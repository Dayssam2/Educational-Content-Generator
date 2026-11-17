import asyncio
import base64
import json
import os
import re
import sys
import tempfile
import unicodedata
from pathlib import Path
from typing import Dict, List, Optional

from dotenv import load_dotenv

_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_ROOT))
load_dotenv(_ROOT / ".env")


class ModuleVocalIndisponible(RuntimeError):
    pass


_ARABE = re.compile("[\u0600-\u06FF]")
_DIACRITIQUES_AR = re.compile("[\u064B-\u065F\u0670\u0640]")

SEUIL_CONFIANCE_IA = 0.6


def detecter_langue(texte: str) -> str:
    lettres = [c for c in texte if c.isalpha()]
    if not lettres:
        return "fr"
    nb_ar = sum(1 for c in lettres if _ARABE.match(c))
    return "ar" if nb_ar / len(lettres) > 0.3 else "fr"


def normaliser(texte: str) -> str:
    t = (texte or "").lower().strip()
    t = _DIACRITIQUES_AR.sub("", t)
    t = re.sub("[إأآا]", "ا", t).replace("ى", "ي").replace("ة", "ه")
    t = "".join(c for c in unicodedata.normalize("NFD", t) if unicodedata.category(c) != "Mn")
    t = re.sub(r"[’'`]", " ", t)
    t = re.sub(r"\s+", " ", t)
    return t


MATIERES: Dict[str, List[str]] = {
    "mathematique": ["math", "maths", "mathematique", "mathematiques", "calcul",
                     "رياضيات", "الرياضيات", "حساب"],
    "arabe": ["arabe", "langue arabe", "عربيه", "العربيه", "لغه عربيه"],
    "science": ["science", "sciences", "eveil scientifique", "علوم", "العلوم",
                "ايقاظ علمي"],
    "francais": ["francais", "langue francaise", "فرنسيه", "الفرنسيه"],
    "histoire_geo": ["histoire", "geographie", "geo", "histoire-geo",
                     "تاريخ", "التاريخ", "جغرافيا", "الجغرافيا"],
}

LIBELLES_MATIERES = {
    "mathematique": "Mathématiques", "arabe": "Arabe", "science": "Sciences",
    "francais": "Français", "histoire_geo": "Histoire-Géo",
}

TYPES_QUESTIONS: Dict[str, List[str]] = {
    "qcm": ["qcm", "choix multiple", "choix multiples", "اختيار من متعدد"],
    "texte_a_trous": ["texte a trous", "trous", "a completer", "فراغات", "املا الفراغ"],
    "question_ouverte": ["question ouverte", "questions ouvertes", "redaction", "سؤال مفتوح", "اسئله مفتوحه"],
    "legende_image": ["legende", "image", "schema", "صوره", "رسم"],
}

ORDINAUX = {
    "premiere": 1, "premier": 1, "deuxieme": 2, "seconde": 2, "troisieme": 3,
    "quatrieme": 4, "cinquieme": 5, "sixieme": 6,
    "الاولي": 1, "الاول": 1, "الثانيه": 2, "الثاني": 2, "الثالثه": 3, "الثالث": 3,
    "الرابعه": 4, "الرابع": 4, "الخامسه": 5, "الخامس": 5, "السادسه": 6, "السادس": 6,
}

ORDINAUX_SANS_ARTICLE = {
    "اولي": 1, "ثانيه": 2, "ثالثه": 3, "رابعه": 4, "خامسه": 5, "سادسه": 6,
}

NOMBRES = {
    "un": 1, "une": 1, "deux": 2, "trois": 3, "quatre": 4, "cinq": 5, "six": 6,
    "sept": 7, "huit": 8, "neuf": 9, "dix": 10, "onze": 11, "douze": 12,
    "quinze": 15, "vingt": 20,
    "واحد": 1, "اثنين": 2, "ثلاث": 3, "ثلاثه": 3, "اربع": 4, "اربعه": 4,
    "خمس": 5, "خمسه": 5, "ست": 6, "سته": 6, "سبع": 7, "ثمان": 8, "تسع": 9,
    "عشر": 10, "عشره": 10,
}

MOTS_EXAMEN = [
    "examen", "exam", "evaluation", "devoir", "controle", "test", "quiz", "quizz", "sujet",
    "امتحان", "امتحانا", "اختبار", "اختبارا", "فرض", "فرضا", "تقييم", "تقييما", "تقيما",
]

VERBES_CREATION = [
    "cree", "creer", "creez", "genere", "generer", "generez", "fais", "faire",
    "faites", "prepare", "preparer", "preparez", "construis", "construire",
    "redige", "rediger", "ecris", "elabore", "concois", "fabrique", "fournis",
    "je veux", "je voudrais", "j aimerais", "je souhaite", "je desire",
    "j ai besoin", "il me faut", "donne moi", "propose moi", "mets moi",
    "انشئ", "انشا", "انشاء", "اعمل", "اعملي", "حضر", "حضرلي", "جهز", "جهزلي", "جهزي",
    "اصنع", "اصنعلي", "ولد", "اكتب", "اريد", "نحب", "اعطني", "اعطيني", "هات", "صمم", "ابن",
    "تنشئ", "تحضر", "تعمل", "تصنع", "تكتب", "تولد", "احتاج", "نحتاج",
]

DEMANDES_POLIES = [
    "tu peux", "tu pourrais", "peux-tu", "peux tu", "pourrais-tu", "pourrais tu",
    "vous pouvez", "pouvez-vous", "pouvez vous", "pourriez-vous", "pourriez vous",
    "s il te plait", "s il vous plait", "stp", "svp",
    "يمكنك", "هل يمكن", "ممكن", "من فضلك", "لو سمحت", "تنجم", "تقدر",
]

MOTS_EXPLICATION = [
    "comment", "pourquoi", "explique", "expliquer", "expliquez", "conseil", "conseils", "idee", "idees",
    "كيف", "كيفاش", "لماذا", "علاش", "اشرح", "اشرحي", "نصيحه", "نصيحة",
]

MARQUEURS_QUESTION = [
    "comment", "pourquoi", "est-ce", "est ce", "quels", "quelles", "quel", "quelle",
    "peut-on", "puis-je", "qu est-ce", "explique",
    "كيف", "لماذا", "ما هي", "ما هو", "هل", "علاش", "كيفاش",
]

MOTS_PDF = ["pdf", "document", "fichier", "ce programme", "مستند", "ملف",
            "المستند", "الملف", "ملفي", "وثيقه", "الوثيقه"]

NEGATIONS = ["pas d examen", "pas d evaluation", "sans examen", "je ne veux pas", "pas besoin",
             "ne veux pas", "لا اريد", "ما نحبش", "بدون امتحان"]

VERBES_OUVRIR = ["ouvre", "ouvrir", "affiche", "afficher", "montre", "montrer",
                 "va a", "aller a", "voir", "افتح", "اعرض", "اظهر", "ورني"]

_MOTIFS_LISTE_EXAMENS = [
    re.compile(r"\bmes (?:examens|evaluations|devoirs|controles|quiz)\b"),
    re.compile(r"\b(?:liste|historique) (?:de |des |d )?(?:mes )?(?:examens|evaluations)\b"),
    re.compile(r"\bexamens? (?:deja )?(?:crees?|enregistres?|sauvegardes?|existants?)\b"),
    re.compile(r"\bexamens? que j ai\b"),
    re.compile("امتحاناتي|اختباراتي|فروضي"),
    re.compile("(?:الامتحانات|الاختبارات|امتحانات|اختبارات)\\s+(?:التي|الي)?\\s*"
               "(?:حفظتها|حفظت|انشاتها|المحفوظه|السابقه)"),
    re.compile("قا[يئ]مه\\s+(?:ال)?(?:امتحانات|اختبارات)"),
]


def _contient(texte_norm: str, mots: List[str]) -> bool:
    for m in mots:
        m = normaliser(m)
        if _ARABE.search(m):
            motif = rf"(?<![\w])[وبلفك]?(?:ال)?{re.escape(m)}(?![\w])"
        else:
            motif = rf"(?<![\w]){re.escape(m)}(?![\w])"
        if re.search(motif, texte_norm):
            return True
    return False


def _extraire_matiere(t: str) -> Optional[str]:
    for mid, syns in MATIERES.items():
        if _contient(t, syns):
            return mid
    return None


def _extraire_niveau(t: str) -> Optional[int]:
    m = re.search(r"(?<!\d)([1-6])\s*(?:eme|e|ere|er|re|°)?\s*(?:annee|an|ans|classe)\b", t)
    if m:
        return int(m.group(1))
    m = re.search(r"(?<!\d)([1-6])\s*(?:eme|ere|er|e)(?![\w])", t)
    if m:
        return int(m.group(1))
    m = re.search(r"(?:niveau|classe|annee)\s*([1-6])(?!\d)", t)
    if m:
        return int(m.group(1))
    for mot, n in ORDINAUX.items():
        if re.search(rf"(?<![\w]){re.escape(normaliser(mot))}(?![\w])", t):
            return n
    m = re.search(r"(?:السنه|سنه)\s*([1-6])", t)
    if m:
        return int(m.group(1))
    for mot, n in ORDINAUX_SANS_ARTICLE.items():
        if re.search(rf"(?:السنه|سنه)\s+{mot}(?![\w])", t):
            return n
    return None


_UNITES_QUESTIONS = "|".join(
    ["questions?", "exercices?", "items?"]
    + [re.escape(normaliser(m)) for m in ("أسئلة", "سؤال", "تمارين", "تمرين")]
)


def _extraire_nb_questions(t: str) -> Optional[int]:
    m = re.search(rf"(\d{{1,2}})\s*(?:{_UNITES_QUESTIONS})", t)
    if m:
        n = int(m.group(1))
        return n if 1 <= n <= 50 else None
    for mot, n in NOMBRES.items():
        if re.search(rf"(?<![\w])[وبلفك]?{re.escape(normaliser(mot))}\s+(?:{_UNITES_QUESTIONS})", t):
            return n
    return None


def _extraire_types(t: str) -> List[str]:
    return [tid for tid, syns in TYPES_QUESTIONS.items() if _contient(t, syns)]


def _commence_par(t: str, mots: List[str]) -> bool:
    return any(t.startswith(normaliser(m)) for m in mots)


def _est_une_question(texte_brut: str, t: str) -> bool:
    if texte_brut.strip().endswith(("?", "؟")):
        return True
    return _commence_par(t, MARQUEURS_QUESTION)


def _demande_liste_examens(t: str) -> bool:
    return any(p.search(t) for p in _MOTIFS_LISTE_EXAMENS)


def _resultat(intention: str, parametres: Optional[Dict] = None,
              confiance: float = 0.5, source: str = "regles", langue: str = "fr") -> Dict:
    return {
        "intention": intention,
        "parametres": {k: v for k, v in (parametres or {}).items() if v not in (None, [], "")},
        "confiance": round(confiance, 2),
        "source": source,
        "langue": langue,
    }


def _slu_regles(texte: str) -> Dict:
    t = normaliser(texte)
    langue = detecter_langue(texte)

    params = {
        "matiere": _extraire_matiere(t),
        "niveau": _extraire_niveau(t),
        "nb_questions": _extraire_nb_questions(t),
        "types": _extraire_types(t),
    }

    parle_examen = _contient(t, MOTS_EXAMEN)
    verbe_creation = _contient(t, VERBES_CREATION)
    question = _est_une_question(texte, t)
    explication = _contient(t, MOTS_EXPLICATION)
    pedagogique = _commence_par(t, MOTS_EXPLICATION) or explication
    negation = _contient(t, NEGATIONS)
    demande_polie = _contient(t, DEMANDES_POLIES) and not explication
    nb_slots = sum(1 for k in ("matiere", "niveau") if params[k])
    objet_examen = parle_examen or params["nb_questions"] is not None

    if _demande_liste_examens(t) and not _commence_par(t, MOTS_EXPLICATION):
        if _contient(t, VERBES_OUVRIR) or not verbe_creation:
            return _resultat("ouvrir_mes_examens", confiance=0.9, langue=langue)

    if objet_examen and not negation and not explication and \
            ((verbe_creation and not question) or demande_polie):
        if _contient(t, MOTS_PDF):
            return _resultat("creer_examen_pdf", confiance=0.85, langue=langue)
        return _resultat("creer_examen", params, confiance=0.7 + 0.1 * nb_slots, langue=langue)

    if parle_examen and not question and not negation and not pedagogique and \
            (nb_slots or params["nb_questions"] is not None or params["types"]):
        if _contient(t, MOTS_PDF):
            return _resultat("creer_examen_pdf", confiance=0.65, langue=langue)
        return _resultat("creer_examen", params, confiance=0.6 + 0.05 * nb_slots, langue=langue)

    if question:
        return _resultat("question", params, confiance=0.85, langue=langue)

    if parle_examen:
        return _resultat("question", params, confiance=0.4, langue=langue)
    if params["matiere"] and params["niveau"]:
        return _resultat("question", params, confiance=0.45, langue=langue)

    return _resultat("question", params, confiance=0.8, langue=langue)


_PROMPT_SLU = """Tu es le module de comprehension (SLU) d'un assistant vocal pour enseignants du primaire en Tunisie.
Analyse l'enonce et reponds UNIQUEMENT avec un objet JSON, sans texte autour, de la forme :
{{"intention": "...", "parametres": {{"matiere": ..., "niveau": ..., "nb_questions": ..., "types": [...]}}, "confiance": 0.0-1.0}}

intention parmi :
- "creer_examen" : l'enseignant DEMANDE qu'on genere un examen maintenant
- "creer_examen_pdf" : il demande un examen a partir du PDF/document joint
- "ouvrir_mes_examens" : il veut voir la liste de ses examens
- "question" : toute autre demande (question pedagogique, conseil, explication...)
matiere parmi : "mathematique", "arabe", "science", "francais", "histoire_geo" ou null
niveau : entier 1 a 6 (annee du primaire) ou null
nb_questions : entier ou null
types parmi : "qcm", "texte_a_trous", "question_ouverte", "legende_image"

Enonce : {texte}
JSON :"""


def _slu_gemini(texte: str, langue: str) -> Optional[Dict]:
    try:
        from services.gemini_service import generate_content
        brut = generate_content(_PROMPT_SLU.format(texte=texte)) or ""
        m = re.search(r"\{.*\}", brut, re.S)
        if not m:
            return None
        data = json.loads(m.group(0))
    except Exception:
        return None

    intention = data.get("intention")
    if intention not in {"creer_examen", "creer_examen_pdf", "ouvrir_mes_examens", "question"}:
        return None
    p = data.get("parametres") or {}
    matiere = p.get("matiere") if p.get("matiere") in MATIERES else None
    niveau = p.get("niveau") if isinstance(p.get("niveau"), int) and 1 <= p["niveau"] <= 6 else None
    nb = p.get("nb_questions") if isinstance(p.get("nb_questions"), int) and 1 <= p["nb_questions"] <= 50 else None
    types = [x for x in (p.get("types") or []) if x in TYPES_QUESTIONS]
    try:
        confiance = float(data.get("confiance", 0.6))
    except (TypeError, ValueError):
        confiance = 0.6
    return _resultat(intention, {"matiere": matiere, "niveau": niveau, "nb_questions": nb, "types": types},
                     confiance=max(0.0, min(confiance, 1.0)), source="ia", langue=langue)


def comprendre(texte: str, utiliser_ia: bool = True) -> Dict:
    texte = (texte or "").strip()
    if not texte:
        raise ValueError("Enonce vide")

    res = _slu_regles(texte)
    if utiliser_ia and res["confiance"] < SEUIL_CONFIANCE_IA:
        ia = _slu_gemini(texte, res["langue"])
        if ia:
            ia["parametres"] = {**res["parametres"], **ia["parametres"]}
            return ia
    return res


def resumer_parametres(parametres: Dict, langue: str = "fr") -> str:
    p = parametres or {}
    morceaux = []
    if p.get("matiere"):
        morceaux.append(LIBELLES_MATIERES.get(p["matiere"], p["matiere"]))
    if p.get("niveau"):
        morceaux.append(f"{p['niveau']}e année")
    if p.get("nb_questions"):
        morceaux.append(f"{p['nb_questions']} questions")
    return ", ".join(morceaux)


_modele_whisper = None
MAX_AUDIO_OCTETS = 10 * 1024 * 1024

PROMPTS_ASR = {
    "fr": "Examen, enseignant, primaire, QCM, mathématiques, année.",
    "ar": "امتحان، معلم، ابتدائي، رياضيات، علوم، السنة الثالثة.",
}


def _charger_whisper():
    global _modele_whisper
    if _modele_whisper is None:
        try:
            from faster_whisper import WhisperModel
        except ImportError as e:
            raise ModuleVocalIndisponible(
                "Reconnaissance vocale serveur indisponible : installez faster-whisper "
                "(pip install faster-whisper)."
            ) from e
        _modele_whisper = WhisperModel(
            os.getenv("WHISPER_MODEL", "small"),
            device=os.getenv("WHISPER_DEVICE", "cpu"),
            compute_type=os.getenv("WHISPER_COMPUTE", "int8"),
        )
    return _modele_whisper


def _decoder_audio_base64(audio_base64: str) -> bytes:
    if "," in audio_base64[:100]:
        audio_base64 = audio_base64.split(",", 1)[1]
    try:
        brut = base64.b64decode(audio_base64, validate=False)
    except Exception as e:
        raise ValueError("Audio base64 invalide") from e
    if not brut:
        raise ValueError("Audio vide")
    if len(brut) > MAX_AUDIO_OCTETS:
        raise ValueError("Enregistrement trop long (10 Mo maximum)")
    return brut


def _decoder_pcm_16k(chemin: str):
    import av
    import numpy as np

    morceaux = []
    with av.open(chemin) as conteneur:
        flux = next((s for s in conteneur.streams if s.type == "audio"), None)
        if flux is None:
            raise ValueError("Aucune piste audio dans l'enregistrement")
        reech = av.AudioResampler(format="s16", layout="mono", rate=16000)
        for trame in conteneur.decode(flux):
            for t in reech.resample(trame) or []:
                morceaux.append(t.to_ndarray().reshape(-1))
        for t in reech.resample(None) or []:
            morceaux.append(t.to_ndarray().reshape(-1))
    if not morceaux:
        raise ValueError("Enregistrement vide ou illisible")
    return np.concatenate(morceaux).astype(np.float32) / 32768.0


def transcrire(audio_base64: str, langue: Optional[str] = None) -> Dict:
    audio = _decoder_audio_base64(audio_base64)
    modele = _charger_whisper()
    code = (langue or "").split("-")[0].lower() or None
    if code not in (None, "fr", "ar"):
        code = None

    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as f:
        f.write(audio)
        chemin = f.name
    try:
        segments, info = modele.transcribe(
            _decoder_pcm_16k(chemin), language=code, vad_filter=True, beam_size=5,
            initial_prompt=PROMPTS_ASR.get(code or "fr", PROMPTS_ASR["fr"]),
        )
        texte = " ".join(s.text.strip() for s in segments).strip()
    finally:
        try:
            os.unlink(chemin)
        except OSError:
            pass
    return {"texte": texte, "langue": getattr(info, "language", code) or code}


VOIX = {
    "fr": os.getenv("TTS_VOIX_FR", "fr-FR-DeniseNeural"),
    "ar": os.getenv("TTS_VOIX_AR", "ar-TN-ReemNeural"),
}
MAX_CARACTERES_TTS = 3_000


def nettoyer_pour_lecture(texte: str) -> str:
    t = re.sub(r"```.*?```", " ", texte or "", flags=re.S)
    t = re.sub(r"`([^`]*)`", r"\1", t)
    t = re.sub(r"!\[[^\]]*\]\([^)]*\)", " ", t)
    t = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", t)
    t = re.sub(r"^\s{0,3}#{1,6}\s*", "", t, flags=re.M)
    t = re.sub(r"^\s*[-*+]\s+", "", t, flags=re.M)
    t = re.sub(r"^[ \t]*\|?[ \t:|-]*-{2,}[ \t:|-]*$", "", t, flags=re.M)
    t = re.sub(
        r"^[ \t]*\|(.*)\|[ \t]*$",
        lambda m: ", ".join(c.strip() for c in m.group(1).split("|") if c.strip()) + ".",
        t, flags=re.M,
    )
    t = re.sub(r"[*_~>]+", "", t)
    t = re.sub(r"\n+", "\n", t)
    t = re.sub(r"(?<![.!?:;,؟])\n", ". ", t)
    t = re.sub(r"\s+", " ", t)
    return t.strip()


async def _synthese_edge(texte: str, voix: str) -> bytes:
    import edge_tts
    morceaux = []
    async for chunk in edge_tts.Communicate(texte, voix).stream():
        if chunk.get("type") == "audio":
            morceaux.append(chunk["data"])
    return b"".join(morceaux)


def synthetiser(texte: str, langue: Optional[str] = None) -> bytes:
    try:
        import edge_tts
    except ImportError as e:
        raise ModuleVocalIndisponible(
            "Synthese vocale serveur indisponible : installez edge-tts (pip install edge-tts)."
        ) from e

    propre = nettoyer_pour_lecture(texte)[:MAX_CARACTERES_TTS]
    if not propre:
        raise ValueError("Texte vide")
    code = (langue or detecter_langue(propre)).split("-")[0].lower()
    voix = VOIX.get(code, VOIX["fr"])

    try:
        return asyncio.run(_synthese_edge(propre, voix))
    except RuntimeError:
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as ex:
            return ex.submit(lambda: asyncio.run(_synthese_edge(propre, voix))).result()