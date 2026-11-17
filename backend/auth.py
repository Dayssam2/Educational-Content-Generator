import hashlib
import secrets

_ITERATIONS = 200_000


def hash_password(password: str) -> str:
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


_ITERATIONS_CODE = 50_000


def generer_code_reset() -> str:
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