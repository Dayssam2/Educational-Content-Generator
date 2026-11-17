import re
import time
import os
import sys
import json
from pathlib import Path
from typing import Optional, Dict, Tuple, List

import requests
from dotenv import load_dotenv

_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))
load_dotenv(_ROOT / ".env")

MODELE_ANALYSE = os.environ.get("GEMINI_MODEL_VISION", "gemini-3.8-flash").strip() or "gemini-3.8-flash"
_ENDPOINT = f"https://generativelanguage.googleapis.com/v1beta/models/{MODELE_ANALYSE}:generateContent"
TIMEOUT_SECONDES = 60

MAX_TENTATIVES = 2
DELAI_DEFAUT_SECONDES = 15


def _cle_api() -> Optional[str]:
    cle = os.environ.get("GEMINI_API_KEY", "").strip()
    return cle or None


def _decoder_data_uri(data_uri: str) -> Optional[Tuple[str, str]]:
    m = re.match(r"^data:([\w/+.-]+);base64,(.+)$", (data_uri or "").strip(), re.DOTALL)
    if not m:
        return None
    return m.group(1), m.group(2)


def _message_erreur(reponse) -> str:
    try:
        return (reponse.json().get("error", {}) or {}).get("message", "") or ""
    except Exception:
        return ""


def _delai_retry(reponse) -> float:
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


def _texte_reponse(data: Dict) -> Optional[str]:
    try:
        parts = data["candidates"][0]["content"]["parts"]
    except (KeyError, IndexError, TypeError):
        return None
    morceaux = [p.get("text", "") for p in parts if isinstance(p, dict) and not p.get("thought")]
    texte = "".join(morceaux).strip()
    return texte or None


def _extraire_json(texte: str):
    t = texte.strip()
    t = re.sub(r"^```(?:json)?", "", t).strip()
    t = re.sub(r"```$", "", t).strip()
    try:
        resultat = json.loads(t)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", t, re.DOTALL)
        if not m:
            return None
        try:
            resultat = json.loads(m.group(0))
        except json.JSONDecodeError:
            return None
    if isinstance(resultat, list) and resultat and isinstance(resultat[0], dict):
        resultat = resultat[0]
    return resultat if isinstance(resultat, dict) else None


def _liste_mots(valeur) -> List[str]:
    if not isinstance(valeur, list):
        return []
    return [str(v).strip() for v in valeur if str(v).strip()]


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

Réponds UNIQUEMENT avec UN objet JSON (pas un tableau), rien d'autre :
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
            return None

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

        if reponse.status_code == 404:
            print(f"[image_analysis_service] Erreur 404 : le modele '{MODELE_ANALYSE}' n'est pas disponible "
                  f"pour cette cle API. Changez GEMINI_MODEL_VISION dans le .env. Detail : "
                  f"{_message_erreur(reponse) or reponse.text[:300]}")
            return None

        if reponse.status_code != 200:
            print(f"[image_analysis_service] Erreur {reponse.status_code} : "
                  f"{_message_erreur(reponse) or reponse.text[:300]}")
            return None

        try:
            data = reponse.json()
        except ValueError as e:
            print(f"[image_analysis_service] Reponse illisible : {e}")
            return None

        texte = _texte_reponse(data)
        if not texte:
            raison = None
            try:
                raison = data["candidates"][0].get("finishReason")
            except Exception:
                pass
            print(f"[image_analysis_service] Reponse Gemini vide (finishReason={raison}).")
            return None

        resultat = _extraire_json(texte)
        if resultat is None:
            print(f"[image_analysis_service] JSON illisible renvoye par Gemini : {texte[:200]}")
            return None

        if not resultat.get("succes"):
            print(f"[image_analysis_service] Gemini n'est pas confiant sur cette image : "
                  f"{resultat.get('raison', '(pas de raison donnee)')}")
            return None

        reponse_correcte = _liste_mots(resultat.get("reponse_correcte"))
        if not reponse_correcte:
            print("[image_analysis_service] 'reponse_correcte' manquant ou vide dans la reponse Gemini.")
            return None

        propositions = _liste_mots(resultat.get("propositions"))
        manquantes = [r for r in reponse_correcte if r not in propositions]
        propositions = propositions + manquantes if propositions else list(reponse_correcte)

        return {"reponse_correcte": reponse_correcte, "propositions": propositions}

    return None