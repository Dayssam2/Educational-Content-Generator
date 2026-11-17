import sys
from pathlib import Path
from typing import Dict, List, Optional

from dotenv import load_dotenv

_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_ROOT))
load_dotenv(_ROOT / ".env")

from services.gemini_service import generate_content
from voice_engine import detecter_langue

CONTEXTE = (
    "Tu es l'assistant pedagogique de ClassAssistant, une plateforme qui aide "
    "les enseignants du primaire en Tunisie a creer, personnaliser et corriger "
    "leurs examens grace a l'IA. Le generateur d'examens fonctionne en 4 "
    "etapes (Selection des parametres, Edition des questions, Validation, "
    "Export PDF). Reponds dans la langue de l'enseignant, de facon concise, concrete et "
    "bienveillante, sur la pedagogie, les types de questions, les baremes, "
    "l'utilisation de la plateforme, ou des idees d'exercices par matiere. "
    "Si l'enseignant a joint un document, appuie-toi dessus pour repondre "
    "quand la question s'y rapporte, et dis clairement si le document ne "
    "contient pas de quoi y repondre. "
    "IMPORTANT : les exercices ou questions que tu proposes ICI, dans cette "
    "conversation, restent du texte libre -- ils ne sont PAS ajoutes "
    "automatiquement a un examen sur la plateforme, et l'etape 'Edition des "
    "questions' ne permet pas de coller du texte libre a la place d'une "
    "question generee par l'outil. Ne dis donc JAMAIS a l'enseignant qu'il "
    "peut 'copier-coller' tes suggestions dans une etape du generateur. Si "
    "l'enseignant veut un vrai examen enregistre, modifiable et exportable, "
    "oriente-le vers un des generateurs de la plateforme (depuis le "
    "programme, depuis un PDF, ou depuis la Banque de Questions) plutot que "
    "de laisser croire que la reponse de ce chat y suffit a elle seule. "
    "Ne propose que des types de questions realistes pour la plateforme "
    "(QCM, texte a trous, question ouverte, legende d'image) : n'invente "
    "pas d'autres types (comme le reliage) sans etre sur qu'ils existent. "
    "Si la question sort clairement de ce cadre, dis-le simplement plutot "
    "que d'inventer une reponse."
)

MAX_TOURS_HISTORIQUE = 6

MAX_CARACTERES_PDF = 8_000

CONSIGNE_VOCALE = (
    "\n\nMODE VOCAL : ta reponse sera LUE A VOIX HAUTE par une synthese vocale. "
    "Reponds en 2 a 5 phrases courtes et naturelles, comme a l'oral. "
    "Pas de markdown, pas de titres, pas de tableaux, pas de listes a puces, "
    "pas d'emojis. Si une liste est indispensable, enumere au plus 3 elements "
    "dans une phrase (d'abord..., ensuite..., enfin...). Termine si utile par "
    "une courte question pour poursuivre l'echange."
)
CONSIGNE_LANGUE = {
    "ar": (
        "\n\nLANGUE : l'enseignant s'exprime en arabe. Reponds UNIQUEMENT en arabe "
        "standard simple et clair, adapte a un enseignant tunisien. N'ecris aucune "
        "phrase en francais ; garde seulement les sigles usuels (QCM, PDF) si besoin."
    ),
    "fr": (
        "\n\nLANGUE : l'enseignant s'exprime en francais. Reponds UNIQUEMENT en francais."
    ),
}
RAPPEL_LANGUE = {
    "ar": "(Rappel : ta reponse doit etre entierement en arabe.)",
    "fr": "(Rappel : ta reponse doit etre entierement en francais.)",
}
PROMPT_TRADUCTION = {
    "ar": "Traduis le texte suivant en arabe standard simple et clair. Garde exactement le meme sens et la meme mise en forme, n'ajoute rien, reponds seulement avec la traduction :\n\n",
    "fr": "Traduis le texte suivant en francais simple et clair. Garde exactement le meme sens et la meme mise en forme, n'ajoute rien, reponds seulement avec la traduction :\n\n",
}


def langue_cible(message: str, historique: Optional[List[Dict]] = None, langue: Optional[str] = None) -> str:
    code = (langue or "").split("-")[0].lower()
    if code in ("ar", "fr"):
        return code
    if any(c.isalpha() for c in message or ""):
        return detecter_langue(message)
    for tour in reversed(historique or []):
        if tour.get("role") == "user" and any(c.isalpha() for c in tour.get("contenu") or ""):
            return detecter_langue(tour["contenu"])
    return "fr"


def _tronquer_pdf_si_necessaire(texte: str) -> str:
    if len(texte) <= MAX_CARACTERES_PDF:
        return texte
    return (
        texte[:MAX_CARACTERES_PDF]
        + "\n\n[...document tronque : trop long pour etre envoye en entier a l'IA. "
        "La reponse peut ne pas tenir compte des dernieres parties du document.]"
    )


def _construire_prompt(
    message: str,
    historique: Optional[List[Dict]],
    texte_pdf: Optional[str] = None,
    nom_fichier_pdf: Optional[str] = None,
    mode_vocal: bool = False,
    langue: str = "fr",
) -> str:
    consignes = CONSIGNE_LANGUE.get(langue, CONSIGNE_LANGUE["fr"])
    if mode_vocal:
        consignes += CONSIGNE_VOCALE

    fil = ""
    for tour in (historique or [])[-MAX_TOURS_HISTORIQUE:]:
        role = "Enseignant" if tour.get("role") == "user" else "Assistant"
        contenu = (tour.get("contenu") or "").strip()
        if contenu:
            fil += f"\n{role} : {contenu}"

    contexte_pdf = ""
    if texte_pdf and texte_pdf.strip():
        nom = nom_fichier_pdf or "document joint"
        contexte_pdf = (
            f"\n\nDocument fourni par l'enseignant ({nom}) :\n"
            f"{_tronquer_pdf_si_necessaire(texte_pdf.strip())}\n"
        )

    return (
        f"{CONTEXTE}{consignes}{contexte_pdf}\n\nConversation en cours :{fil}\n"
        f"Enseignant : {message}\n{RAPPEL_LANGUE.get(langue, RAPPEL_LANGUE['fr'])}\nAssistant :"
    )


def _corriger_langue(reponse: str, langue: str) -> str:
    if detecter_langue(reponse) == langue:
        return reponse
    try:
        traduction = generate_content(PROMPT_TRADUCTION[langue] + reponse)
    except Exception as e:
        print(f"[assistant_engine] Traduction impossible ({e}) : reponse renvoyee telle quelle.")
        return reponse
    traduction = (traduction or "").strip()
    if traduction and detecter_langue(traduction) == langue:
        return traduction
    return reponse


def repondre(
    message: str,
    historique: Optional[List[Dict]] = None,
    texte_pdf: Optional[str] = None,
    nom_fichier_pdf: Optional[str] = None,
    mode_vocal: bool = False,
    langue: Optional[str] = None,
) -> str:
    message = (message or "").strip()
    if not message:
        raise ValueError("Message vide")

    cible = langue_cible(message, historique, langue)
    prompt = _construire_prompt(message, historique, texte_pdf, nom_fichier_pdf, mode_vocal, cible)
    try:
        reponse = generate_content(prompt)
    except Exception as e:
        raise RuntimeError(f"Erreur Gemini : {e}") from e

    if not reponse or not reponse.strip():
        raise RuntimeError("Reponse vide de l'IA")

    return _corriger_langue(reponse.strip(), cible)