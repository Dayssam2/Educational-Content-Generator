import json
import os
import urllib.error
import urllib.request
from typing import Dict, Optional

from dotenv import load_dotenv

load_dotenv()

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "").strip()

_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo?access_token={}"
_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"


class GoogleAuthError(Exception):
    pass


def _as_bool(valeur) -> bool:
    if isinstance(valeur, bool):
        return valeur
    return str(valeur).strip().lower() == "true"


def _get_json(url: str, headers: Optional[Dict] = None) -> Dict:
    requete = urllib.request.Request(url, headers=headers or {})
    try:
        with urllib.request.urlopen(requete, timeout=8) as reponse:
            return json.loads(reponse.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        raise GoogleAuthError("Jeton Google invalide ou expire") from e
    except urllib.error.URLError as e:
        raise GoogleAuthError(f"Impossible de contacter Google : {e}") from e


def verifier_et_recuperer_profil(access_token: str) -> Dict:
    if not access_token or not access_token.strip():
        raise GoogleAuthError("Jeton Google manquant")

    if not GOOGLE_CLIENT_ID:
        raise GoogleAuthError(
            "GOOGLE_CLIENT_ID n'est pas configure cote serveur (.env)"
        )

    infos = _get_json(_TOKENINFO_URL.format(access_token.strip()))
    if infos.get("aud") != GOOGLE_CLIENT_ID:
        raise GoogleAuthError("Ce jeton n'a pas ete emis pour cette application")

    profil = _get_json(
        _USERINFO_URL, headers={"Authorization": f"Bearer {access_token.strip()}"}
    )

    email = profil.get("email") or infos.get("email")
    if not email:
        raise GoogleAuthError("Le compte Google ne fournit pas d'adresse email")

    google_id = profil.get("sub") or infos.get("sub")
    if not google_id:
        raise GoogleAuthError("Reponse Google incomplete (identifiant manquant)")

    return {
        "google_id": google_id,
        "email": email,
        "email_verified": _as_bool(profil.get("email_verified", infos.get("email_verified", False))),
        "nom": profil.get("name") or email.split("@")[0],
    }