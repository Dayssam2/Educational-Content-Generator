"""Export PDF des examens -- mise en page d'un devoir tunisien de l'ecole primaire.

Structure d'une copie :
  * cartouche en 3 cases : ecole / titre du devoir / eleve (+ case du score)
  * consignes ("التعليمة 1", "Consigne 1") avec la colonne des criteres (مع1, C1...)
    et la case d'evaluation pour l'enseignant
  * lignes pointillees pour repondre
  * "جدول إسناد الأعداد" (grille d'evaluation) + score final + signature du parent
Le sens de la page (droite->gauche ou gauche->droite) suit la langue de la matiere.
"""

import base64
import logging
import re
import urllib.request
from datetime import date
from io import BytesIO
from pathlib import Path
from typing import Dict, List, Optional
from xml.sax.saxutils import escape

import arabic_reshaper
from bidi.algorithm import get_display
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    Flowable, Image as RLImage, KeepTogether, Paragraph, SimpleDocTemplate, Spacer,
    Table, TableStyle,
)

log = logging.getLogger(__name__)


_FONTS_DIR = Path(__file__).resolve().parent / "fonts"
_ARABIC_FONT_REGISTERED = False
_POLICE_ARABE = "Amiri"

_ARABIC_RANGE = re.compile(r'[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]')
_CTRL_BIDI = re.compile(r'[‎‏‪-‮⁦-⁩]')
_RUN_LTR = re.compile(r'\(?[0-9](?:[0-9\s+\-×x*÷/=.,:<>()]*(?:[0-9=)]|\.{2,}))?')


def _ensure_arabic_font() -> None:
    global _ARABIC_FONT_REGISTERED, _POLICE_ARABE
    if _ARABIC_FONT_REGISTERED:
        return
    candidats = [
        ("TraditionalArabic", "TraditionalArabic.ttf", "TraditionalArabic-Bold.ttf"),
        ("SakkalMajalla", "SakkalMajalla.ttf", "SakkalMajalla-Bold.ttf"),
        ("Amiri", "Amiri-Regular.ttf", "Amiri-Bold.ttf"),
    ]
    for nom, f_reg, f_bold in candidats:
        chemin_reg, chemin_bold = _FONTS_DIR / f_reg, _FONTS_DIR / f_bold
        if chemin_reg.exists() and chemin_bold.exists():
            pdfmetrics.registerFont(TTFont(nom, str(chemin_reg)))
            pdfmetrics.registerFont(TTFont(f"{nom}-Bold", str(chemin_bold)))
            _POLICE_ARABE = nom
            _ARABIC_FONT_REGISTERED = True
            return
    raise FileNotFoundError(
        f"Aucune police arabe trouvee dans {_FONTS_DIR}. "
        "Place Amiri-Regular.ttf et Amiri-Bold.ttf (ou TraditionalArabic.ttf / -Bold.ttf)."
    )


def _contient_arabe(texte: str) -> bool:
    return bool(_ARABIC_RANGE.search(texte or ""))


def _ligne_visuelle(ligne: str) -> str:
    """Une ligne logique -> ordre visuel (forme des lettres + sens d'ecriture)."""
    if _contient_arabe(ligne):
        runs: List[str] = []

        def _garder(m):
            runs.append(m.group(0))
            return chr(0xE000 + len(runs) - 1)

        ligne = _RUN_LTR.sub(_garder, ligne)
        vis = get_display(arabic_reshaper.reshape(ligne), base_dir="R")
        for i, run in enumerate(runs):
            vis = vis.replace(chr(0xE000 + i), run)
    else:
        vis = get_display(ligne, base_dir="L")
    return _CTRL_BIDI.sub("", vis)


def _ar(texte: str) -> str:
    """Conversion simple (une seule ligne : pied de page, cellules courtes)."""
    return _ligne_visuelle(texte or "")


class ParaAr(Flowable):
    """Paragraphe arabe qui passe correctement a la ligne.

    ReportLab coupe les lignes APRES la mise en ordre visuelle, ce qui inverse l'ordre
    des lignes d'un texte arabe long. Ici on coupe d'abord le texte logique, puis on
    met chaque ligne dans l'ordre visuel.
    """

    def __init__(self, texte: str, style: ParagraphStyle, souligne: bool = False):
        super().__init__()
        self.texte = texte or ""
        self.style = style
        self.souligne = souligne
        self.spaceBefore = style.spaceBefore
        self.spaceAfter = style.spaceAfter
        self._p: Optional[Paragraph] = None

    def _lignes(self, largeur: float) -> List[str]:
        police, taille = self.style.fontName, self.style.fontSize
        sortie: List[str] = []
        for bloc in self.texte.split("\n"):
            mots = bloc.split()
            if not mots:
                sortie.append("")
                continue
            courante: List[str] = []
            for mot in mots:
                essai = " ".join(courante + [mot])
                if courante and pdfmetrics.stringWidth(arabic_reshaper.reshape(essai), police, taille) > largeur:
                    sortie.append(" ".join(courante))
                    courante = [mot]
                else:
                    courante.append(mot)
            if courante:
                sortie.append(" ".join(courante))
        return sortie

    def _construire(self, largeur: float) -> Paragraph:
        utile = max(20, largeur - self.style.leftIndent - self.style.rightIndent - 2)
        lignes = []
        for l in self._lignes(utile):
            vis = escape(_ligne_visuelle(l)).replace("  ", "&nbsp; ") if l else "&nbsp;"
            lignes.append(f"<u>{vis}</u>" if self.souligne and l else vis)
        return Paragraph("<br/>".join(lignes) or "&nbsp;", self.style)

    def wrap(self, aw, ah):
        self._p = self._construire(aw)
        self.width, self.height = self._p.wrap(aw, ah)
        return self.width, self.height

    def split(self, aw, ah):
        return self._construire(aw).split(aw, ah)

    def draw(self):
        self._p.drawOn(self.canv, 0, 0)


class LignesPointillees(Flowable):
    """Lignes pointillees ou l'eleve ecrit sa reponse."""

    def __init__(self, nb: int = 2, interligne: float = 0.85 * cm):
        super().__init__()
        self.nb, self.interligne = max(1, nb), interligne

    def wrap(self, aw, ah):
        self.width, self.height = aw, self.nb * self.interligne
        return self.width, self.height

    def draw(self):
        c = self.canv
        c.saveState()
        c.setStrokeColor(colors.HexColor("#444444"))
        c.setLineWidth(0.7)
        c.setDash(1, 2.4)
        for i in range(self.nb):
            y = self.height - (i + 1) * self.interligne + 0.12 * cm
            c.line(0, y, self.width, y)
        c.restoreState()



LBL = {
    "ar": {
        "pays": "الجمهورية التونسية", "ministere": "وزارة التربية",
        "ecole": "المدرسة الابتدائية", "enseignant": "المعلم(ة)", "annee": "السنة الدراسية",
        "nom": "الاسم واللقب", "classe": "القسم", "note": "العدد", "duree": "المدة",
        "en_matiere": "في مادة", "numero": "عدد", "type_defaut": "فرض مراقبة",
        "consigne": "التعليمة", "critere": "مع", "pts": "ن",
        "vrai": "صواب", "faux": "خطأ",
        "reponse": "الإجابة", "explication": "توضيح",
        "non_renseignee": "(لم يتم إدخال الإجابة)", "aucune": "لا توجد أسئلة",
        "grille": "جدول إسناد الأعداد", "criteres": "المعايير",
        "note_finale": "العدد النهائي", "signature": "إمضاء الولي",
        "page": "صفحة", "corrige": "إصلاح",
        "reserve": "وثيقة خاصة بالمعلم(ة) — لا توزع على التلاميذ",
        "image_absente": "صورة غير متوفرة",
    },
    "fr": {
        "pays": "République Tunisienne", "ministere": "Ministère de l'Éducation",
        "ecole": "École primaire", "enseignant": "Enseignant(e)", "annee": "Année scolaire",
        "nom": "Nom et prénom", "classe": "Classe", "note": "Note", "duree": "Durée",
        "en_matiere": "", "numero": "n°", "type_defaut": "Devoir de contrôle",
        "consigne": "Consigne", "critere": "C", "pts": "pts",
        "vrai": "Vrai", "faux": "Faux",
        "reponse": "Réponse", "explication": "Explication",
        "non_renseignee": "(réponse non renseignée)", "aucune": "Aucune question",
        "grille": "Grille d'évaluation", "criteres": "Critères",
        "note_finale": "Note finale", "signature": "Signature du parent",
        "page": "Page", "corrige": "Corrigé",
        "reserve": "Document réservé à l'enseignant(e) — ne pas distribuer aux élèves",
        "image_absente": "Image non disponible",
    },
}

LETTRES = {"ar": ["أ", "ب", "ج", "د", "هـ", "و", "ز", "ح", "ط", "ي"],
           "fr": list("abcdefghij")}

TITRE_MATIERE_FR = {
    "mathematique": "Mathématiques", "arabe": "Arabe", "science": "Éveil scientifique",
    "francais": "Français", "histoire_geo": "Histoire-Géographie", "dictee": "Dictée",
}
TITRE_MATIERE_AR = {
    "mathematique": "الرياضيات", "arabe": "اللغة العربية", "science": "الإيقاظ العلمي",
    "francais": "الفرنسية", "histoire_geo": "التاريخ والجغرافيا",
}
NIVEAU_AR = {"1": "السنة الأولى", "2": "السنة الثانية", "3": "السنة الثالثة",
             "4": "السنة الرابعة", "5": "السنة الخامسة", "6": "السنة السادسة"}


def _langue_contenu(matiere_key: str) -> str:
    return "fr" if matiere_key in ("francais", "dictee") else "ar"


def _annee_scolaire() -> str:
    aujourdhui = date.today()
    debut = aujourdhui.year if aujourdhui.month >= 9 else aujourdhui.year - 1
    return f"{debut}/{debut + 1}"


def _duree(duree: str, lang: str) -> str:
    d = (duree or "").strip()
    if lang != "ar":
        return d
    m = re.match(r'^(\d+)\s*min(?:ute)?s?$', d, re.IGNORECASE)
    if m:
        return f"{m.group(1)} دق"
    m = re.match(r'^(\d+)\s*h(?:eure)?s?\s*(\d+)?$', d, re.IGNORECASE)
    if m:
        return f"{m.group(1)} س" + (f" و{m.group(2)} دق" if m.group(2) else "")
    return d


def _fmt_points(p) -> str:
    try:
        p = float(p)
    except (TypeError, ValueError):
        return str(p)
    return str(int(p)) if p == int(p) else f"{p:.2f}".rstrip("0").rstrip(".").replace(".", ",")


def _grouper_par_exercice(questions: List[Dict]) -> List[Dict]:
    groupes: List[Dict] = []
    for q in questions or []:
        if q.get("titre_exercice") or not groupes:
            titre = q.get("titre_exercice")
            groupes.append({"numero": len(groupes) + 1, "questions": [],
                            "titre": titre if isinstance(titre, str) else ""})
        groupes[-1]["questions"].append(q)
    for g in groupes:
        g["total_points"] = sum(q.get("points", 0) or 0 for q in g["questions"])
    return groupes



_MARGE = 1.2 * cm
_LARGEUR_UTILE = A4[0] - 2 * _MARGE
_LARG_CRITERE = 1.9 * cm
_PAD = 0.28 * cm
_LARG_CONTENU = _LARGEUR_UTILE - _LARG_CRITERE - 2 * _PAD

NOIR = colors.black
GRIS = colors.HexColor("#555555")
GRIS_FOND = colors.HexColor("#EDEDED")
VERT = colors.HexColor("#0B6B3A")


def _styles() -> Dict[str, ParagraphStyle]:
    _ensure_arabic_font()
    P, PB = _POLICE_ARABE, f"{_POLICE_ARABE}-Bold"

    def s(nom, police, taille, align, **kw):
        return ParagraphStyle(nom, fontName=police, fontSize=taille,
                              leading=kw.pop("leading", taille * 1.45), alignment=align, **kw)

    st = {}
    for lang, (reg, bold, ital, k, al) in {
        "ar": (P, PB, P, 1.0, TA_RIGHT),
        "fr": ("Times-Roman", "Times-Bold", "Times-Italic", 0.86, TA_LEFT),
    }.items():
        st[lang] = {
            "entete": s(f"entete_{lang}", reg, 12 * k, al, leading=18 * k),
            "entete_gras": s(f"entete_g_{lang}", bold, 12 * k, al, leading=18 * k),
            "titre": s(f"titre_{lang}", bold, 17 * k, TA_CENTER, leading=24 * k),
            "titre_sous": s(f"titre_sous_{lang}", bold, 13.5 * k, TA_CENTER, leading=19 * k),
            "titre_petit": s(f"titre_petit_{lang}", reg, 12 * k, TA_CENTER, leading=17 * k),
            "consigne": s(f"consigne_{lang}", bold, 14.5 * k, al, leading=21 * k, spaceAfter=2),
            "support": s(f"support_{lang}", reg, 14 * k, al, leading=22 * k, spaceAfter=3),
            "question": s(f"question_{lang}", bold, 14 * k, al, leading=21 * k, spaceAfter=2),
            "option": s(f"option_{lang}", reg, 14 * k, al, leading=22 * k, spaceAfter=1),
            "reponse": s(f"reponse_{lang}", bold, 13.5 * k, al, leading=20 * k,
                         textColor=VERT, spaceAfter=2),
            "explication": s(f"explication_{lang}", ital, 11.5 * k, al, leading=16 * k,
                             textColor=GRIS, spaceAfter=2),
            "centre": s(f"centre_{lang}", reg, 12.5 * k, TA_CENTER, leading=17 * k),
            "centre_gras": s(f"centre_g_{lang}", bold, 13 * k, TA_CENTER, leading=18 * k),
            "critere": s(f"critere_{lang}", bold, 13 * k, TA_CENTER, leading=17 * k),
        }
    return st


def _t(texte: str, style: ParagraphStyle, souligne: bool = False):
    """Paragraphe arabe (ParaAr) ou latin, selon le texte et la police du style."""
    texte = "" if texte is None else str(texte)
    if _contient_arabe(texte) or style.fontName.startswith(_POLICE_ARABE):
        return ParaAr(texte, style, souligne=souligne)
    contenu = escape(texte).replace("  ", "&nbsp; ") or "&nbsp;"
    return Paragraph(f"<u>{contenu}</u>" if souligne else contenu, style)


def _sens(lang: str, cellules: List) -> List:
    """Ordre des colonnes : de droite a gauche pour l'arabe."""
    return list(reversed(cellules)) if lang == "ar" else list(cellules)


def _sans_marges(*extra) -> TableStyle:
    return TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        *extra,
    ])


def _centrer(flowable, largeur: float = _LARG_CONTENU) -> Table:
    t = Table([[flowable]], colWidths=[largeur])
    t.setStyle(_sans_marges(("ALIGN", (0, 0), (-1, -1), "CENTER")))
    return t



def _cartouche(st: Dict, lang: str, *, ctx: Dict, nom_etablissement: str, nom_professeur: str,
               annee_scolaire: str, titre_devoir: str, correction: bool) -> List:
    L, S = LBL[lang], st[lang]
    pts = "...." if lang == "ar" else "......"

    case_ecole = [
        _t(L["pays"], S["entete_gras"]),
        _t(L["ministere"], S["entete_gras"]),
        _t(f"{L['ecole']} : {nom_etablissement or '.' * 22}", S["entete"]),
        _t(f"{L['enseignant']} : {nom_professeur or '.' * 22}", S["entete"]),
        _t(f"{L['annee']} : {annee_scolaire}", S["entete"]),
    ]

    matiere = ctx["matiere_ar"] if lang == "ar" else ctx["matiere_fr"]
    ligne_matiere = f"{L['en_matiere']} {matiere}".strip()
    case_titre = ([_t(L["corrige"], S["titre_sous"])] if correction else []) + [
        _t(titre_devoir, S["titre"]),
        _t(ligne_matiere, S["titre_sous"]),
        _t(ctx["niveau_ar"] if lang == "ar" else ctx["niveau_fr"], S["titre_petit"]),
        _t(f"{L['duree']} : {_duree(ctx['duree'], lang)}", S["titre_petit"]),
    ]

    if correction:
        case_eleve = [_t(L["reserve"], S["centre"])]
    else:
        score = Table([[_t(f"{L['note']} : {pts} / {_fmt_points(ctx['bareme_total'])}",
                           S["centre_gras"])]], colWidths=[4.2 * cm], rowHeights=[1.1 * cm])
        score.setStyle(TableStyle([
            ("BOX", (0, 0), (-1, -1), 1.1, NOIR),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ]))
        case_eleve = [
            _t(f"{L['nom']} : ", S["entete_gras"]),
            _t("." * 38, S["entete"]),
            _t(f"{L['classe']} : {'.' * 26}", S["entete"]),
            Spacer(1, 0.15 * cm),
            score,
        ]

    larg = [_LARGEUR_UTILE * 0.34, _LARGEUR_UTILE * 0.32, _LARGEUR_UTILE * 0.34]
    t = Table([_sens(lang, [case_ecole, case_titre, case_eleve])], colWidths=larg)
    t.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 1.3, NOIR),
        ("INNERGRID", (0, 0), (-1, -1), 0.8, NOIR),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6), ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    return [t, Spacer(1, 0.35 * cm)]



_DOSSIER_BACKEND = Path(__file__).resolve().parent
_IMAGE_LARGEUR_MAX = 9 * cm
_IMAGE_HAUTEUR_MAX = 6.5 * cm
_IMAGE_PIXELS_MAX = 1400
_IMAGE_TELECHARGEMENT_MAX = 10 * 1024 * 1024
_IMAGE_TIMEOUT_S = 8


def _reference_image(q: Dict) -> Optional[str]:
    for cle in ("image", "image_url", "imageUrl"):
        val = q.get(cle)
        if isinstance(val, dict):
            val = val.get("url") or val.get("src") or val.get("data")
        if isinstance(val, str) and val.strip():
            return val.strip()
    return None


def _octets_image(ref: str) -> bytes:
    if ref.startswith("data:"):
        entete, _, donnees = ref.partition(",")
        if ";base64" in entete:
            return base64.b64decode(donnees)
        from urllib.parse import unquote_to_bytes
        return unquote_to_bytes(donnees)

    if ref.startswith(("http://", "https://")):
        req = urllib.request.Request(ref, headers={"User-Agent": "ExamAI-PDF/1.0"})
        with urllib.request.urlopen(req, timeout=_IMAGE_TIMEOUT_S) as rep_http:
            donnees = rep_http.read(_IMAGE_TELECHARGEMENT_MAX + 1)
        if len(donnees) > _IMAGE_TELECHARGEMENT_MAX:
            raise ValueError("image trop volumineuse")
        return donnees

    brut = ref.split("?", 1)[0]
    candidats = [Path(brut)] if Path(brut).is_absolute() else []
    relatif = brut.lstrip("/\\")
    candidats += [_DOSSIER_BACKEND / relatif, _DOSSIER_BACKEND / "static" / relatif]
    for chemin in candidats:
        try:
            chemin = chemin.resolve()
            if chemin.is_file():
                return chemin.read_bytes()
        except OSError:
            continue
    raise FileNotFoundError(f"image introuvable : {ref[:120]}")


def _normaliser_image(donnees: bytes):
    from PIL import Image as PILImage

    if donnees.lstrip()[:5] in (b"<svg ", b"<?xml") or b"<svg" in donnees[:300]:
        from svglib.svglib import svg2rlg
        from reportlab.graphics import renderPM
        donnees = renderPM.drawToString(svg2rlg(BytesIO(donnees)), fmt="PNG", dpi=150)

    img = PILImage.open(BytesIO(donnees))
    img.load()
    if getattr(img, "is_animated", False):
        img.seek(0)
    if img.mode in ("RGBA", "LA", "P"):
        img = img.convert("RGBA")
        fond = PILImage.new("RGB", img.size, (255, 255, 255))
        fond.paste(img, mask=img.split()[-1])
        img = fond
    elif img.mode != "RGB":
        img = img.convert("RGB")
    img.thumbnail((_IMAGE_PIXELS_MAX, _IMAGE_PIXELS_MAX))

    sortie = BytesIO()
    if img.width * img.height > 900 * 900:
        img.save(sortie, format="JPEG", quality=85, optimize=True)
    else:
        img.save(sortie, format="PNG", optimize=True)
    sortie.seek(0)
    return sortie, img.width, img.height


def _flowable_image(q: Dict, st: Dict, lang: str, cache: Dict,
                    larg_max: float = _IMAGE_LARGEUR_MAX, haut_max: float = _IMAGE_HAUTEUR_MAX):
    """Image cadree (fin trait noir), reduite pour tenir dans larg_max x haut_max."""
    ref = _reference_image(q)
    if not ref:
        return None
    if ref not in cache:
        try:
            cache[ref] = _normaliser_image(_octets_image(ref))
        except Exception as e:
            log.warning("[pdf_export] image de la question %s non rendue : %s", q.get("id"), e)
            cache[ref] = None
    if cache[ref] is None:
        t = Table([[_t(LBL[lang]["image_absente"], st[lang]["explication"])]],
                  colWidths=[larg_max], rowHeights=[2 * cm])
        t.setStyle(TableStyle([
            ("BOX", (0, 0), (-1, -1), 0.6, GRIS), ("BACKGROUND", (0, 0), (-1, -1), GRIS_FOND),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]))
        return t
    flux, larg_px, haut_px = cache[ref]
    echelle = min(larg_max / larg_px, haut_max / haut_px)
    img = RLImage(BytesIO(flux.getvalue()), width=larg_px * echelle, height=haut_px * echelle)
    cadre = Table([[img]])
    cadre.setStyle(_sans_marges(("BOX", (0, 0), (-1, -1), 0.7, GRIS)))
    return cadre


class CaseACocher(Flowable):
    """Vraie case carree a cocher. Dans le corrige, la bonne case est cochee d'une croix."""

    def __init__(self, cote: float = 0.46 * cm, cochee: bool = False):
        super().__init__()
        self.cote, self.cochee = cote, cochee
        self.width = self.height = cote

    def wrap(self, aw, ah):
        return self.cote, self.cote

    def draw(self):
        c, s = self.canv, self.cote
        c.saveState()
        c.setStrokeColor(NOIR)
        c.setLineWidth(1)
        c.rect(0, 0, s, s)
        if self.cochee:
            c.setStrokeColor(VERT)
            c.setLineWidth(1.8)
            m = s * 0.2
            c.line(m, m, s - m, s - m)
            c.line(m, s - m, s - m, m)
        c.restoreState()



def _tableau_donnees(headers: List[str], rows: List[List[str]], st: Dict, lang: str) -> Table:
    S = st[lang]
    data = [_sens(lang, [_t(h, S["centre_gras"]) for h in headers])]
    for row in rows:
        data.append(_sens(lang, [_t(c, S["centre"]) for c in row]))
    n = max(len(headers), 1)
    t = Table(data, colWidths=[_LARG_CONTENU / n] * n)
    t.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.8, NOIR),
        ("BACKGROUND", (0, 0), (-1, 0), GRIS_FOND),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    return t


_LARG_CASE = 0.75 * cm
_LARG_COL_IMAGE = 6.4 * cm
_IMAGE_COTE_LARG = 6.0 * cm     # image placee a cote du texte
_IMAGE_COTE_HAUT = 4.6 * cm


def _choix(textes: List, st: Dict, lang: str, largeur: float, idx_correct=None,
           correction: bool = False) -> Table:
    """Choix avec vraies cases a cocher, en grille (1 a 4 colonnes selon la longueur)."""
    S = st[lang]
    n = len(textes)
    longueur = max((len(str(t)) for t in textes), default=0)
    if longueur <= 10:
        nb_col = min(n, 4)
    elif longueur <= 22:
        nb_col = min(n, 2)
    else:
        nb_col = 1
    nb_col = max(1, min(nb_col, int(largeur // (3.6 * cm))))
    larg_cell = largeur / nb_col

    cellules = []
    for j, texte in enumerate(textes):
        bon = correction and idx_correct is not None and j == idx_correct
        case = CaseACocher(cochee=bon)
        para = _t(str(texte), S["reponse"] if bon else S["option"])
        option = Table([_sens(lang, [case, para])],
                       colWidths=_sens(lang, [_LARG_CASE, larg_cell - _LARG_CASE]))
        option.setStyle(_sans_marges(
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN", (0 if lang != "ar" else 1, 0), (0 if lang != "ar" else 1, 0), "CENTER"),
            ("TOPPADDING", (0, 0), (-1, -1), 1), ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
        ))
        cellules.append(option)

    lignes = []
    for k in range(0, n, nb_col):
        ligne = cellules[k:k + nb_col]
        ligne += [""] * (nb_col - len(ligne))
        lignes.append(_sens(lang, ligne))
    grille = Table(lignes or [[""]], colWidths=[larg_cell] * nb_col)
    grille.setStyle(_sans_marges(
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 2), ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ))
    return grille


def _bloc_question(i: int, nb: int, q: Dict, st: Dict, lang: str, correction: bool, cache: Dict) -> List:
    L, S = LBL[lang], st[lang]
    qtype = q.get("type", "ouverte")
    haut: List = []        # texte de la question (+ choix) -- a cote de l'image s'il y en a une

    if q.get("support"):
        haut.append(_t(q["support"], S["support"]))

    prefixe = f"{LETTRES[lang][i]}) " if nb > 1 and i < len(LETTRES[lang]) else ""
    haut.append(_t(f"{prefixe}{q.get('question', '')}", S["question"]))

    image = _flowable_image(q, st, lang, cache, _IMAGE_COTE_LARG, _IMAGE_COTE_HAUT)
    larg_texte = _LARG_CONTENU - _LARG_COL_IMAGE if image is not None else _LARG_CONTENU

    def reponse_texte(valeur):
        valeur = "" if valeur is None else str(valeur).strip()
        return _t(f"{L['reponse']} : {valeur or L['non_renseignee']}", S["reponse"])

    if qtype == "qcm":
        haut += [Spacer(1, 0.1 * cm),
                 _choix(q.get("options") or [], st, lang, larg_texte,
                        q.get("reponseCorrecteIndex"), correction)]
    elif qtype == "vrai_faux":
        bonne = (0 if q.get("reponseCorrecte") else 1) if correction else None
        haut += [Spacer(1, 0.1 * cm),
                 _choix([L["vrai"], L["faux"]], st, lang, min(larg_texte, 8 * cm), bonne, correction)]

    contenu: List = []
    if image is not None:
        cote = Table([_sens(lang, [haut, image])], colWidths=_sens(lang, [larg_texte, _LARG_COL_IMAGE]))
        col_img = 0 if lang == "ar" else 1
        cote.setStyle(_sans_marges(
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("ALIGN", (col_img, 0), (col_img, 0), "CENTER"),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ))
        contenu.append(cote)
    else:
        contenu += haut

    if q.get("tableau"):
        contenu += [Spacer(1, 0.1 * cm),
                    _tableau_donnees(q["tableau"].get("headers", []), q["tableau"].get("rows", []), st, lang),
                    Spacer(1, 0.15 * cm)]
        if not correction and qtype not in ("qcm", "vrai_faux"):
            return contenu  # l'eleve repond directement dans le tableau

    if qtype in ("qcm", "vrai_faux"):
        pass  # les cases a cocher sont deja placees

    elif qtype == "calcul":
        if correction:
            rep = q.get("reponseAttendue")
            unite = (q.get("unite") or "").strip()
            contenu.append(reponse_texte(f"{rep} {unite}".strip() if rep not in (None, "") else ""))
        else:
            contenu.append(LignesPointillees(2))

    elif qtype in ("ouverte", "texte_trous"):
        if correction:
            contenu.append(reponse_texte(q.get("reponseAttendue")))
        else:
            contenu.append(LignesPointillees(1 if qtype == "texte_trous" else 3))

    else:
        if correction:
            rep = q.get("texte_dictee") or q.get("reponseAttendue")
            if rep in (None, ""):
                brut = q.get("reponseCorrecte")
                rep = ", ".join(map(str, brut)) if isinstance(brut, list) else brut
            contenu.append(reponse_texte(rep))
        else:
            contenu.append(LignesPointillees(2))

    if correction:
        explication = (q.get("explication") or "").strip()
        if explication:
            contenu.append(_t(f"{L['explication']} : {explication}", S["explication"]))

    return contenu


def _case_critere(numero: int, points, st: Dict, lang: str, correction: bool) -> List:
    L, S = LBL[lang], st[lang]
    case = Table([[""]], colWidths=[1.3 * cm], rowHeights=[0.9 * cm])
    case.setStyle(TableStyle([("BOX", (0, 0), (-1, -1), 0.9, NOIR)]))
    elements = [_t(f"{L['critere']}{numero}", S["critere"]), Spacer(1, 0.1 * cm), case]
    if correction:
        elements += [Spacer(1, 0.1 * cm), _t(f"{_fmt_points(points)} {L['pts']}", S["centre"])]
    return elements


def _consigne(ex: Dict, st: Dict, lang: str, correction: bool, cache: Dict) -> Table:
    L, S = LBL[lang], st[lang]
    questions = ex.get("questions") or []

    titre = f"{L['consigne']} {ex['numero']} :"
    entete = [_t(titre, S["consigne"], souligne=True)]
    titre_ex = (ex.get("titre") or "").strip()
    if titre_ex and not re.fullmatch(r"(التمرين|تمرين|exercice|consigne)\s*\d*\s*:?", titre_ex, re.IGNORECASE):
        entete.append(_t(titre_ex, S["question"]))

    critere = _case_critere(ex["numero"], ex["total_points"], st, lang, correction)
    blocs = [_bloc_question(i, len(questions), q, st, lang, correction, cache)
             for i, q in enumerate(questions)] or [[_t(L["aucune"], S["explication"])]]
    lignes = [_sens(lang, [entete + blocs[0], critere])]
    for bloc in blocs[1:]:
        lignes.append(_sens(lang, [bloc, ""]))

    col_crit = 0 if lang == "ar" else 1
    larg = _sens(lang, [_LARGEUR_UTILE - _LARG_CRITERE, _LARG_CRITERE])
    t = Table(lignes, colWidths=larg)
    t.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 1.1, NOIR),
        ("LINEBEFORE" if col_crit == 1 else "LINEAFTER", (col_crit, 0), (col_crit, -1), 0.9, NOIR),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (col_crit, 0), (col_crit, -1), "CENTER"),
        ("LEFTPADDING", (0, 0), (-1, -1), _PAD), ("RIGHTPADDING", (0, 0), (-1, -1), _PAD),
        ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, 0), 6),
    ]))
    return t


def _section_consignes(exercices: List[Dict], st: Dict, lang: str, correction: bool) -> List:
    if not exercices:
        return [_t(LBL[lang]["aucune"], st[lang]["explication"])]
    story: List = []
    cache: Dict = {}
    hauteur_page = A4[1] - 2.4 * cm
    for ex in exercices:
        bloc = _consigne(ex, st, lang, correction, cache)
        _, h = bloc.wrap(_LARGEUR_UTILE, hauteur_page)
        story.append(KeepTogether(bloc) if h <= hauteur_page * 0.8 else bloc)
        story.append(Spacer(1, 0.3 * cm))
    return story



def _arrondi_demi(x: float) -> float:
    return round(x * 2) / 2


def _grille_evaluation(exercices: List[Dict], bareme_total, st: Dict, lang: str) -> List:
    if not exercices:
        return []
    L, S = LBL[lang], st[lang]
    entetes = [L["criteres"]] + [f"{L['critere']}{ex['numero']}" for ex in exercices]
    niveaux = [("+++", 1.0), ("++-", 2 / 3), ("+--", 1 / 3), ("---", 0.0)]

    data = [_sens(lang, [_t(h, S["centre_gras"]) for h in entetes])]
    for symbole, part in niveaux:
        ligne = [Paragraph(symbole, ParagraphStyle("sym", fontName="Courier-Bold", fontSize=11,
                                                   alignment=TA_CENTER, leading=14))]
        for ex in exercices:
            ligne.append(_t(_fmt_points(_arrondi_demi(ex["total_points"] * part)), S["centre"]))
        data.append(_sens(lang, ligne))

    n = len(exercices)
    larg_label = 2.6 * cm
    larg_crit = min(2.2 * cm, (_LARGEUR_UTILE - larg_label) / n)
    t = Table(data, colWidths=_sens(lang, [larg_label] + [larg_crit] * n))
    col_label = n if lang == "ar" else 0
    t.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.8, NOIR),
        ("BACKGROUND", (0, 0), (-1, 0), GRIS_FOND),
        ("BACKGROUND", (col_label, 0), (col_label, -1), GRIS_FOND),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("TOPPADDING", (0, 0), (-1, -1), 2), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    t.hAlign = "RIGHT" if lang == "ar" else "LEFT"

    note = Table([[_t(f"{L['note_finale']} : ...... / {_fmt_points(bareme_total)}", S["centre_gras"])]],
                 colWidths=[5.5 * cm], rowHeights=[1.1 * cm])
    note.setStyle(TableStyle([("BOX", (0, 0), (-1, -1), 1.1, NOIR),
                              ("VALIGN", (0, 0), (-1, -1), "MIDDLE")]))
    signature = Table([[_t(f"{L['signature']} :", S["entete_gras"])], [""]],
                      colWidths=[5.5 * cm], rowHeights=[0.8 * cm, 1.3 * cm])
    signature.setStyle(TableStyle([("BOX", (0, 0), (-1, -1), 1.1, NOIR),
                                   ("VALIGN", (0, 0), (-1, -1), "MIDDLE")]))
    bas = Table([_sens(lang, [note, "", signature])],
                colWidths=_sens(lang, [6 * cm, _LARGEUR_UTILE - 12 * cm, 6 * cm]))
    bas.setStyle(_sans_marges(("VALIGN", (0, 0), (-1, -1), "TOP")))

    return [KeepTogether([
        Spacer(1, 0.2 * cm),
        _t(L["grille"], S["consigne"], souligne=True),
        Spacer(1, 0.12 * cm),
        t,
        Spacer(1, 0.4 * cm),
        bas,
    ])]



def _decor_page_factory(pagination: bool, lang: str):
    def _decor(canvas, doc_):
        canvas.saveState()
        canvas.setStrokeColor(NOIR)
        canvas.setLineWidth(1.4)
        m = 0.75 * cm
        canvas.rect(m, m, A4[0] - 2 * m, A4[1] - 2 * m)
        if pagination:
            canvas.setFillColor(GRIS)
            if lang == "ar":
                canvas.setFont(_POLICE_ARABE, 10)
                canvas.drawCentredString(A4[0] / 2, 0.35 * cm, _ar(f"{LBL['ar']['page']} {doc_.page}"))
            else:
                canvas.setFont("Times-Roman", 9)
                canvas.drawCentredString(A4[0] / 2, 0.35 * cm, f"{LBL['fr']['page']} {doc_.page}")
        canvas.restoreState()
    return _decor



def _preparer_rendu(examen: Dict, langue: str = "fr") -> Dict:
    matiere_key = examen.get("matiere", "")
    niveau = str(examen.get("niveau", "") or "")
    questions = examen.get("questions") or []
    exercices = _grouper_par_exercice(questions)
    return {
        "matiere_ar": TITRE_MATIERE_AR.get(matiere_key, matiere_key),
        "matiere_fr": TITRE_MATIERE_FR.get(matiere_key, matiere_key),
        "niveau_ar": NIVEAU_AR.get(niveau, f"السنة {niveau}" if niveau else ""),
        "niveau_fr": ("1re année" if niveau == "1" else f"{niveau}e année") if niveau else "",
        "chapitre": examen.get("chapitre", ""),
        "duree": examen.get("duree", "60 min"),
        "contenu_langue": _langue_contenu(matiere_key),
        "exercices": exercices,
        "bareme_total": sum(q.get("points", 0) or 0 for q in questions),
    }


def _titre_devoir(examen: Dict, lang: str, type_examen: str, numero_examen) -> str:
    L = LBL[lang]
    type_ex = (type_examen or examen.get("type_examen") or "").strip() or L["type_defaut"]
    numero = numero_examen if numero_examen not in (None, "") else examen.get("numero_examen", 1)
    return f"{type_ex} {L['numero']} {numero}".strip() if numero not in (None, "", 0) else type_ex


def _generer(examen: Dict, *, correction: bool, langue: str, en_tete: bool, pagination: bool,
             nom_etablissement: str, nom_professeur: str, annee_scolaire: str,
             type_examen: str, numero_examen) -> bytes:
    ctx = _preparer_rendu(examen, langue)
    lang = ctx["contenu_langue"]
    st = _styles()

    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=_MARGE, rightMargin=_MARGE,
                            topMargin=1.15 * cm, bottomMargin=1.2 * cm,
                            title=f"{ctx['matiere_fr']} - {ctx['niveau_fr']}")

    titre = _titre_devoir(examen, lang, type_examen, numero_examen)
    if correction and not en_tete:
        titre = f"{LBL[lang]['corrige']} : {titre}"

    story: List = []
    if en_tete:
        story += _cartouche(st, lang, ctx=ctx, nom_etablissement=nom_etablissement,
                            nom_professeur=nom_professeur,
                            annee_scolaire=annee_scolaire or _annee_scolaire(),
                            titre_devoir=titre, correction=correction)
    else:
        story += [_t(titre, st[lang]["titre"]), Spacer(1, 0.3 * cm)]

    story += _section_consignes(ctx["exercices"], st, lang, correction)
    story += _grille_evaluation(ctx["exercices"], ctx["bareme_total"], st, lang)

    decor = _decor_page_factory(pagination, lang)
    doc.build(story, onFirstPage=decor, onLaterPages=decor)
    return buffer.getvalue()


def generer_pdf_examen(examen: Dict, langue: str = "fr", en_tete: bool = True, pagination: bool = True,
                       nom_etablissement: str = "", nom_professeur: str = "", annee_scolaire: str = "",
                       type_examen: str = "", numero_examen=None, **_ignores) -> bytes:
    """type_examen : ex. "فرض مراقبة", "فرض تأليفي", "Devoir de synthèse"."""
    return _generer(examen, correction=False, langue=langue, en_tete=en_tete, pagination=pagination,
                    nom_etablissement=nom_etablissement, nom_professeur=nom_professeur,
                    annee_scolaire=annee_scolaire, type_examen=type_examen, numero_examen=numero_examen)


def generer_pdf_correction(examen: Dict, langue: str = "fr", en_tete: bool = True, pagination: bool = True,
                           nom_etablissement: str = "", nom_professeur: str = "", annee_scolaire: str = "",
                           type_examen: str = "", numero_examen=None, **_ignores) -> bytes:
    return _generer(examen, correction=True, langue=langue, en_tete=en_tete, pagination=pagination,
                    nom_etablissement=nom_etablissement, nom_professeur=nom_professeur,
                    annee_scolaire=annee_scolaire, type_examen=type_examen, numero_examen=numero_examen)