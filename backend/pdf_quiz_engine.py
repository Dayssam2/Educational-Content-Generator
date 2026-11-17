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
    extrait = texte[:4000]
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