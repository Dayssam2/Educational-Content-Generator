"""
Interface HTML interactive pour visualiser les quiz générés
==========================================================
Similaire à exam_viewer.py mais optimisé pour les quiz tunisiens
"""

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

QUIZ_HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>🧠 Quiz Interactif — البرنامج التونسي</title>
<style>
  :root{
    --primary:#2563eb; --primary-bg:#eff6ff; 
    --success:#16a34a; --success-bg:#f0fdf4;
    --warning:#ea580c; --warning-bg:#fff7ed;
    --danger:#dc2626; --danger-bg:#fef2f2;
    --ink:#1f2937; --paper:#f9fafb; --card:#ffffff; 
    --line:#e5e7eb; --muted:#6b7280;
  }
  
  *{box-sizing:border-box;}
  
  body{
    margin:0; background:var(--paper); color:var(--ink);
    font-family:"Tahoma","Arial",sans-serif; line-height:1.6;
    font-size:16px; min-height:100vh;
  }
  
  .container{
    max-width:950px; margin:0 auto; 
    padding:32px 24px 80px;
  }
  
  /* Header Quiz */
  .quiz-header{
    background:var(--card); border:2px solid var(--primary);
    border-radius:12px; padding:28px; text-align:center;
    margin-bottom:32px; box-shadow:0 4px 12px rgba(0,0,0,.08);
  }
  
  .quiz-title{
    font-size:1.8rem; font-weight:700; margin:0 0 8px;
    color:var(--primary);
  }
  
  .quiz-meta{
    display:flex; justify-content:center; gap:24px;
    margin-top:16px; flex-wrap:wrap;
  }
  
  .meta-item{
    background:var(--primary-bg); padding:8px 16px;
    border-radius:20px; font-size:0.9rem; font-weight:600;
  }
  
  /* Navigation Quiz */
  .quiz-nav{
    background:var(--card); border:1px solid var(--line);
    border-radius:8px; padding:20px; margin-bottom:24px;
    display:flex; align-items:center; justify-content:space-between;
    flex-wrap:wrap; gap:16px;
  }
  
  .question-counter{
    font-size:1.1rem; font-weight:600;
  }
  
  .nav-buttons{
    display:flex; gap:12px;
  }
  
  .btn{
    padding:8px 16px; border:none; border-radius:6px;
    cursor:pointer; font-weight:600; font-size:0.9rem;
    transition:all 0.2s ease;
  }
  
  .btn-primary{
    background:var(--primary); color:white;
  }
  .btn-primary:hover{background:#1d4ed8;}
  .btn-primary:disabled{background:var(--muted); cursor:not-allowed;}
  
  .btn-secondary{
    background:var(--line); color:var(--ink);
  }
  .btn-secondary:hover{background:#d1d5db;}
  
  .btn-success{
    background:var(--success); color:white;
  }
  .btn-success:hover{background:#15803d;}
  
  /* Question Container */
  .question-container{
    background:var(--card); border:1px solid var(--line);
    border-radius:12px; padding:32px; margin-bottom:24px;
    box-shadow:0 2px 8px rgba(0,0,0,.04);
    display:none;
  }
  
  .question-container.active{
    display:block;
  }
  
  .question-header{
    display:flex; justify-content:space-between; align-items:center;
    margin-bottom:20px; flex-wrap:wrap; gap:12px;
  }
  
  .question-number{
    background:var(--primary); color:white;
    padding:8px 12px; border-radius:20px;
    font-weight:700; font-size:0.9rem;
  }
  
  .question-type{
    background:var(--warning-bg); color:var(--warning);
    padding:6px 12px; border-radius:16px;
    font-size:0.8rem; font-weight:600;
  }
  
  .question-text{
    font-size:1.2rem; line-height:1.7; margin-bottom:24px;
    font-weight:500; color:var(--ink);
    padding:20px; background:var(--paper);
    border-radius:8px; border-right:4px solid var(--primary);
  }
  
  /* Options QCM */
  .options-container{
    margin-bottom:24px;
  }
  
  .option{
    background:var(--card); border:2px solid var(--line);
    border-radius:8px; padding:16px; margin-bottom:12px;
    cursor:pointer; transition:all 0.2s ease;
    display:flex; align-items:center; gap:12px;
  }
  
  .option:hover{
    border-color:var(--primary); background:var(--primary-bg);
  }
  
  .option.selected{
    border-color:var(--primary); background:var(--primary-bg);
  }
  
  .option.correct{
    border-color:var(--success); background:var(--success-bg);
  }
  
  .option.incorrect{
    border-color:var(--danger); background:var(--danger-bg);
  }
  
  .option-letter{
    background:var(--primary); color:white;
    width:32px; height:32px; border-radius:50%;
    display:flex; align-items:center; justify-content:center;
    font-weight:700; flex-shrink:0;
  }
  
  .option-text{
    flex:1; line-height:1.5;
  }
  
  /* Zone réponse ouverte */
  .open-response{
    margin-bottom:24px;
  }
  
  .response-textarea{
    width:100%; min-height:120px; padding:16px;
    border:2px solid var(--line); border-radius:8px;
    font-family:inherit; font-size:1rem; line-height:1.5;
    resize:vertical;
  }
  
  .response-textarea:focus{
    outline:none; border-color:var(--primary);
  }
  
  /* Zone correction */
  .correction-zone{
    background:var(--success-bg); border:2px solid var(--success);
    border-radius:8px; padding:20px; margin-top:20px;
    display:none;
  }
  
  .correction-zone.show{
    display:block;
  }
  
  .correction-title{
    color:var(--success); font-weight:700; font-size:1.1rem;
    margin-bottom:12px; display:flex; align-items:center; gap:8px;
  }
  
  .correction-text{
    line-height:1.6; color:var(--ink);
  }
  
  /* Résultats finaux */
  .results-container{
    background:var(--card); border:2px solid var(--primary);
    border-radius:12px; padding:32px; text-align:center;
    display:none;
  }
  
  .results-container.show{
    display:block;
  }
  
  .final-score{
    font-size:3rem; font-weight:800; color:var(--primary);
    margin-bottom:16px;
  }
  
  .score-details{
    display:flex; justify-content:center; gap:32px;
    margin:24px 0; flex-wrap:wrap;
  }
  
  .score-item{
    text-align:center;
  }
  
  .score-number{
    display:block; font-size:1.8rem; font-weight:700;
  }
  
  .score-label{
    display:block; font-size:0.9rem; color:var(--muted);
    margin-top:4px;
  }
  
  .correct{color:var(--success);}
  .incorrect{color:var(--danger);}
  
  /* Footer */
  .quiz-footer{
    text-align:center; margin-top:48px; padding-top:24px;
    border-top:1px solid var(--line); color:var(--muted);
    font-size:0.85rem;
  }
  
  /* Responsive */
  @media (max-width: 640px){
    .container{padding:20px 16px 60px;}
    .quiz-meta{gap:12px;}
    .meta-item{padding:6px 12px; font-size:0.8rem;}
    .quiz-nav{flex-direction:column; align-items:stretch;}
    .question-header{flex-direction:column; align-items:flex-start;}
    .score-details{gap:20px;}
  }
  
  /* RTL Support */
  [dir="rtl"]{text-align:right;}
  [dir="rtl"] .question-text{border-right:none; border-left:4px solid var(--primary);}
  [dir="rtl"] .option{flex-direction:row-reverse;}
  
  /* Animations */
  .fade-in{
    animation:fadeIn 0.3s ease-in;
  }
  
  @keyframes fadeIn{
    from{opacity:0; transform:translateY(10px);}
    to{opacity:1; transform:translateY(0);}
  }
  
  /* Print styles */
  @media print{
    .quiz-nav, .btn{display:none;}
    .question-container{display:block !important; margin-bottom:40px;}
    .correction-zone{display:block !important;}
  }
</style>
</head>
<body>
<div class="container">
  
  <!-- Header Quiz -->
  <div class="quiz-header">
    <h1 class="quiz-title">__QUIZ_TITLE__</h1>
    <div class="quiz-meta">
      <div class="meta-item">📚 المادة: __SUBJECT__</div>
      <div class="meta-item">📊 المستوى: __LEVEL__</div>
      <div class="meta-item">❓ عدد الأسئلة: __TOTAL_QUESTIONS__</div>
      <div class="meta-item">⏱️ الوقت: __DURATION__ دقيقة</div>
    </div>
  </div>
  
  <!-- Navigation Quiz -->
  <div class="quiz-nav">
    <div class="question-counter">
      السؤال <span id="current-q">1</span> من <span id="total-q">__TOTAL_QUESTIONS__</span>
    </div>
    <div class="nav-buttons">
      <button class="btn btn-secondary" id="prev-btn" onclick="previousQuestion()" disabled>السابق</button>
      <button class="btn btn-primary" id="next-btn" onclick="nextQuestion()">التالي</button>
      <button class="btn btn-success" id="submit-btn" onclick="submitQuiz()" style="display:none;">إنهاء الاختبار</button>
    </div>
  </div>
  
  <!-- Questions Container -->
  <div id="questions-container">
    __QUESTIONS_HTML__
  </div>
  
  <!-- Résultats finaux -->
  <div class="results-container" id="results">
    <h2>🎉 انتهيت من الاختبار!</h2>
    <div class="final-score" id="final-score">0%</div>
    <div class="score-details">
      <div class="score-item">
        <span class="score-number correct" id="correct-count">0</span>
        <span class="score-label">إجابات صحيحة</span>
      </div>
      <div class="score-item">
        <span class="score-number incorrect" id="incorrect-count">0</span>
        <span class="score-label">إجابات خاطئة</span>
      </div>
      <div class="score-item">
        <span class="score-number" id="total-count">0</span>
        <span class="score-label">إجمالي الأسئلة</span>
      </div>
    </div>
    <button class="btn btn-primary" onclick="restartQuiz()">إعادة الاختبار</button>
  </div>
  
  <!-- Footer -->
  <div class="quiz-footer">
    تم إنشاؤه بواسطة مولد الاختبارات التونسي • RAG + Gemini AI<br>
    __TIMESTAMP__
  </div>

</div>

<script>
let currentQuestion = 0;
let totalQuestions = __TOTAL_QUESTIONS__;
let userAnswers = {};
let quizData = __QUIZ_DATA__;

// Navigation
function nextQuestion() {
  if (currentQuestion < totalQuestions - 1) {
    hideQuestion(currentQuestion);
    currentQuestion++;
    showQuestion(currentQuestion);
    updateNavigation();
  }
}

function previousQuestion() {
  if (currentQuestion > 0) {
    hideQuestion(currentQuestion);
    currentQuestion--;
    showQuestion(currentQuestion);
    updateNavigation();
  }
}

function showQuestion(index) {
  const questionEl = document.getElementById(`question-${index}`);
  if (questionEl) {
    questionEl.classList.add('active', 'fade-in');
  }
  document.getElementById('current-q').textContent = index + 1;
}

function hideQuestion(index) {
  const questionEl = document.getElementById(`question-${index}`);
  if (questionEl) {
    questionEl.classList.remove('active', 'fade-in');
  }
}

function updateNavigation() {
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  const submitBtn = document.getElementById('submit-btn');
  
  prevBtn.disabled = currentQuestion === 0;
  
  if (currentQuestion === totalQuestions - 1) {
    nextBtn.style.display = 'none';
    submitBtn.style.display = 'inline-block';
  } else {
    nextBtn.style.display = 'inline-block';
    submitBtn.style.display = 'none';
  }
}

// Réponses
function selectOption(questionIndex, optionIndex) {
  // Désélectionner autres options
  const options = document.querySelectorAll(`#question-${questionIndex} .option`);
  options.forEach(opt => opt.classList.remove('selected'));
  
  // Sélectionner option cliquée
  const selectedOption = document.getElementById(`q${questionIndex}-opt${optionIndex}`);
  selectedOption.classList.add('selected');
  
  // Sauvegarder réponse
  userAnswers[questionIndex] = optionIndex;
}

function saveOpenResponse(questionIndex, value) {
  userAnswers[questionIndex] = value;
}

// Soumission
function submitQuiz() {
  let correctAnswers = 0;
  
  // Afficher corrections
  for (let i = 0; i < totalQuestions; i++) {
    const question = quizData.questions[i];
    const userAnswer = userAnswers[i];
    
    if (question.type === 'qcm') {
      const correctIndex = question.reponse_correcte;
      const options = document.querySelectorAll(`#question-${i} .option`);
      
      options.forEach((opt, idx) => {
        opt.style.pointerEvents = 'none';
        if (idx === correctIndex) {
          opt.classList.add('correct');
        } else if (idx === userAnswer && idx !== correctIndex) {
          opt.classList.add('incorrect');
        }
      });
      
      if (userAnswer === correctIndex) {
        correctAnswers++;
      }
    }
    
    // Afficher correction
    const correctionEl = document.getElementById(`correction-${i}`);
    if (correctionEl) {
      correctionEl.classList.add('show');
    }
  }
  
  // Afficher résultats
  const percentage = Math.round((correctAnswers / totalQuestions) * 100);
  document.getElementById('final-score').textContent = percentage + '%';
  document.getElementById('correct-count').textContent = correctAnswers;
  document.getElementById('incorrect-count').textContent = totalQuestions - correctAnswers;
  document.getElementById('total-count').textContent = totalQuestions;
  
  // Cacher navigation et afficher résultats
  document.querySelector('.quiz-nav').style.display = 'none';
  document.getElementById('results').classList.add('show');
  
  // Scroll vers résultats
  document.getElementById('results').scrollIntoView({behavior: 'smooth'});
}

function restartQuiz() {
  location.reload();
}

// Initialisation
document.addEventListener('DOMContentLoaded', function() {
  showQuestion(0);
  updateNavigation();
  
  // Auto-save pour questions ouvertes
  const textareas = document.querySelectorAll('.response-textarea');
  textareas.forEach((textarea, index) => {
    textarea.addEventListener('input', function() {
      saveOpenResponse(this.dataset.questionIndex, this.value);
    });
  });
});

// Raccourcis clavier
document.addEventListener('keydown', function(e) {
  if (e.key === 'ArrowRight' && currentQuestion < totalQuestions - 1) {
    nextQuestion();
  } else if (e.key === 'ArrowLeft' && currentQuestion > 0) {
    previousQuestion();
  }
});
</script>
</body>
</html>
"""


def format_question_html(question_data: dict, question_index: int) -> str:
    """Formate une question en HTML"""
    
    question_type = question_data.get('type', 'qcm')
    question_text = question_data.get('question', '')
    
    # Header question
    type_labels = {
        'qcm': 'اختيار متعدد',
        'ouverte': 'سؤال مفتوح',
        'vrai_faux': 'صحيح/خطأ'
    }
    type_label = type_labels.get(question_type, question_type)
    
    html = f'''
    <div class="question-container" id="question-{question_index}">
      <div class="question-header">
        <div class="question-number">السؤال {question_index + 1}</div>
        <div class="question-type">{type_label}</div>
      </div>
      
      <div class="question-text">{question_text}</div>
    '''
    
    if question_type == 'qcm':
        # Options QCM
        options = question_data.get('options', [])
        html += '<div class="options-container">'
        
        option_letters = ['أ', 'ب', 'ج', 'د', 'هـ', 'و']
        
        for i, option in enumerate(options):
            letter = option_letters[i] if i < len(option_letters) else str(i+1)
            html += f'''
            <div class="option" id="q{question_index}-opt{i}" onclick="selectOption({question_index}, {i})">
              <div class="option-letter">{letter}</div>
              <div class="option-text">{option}</div>
            </div>
            '''
        
        html += '</div>'
    
    elif question_type == 'ouverte':
        # Zone réponse ouverte
        html += f'''
        <div class="open-response">
          <textarea class="response-textarea" 
                    data-question-index="{question_index}"
                    placeholder="اكتب إجابتك هنا..."></textarea>
        </div>
        '''
    
    # Zone correction
    explication = question_data.get('explication', '')
    if explication:
        html += f'''
        <div class="correction-zone" id="correction-{question_index}">
          <div class="correction-title">
            ✅ التفسير
          </div>
          <div class="correction-text">{explication}</div>
        </div>
        '''
    
    html += '</div>'
    return html


def create_quiz_html(quiz_data: dict, output_file: str = None) -> str:
    """
    Crée un fichier HTML interactif pour un quiz
    
    Args:
        quiz_data: Dict contenant le quiz généré
        output_file: Chemin du fichier HTML à créer
        
    Returns:
        Chemin du fichier créé
    """
    
    # Extraction des données
    quiz_info = quiz_data.get('quiz', {})
    config = quiz_data.get('config', {})
    questions = quiz_info.get('questions', [])
    
    # Métadonnées
    title = f"اختبار {config.get('matiere', 'المادة')} - المستوى {config.get('niveau', '؟')}"
    subject_map = {
        'arabe': 'اللغة العربية',
        'mathematique': 'الرياضيات'
    }
    subject = subject_map.get(config.get('matiere', ''), config.get('matiere', 'المادة'))
    level = f"السنة {config.get('niveau', '؟')} ابتدائي"
    total_questions = len(questions)
    duration = config.get('duree_minutes', 30)
    
    # Génération HTML des questions
    questions_html = ""
    for i, question in enumerate(questions):
        questions_html += format_question_html(question, i)
    
    # Préparation des données JS
    quiz_data_js = json.dumps(quiz_info, ensure_ascii=False, indent=2)
    
    # Remplir le template
    html = QUIZ_HTML_TEMPLATE
    html = html.replace('__QUIZ_TITLE__', title)
    html = html.replace('__SUBJECT__', subject)
    html = html.replace('__LEVEL__', level)
    html = html.replace('__TOTAL_QUESTIONS__', str(total_questions))
    html = html.replace('__DURATION__', str(duration))
    html = html.replace('__QUESTIONS_HTML__', questions_html)
    html = html.replace('__QUIZ_DATA__', quiz_data_js)
    html = html.replace('__TIMESTAMP__', datetime.now().strftime('%Y-%m-%d %H:%M'))
    
    # Nom du fichier de sortie
    if output_file is None:
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        matiere = config.get('matiere', 'quiz')
        niveau = config.get('niveau', 'x')
        output_file = f"QUIZ_INTERACTIF_{matiere.upper()}_NIVEAU{niveau}_{timestamp}.html"
    
    # Sauvegarder
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(html)
    
    print(f"Quiz interactif créé: {output_file}")
    return output_file


def create_quiz_collection_html(quiz_list: List[dict], output_file: str = "QUIZ_COLLECTION_INTERACTIVE.html") -> str:
    """Crée un HTML avec plusieurs quiz sélectionnables"""
    
    # TODO: Implémenter si nécessaire
    pass


def load_quiz_from_json(quiz_file: str) -> Optional[dict]:
    """Charge un quiz depuis un fichier JSON"""
    
    try:
        with open(quiz_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Erreur lecture {quiz_file}: {e}")
        return None


if __name__ == "__main__":
    # Test avec un quiz exemple
    
    # Créer un quiz de test si pas de fichier disponible
    test_quiz = {
        'config': {
            'matiere': 'arabe',
            'niveau': 1,
            'duree_minutes': 20
        },
        'quiz': {
            'questions': [
                {
                    'type': 'qcm',
                    'question': 'ما هو صوت الحرف "ب" في كلمة "باب"؟',
                    'options': ['بَا', 'بِي', 'بُو', 'بْ'],
                    'reponse_correcte': 0,
                    'explication': 'الحرف "ب" في كلمة "باب" يُلفظ "بَا" بفتحة.'
                },
                {
                    'type': 'ouverte',
                    'question': 'اكتب جملة تحتوي على حرف "ت"',
                    'reponse_correcte': 'مثال: التلميذ نشيط',
                    'explication': 'يجب أن تحتوي الجملة على حرف التاء في أي موضع.'
                }
            ]
        }
    }
    
    # Créer le quiz interactif
    html_file = create_quiz_html(test_quiz, "QUIZ_TEST_INTERACTIF.html")
    
    print(f"\n🌐 Ouvre le fichier dans ton navigateur:")
    print(f"   {Path(html_file).absolute()}")
    print(f"\n📱 Quiz interactif avec:")
    print("   • Navigation entre questions")
    print("   • Corrections automatiques")
    print("   • Résultats finaux")
    print("   • Interface RTL (arabe)")