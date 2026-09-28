"""
Petits utilitaires d'authentification : hash de mot de passe et jetons de
connexion. Volontairement construits avec seulement la bibliotheque standard
(hashlib, secrets) -- pas de nouvelle dependance a installer (pas de bcrypt,
pas de JWT). Suffisant pour ce cas d'usage ; facile a faire evoluer plus tard.
"""

import hashlib
import secrets

_ITERATIONS = 200_000


def hash_password(password: str) -> str:
    """Renvoie 'salt$hash' (hex). Le sel est different a chaque appel."""
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), bytes.fromhex(salt), _ITERATIONS
    ).hex()
    return f"{salt}${digest}"


def verifier_password(password: str, stocke: str) -> bool:
    try:
        salt, digest_attendu = stocke.split("$", 1)
    except ValueError:
        return False
    digest_calcule = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), bytes.fromhex(salt), _ITERATIONS
    ).hex()
    return secrets.compare_digest(digest_calcule, digest_attendu)


def generer_token() -> str:
    return secrets.token_urlsafe(32)


# --- Code de reinitialisation de mot de passe ("mot de passe oublie") -----
# Un code numerique a 6 chiffres (pas un token long) : l'utilisateur le
# recopie a la main depuis son email. Sa securite ne repose pas sur le
# nombre d'iterations de hachage (qui n'empeche pas un simple essai-erreur
# sur 10^6 valeurs), mais sur la limite de tentatives et l'expiration
# gerees cote base (voir database.py / main.py) -- donc iterations plus
# faibles que hash_password, volontairement.

_ITERATIONS_CODE = 50_000


def generer_code_reset() -> str:
    """Code a 6 chiffres, zeros de tete inclus (ex: '004821')."""
    return f"{secrets.randbelow(1_000_000):06d}"


def hash_code(code: str) -> str:
    salt = secrets.token_hex(8)
    digest = hashlib.pbkdf2_hmac(
        "sha256", code.encode("utf-8"), bytes.fromhex(salt), _ITERATIONS_CODE
    ).hex()
    return f"{salt}${digest}"


def verifier_code(code: str, stocke: str) -> bool:
    try:
        salt, digest_attendu = stocke.split("$", 1)
    except ValueError:
        return False
    digest_calcule = hashlib.pbkdf2_hmac(
        "sha256", code.encode("utf-8"), bytes.fromhex(salt), _ITERATIONS_CODE
    ).hex()
    return secrets.compare_digest(digest_calcule, digest_attendu)