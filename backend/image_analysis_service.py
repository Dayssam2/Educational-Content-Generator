"""
Analyse d'une image UPLOADEE PAR L'ENSEIGNANT (pas generee par l'IA) pour
les questions qui ont besoin d'une image reelle pour etre correctes -- au
depart, le type "legende" (legender les parties d'un schema), qui EXIGE
une image (voir models.QuestionLegende).

POURQUOI CE MODULE EST SEPARE D'image_service.py :
- image_service.py GENERE une image a partir d'une description texte, avec
  un modele d'IMAGE (gemini-2.5-flash-image) qui n'a AUCUN quota gratuit
  (voir "Quota GRATUIT NUL" dans image_service.py) -- il faut de la
  facturation activee sur le projet Google Cloud pour que ca marche.
- Ce module fait l'INVERSE : l'enseignant fournit sa propre image (une
  photo, un schema deja fait...), et ce module demande a un modele de
  TEXTE multimodal (capacite "vision", qui sait lire une image en entree)
  de la regarder et de dire ce qu'elle represente -- pour construire la
  bonne reponse ("reponse_correcte") et une banque de mots
  ("propositions") a proposer a l'eleve. Un modele TEXTE a un vrai quota
  gratuit (10 requetes/minute, 250/jour pour gemini-2.5-flash au moment
  ou ce module a ete ecrit) -- ce chemin ne depend donc PAS de
  facturation, contrairement a image_service.py.

Meme philosophie que le reste de l'IA de cette app (voir image_service.py,
validation.py) : aucune exception ne remonte jusqu'a l'appelant, tout est
avale et loggue -- `analyser_image_legende()` renvoie simplement None en
cas d'echec (image illisible, reseau, quota, reponse Gemini invalide, OU
Gemini lui-meme pas confiant dans ce qu'il voit). Ce dernier cas est
volontaire : mieux vaut garder la question "Incomplete" cote frontend que
lui faire deviner/afficher une mauvaise correction a l'eleve.

A ADAPTER cote appelant (non ecrit ici -- je n'ai pas main.py/models.py) :
1. Un nouvel endpoint (ex. POST /api/examens/{id}/questions/{qid}/image)
   qui recoit l'image uploadee en base64 (meme convention de data URI que
   ImageRef.url, deja utilisee pour les images generees -- voir
   image_service.py) et appelle analyser_image_legende().
2. Si models.QuestionLegende n'a pas encore de champ pour la banque de
   mots, l'ajouter :
       propositions: Optional[List[str]] = None
3. Mettre a jour la question avec :
   - image.url = l'image uploadee telle quelle (data URI, aucune
     regeneration necessaire)
   - reponse_correcte = resultat["reponse_correcte"]
   - propositions = resultat["propositions"]
   et ne repasser la question a "complete" QUE si le resultat n'est pas
   None (sinon la laisser "Incomplete" avec un message explicite plutot
   que de deviner).
"""

import re
import time
import os
import sys
import json
from pathlib import Path
from typing import Optional, Dict, Tuple

import requests
from dotenv import load_dotenv

_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))
load_dotenv(_ROOT / ".env")

# Modele TEXTE multimodal (lit une image + du texte, repond en texte/JSON) --
# PAS le modele de generation d'image. Overridable par env si le reste de
# l'app utilise deja un autre modele texte dans services/gemini_service.py
# (a aligner pour la coherence, meme si ce n'est pas obligatoire
# techniquement -- les deux modeles peuvent cohabiter sans se gener).
MODELE_ANALYSE = os.environ.get("GEMINI_MODEL_VISION", "gemini-2.5-flash")
_ENDPOINT = f"https://generativelanguage.googleapis.com/v1beta/models/{MODELE_ANALYSE}:generateContent"
TIMEOUT_SECONDES = 30

# Le tier gratuit TEXTE est bien plus genereux que celui de l'image (voir
# image_service.py) -- pas besoin d'autant de reessais.
MAX_TENTATIVES = 2
DELAI_DEFAUT_SECONDES = 15


def _cle_api() -> Optional[str]:
    cle = os.environ.get("GEMINI_API_KEY", "").strip()
    return cle or None


def _decoder_data_uri(data_uri: str) -> Optional[Tuple[str, str]]:
    """Decoupe une data URI ("data:image/png;base64,XXXX", meme convention
    que ImageRef.url) en (mime_type, base64_payload). Renvoie None si le
    format ne correspond pas -- ex. le frontend a envoye une URL http
    plutot qu'un vrai upload encode."""
    m = re.match(r"^data:([\w/+.-]+);base64,(.+)$", (data_uri or "").strip(), re.DOTALL)
    if not m:
        return None
    return m.group(1), m.group(2)


def _message_erreur(reponse) -> str:
    """Meme fonction que dans image_service.py : le VRAI message d'erreur
    de Google est dans le corps JSON, jamais dans raise_for_status()."""
    try:
        return (reponse.json().get("error", {}) or {}).get("message", "") or ""
    except Exception:
        return ""


def _delai_retry(reponse) -> float:
    """Idem image_service.py : Retry-After, sinon retryDelay, sinon la
    valeur par defaut."""
    entete = reponse.headers.get("Retry-After") if reponse is not None else None
    if entete:
        try:
            return max(1.0, float(entete))
        except ValueError:
            pass
    try:
        details = reponse.json().get("error", {}).get("details", [])
        for d in details:
            delai = d.get("retryDelay")
            if delai:
                m = re.match(r"([\d.]+)s?", str(delai))
                if m:
                    return max(1.0, float(m.group(1)))
    except Exception:
        pass
    return DELAI_DEFAUT_SECONDES


def _construire_prompt(question_texte: str, matiere: str, niveau: str, langue: str, nb_intrus: int) -> str:
    langue_nom = "arabe" if langue == "ar" else "français"
    return f"""Tu regardes une image fournie par un enseignant pour un exercice de
"légende" (l'élève doit identifier des éléments numérotés ou pointés par
des flèches sur un schéma ou une photo).

Matière : {matiere or "non precisee"}. Niveau scolaire : {niveau or "non precise"}.
Consigne donnée à l'élève : {question_texte or "Légende les éléments indiqués sur l'image."}

Étapes :
1. Repère chaque repère numéroté (1, 2, 3...) ou chaque flèche/pointeur sur
   l'image, DANS L'ORDRE (numéro croissant, sinon de haut en bas puis
   gauche à droite).
2. Donne, pour chaque repère, le mot exact qui doit être écrit à cet
   endroit -- en {langue_nom}, adapté à un élève de niveau {niveau or "primaire"}.
3. Propose {nb_intrus} mots-INTRUS plausibles mais FAUX (du même thème que
   l'image, pour ne pas les rendre trop évidents), à mélanger avec les
   bonnes réponses dans une banque de mots.

Si l'image ne montre AUCUN repère identifiable (pas de numéros, pas de
flèches, sujet incompréhensible), ou si tu n'es pas raisonnablement sûr de
ce que représente un repère, réponds avec "succes": false plutôt que de
deviner -- une légende fausse est pire qu'aucune légende.

Réponds UNIQUEMENT avec ce JSON, rien d'autre, pas de ```markdown``` :
{{
  "succes": true,
  "reponse_correcte": ["mot du repère 1", "mot du repère 2", "..."],
  "propositions": ["reponse 1", "reponse 2", "...", "intrus 1", "..."]
}}
ou, en cas d'échec :
{{"succes": false, "raison": "explication courte"}}"""


def analyser_image_legende(
    image_data_uri: str,
    question_texte: str = "",
    matiere: str = "",
    niveau: str = "",
    langue: str = "ar",
    nb_intrus: int = 2,
) -> Optional[Dict]:
    """Envoie l'image UPLOADEE (data URI) a un modele Gemini multimodal
    pour qu'il en deduise la reponse correcte (une par repere, DANS
    L'ORDRE) et une banque de propositions. Renvoie None si l'image est
    illisible, si l'IA echoue (reseau/quota/reponse invalide), ou si
    Gemini lui-meme ne se dit pas confiant. Ne leve jamais d'exception
    (meme convention que generer_image() dans image_service.py)."""
    decode = _decoder_data_uri(image_data_uri)
    if decode is None:
        print("[image_analysis_service] Image uploadee invalide (pas une data URI base64).")
        return None
    mime_type, payload_b64 = decode

    cle = _cle_api()
    if not cle:
        print("[image_analysis_service] GEMINI_API_KEY absente : analyse impossible.")
        return None

    prompt = _construire_prompt(question_texte, matiere, niveau, langue, nb_intrus)
    payload = {
        "contents": [{
            "parts": [
                {"text": prompt},
                {"inlineData": {"mimeType": mime_type, "data": payload_b64}},
            ]
        }],
        # Force une sortie JSON pure -- evite en grande partie le probleme
        # des ```json``` que generer_quiz_avec_gemini doit nettoyer a la main.
        "generationConfig": {"responseMimeType": "application/json"},
    }

    for tentative in range(1, MAX_TENTATIVES + 1):
        try:
            reponse = requests.post(
                _ENDPOINT,
                headers={"x-goog-api-key": cle, "Content-Type": "application/json"},
                json=payload,
                timeout=TIMEOUT_SECONDES,
            )
        except Exception as e:
            print(f"[image_analysis_service] Erreur reseau (tentative {tentative}/{MAX_TENTATIVES}) : {e}")
            return None  # panne reseau : reessayer immediatement n'aiderait pas

        if reponse.status_code == 429:
            if tentative == MAX_TENTATIVES:
                print(f"[image_analysis_service] Quota depasse (429) apres {MAX_TENTATIVES} tentatives : "
                      f"{_message_erreur(reponse) or '(pas de detail renvoye par Google)'}")
                return None
            delai = _delai_retry(reponse)
            print(f"[image_analysis_service] 429 -- nouvelle tentative dans {delai:.0f}s "
                  f"({tentative}/{MAX_TENTATIVES})...")
            time.sleep(delai)
            continue

        if reponse.status_code != 200:
            print(f"[image_analysis_service] Erreur {reponse.status_code} : "
                  f"{_message_erreur(reponse) or reponse.text[:300]}")
            return None

        try:
            data = reponse.json()
            texte = data["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError, TypeError) as e:
            print(f"[image_analysis_service] Reponse Gemini inattendue : {e}")
            return None

        # Filet de securite si le modele ajoute quand meme des ```json```
        # malgre responseMimeType (meme nettoyage que generer_quiz_avec_gemini).
        texte = texte.strip()
        if texte.startswith("```json"):
            texte = texte[7:]
        if texte.endswith("```"):
            texte = texte[:-3]
        texte = texte.strip()

        try:
            resultat = json.loads(texte)
        except json.JSONDecodeError as e:
            print(f"[image_analysis_service] JSON illisible renvoye par Gemini : {e} -- {texte[:200]}")
            return None

        if not resultat.get("succes"):
            print(f"[image_analysis_service] Gemini n'est pas confiant sur cette image : "
                  f"{resultat.get('raison', '(pas de raison donnee)')}")
            return None

        reponse_correcte = resultat.get("reponse_correcte")
        if not isinstance(reponse_correcte, list) or not reponse_correcte:
            print("[image_analysis_service] 'reponse_correcte' manquant ou vide dans la reponse Gemini.")
            return None

        propositions = resultat.get("propositions")
        if not isinstance(propositions, list) or not propositions:
            propositions = list(reponse_correcte)  # filet de securite minimal

        return {"reponse_correcte": reponse_correcte, "propositions": propositions}

    return None