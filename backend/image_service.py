import re
import time
import os
import sys
from pathlib import Path
from typing import Optional, Tuple

import requests
from dotenv import load_dotenv

_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))
load_dotenv(_ROOT / ".env")

MODELE_IMAGE = os.environ.get("GEMINI_MODEL_IMAGE", "gemini-2.5-flash-image").strip() or "gemini-2.5-flash-image"
_ENDPOINT = f"https://generativelanguage.googleapis.com/v1beta/models/{MODELE_IMAGE}:generateContent"
TIMEOUT_SECONDES = 60

MAX_TENTATIVES = 3
DELAI_DEFAUT_SECONDES = 20

VERIFICATION_ACTIVEE = os.environ.get("IMAGE_VERIFICATION", "1").strip() != "0"
MAX_GENERATIONS = max(1, int(os.environ.get("IMAGE_MAX_GENERATIONS", "3") or 3))

DERNIERE_GENERATION = {}

STYLE_ENFANTS = (
    "Illustration simple et coloree, style dessin pour cahier d'ecole "
    "primaire, fond blanc ou uni, formes claires et nettes, adaptee a des "
    "enfants de 6 a 12 ans. N'ecris AUCUN texte, lettre, chiffre ou mot "
    "dans l'image elle-meme -- uniquement le dessin decrit ci-dessous, "
    "rien d'autre. Respecte EXACTEMENT le nombre d'objets demande : si la "
    "description dit 3 pommes, dessine exactement 3 pommes, ni plus ni moins. "
    "Les objets a compter doivent etre bien separes, entiers et faciles a "
    "compter par un enfant. Dessine tous les elements cites dans la "
    "description, et aucun element supplementaire qui pourrait l'induire en erreur. "
    "Cadrage : fond uniforme sur toute l'image, sujet entier et centre, entierement "
    "visible, sans bande grise ou coloree sur les bords, sans cadre, sans marge "
    "parasite et sans element coupe par le bord de l'image."
)

PROMPT_VERIFICATION = """Tu controles une illustration destinee a un exercice d'ecole primaire.
Voici ce que l'image devait representer :
<<<
{description}
>>>

Regarde l'image attentivement et verifie :
1. Chaque objet ou element demande est-il present ?
2. Les QUANTITES sont-elles exactes ? Compte les objets un par un.
3. Les details importants pour l'exercice sont-ils corrects (ex. l'heure indiquee par une horloge) ?
4. L'image contient-elle du texte, des lettres ou des chiffres ecrits ? (Les chiffres d'un cadran d'horloge, d'une regle ou d'un calendrier ne comptent pas s'ils sont demandes dans la description.)
5. CADRAGE : le sujet est-il entier (rien de coupe par le bord de l'image), le fond est-il uniforme, et l'image est-elle SANS bande grise ou coloree parasite, sans cadre et sans grand vide inutile ?

Reponds UNIQUEMENT avec UN objet JSON :
{{"conforme": true ou false, "probleme": "description courte du defaut, vide si conforme"}}
L'image est conforme seulement si les points 1, 2, 3 et 5 sont respectes et qu'il n'y a pas de texte (point 4)."""


def _cle_api() -> Optional[str]:
    cle = os.environ.get("GEMINI_API_KEY", "").strip()
    return cle or None


def _message_erreur(reponse) -> str:
    try:
        return (reponse.json().get("error", {}) or {}).get("message", "") or ""
    except Exception:
        return ""


def _quota_est_nulle(message: str) -> bool:
    return bool(re.search(r"limit:\s*0\b", message or ""))


def _credits_epuises(message: str) -> bool:
    """Credits prepayes epuises : aucun reessai ne peut reussir, il faut recharger sur https://ai.studio/projects."""
    m = (message or "").lower()
    return "prepayment" in m or "credits are depleted" in m or "depleted" in m


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


def _generer_une_image(prompt: str, cle: str) -> Optional[str]:
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"responseModalities": ["Image"]},
    }

    for tentative in range(1, MAX_TENTATIVES + 1):
        try:
            reponse = requests.post(
                _ENDPOINT,
                headers={"x-goog-api-key": cle, "Content-Type": "application/json"},
                json=payload,
                timeout=TIMEOUT_SECONDES,
            )
        except requests.Timeout:
            if tentative == MAX_TENTATIVES:
                print(f"[image_service] Delai depasse ({TIMEOUT_SECONDES}s) apres {MAX_TENTATIVES} tentatives.")
                return None
            print(f"[image_service] Delai depasse -- nouvelle tentative ({tentative}/{MAX_TENTATIVES})...")
            continue
        except Exception as e:
            print(f"[image_service] Erreur reseau (tentative {tentative}/{MAX_TENTATIVES}) : {e}")
            return None

        if reponse.status_code == 429:
            message_429 = _message_erreur(reponse)
            if _credits_epuises(message_429 or reponse.text):
                print("[image_service] Credits Gemini EPUISES (prepayment) -- aucun reessai ne peut reussir. "
                      f"Rechargez sur https://ai.studio/projects. Detail : {message_429}")
                return None
            if _quota_est_nulle(message_429):
                print(
                    "[image_service] Quota GRATUIT NUL (limit: 0) pour ce modele -- "
                    "aucun reessai ne peut reussir, la facturation doit etre activee "
                    f"sur le projet Google Cloud lie a cette cle API. Detail : {message_429}"
                )
                return None
            if tentative == MAX_TENTATIVES:
                print(f"[image_service] Quota depasse (429) apres {MAX_TENTATIVES} tentatives : "
                      f"{message_429 or '(pas de detail renvoye par Google)'}")
                return None
            delai = _delai_retry(reponse)
            print(f"[image_service] 429 -- {message_429 or 'quota depasse'} "
                  f"-- nouvelle tentative dans {delai:.0f}s ({tentative}/{MAX_TENTATIVES})...")
            time.sleep(delai)
            continue

        if reponse.status_code == 404:
            print(f"[image_service] Erreur 404 : le modele '{MODELE_IMAGE}' n'est pas disponible pour cette "
                  f"cle API. Changez GEMINI_MODEL_IMAGE dans le .env. Detail : "
                  f"{_message_erreur(reponse) or reponse.text[:300]}")
            return None

        if reponse.status_code != 200:
            print(f"[image_service] Erreur {reponse.status_code} : "
                  f"{_message_erreur(reponse) or reponse.text[:300]}")
            return None

        try:
            data = reponse.json()
        except Exception as e:
            print(f"[image_service] Reponse illisible : {e}")
            return None

        try:
            parts = data["candidates"][0]["content"]["parts"]
        except (KeyError, IndexError, TypeError) as e:
            print(f"[image_service] Reponse Gemini inattendue : {e}")
            return None

        for part in parts or []:
            inline = part.get("inlineData") or part.get("inline_data")
            if inline and inline.get("data"):
                mime = inline.get("mimeType") or inline.get("mime_type") or "image/png"
                return f"data:{mime};base64,{inline['data']}"

        finish_reason = None
        try:
            finish_reason = data["candidates"][0].get("finishReason")
        except Exception:
            pass
        print(f"[image_service] Aucune image dans la reponse (finishReason={finish_reason}).")
        return None

    return None


def verifier_image(image_data_uri: str, description: str) -> Tuple[Optional[bool], str]:
    try:
        import image_analysis_service as ias
    except Exception as e:
        print(f"[image_service] Verification impossible (image_analysis_service introuvable : {e}).")
        return None, ""

    cle = _cle_api()
    decode = ias._decoder_data_uri(image_data_uri)
    if not cle or decode is None:
        return None, ""
    mime_type, payload_b64 = decode
    payload = {
        "contents": [{"parts": [
            {"text": PROMPT_VERIFICATION.format(description=description)},
            {"inlineData": {"mimeType": mime_type, "data": payload_b64}},
        ]}],
        "generationConfig": {"responseMimeType": "application/json"},
    }

    for tentative in range(1, 3):
        try:
            reponse = requests.post(
                ias._ENDPOINT,
                headers={"x-goog-api-key": cle, "Content-Type": "application/json"},
                json=payload,
                timeout=ias.TIMEOUT_SECONDES,
            )
        except Exception as e:
            print(f"[image_service] Verification : erreur reseau ({e}).")
            return None, ""
        if reponse.status_code == 429 and _credits_epuises(reponse.text):
            print("[image_service] Verification : credits Gemini EPUISES (prepayment) -- verification ignoree.")
            return None, ""
        if reponse.status_code == 429 and tentative == 1:
            time.sleep(ias._delai_retry(reponse))
            continue
        if reponse.status_code != 200:
            print(f"[image_service] Verification : erreur {reponse.status_code} -- "
                  f"{_message_erreur(reponse) or reponse.text[:200]}")
            return None, ""
        try:
            texte = ias._texte_reponse(reponse.json())
        except Exception:
            texte = None
        resultat = ias._extraire_json(texte) if texte else None
        if resultat is None or "conforme" not in resultat:
            print("[image_service] Verification : reponse illisible.")
            return None, ""
        conforme = resultat.get("conforme")
        if isinstance(conforme, str):
            conforme = conforme.strip().lower() in ("true", "oui", "1")
        return bool(conforme), str(resultat.get("probleme") or "").strip()
    return None, ""


def generer_image(description: str) -> Optional[str]:
    DERNIERE_GENERATION.clear()
    description = (description or "").strip()
    if not description:
        return None

    cle = _cle_api()
    if not cle:
        print("[image_service] GEMINI_API_KEY absente : image ignoree.")
        return None

    prompt_base = f"{STYLE_ENFANTS}\n\nContexte et sujet de l'image :\n{description}"
    prompt = prompt_base
    nb_generations = 1 if not VERIFICATION_ACTIVEE else MAX_GENERATIONS
    problemes = []

    for essai in range(1, nb_generations + 1):
        uri = _generer_une_image(prompt, cle)
        DERNIERE_GENERATION.update({"generations": essai, "problemes": list(problemes)})
        if uri is None:
            DERNIERE_GENERATION["statut"] = "echec_generation"
            return None
        if not VERIFICATION_ACTIVEE:
            DERNIERE_GENERATION["statut"] = "non_verifiee"
            return uri

        conforme, probleme = verifier_image(uri, description)
        if conforme is None:
            DERNIERE_GENERATION["statut"] = "verification_indisponible"
            return uri
        if conforme:
            DERNIERE_GENERATION["statut"] = "conforme" if essai == 1 else "conforme_apres_correction"
            return uri

        problemes.append(probleme or "image non conforme")
        DERNIERE_GENERATION["problemes"] = list(problemes)
        print(f"[image_service] Image non conforme (essai {essai}/{nb_generations}) : {probleme or '?'}")
        prompt = (
            f"{prompt_base}\n\nATTENTION : une version precedente etait fausse ({probleme or 'image non conforme'}). "
            "Corrige ce defaut : respecte exactement chaque element et chaque quantite demandes, "
            "avec un fond uniforme et un sujet entier, sans bande parasite."
        )

    DERNIERE_GENERATION["statut"] = "rejetee"
    print(f"[image_service] Image rejetee apres {nb_generations} essais : aucune image plutot qu'une image fausse.")
    return None