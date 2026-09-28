import { useEffect, useMemo, useState, useCallback, useRef, memo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, Inbox, PenLine, FilePlus2, Download, Trash2, Clock,
  BookOpen, GraduationCap, Loader2, AlertTriangle, LayoutGrid, List,
  ArrowUpDown, MoreVertical, Copy, Eye, Share2, X, CheckCircle2,
  FileEdit, FileCheck2, Send, Sparkles, TrendingUp, RefreshCw,
  Star, Archive, ArchiveRestore, FileJson, FileText, Rows3,
  CheckSquare, Square, Trash, Layers, Filter, ChevronRight,
  ChevronDown, ChevronUp, Calendar, Award, ListChecks, HelpCircle,
  AlignLeft, ToggleLeft, Hash, PenLine as PenLineIcon, Info,
  ExternalLink, Printer, ChevronLeft,
} from 'lucide-react'
import TopNav from '../components/TopNav.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import { useWizard } from '../context/WizardContext.jsx'
import { api } from '../api/client.js'
import { MATIERE_LABEL, NIVEAU_LABEL } from '../data/mockData.js'

/* ============ TOKENS DE DESIGN (identiques au wizard) ============ */
const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f172a]/35 focus-visible:ring-offset-2'
const HOVER_LIFT = 'motion-reduce:transition-none motion-reduce:hover:translate-y-0'
const BRAND = '#7a0008'
const INK = '#0f172a'

/* ============ CONFIG ============ */

const FILTRES = [
  { id: 'tous',      label: 'Tous',      icon: Sparkles,   accent: BRAND },
  { id: 'favoris',   label: 'Favoris',   icon: Star,       accent: '#b45309' },
  { id: 'brouillon', label: 'Brouillon', icon: FileEdit,   accent: '#b45309' },
  { id: 'valide',    label: 'Validé',    icon: FileCheck2, accent: '#047857' },
  { id: 'exporte',   label: 'Exporté',   icon: Send,       accent: '#1d4ed8' },
  { id: 'archives',  label: 'Archives',  icon: Archive,    accent: '#475569' },
]

const TRIS = [
  { id: 'recent',    label: 'Plus récents', icon: Clock },
  { id: 'ancien',    label: 'Plus anciens', icon: Clock },
  { id: 'titre',     label: 'Titre (A→Z)',  icon: AlignLeft },
  { id: 'matiere',   label: 'Matière',      icon: BookOpen },
  { id: 'questions', label: 'Nb questions', icon: ListChecks },
  { id: 'statut',    label: 'Statut',       icon: Info },
]

const PERIODES = [
  { id: 'tout', label: 'Tout' },
  { id: '7j',   label: '7 jours' },
  { id: '30j',  label: '30 jours' },
]

const STATUT_META = {
  brouillon: { color: '#b45309', glow: 'rgba(180,83,9,0.10)', label: 'Brouillon' },
  valide:    { color: '#047857', glow: 'rgba(4,120,87,0.10)',  label: 'Validé' },
  exporte:   { color: '#1d4ed8', glow: 'rgba(29,78,216,0.10)', label: 'Exporté' },
}

/* ============ HELPERS ============ */

/**
 * ✅ CORRIGÉ : normalise le statut (casse, accents, espaces) puis décide
 * de l'étape. Un brouillon (ou tout statut inconnu/vide) ouvre l'ÉDITION.
 */
function etapePourStatut(statut) {
  const s = String(statut || '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  if (s === 'exporte' || s === 'exported' || s === 'published') return '/wizard/export'
  if (s === 'valide' || s === 'validated' || s === 'approved') return '/wizard/validation'
  // brouillon, draft, vide, inconnu → édition
  return '/wizard/edition'
}

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

function relativeDate(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const j = Math.floor(diff / 86400000)
  if (j === 0) return "Aujourd'hui"
  if (j === 1) return 'Hier'
  if (j < 7) return `Il y a ${j} j`
  if (j < 30) return `Il y a ${Math.floor(j / 7)} sem.`
  return formatDate(iso)
}

function typeQuestionLabel(type) {
  const map = {
    qcm: 'QCM', vrai_faux: 'Vrai/Faux', ouverte: 'Ouverte',
    calcul: 'Calcul', redaction: 'Rédaction', association: 'Association',
    texte_trous: 'Texte à trous', phrase_a_trous: 'Texte à trous', trous: 'Texte à trous',
  }
  return map[type] || type || 'Question'
}

function typeQuestionIcon(type) {
  const map = {
    qcm: ListChecks, vrai_faux: ToggleLeft, ouverte: AlignLeft,
    calcul: Hash, redaction: PenLine, association: Layers,
    texte_trous: AlignLeft, phrase_a_trous: AlignLeft, trous: AlignLeft,
  }
  return map[type] || HelpCircle
}

function texteQuestion(q) {
  const candidats = [
    q.enonce, q.question, q.intitule, q.texte, q.contenu,
    q.libelle, q.consigne, q.titre, q.text, q.label, q.prompt,
  ]
  const trouve = candidats.find((v) => typeof v === 'string' && v.trim() !== '')
  return trouve || null
}

async function copierTexte(texte) {
  if (navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(texte); return } catch { /* fallback */ }
  }
  const zone = document.createElement('textarea')
  zone.value = texte
  zone.style.position = 'fixed'
  zone.style.opacity = '0'
  document.body.appendChild(zone)
  zone.focus(); zone.select()
  try {
    const ok = document.execCommand('copy')
    if (!ok) throw new Error('La copie a échoué')
  } finally { zone.remove() }
}

/* ============ COMPOSANT PRINCIPAL ============ */

export default function MesExamens() {
  const navigate = useNavigate()
  const { chargerExamen } = useWizard()

  const [examens, setExamens] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [recherche, setRecherche] = useState('')
  const [rechercheDebounced, setRechercheDebounced] = useState('')
  const [filtreStatut, setFiltreStatut] = useState('tous')
  const [filtreMatiere, setFiltreMatiere] = useState([])
  const [filtreNiveau, setFiltreNiveau] = useState([])
  const [filtrePeriode, setFiltrePeriode] = useState('tout')
  const [tri, setTri] = useState('recent')
  const [vue, setVue] = useState(() => {
    try { return localStorage.getItem('examai_vue') || 'grid' } catch { return 'grid' }
  })
  const [enCours, setEnCours] = useState(null)
  const [menuOuvert, setMenuOuvert] = useState(null)
  const [toast, setToast] = useState(null)
  const [confirmation, setConfirmation] = useState(null)
  const [confirmBusy, setConfirmBusy] = useState(false)
  const [selection, setSelection] = useState(new Set())
  const [favoris, setFavoris] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('examai_favoris') || '[]')) } catch { return new Set() }
  })
  const [archives, setArchives] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('examai_archives') || '[]')) } catch { return new Set() }
  })
  const [panneauOuvert, setPanneauOuvert] = useState(true)
  const [drawerItem, setDrawerItem] = useState(null)
  const [filtresAvancesOuverts, setFiltresAvancesOuverts] = useState(false)

  useEffect(() => { localStorage.setItem('examai_favoris', JSON.stringify([...favoris])) }, [favoris])
  useEffect(() => { localStorage.setItem('examai_archives', JSON.stringify([...archives])) }, [archives])
  useEffect(() => { try { localStorage.setItem('examai_vue', vue) } catch {} }, [vue])
  useEffect(() => { charger() }, [])

  useEffect(() => {
    const t = setTimeout(() => setRechercheDebounced(recherche), 250)
    return () => clearTimeout(t)
  }, [recherche])

  function charger() {
    setChargement(true); setErreur(null)
    api.listExamens()
      .then((data) => setExamens(data))
      .catch((e) => setErreur(e.message))
      .finally(() => setChargement(false))
  }

  useEffect(() => {
    function onClick() { setMenuOuvert(null) }
    if (menuOuvert) {
      window.addEventListener('click', onClick)
      return () => window.removeEventListener('click', onClick)
    }
  }, [menuOuvert])

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
      if (e.key === '/') { e.preventDefault(); document.getElementById('examai-search')?.focus() }
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); navigate('/wizard/selection') }
      if (e.key === 'Escape') {
        if (confirmation) setConfirmation(null)
        else if (menuOuvert) setMenuOuvert(null)
        else if (drawerItem) setDrawerItem(null)
        else setSelection(new Set())
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate, drawerItem, menuOuvert, confirmation])

  /* ============ STATS ============ */
  const stats = useMemo(() => {
    const actifs = examens.filter((e) => !archives.has(e.id))
    return {
      total: actifs.length,
      brouillon: actifs.filter((e) => e.statut === 'brouillon').length,
      valide: actifs.filter((e) => e.statut === 'valide').length,
      exporte: actifs.filter((e) => e.statut === 'exporte').length,
      archives: examens.filter((e) => archives.has(e.id)).length,
      favoris: actifs.filter((e) => favoris.has(e.id)).length,
      questions: actifs.reduce((acc, e) => acc + (e.questions?.length || 0), 0),
    }
  }, [examens, favoris, archives])

  const matieresDispo = useMemo(() => {
    const set = new Set(examens.map((e) => e.matiere).filter(Boolean))
    return [...set].sort()
  }, [examens])

  const niveauxDispo = useMemo(() => {
    const set = new Set(examens.map((e) => e.niveau).filter(Boolean))
    return [...set].sort()
  }, [examens])

  /* ============ FILTRAGE + TRI ============ */
  const examensFiltres = useMemo(() => {
    const q = rechercheDebounced.trim().toLowerCase()
    const now = Date.now()

    let result = examens.filter((item) => {
      const estArchive = archives.has(item.id)

      if (filtreStatut === 'archives') { if (!estArchive) return false }
      else if (estArchive) return false
      if (filtreStatut === 'favoris' && !favoris.has(item.id)) return false
      if (['brouillon', 'valide', 'exporte'].includes(filtreStatut) && item.statut !== filtreStatut) return false

      if (filtreMatiere.length && !filtreMatiere.includes(item.matiere)) return false
      if (filtreNiveau.length && !filtreNiveau.includes(item.niveau)) return false

      if (filtrePeriode !== 'tout') {
        const jours = filtrePeriode === '7j' ? 7 : 30
        const d = new Date(item.updated_at || 0).getTime()
        if (now - d > jours * 86400000) return false
      }

      if (!q) return true
      const cible = [
        item.titre,
        MATIERE_LABEL[item.matiere] || item.matiere,
        NIVEAU_LABEL[item.niveau] || item.niveau,
        item.chapitre,
        ...(item.questions || []).map((qq) => qq.enonce || qq.titre || ''),
      ].join(' ').toLowerCase()
      return cible.includes(q)
    })

    const sorters = {
      recent:    (a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0),
      ancien:    (a, b) => new Date(a.updated_at || 0) - new Date(b.updated_at || 0),
      titre:     (a, b) => (a.titre || '').localeCompare(b.titre || ''),
      matiere:   (a, b) => (a.matiere || '').localeCompare(b.matiere || ''),
      questions: (a, b) => (b.questions?.length || 0) - (a.questions?.length || 0),
      statut:    (a, b) => (a.statut || '').localeCompare(b.statut || ''),
    }

    const favs = result.filter((e) => favoris.has(e.id))
    const autres = result.filter((e) => !favoris.has(e.id))
    favs.sort(sorters[tri] || sorters.recent)
    autres.sort(sorters[tri] || sorters.recent)
    return [...favs, ...autres]
  }, [examens, rechercheDebounced, filtreStatut, filtreMatiere, filtreNiveau, filtrePeriode, tri, favoris, archives])

  const filtresActifs = filtreStatut !== 'tous' || recherche.trim() || filtreMatiere.length || filtreNiveau.length || filtrePeriode !== 'tout'
  const selectionArray = [...selection]

  /* ============ ACTIONS ============ */

  /**
   * ✅ CORRIGÉ : on force la destination.
   * - brouillon → /wizard/edition (même si on vient de la liste)
   * - valide    → /wizard/validation
   * - exporte   → /wizard/export
   * Le `chargerExamen` peut modifier `examen.statut` dans le contexte ; on
   * se base donc sur le statut ORIGINAL de l'item de la liste (item.statut),
   * pas sur celui du contexte après chargement.
   */
  const handleOuvrir = useCallback(async (item) => {
    setEnCours(item.id); setErreur(null)
    try {
      await chargerExamen(item.id)
      const route = etapePourStatut(item.statut)
      navigate(route)
    } catch (e) {
      setErreur(e.message)
      setEnCours(null)
    }
  }, [chargerExamen, navigate])

  const handleExporter = useCallback(async (item, format = 'pdf') => {
    setMenuOuvert(null)
    setEnCours(item.id); setErreur(null)
    try {
      const blob = await api.exportExamen(item.id, {
        langue: 'fr', format, en_tete: true, pagination: true, nom_etablissement: '',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `examen_${item.id}.${format}`
      document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(url)
      setToast(`Export ${format.toUpperCase()} téléchargé`)
    } catch (e) { setErreur(e.message) }
    finally { setEnCours(null) }
  }, [])

  const handleSupprimer = useCallback((item) => {
    setMenuOuvert(null)
    setConfirmation({
      title: 'Supprimer cet examen ?',
      message: `« ${item.titre} » sera définitivement supprimé. Cette action est irréversible.`,
      confirmLabel: 'Supprimer',
      onConfirm: async () => {
        setEnCours(item.id); setErreur(null)
        try {
          await api.deleteExamen(item.id)
          setExamens((prev) => prev.filter((e) => e.id !== item.id))
          setToast('Examen supprimé')
          setDrawerItem((prev) => (prev?.id === item.id ? null : prev))
        } catch (e) { setErreur(e.message) }
        finally { setEnCours(null) }
      },
    })
  }, [])

  const handleDupliquer = useCallback(async (item) => {
    setEnCours(item.id)
    try {
      if (api.duplicateExamen) {
        const copie = await api.duplicateExamen(item.id)
        setExamens((prev) => [copie, ...prev])
      } else {
        setExamens((prev) => [
          { ...item, id: `${item.id}-copy-${Date.now()}`, titre: `${item.titre} (copie)`, statut: 'brouillon', updated_at: new Date().toISOString() },
          ...prev,
        ])
      }
      setToast('Examen dupliqué')
    } catch (e) { setErreur(e.message) }
    finally { setEnCours(null); setMenuOuvert(null) }
  }, [])

  const handlePartager = useCallback((item) => {
    const url = `${window.location.origin}/examen/${item.id}`
    copierTexte(url)
      .then(() => setToast('Lien copié dans le presse-papier'))
      .catch(() => setErreur('Impossible de copier le lien automatiquement.'))
    setMenuOuvert(null)
  }, [])

  const toggleFavori = useCallback((id) => {
    setFavoris((prev) => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }, [])

  const toggleArchive = useCallback((id) => {
    setArchives((prev) => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
    setMenuOuvert(null)
  }, [])

  const toggleSelection = useCallback((id) => {
    setSelection((prev) => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }, [])

  const toggleMenu = useCallback((id, e) => {
    e.stopPropagation()
    setMenuOuvert((prev) => (prev === id ? null : id))
  }, [])

  function toggleSelectAll() {
    if (selection.size === examensFiltres.length) setSelection(new Set())
    else setSelection(new Set(examensFiltres.map((e) => e.id)))
  }

  function toggleInArray(setter, value) {
    setter((prev) => prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value])
  }

  function resetFiltres() {
    setRecherche(''); setFiltreStatut('tous')
    setFiltreMatiere([]); setFiltreNiveau([]); setFiltrePeriode('tout')
  }

  async function actionMasse(type) {
    const ids = selectionArray
    if (type === 'supprimer') {
      setConfirmation({
        title: `Supprimer ${ids.length} examen(s) ?`,
        message: 'Cette action est irréversible et supprimera définitivement les examens sélectionnés.',
        confirmLabel: 'Supprimer',
        onConfirm: async () => {
          try {
            await Promise.all(ids.map((id) => api.deleteExamen(id)))
            setExamens((prev) => prev.filter((e) => !ids.includes(e.id)))
            setToast(`${ids.length} examen(s) supprimé(s)`)
            setSelection(new Set())
          } catch (e) { setErreur(e.message) }
        },
      })
      return
    }
    if (type === 'archiver') {
      setArchives((prev) => { const n = new Set(prev); ids.forEach((id) => n.add(id)); return n })
      setToast(`${ids.length} examen(s) archivé(s)`)
    } else if (type === 'exporter') {
      for (const id of ids) {
        const item = examens.find((e) => e.id === id)
        if (item && (item.questions?.length || 0) > 0) await handleExporter(item)
      }
    }
    setSelection(new Set())
  }

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

        @keyframes examaiMenuPop {
          from { opacity: 0; transform: scale(.96) translateY(-4px); }
          to   { opacity: 1; transform: none; }
        }
        .examai-menu-pop { animation: examaiMenuPop .16s cubic-bezier(.22,1,.36,1) both; transform-origin: top right; }

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

        @keyframes examaiDrawerIn {
          from { opacity: 0; transform: translateX(40px); }
          to   { opacity: 1; transform: none; }
        }
        .examai-drawer-in { animation: examaiDrawerIn .32s cubic-bezier(.22,1,.36,1) both; }

        @keyframes examaiOverlayIn { from { opacity: 0 } to { opacity: 1 } }
        .examai-overlay-in { animation: examaiOverlayIn .22s ease-out both; }

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
          .examai-fade-up, .examai-menu-pop, .examai-toast-in,
          .examai-slide-left, .examai-drawer-in, .examai-overlay-in,
          .examai-skeleton { animation: none !important; }
        }
      `}</style>

      <TopNav />

      <main className="mx-auto max-w-7xl px-6 py-8">

        {/* ====== EN-TÊTE ====== */}
        <div className="relative mb-6 w-full overflow-hidden rounded-[28px] border border-[#0f172a]/20 bg-white p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="examai-serif text-[30px] sm:text-[40px] lg:text-[42px] font-semibold tracking-[-0.025em] text-[#0f172a] leading-[1.15]">
                Mes{' '}
                <span className="text-[#7a0008] relative">
                  <span className="examai-underline-wave">Examens.</span>
                </span>
              </h1>
              <p className="examai-serif mt-3 text-[14px] sm:text-[15px] font-normal italic leading-[1.6] text-[#0f172a]/75 max-w-[620px]">
                Retrouvez, modifiez et exportez tous les examens que vous avez créés.
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#0f172a]/15 bg-white px-2.5 py-1 text-[11.5px] font-bold text-[#0f172a] tabular-nums">
                  <Layers size={11} />
                  {stats.total} actif{stats.total > 1 ? 's' : ''}
                </span>
                {stats.favoris > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/60 bg-amber-50/60 px-2.5 py-1 text-[11px] font-bold text-amber-700">
                    <Star size={10} fill="currentColor" /> {stats.favoris}
                  </span>
                )}
                {stats.archives > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-[#0f172a]/15 bg-white px-2.5 py-1 text-[11px] font-bold text-[#0f172a]/60">
                    <Archive size={10} /> {stats.archives}
                  </span>
                )}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button onClick={charger} disabled={chargement} title="Actualiser" aria-label="Actualiser"
                className={`flex h-10 w-10 items-center justify-center rounded-full border border-[#0f172a]/15 bg-white text-[#0f172a]/60 transition-all hover:border-[#0f172a]/40 hover:text-[#0f172a] disabled:opacity-50 ${FOCUS_RING}`}>
                <RefreshCw size={14} className={chargement ? 'animate-spin' : ''} />
              </button>
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
              <button onClick={() => navigate('/wizard/selection')}
                className={`examai-shine group relative flex items-center gap-2 rounded-full bg-[#7a0008] px-5 py-2.5 text-[13px] font-semibold text-white shadow-[0_1px_2px_rgba(79,0,5,0.2),0_10px_22px_-8px_rgba(122,0,8,0.55),inset_0_1px_0_rgba(255,255,255,0.15)] transition-all hover:-translate-y-0.5 hover:bg-[#961014] hover:shadow-[0_1px_2px_rgba(79,0,5,0.25),0_14px_28px_-8px_rgba(122,0,8,0.65),inset_0_1px_0_rgba(255,255,255,0.2)] active:scale-[0.985] ${FOCUS_RING} ${HOVER_LIFT}`}>
                <FilePlus2 size={15} className="transition-transform group-hover:rotate-90 motion-reduce:group-hover:rotate-0" />
                Nouvel examen
              </button>
            </div>
          </div>
        </div>

        {/* ====== LAYOUT ====== */}
        <div className={`grid gap-5 ${panneauOuvert ? 'lg:grid-cols-[280px_1fr] lg:items-start' : ''}`}>
          {panneauOuvert && (
            <aside className="examai-slide-left hidden lg:block lg:sticky lg:top-6 lg:self-start space-y-4">
              <div className="rounded-[24px] border border-[#0f172a]/20 bg-white p-4">
                <div className="mb-3 flex items-center gap-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[#7a0008]/[0.08] text-[#7a0008]">
                    <TrendingUp size={15} />
                  </span>
                  <div className="min-w-0">
                    <p className="examai-serif text-[14.5px] font-semibold text-[#0f172a]">Aperçu</p>
                    <p className="text-[10.5px] font-bold italic text-[#0f172a]/45">
                      {stats.questions} question{stats.questions > 1 ? 's' : ''} au total
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <StatTile icon={Layers}     label="Total"      value={stats.total}     accent={BRAND} />
                  <StatTile icon={FileEdit}   label="Brouillons" value={stats.brouillon} accent="#b45309" />
                  <StatTile icon={FileCheck2} label="Validés"    value={stats.valide}    accent="#047857" />
                  <StatTile icon={Send}       label="Exportés"   value={stats.exporte}   accent="#1d4ed8" />
                </div>
              </div>

              <div className="rounded-[24px] border border-[#0f172a]/20 bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[#0f172a]/55">
                    <Filter size={11} /> Filtres avancés
                  </span>
                  {filtresActifs && (
                    <button onClick={resetFiltres}
                      className={`text-[10.5px] font-semibold text-[#0f172a]/60 transition-colors hover:text-[#7a0008] ${FOCUS_RING} rounded`}>
                      Réinitialiser
                    </button>
                  )}
                </div>

                <FiltresRapides
                  matieresDispo={matieresDispo} niveauxDispo={niveauxDispo}
                  filtreMatiere={filtreMatiere} filtreNiveau={filtreNiveau} filtrePeriode={filtrePeriode}
                  onToggleMatiere={(m) => toggleInArray(setFiltreMatiere, m)}
                  onToggleNiveau={(n) => toggleInArray(setFiltreNiveau, n)}
                  onSetPeriode={setFiltrePeriode}
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
                    id="examai-search"
                    value={recherche}
                    onChange={(e) => setRecherche(e.target.value)}
                    placeholder="Rechercher par titre, matière, chapitre…"
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

                <div className="relative">
                  <ArrowUpDown size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#0f172a]/50" />
                  <select value={tri} onChange={(e) => setTri(e.target.value)} aria-label="Trier par"
                    className={`appearance-none rounded-full border border-[#0f172a]/15 bg-white py-2.5 pl-8 pr-8 text-[12.5px] font-medium text-[#0f172a]/85 outline-none transition-all hover:border-[#0f172a]/30 focus:border-[#0f172a]/40 focus:shadow-[0_0_0_4px_rgba(15,23,42,0.10)] ${FOCUS_RING}`}>
                    {TRIS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                  <ChevronDown size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#0f172a]/45" />
                </div>

                <button onClick={() => setFiltresAvancesOuverts((v) => !v)}
                  className={`lg:hidden flex items-center gap-1.5 rounded-full border px-3 py-2.5 text-[12px] font-semibold transition-all ${FOCUS_RING} ${
                    filtresAvancesOuverts || filtreMatiere.length || filtreNiveau.length || filtrePeriode !== 'tout'
                      ? 'border-[#7a0008]/40 bg-[#7a0008]/[0.06] text-[#7a0008]'
                      : 'border-[#0f172a]/15 bg-white text-[#0f172a]/70'
                  }`}>
                  <Filter size={13} /> Filtres
                </button>

                <div className="flex items-center gap-0.5 rounded-full border border-[#0f172a]/15 bg-white p-0.5">
                  {[
                    { v: 'grid',    I: LayoutGrid, l: 'Grille' },
                    { v: 'list',    I: List,       l: 'Liste' },
                    { v: 'compact', I: Rows3,      l: 'Compact' },
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
                    matieresDispo={matieresDispo} niveauxDispo={niveauxDispo}
                    filtreMatiere={filtreMatiere} filtreNiveau={filtreNiveau} filtrePeriode={filtrePeriode}
                    onToggleMatiere={(m) => toggleInArray(setFiltreMatiere, m)}
                    onToggleNiveau={(n) => toggleInArray(setFiltreNiveau, n)}
                    onSetPeriode={setFiltrePeriode}
                  />
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-[#0f172a]/10 pt-3">
                {FILTRES.map((f) => {
                  const Icon = f.icon
                  const active = filtreStatut === f.id
                  const count = f.id === 'tous' ? stats.total
                    : f.id === 'favoris' ? stats.favoris
                    : f.id === 'archives' ? stats.archives
                    : stats[f.id] || 0
                  return (
                    <button key={f.id} onClick={() => setFiltreStatut(f.id)} aria-pressed={active}
                      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-all ${FOCUS_RING} ${
                        active
                          ? 'border-transparent bg-[#7a0008] text-white shadow-[0_4px_10px_-4px_rgba(122,0,8,0.45)]'
                          : 'border-[#0f172a]/15 bg-white text-[#0f172a]/70 hover:border-[#0f172a]/30 hover:text-[#0f172a] hover:bg-[#0f172a]/[0.03]'
                      }`}>
                      <Icon size={12} />
                      {f.label}
                      <span className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[10.5px] font-bold tabular-nums ${
                        active ? 'bg-white/20 text-white' : 'bg-[#0f172a]/[0.06] text-[#0f172a]/60'
                      }`}>
                        {count}
                      </span>
                    </button>
                  )
                })}

                {examensFiltres.length > 0 && (
                  <button onClick={toggleSelectAll}
                    className={`ml-auto flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11.5px] font-semibold text-[#0f172a]/60 transition-colors hover:bg-[#0f172a]/[0.06] hover:text-[#0f172a] ${FOCUS_RING}`}>
                    {selection.size === examensFiltres.length && examensFiltres.length > 0
                      ? <><CheckSquare size={12} /> Tout désélectionner</>
                      : <><Square size={12} /> Tout sélectionner</>}
                  </button>
                )}
              </div>
            </div>

            {filtresActifs && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1 text-[11.5px] font-semibold text-[#0f172a]/60">
                  {examensFiltres.length} résultat{examensFiltres.length > 1 ? 's' : ''}
                </span>
                {recherche && <FilterChip label={`« ${recherche} »`} onClear={() => setRecherche('')} />}
                {filtreStatut !== 'tous' && (
                  <FilterChip label={FILTRES.find((f) => f.id === filtreStatut)?.label} onClear={() => setFiltreStatut('tous')} />
                )}
                {filtreMatiere.map((m) => (
                  <FilterChip key={m} label={MATIERE_LABEL[m] || m} onClear={() => toggleInArray(setFiltreMatiere, m)} />
                ))}
                {filtreNiveau.map((n) => (
                  <FilterChip key={n} label={NIVEAU_LABEL[n] || n} onClear={() => toggleInArray(setFiltreNiveau, n)} />
                ))}
                {filtrePeriode !== 'tout' && (
                  <FilterChip label={PERIODES.find((p) => p.id === filtrePeriode)?.label} onClear={() => setFiltrePeriode('tout')} />
                )}
                {(filtreMatiere.length + filtreNiveau.length + (filtrePeriode !== 'tout' ? 1 : 0) + (filtreStatut !== 'tous' ? 1 : 0) + (recherche ? 1 : 0)) > 1 && (
                  <button onClick={resetFiltres}
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
                  <div key={i} className="examai-skeleton h-[200px] rounded-[20px] border border-[#0f172a]/10" />
                ))}
              </div>
            )}

            {!chargement && examensFiltres.length === 0 && (
              <div className="examai-fade-up mt-8 flex flex-col items-center justify-center rounded-[24px] border border-dashed border-[#0f172a]/25 bg-white px-6 py-16 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#7a0008]/[0.08] text-[#7a0008]">
                  <Inbox size={22} />
                </span>
                <p className="examai-serif mt-4 text-[18px] font-semibold text-[#0f172a]">
                  {filtresActifs ? 'Aucun examen ne correspond' : "Aucun examen pour l'instant"}
                </p>
                <p className="examai-serif mt-2 max-w-sm text-[13.5px] font-bold italic text-[#0f172a]/55">
                  {filtresActifs
                    ? 'Essayez un autre mot-clé ou réinitialisez les filtres.'
                    : 'Créez votre premier examen en quelques clics grâce au générateur guidé.'}
                </p>
                {filtresActifs ? (
                  <button onClick={resetFiltres}
                    className={`mt-5 rounded-full border border-[#0f172a]/20 bg-white px-4 py-2 text-[12.5px] font-semibold text-[#0f172a]/75 transition-all hover:-translate-y-0.5 hover:border-[#0f172a]/50 hover:text-[#0f172a] ${FOCUS_RING} ${HOVER_LIFT}`}>
                    Réinitialiser
                  </button>
                ) : (
                  <button onClick={() => navigate('/wizard/selection')}
                    className={`mt-5 flex items-center gap-2 rounded-full bg-[#7a0008] px-5 py-2.5 text-[12.5px] font-semibold text-white shadow-[0_1px_2px_rgba(79,0,5,0.2),0_10px_22px_-8px_rgba(122,0,8,0.5)] transition-all hover:-translate-y-0.5 active:scale-[0.985] ${FOCUS_RING} ${HOVER_LIFT}`}>
                    <FilePlus2 size={14} /> Créer mon premier examen
                  </button>
                )}
              </div>
            )}

            {!chargement && examensFiltres.length > 0 && (
              vue === 'grid' ? (
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  {examensFiltres.map((item, i) => (
                    <div key={item.id} className="examai-fade-up" style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}>
                      <ExamCard
                        item={item}
                        busy={enCours === item.id}
                        menuOuvert={menuOuvert === item.id}
                        favori={favoris.has(item.id)}
                        selectionne={selection.has(item.id)}
                        recherche={rechercheDebounced}
                        onToggleFavori={toggleFavori}
                        onToggleSelection={toggleSelection}
                        onToggleMenu={toggleMenu}
                        onOuvrir={handleOuvrir}
                        onOuvrirDetails={setDrawerItem}
                        onExporter={handleExporter}
                        onSupprimer={handleSupprimer}
                        onDupliquer={handleDupliquer}
                        onPartager={handlePartager}
                        onArchiver={toggleArchive}
                        estArchive={archives.has(item.id)}
                      />
                    </div>
                  ))}
                </div>
              ) : vue === 'list' ? (
                <div className="examai-fade-up mt-5 overflow-hidden rounded-[20px] border border-[#0f172a]/20 bg-white shadow-[0_10px_28px_-16px_rgba(15,23,42,0.15)]">
                  {examensFiltres.map((item, i) => (
                    <ExamRow key={item.id} item={item} busy={enCours === item.id}
                      isLast={i === examensFiltres.length - 1}
                      menuOuvert={menuOuvert === item.id}
                      favori={favoris.has(item.id)}
                      selectionne={selection.has(item.id)}
                      recherche={rechercheDebounced}
                      onToggleFavori={toggleFavori}
                      onToggleSelection={toggleSelection}
                      onToggleMenu={toggleMenu}
                      onOuvrir={handleOuvrir}
                      onOuvrirDetails={setDrawerItem}
                      onExporter={handleExporter}
                      onSupprimer={handleSupprimer}
                      onDupliquer={handleDupliquer}
                      onPartager={handlePartager}
                      onArchiver={toggleArchive}
                      estArchive={archives.has(item.id)} />
                  ))}
                </div>
              ) : (
                <div className="examai-fade-up mt-5 overflow-hidden rounded-[20px] border border-[#0f172a]/20 bg-white shadow-[0_10px_28px_-16px_rgba(15,23,42,0.12)]">
                  {examensFiltres.map((item, i) => (
                    <CompactRow key={item.id} item={item}
                      isLast={i === examensFiltres.length - 1}
                      favori={favoris.has(item.id)}
                      selectionne={selection.has(item.id)}
                      recherche={rechercheDebounced}
                      onToggleFavori={toggleFavori}
                      onToggleSelection={toggleSelection}
                      onOuvrir={handleOuvrir}
                      onOuvrirDetails={setDrawerItem} />
                  ))}
                </div>
              )
            )}
          </div>
        </div>
      </main>

      {selection.size > 0 && (
        <div className="examai-toast-in fixed bottom-6 left-1/2 z-40 -translate-x-1/2">
          <div className="flex items-center gap-2 rounded-full border border-[#0f172a]/20 bg-white px-2 py-1.5 shadow-[0_14px_32px_-14px_rgba(15,23,42,0.3)]">
            <span className="ml-2 text-[12.5px] font-bold text-[#0f172a]">
              {selection.size} sélectionné{selection.size > 1 ? 's' : ''}
            </span>
            <span className="mx-1 h-5 w-px bg-[#0f172a]/15" />
            <button onClick={() => actionMasse('exporter')}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold text-[#0f172a] transition-colors hover:bg-[#0f172a]/[0.06] ${FOCUS_RING}`}>
              <Download size={13} /> Exporter
            </button>
            <button onClick={() => actionMasse('archiver')}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold text-[#0f172a] transition-colors hover:bg-[#0f172a]/[0.06] ${FOCUS_RING}`}>
              <Archive size={13} /> Archiver
            </button>
            <button onClick={() => actionMasse('supprimer')}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold text-[#7a0008] transition-colors hover:bg-[#7a0008]/[0.08] ${FOCUS_RING}`}>
              <Trash size={13} /> Supprimer
            </button>
            <button onClick={() => setSelection(new Set())} aria-label="Annuler la sélection"
              className={`flex h-7 w-7 items-center justify-center rounded-full text-[#0f172a]/50 hover:bg-[#0f172a]/[0.06] hover:text-[#0f172a] ${FOCUS_RING}`}>
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div className="examai-toast-in fixed bottom-6 left-1/2 z-50 -translate-x-1/2" role="status" aria-live="polite">
          <div className="flex items-center gap-2 rounded-full border border-[#0f172a]/20 bg-white px-4 py-2.5 text-[12.5px] font-semibold text-[#0f172a] shadow-[0_14px_32px_-14px_rgba(15,23,42,0.3)]">
            <CheckCircle2 size={14} className="text-emerald-600" />
            {toast}
          </div>
        </div>
      )}

      {confirmation && (
        <ConfirmDialog
          title={confirmation.title}
          message={confirmation.message}
          confirmLabel={confirmation.confirmLabel}
          busy={confirmBusy}
          onCancel={() => setConfirmation(null)}
          onConfirm={async () => {
            setConfirmBusy(true)
            try { await confirmation.onConfirm() }
            finally { setConfirmBusy(false); setConfirmation(null) }
          }}
        />
      )}

      {drawerItem && (
        <ExamDrawer
          item={drawerItem}
          busy={enCours === drawerItem.id}
          favori={favoris.has(drawerItem.id)}
          estArchive={archives.has(drawerItem.id)}
          onClose={() => setDrawerItem(null)}
          onToggleFavori={() => toggleFavori(drawerItem.id)}
          onOuvrir={handleOuvrir}
          onExporter={handleExporter}
          onSupprimer={handleSupprimer}
          onDupliquer={handleDupliquer}
          onPartager={handlePartager}
          onArchiver={() => toggleArchive(drawerItem.id)}
        />
      )}
    </div>
  )
}

/* =================== SOUS-COMPOSANTS =================== */

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

function FiltresRapides({
  matieresDispo, niveauxDispo, filtreMatiere, filtreNiveau, filtrePeriode,
  onToggleMatiere, onToggleNiveau, onSetPeriode,
}) {
  return (
    <>
      {matieresDispo.length > 0 && (
        <div className="mb-3">
          <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wider text-[#0f172a]/50">Matière</p>
          <div className="flex flex-wrap gap-1.5">
            {matieresDispo.map((m) => {
              const active = filtreMatiere.includes(m)
              return (
                <button key={m} onClick={() => onToggleMatiere(m)} aria-pressed={active}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all ${FOCUS_RING} ${
                    active
                      ? 'border-transparent bg-[#7a0008] text-white shadow-[0_3px_8px_-3px_rgba(122,0,8,0.4)]'
                      : 'border-[#0f172a]/15 bg-white text-[#0f172a]/70 hover:border-[#0f172a]/30 hover:text-[#0f172a]'
                  }`}>
                  {MATIERE_LABEL[m] || m}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {niveauxDispo.length > 0 && (
        <div className="mb-3">
          <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wider text-[#0f172a]/50">Niveau</p>
          <div className="flex flex-wrap gap-1.5">
            {niveauxDispo.map((n) => {
              const active = filtreNiveau.includes(n)
              return (
                <button key={n} onClick={() => onToggleNiveau(n)} aria-pressed={active}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all ${FOCUS_RING} ${
                    active
                      ? 'border-transparent bg-[#7a0008] text-white shadow-[0_3px_8px_-3px_rgba(122,0,8,0.4)]'
                      : 'border-[#0f172a]/15 bg-white text-[#0f172a]/70 hover:border-[#0f172a]/30 hover:text-[#0f172a]'
                  }`}>
                  {NIVEAU_LABEL[n] || n}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div>
        <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wider text-[#0f172a]/50">Période</p>
        <div className="flex flex-wrap gap-1.5">
          {PERIODES.map((p) => {
            const active = filtrePeriode === p.id
            return (
              <button key={p.id} onClick={() => onSetPeriode(p.id)} aria-pressed={active}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all ${FOCUS_RING} ${
                  active
                    ? 'border-transparent bg-[#7a0008] text-white shadow-[0_3px_8px_-3px_rgba(122,0,8,0.4)]'
                    : 'border-[#0f172a]/15 bg-white text-[#0f172a]/70 hover:border-[#0f172a]/30 hover:text-[#0f172a]'
                }`}>
                {p.label}
              </button>
            )
          })}
        </div>
      </div>
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

function MenuItem({ icon: Icon, children, danger, disabled, onClick }) {
  return (
    <button onClick={onClick} disabled={disabled} role="menuitem"
      className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12.5px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        danger
          ? 'text-[#7a0008] hover:bg-[#7a0008]/[0.06]'
          : 'text-[#0f172a]/80 hover:bg-[#0f172a]/[0.05] hover:text-[#0f172a]'
      }`}>
      <Icon size={13} />
      {children}
    </button>
  )
}

function CardMenu({ item, onOuvrir, onExporter, onSupprimer, onDupliquer, onPartager, onArchiver, estArchive }) {
  const nb = item.questions?.length || 0
  return (
    <div role="menu"
      className="examai-menu-pop absolute right-3 top-12 z-20 w-52 overflow-hidden rounded-[14px] border border-[#0f172a]/15 bg-white py-1 shadow-[0_18px_40px_-16px_rgba(15,23,42,0.28)]"
      onClick={(e) => e.stopPropagation()}>
      <MenuItem icon={PenLine} onClick={() => onOuvrir(item)}>Ouvrir</MenuItem>
      <MenuItem icon={Eye} onClick={() => window.open(`/examen/${item.id}`, '_blank')}>Aperçu</MenuItem>
      <div className="my-1 h-px bg-[#0f172a]/8" />
      <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#0f172a]/45">Exporter</div>
      <MenuItem icon={FileText} disabled={nb === 0} onClick={() => onExporter(item, 'pdf')}>PDF</MenuItem>
      <MenuItem icon={FileText} disabled={nb === 0} onClick={() => onExporter(item, 'docx')}>Word (DOCX)</MenuItem>
      <MenuItem icon={FileJson} disabled={nb === 0} onClick={() => onExporter(item, 'json')}>JSON</MenuItem>
      <div className="my-1 h-px bg-[#0f172a]/8" />
      <MenuItem icon={Copy} onClick={() => onDupliquer(item)}>Dupliquer</MenuItem>
      <MenuItem icon={Share2} onClick={() => onPartager(item)}>Copier le lien</MenuItem>
      <MenuItem icon={estArchive ? ArchiveRestore : Archive} onClick={() => onArchiver(item.id)}>
        {estArchive ? 'Désarchiver' : 'Archiver'}
      </MenuItem>
      <div className="my-1 h-px bg-[#0f172a]/8" />
      <MenuItem icon={Trash2} danger onClick={() => onSupprimer(item)}>Supprimer</MenuItem>
    </div>
  )
}

function ConfirmDialog({ title, message, confirmLabel = 'Confirmer', danger = true, busy, onCancel, onConfirm }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <>
      <div className="examai-overlay-in fixed inset-0 z-[80] bg-[#0f172a]/40 backdrop-blur-sm" onClick={onCancel} />
      <div role="alertdialog" aria-modal="true" aria-labelledby="examai-confirm-title" aria-describedby="examai-confirm-message"
        className="examai-fade-up fixed left-1/2 top-1/2 z-[90] w-[90vw] max-w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-[20px] border border-[#0f172a]/20 bg-white p-5 shadow-[0_24px_60px_-20px_rgba(15,23,42,0.4)]">
        <div className="flex items-start gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
            danger ? 'bg-[#7a0008]/[0.10] text-[#7a0008]' : 'bg-[#0f172a]/[0.06] text-[#0f172a]'
          }`}>
            <AlertTriangle size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <h3 id="examai-confirm-title" className="examai-serif text-[16px] font-semibold text-[#0f172a]">{title}</h3>
            <p id="examai-confirm-message" className="mt-1.5 text-[13px] leading-relaxed text-[#0f172a]/65">{message}</p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} autoFocus disabled={busy}
            className={`rounded-full border border-[#0f172a]/20 bg-white px-4 py-2 text-[12.5px] font-semibold text-[#0f172a]/75 transition-all hover:-translate-y-0.5 hover:border-[#0f172a]/50 hover:text-[#0f172a] disabled:opacity-50 ${FOCUS_RING} ${HOVER_LIFT}`}>
            Annuler
          </button>
          <button onClick={onConfirm} disabled={busy}
            className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-[12.5px] font-semibold text-white transition-all disabled:opacity-60 ${FOCUS_RING} ${
              danger
                ? 'bg-[#7a0008] shadow-[0_6px_16px_-6px_rgba(122,0,8,0.5)] hover:bg-[#961014]'
                : 'bg-[#0f172a] shadow-[0_6px_16px_-6px_rgba(15,23,42,0.4)] hover:bg-[#1e293b]'
            }`}>
            {busy && <Loader2 size={13} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </>
  )
}

function ApercuQuestions({ questions, recherche, limit }) {
  const liste = limit ? questions.slice(0, limit) : questions
  if (liste.length === 0) return null
  return (
    <div className="rounded-[12px] border border-[#0f172a]/10 bg-[#0f172a]/[0.02] p-2.5 space-y-1.5">
      {liste.map((q, i) => {
        const TypeIcon = typeQuestionIcon(q.type)
        return (
          <div key={i} className="flex items-start gap-2 text-[11.5px]">
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#0f172a]/[0.07] text-[9px] font-bold text-[#0f172a]/75 mt-0.5">
              {i + 1}
            </span>
            <span className="min-w-0 flex-1 truncate text-[#0f172a]/75">
              <Highlight text={texteQuestion(q) || '—'} query={recherche} />
            </span>
            <span className="shrink-0 flex items-center gap-0.5 text-[9.5px] font-bold uppercase tracking-wider text-[#0f172a]/50">
              <TypeIcon size={9} /> {typeQuestionLabel(q.type)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

const ExamCard = memo(function ExamCard({
  item, busy, menuOuvert, favori, selectionne, recherche,
  onToggleFavori, onToggleSelection, onToggleMenu,
  onOuvrir, onOuvrirDetails, onExporter, onSupprimer, onDupliquer, onPartager, onArchiver, estArchive,
}) {
  const nb = item.questions?.length || 0
  const meta = STATUT_META[item.statut] || STATUT_META.brouillon
  const [questionsOuvertes, setQuestionsOuvertes] = useState(false)

  return (
    <div
      className={`group relative flex h-full flex-col rounded-[20px] border bg-white p-5 transition-colors ${
        selectionne
          ? 'border-[#7a0008]/50 ring-2 ring-[#7a0008]/15'
          : 'border-[#0f172a]/20 hover:border-[#0f172a]/35'
      }`}
    >
      <div className="relative z-10 flex items-start gap-2.5">
        <button onClick={() => onToggleSelection(item.id)} aria-label="Sélectionner"
          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all ${FOCUS_RING} ${
            selectionne
              ? 'border-[#7a0008] bg-[#7a0008] text-white'
              : 'border-[#0f172a]/25 bg-white opacity-0 hover:border-[#0f172a]/60 group-hover:opacity-100 focus-visible:opacity-100'
          }`}>
          {selectionne && <CheckCircle2 size={11} strokeWidth={3} />}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="examai-serif line-clamp-2 text-[15.5px] font-semibold leading-snug text-[#0f172a]">
                <Highlight text={item.titre} query={recherche} />
              </p>
              <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
                  style={{ color: meta.color, background: `${meta.color}1a` }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color }} />
                  {meta.label}
                </span>
                {nb > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-[#0f172a]/15 bg-white px-2 py-0.5 text-[10px] font-bold text-[#0f172a]/70">
                    <ListChecks size={9} /> {nb} q.
                  </span>
                )}
                {item.duree && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-[#0f172a]/15 bg-white px-2 py-0.5 text-[10px] font-bold text-[#0f172a]/70">
                    <Clock size={9} /> {item.duree}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col items-end gap-1">
              <button onClick={() => onToggleFavori(item.id)} aria-label={favori ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all ${FOCUS_RING} ${
                  favori ? 'text-amber-500 bg-amber-50' : 'text-[#0f172a]/30 hover:bg-[#0f172a]/[0.05] hover:text-amber-500'
                }`}>
                <Star size={14} fill={favori ? 'currentColor' : 'none'} />
              </button>
              <button onClick={(e) => onToggleMenu(item.id, e)} aria-label="Plus d'options" aria-haspopup="menu" aria-expanded={menuOuvert}
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[#0f172a]/45 transition-all hover:bg-[#0f172a]/[0.06] hover:text-[#0f172a] ${FOCUS_RING}`}>
                <MoreVertical size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {menuOuvert && (
        <CardMenu item={item}
          onOuvrir={onOuvrir} onExporter={onExporter} onSupprimer={onSupprimer}
          onDupliquer={onDupliquer} onPartager={onPartager}
          onArchiver={onArchiver} estArchive={estArchive} />
      )}

      <div className="relative z-10 mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[#0f172a]/70">
        <span className="flex items-center gap-1">
          <BookOpen size={12} className="text-[#0f172a]/45" />
          <span className="font-semibold text-[#0f172a]">{MATIERE_LABEL[item.matiere] || item.matiere}</span>
        </span>
        <span className="flex items-center gap-1">
          <GraduationCap size={12} className="text-[#0f172a]/45" />
          {NIVEAU_LABEL[item.niveau] || item.niveau}
        </span>
      </div>
      {item.chapitre && (
        <p className="relative z-10 mt-1 truncate text-[11.5px] italic text-[#0f172a]/55">
          <Highlight text={item.chapitre} query={recherche} />
        </p>
      )}

      {nb > 0 && (
        <div className="relative z-10 mt-3">
          <ApercuQuestions
            questions={item.questions}
            recherche={recherche}
            limit={questionsOuvertes ? undefined : 3}
          />
          {nb > 3 && (
            <button onClick={() => setQuestionsOuvertes((v) => !v)}
              className={`mt-1.5 flex items-center gap-1 pl-1 text-[10.5px] font-semibold text-[#7a0008]/75 transition-colors hover:text-[#7a0008] ${FOCUS_RING} rounded`}>
              {questionsOuvertes ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {questionsOuvertes ? 'Réduire' : `Afficher les ${nb} questions`}
            </button>
          )}
        </div>
      )}

      <div className="relative z-10 mt-auto pt-4 flex items-center gap-2">
        <span className="flex items-center gap-1 text-[11px] text-[#0f172a]/50" title={formatDate(item.updated_at)}>
          <Clock size={10} /> {relativeDate(item.updated_at)}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <button onClick={() => onOuvrirDetails(item)}
            className={`flex items-center gap-1 rounded-full border border-[#0f172a]/15 bg-white px-2.5 py-1.5 text-[11.5px] font-semibold text-[#0f172a]/75 transition-all hover:-translate-y-0.5 hover:border-[#0f172a]/40 hover:text-[#0f172a] ${FOCUS_RING} ${HOVER_LIFT}`}>
            <Eye size={11} /> Détails
          </button>
          <button onClick={() => onOuvrir(item)} disabled={busy}
            className={`flex items-center justify-center gap-1.5 rounded-full bg-[#7a0008] px-3 py-1.5 text-[11.5px] font-semibold text-white shadow-[0_4px_10px_-4px_rgba(122,0,8,0.4),inset_0_1px_0_rgba(255,255,255,0.15)] transition-all hover:-translate-y-0.5 hover:bg-[#961014] hover:shadow-[0_6px_14px_-4px_rgba(122,0,8,0.5)] active:scale-[0.97] disabled:opacity-50 ${FOCUS_RING} ${HOVER_LIFT}`}>
            {busy ? <Loader2 size={11} className="animate-spin" /> : <PenLine size={11} />}
            Ouvrir
          </button>
        </div>
      </div>
    </div>
  )
})

const ExamRow = memo(function ExamRow({
  item, busy, isLast, menuOuvert, favori, selectionne, recherche,
  onToggleFavori, onToggleSelection, onToggleMenu,
  onOuvrir, onOuvrirDetails, onExporter, onSupprimer, onDupliquer, onPartager, onArchiver, estArchive,
}) {
  const nb = item.questions?.length || 0
  const meta = STATUT_META[item.statut] || STATUT_META.brouillon
  const [questionsOuvertes, setQuestionsOuvertes] = useState(false)
  return (
    <div className={!isLast ? 'border-b border-[#0f172a]/10' : ''}>
      <div className={`group relative flex items-center gap-3 px-4 py-3.5 transition-colors ${
        selectionne ? 'bg-[#7a0008]/[0.04]' : 'hover:bg-[#0f172a]/[0.025]'
      }`}>
        <span className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: meta.color, opacity: 0.7 }} />

        <button onClick={() => onToggleSelection(item.id)} aria-label="Sélectionner"
          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all ${FOCUS_RING} ${
            selectionne ? 'border-[#7a0008] bg-[#7a0008] text-white' : 'border-[#0f172a]/25 bg-white opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
          }`}>
          {selectionne && <CheckCircle2 size={11} strokeWidth={3} />}
        </button>
        <button onClick={() => onToggleFavori(item.id)} aria-label={favori ? 'Retirer' : 'Favori'}
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-all ${FOCUS_RING} ${
            favori ? 'text-amber-500' : 'text-[#0f172a]/25 hover:text-amber-500'
          }`}>
          <Star size={13} fill={favori ? 'currentColor' : 'none'} />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="examai-serif truncate text-[14px] font-semibold text-[#0f172a]">
              <Highlight text={item.titre} query={recherche} />
            </p>
            <StatusBadge statut={item.statut} />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11.5px] text-[#0f172a]/60">
            <span className="flex items-center gap-1"><BookOpen size={11} />{MATIERE_LABEL[item.matiere] || item.matiere}</span>
            <span className="flex items-center gap-1"><GraduationCap size={11} />{NIVEAU_LABEL[item.niveau] || item.niveau}</span>
            <span className="truncate">{item.chapitre}</span>
          </div>
        </div>

        <div className="hidden shrink-0 items-center gap-4 text-[11.5px] text-[#0f172a]/60 sm:flex">
          <button onClick={() => setQuestionsOuvertes((v) => !v)} disabled={nb === 0}
            aria-expanded={questionsOuvertes}
            title={nb === 0 ? undefined : (questionsOuvertes ? 'Masquer les questions' : 'Afficher les questions')}
            className={`flex items-center gap-1 rounded-full px-1.5 py-1 -mx-1.5 -my-1 transition-colors hover:bg-[#0f172a]/[0.06] disabled:cursor-default disabled:hover:bg-transparent ${FOCUS_RING}`}>
            <FileCheck2 size={11} />{nb}
            {nb > 0 && (questionsOuvertes ? <ChevronUp size={11} /> : <ChevronDown size={11} />)}
          </button>
          <span>{item.duree}</span>
          <span className="flex w-20 items-center justify-end gap-1" title={formatDate(item.updated_at)}>
            <Clock size={11} /> {relativeDate(item.updated_at)}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button onClick={() => onOuvrirDetails(item)} title="Détails"
            className={`flex h-8 w-8 items-center justify-center rounded-full border border-[#0f172a]/15 text-[#0f172a]/50 transition-colors hover:border-[#0f172a]/40 hover:text-[#0f172a] ${FOCUS_RING}`}>
            <Eye size={13} />
          </button>
          <button onClick={() => onOuvrir(item)} disabled={busy}
            className={`flex items-center gap-1.5 rounded-full border border-[#0f172a]/15 bg-white px-3 py-1.5 text-[12px] font-semibold text-[#0f172a] transition-colors hover:border-[#0f172a]/40 hover:bg-[#0f172a]/[0.04] disabled:opacity-50 ${FOCUS_RING}`}>
            {busy ? <Loader2 size={12} className="animate-spin" /> : <PenLine size={12} />}
            Ouvrir
          </button>
          <button onClick={() => onExporter(item)} disabled={busy || nb === 0} aria-label="Exporter"
            className={`flex h-8 w-8 items-center justify-center rounded-full border border-[#0f172a]/15 text-[#0f172a]/50 transition-colors hover:border-[#0f172a]/40 hover:text-[#0f172a] disabled:opacity-40 ${FOCUS_RING}`}>
            <Download size={13} />
          </button>
          <button onClick={(e) => onToggleMenu(item.id, e)} aria-label="Plus d'options" aria-haspopup="menu" aria-expanded={menuOuvert}
            className={`flex h-8 w-8 items-center justify-center rounded-full border border-[#0f172a]/15 text-[#0f172a]/50 transition-colors hover:border-[#0f172a]/40 hover:text-[#0f172a] ${FOCUS_RING}`}>
            <MoreVertical size={13} />
          </button>
          {menuOuvert && (
            <CardMenu item={item}
              onOuvrir={onOuvrir} onExporter={onExporter} onSupprimer={onSupprimer}
              onDupliquer={onDupliquer} onPartager={onPartager}
              onArchiver={onArchiver} estArchive={estArchive} />
          )}
        </div>
      </div>

      {questionsOuvertes && nb > 0 && (
        <div className="px-4 pb-3 pl-11">
          <ApercuQuestions questions={item.questions} recherche={recherche} />
        </div>
      )}
    </div>
  )
})

const CompactRow = memo(function CompactRow({ item, isLast, favori, selectionne, recherche, onToggleFavori, onToggleSelection, onOuvrir, onOuvrirDetails }) {
  const meta = STATUT_META[item.statut] || STATUT_META.brouillon
  const nb = item.questions?.length || 0
  const [questionsOuvertes, setQuestionsOuvertes] = useState(false)
  return (
    <div className={!isLast ? 'border-b border-[#0f172a]/10' : ''}>
      <div className={`group relative flex items-center gap-3 px-4 py-2 transition-colors hover:bg-[#0f172a]/[0.025] ${
        selectionne ? 'bg-[#7a0008]/[0.04]' : ''
      }`}>
        <span className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: meta.color, opacity: 0.6 }} />
        <button onClick={() => onToggleSelection(item.id)} aria-label="Sélectionner"
          className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border transition-all ${FOCUS_RING} ${
            selectionne ? 'border-[#7a0008] bg-[#7a0008] text-white' : 'border-[#0f172a]/25 bg-white opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
          }`}>
          {selectionne && <CheckCircle2 size={9} strokeWidth={3} />}
        </button>
        <button onClick={() => onToggleFavori(item.id)}
          className={`flex h-5 w-5 shrink-0 items-center justify-center ${FOCUS_RING} ${
            favori ? 'text-amber-500' : 'text-[#0f172a]/15 hover:text-amber-500'
          }`}
          aria-label="Favori">
          <Star size={12} fill={favori ? 'currentColor' : 'none'} />
        </button>
        <button onClick={() => onOuvrir(item)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <span className="examai-serif truncate text-[13px] font-medium text-[#0f172a]">{item.titre}</span>
          <span className="hidden shrink-0 text-[11px] text-[#0f172a]/50 sm:inline">{MATIERE_LABEL[item.matiere] || item.matiere}</span>
        </button>
        <button onClick={() => setQuestionsOuvertes((v) => !v)} disabled={nb === 0}
          aria-expanded={questionsOuvertes}
          title={nb === 0 ? undefined : (questionsOuvertes ? 'Masquer les questions' : 'Afficher les questions')}
          className={`hidden shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] text-[#0f172a]/50 transition-colors hover:bg-[#0f172a]/[0.06] hover:text-[#0f172a] disabled:hover:bg-transparent sm:flex ${FOCUS_RING}`}>
          {nb} q.
          {nb > 0 && (questionsOuvertes ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}
        </button>
        <StatusBadge statut={item.statut} />
        <span className="hidden w-16 shrink-0 text-right text-[11px] text-[#0f172a]/50 sm:inline">{relativeDate(item.updated_at)}</span>
        <button onClick={() => onOuvrirDetails(item)} className={`flex h-6 w-6 items-center justify-center rounded-full text-[#0f172a]/40 hover:text-[#0f172a] ${FOCUS_RING}`}>
          <Eye size={12} />
        </button>
      </div>
      {questionsOuvertes && nb > 0 && (
        <div className="px-4 pb-2.5 pl-11">
          <ApercuQuestions questions={item.questions} recherche={recherche} />
        </div>
      )}
    </div>
  )
})

function ExamDrawer({
  item, busy, favori, estArchive,
  onClose, onToggleFavori, onOuvrir, onExporter, onSupprimer, onDupliquer, onPartager, onArchiver,
}) {
  const nb = item.questions?.length || 0
  const meta = STATUT_META[item.statut] || STATUT_META.brouillon
  const totalPoints = (item.questions || []).reduce((acc, q) => acc + (q.points || 0), 0)
  const closeBtnRef = useRef(null)

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    closeBtnRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <>
      <div className="examai-overlay-in fixed inset-0 z-[60] bg-[#0f172a]/40 backdrop-blur-sm" onClick={onClose} />
      <aside role="dialog" aria-modal="true" aria-labelledby="examai-drawer-title"
        className="examai-drawer-in fixed right-0 top-0 bottom-0 z-[70] w-full max-w-[560px] flex flex-col border-l border-[#0f172a]/20 bg-[#f8fafc] shadow-[-24px_0_60px_-20px_rgba(15,23,42,0.3)]">
        <div className="relative shrink-0 border-b border-[#0f172a]/10 bg-white">
          <div className="absolute inset-0 opacity-40"
            style={{ background: `radial-gradient(circle at 100% 0%, ${meta.glow} 0%, transparent 55%)` }} />
          <div className="relative px-6 py-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold"
                    style={{ color: meta.color, background: `${meta.color}1a` }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color }} />
                    {meta.label}
                  </span>
                  {estArchive && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#0f172a]/15 bg-white px-2 py-0.5 text-[10.5px] font-bold text-[#0f172a]/60">
                      <Archive size={10} /> Archivé
                    </span>
                  )}
                  {favori && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/60 bg-amber-50/60 px-2 py-0.5 text-[10.5px] font-bold text-amber-700">
                      <Star size={10} fill="currentColor" /> Favori
                    </span>
                  )}
                </div>
                <h2 id="examai-drawer-title" className="examai-serif text-[24px] font-semibold leading-tight tracking-[-0.02em] text-[#0f172a]">
                  {item.titre}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-[#0f172a]/70">
                  <span className="flex items-center gap-1.5">
                    <BookOpen size={12} className="text-[#0f172a]/55" />
                    <span className="font-semibold text-[#0f172a]">{MATIERE_LABEL[item.matiere] || item.matiere}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <GraduationCap size={12} className="text-[#0f172a]/55" />
                    {NIVEAU_LABEL[item.niveau] || item.niveau}
                  </span>
                  {item.duree && (
                    <span className="flex items-center gap-1.5">
                      <Clock size={12} className="text-[#0f172a]/55" /> {item.duree}
                    </span>
                  )}
                </div>
                {item.chapitre && (
                  <p className="mt-1.5 text-[12px] italic text-[#0f172a]/55">{item.chapitre}</p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={onToggleFavori} aria-label="Favori"
                  className={`flex h-8 w-8 items-center justify-center rounded-full transition-all ${FOCUS_RING} ${
                    favori ? 'text-amber-500 bg-amber-50' : 'text-[#0f172a]/40 hover:bg-[#0f172a]/[0.06] hover:text-amber-500'
                  }`}>
                  <Star size={15} fill={favori ? 'currentColor' : 'none'} />
                </button>
                <button ref={closeBtnRef} onClick={onClose} aria-label="Fermer"
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-[#0f172a]/40 transition-colors hover:bg-[#0f172a]/[0.06] hover:text-[#0f172a] ${FOCUS_RING}`}>
                  <X size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 px-6 py-4 border-b border-[#0f172a]/10 bg-white">
          <DrawerStat icon={ListChecks} label="Questions" value={nb} accent={BRAND} />
          <DrawerStat icon={Award} label="Barème" value={`${totalPoints} pts`} accent="#b45309" />
          <DrawerStat icon={Calendar} label="Modifié" value={relativeDate(item.updated_at)} accent="#047857" />
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {nb === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#7a0008]/[0.08] text-[#7a0008]">
                <FileEdit size={20} />
              </span>
              <p className="examai-serif mt-3 text-[15px] font-semibold text-[#0f172a]">Aucune question pour l'instant</p>
              <p className="mt-1 text-[12.5px] font-bold italic text-[#0f172a]/55">
                Ouvrez cet examen pour commencer à ajouter des questions.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="examai-serif text-[15px] font-semibold text-[#0f172a]">
                  Questions <span className="text-[#0f172a]/60 text-[13px] font-normal">({nb})</span>
                </h3>
              </div>
              {(item.questions || []).map((q, i) => {
                const TypeIcon = typeQuestionIcon(q.type)
                return (
                  <div key={i} className="rounded-[14px] border border-[#0f172a]/15 bg-white p-3.5 transition-all hover:border-[#0f172a]/30">
                    <div className="flex items-start gap-2.5">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#7a0008] text-[10px] font-bold text-white shadow-[0_2px_6px_-2px_rgba(122,0,8,0.5)]">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#0f172a]/65">
                            <TypeIcon size={10} /> {typeQuestionLabel(q.type)}
                          </span>
                          {q.points != null && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-[#0f172a]/15 bg-white px-2 py-0.5 text-[10px] font-bold text-[#0f172a]/70">
                              <Award size={9} /> {q.points} pt{q.points > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        <p className="mt-1.5 text-[13px] leading-relaxed text-[#0f172a]/85">
                          {texteQuestion(q) || '—'}
                        </p>
                        {q.options?.length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {q.options.map((opt, j) => (
                              <li key={j} className="flex items-start gap-1.5 text-[12px] text-[#0f172a]/75">
                                <span className="shrink-0 font-bold text-[#0f172a]/60 mt-0.5">
                                  {String.fromCharCode(65 + j)}.
                                </span>
                                <span>{typeof opt === 'string' ? opt : opt.texte || opt.label}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        {q.reponse && (
                          <div className="mt-2 flex items-start gap-1.5 rounded-[10px] bg-emerald-50 border border-emerald-200/60 px-2.5 py-1.5">
                            <CheckCircle2 size={11} className="text-emerald-600 mt-0.5 shrink-0" />
                            <span className="text-[11.5px] text-emerald-700">
                              <span className="font-bold">Réponse : </span>{q.reponse}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-[#0f172a]/10 bg-white px-6 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => onOuvrir(item)} disabled={busy}
              className={`flex items-center gap-1.5 rounded-full bg-[#7a0008] px-4 py-2.5 text-[12.5px] font-semibold text-white shadow-[0_1px_2px_rgba(79,0,5,0.2),0_8px_18px_-6px_rgba(122,0,8,0.5),inset_0_1px_0_rgba(255,255,255,0.15)] transition-all hover:-translate-y-0.5 hover:bg-[#961014] active:scale-[0.98] disabled:opacity-50 ${FOCUS_RING} ${HOVER_LIFT}`}>
              {busy ? <Loader2 size={13} className="animate-spin" /> : <PenLine size={13} />}
              Ouvrir dans l'éditeur
            </button>
            <button onClick={() => onExporter(item)} disabled={busy || nb === 0}
              className={`flex items-center gap-1.5 rounded-full border border-[#0f172a]/15 bg-white px-3.5 py-2.5 text-[12.5px] font-semibold text-[#0f172a]/80 transition-all hover:-translate-y-0.5 hover:border-[#0f172a]/40 hover:text-[#0f172a] disabled:opacity-40 ${FOCUS_RING} ${HOVER_LIFT}`}>
              <Printer size={13} /> Exporter
            </button>
            <div className="ml-auto flex items-center gap-1.5">
              <button onClick={() => onDupliquer(item)} title="Dupliquer"
                className={`flex h-9 w-9 items-center justify-center rounded-full border border-[#0f172a]/15 text-[#0f172a]/55 transition-all hover:border-[#0f172a]/40 hover:text-[#0f172a] ${FOCUS_RING}`}>
                <Copy size={14} />
              </button>
              <button onClick={() => onPartager(item)} title="Copier le lien"
                className={`flex h-9 w-9 items-center justify-center rounded-full border border-[#0f172a]/15 text-[#0f172a]/55 transition-all hover:border-[#0f172a]/40 hover:text-[#0f172a] ${FOCUS_RING}`}>
                <Share2 size={14} />
              </button>
              <button onClick={onArchiver} title={estArchive ? 'Désarchiver' : 'Archiver'}
                className={`flex h-9 w-9 items-center justify-center rounded-full border border-[#0f172a]/15 text-[#0f172a]/55 transition-all hover:border-[#0f172a]/40 hover:text-[#0f172a] ${FOCUS_RING}`}>
                {estArchive ? <ArchiveRestore size={14} /> : <Archive size={14} />}
              </button>
              <button onClick={() => onSupprimer(item)} title="Supprimer"
                className={`flex h-9 w-9 items-center justify-center rounded-full border border-[#7a0008]/25 text-[#7a0008] transition-all hover:border-[#7a0008]/60 hover:bg-[#7a0008]/[0.06] ${FOCUS_RING}`}>
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}

function DrawerStat({ icon: Icon, label, value, accent }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]"
        style={{ background: `${accent}1a`, color: accent }}>
        <Icon size={13} strokeWidth={2.2} />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#0f172a]/50">{label}</p>
        <p className="examai-serif text-[14px] font-semibold text-[#0f172a] truncate">{value}</p>
      </div>
    </div>
  )
}

function Highlight({ text, query }) {
  if (!query || !text) return text
  const q = query.trim()
  if (!q) return text
  const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  const parts = String(text).split(regex)
  return parts.map((part, i) =>
    regex.test(part) && part.toLowerCase() === q.toLowerCase()
      ? <mark key={i} className="bg-[#d4a76a]/40 text-[#0f172a] rounded-sm px-0.5">{part}</mark>
      : part
  )
}