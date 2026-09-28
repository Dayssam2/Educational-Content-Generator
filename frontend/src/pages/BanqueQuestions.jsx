import { useEffect, useMemo, useState, useCallback, useRef, memo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, Inbox, ExternalLink, ChevronDown, ChevronUp, Check,
  BookOpen, GraduationCap, Layers, ListChecks, Filter, Loader2,
  AlertTriangle, Sparkles, SlidersHorizontal, LayoutGrid, Rows3,
  Hash, Eye, FileText, ArrowRight, X, RefreshCw, TrendingUp,
  HelpCircle, AlignLeft, ToggleLeft, PenLine, CheckCircle2,
  Copy, MoreVertical, ArrowUpDown,
} from 'lucide-react'
import TopNav from '../components/TopNav.jsx'
import { useWizard } from '../context/WizardContext.jsx'
import { api } from '../api/client.js'
import { MATIERE_LABEL, NIVEAU_LABEL, NIVEAUX, TYPES_QUESTIONS } from '../data/mockData.js'

/* ============ TOKENS (identiques à Mes Examens) ============ */
const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f172a]/35 focus-visible:ring-offset-2'
const HOVER_LIFT = 'motion-reduce:transition-none motion-reduce:hover:translate-y-0'
const BRAND = '#7a0008'
const INK = '#0f172a'

/* ============ TYPES DE QUESTION ============ */
const TYPE_META = {
  qcm:          { label: 'QCM',           color: '#7a0008', glow: 'rgba(122,0,8,0.10)' },
  vrai_faux:    { label: 'Vrai / Faux',   color: '#1d4ed8', glow: 'rgba(29,78,216,0.10)' },
  ouverte:      { label: 'Ouverte',       color: '#047857', glow: 'rgba(4,120,87,0.10)' },
  texte_trous:  { label: 'Texte à trous', color: '#b45309', glow: 'rgba(180,83,9,0.10)' },
  calcul:       { label: 'Calcul',        color: '#6d28d9', glow: 'rgba(109,40,217,0.10)' },
  redaction:    { label: 'Rédaction',     color: '#0e7490', glow: 'rgba(14,116,144,0.10)' },
  association:  { label: 'Association',   color: '#be185d', glow: 'rgba(190,24,93,0.10)' },
}

const LABELS_CONNUS = Object.fromEntries((TYPES_QUESTIONS || []).map((t) => [t.id, t.label]))

function metaType(type) {
  const base = TYPE_META[type]
  return {
    label: LABELS_CONNUS[type] || base?.label || type || 'Question',
    color: base?.color || '#475569',
    glow: base?.glow || 'rgba(71,85,105,0.10)',
  }
}

function typeQuestionIcon(type) {
  const map = {
    qcm: ListChecks, vrai_faux: ToggleLeft, ouverte: AlignLeft,
    calcul: Hash, redaction: PenLine, association: Layers,
    texte_trous: AlignLeft, phrase_a_trous: AlignLeft, trous: AlignLeft,
  }
  return map[type] || HelpCircle
}

const ARABIC_RE = /[\u0600-\u06FF]/
function estArabe(texte) {
  return typeof texte === 'string' && ARABIC_RE.test(texte)
}

function etapePourStatut(statut) {
  if (statut === 'exporte') return '/wizard/export'
  if (statut === 'valide') return '/wizard/validation'
  return '/wizard/edition'
}

/* ============ COMPOSANT PRINCIPAL ============ */
export default function BanqueQuestions() {
  const navigate = useNavigate()
  const { chargerExamen } = useWizard()

  const [examens, setExamens] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [recherche, setRecherche] = useState('')
  const [rechercheDebounced, setRechercheDebounced] = useState('')
  const [filtreMatiere, setFiltreMatiere] = useState([])
  const [filtreNiveau, setFiltreNiveau] = useState([])
  const [filtreType, setFiltreType] = useState([])
  // NOUVEAU -- filtre par chapitre (jusqu'ici seule la recherche texte
  // libre pouvait matcher un chapitre, pas de liste de pastilles dediee
  // comme matiere/niveau/type).
  const [filtreChapitre, setFiltreChapitre] = useState([])
  // NOUVEAU -- tri du resultat, et recherche locale dans la LISTE des
  // chapitres du filtre (pas la recherche principale : celle-ci ne
  // touche pas aux questions affichees, juste a la liste des pastilles
  // "Chapitre" quand il y en a beaucoup).
  const [tri, setTri] = useState('recent')
  const [rechercheChapitreFiltre, setRechercheChapitreFiltre] = useState('')
  const [examenEnCours, setExamenEnCours] = useState(null)
  const [panneauOuvert, setPanneauOuvert] = useState(true)
  const [filtresAvancesOuverts, setFiltresAvancesOuverts] = useState(false)
  const [toast, setToast] = useState(null)
  // NOUVEAU -- "examen personnalise" : choisir des questions DEJA
  // generees (pas de regeneration IA) et les assembler dans un nouvel
  // examen. `selection` est un Set de _cleUnique, independant des filtres
  // actifs -- changer de filtre ne fait pas perdre ce qui est deja
  // coche.
  const [modeSelection, setModeSelection] = useState(false)
  const [selection, setSelection] = useState(() => new Set())
  const [creationEnCours, setCreationEnCours] = useState(false)
  const [erreurCreation, setErreurCreation] = useState(null)
  const [vue, setVue] = useState(() => {
    try { return localStorage.getItem('examai_banque_vue') || 'grid' } catch { return 'grid' }
  })

  useEffect(() => { try { localStorage.setItem('examai_banque_vue', vue) } catch {} }, [vue])

  useEffect(() => {
    let annule = false
    setChargement(true)
    setErreur(null)
    api.listExamens()
      .then((data) => !annule && setExamens(data))
      .catch((e) => !annule && setErreur(e.message))
      .finally(() => !annule && setChargement(false))
    return () => { annule = true }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setRechercheDebounced(recherche), 250)
    return () => clearTimeout(t)
  }, [recherche])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2400)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    function onKey(e) {
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') {
        if (e.key === 'Escape') document.activeElement.blur()
        return
      }
      if (e.key === '/') { e.preventDefault(); document.getElementById('examai-banque-search')?.focus() }
      if (e.key === 'Escape') {
        if (filtresAvancesOuverts) setFiltresAvancesOuverts(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [filtresAvancesOuverts])

  // NOUVEAU -- deduplique les questions IDENTIQUES qui apparaissent dans
  // PLUSIEURS examens. Frequent depuis "Creer un examen personnalise" :
  // il COPIE des questions existantes dans un nouvel examen plutot que
  // de les deplacer -- une question deja dans la Banque y reapparaissait
  // donc une deuxieme fois des qu'elle etait reutilisee, alors qu'aucune
  // "nouvelle" question n'avait ete creee. `_occurrences` garde la trace
  // de TOUS les examens ou cette question existe (le premier -- le plus
  // recent, GET /api/examens etant deja trie par date de MAJ -- reste
  // celui utilise par "Voir l'examen" ; les autres sont accessibles via
  // le badge "utilisee dans N examens" sur la carte).
  const questions = useMemo(() => {
    const brutes = examens.flatMap((exam) =>
      (exam.questions || []).map((q, idx) => ({
        ...q,
        _examenId: exam.id,
        _examenTitre: exam.titre,
        _statut: exam.statut,
        _matiere: exam.matiere,
        _niveau: exam.niveau,
        _chapitre: exam.chapitre,
      }))
    )

    const parSignature = new Map()
    for (const q of brutes) {
      const signature = [q._matiere, q._niveau, q.type, (q.question || '').trim().toLowerCase()].join('|')
      const occurrence = { examenId: q._examenId, examenTitre: q._examenTitre, statut: q._statut, chapitre: q._chapitre }
      const existante = parSignature.get(signature)
      if (existante) {
        existante._occurrences.push(occurrence)
      } else {
        parSignature.set(signature, { ...q, _cleUnique: signature, _occurrences: [occurrence] })
      }
    }
    return [...parSignature.values()]
  }, [examens])

  const stats = useMemo(() => {
    const matieres = new Set(questions.map((q) => q._matiere).filter(Boolean))
    const chapitres = new Set(questions.map((q) => q._chapitre).filter(Boolean))
    const types = new Set(questions.map((q) => q.type).filter(Boolean))
    return {
      total: questions.length,
      matieres: matieres.size,
      chapitres: chapitres.size,
      types: types.size,
    }
  }, [questions])

  const matieresDispo = useMemo(() => {
    return [...new Set(questions.map((q) => q._matiere).filter(Boolean))].sort()
  }, [questions])
  const niveauxDispo = useMemo(() => {
    return [...new Set(questions.map((q) => q._niveau).filter(Boolean))].sort()
  }, [questions])
  const typesDispo = useMemo(() => {
    return [...new Set(questions.map((q) => q.type).filter(Boolean))]
  }, [questions])
  const chapitresDispo = useMemo(() => {
    return [...new Set(questions.map((q) => q._chapitre).filter(Boolean))].sort()
  }, [questions])

  const rechercheNormalisee = rechercheDebounced.trim().toLowerCase()

  // ===== AJOUT : filtrage a facettes -- chaque pastille (matiere, niveau,
  // type, chapitre) affiche le compte qu'elle donnerait EN PLUS des
  // autres filtres deja actifs (pas un compte global fige), et se
  // desactive automatiquement si elle ne donnerait plus rien -- meme
  // principe que les filtres d'Amazon/Airbnb. `filtrerSauf` applique
  // tout SAUF la dimension `exclure`, pour ne pas qu'une categorie se
  // retrecisse elle-meme quand on change sa propre selection. =====
  function filtrerSauf(exclure) {
    return questions.filter((q) => {
      if (exclure !== 'matiere' && filtreMatiere.length && !filtreMatiere.includes(q._matiere)) return false
      if (exclure !== 'niveau' && filtreNiveau.length && !filtreNiveau.includes(q._niveau)) return false
      if (exclure !== 'type' && filtreType.length && !filtreType.includes(q.type)) return false
      if (exclure !== 'chapitre' && filtreChapitre.length && !filtreChapitre.includes(q._chapitre)) return false
      if (!rechercheNormalisee) return true
      const cible = [q.question, q._examenTitre, q._chapitre].join(' ').toLowerCase()
      return cible.includes(rechercheNormalisee)
    })
  }

  function compterOccurrences(qs, champ) {
    const compte = new Map()
    for (const q of qs) {
      const val = champ === 'type' ? q.type : q[champ]
      if (!val) continue
      compte.set(val, (compte.get(val) || 0) + 1)
    }
    return compte
  }

  const comptesMatiere = useMemo(
    () => compterOccurrences(filtrerSauf('matiere'), '_matiere'),
    [questions, filtreNiveau, filtreType, filtreChapitre, rechercheNormalisee]
  )
  const comptesNiveau = useMemo(
    () => compterOccurrences(filtrerSauf('niveau'), '_niveau'),
    [questions, filtreMatiere, filtreType, filtreChapitre, rechercheNormalisee]
  )
  const comptesType = useMemo(
    () => compterOccurrences(filtrerSauf('type'), 'type'),
    [questions, filtreMatiere, filtreNiveau, filtreChapitre, rechercheNormalisee]
  )
  const comptesChapitre = useMemo(
    () => compterOccurrences(filtrerSauf('chapitre'), '_chapitre'),
    [questions, filtreMatiere, filtreNiveau, filtreType, rechercheNormalisee]
  )
  // ===== FIN AJOUT =====

  const questionsFiltrees = useMemo(() => {
    const resultat = questions.filter((q) => {
      if (filtreMatiere.length && !filtreMatiere.includes(q._matiere)) return false
      if (filtreNiveau.length && !filtreNiveau.includes(q._niveau)) return false
      if (filtreType.length && !filtreType.includes(q.type)) return false
      if (filtreChapitre.length && !filtreChapitre.includes(q._chapitre)) return false
      if (!rechercheNormalisee) return true
      const cible = [q.question, q._examenTitre, q._chapitre].join(' ').toLowerCase()
      return cible.includes(rechercheNormalisee)
    })
    // NOUVEAU -- tri. "recent" garde l'ordre naturel : GET /api/examens
    // trie deja par updated_at DESC cote backend, et flatMap conserve cet
    // ordre -- donc "recent" n'a rien a re-trier.
    if (tri === 'points_desc') return [...resultat].sort((a, b) => (b.points || 0) - (a.points || 0))
    if (tri === 'points_asc') return [...resultat].sort((a, b) => (a.points || 0) - (b.points || 0))
    if (tri === 'alpha') return [...resultat].sort((a, b) => (a.question || '').localeCompare(b.question || ''))
    return resultat
  }, [questions, filtreMatiere, filtreNiveau, filtreType, filtreChapitre, rechercheNormalisee, tri])

  const filtresActifs =
    filtreMatiere.length > 0 || filtreNiveau.length > 0 || filtreType.length > 0 ||
    filtreChapitre.length > 0 || recherche.trim().length > 0

  function toggleInArray(setter, value) {
    setter((prev) => prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value])
  }

  function reinitialiser() {
    setRecherche('')
    setFiltreMatiere([])
    setFiltreNiveau([])
    setFiltreType([])
    setFiltreChapitre([])
  }

  // ===== AJOUT : examen personnalise depuis la selection =====
  const toggleSelection = useCallback((cle) => {
    setSelection((prev) => {
      const next = new Set(prev)
      if (next.has(cle)) next.delete(cle)
      else next.add(cle)
      return next
    })
  }, [])

  const questionsSelectionnees = useMemo(
    () => questions.filter((q) => selection.has(q._cleUnique)),
    [questions, selection]
  )

  // Une matiere et un niveau uniques sont necessaires (structure du
  // backend : langue/gabarit de correction en dependent, voir
  // pdf_export.py) -- le chapitre, lui, peut librement melanger
  // plusieurs valeurs (il devient juste "Chapitre A, Chapitre B").
  const selectionCoherente = useMemo(() => {
    if (questionsSelectionnees.length === 0) return true
    const matieres = new Set(questionsSelectionnees.map((q) => q._matiere))
    const niveaux = new Set(questionsSelectionnees.map((q) => q._niveau))
    return matieres.size === 1 && niveaux.size === 1
  }, [questionsSelectionnees])

  const pointsSelection = useMemo(
    () => questionsSelectionnees.reduce((s, q) => s + (q.points || 0), 0),
    [questionsSelectionnees]
  )

  function viderSelection() {
    setSelection(new Set())
    setErreurCreation(null)
  }

  function quitterModeSelection() {
    setModeSelection(false)
    viderSelection()
  }

  async function creerExamenPersonnalise() {
    if (questionsSelectionnees.length === 0 || !selectionCoherente) return
    setCreationEnCours(true)
    setErreurCreation(null)
    try {
      const matiere = questionsSelectionnees[0]._matiere
      const niveau = questionsSelectionnees[0]._niveau
      const chapitresUniques = [...new Set(questionsSelectionnees.map((q) => q._chapitre).filter(Boolean))]
      const chapitre = chapitresUniques.join(', ') || 'Sélection personnalisée'
      // Retire les champs internes (_cleUnique, _examenId...) ajoutes par
      // le flatMap plus haut -- le backend ne doit recevoir que de
      // vraies questions, pas ce metadata de tracking cote frontend.
      const questionsPropres = questionsSelectionnees.map(
        ({ _cleUnique, _examenId, _examenTitre, _statut, _matiere, _niveau, _chapitre, _occurrences, ...reste }) => reste
      )

      const nouvelExamen = await api.createExamenDepuisSelection({
        matiere, niveau, chapitre, questions: questionsPropres,
      })
      await chargerExamen(nouvelExamen.id)
      quitterModeSelection()
      navigate('/wizard/edition')
    } catch (e) {
      setErreurCreation(e.message || 'La création a échoué.')
    } finally {
      setCreationEnCours(false)
    }
  }
  // ===== FIN AJOUT =====

  const handleVoirExamen = useCallback(async (examenId, statut) => {
    setExamenEnCours(examenId)
    setErreur(null)
    try {
      await chargerExamen(examenId)
      navigate(etapePourStatut(statut))
    } catch (e) {
      setErreur(e.message)
      setExamenEnCours(null)
    }
  }, [chargerExamen, navigate])

  /* ============ RENDER ============ */
  return (
    <div className="relative min-h-screen bg-[#f8fafc] text-[#0f172a]">
      <style>{`
        .examai-underline-wave {
          background-color: rgba(122,0,8,0.12);
          background-repeat: no-repeat;
          background-size: 100% 0.35em;
          background-position: 0 88%;
          padding: 0 0.15em;
        }
        @keyframes examaiFadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .examai-fade-up { animation: examaiFadeUp .4s cubic-bezier(.22,1,.36,1) both; }

        @keyframes examaiToastIn {
          from { opacity: 0; transform: translate(-50%, 20px) scale(.95); }
          to   { opacity: 1; transform: translate(-50%, 0) scale(1); }
        }
        .examai-toast-in { animation: examaiToastIn .35s cubic-bezier(.22,1,.36,1) both; }

        @keyframes examaiSlideLeft {
          from { opacity: 0; transform: translateX(-16px); }
          to   { opacity: 1; transform: none; }
        }
        .examai-slide-left { animation: examaiSlideLeft .4s cubic-bezier(.22,1,.36,1) both; }

        .examai-skeleton {
          background: linear-gradient(90deg, rgba(15,23,42,0.04) 0%, rgba(15,23,42,0.08) 50%, rgba(15,23,42,0.04) 100%);
          background-size: 200% 100%;
          animation: examaiShimmer 1.6s ease-in-out infinite;
        }
        @keyframes examaiShimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        .examai-shine { position: relative; overflow: hidden; }
        .examai-shine::after {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent);
          transform: translateX(-100%);
          transition: transform .7s;
        }
        .examai-shine:hover::after { transform: translateX(100%); }

        @media (prefers-reduced-motion: reduce) {
          .examai-fade-up, .examai-toast-in, .examai-slide-left, .examai-skeleton { animation: none !important; }
        }
      `}</style>

      <TopNav />

      <main className="mx-auto max-w-7xl px-6 py-8">

        {/* ====== EN-TÊTE (identique à Mes Examens) ====== */}
        <div className="relative mb-6 w-full overflow-hidden rounded-[28px] border border-[#0f172a]/20 bg-white p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="examai-serif text-[30px] sm:text-[40px] lg:text-[42px] font-semibold tracking-[-0.025em] text-[#0f172a] leading-[1.15]">
                Banque de{' '}
                <span className="text-[#7a0008] relative">
                  <span className="examai-underline-wave">Questions.</span>
                </span>
              </h1>
              <p className="examai-serif mt-3 text-[14px] sm:text-[15px] font-normal italic leading-[1.6] text-[#0f172a]/75 max-w-[620px]">
                Toutes les questions de vos examens, regroupées au même endroit pour vous
                en inspirer ou retrouver rapidement celle qu'il vous faut.
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#0f172a]/15 bg-white px-2.5 py-1 text-[11.5px] font-bold text-[#0f172a] tabular-nums">
                  <ListChecks size={11} />
                  {stats.total} question{stats.total > 1 ? 's' : ''}
                </span>
                {stats.matieres > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-[#0f172a]/15 bg-white px-2.5 py-1 text-[11px] font-bold text-[#0f172a]/70">
                    <BookOpen size={10} /> {stats.matieres}
                  </span>
                )}
                {stats.types > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-[#0f172a]/15 bg-white px-2.5 py-1 text-[11px] font-bold text-[#0f172a]/60">
                    <Sparkles size={10} /> {stats.types} type{stats.types > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button onClick={() => setPanneauOuvert((v) => !v)}
                title={panneauOuvert ? 'Masquer les stats' : 'Afficher les stats'}
                aria-pressed={panneauOuvert}
                className={`hidden h-10 w-10 items-center justify-center rounded-full border bg-white transition-all lg:flex ${FOCUS_RING} ${
                  panneauOuvert
                    ? 'border-[#0f172a]/40 text-[#0f172a] shadow-[0_6px_16px_-8px_rgba(15,23,42,0.25)]'
                    : 'border-[#0f172a]/15 text-[#0f172a]/60 hover:border-[#0f172a]/40 hover:text-[#0f172a]'
                }`}>
                <TrendingUp size={14} />
              </button>
              <button onClick={() => (modeSelection ? quitterModeSelection() : setModeSelection(true))}
                aria-pressed={modeSelection}
                className={`flex items-center gap-2 rounded-full border px-4 py-2.5 text-[13px] font-semibold transition-all hover:-translate-y-0.5 active:scale-[0.985] ${FOCUS_RING} ${HOVER_LIFT} ${
                  modeSelection
                    ? 'border-[#7a0008]/40 bg-[#7a0008]/[0.06] text-[#7a0008]'
                    : 'border-[#0f172a]/20 bg-white text-[#0f172a]/75 hover:border-[#0f172a]/40 hover:text-[#0f172a]'
                }`}>
                {modeSelection ? <X size={14} /> : <Check size={14} />}
                {modeSelection ? 'Annuler la sélection' : 'Choisir des questions'}
              </button>
              <button onClick={() => navigate('/wizard/selection')}
                className={`examai-shine group relative flex items-center gap-2 rounded-full bg-[#7a0008] px-5 py-2.5 text-[13px] font-semibold text-white shadow-[0_1px_2px_rgba(79,0,5,0.2),0_10px_22px_-8px_rgba(122,0,8,0.55),inset_0_1px_0_rgba(255,255,255,0.15)] transition-all hover:-translate-y-0.5 hover:bg-[#961014] hover:shadow-[0_1px_2px_rgba(79,0,5,0.25),0_14px_28px_-8px_rgba(122,0,8,0.65),inset_0_1px_0_rgba(255,255,255,0.2)] active:scale-[0.985] ${FOCUS_RING} ${HOVER_LIFT}`}>
                <FileText size={15} className="transition-transform group-hover:rotate-90 motion-reduce:group-hover:rotate-0" />
                Générer un examen
              </button>
            </div>
          </div>
        </div>

        {/* ====== LAYOUT (identique à Mes Examens) ====== */}
        <div className={`grid gap-5 ${panneauOuvert ? 'lg:grid-cols-[280px_1fr] lg:items-start' : ''}`}>
          {panneauOuvert && (
            <aside className="examai-slide-left hidden lg:block lg:sticky lg:top-6 lg:self-start space-y-4">
              {/* Aperçu */}
              <div className="rounded-[24px] border border-[#0f172a]/20 bg-white p-4">
                <div className="mb-3 flex items-center gap-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[#7a0008]/[0.08] text-[#7a0008]">
                    <TrendingUp size={15} />
                  </span>
                  <div className="min-w-0">
                    <p className="examai-serif text-[14.5px] font-semibold text-[#0f172a]">Aperçu</p>
                    <p className="text-[10.5px] font-bold italic text-[#0f172a]/45">
                      {stats.chapitres} chapitre{stats.chapitres > 1 ? 's' : ''} couvert{stats.chapitres > 1 ? 's' : ''}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <StatTile icon={ListChecks} label="Questions" value={stats.total}     accent={BRAND} />
                  <StatTile icon={BookOpen}   label="Matières"  value={stats.matieres}  accent="#b45309" />
                  <StatTile icon={Layers}     label="Chapitres" value={stats.chapitres} accent="#047857" />
                  <StatTile icon={Sparkles}   label="Types"     value={stats.types}     accent="#1d4ed8" />
                </div>
              </div>

              {/* Filtres avancés */}
              <div className="rounded-[24px] border border-[#0f172a]/20 bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[#0f172a]/55">
                    <Filter size={11} /> Filtres avancés
                  </span>
                  {filtresActifs && (
                    <button onClick={reinitialiser}
                      className={`text-[10.5px] font-semibold text-[#0f172a]/60 transition-colors hover:text-[#7a0008] ${FOCUS_RING} rounded`}>
                      Réinitialiser
                    </button>
                  )}
                </div>

                <FiltresRapides
                  matieresDispo={matieresDispo} niveauxDispo={niveauxDispo} typesDispo={typesDispo}
                  chapitresDispo={chapitresDispo}
                  filtreMatiere={filtreMatiere} filtreNiveau={filtreNiveau} filtreType={filtreType}
                  filtreChapitre={filtreChapitre}
                  onToggleMatiere={(m) => toggleInArray(setFiltreMatiere, m)}
                  onToggleNiveau={(n) => toggleInArray(setFiltreNiveau, n)}
                  onToggleType={(t) => toggleInArray(setFiltreType, t)}
                  onToggleChapitre={(c) => toggleInArray(setFiltreChapitre, c)}
                  comptesMatiere={comptesMatiere} comptesNiveau={comptesNiveau}
                  comptesType={comptesType} comptesChapitre={comptesChapitre}
                  rechercheChapitreFiltre={rechercheChapitreFiltre}
                  onRechercheChapitreFiltre={setRechercheChapitreFiltre}
                />
              </div>
            </aside>
          )}

          <div className="min-w-0">
            {/* ====== Barre de contrôle ====== */}
            <div className="rounded-[20px] border border-[#0f172a]/20 bg-white px-4 py-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[220px] flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-[14px] w-[14px] -translate-y-1/2 text-[#0f172a]/45" />
                  <input
                    id="examai-banque-search"
                    value={recherche}
                    onChange={(e) => setRecherche(e.target.value)}
                    placeholder="Rechercher une question, un chapitre, un examen…"
                    className={`w-full rounded-full border border-[#0f172a]/15 bg-white py-2.5 pl-9 pr-10 text-[13px] text-[#0f172a] outline-none transition-all placeholder:text-[#0f172a]/40 focus:border-[#0f172a]/40 focus:shadow-[0_0_0_4px_rgba(15,23,42,0.10)] ${FOCUS_RING}`}
                  />
                  {recherche ? (
                    <button onClick={() => setRecherche('')} aria-label="Effacer"
                      className={`absolute right-2.5 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full text-[#0f172a]/50 transition-colors hover:bg-[#0f172a]/[0.08] hover:text-[#0f172a] ${FOCUS_RING}`}>
                      <X size={12} />
                    </button>
                  ) : (
                    <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 items-center rounded border border-[#0f172a]/15 bg-white px-1.5 py-0.5 text-[10px] font-bold text-[#0f172a]/50 sm:inline-flex">/</kbd>
                  )}
                </div>

                <button onClick={() => setFiltresAvancesOuverts((v) => !v)}
                  className={`lg:hidden flex items-center gap-1.5 rounded-full border px-3 py-2.5 text-[12px] font-semibold transition-all ${FOCUS_RING} ${
                    filtresAvancesOuverts || filtreMatiere.length || filtreNiveau.length || filtreType.length
                      ? 'border-[#7a0008]/40 bg-[#7a0008]/[0.06] text-[#7a0008]'
                      : 'border-[#0f172a]/15 bg-white text-[#0f172a]/70'
                  }`}>
                  <Filter size={13} /> Filtres
                </button>

                {/* NOUVEAU -- tri du resultat. Un simple <select> plutot
                    qu'un menu deroulant custom : plus rapide a construire,
                    et deja accessible au clavier/lecteur d'ecran par
                    defaut. */}
                <div className="relative flex items-center">
                  <ArrowUpDown size={13} className="pointer-events-none absolute left-3 text-[#0f172a]/45" />
                  <select
                    value={tri}
                    onChange={(e) => setTri(e.target.value)}
                    aria-label="Trier les questions"
                    className={`appearance-none rounded-full border border-[#0f172a]/15 bg-white py-2.5 pl-8 pr-7 text-[12px] font-semibold text-[#0f172a]/80 outline-none transition-colors hover:border-[#0f172a]/30 focus:border-[#0f172a]/40 ${FOCUS_RING}`}
                  >
                    <option value="recent">Plus récentes</option>
                    <option value="points_desc">Points (décroissant)</option>
                    <option value="points_asc">Points (croissant)</option>
                    <option value="alpha">Ordre alphabétique</option>
                  </select>
                </div>

                <div className="flex items-center gap-0.5 rounded-full border border-[#0f172a]/15 bg-white p-0.5">
                  {[
                    { v: 'grid', I: LayoutGrid, l: 'Grille' },
                    { v: 'list', I: Rows3,      l: 'Liste' },
                  ].map(({ v, I, l }) => (
                    <button key={v} onClick={() => setVue(v)} aria-label={l} aria-pressed={vue === v}
                      className={`flex h-8 w-8 items-center justify-center rounded-full transition-all ${FOCUS_RING} ${
                        vue === v
                          ? 'bg-[#7a0008] text-white shadow-[0_4px_10px_-4px_rgba(122,0,8,0.45)]'
                          : 'text-[#0f172a]/50 hover:bg-[#0f172a]/[0.05] hover:text-[#0f172a]'
                      }`}>
                      <I size={14} />
                    </button>
                  ))}
                </div>
              </div>

              {filtresAvancesOuverts && (
                <div className="lg:hidden mt-3 rounded-[14px] border border-[#0f172a]/15 bg-white p-3">
                  <FiltresRapides
                    matieresDispo={matieresDispo} niveauxDispo={niveauxDispo} typesDispo={typesDispo}
                    chapitresDispo={chapitresDispo}
                    filtreMatiere={filtreMatiere} filtreNiveau={filtreNiveau} filtreType={filtreType}
                    filtreChapitre={filtreChapitre}
                    onToggleMatiere={(m) => toggleInArray(setFiltreMatiere, m)}
                    onToggleNiveau={(n) => toggleInArray(setFiltreNiveau, n)}
                    onToggleType={(t) => toggleInArray(setFiltreType, t)}
                    onToggleChapitre={(c) => toggleInArray(setFiltreChapitre, c)}
                    comptesMatiere={comptesMatiere} comptesNiveau={comptesNiveau}
                    comptesType={comptesType} comptesChapitre={comptesChapitre}
                    rechercheChapitreFiltre={rechercheChapitreFiltre}
                    onRechercheChapitreFiltre={setRechercheChapitreFiltre}
                  />
                </div>
              )}

              {/* Pills de type — comme les pills statut de Mes Examens */}
              {typesDispo.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-[#0f172a]/10 pt-3">
                  <span className="mr-1 text-[10.5px] font-bold uppercase tracking-wider text-[#0f172a]/50">
                    Types
                  </span>
                  {typesDispo.map((t) => {
                    const meta = metaType(t)
                    const Icon = typeQuestionIcon(t)
                    const active = filtreType.includes(t)
                    const count = comptesType.get(t) || 0
                    const indisponible = count === 0 && !active
                    return (
                      <button key={t} onClick={() => !indisponible && toggleInArray(setFiltreType, t)}
                        aria-pressed={active} disabled={indisponible}
                        className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS_RING} ${
                          active
                            ? 'border-transparent bg-[#7a0008] text-white shadow-[0_4px_10px_-4px_rgba(122,0,8,0.45)]'
                            : 'border-[#0f172a]/15 bg-white text-[#0f172a]/70 hover:border-[#0f172a]/30 hover:text-[#0f172a] hover:bg-[#0f172a]/[0.03]'
                        }`}>
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ background: active ? '#fff' : meta.color }} />
                        <Icon size={11} />
                        {meta.label}
                        <span className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[10.5px] font-bold tabular-nums ${
                          active ? 'bg-white/20 text-white' : 'bg-[#0f172a]/[0.06] text-[#0f172a]/60'
                        }`}>
                          {count}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Chips de filtres actifs */}
            {filtresActifs && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1 text-[11.5px] font-semibold text-[#0f172a]/60">
                  {questionsFiltrees.length} résultat{questionsFiltrees.length > 1 ? 's' : ''}
                </span>
                {recherche && <FilterChip label={`« ${recherche} »`} onClear={() => setRecherche('')} />}
                {filtreMatiere.map((m) => (
                  <FilterChip key={m} label={MATIERE_LABEL[m] || m} onClear={() => toggleInArray(setFiltreMatiere, m)} />
                ))}
                {filtreNiveau.map((n) => (
                  <FilterChip key={n} label={NIVEAU_LABEL[n] || n} onClear={() => toggleInArray(setFiltreNiveau, n)} />
                ))}
                {filtreChapitre.map((c) => (
                  <FilterChip key={c} label={c} onClear={() => toggleInArray(setFiltreChapitre, c)} />
                ))}
                {filtreType.map((t) => (
                  <FilterChip key={t} label={metaType(t).label} onClear={() => toggleInArray(setFiltreType, t)} />
                ))}
                {(filtreMatiere.length + filtreNiveau.length + filtreType.length + filtreChapitre.length + (recherche ? 1 : 0)) > 1 && (
                  <button onClick={reinitialiser}
                    className={`text-[11px] font-semibold text-[#0f172a]/60 underline-offset-2 hover:text-[#7a0008] hover:underline ${FOCUS_RING} rounded`}>
                    Tout effacer
                  </button>
                )}
              </div>
            )}

            {erreur && (
              <div role="alert" className="mt-5 flex items-start gap-3 rounded-[16px] border border-[#7a0008]/40 bg-[#0f172a]/[0.035] p-4 text-[13px] text-[#0f172a]">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#7a0008]/10">
                  <AlertTriangle size={14} className="text-[#7a0008]" />
                </span>
                <span className="min-w-0 break-words pt-0.5 font-medium">{erreur}</span>
              </div>
            )}

            {chargement && (
              <div className={`mt-5 grid gap-4 ${vue === 'grid' ? 'sm:grid-cols-2' : ''}`}>
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="examai-skeleton h-[180px] rounded-[20px] border border-[#0f172a]/10" />
                ))}
              </div>
            )}

            {!chargement && questionsFiltrees.length === 0 && (
              <div className="examai-fade-up mt-8 flex flex-col items-center justify-center rounded-[24px] border border-dashed border-[#0f172a]/25 bg-white px-6 py-16 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#7a0008]/[0.08] text-[#7a0008]">
                  <Inbox size={22} />
                </span>
                <p className="examai-serif mt-4 text-[18px] font-semibold text-[#0f172a]">
                  {questions.length === 0 ? 'Aucune question pour l\u2019instant' : 'Aucune question ne correspond'}
                </p>
                <p className="examai-serif mt-2 max-w-sm text-[13.5px] font-bold italic text-[#0f172a]/55">
                  {questions.length === 0
                    ? 'Générez votre premier examen pour commencer à remplir votre banque de questions.'
                    : 'Essayez un autre mot-clé ou réinitialisez les filtres.'}
                </p>
                {questions.length === 0 ? (
                  <button onClick={() => navigate('/wizard/selection')}
                    className={`mt-5 flex items-center gap-2 rounded-full bg-[#7a0008] px-5 py-2.5 text-[12.5px] font-semibold text-white shadow-[0_1px_2px_rgba(79,0,5,0.2),0_10px_22px_-8px_rgba(122,0,8,0.5)] transition-all hover:-translate-y-0.5 active:scale-[0.985] ${FOCUS_RING} ${HOVER_LIFT}`}>
                    <FileText size={14} /> Générer un examen
                  </button>
                ) : (
                  <button onClick={reinitialiser}
                    className={`mt-5 rounded-full border border-[#0f172a]/20 bg-white px-4 py-2 text-[12.5px] font-semibold text-[#0f172a]/75 transition-all hover:-translate-y-0.5 hover:border-[#0f172a]/50 hover:text-[#0f172a] ${FOCUS_RING} ${HOVER_LIFT}`}>
                    Réinitialiser
                  </button>
                )}
              </div>
            )}

            {!chargement && questionsFiltrees.length > 0 && (
              vue === 'grid' ? (
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  {questionsFiltrees.map((q, i) => (
                    <div key={q._cleUnique} className="examai-fade-up" style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}>
                      <QuestionCard
                        q={q}
                        busy={examenEnCours === q._examenId}
                        recherche={rechercheDebounced}
                        onVoirExamen={handleVoirExamen}
                        modeSelection={modeSelection}
                        selectionnee={selection.has(q._cleUnique)}
                        onToggleSelection={toggleSelection}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="examai-fade-up mt-5 overflow-hidden rounded-[20px] border border-[#0f172a]/20 bg-white">
                  {questionsFiltrees.map((q, i) => (
                    <QuestionRow
                      key={q._cleUnique}
                      q={q}
                      isLast={i === questionsFiltrees.length - 1}
                      busy={examenEnCours === q._examenId}
                      recherche={rechercheDebounced}
                      onVoirExamen={handleVoirExamen}
                      modeSelection={modeSelection}
                      selectionnee={selection.has(q._cleUnique)}
                      onToggleSelection={toggleSelection}
                    />
                  ))}
                </div>
              )
            )}
          </div>
        </div>
      </main>

      {/* ===== AJOUT : barre flottante de selection -- resume + creation
          de l'examen personnalise. N'apparait qu'en mode selection avec
          au moins une question cochee ; reste visible quels que soient
          les filtres actifs (la selection elle-meme n'en depend pas). ===== */}
      {modeSelection && selection.size > 0 && (
        <div className="fixed bottom-4 left-1/2 z-40 w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2">
          <div className="examai-toast-in overflow-hidden rounded-[20px] border border-[#0f172a]/20 bg-white shadow-[0_14px_32px_-14px_rgba(15,23,42,0.3)]">
            <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#7a0008]/[0.1] text-[#7a0008]">
                  <ListChecks size={15} />
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-[#0f172a]">
                    {selection.size} question{selection.size > 1 ? 's' : ''} sélectionnée{selection.size > 1 ? 's' : ''}
                    <span className="ml-1.5 font-normal text-[#0f172a]/50">· {pointsSelection} pts</span>
                  </p>
                  {!selectionCoherente ? (
                    <p className="flex items-center gap-1 text-[11px] font-semibold text-[#7a0008]">
                      <AlertTriangle size={11} /> Toutes les questions doivent être de la même matière et du même niveau
                    </p>
                  ) : erreurCreation ? (
                    <p className="flex items-center gap-1 text-[11px] font-semibold text-[#7a0008]">
                      <AlertTriangle size={11} /> {erreurCreation}
                    </p>
                  ) : (
                    <p className="text-[11px] text-[#0f172a]/50">Le barème sera réparti sur 20 automatiquement</p>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button onClick={viderSelection}
                  className={`rounded-full border border-[#0f172a]/20 bg-white px-3.5 py-2 text-[12px] font-semibold text-[#0f172a]/70 transition-all hover:border-[#0f172a]/40 hover:text-[#0f172a] ${FOCUS_RING}`}>
                  Vider
                </button>
                <button
                  onClick={creerExamenPersonnalise}
                  disabled={!selectionCoherente || creationEnCours}
                  className={`flex items-center gap-2 rounded-full bg-[#7a0008] px-4 py-2 text-[12.5px] font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-[#961014] active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 ${FOCUS_RING} ${HOVER_LIFT}`}
                >
                  {creationEnCours ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
                  Créer l'examen personnalisé
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ===== FIN AJOUT ===== */}

      {/* Toast */}
      {toast && (
        <div className="examai-toast-in fixed bottom-6 left-1/2 z-50 -translate-x-1/2" role="status" aria-live="polite">
          <div className="flex items-center gap-2 rounded-full border border-[#0f172a]/20 bg-white px-4 py-2.5 text-[12.5px] font-semibold text-[#0f172a] shadow-[0_14px_32px_-14px_rgba(15,23,42,0.3)]">
            <CheckCircle2 size={14} className="text-emerald-600" />
            {toast}
          </div>
        </div>
      )}
    </div>
  )
}

/* =================== SOUS-COMPOSANTS =================== */

/* StatTile — identique à Mes Examens */
function StatTile({ icon: Icon, label, value, accent }) {
  return (
    <div className="rounded-[12px] border border-[#0f172a]/10 bg-white p-2.5">
      <div className="flex items-center gap-1.5">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[8px]"
          style={{ background: `${accent}1a`, color: accent }}>
          <Icon size={11} strokeWidth={2.2} />
        </span>
        <p className="truncate text-[9.5px] font-bold uppercase tracking-wider text-[#0f172a]/55">{label}</p>
      </div>
      <p className="examai-serif mt-1.5 text-[20px] font-semibold leading-none text-[#0f172a] tabular-nums">
        {value}
      </p>
    </div>
  )
}

/* FiltresRapides — pills matière/niveau/type (comme Mes Examens) */
function FiltresRapides({
  matieresDispo, niveauxDispo, typesDispo, chapitresDispo,
  filtreMatiere, filtreNiveau, filtreType, filtreChapitre,
  onToggleMatiere, onToggleNiveau, onToggleType, onToggleChapitre,
  comptesMatiere, comptesNiveau, comptesType, comptesChapitre,
  rechercheChapitreFiltre, onRechercheChapitreFiltre,
}) {
  // NOUVEAU -- une pastille a facettes : affiche son compte (calcule en
  // tenant compte des AUTRES filtres actifs, voir comptesMatiere etc.
  // dans le composant parent) et se grise/desactive si elle ne
  // donnerait plus rien -- sauf si elle est deja selectionnee (pour
  // pouvoir toujours la desactiver).
  function Pastille({ valeur, actif, label, compte, onToggle, rtl }) {
    const indisponible = compte === 0 && !actif
    return (
      <button
        onClick={() => !indisponible && onToggle(valeur)}
        aria-pressed={actif}
        disabled={indisponible}
        dir={rtl ? 'rtl' : 'ltr'}
        className={`flex max-w-full items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS_RING} ${
          actif
            ? 'border-transparent bg-[#7a0008] text-white shadow-[0_3px_8px_-3px_rgba(122,0,8,0.4)]'
            : 'border-[#0f172a]/15 bg-white text-[#0f172a]/70 hover:border-[#0f172a]/30 hover:text-[#0f172a]'
        }`}
      >
        <span className="truncate">{label}</span>
        <span className={`shrink-0 rounded-full px-1.5 text-[10px] font-bold tabular-nums ${
          actif ? 'bg-white/20 text-white' : 'bg-[#0f172a]/[0.06] text-[#0f172a]/55'
        }`}>
          {compte}
        </span>
      </button>
    )
  }

  const chapitresAffiches = rechercheChapitreFiltre
    ? (chapitresDispo || []).filter((c) => c.toLowerCase().includes(rechercheChapitreFiltre.trim().toLowerCase()))
    : chapitresDispo

  return (
    <>
      {matieresDispo.length > 0 && (
        <div className="mb-3">
          <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wider text-[#0f172a]/50">Matière</p>
          <div className="flex flex-wrap gap-1.5">
            {matieresDispo.map((m) => (
              <Pastille key={m} valeur={m} actif={filtreMatiere.includes(m)}
                label={MATIERE_LABEL[m] || m} compte={comptesMatiere?.get(m) || 0} onToggle={onToggleMatiere} />
            ))}
          </div>
        </div>
      )}

      {niveauxDispo.length > 0 && (
        <div className="mb-3">
          <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wider text-[#0f172a]/50">Niveau</p>
          <div className="flex flex-wrap gap-1.5">
            {niveauxDispo.map((n) => (
              <Pastille key={n} valeur={n} actif={filtreNiveau.includes(n)}
                label={NIVEAU_LABEL[n] || n} compte={comptesNiveau?.get(n) || 0} onToggle={onToggleNiveau} />
            ))}
          </div>
        </div>
      )}

      {/* Chapitre : meme motif que matiere/niveau, + une recherche locale
          quand la liste est longue (au-dela de 8, une simple liste de
          pastilles a defiler devient vite peu pratique). */}
      {chapitresDispo && chapitresDispo.length > 0 && (
        <div className="mb-3">
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-[#0f172a]/50">Chapitre</p>
            {chapitresDispo.length > 8 && <p className="text-[10px] text-[#0f172a]/35">{chapitresDispo.length}</p>}
          </div>

          {chapitresDispo.length > 8 && (
            <div className="relative mb-1.5">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-[11px] w-[11px] -translate-y-1/2 text-[#0f172a]/40" />
              <input
                value={rechercheChapitreFiltre}
                onChange={(e) => onRechercheChapitreFiltre(e.target.value)}
                placeholder="Filtrer les chapitres…"
                className={`w-full rounded-[10px] border border-[#0f172a]/12 bg-white py-1.5 pl-7 pr-2 text-[11px] text-[#0f172a] outline-none placeholder:text-[#0f172a]/35 focus:border-[#0f172a]/35 ${FOCUS_RING}`}
              />
            </div>
          )}

          <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto pr-1">
            {chapitresAffiches.length === 0 ? (
              <p className="text-[10.5px] italic text-[#0f172a]/40">Aucun chapitre ne correspond.</p>
            ) : (
              chapitresAffiches.map((c) => (
                <Pastille key={c} valeur={c} actif={filtreChapitre.includes(c)}
                  label={c} compte={comptesChapitre?.get(c) || 0} onToggle={onToggleChapitre} rtl={estArabe(c)} />
              ))
            )}
          </div>
        </div>
      )}

      {typesDispo.length > 0 && (
        <div>
          <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wider text-[#0f172a]/50">Type</p>
          <div className="flex flex-wrap gap-1.5">
            {typesDispo.map((t) => {
              const meta = metaType(t)
              const actif = filtreType.includes(t)
              const compte = comptesType?.get(t) || 0
              const indisponible = compte === 0 && !actif
              return (
                <button key={t} onClick={() => !indisponible && onToggleType(t)} aria-pressed={actif}
                  disabled={indisponible}
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS_RING} ${
                    actif
                      ? 'border-transparent bg-[#7a0008] text-white shadow-[0_3px_8px_-3px_rgba(122,0,8,0.4)]'
                      : 'border-[#0f172a]/15 bg-white text-[#0f172a]/70 hover:border-[#0f172a]/30 hover:text-[#0f172a]'
                  }`}>
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: actif ? '#fff' : meta.color }} />
                  {meta.label}
                  <span className={`shrink-0 rounded-full px-1.5 text-[10px] font-bold tabular-nums ${
                    actif ? 'bg-white/20 text-white' : 'bg-[#0f172a]/[0.06] text-[#0f172a]/55'
                  }`}>
                    {compte}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}

function FilterChip({ label, onClear }) {
  return (
    <span className="flex items-center gap-1 rounded-full border border-[#0f172a]/15 bg-white px-2.5 py-1 text-[11px] font-semibold text-[#0f172a]">
      {label}
      <button onClick={onClear} aria-label={`Retirer ${label}`}
        className={`flex h-4 w-4 items-center justify-center rounded-full text-[#0f172a]/50 transition-colors hover:bg-[#0f172a]/[0.08] hover:text-[#0f172a] ${FOCUS_RING}`}>
        <X size={10} />
      </button>
    </span>
  )
}

/* QuestionCard — style exact des ExamCard de Mes Examens */
const QuestionCard = memo(function QuestionCard({ q, busy, recherche, onVoirExamen, modeSelection, selectionnee, onToggleSelection }) {
  const [ouvert, setOuvert] = useState(false)
  const [occurrencesOuvertes, setOccurrencesOuvertes] = useState(false)
  const rtl = estArabe(q.question)
  const chapitreRtl = estArabe(q._chapitre)
  // Sanitise : _cleUnique est desormais la SIGNATURE de deduplication
  // (matiere|niveau|type|enonce, voir plus haut) -- un texte de question
  // brut ne doit pas finir tel quel dans un attribut HTML id/aria-controls
  // (caracteres speciaux, longueur arbitraire).
  const idReponse = `reponse-${q._cleUnique.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80)}`
  const meta = metaType(q.type)
  const TypeIcon = typeQuestionIcon(q.type)
  const autresOccurrences = (q._occurrences || []).slice(1)

  return (
    <div
      onClick={modeSelection ? () => onToggleSelection(q._cleUnique) : undefined}
      className={`group relative flex h-full flex-col rounded-[20px] border bg-white p-5 transition-colors ${
        modeSelection ? 'cursor-pointer' : ''
      } ${
        selectionnee ? 'border-[#7a0008]/50 bg-[#7a0008]/[0.03] ring-1 ring-[#7a0008]/20' : 'border-[#0f172a]/20 hover:border-[#0f172a]/35'
      }`}
    >
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* NOUVEAU -- case a cocher du mode selection (voir le bouton
              "Choisir des questions" dans l'en-tete de page). */}
          {modeSelection && (
            <span
              aria-hidden="true"
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all ${
                selectionnee ? 'border-[#7a0008] bg-[#7a0008]' : 'border-[#0f172a]/25 bg-white'
              }`}
            >
              {selectionnee && <Check size={11} strokeWidth={3.5} className="text-white" />}
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
            style={{ color: meta.color, background: `${meta.color}1a` }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color }} />
            <TypeIcon size={9} />
            {meta.label}
          </span>
          {q.points != null && (
            <span className="inline-flex items-center gap-1 rounded-full border border-[#0f172a]/15 bg-white px-2 py-0.5 text-[10px] font-bold text-[#0f172a]/70">
              {q.points} pt{q.points > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {!modeSelection && (
          <button
            onClick={() => onVoirExamen(q._examenId, q._statut)}
            disabled={busy}
            className={`flex shrink-0 items-center gap-1 rounded-full border border-[#0f172a]/15 bg-white px-2.5 py-1.5 text-[11.5px] font-semibold text-[#0f172a]/75 transition-all hover:-translate-y-0.5 hover:border-[#0f172a]/40 hover:text-[#0f172a] disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING} ${HOVER_LIFT}`}
          >
            {busy ? <Loader2 size={11} className="animate-spin" /> : <ExternalLink size={11} />}
            Voir l'examen
          </button>
        )}
      </div>

      <p
        dir={rtl ? 'rtl' : 'ltr'}
        className={`relative z-10 mt-3 text-[14.5px] leading-relaxed ${
          rtl ? 'text-right font-medium text-[#0f172a]' : 'examai-serif text-left italic text-[#0f172a]'
        }`}
      >
        {q.question}
      </p>

      <div className="relative z-10 mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-[#0f172a]/50">
        <span className="flex items-center gap-1">
          <BookOpen size={11} /> {MATIERE_LABEL[q._matiere] || q._matiere}
        </span>
        <span className="flex items-center gap-1">
          <GraduationCap size={11} /> {NIVEAU_LABEL[q._niveau] || q._niveau}
        </span>
        {q._chapitre && (
          <span className="flex min-w-0 items-center gap-1">
            <Layers size={11} className="shrink-0" />
            <span dir={chapitreRtl ? 'rtl' : 'ltr'} className="truncate">{q._chapitre}</span>
          </span>
        )}
      </div>

      {/* NOUVEAU -- cette meme question existe dans d'autres examens
          (typiquement : reutilisee dans un examen personnalise, voir le
          mode selection). Repliee par defaut pour ne pas alourdir
          chaque carte quand ce n'est pas le cas. */}
      {autresOccurrences.length > 0 && !modeSelection && (
        <div className="relative z-10 mt-1.5">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setOccurrencesOuvertes((v) => !v) }}
            className={`flex items-center gap-1 text-[10.5px] font-semibold text-[#0f172a]/45 transition-colors hover:text-[#0f172a] ${FOCUS_RING} rounded`}
          >
            <Copy size={10} />
            Utilisée dans {q._occurrences.length} examens
            <ChevronDown size={10} className={`transition-transform ${occurrencesOuvertes ? 'rotate-180' : ''}`} />
          </button>
          {occurrencesOuvertes && (
            <ul className="mt-1 space-y-0.5 border-l-2 border-[#0f172a]/10 pl-2">
              {q._occurrences.map((occ) => (
                <li key={occ.examenId}>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onVoirExamen(occ.examenId, occ.statut) }}
                    className={`truncate text-[10.5px] text-[#0f172a]/55 underline-offset-2 hover:text-[#7a0008] hover:underline ${FOCUS_RING} rounded`}
                  >
                    {occ.examenTitre || `Examen #${occ.examenId}`}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!modeSelection && (
        <button
          type="button"
          onClick={() => setOuvert((v) => !v)}
          aria-expanded={ouvert}
          aria-controls={idReponse}
          className={`relative z-10 mt-auto flex w-fit items-center gap-1.5 self-start rounded-full px-2.5 pt-4 pb-1 -mx-2.5 text-[12px] font-semibold text-[#7a0008] transition-colors hover:bg-[#7a0008]/[0.08] ${FOCUS_RING}`}
        >
          <ChevronDown size={13} className={`transition-transform duration-200 ${ouvert ? 'rotate-180' : ''}`} />
          {ouvert ? 'Masquer la réponse' : 'Voir la réponse'}
        </button>
      )}

      {ouvert && !modeSelection && (
        <div
          id={idReponse}
          className="examai-fade-up relative z-10 mt-2 rounded-[12px] border-l-2 p-3 text-[12.5px] text-[#0f172a]/75"
          style={{ background: `${meta.color}0a`, borderColor: meta.color }}
        >
          <Reponse q={q} />
        </div>
      )}
    </div>
  )
})

/* QuestionRow — vue liste (alignée sur ExamRow de Mes Examens) */
const QuestionRow = memo(function QuestionRow({ q, isLast, busy, recherche, onVoirExamen, modeSelection, selectionnee, onToggleSelection }) {
  const [ouvert, setOuvert] = useState(false)
  const rtl = estArabe(q.question)
  const meta = metaType(q.type)
  const TypeIcon = typeQuestionIcon(q.type)
  const nbOccurrences = (q._occurrences || []).length

  return (
    <div className={!isLast ? 'border-b border-[#0f172a]/10' : ''}>
      <div
        onClick={modeSelection ? () => onToggleSelection(q._cleUnique) : undefined}
        className={`group relative flex items-start gap-3 px-4 py-3.5 transition-colors ${
          modeSelection ? 'cursor-pointer' : ''
        } ${selectionnee ? 'bg-[#7a0008]/[0.04]' : 'hover:bg-[#0f172a]/[0.025]'}`}
      >
        {modeSelection && (
          <span
            aria-hidden="true"
            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all ${
              selectionnee ? 'border-[#7a0008] bg-[#7a0008]' : 'border-[#0f172a]/25 bg-white'
            }`}
          >
            {selectionnee && <Check size={11} strokeWidth={3.5} className="text-white" />}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
              style={{ color: meta.color, background: `${meta.color}1a` }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color }} />
              <TypeIcon size={9} />
              {meta.label}
            </span>
            {q.points != null && (
              <span className="text-[10.5px] font-bold text-[#0f172a]/55">{q.points} pt{q.points > 1 ? 's' : ''}</span>
            )}
            <span className="text-[10.5px] text-[#0f172a]/45">
              {MATIERE_LABEL[q._matiere] || q._matiere} · {NIVEAU_LABEL[q._niveau] || q._niveau}
            </span>
            {/* NOUVEAU -- voir la note dans QuestionCard : cette meme
                question existe dans plusieurs examens (reutilisation via
                un examen personnalise, typiquement). */}
            {nbOccurrences > 1 && (
              <span className="flex items-center gap-1 text-[10.5px] font-semibold text-[#0f172a]/40">
                <Copy size={9} /> {nbOccurrences} examens
              </span>
            )}
          </div>


          <p
            dir={rtl ? 'rtl' : 'ltr'}
            className={`mt-1.5 text-[13px] ${rtl ? 'text-right' : 'text-left'} text-[#0f172a]`}
          >
            {q.question}
          </p>

          {ouvert && !modeSelection && (
            <div
              className="examai-fade-up mt-2 rounded-[12px] border-l-2 p-3 text-[12px] text-[#0f172a]/75"
              style={{ background: `${meta.color}0a`, borderColor: meta.color }}
            >
              <Reponse q={q} />
            </div>
          )}
        </div>

        {!modeSelection && (
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => setOuvert((v) => !v)}
              aria-expanded={ouvert}
              className={`flex h-8 w-8 items-center justify-center rounded-full border border-[#0f172a]/15 text-[#0f172a]/55 transition-colors hover:border-[#0f172a]/40 hover:text-[#0f172a] ${FOCUS_RING}`}
              title={ouvert ? 'Masquer la réponse' : 'Voir la réponse'}
            >
              <ChevronDown size={13} className={`transition-transform ${ouvert ? 'rotate-180' : ''}`} />
            </button>

            <button
              onClick={() => onVoirExamen(q._examenId, q._statut)}
              disabled={busy}
              className={`flex items-center gap-1.5 rounded-full border border-[#0f172a]/15 bg-white px-3 py-1.5 text-[12px] font-semibold text-[#0f172a] transition-colors hover:border-[#0f172a]/40 hover:bg-[#0f172a]/[0.04] disabled:opacity-50 ${FOCUS_RING}`}
            >
              {busy ? <Loader2 size={12} className="animate-spin" /> : <ExternalLink size={12} />}
              Ouvrir
            </button>
          </div>
        )}
      </div>
    </div>
  )
})

/* =================== RÉPONSE (logique conservée) =================== */
function indexReponseCorrecte(q) {
  const candidats = [q.reponseCorrecteIndex, q.reponse_correcte_index, q.indexCorrect, q.correctIndex]
  return candidats.find((v) => typeof v === 'number')
}
function valeurVraiFaux(q) {
  const candidats = [q.reponseCorrecte, q.reponse_correcte, q.correcte, q.reponse]
  const booleen = candidats.find((v) => typeof v === 'boolean')
  if (typeof booleen === 'boolean') return booleen
  const texte = candidats.find((v) => typeof v === 'string')
  if (typeof texte === 'string') {
    const t = texte.trim().toLowerCase()
    if (t === 'vrai' || t === 'true') return true
    if (t === 'faux' || t === 'false') return false
  }
  return null
}
function texteReponseLibre(q) {
  const candidats = [
    q.reponseAttendue, q.reponseCorrecte, q.reponse_correcte,
    q.reponse, q.correction, q.reponseLibre, q.reponse_libre, q.texteReponse,
  ]
  return candidats.find((v) => typeof v === 'string' && v.trim() !== '') || null
}

function Reponse({ q }) {
  if (q.type === 'qcm' && Array.isArray(q.options)) {
    const indexCorrect = indexReponseCorrecte(q)
    return (
      <ul className="space-y-1">
        {q.options.map((opt, i) => {
          const correcte = i === indexCorrect
          const rtl = estArabe(opt)
          return (
            <li
              key={i}
              dir={rtl ? 'rtl' : 'ltr'}
              className={`flex items-center gap-1.5 ${rtl ? 'text-right' : 'text-left'} ${
                correcte ? 'font-semibold text-[#047857]' : ''
              }`}
            >
              {correcte && <Check size={12} className="shrink-0 text-[#047857]" strokeWidth={3} />}
              {opt}
            </li>
          )
        })}
      </ul>
    )
  }

  if (q.type === 'vrai_faux') {
    const val = valeurVraiFaux(q)
    if (val === true) return <p className="font-semibold text-[#047857]">Vrai</p>
    if (val === false) return <p className="font-semibold text-[#047857]">Faux</p>
    return <p className="italic text-[#0f172a]/45">Réponse non disponible</p>
  }

  const libre = texteReponseLibre(q)
  if (!libre) return <p className="italic text-[#0f172a]/45">Réponse non disponible</p>
  const rtl = estArabe(libre)
  return (
    <p dir={rtl ? 'rtl' : 'ltr'} className={rtl ? 'text-right' : 'text-left'}>
      {libre}
    </p>
  )
}