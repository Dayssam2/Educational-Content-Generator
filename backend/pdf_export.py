"""
Generation du PDF d'examen pour l'etape 4 du wizard (ecran Export).

MISE A JOUR 7 -- correction du contrat d'entree (voir main.py reel)
--------------------------------------------------------------------------
La MISE A JOUR 6 (juste en dessous) avait reecrit ce fichier pour prendre
en entree le payload "exercices deja groupes + libelles precalcules" tel
qu'envoye par un composant Export.jsx qui m'avait ete montre isolement.
Une fois main.py vu en entier, il s'avere que main.py (POST
/api/examens/{id}/export et .../export/corrige) appelle en realite :

    pdf_export.generer_pdf_examen(
        examen,                              # le dict complet de db.get_examen()
        langue=payload.langue,               # "fr" uniquement pour l'instant
        en_tete=payload.en_tete,
        pagination=payload.pagination,
        nom_etablissement=payload.nom_etablissement,
    )

-- c'est-a-dire EXACTEMENT le contrat de la version d'AVANT la mise a
jour 6 (`examen["matiere"]` est une CLE parmi MATIERES_VALIDES --
mathematique/arabe/science/francais/histoire_geo --, `examen["niveau"]`
va de "1" a "6", `examen["questions"]` est une liste PLATE construite par
quiz_engine.py, pas les "exercices" deja groupes d'Export.jsx). Appeler
l'ancien main.py avec la signature de la mise a jour 6 plantait donc
partout (le dict `examen` se faisait iterer comme une liste, d'ou le 500
signale). Cette mise a jour 7 REND A generer_pdf_examen/generer_pdf_correction
leur signature d'origine (`examen: Dict` en premier parametre), tout en
GARDANT tout le travail visuel de la mise a jour 6 (en-tete officiel
arabe, cadres d'exercice, pastilles de bareme, corrections bidi...) --
voir plus bas comment les deux se combinent :

- `_grouper_par_exercice()` (nouveau) reconstruit des blocs visuels a
  partir de la liste PLATE `examen["questions"]` : une nouvelle boite
  demarre a chaque question qui porte un `titre_exercice` (c'est ainsi que
  quiz_engine.py aplatit deja un bloc "lecture"/"probleme" -- seule la
  PREMIERE sous-question du bloc garde le titre) ; si aucune question n'a
  jamais de titre_exercice, tout l'examen forme une seule boite.
- Les libelles matiere/niveau (arabe et francais) sont RECALCULES ici a
  partir des CLES (TITRE_MATIERE_FR/AR, format primaire "السنة N ابتدائي")
  -- Export.jsx les envoyait deja prets, main.py ne les envoie pas.
  `contenu_langue` est deduit de `examen["matiere"]` (voir _langue_contenu),
  meme convention que l'ancienne `_langue_matiere` de la version pre-mise
  a jour 6.
- Le titre du devoir n'a plus de "type_devoir" (ce concept n'existe pas
  cote quiz_engine.py/main.py) : on reconstruit "اختبار في مادة {matiere}"
  + sous-titre "{niveau} — {chapitre}", comme le faisait la version
  pre-mise a jour 6.
- `_bloc_question` gagne un vrai support pour "calcul" (frequent en maths,
  auparavant sans zone de reponse dediee) et un filet de securite
  generique pour les types que ce fichier n'a jamais rendus dedie
  (association/remise_en_ordre/tri/legende/dictee/redaction -- deja
  documente comme limitation connue dans quiz_engine.py) : au moins la
  consigne + un peu d'espace/la reponse si disponible, jamais un plantage.

Si un jour un wizard "college/lycee" (Export.jsx, exercices deja groupes,
type_devoir...) est vraiment branche sur CE backend via un AUTRE endpoint,
il faudra soit lui dedier ses propres fonctions, soit un parametre
explicite qui choisit le mode d'entree -- ne pas deviner la forme du dict
`examen` a l'aveugle.

MISE A JOUR 6 -- refonte visuelle pour matcher une "vraie feuille d'examen"
--------------------------------------------------------------------------
CE QUI A CHANGE VISUELLEMENT (toujours valable apres la mise a jour 7) :

1. L'EN-TETE OFFICIEL (pays + ministere, cartouche etablissement/eleve) est
   TOUJOURS EN ARABE, quelle que soit la matiere -- meme chose pour le
   "chrome" administratif : le mot "التمرين N" et l'unite "نقطة/نقاط" sont
   TOUJOURS en arabe. Seul le contenu reel (enonce, options, support) suit
   sa langue detectee -- voir _est_arabe_texte(). C'est le changement de
   fond par rapport a la toute premiere version, qui faisait basculer TOUT
   le document (y compris ce chrome) selon `langue`.

2. Chaque exercice est maintenant un vrai CADRE (bordure fine) avec un
   bandeau "التمرين N" + pastille de bareme total -- au lieu de l'ancienne
   "case مع N" en marge exterieure de CHAQUE question. Le bareme par
   question reste affiche, mais en simple texte, pas en case encadree.

3. Le cartouche d'en-tete n'est plus 2 blocs a bordures/grille (tableau
   "officiel a cases") mais une grille SANS BORDURE avec des lignes
   "libelle : valeur" (ou "libelle : .........." si le champ est vide).
   Une ligne "العدد : .... / {bareme total}" est incluse -- un vrai devoir
   tunisien affiche quasi toujours son bareme total sur la copie elle-meme.

4. Les lettres d'option QCM (a) b) c)...) sont TOUJOURS en latin, meme pour
   un enonce arabe.

Ce qui n'a PAS change : detection auto arabe/latin par contenu
(_contient_arabe + arabic-reshaper + python-bidi), chiffres occidentaux
(_num_ar reste un pass-through), _duree_ar (compatible "NN min" ET
"1hNN"), et la logique polices (_ensure_arabic_font, avec fallback
Traditional Arabic -> Sakkal Majalla -> Amiri, inchangee).
"""

import re
from datetime import date
from io import BytesIO
from pathlib import Path
from typing import Dict, List, Optional

import arabic_reshaper
from bidi.algorithm import get_display
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether,
)

# ---------------------------------------------------------------------------
# Ressources (polices) -- inchange
# ---------------------------------------------------------------------------
_FONTS_DIR = Path(__file__).resolve().parent / "fonts"
_ARABIC_FONT_REGISTERED = False
_POLICE_ARABE = "Amiri"   # nom actif, remplace par TraditionalArabic si dispo

_ARABIC_RANGE = re.compile(
    r'[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]'
)


def _ensure_arabic_font() -> None:
    """Enregistre la police arabe. Essaie Traditional Arabic (la vraie
    police des sujets tunisiens), puis Sakkal Majalla, puis Amiri."""
    global _ARABIC_FONT_REGISTERED, _POLICE_ARABE
    if _ARABIC_FONT_REGISTERED:
        return

    candidats = [
        ("TraditionalArabic", "TraditionalArabic.ttf", "TraditionalArabic-Bold.ttf"),
        ("SakkalMajalla", "SakkalMajalla.ttf", "SakkalMajalla-Bold.ttf"),
        ("Amiri", "Amiri-Regular.ttf", "Amiri-Bold.ttf"),
    ]
    for nom, f_reg, f_bold in candidats:
        chemin_reg = _FONTS_DIR / f_reg
        chemin_bold = _FONTS_DIR / f_bold
        if chemin_reg.exists() and chemin_bold.exists():
            pdfmetrics.registerFont(TTFont(nom, str(chemin_reg)))
            pdfmetrics.registerFont(TTFont(f"{nom}-Bold", str(chemin_bold)))
            _POLICE_ARABE = nom
            _ARABIC_FONT_REGISTERED = True
            return

    raise FileNotFoundError(
        f"Aucune police arabe trouvee dans {_FONTS_DIR}. "
        "Place Amiri-Regular.ttf et Amiri-Bold.ttf (fallback). "
        "Idealement TraditionalArabic.ttf et TraditionalArabic-Bold.ttf."
    )


def _contient_arabe(texte: str) -> bool:
    return bool(_ARABIC_RANGE.search(texte or ""))


def _ar(texte: str) -> str:
    """Reshape + reordonne un texte arabe pour ReportLab."""
    return get_display(arabic_reshaper.reshape(texte or ""))


def _est_arabe_texte(texte: str, contenu_langue: str) -> bool:
    """Determine si UN texte donne (enonce/support/option) doit etre rendu
    en arabe : detection reelle sur son contenu en priorite : un texte vide
    retombe sur contenu_langue (le "matiereEstArabe" calcule par
    Export.jsx) plutot que d'etre traite par defaut comme du latin."""
    if _contient_arabe(texte):
        return True
    if (texte or "").strip():
        return False
    return contenu_langue == "ar"


def _annee_scolaire() -> str:
    """Annee scolaire tunisienne en cours (rentree en septembre) -- utilise
    seulement si le frontend n'a rien envoye dans annee_scolaire."""
    aujourdhui = date.today()
    debut = aujourdhui.year if aujourdhui.month >= 9 else aujourdhui.year - 1
    return f"{debut} / {debut + 1}"


def _duree_ar(duree: str) -> str:
    """Traduit une duree simple en arabe ('2h30' -> '2 سا 30 د', '60 min'
    -> '60 دق'). Compatible avec les deux formats (l'ancien "NN min" et le
    nouveau selecteur DUREES d'Export.jsx : '1h','1h30','2h',...)."""
    d = (duree or "").strip()
    m = re.match(r'^(\d+)\s*min(?:ute)?s?$', d, re.IGNORECASE)
    if m:
        return f"{m.group(1)} دق"
    m = re.match(r'^(\d+)\s*h(?:eure)?s?\s*(\d+)?$', d, re.IGNORECASE)
    if m:
        heures, minutes = m.group(1), m.group(2)
        return f"{heures} سا" + (f" {minutes} د" if minutes else "")
    return d


def _num_ar(n) -> str:
    """En Tunisie on utilise les chiffres arabes OCCIDENTAUX (1, 2, 3...)
    -- les memes qu'en francais. Simple pass-through, garde pour lisibilite
    des appels et compatibilite si un jour on doit vraiment convertir."""
    return str(n)


# ---------------------------------------------------------------------------
# Libelles fixes -- portes tels quels depuis l'objet `L` d'Export.jsx, pour
# que le "chrome" (mots administratifs) soit rigoureusement identique a
# l'apercu que le PDF doit reproduire.
# ---------------------------------------------------------------------------
L = {
    "exercice": "التمرين",
    "point": "نقطة",
    "points": "نقاط",
    "page": "صفحة",
    "vrai": "صحيح",
    "faux": "خطأ",
    "etablissement": "المؤسسة التربوية",
    "annee": "السنة الدراسية",
    "matiere": "المادة",
    "niveau": "المستوى",
    "professeur": "الأستاذ(ة)",
    "nomPrenom": "الاسم واللقب",
    "classe": "القسم",
    "numero": "العدد",
    "date": "التاريخ",
    "note": "العدد",
    "corrige": "إصلاح",
    "reserveEnseignant": "وثيقة خاصة بالمربي — لا يتم توزيعها على التلاميذ",
    "aucuneQuestion": "لا توجد أسئلة",
    "reponseCorrecte": "الإجابة الصحيحة",
    "reponseAttendue": "الإجابة المنتظرة",
    "explication": "التعليل",
    "reponseNonRenseignee": "(لم يتم إدخال الإجابة)",
}

LETTRES_OPTIONS = "abcdefgh"  # toujours en latin, meme pour un enonce arabe
                               # (voir MISE A JOUR 6, point 4)

# ---------------------------------------------------------------------------
# Libelles matiere/niveau -- main.py envoie des CLES (MATIERES_VALIDES,
# NIVEAUX_VALIDES : "1".."6"), pas des libelles tout faits : on les
# reconstruit ici, comme le faisait la toute premiere version de ce
# fichier (voir MISE A JOUR 7).
# ---------------------------------------------------------------------------
TITRE_MATIERE_FR = {
    "mathematique": "Mathematiques",
    "arabe": "Arabe",
    "science": "Sciences de la vie",
    "francais": "Francais",
    "histoire_geo": "Histoire-Geographie",
    "dictee": "Dictee",
}

TITRE_MATIERE_AR = {
    "mathematique": "الرياضيات",
    "arabe": "اللغة العربية",
    "science": "الإيقاظ العلمي",
    "francais": "الفرنسية",
    "histoire_geo": "التاريخ والجغرافيا",
}


def _langue_contenu(matiere_key: str) -> str:
    """"fr" pour le francais / la dictee, "ar" pour tout le reste -- meme
    convention que l'ancienne _langue_matiere() de la version d'origine."""
    return "fr" if matiere_key in ("francais", "dictee") else "ar"


def _grouper_par_exercice(questions: List[Dict]) -> List[Dict]:
    """Reconstruit des blocs visuels (l'equivalent de l'"exercices" groupe
    d'un autre wizard) a partir de la liste PLATE que renvoie
    quiz_engine.py : une nouvelle boite demarre a chaque question qui
    porte un `titre_exercice` (c'est exactement ainsi que quiz_engine.py
    aplatit un bloc "lecture"/"probleme" -- seule la PREMIERE sous-question
    du bloc garde ce titre, voir _vers_question_api la-bas). Si aucune
    question n'en porte jamais, tout l'examen forme une seule boite plutot
    que de ne rien afficher."""
    groupes: List[Dict] = []
    for q in questions or []:
        if q.get("titre_exercice") or not groupes:
            groupes.append({"numero": len(groupes) + 1, "questions": []})
        groupes[-1]["questions"].append(q)
    for g in groupes:
        g["total_points"] = sum(q.get("points", 0) for q in g["questions"])
    return groupes


# ---------------------------------------------------------------------------
# Mise en page
# ---------------------------------------------------------------------------
_MARGE = 1.2 * cm
_LARGEUR_UTILE = A4[0] - 2 * _MARGE
_PAD_BOX = 0.32 * cm                              # marge interieure des cadres d'exercice
_LARGEUR_CONTENU_BOX = _LARGEUR_UTILE - 2 * _PAD_BOX
_LARGEUR_BADGE = 2.3 * cm
_LARGEUR_POINTS_QUESTION = 2.3 * cm

# ---------------------------------------------------------------------------
# Couleurs style tunisien -- rouge aligne sur celui de l'apercu (#7a0008)
# ---------------------------------------------------------------------------
ROUGE_TUNISIEN = colors.HexColor("#7a0008")
BORDURE_ROUGE_CLAIRE = colors.HexColor("#e4cccf")   # ~teinte 20% du rouge sur blanc
BADGE_BG_ROUGE = colors.HexColor("#f4ebec")         # ~teinte 8% du rouge sur blanc
VERT_TUNISIEN = colors.HexColor("#059669")          # vert "emerald" de l'apercu (corrige)
GRIS_CLAIR = colors.HexColor("#F5F5F5")


# ---------------------------------------------------------------------------
# Styles -- tailles/polices calibrees sur les vraies copies + l'apercu JSX
# ---------------------------------------------------------------------------
def _styles() -> Dict[str, ParagraphStyle]:
    _ensure_arabic_font()
    P = _POLICE_ARABE
    PB = f"{_POLICE_ARABE}-Bold"

    return {
        # --- En-tete officiel (toujours arabe) ---
        "pays_arabe": ParagraphStyle(
            "pays", fontName=PB, fontSize=15, leading=20,
            alignment=TA_CENTER, textColor=ROUGE_TUNISIEN, spaceAfter=2
        ),
        "ministere_arabe": ParagraphStyle(
            "ministere", fontName=PB, fontSize=12, leading=16,
            alignment=TA_CENTER, textColor=ROUGE_TUNISIEN, spaceAfter=2
        ),
        "identite_arabe": ParagraphStyle(
            "identite", fontName=P, fontSize=10.5, leading=16.5,
            alignment=TA_RIGHT
        ),
        # --- Titre du devoir ---
        "titre_devoir_arabe": ParagraphStyle(
            "titre_devoir_ar", fontName=PB, fontSize=18, leading=25,
            alignment=TA_CENTER, textColor=colors.HexColor("#250002"),
            spaceBefore=2, spaceAfter=2
        ),
        "titre_devoir_latin": ParagraphStyle(
            "titre_devoir_lat", fontName="Times-Bold", fontSize=16, leading=21,
            alignment=TA_CENTER, textColor=colors.HexColor("#250002"),
            spaceBefore=2, spaceAfter=2
        ),
        "sous_titre_arabe": ParagraphStyle(
            "sous_titre_ar", fontName=P, fontSize=11.5, leading=17,
            alignment=TA_CENTER, textColor=colors.HexColor("#444444"), spaceAfter=2
        ),
        "sous_titre_latin": ParagraphStyle(
            "sous_titre_lat", fontName="Times-Italic", fontSize=10.5, leading=15,
            alignment=TA_CENTER, textColor=colors.HexColor("#444444"), spaceAfter=2
        ),
        # --- Chrome exercice (toujours arabe) ---
        "exercice_arabe": ParagraphStyle(
            "exercice_ar", fontName=PB, fontSize=13.5, leading=19,
            alignment=TA_RIGHT, textColor=ROUGE_TUNISIEN
        ),
        "badge_arabe": ParagraphStyle(
            "badge_ar", fontName=PB, fontSize=10, leading=13,
            alignment=TA_CENTER, textColor=ROUGE_TUNISIEN
        ),
        "points_ligne_arabe": ParagraphStyle(
            "points_ligne", fontName=PB, fontSize=9.5, leading=12,
            alignment=TA_CENTER, textColor=ROUGE_TUNISIEN
        ),
        # --- Question / support ---
        "question_arabe": ParagraphStyle(
            "question_ar", fontName=PB, fontSize=13, leading=19,
            alignment=TA_RIGHT, spaceAfter=3
        ),
        "question_latin": ParagraphStyle(
            "question_lat", fontName="Times-Bold", fontSize=11.5, leading=16,
            alignment=TA_LEFT, spaceAfter=3
        ),
        "support_arabe": ParagraphStyle(
            "support_ar", fontName=P, fontSize=12, leading=18,
            alignment=TA_RIGHT, textColor=colors.black, spaceAfter=3
        ),
        "support_latin": ParagraphStyle(
            "support_lat", fontName="Times-Roman", fontSize=11, leading=15,
            alignment=TA_LEFT, textColor=colors.black, spaceAfter=3
        ),
        # --- Options QCM ---
        "option_arabe": ParagraphStyle(
            "option_ar", fontName=P, fontSize=12, leading=18,
            alignment=TA_RIGHT, rightIndent=12, spaceAfter=2
        ),
        "option_latin": ParagraphStyle(
            "option_lat", fontName="Times-Roman", fontSize=10.5, leading=14,
            alignment=TA_LEFT, leftIndent=12, spaceAfter=2
        ),
        "option_correcte_arabe": ParagraphStyle(
            "option_correcte_ar", fontName=PB, fontSize=12, leading=18,
            alignment=TA_RIGHT, rightIndent=12, spaceAfter=2, textColor=VERT_TUNISIEN
        ),
        "option_correcte_latin": ParagraphStyle(
            "option_correcte_lat", fontName="Times-Bold", fontSize=10.5, leading=14,
            alignment=TA_LEFT, leftIndent=12, spaceAfter=2, textColor=VERT_TUNISIEN
        ),
        # --- Reponse (corrige) ---
        "reponse_arabe": ParagraphStyle(
            "reponse_ar", fontName=PB, fontSize=12, leading=18,
            alignment=TA_RIGHT, textColor=VERT_TUNISIEN, spaceAfter=3
        ),
        # reponse_latin/explication_latin : actuellement JAMAIS choisis
        # (les libelles "الإجابة الصحيحة"/"التعليل" sont toujours arabes,
        # voir _bloc_question) -- gardes par symmetrie et pour un futur
        # rendu ou ces libelles deviendraient eux-memes bilingues.
        "reponse_latin": ParagraphStyle(
            "reponse_lat", fontName="Times-Bold", fontSize=10.5, leading=14,
            alignment=TA_LEFT, textColor=VERT_TUNISIEN, spaceAfter=3
        ),
        "explication_arabe": ParagraphStyle(
            "explication_ar", fontName=P, fontSize=10, leading=15,
            alignment=TA_RIGHT, textColor=colors.grey, spaceAfter=4
        ),
        "explication_latin": ParagraphStyle(
            "explication_lat", fontName="Times-Italic", fontSize=9, leading=12,
            alignment=TA_LEFT, textColor=colors.grey, spaceAfter=4
        ),
        # --- Cellules de tableau (donnees chiffrees dans une question) ---
        "cell_latin": ParagraphStyle(
            "cell_lat", fontName="Times-Roman", fontSize=10.5, leading=14, alignment=TA_CENTER
        ),
        "cell_latin_bold": ParagraphStyle(
            "cell_lat_b", fontName="Times-Bold", fontSize=11, leading=15, alignment=TA_CENTER
        ),
        "cell_arabe": ParagraphStyle(
            "cell_ar", fontName=P, fontSize=12, leading=17, alignment=TA_CENTER
        ),
        "cell_arabe_bold": ParagraphStyle(
            "cell_ar_b", fontName=PB, fontSize=12.5, leading=18, alignment=TA_CENTER
        ),
    }


def _p(texte: str, styles: Dict, style_key: str, contenu_langue: str = "fr") -> Paragraph:
    """Paragraph avec police/direction adaptee a la langue REELLE du texte
    (fallback sur contenu_langue si le texte est vide)."""
    if _est_arabe_texte(texte, contenu_langue):
        return Paragraph(_ar(texte), styles[f"{style_key}_arabe"])
    return Paragraph(texte or "", styles[f"{style_key}_latin"])


# ---------------------------------------------------------------------------
# Petits helpers de mise en page
# ---------------------------------------------------------------------------
def _ligne_horizontale(largeur: float, couleur=ROUGE_TUNISIEN, epaisseur: float = 1.0) -> Table:
    """Un simple filet horizontal (Table 1x1 avec fond colore) -- utilise
    pour le separateur sous l'en-tete, sous chaque bandeau d'exercice, et
    pour le petit trait sous le titre du devoir."""
    t = Table([[""]], colWidths=[largeur], rowHeights=[epaisseur])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), couleur),
        ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    return t


def _badge_points(points, styles: Dict) -> Table:
    """Pastille de bareme (ex: '3 نقاط') -- fond rouge tres clair, texte
    rouge, comme le badge de l'apercu ('rounded-full bg-[#7a0008]/[0.08]')."""
    unite = L["points"] if points != 1 else L["point"]
    texte = _ar(f"{_num_ar(points)} {unite}")
    t = Table([[Paragraph(texte, styles["badge_arabe"])]], colWidths=[_LARGEUR_BADGE])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), BADGE_BG_ROUGE),
        ("BOX", (0, 0), (-1, -1), 0.6, BORDURE_ROUGE_CLAIRE),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 3), ("RIGHTPADDING", (0, 0), (-1, -1), 3),
    ]))
    return t


def _proteger_latin(valeur: str) -> str:
    """Isole une valeur latine/numerique (annee '2025 / 2026', date,
    nom...) des reordonnancements bidi indesirables quand elle est
    combinee a un libelle arabe dans UNE seule chaine reshapee : sans ca,
    '2025 / 2026' peut se retrouver affiche '2026 / 2025' (bidi traite les
    deux nombres separes par '/' comme deux runs distincts et les
    reordonne dans un contexte RTL). Les marques U+200E (LRM) forcent cet
    isolat a rester en ordre LTR. Ne touche pas une valeur qui contient
    elle-meme de l'arabe -- elle doit continuer a etre reshapee normalement."""
    if not valeur or _contient_arabe(valeur):
        return valeur
    return f"\u200E{valeur}\u200E"


def _ligne_identite(label: str, valeur: str, styles: Dict, vide_len: int = 24) -> Paragraph:
    """Une ligne 'libelle : valeur' du cartouche -- si valeur est vide, une
    ligne de points sert de blanc a remplir a la main (comme les
    '............' de l'apercu). Reshape le tout EN UN SEUL bloc (et pas
    label puis valeur separement) pour laisser bidi/reshaper gerer
    correctement l'ordre visuel -- coller deux fragments deja reordonnes
    donnerait un resultat casse -- voir aussi _proteger_latin() pour le cas
    des valeurs numeriques/latines a plusieurs "runs" (ex: une annee)."""
    valeur = (valeur or "").strip() or ("." * vide_len)
    return Paragraph(_ar(f"{label} : {_proteger_latin(valeur)}"), styles["identite_arabe"])


def _tableau_donnees(headers: List[str], rows: List[List[str]], arabe: bool, styles: Dict) -> Table:
    """Tableau integre dans une question (montants, mesures...) -- inchange
    dans l'esprit, prend juste `styles` en parametre plutot que de le
    recalculer (evite de re-enregistrer les polices a chaque appel)."""
    style_header = styles["cell_arabe_bold"] if arabe else styles["cell_latin_bold"]
    style_cell = styles["cell_arabe"] if arabe else styles["cell_latin"]

    data = [[Paragraph(_ar(h) if arabe else h, style_header) for h in headers]]
    for row in rows:
        data.append([Paragraph(_ar(c) if arabe else c, style_cell) for c in row])

    n = max(len(headers), 1)
    largeur = _LARGEUR_CONTENU_BOX / n
    t = Table(data, colWidths=[largeur] * n)
    t.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.7, colors.black),
        ("BACKGROUND", (0, 0), (-1, 0), GRIS_CLAIR),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    return t


# ---------------------------------------------------------------------------
# Cartouche d'identite + titre du devoir
# ---------------------------------------------------------------------------
def _cartouche_identite(
    styles: Dict, *, pays_ar: str, ministere_ar: str, nom_etablissement: str,
    annee_scolaire: str, matiere_label_ar: str, niveau_label_ar: str,
    nom_professeur: str, bareme_total: int,
) -> List:
    """En-tete officiel : pays + ministere centres, filet fin, puis une
    grille SANS BORDURE a 2 colonnes (comme l'apercu) plutot que les 2
    blocs a cases de l'ancienne version."""
    story: List = [
        Paragraph(_ar(pays_ar), styles["pays_arabe"]),
        Paragraph(_ar(ministere_ar), styles["ministere_arabe"]),
        Spacer(1, 0.12 * cm),
        _ligne_horizontale(_LARGEUR_UTILE, BORDURE_ROUGE_CLAIRE, 1.1),
        Spacer(1, 0.28 * cm),
    ]

    droite = [
        [_ligne_identite(L["etablissement"], nom_etablissement, styles, 30)],
        [_ligne_identite(L["annee"], annee_scolaire, styles, 12)],
        [_ligne_identite(L["matiere"], matiere_label_ar, styles, 16)],
        [_ligne_identite(L["niveau"], niveau_label_ar, styles, 16)],
        [_ligne_identite(L["professeur"], nom_professeur, styles, 30)],
    ]
    gauche = [
        [_ligne_identite(L["nomPrenom"], "", styles, 32)],
        [_ligne_identite(f"{L['classe']} / {L['numero']}", "", styles, 20)],
        [_ligne_identite(L["date"], "", styles, 22)],
        # AJOUT (voir MISE A JOUR 6, point 3) : le total sur la copie elle-meme.
        [_ligne_identite(L["note"], f".... / {_num_ar(bareme_total)}", styles, 0)],
    ]

    largeur_col = _LARGEUR_UTILE / 2
    pad_col = dict(LEFTPADDING=4, RIGHTPADDING=4, TOPPADDING=1.5, BOTTOMPADDING=1.5)

    t_droite = Table(droite, colWidths=[largeur_col])
    t_droite.setStyle(TableStyle([(k, (0, 0), (-1, -1), v) for k, v in pad_col.items()]))
    t_gauche = Table(gauche, colWidths=[largeur_col])
    t_gauche.setStyle(TableStyle([(k, (0, 0), (-1, -1), v) for k, v in pad_col.items()]))

    grille = Table([[t_droite, t_gauche]], colWidths=[largeur_col, largeur_col])
    grille.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEAFTER", (0, 0), (0, -1), 0.6, BORDURE_ROUGE_CLAIRE),
        ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(grille)
    return story


def _titre_devoir(titre_ar: str, titre_fr: str, styles: Dict, contenu_langue: str, sous_titre_ar: str = "") -> List:
    """Titre central du devoir + petit trait rouge centre en dessous. Le
    sous-titre optionnel (ex: "{niveau} — {chapitre}") est toujours rendu
    en arabe -- comme le reste du chrome administratif (voir MISE A JOUR 6)."""
    story: List = [Spacer(1, 0.25 * cm)]
    story.append(_p(titre_ar or titre_fr or "Devoir", styles, "titre_devoir", contenu_langue="ar"))
    if sous_titre_ar:
        story.append(Paragraph(_ar(sous_titre_ar), styles["sous_titre_arabe"]))
    trait = _ligne_horizontale(3.2 * cm, ROUGE_TUNISIEN, 1.4)
    trait.hAlign = "CENTER"
    story.append(trait)
    story.append(Spacer(1, 0.4 * cm))
    return story


# ---------------------------------------------------------------------------
# Une question -> flowables (sujet OU corrige selon `correction`)
# ---------------------------------------------------------------------------
def _bloc_question(i: int, q: Dict, styles: Dict, contenu_langue: str, correction: bool = False) -> List:
    """Construit une question complete : [support optionnel] + ligne
    'i) enonce ... points' + zone de reponse (options / vrai-faux / lignes
    a completer) + [tableau optionnel]. En mode correction, la zone de
    reponse montre la bonne reponse en vert (+ l'explication si fournie)
    au lieu d'un espace a remplir.

    Remplace les anciennes _bloc_question()/_bloc_correction() qui
    dupliquaient presque tout leur code -- desormais une seule fonction
    avec un booleen `correction`."""
    contenu: List = []
    texte_ref = f"{q.get('question', '')} {q.get('support', '')}"
    arabe = _est_arabe_texte(texte_ref, contenu_langue)

    # Support (rarement envoye par le payload actuel d'Export.jsx, mais
    # gere par securite/compatibilite si le frontend l'ajoute plus tard).
    if q.get("support"):
        support_style = styles["support_arabe"] if arabe else styles["support_latin"]
        contenu.append(Paragraph(_ar(q["support"]) if arabe else q["support"], support_style))

    # Ligne "i) enonce" + points -- le cote de la pastille de points suit
    # la langue REELLE de CETTE question (comme dans Export.jsx, ou
    # justify-between s'inverse selon dir=rtl/ltr herite), mais l'UNITE
    # "نقطة/نقاط" reste toujours en arabe (chrome -- voir MISE A JOUR 6).
    points = q.get("points", 0) or 0
    unite = L["points"] if points != 1 else L["point"]
    para_points = Paragraph(_ar(f"{_num_ar(points)} {unite}"), styles["points_ligne_arabe"])
    para_question = _p(f"{i + 1}) {q.get('question', '')}", styles, "question", contenu_langue)

    largeur_pts = _LARGEUR_POINTS_QUESTION
    largeur_txt = _LARGEUR_CONTENU_BOX - largeur_pts
    if arabe:
        data, colw = [[para_points, para_question]], [largeur_pts, largeur_txt]
    else:
        data, colw = [[para_question, para_points]], [largeur_txt, largeur_pts]
    ligne = Table(data, colWidths=colw)
    ligne.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (0, 0), (0, 0), "CENTER"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    contenu.append(ligne)

    qtype = q.get("type", "ouverte")
    style_option = styles["option_arabe"] if arabe else styles["option_latin"]

    if qtype == "qcm":
        options = q.get("options") or []
        idx_correct = q.get("reponseCorrecteIndex")
        for j, opt in enumerate(options):
            lettre = LETTRES_OPTIONS[j] if j < len(LETTRES_OPTIONS) else str(j + 1)
            est_correcte = correction and idx_correct is not None and j == idx_correct
            coche = "(X)" if est_correcte else "(  )"
            style_opt = (
                (styles["option_correcte_arabe"] if arabe else styles["option_correcte_latin"])
                if est_correcte else style_option
            )
            if arabe:
                contenu.append(Paragraph(_ar(f"{coche} {lettre}. {opt}"), style_opt))
            else:
                contenu.append(Paragraph(f"{coche} {lettre}) {opt}", style_opt))

    elif qtype == "vrai_faux":
        if correction:
            # Le libelle "الإجابة الصحيحة" est TOUJOURS arabe (chrome, voir
            # MISE A JOUR 6) : on utilise TOUJOURS le style "_arabe", meme
            # pour une question en francais -- utiliser `arabe` (qui reflete
            # la langue de la QUESTION, pas de ce libelle) ici appliquerait
            # une police latine sans glyphes arabes a du texte arabe, ce qui
            # produit des blocs illisibles au lieu du texte.
            correcte = bool(q.get("reponseCorrecte"))
            contenu.append(Paragraph(
                _ar(f"{L['reponseCorrecte']} : {L['vrai'] if correcte else L['faux']}"),
                styles["reponse_arabe"],
            ))
        else:
            # Chrome toujours arabe (voir MISE A JOUR 6) -- calibre sur les
            # vrais sujets, ne pas faire varier selon la langue du contenu.
            contenu.append(Paragraph(_ar(f"{L['vrai']} (  )        {L['faux']} (  )"), style_option))

    elif qtype in ("ouverte", "texte_trous"):
        if correction:
            # Meme raison que pour vrai_faux juste au-dessus : "الإجابة
            # المنتظرة" est un libelle toujours arabe, style TOUJOURS
            # "_arabe" quelle que soit la langue de la question.
            reponse = str(q.get("reponseAttendue") or "").strip()
            texte = reponse or L["reponseNonRenseignee"]
            contenu.append(Paragraph(_ar(f"{L['reponseAttendue']} : {texte}"), styles["reponse_arabe"]))
        else:
            contenu.append(Spacer(1, 0.15 * cm))
            for _ in range(3):
                contenu.append(Paragraph("_" * 58, style_option))

    elif qtype == "calcul":
        # Frequent en maths -- absent des types geres par la toute
        # premiere version de ce fichier (qui ne montrait aucune zone de
        # reponse dediee), ajoute ici : une ligne a completer au sujet,
        # la valeur attendue (+ unite) au corrige.
        if correction:
            reponse = q.get("reponseAttendue")
            unite = (q.get("unite") or "").strip()
            texte = f"{reponse} {unite}".strip() if reponse not in (None, "") else L["reponseNonRenseignee"]
            contenu.append(Paragraph(_ar(f"{L['reponseAttendue']} : {texte}"), styles["reponse_arabe"]))
        else:
            contenu.append(Spacer(1, 0.15 * cm))
            contenu.append(Paragraph("_" * 40, style_option))

    else:
        # Types que ce fichier n'a jamais rendus de facon dediee
        # (association, remise_en_ordre, tri, legende, dictee, redaction --
        # limitation deja documentee dans quiz_engine.py). On affiche au
        # moins la consigne (deja fait plus haut) + un peu d'espace, et au
        # corrige la meilleure information disponible plutot que de ne
        # rien montrer du tout ou de planter sur un type inconnu.
        if correction:
            reponse = q.get("reponseAttendue")
            if reponse in (None, ""):
                brut = q.get("reponseCorrecte")
                if isinstance(brut, list):
                    reponse = ", ".join(str(x) for x in brut)
                elif brut not in (None, ""):
                    reponse = str(brut)
            if q.get("texte_dictee"):
                reponse = q["texte_dictee"]
            if reponse:
                contenu.append(Paragraph(_ar(f"{L['reponseAttendue']} : {reponse}"), styles["reponse_arabe"]))
        else:
            contenu.append(Spacer(1, 0.15 * cm))
            contenu.append(Paragraph("_" * 58, style_option))
            contenu.append(Paragraph("_" * 58, style_option))

    if correction:
        explication = (q.get("explication") or "").strip()
        if explication:
            # Idem : "التعليل" est un libelle toujours arabe -- style
            # toujours "_arabe" (voir les deux remarques identiques
            # ci-dessus pour vrai_faux/ouverte -- meme bug, meme fix).
            contenu.append(Paragraph(_ar(f"{L['explication']} : {explication}"), styles["explication_arabe"]))

    if q.get("tableau"):
        contenu.append(Spacer(1, 0.15 * cm))
        contenu.append(_tableau_donnees(q["tableau"]["headers"], q["tableau"]["rows"], arabe, styles))

    return contenu


# ---------------------------------------------------------------------------
# Un exercice -> cadre avec bandeau + questions
# ---------------------------------------------------------------------------
def _boite_exercice(exercice: Dict, styles: Dict, contenu_langue: str, correction: bool) -> Table:
    """Le cadre d'un exercice : bandeau 'التمرين N' + pastille de bareme
    total (toujours cote gauche, titre a droite -- chrome fixe, pas de
    variation selon la langue du contenu, voir MISE A JOUR 6), filet, puis
    chaque question."""
    numero = exercice.get("numero", 1)
    questions = exercice.get("questions") or []
    total_points = exercice.get("total_points", sum(q.get("points", 0) for q in questions))

    titre = Paragraph(_ar(f"{L['exercice']} {_num_ar(numero)}"), styles["exercice_arabe"])
    badge = _badge_points(total_points, styles)
    entete = Table([[badge, titre]], colWidths=[_LARGEUR_BADGE, _LARGEUR_CONTENU_BOX - _LARGEUR_BADGE])
    entete.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))

    contenu: List = [entete, Spacer(1, 0.12 * cm),
                     _ligne_horizontale(_LARGEUR_CONTENU_BOX, BORDURE_ROUGE_CLAIRE, 0.8),
                     Spacer(1, 0.2 * cm)]

    if not questions:
        contenu.append(Paragraph(_ar(L["aucuneQuestion"]), styles["explication_arabe"]))
    else:
        for i, q in enumerate(questions):
            contenu += _bloc_question(i, q, styles, contenu_langue, correction=correction)
            if i < len(questions) - 1:
                contenu.append(Spacer(1, 0.22 * cm))

    boite = Table([[contenu]], colWidths=[_LARGEUR_UTILE])
    boite.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.8, BORDURE_ROUGE_CLAIRE),
        ("LEFTPADDING", (0, 0), (-1, -1), _PAD_BOX), ("RIGHTPADDING", (0, 0), (-1, -1), _PAD_BOX),
        ("TOPPADDING", (0, 0), (-1, -1), _PAD_BOX), ("BOTTOMPADDING", (0, 0), (-1, -1), _PAD_BOX),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    return boite


def _section_exercices(exercices: List[Dict], styles: Dict, contenu_langue: str, correction: bool = False) -> List:
    story: List = []
    if not exercices:
        story.append(Paragraph(_ar(L["aucuneQuestion"]), styles["explication_arabe"]))
        return story
    for ex in exercices:
        story.append(KeepTogether(_boite_exercice(ex, styles, contenu_langue, correction)))
        story.append(Spacer(1, 0.38 * cm))
    return story


def _pied_de_page_factory(pagination: bool):
    """Callback onFirstPage/onLaterPages -- identique pour le sujet et le
    corrige, factorise ici pour ne pas le dupliquer deux fois."""
    def _pied(canvas, doc_):
        if not pagination:
            return
        canvas.saveState()
        canvas.setFillColor(colors.grey)
        canvas.setFont(_POLICE_ARABE, 9)
        canvas.drawCentredString(A4[0] / 2, 1 * cm, _ar(f"{L['page']} {_num_ar(doc_.page)}"))
        canvas.restoreState()
    return _pied


# ---------------------------------------------------------------------------
# Points d'entree -- signature d'origine (voir MISE A JOUR 7) :
# generer_pdf_examen(examen, langue=, en_tete=, pagination=, nom_etablissement=)
# ---------------------------------------------------------------------------
def _preparer_rendu(examen: Dict, langue: str) -> Dict:
    """Calculs communs a generer_pdf_examen()/generer_pdf_correction() :
    validation de `langue`, libelles matiere/niveau, langue du contenu,
    regroupement en exercices et bareme total. Factorise pour ne pas
    dupliquer cette logique deux fois."""
    if langue != "fr":
        # main.py verifie deja ca AVANT d'appeler cette fonction (voir
        # exporter_examen/exporter_correction_examen) et renvoie un 400 --
        # ce ValueError est un filet de securite en plus, pas la premiere
        # ligne de defense.
        raise ValueError(
            f"Rendu en langue {langue!r} pas encore disponible (francais uniquement pour l'instant)."
        )

    matiere_key = examen.get("matiere", "")
    niveau = str(examen.get("niveau", ""))
    questions = examen.get("questions") or []
    exercices = _grouper_par_exercice(questions)
    bareme_total = sum(q.get("points", 0) for q in questions)

    return {
        "matiere_ar": TITRE_MATIERE_AR.get(matiere_key, matiere_key),
        "matiere_fr": TITRE_MATIERE_FR.get(matiere_key, matiere_key),
        "niveau_ar": f"السنة {niveau} ابتدائي" if niveau else "",
        "niveau_fr": f"{niveau}e annee" if niveau else "",
        "chapitre": examen.get("chapitre", ""),
        "duree": examen.get("duree", "60 min"),
        "contenu_langue": _langue_contenu(matiere_key),
        "exercices": exercices,
        "bareme_total": bareme_total,
    }


def generer_pdf_examen(
    examen: Dict,
    langue: str = "fr",
    en_tete: bool = True,
    pagination: bool = True,
    nom_etablissement: str = "",
    nom_professeur: str = "",
    annee_scolaire: str = "",
    **_ignores,
) -> bytes:
    """Point d'entree appele par POST /api/examens/{id}/export (main.py).
    `examen` est le dict complet renvoye par db.get_examen() -- voir
    MISE A JOUR 7 en tete de fichier pour le detail du contrat. `**_ignores`
    avale tout champ imprevu plutot que de planter."""
    ctx = _preparer_rendu(examen, langue)
    styles = _styles()

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4, leftMargin=_MARGE, rightMargin=_MARGE,
        topMargin=1.2 * cm, bottomMargin=1.2 * cm,
    )

    story: List = []
    if en_tete:
        story += _cartouche_identite(
            styles, pays_ar="الجمهورية التونسية", ministere_ar="وزارة التربية",
            nom_etablissement=nom_etablissement,
            annee_scolaire=annee_scolaire or _annee_scolaire(),
            matiere_label_ar=ctx["matiere_ar"], niveau_label_ar=ctx["niveau_ar"],
            nom_professeur=nom_professeur, bareme_total=ctx["bareme_total"],
        )

    titre_ar = f"اختبار في مادة {ctx['matiere_ar']}"
    titre_fr = f"Examen de {ctx['matiere_fr']}"
    sous_titre = f"{ctx['niveau_ar']} — {ctx['chapitre']}" if ctx["chapitre"] else ctx["niveau_ar"]
    story += _titre_devoir(titre_ar, titre_fr, styles, ctx["contenu_langue"], sous_titre_ar=sous_titre)
    story += _section_exercices(ctx["exercices"], styles, ctx["contenu_langue"], correction=False)

    pied = _pied_de_page_factory(pagination)
    doc.build(story, onFirstPage=pied, onLaterPages=pied)
    return buffer.getvalue()


def generer_pdf_correction(
    examen: Dict,
    langue: str = "fr",
    en_tete: bool = True,
    pagination: bool = True,
    nom_etablissement: str = "",
    nom_professeur: str = "",
    annee_scolaire: str = "",
    **_ignores,
) -> bytes:
    """Point d'entree appele par POST /api/examens/{id}/export/corrige --
    corrige (reponses + bareme + explications) du meme examen que
    generer_pdf_examen(), meme mise en page. Reutilise tous les memes
    helpers avec correction=True plutot que de dupliquer la construction
    du cadre d'exercice."""
    ctx = _preparer_rendu(examen, langue)
    styles = _styles()

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4, leftMargin=_MARGE, rightMargin=_MARGE,
        topMargin=1.2 * cm, bottomMargin=1.2 * cm,
    )

    story: List = []
    if en_tete:
        story += _cartouche_identite(
            styles, pays_ar="الجمهورية التونسية", ministere_ar="وزارة التربية",
            nom_etablissement=nom_etablissement,
            annee_scolaire=annee_scolaire or _annee_scolaire(),
            matiere_label_ar=ctx["matiere_ar"], niveau_label_ar=ctx["niveau_ar"],
            nom_professeur=nom_professeur, bareme_total=ctx["bareme_total"],
        )

    titre_ar = f"{L['corrige']} — اختبار في مادة {ctx['matiere_ar']}"
    titre_fr = f"Corrige — Examen de {ctx['matiere_fr']}"
    sous_titre = f"{ctx['niveau_ar']} — {ctx['chapitre']}" if ctx["chapitre"] else ctx["niveau_ar"]
    story += _titre_devoir(titre_ar, titre_fr, styles, ctx["contenu_langue"], sous_titre_ar=sous_titre)
    story.append(Paragraph(_ar(L["reserveEnseignant"]), styles["explication_arabe"]))
    story.append(Spacer(1, 0.3 * cm))

    story += _section_exercices(ctx["exercices"], styles, ctx["contenu_langue"], correction=True)

    pied = _pied_de_page_factory(pagination)
    doc.build(story, onFirstPage=pied, onLaterPages=pied)
    return buffer.getvalue()