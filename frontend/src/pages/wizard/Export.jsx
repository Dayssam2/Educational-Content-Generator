import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Download, Loader2, AlertTriangle, Check, ArrowLeft, ArrowRight,
  FileText, Printer, Globe, Settings2, Eye, Sparkles, CheckCircle2,
  FileCheck2, Wand2, GraduationCap, BookOpen, Clock,
} from 'lucide-react'
import WizardShell from '../../components/WizardShell.jsx'
import { useWizard } from '../../context/WizardContext.jsx'
import { MATIERE_LABEL, NIVEAU_LABEL } from '../../data/mockData.js'

const WIZARD_STEPS = [
  { n: 1, label: 'Sélection' },
  { n: 2, label: 'Édition' },
  { n: 3, label: 'Validation' },
  { n: 4, label: 'Export' },
]
const CURRENT_STEP = 4

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f172a]/35 focus-visible:ring-offset-2'
const HOVER_LIFT = 'motion-reduce:transition-none motion-reduce:hover:translate-y-0'


function LogoPDF({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="2" width="14" height="18" rx="2" fill="#DC2626" />
      <rect x="5" y="4" width="10" height="14" rx="1" fill="#fff" fillOpacity="0.15" />
      <text x="12" y="15" textAnchor="middle" fontSize="6" fontWeight="bold" fill="#fff" fontFamily="Arial, sans-serif">PDF</text>
      <path d="M15 2v5h5" fill="#B91C1C" />
      <path d="M15 2l5 5h-5V2z" fill="#7F1D1D" />
    </svg>
  )
}

function LogoWord({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="2" width="14" height="18" rx="2" fill="#2B579A" />
      <rect x="5" y="4" width="10" height="14" rx="1" fill="#fff" fillOpacity="0.15" />
      <text x="12" y="15" textAnchor="middle" fontSize="7" fontWeight="bold" fill="#fff" fontFamily="Arial, sans-serif">W</text>
      <path d="M15 2v5h5" fill="#1E3F6F" />
      <path d="M15 2l5 5h-5V2z" fill="#152E52" />
    </svg>
  )
}

function LogoJSON({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="2" width="14" height="18" rx="2" fill="#F59E0B" />
      <rect x="5" y="4" width="10" height="14" rx="1" fill="#fff" fillOpacity="0.15" />
      <text x="12" y="15" textAnchor="middle" fontSize="4.5" fontWeight="bold" fill="#fff" fontFamily="monospace">{'{}'}</text>
      <path d="M15 2v5h5" fill="#B45309" />
      <path d="M15 2l5 5h-5V2z" fill="#78350F" />
    </svg>
  )
}

function LogoMarkdown({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="2" width="14" height="18" rx="2" fill="#0f172a" />
      <rect x="5" y="4" width="10" height="14" rx="1" fill="#fff" fillOpacity="0.12" />
      <text x="12" y="15" textAnchor="middle" fontSize="5" fontWeight="bold" fill="#fff" fontFamily="monospace">M↓</text>
      <path d="M15 2v5h5" fill="#1E293B" />
      <path d="M15 2l5 5h-5V2z" fill="#0F172A" />
    </svg>
  )
}

function LogoPrint({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="2" width="14" height="18" rx="2" fill="#475569" />
      <rect x="5" y="4" width="10" height="14" rx="1" fill="#fff" fillOpacity="0.12" />
      <path d="M8 10h8M8 13h6" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M15 2v5h5" fill="#334155" />
      <path d="M15 2l5 5h-5V2z" fill="#1E293B" />
    </svg>
  )
}


const FORMATS = [
  { id: 'pdf', label: 'PDF', description: 'Idéal pour imprimer et partager', icon: LogoPDF, extension: '.pdf', tag: 'Recommandé', tagTone: 'emerald', enabled: true, nature: 'binaire' },
  { id: 'impression', label: 'Impression directe', description: 'Ouvre la boîte de dialogue d\'impression', icon: LogoPrint, extension: null, tag: null, tagTone: null, enabled: true, nature: 'impression' },
  { id: 'docx', label: 'Word (.docx)', description: 'Modifiable dans Word ou LibreOffice', icon: LogoWord, extension: '.docx', tag: null, tagTone: null, enabled: true, nature: 'binaire' },
  { id: 'md', label: 'Markdown (.md)', description: 'Format texte — peut s\'ouvrir dans Word par défaut', icon: LogoMarkdown, extension: '.md', tag: null, tagTone: null, enabled: true, nature: 'texte' },
  { id: 'json', label: 'JSON', description: 'Données structurées — à ouvrir avec un éditeur', icon: LogoJSON, extension: '.json', tag: null, tagTone: null, enabled: true, nature: 'texte' },
]

const ETAPES_GENERATION = [
  { label: 'Préparation du document…', icon: FileText },
  { label: 'Application du barème…', icon: FileCheck2 },
  { label: 'Mise en page…', icon: Settings2 },
  { label: 'Finalisation de l\'export…', icon: Wand2 },
]

const TAG_TONES = {
  emerald: 'bg-emerald-100 text-emerald-700',
  amber: 'bg-amber-100 text-amber-700',
  navy: 'bg-[#0f172a]/[0.08] text-[#0f172a]/60',
}


const TYPES_DEVOIR = [
  { id: 'controle_1', label: 'Devoir de contrôle N°1', short: 'Contrôle N°1' },
  { id: 'controle_2', label: 'Devoir de contrôle N°2', short: 'Contrôle N°2' },
  { id: 'controle_3', label: 'Devoir de contrôle N°3', short: 'Contrôle N°3' },
  { id: 'synthese',   label: 'Devoir de synthèse',     short: 'Synthèse' },
  { id: 'maison',     label: 'Devoir à la maison',     short: 'Maison' },
]

const TYPES_DEVOIR_AR = {
  controle_1: 'فرض مراقبة عدد 1',
  controle_2: 'فرض مراقبة عدد 2',
  controle_3: 'فرض مراقبة عدد 3',
  synthese:   'فرض تأليفي',
  maison:     'فرض منزلي',
}


const MATIERE_AR = {
  arabe: 'العربية', francais: 'الفرنسية', math: 'الرياضيات', maths: 'الرياضيات',
  mathematique: 'الرياضيات', mathematiques: 'الرياضيات', mathématiques: 'الرياضيات',
  eveil: 'الإيقاظ العلمي', eveil_scientifique: 'الإيقاظ العلمي', science: 'الإيقاظ العلمي',
  sciences: 'العلوم', islamique: 'التربية الإسلامية',
  education_islamique: 'التربية الإسلامية', histoire: 'التاريخ',
  histoire_geo: 'التاريخ والجغرافيا',
  geographie: 'الجغرافيا', civique: 'التربية المدنية',
  education_civique: 'التربية المدنية', anglais: 'الإنقليزية',
  informatique: 'الإعلامية', techno: 'التكنولوجيا', dessin: 'الرسم',
  musique: 'الموسيقى', sport: 'التربية البدنية',
  physique: 'العلوم الفيزيائية', svt: 'علوم الحياة والأرض',
  philosophie: 'الفلسفة', eco: 'الاقتصاد', gestion: 'التصرف',
}

const NIVEAU_AR = {
  '1ere_primaire': 'السنة الأولى ابتدائي', '2eme_primaire': 'السنة الثانية ابتدائي',
  '3eme_primaire': 'السنة الثالثة ابتدائي', '4eme_primaire': 'السنة الرابعة ابتدائي',
  '5eme_primaire': 'السنة الخامسة ابتدائي', '6eme_primaire': 'السنة السادسة ابتدائي',
  '1ere': 'السنة الأولى ابتدائي', '2eme': 'السنة الثانية ابتدائي',
  '3eme': 'السنة الثالثة ابتدائي', '4eme': 'السنة الرابعة ابتدائي',
  '5eme': 'السنة الخامسة ابتدائي', '6eme': 'السنة السادسة ابتدائي',
  '1ere_annee': 'السنة الأولى ابتدائي', '2eme_annee': 'السنة الثانية ابتدائي',
  '3eme_annee': 'السنة الثالثة ابتدائي', '4eme_annee': 'السنة الرابعة ابتدائي',
  '5eme_annee': 'السنة الخامسة ابتدائي', '6eme_annee': 'السنة السادسة ابتدائي',
  '1ere_annee_primaire': 'السنة الأولى ابتدائي', '2eme_annee_primaire': 'السنة الثانية ابتدائي',
  '3eme_annee_primaire': 'السنة الثالثة ابتدائي', '4eme_annee_primaire': 'السنة الرابعة ابتدائي',
  '5eme_annee_primaire': 'السنة الخامسة ابتدائي', '6eme_annee_primaire': 'السنة السادسة ابتدائي',
}

const MATIERES_ARABES = new Set([
  'arabe', 'islamique', 'education_islamique', 'histoire', 'geographie',
  'civique', 'education_civique', 'philosophie',
])

const L = {
  pays: 'الجمهورية التونسية', ministere: 'وزارة التربية', aucuneQuestion: 'لا توجد أسئلة',
}


const LBL = {
  ar: {
    pays: 'الجمهورية التونسية', ministere: 'وزارة التربية',
    ecole: 'المدرسة الابتدائية', enseignant: 'المعلم(ة)', annee: 'السنة الدراسية',
    nom: 'الاسم واللقب', classe: 'القسم', note: 'العدد', duree: 'المدة', enMatiere: 'في مادة',
    consigne: 'التعليمة', critere: 'مع', pts: 'ن', vrai: 'صواب', faux: 'خطأ',
    reponse: 'الإجابة', explication: 'توضيح', grille: 'جدول إسناد الأعداد',
    criteres: 'المعايير', noteFinale: 'العدد النهائي', signature: 'إمضاء الولي',
    page: 'صفحة', corrige: 'إصلاح', reserve: 'وثيقة خاصة بالمعلم(ة) — لا توزع على التلاميذ',
    aucune: 'لا توجد أسئلة', questionVide: 'سؤال فارغ', ordre: 'الترتيب', texte: 'النص',
    longueur: 'عدد الكلمات الأدنى',
  },
  fr: {
    pays: 'République Tunisienne', ministere: "Ministère de l'Éducation",
    ecole: 'École primaire', enseignant: 'Enseignant(e)', annee: 'Année scolaire',
    nom: 'Nom et prénom', classe: 'Classe', note: 'Note', duree: 'Durée', enMatiere: '',
    consigne: 'Consigne', critere: 'C', pts: 'pts', vrai: 'Vrai', faux: 'Faux',
    reponse: 'Réponse', explication: 'Explication', grille: "Grille d'évaluation",
    criteres: 'Critères', noteFinale: 'Note finale', signature: 'Signature du parent',
    page: 'Page', corrige: 'Corrigé', reserve: "Document réservé à l'enseignant(e)",
    aucune: 'Aucune question', questionVide: 'Question vide', ordre: 'Ordre', texte: 'Texte',
    longueur: 'Longueur minimale',
  },
}
const LETTRES = { ar: ['أ', 'ب', 'ج', 'د', 'هـ', 'و', 'ز', 'ح', 'ط', 'ي'], fr: 'abcdefghij'.split('') }


const ENONCE_AR = {
  "Légende les éléments indiqués sur l'image.": 'أكمل البيانات المشار إليها على الصورة.',
  "Légende les éléments indiqués sur l'image": 'أكمل البيانات المشار إليها على الصورة.',
  "Légende les éléments numérotés sur l'image.": 'أكمل البيانات المرقّمة على الصورة.',
  "Légende les éléments numérotés sur l'image": 'أكمل البيانات المرقّمة على الصورة.',
  "Légende l'image.": 'أكمل بيانات الصورة.',
  "Légende l'image": 'أكمل بيانات الصورة.',
  'Écris le texte dicté.': 'اكتب النص المُملّى.',
  'Écoute et écris le texte dicté.': 'استمع واكتب النص المُملّى.',
  'Rédige un texte sur le sujet proposé.': 'اكتب نصًا في الموضوع المقترح.',
  'Rédige un texte.': 'اكتب نصًا.',
  'Calcule le résultat.': 'احسب الناتج.',
  'Effectue le calcul.': 'أنجز العملية الحسابية.',
  'Classe les éléments dans les bonnes catégories.': 'صنّف العناصر في الأصناف المناسبة.',
  'Associe chaque élément de la colonne de gauche à sa correspondance.': 'اربط كل عنصر من العمود الأيسر بما يناسبه.',
  'Remets les éléments dans le bon ordre.': 'أعد ترتيب العناصر ترتيبًا صحيحًا.',
  'Choisis la bonne réponse.': 'اختر الجواب الصحيح.',
  'Coche la bonne réponse.': 'ضع علامة على الجواب الصحيح.',
  'Réponds par vrai ou faux.': 'أجب بصحيح أو خطأ.',
  'Réponds par vrai ou faux :': 'أجب بصحيح أو خطأ :',
  'Complète le texte par les mots suivants.': 'أكمل النص بالكلمات التالية.',
  'Complète le texte.': 'أكمل النص.',
}


function normaliserType(t) {
  return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}
function estLegende(q) {
  return normaliserType(q?.type) === 'legende'
}
function enonceAffiche(q, matiereEstArabe) {
  const brut = q?.question || ''
  if (!brut) return ''
  const forceAr = matiereEstArabe || estLegende(q)
  if (!forceAr) return brut
  const trimmed = brut.trim()
  if (ENONCE_AR[trimmed]) return ENONCE_AR[trimmed]
  const cleaned = trimmed.replace(/[.…]+$/, '')
  for (const [fr, ar] of Object.entries(ENONCE_AR)) {
    if (fr.replace(/[.…]+$/, '') === cleaned) return ar
  }
  return brut
}
function anneeScolaireCourante() {
  const d = new Date()
  const debut = d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1
  return `${debut} / ${debut + 1}`
}
function dureeAr(label) {
  const s = String(label || '')
  const m = s.match(/^(\d+)\s*min$/i)
  if (m) return `${m[1]} دق`
  const h = s.match(/^(\d+)h(\d+)?$/i)
  if (h) return `${h[1]} س${h[2] ? ` و${Number(h[2])} دق` : ''}`
  return s
}
function fmtPoints(p) {
  const n = Number(p) || 0
  return Number.isInteger(n) ? String(n) : String(n).replace('.', ',')
}
function demi(x) {
  return Math.round(x * 2) / 2
}


function recupererImageLegende() {
  try { return sessionStorage.getItem('examai_image_legende') } catch { return null }
}
function recupererImageLegendeNom() {
  try { return sessionStorage.getItem('examai_image_legende_nom') || '' } catch { return '' }
}

function enrichirQuestionsAvecImage(questions, imageFallback, nomFallback) {
  if (!Array.isArray(questions)) return []
  return questions.map((q) => {
    if (!estLegende(q)) return q
    const hasUrl = q?.image?.url && String(q.image.url).length > 20
    if (hasUrl) return q
    if (!imageFallback) return q
    return {
      ...q,
      image: {
        ...(q.image || {}),
        url: imageFallback,
        alt_text: q.image?.alt_text || nomFallback || 'Image de la question',
        description: q.image?.description || nomFallback || 'Image fournie pour la question à légender',
      },
    }
  })
}


function regrouperEnExercices(questions = []) {
  if (!questions.length) return []
  const aExerciceExplicite = questions.some((q) => q.exercice != null)

  if (aExerciceExplicite) {
    const map = new Map()
    questions.forEach((q) => {
      const n = q.exercice ?? 1
      if (!map.has(n)) map.set(n, [])
      map.get(n).push(q)
    })
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([numero, items]) => ({
        numero, type: items[0]?.type, questions: items,
        totalPoints: items.reduce((s, q) => s + (Number(q.points) || 0), 0),
      }))
  }

  const ordreTypes = []
  const parType = new Map()
  questions.forEach((q) => {
    const t = q.type || 'ouverte'
    if (!parType.has(t)) { parType.set(t, []); ordreTypes.push(t) }
    parType.get(t).push(q)
  })
  return ordreTypes.map((t, idx) => {
    const items = parType.get(t)
    return {
      numero: idx + 1, type: t, questions: items,
      totalPoints: items.reduce((s, q) => s + (Number(q.points) || 0), 0),
    }
  })
}

export default function Export() {
  const navigate = useNavigate()
  const { examen, exporterExamen, exporterCorrection, loading, error } = useWizard()

  const [langue] = useState('fr')
  const [format, setFormat] = useState('pdf')
  const [enTete, setEnTete] = useState(true)
  const [pagination, setPagination] = useState(true)
  const [fichierUrl, setFichierUrl] = useState(null)
  const [fichierNom, setFichierNom] = useState(null)
  const [generation, setGeneration] = useState(false)
  const [lastError, setLastError] = useState(null)

  const [nomLycee, setNomLycee] = useState('')
  const [nomProfesseur, setNomProfesseur] = useState('')
  const [anneeScolaire, setAnneeScolaire] = useState(anneeScolaireCourante)
  const [typeDevoir, setTypeDevoir] = useState('controle_1')
  const [showInfosTun, setShowInfosTun] = useState(true)

  const [vueApercu, setVueApercu] = useState('sujet')
  const [genererCorrige, setGenererCorrige] = useState(false)
  const [erreurCorrige, setErreurCorrige] = useState(null)

  const matiereEstArabe = MATIERES_ARABES.has(examen.matiere)
  const cleMatiere = String(examen.matiere || '').toLowerCase()
  const langueDoc = (cleMatiere.includes('franc') || cleMatiere.includes('dictee')) ? 'fr' : 'ar'

  
  const imageLegendeFallback = recupererImageLegende()
  const imageLegendeNomFallback = recupererImageLegendeNom()

  
  const questionsEnrichies = enrichirQuestionsAvecImage(
    examen.questions || [],
    imageLegendeFallback,
    imageLegendeNomFallback,
  )

  
  const matiereLabel = MATIERE_LABEL[examen.matiere] || examen.matiere || '—'
  const niveauLabel = NIVEAU_LABEL[examen.niveau] || examen.niveau || '—'

  const matiereAr = (() => {
    if (MATIERE_AR[examen.matiere]) return MATIERE_AR[examen.matiere]
    const key = cleMatiere
    if (key.includes('math')) return 'الرياضيات'
    if (key.includes('arabe')) return 'العربية'
    if (key.includes('franc')) return 'الفرنسية'
    if (key.includes('angla')) return 'الإنقليزية'
    if (key.includes('islam')) return 'التربية الإسلامية'
    if (key.includes('eveil')) return 'الإيقاظ العلمي'
    if (key.includes('science')) return 'العلوم'
    if (key.includes('hist')) return 'التاريخ'
    if (key.includes('geo')) return 'الجغرافيا'
    if (key.includes('civi')) return 'التربية المدنية'
    if (key.includes('info')) return 'الإعلامية'
    if (key.includes('techno')) return 'التكنولوجيا'
    if (key.includes('dessin')) return 'الرسم'
    if (key.includes('musiq')) return 'الموسيقى'
    if (key.includes('sport') || key.includes('physi')) return 'التربية البدنية'
    return matiereLabel
  })()

  const niveauAr = (() => {
    if (NIVEAU_AR[examen.niveau]) return NIVEAU_AR[examen.niveau]
    const num = String(examen.niveau || '').match(/\d+/)?.[0]
    if (num) {
      const map = {
        '1': 'السنة الأولى ابتدائي', '2': 'السنة الثانية ابتدائي',
        '3': 'السنة الثالثة ابتدائي', '4': 'السنة الرابعة ابتدائي',
        '5': 'السنة الخامسة ابتدائي', '6': 'السنة السادسة ابتدائي',
      }
      if (map[num]) return map[num]
    }
    return niveauLabel
  })()

  const dureeMinutes = examen.duree_minutes ?? examen.duree ?? null
  function formaterDuree(min) {
    if (min == null || min === '') return '—'
    const m = Number(min)
    if (Number.isNaN(m) || m <= 0) return '—'
    const h = Math.floor(m / 60)
    const r = m % 60
    if (h === 0) return `${r} min`
    if (r === 0) return `${h}h`
    return `${h}h${String(r).padStart(2, '0')}`
  }
  const dureeLabel = formaterDuree(dureeMinutes)

  const formatSelectionne = FORMATS.find((f) => f.id === format) || FORMATS[0]
  const pret = Boolean(fichierUrl)

  const typeDevoirLabel =
    TYPES_DEVOIR.find((t) => t.id === typeDevoir)?.label || 'Devoir de contrôle N°1'
  const typeDevoirLabelAr = TYPES_DEVOIR_AR[typeDevoir] || TYPES_DEVOIR_AR.controle_1

  const exercices = regrouperEnExercices(questionsEnrichies)
  const nbExercices = exercices.length
  const nbQuestions = questionsEnrichies.length
  const totalPoints = questionsEnrichies.reduce((s, q) => s + (Number(q.points) || 0), 0) || 0

  
  const parametresCommuns = {
    langue,
    en_tete: enTete,
    pagination,
    nom_etablissement: nomLycee || '',
    nom_professeur: nomProfesseur || '',
    annee_scolaire: anneeScolaire,
    type_devoir: typeDevoir,
    type_devoir_label: typeDevoirLabel,
    type_devoir_label_ar: typeDevoirLabelAr,
    duree: dureeLabel,
    duree_minutes: dureeMinutes,
    matiere: examen.matiere,
    matiere_label: matiereLabel,
    matiere_label_ar: matiereAr,
    niveau: examen.niveau,
    niveau_label: niveauLabel,
    niveau_label_ar: niveauAr,
    contenu_langue: matiereEstArabe ? 'ar' : 'fr',
    pays_ar: L.pays,
    ministere_ar: L.ministere,
  }

  
  async function handleGenerer() {
    setGeneration(true)
    setLastError(null)

    try {
      const formatBackend = format === 'impression' ? 'pdf' : format

      const payload = {
        ...parametresCommuns,
        format: formatBackend,
        nb_questions: nbQuestions,
        pays_fr: 'République Tunisienne',
        ministere_fr: "Ministère de l'Éducation",
        exercices: exercices.map((ex) => ({
          numero: ex.numero, type: ex.type, total_points: ex.totalPoints,
          questions: ex.questions.map((q) => ({
            id: q.id,
            question: enonceAffiche(q, matiereEstArabe),
            question_ar: estLegende(q) ? enonceAffiche(q, true) : null,
            type: q.type, points: q.points,
            options: q.options || null,
            reponseCorrecte: q.reponseCorrecte ?? null,
            reponseCorrecteIndex: q.reponseCorrecteIndex ?? null,
            reponseAttendue: q.reponseAttendue ?? null,
            image: q.image ?? null,
            support: q.support ?? null,
            tableau: q.tableau ?? null,
            titre_exercice: q.titre_exercice ?? null,
            colonne_gauche: q.colonne_gauche ?? null,
            colonne_droite: q.colonne_droite ?? null,
            elements: q.elements ?? null,
            categories: q.categories ?? null,
            texte_dictee: q.texte_dictee ?? null,
            criteres_evaluation: q.criteres_evaluation ?? null,
            unite: q.unite ?? null,
            longueur_min_mots: q.longueur_min_mots ?? null,
          })),
        })),
      }

      const blob = await exporterExamen(payload)
      const url = URL.createObjectURL(blob)
      const ext = formatSelectionne.extension || '.pdf'
      const nom = `devoir_${examen.id}${ext}`

      if (format === 'impression') {
        const win = window.open(url, '_blank', 'noopener,noreferrer')
        if (win) {
          win.addEventListener('load', () => {
            try { win.print() } catch {  }
          })
        }
        return
      }

      setFichierUrl(url)
      setFichierNom(nom)
      if (formatSelectionne.nature !== 'texte') declencherTelechargement(url, nom)
    } catch (err) {
      setLastError(err?.message || 'Erreur lors de la génération du fichier.')
    } finally {
      setGeneration(false)
    }
  }

  function declencherTelechargement(url, filename) {
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  function handleReinitialiser() {
    if (fichierUrl) URL.revokeObjectURL(fichierUrl)
    setFichierUrl(null)
    setFichierNom(null)
    setLastError(null)
  }

  async function handleTelechargerCorrige() {
    setGenererCorrige(true)
    setErreurCorrige(null)
    try {
      const blob = await exporterCorrection({
        ...parametresCommuns,
        format: 'pdf',
        exercices: exercices.map((ex) => ({
          numero: ex.numero, type: ex.type, total_points: ex.totalPoints,
          questions: ex.questions.map((q) => ({
            ...q,
            question: enonceAffiche(q, matiereEstArabe),
          })),
        })),
      })
      const url = URL.createObjectURL(blob)
      declencherTelechargement(url, `corrige_${examen.id}.pdf`)
    } catch (err) {
      setErreurCorrige(err?.message || 'Erreur lors de la génération du corrigé.')
    } finally {
      setGenererCorrige(false)
    }
  }

  
  if (!examen.id) {
    return (
      <WizardShell step={4} hideStepper>
        <div className="mx-auto max-w-lg py-14 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#7a0008]/[0.08] text-[#7a0008]">
            <FileText size={22} />
          </div>
          <h1 className="examai-serif text-[20px] font-semibold text-[#0f172a]">Aucun examen en cours</h1>
          <p className="mt-2 text-[13.5px] font-bold italic text-[#0f172a]/55">
            Retournez à l'étape 1 pour générer un examen avant de pouvoir l'exporter.
          </p>
          <button
            onClick={() => navigate('/wizard/selection')}
            className={`mt-5 inline-flex items-center gap-2 rounded-full bg-[#7a0008] px-6 py-3 text-[13.5px] font-semibold text-white shadow-[0_1px_2px_rgba(15,23,42,0.2),0_10px_22px_-8px_rgba(122,0,8,0.5)] transition-all hover:-translate-y-0.5 active:scale-[0.985] ${FOCUS_RING}`}
          >
            Aller à la sélection <ArrowRight size={15} />
          </button>
        </div>
      </WizardShell>
    )
  }

  const corrige = vueApercu === 'corrige'

  return (
    <WizardShell step={4} hideStepper>
      <style>{`
        .examai-underline-wave {
          background-color: rgba(122,0,8,0.12);
          background-repeat: no-repeat;
          background-size: 100% 0.35em;
          background-position: 0 88%;
          padding: 0 0.15em;
        }
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

        
        .examai-a4 {
          width: 100%; max-width: 780px; margin: 0 auto; background: #ffffff;
          padding: clamp(14px, 3.2vw, 30px);
          box-shadow: 0 1px 3px rgba(15,23,42,0.08), 0 12px 32px -12px rgba(15,23,42,0.22);
          color: #111; position: relative;
          -webkit-font-smoothing: antialiased;
        }
        .examai-a4-cadre { border: 1.5px solid #111; padding: clamp(10px, 2.4vw, 20px); }
        .examai-arabic {
          font-family: 'Amiri', 'Scheherazade New', 'Traditional Arabic', 'Times New Roman', serif;
        }
        .examai-serif-pdf { font-family: 'Times New Roman', 'Georgia', serif; }

        .pdf-cartouche { display: grid; grid-template-columns: 1fr 0.95fr 1fr; border: 1.5px solid #111; }
        .pdf-cartouche > div { padding: 8px 10px; font-size: 12px; line-height: 1.75; }
        .pdf-cartouche > div + div { border-inline-start: 1px solid #111; }
        .pdf-points { color: #777; letter-spacing: 0.12em; }

        .pdf-consigne { display: grid; grid-template-columns: 1fr 62px; border: 1.3px solid #111; }
        .pdf-consigne + .pdf-consigne { margin-top: 10px; }
        .pdf-consigne-corps { padding: 10px 12px 12px; min-width: 0; }
        .pdf-consigne-critere {
          border-inline-start: 1.1px solid #111; padding-top: 8px;
          display: flex; flex-direction: column; align-items: center; gap: 4px;
        }
        .pdf-case-eval { width: 40px; height: 28px; border: 1.1px solid #111; }
        .pdf-titre-consigne { font-weight: 700; text-decoration: underline; text-underline-offset: 4px; font-size: 14.5px; }
        .pdf-question { font-weight: 700; font-size: 13.5px; line-height: 1.75; }
        .pdf-texte { font-size: 13px; line-height: 1.8; }
        .pdf-ligne { border-bottom: 1.4px dotted #555; height: 26px; }
        .pdf-case {
          width: 15px; height: 15px; border: 1.3px solid #111; flex-shrink: 0;
          display: inline-flex; align-items: center; justify-content: center;
          color: #0B6B3A; font-weight: 900; font-size: 13px; line-height: 1;
        }
        .pdf-reponse { color: #0B6B3A; font-weight: 700; font-size: 13px; line-height: 1.75; }
        .pdf-explication { color: #666; font-style: italic; font-size: 11.5px; line-height: 1.6; }
        .pdf-image { border: 1px solid #888; max-height: 150px; max-width: 200px; width: auto; object-fit: contain; }

        .pdf-table { border-collapse: collapse; }
        .pdf-table th, .pdf-table td { border: 1px solid #111; padding: 3px 8px; text-align: center; font-size: 12px; }
        .pdf-table th, .pdf-table .pdf-gris { background: #ededed; }

        @media (max-width: 560px) {
          .pdf-cartouche { grid-template-columns: 1fr; }
          .pdf-cartouche > div + div { border-inline-start: 0; border-top: 1px solid #111; }
          .pdf-image { max-width: 170px; max-height: 130px; align-self: center; }
          .pdf-consigne { grid-template-columns: 1fr 50px; }
          .pdf-consigne-corps { padding: 8px 9px 10px; }
          .pdf-case-eval { width: 32px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .examai-orbit, .examai-orbit-slow, .examai-orbit-pulse,
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
                Finaliser{' '}
                <span className="text-[#7a0008] relative">
                  <span className="examai-underline-wave">et exporter.</span>
                </span>
              </h1>
              <p className="examai-serif mt-2.5 text-[14px] sm:text-[15px] font-normal italic leading-[1.6] text-[#0f172a]/70">
                Vérifiez l'aperçu, choisissez le format et générez votre fichier.
              </p>
            </div>
            <div className={`flex shrink-0 items-center gap-2 rounded-full border-2 px-3 py-1.5 text-[11.5px] font-semibold transition-all ${
              pret ? 'border-emerald-500 bg-emerald-50/40' : 'border-[#0f172a]/15 bg-white'
            }`}>
              {pret ? (
                <>
                  <Check size={12} className="text-emerald-600" strokeWidth={3} />
                  <span className="font-bold text-emerald-700">Fichier prêt</span>
                </>
              ) : (
                <>
                  <Sparkles size={12} className="text-[#0f172a]/50" />
                  <span className="text-[#0f172a]/60">Prêt à exporter</span>
                </>
              )}
            </div>
          </div>
        </div>

        {}
        {(error || lastError || erreurCorrige) && (
          <div role="alert" className="mb-5 flex items-start gap-3 rounded-[16px] border border-[#7a0008]/40 bg-[#0f172a]/[0.035] p-4 text-[13px] text-[#0f172a]">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#7a0008]/10">
              <AlertTriangle size={14} className="text-[#7a0008]" />
            </span>
            <span className="min-w-0 break-words pt-0.5 font-medium">{lastError || erreurCorrige || error}</span>
          </div>
        )}

        {}
        <div className="mb-5 flex items-center overflow-x-auto rounded-[20px] border border-[#0f172a]/20 bg-white px-5 py-3.5" role="list">
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
        {generation && <GenerationLoader formatLabel={formatSelectionne.label} />}

        {}
        {!generation && (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">

            {}
            <div className="min-w-0">
              <div className="rounded-[24px] border border-[#0f172a]/20 bg-[#f4f2f1] p-4 sm:p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-white text-[#0f172a] ring-1 ring-[#0f172a]/10">
                      <Eye size={17} />
                    </span>
                    <div className="min-w-0">
                      <p className="examai-serif truncate text-[16.5px] font-semibold text-[#0f172a]">Aperçu du rendu</p>
                      <p className="mt-0.5 truncate text-[11.5px] text-[#0f172a]/50">
                        Format officiel tunisien · A4
                      </p>
                    </div>
                  </div>

                  {}
                  <div role="tablist" aria-label="Choix de l'aperçu" className="flex shrink-0 rounded-full border border-[#0f172a]/15 bg-white p-1">
                    {[
                      { id: 'sujet', label: 'Sujet', icon: FileText, actif: 'bg-[#7a0008] text-white' },
                      { id: 'corrige', label: 'Corrigé', icon: FileCheck2, actif: 'bg-emerald-600 text-white' },
                    ].map((t) => {
                      const Icon = t.icon
                      const actif = vueApercu === t.id
                      return (
                        <button
                          key={t.id}
                          role="tab"
                          aria-selected={actif}
                          onClick={() => setVueApercu(t.id)}
                          className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors ${FOCUS_RING} ${
                            actif ? t.actif : 'text-[#0f172a]/60 hover:text-[#0f172a]'
                          }`}
                        >
                          <Icon size={13} /> {t.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {corrige && (
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-emerald-300/70 bg-emerald-50/70 px-4 py-3">
                    <p className="min-w-0 text-[12px] leading-snug text-emerald-900/80">
                      <span className="font-bold">Corrigé réservé à l'enseignant</span> — réponses cochées, barème et explications.
                    </p>
                    <button
                      onClick={handleTelechargerCorrige}
                      disabled={genererCorrige}
                      className={`flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-[12px] font-semibold text-white transition-all hover:bg-emerald-700 active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
                    >
                      {genererCorrige ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} strokeWidth={2.4} />}
                      {genererCorrige ? 'Génération…' : 'Télécharger le corrigé'}
                    </button>
                  </div>
                )}

                <ApercuA4
                  lang={langueDoc}
                  corrige={corrige}
                  exercices={exercices}
                  matiereEstArabe={matiereEstArabe}
                  enTete={enTete}
                  pagination={pagination}
                  nomLycee={nomLycee}
                  nomProfesseur={nomProfesseur}
                  anneeScolaire={anneeScolaire}
                  titre={langueDoc === 'ar' ? typeDevoirLabelAr : typeDevoirLabel}
                  matiere={langueDoc === 'ar' ? matiereAr : matiereLabel}
                  niveau={langueDoc === 'ar' ? niveauAr : niveauLabel}
                  duree={langueDoc === 'ar' ? dureeAr(dureeLabel) : dureeLabel}
                  totalPoints={totalPoints}
                />

                <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-[#0f172a]/55">
                  <span className="flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
                    <FileText size={11} /> {nbExercices} exercice{nbExercices > 1 ? 's' : ''}
                  </span>
                  <span className="flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
                    <CheckCircle2 size={11} /> {totalPoints} point{totalPoints > 1 ? 's' : ''}
                  </span>
                  <span className="flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 font-semibold text-[#7a0008] shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
                    <formatSelectionne.icon size={11} /> {formatSelectionne.label}
                  </span>
                </div>

                {pret && fichierNom && (
                  <div className="mt-4 flex items-center justify-between gap-3 rounded-[14px] border border-emerald-500/30 bg-emerald-50/50 p-3.5">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                        <CheckCircle2 size={15} className="text-emerald-600" strokeWidth={2.4} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[12.5px] font-bold text-emerald-800">Fichier généré</p>
                        <p className="truncate text-[11px] italic text-emerald-700/70">{fichierNom}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        onClick={() => declencherTelechargement(fichierUrl, fichierNom)}
                        className={`flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-emerald-700 ${FOCUS_RING}`}
                      >
                        <Download size={12} /> Télécharger
                      </button>
                      <button
                        onClick={handleReinitialiser}
                        className={`rounded-full border border-emerald-500/40 bg-white px-3 py-1.5 text-[11px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-50 ${FOCUS_RING}`}
                      >
                        Régénérer
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {}
            <div className="space-y-4 lg:sticky lg:top-4">

              <div className="rounded-[24px] border border-[#7a0008]/25 bg-[#7a0008]/[0.02] p-5">
                <button
                  type="button"
                  onClick={() => setShowInfosTun((v) => !v)}
                  aria-expanded={showInfosTun}
                  className={`flex w-full items-center gap-2.5 text-left ${FOCUS_RING}`}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[#7a0008]/10 text-[#7a0008]">
                    🇹🇳
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="examai-serif text-[15px] font-semibold text-[#0f172a]">
                      En-tête officiel tunisien
                    </p>
                    <p className="examai-arabic text-[11px] font-bold text-[#0f172a]/45">
                      {L.pays} • {L.ministere}
                    </p>
                  </div>
                  <ArrowRight
                    size={14}
                    className={`shrink-0 text-[#0f172a]/40 transition-transform ${showInfosTun ? 'rotate-90' : ''}`}
                  />
                </button>

                {showInfosTun && (
                  <div className="mt-4 space-y-3">
                    <Champ label="École">
                      <input
                        type="text"
                        value={nomLycee}
                        onChange={(e) => setNomLycee(e.target.value)}
                        placeholder="مثال : المدرسة الابتدائية نهج الحرية"
                        dir="auto"
                        className={`examai-arabic w-full rounded-[10px] border border-[#0f172a]/20 bg-white px-3 py-2 text-[13px] text-[#0f172a] placeholder:text-[#0f172a]/30 focus:border-[#7a0008]/60 ${FOCUS_RING}`}
                      />
                    </Champ>

                    <Champ label="Enseignant(e)">
                      <input
                        type="text"
                        value={nomProfesseur}
                        onChange={(e) => setNomProfesseur(e.target.value)}
                        placeholder="مثال : محمد بن صالح"
                        dir="auto"
                        className={`examai-arabic w-full rounded-[10px] border border-[#0f172a]/20 bg-white px-3 py-2 text-[13px] text-[#0f172a] placeholder:text-[#0f172a]/30 focus:border-[#7a0008]/60 ${FOCUS_RING}`}
                      />
                    </Champ>

                    <div className="grid grid-cols-2 gap-2.5">
                      <Champ label="Année scolaire">
                        <input
                          type="text"
                          value={anneeScolaire}
                          onChange={(e) => setAnneeScolaire(e.target.value)}
                          placeholder="2026 / 2027"
                          className={`w-full rounded-[10px] border border-[#0f172a]/20 bg-white px-3 py-2 text-[13px] text-[#0f172a] placeholder:text-[#0f172a]/30 focus:border-[#7a0008]/60 ${FOCUS_RING}`}
                        />
                      </Champ>
                      <Champ label="Type de devoir">
                        <select
                          value={typeDevoir}
                          onChange={(e) => setTypeDevoir(e.target.value)}
                          className={`w-full rounded-[10px] border border-[#0f172a]/20 bg-white px-2.5 py-2 text-[13px] text-[#0f172a] focus:border-[#7a0008]/60 ${FOCUS_RING}`}
                        >
                          {TYPES_DEVOIR.map((t) => (
                            <option key={t.id} value={t.id}>{t.short}</option>
                          ))}
                        </select>
                      </Champ>
                    </div>
                    <p className="examai-arabic -mt-1 text-right text-[12px] font-bold text-[#7a0008]/80" dir="rtl">
                      {typeDevoirLabelAr}
                    </p>

                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <InfoMini icon={BookOpen} label="Matière" valeur={matiereAr} arabe />
                      <InfoMini icon={GraduationCap} label="Niveau" valeur={niveauAr.replace(' ابتدائي', '')} arabe />
                      <InfoMini icon={Clock} label="Durée" valeur={dureeLabel} />
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-[24px] border border-[#0f172a]/20 bg-white p-5">
                <TitreCarte icon={FileText} titre="Format de sortie" sous="Type de fichier" />
                <div className="mt-3 space-y-1.5">
                  {FORMATS.map((opt) => {
                    const Icon = opt.icon
                    const active = format === opt.id
                    return (
                      <label
                        key={opt.id}
                        className={`flex cursor-pointer items-center justify-between gap-2 rounded-[12px] border px-3 py-2 transition-colors ${
                          active ? 'border-[#7a0008]/40 bg-[#7a0008]/[0.04]' : 'border-[#0f172a]/15 hover:border-[#0f172a]/30'
                        }`}
                      >
                        <span className="flex min-w-0 items-center gap-2.5">
                          <input
                            type="radio" name="format" checked={active}
                            onChange={() => setFormat(opt.id)}
                            className="h-4 w-4 shrink-0 border-[#0f172a]/30 text-[#7a0008] focus:ring-[#7a0008]/30"
                          />
                          <span className="shrink-0"><Icon size={18} /></span>
                          <span className="min-w-0">
                            <span className="block text-[13px] font-medium text-[#0f172a]">{opt.label}</span>
                            <span className="block truncate text-[10.5px] italic text-[#0f172a]/50">{opt.description}</span>
                          </span>
                        </span>
                        {opt.tag && (
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider ${TAG_TONES[opt.tagTone] || TAG_TONES.navy}`}>
                            {opt.tag}
                          </span>
                        )}
                      </label>
                    )
                  })}
                </div>
              </div>

              <div className="rounded-[24px] border border-[#0f172a]/20 bg-white p-5">
                <TitreCarte icon={Settings2} titre="Options" sous="Langue et mise en page" />
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-[13px] font-semibold text-[#0f172a]">
                      <Globe size={14} className="text-[#0f172a]/50" /> Langue de l'interface
                    </span>
                    <div className="flex rounded-full border border-[#0f172a]/15 p-0.5 text-[11.5px] font-semibold">
                      <span className="rounded-full bg-[#7a0008] px-2.5 py-1 text-white">FR</span>
                      <span className="cursor-not-allowed px-2.5 py-1 text-[#0f172a]/30" title="Bientôt">AR</span>
                    </div>
                  </div>
                  <div className="h-px bg-[#0f172a]/10" />
                  <Toggle
                    label="En-tête de l'établissement"
                    description="Cartouche officiel en haut de la copie"
                    on={enTete} onChange={setEnTete}
                  />
                  <div className="h-px bg-[#0f172a]/10" />
                  <Toggle
                    label="Pagination automatique"
                    description="Numérote les pages du document"
                    on={pagination} onChange={setPagination}
                  />
                </div>
                <div className="mt-4 flex items-start gap-2 rounded-[12px] border border-[#0f172a]/15 bg-[#0f172a]/[0.02] p-3">
                  <Sparkles size={12} className="mt-0.5 shrink-0 text-[#0f172a]/50" strokeWidth={2.2} />
                  <p className="text-[11px] font-medium leading-snug text-[#0f172a]/55">
                    {format === 'impression'
                      ? 'Le PDF s\'ouvrira dans un nouvel onglet et la boîte d\'impression s\'affichera.'
                      : formatSelectionne.nature === 'texte'
                        ? 'Le fichier texte sera généré, puis prêt à télécharger.'
                        : 'Le fichier sera téléchargé automatiquement une fois la génération terminée.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {}
        {!generation && (
          <div className="sticky bottom-4 z-20 mt-5 w-full">
            <div className="w-full overflow-hidden rounded-[20px] border border-[#0f172a]/20 bg-white/95 shadow-[0_14px_32px_-14px_rgba(15,23,42,0.25)] backdrop-blur">
              <div className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap items-center gap-2 text-[12px] text-[#0f172a]/60">
                  <span className="flex items-center gap-1.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0f172a]/[0.08] text-[10px] font-bold text-[#0f172a]">
                      {nbExercices}
                    </span>
                    exercice{nbExercices > 1 ? 's' : ''}
                  </span>
                  <span className="h-3 w-px bg-[#0f172a]/15" />
                  <span className="flex items-center gap-1.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#7a0008]/[0.08] text-[10px] font-bold text-[#7a0008]">
                      {totalPoints}
                    </span>
                    point{totalPoints > 1 ? 's' : ''}
                  </span>
                  <span className="h-3 w-px bg-[#0f172a]/15" />
                  <span className="flex items-center gap-1.5 rounded-full bg-[#0f172a]/[0.05] px-2 py-0.5 font-semibold text-[#0f172a]/70">
                    <Clock size={12} /> {dureeLabel}
                  </span>
                  {pret && (
                    <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10.5px] font-bold text-emerald-700">
                      <Check size={10} strokeWidth={3} /> Prêt
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => navigate('/wizard/validation')}
                    className={`flex shrink-0 items-center justify-center gap-1.5 rounded-full border-2 border-[#0f172a]/20 bg-white px-4 py-2.5 text-[12.5px] font-semibold text-[#0f172a] transition-all hover:-translate-y-0.5 hover:border-[#0f172a]/50 active:scale-[0.985] ${FOCUS_RING} ${HOVER_LIFT}`}
                  >
                    <ArrowLeft size={14} strokeWidth={2.4} />
                    Retour
                  </button>
                  <button
                    onClick={handleTelechargerCorrige}
                    disabled={genererCorrige}
                    className={`flex shrink-0 items-center justify-center gap-1.5 rounded-full border-2 border-emerald-600/70 bg-white px-4 py-2.5 text-[12.5px] font-semibold text-emerald-700 transition-all hover:-translate-y-0.5 hover:bg-emerald-50 active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING} ${HOVER_LIFT}`}
                  >
                    {genererCorrige ? <Loader2 size={14} className="animate-spin" /> : <FileCheck2 size={14} strokeWidth={2.2} />}
                    {genererCorrige ? 'Génération…' : 'Corrigé (PDF)'}
                  </button>
                  <button
                    onClick={handleGenerer}
                    disabled={loading}
                    className={`group relative flex shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-full bg-[#7a0008] px-5 py-2.5 text-[12.5px] font-semibold text-white shadow-[0_1px_2px_rgba(15,23,42,0.2),0_10px_22px_-10px_rgba(122,0,8,0.55),inset_0_1px_0_rgba(255,255,255,0.15)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#961014] active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${FOCUS_RING}`}
                  >
                    <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                    {loading ? (
                      <Loader2 size={14} className="relative animate-spin" />
                    ) : format === 'impression' ? (
                      <Printer size={14} strokeWidth={2.4} className="relative" />
                    ) : null}
                    <span className="relative">
                      {loading ? 'Génération…' : format === 'impression' ? 'Imprimer' : 'Télécharger'}
                    </span>
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


function ApercuA4({
  lang, corrige, exercices, matiereEstArabe, enTete, pagination,
  nomLycee, nomProfesseur, anneeScolaire, titre, matiere, niveau, duree, totalPoints,
}) {
  const T = LBL[lang]
  const dir = lang === 'ar' ? 'rtl' : 'ltr'
  const police = lang === 'ar' ? 'examai-arabic' : 'examai-serif-pdf'
  const pts = <span className="pdf-points">..........</span>

  return (
    <div className="examai-a4">
      <div className={`examai-a4-cadre ${police}`} dir={dir}>
        {}
        {enTete ? (
          <div className="pdf-cartouche mb-4">
            <div>
              <p className="font-bold">{T.pays}</p>
              <p className="font-bold">{T.ministere}</p>
              <p>{T.ecole} : {nomLycee || pts}</p>
              <p>{T.enseignant} : {nomProfesseur || pts}</p>
              <p>{T.annee} : <span dir="ltr">{anneeScolaire}</span></p>
            </div>
            <div className="flex flex-col items-center justify-center text-center">
              {corrige && <p className="text-[13px] font-bold">{T.corrige}</p>}
              <p className="text-[17px] font-bold leading-snug">{titre}</p>
              <p className="text-[14px] font-bold">{[T.enMatiere, matiere].filter(Boolean).join(' ')}</p>
              <p>{niveau}</p>
              {duree && duree !== '—' && <p>{T.duree} : {duree}</p>}
            </div>
            <div className="flex flex-col justify-center">
              {corrige ? (
                <p className="text-center">{T.reserve}</p>
              ) : (
                <>
                  <p className="font-bold">{T.nom} :</p>
                  <p>{pts}{pts}</p>
                  <p>{T.classe} : {pts}</p>
                  <div className="mx-auto mt-1.5 border-[1.5px] border-[#111] px-4 py-1 text-[13px] font-bold">
                    {T.note} : .... / {fmtPoints(totalPoints)}
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          <p className="mb-4 text-center text-[17px] font-bold">{corrige ? `${T.corrige} : ` : ''}{titre}</p>
        )}

        {}
        {exercices.length === 0 ? (
          <p className="pdf-explication text-center">{T.aucune}</p>
        ) : (
          exercices.map((ex) => (
            <div key={ex.numero} className="pdf-consigne">
              <div className="pdf-consigne-corps">
                <p className="pdf-titre-consigne mb-1.5">{T.consigne} {ex.numero} :</p>
                <div className="space-y-3">
                  {ex.questions.map((q, qi) => (
                    <QuestionApercu
                      key={q.id ?? qi}
                      q={q}
                      prefixe={ex.questions.length > 1 ? `${LETTRES[lang][qi] || qi + 1}) ` : ''}
                      lang={lang}
                      corrige={corrige}
                      matiereEstArabe={matiereEstArabe}
                    />
                  ))}
                </div>
              </div>
              <div className="pdf-consigne-critere">
                <span className="text-[13px] font-bold">{T.critere}{ex.numero}</span>
                <span className="pdf-case-eval" />
                {corrige && <span className="text-[12px]">{fmtPoints(ex.totalPoints)} {T.pts}</span>}
              </div>
            </div>
          ))
        )}

        {}
        {exercices.length > 0 && (
          <div className="mt-5">
            <p className="pdf-titre-consigne mb-2">{T.grille}</p>
            <div className="overflow-x-auto">
              <table className="pdf-table">
                <thead>
                  <tr>
                    <th>{T.criteres}</th>
                    {exercices.map((ex) => <th key={ex.numero}>{T.critere}{ex.numero}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {[['+++', 1], ['++-', 2 / 3], ['+--', 1 / 3], ['---', 0]].map(([sym, part]) => (
                    <tr key={sym}>
                      <td className="pdf-gris font-mono font-bold" dir="ltr">{sym}</td>
                      {exercices.map((ex) => (
                        <td key={ex.numero}>{fmtPoints(demi(ex.totalPoints * part))}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
              <div className="border-[1.5px] border-[#111] px-4 py-2 text-[13px] font-bold">
                {T.noteFinale} : ...... / {fmtPoints(totalPoints)}
              </div>
              <div className="h-[64px] w-[190px] border-[1.5px] border-[#111] px-3 py-1.5 text-[12.5px] font-bold">
                {T.signature} :
              </div>
            </div>
          </div>
        )}
      </div>

      {pagination && (
        <p className={`mt-2 text-center text-[10.5px] text-[#777] ${police}`}>{T.page} 1</p>
      )}
    </div>
  )
}


function QuestionApercu({ q, prefixe, lang, corrige, matiereEstArabe }) {
  const T = LBL[lang]
  const type = normaliserType(q.type)
  const enonce = enonceAffiche(q, matiereEstArabe)
  const imageUrl = q.image?.url
  const reponse = (valeur) => (
    <p className="pdf-reponse">{T.reponse} : {valeur || '—'}</p>
  )

  const choix = (textes, idxCorrect) => (
    <div className={`mt-1.5 grid grid-cols-1 gap-x-6 gap-y-1.5 ${textes.some((t) => String(t).length > 18) ? '' : 'sm:grid-cols-2'}`}>
      {textes.map((t, j) => {
        const bon = corrige && idxCorrect === j
        return (
          <span key={j} className={`flex items-center gap-2 pdf-texte ${bon ? 'pdf-reponse' : ''}`}>
            <span className="pdf-case">{bon ? '✕' : ''}</span>
            <span className="min-w-0">{t}</span>
          </span>
        )
      })}
    </div>
  )

  const lignes = (n) => (
    <div className="mt-1">
      {Array.from({ length: n }).map((_, i) => <div key={i} className="pdf-ligne" />)}
    </div>
  )

  
  const haut = (
    <div className="min-w-0 flex-1">
      {q.support && <p className="pdf-texte mb-1 whitespace-pre-line">{q.support}</p>}
      <p className="pdf-question">
        {prefixe}{enonce || <span className="italic font-normal text-[#999]">{T.questionVide}</span>}
      </p>
      {type === 'qcm' && q.options && choix(q.options, q.reponseCorrecteIndex)}
      {type === 'vrai_faux' && choix([T.vrai, T.faux], q.reponseCorrecte ? 0 : 1)}
    </div>
  )

  let zoneReponse = null
  if (type === 'ouverte' || type === 'texte_trous') {
    zoneReponse = corrige ? reponse(q.reponseAttendue) : lignes(type === 'texte_trous' ? 1 : 3)
  } else if (type === 'calcul') {
    zoneReponse = corrige ? reponse(`${q.reponseAttendue ?? ''} ${q.unite || ''}`.trim()) : lignes(2)
  } else if (type === 'dictee') {
    zoneReponse = corrige ? <p className="pdf-reponse">{T.texte} : {q.texte_dictee || '—'}</p> : lignes(4)
  } else if (type === 'redaction') {
    zoneReponse = corrige
      ? <p className="pdf-explication">{(q.criteres_evaluation || []).join(' · ') || '—'}</p>
      : (
        <>
          {lignes(6)}
          {q.longueur_min_mots && <p className="pdf-explication mt-1">{T.longueur} : {q.longueur_min_mots}</p>}
        </>
      )
  } else if (estLegende(q)) {
    zoneReponse = (
      <ul className="mt-1 space-y-1">
        {(q.reponseCorrecte || []).map((r, i) => (
          <li key={i} className="flex items-end gap-2 pdf-texte">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#111] text-[11px] font-bold">{i + 1}</span>
            {corrige ? <span className="pdf-reponse">{r || '—'}</span> : <span className="pdf-ligne flex-1" />}
          </li>
        ))}
      </ul>
    )
  } else if (type === 'association') {
    zoneReponse = (
      <ul className="mt-1 space-y-1 pdf-texte">
        {(q.colonne_gauche || []).map((g, i) => (
          <li key={i} className="flex items-end gap-2">
            <span className="font-bold">{i + 1})</span>
            <span>{g}</span>
            <span className="text-[#777]">{lang === 'ar' ? '←' : '→'}</span>
            {corrige
              ? <span className="pdf-reponse">{q.colonne_droite?.[q.reponseCorrecte?.[i]] ?? '?'}</span>
              : <span className="pdf-ligne min-w-[90px] flex-1" />}
          </li>
        ))}
      </ul>
    )
  } else if (type === 'remise_en_ordre') {
    zoneReponse = corrige
      ? <p className="pdf-reponse">{T.ordre} : {(q.reponseCorrecte || []).map((idx) => q.elements?.[idx]).join(lang === 'ar' ? ' ← ' : ' → ')}</p>
      : (
        <ul className="mt-1 space-y-1 pdf-texte">
          {(q.elements || []).map((el, i) => (
            <li key={i} className="flex items-center gap-2"><span className="pdf-case" /><span>{el}</span></li>
          ))}
        </ul>
      )
  } else if (type === 'tri') {
    zoneReponse = (
      <div className="mt-1 space-y-1.5 pdf-texte">
        <div className="flex flex-wrap gap-2">
          {(q.categories || []).map((c, i) => (
            <span key={i} className="border border-[#111] px-2 font-bold">{c}</span>
          ))}
        </div>
        <ul className="space-y-1">
          {(q.elements || []).map((el, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="pdf-case" />
              <span>{el}</span>
              {corrige && <span className="pdf-reponse">— {q.categories?.[q.reponseCorrecte?.[i]] ?? '?'}</span>}
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <div>
      {imageUrl ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
          {haut}
          <img src={imageUrl} alt={q.image?.alt_text || ''} className="pdf-image shrink-0" />
        </div>
      ) : haut}

      {q.tableau?.headers && q.tableau?.rows && (
        <div className="mt-2 overflow-x-auto">
          <table className="pdf-table w-full">
            <thead>
              <tr>{q.tableau.headers.map((h, hi) => <th key={hi}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {q.tableau.rows.map((row, ri) => (
                <tr key={ri}>{row.map((c, ci) => <td key={ci}>{c}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {zoneReponse}

      {corrige && q.explication && (
        <p className="pdf-explication mt-0.5">{T.explication} : {q.explication}</p>
      )}
    </div>
  )
}


function Champ({ label, children }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-[10.5px] font-bold uppercase tracking-wider text-[#0f172a]/55">{label}</span>
      {children}
    </label>
  )
}

function InfoMini({ icon: Icon, label, valeur, arabe = false }) {
  return (
    <div className="min-w-0 rounded-[10px] border border-[#0f172a]/10 bg-white/80 px-2 py-2 text-center">
      <Icon size={13} className="mx-auto text-[#0f172a]/50" />
      <p className="mt-1 text-[9.5px] font-bold uppercase tracking-wider text-[#0f172a]/45">{label}</p>
      <p className={`truncate text-[12px] font-semibold text-[#0f172a] ${arabe ? 'examai-arabic' : ''}`} title={valeur}>{valeur}</p>
    </div>
  )
}

function TitreCarte({ icon: Icon, titre, sous }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[#0f172a]/[0.08] text-[#0f172a]">
        <Icon size={15} />
      </span>
      <div className="min-w-0">
        <p className="examai-serif text-[15px] font-semibold text-[#0f172a]">{titre}</p>
        <p className="text-[10.5px] font-bold italic text-[#0f172a]/45">{sous}</p>
      </div>
    </div>
  )
}


function Toggle({ label, description, on, onChange }) {
  return (
    <button
      type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)}
      className={`group flex w-full items-center justify-between gap-3 text-left ${FOCUS_RING}`}
    >
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold text-[#0f172a]">{label}</span>
        {description && (
          <span className="mt-0.5 block text-[11px] italic text-[#0f172a]/50">{description}</span>
        )}
      </span>
      <span className={`relative flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ${
        on ? 'bg-[#7a0008]' : 'bg-[#0f172a]/[0.15]'
      }`}>
        <span className={`absolute h-5 w-5 rounded-full bg-white shadow-[0_1px_3px_rgba(15,23,42,0.25)] transition-transform duration-200 ${
          on ? 'translate-x-[22px]' : 'translate-x-0.5'
        }`} />
      </span>
    </button>
  )
}


function GenerationLoader({ formatLabel = 'PDF' }) {
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
          <FileText size={24} className="text-white" strokeWidth={2} />
        </div>
      </div>
      <div className="relative flex flex-col items-center gap-2 text-center">
        <h3 className="examai-serif text-[18px] font-semibold text-[#0f172a]">Génération en cours</h3>
        <p className="flex items-center gap-1 text-[13px] font-medium italic text-[#0f172a]/55">
          Préparation du {formatLabel}
          <span className="examai-dot-1 inline-block h-1 w-1 rounded-full bg-[#0f172a]/60" />
          <span className="examai-dot-2 inline-block h-1 w-1 rounded-full bg-[#0f172a]/60" />
          <span className="examai-dot-3 inline-block h-1 w-1 rounded-full bg-[#0f172a]/60" />
        </p>
      </div>
      <ul className="relative w-full max-w-sm space-y-1.5">
        {ETAPES_GENERATION.map((etape, idx) => {
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