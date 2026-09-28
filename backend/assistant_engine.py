"""
Moteur de l'assistant pedagogique conversationnel (page Assistant / lien
"Aide" du frontend), appele par POST /api/assistant/chat (voir main.py).

Ce module n'existait pas : le champ de saisie de la page Assistant etait un
mockup visuel, jamais branche sur rien (voir le commentaire "TODO API" qui
etait dans Assistant.jsx, et la note en tete de main.py qui explique que le
chatbot conversationnel /api/chat a ete retire au profit du wizard
structure). Ceci remet une reponse en langage libre, mais pour une question
ponctuelle plutot que pour generer un examen complet.

Reutilise le meme services/gemini_service.py que quiz_engine.py -- pas de
nouvelle dependance, pas de nouvelle cle API a configurer.

Aucun historique n'est persiste cote backend : le frontend renvoie a chaque
appel les derniers echanges de la conversation en cours (stockes en state
React), et tout est perdu au rechargement de la page -- suffisant pour de
l'aide ponctuelle. A revoir (table dediee) si vous voulez un historique
retrouve d'une session a l'autre ou visible depuis un autre appareil.

MISE A JOUR : l'assistant peut maintenant repondre a partir d'un PDF joint
par l'enseignant a sa question (programme, fiche de cours, sujet
d'examen...), en plus de l'historique de conversation. Le texte est deja
extrait par main.py (reutilise pdf_quiz_engine.extraire_texte_pdf, meme
fonction que pour POST /api/examens/depuis-pdf -- pas de deuxieme
implementation d'extraction PDF) : ce module ne fait QUE l'inserer dans le
prompt, il ne decode jamais de base64 ni ne lit de PDF lui-meme. Meme
usage PONCTUEL que le reste de ce fichier : ce texte n'est ni indexe ni
conserve au-dela de la reponse en cours.
"""

import sys
from pathlib import Path
from typing import Dict, List, Optional

from dotenv import load_dotenv

_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_ROOT))
load_dotenv(_ROOT / ".env")

from services.gemini_service import generate_content

# Cadre le sujet (pedagogie / plateforme) sans etre trop rigide -- sinon
# l'assistant refuse des questions raisonnablement liees a l'evaluation
# juste parce qu'elles ne rentrent pas mot pour mot dans une case.
CONTEXTE = (
    "Tu es l'assistant pedagogique de ClassAssistant, une plateforme qui aide "
    "les enseignants du primaire en Tunisie a creer, personnaliser et corriger "
    "leurs examens grace a l'IA. Le generateur d'examens fonctionne en 4 "
    "etapes (Selection des parametres, Edition des questions, Validation, "
    "Export PDF). Reponds en francais, de facon concise, concrete et "
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

# Au-dela, le prompt grossit pour rien : le debut d'une longue conversation
# n'aide plus a repondre a la question du moment.
MAX_TOURS_HISTORIQUE = 6

# Plus court que pdf_quiz_engine.MAX_CARACTERES_PDF (12 000) : ici il s'agit
# de repondre a UNE question sur un extrait du document, pas de generer un
# examen complet a partir de tout son contenu -- pas besoin d'un contexte
# aussi large, et ca garde le prompt (donc le temps de reponse) plus leger.
MAX_CARACTERES_PDF = 8_000


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
) -> str:
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
        f"{CONTEXTE}{contexte_pdf}\n\nConversation en cours :{fil}\n"
        f"Enseignant : {message}\nAssistant :"
    )


def repondre(
    message: str,
    historique: Optional[List[Dict]] = None,
    texte_pdf: Optional[str] = None,
    nom_fichier_pdf: Optional[str] = None,
) -> str:
    """Point d'entree appele par POST /api/assistant/chat (main.py).

    `texte_pdf` est deja extrait par main.py AVANT d'arriver ici (voir
    pdf_quiz_engine.extraire_texte_pdf) : ce module ne s'occupe jamais du
    decodage base64 ni de la lecture du fichier lui-meme -- meme separation
    des responsabilites que pdf_quiz_engine.generer_quiz_depuis_pdf, qui ne
    fait pas non plus de decodage (fait dans main.py:_decoder_pdf_base64)."""
    message = (message or "").strip()
    if not message:
        raise ValueError("Message vide")

    prompt = _construire_prompt(message, historique, texte_pdf, nom_fichier_pdf)
    try:
        reponse = generate_content(prompt)
    except Exception as e:
        raise RuntimeError(f"Erreur Gemini : {e}") from e

    if not reponse or not reponse.strip():
        raise RuntimeError("Reponse vide de l'IA")

    return reponse.strip()