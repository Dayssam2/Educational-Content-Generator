TEMPLATE_HTML = """<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Quiz interactif — Espace élève</title>
<style>
  :root{
    --ink:#1a1f2e;
    --paper:#f4f6fb;
    --card:#ffffff;
    --line:#e3e7f0;
    --line-soft:#eef1f8;
    --ok:#1a9d63;
    --ok-bg:#e8f9f0;
    --ko:#e0483e;
    --ko-bg:#fdecea;
    --accent:#4d5bf9;
    --accent-dark:#3843d6;
    --accent-soft:#eef0ff;
    --muted:#6b7280;
    --radius-lg:18px;
    --radius-md:12px;
    --radius-sm:8px;
    --shadow-sm:0 1px 2px rgba(16,24,40,.04);
    --shadow-md:0 8px 24px rgba(16,24,40,.06);
  }
  *{box-sizing:border-box;}
  body{
    margin:0;
    background:
      radial-gradient(1200px 400px at 50% -10%, #eef0ff 0%, transparent 60%),
      var(--paper);
    color:var(--ink);
    font-family:"Inter","Segoe UI",system-ui,-apple-system,sans-serif;
    line-height:1.6;
    -webkit-font-smoothing:antialiased;
  }
  .wrap{max-width:920px;margin:0 auto;padding:48px 24px 96px;}

  header.top{
    background:var(--card);
    border:1px solid var(--line);
    border-radius:var(--radius-lg);
    box-shadow:var(--shadow-sm), var(--shadow-md);
    padding:28px 32px;
    margin-bottom:32px;
    display:flex;
    justify-content:space-between;
    align-items:center;
    gap:16px;
    flex-wrap:wrap;
  }
  header.top .eyebrow{
    display:inline-block;
    font-size:.72rem;
    font-weight:700;
    letter-spacing:.06em;
    text-transform:uppercase;
    color:var(--accent);
    background:var(--accent-soft);
    padding:4px 10px;
    border-radius:999px;
    margin-bottom:10px;
  }
  header.top h1{font-size:1.7rem;margin:0 0 6px;letter-spacing:-0.02em;font-weight:800;}
  header.top p{margin:0;color:var(--muted);font-size:.92rem;}
  .stamp{font-size:.78rem;color:var(--muted);text-align:right;white-space:nowrap;}

  .scenario{
    background:var(--card);
    border:1px solid var(--line);
    border-radius:var(--radius-lg);
    box-shadow:var(--shadow-sm);
    margin-bottom:20px;
    overflow:hidden;
    transition:box-shadow .15s ease;
  }
  .scenario.open{box-shadow:var(--shadow-sm), var(--shadow-md);}
  .scenario-head{
    display:flex;align-items:center;justify-content:space-between;gap:12px;
    padding:20px 24px;cursor:pointer;user-select:none;
    transition:background .12s ease;
  }
  .scenario-head:hover{background:var(--line-soft);}
  .scenario-head .titles h2{margin:0 0 4px;font-size:1.12rem;font-weight:700;letter-spacing:-0.01em;}
  .scenario-head .titles .sub{font-size:.84rem;color:var(--muted);}
  .badge{
    font-size:.72rem;font-weight:700;letter-spacing:.03em;text-transform:uppercase;
    padding:5px 12px;border-radius:999px;white-space:nowrap;
  }
  .badge.ok{background:var(--ok-bg);color:var(--ok);}
  .badge.ko{background:var(--ko-bg);color:var(--ko);}
  .chevron{font-size:.85rem;color:var(--muted);transition:transform .18s ease;margin-inline-start:4px;}
  .scenario.open .chevron{transform:rotate(90deg);}
  .scenario-body{display:none;padding:0 24px 26px;}
  .scenario.open .scenario-body{display:block;}

  .meta-row{
    display:flex;gap:10px;flex-wrap:wrap;font-size:.82rem;color:var(--muted);
    padding:16px 0 20px;margin-bottom:6px;border-bottom:1px solid var(--line-soft);
  }
  .meta-row span{
    background:var(--paper);border:1px solid var(--line-soft);
    padding:5px 12px;border-radius:999px;
  }
  .meta-row strong{color:var(--ink);font-weight:600;}

  .errors{
    background:var(--ko-bg);border-inline-start:3px solid var(--ko);
    border-radius:var(--radius-sm);
    padding:14px 16px;margin:16px 0;font-size:.9rem;
  }
  .errors ul{margin:6px 0 0;padding-inline-start:18px;}

  .qlist{list-style:none;margin:0;padding:0;counter-reset:q;}
  .qcard{
    counter-increment:q;
    border:1px solid var(--line);
    border-radius:var(--radius-md);
    background:var(--card);
    padding:20px 20px 20px 44px;
    margin-top:16px;
    position:relative;
    transition:border-color .12s ease;
  }
  [dir="rtl"] .qcard{padding:20px 44px 20px 20px;}
  .qcard::before{
    content:"Q" counter(q);
    position:absolute;top:20px;inset-inline-start:16px;
    background:var(--accent-soft);color:var(--accent);
    font-weight:700;font-size:.72rem;
    padding:3px 0;width:22px;text-align:center;border-radius:999px;
  }
  .qtype{
    display:inline-block;font-size:.68rem;font-weight:700;
    text-transform:uppercase;letter-spacing:.06em;color:var(--accent);
    background:var(--accent-soft);padding:3px 9px;border-radius:999px;margin-bottom:10px;
  }
  .qtext{font-size:1rem;margin:0 0 14px;font-weight:500;color:var(--ink);}

  .options{list-style:none;margin:0 0 4px;padding:0;display:grid;gap:8px;}
  .opt-btn{
    width:100%;text-align:start;padding:11px 14px;background:var(--paper);
    border:1px solid var(--line);border-radius:var(--radius-sm);font-size:.94rem;
    font-family:inherit;color:var(--ink);cursor:pointer;transition:all .12s ease;
  }
  .opt-btn:hover:not(:disabled){background:var(--accent-soft);border-color:var(--accent);}
  .opt-btn:disabled{cursor:default;}
  .opt-btn.correct{background:var(--ok-bg);border-color:var(--ok);font-weight:600;color:var(--ok);}
  .opt-btn.correct::after{content:" \2713";}
  .opt-btn.wrong{background:var(--ko-bg);border-color:var(--ko);color:var(--ko);}
  .opt-btn.wrong::after{content:" \2717";}

  .vf-row{display:flex;gap:10px;margin-bottom:6px;}
  .vf-btn{
    flex:1;padding:11px 14px;background:var(--paper);border:1px solid var(--line);
    border-radius:var(--radius-sm);font-family:inherit;font-size:.94rem;font-weight:600;
    cursor:pointer;color:var(--ink);transition:all .12s ease;
  }
  .vf-btn:hover:not(:disabled){background:var(--accent-soft);border-color:var(--accent);}
  .vf-btn:disabled{cursor:default;}
  .vf-btn.correct{background:var(--ok-bg);border-color:var(--ok);color:var(--ok);}
  .vf-btn.wrong{background:var(--ko-bg);border-color:var(--ko);color:var(--ko);}

  .trous-input{
    display:inline-block;width:130px;padding:5px 10px;margin:0 4px;
    border:1px solid var(--line);border-bottom:2px solid var(--accent);
    font-family:inherit;font-size:.94rem;background:#fff;border-radius:var(--radius-sm);
  }
  .trous-input.correct{background:var(--ok-bg);border-bottom-color:var(--ok);}
  .trous-input.wrong{background:var(--ko-bg);border-bottom-color:var(--ko);}
  .trous-input:disabled{color:var(--ink);opacity:1;}

  .verify-btn{
    margin-top:10px;padding:9px 20px;background:var(--accent);color:#fff;
    border:none;border-radius:var(--radius-sm);font-family:inherit;font-size:.85rem;
    font-weight:600;cursor:pointer;transition:background .12s ease;
  }
  .verify-btn:hover:not(:disabled){background:var(--accent-dark);}
  .verify-btn:disabled{opacity:.4;cursor:default;}

  .ouverte-box{
    width:100%;min-height:78px;padding:10px 12px;border:1px solid var(--line);
    border-radius:var(--radius-sm);font-family:inherit;font-size:.92rem;resize:vertical;margin-bottom:4px;
  }
  .ouverte-box:focus{outline:none;border-color:var(--accent);}
  .ouverte-box:disabled{background:var(--paper);}

  .vf-answer{display:inline-block;padding:5px 12px;border-radius:var(--radius-sm);font-size:.85rem;font-weight:600;}
  .vf-answer.true{background:var(--ok-bg);color:var(--ok);}
  .vf-answer.false{background:var(--ko-bg);color:var(--ko);}
  .trous-blank{background:#fff3d6;padding:1px 6px;border-radius:var(--radius-sm);font-weight:600;border:1px solid #e8c874;}
  .reponses-list{margin:8px 0 0;padding-inline-start:18px;font-size:.88rem;}

  .explication, .reponse-attendue, .correction-container{
    margin-top:14px;
    padding-top:14px;
    border-top:1px dashed var(--line);
    font-size:.88rem;
    color:var(--muted);
    display:none;
  }
  .explication.visible, .reponse-attendue.visible, .correction-container.visible{
    display:block;
  }
  .explication strong, .reponse-attendue strong, .correction-container strong{
    color:var(--ink);
  }
  .correction-container.correct{border-top-color:var(--ok);}
  .correction-container.wrong{border-top-color:var(--ko);}
  .correction-container .correct-answer{color:var(--ok);font-weight:700;}
  .correction-container .wrong-answer{color:var(--ko);font-weight:700;}

  [dir="rtl"]{text-align:right;}
  footer{text-align:center;font-size:.82rem;color:var(--muted);margin-top:40px;}

  ::-webkit-scrollbar{width:10px;height:10px;}
  ::-webkit-scrollbar-thumb{background:#c7cee0;border-radius:999px;}

  @media (max-width:600px){
    .wrap{padding:28px 16px 72px;}
    header.top{flex-direction:column;align-items:flex-start;padding:22px 20px;}
    .stamp{text-align:left;}
    .qcard{padding:18px 16px 18px 40px;}
  }
</style>
</head>
<body>
<div class="wrap">
  <header class="top">
    <div>
      <span class="eyebrow">Espace élève</span>
      <h1>Quiz interactif</h1>
      <p>Réponds d'abord, puis vérifie ta correction pour chaque question.</p>
    </div>
    <div class="stamp" id="stamp"></div>
  </header>
  <div id="scenarios"></div>
  <footer>Clique sur un scénario pour ouvrir l'examen, réponds aux questions puis vérifie tes réponses.</footer>
</div>

<script>
const DATA = __DATA_JSON__;

const TYPE_LABELS = {
  qcm: "QCM",
  vrai_faux: "Vrai / Faux",
  texte_a_trous: "Texte à trous",
  ouverte: "Question ouverte"
};

function esc(s){
  if (s === null || s === undefined) return "";
  return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
}

function renderQuestion(q, uid){
  const type = q.type;
  let html = `<li class="qcard"><span class="qtype">${TYPE_LABELS[type] || esc(type)}</span>`;

  if (type === "qcm"){
    html += `<p class="qtext">${esc(q.question)}</p><ul class="options">`;
    (q.options || []).forEach((opt, i) => {
      html += `<li><button type="button" class="opt-btn" id="${uid}-opt-${i}"
        onclick="checkQCM('${uid}', ${i})">${esc(opt)}</button></li>`;
    });
    html += `</ul>`;
    html += `<div class="correction-container" id="${uid}-correction"></div>`;
    if (q.explication){
      html += `<div class="explication" id="${uid}-expl"><strong>Explication — </strong>${esc(q.explication)}</div>`;
    }
  }

  else if (type === "vrai_faux"){
    html += `<p class="qtext">${esc(q.question)}</p>`;
    html += `<div class="vf-row">
      <button type="button" class="vf-btn" id="${uid}-vf-true" onclick="checkVF('${uid}', true)">Vrai</button>
      <button type="button" class="vf-btn" id="${uid}-vf-false" onclick="checkVF('${uid}', false)">Faux</button>
    </div>`;
    html += `<div class="correction-container" id="${uid}-correction"></div>`;
    if (q.explication){
      html += `<div class="explication" id="${uid}-expl"><strong>Explication — </strong>${esc(q.explication)}</div>`;
    }
  }

  else if (type === "texte_a_trous"){
    let i = 0;
    let texte = esc(q.texte || "");

    // Remplacer chaque "___" par un input avec un ID unique
    texte = texte.replace(/___/g, function() {
      const idx = i;
      i++;
      return `<input type="text" class="trous-input" id="${uid}-blank-${idx}" autocomplete="off" placeholder="...">`;
    });

    html += `<p class="qtext">${texte}</p>`;
    const reponses = q.reponse_correcte || [];

    // Ajouter le bouton avec un onclick correct
    html += `<button type="button" class="verify-btn" onclick="checkTrous('${uid}')">Vérifier mes réponses</button>`;
    html += `<div class="correction-container" id="${uid}-correction"></div>`;
    if (q.explication){
      html += `<div class="explication" id="${uid}-expl"><strong>Explication — </strong>${esc(q.explication)}</div>`;
    }
  }

  else if (type === "ouverte"){
    html += `<p class="qtext">${esc(q.question)}</p>`;
    html += `<textarea class="ouverte-box" id="${uid}-answer" placeholder="Écris ta réponse ici..."></textarea>`;
    html += `<br><button type="button" class="verify-btn" onclick="revealOuverte('${uid}')">Voir la correction</button>`;
    html += `<div class="correction-container" id="${uid}-correction"></div>`;
    if (q.explication){
      html += `<div class="explication" id="${uid}-expl"><strong>Explication — </strong>${esc(q.explication)}</div>`;
    }
  }

  else {
    html += `<pre style="white-space:pre-wrap;font-size:.8rem;">${esc(JSON.stringify(q, null, 2))}</pre>`;
  }

  html += `</li>`;
  return html;
}

function showCorrection(uid, isCorrect, message) {
  const container = document.getElementById(`${uid}-correction`);
  if (container) {
    container.innerHTML = message;
    container.classList.add("visible");
    container.classList.remove("correct", "wrong");
    container.classList.add(isCorrect ? "correct" : "wrong");
  }
}

function checkQCM(uid, chosenIndex){
  const q = window.__QDATA[uid];
  const btns = q.options.map((_, i) => document.getElementById(`${uid}-opt-${i}`));
  let isCorrect = false;

  // Nettoyer les textes pour comparaison
  const correctText = String(q.reponse_correcte).trim();

  btns.forEach((btn, i) => {
    btn.disabled = true;
    const btnText = String(q.options[i]).trim();

    if (btnText === correctText){
      btn.classList.add("correct");
      if (i === chosenIndex) isCorrect = true;
    } else if (i === chosenIndex){
      btn.classList.add("wrong");
    }
  });

  const message = isCorrect
    ? `<strong>Correct !</strong> La bonne réponse était : <span class="correct-answer">${esc(q.reponse_correcte)}</span>`
    : `<strong>Incorrect.</strong> La bonne réponse était : <span class="correct-answer">${esc(q.reponse_correcte)}</span>`;

  showCorrection(uid, isCorrect, message);

  const expl = document.getElementById(`${uid}-expl`);
  if (expl) expl.classList.add("visible");
}

function checkVF(uid, chosen){
  const q = window.__QDATA[uid];
  const trueBtn = document.getElementById(`${uid}-vf-true`);
  const falseBtn = document.getElementById(`${uid}-vf-false`);
  trueBtn.disabled = true;
  falseBtn.disabled = true;

  const correctBtn = q.reponse_correcte === true ? trueBtn : falseBtn;
  const chosenBtn = chosen === true ? trueBtn : falseBtn;
  const isCorrect = chosen === q.reponse_correcte;

  correctBtn.classList.add("correct");
  if (!isCorrect) chosenBtn.classList.add("wrong");

  const message = isCorrect
    ? `<strong>Correct !</strong> L'affirmation est bien <span class="correct-answer">${q.reponse_correcte ? "VRAIE" : "FAUSSE"}</span>.`
    : `<strong>Incorrect.</strong> L'affirmation est en réalité <span class="correct-answer">${q.reponse_correcte ? "VRAIE" : "FAUSSE"}</span>.`;

  showCorrection(uid, isCorrect, message);

  const expl = document.getElementById(`${uid}-expl`);
  if (expl) expl.classList.add("visible");
}

function normalize(s){
  return (s || "").toString().trim().toLowerCase();
}

function checkTrous(uid){
  // Récupérer la question depuis window.__QDATA
  const q = window.__QDATA[uid];
  if (!q) {
    console.error("Question not found for uid:", uid);
    return;
  }

  const reponses = q.reponse_correcte || [];
  console.log("Checking trous for", uid, "reponses:", reponses);

  let allCorrect = true;
  let userAnswers = [];
  let results = [];

  // Récupérer tous les champs de saisie
  for (let i = 0; i < reponses.length; i++) {
    const input = document.getElementById(`${uid}-blank-${i}`);
    console.log(`Looking for ${uid}-blank-${i}:`, input);

    if (!input) {
      console.error(`Input ${uid}-blank-${i} not found`);
      results.push({correct: false, expected: reponses[i] || "", user: "Champ non trouvé"});
      continue;
    }

    input.disabled = true;
    const userAnswer = input.value.trim();
    userAnswers.push(userAnswer);

    const expectedAnswer = reponses[i] || "";
    const isCorrect = normalize(userAnswer) === normalize(expectedAnswer);

    if (isCorrect){
      input.classList.add("correct");
      input.classList.remove("wrong");
    } else {
      input.classList.add("wrong");
      input.classList.remove("correct");
      allCorrect = false;
    }

    results.push({
      correct: isCorrect,
      expected: expectedAnswer,
      user: userAnswer
    });
  }

  // Désactiver le bouton
  const btn = document.querySelector(`#${uid}-verify`);
  if (btn) btn.disabled = true;

  // Construire le message de correction
  let message = '';
  if (allCorrect && results.length > 0) {
    message = `<strong>Parfait !</strong> Toutes les réponses sont correctes.`;
  } else {
    message = `<strong>Certaines réponses sont incorrectes.</strong><br><br>`;
    message += `<div style="display:grid;gap:6px;margin-top:4px;">`;
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const expected = esc(r.expected || "");
      const user = esc(r.user || "(vide)");
      const isCorrect = r.correct;

      message += `<div style="display:flex;gap:8px;align-items:center;padding:4px 8px;background:${isCorrect ? 'var(--ok-bg)' : 'var(--ko-bg)'};border-radius:6px;">`;
      message += `<span style="display:inline-block;width:24px;font-size:1.1rem;">${isCorrect ? '' : ''}</span>`;
      message += `<span style="flex:1;">`;
      message += `<strong>Trou ${i+1}:</strong> `;
      message += `<span style="font-weight:600;color:var(--ok);">${expected}</span>`;
      if (!isCorrect) {
        message += ` <span style="color:var(--muted);">(vous avez écrit:</span> <span style="font-weight:600;color:var(--ko);">${user}</span><span style="color:var(--muted);">)</span>`;
      }
      message += `</span>`;
      message += `</div>`;
    }
    message += `</div>`;
  }

  showCorrection(uid, allCorrect, message);

  const expl = document.getElementById(`${uid}-expl`);
  if (expl) expl.classList.add("visible");
}

function revealOuverte(uid){
  const q = window.__QDATA[uid];
  const box = document.getElementById(`${uid}-answer`);
  if (box) box.disabled = true;

  const btn = document.getElementById(`${uid}-verify`);
  if (btn) btn.disabled = true;

  const message = `<strong>Réponse attendue :</strong><br><span style="display:inline-block;margin-top:4px;color:var(--ink);">${esc(q.reponse_correcte)}</span>`;
  showCorrection(uid, true, message);

  const expl = document.getElementById(`${uid}-expl`);
  if (expl) expl.classList.add("visible");
}

function renderScenario(s, idx){
  const ok = s.succes;
  const examen = s.examen;
  const isRTL = examen && examen.langue === "ar";
  let body = "";

  if (examen){
    body += `<div class="meta-row">
      <span><strong>Matière :</strong> ${esc(examen.matiere)}</span>
      <span><strong>Niveau :</strong> ${esc(examen.niveau)}</span>
      <span><strong>Chapitres :</strong> ${esc(examen.chapitre)}</span>
      <span><strong>Durée :</strong> ${esc(examen.duree_estimee_minutes)} min</span>
      <span><strong>Questions :</strong> ${examen.questions.length}</span>
    </div>`;
  }

  if (!ok && s.erreurs && s.erreurs.length){
    body += `<div class="errors"><strong>Erreurs de validation :</strong>
      <ul>${s.erreurs.map(e => `<li>${esc(e)}</li>`).join("")}</ul>
    </div>`;
  }

  if (examen && examen.questions && examen.questions.length){
    body += `<ul class="qlist" ${isRTL ? 'dir="rtl"' : ""}>`;
    examen.questions.forEach((q, qi) => {
      const uid = `s${idx}-q${qi}`;
      window.__QDATA[uid] = q;
      body += renderQuestion(q, uid);
    });
    body += `</ul>`;
  } else if (!examen) {
    body += `<p style="color:var(--muted);">Aucun examen n'a pu être généré pour ce scénario.</p>`;
  }

  return `
  <section class="scenario" data-idx="${idx}">
    <div class="scenario-head" onclick="this.closest('.scenario').classList.toggle('open')">
      <div class="titles">
        <h2>Scénario ${s.scenario} — ${esc(s.matiere)}</h2>
        <div class="sub">${esc(s.niveau)} · tentative ${s.tentatives}</div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;">
        <span class="badge ${ok ? "ok" : "ko"}">${ok ? "RÉUSSI" : "ÉCHEC"}</span>
        <span class="chevron">▸</span>
      </div>
    </div>
    <div class="scenario-body">${body}</div>
  </section>`;
}

function render(){
  window.__QDATA = {};

  document.getElementById("scenarios").innerHTML = DATA.map((s, i) => renderScenario(s, i)).join("");
  document.getElementById("stamp").textContent = "Généré le " + new Date().toLocaleString("fr-FR");

  const first = document.querySelector(".scenario");
  if (first) first.classList.add("open");
}

render();
</script>
</body>
</html>
"""


# ============================================================================
# TEMPLATE HTML POUR EXAMENS GÉNÉRÉS AVEC RAG
# ============================================================================

TEMPLATE_EXAM_HTML = """<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>امتحان — النظام التونسي</title>
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
  }
  *{box-sizing:border-box;}
  body{
    margin:0;
    background:var(--paper);
    color:var(--ink);
    font-family:"Tahoma","Arial",sans-serif;
    line-height:1.8;
    font-size:17px;
  }
  .wrap{max-width:900px;margin:0 auto;padding:32px 24px 80px;}
  
  .header-official{
    text-align:center;
    border:3px solid var(--ink);
    padding:28px;
    margin-bottom:32px;
    background:var(--card);
  }
  .header-official h1{margin:0 0 8px;font-size:1.9rem;letter-spacing:-0.01em;}
  .header-official .meta{font-size:1.1rem;color:var(--muted);margin:4px 0;}
  .header-official .exam-info{
    margin-top:18px;padding-top:18px;border-top:2px solid var(--line);
    display:flex;justify-content:space-around;gap:16px;flex-wrap:wrap;
  }
  .header-official .exam-info .info-item{font-size:1.05rem;}
  .header-official .exam-info .info-item strong{color:var(--ink);}
  
  .preamble{
    text-align:center;font-size:1.15rem;margin-bottom:28px;
    padding:18px;background:var(--primary-bg);border-radius:4px;
  }
  
  .exam-container{
    background:var(--card);border:1px solid var(--line);
    padding:36px;margin-bottom:24px;
    box-shadow:0 2px 8px rgba(0,0,0,0.05);
  }
  
  .exam-content{
    white-space:pre-wrap;
    font-family:"Tahoma","Arial",sans-serif;
    line-height:2;
    font-size:1.05rem;
  }
  
  .rag-meta{
    background:#fff9e6;border-right:3px solid var(--accent);
    padding:14px 18px;margin-top:28px;font-size:0.9rem;
    border-radius:4px;
  }
  .rag-meta strong{color:var(--accent);}
  
  footer{
    text-align:center;font-size:0.85rem;color:var(--muted);
    margin-top:48px;padding-top:24px;border-top:1px solid var(--line);
  }
  
  @media print{
    body{background:#fff;}
    .wrap{padding:0;}
    .rag-meta{display:none;}
    .exam-container{border:none;box-shadow:none;}
  }
  
  [dir="rtl"]{text-align:right;}
  [dir="rtl"] .rag-meta{border-right:none;border-left:3px solid var(--accent);}
</style>
</head>
<body>
<div class="wrap">
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
  
  <div class="preamble">
    📝 اقرأ الأسئلة بعناية وأجب عليها بدقة
  </div>
  
  <div class="exam-container">
    <div class="exam-content">__EXAM_CONTENT__</div>
  </div>
  
  <div class="rag-meta">
    <strong>📚 مصادر البرنامج الرسمي:</strong> __SOURCES__<br>
    <strong>📊 عدد المقاطع المستخدمة:</strong> __CHUNKS__ chunks من قاعدة البيانات<br>
    <strong>🤖 مولد بواسطة:</strong> نظام RAG + Gemini AI
  </div>
  
  <footer>
    تم إنشاؤه بواسطة مولد الامتحانات التونسي • __TIMESTAMP__
  </footer>
</div>
</body>
</html>
"""


def generate_exam_html(exam_data: dict, output_file: str = None) -> str:
    """
    Génère un HTML pour afficher un examen
    
    Args:
        exam_data: Dict avec 'config', 'exam', 'sources', 'nb_chunks_used'
        output_file: Nom du fichier HTML à créer
    
    Returns:
        Chemin du fichier HTML créé
    """
    from datetime import datetime
    from pathlib import Path
    
    config = exam_data.get('config', {})
    exam = exam_data.get('exam', {})
    sources = exam_data.get('sources', [])
    chunks = exam_data.get('nb_chunks_used', 0)
    
    # Extraire infos
    matiere = config.get('matiere', 'mathematique')
    niveau = config.get('niveau', 1)
    type_exam = config.get('type_exam', 'controle')
    duree = config.get('duree_minutes', 60)
    
    # Mappings
    type_mapping = {
        'controle': 'مراقبة',
        'examen': 'امتحان',
        'devoir': 'فرض'
    }
    type_ar = type_mapping.get(type_exam, type_exam)
    
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
    
    niveau_ar = f"السنة {niveau} ابتدائي"
    
    # Contenu
    exam_content = exam.get('contenu', str(exam))
    
    # Sources
    sources_str = ', '.join(sources) if sources else 'البرنامج الرسمي'
    
    # Remplir template
    html = TEMPLATE_EXAM_HTML
    html = html.replace('__SCHOOL__', 'المدرسة الابتدائية: .....................')
    html = html.replace('__MATIERE__', matiere_ar)
    html = html.replace('__NIVEAU__', niveau_ar)
    html = html.replace('__TYPE__', type_ar)
    html = html.replace('__DUREE__', str(duree))
    html = html.replace('__EXAM_CONTENT__', exam_content)
    html = html.replace('__SOURCES__', sources_str)
    html = html.replace('__CHUNKS__', str(chunks))
    html = html.replace('__TIMESTAMP__', datetime.now().strftime('%Y-%m-%d %H:%M'))
    
    # Nom fichier
    if output_file is None:
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        output_file = f"exam_{matiere}_niveau{niveau}_{timestamp}.html"
    
    # Sauvegarder
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(html)
    
    abs_path = Path(output_file).absolute()
    print(f"✅ HTML créé: {output_file}")
    print(f"🌐 Ouvre dans le navigateur: {abs_path}")
    
    return str(abs_path)


# ============================================================================
# EXEMPLE D'UTILISATION
# ============================================================================

if __name__ == "__main__":
    import json
    from pathlib import Path
    
    # Test avec examen généré
    test_file = "test_exam_math1.json"
    
    if Path(test_file).exists():
        print("📄 Lecture de l'examen...")
        with open(test_file, 'r', encoding='utf-8') as f:
            exam_data = json.load(f)
        
        print("\n🎨 Génération du HTML...")
        html_file = generate_exam_html(exam_data)
        
        print(f"\n✅ Terminé ! Ouvre {html_file} dans ton navigateur")
    else:
        print(f"❌ Fichier {test_file} introuvable")
        print("💡 Génère d'abord un examen avec: python test_generator_simple.py")