import json
import os
from datetime import datetime, timezone
from typing import Optional, List, Dict

from dotenv import load_dotenv
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

load_dotenv()

DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/examai"
)

GENRES_VALIDES = ["femme", "homme"]
STATUTS_VALIDES = ["brouillon", "valide", "exporte"]

_pool: Optional[ConnectionPool] = None


def _get_pool() -> ConnectionPool:
    global _pool
    if _pool is None:
        _pool = ConnectionPool(
            DATABASE_URL,
            min_size=1,
            max_size=10,
            kwargs={"row_factory": dict_row},
            open=True,
        )
    return _pool


def fermer_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None


def init_db() -> None:
    pool = _get_pool()
    with pool.connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                nom TEXT NOT NULL,
                genre TEXT NOT NULL DEFAULT 'femme',
                created_at TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS tokens (
                token TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at TEXT NOT NULL
            )
        """)
        conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT")
        conn.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id "
            "ON users (google_id) WHERE google_id IS NOT NULL"
        )
        conn.execute("""
            CREATE TABLE IF NOT EXISTS password_reset_codes (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                code_hash TEXT NOT NULL,
                expire_at TEXT NOT NULL,
                tentatives INTEGER NOT NULL DEFAULT 0,
                utilise BOOLEAN NOT NULL DEFAULT FALSE,
                created_at TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS examens (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                matiere TEXT NOT NULL,
                niveau TEXT NOT NULL,
                chapitre TEXT NOT NULL,
                titre TEXT NOT NULL,
                statut TEXT NOT NULL DEFAULT 'brouillon',
                questions_json TEXT NOT NULL,
                validation_json TEXT,
                duree TEXT NOT NULL DEFAULT '60 min',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        conn.execute("ALTER TABLE examens ADD COLUMN IF NOT EXISTS chapitres_json TEXT")
        conn.execute("ALTER TABLE examens ADD COLUMN IF NOT EXISTS nb_questions INTEGER")
        conn.execute("ALTER TABLE examens ADD COLUMN IF NOT EXISTS difficulte TEXT")
        conn.execute("ALTER TABLE examens ADD COLUMN IF NOT EXISTS types_questions_json TEXT")
        conn.execute("ALTER TABLE examens ADD COLUMN IF NOT EXISTS notes TEXT")
        conn.commit()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def creer_user(
    email: str, password_hash: str, nom: str, genre: str, google_id: Optional[str] = None
) -> int:
    pool = _get_pool()
    with pool.connection() as conn:
        cur = conn.execute(
            "INSERT INTO users (email, password_hash, nom, genre, google_id, created_at) "
            "VALUES (%s, %s, %s, %s, %s, %s) RETURNING id",
            (email.strip().lower(), password_hash, nom.strip(), genre, google_id, _now()),
        )
        user_id = cur.fetchone()["id"]
        conn.commit()
        return user_id


def get_user_by_google_id(google_id: str) -> Optional[Dict]:
    pool = _get_pool()
    with pool.connection() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE google_id = %s", (google_id,)
        ).fetchone()
        return dict(row) if row else None


def lier_google_id(user_id: int, google_id: str) -> None:
    pool = _get_pool()
    with pool.connection() as conn:
        conn.execute(
            "UPDATE users SET google_id = %s WHERE id = %s", (google_id, user_id)
        )
        conn.commit()


def get_user_by_email(email: str) -> Optional[Dict]:
    pool = _get_pool()
    with pool.connection() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE email = %s", (email.strip().lower(),)
        ).fetchone()
        return dict(row) if row else None


def get_user_by_id(user_id: int) -> Optional[Dict]:
    pool = _get_pool()
    with pool.connection() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = %s", (user_id,)).fetchone()
        return dict(row) if row else None


def creer_token(token: str, user_id: int) -> None:
    pool = _get_pool()
    with pool.connection() as conn:
        conn.execute(
            "INSERT INTO tokens (token, user_id, created_at) VALUES (%s, %s, %s)",
            (token, user_id, _now()),
        )
        conn.commit()


def get_user_id_par_token(token: str) -> Optional[int]:
    pool = _get_pool()
    with pool.connection() as conn:
        row = conn.execute(
            "SELECT user_id FROM tokens WHERE token = %s", (token,)
        ).fetchone()
        return row["user_id"] if row else None


def supprimer_token(token: str) -> None:
    pool = _get_pool()
    with pool.connection() as conn:
        conn.execute("DELETE FROM tokens WHERE token = %s", (token,))
        conn.commit()


def supprimer_tokens_user(user_id: int) -> None:
    pool = _get_pool()
    with pool.connection() as conn:
        conn.execute("DELETE FROM tokens WHERE user_id = %s", (user_id,))
        conn.commit()


def modifier_password(user_id: int, password_hash: str) -> None:
    pool = _get_pool()
    with pool.connection() as conn:
        conn.execute(
            "UPDATE users SET password_hash = %s WHERE id = %s", (password_hash, user_id)
        )
        conn.commit()


def creer_code_reset(user_id: int, code_hash: str, expire_at: str) -> None:
    pool = _get_pool()
    with pool.connection() as conn:
        conn.execute(
            "UPDATE password_reset_codes SET utilise = TRUE "
            "WHERE user_id = %s AND utilise = FALSE",
            (user_id,),
        )
        conn.execute(
            "INSERT INTO password_reset_codes (user_id, code_hash, expire_at, created_at) "
            "VALUES (%s, %s, %s, %s)",
            (user_id, code_hash, expire_at, _now()),
        )
        conn.commit()


def code_reset_recent(user_id: int, secondes: int) -> bool:
    pool = _get_pool()
    with pool.connection() as conn:
        row = conn.execute(
            "SELECT created_at FROM password_reset_codes WHERE user_id = %s "
            "ORDER BY created_at DESC LIMIT 1",
            (user_id,),
        ).fetchone()
        if not row:
            return False
        cree = datetime.fromisoformat(row["created_at"])
        return (datetime.now(timezone.utc) - cree).total_seconds() < secondes


def get_code_reset_actif(user_id: int) -> Optional[Dict]:
    pool = _get_pool()
    with pool.connection() as conn:
        row = conn.execute(
            "SELECT * FROM password_reset_codes WHERE user_id = %s AND utilise = FALSE "
            "AND expire_at > %s ORDER BY created_at DESC LIMIT 1",
            (user_id, _now()),
        ).fetchone()
        return dict(row) if row else None


def incrementer_tentative_code(code_id: int) -> None:
    pool = _get_pool()
    with pool.connection() as conn:
        conn.execute(
            "UPDATE password_reset_codes SET tentatives = tentatives + 1 WHERE id = %s",
            (code_id,),
        )
        conn.commit()


def marquer_code_utilise(code_id: int) -> None:
    pool = _get_pool()
    with pool.connection() as conn:
        conn.execute(
            "UPDATE password_reset_codes SET utilise = TRUE WHERE id = %s", (code_id,)
        )
        conn.commit()


def creer_examen(
    user_id: int,
    matiere: str,
    niveau: str,
    chapitre: str,
    titre: str,
    questions: List[Dict],
    duree: str = "60 min",
    chapitres: Optional[List[str]] = None,
    nb_questions: Optional[int] = None,
    difficulte: Optional[str] = None,
    types_questions: Optional[List[str]] = None,
    notes: Optional[str] = None,
) -> int:
    now = _now()
    pool = _get_pool()
    with pool.connection() as conn:
        cur = conn.execute(
            """INSERT INTO examens
               (user_id, matiere, niveau, chapitre, titre, statut, questions_json, duree,
                chapitres_json, nb_questions, difficulte, types_questions_json, notes,
                created_at, updated_at)
               VALUES (%s, %s, %s, %s, %s, 'brouillon', %s, %s, %s, %s, %s, %s, %s, %s, %s)
               RETURNING id""",
            (
                user_id, matiere, niveau, chapitre, titre, json.dumps(questions), duree,
                json.dumps(chapitres) if chapitres is not None else None,
                nb_questions, difficulte,
                json.dumps(types_questions) if types_questions is not None else None,
                notes, now, now,
            ),
        )
        examen_id = cur.fetchone()["id"]
        conn.commit()
        return examen_id


def _row_to_examen(row: Dict) -> Dict:
    d = dict(row)
    d["questions"] = json.loads(d.pop("questions_json"))
    validation_json = d.pop("validation_json")
    d["validation"] = json.loads(validation_json) if validation_json else None
    chapitres_json = d.pop("chapitres_json", None)
    d["chapitres"] = json.loads(chapitres_json) if chapitres_json else None
    types_questions_json = d.pop("types_questions_json", None)
    d["types_questions"] = json.loads(types_questions_json) if types_questions_json else None
    return d


def lister_examens(user_id: int) -> List[Dict]:
    pool = _get_pool()
    with pool.connection() as conn:
        rows = conn.execute(
            "SELECT * FROM examens WHERE user_id = %s ORDER BY updated_at DESC", (user_id,)
        ).fetchall()
        return [_row_to_examen(r) for r in rows]


def get_examen(examen_id: int) -> Optional[Dict]:
    pool = _get_pool()
    with pool.connection() as conn:
        row = conn.execute("SELECT * FROM examens WHERE id = %s", (examen_id,)).fetchone()
        return _row_to_examen(row) if row else None


def modifier_questions_examen(examen_id: int, questions: List[Dict]) -> None:
    pool = _get_pool()
    with pool.connection() as conn:
        conn.execute(
            "UPDATE examens SET questions_json = %s, statut = 'brouillon', "
            "validation_json = NULL, updated_at = %s WHERE id = %s",
            (json.dumps(questions), _now(), examen_id),
        )
        conn.commit()


def mettre_a_jour_notes(examen_id: int, notes: Optional[str]) -> None:
    pool = _get_pool()
    with pool.connection() as conn:
        conn.execute(
            "UPDATE examens SET notes = %s, updated_at = %s WHERE id = %s",
            (notes, _now(), examen_id),
        )
        conn.commit()


def enregistrer_validation(examen_id: int, validation: Dict, statut: str) -> None:
    pool = _get_pool()
    with pool.connection() as conn:
        conn.execute(
            "UPDATE examens SET validation_json = %s, statut = %s, updated_at = %s WHERE id = %s",
            (json.dumps(validation), statut, _now(), examen_id),
        )
        conn.commit()


def marquer_exporte(examen_id: int) -> None:
    pool = _get_pool()
    with pool.connection() as conn:
        conn.execute(
            "UPDATE examens SET statut = 'exporte', updated_at = %s WHERE id = %s",
            (_now(), examen_id),
        )
        conn.commit()


def supprimer_examen(examen_id: int) -> None:
    pool = _get_pool()
    with pool.connection() as conn:
        conn.execute("DELETE FROM examens WHERE id = %s", (examen_id,))
        conn.commit()