"""
Interface HTML pour afficher les examens générés avec RAG
==========================================================
"""

import json
from datetime import datetime
from pathlib import Path

TEMPLATE_HTML = """<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Examen — Générateur Tunisien</title>
<style>
  :root{
    --ink:#1c2b24;
    --paper:#f7f5ef;
    --card:#ffffff;
    --line:#e2ddd0;
    --primary:#2f6b4f;
    --primary-bg:#e7f1ea;
    --accent:#c9622a;
    --muted:#7a7566;
    --warning:#a13d2e;
    --warning-bg:#f7e9e5;
  }
  *{box-sizing:border-box;}
  body{
    margin:0;
    background:var(--paper);
    color:var(--ink);
    font-family:"Tahoma","Arial",sans-serif;
    line-height:1.7;
    font-size:16px;
  }
  .wrap{max-width:900px;margin:0 auto;padding:32px 24px 80px;}
  
  /* Header Officiel */
  .header-official{
    text-align:center;
    border:3px solid var(--ink);
    padding:24px;
    margin-bottom:32px;
    background:var(--card);
  }
  .header-official h1{
    margin:0 0 8px;
    font-size:1.8rem;
    letter-spacing:-0.01em;
  }
  .header-official .meta{
    font-size:1.1rem;
    color:var(--muted);
    margin:4px 0;
  }
  .header-official .exam-info{
    margin-top:16px;
    padding-top:16px;
    border-top:2px solid var(--line);
    display:flex;
    justify-content:space-around;
    gap:16px;
    flex-wrap:wrap;
  }
  .header-official .exam-info .info-item{
    font-size:1rem;
  }
  .header-official .exam-info .info-item strong{
    color:var(--ink);
  }
  
  /* Container Examen */
  .exam-container{
    background:var(--card);
    border:1px solid var(--line);
    padding:32px;
    margin-bottom:24px;
    box-shadow:0 2px 8px rgba(0,0,0,0.05);
  }
  
  /* Préambule */
  .preamble{
    text-align:center;
    font-size:1.1rem;
    margin-bottom:24px;
    padding:16px;
    background:var(--primary-bg);
    border-radius:4px;
  }
  
  /* Contenu brut */
  .exam-content{
    white-space:pre-wrap;
    font-family:"Tahoma","Arial",sans-serif;
    line-height:1.9;
    font-size:1.05rem;
  }
  
  /* Headers markdown */
  .exam-content h1, .exam-content h2, .exam-content h3{
    margin-top:24px;
    margin-bottom:12px;
    color:var(--ink);
  }
  .exam-content h1{font-size:1.6rem;border-bottom:2px solid var(--ink);padding-bottom:8px;}
  .exam-content h2{font-size:1.3rem;}
  .exam-content h3{font-size:1.1rem;}
  
  /* Lists */
  .exam-content ul, .exam-content ol{
    padding-right:24px;
    margin:12px 0;
  }
  .exam-content li{
    margin-bottom:8px;
  }
  
  /* Code/Math */
  .exam-content code{
    background:var(--paper);
    padding:2px 6px;
    border-radius:2px;
    font-family:"Courier New",monospace;
    font-size:0.95em;
  }
  
  /* Sections spéciales */
  .section-exercice{
    margin:24px 0;
    padding:16px;
    border-right:4px solid var(--accent);
    background:#fafaf8;
  }
  
  .section-correction{
    margin:32px 0 0;
    padding:20px;
    border:2px dashed var(--primary);
    background:var(--primary-bg);
    border-radius:4px;
  }
  
  /* Métadonnées RAG */
  .rag-meta{
    background:var(--warning-bg);
    border-right:3px solid var(--warning);
    padding:12px 16px;
    margin-top:24px;
    font-size:0.9rem;
  }
  .rag-meta strong{color:var(--warning);}
  
  /* Footer */
  footer{
    text-align:center;
    font-size:0.85rem;
    color:var(--muted);
    margin-top:48px;
    padding-top:24px;
    border-top:1px solid var(--line);
  }
  
  /* Print styles */
  @media print{
    body{background:#fff;}
    .wrap{padding:0;}
    .rag-meta{display:none;}
    .exam-container{border:none;box-shadow:none;}
  }
  
  /* RTL support */
  [dir="rtl"]{text-align:right;}
  [dir="rtl"] .section-exercice{border-right:none;border-left:4px solid var(--accent);}
  [dir="rtl"] .rag-meta{border-right:none;border-left:3px solid var(--warning);}
  [dir="rtl"] ul, [dir="rtl"] ol{padding-right:0;padding-left:24px;}
</style>
</head>
<body>
<div class="wrap">
  <!-- Header Officiel -->
  <div class="header-official">
    <h1>الجمهورية التونسية</h1>
    <div class="meta">وزارة التربية</div>
    <div class="meta">__SCHOOL__</div>
    <div class="exam-info">
      <div class="info-item"><strong>المادة:</strong> __MATIERE__</div>
      <div class="info-item"><strong>المستوى:</strong> __NIVEAU__</div>
      <div class="info-item"><strong>النوع:</strong> __TYPE__</div>
      <div class="info-item"><strong>المدة:</strong> __DUREE__ دقيقة</div>
    </div>
  </div>
  
  <!-- Préambule -->
  <div class="preamble">
    📝 اقرأ الأسئلة بعناية وأجب عليها بدقة
  </div>
  
  <!-- Contenu de l'examen -->
  <div class="exam-container">
    <div class="exam-content">__EXAM_CONTENT__</div>
  </div>
  
  <!-- Métadonnées RAG -->
  <div class="rag-meta">
    <strong>📚 مصادر البرنامج الرسمي:</strong> __SOURCES__<br>
    <strong>📊 عدد المقاطع المستخدمة:</strong> __CHUNKS__ من قاعدة البيانات<br>
    <strong>🤖 مولد بواسطة:</strong> نظام RAG + Gemini AI
  </div>
  
  <footer>
    تم إنشاؤه بواسطة مولد الامتحانات التونسي • __TIMESTAMP__
  </footer>
</div>
</body>
</html>
"""


def format_exam_content(content: str) -> str:
    """Formate le contenu markdown en HTML préservant la structure"""
    
    # Convertir headers markdown
    content = content.replace('# ', '<h1>')
    content = content.replace('## ', '<h2>')
    content = content.replace('### ', '<h3>')
    
    # Ajouter fermetures de headers (simpliste mais fonctionnel)
    lines = content.split('\n')
    formatted_lines = []
    
    for line in lines:
        if line.startswith('<h1>'):
            line = line + '</h1>'
        elif line.startswith('<h2>'):
            line = line + '</h2>'
        elif line.startswith('<h3>'):
            line = line + '</h3>'
        formatted_lines.append(line)
    
    return '\n'.join(formatted_lines)


def create_exam_html(exam_data: dict, output_file: str = None):
    """
    Crée un fichier HTML pour afficher un examen
    
    Args:
        exam_data: Dict contenant l'examen généré
        output_file: Chemin du fichier HTML à créer
    """
    
    config = exam_data.get('config', {})
    exam = exam_data.get('exam', {})
    sources = exam_data.get('sources', [])
    chunks = exam_data.get('nb_chunks_used', 0)
    
    # Extraire infos
    matiere = config.get('matiere', 'رياضيات')
    niveau = f"السنة {config.get('niveau', '؟')} ابتدائي"
    type_exam = config.get('type_exam', 'امتحان')
    duree = config.get('duree_minutes', 60)
    
    # Mapping types
    type_mapping = {
        'controle': 'مراقبة',
        'examen': 'امتحان',
        'devoir': 'فرض'
    }
    type_ar = type_mapping.get(type_exam, type_exam)
    
    # Mapping matières
    matiere_mapping = {
        'mathematique': 'رياضيات',
        'arabe': 'لغة عربية',
        'francais': 'français',
        'science': 'إيقاظ علمي',
        'physique': 'فيزياء',
        'geo': 'جغرافيا',
        'histoire': 'تاريخ',
        'madaniya': 'تربية مدنية',
    }
    matiere_ar = matiere_mapping.get(matiere, matiere)
    
    # Contenu de l'examen
    exam_content = exam.get('contenu', str(exam))
    exam_content = format_exam_content(exam_content)
    
    # Sources
    sources_str = ', '.join(sources) if sources else 'البرنامج الرسمي'
    
    # Remplir le template
    html = TEMPLATE_HTML
    html = html.replace('__SCHOOL__', 'المدرسة الابتدائية: .....................')
    html = html.replace('__MATIERE__', matiere_ar)
    html = html.replace('__NIVEAU__', niveau)
    html = html.replace('__TYPE__', type_ar)
    html = html.replace('__DUREE__', str(duree))
    html = html.replace('__EXAM_CONTENT__', exam_content)
    html = html.replace('__SOURCES__', sources_str)
    html = html.replace('__CHUNKS__', str(chunks))
    html = html.replace('__TIMESTAMP__', datetime.now().strftime('%Y-%m-%d %H:%M'))
    
    # Sauvegarder
    if output_file is None:
        output_file = f"exam_{matiere}_niveau{config.get('niveau', '?')}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.html"
    
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(html)
    
    print(f"✅ HTML créé: {output_file}")
    return output_file


def create_multiple_exams_html(exams_data: list, output_file: str = "examens_collection.html"):
    """Crée un HTML avec plusieurs examens"""
    
    # TODO: Implémenter version multi-examens si besoin
    pass


if __name__ == "__main__":
    # Test avec un examen exemple
    test_file = "test_exam_math1.json"
    
    if Path(test_file).exists():
        with open(test_file, 'r', encoding='utf-8') as f:
            exam_data = json.load(f)
        
        html_file = create_exam_html(exam_data, "exam_math1_viewer.html")
        print(f"\n🌐 Ouvre le fichier dans ton navigateur:")
        print(f"   {Path(html_file).absolute()}")
    else:
        print(f"❌ Fichier {test_file} introuvable")
