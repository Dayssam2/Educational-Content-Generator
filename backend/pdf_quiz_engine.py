"""
Generation d'un examen a partir d'un PDF fourni par l'enseignant (PAS
depuis database_tunisienne/), appele par POST /api/examens/depuis-pdf
(voir l'ajout correspondant a main.py).

USAGE PONCTUEL UNIQUEMENT : le texte extrait du PDF n'est ni indexe dans
le Chroma de rag_system/, ni sauvegarde sur disque au-dela de la
generation en cours -- il sert une fois, comme contexte du prompt
Gemini, exactement comme le ferait quiz_engine.build_rag_context() avec
des resultats RAG, puis il est perdu (seules les QUESTIONS generees
survivent, via db.creer_examen -- comme n'importe quel examen). Si un
jour ce contenu doit devenir reutilisable par d'autres enseignants
(ajout permanent au programme), c'est un besoin different : il faudrait
convertir le PDF vers le schema JSON attendu par
rag_system.DocumentLoader et l'indexer via SimpleRAG.index_all(), pas ce
module.

Ne reutilise donc PAS rag_system.DocumentLoader (glob *.json uniquement,
schema tunisien specifique -- aucune notion de PDF, aucune fonction
d'extraction de texte n'existe dans ce package) ni SimpleRAG/VectorStore/
TextEmbedder (indexation + recherche par similarite inutiles ici : il
n'y a qu'UN SEUL document, deja connu, pas un corpus a interroger).

Reutilise en revanche quiz_engine.py tel quel pour tout ce qui suit
l'obtention du texte : ParametresExamen, generer_quiz_avec_gemini()
(qui ne s'occupe jamais de la provenance de son contexte -- RAG ou PDF,
aucune difference pour elle), et les memes fonctions d'aplatissement/
mise en forme (_aplatir_questions, _vers_question_api, _repartir_bareme)
que generer_quiz_pour_wizard() utilise deja, pour renvoyer EXACTEMENT le
meme contrat de sortie (dict matiere/niveau/chapitre/titre/duree/
questions/sources) -- main.py peut donc le persister avec
db.creer_examen sans aucune adaptation.

MISE A JOUR : ajout de detecter_matiere_niveau(), utilisee par POST
/api/examens/depuis-pdf dans main.py quand l'enseignant ne precise pas
matiere/niveau lui-meme (voir le bouton "Creer un examen depuis ce PDF"
du chat assistant, qui ne demande plus ces deux champs a la main --
Gemini les identifie a partir du contenu du document). Reutilise le
meme services/gemini_service.py que le reste du fichier -- toujours pas
de nouvelle dependance, pas de nouvelle cle API.

LIMITES CONNUES (voir la discussion avant ce fichier) :
1. Pas d'OCR. Un PDF scanne (photo, image) n'a pas de calque de texte :
   l'extraction renvoie une chaine vide et generer_quiz_depuis_pdf() leve
   une erreur explicite plutot que d'envoyer un contexte vide a Gemini
   (qui inventerait alors un contenu sans lien avec le document reel).
2. La regeneration (POST /api/examens/{id}/regenerer) n'est PAS adaptee
   a ce cas : elle rappelle le chemin RAG, qui echouera pour un examen
   issu d'un PDF (pas de vrais chapitres du programme a chercher). A
   traiter cote main.py (bloquer proprement plutot que laisser echouer).
3. detecter_matiere_niveau() est une estimation IA, pas une certitude :
   si le document est ambigu (peu de texte, plusieurs matieres melangees),
   Gemini peut se tromper. Voir main.py -- le resultat de la creation
   montre toujours la matiere/niveau retenus pour que l'enseignant puisse
   verifier tout de suite.

DEPENDANCES A AJOUTER (si absentes) dans requirements.txt du backend :
    pdfplumber
    pypdf
"""

import io
import json
from typing import Dict, List, Optional

import pdfplumber
from pypdf import PdfReader

from services.gemini_service import generate_content
from quiz_engine import (
    ParametresExamen,
    QuizGenerationError,
    MATIERE_DISPLAY,
    generer_quiz_avec_gemini,
    _aplatir_questions,
    _vers_question_api,
    _repartir_bareme,
)


# Au-dela, le prompt Gemini gonfle pour rien et risque de depasser le
# budget de contexte du modele -- un PDF de cours primaire de quelques
# pages tient largement dans cette limite ; un PDF plus long est
# TRONQUE (voir _tronquer_si_necessaire) plutot que rejete, pour ne pas
# bloquer l'enseignant sur un document juste un peu trop long. A ajuster
# si vos documents sources sont typiquement plus longs.
MAX_CARACTERES_PDF = 12_000


def _tronquer_si_necessaire(texte: str) -> str:
    if len(texte) <= MAX_CARACTERES_PDF:
        return texte
    tronque = texte[:MAX_CARACTERES_PDF]
    return (
        tronque
        + "\n\n[...document tronque : trop long pour etre envoye en entier a l'IA. "
        "Les questions generees ne couvriront peut-etre pas les dernieres pages.]"
    )


def extraire_texte_pdf(pdf_bytes: bytes) -> str:
    """Extrait le texte d'un PDF. Essaie pdfplumber en premier (meilleure
    gestion des mises en page a colonnes, courantes dans les fiches
    d'exercices), puis pypdf en repli si pdfplumber echoue completement
    (fichier legerement corrompu, par exemple).

    Renvoie une chaine vide si le PDF n'a pas de calque de texte
    exploitable (PDF scanne / image) -- generer_quiz_depuis_pdf() le
    detecte ensuite et leve une erreur explicite (voir limite connue #1
    en tete de fichier : pas d'OCR ici)."""
    morceaux: List[str] = []

    try:
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            for page in pdf.pages:
                texte_page = page.extract_text() or ""
                if texte_page.strip():
                    morceaux.append(texte_page.strip())
    except Exception as e:
        print(f"[pdf_quiz_engine] pdfplumber a echoue ({e}), repli sur pypdf")
        morceaux = []

    if not morceaux:
        try:
            reader = PdfReader(io.BytesIO(pdf_bytes))
            for page in reader.pages:
                texte_page = page.extract_text() or ""
                if texte_page.strip():
                    morceaux.append(texte_page.strip())
        except Exception as e:
            print(f"[pdf_quiz_engine] pypdf a egalement echoue : {e}")
            return ""

    return "\n\n".join(morceaux)


def detecter_matiere_niveau(
    texte: str, matieres_valides: List[str], niveaux_valides: List[str]
) -> Dict[str, str]:
    """Demande a Gemini d'identifier la matiere et le niveau scolaire a
    partir du texte extrait d'un PDF -- utilise par POST
    /api/examens/depuis-pdf dans main.py quand l'enseignant ne les
    precise pas lui-meme (bouton "Creer un examen depuis ce PDF" du chat
    assistant : plus de formulaire matiere/niveau a remplir).

    Contraint TOUJOURS le resultat a une valeur de matieres_valides /
    niveaux_valides (repli sur la premiere valeur de chaque liste si
    Gemini hesite, se trompe de formulation, ou si sa reponse n'est pas
    du JSON exploitable) : le reste du pipeline (MATIERE_DISPLAY,
    validation cote main.py, db.creer_examen) suppose deja des cles
    connues, jamais une valeur inventee par l'IA.

    N'est qu'une estimation -- voir limite connue #3 en tete de fichier."""
    extrait = texte[:4000]  # la 1ere page suffit largement a identifier matiere/niveau
    prompt = (
        "Voici un extrait d'un document scolaire tunisien (programme primaire) :\n\n"
        f"{extrait}\n\n"
        "Identifie la matiere et le niveau scolaire (de 1 a 6) de ce document. "
        "Reponds UNIQUEMENT avec un objet JSON valide, sans aucun texte autour, "
        'exactement sous cette forme : {"matiere": "...", "niveau": "..."}\n'
        f"matiere doit etre EXACTEMENT une de ces valeurs : {', '.join(matieres_valides)}.\n"
        f"niveau doit etre EXACTEMENT une de ces valeurs : {', '.join(niveaux_valides)}."
    )
    matiere_repli, niveau_repli = matieres_valides[0], niveaux_valides[0]
    try:
        reponse = generate_content(prompt)
        nettoyee = reponse.strip().strip("`")
        if nettoyee.lower().startswith("json"):
            nettoyee = nettoyee[4:].strip()
        donnees = json.loads(nettoyee)
        matiere = donnees.get("matiere")
        niveau = str(donnees.get("niveau"))
        return {
            "matiere": matiere if matiere in matieres_valides else matiere_repli,
            "niveau": niveau if niveau in niveaux_valides else niveau_repli,
        }
    except Exception as e:
        print(f"[pdf_quiz_engine] Detection matiere/niveau echouee ({e}), repli sur valeurs par defaut")
        return {"matiere": matiere_repli, "niveau": niveau_repli}


def _construire_contexte_pdf(texte: str, nom_fichier: Optional[str]) -> str:
    """Meme forme visuelle que quiz_engine.build_rag_context(), pour que
    le prompt Gemini traite ce contexte exactement comme il traiterait
    des extraits RAG -- aucune modification necessaire du cote de
    prompts/quiz_prompt.py."""
    entete = f"=== DOCUMENT FOURNI PAR L'ENSEIGNANT ({nom_fichier or 'sans nom'}) ===\n"
    return entete + "\n" + texte


def generer_quiz_depuis_pdf(
    pdf_bytes: bytes,
    matiere_key: str,
    niveau: str,
    nb_questions: int,
    difficulte: str = "normale",
    types_questions: Optional[List[str]] = None,
    duree: str = "60 min",
    notes: Optional[str] = None,
    repartition_types: Optional[Dict[str, int]] = None,
    nom_fichier: Optional[str] = None,
) -> Dict:
    """Equivalent de quiz_engine.generer_quiz_pour_wizard(), mais le
    contexte vient d'un PDF fourni par l'enseignant a la place du RAG
    sur database_tunisienne/. Meme forme de sortie (dict avec
    matiere/niveau/chapitre/titre/duree/questions/sources) pour que
    main.py puisse le persister avec db.creer_examen exactement comme un
    examen genere depuis le programme -- voir POST /api/examens/depuis-pdf.
    """
    matiere_display = MATIERE_DISPLAY.get(matiere_key, matiere_key)

    texte = extraire_texte_pdf(pdf_bytes)
    if not texte.strip():
        raise QuizGenerationError(
            "Impossible d'extraire du texte de ce PDF. S'il s'agit d'un document "
            "scanne (photo ou image plutot que texte selectionnable), l'extraction "
            "automatique ne fonctionne pas encore pour ce type de fichier -- essayez "
            "un PDF exporte directement depuis un traitement de texte."
        )

    texte = _tronquer_si_necessaire(texte)
    contexte_pdf = _construire_contexte_pdf(texte, nom_fichier)

    params = ParametresExamen(
        nom=f"Quiz {matiere_display} - niveau {niveau}",
        matiere=matiere_display,
        niveau=str(niveau),
        chapitres=[nom_fichier or "Document fourni par l'enseignant"],
    )
    params.nb_questions = nb_questions
    params.difficulte = difficulte
    if types_questions:
        params.types_questions = types_questions
    params.notes = notes
    params.repartition_types = repartition_types

    try:
        examen = generer_quiz_avec_gemini(params, contexte_pdf)
    except Exception as e:
        # Meme classification qu'en generer_quiz_pour_wizard() : un 429 /
        # quota Gemini n'a rien a voir avec une cle API absente.
        message = str(e)
        if "429" in message or "quota" in message.lower() or "rate limit" in message.lower():
            raise QuizGenerationError(
                "L'IA est temporairement surchargee : la limite de requetes Gemini "
                "(niveau gratuit) est atteinte. Patientez une minute puis reessayez -- "
                "ce n'est pas un probleme de cle API."
            )
        raise QuizGenerationError(
            f"Gemini n'a pas reussi a generer le quiz depuis ce PDF ({message})."
        )

    if examen is None:
        raise QuizGenerationError("Gemini n'a pas reussi a generer le quiz depuis ce PDF.")

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
        "titre": f"{matiere_display} — {nom_fichier or examen.chapitre}",
        "duree": duree,
        "questions": questions_out,
        "sources": [nom_fichier or "Document fourni par l'enseignant"],
    }