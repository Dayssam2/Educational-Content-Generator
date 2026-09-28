"""
Generation des images qui illustrent certaines questions (ex: "observe
l'image et compte les pommes", un schema a legender), via le modele
d'image de Gemini.

Volontairement un module A PART de services/gemini_service.py (utilise par
quiz_engine.py et assistant_engine.py pour le texte) : on ne connait pas le
contenu de ce fichier (il n'a pas ete fourni), donc on evite d'y toucher ou
d'en dependre -- aucun risque de casser le chat ou la generation de quiz
existants. Ce module appelle directement l'API REST Gemini, avec la MEME
cle GEMINI_API_KEY que le reste de l'app (voir .env) : pas de compte ni de
cle supplementaire a creer.

Comme le reste de l'IA dans cette app (voir validation.py, quiz_engine.py) :
toute erreur (quota, reseau, cle absente, reponse inattendue) est avalee et
loggee -- une image qui rate ne doit JAMAIS faire echouer la generation de
l'examen. `generer_image()` renvoie simplement None dans ce cas.

MISE A JOUR -- retry sur 429 : le niveau gratuit du modele d'IMAGE a une
limite de requetes/minute beaucoup plus basse que le modele de texte (voir
generate_content dans services/gemini_service.py) -- un run reel a montre
que meme 4-5 appels en parallele suffisent a tous se faire rejeter en 429
d'un coup. On respecte maintenant le delai que Google recommande lui-meme
(header Retry-After, ou le champ retryDelay de l'erreur) et on reessaie
2 fois avant d'abandonner, au lieu de renoncer au premier echec.

MISE A JOUR 2 -- messages d'erreur enfin lisibles : `reponse.raise_for_status()`
ne donnait QUE le code HTTP generique ("400 Client Error", "403 Client
Error"...), jamais la VRAIE raison que Google renvoie dans le corps JSON
de la reponse (cle API invalide, API pas activee sur le projet, modele
pas accessible sur ce compte...). Meme chose quand la reponse est un 200
mais sans image : Google renvoie souvent un `finishReason` (SAFETY,
PROHIBITED_CONTENT...) qui explique pourquoi le modele a refuse de
generer, et qu'on affichait pas avant. Les deux sont maintenant loggues.
"""

import re
import time
import os
import sys
from pathlib import Path
from typing import Optional

import requests
from dotenv import load_dotenv

_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))
load_dotenv(_ROOT / ".env")

# Modele d'image de Gemini (nom de code "Nano Banana"). Un seul endroit a
# changer si Google renomme/remplace le modele.
MODELE_IMAGE = "gemini-2.5-flash-image"
_ENDPOINT = f"https://generativelanguage.googleapis.com/v1beta/models/{MODELE_IMAGE}:generateContent"
TIMEOUT_SECONDES = 30

# Nombre de tentatives TOTAL (1 essai + ces retries) en cas de 429, et
# delai par defaut si Google n'en suggere aucun (voir _delai_retry). Le
# niveau gratuit de ce modele autorise tres peu de requetes par minute --
# mieux vaut attendre et reessayer que d'abandonner tout de suite.
MAX_TENTATIVES = 3
DELAI_DEFAUT_SECONDES = 20

# Cadre applique a CHAQUE image, en plus du contexte fourni par l'appelant
# (voir _prompt_image_enrichi dans quiz_engine.py) : style adapte a un
# cahier d'ecole primaire tunisien, et surtout AUCUN texte incruste dans
# l'image -- les modeles d'image rendent tres mal l'arabe (lettres
# deformees), mieux vaut ne jamais leur demander d'ecrire quoi que ce soit.
STYLE_ENFANTS = (
    "Illustration simple et coloree, style dessin pour cahier d'ecole "
    "primaire, fond blanc ou uni, formes claires et nettes, adaptee a des "
    "enfants de 6 a 12 ans. N'ecris AUCUN texte, lettre, chiffre ou mot "
    "dans l'image elle-meme -- uniquement le dessin decrit ci-dessous, "
    "rien d'autre."
)


def _cle_api() -> Optional[str]:
    cle = os.environ.get("GEMINI_API_KEY", "").strip()
    return cle or None


def _message_erreur(reponse) -> str:
    """Le VRAI message d'erreur de Google, cache dans le corps JSON de la
    reponse (`reponse.raise_for_status()` ne donne que "400 Client Error",
    jamais pourquoi). Ex: "API key not valid", "Generative Language API
    has not been used in project ... before or it is disabled", "This
    model is not enabled for your project"... Renvoie une chaine vide si
    le corps n'est pas du JSON exploitable (reseau capricieux, page
    d'erreur HTML d'un proxy, etc.)."""
    try:
        return (reponse.json().get("error", {}) or {}).get("message", "") or ""
    except Exception:
        return ""


def _quota_est_nulle(message: str) -> bool:
    """Vrai si Google annonce un quota gratuit LITTERALEMENT NUL pour ce
    modele (le message contient "limit: 0") -- pas juste "quelques
    requetes par minute". Cas reel observe : "gemini-2.5-flash-preview-
    image" (une variante "preview", souvent exclue du tier gratuit) avec
    "limit: 0, model: gemini-2.5-flash-preview-image" repete plusieurs
    fois dans le message. Dans ce cas, AUCUN reessai, meme en attendant
    une minute, ne peut jamais reussir -- ce n'est pas un quota bas qui
    se recharge, c'est zero de maniere permanente pour ce modele sur ce
    projet. Continuer a reessayer ne fait que gaspiller des minutes
    (2 reessais x jusqu'a 59s chacun observes en pratique) pour un echec
    garanti a l'avance."""
    return bool(re.search(r"limit:\s*0\b", message or ""))


def _delai_retry(reponse) -> float:
    """Combien de temps attendre avant de reessayer, d'apres ce que
    Google recommande lui-meme -- plutot que de deviner un chiffre fixe :
    1) le header standard HTTP `Retry-After` (secondes) ;
    2) le champ `retryDelay` (ex: "13s") que l'API Gemini renvoie dans le
       detail de l'erreur RESOURCE_EXHAUSTED ;
    3) sinon, DELAI_DEFAUT_SECONDES."""
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


def generer_image(description: str) -> Optional[str]:
    """Genere une image a partir d'une description (deja enrichie du
    contexte matiere/niveau/chapitre/question par l'appelant -- voir
    quiz_engine.py) et la renvoie en data URI base64
    ("data:image/png;base64,...."), prete a etre posee dans ImageRef.url
    (voir models.py) et utilisable telle quelle par un `<img src=...>`
    cote frontend -- aucun serveur de fichiers statiques necessaire.

    Renvoie None si l'IA echoue (apres MAX_TENTATIVES essais en cas de
    429), si la cle API est absente, ou si aucune image n'est revenue. Ne
    leve JAMAIS d'exception (voir docstring du module) : un souci
    d'image ne doit jamais faire echouer tout l'examen."""
    description = (description or "").strip()
    if not description:
        return None

    cle = _cle_api()
    if not cle:
        print("[image_service] GEMINI_API_KEY absente : image ignoree.")
        return None

    prompt = f"{STYLE_ENFANTS}\n\nContexte et sujet de l'image :\n{description}"
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
        except Exception as e:
            print(f"[image_service] Erreur reseau (tentative {tentative}/{MAX_TENTATIVES}) : {e}")
            return None  # panne reseau : reessayer immediatement n'aiderait pas

        if reponse.status_code == 429:
            message_429 = _message_erreur(reponse)
            if _quota_est_nulle(message_429):
                # Inutile d'attendre ni de reessayer : "limit: 0" veut dire
                # que ce modele n'a AUCUNE allocation gratuite sur ce
                # projet -- la seule issue est d'activer la facturation
                # (voir le message affiche), pas de patienter.
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

        if reponse.status_code != 200:
            # NOUVEAU : avant, on ne voyait que "400 Client Error" /
            # "403 Client Error" (message generique de `requests`) --
            # jamais la vraie raison de Google. Les causes les plus
            # frequentes derriere un 400/403 qui persiste MEME avec du
            # quota disponible : cle API invalide/restreinte, l'API
            # "Generative Language API" pas activee sur le projet Google
            # Cloud, ou ce modele precis pas accessible sur ce compte/
            # cette region -- le message ci-dessous dit exactement
            # laquelle.
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

        for part in parts:
            inline = part.get("inlineData") or part.get("inline_data")
            if inline and inline.get("data"):
                mime = inline.get("mimeType") or inline.get("mime_type") or "image/png"
                return f"data:{mime};base64,{inline['data']}"

        # NOUVEAU : un 200 SANS image arrive souvent parce que le modele a
        # refuse de generer (filtre de securite trop prudent, meme sur un
        # contenu innocent pour enfants) -- `finishReason` dit pourquoi
        # (SAFETY, PROHIBITED_CONTENT, IMAGE_SAFETY...). Avant, ce cas
        # ressemblait exactement a un echec de quota, impossible a
        # distinguer dans les logs.
        finish_reason = None
        try:
            finish_reason = data["candidates"][0].get("finishReason")
        except Exception:
            pass
        print(f"[image_service] Aucune image dans la reponse (finishReason={finish_reason}).")
        return None

    return None