#!/usr/bin/env python3
"""Enregistre au micro les phrases de reference pour l'evaluation de la reconnaissance vocale.

Pour chaque phrase, cree dans eval_data/asr/<langue>/ :
    <locuteur>_<NN>.wav   (16 kHz, mono)
    <locuteur>_<NN>.txt   (la phrase exacte a lire)

Installation :  pip install sounddevice numpy
(Affichage correct de l'arabe dans la console : pip install arabic-reshaper python-bidi)

Exemples :
    python enregistrer_asr.py --langue fr --locuteur amine
    python enregistrer_asr.py --langue ar --locuteur amine
    python enregistrer_asr.py --langue both --locuteur sarra --debut 5
    python enregistrer_asr.py --liste-micros
"""
import argparse
import re
import sys
import wave
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

BACKEND = Path(__file__).resolve().parent
FREQ = 16000

PHRASES = {
    "fr": [
        "Crée un examen de mathématiques pour la troisième année.",
        "Je veux un devoir de sciences avec dix questions.",
        "Ouvre la liste de mes examens.",
        "Comment expliquer les fractions aux élèves ?",
        "Prépare un contrôle de français avec des questions à choix multiples.",
        "Génère une évaluation d'histoire pour la cinquième année.",
        "Les élèves doivent compléter le texte à trous.",
        "Quelle est la différence entre un nom et un verbe ?",
        "Ajoute une question sur le cycle de l'eau.",
        "Le chat dort sous la table de la cuisine.",
        "Ajoute trois questions sur les fractions.",
        "Je voudrais un examen d'arabe pour la deuxième année.",
        "Montre-moi les examens enregistrés.",
        "Quelle méthode utiliser pour enseigner la lecture ?",
        "Les plantes ont besoin de lumière et d'eau.",
        "Crée un quiz de géographie avec des questions ouvertes.",
        "Combien de questions contient cet examen ?",
        "Le soleil se lève à l'est.",
        "Explique la différence entre le singulier et le pluriel.",
        "Génère un exercice de calcul pour la première année.",
    ],
    "ar": [
        "أنشئ امتحان رياضيات للسنة الثالثة",
        "أريد فرضا في العلوم فيه عشرة أسئلة",
        "افتح قائمة امتحاناتي",
        "كيف أشرح الكسور للتلاميذ؟",
        "حضر اختبارا في اللغة العربية للسنة الثانية",
        "ما هو الفرق بين الاسم والفعل؟",
        "يجب على التلاميذ ملء الفراغات في النص",
        "أضف سؤالا عن دورة الماء",
        "القط نائم تحت طاولة المطبخ",
        "اكتب امتحان تاريخ وجغرافيا للسنة السادسة",
        "أضف ثلاثة أسئلة عن الكسور",
        "أريد امتحانا في اللغة الفرنسية للسنة الرابعة",
        "اعرض لي الامتحانات المحفوظة",
        "ما هي أفضل طريقة لتعليم القراءة؟",
        "تحتاج النباتات إلى الضوء والماء",
        "أنشئ اختبار جغرافيا بأسئلة مفتوحة",
        "كم سؤالا يحتوي هذا الامتحان؟",
        "تشرق الشمس من الشرق",
        "اشرح الفرق بين المفرد والجمع",
        "ولد تمرينا في الحساب للسنة الأولى",
    ],
}


def afficher_texte(texte):
    """Affichage lisible de l'arabe dans la console (si arabic-reshaper et python-bidi sont installes)."""
    if re.search(r"[\u0600-\u06FF]", texte):
        try:
            import arabic_reshaper
            from bidi.algorithm import get_display
            return get_display(arabic_reshaper.reshape(texte))
        except ImportError:
            pass
    return texte


def importer_audio():
    try:
        import numpy as np
        import sounddevice as sd
        return np, sd
    except ImportError:
        print("Modules manquants. Installez-les avec :  pip install sounddevice numpy")
        sys.exit(1)


def enregistrer(np, sd, micro):
    """Enregistre jusqu'a ce que l'utilisateur appuie sur Entree. Retourne un tableau int16."""
    morceaux = []

    def rappel(donnees, frames, temps, statut):
        morceaux.append(donnees.copy())

    with sd.InputStream(samplerate=FREQ, channels=1, dtype="int16", device=micro, callback=rappel):
        input("      >>> ENREGISTREMENT... lisez la phrase, puis appuyez sur Entree pour arreter ")
    if not morceaux:
        return np.zeros(0, dtype="int16")
    return np.concatenate(morceaux).flatten()


def sauver_wav(chemin, audio):
    with wave.open(str(chemin), "wb") as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(FREQ)
        f.writeframes(audio.tobytes())


def verifier_audio(np, audio):
    """Retourne (ok, message)."""
    duree = len(audio) / FREQ
    if duree < 0.7:
        return False, f"trop court ({duree:.1f}s)"
    pic = int(np.abs(audio.astype("int32")).max())
    if pic < 1500:
        return False, f"volume trop faible (pic {pic}/32767) : rapprochez-vous du micro"
    if pic >= 32000:
        return False, "saturation (trop fort) : eloignez-vous un peu du micro"
    return True, f"{duree:.1f}s, volume OK"


def jouer(sd, audio):
    sd.play(audio, FREQ)
    sd.wait()


def lister_micros(sd):
    print(sd.query_devices())
    print("\nUtilisez --micro <numero> pour choisir un micro precis.")


def enregistrer_langue(np, sd, langue, locuteur, dossier_base, debut, refaire, micro):
    phrases = PHRASES[langue]
    dossier = dossier_base / langue
    dossier.mkdir(parents=True, exist_ok=True)
    nom_langue = "FRANCAIS" if langue == "fr" else "ARABE"
    print(f"\n{'=' * 70}\n {nom_langue} -- {len(phrases)} phrases -- locuteur : {locuteur}\n{'=' * 70}")

    i = max(1, debut)
    while i <= len(phrases):
        texte = phrases[i - 1]
        base = dossier / f"{locuteur}_{i:02d}"
        wav, txt = base.with_suffix(".wav"), base.with_suffix(".txt")
        if wav.exists() and txt.exists() and not refaire:
            print(f"\n  [{i:02d}/{len(phrases)}] deja enregistree, ignoree (option --refaire pour recommencer)")
            i += 1
            continue

        print(f"\n  [{i:02d}/{len(phrases)}] Lisez cette phrase a voix haute :\n")
        print(f"        {afficher_texte(texte)}\n")
        cmd = input("      Entree = commencer | s = sauter | q = quitter : ").strip().lower()
        if cmd == "q":
            return False
        if cmd == "s":
            i += 1
            continue

        audio = enregistrer(np, sd, micro)
        ok, msg = verifier_audio(np, audio)
        print(f"      Controle : {msg}")

        while True:
            choix = input("      Entree = garder | e = ecouter | r = refaire | s = sauter : ").strip().lower()
            if choix == "e":
                jouer(sd, audio)
                continue
            break

        if choix == "r":
            continue  # meme phrase
        if choix == "s":
            i += 1
            continue
        if not ok:
            confirm = input("      Le controle a signale un probleme. Garder quand meme ? (o/N) ").strip().lower()
            if confirm != "o":
                continue

        sauver_wav(wav, audio)
        txt.write_text(texte, encoding="utf-8")
        print(f"      Sauvegarde : {wav.name} + {txt.name}")
        i += 1
    return True


def main():
    ap = argparse.ArgumentParser(description="Enregistre les phrases de reference pour l'evaluation ASR.")
    ap.add_argument("--langue", choices=["fr", "ar", "both"], default="both")
    ap.add_argument("--locuteur", default="locuteur1", help="prenom, sans espace ni underscore (ex: amine)")
    ap.add_argument("--debut", type=int, default=1, help="numero de la premiere phrase (defaut 1)")
    ap.add_argument("--refaire", action="store_true", help="re-enregistre meme si le fichier existe")
    ap.add_argument("--micro", type=int, default=None, help="numero du micro (voir --liste-micros)")
    ap.add_argument("--liste-micros", action="store_true", help="affiche les micros disponibles et quitte")
    ap.add_argument("--donnees", default=str(BACKEND / "eval_data"), help="dossier des donnees de test")
    args = ap.parse_args()

    np, sd = importer_audio()
    if args.liste_micros:
        lister_micros(sd)
        return

    locuteur = re.sub(r"[^\w-]", "", args.locuteur.replace("_", "-"))
    if not locuteur:
        print("Nom de locuteur invalide.")
        sys.exit(1)
    dossier_base = Path(args.donnees) / "asr"

    print("Conseils : piece calme (ou bruit de classe si vous voulez tester ce cas), micro a 20-30 cm,")
    print("voix naturelle, comme face a l'assistant. Une prise par phrase.")
    langues = ["fr", "ar"] if args.langue == "both" else [args.langue]
    for langue in langues:
        if not enregistrer_langue(np, sd, langue, locuteur, dossier_base, args.debut, args.refaire, args.micro):
            break

    print(f"\nTermine. Fichiers dans : {dossier_base}")
    print("Lancez maintenant :  python evaluation.py --sections 3 --whisper medium")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nInterrompu. Les phrases deja enregistrees sont conservees.")