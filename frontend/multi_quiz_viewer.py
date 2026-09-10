"""
Visualiseur HTML pour plusieurs quiz dans un seul fichier
========================================================
Tous les quiz générés dans une interface unifiée
"""

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

MULTI_QUIZ_HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>🧠 مجموعة الاختبارات — البرنامج التونسي</title>
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
    max-width:1000px; margin:0 auto; 
    padding:32px 24px 80px;
  }
  
  /* Header Principal */
  .main-header{
    background:var(--card); border:2px solid var(--primary);
    border-radius:12px; padding:28px; text-align:center;
    margin-bottom:32px; box-shadow:0 4px 12px rgba(0,0,0,.08);
  }
  
  .main-title{
    font-size:2rem; font-weight:700; margin:0 0 8px;
    color:var(--primary);
  }
  
  .main-subtitle{
    color:var(--muted); font-size:1.1rem; margin-bottom:20px;
  }
  
  .quiz-stats{
    display:flex; justify-content:center; gap:24px;
    flex-wrap:wrap;
  }
  
  .stat-item{
    background:var(--primary-bg); padding:12px 20px;
    border-radius:20px; font-weight:600;
  }
  
  /* Sélecteur de Quiz */
  .quiz-selector{
    background:var(--card); border:1px solid var(--line);
    border-radius:8px; padding:20px; margin-bottom:24px;
  }
  
  .selector-title{
    font-size:1.2rem; font-weight:600; margin-bottom:16px;
    color:var(--ink);
  }
  
  .quiz-list{
    display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr));
    gap:16px;
  }
  
  .quiz-card{
    background:var(--paper); border:2px solid var(--line);
    border-radius:8px; padding:16px; cursor:pointer;
    transition:all 0.2s ease;
  }
  
  .quiz-card:hover{
    border-color:var(--primary); background:var(--primary-bg);
  }
  
  .quiz-card.active{
    border-color:var(--primary); background:var(--primary-bg);
  }
  
  .quiz-card-title{
    font-weight:600; margin-bottom:8px; color:var(--ink);
  }
  
  .quiz-card-meta{
    font-size:0.9rem; color:var(--muted);
  }
  
  /* Navigation Quiz */
  .quiz-nav{
    background:var(--card); border:1px solid var(--line);
    border-radius:8px; padding:20px; margin-bottom:24px;
    display:flex; align-items:center; justify-content:space-between;
    flex-wrap:wrap; gap:16px; display:none;
  }
  
  .quiz-nav.show{display:flex;}
  
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
  
  /* Container Quiz */
  .quiz-content{
    display:none;
  }
  
  .quiz-content.active{
    display:block;
  }
  
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
  
  /* Résultats */
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
  
  /* Message pas de quiz */
  .no-quiz{
    text-align:center; padding:60px 20px;
    color:var(--muted); font-size:1.1rem;
  }
  
  /* Footer */
  .main-footer{
    text-align:center; margin-top:48px; padding-top:24px;
    border-top:1px solid var(--line); color:var(--muted);
    font-size:0.85rem;
  }
  
  /* Responsive */
  @media (max-width: 640px){
    .container{padding:20px 16px 60px;}
    .quiz-stats{gap:12px;}
    .stat-item{padding:8px 16px; font-size:0.9rem;}
    .quiz-nav{flex-direction:column; align-items:stretch;}
    .question-header{flex-direction:column; align-items:flex-start;}
    .score-details{gap:20px;}
    .quiz-list{grid-template-columns:1fr;}
  }
  
  /* RTL Support */
  [dir="rtl"]{text-align:right;}
  [dir="rtl"] .question-text{border-right:none; border-left:4px solid var(--primary);}
  [dir="rtl"] .option{flex-direction:row-reverse;}
</style>
</head>
<body>
<div class="container">
  
  <!-- Header Principal -->
  <div class="main-header">
    <h1 class="main-title">مجموعة الاختبارات التفاعلية</h1>
    <div class="main-subtitle">البرنامج الرسمي التونسي - اللغة العربية والرياضيات</div>
    <div class="quiz-stats">
      <div class="stat-item">📚 عدد الاختبارات: <span id="quiz-count">0</span></div>
      <div class="stat-item">🎯 المواد: عربي، رياضيات</div>
      <div class="stat-item">📊 المستويات: 1، 2</div>
    </div>
  </div>
  
  <!-- Sélecteur de Quiz -->
  <div class="quiz-selector">
    <div class="selector-title">اختر الاختبار:</div>
    <div class="quiz-list" id="quiz-list">
      <div class="no-quiz">لا توجد اختبارات متاحة حاليا</div>
    </div>
  </div>
  
  <!-- Navigation Quiz -->
  <div class="quiz-nav" id="quiz-nav">
    <div class="question-counter">
      السؤال <span id="current-q">1</span> من <span id="total-q">0</span>
    </div>
    <div class="nav-buttons">
      <button class="btn btn-secondary" id="prev-btn" onclick="previousQuestion()" disabled>السابق</button>
      <button class="btn btn-primary" id="next-btn" onclick="nextQuestion()">التالي</button>
      <button class="btn btn-success" id="submit-btn" onclick="submitQuiz()" style="display:none;">إنهاء الاختبار</button>
      <button class="btn btn-secondary" onclick="backToSelection()">العودة للقائمة</button>
    </div>
  </div>
  
  <!-- Container Quiz -->
  <div id="quiz-container">
    <!-- Questions sera générées dynamiquement -->
  </div>
  
  <!-- Résultats -->
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
    <div style="margin-top:24px; display:flex; gap:12px; justify-content:center; flex-wrap:wrap;">
      <button class="btn btn-primary" onclick="restartQuiz()">إعادة الاختبار</button>
      <button class="btn btn-secondary" onclick="backToSelection()">اختبار آخر</button>
    </div>
  </div>
  
  <!-- Footer -->
  <div class="main-footer">
    تم إنشاؤه بواسطة مولد الاختبارات التونسي • RAG + Gemini AI<br>
    __TIMESTAMP__
  </div>

</div>

<script>
// Variables globales
let allQuizzes = __QUIZ_DATA__;
let currentQuizIndex = -1;
let currentQuestion = 0;
let totalQuestions = 0;
let userAnswers = {};

// Initialisation
document.addEventListener('DOMContentLoaded', function() {
  loadQuizList();
  updateQuizCount();
});

function updateQuizCount() {
  document.getElementById('quiz-count').textContent = allQuizzes.length;
}

function loadQuizList() {
  const listContainer = document.getElementById('quiz-list');
  
  if (allQuizzes.length === 0) {
    listContainer.innerHTML = '<div class="no-quiz">لا توجد اختبارات متاحة حاليا</div>';
    return;
  }
  
  listContainer.innerHTML = '';
  
  allQuizzes.forEach((quiz, index) => {
    const card = document.createElement('div');
    card.className = 'quiz-card';
    card.onclick = () => selectQuiz(index);
    
    const config = quiz.config || {};
    const questions = quiz.quiz?.questions || [];
    
    const subjectMap = {
      'arabe': 'اللغة العربية',
      'mathematique': 'الرياضيات'
    };
    
    const subject = subjectMap[config.matiere] || config.matiere || 'غير محدد';
    const level = `المستوى ${config.niveau || '؟'}`;
    const questionCount = questions.length;
    
    card.innerHTML = `
      <div class="quiz-card-title">${subject} - ${level}</div>
      <div class="quiz-card-meta">
        عدد الأسئلة: ${questionCount} • 
        المدة: ${config.duree_minutes || 30} دقيقة
      </div>
    `;
    
    listContainer.appendChild(card);
  });
}

function selectQuiz(index) {
  currentQuizIndex = index;
  const quiz = allQuizzes[index];
  const questions = quiz.quiz?.questions || [];
  
  if (questions.length === 0) {
    alert('هذا الاختبار لا يحتوي على أسئلة');
    return;
  }
  
  // Mettre à jour UI
  document.querySelector('.quiz-selector').style.display = 'none';
  document.getElementById('quiz-nav').classList.add('show');
  
  // Marquer carte active
  const cards = document.querySelectorAll('.quiz-card');
  cards.forEach(card => card.classList.remove('active'));
  cards[index].classList.add('active');
  
  // Charger questions
  loadQuizQuestions(quiz);
  
  // Reset état
  currentQuestion = 0;
  userAnswers = {};
  totalQuestions = questions.length;
  
  document.getElementById('total-q').textContent = totalQuestions;
  
  showQuestion(0);
  updateNavigation();
}

function loadQuizQuestions(quiz) {
  const questions = quiz.quiz?.questions || [];
  const container = document.getElementById('quiz-container');
  container.innerHTML = '';
  
  questions.forEach((question, index) => {
    const questionEl = createQuestionElement(question, index);
    container.appendChild(questionEl);
  });
}

function createQuestionElement(question, index) {
  const div = document.createElement('div');
  div.className = 'question-container';
  div.id = `question-${index}`;
  
  const typeLabels = {
    'qcm': 'اختيار متعدد',
    'ouverte': 'سؤال مفتوح',
    'vrai_faux': 'صحيح/خطأ'
  };
  
  const typeLabel = typeLabels[question.type] || question.type;
  
  let optionsHtml = '';
  
  if (question.type === 'qcm') {
    const letters = ['أ', 'ب', 'ج', 'د', 'هـ', 'و'];
    optionsHtml = '<div class="options-container">';
    
    (question.options || []).forEach((option, i) => {
      const letter = letters[i] || (i + 1);
      optionsHtml += `
        <div class="option" id="q${index}-opt${i}" onclick="selectOption(${index}, ${i})">
          <div class="option-letter">${letter}</div>
          <div class="option-text">${option}</div>
        </div>
      `;
    });
    
    optionsHtml += '</div>';
  } else if (question.type === 'ouverte') {
    optionsHtml = `
      <div class="open-response">
        <textarea class="response-textarea" 
                  data-question-index="${index}"
                  placeholder="اكتب إجابتك هنا..."></textarea>
      </div>
    `;
  }
  
  let correctionHtml = '';
  if (question.explication) {
    correctionHtml = `
      <div class="correction-zone" id="correction-${index}">
        <div class="correction-title">✅ التفسير</div>
        <div class="correction-text">${question.explication}</div>
      </div>
    `;
  }
  
  div.innerHTML = `
    <div class="question-header">
      <div class="question-number">السؤال ${index + 1}</div>
      <div class="question-type">${typeLabel}</div>
    </div>
    
    <div class="question-text">${question.question}</div>
    
    ${optionsHtml}
    
    ${correctionHtml}
  `;
  
  return div;
}

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
    questionEl.classList.add('active');
  }
  document.getElementById('current-q').textContent = index + 1;
}

function hideQuestion(index) {
  const questionEl = document.getElementById(`question-${index}`);
  if (questionEl) {
    questionEl.classList.remove('active');
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
  const options = document.querySelectorAll(`#question-${questionIndex} .option`);
  options.forEach(opt => opt.classList.remove('selected'));
  
  const selectedOption = document.getElementById(`q${questionIndex}-opt${optionIndex}`);
  selectedOption.classList.add('selected');
  
  userAnswers[questionIndex] = optionIndex;
}

// Auto-save pour questions ouvertes
document.addEventListener('input', function(e) {
  if (e.target.classList.contains('response-textarea')) {
    const questionIndex = parseInt(e.target.dataset.questionIndex);
    userAnswers[questionIndex] = e.target.value;
  }
});

// Soumission
function submitQuiz() {
  const quiz = allQuizzes[currentQuizIndex];
  const questions = quiz.quiz?.questions || [];
  let correctAnswers = 0;
  
  // Afficher corrections
  questions.forEach((question, i) => {
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
  });
  
  // Afficher résultats
  const percentage = Math.round((correctAnswers / totalQuestions) * 100);
  document.getElementById('final-score').textContent = percentage + '%';
  document.getElementById('correct-count').textContent = correctAnswers;
  document.getElementById('incorrect-count').textContent = totalQuestions - correctAnswers;
  document.getElementById('total-count').textContent = totalQuestions;
  
  // Cacher navigation et afficher résultats
  document.getElementById('quiz-nav').style.display = 'none';
  document.getElementById('results').classList.add('show');
  
  // Scroll vers résultats
  document.getElementById('results').scrollIntoView({behavior: 'smooth'});
}

function restartQuiz() {
  if (currentQuizIndex >= 0) {
    // Reset état
    userAnswers = {};
    currentQuestion = 0;
    
    // Reset UI
    document.getElementById('results').classList.remove('show');
    document.getElementById('quiz-nav').style.display = 'flex';
    
    // Reset questions
    const questions = allQuizzes[currentQuizIndex].quiz?.questions || [];
    questions.forEach((question, i) => {
      const options = document.querySelectorAll(`#question-${i} .option`);
      options.forEach(opt => {
        opt.style.pointerEvents = 'auto';
        opt.classList.remove('selected', 'correct', 'incorrect');
      });
      
      const textarea = document.querySelector(`textarea[data-question-index="${i}"]`);
      if (textarea) {
        textarea.value = '';
      }
      
      const correctionEl = document.getElementById(`correction-${i}`);
      if (correctionEl) {
        correctionEl.classList.remove('show');
      }
    });
    
    showQuestion(0);
    updateNavigation();
  }
}

function backToSelection() {
  // Reset état
  currentQuizIndex = -1;
  currentQuestion = 0;
  userAnswers = {};
  
  // Cacher quiz et résultats
  document.getElementById('quiz-nav').classList.remove('show');
  document.getElementById('results').classList.remove('show');
  document.querySelector('.quiz-selector').style.display = 'block';
  
  // Reset cartes actives
  const cards = document.querySelectorAll('.quiz-card');
  cards.forEach(card => card.classList.remove('active'));
}

// Raccourcis clavier
document.addEventListener('keydown', function(e) {
  if (currentQuizIndex >= 0 && !document.getElementById('results').classList.contains('show')) {
    if (e.key === 'ArrowRight' && currentQuestion < totalQuestions - 1) {
      nextQuestion();
    } else if (e.key === 'ArrowLeft' && currentQuestion > 0) {
      previousQuestion();
    }
  }
});
</script>
</body>
</html>
"""

def create_multi_quiz_html(quiz_list: List[dict], output_file: str = "QUIZ_COLLECTION_INTERACTIVE.html") -> str:
    """
    Crée un HTML avec tous les quiz dans une seule interface
    
    Args:
        quiz_list: Liste des quiz générés
        output_file: Nom du fichier HTML à créer
        
    Returns:
        Chemin du fichier créé
    """
    
    # Préparer les données JS
    quiz_data_js = json.dumps(quiz_list, ensure_ascii=False, indent=2)
    
    # Remplir le template
    html = MULTI_QUIZ_HTML_TEMPLATE
    html = html.replace('__QUIZ_DATA__', quiz_data_js)
    html = html.replace('__TIMESTAMP__', datetime.now().strftime('%Y-%m-%d %H:%M'))
    
    # Sauvegarder
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(html)
    
    print(f"Visualiseur multi-quiz créé: {output_file}")
    return output_file


if __name__ == "__main__":
    # Test avec des quiz exemples
    test_quizzes = [
        {
            'config': {
                'matiere': 'arabe',
                'niveau': 1,
                'duree_minutes': 20
            },
            'quiz': {
                'questions': [
                    {
                        'type': 'qcm',
                        'question': 'ما هو صوت الحرف "ب"؟',
                        'options': ['بَا', 'بِي', 'بُو', 'بْ'],
                        'reponse_correcte': 0,
                        'explication': 'الحرف "ب" يُلفظ "بَا" بفتحة.'
                    }
                ]
            }
        },
        {
            'config': {
                'matiere': 'mathematique',
                'niveau': 1,
                'duree_minutes': 25
            },
            'quiz': {
                'questions': [
                    {
                        'type': 'qcm',
                        'question': 'كم يساوي 2 + 3؟',
                        'options': ['4', '5', '6', '7'],
                        'reponse_correcte': 1,
                        'explication': '2 + 3 = 5'
                    }
                ]
            }
        }
    ]
    
    create_multi_quiz_html(test_quizzes, "TEST_MULTI_QUIZ.html")
    print("\n🌐 Test créé: TEST_MULTI_QUIZ.html")