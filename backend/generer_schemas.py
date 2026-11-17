import json
import shutil
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

BACKEND = Path(__file__).resolve().parent
DOSSIER = BACKEND / "eval_data" / "legende"
IMAGES_GENEREES = BACKEND / "eval_resultats" / "images_generees"
NB_NEGATIFS = 6


def charger_police(taille):
    try:
        return ImageFont.load_default(size=taille)
    except TypeError:
        return ImageFont.load_default()


POLICE = charger_police(22)


def pastille(d, x, y, numero):
    d.ellipse([x - 20, y - 20, x + 20, y + 20], fill="white", outline="black", width=3)
    d.text((x, y), str(numero), fill="black", font=POLICE, anchor="mm")


def ajouter_pastilles(d, positions):
    for numero, (x, y) in enumerate(positions, 1):
        pastille(d, x, y, numero)


def schema_maison():
    im = Image.new("RGB", (500, 450), "white")
    d = ImageDraw.Draw(im)
    d.polygon([(100, 200), (250, 80), (400, 200)], fill="#b5532f")
    d.rectangle([300, 90, 340, 160], fill="#8a8a8a")
    d.rectangle([100, 200, 400, 400], fill="#f0d9a8")
    d.rectangle([140, 250, 220, 330], fill="#7ec8e3")
    d.rectangle([280, 280, 350, 400], fill="#6b4226")
    ajouter_pastilles(d, [(250, 140), (320, 70), (180, 290), (315, 340)])
    return im, ["toit", "cheminée", "fenêtre", "porte"], ["السقف", "المدخنة", "النافذة", "الباب"]


def schema_bonhomme():
    im = Image.new("RGB", (400, 500), "white")
    d = ImageDraw.Draw(im)
    d.ellipse([160, 40, 240, 120], fill="#f5cba7")
    d.rectangle([170, 120, 230, 260], fill="#3498db")
    d.rectangle([90, 130, 170, 150], fill="#f5cba7")
    d.rectangle([180, 260, 220, 420], fill="#2c3e50")
    ajouter_pastilles(d, [(200, 80), (200, 190), (110, 100), (200, 340)])
    return im, ["tête", "corps", "bras", "jambe"], ["الرأس", "الجسم", "الذراع", "الرجل"]


def schema_voiture():
    im = Image.new("RGB", (550, 350), "white")
    d = ImageDraw.Draw(im)
    d.rectangle([60, 170, 490, 260], fill="#c0392b")
    d.rectangle([160, 100, 380, 170], fill="#aed6f1")
    d.ellipse([110, 230, 190, 310], fill="#222222")
    d.ellipse([60, 185, 85, 210], fill="#f4d03f")
    ajouter_pastilles(d, [(320, 215), (270, 60), (150, 335), (35, 197)])
    return im, ["carrosserie", "vitre", "roue", "phare"], ["الهيكل", "الزجاج", "العجلة", "المصباح"]


def schema_arbre():
    im = Image.new("RGB", (450, 500), "white")
    d = ImageDraw.Draw(im)
    d.ellipse([100, 40, 350, 260], fill="#27ae60")
    d.rectangle([205, 250, 245, 430], fill="#6e4b2a")
    d.polygon([(205, 430), (150, 480), (245, 430)], fill="#8b5a2b")
    d.ellipse([370, 20, 430, 80], fill="#f9e79f")
    ajouter_pastilles(d, [(225, 150), (225, 340), (150, 470), (400, 110)])
    return im, ["feuillage", "tronc", "racine", "soleil"], ["الأوراق", "الجذع", "الجذر", "الشمس"]


SCHEMAS = [
    ("maison", schema_maison),
    ("bonhomme", schema_bonhomme),
    ("voiture", schema_voiture),
    ("arbre", schema_arbre),
]


def entree(reponses, langue, question):
    return {"reponse_correcte": reponses, "langue": langue, "matiere": "science",
            "niveau": "3", "question": question}


def ecrire_schemas(verite):
    for nom, fabrique in SCHEMAS:
        image, fr, ar = fabrique()
        image.save(DOSSIER / f"{nom}_fr.png")
        image.save(DOSSIER / f"{nom}_ar.png")
        verite[f"{nom}_fr.png"] = entree(fr, "fr", f"Légende le schéma ({nom}).")
        verite[f"{nom}_ar.png"] = entree(ar, "ar", f"سمّ أجزاء الرسم ({nom})")


def ecrire_negatifs(verite):
    if not IMAGES_GENEREES.exists():
        print("Aucune image generee trouvee : lancez d'abord "
              "'python evaluation.py --sections 6' pour avoir des cas negatifs.")
        return 0
    fichiers = sorted(IMAGES_GENEREES.glob("image_*.*"))[:NB_NEGATIFS]
    for i, fichier in enumerate(fichiers, 1):
        nom = f"negatif_{i}{fichier.suffix}"
        shutil.copy(fichier, DOSSIER / nom)
        verite[nom] = entree([], "fr", "Légende l'image.")
    return len(fichiers)


def main():
    DOSSIER.mkdir(parents=True, exist_ok=True)
    verite = {}
    ecrire_schemas(verite)
    nb_negatifs = ecrire_negatifs(verite)
    (DOSSIER / "verite.json").write_text(json.dumps(verite, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"{len(SCHEMAS) * 2} schemas numerotes et {nb_negatifs} cas negatifs ecrits dans {DOSSIER}")
    print(f"{len(verite)} entrees dans verite.json")


if __name__ == "__main__":
    main()