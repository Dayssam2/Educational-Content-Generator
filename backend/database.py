"""
Persistance des comptes et des examens -- PostgreSQL.

Migre depuis SQLite (voir CHANGEMENTS.md pour le detail et le pourquoi).
Meme principe qu'avant : ce module est le SEUL endroit qui connait le
detail du stockage -- main.py continue d'appeler creer_user(), get_examen()
etc. exactement comme avant, sans rien savoir du moteur de base de donnees
derriere (aucun changement necessaire dans main.py).

Connexion : lit DATABASE_URL dans .env, format standard PostgreSQL :
    postgresql://utilisateur:motdepasse@hote:5432/nom_de_la_base
Un hebergeur manage (Supabase, Neon, Railway...) te donne cette chaine
telle quelle, avec le SSL deja configure dedans -- copie-la sans y toucher.

Pool de connexions (psycopg_pool) plutot qu'une connexion par requete comme
le faisait sqlite3 : PostgreSQL est un serveur reseau, ouvrir une nouvelle
connexion a chaque appel serait lent et inutile.

Cycle de vie du pool : cree a la demande par _get_pool() (appele par
n'importe quelle fonction de ce module), ferme explicitement par
fermer_pool() -- a appeler depuis le hook @app.on_event("shutdown") de
main.py. Sans cet appel explicite, Python finit par fermer le pool lui-
meme via ConnectionPool.__del__ au moment ou l'interpreteur s'arrete, mais
depuis Python 3.13 ca leve un PythonFinalizationError bruyant (sans
consequence reelle -- l'exception est "ignoree" -- mais ca pollue les logs
a chaque arret/rechargement du serveur). fermer_pool() evite ce bruit en
fermant le pool nous-memes, pendant que l'interpreteur est encore
pleinement vivant.
"""

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
    """Ferme proprement le pool de connexions -- a appeler au shutdown de
    l'app (voir @app.on_event("shutdown") dans main.py), plutot que de
    laisser Python le faire lui-meme via ConnectionPool.__del__ a l'arret
    de l'interpreteur : depuis Python 3.13, joindre les threads internes
    du pool a ce moment-la leve PythonFinalizationError -- visible dans
    les logs, sans consequence reelle (l'exception est "ignoree"), mais ca
    fait du bruit inutile a chaque arret/rechargement du serveur. En
    fermant le pool nous-memes AVANT que l'interpreteur ne commence a se
    demanteler, __del__ le trouve deja ferme et ne fait plus rien.

    Sans effet si le pool n'a jamais ete ouvert (_pool encore None, par
    exemple si l'app s'arrete avant la premiere requete) -- pas la peine
    de forcer sa creation juste pour le refermer aussitot."""
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
        # Connexion avec Google (voir CHANGEMENTS.md). ADD COLUMN IF NOT
        # EXISTS plutot que dans le CREATE TABLE users ci-dessus : une base
        # existante garde ses comptes sans toucher aux lignes deja creees
        # (google_id reste NULL pour eux, ce qui est autorise -- une
        # contrainte UNIQUE accepte plusieurs NULL en PostgreSQL).
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
        # NOUVEAU -- parametres d'origine de la generation, gardes pour
        # pouvoir REGENERER plus tard (voir /api/examens/{id}/regenerer
        # dans main.py) sans redemander a l'enseignant de tout ressaisir.
        # ADD COLUMN IF NOT EXISTS : meme principe que google_id plus haut,
        # une base existante garde ses examens (ces colonnes restent NULL
        # pour eux -- un ancien examen redevient juste non-regenerable
        # automatiquement, ce qui est un comportement acceptable degrade).
        conn.execute("ALTER TABLE examens ADD COLUMN IF NOT EXISTS chapitres_json TEXT")
        conn.execute("ALTER TABLE examens ADD COLUMN IF NOT EXISTS nb_questions INTEGER")
        conn.execute("ALTER TABLE examens ADD COLUMN IF NOT EXISTS difficulte TEXT")
        conn.execute("ALTER TABLE examens ADD COLUMN IF NOT EXISTS types_questions_json TEXT")
        conn.execute("ALTER TABLE examens ADD COLUMN IF NOT EXISTS notes TEXT")
        conn.commit()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# --- Users -------------------------------------------------------------

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
    """Rattache un compte Google a un compte existant (cree auparavant par
    email/mot de passe). Permet a quelqu'un qui s'etait inscrit normalement
    d'utiliser ensuite 'Continuer avec Google' avec la meme adresse, sans
    creer un deuxieme compte en double."""
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


# --- Tokens --------------------------------------------------------------

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
    """Supprime tous les jetons de connexion de l'utilisateur -- utilise
    apres une reinitialisation de mot de passe pour deconnecter toute
    session en cours (au cas ou le compte aurait ete compromis)."""
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


# --- Reinitialisation de mot de passe ("mot de passe oublie") --------------

def creer_code_reset(user_id: int, code_hash: str, expire_at: str) -> None:
    """Enregistre un nouveau code de reinitialisation pour l'utilisateur.
    Invalide d'abord tout code precedent non utilise : un seul code actif
    a la fois, pour eviter qu'un vieux code envoye plus tot reste valable
    en parallele d'un nouveau."""
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
    """Vrai si un code a deja ete envoye a ce compte il y a moins de
    `secondes` -- anti-spam sur /api/auth/forgot-password (sinon un
    utilisateur, ou un attaquant, pourrait declencher l'envoi d'emails en
    boucle)."""
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
    """Le code non utilise et non expire le plus recent pour ce compte (ou
    None). La verification d'expiration se fait ici (comparaison a l'heure
    actuelle) : main.py n'a pas besoin de connaitre le format de stockage
    des dates, meme principe que le reste de ce fichier."""
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


# --- Examens ---------------------------------------------------------------

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
    # NOUVEAU -- voir creer_examen : decode les listes stockees en JSON.
    # None pour un examen cree avant cette mise a jour (colonnes absentes
    # a l'epoque, voir init_db) -- c'est attendu, pas une erreur.
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
    # Modifier le contenu remet l'examen en brouillon : une edition manuelle
    # invalide la derniere validation.
    pool = _get_pool()
    with pool.connection() as conn:
        conn.execute(
            "UPDATE examens SET questions_json = %s, statut = 'brouillon', "
            "validation_json = NULL, updated_at = %s WHERE id = %s",
            (json.dumps(questions), _now(), examen_id),
        )
        conn.commit()


def mettre_a_jour_notes(examen_id: int, notes: Optional[str]) -> None:
    """Enregistre les consignes utilisees pour la derniere (re)generation --
    voir POST /api/examens/{id}/regenerer dans main.py. Separee de
    modifier_questions_examen() : les deux sont appelees ensemble lors
    d'une regeneration, mais modifier_questions_examen() reste utilisable
    seule pour une simple edition manuelle (etape 2), sans toucher aux
    notes d'origine dans ce cas."""
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