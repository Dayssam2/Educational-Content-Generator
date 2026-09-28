import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Loader2, AlertTriangle, Check, GraduationCap, BookOpen, Layers,
  ListChecks, ArrowRight, CheckCircle2, Hash, Gauge, Clock, Pencil,
  FileText, SlidersHorizontal, Minus, Plus, X, Search, PenLine, ImagePlus,
} from 'lucide-react'
import WizardShell from '../../components/WizardShell.jsx'
import { useWizard } from '../../context/WizardContext.jsx'
import { api } from '../../api/client.js'
import { NIVEAUX, MATIERE_LABEL, TYPES_QUESTIONS } from '../../data/mockData.js'

const NB_QUESTIONS_OPTIONS = [5, 8, 10, 12, 15, 20]
const DIFFICULTE_OPTIONS = ['Facile', 'Moyenne', 'Difficile']
const DUREE_OPTIONS = [30, 45, 60, 90]

const WIZARD_STEPS = [
  { n: 1, label: 'Sélection' },
  { n: 2, label: 'Édition' },
  { n: 3, label: 'Validation' },
  { n: 4, label: 'Export' },
]
const CURRENT_STEP = 1

const ARABIC_RE = /[\u0600-\u06FF]/
function estArabe(t) { return typeof t === 'string' && ARABIC_RE.test(t) }

function normaliserNiveau(label = '') {
  if (!label) return ''
  return String(label)
    .replace(/\b1\s*(?:ère|ere|er|re|ème|eme)\b/gi, '1ʳᵉ')
    .replace(/(\d+)\s*(?:ème|eme|éme|EME|ÈME)\b/gi, '$1ᵉ')
    .replace(/\bannee\b/gi, 'année')
    .replace(/\bquatrieme\b/gi, 'Quatrième')
    .replace(/\bcinquieme\b/gi, 'Cinquième')
    .replace(/\bsixieme\b/gi, 'Sixième')
    .replace(/\bpremiere\b/gi, 'Première')
    .replace(/\bdeuxieme\b/gi, 'Deuxième')
    .replace(/\btroisieme\b/gi, 'Troisième')
}

function numeroNiveau(label = '', fallback = '') {
  const m = String(label).match(/\d+/)
  return m ? m[0] : fallback
}

function normaliserTexte(str = '') {
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f172a]/35 focus-visible:ring-offset-2'
const HOVER_LIFT = 'motion-reduce:transition-none motion-reduce:hover:translate-y-0'

export default function Selection() {
  const navigate = useNavigate()
  const { genererExamen, loading, error, setError } = useWizard()

  const [niveau, setNiveau] = useState('')
  const [matiere, setMatiere] = useState('')
  const [chapitre, setChapitre] = useState('')
  const [nbQuestions, setNbQuestions] = useState(10)
  const [difficulte, setDifficulte] = useState('Moyenne')
  const [duree, setDuree] = useState(60)
  const [typesQuestions, setTypesQuestions] = useState([])
  // NOUVEAU -- repartition optionnelle du nombre de questions par type
  // selectionne (ex: {qcm: 4, texte_trous: 4, ouverte: 2} pour 10
  // questions au total -- voir main.py:ExamenCreateIn.repartition_types).
  // Cle = id du type (voir TYPES_QUESTIONS), valeur = nombre voulu. Une
  // cle absente ou a 0 veut dire "l'IA decide librement pour ce type".
  const [repartitionTypes, setRepartitionTypes] = useState({})
  // NOUVEAU -- consignes libres transmises a l'IA en plus des parametres
  // structures ci-dessus (voir handleGenerer et main.py/quiz_engine.py).
  const [notes, setNotes] = useState('')
  // NOUVEAU -- image fournie par l'enseignant pour construire UNE question
  // "legende" a partir d'une image REELLE (voir handleGenerer et
  // main.py:_ajouter_question_legende_uploadee) plutot que de laisser
  // l'IA imaginer sa propre description. `imageLegende` est la data URI
  // base64 (ce que le backend attend, meme convention que ImageRef.url) ;
  // `imageLegendeNom` est juste le nom du fichier, pour l'affichage.
  const [imageLegende, setImageLegende] = useState(null)
  const [imageLegendeNom, setImageLegendeNom] = useState('')
  const imageLegendeInputRef = useRef(null)
  const [nbQuestionsManuel, setNbQuestionsManuel] = useState(false)
  const [dureeManuelle, setDureeManuelle] = useState(false)
  const [showRecap, setShowRecap] = useState(false)

  const [rechercheChapitre, setRechercheChapitre] = useState('')

  const [matieresDispo, setMatieresDispo] = useState([])
  const [chapitresDispo, setChapitresDispo] = useState([])
  const [chargementMatieres, setChargementMatieres] = useState(false)
  const [chargementChapitres, setChargementChapitres] = useState(false)

  useEffect(() => {
    if (!niveau) {
      setMatieresDispo([])
      setMatiere('')
      return
    }
    let annule = false
    setChargementMatieres(true); setError(null)
    api.getMatieres(niveau)
      .then((data) => {
        if (annule) return
        setMatieresDispo(data.matieres)
        setMatiere('')
      })
      .catch((e) => !annule && setError(e.message))
      .finally(() => !annule && setChargementMatieres(false))
    return () => { annule = true }
  }, [niveau])

  useEffect(() => {
    if (!matiere || !niveau) { setChapitresDispo([]); setChapitre(''); return }
    let annule = false
    setChargementChapitres(true)
    api.getChapitres(matiere, niveau)
      .then((data) => {
        if (annule) return
        setChapitresDispo(data.chapitres)
        setChapitre('')
        setRechercheChapitre('')
      })
      .catch((e) => !annule && setError(e.message))
      .finally(() => !annule && setChargementChapitres(false))
    return () => { annule = true }
  }, [matiere, niveau])

  useEffect(() => {
    if (!showRecap) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (e) => { if (e.key === 'Escape') setShowRecap(false) }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [showRecap])

  function toggleType(id) {
    setTypesQuestions((p) => {
      const estActif = p.includes(id)
      // NOUVEAU -- decocher "legende" retire aussi l'image associee : sinon
      // elle resterait en memoire et serait quand meme envoyee dans
      // handleGenerer (voir image_legende plus bas) alors que le type
      // n'est plus selectionne -- le bloc d'upload disparaissant en meme
      // temps (voir plus bas, affichage conditionne sur typesQuestions).
      if (estActif && id === 'legende') {
        setImageLegende(null)
        setImageLegendeNom('')
      }
      // NOUVEAU -- decocher un type retire aussi son chiffre de repartition
      // (voir repartitionTypes) : un chiffre pour un type qui n'est plus
      // demande n'aurait aucun sens a envoyer au backend.
      if (estActif) {
        setRepartitionTypes((r) => {
          const { [id]: _retire, ...reste } = r
          return reste
        })
      }
      return estActif ? p.filter((t) => t !== id) : [...p, id]
    })
  }
  function handleNbQuestionsInput(v) {
    const d = v.replace(/\D/g, '')
    if (d === '') return setNbQuestions('')
    setNbQuestions(Math.min(100, Math.max(1, Number(d))))
  }
  function handleDureeInput(v) {
    const d = v.replace(/\D/g, '')
    if (d === '') return setDuree('')
    setDuree(Math.min(300, Math.max(5, Number(d))))
  }
  function increment(field, delta) {
    if (field === 'nb') {
      setNbQuestions(Math.min(100, Math.max(1, Number(nbQuestions || 0) + delta)))
    } else {
      setDuree(Math.min(300, Math.max(5, Number(duree || 0) + delta)))
    }
  }
  function selectNbPreset(v) {
    setNbQuestionsManuel(false)
    setNbQuestions(Number(v))
  }
  function selectDureePreset(v) {
    setDureeManuelle(false)
    setDuree(Number(v))
  }

  // NOUVEAU -- conversion du fichier choisi en data URI base64 (meme
  // fonction que celle deja ecrite dans Edition.jsx pour l'upload
  // d'image apres generation -- ici c'est juste AVANT).
  function handleFichierImageLegende(e) {
    const fichier = e.target.files?.[0]
    e.target.value = ''
    if (!fichier) return
    const reader = new FileReader()
    reader.onload = () => {
      setImageLegende(reader.result)
      setImageLegendeNom(fichier.name)
    }
    reader.readAsDataURL(fichier)
  }

  async function handleGenerer() {
    if (!niveau) return setError('Choisis un niveau.')
    if (!matiere || !chapitre) return setError('Choisis une matière et un chapitre.')
    if (typesQuestions.length === 0) return setError('Choisis au moins un type de question.')
    if (!nbQuestions || Number(nbQuestions) < 1) return setError('Nombre de questions invalide.')
    if (!duree || Number(duree) < 5) return setError('Durée invalide.')
    // NOUVEAU -- si l'enseignant a commence a remplir une repartition par
    // type (totalRepartition > 0), elle doit correspondre EXACTEMENT au
    // nombre de questions choisi -- meme verification refaite cote
    // backend (voir main.py:creer_examen), mais autant le dire ici avant
    // de lancer la generation.
    if (totalRepartition > 0 && totalRepartition !== Number(nbQuestions)) {
      return setError(
        `La répartition par type (${totalRepartition}) ne correspond pas au nombre de questions choisi (${nbQuestions}).`
      )
    }
    try {
      await genererExamen({
        matiere, niveau, chapitres: [chapitre],
        nb_questions: Number(nbQuestions), difficulte,
        duree_minutes: Number(duree),
        types_questions: typesQuestions,
        notes: notes.trim() || undefined,
        image_legende: imageLegende || undefined,
        repartition_types: totalRepartition > 0 ? repartitionTypes : undefined,
      })
      navigate('/wizard/edition')
    } catch {}
  }

  const niveauActuel = NIVEAUX.find((n) => n.id === niveau)
  const niveauLabel = normaliserNiveau(niveauActuel?.label || '')
  const matiereLabel = matiere ? MATIERE_LABEL[matiere] || matiere : null
  const dureeLabel = duree ? `${duree} min` : ''
  const pretAGenerer = Boolean(niveau && matiere && chapitre && typesQuestions.length > 0 && nbQuestions && duree && !loading)
  // NOUVEAU -- somme des chiffres de repartition par type (voir
  // repartitionTypes) : 0 veut dire "personne n'a rien rempli, l'IA
  // decide librement", sinon la somme doit correspondre a nbQuestions
  // (verifie dans handleGenerer, et a nouveau cote backend dans
  // creer_examen -- voir main.py).
  const totalRepartition = Object.values(repartitionTypes).reduce((s, n) => s + (Number(n) || 0), 0)

  const chapitresFiltres = (() => {
    const q = normaliserTexte(rechercheChapitre.trim())
    if (!q) return chapitresDispo
    return chapitresDispo.filter((c) => normaliserTexte(c).includes(q))
  })()

  return (
    <WizardShell step={1} hideStepper>
      <style>{`
        @keyframes examaiModalFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes examaiModalSlideUp { from { opacity: 0; transform: translateY(16px) scale(0.98) } to { opacity: 1; transform: translateY(0) scale(1) } }

        @keyframes examaiAlertIn {
          0%   { opacity: 0; transform: translateY(-10px) scale(0.97); }
          55%  { opacity: 1; transform: translateY(0) scale(1.005); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes examaiAlertBar {
          0%   { transform: scaleY(0); }
          100% { transform: scaleY(1); }
        }
        @keyframes examaiAlertDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%      { opacity: 0.65; transform: scale(0.85); }
        }
        @keyframes examaiAlertPing {
          0%   { opacity: 0.55; transform: scale(1); }
          80%  { opacity: 0;    transform: scale(2.4); }
          100% { opacity: 0;    transform: scale(2.4); }
        }
        @keyframes examaiAlertHalo {
          0%, 100% { opacity: 0.5; }
          50%      { opacity: 1; }
        }
        @keyframes examaiAlertTitle {
          0%   { opacity: 0; transform: translateX(-4px); }
          100% { opacity: 1; transform: translateX(0); }
        }
        @keyframes examaiAlertSubtitle {
          0%   { opacity: 0; transform: translateX(-4px); }
          100% { opacity: 1; transform: translateX(0); }
        }
        @keyframes examaiTextGlowNeutral {
          0%, 100% { opacity: 1; text-shadow: 0 0 0 rgba(15,23,42,0); }
          50%      { opacity: 0.55; text-shadow: 0 0 8px rgba(15,23,42,0.35), 0 0 16px rgba(15,23,42,0.15); }
        }
        @keyframes examaiTextGlowWarning {
          0%, 100% { opacity: 1; text-shadow: 0 0 0 rgba(122,0,8,0); }
          50%      { opacity: 0.6; text-shadow: 0 0 8px rgba(122,0,8,0.4), 0 0 16px rgba(122,0,8,0.2); }
        }

        .examai-modal-backdrop { animation: examaiModalFadeIn 200ms ease-out both; }
        .examai-modal-panel { animation: examaiModalSlideUp 240ms cubic-bezier(0.22, 1, 0.36, 1) both; }

        .examai-alert { animation: examaiAlertIn 0.48s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .examai-alert-bar { transform-origin: top; animation: examaiAlertBar 0.55s cubic-bezier(0.22, 1, 0.36, 1) 0.1s both; }
        .examai-alert-dot { animation: examaiAlertDot 2.2s ease-in-out infinite; }
        .examai-alert-ping { animation: examaiAlertPing 2.2s cubic-bezier(0, 0, 0.2, 1) infinite; }
        .examai-alert-halo { animation: examaiAlertHalo 3s ease-in-out infinite; }
        .examai-alert-title { animation: examaiAlertTitle 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.15s both; }
        .examai-alert-subtitle { animation: examaiAlertSubtitle 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.25s both; }

        .examai-text-glow-neutral { animation: examaiTextGlowNeutral 2.6s ease-in-out infinite; }
        .examai-text-glow-warning { animation: examaiTextGlowWarning 2.6s ease-in-out infinite; }

        .examai-underline-wave {
          background-color: rgba(122,0,8,0.12);
          background-repeat: no-repeat;
          background-size: 100% 0.35em;
          background-position: 0 88%;
          padding: 0 0.15em;
        }

        /* ✅ Scrollbar bleu nuit PLEIN */
        .examai-scroll-navy {
          scrollbar-width: thin;
          scrollbar-color: #0f172a rgba(15,23,42,0.12);
        }
        .examai-scroll-navy::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }
        .examai-scroll-navy::-webkit-scrollbar-track {
          background: rgba(15,23,42,0.12);
          border-radius: 999px;
        }
        .examai-scroll-navy::-webkit-scrollbar-thumb {
          background-color: #0f172a;
          background-image: none;
          border-radius: 999px;
          border: 2px solid #ffffff;
        }
        .examai-scroll-navy::-webkit-scrollbar-thumb:hover {
          background-color: #020617;
        }
        .examai-scroll-navy::-webkit-scrollbar-thumb:active {
          background-color: #020617;
        }

        @media (prefers-reduced-motion: reduce) {
          .examai-modal-backdrop, .examai-modal-panel,
          .examai-alert, .examai-alert-bar, .examai-alert-dot, .examai-alert-ping,
          .examai-alert-halo, .examai-alert-title, .examai-alert-subtitle,
          .examai-text-glow-neutral, .examai-text-glow-warning {
            animation: none !important;
            opacity: 1 !important;
            text-shadow: none !important;
          }
        }
      `}</style>
      <div className="w-full max-w-full overflow-x-hidden">

        {/* ===== EN-TÊTE ===== */}
        <div className="relative mb-6 w-full overflow-hidden rounded-[28px] border border-[#0f172a]/20 bg-white p-6 sm:p-8">
          <h1 className="examai-serif text-[30px] sm:text-[40px] lg:text-[42px] font-semibold tracking-[-0.025em] text-[#0f172a] leading-[1.15]">
            Créez votre{' '}
            <span className="text-[#7a0008] relative">
              <span className="examai-underline-wave">Nouvel Examen.</span>
            </span>
          </h1>

          <p className="examai-serif mt-3 text-[14px] sm:text-[15px] font-normal italic leading-[1.6] text-[#0f172a]/75">
            Configurez les paramètres ci-dessous, puis générez votre examen en un clic.
          </p>
        </div>

        {/* ===== ERREUR ===== */}
        {error && (
          <div role="alert" className="examai-alert mb-5 flex items-start gap-3 rounded-[16px] border border-[#7a0008]/40 bg-[#0f172a]/[0.035] p-4 text-[13px] text-[#0f172a]">
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

        {/* ===== SÉLECTION DES PARAMÈTRES ===== */}
        <div className="min-w-0 rounded-[24px] border border-[#0f172a]/20 bg-white p-6">
          <SectionHeader icon={SlidersHorizontal} title="Sélection des paramètres"
            subtitle="Choisissez le niveau, la matière et le chapitre" />

          {/* ===== Niveau ===== */}
          <div className="mt-6">
            <FieldLabel icon={GraduationCap} title="Niveau scolaire" />
            <div className="flex flex-wrap gap-2.5" role="group" aria-label="Niveau scolaire">
              {NIVEAUX.map((n) => {
                const active = n.id === niveau
                const label = normaliserNiveau(n.label)
                const num = numeroNiveau(label, n.id)
                return (
                  <button key={n.id} type="button" onClick={() => setNiveau(n.id)} aria-pressed={active}
                    className={`group relative flex items-center gap-2.5 rounded-[16px] border px-5 py-3 text-[13.5px] font-semibold transition-all duration-200 ${FOCUS_RING} ${HOVER_LIFT} ${
                      active
                        ? 'border-transparent bg-[#7a0008] text-white shadow-[0_10px_28px_-10px_rgba(122,0,8,0.65)]'
                        : 'border-[#0f172a]/12 bg-white text-[#0f172a] hover:-translate-y-0.5 hover:border-[#0f172a]/25 hover:shadow-[0_10px_24px_-12px_rgba(15,23,42,0.2)]'
                    }`}>
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${
                      active ? 'bg-white/20' : 'bg-[#0f172a]/[0.08] text-[#0f172a]/70'
                    }`}>
                      {num}
                    </span>
                    {label}
                    {active && <Check size={14} strokeWidth={3} className="ml-1" />}
                  </button>
                )
              })}
            </div>
          </div>

          {/* ===== Matière ===== */}
          <div className="mt-6">
            <FieldLabel icon={BookOpen} title="Matière"
              hint={
                !niveau ? "Sélectionnez d'abord un niveau"
                  : chargementMatieres ? 'Chargement…'
                  : matieresDispo.length ? `${matieresDispo.length} disciplines disponibles`
                  : ''
              } />
            {!niveau ? (
              <EmptyState
                tone="warning"
                title="Choisissez un niveau d'abord"
                subtitle="Le niveau scolaire détermine les matières disponibles."
              />
            ) : chargementMatieres ? (
              <SkeletonGrid rows={2} cols={3} label="Chargement des matières" />
            ) : matieresDispo.length === 0 ? (
              <EmptyState
                tone="neutral"
                title="Aucune matière disponible"
                subtitle="Essayez un autre niveau ou revenez plus tard."
              />
            ) : (
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3" role="group" aria-label="Matière">
                {matieresDispo.map((m) => {
                  const active = m.id === matiere
                  const label = MATIERE_LABEL[m.id] || m.id
                  return (
                    <button key={m.id} type="button" onClick={() => setMatiere(m.id)} aria-pressed={active}
                      className={`group relative min-w-0 overflow-hidden rounded-[16px] border p-3.5 text-left transition-all duration-200 ${FOCUS_RING} ${HOVER_LIFT} ${
                        active
                          ? 'border-[#7a0008]/40 bg-[#7a0008]/[0.06] shadow-[0_10px_26px_-12px_rgba(122,0,8,0.4)]'
                          : 'border-[#0f172a]/10 bg-white hover:-translate-y-0.5 hover:border-[#0f172a]/20 hover:shadow-[0_10px_24px_-14px_rgba(15,23,42,0.16)]'
                      }`}>
                      <div className="flex items-start justify-between gap-2">
                        <span className={`flex h-9 w-9 items-center justify-center rounded-[11px] text-[13px] font-bold ${
                          active ? 'bg-[#7a0008] text-white' : 'bg-[#0f172a]/[0.07] text-[#0f172a]'
                        }`}>
                          {label.charAt(0).toUpperCase()}
                        </span>
                        {active && <CheckCircle2 size={16} className="text-[#7a0008]" strokeWidth={2.4} />}
                      </div>
                      <p className={`mt-2.5 examai-serif truncate text-[14px] font-semibold ${
                        active ? 'text-[#7a0008]' : 'text-[#0f172a]'
                      }`}>{label}</p>
                      <p className="mt-0.5 text-[11px] text-[#0f172a]/45">{m.nb_chapitres} chapitres</p>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* ===== Chapitre ===== */}
          <div className="mt-6">
            <FieldLabel icon={Layers} title="Chapitre / Thème"
              hint={
                !matiere ? "Sélectionnez d'abord une matière"
                  : chargementChapitres ? 'Chargement…'
                  : chapitresDispo.length ? `${chapitresDispo.length} chapitres`
                  : ''
              } />
            {!matiere ? (
              <EmptyState
                tone="warning"
                title="Choisissez une matière d'abord"
                subtitle="Les chapitres dépendent de la matière sélectionnée."
              />
            ) : chargementChapitres ? (
              <SkeletonGrid rows={3} cols={2} label="Chargement des chapitres" />
            ) : chapitresDispo.length === 0 ? (
              <EmptyState
                tone="neutral"
                title="Aucun chapitre disponible"
                subtitle="Essayez une autre matière ou revenez plus tard."
              />
            ) : (
              <>
                {/* ✅ Barre de recherche — bordure bleu nuit PLEIN */}
                <div className="relative mb-3">
                  <Search
                    size={15}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#0f172a]"
                    strokeWidth={2.4}
                  />
                  <input
                    type="text"
                    value={rechercheChapitre}
                    onChange={(e) => setRechercheChapitre(e.target.value)}
                    placeholder="Rechercher un chapitre…"
                    aria-label="Rechercher un chapitre"
                    className={`w-full rounded-[14px] border-2 border-[#0f172a] bg-white py-2.5 pl-10 pr-10 text-[13.5px] text-[#0f172a] placeholder:text-[#0f172a]/45 focus:border-[#0f172a] focus:outline-none focus:shadow-[0_0_0_4px_rgba(15,23,42,0.18)] transition-all ${FOCUS_RING}`}
                  />
                  {rechercheChapitre && (
                    <button
                      type="button"
                      onClick={() => setRechercheChapitre('')}
                      aria-label="Effacer la recherche"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full text-[#0f172a] transition-colors hover:bg-[#0f172a]/[0.10]"
                    >
                      <X size={13} strokeWidth={2.6} />
                    </button>
                  )}
                </div>

                {/* Résultats — scrollbar bleu nuit PLEIN */}
                {chapitresFiltres.length === 0 ? (
                  <EmptyState
                    tone="neutral"
                    title="Aucun chapitre trouvé"
                    subtitle={`Aucun résultat pour « ${rechercheChapitre} ».`}
                  />
                ) : (
                  <div
                    className="examai-scroll-navy grid max-h-72 gap-2 overflow-y-auto pr-2 sm:grid-cols-2"
                    role="group"
                    aria-label="Chapitre"
                  >
                    {chapitresFiltres.map((c) => {
                      const active = c === chapitre
                      const rtl = estArabe(c)
                      return (
                        <button key={c} type="button" onClick={() => setChapitre(c)} aria-pressed={active}
                          dir={rtl ? 'rtl' : 'ltr'}
                          className={`group flex min-w-0 items-center gap-3 rounded-[14px] border px-4 py-3 transition-all duration-150 ${FOCUS_RING} ${
                            rtl ? 'text-right' : 'text-left'
                          } ${
                            active
                              ? 'border-[#7a0008]/35 bg-[#7a0008]/[0.06] shadow-[0_8px_22px_-12px_rgba(122,0,8,0.35)]'
                              : 'border-[#0f172a]/10 bg-white hover:border-[#0f172a]/20 hover:bg-[#0f172a]/[0.02]'
                          }`}>
                          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                            active ? 'border-[#7a0008] bg-[#7a0008] text-white' : 'border-[#0f172a]/20 text-transparent'
                          }`}>
                            <Check size={11} strokeWidth={3} />
                          </span>
                          <span className={`min-w-0 flex-1 truncate text-[13.5px] ${
                            active ? 'font-semibold text-[#7a0008]' : 'text-[#0f172a]/75'
                          }`}>{c}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </div>

          {/* ===== Types de questions ===== */}
          <div className="mt-6">
            <FieldLabel icon={ListChecks} title="Types de questions"
              hint={
                typesQuestions.length === 0
                  ? 'Aucun sélectionné'
                  : `${typesQuestions.length} sélectionné${typesQuestions.length > 1 ? 's' : ''}`
              } />
            <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="Types de questions">
              {TYPES_QUESTIONS.map((t) => {
                const active = typesQuestions.includes(t.id)
                return (
                  <button key={t.id} type="button" onClick={() => toggleType(t.id)} aria-pressed={active}
                    className={`flex w-full items-center gap-3 rounded-[14px] border px-3.5 py-3 text-left transition-all duration-150 ${FOCUS_RING} ${
                      active
                        ? 'border-[#7a0008]/35 bg-[#7a0008]/[0.05]'
                        : 'border-[#0f172a]/10 bg-white hover:border-[#0f172a]/20 hover:bg-[#0f172a]/[0.02]'
                    }`}>
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all ${
                      active ? 'border-[#7a0008] bg-[#7a0008]' : 'border-[#0f172a]/25'
                    }`}>
                      {active && <Check size={11} strokeWidth={3.5} className="text-white" />}
                    </span>
                    <span className={`min-w-0 flex-1 truncate text-[13px] font-medium ${
                      active ? 'text-[#7a0008]' : 'text-[#0f172a]'
                    }`}>{t.label}</span>
                  </button>
                )
              })}
            </div>

            {/* NOUVEAU -- repartition optionnelle du nombre de questions
                par type (voir repartitionTypes, toggleType, et
                main.py:ExamenCreateIn.repartition_types). N'apparait
                qu'avec 2 types selectionnes ou plus : avec un seul type,
                la "repartition" est evidente (100% de ce type), inutile
                de le demander. */}
            {typesQuestions.length >= 2 && (
              <div className="mt-3 rounded-[14px] border border-[#0f172a]/10 bg-[#0f172a]/[0.02] p-3.5">
                <div className="mb-2.5 flex items-center justify-between gap-2">
                  <p className="text-[11.5px] font-bold text-[#0f172a]/70">
                    Nombre de questions par type (optionnel)
                  </p>
                  <p className={`text-[11px] font-bold ${
                    totalRepartition === 0
                      ? 'text-[#0f172a]/40'
                      : totalRepartition === Number(nbQuestions)
                        ? 'text-emerald-600'
                        : 'text-amber-600'
                  }`}>
                    {totalRepartition === 0 ? 'Répartition libre (IA)' : `${totalRepartition} / ${nbQuestions || 0}`}
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {TYPES_QUESTIONS.filter((t) => typesQuestions.includes(t.id)).map((t) => (
                    <label key={t.id} className={`flex items-center justify-between gap-2 rounded-[10px] border border-[#0f172a]/10 bg-white px-3 py-2 ${FOCUS_RING}`}>
                      <span className="min-w-0 flex-1 truncate text-[12.5px] text-[#0f172a]/80">{t.label}</span>
                      <input
                        type="number"
                        min={0}
                        placeholder="0"
                        value={repartitionTypes[t.id] || ''}
                        onChange={(e) => {
                          const v = e.target.value.replace(/\D/g, '')
                          setRepartitionTypes((r) => ({ ...r, [t.id]: v === '' ? 0 : Number(v) }))
                        }}
                        aria-label={`Nombre de questions de type ${t.label}`}
                        className="w-14 rounded-[8px] border border-[#0f172a]/15 px-2 py-1 text-center text-[12.5px] font-semibold text-[#0f172a] outline-none focus:border-[#7a0008]/40"
                      />
                    </label>
                  ))}
                </div>
                <p className="mt-2 text-[10.5px] text-[#0f172a]/40">
                  Laisse à 0 pour que l'IA décide librement — sinon la somme doit correspondre au nombre de questions choisi ci-dessous.
                </p>
              </div>
            )}
          </div>

          {/* ===== Paramètres avancés ===== */}
          <div className="mt-6">
            <FieldLabel icon={Hash} title="Paramètres avancés"
              hint="Ajustez le nombre de questions, la difficulté et la durée" />
            <div className="grid gap-4 lg:grid-cols-3">
              <MetricCard
                icon={Hash} label="Questions" hint="Entre 1 et 100"
                value={nbQuestions} unit="q" placeholder="Ex : 10"
                manual={nbQuestionsManuel}
                onToggleManual={() => setNbQuestionsManuel((v) => { if (!v && nbQuestions === '') setNbQuestions(10); return !v })}
                onManualChange={handleNbQuestionsInput}
                onIncrement={() => increment('nb', 1)}
                onDecrement={() => increment('nb', -1)}
                presets={NB_QUESTIONS_OPTIONS.map((n) => ({ value: String(n), label: String(n) }))}
                onPreset={selectNbPreset}
              />
              <MetricCard
                icon={Gauge} label="Difficulté" hint="Niveau d'exigence"
                value={difficulte} unit=""
                manual={false}
                onToggleManual={() => {}}
                presets={DIFFICULTE_OPTIONS.map((d) => ({ value: d, label: d }))}
                onPreset={setDifficulte}
                isDifficulty
              />
              <MetricCard
                icon={Clock} label="Durée" hint="Entre 5 et 300 min"
                value={duree} unit="min" placeholder="Ex : 60"
                manual={dureeManuelle}
                onToggleManual={() => setDureeManuelle((v) => { if (!v && duree === '') setDuree(60); return !v })}
                onManualChange={handleDureeInput}
                onIncrement={() => increment('min', 5)}
                onDecrement={() => increment('min', -5)}
                presets={DUREE_OPTIONS.map((d) => ({ value: String(d), label: String(d) }))}
                onPreset={selectDureePreset}
              />
            </div>
          </div>

          {/* ===== NOUVEAU : consignes libres pour l'IA ===== */}
          <div className="mt-6">
            <FieldLabel icon={PenLine} title="Consignes pour l'IA (optionnel)"
              hint={notes.trim() ? 'Une consigne ajoutée' : 'Aucune consigne'} />
            {/* ✅ Bordure bleu nuit PLEIN comme la barre de recherche */}
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Ex : insiste sur les fractions, évite les questions de calcul mental, privilégie des exemples avec des animaux…"
              aria-label="Consignes libres pour l'IA"
              className={`w-full rounded-[16px] border-2 border-[#0f172a] bg-white px-4 py-3 text-[13.5px] text-[#0f172a] outline-none transition-all placeholder:text-[#0f172a]/45 focus:border-[#0f172a] focus:shadow-[0_0_0_4px_rgba(15,23,42,0.18)] ${FOCUS_RING}`}
            />
          </div>

          {/* ===== NOUVEAU : image pour une question "légende" construite
              a partir d'une image REELLE (voir main.py:
              _ajouter_question_legende_uploadee) -- l'IA LIT cette image
              pour en deduire la reponse correcte, au lieu d'imaginer sa
              propre description. N'apparait que si "Légende" est
              selectionne dans "Types de questions" ci-dessus -- sinon ce
              serait une image pour un type de question que l'enseignant
              n'a pas demande. ===== */}
          {typesQuestions.includes('legende') && (
            <div className="mt-6">
              <FieldLabel icon={ImagePlus} title="Question à légender à partir d'une image (optionnel)"
                hint={imageLegendeNom || 'Aucune image'} />
              <input
                ref={imageLegendeInputRef}
                type="file"
                accept="image/*"
                onChange={handleFichierImageLegende}
                className="hidden"
                aria-label="Importer une image pour une question à légender"
              />
              {imageLegende ? (
                <div className="flex items-center gap-3 rounded-[16px] border border-[#0f172a]/15 bg-white p-3">
                  <img
                    src={imageLegende}
                    alt=""
                    className="h-16 w-16 shrink-0 rounded-[10px] border border-[#0f172a]/10 object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-semibold text-[#0f172a]">{imageLegendeNom}</p>
                    <p className="text-[11px] text-[#0f172a]/50">
                      L'IA lira cette image pour créer une question de type "Légende"
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setImageLegende(null); setImageLegendeNom('') }}
                    aria-label="Retirer l'image"
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#0f172a]/50 transition-colors hover:bg-[#0f172a]/[0.08] hover:text-[#0f172a] ${FOCUS_RING}`}
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => imageLegendeInputRef.current?.click()}
                  className={`flex w-full items-center justify-center gap-2 rounded-[16px] border-2 border-dashed border-[#7a0008]/35 bg-[#7a0008]/[0.03] py-4 text-[13px] font-semibold text-[#7a0008] transition-all hover:border-[#7a0008]/55 hover:bg-[#7a0008]/[0.06] ${FOCUS_RING}`}
                >
                  <ImagePlus size={16} />
                  Importer une image (schéma, photo…) — recommandé pour ce type
                </button>
              )}
            </div>
          )}
        </div>

        {/* ===== BARRE FLOTTANTE ===== */}
        <div className="sticky bottom-4 z-20 mt-6 w-full">
          <div className="w-full overflow-hidden rounded-[24px] border border-[#0f172a]/20 bg-white">
            <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 flex-wrap items-center gap-3">
                <button type="button" onClick={() => setShowRecap(true)} aria-haspopup="dialog" aria-expanded={showRecap}
                  className={`flex items-center gap-2.5 rounded-full border border-[#0f172a]/15 bg-white px-4 py-2 text-[12.5px] font-semibold text-[#0f172a] transition-all hover:border-[#0f172a]/30 hover:bg-[#0f172a]/[0.03] hover:shadow-[0_6px_16px_-8px_rgba(15,23,42,0.2)] ${FOCUS_RING}`}>
                  <FileText size={14} />
                  Récapitulatif
                </button>
                <div className="hidden items-center gap-3 text-[11.5px] text-[#0f172a]/50 sm:flex">
                  <span className="flex items-center gap-1.5">
                    <Hash size={12} className="text-[#0f172a]/70" />
                    {nbQuestions || 0} q
                  </span>
                  <span className="h-3 w-px bg-[#0f172a]/15" />
                  <span className="flex items-center gap-1.5">
                    <Clock size={12} className="text-[#0f172a]/70" />
                    {dureeLabel || '—'}
                  </span>
                  <span className="h-3 w-px bg-[#0f172a]/15" />
                  <span className="flex items-center gap-1.5">
                    <Gauge size={12} className="text-[#0f172a]/70" />
                    {difficulte}
                  </span>
                </div>
              </div>
              <button onClick={handleGenerer} disabled={!pretAGenerer}
                className={`group relative flex shrink-0 items-center justify-center gap-2 overflow-hidden rounded-full bg-[#7a0008] px-7 py-3.5 text-[14px] font-semibold text-white shadow-[0_1px_2px_rgba(15,23,42,0.2),0_14px_30px_-10px_rgba(122,0,8,0.6)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_1px_2px_rgba(15,23,42,0.2),0_18px_38px_-12px_rgba(122,0,8,0.7)] active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-[0_1px_2px_rgba(15,23,42,0.2),0_14px_30px_-10px_rgba(122,0,8,0.6)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${FOCUS_RING}`}>
                {loading ? (
                  <><Loader2 size={16} className="animate-spin" /> Génération…</>
                ) : (
                  <>Générer l'examen <ArrowRight size={16} strokeWidth={2.2} className="transition-transform group-hover:translate-x-1 motion-reduce:group-hover:translate-x-0" /></>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* ===== MODAL RÉCAP ===== */}
        {showRecap && (
          <RecapModal
            onClose={() => setShowRecap(false)}
            niveauLabel={niveauLabel} matiereLabel={matiereLabel}
            chapitre={chapitre} nbQuestions={nbQuestions}
            difficulte={difficulte} dureeLabel={dureeLabel}
            typesQuestions={typesQuestions}
            notes={notes}
          />
        )}
      </div>
    </WizardShell>
  )
}

/* ===== SOUS-COMPOSANTS ===== */

function SectionHeader({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-[#7a0008]/[0.08] text-[#7a0008]">
        <Icon size={17} />
      </span>
      <div className="min-w-0">
        <p className="examai-serif truncate text-[16.5px] font-semibold text-[#0f172a]">{title}</p>
        {subtitle && (
          <p className="mt-0.5 truncate text-[11.5px] font-bold italic text-[#0f172a]/55">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  )
}

function FieldLabel({ icon: Icon, title, hint }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[#7a0008]/[0.08] text-[#7a0008]">
          <Icon size={14} />
        </span>
        <p className="examai-serif truncate text-[14.5px] font-semibold text-[#0f172a]">{title}</p>
      </div>
      {hint && (
        <p className="truncate text-[11px] font-bold italic text-[#0f172a]/50">
          {hint}
        </p>
      )}
    </div>
  )
}

function SkeletonGrid({ rows = 2, cols = 3, label = 'Chargement' }) {
  return (
    <div className={`grid gap-2.5 ${cols === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`} role="status" aria-label={label}>
      {Array.from({ length: rows * cols }).map((_, i) => (
        <span key={i} aria-hidden="true" className="h-16 animate-pulse rounded-[14px] bg-[#0f172a]/[0.06] motion-reduce:animate-none" />
      ))}
    </div>
  )
}

function EmptyState({ title, subtitle, tone = 'neutral' }) {
  const tones = {
    neutral: {
      wrap: 'border-[#7a0008]/25 bg-[#0f172a]/[0.03]',
      title: 'text-[#0f172a]',
      subtitle: 'text-[#0f172a]/55',
      bar: 'bg-[#0f172a]/70',
      dot: 'bg-[#0f172a]/80',
      halo: 'rgba(15,23,42,0.05)',
      textGlow: 'examai-text-glow-neutral',
    },
    warning: {
      wrap: 'border-[#7a0008]/40 bg-[#0f172a]/[0.035]',
      title: 'text-[#0f172a]',
      subtitle: 'text-[#0f172a]/60',
      bar: 'bg-[#7a0008]',
      dot: 'bg-[#7a0008]',
      halo: 'rgba(122,0,8,0.06)',
      textGlow: 'examai-text-glow-warning',
    },
    brand: {
      wrap: 'border-[#7a0008]/30 bg-[#0f172a]/[0.03]',
      title: 'text-[#0f172a]',
      subtitle: 'text-[#0f172a]/55',
      bar: 'bg-[#7a0008]',
      dot: 'bg-[#7a0008]',
      halo: 'rgba(122,0,8,0.05)',
      textGlow: 'examai-text-glow-warning',
    },
  }
  const t = tones[tone] || tones.neutral
  const isWarning = tone === 'warning'

  return (
    <div
      role="status"
      className={`examai-alert relative overflow-hidden rounded-[16px] border px-5 py-4 pl-6 ${t.wrap}`}
    >
      {isWarning && (
        <span
          className="examai-alert-halo pointer-events-none absolute inset-0"
          style={{ background: `radial-gradient(circle at 0% 50%, ${t.halo} 0%, transparent 55%)` }}
          aria-hidden="true"
        />
      )}

      <span
        className={`examai-alert-bar absolute left-0 top-0 h-full w-[3px] ${t.bar}`}
        aria-hidden="true"
      />

      <div className="relative flex items-start gap-3.5">
        <span className="relative mt-[7px] flex h-2 w-2 shrink-0" aria-hidden="true">
          {isWarning && (
            <span
              className={`examai-alert-ping absolute inline-flex h-full w-full rounded-full ${t.dot} opacity-60`}
            />
          )}
          <span
            className={`examai-alert-dot relative inline-flex h-2 w-2 rounded-full ${t.dot}`}
          />
        </span>

        <div className="min-w-0 flex-1">
          <p className={`examai-alert-title examai-serif ${t.textGlow} text-[14.5px] font-semibold leading-[1.3] tracking-[-0.01em] ${t.title}`}>
            {title}
          </p>
          {subtitle && (
            <p className={`examai-alert-subtitle mt-1.5 text-[12px] font-normal leading-[1.55] tracking-[0.005em] ${t.subtitle}`}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function MetricCard({
  icon: Icon, label, hint, value, unit, manual, onToggleManual,
  onManualChange, onIncrement, onDecrement, presets, onPreset, isDifficulty,
  placeholder = 'Ex : 10',
}) {
  const selectedIdx = presets.findIndex((p) => String(p.value) === String(value))

  return (
    <div className="relative min-w-0 overflow-hidden rounded-[18px] border border-[#0f172a]/10 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <Icon size={13} className="shrink-0 text-[#7a0008]" aria-hidden="true" />
          <p className="truncate text-[11.5px] font-bold uppercase tracking-wider text-[#0f172a]/65">{label}</p>
        </div>
        {!isDifficulty && (
          <button type="button" onClick={onToggleManual} aria-pressed={manual}
            className={`flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-all ${FOCUS_RING} ${
              manual
                ? 'border-transparent bg-[#7a0008] text-white shadow-[0_4px_10px_-4px_rgba(122,0,8,0.5)]'
                : 'border-[#0f172a]/15 bg-white text-[#0f172a]/60 hover:border-[#0f172a]/30 hover:bg-[#0f172a]/[0.04] hover:shadow-[0_4px_10px_-6px_rgba(15,23,42,0.2)]'
            }`}>
            <Pencil size={9} strokeWidth={2.5} aria-hidden="true" />
            {manual ? 'Manuel' : 'Perso'}
          </button>
        )}
      </div>

      {isDifficulty && (
        <div className="mb-3 flex items-center gap-1.5" aria-hidden="true">
          {presets.map((p, i) => (
            <span key={p.value} className={`h-1.5 flex-1 rounded-full transition-colors ${
              selectedIdx >= 0 && i <= selectedIdx
                ? 'bg-[#7a0008]'
                : 'bg-[#0f172a]/10'
            }`} />
          ))}
        </div>
      )}

      {manual && !isDifficulty ? (
        <div className="relative mb-3">
          <input type="text" inputMode="numeric" value={value} onChange={(e) => onManualChange(e.target.value)}
            placeholder={placeholder} aria-label={`${label}, valeur personnalisée`}
            className="w-full min-w-0 rounded-[12px] border border-[#0f172a]/20 bg-white px-3.5 py-2.5 pr-14 text-[15px] font-semibold text-[#0f172a] placeholder:font-normal placeholder:text-[#0f172a]/30 focus:border-[#7a0008]/50 focus:outline-none" />
          {unit && (
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-[#0f172a]/[0.07] px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-[#0f172a]/70">
              {unit}
            </span>
          )}
        </div>
      ) : !isDifficulty ? (
        <div className="mb-3 flex items-center justify-center gap-3">
          <button type="button" onClick={onDecrement} aria-label={`Diminuer : ${label}`}
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#0f172a]/15 bg-white text-[#0f172a] shadow-[0_2px_6px_-2px_rgba(15,23,42,0.15)] transition-all hover:border-[#0f172a]/30 hover:bg-[#0f172a]/[0.04] hover:shadow-[0_4px_10px_-4px_rgba(15,23,42,0.25)] active:scale-95 ${FOCUS_RING}`}>
            <Minus size={13} strokeWidth={2.5} />
          </button>
          <div className="min-w-[70px] text-center">
            <p className="examai-serif text-[22px] font-bold leading-none text-[#0f172a]">{value || 0}</p>
            {unit && <p className="mt-0.5 text-[10px] uppercase tracking-wider text-[#0f172a]/45">{unit}</p>}
          </div>
          <button type="button" onClick={onIncrement} aria-label={`Augmenter : ${label}`}
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#0f172a]/15 bg-white text-[#0f172a] shadow-[0_2px_6px_-2px_rgba(15,23,42,0.15)] transition-all hover:border-[#0f172a]/30 hover:bg-[#0f172a]/[0.04] hover:shadow-[0_4px_10px_-4px_rgba(15,23,42,0.25)] active:scale-95 ${FOCUS_RING}`}>
            <Plus size={13} strokeWidth={2.5} />
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => {
          const active = String(p.value) === String(value)
          return (
            <button key={p.value} type="button" onClick={() => onPreset(p.value)} aria-pressed={active}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all ${FOCUS_RING} ${
                active
                  ? 'border-transparent bg-[#7a0008] text-white shadow-[0_4px_10px_-4px_rgba(122,0,8,0.5)]'
                  : 'border-[#0f172a]/12 bg-white text-[#0f172a]/65 hover:border-[#0f172a]/30 hover:bg-[#0f172a]/[0.04] hover:shadow-[0_3px_8px_-4px_rgba(15,23,42,0.18)]'
              }`}>{p.label}</button>
          )
        })}
      </div>

      {hint && <p className="mt-2.5 text-[10.5px] text-[#0f172a]/40">{hint}</p>}
    </div>
  )
}

function RecapModal({ onClose, niveauLabel, matiereLabel, chapitre, nbQuestions, difficulte, dureeLabel, typesQuestions, notes }) {
  const closeBtnRef = useRef(null)
  useEffect(() => { closeBtnRef.current?.focus() }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center sm:p-4">
      <div className="examai-modal-backdrop absolute inset-0 bg-[#0f172a]/40 backdrop-blur-sm" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label="Récapitulatif de l'examen"
        className="examai-modal-panel relative max-h-[85vh] w-full max-w-md overflow-y-auto rounded-[24px] border border-[#0f172a]/20 bg-white">
        <div className="flex items-center justify-between border-b border-[#0f172a]/8 p-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[#7a0008]/[0.08]">
              <FileText size={15} className="text-[#7a0008]" />
            </span>
            <p className="examai-serif truncate text-[15px] font-semibold text-[#0f172a]">Récapitulatif</p>
          </div>
          <button ref={closeBtnRef} onClick={onClose} aria-label="Fermer le récapitulatif"
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#0f172a]/12 text-[#0f172a]/60 transition-all hover:border-[#0f172a]/30 hover:bg-[#0f172a]/[0.04] hover:text-[#0f172a] hover:shadow-[0_4px_10px_-6px_rgba(15,23,42,0.2)] ${FOCUS_RING}`}>
            <X size={14} />
          </button>
        </div>
        <div className="space-y-4 p-5">
          <div className="space-y-2.5">
            <RecapRow icon={GraduationCap} label="Niveau" value={niveauLabel} />
            <RecapRow icon={BookOpen} label="Matière" value={matiereLabel} />
            <RecapRow icon={Layers} label="Chapitre" value={chapitre} />
          </div>
          <div className="border-t border-dashed border-[#0f172a]/12" />
          <div className="space-y-2.5">
            <RecapRow icon={Hash} label="Questions" value={nbQuestions ? `${nbQuestions} q` : '—'} />
            <RecapRow icon={Gauge} label="Difficulté" value={difficulte} />
            <RecapRow icon={Clock} label="Durée" value={dureeLabel || '—'} />
            <RecapRow icon={ListChecks} label="Types" value={
              typesQuestions.length === 0
                ? '—'
                : `${typesQuestions.length} sélectionné${typesQuestions.length > 1 ? 's' : ''}`
            } />
          </div>
          {notes?.trim() && (
            <>
              <div className="border-t border-dashed border-[#0f172a]/12" />
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] bg-[#0f172a]/[0.06] text-[#0f172a]/60">
                  <PenLine size={13} />
                </span>
                <div className="min-w-0">
                  <p className="text-[10.5px] font-bold uppercase tracking-wide text-[#0f172a]/40">Consignes pour l'IA</p>
                  <p className="mt-0.5 text-[12.5px] italic text-[#0f172a]/75">{notes}</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function RecapRow({ icon: Icon, label, value }) {
  const filled = Boolean(value)
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors ${
        filled ? 'bg-[#7a0008]/10 text-[#7a0008]' : 'bg-[#0f172a]/[0.04] text-[#0f172a]/25'
      }`}>
        <Icon size={13} />
      </span>
      <span className="min-w-0 flex-1 truncate text-[12.5px] text-[#0f172a]/55">{label}</span>
      <span className={`max-w-[55%] truncate text-right text-[12.5px] font-medium ${
        filled ? 'text-[#0f172a]' : 'text-[#0f172a]/30'
      }`}>{value || '—'}</span>
    </div>
  )
}