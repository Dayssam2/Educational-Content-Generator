#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys
import json
import os
from pathlib import Path
from datetime import datetime
from typing import List, Dict
from dotenv import load_dotenv

load_dotenv()

_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(_ROOT))

from services.gemini_service import generate_content
from rag_system import SimpleRAG
from models.models import Examen, QuestionQCM, QuestionVraiFaux, QuestionOuverte
from prompts.quiz_prompt import construire_prompt

gemini_api_key = os.getenv("GEMINI_API_KEY")
if not gemini_api_key:
    print(" ERREUR: GEMINI_API_KEY non trouvée dans .env")
    sys.exit(1)

quiz_configs = [
    ("TEST Précision 6ème Histoire-Géo - Maghreb (position/superficie) [Exact]", "التاريخ والجغرافيا", "6", "المغرب العربي: الموقع والمساحة والتّقسيم السّياسي"),
    ("TEST Précision 6ème Histoire-Géo - Maghreb (position/superficie) [Modifié]", "التاريخ والجغرافيا", "6", "المغرب العربي الموقع والمساحه والتقسيم السياسي"),
    ("TEST Précision 6ème Histoire-Géo - Maghreb (position/superficie) [Conceptuel]", "التاريخ والجغرافيا", "6", "كم عدد الدول العربية الموجودة في شمال إفريقيا"),
    ("TEST Précision 6ème Histoire-Géo - Répartition population Tunisie [Exact]", "التاريخ والجغرافيا", "6", "التّوزّع الجغرافي للسّكّان والأدفاق الهجريّة في البلاد التّونسيّة"),
    ("TEST Précision 6ème Histoire-Géo - Répartition population Tunisie [Modifié]", "التاريخ والجغرافيا", "6", "التوزع الجغرافي للسكان والادفاق الهجريه في البلاد التونسيه"),
    ("TEST Précision 6ème Histoire-Géo - Répartition population Tunisie [Conceptuel]", "التاريخ والجغرافيا", "6", "لماذا يتركّز أغلب سكّان تونس في بعض المناطق دون أخرى ولماذا يهاجرون"),
    ("TEST Précision 1ère Maths - Droite/Gauche [Exact]", "الرياضيات", "1", "الْيَمِينُ وَالْيَسَارُ"),
    ("TEST Précision 1ère Maths - Droite/Gauche [Modifié]", "الرياضيات", "1", "اليمين واليسار"),
    ("TEST Précision 1ère Maths - Droite/Gauche [Conceptuel]", "الرياضيات", "1", "كيف أميّز بين يدي التي أكتب بها ويدي الأخرى"),
    ("TEST Précision 1ère Maths - Appartenance à un ensemble [Exact]", "الرياضيات", "1", "الِانْتِمَاءُ وَعَدَمُ الِانْتِمَاءِ"),
    ("TEST Précision 1ère Maths - Appartenance à un ensemble [Modifié]", "الرياضيات", "1", "الانتماء وعدم الانتماء"),
    ("TEST Précision 1ère Maths - Appartenance à un ensemble [Conceptuel]", "الرياضيات", "1", "كيف أعرف إن كان شيء ما جزءا من مجموعة معيّنة أم لا"),
    ("TEST Précision 2ème Maths - Ligne brisée [Exact]", "الرياضيات", "2", "الْخَطُّ الْمُنْكَسِرُ: التَّعَرُّفُ وَالِٱسْتِعْمَالُ"),
    ("TEST Précision 2ème Maths - Ligne brisée [Modifié]", "الرياضيات", "2", "الخط المنكسر التعرف والاستعمال"),
    ("TEST Précision 2ème Maths - Ligne brisée [Conceptuel]", "الرياضيات", "2", "كيف يبدو الخط الذي يتغيّر اتّجاهه عدّة مرّات بدل أن يبقى مستقيما"),
    ("TEST Précision 2ème Maths - Polygones [Exact]", "الرياضيات", "2", "الْمُضَلَّعَاتُ: تَعَرُّفُ الْمُضَلَّعَاتِ"),
    ("TEST Précision 2ème Maths - Polygones [Modifié]", "الرياضيات", "2", "المضلعات تعرف المضلعات"),
    ("TEST Précision 2ème Maths - Polygones [Conceptuel]", "الرياضيات", "2", "ما اسم الأشكال الهندسية المغلقة التي تتكوّن من عدّة أضلاع مستقيمة"),
    ("TEST Précision 3ème Maths - Produit de deux nombres [Exact]", "الرياضيات", "3", "أَتَعَرَّفُ فِكْرَةَ جُذَاءِ عَدَدَيْنِ"),
    ("TEST Précision 3ème Maths - Produit de deux nombres [Modifié]", "الرياضيات", "3", "اتعرف فكره جذاء عددين"),
    ("TEST Précision 3ème Maths - Produit de deux nombres [Conceptuel]", "الرياضيات", "3", "ماذا نسمّي النتيجة عندما نكرّر جمع نفس العدد عدّة مرّات"),
    ("TEST Précision 3ème Maths - L'angle [Exact]", "الرياضيات", "3", "أَتَعَرَّفُ الزَّاوِيَةَ وَأَرْسُمُهَا"),
    ("TEST Précision 3ème Maths - L'angle [Modifié]", "الرياضيات", "3", "اتعرف الزاويه وارسمها"),
    ("TEST Précision 3ème Maths - L'angle [Conceptuel]", "الرياضيات", "3", "كيف أرسم الفتحة التي تتكوّن بين خطّين ينطلقان من نفس النقطة"),
    ("TEST Précision 4ème Maths - Division euclidienne [Exact]", "الرياضيات", "4", "أتعرّف القسمة الإقليديّة"),
    ("TEST Précision 4ème Maths - Division euclidienne [Modifié]", "الرياضيات", "4", "اتعرف القسمه الاقليديه"),
    ("TEST Précision 4ème Maths - Division euclidienne [Conceptuel]", "الرياضيات", "4", "كيف أوزّع عددا من الأشياء بالتساوي على مجموعات وأعرف الباقي"),
    ("TEST Précision 4ème Maths - Unités de longueur [Exact]", "الرياضيات", "4", "أتصرّف في وحدات قيس الأطوال (المتر ومضاعفاته)"),
    ("TEST Précision 4ème Maths - Unités de longueur [Modifié]", "الرياضيات", "4", "اتصرف في وحدات قيس الاطوال المتر ومضاعفاته"),
    ("TEST Précision 4ème Maths - Unités de longueur [Conceptuel]", "الرياضيات", "4", "كيف أحوّل طولا معبّرا عنه بالكيلومتر إلى الهكتومتر أو المتر"),
    ("TEST Précision 5ème Maths - Cercle et disque [Exact]", "الرياضيات", "5", "أتعرّف الدائرة والقرص الدائري"),
    ("TEST Précision 5ème Maths - Cercle et disque [Modifié]", "الرياضيات", "5", "اتعرف الدايره والقرص الدايري"),
    ("TEST Précision 5ème Maths - Cercle et disque [Conceptuel]", "الرياضيات", "5", "ما الفرق بين الشّكل المستدير المجوّف من الدّاخل والشّكل المستدير المملوء بالكامل"),
    ("TEST Précision 5ème Maths - Suites proportionnelles [Exact]", "الرياضيات", "5", "أتعرّف سلسلتين من الأعداد الصحيحة الطبيعية المتناسبة طرديّا"),
    ("TEST Précision 5ème Maths - Suites proportionnelles [Modifié]", "الرياضيات", "5", "اتعرف سلسلتين من الاعداد الصحيحه الطبيعيه المتناسبه طرديا"),
    ("TEST Précision 5ème Maths - Suites proportionnelles [Conceptuel]", "الرياضيات", "5", "كيف أعرف أنّ زيادة عدد في قائمة تقابلها دائما نفس نسبة الزّيادة في قائمة أخرى"),
    ("TEST Précision 6ème Maths - Multiples communs [Exact]", "الرياضيات", "6", "أتعرّف مضاعفات مشتركة لعددين صحيحين طبيعيّين فأكثر"),
    ("TEST Précision 6ème Maths - Multiples communs [Modifié]", "الرياضيات", "6", "اتعرف مضاعفات مشتركه لعددين صحيحين طبيعيين فاكثر"),
    ("TEST Précision 6ème Maths - Multiples communs [Conceptuel]", "الرياضيات", "6", "كيف أجد عددا يقبل القسمة على عددين مختلفين في نفس الوقت"),
    ("TEST Précision 6ème Maths - Vitesse et distance [Exact]", "الرياضيات", "6", "أوظّف التّناسب في حساب معدّل السّرعة والمسافة"),
    ("TEST Précision 6ème Maths - Vitesse et distance [Modifié]", "الرياضيات", "6", "اوظف التناسب في حساب معدل السرعه والمسافه"),
    ("TEST Précision 6ème Maths - Vitesse et distance [Conceptuel]", "الرياضيات", "6", "كيف أحسب المسافة التي تقطعها سيّارة تسير بسرعة ثابتة خلال مدّة معيّنة"),
    ("TEST Précision 3ème Sciences - Déplacement dans l'eau [Exact]", "الإيقاظ العلمي", "3", "التنقل في الماء"),
    ("TEST Précision 3ème Sciences - Déplacement dans l'eau [Modifié]", "الإيقاظ العلمي", "3", "التنقل في الماء"),
    ("TEST Précision 3ème Sciences - Déplacement dans l'eau [Conceptuel]", "الإيقاظ العلمي", "3", "كيف تتحرّك الحيوانات التي تعيش في البحار والأنهار"),
    ("TEST Précision 3ème Sciences - États de la matière [Exact]", "الإيقاظ العلمي", "3", "حالات المادة في الطبيعة"),
    ("TEST Précision 3ème Sciences - États de la matière [Modifié]", "الإيقاظ العلمي", "3", "حالات الماده في الطبيعه"),
    ("TEST Précision 3ème Sciences - États de la matière [Conceptuel]", "الإيقاظ العلمي", "3", "لماذا يكون الماء أحيانا سائلا وأحيانا أخرى صلبا مثل الثّلج أو غازا مثل البخار"),
    ("TEST Précision 4ème Sciences - Conducteur/isolant thermique [Exact]", "الإيقاظ العلمي", "4", "الناقل الحراري والعازل الحراري"),
    ("TEST Précision 4ème Sciences - Conducteur/isolant thermique [Modifié]", "الإيقاظ العلمي", "4", "الناقل الحراري والعازل الحراري"),
    ("TEST Précision 4ème Sciences - Conducteur/isolant thermique [Conceptuel]", "الإيقاظ العلمي", "4", "لماذا تسخن بعض المعادن بسرعة بينما يبقى الخشب أو البلاستيك باردا عند لمس شيء ساخن"),
    ("TEST Précision 4ème Sciences - Mesure de masse (balance) [Exact]", "الإيقاظ العلمي", "4", "قيس كتل بواسطة الميزان"),
    ("TEST Précision 4ème Sciences - Mesure de masse (balance) [Modifié]", "الإيقاظ العلمي", "4", "قيس كتل بواسطه الميزان"),
    ("TEST Précision 4ème Sciences - Mesure de masse (balance) [Conceptuel]", "الإيقاظ العلمي", "4", "كيف أعرف وزن جسم ما بدقّة باستعمال أداة خاصّة"),
    ("TEST Précision 5ème Sciences - Circulation sanguine [Exact]", "الإيقاظ العلمي", "5", "الدورة الدموية: الصغرى - الكبرى"),
    ("TEST Précision 5ème Sciences - Circulation sanguine [Modifié]", "الإيقاظ العلمي", "5", "الدوره الدمويه الصغري الكبري"),
    ("TEST Précision 5ème Sciences - Circulation sanguine [Conceptuel]", "الإيقاظ العلمي", "5", "كيف ينتقل الدّم من القلب إلى بقيّة أعضاء الجسم ثمّ يعود إليه"),
    ("TEST Précision 5ème Sciences - Circuit électrique [Exact]", "الإيقاظ العلمي", "5", "الدارة الكهربائية - تمثيلها برسم بياني - القاطعة والصهيرة"),
    ("TEST Précision 5ème Sciences - Circuit électrique [Modifié]", "الإيقاظ العلمي", "5", "الداره الكهربائيه تمثيلها برسم بياني القاطعه والصهيره"),
    ("TEST Précision 5ème Sciences - Circuit électrique [Conceptuel]", "الإيقاظ العلمي", "5", "ما الذي يجعل المصباح يضيء عند الضغط على الزّرّ وينطفئ عند تركه"),
    ("TEST Précision 6ème Sciences - Pollinisation/fécondation [Exact]", "الإيقاظ العلمي", "6", "التأبير والاخصاب"),
    ("TEST Précision 6ème Sciences - Pollinisation/fécondation [Modifié]", "الإيقاظ العلمي", "6", "التابير والاخصاب"),
    ("TEST Précision 6ème Sciences - Pollinisation/fécondation [Conceptuel]", "الإيقاظ العلمي", "6", "كيف تتكوّن البذور داخل الأزهار قبل أن تصبح ثمارا"),
    ("TEST Précision 6ème Sciences - L'aimant [Exact]", "الإيقاظ العلمي", "6", "أنواع المغنط، أشكاله، قدرته على جذب المواد الحديديّة"),
    ("TEST Précision 6ème Sciences - L'aimant [Modifié]", "الإيقاظ العلمي", "6", "انواع المغنط اشكاله قدرته علي جذب المواد الحديديه"),
    ("TEST Précision 6ème Sciences - L'aimant [Conceptuel]", "الإيقاظ العلمي", "6", "لماذا تلتصق بعض القطع المعدنية بجسم معيّن دون تلامس مباشر"),
    ("TEST Précision 4ème Français - Verbe être au présent [Exact]", "Français", "4", "Le verbe « être » au présent"),
    ("TEST Précision 4ème Français - Verbe être au présent [Modifié]", "Français", "4", "le verbe etre au present"),
    ("TEST Précision 4ème Français - Verbe être au présent [Conceptuel]", "Français", "4", "comment exprimer ce qu'on est actuellement, par exemple content ou fatigué"),
    ("TEST Précision 4ème Français - Groupe sujet / groupe verbal [Exact]", "Français", "4", "Les deux groupes de la phrase (groupe sujet / groupe verbal)"),
    ("TEST Précision 4ème Français - Groupe sujet / groupe verbal [Modifié]", "Français", "4", "les deux groupes de la phrase groupe sujet groupe verbal"),
    ("TEST Précision 4ème Français - Groupe sujet / groupe verbal [Conceptuel]", "Français", "4", "comment repérer qui fait l'action et ce qu'il fait dans une phrase"),
    ("TEST Précision 5ème Français - G.N.S et G.V. [Exact]", "Français", "5", "J'apprends à reconnaître et à utiliser le G.N.S et le G.V. dans des phrases"),
    ("TEST Précision 5ème Français - G.N.S et G.V. [Modifié]", "Français", "5", "reconnaitre et utiliser le gns et le gv dans des phrases"),
    ("TEST Précision 5ème Français - G.N.S et G.V. [Conceptuel]", "Français", "5", "comment trouver le groupe de mots qui fait l'action et celui qui décrit l'action dans une phrase"),
    ("TEST Précision 5ème Français - Noms féminins en ie/ue/ée [Exact]", "Français", "5", "J'apprends à écrire des noms féminins qui se terminent par « ie », « ue » ou « ée »"),
    ("TEST Précision 5ème Français - Noms féminins en ie/ue/ée [Modifié]", "Français", "5", "ecrire des noms feminins qui se terminent par ie ue ou ee"),
    ("TEST Précision 5ème Français - Noms féminins en ie/ue/ée [Conceptuel]", "Français", "5", "comment écrire la fin d'un mot comme sortie, statue ou cheminée sans se tromper"),
    ("TEST Précision 6ème Français - Adjectif épithète/attribut [Exact]", "Français", "6", "J'apprends à utiliser l'adjectif épithète et l'adjectif attribut"),
    ("TEST Précision 6ème Français - Adjectif épithète/attribut [Modifié]", "Français", "6", "utiliser l adjectif epithete et l adjectif attribut"),
    ("TEST Précision 6ème Français - Adjectif épithète/attribut [Conceptuel]", "Français", "6", "quelle différence entre un mot qui décrit directement à côté du nom et un mot relié par le verbe être"),
    ("TEST Précision 6ème Français - Verbes pouvoir et vouloir au présent [Exact]", "Français", "6", "J'apprends à conjuguer les verbes pouvoir et vouloir au présent"),
    ("TEST Précision 6ème Français - Verbes pouvoir et vouloir au présent [Modifié]", "Français", "6", "conjuguer les verbes pouvoir et vouloir au present"),
    ("TEST Précision 6ème Français - Verbes pouvoir et vouloir au présent [Conceptuel]", "Français", "6", "comment dire qu'on a la capacité de faire quelque chose ou qu'on désire le faire"),
]

MATIERE_MAPPING = {
    "اللغة العربية": "arabe",
    "الرياضيات": "mathematique",
    "الإيقاظ العلمي": "science",
    "Français": "francais",
    "التاريخ والجغرافيا": "histoire_geo",
    "المواد الاجتماعية": "histoire_geo_madania"
}


def map_matiere(matiere_ar: str) -> str:
    return MATIERE_MAPPING.get(matiere_ar, matiere_ar.lower())


class ParametresExamen:
    def __init__(self, nom: str, matiere: str, niveau: str, chapitres: List[str]):
        self.nom_examen = nom
        self.matiere = matiere
        self.niveau = niveau
        self.chapitres = chapitres
        self.nb_questions = 5
        self.duree_minutes = 30
        self.langue = "fr" if matiere == "Français" else "ar"
        self.types_questions = ["qcm", "vrai_faux", "question_ouverte"]
        self.difficulte = "normale"


def build_rag_context(rag_results: List[Dict]) -> str:
    if not rag_results:
        return "Aucun contenu trouvé dans le programme."

    context_parts = ["=== CONTEXTE DU PROGRAMME ===\n"]

    for i, result in enumerate(rag_results[:5], 1):
        metadata = result['metadata']
        content = result['content']

        context_parts.append(f"\n[Extrait {i}]")
        context_parts.append(f"Matière: {metadata.get('matiere', 'N/A')}")
        context_parts.append(f"Niveau: {metadata.get('niveau', 'N/A')}")
        context_parts.append(f"Titre: {metadata.get('titre', 'N/A')}")
        context_parts.append(f"Contenu:\n{content}")
        context_parts.append("")

    return "\n".join(context_parts)


def generer_quiz_avec_gemini(params: ParametresExamen, contexte_rag: str) -> Examen:
    prompt = construire_prompt(params, contexte_programme=contexte_rag)

    prompt += """

Génère le quiz au format JSON:
{
  "matiere": "nom de la matière",
  "niveau": "niveau scolaire",
  "chapitre": "chapitre couvert",
  "langue": "ar",
  "duree_estimee_minutes": 30,
  "questions": [
    {
      "type": "qcm",
      "question": "نص السؤال",
      "options": ["أ) خيار 1", "ب) خيار 2", "ج) خيار 3", "د) خيار 4"],
      "reponse_correcte": 0,
      "explication": "شرح الإجابة"
    },
    {
      "type": "ouverte",
      "question": "نص السؤال المفتوح",
      "reponse_correcte": "الإجابة المتوقعة",
      "explication": "شرح الإجابة"
    }
  ]
}

Réponds UNIQUEMENT avec le JSON."""

    try:
        response_text = generate_content(prompt)

        response_text = response_text.strip()
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]
        response_text = response_text.strip()

        quiz_data = json.loads(response_text)
        return create_examen_from_response(quiz_data, params)

    except Exception as e:
        print(f"Erreur Gemini: {e}")
        return None


def create_examen_from_response(quiz_data: Dict, params: ParametresExamen) -> Examen:
    questions = []
    for q in quiz_data.get("questions", []):
        if q["type"] == "qcm":
            reponse_correcte_text = ""
            if isinstance(q["reponse_correcte"], int) and 0 <= q["reponse_correcte"] < len(q["options"]):
                reponse_correcte_text = q["options"][q["reponse_correcte"]]

            questions.append(QuestionQCM(
                type="qcm",
                question=q["question"],
                options=q["options"],
                reponse_correcte=reponse_correcte_text,
                explication=q.get("explication", "")
            ))

        elif q["type"] == "vrai_faux":
            reponse_bool = q["reponse_correcte"]
            if isinstance(reponse_bool, str):
                if reponse_bool in ['صواب', 'صحيح', 'نعم', 'true', 'True', 'صحيحة']:
                    reponse_bool = True
                elif reponse_bool in ['خطأ', 'خاطئ', 'لا', 'false', 'False', 'خاطئة']:
                    reponse_bool = False
                else:
                    reponse_bool = True

            questions.append(QuestionVraiFaux(
                type="vrai_faux",
                question=q["question"],
                reponse_correcte=reponse_bool,
                explication=q.get("explication", "")
            ))

        elif q["type"] == "question_ouverte" or q["type"] == "ouverte":
            reponse_attendue = q.get("reponse_correcte", q.get("reponse_exemple", "Réponse à définir"))
            questions.append(QuestionOuverte(
                type="ouverte",
                question=q["question"],
                reponse_correcte=reponse_attendue,
                explication=q.get("explication", "")
            ))

    return Examen(
        matiere=quiz_data.get("matiere", params.matiere),
        niveau=quiz_data.get("niveau", params.niveau),
        chapitre=quiz_data.get("chapitre", ", ".join(params.chapitres)),
        langue=quiz_data.get("langue", "ar"),
        duree_estimee_minutes=quiz_data.get("duree_estimee_minutes", 30),
        questions=questions
    )


def sauvegarder_quiz_avec_html(quiz_data: Dict, config: Dict, sources: List[str], all_quiz_list: List[Dict]) -> str:
    full_quiz_data = {
        'config': config,
        'quiz': quiz_data,
        'sources': sources,
        'timestamp': datetime.now().isoformat(),
        'nb_chunks_used': len(sources)
    }

    all_quiz_list.append(full_quiz_data)

    niveau = config.get('niveau', 'x')
    quiz_name = f"{config.get('nom', 'Quiz')} (Niveau {niveau})"

    print(f"Quiz ajouté à la collection HTML: {quiz_name}")

    return quiz_name


def generer_rapport_rag_html(all_quiz_data: List[Dict]) -> str:
    timestamp = datetime.now().strftime("%d/%m/%Y à %H:%M")

    html_content = f'''<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Rapport RAG — Analyse des leçons (Gemini + Database Tunisienne)</title>
<style>
  :root{{
    --ink:#1c2430; --paper:#f3f5f8; --card:#ffffff; --line:#e4e8ee;
    --accent:#3a5bfd; --accent-soft:#eef1ff; --muted:#6b7280;
  }}
  *{{box-sizing:border-box;}}
  body{{margin:0;background:linear-gradient(135deg, #fef7f7 0%, #f9f1f3 50%, #f3f5f8 100%);color:var(--ink);
    font-family:"Inter","Segoe UI",system-ui,sans-serif;line-height:1.6;}}
  .container{{max-width:1100px;margin:0 auto;padding:48px 24px 80px;}}
  .page-header{{text-align:center;margin-bottom:8px;}}
  .page-header h1{{font-size:2.1rem;font-weight:800;margin:0;}}
  .timestamp{{text-align:center;color:var(--muted);font-size:0.85rem;margin-bottom:44px;}}
  .quiz-block{{background:var(--card);border:1px solid var(--line);
    box-shadow:0 1px 2px rgba(16,24,40,.04);margin-bottom:28px;padding:28px 30px;
    border-radius:16px;}}
  .quiz-header h2{{font-size:1.35rem;font-weight:700;margin:0 0 20px;}}
  .rag-stats{{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));
    gap:12px;margin-bottom:26px;}}
  .stat{{background:var(--paper);padding:14px 16px;border-radius:10px;border:1px solid var(--line);}}
  .stat .label{{display:block;font-size:0.75rem;color:var(--muted);margin-bottom:4px;
    text-transform:uppercase;letter-spacing:.03em;}}
  .stat .value{{display:block;font-size:1.05rem;font-weight:700;color:var(--ink);}}

  .similarity{{
    color:#1a9d63 !important;
    font-weight:700;
    background:linear-gradient(135deg, #e8f9f0 0%, #d4f4dd 100%);
    padding:3px 8px;
    border-radius:6px;
    border:1px solid rgba(26,157,99,0.3);
    box-shadow:0 2px 4px rgba(26,157,99,0.15);
  }}
  .distance{{
    color:#e0483e !important;
    font-weight:700;
    background:linear-gradient(135deg, #fdecea 0%, #fde2e1 100%);
    padding:3px 8px;
    border-radius:6px;
    border:1px solid rgba(224,72,62,0.3);
    box-shadow:0 2px 4px rgba(224,72,62,0.15);
  }}
  .matiere-tag{{
    color:#3a5bfd !important;
    font-weight:600;
    background:linear-gradient(135deg, #eef1ff 0%, #e8ebff 100%);
    padding:3px 8px;
    border-radius:6px;
    border:1px solid rgba(58,91,253,0.3);
    box-shadow:0 2px 4px rgba(58,91,253,0.15);
  }}
</style>
</head>
<body>
<div class="container">

<div class="page-header">
<h1>Rapport RAG — Base de Donnees Tunisienne</h1>
<p>Systeme RAG + Base Tunisienne (Arabe & Mathematiques) + Gemini AI</p>
</div>

<div class="timestamp">Genere le {timestamp}</div>

'''

    for quiz_data in all_quiz_data:
        nom = quiz_data.get('nom', 'Quiz sans nom')
        matiere = quiz_data.get('matiere', 'N/A')
        niveau = quiz_data.get('niveau', 'N/A')
        query = quiz_data.get('query', 'N/A')
        rag_results = quiz_data.get('rag_results', [])
        search_type = quiz_data.get('search_type', 'unknown')

        html_content += f'''
<div class="quiz-block">
<div class="quiz-header">
<h2>{nom}</h2>
<p><strong>{matiere}</strong> — Niveau {niveau}</p>
</div>

<div class="rag-stats">
<div class="stat">
<span class="label">Requête de recherche</span>
<span class="value">{query}</span>
</div>
<div class="stat">
<span class="label">Type de recherche</span>
<span class="value">{"Exacte" if search_type == "exact" else "Semantique"}</span>
</div>
<div class="stat">
<span class="label">Leçons trouvées</span>
<span class="value">{len(rag_results)}</span>
</div>
</div>

<h3>Leçons identifiées par le RAG</h3>
'''

        if rag_results:
            for i, result in enumerate(rag_results, 1):
                metadata = result.get('metadata', {})
                similarity = result.get('similarity', 0)
                distance = result.get('distance', 0)
                titre = metadata.get('titre', 'Sans titre')
                notions_raw = metadata.get('notions', '')
                if isinstance(notions_raw, list):
                    notions_raw = '\n'.join(f"• {n}" for n in notions_raw)
                notions = notions_raw.replace('\n', '<br>') if notions_raw else 'Notions non disponibles'
                matiere_rag = metadata.get('matiere', 'N/A')

                html_content += f'''
<div style="background:var(--paper);padding:16px;border-radius:8px;margin-bottom:12px;">
<strong>#{i}</strong> — {titre}<br>
<div style="margin:8px 0;padding:8px;background:rgba(59, 130, 246, 0.1);border-radius:6px;font-size:0.9em;">
<strong>📖 Notions:</strong> {notions}
</div>
<small style="color:var(--muted);">
Similarité: <span class="similarity">{similarity:.1f}%</span> | Distance: <span class="distance">{distance:.3f}</span> | Matière: <span class="matiere-tag">{matiere_rag}</span>
</small>
</div>
'''
        else:
            html_content += '<p style="color:var(--muted);font-style:italic;">Aucune leçon trouvée</p>'

        html_content += '</div>'

    html_content += '''
</div>
</body>
</html>
'''

    return html_content


def main():
    lessons_dir = Path(_ROOT) / "database_tunisienne"
    if not lessons_dir.exists():
        print(f"ERREUR: Dossier {lessons_dir} non trouve!")
        sys.exit(1)

    rag_system = SimpleRAG(lessons_dir=str(lessons_dir))
    rag_system.index_all()
    stats = rag_system.get_stats()
    print(f"RAG initialise avec database_tunisienne - {stats['total_chunks']} chunks indexes")
    print(f"   Arabe: {stats['par_matiere'].get('arabe', 0)} chapitres")
    print(f"   Maths: {stats['par_matiere'].get('mathematique', 0)} chapitres\n")

    all_quiz_data = []
    all_quiz_collection = []

    for nom, matiere_ar, niveau, query in quiz_configs:
        print(f"Quiz: {nom}")
        print(f"   Matiere: {matiere_ar} | Niveau: {niveau}")
        print(f"   Recherche: '{query}'")

        matiere_en = map_matiere(matiere_ar)

        rag_result = rag_system.search(
            query=query,
            matiere=matiere_en,
            niveau=niveau,
            n_results=5
        )

        rag_results = rag_result.get('results', [])
        search_type = rag_result.get('search_type', 'semantic')

        print(f"   RAG trouve: {len(rag_results)} resultats ({search_type})")

        contexte_rag = build_rag_context(rag_results)

        params = ParametresExamen(nom, matiere_ar, niveau, [query])

        try:
            print("   Generation quiz avec Gemini...")
            examen = generer_quiz_avec_gemini(params, contexte_rag)

            if examen:
                print(f"   SUCCES ! Quiz genere: {len(examen.questions)} questions")

                quiz_config = {
                    'nom': nom,
                    'matiere': matiere_en,
                    'niveau': niveau,
                    'duree_minutes': 30
                }

                quiz_data_dict = {
                    'questions': []
                }

                for q in examen.questions:
                    q_dict = {
                        'type': q.type,
                        'question': q.question,
                        'explication': q.explication
                    }

                    if q.type == 'qcm':
                        q_dict['options'] = q.options
                        try:
                            q_dict['reponse_correcte'] = q.options.index(q.reponse_correcte)
                        except ValueError:
                            q_dict['reponse_correcte'] = 0
                    else:
                        q_dict['reponse_correcte'] = q.reponse_correcte

                    quiz_data_dict['questions'].append(q_dict)

                sources = [r.get('metadata', {}).get('chapitre', 'Source inconnue') for r in rag_results]

                sauvegarder_quiz_avec_html(quiz_data_dict, quiz_config, sources, all_quiz_collection)

            else:
                print("   Echec generation quiz")

            all_quiz_data.append({
                'nom': nom,
                'matiere': matiere_ar,
                'niveau': niveau,
                'query': query,
                'rag_results': rag_results,
                'search_type': search_type,
                'examen': examen
            })

        except Exception as e:
            print(f"   ERREUR pour {nom}: {e}")
            all_quiz_data.append({
                'nom': nom,
                'matiere': matiere_ar,
                'niveau': niveau,
                'query': query,
                'rag_results': rag_results,
                'search_type': search_type,
                'examen': None
            })

        print()

    print("\nGeneration du rapport HTML...")
    rapport_html = generer_rapport_rag_html(all_quiz_data)

    rapport_path = _ROOT / "QUIZ_RAPPORT_FINAL_GEMINI.html"
    with open(rapport_path, 'w', encoding='utf-8') as f:
        f.write(rapport_html)

    success_count = sum(1 for q in all_quiz_data if q['examen'] is not None)
    error_count = len(all_quiz_data) - success_count

    print(f"Quiz generes avec succes: {success_count} | Erreurs: {error_count}")
    print(f"Rapport RAG genere: {rapport_path.name}")


if __name__ == "__main__":
    main()