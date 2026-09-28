"""
Envoi d'emails -- pour l'instant uniquement le code de reinitialisation de
mot de passe ("mot de passe oublie").

Volontairement construit avec seulement smtplib (bibliotheque standard),
meme philosophie que auth.py : pas de nouvelle dependance a installer (pas
de sendgrid, pas de boto3/SES). Fonctionne avec n'importe quel fournisseur
SMTP classique -- Gmail (avec un "mot de passe d'application", pas le mot
de passe du compte), Mailtrap ou Brevo en developpement, Amazon SES/Postmark
en production via leur interface SMTP. Il suffit de renseigner les
variables SMTP_* dans .env (voir .env.example).

Mode developpement sans SMTP configure : si SMTP_HOST est vide, l'email
n'est pas envoye mais affiche dans les logs du serveur -- pratique pour
tester le flux "mot de passe oublie" en local sans compte SMTP reel.
"""

import os
import smtplib
import ssl
from email.message import EmailMessage

from dotenv import load_dotenv

load_dotenv()

SMTP_HOST = os.environ.get("SMTP_HOST", "").strip()
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587") or "587")
SMTP_USER = os.environ.get("SMTP_USER", "").strip()
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "").strip()
SMTP_FROM = os.environ.get("SMTP_FROM", "").strip() or SMTP_USER


def _envoyer(destinataire: str, sujet: str, corps_texte: str) -> None:
    if not SMTP_HOST:
        print(f"[email_service] SMTP non configure (.env) -- email NON envoye, affiche a la place :")
        print(f"[email_service]   A : {destinataire}")
        print(f"[email_service]   Sujet : {sujet}")
        print(f"[email_service]   Corps :\n{corps_texte}")
        return

    message = EmailMessage()
    message["From"] = SMTP_FROM
    message["To"] = destinataire
    message["Subject"] = sujet
    message.set_content(corps_texte)

    contexte = ssl.create_default_context()
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as serveur:
        serveur.starttls(context=contexte)
        if SMTP_USER:
            serveur.login(SMTP_USER, SMTP_PASSWORD)
        serveur.send_message(message)


def envoyer_code_reset(email: str, code: str, nom: str) -> None:
    sujet = "ExamAI -- Code de reinitialisation de mot de passe"
    corps = (
        f"Bonjour {nom},\n\n"
        f"Voici ton code de reinitialisation de mot de passe : {code}\n\n"
        f"Ce code est valable 15 minutes et ne peut etre utilise qu'une "
        f"seule fois.\n\n"
        f"Si tu n'es pas a l'origine de cette demande, ignore simplement "
        f"cet email : ton mot de passe actuel reste inchange.\n\n"
        f"-- L'equipe ExamAI"
    )
    _envoyer(email, sujet, corps)