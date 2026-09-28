import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle2, AlertTriangle, Lightbulb, RotateCcw, Loader2, ShieldCheck, ClipboardCheck, ArrowLeft, ArrowRight, Check, Sparkles, ChevronRight, Target, TrendingUp, Zap, RefreshCw, PenLine, Pencil } from 'lucide-react'
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

function analyserRecommandation(texte) {
  const t = (texte || '').toLowerCase()
  if (/(ajoutez|augmentez|il manque|barème|point)/.test(t)) {
    return { icon: TrendingUp, tone: 'rose', label: 'Barème' }
  }
  if (/(reformul|précis|clair|ambigu|confus)/.test(t)) {
    return { icon: Target, tone: 'amber', label: 'Clarté' }
  }
  if (/(variété|diversif|type|équilibre)/.test(t)) {
    return { icon: Zap, tone: 'navy', label: 'Variété' }
  }
  if (/(cohéren|logique|structure)/.test(t)) {
    return { icon: Sparkles, tone: 'emerald', label: 'Cohérence' }
  }
  return { icon: Lightbulb, tone: 'navy', label: 'Suggestion' }
}

const TONES = {
  rose: { bg: 'bg-[#7a0008]/[0.04]', border: 'border-[#7a0008]/20', icon: 'bg-[#7a0008]/[0.10] text-[#7a0008]', label: 'text-[#7a0008]' },
  amber: { bg: 'bg-amber-50/60', border: 'border-amber-200', icon: 'bg-amber-100 text-amber-700', label: 'text-amber-700' },
  navy: { bg: 'bg-[#0f172a]/[0.03]', border: 'border-[#0f172a]/15', icon: 'bg-[#0f172a]/[0.08] text-[#0f172a]', label: 'text-[#0f172a]' },
  emerald: { bg: 'bg-emerald-50/60', border: 'border-emerald-200', icon: 'bg-emerald-100 text-emerald-700', label: 'text-emerald-700' },
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

  // NOUVEAU -- un examen cree depuis un PDF (POST /api/examens/depuis-pdf,
  // y compris via le bouton "Creer un examen depuis ce PDF" du chat
  // assistant) ou assemble depuis la Banque de Questions (POST
  // /api/examens/depuis-selection) n'a pas de `chapitres` du programme --
  // voir creer_examen_depuis_pdf / creer_examen_depuis_selection dans
  // main.py, qui omettent ce champ VOLONTAIREMENT. POST
  // /api/examens/{id}/regenerer le detecte et renvoie une 422 explicite
  // (voir regenerer_examen dans main.py : le chemin RAG n'a pas de vrais
  // chapitres du programme a chercher pour ce genre d'examen). Sans ce
  // check ici, le bouton "Regenerer selon les recommandations" restait
  // affiche pour ces examens-la et menait systematiquement a cette
  // erreur au clic, sans que l'enseignant sache pourquoi avant d'essayer.
  const examenRegenerable = Array.isArray(examen.chapitres) && examen.chapitres.length > 0

  // NOUVEAU -- consignes libres pour la regeneration (en plus des
  // recommandations de l'IA, envoyees automatiquement -- voir
  // handleRegenerer). Etat local et loading dedie : distinct du
  // `loading` global (partage avec lancerValidation) pour ne pas faire
  // clignoter les DEUX boutons a la fois pendant une regeneration.
  const [notesRegeneration, setNotesRegeneration] = useState('')
  const [regenerationEnCours, setRegenerationEnCours] = useState(false)
  const [erreurRegeneration, setErreurRegeneration] = useState(null)
  // NOUVEAU -- confirmation affichee juste apres une regeneration reussie
  // (nombre de questions du nouvel examen), + reference vers le bloc
  // "Examen et corrigé" pour y faire defiler automatiquement : sans ca,
  // le nouvel examen remplaçait bien examen.questions, mais silencieusement
  // -- rien n'indiquait a l'enseignant qu'autre chose etait apparu plus
  // haut sur la page, hors de son champ de vision au moment du clic.
  const [regenerationReussie, setRegenerationReussie] = useState(null)
  const apercuRef = useRef(null)

  async function handleRegenerer() {
    setErreurRegeneration(null)
    setRegenerationReussie(null)
    setRegenerationEnCours(true)
    try {
      const nouvelExamen = await regenererExamen(notesRegeneration.trim() || undefined)
      setNotesRegeneration('')
      setRegenerationReussie({ nombreQuestions: nouvelExamen?.questions?.length ?? examen.questions.length })
      apercuRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      // regenererExamen a deja remis examen.validation a null (comme le
      // fait le backend, voir database.modifier_questions_examen) --
      // le useEffect ci-dessous relance alors lancerValidation()
      // automatiquement, comme apres une premiere generation.
    } catch (e) {
      setErreurRegeneration(e?.message || 'La régénération a échoué.')
    } finally {
      setRegenerationEnCours(false)
    }
  }

  // NOUVEAU -- corrige un bug reel : les recommandations affichees
  // "changeaient" ou "disparaissaient" apres un court instant. Cause :
  // ce useEffect ne se protegeait pas contre un DOUBLE appel -- React 18
  // en StrictMode (dev) invoque volontairement les effets deux fois au
  // montage pour detecter les bugs de nettoyage, donc lancerValidation()
  // partait deux fois EN PARALLELE. Chaque appel relance une VRAIE
  // analyse par l'IA (non deterministe : les recommandations ne sont
  // jamais mot pour mot identiques d'un appel a l'autre) -- la reponse
  // du second appel a atterrir ecrasait celle du premier deja affichee,
  // ou un des deux echouait et laissait "aucune recommandation".
  // `validationEnVolRef` garantit qu'un seul appel reel part a la fois.
  const validationEnVolRef = useRef(false)

  useEffect(() => {
    if (examen.id && !validation && !validationEnVolRef.current) {
      validationEnVolRef.current = true
      lancerValidation()
        .catch(() => {})
        .finally(() => { validationEnVolRef.current = false })
    }
    // `validation` est maintenant dans les dependances (elle ne l'etait
    // pas avant) : c'est ce qui permet une RE-validation automatique
    // apres une regeneration (regenererExamen remet validation a null,
    // voir handleRegenerer plus haut) sans que l'utilisateur ait besoin
    // de cliquer sur "Revalider le contenu" a la main.
  }, [examen.id, validation])

  // NOUVEAU -- une fois que la revalidation automatique (ci-dessus) a
  // fini et rapporte un nouveau `validation`, la confirmation "en cours"
  // n'a plus lieu d'etre : le bandeau retombe a son etat normal.
  useEffect(() => {
    if (validation && regenerationReussie) {
      setRegenerationReussie(null)
    }
  }, [validation])

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
        @keyframes examaiOrbitPulse {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.08); opacity: 1; }
        }
        @keyframes examaiScanLine {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(400%); }
        }
        @keyframes examaiFadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes examaiDot {
          0%, 20% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.1); }
          80%, 100% { opacity: 0.3; transform: scale(0.8); }
        }

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

        {/* ===== EN-TÊTE ===== */}
        <div className="relative mb-6 w-full overflow-hidden rounded-[28px] border border-[#0f172a]/20 bg-white p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="examai-serif text-[30px] sm:text-[40px] lg:text-[42px] font-semibold tracking-[-0.025em] text-[#0f172a] leading-[1.15]">
                Vérification{' '}
                <span className="text-[#7a0008] relative">
                  <span className="examai-underline-wave">et validation.</span>
                </span>
              </h1>
              <p className="examai-serif mt-3 text-[14px] sm:text-[15px] font-normal italic leading-[1.6] text-[#0f172a]/75">
                L'IA analyse votre examen et vous indique les points à améliorer.
              </p>
            </div>

            {validation && (
              <div
                className={`flex shrink-0 items-center gap-2 rounded-full border-2 px-3 py-1.5 text-[11.5px] font-semibold transition-all ${
                  validation.peut_valider
                    ? 'border-emerald-500 bg-emerald-50/40'
                    : 'border-amber-300 bg-amber-50/40'
                }`}
              >
                {validation.peut_valider ? (
                  <>
                    <Check size={12} className="text-emerald-600" strokeWidth={3} />
                    <span className="font-bold text-emerald-700">Prêt à valider</span>
                  </>
                ) : (
                  <>
                    <span className="examai-pulse h-2 w-2 rounded-full bg-amber-500" />
                    <span className="font-bold text-amber-700">Corrections requises</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ===== ERREUR ===== */}
        {error && (
          <div role="alert" className="mb-5 flex items-start gap-3 rounded-[16px] border border-[#7a0008]/40 bg-[#0f172a]/[0.035] p-4 text-[13px] text-[#0f172a]">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#7a0008]/10">
              <AlertTriangle size={14} className="text-[#7a0008]" />
            </span>
            <span className="min-w-0 break-words pt-0.5 font-medium">{error}</span>
          </div>
        )}

        {/* ===== Étapes du parcours ===== */}
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

        {/* ===== AJOUT : examen + corrigé visibles pendant la validation
            (aucun appel réseau — dérivé de examen.questions déjà en
            mémoire) : la case "Corrigé complet" ajoutée côté backend
            (validation.py) apparaît déjà automatiquement dans la liste
            des checks plus bas, sans rien changer ici ; ce bloc ajoute en
            plus le CONTENU (questions + bonnes réponses), pas seulement
            le verdict. ===== */}
        {examen.id && (
          <div
            ref={apercuRef}
            className={`mb-5 rounded-[24px] border p-5 transition-colors ${
              regenerationReussie ? 'border-[#7a0008]/40 bg-[#7a0008]/[0.03]' : 'border-emerald-300/70 bg-emerald-50/40'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] ${
                  regenerationReussie ? 'bg-[#7a0008]/[0.1] text-[#7a0008]' : 'bg-emerald-100 text-emerald-700'
                }`}>
                  {regenerationReussie ? <RefreshCw size={15} /> : <CheckCircle2 size={15} />}
                </span>
                <div className="min-w-0">
                  <p className="examai-serif text-[15px] font-semibold text-[#0f172a]">
                    {regenerationReussie ? 'Nouvel examen régénéré' : 'Examen et corrigé'}
                  </p>
                  <p className="text-[10.5px] font-bold italic text-[#0f172a]/45">
                    {regenerationReussie
                      ? `${regenerationReussie.nombreQuestions} question${regenerationReussie.nombreQuestions > 1 ? 's' : ''} — relisez avant de valider`
                      : 'Bonnes réponses en évidence, à relire avant de valider'}
                  </p>
                </div>
              </div>
              {/* NOUVEAU -- va directement editer les questions (utile
                  surtout apres une regeneration : corriger un detail sans
                  attendre la revalidation automatique). */}
              <button
                onClick={() => navigate('/wizard/edition')}
                className={`flex shrink-0 items-center gap-1.5 rounded-full border border-[#0f172a]/20 bg-white px-3.5 py-2 text-[12px] font-semibold text-[#0f172a] transition-all hover:-translate-y-0.5 hover:border-[#0f172a]/50 hover:bg-[#0f172a]/[0.03] ${FOCUS_RING} ${HOVER_LIFT}`}
              >
                <Pencil size={12} /> Éditer les questions
              </button>
            </div>

            <div className="mt-3 max-h-80 space-y-2 overflow-y-auto rounded-[14px] border border-emerald-200 bg-white p-3">
              {(examen.questions || []).length === 0 ? (
                <p className="text-[11px] italic text-[#0f172a]/40">Aucune question.</p>
              ) : (
                examen.questions.map((q, i) => (
                  <div key={q.id ?? i} className="rounded-[10px] border border-[#0f172a]/10 bg-[#0f172a]/[0.02] p-2.5">
                    <p className="text-[11.5px] font-semibold text-[#0f172a]">
                      {i + 1}. {q.question || <span className="italic text-[#0f172a]/40">Énoncé vide</span>}
                    </p>

                    {q.type === 'qcm' && (
                      <ul className="mt-1.5 space-y-0.5">
                        {(q.options || []).map((o, j) => (
                          <li
                            key={j}
                            className={`flex items-center gap-1.5 text-[11px] ${
                              j === q.reponseCorrecteIndex ? 'font-bold text-emerald-700' : 'text-[#0f172a]/55'
                            }`}
                          >
                            {j === q.reponseCorrecteIndex && (
                              <Check size={10} strokeWidth={3} className="shrink-0 text-emerald-600" />
                            )}
                            {String.fromCharCode(65 + j)}. {o}
                          </li>
                        ))}
                      </ul>
                    )}

                    {q.type === 'vrai_faux' && (
                      <p className="mt-1 text-[11px] font-bold text-emerald-700">
                        Réponse correcte : {q.reponseCorrecte ? 'Vrai' : 'Faux'}
                      </p>
                    )}

                    {(q.type === 'ouverte' || q.type === 'texte_trous') && (
                      <p className="mt-1 text-[11px] font-bold text-emerald-700">
                        Réponse attendue :{' '}
                        {q.reponseAttendue || (
                          <span className="italic font-normal text-[#0f172a]/40">Non renseignée</span>
                        )}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
        {/* ===== FIN AJOUT ===== */}

        {/* ===== CHARGEMENT — ANALYSE EN COURS ===== */}
        {loading && !validation && <AnalyseLoader />}

        {/* ===== VALIDATION ===== */}
        {validation && (
          <>
            <div className="grid gap-5 lg:grid-cols-[1fr_360px] lg:items-start">

              {/* ===== ANALYSE ===== */}
              <div className="min-w-0 rounded-[24px] border border-[#0f172a]/20 bg-white p-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-[#0f172a]/[0.08] text-[#0f172a]">
                      <ShieldCheck size={17} />
                    </span>
                    <div className="min-w-0">
                      <p className="examai-serif truncate text-[16.5px] font-semibold text-[#0f172a]">Analyse de l'IA</p>
                      <p className="mt-0.5 truncate text-[11.5px] text-[#0f172a]/50">Contenu, cohérence et barème</p>
                    </div>
                  </div>

                  <button
                    onClick={() => navigate('/wizard/edition')}
                    className={`flex shrink-0 items-center gap-1.5 rounded-full border border-[#0f172a]/20 bg-white px-3 py-1.5 text-[11.5px] font-semibold text-[#0f172a]/70 transition-all hover:-translate-y-0.5 hover:border-[#0f172a]/50 hover:text-[#0f172a] ${FOCUS_RING} ${HOVER_LIFT}`}
                  >
                    <ArrowLeft size={12} strokeWidth={2.4} />
                    Retour à l'édition
                  </button>
                </div>

                <div className="mt-6 flex flex-col items-center">
                  <ScoreGauge score={validation.score} />

                  <div className="mt-4 flex items-center gap-2">
                    <span
                      className="rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider"
                      style={{ backgroundColor: `${scoreColor(validation.score)}1a`, color: scoreColor(validation.score) }}
                    >
                      {scoreLabel(validation.score)}
                    </span>
                  </div>

                  <p className="examai-serif mt-3 max-w-md text-center text-[15px] font-semibold text-[#0f172a]">{validation.resume}</p>
                </div>

                <div className="mt-6 space-y-2">
                  {validation.checks.map((c) => (
                    <div
                      key={c.label}
                      className={`flex items-center gap-2.5 rounded-[12px] border px-3.5 py-2.5 text-[13px] font-medium ${
                        c.ok
                          ? 'border-emerald-500/30 bg-emerald-50/40 text-emerald-800'
                          : 'border-[#7a0008]/30 bg-[#7a0008]/[0.04] text-[#7a0008]'
                      }`}
                    >
                      {c.ok ? (
                        <CheckCircle2 size={15} className="shrink-0 text-emerald-600" />
                      ) : (
                        <AlertTriangle size={15} className="shrink-0 text-[#7a0008]" />
                      )}
                      {c.label}
                    </div>
                  ))}
                </div>

                {validation.avertissements.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {validation.avertissements.map((a) => (
                      <div
                        key={a}
                        className="flex items-center gap-2.5 rounded-[12px] border border-[#d4a76a]/40 bg-[#d4a76a]/[0.1] px-3.5 py-2.5 text-[13px] font-medium text-[#8a5a1f]"
                      >
                        <AlertTriangle size={15} className="shrink-0" />
                        {a}
                      </div>
                    ))}
                  </div>
                )}

                {!validation.peut_valider && (
                  <div role="alert" className="mt-4 flex items-start gap-2.5 rounded-[14px] border border-[#7a0008]/30 bg-[#7a0008]/[0.04] p-3.5 text-[12.5px] font-bold text-[#7a0008]">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                    Corrigez les points signalés en rouge avant de pouvoir valider cet examen.
                  </div>
                )}

                <button
                  onClick={() => lancerValidation().catch(() => {})}
                  disabled={loading}
                  className={`mt-6 flex w-full items-center justify-center gap-2 rounded-full border-2 border-[#0f172a]/30 bg-white py-2.5 text-[13.5px] font-bold text-[#0f172a] transition-all hover:-translate-y-0.5 hover:border-[#0f172a]/60 hover:bg-[#0f172a]/[0.04] disabled:opacity-50 disabled:hover:translate-y-0 ${FOCUS_RING} ${HOVER_LIFT}`}
                >
                  {loading ? <Loader2 size={15} className="animate-spin" /> : <RotateCcw size={15} />}
                  Revalider le contenu
                </button>
              </div>

              {/* ===== RECOMMANDATIONS ===== */}
              <div className="h-fit min-w-0 rounded-[24px] border border-[#0f172a]/20 bg-white p-5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[#0f172a]/[0.08] text-[#0f172a]">
                      <Lightbulb size={15} />
                    </span>
                    <div className="min-w-0">
                      <p className="examai-serif text-[15.5px] font-semibold text-[#0f172a]">Recommandations</p>
                      <p className="text-[10.5px] font-bold italic text-[#0f172a]/45">
                        Suggestions de l'IA pour améliorer
                      </p>
                    </div>
                  </div>
                  {validation.recommandations.length > 0 && (
                    <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-[#0f172a] px-2 text-[11px] font-bold text-white">
                      {validation.recommandations.length}
                    </span>
                  )}
                </div>

                {validation.recommandations.length === 0 ? (
                  <div className="mt-4 flex flex-col items-center gap-2 rounded-[16px] border border-dashed border-emerald-500/30 bg-emerald-50/40 px-4 py-6 text-center">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                      <CheckCircle2 size={20} className="text-emerald-600" strokeWidth={2.2} />
                    </span>
                    <p className="text-[13px] font-bold text-emerald-800">Aucune recommandation</p>
                    <p className="text-[11.5px] italic text-emerald-700/70">
                      Votre examen est bien structuré. Rien à signaler.
                    </p>
                  </div>
                ) : (
                  <ul className="mt-4 space-y-2.5">
                    {validation.recommandations.map((r, idx) => {
                      const { icon: Icon, tone, label } = analyserRecommandation(r)
                      const t = TONES[tone]

                      return (
                        <li
                          key={`${r}-${idx}`}
                          className={`group flex items-start gap-3 rounded-[14px] border ${t.border} ${t.bg} p-3.5 transition-all hover:shadow-[0_6px_16px_-10px_rgba(15,23,42,0.15)]`}
                        >
                          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] ${t.icon}`}>
                            <Icon size={14} strokeWidth={2.2} />
                          </span>

                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex items-center gap-2">
                              <span className={`text-[9.5px] font-bold uppercase tracking-wider ${t.label}`}>
                                {label}
                              </span>
                              <span className="text-[9.5px] font-medium text-[#0f172a]/30">
                                · Conseil {idx + 1}
                              </span>
                            </div>

                            <p className="text-[12.5px] font-medium leading-snug text-[#0f172a]/85">
                              {r}
                            </p>
                          </div>

                          <ChevronRight
                            size={14}
                            className="mt-1.5 shrink-0 text-[#0f172a]/20 transition-all group-hover:translate-x-0.5 group-hover:text-[#0f172a]/40"
                            strokeWidth={2.4}
                          />
                        </li>
                      )
                    })}
                  </ul>
                )}

                {validation.recommandations.length > 0 && (
                  <div className="mt-4 flex items-start gap-2 rounded-[12px] border border-[#0f172a]/15 bg-[#0f172a]/[0.02] p-3">
                    <Sparkles size={12} className="mt-0.5 shrink-0 text-[#0f172a]/50" strokeWidth={2.2} />
                    <p className="text-[11px] font-medium leading-snug text-[#0f172a]/55">
                      Appliquez ces suggestions dans l'étape <span className="font-bold text-[#7a0008]">Édition</span>, puis revalidez.
                    </p>
                  </div>
                )}

                {/* ===== NOUVEAU : régénérer directement en tenant compte
                    des recommandations, sans repasser par l'édition
                    manuelle -- l'IA reçoit les recommandations
                    ci-dessus + une consigne libre optionnelle.
                    CORRIGE -- seulement si examenRegenerable : sinon
                    (examen cree depuis un PDF ou assemble depuis la
                    Banque de Questions, sans `chapitres`), ce bouton
                    menait a coup sur a une erreur 422 au clic. On
                    explique pourquoi a la place, plutot que de laisser
                    l'enseignant decouvrir la limite en cliquant. ===== */}
                {validation.recommandations.length > 0 && (
                  examenRegenerable ? (
                    <div className="mt-3 rounded-[14px] border border-[#7a0008]/20 bg-[#7a0008]/[0.03] p-3.5">
                      <div className="flex items-center gap-2">
                        <RefreshCw size={13} className="shrink-0 text-[#7a0008]" strokeWidth={2.2} />
                        <p className="text-[12px] font-bold text-[#7a0008]">
                          Ou laissez l'IA régénérer l'examen selon ces recommandations
                        </p>
                      </div>

                      <div className="relative mt-2.5">
                        <PenLine size={12} className="pointer-events-none absolute left-3 top-2.5 text-[#0f172a]/35" aria-hidden="true" />
                        <textarea
                          value={notesRegeneration}
                          onChange={(e) => setNotesRegeneration(e.target.value)}
                          rows={2}
                          placeholder="Consigne supplémentaire (optionnel) : ex. « garde le même nombre de questions »"
                          aria-label="Consigne supplémentaire pour la régénération"
                          className={`w-full rounded-[10px] border border-[#0f172a]/15 bg-white py-2 pl-8 pr-3 text-[12.5px] text-[#0f172a] outline-none transition-colors placeholder:text-[#0f172a]/35 focus:border-[#7a0008]/40 ${FOCUS_RING}`}
                        />
                      </div>

                      {erreurRegeneration && (
                        <p className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-[#7a0008]">
                          <AlertTriangle size={11} /> {erreurRegeneration}
                        </p>
                      )}

                      <button
                        onClick={handleRegenerer}
                        disabled={regenerationEnCours || loading}
                        className={`mt-2.5 flex w-full items-center justify-center gap-2 rounded-full bg-[#7a0008] py-2.5 text-[12.5px] font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-[#961014] active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 ${FOCUS_RING} ${HOVER_LIFT}`}
                      >
                        {regenerationEnCours ? (
                          <><Loader2 size={14} className="animate-spin" /> Régénération…</>
                        ) : (
                          <><RefreshCw size={13} /> Régénérer selon les recommandations</>
                        )}
                      </button>
                    </div>
                  ) : (
                    <div className="mt-3 rounded-[14px] border border-[#0f172a]/15 bg-[#0f172a]/[0.02] p-3.5">
                      <div className="flex items-start gap-2">
                        <AlertTriangle size={13} className="mt-0.5 shrink-0 text-[#0f172a]/45" />
                        <p className="text-[11.5px] font-medium leading-snug text-[#0f172a]/60">
                          Cet examen a été créé depuis un PDF (ou assemblé depuis la Banque de
                          Questions) : la régénération automatique par l'IA n'est pas
                          disponible pour ce type d'examen. Appliquez les recommandations
                          ci-dessus manuellement à l'étape{' '}
                          <span className="font-bold text-[#0f172a]">Édition</span>, ou
                          réimportez le document via « Nouvel examen depuis un PDF » pour
                          repartir de zéro.
                        </p>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>

            {/* ===== BARRE FLOTTANTE COMPACTE ===== */}
            <div className="sticky bottom-4 z-20 mt-5 w-full">
              <div className="w-full overflow-hidden rounded-[20px] border border-[#0f172a]/20 bg-white shadow-[0_14px_32px_-14px_rgba(15,23,42,0.25)]">
                <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">

                  <div className="flex flex-wrap items-center gap-2 text-[12px] text-[#0f172a]/60">
                    <span className="flex items-center gap-1.5">
                      <span
                        className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold"
                        style={{ backgroundColor: `${scoreColor(validation.score)}1a`, color: scoreColor(validation.score) }}
                      >
                        {validation.score}
                      </span>
                      Score de qualité
                    </span>
                    {!validation.peut_valider && (
                      <>
                        <span className="h-3 w-px bg-[#0f172a]/15" />
                        <span className="flex items-center gap-1 rounded-full bg-[#7a0008]/[0.08] px-2 py-0.5 text-[10.5px] font-bold text-[#7a0008]">
                          <AlertTriangle size={10} />
                          Corrections requises
                        </span>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => navigate('/wizard/edition')}
                      className={`group flex shrink-0 items-center justify-center gap-1.5 rounded-full border-2 border-[#0f172a]/25 bg-white px-4 py-2.5 text-[12.5px] font-semibold text-[#0f172a] transition-all hover:-translate-y-0.5 hover:border-[#0f172a]/60 hover:bg-[#0f172a]/[0.04] active:scale-[0.985] ${FOCUS_RING} ${HOVER_LIFT}`}
                    >
                      <ArrowLeft size={14} strokeWidth={2.4} />
                      Retour à l'édition
                    </button>

                    {/* ✅ Bouton "Valider l'examen" — SANS gradient */}
                    <button
                      onClick={() => navigate('/wizard/export')}
                      disabled={!validation.peut_valider || loading}
                      className={`group relative flex shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-full bg-[#7a0008] px-5 py-2.5 text-[12.5px] font-semibold text-white shadow-[0_1px_2px_rgba(15,23,42,0.2),0_10px_22px_-10px_rgba(122,0,8,0.55),inset_0_1px_0_rgba(255,255,255,0.15)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#961014] hover:shadow-[0_1px_2px_rgba(15,23,42,0.25),0_14px_30px_-10px_rgba(122,0,8,0.7),inset_0_1px_0_rgba(255,255,255,0.2)] active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:bg-[#7a0008] disabled:hover:shadow-[0_1px_2px_rgba(15,23,42,0.2),0_10px_22px_-10px_rgba(122,0,8,0.55),inset_0_1px_0_rgba(255,255,255,0.15)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${FOCUS_RING}`}
                    >
                      <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />

                      <span className="relative">Valider l'examen</span>
                      <ArrowRight
                        size={14}
                        strokeWidth={2.4}
                        className="relative transition-transform duration-200 group-hover:translate-x-1 motion-reduce:group-hover:translate-x-0"
                      />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </WizardShell>
  )
}

/* ===== LOADER D'ANALYSE ===== */
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

        {/* ✅ Icône centrale — SANS gradient */}
        <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-[#7a0008] shadow-[0_8px_24px_-6px_rgba(122,0,8,0.6)]">
          <Sparkles size={24} className="text-white" strokeWidth={2} />
        </div>
      </div>

      <div className="relative flex flex-col items-center gap-2 text-center">
        <h3 className="examai-serif text-[18px] font-semibold text-[#0f172a]">
          Analyse en cours
        </h3>
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
              <span className="text-[12px] font-medium text-[#0f172a]/70">
                {etape.label}
              </span>
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

/* ===== SCORE GAUGE ===== */
function ScoreGauge({ score }) {
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const color = scoreColor(score)

  return (
    <div className="relative flex h-36 w-36 items-center justify-center">
      <svg viewBox="0 0 128 128" className="h-36 w-36 -rotate-90">
        <circle cx="64" cy="64" r={radius} fill="none" stroke={color} strokeOpacity="0.12" strokeWidth="12" />
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 600ms cubic-bezier(0.22, 1, 0.36, 1)' }}
        />
      </svg>
      <span className="examai-serif absolute text-2xl font-semibold text-[#0f172a]">{score}%</span>
    </div>
  )
}