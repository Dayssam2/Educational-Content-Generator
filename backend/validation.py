import json
import os
import sys
from pathlib import Path
from typing import Dict, List

from dotenv import load_dotenv

_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))
load_dotenv(_ROOT / ".env")

POINTS_PAR_REGLE_ECHOUEE = 20

_IA_ACTIVEE = os.environ.get("VALIDATION_IA", "1").strip() != "0"
MAX_ELEMENTS_PAR_LISTE = 4


def _check_nb_questions(questions: List[Dict], nb_attendu: int | None) -> Dict:
    n = len(questions)
    if nb_attendu:
        ok = n == nb_attendu
        label = f"Nombre de questions correct ({n}/{nb_attendu})"
    else:
        ok = n > 0
        label = f"Nombre de questions correct ({n})"
    return {"ok": ok, "label": label}


def _check_bareme(questions: List[Dict]) -> Dict:
    total = sum(q.get("points", 0) for q in questions)
    ok = total == 20 and all(q.get("points", 0) > 0 for q in questions)
    return {"ok": ok, "label": f"Bareme sur 20 ({total}/20 points)"}


def _check_variete(questions: List[Dict]) -> Dict:
    types_presents = {q.get("type") for q in questions}
    ok = len(types_presents) >= 2
    return {"ok": ok, "label": "Questions variees (plusieurs types)"}


def _check_niveau(examen: Dict, niveau_attendu: str | None) -> Dict:
    ok = niveau_attendu is None or str(examen.get("niveau")) == str(niveau_attendu)
    return {"ok": ok, "label": "Niveau adapte au niveau selectionne"}


def _check_pas_vide(questions: List[Dict]) -> Dict:
    def question_valide(q: Dict) -> bool:
        if not q.get("question", "").strip():
            return False
        t = q.get("type")
        if t == "qcm":
            options = q.get("options") or []
            idx = q.get("reponseCorrecteIndex")
            if len(options) < 2 or any(not o.strip() for o in options):
                return False
            if not isinstance(idx, int) or not (0 <= idx < len(options)):
                return False
        elif t == "association":
            gauche = q.get("colonne_gauche") or []
            droite = q.get("colonne_droite") or []
            if len(gauche) < 2 or len(droite) < 2:
                return False
            if any(not str(g).strip() for g in gauche) or any(not str(d).strip() for d in droite):
                return False
        elif t == "remise_en_ordre":
            elements = q.get("elements") or []
            if len(elements) < 2 or any(not str(e).strip() for e in elements):
                return False
        elif t == "tri":
            categories = q.get("categories") or []
            elements = q.get("elements") or []
            if len(categories) < 2 or len(elements) < 2:
                return False
            if any(not str(c).strip() for c in categories) or any(not str(e).strip() for e in elements):
                return False
        elif t == "calcul":
            if q.get("reponseAttendue") in (None, ""):
                return False
        elif t == "legende":
            image = q.get("image") or {}
            if not (image.get("url") or image.get("description")):
                return False
            reponses = q.get("reponseCorrecte") or []
            if len(reponses) < 1 or any(not str(r).strip() for r in reponses):
                return False
        elif t == "dictee":
            if not str(q.get("texte_dictee", "")).strip():
                return False
        return True

    ok = all(question_valide(q) for q in questions)
    return {"ok": ok, "label": "Aucune question vide"}


def _check_doublons(questions: List[Dict]) -> Dict:
    textes = [q.get("question", "").strip().lower() for q in questions]
    ok = len(textes) == len(set(textes))
    return {"ok": ok, "label": "Aucune question dupliquee"}


def _check_corrections_completes(questions: List[Dict]) -> Dict:
    def correction_valide(q: Dict) -> bool:
        t = q.get("type")
        if t == "qcm":
            options = q.get("options") or []
            idx = q.get("reponseCorrecteIndex")
            return isinstance(idx, int) and 0 <= idx < len(options)
        if t == "vrai_faux":
            return isinstance(q.get("reponseCorrecte"), bool)
        if t in ("ouverte", "texte_trous"):
            return bool(str(q.get("reponseAttendue", "")).strip())
        if t == "association":
            gauche = q.get("colonne_gauche") or []
            droite = q.get("colonne_droite") or []
            correspondance = q.get("reponseCorrecte")
            if not isinstance(correspondance, list) or len(correspondance) != len(gauche):
                return False
            return all(isinstance(i, int) and 0 <= i < len(droite) for i in correspondance)
        if t == "remise_en_ordre":
            elements = q.get("elements") or []
            ordre = q.get("reponseCorrecte")
            if not isinstance(ordre, list):
                return False
            return sorted(ordre) == list(range(len(elements)))
        if t == "tri":
            elements = q.get("elements") or []
            categories = q.get("categories") or []
            correspondance = q.get("reponseCorrecte")
            if not isinstance(correspondance, list) or len(correspondance) != len(elements):
                return False
            return all(isinstance(i, int) and 0 <= i < len(categories) for i in correspondance)
        if t == "calcul":
            return q.get("reponseAttendue") not in (None, "")
        if t == "legende":
            reponses = q.get("reponseCorrecte") or []
            return len(reponses) >= 1 and all(str(r).strip() for r in reponses)
        if t == "dictee":
            return bool(str(q.get("texte_dictee", "")).strip())
        return True

    ok = all(correction_valide(q) for q in questions)
    return {"ok": ok, "label": "Corrige complet (reponse correcte renseignee pour chaque question)"}


def _regles(examen: Dict, nb_questions_attendu: int | None, niveau_attendu: str | None) -> List[Dict]:
    questions = examen.get("questions", [])
    return [
        _check_nb_questions(questions, nb_questions_attendu),
        _check_bareme(questions),
        _check_variete(questions),
        _check_niveau(examen, niveau_attendu),
        _check_pas_vide(questions),
        _check_doublons(questions),
        _check_corrections_completes(questions),
    ]


_TYPE_LABEL = {
    "qcm": "QCM", "vrai_faux": "Vrai/Faux", "ouverte": "Question ouverte",
    "texte_trous": "Texte à trous", "association": "Association",
    "remise_en_ordre": "Remise en ordre", "tri": "Tri / classement",
    "calcul": "Calcul", "legende": "Légende à compléter", "dictee": "Dictée",
    "redaction": "Rédaction",
}


def _decrire_question(q: Dict, index: int) -> str:
    t = q.get("type")
    label = _TYPE_LABEL.get(t, t or "?")
    morceaux = [f"Question {index + 1} ({label}, {q.get('points', '?')} pts) : {q.get('question') or '(énoncé vide)'}"]

    if t == "qcm":
        morceaux.append(f"Options proposées : {' / '.join(q.get('options') or [])}")
    elif t == "association":
        morceaux.append(
            f"À relier : {', '.join(q.get('colonne_gauche') or [])} "
            f"avec {', '.join(q.get('colonne_droite') or [])}"
        )
    elif t == "remise_en_ordre":
        morceaux.append(f"Éléments à ordonner : {', '.join(q.get('elements') or [])}")
    elif t == "tri":
        morceaux.append(
            f"Catégories : {', '.join(q.get('categories') or [])} — "
            f"éléments à classer : {', '.join(q.get('elements') or [])}"
        )
    elif t == "dictee":
        morceaux.append(f"Texte à dicter : {q.get('texte_dictee') or '(vide)'}")
    elif t == "redaction" and q.get("criteres_evaluation"):
        morceaux.append(f"Critères d'évaluation : {', '.join(q['criteres_evaluation'])}")

    return " — ".join(morceaux)


def _construire_prompt_ia(examen: Dict, checks: List[Dict]) -> str:
    questions = examen.get("questions", [])
    description_questions = "\n".join(_decrire_question(q, i) for i, q in enumerate(questions))

    echecs = [c["label"] for c in checks if not c.get("ok")]
    section_echecs = ""
    if echecs:
        liste_echecs = "\n".join(f"- {label}" for label in echecs)
        section_echecs = f"""

Ces verifications automatiques ont ECHOUE sur cet examen :
{liste_echecs}

Ce sont des problemes reels et prioritaires : pour chacun, donne dans
"recommandations" une action CONCRETE et actionnable pour le corriger
(quoi changer exactement -- ex: quelle question ajuster, de combien de
points, etc.), en te basant sur les questions listees plus bas. Mets ces
recommandations-la EN PREMIER dans le tableau."""

    return f"""Tu es un inspecteur pedagogique qui relit un examen de {examen.get("matiere", "?")} pour le niveau {examen.get("niveau", "?")} (chapitre : {examen.get("chapitre", "?")}).

Voici les questions :
{description_questions}
{section_echecs}

Analyse aussi la qualite pedagogique du contenu, au-dela des points ci-dessus s'il y en a : une difficulte mal adaptee au niveau, une formulation ambigue ou une question qui pourrait avoir plusieurs bonnes reponses, un ecart avec le chapitre annonce, un manque de variete dans la difficulte (tout facile ou tout dur). Ne repete pas les verifications structurelles qui n'ont pas echoue (nombre de questions, bareme, variete des types, niveau, questions vides ou dupliquees) -- elles sont deja bonnes, pas la peine de le redire.

Reponds UNIQUEMENT avec un objet JSON, sans aucun texte ni markdown autour :
{{"avertissements": ["..."], "recommandations": ["..."]}}

"avertissements" : problemes de qualite pedagogique reperes (formulation, difficulte, coherence). "recommandations" : actions concretes a faire -- en priorite pour corriger les echecs listes plus haut s'il y en a, puis des ameliorations pedagogiques generales. Chaque tableau : au maximum {MAX_ELEMENTS_PAR_LISTE} phrases courtes en francais, une par ligne, pas de numerotation. Tableau vide si rien de reel a signaler dans cette categorie -- n'invente pas un probleme pour remplir le tableau.

IMPORTANT : ecris comme si tu parlais directement a l'enseignant, qui ne
connait PAS la structure technique de ce fichier. Ne mentionne jamais de
nom de champ, de cle ou de code (des mots comme "reponseAttendue",
"reponseCorrecteIndex", "colonne_gauche"...) -- parle du contenu
pedagogique (l'enonce, les options proposees, la reponse attendue), jamais
de la structure de donnees qui le contient."""


def _avis_ia(examen: Dict, checks: List[Dict]) -> Dict:
    vide = {"avertissements": [], "recommandations": []}
    if not _IA_ACTIVEE or not examen.get("questions"):
        return vide

    try:
        from services.gemini_service import generate_content
    except Exception as e:
        print(f"[validation] services.gemini_service indisponible : {e}")
        return vide

    try:
        reponse = generate_content(_construire_prompt_ia(examen, checks))
        reponse = reponse.strip()
        if reponse.startswith("```json"):
            reponse = reponse[7:]
        if reponse.endswith("```"):
            reponse = reponse[:-3]
        data = json.loads(reponse.strip())

        avertissements = [str(a).strip() for a in data.get("avertissements", []) if str(a).strip()]
        recommandations = [str(r).strip() for r in data.get("recommandations", []) if str(r).strip()]
        return {
            "avertissements": avertissements[:MAX_ELEMENTS_PAR_LISTE],
            "recommandations": recommandations[:MAX_ELEMENTS_PAR_LISTE],
        }
    except Exception as e:
        print(f"[validation] Avis pedagogique IA indisponible : {e}")
        return vide


def valider_examen(examen: Dict, nb_questions_attendu: int | None = None, niveau_attendu: str | None = None) -> Dict:
    checks = _regles(examen, nb_questions_attendu, niveau_attendu)
    regles_echouees = sum(1 for c in checks if not c["ok"])
    score = max(0, 100 - regles_echouees * POINTS_PAR_REGLE_ECHOUEE)

    if regles_echouees == 0:
        resume = "Votre examen est de bonne qualite !"
    else:
        resume = "Des corrections sont necessaires avant de pouvoir valider cet examen."

    avis = _avis_ia(examen, checks)

    return {
        "score": score,
        "resume": resume,
        "checks": checks,
        "avertissements": avis["avertissements"],
        "recommandations": avis["recommandations"],
        "peut_valider": regles_echouees == 0,
    }