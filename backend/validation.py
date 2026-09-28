"""
Analyse d'un examen pour l'etape 3 du wizard (ecran Validation).

Deux couches independantes, fusionnees dans une seule reponse :
1. Regles deterministes (nombre de questions, bareme, variete des types,
   niveau, questions vides, doublons) -- gratuit, instantane, aucun appel
   reseau. C'est ce qui decide `score` et `peut_valider` : l'IA ne peut
   PAS faire echouer une validation, elle ne fait qu'enrichir l'avis.
2. Avis pedagogique via Gemini (avertissements/recommandations) -- relit
   la QUALITE du contenu (formulation, difficulte adaptee au niveau,
   coherence avec le chapitre...), des choses qu'une regle fixe ne peut
   pas juger. Volontairement en meilleur effort : toute erreur (quota,
   reseau, JSON invalide, module Gemini absent) est avalee et renvoie des
   listes vides -- Gemini est un plus, jamais une dependance bloquante
   pour /api/examens/{id}/valider. Desactivable sans toucher au code via
   VALIDATION_IA=0 dans .env (cout/latence si besoin de la couper vite).

La forme de la reponse (score, resume, checks, avertissements,
recommandations, peut_valider) ne change pas, donc rien a modifier cote
frontend.
"""

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

# Permet de desactiver l'appel IA sans toucher au code (VALIDATION_IA=0
# dans .env) -- active par defaut.
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
            # NOUVEAU (voir models.py / quiz_engine.py) : colonnes trop
            # courtes ou avec une entree vide -- avant, ce type n'existait
            # pas encore et aurait ete traite comme "type inconnu"
            # (ok=True par defaut), donc jamais repere.
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
            # Une image est obligatoire pour ce type (voir models.py) --
            # url generee OU description en attente, l'une des deux.
            image = q.get("image") or {}
            if not (image.get("url") or image.get("description")):
                return False
            reponses = q.get("reponseCorrecte") or []
            if len(reponses) < 1 or any(not str(r).strip() for r in reponses):
                return False
        elif t == "dictee":
            if not str(q.get("texte_dictee", "")).strip():
                return False
        # "redaction" et "ouverte"/"texte_trous" : pas de structure propre
        # a verifier ici au-dela du texte de la question (deja fait plus
        # haut) -- leur reponse/correction est verifiee dans
        # _check_corrections_completes ci-dessous.
        return True

    ok = all(question_valide(q) for q in questions)
    return {"ok": ok, "label": "Aucune question vide"}


def _check_doublons(questions: List[Dict]) -> Dict:
    textes = [q.get("question", "").strip().lower() for q in questions]
    ok = len(textes) == len(set(textes))
    return {"ok": ok, "label": "Aucune question dupliquee"}


def _check_corrections_completes(questions: List[Dict]) -> Dict:
    """Verifie que CHAQUE question porte une correction exploitable, quel
    que soit son type -- _check_pas_vide() ci-dessus ne verifie
    reponseCorrecteIndex QUE pour les qcm. Sans ce check, une question
    vrai_faux ou ouverte/texte_trous editee a la main (voir
    modifier_questions_examen dans database.py) pouvait passer la
    validation avec une reponseCorrecte/reponseAttendue vide ou absente,
    et le corrige genere (voir pdf_export.generer_pdf_correction) affichait
    alors un trou a la place de la reponse attendue. C'est ce check qui
    fait que « la correction passe aussi par la validation », pas
    seulement l'enonce des questions."""
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
            # NOUVEAU : reponseCorrecte doit couvrir chaque element de
            # colonne_gauche par un index valide dans colonne_droite.
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
        # "redaction" : pas de reponse unique par nature (evaluee sur des
        # criteres, voir models.QuestionRedaction) -- rien a verifier ici.
        # Type inconnu restant : deja ignore ailleurs (voir quiz_engine.py),
        # on ne bloque pas la validation dessus.
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


# --- Avis pedagogique (Gemini) ---------------------------------------------

_TYPE_LABEL = {
    "qcm": "QCM", "vrai_faux": "Vrai/Faux", "ouverte": "Question ouverte",
    "texte_trous": "Texte à trous", "association": "Association",
    "remise_en_ordre": "Remise en ordre", "tri": "Tri / classement",
    "calcul": "Calcul", "legende": "Légende à compléter", "dictee": "Dictée",
    "redaction": "Rédaction",
}


def _decrire_question(q: Dict, index: int) -> str:
    """Description en langage naturel d'UNE question, pour le prompt de
    l'avis pedagogique ci-dessous -- JAMAIS le JSON brut avec ses noms de
    champs techniques (reponseAttendue, reponseCorrecteIndex, colonne_
    gauche...). Voir la note dans _construire_prompt_ia : sans ca, le
    modele reprenait parfois ces noms de champs mot pour mot dans ses
    recommandations, incomprehensibles pour un enseignant."""
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
    """Prompt recentre sur ce que les regles deterministes ci-dessus NE
    PEUVENT PAS juger (qualite du contenu, pas structure) -- MAIS reçoit
    aussi la liste des regles echouees, pour que les recommandations
    aident concretement a les corriger plutot que de rester generiques
    et deconnectees de ce qui bloque reellement la validation."""
    questions = examen.get("questions", [])
    # NOUVEAU -- description en LANGAGE NATUREL, plus un dump JSON brut.
    # Avant, le JSON envoye au modele contenait litteralement des cles
    # comme "reponseAttendue" -- et le modele les reprenait mot pour mot
    # dans ses recommandations ("Renseignez le champ 'reponseAttendue'..."),
    # incomprehensible pour un enseignant qui n'a jamais vu cette
    # structure de donnees. En ne lui montrant plus AUCUN nom de champ
    # technique, il ne peut plus les recopier -- ils ne sont simplement
    # plus dans ce qu'il lit.
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
    """Suggestions pedagogiques via Gemini, en meilleur effort. Toute
    erreur (module absent, quota, reseau, JSON invalide) est avalee et
    renvoie des listes vides : un souci cote IA ne doit jamais faire
    echouer POST /api/examens/{id}/valider, qui doit rester utilisable
    meme sans Gemini (voir le score deterministe, calcule a part)."""
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
        # Meme principe que dans quiz_engine.py : on log pour diagnostiquer
        # (quota ? cle absente ? JSON malforme ?), mais on n'interrompt
        # jamais la validation pour un probleme cote IA.
        print(f"[validation] Avis pedagogique IA indisponible : {e}")
        return vide


def valider_examen(examen: Dict, nb_questions_attendu: int | None = None, niveau_attendu: str | None = None) -> Dict:
    """Point d'entree appele par POST /api/examens/{id}/valider (main.py)."""
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