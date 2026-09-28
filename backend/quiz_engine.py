"""
Moteur de generation de quiz, appele par POST /api/examens (voir main.py).

Comme l'ancien quiz_orchestrator.py (version chatbot), ce module NE REECRIT
PAS rag_system/, services/gemini_service.py ni prompts/quiz_prompt.py -- il
les importe et les appelle. La seule chose qui change par rapport a la
version chatbot : plus besoin de extraire_infos_ia() ni
appliquer_resultat_ia() (comprehension de texte libre), puisque le wizard
React envoie deja matiere/niveau/chapitres/nb_questions de facon structuree
(boutons et menus deroulants cote frontend). generer_quiz(), lister_chapitres()
et lister_niveaux_disponibles() sont repris tels quels : c'est la meme
"vraie" logique RAG + Gemini, juste appelee differemment.

MISE A JOUR : models.models EST DE NOUVEAU UTILISE ICI (voir
_construire_question_feuille / create_examen_from_response plus bas).
models.py connait maintenant 12 types (les 4 d'origine + association,
remise_en_ordre, tri, calcul, legende, dictee, redaction, et le
regroupement "lecture") -- ce fichier les genere et les valide tous.

IMPORTANT -- ce qui n'a PAS ete touche dans cette mise a jour :
pdf_export.py et validation.py sont restes EXACTEMENT comme avant. Deux
consequences a connaitre :

1. Ils ne savent afficher/valider correctement que qcm / vrai_faux /
   ouverte / texte_trous. Une question association/tri/calcul/legende/
   dictee/redaction sera quand meme stockee et validee "structurellement"
   par ce fichier (via models.py), mais pdf_export.py l'affichera sans
   zone de reponse dediee (juste la consigne) tant qu'il n'est pas mis a
   jour lui aussi.

2. "lecture" est un REGROUPEMENT dans models.py (un texte + plusieurs
   sous-questions), mais validation.py/pdf_export.py attendent une liste
   PLATE de questions, chacune avec ses propres points. On aplati donc
   chaque exercice de lecture en autant d'entrees que de sous-questions
   au moment de construire la sortie (voir _aplatir_questions /
   _vers_question_api plus bas) : chaque sous-question recupere le texte
   partage dans son propre champ "support" si elle n'a pas le sien, et le
   titre d'exercice est mis sur la premiere sous-question seulement (pour
   ne pas le repeter). Le bareme est reparti sur le nombre REEL de
   sous-questions, pas sur le nombre de blocs.
"""

import sys
import json
from pathlib import Path
from typing import Optional, Dict, List, Tuple

from dotenv import load_dotenv
from pydantic import ValidationError

_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_ROOT))
load_dotenv(_ROOT / ".env")

from services.gemini_service import generate_content
from rag_system import SimpleRAG, DocumentLoader
from prompts.quiz_prompt import construire_prompt
import image_service

# La structure reelle du projet a `models.py` a l'interieur d'un paquet
# `models/` chez certains (d'ou "models.models" dans les commentaires
# ci-dessus) -- mais pas chez tous. On tente les deux, dans cet ordre :
# supprimez la branche qui ne correspond pas a votre projet.
try:
    from models.models import (
        Examen, QuestionQCM, QuestionVraiFaux, QuestionOuverte, QuestionRedaction,
        QuestionTrous, QuestionAssociation, QuestionOrdre, QuestionTri,
        QuestionCalcul, QuestionLegende, QuestionDictee, ExerciceLecture,
        ImageRef, TableauDonnees,
    )
except ImportError:
    from models import (
        Examen, QuestionQCM, QuestionVraiFaux, QuestionOuverte, QuestionRedaction,
        QuestionTrous, QuestionAssociation, QuestionOrdre, QuestionTri,
        QuestionCalcul, QuestionLegende, QuestionDictee, ExerciceLecture,
        ImageRef, TableauDonnees,
    )


class QuizGenerationError(Exception):
    """Levee quand le RAG ne trouve rien de pertinent, ou que Gemini echoue."""


MATIERE_DISPLAY = {
    "mathematique": "الرياضيات",
    "arabe": "اللغة العربية",
    "science": "الإيقاظ العلمي",
    "francais": "Français",
    "histoire_geo": "التاريخ والجغرافيا",
}

BAREME_TOTAL = 20  # note sur 20 : convention standard des examens tunisiens

# MISE A JOUR : les images sont maintenant generees les unes APRES les
# autres, plus en parallele. Un run reel a montre que meme 4-5 appels
# lances en meme temps se faisaient TOUS rejeter en 429 d'un coup : le
# niveau gratuit du modele d'image autorise beaucoup moins de requetes
# par minute que le modele de texte, et les lancer en rafale garantissait
# de depasser cette limite. C'est plus lent (chaque image peut attendre
# et reessayer, voir image_service.MAX_TENTATIVES) mais ca reussit
# reellement, plutot que d'echouer vite et systematiquement.


def _repartir_bareme(nb_questions: int) -> List[int]:
    """Repartit BAREME_TOTAL points sur nb_questions, le plus egalement
    possible, en garantissant une somme EXACTE de 20 (les premieres
    questions recoivent le point restant s'il ne se divise pas rond).
    Ex: 4 questions -> [5,5,5,5]. 7 questions -> [3,3,3,3,3,3,2].

    IMPORTANT : nb_questions doit etre le nombre de questions REELLEMENT
    gradables une fois les exercices de lecture APLATIS (voir
    _aplatir_questions) -- pas le nombre de blocs de haut niveau, sinon un
    exercice de lecture a 3 sous-questions ne recevrait qu'1/N-ieme du
    bareme au lieu de 3/N-iemes.

    Simplification assumee : repartition egale entre toutes les questions,
    quel que soit leur type. Le systeme tunisien pondere parfois les
    exercices differemment (un probleme note plus qu'un QCM) -- si vos
    enseignants suivent une ponderation precise par type, dites-le moi et
    je l'ajoute plutot que de deviner un bareme specifique."""
    if nb_questions <= 0:
        return []
    base = BAREME_TOTAL // nb_questions
    reste = BAREME_TOTAL % nb_questions
    return [base + (1 if i < reste else 0) for i in range(nb_questions)]

_rag_engine: Optional[SimpleRAG] = None


def get_rag_engine() -> SimpleRAG:
    global _rag_engine
    if _rag_engine is None:
        _rag_engine = SimpleRAG(lessons_dir=str(_ROOT / "database_tunisienne"))
    return _rag_engine


_document_loader: Optional[DocumentLoader] = None


def get_document_loader() -> DocumentLoader:
    global _document_loader
    if _document_loader is None:
        _document_loader = DocumentLoader(lessons_dir=str(_ROOT / "database_tunisienne"))
        _document_loader.load_all_documents()
    return _document_loader


def lister_chapitres(matiere: str, niveau: str) -> List[str]:
    """Titres exacts des chapitres disponibles pour une matiere/niveau, dans
    l'ordre du fichier JSON source. Alimente GET /api/chapitres."""
    loader = get_document_loader()
    docs = loader.get_by_matiere_niveau(matiere, str(niveau))
    return [d.metadata.get("titre", "Sans titre") for d in docs]


def lister_niveaux_disponibles(matiere: str) -> List[str]:
    """Niveaux (1 a 6) pour lesquels du contenu existe reellement pour cette
    matiere. Utile pour ne pas proposer un niveau vide dans le formulaire."""
    loader = get_document_loader()
    return [n for n in ["1", "2", "3", "4", "5", "6"] if loader.get_by_matiere_niveau(matiere, n)]


class ParametresExamen:
    def __init__(self, nom: str, matiere: str, niveau: str, chapitres: List[str]):
        self.nom_examen = nom
        self.matiere = matiere
        self.niveau = niveau
        self.chapitres = chapitres
        self.nb_questions = 5
        self.duree_minutes = 30
        self.langue = "fr" if matiere == "Français" else "ar"
        self.types_questions = ["qcm", "vrai_faux", "question_ouverte"]
        self.difficulte = "normale"
        # NOUVEAU -- consignes libres de l'enseignant (etape Selection), ou
        # recommandations de l'IA a corriger (etape Validation -> voir
        # POST /api/examens/{id}/regenerer dans main.py). None par defaut :
        # ne change rien au prompt si personne n'en fournit (voir
        # generer_quiz_avec_gemini plus bas).
        self.notes = None
        # NOUVEAU -- repartition optionnelle du nombre de questions par
        # type, ex: {"qcm": 4, "texte_trous": 4, "ouverte": 2} pour un
        # total de 10 (voir main.py:ExamenCreateIn.repartition_types).
        # None par defaut : Gemini choisit librement parmi
        # self.types_questions, comme avant -- c'est une CONSIGNE
        # supplementaire dans le prompt (voir generer_quiz_avec_gemini),
        # pas une contrainte forcee cote code : Gemini peut s'en ecarter
        # legerement, comme pour le reste du prompt.
        self.repartition_types = None


def _vers_reponse_texte(valeur, defaut="") -> str:
    """Gemini renvoie parfois une liste pour un texte a trous a plusieurs
    blancs (ex: ['امام', 'وراء']) plutot qu'une seule chaine. models.py
    accepte cette liste directement en interne (QuestionTrous), mais le
    contrat de sortie existant (reponseAttendue, lu par pdf_export.py)
    attend une chaine -- ce join ne sert donc qu'a CETTE conversion
    finale, plus a la validation."""
    if isinstance(valeur, list):
        return " / ".join(str(v) for v in valeur)
    return str(valeur) if valeur not in (None, "") else defaut


def build_rag_context(rag_results: List[Dict]) -> str:
    if not rag_results:
        return "Aucun contenu trouve dans le programme."
    context_parts = ["=== CONTEXTE DU PROGRAMME ===\n"]
    for i, result in enumerate(rag_results[:5], 1):
        metadata = result["metadata"]
        content = result["content"]
        context_parts.append(f"\n[Extrait {i}]")
        context_parts.append(f"Matiere: {metadata.get('matiere', 'N/A')}")
        context_parts.append(f"Niveau: {metadata.get('niveau', 'N/A')}")
        context_parts.append(f"Titre: {metadata.get('titre', 'N/A')}")
        context_parts.append(f"Contenu:\n{content}")
        context_parts.append("")
    return "\n".join(context_parts)


# ---------------------------------------------------------------------------
# JSON brut de Gemini -> instances Pydantic de models.py
# ---------------------------------------------------------------------------

def _image_depuis_json(q: Dict) -> Optional["ImageRef"]:
    """Accepte deux formes dans le JSON de Gemini : soit un objet "image"
    deja complet ({"url" / "description" / "alt_text": ...}), soit le
    raccourci "image_description" (une phrase) -- le plus courant, puisque
    c'est ce que le prompt (voir generer_quiz_avec_gemini) lui demande
    d'utiliser. Ne genere RIEN ici (pas d'appel reseau dans cette
    fonction) : `image.url` reste vide a ce stade, seule `description`
    est posee. La vraie generation (image_service.py) se fait plus tard,
    en une seule passe apres coup sur TOUTE la liste de questions -- voir
    _generer_images_manquantes -- pour pouvoir l'enrichir du contexte
    matiere/niveau/chapitre (pas encore connu ici, question par question)
    et pour paralleliser les appels plutot que d'attendre chacun son tour."""
    if isinstance(q.get("image"), dict):
        try:
            return ImageRef(**q["image"])
        except (ValidationError, TypeError):
            pass
    description = (q.get("image_description") or "").strip()
    return ImageRef(description=description) if description else None


def _champs_communs(q: Dict) -> Dict:
    """Champs partages par tous les types de question (voir
    models.QuestionBase) : toujours lus avec .get(), jamais obligatoires."""
    tableau = q.get("tableau")
    return {
        "titre_exercice": q.get("titre_exercice") or None,
        "support": q.get("support") or None,
        "tableau": TableauDonnees(**tableau) if tableau else None,
        "image": _image_depuis_json(q),
        "explication": q.get("explication", ""),
    }


def _construire_question_feuille(q: Dict):
    """Construit UNE question (pas un exercice de lecture) a partir de son
    dict JSON brut -- reutilise a l'identique pour les questions de haut
    niveau ET pour les sous_questions d'un exercice de "lecture" (voir
    create_examen_from_response plus bas), pour ne pas dupliquer cette
    logique deux fois."""
    commun = _champs_communs(q)
    t = q.get("type")

    if t == "qcm":
        options = q.get("options", [])
        brut = q.get("reponse_correcte")
        if isinstance(brut, int) and 0 <= brut < len(options):
            reponse_correcte_text = options[brut]
        else:
            reponse_correcte_text = str(brut) if brut is not None else ""
        return QuestionQCM(
            type="qcm", question=q["question"], options=options,
            reponse_correcte=reponse_correcte_text, **commun,
        )

    if t == "vrai_faux":
        reponse_bool = q.get("reponse_correcte")
        if isinstance(reponse_bool, str):
            if reponse_bool in ['صواب', 'صحيح', 'نعم', 'true', 'True', 'صحيحة']:
                reponse_bool = True
            elif reponse_bool in ['خطأ', 'خاطئ', 'لا', 'false', 'False', 'خاطئة']:
                reponse_bool = False
            else:
                reponse_bool = True
        return QuestionVraiFaux(
            type="vrai_faux", question=q["question"], reponse_correcte=bool(reponse_bool), **commun,
        )

    if t in ("question_ouverte", "ouverte"):
        reponse_attendue = q.get("reponse_correcte", q.get("reponse_exemple"))
        return QuestionOuverte(
            type="ouverte", question=q["question"],
            reponse_correcte=_vers_reponse_texte(reponse_attendue, "Reponse a definir"),
            **commun,
        )

    if t == "redaction":
        return QuestionRedaction(
            type="redaction", question=q["question"],
            criteres_evaluation=q.get("criteres_evaluation"),
            longueur_min_mots=q.get("longueur_min_mots"),
            **commun,
        )

    if t in ("texte_trous", "texte_a_trous"):
        return QuestionTrous(
            type="texte_trous", question=q["question"],
            reponse_correcte=q.get("reponse_correcte", ""),
            **commun,
        )

    if t == "association":
        return QuestionAssociation(
            type="association", question=q["question"],
            colonne_gauche=q.get("colonne_gauche", []),
            colonne_droite=q.get("colonne_droite", []),
            reponse_correcte=q.get("reponse_correcte", []),
            **commun,
        )

    if t == "remise_en_ordre":
        return QuestionOrdre(
            type="remise_en_ordre", question=q["question"],
            elements=q.get("elements", []),
            reponse_correcte=q.get("reponse_correcte", []),
            **commun,
        )

    if t == "tri":
        return QuestionTri(
            type="tri", question=q["question"],
            categories=q.get("categories", []),
            elements=q.get("elements", []),
            reponse_correcte=q.get("reponse_correcte", []),
            **commun,
        )

    if t == "calcul":
        return QuestionCalcul(
            type="calcul", question=q["question"],
            reponse_correcte=q.get("reponse_correcte"),
            unite=q.get("unite"),
            tolerance=q.get("tolerance", 0) or 0,
            **commun,
        )

    if t == "legende":
        image = commun.pop("image", None)
        if image is None:
            # QuestionLegende exige une image (voir models.py) -- sans ca,
            # Pydantic le dirait aussi, mais avec un message moins parlant
            # que celui-ci pour diagnostiquer un prompt Gemini qui a
            # oublie "image_description".
            raise ValueError("Une question 'legende' doit avoir une image (image_description manquant).")
        return QuestionLegende(
            type="legende", question=q["question"], image=image,
            reponse_correcte=q.get("reponse_correcte", []),
            **commun,
        )

    if t == "dictee":
        return QuestionDictee(
            type="dictee",
            question=q.get("question") or "Ecris le texte dicte par ton enseignant.",
            texte_dictee=q.get("texte_dictee", ""),
            mots_difficiles=q.get("mots_difficiles"),
            **commun,
        )

    raise KeyError(f"Type de question inconnu : {t!r}")


def create_examen_from_response(quiz_data: Dict, params: ParametresExamen) -> Examen:
    items = []
    for q in quiz_data.get("questions", []):
        try:
            if q.get("type") == "lecture":
                sous_questions = []
                for sq in q.get("sous_questions", []):
                    try:
                        sous_questions.append(_construire_question_feuille(sq))
                    except (ValidationError, KeyError, TypeError, ValueError) as e:
                        print(f"[quiz_engine] Sous-question de lecture ignoree (invalide) : {e}")
                        continue
                if not sous_questions:
                    print("[quiz_engine] Exercice de lecture ignore (aucune sous-question valide).")
                    continue
                items.append(ExerciceLecture(
                    type="lecture",
                    titre_exercice=q.get("titre_exercice"),
                    texte=q.get("texte") or q.get("support"),
                    image=_image_depuis_json(q),
                    sous_questions=sous_questions,
                ))
            else:
                items.append(_construire_question_feuille(q))
            # type inconnu (ni "lecture" ni reconnu dans _construire_question_feuille)
            # -> KeyError levee ci-dessus, rattrapee juste en dessous : ignore silencieusement,
            # meme comportement qu'avant cette mise a jour.
        except (ValidationError, KeyError, TypeError, ValueError) as e:
            print(f"[quiz_engine] Question ignoree (invalide) : {e}")
            continue

    if not items:
        raise QuizGenerationError(
            "Gemini n'a renvoye aucune question valide (voir les logs backend "
            "pour le detail de chaque rejet)."
        )

    langue = quiz_data.get("langue", "ar")
    if langue not in ("fr", "ar"):
        langue = "ar"

    try:
        duree = int(quiz_data.get("duree_estimee_minutes", 30) or 30)
    except (TypeError, ValueError):
        duree = 30

    examen = Examen(
        matiere=quiz_data.get("matiere", params.matiere),
        niveau=quiz_data.get("niveau", params.niveau),
        chapitre=quiz_data.get("chapitre", ", ".join(params.chapitres)),
        langue=langue,
        duree_estimee_minutes=duree,
        questions=items,
    )

    _generer_images_manquantes(examen, params)
    return examen


def _prompt_image_enrichi(question, params: "ParametresExamen") -> str:
    """Enrichit la description d'image fournie par Gemini (une phrase
    isolee, ex: "trois pommes rouges") avec le contexte de l'examen --
    matiere, niveau, chapitre -- et l'enonce de la question elle-meme.
    Sans ce contexte, l'image generee ne sait rien du niveau scolaire ni
    du sujet reel (une "plante" dessinee pour une 1ere annee n'a pas le
    meme niveau de detail que pour une 6eme, par exemple)."""
    morceaux = [
        f"Matiere : {params.matiere}.",
        f"Niveau scolaire : {params.niveau}.",
    ]
    if params.chapitres:
        morceaux.append(f"Chapitre : {', '.join(params.chapitres)}.")
    if getattr(question, "question", None):
        morceaux.append(f"Question posee a l'eleve : {question.question}")
    morceaux.append(f"Ce que l'image doit representer : {question.image.description}")
    return " ".join(morceaux)


def _images_a_generer(items: List) -> List:
    """Rassemble TOUTES les images en attente d'une vraie generation --
    celles des questions isolees, celles des sous-questions d'un exercice
    de lecture, ET celle du bloc de lecture lui-meme (son image de
    support partagee, independante de ses sous-questions)."""
    a_generer = []
    for item in items:
        if item.type == "lecture":
            if item.image and item.image.description and not item.image.url:
                a_generer.append(item)
            a_generer.extend(
                sq for sq in item.sous_questions
                if sq.image and sq.image.description and not sq.image.url
            )
        else:
            if item.image and item.image.description and not item.image.url:
                a_generer.append(item)
    return a_generer


def _generer_images_manquantes(examen: Examen, params: "ParametresExamen") -> None:
    """Genere, l'UNE APRES L'AUTRE (voir la note sur MAX_TENTATIVES plus
    haut -- le parallelisme causait des 429 systematiques), la vraie
    image de chaque question/bloc qui n'a encore qu'une description en
    attente. Best effort : une image qui echoue meme apres les retries de
    image_service.generer_image() est retiree plutot que de laisser un
    champ image a moitie rempli -- SAUF pour "legende", qui EXIGE une
    image (voir models.py) : dans ce cas on garde la description, pour
    que la question reste valide et affichable (avec un "pas encore
    generee" cote frontend) plutot que de la perdre completement."""
    a_generer = _images_a_generer(examen.questions)
    if not a_generer:
        return

    for item in a_generer:
        prompt = _prompt_image_enrichi(item, params)
        url = image_service.generer_image(prompt)
        if url:
            item.image.url = url
            item.image.alt_text = item.image.alt_text or item.image.description
        elif item.type != "legende":
            item.image = None
        # sinon (legende sans image generee) : on garde item.image.description,
        # voir docstring ci-dessus.


def generer_quiz_avec_gemini(params: ParametresExamen, contexte_rag: str) -> Optional[Examen]:
    prompt = construire_prompt(params, contexte_programme=contexte_rag)

    # NOUVEAU -- consignes libres (Selection) et/ou recommandations a
    # corriger (regeneration depuis Validation, voir main.py). Place
    # AVANT le format JSON pour que Gemini les traite comme des
    # instructions de fond, pas comme un simple detail technique noye au
    # milieu du schema attendu.
    if getattr(params, "notes", None):
        prompt += f"""

Consignes supplementaires de l'enseignant, a respecter en priorite :
{params.notes.strip()}
"""

    # NOUVEAU -- repartition par type demandee par l'enseignant (voir
    # ParametresExamen.repartition_types). Place comme les "notes"
    # ci-dessus, AVANT le format JSON, pour que Gemini la traite comme
    # une contrainte de fond -- pas une garantie absolue (Gemini peut
    # s'en ecarter comme pour toute consigne en langage naturel), mais
    # une instruction bien plus precise que la simple liste de types
    # autorises juste en dessous.
    if getattr(params, "repartition_types", None):
        lignes = "\n".join(
            f"- {n} question(s) de type \"{t}\""
            for t, n in params.repartition_types.items() if n
        )
        prompt += f"""

Repartition EXACTE des types de questions demandee par l'enseignant --
respecte precisement ces quantites (leur somme correspond au nombre total
de questions demande) :
{lignes}
"""

    prompt += """

Genere le quiz au format JSON. Utilise UNIQUEMENT les types de questions
demandes par l'enseignant (voir plus haut), parmi : qcm, vrai_faux,
ouverte, redaction, texte_trous, association, remise_en_ordre, tri,
calcul, legende, dictee, lecture.

Champs optionnels, utilisables sur presque n'importe quel type de
question quand c'est pertinent pour ce niveau/cette matiere (sinon, ne
les mets pas) :
- "titre_exercice" : un titre court, ex: "Exercice 1".
- "support" : un texte ou document court sur lequel porte UNE SEULE
  question. Pour PLUSIEURS questions sur le MEME texte, utilise plutot le
  type "lecture" ci-dessous (ne repete pas le texte sur chaque question).
- "tableau" : {"headers": [...], "rows": [[...], ...]} pour un probleme
  avec des donnees chiffrees.
- "image_description" : UNE SEULE PHRASE decrivant une illustration
  simple, utile pour un enfant tunisien du primaire (ex: "trois pommes
  rouges sur une table"). N'utilise ce champ QUE quand une image aide
  vraiment a comprendre la question -- jamais pour decorer. Pour le type
  "legende" ci-dessous, ce champ est OBLIGATOIRE. Ne decris jamais du
  texte ecrit a l'interieur de l'image (les modeles d'image rendent tres
  mal l'arabe).

Un exemple de chaque type :
{
  "matiere": "nom de la matiere",
  "niveau": "niveau scolaire",
  "chapitre": "chapitre couvert",
  "langue": "ar",
  "duree_estimee_minutes": 30,
  "questions": [
    {
      "type": "qcm", "question": "...",
      "options": ["...", "...", "...", "..."], "reponse_correcte": 0,
      "explication": "..."
    },
    {
      "type": "vrai_faux", "question": "...", "reponse_correcte": true
    },
    {
      "type": "ouverte", "question": "...", "reponse_correcte": "..."
    },
    {
      "type": "redaction", "question": "Raconte tes vacances en quelques phrases.",
      "criteres_evaluation": ["Utilise le passe compose", "Au moins 5 lignes"],
      "longueur_min_mots": 40
    },
    {
      "type": "texte_trous", "question": "Le chat est ___ le canape.",
      "reponse_correcte": "sous"
    },
    {
      "type": "association", "question": "Relie chaque chiffre a la bonne quantite.",
      "colonne_gauche": ["1", "2", "3"], "colonne_droite": ["...", "...", "..."],
      "reponse_correcte": [1, 0, 2]
    },
    {
      "type": "remise_en_ordre", "question": "Remets ces evenements dans l'ordre.",
      "elements": ["...", "...", "..."], "reponse_correcte": [0, 1, 2]
    },
    {
      "type": "tri", "question": "Classe ces mots dans le bon tableau.",
      "categories": ["Noms", "Verbes"], "elements": ["chat", "courir", "table"],
      "reponse_correcte": [0, 1, 0]
    },
    {
      "type": "calcul", "question": "Un champ mesure 12m sur 5m. Quelle est son aire ?",
      "reponse_correcte": 60, "unite": "m2"
    },
    {
      "type": "legende", "question": "Legende les parties de la plante.",
      "image_description": "une plante avec les numeros 1, 2 et 3 pointant vers la racine, la tige et une feuille",
      "reponse_correcte": ["racine", "tige", "feuille"]
    },
    {
      "type": "dictee", "texte_dictee": "Le petit chat noir dort sur le tapis."
    },
    {
      "type": "lecture", "titre_exercice": "Lecture",
      "texte": "Un court texte de lecture adapte au niveau demande...",
      "sous_questions": [
        {"type": "ouverte", "question": "...", "reponse_correcte": "..."},
        {"type": "vrai_faux", "question": "...", "reponse_correcte": true}
      ]
    }
  ]
}

Reponds UNIQUEMENT avec le JSON."""

    try:
        response_text = generate_content(prompt)
        response_text = response_text.strip()
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]
        response_text = response_text.strip()
        quiz_data = json.loads(response_text)
        return create_examen_from_response(quiz_data, params)
    except Exception as e:
        print(f"Erreur Gemini: {e}")
        # Avant : `return None` avalait l'exception -- l'appelant ne savait
        # plus DU TOUT pourquoi ca avait echoue (quota Gemini ? cle absente ?
        # JSON invalide ?) et affichait un message generique "verifie ta cle
        # API" meme quand la vraie cause etait un simple 429 de quota. On
        # relance plutot l'exception pour que generer_quiz_pour_wizard
        # puisse donner un message qui correspond a la vraie cause.
        raise


# ---------------------------------------------------------------------------
# Examen (Pydantic, eventuellement imbrique via "lecture") -> contrat de
# sortie plat existant (voir la note en tete de fichier)
# ---------------------------------------------------------------------------

def _aplatir_questions(items: List) -> List[Tuple[Optional["ExerciceLecture"], bool, object]]:
    """Deplie chaque exercice de lecture en autant d'entrees (lecture,
    est_premiere, sous_question) que de sous-questions ; une question
    isolee devient (None, False, question). `est_premiere` sert a savoir
    a laquelle des sous-questions accrocher le titre_exercice du bloc
    (une seule fois, pas repete sur chacune) -- voir _vers_question_api."""
    plat: List[Tuple[Optional["ExerciceLecture"], bool, object]] = []
    for item in items:
        if item.type == "lecture":
            for i, sq in enumerate(item.sous_questions):
                plat.append((item, i == 0, sq))
        else:
            plat.append((None, False, item))
    return plat


def _vers_question_api(id_str: str, q, points: int, lecture=None, est_premiere: bool = False) -> Dict:
    """Convertit une question (instance Pydantic de models.py) vers le
    format attendu par le frontend/pdf_export.py/validation.py (id, type,
    points, question, + les champs specifiques au type) -- INCHANGE pour
    qcm/vrai_faux/ouverte/texte_trous, pour ne rien casser cote
    frontend/pdf_export.py/validation.py (aucun des 3 n'a ete modifie ici).

    `lecture`/`est_premiere` : si cette question vient d'un exercice de
    lecture aplati (voir _aplatir_questions), elle recupere le texte/
    l'image partages du bloc quand elle n'a pas les siens -- sinon ce
    texte serait perdu, puisque validation.py/pdf_export.py ne
    comprennent pas encore le regroupement "lecture" lui-meme."""
    base: Dict = {
        "id": id_str,
        "type": q.type,
        "points": points,
        "question": q.question,
    }

    titre_exercice = q.titre_exercice or (lecture.titre_exercice if lecture and est_premiere else None)
    support = q.support or (lecture.texte if lecture else None)
    image = q.image or (lecture.image if lecture else None)

    if titre_exercice:
        base["titre_exercice"] = titre_exercice
    if support:
        base["support"] = support
    if q.tableau:
        base["tableau"] = q.tableau.model_dump()
    if image and image.url:
        base["image"] = {"url": image.url, "alt_text": image.alt_text}

    if q.type == "qcm":
        base["options"] = q.options
        try:
            base["reponseCorrecteIndex"] = q.options.index(q.reponse_correcte)
        except ValueError:
            base["reponseCorrecteIndex"] = 0
    elif q.type == "vrai_faux":
        base["reponseCorrecte"] = bool(q.reponse_correcte)
    elif q.type == "association":
        base["colonne_gauche"] = q.colonne_gauche
        base["colonne_droite"] = q.colonne_droite
        base["reponseCorrecte"] = q.reponse_correcte
    elif q.type == "remise_en_ordre":
        base["elements"] = q.elements
        base["reponseCorrecte"] = q.reponse_correcte
    elif q.type == "tri":
        base["categories"] = q.categories
        base["elements"] = q.elements
        base["reponseCorrecte"] = q.reponse_correcte
    elif q.type == "calcul":
        base["reponseAttendue"] = q.reponse_correcte
        if q.unite:
            base["unite"] = q.unite
        if q.tolerance:
            base["tolerance"] = q.tolerance
    elif q.type == "legende":
        base["reponseCorrecte"] = q.reponse_correcte
    elif q.type == "dictee":
        base["texte_dictee"] = q.texte_dictee
        if q.mots_difficiles:
            base["mots_difficiles"] = q.mots_difficiles
    elif q.type == "redaction":
        if q.criteres_evaluation:
            base["criteres_evaluation"] = q.criteres_evaluation
        if q.longueur_min_mots:
            base["longueur_min_mots"] = q.longueur_min_mots
    else:  # ouverte, texte_trous
        base["reponseAttendue"] = _vers_reponse_texte(q.reponse_correcte)
    return base


def generer_quiz_pour_wizard(
    matiere_key: str,
    niveau: str,
    chapitres: List[str],
    nb_questions: int,
    difficulte: str = "normale",
    types_questions: Optional[List[str]] = None,
    duree: str = "60 min",
    notes: Optional[str] = None,
    repartition_types: Optional[Dict[str, int]] = None,
) -> Dict:
    """
    Point d'entree appele par POST /api/examens (main.py) ET par
    POST /api/examens/{id}/regenerer (meme fonction reutilisee pour les
    deux : une regeneration n'est rien d'autre qu'une generation avec les
    memes parametres d'origine + des consignes supplementaires -- voir
    `notes`).

    Reprend exactement la logique de generer_quiz(state) de la version
    chatbot (voir la note dans ce fichier original sur pourquoi un titre
    EXACT passe par DocumentLoader plutot que par SimpleRAG.search(), pour
    eviter que rag_engine.py ne merge des chapitres voisins non demandes) --
    seule la signature change : parametres explicites plutot qu'un dict
    d'etat de conversation.

    `notes` : consignes libres de l'enseignant (etape Selection), et/ou
    recommandations de l'IA a corriger lors d'une regeneration (voir
    _construire_notes_regeneration dans main.py) -- simplement ajoutees
    au prompt envoye a Gemini, voir generer_quiz_avec_gemini.

    `repartition_types` : nombre de questions VOULU pour chaque type
    (ex: {"qcm": 4, "ouverte": 6}), optionnel -- voir
    main.py:ExamenCreateIn.repartition_types pour la validation cote API
    (la somme doit correspondre a nb_questions) et ParametresExamen pour
    comment c'est transmis au prompt. Si absent, Gemini choisit librement
    parmi `types_questions`, comme avant.
    """
    matiere_display = MATIERE_DISPLAY.get(matiere_key, matiere_key)

    loader = get_document_loader()
    docs_matiere_niveau = loader.get_by_matiere_niveau(matiere_key, str(niveau))
    docs_par_titre = {d.metadata.get("titre"): d for d in docs_matiere_niveau}

    rag_results: List[Dict] = []
    chapitres_non_trouves: List[str] = []

    for titre in chapitres:
        doc = docs_par_titre.get(titre)
        if doc is not None:
            rag_results.append({
                "id": doc.id,
                "content": doc.content,
                "metadata": doc.metadata,
                "similarity": 100.0,
                "distance": 0.0,
            })
        else:
            chapitres_non_trouves.append(titre)

    if chapitres_non_trouves:
        rag = get_rag_engine()
        ids_vus = {r["id"] for r in rag_results}
        for titre in chapitres_non_trouves:
            resultat = rag.search(query=titre, matiere=matiere_key, niveau=str(niveau), n_results=3)
            for r in resultat.get("results", []):
                if r["id"] not in ids_vus:
                    ids_vus.add(r["id"])
                    rag_results.append(r)

    if not rag_results:
        raise QuizGenerationError(
            f"Aucun contenu trouve dans le programme pour « {', '.join(chapitres)} » "
            f"({matiere_display}, niveau {niveau})."
        )

    contexte_rag = build_rag_context(rag_results)

    params = ParametresExamen(
        nom=f"Quiz {matiere_display} - niveau {niveau}",
        matiere=matiere_display,
        niveau=str(niveau),
        chapitres=chapitres,
    )
    params.nb_questions = nb_questions
    params.difficulte = difficulte
    if types_questions:
        params.types_questions = types_questions
    params.notes = notes
    params.repartition_types = repartition_types

    try:
        examen = generer_quiz_avec_gemini(params, contexte_rag)
    except Exception as e:
        # 429 / "quota" / "rate limit" dans le message : c'est le cas le
        # plus courant en pratique (le niveau gratuit de l'API Gemini
        # autorise seulement 5 requetes par minute, partagees avec le chat
        # de la page Assistant), et ca n'a rien a voir avec GEMINI_API_KEY.
        # Un autre message ici induirait a tort a chercher du cote de la cle
        # API alors qu'il suffit d'attendre une minute.
        message = str(e)
        if "429" in message or "quota" in message.lower() or "rate limit" in message.lower():
            raise QuizGenerationError(
                "L'IA est temporairement surchargee : la limite de requetes Gemini "
                "(niveau gratuit) est atteinte. Patientez une minute puis reessayez -- "
                "ce n'est pas un probleme de cle API."
            )
        raise QuizGenerationError(
            f"Gemini n'a pas reussi a generer le quiz ({message}). Verifie GEMINI_API_KEY "
            "dans .env si le probleme persiste au-dela d'une minute d'attente."
        )

    if examen is None:
        raise QuizGenerationError(
            "Gemini n'a pas reussi a generer le quiz. Verifie GEMINI_API_KEY dans .env "
            "et regarde les logs du terminal backend pour le message d'erreur exact."
        )

    plat = _aplatir_questions(examen.questions)
    points_list = _repartir_bareme(len(plat))
    questions_out = [
        _vers_question_api(f"q{i + 1}", q, points, lecture=lecture, est_premiere=est_premiere)
        for i, ((lecture, est_premiere, q), points) in enumerate(zip(plat, points_list))
    ]

    return {
        "matiere": matiere_key,
        "niveau": str(niveau),
        "chapitre": examen.chapitre,
        "titre": f"{matiere_display} — {examen.chapitre}",
        "duree": duree,
        "questions": questions_out,
        "sources": [r.get("metadata", {}).get("titre", "Source inconnue") for r in rag_results],
    }