"""
Verification d'un jeton Google OAuth2 ("Continuer avec Google") et
recuperation du profil associe -- utilise par POST /api/auth/google.

Le frontend obtient un access_token via Google Identity Services (dans le
navigateur, popup de connexion Google) et nous l'envoie. Cote serveur, on
ne fait JAMAIS confiance a un email/nom envoye directement par le
frontend : on redemande le profil a Google avec ce jeton, pour etre sur
qu'il vient reellement d'un compte Google authentifie.

Volontairement construit avec seulement urllib (bibliotheque standard),
meme philosophie que email_service.py : pas de nouvelle dependance (pas
de google-auth, pas de requests) pour deux simples appels HTTP GET.
"""

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
    """Jeton Google absent, invalide, expire, ou destine a une autre
    application. Le message est sur (pas de detail interne sensible) --
    il peut etre remonte tel quel dans une reponse HTTP 401/400."""


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
    """Verifie le jeton auprès de Google puis renvoie le profil associe :
    {google_id, email, email_verified, nom}. Leve GoogleAuthError si le
    jeton est invalide/expire, ou n'a pas ete emis pour notre application
    (protection contre la confusion de jeton : un jeton mineur pour une
    AUTRE appli ne doit pas etre accepte ici)."""
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