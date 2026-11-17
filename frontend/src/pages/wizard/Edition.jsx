import { useState, useEffect, useMemo, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Pencil, Copy, Trash2, Plus, Loader2, AlertTriangle, Check,
  ListChecks, ArrowRight, FileEdit, Search, X,
  ArrowUp, ArrowDown, Filter, Eye, AlertCircle,
  Sparkles, GripVertical, ChevronDown,
} from 'lucide-react'
import WizardShell from '../../components/WizardShell.jsx'
import { useWizard } from '../../context/WizardContext.jsx'


const TYPE_LABEL = {
  qcm: 'QCM',
  vrai_faux: 'Vrai / Faux',
  ouverte: 'Ouverte',
  texte_trous: 'Texte à trous',
  calcul: 'Calcul',
  legende: 'Légende',
  association: 'Association',
  remise_en_ordre: 'Remise en ordre',
  tri: 'Tri',
  dictee: 'Dictée',
  redaction: 'Rédaction',
}

const TYPE_COLOR = {
  qcm: { bg: 'bg-[#0f172a]/[0.08]', text: 'text-[#0f172a]' },
  vrai_faux: { bg: 'bg-[#7a0008]/[0.08]', text: 'text-[#7a0008]' },
  ouverte: { bg: 'bg-emerald-500/[0.10]', text: 'text-emerald-700' },
  texte_trous: { bg: 'bg-amber-500/[0.10]', text: 'text-amber-700' },
}
const TYPE_COLOR_DEFAUT = { bg: 'bg-[#0f172a]/[0.06]', text: 'text-[#0f172a]/70' }

function labelType(t) {
  return TYPE_LABEL[t] || t || 'Question'
}

const WIZARD_STEPS = [
  { n: 1, label: 'Sélection' },
  { n: 2, label: 'Édition' },
  { n: 3, label: 'Validation' },
  { n: 4, label: 'Export' },
]
const CURRENT_STEP = 2

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f172a]/35 focus-visible:ring-offset-2'
const HOVER_LIFT = 'motion-reduce:transition-none motion-reduce:hover:translate-y-0'

const ACTION_BTN = 'flex h-8 w-8 items-center justify-center rounded-full text-[#0f172a]/50 transition-all hover:bg-[#0f172a]/[0.08] hover:text-[#0f172a] disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-[#0f172a]/50'
const ACTION_BTN_DANGER = 'flex h-8 w-8 items-center justify-center rounded-full text-[#0f172a]/50 transition-all hover:bg-red-50 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed'

const INPUT_REPONSE = `w-full rounded-[12px] border-2 border-dashed border-[#0f172a]/25 px-3.5 py-2.5 text-[13.5px] text-[#0f172a]/80 outline-none transition-colors placeholder:text-[#0f172a]/35 focus:border-[#7a0008]/50 focus:text-[#0f172a] ${FOCUS_RING}`


function texteRempli(v) {
  return v != null && String(v).trim() !== ''
}

function questionComplete(q) {
  if (!texteRempli(q.question)) return false
  switch (q.type) {
    case 'qcm':
      return Array.isArray(q.options)
        && q.options.length >= 2
        && q.options.every(texteRempli)
        && q.reponseCorrecteIndex != null
        && q.reponseCorrecteIndex >= 0
        && q.reponseCorrecteIndex < q.options.length
    case 'vrai_faux':
      return q.reponseCorrecte === true || q.reponseCorrecte === false
    case 'ouverte':
    case 'texte_trous':
    case 'calcul':
      return texteRempli(q.reponseAttendue)
    case 'legende':
      return Array.isArray(q.reponseCorrecte) && q.reponseCorrecte.length > 0 && q.reponseCorrecte.every(texteRempli)
    case 'dictee':
      return texteRempli(q.texte_dictee)
    case 'association':
      return Array.isArray(q.colonne_gauche) && q.colonne_gauche.length > 0
        && Array.isArray(q.reponseCorrecte) && q.reponseCorrecte.length === q.colonne_gauche.length
    case 'tri':
      return Array.isArray(q.elements) && q.elements.length > 0
        && Array.isArray(q.reponseCorrecte) && q.reponseCorrecte.length === q.elements.length
    default:
      return true
  }
}


export default function Edition() {
  const navigate = useNavigate()
  const {
    examen,
    updateQuestion,
    removeQuestion,
    duplicateQuestion,
    addQuestion,
    sauvegarderQuestions,
    loading,
    error,
  } = useWizard()

  const questions = examen.questions || []
  const [selected, setSelected] = useState(questions[0]?.id)

  const [recherche, setRecherche] = useState('')
  const [filtreType, setFiltreType] = useState('all')
  const [filtreOuvert, setFiltreOuvert] = useState(false)
  const [showApercu, setShowApercu] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [questionASupprimer, setQuestionASupprimer] = useState(null)
  const filtreRef = useRef(null)

  const totalPoints = questions.reduce((sum, q) => sum + (Number(q.points) || 0), 0)

  const questionsIncompletes = useMemo(
    () => questions.filter((q) => !questionComplete(q)),
    [questions]
  )

  const questionsFiltrees = useMemo(() => {
    const r = recherche.trim().toLowerCase()
    return questions.filter((question, i) => {
      const matchRecherche = !r
        || question.question?.toLowerCase().includes(r)
        || `q${i + 1}`.includes(r)
        || String(i + 1).includes(r)
      const matchType = filtreType === 'all' || question.type === filtreType
      return matchRecherche && matchType
    })
  }, [questions, recherche, filtreType])

  const typesDispo = [...new Set(questions.map((q) => q.type))]

  useEffect(() => {
    if (!questions.some((q) => q.id === selected)) setSelected(questions[0]?.id)
  }, [questions, selected])

  useEffect(() => {
    if (!filtreOuvert) return
    function handleClick(e) {
      if (filtreRef.current && !filtreRef.current.contains(e.target)) setFiltreOuvert(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [filtreOuvert])

  useEffect(() => {
    function handleKeyDown(e) {
      if (questionASupprimer || showApercu || showShortcuts) {
        if (e.key === '?' && showShortcuts && !e.target.matches('input, textarea')) setShowShortcuts(false)
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        sauvegarderQuestions().catch(() => {})
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'd' && selected) {
        e.preventDefault()
        duplicateQuestion(selected)
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        handleVerifier()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        document.getElementById('search-input')?.focus()
      }
      if (e.key === '?' && !e.target.matches('input, textarea')) {
        setShowShortcuts(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

  function scrollTo(id) {
    setSelected(id)
    document.getElementById(`question-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  function handleAjouter() {
    setRecherche('')
    setFiltreType('all')
    const id = addQuestion()
    if (id) requestAnimationFrame(() => scrollTo(id))
  }

  function handleSupprimer(id) {
    const index = questions.findIndex((x) => x.id === id)
    if (index !== -1) setQuestionASupprimer({ id, index, question: questions[index] })
  }

  function confirmerSuppression() {
    if (!questionASupprimer) return
    removeQuestion(questionASupprimer.id)
    setQuestionASupprimer(null)
  }

  function echanger(indexA, indexB) {
    const a = questions[indexA]
    const b = questions[indexB]
    if (!a || !b) return
    const { id: _idA, ...contenuA } = a
    const { id: _idB, ...contenuB } = b
    updateQuestion(a.id, contenuB)
    updateQuestion(b.id, contenuA)
    setSelected(b.id)
  }

  function handleMonter(id) {
    const idx = questions.findIndex((q) => q.id === id)
    if (idx > 0) echanger(idx, idx - 1)
  }

  function handleDescendre(id) {
    const idx = questions.findIndex((q) => q.id === id)
    if (idx !== -1 && idx < questions.length - 1) echanger(idx, idx + 1)
  }

  async function handleVerifier() {
    if (loading) return
    try {
      await sauvegarderQuestions()
      navigate('/wizard/validation')
    } catch {
    }
  }

  
  if (!examen.id) {
    return (
      <WizardShell step={2} hideStepper>
        <div className="mx-auto max-w-lg py-14 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#7a0008]/[0.08] text-[#7a0008]">
            <FileEdit size={22} />
          </div>
          <h1 className="examai-serif text-[20px] font-semibold text-[#0f172a]">Aucun examen en cours</h1>
          <p className="mt-2 text-[13.5px] font-bold italic text-[#0f172a]/55">
            Retournez à l'étape 1 pour générer un examen avant de pouvoir le modifier ici.
          </p>
          <Link
            to="/wizard/selection"
            className={`mt-5 inline-flex items-center gap-2 rounded-full bg-[#7a0008] px-6 py-3 text-[13.5px] font-semibold text-white shadow-[0_1px_2px_rgba(15,23,42,0.2),0_10px_22px_-8px_rgba(122,0,8,0.5)] transition-all hover:-translate-y-0.5 active:scale-[0.985] ${FOCUS_RING}`}
          >
            Aller à la sélection <ArrowRight size={15} />
          </Link>
        </div>
      </WizardShell>
    )
  }

  return (
    <WizardShell step={2} hideStepper>
      <style>{`
        .examai-underline-wave {
          background-color: rgba(122,0,8,0.12);
          background-repeat: no-repeat;
          background-size: 100% 0.35em;
          background-position: 0 88%;
          padding: 0 0.15em;
        }
        @keyframes examaiModalFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes examaiModalSlideUp {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      <div className="w-full max-w-full overflow-x-hidden">

        {}
        <div className="relative mb-6 w-full overflow-hidden rounded-[28px] border border-[#0f172a]/20 bg-white p-6 sm:p-8">
          <h1 className="examai-serif text-[30px] sm:text-[40px] lg:text-[42px] font-semibold tracking-[-0.025em] text-[#0f172a] leading-[1.15]">
            Modifier{' '}
            <span className="text-[#7a0008] relative">
              <span className="examai-underline-wave">L'examen.</span>
            </span>
          </h1>
          <p className="examai-serif mt-3 text-[14px] sm:text-[15px] font-normal italic leading-[1.6] text-[#0f172a]/75">
            Ajustez les questions, les réponses et le barème avant de passer à la validation.
          </p>
        </div>

        {}
        {error && (
          <div role="alert" className="mb-5 flex items-start gap-3 rounded-[16px] border border-[#7a0008]/40 bg-[#0f172a]/[0.035] p-4 text-[13px] text-[#0f172a]">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#7a0008]/10">
              <AlertTriangle size={14} className="text-[#7a0008]" />
            </span>
            <span className="min-w-0 break-words pt-0.5 font-medium">{error}</span>
          </div>
        )}

        {}
        {questionsIncompletes.length > 0 && (
          <div className="mb-5 flex items-start gap-3 rounded-[16px] border border-amber-300 bg-amber-50/70 p-4 text-[13px] text-amber-900">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-200">
              <AlertCircle size={14} className="text-amber-700" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-bold">
                {questionsIncompletes.length} question{questionsIncompletes.length > 1 ? 's' : ''} incomplète{questionsIncompletes.length > 1 ? 's' : ''}
              </p>
              <p className="mt-0.5 text-[12px] font-bold italic text-amber-800/80">
                Vérifiez l'énoncé, les options et la bonne réponse avant de valider.
              </p>
            </div>
          </div>
        )}

        {}
        <div className="mb-5 flex items-center rounded-[20px] border border-[#0f172a]/20 bg-white px-5 py-4" role="list" aria-label="Étapes de création de l'examen">
          {WIZARD_STEPS.map((s, i) => {
            const active = s.n === CURRENT_STEP
            const done = s.n < CURRENT_STEP
            return (
              <div key={s.n} role="listitem" className="flex flex-1 items-center last:flex-none">
                <div className="flex items-center gap-2.5">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-bold transition-colors ${
                    active
                      ? 'bg-[#7a0008] text-white shadow-[0_6px_14px_-4px_rgba(122,0,8,0.5)]'
                      : done
                        ? 'bg-[#7a0008]/10 text-[#7a0008]'
                        : 'bg-[#0f172a]/[0.06] text-[#0f172a]/40'
                  }`}>
                    {done ? <Check size={14} strokeWidth={3} /> : s.n}
                  </span>
                  <span className={`whitespace-nowrap text-[13px] font-semibold ${
                    active ? 'text-[#7a0008]' : done ? 'text-[#0f172a]/70' : 'text-[#0f172a]/40'
                  }`}>{s.label}</span>
                </div>
                {i < WIZARD_STEPS.length - 1 && (
                  <span className={`mx-3 h-px flex-1 rounded-full ${done ? 'bg-[#7a0008]/25' : 'bg-[#0f172a]/10'}`} />
                )}
              </div>
            )
          })}
        </div>

        {}
        <div className="grid gap-5 lg:grid-cols-[280px_1fr] lg:items-start">

          {}
          <aside className="h-fit rounded-[24px] border border-[#0f172a]/20 bg-white p-4 lg:sticky lg:top-6">
            <div className="mb-3 flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[#7a0008]/[0.08] text-[#7a0008]">
                <ListChecks size={15} />
              </span>
              <p className="examai-serif text-[14.5px] font-semibold text-[#0f172a]">
                Questions <span className="text-[#7a0008]/60">({questions.length})</span>
              </p>
            </div>

            <div className="relative mb-2">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#0f172a]" strokeWidth={2.4} />
              <input
                id="search-input"
                type="text"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                placeholder="Rechercher… (Ctrl+K)"
                aria-label="Rechercher une question"
                className={`w-full rounded-[12px] border-2 border-[#0f172a] bg-white py-2 pl-9 pr-8 text-[12.5px] text-[#0f172a] placeholder:text-[#0f172a]/40 focus:outline-none focus:shadow-[0_0_0_4px_rgba(15,23,42,0.15)] ${FOCUS_RING}`}
              />
              {recherche && (
                <button
                  type="button"
                  onClick={() => setRecherche('')}
                  aria-label="Effacer"
                  className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-[#0f172a] hover:bg-[#0f172a]/[0.10]"
                >
                  <X size={11} strokeWidth={2.6} />
                </button>
              )}
            </div>

            <div ref={filtreRef} className="relative mb-3">
              <button
                type="button"
                onClick={() => setFiltreOuvert((v) => !v)}
                className={`flex w-full items-center justify-between gap-2 rounded-[12px] border border-[#0f172a]/20 bg-white px-3 py-2 text-[12.5px] font-semibold text-[#0f172a]/80 transition-all hover:border-[#0f172a]/40 ${FOCUS_RING}`}
              >
                <span className="flex items-center gap-2">
                  <Filter size={12} strokeWidth={2.4} />
                  {filtreType === 'all' ? 'Tous les types' : labelType(filtreType)}
                </span>
                <ChevronDown size={12} className={`transition-transform ${filtreOuvert ? 'rotate-180' : ''}`} />
              </button>

              {filtreOuvert && (
                <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-[14px] border border-[#0f172a]/20 bg-white shadow-[0_16px_32px_-12px_rgba(15,23,42,0.25)]">
                  <div className="p-1.5">
                    {['all', ...typesDispo].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => { setFiltreType(t); setFiltreOuvert(false) }}
                        className={`flex w-full items-center justify-between rounded-[10px] px-2.5 py-2 text-left text-[12px] font-semibold transition-colors ${
                          filtreType === t ? 'bg-[#0f172a]/[0.08] text-[#0f172a]' : 'text-[#0f172a]/70 hover:bg-[#0f172a]/[0.04]'
                        }`}
                      >
                        {t === 'all' ? 'Tous les types' : labelType(t)}
                        {filtreType === t && <Check size={12} strokeWidth={3} />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {questions.length === 0 ? (
              <p className="rounded-[14px] border border-dashed border-[#7a0008]/25 bg-[#0f172a]/[0.03] px-3 py-4 text-center text-[12px] font-bold italic text-[#0f172a]/50">
                Aucune question pour l'instant
              </p>
            ) : questionsFiltrees.length === 0 ? (
              <p className="rounded-[14px] border border-dashed border-[#0f172a]/25 bg-[#0f172a]/[0.03] px-3 py-4 text-center text-[12px] font-bold italic text-[#0f172a]/50">
                Aucun résultat
              </p>
            ) : (
              <ul className="max-h-[400px] space-y-1 overflow-y-auto pr-1">
                {questionsFiltrees.map((q) => {
                  const realIndex = questions.findIndex((x) => x.id === q.id)
                  const active = selected === q.id
                  const complete = questionComplete(q)
                  const tc = TYPE_COLOR[q.type] || TYPE_COLOR_DEFAUT
                  return (
                    <li key={q.id}>
                      <button
                        onClick={() => scrollTo(q.id)}
                        className={`flex w-full items-center justify-between gap-2 rounded-[12px] px-3 py-2 text-left text-[13px] transition-colors ${FOCUS_RING} ${
                          active
                            ? 'bg-[#7a0008]/[0.08] font-bold text-[#7a0008]'
                            : 'text-[#0f172a]/60 hover:bg-[#0f172a]/[0.05] hover:text-[#0f172a]'
                        }`}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                            active ? 'bg-[#7a0008] text-white' : 'bg-[#0f172a]/[0.08] text-[#0f172a]/60'
                          }`}>{realIndex + 1}</span>
                          <span className="max-w-[120px] truncate">
                            {q.question?.trim() || `Question ${realIndex + 1}`}
                          </span>
                        </span>
                        <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9.5px] font-bold ${complete ? `${tc.bg} ${tc.text}` : 'bg-amber-100 text-amber-800'}`}>
                          {complete ? labelType(q.type) : '⚠'}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}

            <button
              type="button"
              onClick={() => setShowShortcuts(true)}
              className={`mt-3 flex w-full items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-[#0f172a]/40 bg-white py-2 text-[11px] font-bold text-[#0f172a] transition-colors hover:border-[#0f172a] hover:bg-[#0f172a]/[0.04] ${FOCUS_RING}`}
            >
              <Sparkles size={11} strokeWidth={2.4} />
              Raccourcis clavier ( ? )
            </button>
          </aside>

          {}
          <div className="min-w-0 space-y-4">
            {questionsFiltrees.length === 0 && questions.length > 0 ? (
              <div className="rounded-[20px] border border-dashed border-[#0f172a]/25 bg-white py-14 text-center">
                <p className="text-[13.5px] font-bold italic text-[#0f172a]/50">
                  Aucune question ne correspond à votre recherche
                </p>
              </div>
            ) : (
              questionsFiltrees.map((q) => {
                const realIndex = questions.findIndex((x) => x.id === q.id)
                return (
                  <QuestionCard
                    key={q.id}
                    index={realIndex}
                    question={q}
                    onChange={(patch) => updateQuestion(q.id, patch)}
                    onDuplicate={() => duplicateQuestion(q.id)}
                    onDelete={() => handleSupprimer(q.id)}
                    onUp={() => handleMonter(q.id)}
                    onDown={() => handleDescendre(q.id)}
                    canUp={realIndex > 0}
                    canDown={realIndex < questions.length - 1}
                    onFocus={() => setSelected(q.id)}
                  />
                )
              })
            )}

            <button
              onClick={handleAjouter}
              className={`flex w-full items-center justify-center gap-2 rounded-[16px] border-2 border-dashed border-[#0f172a]/30 bg-white py-3.5 text-[13.5px] font-bold text-[#0f172a]/60 transition-all hover:-translate-y-0.5 hover:border-[#0f172a]/60 hover:text-[#0f172a] ${FOCUS_RING} ${HOVER_LIFT}`}
            >
              <Plus size={16} strokeWidth={2.4} /> Ajouter une question
            </button>
          </div>
        </div>

        {}
        <div className="sticky bottom-4 z-20 mt-5 w-full">
          <div className="w-full overflow-hidden rounded-[20px] border border-[#0f172a]/20 bg-white shadow-[0_14px_32px_-14px_rgba(15,23,42,0.25)]">
            <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2 text-[12px] text-[#0f172a]/60">
                <span className="flex items-center gap-1.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0f172a]/[0.08] text-[10px] font-bold text-[#0f172a]">
                    {questions.length}
                  </span>
                  question{questions.length > 1 ? 's' : ''}
                </span>
                <span className="h-3 w-px bg-[#0f172a]/15" />
                <span className="flex items-center gap-1.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#7a0008]/[0.08] text-[10px] font-bold text-[#7a0008]">
                    {totalPoints}
                  </span>
                  point{totalPoints > 1 ? 's' : ''}
                </span>
                {questionsIncompletes.length > 0 && (
                  <>
                    <span className="h-3 w-px bg-[#0f172a]/15" />
                    <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10.5px] font-bold text-amber-800">
                      <AlertCircle size={10} />
                      {questionsIncompletes.length} incomplète{questionsIncompletes.length > 1 ? 's' : ''}
                    </span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowApercu(true)}
                  className={`flex items-center gap-1.5 rounded-full border-2 border-[#7a0008]/30 bg-white px-3.5 py-2 text-[12px] font-semibold text-[#7a0008] transition-all hover:-translate-y-0.5 hover:border-[#7a0008] hover:bg-[#7a0008]/[0.04] ${FOCUS_RING} ${HOVER_LIFT}`}
                >
                  <Eye size={13} strokeWidth={2.2} />
                  Aperçu
                </button>

                <button
                  onClick={handleVerifier}
                  disabled={loading || questions.length === 0}
                  className={`group relative flex shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-full bg-[#7a0008] px-5 py-2.5 text-[12.5px] font-semibold text-white shadow-[0_1px_2px_rgba(15,23,42,0.2),0_10px_22px_-10px_rgba(122,0,8,0.55),inset_0_1px_0_rgba(255,255,255,0.15)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#961014] active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${FOCUS_RING}`}
                >
                  {loading ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Enregistrement…</span>
                    </>
                  ) : (
                    <>
                      <span>Vérifier l'examen</span>
                      <ArrowRight size={14} strokeWidth={2.4} className="transition-transform duration-200 group-hover:translate-x-1 motion-reduce:group-hover:translate-x-0" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}

      {showApercu && (
        <ApercuModal questions={questions} totalPoints={totalPoints} onClose={() => setShowApercu(false)} />
      )}

      {questionASupprimer && (
        <DeleteConfirmModal
          question={questionASupprimer.question}
          index={questionASupprimer.index}
          onCancel={() => setQuestionASupprimer(null)}
          onConfirm={confirmerSuppression}
        />
      )}
    </WizardShell>
  )
}


function QuestionCard({ index, question, onChange, onDuplicate, onDelete, onUp, onDown, canUp, canDown, onFocus }) {
  const complete = questionComplete(question)
  return (
    <div
      id={`question-${question.id}`}
      onFocusCapture={onFocus}
      className={`group rounded-[20px] border-2 bg-white p-5 transition-colors ${
        complete ? 'border-[#0f172a]/20' : 'border-amber-300'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-[12px] font-medium text-[#0f172a]/55">
          <span className="flex items-center gap-1.5 rounded-full bg-[#7a0008]/[0.08] px-2.5 py-1 font-semibold text-[#7a0008]">
            <GripVertical size={11} className="opacity-40" />
            Q{index + 1}
          </span>
          <span className="rounded-full border border-[#0f172a]/15 px-2.5 py-1 text-[#0f172a]/70">
            {labelType(question.type)}
          </span>
          <label className="flex items-center gap-1.5 rounded-full border border-[#0f172a]/15 px-2.5 py-1">
            <input
              type="number"
              min={0}
              step={0.5}
              value={question.points ?? 0}
              onChange={(e) => onChange({ points: Math.max(0, Number(e.target.value) || 0) })}
              aria-label={`Points pour la question ${index + 1}`}
              className="w-9 border-none bg-transparent text-center text-[12px] font-semibold text-[#0f172a] outline-none"
            />
            <span className="text-[#0f172a]/50">pts</span>
          </label>
          {!complete && (
            <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-800">
              <AlertCircle size={10} />
              Incomplète
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1 opacity-60 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <button type="button" onClick={onUp} disabled={!canUp} aria-label="Monter la question" title="Monter" className={`${ACTION_BTN} ${FOCUS_RING}`}>
            <ArrowUp size={14} strokeWidth={2.2} />
          </button>
          <button type="button" onClick={onDown} disabled={!canDown} aria-label="Descendre la question" title="Descendre" className={`${ACTION_BTN} ${FOCUS_RING}`}>
            <ArrowDown size={14} strokeWidth={2.2} />
          </button>
          <button type="button" onClick={onDuplicate} aria-label="Dupliquer" title="Dupliquer" className={`${ACTION_BTN} ${FOCUS_RING}`}>
            <Copy size={14} strokeWidth={2.2} />
          </button>
          <button type="button" onClick={onDelete} aria-label="Supprimer" title="Supprimer" className={`${ACTION_BTN_DANGER} ${FOCUS_RING}`}>
            <Trash2 size={14} strokeWidth={2.2} />
          </button>
        </div>
      </div>

      <div className="relative mt-3.5">
        <Pencil size={12} className="pointer-events-none absolute left-3.5 top-3.5 text-[#0f172a]/40" aria-hidden="true" />
        <textarea
          rows={2}
          value={question.question || ''}
          onChange={(e) => onChange({ question: e.target.value })}
          placeholder="Énoncé de la question"
          aria-label={`Énoncé de la question ${index + 1}`}
          className={`w-full resize-y rounded-[12px] border border-[#0f172a]/20 bg-white py-2.5 pl-9 pr-3.5 text-[14px] font-medium text-[#0f172a] outline-none transition-all placeholder:font-normal placeholder:text-[#0f172a]/35 focus:border-[#0f172a]/50 focus:shadow-[0_0_0_4px_rgba(15,23,42,0.10)] ${FOCUS_RING}`}
        />
      </div>

      {question.support != null && (
        <textarea
          rows={3}
          value={question.support || ''}
          onChange={(e) => onChange({ support: e.target.value })}
          placeholder="Texte support (optionnel)"
          aria-label="Texte support"
          className={`mt-2 w-full resize-y rounded-[12px] border border-[#0f172a]/15 bg-[#0f172a]/[0.02] px-3.5 py-2.5 text-[13px] italic text-[#0f172a]/80 outline-none focus:border-[#0f172a]/40 ${FOCUS_RING}`}
        />
      )}

      <div className="mt-3.5">
        <EditeurReponse question={question} onChange={onChange} index={index} />
      </div>
    </div>
  )
}


function EditeurReponse({ question: q, onChange, index }) {
  switch (q.type) {
    case 'qcm': {
      const options = Array.isArray(q.options) ? q.options : []
      return (
        <div>
          <div className="grid gap-2 sm:grid-cols-2">
            {options.map((opt, i) => {
              const correct = q.reponseCorrecteIndex === i
              return (
                <div
                  key={i}
                  className={`flex items-center gap-2.5 rounded-[12px] border px-3 py-2 text-[13px] transition-colors ${
                    correct ? 'border-[#2f855a]/40 bg-[#2f855a]/[0.05]' : 'border-[#0f172a]/15 hover:border-[#0f172a]/30'
                  }`}
                >
                  <input
                    type="radio"
                    name={`${q.id}-correct`}
                    checked={correct}
                    onChange={() => onChange({ reponseCorrecteIndex: i })}
                    aria-label={`Marquer l'option ${i + 1} comme bonne réponse`}
                    className="h-4 w-4 shrink-0 border-[#0f172a]/30 text-[#2f855a] focus:ring-[#2f855a]/30"
                  />
                  <input
                    value={opt || ''}
                    onChange={(e) => {
                      const next = [...options]
                      next[i] = e.target.value
                      onChange({ options: next })
                    }}
                    placeholder={`Option ${i + 1}`}
                    aria-label={`Option ${i + 1}`}
                    className="min-w-0 flex-1 border-none bg-transparent text-[13px] text-[#0f172a] outline-none placeholder:text-[#0f172a]/35"
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => {
                        const next = options.filter((_, j) => j !== i)
                        let idx = q.reponseCorrecteIndex
                        if (idx === i) idx = 0
                        else if (idx > i) idx -= 1
                        onChange({ options: next, reponseCorrecteIndex: idx })
                      }}
                      aria-label={`Retirer l'option ${i + 1}`}
                      className="shrink-0 rounded-full p-1 text-[#0f172a]/35 hover:bg-red-50 hover:text-red-600"
                    >
                      <X size={12} />
                    </button>
                  )}
                  {correct && <Check size={13} strokeWidth={3} className="shrink-0 text-[#2f855a]" />}
                </div>
              )
            })}
          </div>
          {options.length < 6 && (
            <button
              type="button"
              onClick={() => onChange({ options: [...options, ''] })}
              className="mt-2 flex items-center gap-1 text-[12px] font-semibold text-[#0f172a]/55 hover:text-[#0f172a]"
            >
              <Plus size={12} /> Ajouter une option
            </button>
          )}
        </div>
      )
    }

    case 'vrai_faux':
      return (
        <div className="flex gap-2">
          {[{ v: true, label: 'Vrai' }, { v: false, label: 'Faux' }].map(({ v, label }) => {
            const active = q.reponseCorrecte === v
            return (
              <button
                key={label}
                type="button"
                onClick={() => onChange({ reponseCorrecte: v })}
                className={`flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-[13px] font-semibold transition-all ${FOCUS_RING} ${
                  active
                    ? 'border-transparent bg-[#2f855a] text-white'
                    : 'border-[#0f172a]/20 text-[#0f172a]/60 hover:border-[#0f172a]/40'
                }`}
              >
                {active && <Check size={12} strokeWidth={3} />}
                {label}
              </button>
            )
          })}
        </div>
      )

    case 'ouverte':
      return (
        <input
          placeholder="Réponse attendue (pour la correction)"
          value={q.reponseAttendue || ''}
          onChange={(e) => onChange({ reponseAttendue: e.target.value })}
          aria-label={`Réponse attendue pour la question ${index + 1}`}
          className={INPUT_REPONSE}
        />
      )

    case 'texte_trous':
      return (
        <input
          placeholder="Réponse(s) attendue(s) — séparez par des virgules si plusieurs blancs"
          value={q.reponseAttendue || ''}
          onChange={(e) => onChange({ reponseAttendue: e.target.value })}
          aria-label={`Réponse attendue pour la question ${index + 1}`}
          className={INPUT_REPONSE}
        />
      )

    case 'calcul':
      return (
        <div className="flex gap-2">
          <input
            placeholder="Résultat attendu"
            value={q.reponseAttendue ?? ''}
            onChange={(e) => onChange({ reponseAttendue: e.target.value })}
            aria-label="Résultat attendu"
            className={INPUT_REPONSE}
          />
          <input
            placeholder="Unité"
            value={q.unite || ''}
            onChange={(e) => onChange({ unite: e.target.value })}
            aria-label="Unité"
            className={`w-28 shrink-0 ${INPUT_REPONSE}`}
          />
        </div>
      )

    case 'legende':
      return (
        <div className="space-y-3">
          {q.image?.url && (
            <img
              src={q.image.url}
              alt={q.image.alt_text || ''}
              className="max-h-56 w-auto rounded-[10px] border border-[#0f172a]/15 object-contain"
            />
          )}
          <ListeEditable
            titre="Légendes attendues (dans l'ordre des numéros)"
            items={Array.isArray(q.reponseCorrecte) ? q.reponseCorrecte : []}
            onChange={(items) => onChange({ reponseCorrecte: items })}
            numerote
          />
        </div>
      )

    case 'dictee':
      return (
        <textarea
          rows={4}
          placeholder="Texte de la dictée"
          value={q.texte_dictee || ''}
          onChange={(e) => onChange({ texte_dictee: e.target.value })}
          aria-label="Texte de la dictée"
          className={`resize-y ${INPUT_REPONSE}`}
        />
      )

    case 'redaction':
      return (
        <div className="space-y-3">
          <ListeEditable
            titre="Critères d'évaluation"
            items={Array.isArray(q.criteres_evaluation) ? q.criteres_evaluation : []}
            onChange={(items) => onChange({ criteres_evaluation: items })}
          />
          <label className="flex items-center gap-2 text-[12px] font-semibold text-[#0f172a]/60">
            Longueur minimale
            <input
              type="number"
              min={0}
              value={q.longueur_min_mots ?? ''}
              onChange={(e) => onChange({ longueur_min_mots: e.target.value === '' ? null : Math.max(0, Number(e.target.value)) })}
              className="w-20 rounded-[8px] border border-[#0f172a]/15 px-2 py-1 text-center text-[12.5px] text-[#0f172a] outline-none focus:border-[#7a0008]/40"
            />
            mots
          </label>
        </div>
      )

    case 'association': {
      const gauche = Array.isArray(q.colonne_gauche) ? q.colonne_gauche : []
      const droite = Array.isArray(q.colonne_droite) ? q.colonne_droite : []
      const rep = Array.isArray(q.reponseCorrecte) ? q.reponseCorrecte : []
      return (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <ListeEditable titre="Colonne de gauche" items={gauche} onChange={(items) => onChange({ colonne_gauche: items, reponseCorrecte: rep.slice(0, items.length) })} numerote />
            <ListeEditable titre="Colonne de droite" items={droite} onChange={(items) => onChange({ colonne_droite: items })} lettres />
          </div>
          {gauche.length > 0 && droite.length > 0 && (
            <div className="rounded-[12px] border border-[#2f855a]/25 bg-[#2f855a]/[0.04] p-3">
              <p className="mb-2 text-[11.5px] font-bold text-emerald-800">Bonnes associations</p>
              <div className="space-y-1.5">
                {gauche.map((g, i) => (
                  <div key={i} className="flex items-center gap-2 text-[12.5px]">
                    <span className="min-w-0 flex-1 truncate text-[#0f172a]/80">{i + 1}) {g || '—'}</span>
                    <span className="text-[#0f172a]/40">→</span>
                    <select
                      value={rep[i] ?? ''}
                      onChange={(e) => {
                        const next = [...rep]
                        while (next.length < gauche.length) next.push(null)
                        next[i] = e.target.value === '' ? null : Number(e.target.value)
                        onChange({ reponseCorrecte: next })
                      }}
                      className="w-40 rounded-[8px] border border-[#0f172a]/15 bg-white px-2 py-1 text-[12px] outline-none"
                    >
                      <option value="">—</option>
                      {droite.map((d, j) => (
                        <option key={j} value={j}>{String.fromCharCode(65 + j)}) {d}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )
    }

    case 'remise_en_ordre': {
      const elements = Array.isArray(q.elements) ? q.elements : []
      const ordre = Array.isArray(q.reponseCorrecte) ? q.reponseCorrecte : []
      return (
        <div className="space-y-3">
          <ListeEditable titre="Éléments (affichés dans le désordre à l'élève)" items={elements} onChange={(items) => onChange({ elements: items, reponseCorrecte: ordre.filter((x) => x < items.length) })} numerote />
          {elements.length > 0 && (
            <div className="rounded-[12px] border border-[#2f855a]/25 bg-[#2f855a]/[0.04] p-3">
              <p className="mb-2 text-[11.5px] font-bold text-emerald-800">Ordre correct</p>
              <div className="space-y-1.5">
                {elements.map((_, pos) => (
                  <div key={pos} className="flex items-center gap-2 text-[12.5px]">
                    <span className="w-16 shrink-0 font-semibold text-[#0f172a]/60">{pos + 1}ᵉ</span>
                    <select
                      value={ordre[pos] ?? ''}
                      onChange={(e) => {
                        const next = [...ordre]
                        while (next.length < elements.length) next.push(null)
                        next[pos] = e.target.value === '' ? null : Number(e.target.value)
                        onChange({ reponseCorrecte: next })
                      }}
                      className="min-w-0 flex-1 rounded-[8px] border border-[#0f172a]/15 bg-white px-2 py-1 text-[12px] outline-none"
                    >
                      <option value="">—</option>
                      {elements.map((el, j) => (
                        <option key={j} value={j}>{j + 1}) {el}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )
    }

    case 'tri': {
      const categories = Array.isArray(q.categories) ? q.categories : []
      const elements = Array.isArray(q.elements) ? q.elements : []
      const rep = Array.isArray(q.reponseCorrecte) ? q.reponseCorrecte : []
      return (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <ListeEditable titre="Catégories" items={categories} onChange={(items) => onChange({ categories: items })} />
            <ListeEditable titre="Éléments à classer" items={elements} onChange={(items) => onChange({ elements: items, reponseCorrecte: rep.slice(0, items.length) })} />
          </div>
          {elements.length > 0 && categories.length > 0 && (
            <div className="rounded-[12px] border border-[#2f855a]/25 bg-[#2f855a]/[0.04] p-3">
              <p className="mb-2 text-[11.5px] font-bold text-emerald-800">Bonne catégorie de chaque élément</p>
              <div className="space-y-1.5">
                {elements.map((el, i) => (
                  <div key={i} className="flex items-center gap-2 text-[12.5px]">
                    <span className="min-w-0 flex-1 truncate text-[#0f172a]/80">{el || '—'}</span>
                    <select
                      value={rep[i] ?? ''}
                      onChange={(e) => {
                        const next = [...rep]
                        while (next.length < elements.length) next.push(null)
                        next[i] = e.target.value === '' ? null : Number(e.target.value)
                        onChange({ reponseCorrecte: next })
                      }}
                      className="w-40 rounded-[8px] border border-[#0f172a]/15 bg-white px-2 py-1 text-[12px] outline-none"
                    >
                      <option value="">—</option>
                      {categories.map((c, j) => (
                        <option key={j} value={j}>{c}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )
    }

    default:
      return (
        <input
          placeholder="Réponse attendue (pour la correction)"
          value={q.reponseAttendue || ''}
          onChange={(e) => onChange({ reponseAttendue: e.target.value })}
          className={INPUT_REPONSE}
        />
      )
  }
}


function ListeEditable({ titre, items, onChange, numerote = false, lettres = false }) {
  return (
    <div className="rounded-[12px] border border-[#0f172a]/12 bg-[#0f172a]/[0.02] p-3">
      <p className="mb-2 text-[11.5px] font-bold text-[#0f172a]/65">{titre}</p>
      <div className="space-y-1.5">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-2">
            {(numerote || lettres) && (
              <span className="w-5 shrink-0 text-center text-[11px] font-bold text-[#7a0008]">
                {lettres ? String.fromCharCode(65 + i) : i + 1}
              </span>
            )}
            <input
              value={it ?? ''}
              onChange={(e) => {
                const next = [...items]
                next[i] = e.target.value
                onChange(next)
              }}
              className="min-w-0 flex-1 rounded-[8px] border border-[#0f172a]/15 bg-white px-2.5 py-1.5 text-[12.5px] text-[#0f172a] outline-none focus:border-[#7a0008]/40"
            />
            <button
              type="button"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              aria-label="Retirer"
              className="shrink-0 rounded-full p-1 text-[#0f172a]/35 hover:bg-red-50 hover:text-red-600"
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onChange([...items, ''])}
        className="mt-2 flex items-center gap-1 text-[12px] font-semibold text-[#0f172a]/55 hover:text-[#0f172a]"
      >
        <Plus size={12} /> Ajouter
      </button>
    </div>
  )
}


function ShortcutsModal({ onClose }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const raccourcis = [
    { keys: ['Ctrl', 'S'], label: 'Enregistrer les modifications' },
    { keys: ['Ctrl', 'D'], label: 'Dupliquer la question sélectionnée' },
    { keys: ['Ctrl', 'Entrée'], label: "Vérifier l'examen" },
    { keys: ['Ctrl', 'K'], label: 'Rechercher une question' },
    { keys: ['?'], label: 'Afficher les raccourcis' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#0f172a]/40 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Raccourcis clavier"
        className="relative w-full max-w-md overflow-hidden rounded-[24px] border border-[#0f172a]/20 bg-white"
        style={{ animation: 'examaiModalSlideUp 240ms cubic-bezier(0.22, 1, 0.36, 1) both' }}
      >
        <div className="flex items-center justify-between border-b border-[#0f172a]/10 p-5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-[#0f172a]/[0.08]">
              <Sparkles size={15} className="text-[#0f172a]" strokeWidth={2.4} />
            </span>
            <p className="examai-serif text-[15px] font-semibold text-[#0f172a]">Raccourcis clavier</p>
          </div>
          <button onClick={onClose} aria-label="Fermer" className="flex h-8 w-8 items-center justify-center rounded-full text-[#0f172a]/60 hover:bg-[#0f172a]/[0.05]">
            <X size={14} />
          </button>
        </div>
        <div className="space-y-2 p-5">
          {raccourcis.map((s) => (
            <div key={s.label} className="flex items-center justify-between gap-3 rounded-[10px] bg-[#0f172a]/[0.03] px-3 py-2">
              <span className="text-[12.5px] font-medium text-[#0f172a]/75">{s.label}</span>
              <span className="flex shrink-0 items-center gap-1">
                {s.keys.map((k) => (
                  <kbd key={k} className="rounded-md border border-[#0f172a]/20 bg-white px-2 py-0.5 font-mono text-[10.5px] font-bold text-[#0f172a]">
                    {k}
                  </kbd>
                ))}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}


function ApercuModal({ questions, totalPoints, onClose }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-[#0f172a]/40 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Aperçu de l'examen"
        className="relative max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-[24px] border border-[#0f172a]/20 bg-white"
        style={{ animation: 'examaiModalSlideUp 240ms cubic-bezier(0.22, 1, 0.36, 1) both' }}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-[#0f172a]/10 bg-white/95 px-5 py-4 backdrop-blur">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-[#7a0008]/[0.10]">
              <Eye size={15} className="text-[#7a0008]" />
            </span>
            <div>
              <p className="examai-serif text-[15px] font-semibold text-[#0f172a]">Aperçu de l'examen</p>
              <p className="text-[11px] font-bold italic text-[#0f172a]/50">
                {questions.length} question{questions.length > 1 ? 's' : ''} · {totalPoints} pt{totalPoints > 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Fermer" className="flex h-8 w-8 items-center justify-center rounded-full text-[#0f172a]/60 hover:bg-[#0f172a]/[0.05]">
            <X size={14} />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {questions.map((q, i) => (
            <div key={q.id} className="rounded-[16px] border border-[#0f172a]/15 bg-white p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-[12px] font-bold text-[#0f172a]/70">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#7a0008]/[0.10] text-[11px] font-bold text-[#7a0008]">
                    {i + 1}
                  </span>
                  {labelType(q.type)}
                </span>
                <span className="text-[11px] font-bold text-[#0f172a]/50">{q.points} pt{q.points > 1 ? 's' : ''}</span>
              </div>
              <p className="examai-serif mt-2.5 text-[14.5px] font-semibold text-[#0f172a]">
                {q.question || <span className="italic text-[#0f172a]/40">Énoncé vide</span>}
              </p>

              {q.type === 'qcm' && (
                <ul className="mt-2.5 space-y-1">
                  {(q.options || []).map((o, j) => (
                    <li key={j} className={`flex items-center gap-2 rounded-[10px] px-2.5 py-1.5 text-[12.5px] ${
                      j === q.reponseCorrecteIndex ? 'bg-[#2f855a]/[0.08] font-semibold text-emerald-800' : 'text-[#0f172a]/70'
                    }`}>
                      <span className="text-[10px] font-bold text-[#0f172a]/60">{String.fromCharCode(65 + j)}.</span>
                      {o}
                      {j === q.reponseCorrecteIndex && <Check size={12} strokeWidth={3} className="ml-auto text-emerald-600" />}
                    </li>
                  ))}
                </ul>
              )}

              {q.type === 'vrai_faux' && (
                <p className="mt-2 text-[12.5px] text-[#0f172a]/70">
                  Réponse : <span className="font-bold text-emerald-700">{q.reponseCorrecte ? 'Vrai' : 'Faux'}</span>
                </p>
              )}

              {['ouverte', 'texte_trous', 'calcul'].includes(q.type) && (
                <p className="mt-2 rounded-[10px] border border-dashed border-[#0f172a]/20 px-2.5 py-1.5 text-[12px] italic text-[#0f172a]/60">
                  {texteRempli(q.reponseAttendue) ? `${q.reponseAttendue}${q.unite ? ` ${q.unite}` : ''}` : 'Aucune réponse attendue spécifiée'}
                </p>
              )}

              {q.type === 'legende' && (
                <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-[12px] text-emerald-800">
                  {(q.reponseCorrecte || []).map((r, j) => <li key={j}>{r || '—'}</li>)}
                </ol>
              )}

              {q.type === 'dictee' && (
                <p className="mt-2 whitespace-pre-line text-[12px] italic text-[#0f172a]/70">{q.texte_dictee}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}


function DeleteConfirmModal({ question, index, onCancel, onConfirm }) {
  const cancelBtnRef = useRef(null)

  useEffect(() => { cancelBtnRef.current?.focus() }, [])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); onCancel() }
    }
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [onCancel])

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-3 sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-[#0f172a]/50 backdrop-blur-sm"
        style={{ animation: 'examaiModalFadeIn 200ms ease-out both' }}
        onClick={onCancel}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-modal-title"
        className="relative w-full max-w-md overflow-hidden rounded-[24px] border-2 border-[#7a0008]/30 bg-white"
        style={{ animation: 'examaiModalSlideUp 240ms cubic-bezier(0.22, 1, 0.36, 1) both' }}
      >
        <div className="h-1 w-full bg-[#7a0008]" />
        <div className="flex items-start gap-4 p-6 pb-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#7a0008]/[0.10]">
            <Trash2 size={20} className="text-[#7a0008]" strokeWidth={2.2} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 id="delete-modal-title" className="examai-serif text-[18px] font-semibold leading-tight text-[#0f172a]">
              Supprimer cette question ?
            </h3>
            <p className="mt-1.5 text-[12.5px] font-bold italic text-[#0f172a]/60">
              Cette action est irréversible. La question sera retirée de l'examen.
            </p>
          </div>
        </div>

        <div className="mx-6 mb-5 rounded-[14px] border border-[#0f172a]/15 bg-[#0f172a]/[0.03] p-3.5">
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded-full bg-[#7a0008]/[0.10] px-2 py-0.5 text-[10.5px] font-bold text-[#7a0008]">Q{index + 1}</span>
            <span className="rounded-full border border-[#0f172a]/15 px-2 py-0.5 text-[10px] font-semibold text-[#0f172a]/60">
              {labelType(question.type)}
            </span>
          </div>
          <p className="examai-serif line-clamp-2 text-[13.5px] font-medium text-[#0f172a]">
            {question.question?.trim() || <span className="italic text-[#0f172a]/40">Énoncé vide</span>}
          </p>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-[#0f172a]/10 bg-[#0f172a]/[0.02] p-4 sm:flex-row sm:justify-end">
          <button
            ref={cancelBtnRef}
            type="button"
            onClick={onCancel}
            className={`rounded-full border border-[#0f172a]/20 bg-white px-5 py-2.5 text-[13px] font-semibold text-[#0f172a] transition-all hover:border-[#0f172a]/40 ${FOCUS_RING}`}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex items-center justify-center gap-2 rounded-full bg-[#7a0008] px-5 py-2.5 text-[13px] font-semibold text-white transition-all hover:bg-[#961014] ${FOCUS_RING}`}
          >
            <Trash2 size={14} strokeWidth={2.4} />
            Supprimer
          </button>
        </div>
      </div>
    </div>
  )
}