import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  CheckCircle2, AlertTriangle, Lightbulb, RotateCcw, Loader2, ShieldCheck, ClipboardCheck,
  ArrowLeft, ArrowRight, Check, Sparkles, Target, TrendingUp, Zap, RefreshCw, Pencil,
  XCircle, ChevronDown, Info, Copy, FileText, ListChecks, ToggleLeft, PenLine, TextCursorInput, Calculator, Image as ImageIcon,
} from 'lucide-react'
import WizardShell from '../../components/WizardShell.jsx'
import { useWizard } from '../../context/WizardContext.jsx'

const WIZARD_STEPS = [
  { n: 1, label: 'Sélection' },
  { n: 2, label: 'Édition' },
  { n: 3, label: 'Validation' },
  { n: 4, label: 'Export' },
]
const CURRENT_STEP = 3

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f172a]/35 focus-visible:ring-offset-2'
const HOVER_LIFT = 'motion-reduce:transition-none motion-reduce:hover:translate-y-0'


function scoreColor(score) {
  if (score >= 80) return '#2f855a'
  if (score >= 50) return '#b8722a'
  return '#c53030'
}

function scoreLabel(score) {
  if (score >= 80) return 'Excellent'
  if (score >= 60) return 'Bon'
  if (score >= 50) return 'Moyen'
  return 'À améliorer'
}

function scoreMessage(score, peutValider) {
  if (!peutValider) return 'Quelques points bloquants doivent être corrigés avant la validation.'
  if (score >= 80) return 'Votre examen est prêt : il peut être validé tel quel.'
  if (score >= 60) return 'Bon examen. Les recommandations peuvent encore l’améliorer.'
  return 'L’examen peut être validé, mais il gagnerait à être retravaillé.'
}


function analyserRecommandation(texte) {
  const t = (texte || '').toLowerCase()
  if (/(variété|diversif|types? de questions|équilibre)/.test(t)) return { icon: Zap, tone: 'navy', label: 'Variété' }
  if (/(reformul|précis|clair|ambigu|confus)/.test(t)) return { icon: Target, tone: 'amber', label: 'Clarté' }
  if (/(cohéren|logique|structure)/.test(t)) return { icon: Sparkles, tone: 'emerald', label: 'Cohérence' }
  if (/(barème|bareme|points?\b|note|total)/.test(t)) return { icon: TrendingUp, tone: 'rose', label: 'Barème' }
  return { icon: Lightbulb, tone: 'navy', label: 'Suggestion' }
}

const TYPES_QUESTION = {
  qcm: 'QCM', vrai_faux: 'Vrai / Faux', ouverte: 'Question ouverte', texte_trous: 'Texte à trous',
  calcul: 'Calcul', legende: 'Légende', association: 'Association', remise_en_ordre: 'Remise en ordre',
  tri: 'Classement', dictee: 'Dictée', redaction: 'Rédaction',
}

const ETAPES_ANALYSE = [
  { label: 'Lecture des questions…', icon: ClipboardCheck },
  { label: 'Vérification du barème…', icon: TrendingUp },
  { label: 'Analyse de la cohérence…', icon: ShieldCheck },
  { label: 'Génération des recommandations…', icon: Sparkles },
]

export default function Validation() {
  const navigate = useNavigate()
  const { examen, lancerValidation, regenererExamen, loading, error } = useWizard()
  const validation = examen.validation

  const examenRegenerable = Array.isArray(examen.chapitres) && examen.chapitres.length > 0

  const [notesRegeneration, setNotesRegeneration] = useState('')
  const [regenerationEnCours, setRegenerationEnCours] = useState(false)
  const [erreurRegeneration, setErreurRegeneration] = useState(null)
  const [regenerationReussie, setRegenerationReussie] = useState(null)
  const apercuRef = useRef(null)

  const [recosTraitees, setRecosTraitees] = useState(() => new Set())
  const [afficherConformes, setAfficherConformes] = useState(false)
  const [apercuOuvert, setApercuOuvert] = useState(false)
  const [recosCopiees, setRecosCopiees] = useState(false)

  async function handleRegenerer() {
    setErreurRegeneration(null)
    setRegenerationReussie(null)
    setRegenerationEnCours(true)
    try {
      const nouvelExamen = await regenererExamen(notesRegeneration.trim() || undefined)
      setNotesRegeneration('')
      setRegenerationReussie({ nombreQuestions: nouvelExamen?.questions?.length ?? examen.questions.length })
      setApercuOuvert(true)
      setTimeout(() => apercuRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
    } catch (e) {
      setErreurRegeneration(e?.message || 'La régénération a échoué.')
    } finally {
      setRegenerationEnCours(false)
    }
  }

  const validationEnVolRef = useRef(false)

  useEffect(() => {
    if (examen.id && !validation && !validationEnVolRef.current) {
      validationEnVolRef.current = true
      lancerValidation()
        .catch(() => {})
        .finally(() => { validationEnVolRef.current = false })
    }
  }, [examen.id, validation])

  useEffect(() => {
    if (validation && regenerationReussie) setRegenerationReussie(null)
    setRecosTraitees(new Set())
  }, [validation])

  
  const checks = validation?.checks || []
  const avertissements = validation?.avertissements || []
  const recommandations = validation?.recommandations || []
  const checksEchoues = checks.filter((c) => !c.ok)
  const checksOk = checks.filter((c) => c.ok)

  const recosAnalysees = useMemo(
    () => recommandations.map((texte, idx) => ({ texte, idx, ...analyserRecommandation(texte) })),
    [recommandations],
  )

  function basculerTraitee(idx) {
    setRecosTraitees((s) => {
      const n = new Set(s)
      if (n.has(idx)) n.delete(idx)
      else n.add(idx)
      return n
    })
  }

  function copierRecommandations() {
    const texte = recommandations.map((r, i) => `${i + 1}. ${r}`).join('\n')
    navigator.clipboard?.writeText(texte)
    setRecosCopiees(true)
    setTimeout(() => setRecosCopiees(false), 1600)
  }

  if (!examen.id) {
    return (
      <WizardShell step={3} hideStepper>
        <div className="mx-auto max-w-lg py-14 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#7a0008]/[0.08] text-[#7a0008]">
            <ClipboardCheck size={22} />
          </div>
          <h1 className="examai-serif text-[20px] font-semibold text-[#0f172a]">Aucun examen en cours</h1>
          <p className="mt-2 text-[13.5px] font-bold italic text-[#0f172a]/55">
            Retournez à l'étape 1 pour générer un examen avant de pouvoir le valider.
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
    <WizardShell step={3} hideStepper>
      <style>{`
        .examai-underline-wave {
          background-color: rgba(122,0,8,0.12);
          background-repeat: no-repeat;
          background-size: 100% 0.35em;
          background-position: 0 88%;
          padding: 0 0.15em;
        }
        @keyframes examaiPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        .examai-pulse { animation: examaiPulse 1.6s ease-in-out infinite; }
        @keyframes examaiSpinSlow { to { transform: rotate(360deg); } }
        @keyframes examaiOrbitPulse { 0%, 100% { transform: scale(1); opacity: 0.6; } 50% { transform: scale(1.08); opacity: 1; } }
        @keyframes examaiScanLine { 0% { transform: translateY(-100%); } 100% { transform: translateY(400%); } }
        @keyframes examaiFadeInUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes examaiDot { 0%, 20% { opacity: 0.3; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.1); } 80%, 100% { opacity: 0.3; transform: scale(0.8); } }
        .examai-orbit { animation: examaiSpinSlow 2.4s linear infinite; }
        .examai-orbit-slow { animation: examaiSpinSlow 3.6s linear infinite reverse; }
        .examai-orbit-pulse { animation: examaiOrbitPulse 2s ease-in-out infinite; }
        .examai-scan { animation: examaiScanLine 2s ease-in-out infinite; }
        .examai-fade-in-up { animation: examaiFadeInUp 0.5s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .examai-dot-1 { animation: examaiDot 1.4s ease-in-out infinite; }
        .examai-dot-2 { animation: examaiDot 1.4s ease-in-out 0.2s infinite; }
        .examai-dot-3 { animation: examaiDot 1.4s ease-in-out 0.4s infinite; }
        @media (prefers-reduced-motion: reduce) {
          .examai-pulse, .examai-orbit, .examai-orbit-slow, .examai-orbit-pulse,
          .examai-scan, .examai-fade-in-up, .examai-dot-1, .examai-dot-2, .examai-dot-3 {
            animation: none !important;
          }
        }
      `}</style>

      <div className="w-full max-w-full overflow-x-hidden">

        {}
        <div className="relative mb-5 w-full overflow-hidden rounded-[28px] border border-[#0f172a]/20 bg-white px-6 py-6 sm:px-8 sm:py-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="examai-serif text-[30px] sm:text-[38px] font-semibold tracking-[-0.025em] text-[#0f172a] leading-[1.15]">
                Vérification{' '}
                <span className="text-[#7a0008] relative">
                  <span className="examai-underline-wave">et validation.</span>
                </span>
              </h1>
              <p className="examai-serif mt-2.5 text-[14px] sm:text-[15px] font-normal italic leading-[1.6] text-[#0f172a]/70">
                L'IA analyse votre examen et vous indique les points à améliorer.
              </p>
            </div>
            {validation?.peut_valider && <PastilleStatut peutValider />}
          </div>
        </div>

        {}
        {error && (
          <div role="alert" className="mb-5 flex items-start gap-3 rounded-[16px] border border-[#7a0008]/40 bg-[#7a0008]/[0.03] p-4 text-[13px] text-[#0f172a]">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#7a0008]/10">
              <AlertTriangle size={14} className="text-[#7a0008]" />
            </span>
            <span className="min-w-0 break-words pt-0.5 font-medium">{error}</span>
          </div>
        )}

        {}
        <div className="mb-5 flex items-center overflow-x-auto rounded-[20px] border border-[#0f172a]/20 bg-white px-5 py-3.5" role="list" aria-label="Étapes de création de l'examen">
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
                  <span className={`mx-3 h-px min-w-[16px] flex-1 rounded-full ${done ? 'bg-[#7a0008]/25' : 'bg-[#0f172a]/10'}`} />
                )}
              </div>
            )
          })}
        </div>

        {}
        {loading && !validation && <AnalyseLoader />}

        {}
        {validation && (
          <>
            {}
            <section className="examai-fade-in-up mb-5 overflow-hidden rounded-[24px] border border-[#0f172a]/[0.12] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_18px_40px_-30px_rgba(15,23,42,0.35)]">
              <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[auto_minmax(0,1fr)_280px] lg:items-center lg:gap-8">
                <div className="flex justify-center">
                  <ScoreGauge score={validation.score} />
                </div>

                <div className="min-w-0 text-center lg:text-left">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f6f6f6] px-3 py-1 text-[11.5px] font-semibold text-[#0f172a]/65 ring-1 ring-[#0f172a]/[0.06]">
                    <ShieldCheck size={13} className="text-[#7a0008]" />
                    Score de qualité · {scoreLabel(validation.score)}
                  </span>
                  {validation.resume && (
                    <p className="examai-serif mt-3 text-[19px] font-semibold leading-snug text-[#0f172a] sm:text-[20px]">
                      {validation.resume}
                    </p>
                  )}
                  <p className={`mt-3 inline-flex items-center gap-2 text-[13px] font-semibold ${validation.peut_valider ? 'text-[#0f172a]/70' : 'text-[#7a0008]'}`}>
                    {validation.peut_valider
                      ? <><CheckCircle2 size={15} className="text-emerald-600" /> Cet examen peut être validé.</>
                      : <><XCircle size={15} /> Corrigez {checksEchoues.length > 1 ? `les ${checksEchoues.length} points bloquants` : 'le point bloquant'} avant de valider.</>}
                  </p>
                </div>

                <div className="space-y-3.5 rounded-[18px] bg-[#f8f8f8] p-4 ring-1 ring-[#0f172a]/[0.05]">
                  <BarreStat icone={CheckCircle2} libelle="Points conformes" valeur={checksOk.length} total={checks.length} />
                  <BarreStat icone={AlertTriangle} libelle="Remarques" valeur={checksEchoues.length + avertissements.length} />
                  <BarreStat icone={Lightbulb} libelle="Conseils traités" valeur={recosTraitees.size} total={recommandations.length} />
                  <button
                    onClick={() => lancerValidation().catch(() => {})}
                    disabled={loading}
                    className={`mt-1 flex w-full items-center justify-center gap-1.5 rounded-full bg-white py-2 text-[12px] font-semibold text-[#0f172a]/75 ring-1 ring-[#0f172a]/[0.12] transition-all hover:text-[#0f172a] hover:ring-[#0f172a]/30 disabled:opacity-50 ${FOCUS_RING}`}
                  >
                    {loading ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                    Revalider le contenu
                  </button>
                </div>
              </div>
            </section>

            {}
            <div className="grid gap-5 lg:grid-cols-2 lg:items-start">

              {}
              <section className="min-w-0 rounded-[24px] border border-[#0f172a]/[0.12] bg-white p-5 sm:p-6">
                <EnTeteSection icone={ClipboardCheck} titre="Remarques" sous="Vérifications automatiques de l'examen" nombre={checksEchoues.length + avertissements.length} />

                {checks.length === 0 && avertissements.length === 0 ? (
                  <EtatVide icone={CheckCircle2} texte="Aucune remarque pour cet examen." />
                ) : (
                  <ul className="mt-4 space-y-2">
                    {checksEchoues.map((c, i) => (
                      <CarteRemarque key={c.label} type="erreur" delai={i}>{c.label}</CarteRemarque>
                    ))}
                    {avertissements.map((a, i) => (
                      <CarteRemarque key={a} type="avertissement" delai={checksEchoues.length + i}>{a}</CarteRemarque>
                    ))}
                    {(afficherConformes || (!checksEchoues.length && !avertissements.length)) && checksOk.map((c, i) => (
                      <CarteRemarque key={c.label} type="ok" delai={i}>{c.label}</CarteRemarque>
                    ))}
                  </ul>
                )}

                {checksOk.length > 0 && (checksEchoues.length > 0 || avertissements.length > 0) && (
                  <button
                    onClick={() => setAfficherConformes((v) => !v)}
                    aria-expanded={afficherConformes}
                    className={`mt-3 flex w-full items-center justify-center gap-1.5 rounded-[12px] border border-dashed border-[#0f172a]/15 py-2 text-[12px] font-semibold text-[#0f172a]/55 transition-colors hover:border-[#0f172a]/30 hover:text-[#0f172a] ${FOCUS_RING}`}
                  >
                    <CheckCircle2 size={13} className="text-emerald-600" />
                    {afficherConformes ? 'Masquer' : 'Voir'} les {checksOk.length} points conformes
                    <ChevronDown size={14} className={`transition-transform ${afficherConformes ? 'rotate-180' : ''}`} />
                  </button>
                )}
              </section>

              {}
              <section className="min-w-0 rounded-[24px] border border-[#0f172a]/[0.12] bg-white p-5 sm:p-6">
                <EnTeteSection
                  icone={Lightbulb}
                  titre="Recommandations"
                  sous="Suggestions de l'IA pour améliorer l'examen"
                  nombre={recommandations.length}
                  action={recommandations.length > 0 && (
                    <button
                      onClick={copierRecommandations}
                      title="Copier toutes les recommandations"
                      className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold text-[#0f172a]/45 transition-colors hover:bg-[#0f172a]/[0.05] hover:text-[#0f172a] ${FOCUS_RING}`}
                    >
                      {recosCopiees ? <Check size={13} strokeWidth={3} /> : <Copy size={13} />}
                      {recosCopiees ? 'Copié' : 'Copier'}
                    </button>
                  )}
                />

                {recommandations.length === 0 ? (
                  <EtatVide icone={CheckCircle2} texte="Aucune recommandation : votre examen est bien structuré." />
                ) : (
                  <>
                    <ol className="mt-4 space-y-2">
                      {recosAnalysees.map((r, i) => {
                        const faite = recosTraitees.has(r.idx)
                        const Icone = r.icon
                        return (
                          <li
                            key={`${r.texte}-${r.idx}`}
                            className={`examai-fade-in-up group flex items-start gap-3 rounded-[16px] border p-3.5 transition-all ${
                              faite ? 'border-[#0f172a]/[0.06] bg-[#f8f8f8]' : 'border-[#0f172a]/10 bg-white hover:border-[#0f172a]/20 hover:shadow-[0_10px_24px_-18px_rgba(15,23,42,0.45)]'
                            }`}
                            style={{ animationDelay: `${i * 50}ms` }}
                          >
                            <span className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] ${faite ? 'bg-white text-[#0f172a]/30' : 'bg-[#f4f4f4] text-[#7a0008]'}`}>
                              <Icone size={16} />
                              <span className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold tabular-nums text-[#0f172a]/60 ring-1 ring-[#0f172a]/10">
                                {r.idx + 1}
                              </span>
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#0f172a]/40">{r.label}</p>
                              <p className={`mt-0.5 text-[13.5px] leading-relaxed ${faite ? 'text-[#0f172a]/35 line-through' : 'text-[#0f172a]/85'}`}>
                                {r.texte}
                              </p>
                            </div>
                            <button
                              onClick={() => basculerTraitee(r.idx)}
                              aria-pressed={faite}
                              title={faite ? 'Marquer comme non traitée' : 'Marquer comme traitée'}
                              aria-label={faite ? 'Marquer comme non traitée' : 'Marquer comme traitée'}
                              className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-all ${FOCUS_RING} ${
                                faite ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-[#0f172a]/20 text-transparent hover:border-[#0f172a]/45 hover:text-[#0f172a]/30'
                              }`}
                            >
                              <Check size={13} strokeWidth={3} />
                            </button>
                          </li>
                        )
                      })}
                    </ol>

                    {}
                    {examenRegenerable ? (
                      <div className="mt-4 rounded-[18px] bg-[#f8f8f8] p-4 ring-1 ring-[#0f172a]/[0.05]">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[#7a0008] text-white shadow-[0_6px_14px_-8px_rgba(122,0,8,0.8)]">
                            <RefreshCw size={15} />
                          </span>
                          <div className="min-w-0">
                            <p className="text-[13.5px] font-semibold text-[#0f172a]">Régénérer avec l'IA</p>
                            <p className="text-[12px] text-[#0f172a]/50">Les {recommandations.length} recommandations sont transmises automatiquement.</p>
                          </div>
                        </div>
                        <textarea
                          value={notesRegeneration}
                          onChange={(e) => setNotesRegeneration(e.target.value)}
                          rows={2}
                          placeholder="Consigne supplémentaire (optionnel) : ex. « garde le même nombre de questions »"
                          aria-label="Consigne supplémentaire pour la régénération"
                          className={`mt-3 w-full resize-none rounded-[12px] border border-[#0f172a]/[0.12] bg-white px-3 py-2 text-[13px] text-[#0f172a] outline-none transition-colors placeholder:text-[#0f172a]/35 focus:border-[#0f172a]/35 ${FOCUS_RING}`}
                        />
                        {erreurRegeneration && (
                          <p role="alert" className="mt-2 flex items-center gap-1.5 text-[12px] font-semibold text-[#7a0008]">
                            <AlertTriangle size={12} /> {erreurRegeneration}
                          </p>
                        )}
                        <button
                          onClick={handleRegenerer}
                          disabled={regenerationEnCours || loading}
                          className={`mt-2.5 flex w-full items-center justify-center gap-2 rounded-full bg-[#7a0008] py-2.5 text-[12.5px] font-semibold text-white shadow-[0_8px_18px_-12px_rgba(122,0,8,0.8)] transition-all hover:-translate-y-0.5 hover:bg-[#961014] active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 ${FOCUS_RING} ${HOVER_LIFT}`}
                        >
                          {regenerationEnCours
                            ? <><Loader2 size={14} className="animate-spin" /> Régénération…</>
                            : <><RefreshCw size={13} /> Régénérer selon les recommandations</>}
                        </button>
                      </div>
                    ) : (
                      <div className="mt-4 flex items-start gap-3 rounded-[18px] bg-[#f8f8f8] p-4 ring-1 ring-[#0f172a]/[0.05]">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-white text-[#0f172a]/45 ring-1 ring-[#0f172a]/[0.06]">
                          <Info size={15} />
                        </span>
                        <p className="text-[12.5px] leading-relaxed text-[#0f172a]/55">
                          Examen créé depuis un PDF ou la Banque de Questions : la régénération automatique n'est pas
                          disponible. Appliquez les recommandations à l'étape <span className="font-semibold text-[#0f172a]">Édition</span>.
                        </p>
                      </div>
                    )}
                  </>
                )}
              </section>
            </div>
          </>
        )}

        {}
        <section
          ref={apercuRef}
          className={`mt-5 scroll-mt-4 overflow-hidden rounded-[24px] border bg-white transition-colors ${
            regenerationReussie ? 'border-[#7a0008]/40 ring-4 ring-[#7a0008]/[0.05]' : 'border-[#0f172a]/[0.12]'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 p-5 sm:px-6">
            <button
              onClick={() => setApercuOuvert((v) => !v)}
              aria-expanded={apercuOuvert}
              className={`flex min-w-0 flex-1 items-center gap-3 text-left ${FOCUS_RING}`}
            >
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] ${regenerationReussie ? 'bg-[#7a0008] text-white' : 'bg-[#f4f4f4] text-[#7a0008]'}`}>
                {regenerationReussie ? <RefreshCw size={17} /> : <FileText size={17} />}
              </span>
              <span className="min-w-0">
                <span className="examai-serif block text-[16.5px] font-semibold text-[#0f172a]">
                  {regenerationReussie ? 'Nouvel examen régénéré' : 'Examen et corrigé'}
                </span>
                <span className="block text-[12px] text-[#0f172a]/50">
                  {regenerationReussie
                    ? `${regenerationReussie.nombreQuestions} question${regenerationReussie.nombreQuestions > 1 ? 's' : ''} — relisez avant de valider`
                    : `${(examen.questions || []).length} question${(examen.questions || []).length > 1 ? 's' : ''} avec les bonnes réponses`}
                </span>
              </span>
              <span className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f4f4f4] text-[#0f172a]/50">
                <ChevronDown size={16} className={`transition-transform duration-300 ${apercuOuvert ? 'rotate-180' : ''}`} />
              </span>
            </button>
            <button
              onClick={() => navigate('/wizard/edition')}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border border-[#0f172a]/15 px-3.5 py-2 text-[12px] font-semibold text-[#0f172a]/70 transition-colors hover:border-[#0f172a]/40 hover:text-[#0f172a] ${FOCUS_RING}`}
            >
              <Pencil size={12} /> Éditer les questions
            </button>
          </div>

          {apercuOuvert && (
            <div className="examai-fade-in-up border-t border-[#0f172a]/[0.07] bg-[#fafafa] p-5 sm:p-6">
              {(examen.questions || []).length === 0 ? (
                <EtatVide icone={FileText} texte="Aucune question." />
              ) : (
                <ol className="grid gap-3 md:grid-cols-2">
                  {examen.questions.map((q, i) => <CarteQuestion key={q.id ?? i} q={q} numero={i + 1} />)}
                </ol>
              )}
            </div>
          )}
        </section>

        {}
        {validation && (
          <div className="sticky bottom-4 z-20 mt-5 w-full">
            <div className="w-full overflow-hidden rounded-[20px] border border-[#0f172a]/20 bg-white/95 shadow-[0_14px_32px_-14px_rgba(15,23,42,0.25)] backdrop-blur">
              <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[12.5px] text-[#0f172a]/60">
                  Score <span className="font-bold tabular-nums text-[#0f172a]">{validation.score}/100</span>
                  {validation.peut_valider && (
                    <><span className="mx-2 text-[#0f172a]/20">·</span><span className="font-semibold text-[#0f172a]/70">Prêt à valider</span></>
                  )}
                </p>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => navigate('/wizard/edition')}
                    className={`flex shrink-0 items-center justify-center gap-1.5 rounded-full border-2 border-[#0f172a]/20 bg-white px-4 py-2.5 text-[12.5px] font-semibold text-[#0f172a] transition-all hover:-translate-y-0.5 hover:border-[#0f172a]/50 active:scale-[0.985] ${FOCUS_RING} ${HOVER_LIFT}`}
                  >
                    <ArrowLeft size={14} strokeWidth={2.4} />
                    Retour à l'édition
                  </button>
                  <button
                    onClick={() => navigate('/wizard/export')}
                    disabled={!validation.peut_valider || loading}
                    title={!validation.peut_valider ? 'Corrigez les points bloquants pour pouvoir valider' : undefined}
                    className={`group relative flex shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-full bg-[#7a0008] px-5 py-2.5 text-[12.5px] font-semibold text-white shadow-[0_1px_2px_rgba(15,23,42,0.2),0_10px_22px_-10px_rgba(122,0,8,0.55)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#961014] active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:bg-[#7a0008] ${FOCUS_RING} ${HOVER_LIFT}`}
                  >
                    <span className="relative">Valider l'examen</span>
                    <ArrowRight size={14} strokeWidth={2.4} className="relative transition-transform duration-200 group-hover:translate-x-1 motion-reduce:group-hover:translate-x-0" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </WizardShell>
  )
}




function PastilleStatut({ peutValider }) {
  return (
    <span className={`flex shrink-0 items-center gap-1.5 rounded-full border border-[#0f172a]/15 px-3 py-1.5 text-[12px] font-semibold ${peutValider ? 'text-[#0f172a]/70' : 'text-[#7a0008]'}`}>
      {peutValider && <><CheckCircle2 size={13} className="text-emerald-600" /> Prêt à valider</>}
    </span>
  )
}

function EnTeteSection({ icone: Icone, titre, sous, nombre, action }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[#f4f4f4] text-[#7a0008]">
          <Icone size={17} />
        </span>
        <div className="min-w-0">
          <h2 className="examai-serif flex items-center gap-2 text-[16.5px] font-semibold text-[#0f172a]">
            {titre}
            {nombre > 0 && (
              <span className="rounded-full bg-[#0f172a] px-2 py-0.5 font-sans text-[11px] font-bold tabular-nums text-white">{nombre}</span>
            )}
          </h2>
          <p className="truncate text-[12px] text-[#0f172a]/50">{sous}</p>
        </div>
      </div>
      {action}
    </div>
  )
}

function EtatVide({ icone: Icone, texte }) {
  return (
    <div className="mt-4 flex flex-col items-center gap-2 rounded-[16px] border border-dashed border-[#0f172a]/[0.12] px-4 py-8 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#f4f4f4] text-emerald-600">
        <Icone size={20} />
      </span>
      <p className="text-[13px] font-medium text-[#0f172a]/60">{texte}</p>
    </div>
  )
}

function BarreStat({ icone: Icone, libelle, valeur, total }) {
  const pct = total ? Math.round((valeur / total) * 100) : null
  return (
    <div>
      <div className="flex items-center justify-between gap-2 text-[12.5px]">
        <span className="flex items-center gap-2 font-medium text-[#0f172a]/65">
          <Icone size={14} className="text-[#0f172a]/40" />
          {libelle}
        </span>
        <span className="font-bold tabular-nums text-[#0f172a]">{total ? `${valeur}/${total}` : valeur}</span>
      </div>
      {pct !== null && (
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#0f172a]/[0.07]">
          <div className="h-full rounded-full bg-[#7a0008] transition-[width] duration-700 ease-out" style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  )
}

const STYLE_REMARQUE = {
  erreur: { icone: XCircle, couleur: 'text-[#7a0008]', libelle: 'À corriger' },
  avertissement: { icone: AlertTriangle, couleur: 'text-amber-600', libelle: 'Avertissement' },
  ok: { icone: CheckCircle2, couleur: 'text-emerald-600', libelle: 'Conforme' },
}

function CarteRemarque({ type, delai = 0, children }) {
  const st = STYLE_REMARQUE[type]
  const Icone = st.icone
  return (
    <li
      className={`examai-fade-in-up flex items-start gap-3 rounded-[16px] border p-3.5 transition-colors ${
        type === 'ok' ? 'border-[#0f172a]/[0.06] bg-[#fafafa]' : 'border-[#0f172a]/10 bg-white hover:border-[#0f172a]/20'
      }`}
      style={{ animationDelay: `${delai * 50}ms` }}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[#f4f4f4]">
        <Icone size={17} className={st.couleur} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#0f172a]/40">{st.libelle}</p>
        <p className={`mt-0.5 text-[13.5px] leading-relaxed ${type === 'ok' ? 'text-[#0f172a]/55' : 'text-[#0f172a]/85'}`}>{children}</p>
      </div>
    </li>
  )
}

const ICONES_TYPE = {
  qcm: ListChecks, vrai_faux: ToggleLeft, ouverte: PenLine, texte_trous: TextCursorInput,
  calcul: Calculator, legende: ImageIcon,
}

function CarteQuestion({ q, numero }) {
  const type = TYPES_QUESTION[q.type] || q.type || 'Question'
  const IconeType = ICONES_TYPE[q.type] || FileText
  const rtl = /[؀-ۿ]/.test(`${q.question || ''}${(q.options || []).join('')}`)
  const reponse = q.type === 'vrai_faux'
    ? (q.reponseCorrecte ? 'Vrai' : 'Faux')
    : (q.type === 'ouverte' || q.type === 'texte_trous' || q.type === 'calcul')
      ? (q.reponseAttendue ? `${q.reponseAttendue}${q.unite ? ` ${q.unite}` : ''}` : null)
      : undefined

  return (
    <li className="flex min-w-0 flex-col rounded-[18px] border border-[#0f172a]/[0.08] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-[#0f172a] px-1.5 text-[11.5px] font-bold tabular-nums text-white">{numero}</span>
          <span className="flex items-center gap-1.5 rounded-full bg-[#f4f4f4] px-2.5 py-1 text-[11px] font-semibold text-[#0f172a]/60">
            <IconeType size={12} className="text-[#7a0008]" /> {type}
          </span>
        </span>
        {q.points != null && (
          <span className="rounded-full bg-[#f4f4f4] px-2.5 py-1 text-[11px] font-bold tabular-nums text-[#0f172a]/70">
            {q.points} pt{Number(q.points) > 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div dir={rtl ? 'rtl' : 'ltr'} className="mt-3 flex-1">
        <p className="text-[14px] font-semibold leading-relaxed text-[#0f172a]">
          {q.question || <span className="italic font-normal text-[#0f172a]/40">Énoncé vide</span>}
        </p>

        {q.type === 'qcm' && (
          <ul className="mt-2.5 space-y-1.5">
            {(q.options || []).map((o, j) => {
              const bonne = j === q.reponseCorrecteIndex
              return (
                <li
                  key={j}
                  className={`flex items-center gap-2.5 rounded-[10px] px-2.5 py-1.5 text-[13px] ${
                    bonne ? 'bg-[#f4f4f4] font-semibold text-[#0f172a]' : 'text-[#0f172a]/55'
                  }`}
                >
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10.5px] font-bold ${
                    bonne ? 'bg-emerald-600 text-white' : 'bg-white text-[#0f172a]/45 ring-1 ring-[#0f172a]/15'
                  }`}>
                    {bonne ? <Check size={11} strokeWidth={3} /> : String.fromCharCode(65 + j)}
                  </span>
                  <span className="min-w-0">{o}</span>
                </li>
              )
            })}
          </ul>
        )}

        {reponse !== undefined && (
          reponse
            ? (
              <p className="mt-2.5 flex items-center gap-2 rounded-[10px] bg-[#f4f4f4] px-2.5 py-1.5 text-[13px] font-semibold text-[#0f172a]">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white"><Check size={11} strokeWidth={3} /></span>
                <span className="min-w-0">{reponse}</span>
              </p>
            )
            : (
              <p className="mt-2.5 flex items-center gap-2 text-[12.5px] font-medium text-[#0f172a]/60">
                <AlertTriangle size={14} className="text-amber-600" /> Réponse attendue non renseignée
              </p>
            )
        )}
      </div>
    </li>
  )
}


function AnalyseLoader() {
  return (
    <div className="relative flex min-h-[420px] flex-col items-center justify-center gap-8 overflow-hidden rounded-[24px] border border-[#0f172a]/20 bg-white p-10">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="examai-scan absolute left-0 right-0 h-32 bg-gradient-to-b from-transparent via-[#7a0008]/[0.06] to-transparent" />
      </div>
      <div className="relative flex h-40 w-40 items-center justify-center">
        <div className="examai-orbit-slow absolute inset-0 rounded-full border-2 border-dashed border-[#0f172a]/20">
          <span className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-[#0f172a]/40" />
          <span className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-[#0f172a]/40" />
        </div>
        <div className="examai-orbit absolute inset-4 rounded-full border-2 border-[#7a0008]/20">
          <span className="absolute -top-1.5 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-[#7a0008] shadow-[0_0_10px_rgba(122,0,8,0.5)]" />
        </div>
        <div className="examai-orbit-pulse absolute inset-10 rounded-full border border-[#7a0008]/30 bg-[#7a0008]/[0.04]" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-[#7a0008] shadow-[0_8px_24px_-6px_rgba(122,0,8,0.6)]">
          <ShieldCheck size={24} className="text-white" strokeWidth={2} />
        </div>
      </div>
      <div className="relative flex flex-col items-center gap-2 text-center">
        <h3 className="examai-serif text-[18px] font-semibold text-[#0f172a]">Analyse en cours</h3>
        <p className="flex items-center gap-1 text-[13px] font-medium italic text-[#0f172a]/55">
          L'IA examine votre examen
          <span className="examai-dot-1 inline-block h-1 w-1 rounded-full bg-[#0f172a]/60" />
          <span className="examai-dot-2 inline-block h-1 w-1 rounded-full bg-[#0f172a]/60" />
          <span className="examai-dot-3 inline-block h-1 w-1 rounded-full bg-[#0f172a]/60" />
        </p>
      </div>
      <ul className="relative w-full max-w-sm space-y-1.5">
        {ETAPES_ANALYSE.map((etape, idx) => {
          const Icon = etape.icon
          return (
            <li
              key={etape.label}
              className="examai-fade-in-up flex items-center gap-2.5 rounded-[10px] border border-[#0f172a]/10 bg-[#0f172a]/[0.02] px-3 py-2"
              style={{ animationDelay: `${idx * 0.12}s` }}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-[#0f172a]/15">
                <Icon size={12} className="text-[#0f172a]/70" strokeWidth={2.2} />
              </span>
              <span className="text-[12px] font-medium text-[#0f172a]/70">{etape.label}</span>
              <span className="ml-auto flex h-1.5 w-1.5">
                <span className="examai-dot-1 h-full w-full rounded-full bg-[#7a0008]" />
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}


function ScoreGauge({ score }) {
  const cible = Math.max(0, Math.min(100, Number(score) || 0))
  const [affiche, setAffiche] = useState(0)

  useEffect(() => {
    const reduit = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduit) { setAffiche(cible); return undefined }
    let raf
    const debut = performance.now()
    const depart = 0
    const tick = (t) => {
      const p = Math.min(1, (t - debut) / 900)
      const e = 1 - (1 - p) ** 3
      setAffiche(Math.round(depart + (cible - depart) * e))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [cible])

  const radius = 54
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (affiche / 100) * circumference
  const color = scoreColor(cible)

  return (
    <div className="relative flex h-40 w-40 items-center justify-center" role="img" aria-label={`Score de qualité : ${cible} sur 100`}>
      <svg viewBox="0 0 128 128" className="h-40 w-40 -rotate-90">
        <circle cx="64" cy="64" r={radius} fill="none" stroke={color} strokeOpacity="0.12" strokeWidth="11" />
        <circle
          cx="64" cy="64" r={radius} fill="none" stroke={color} strokeWidth="11" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute flex flex-col items-center">
        <span className="examai-serif text-[34px] font-bold leading-none tabular-nums text-[#0f172a]">{affiche}</span>
        <span className="mt-1 text-[11px] font-semibold text-[#0f172a]/45">sur 100</span>
      </span>
    </div>
  )
}