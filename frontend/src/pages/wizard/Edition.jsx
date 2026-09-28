import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Download, Loader2, AlertTriangle, Check, ArrowLeft, ArrowRight,
  FileText, Printer, Globe, Settings2, Eye, Sparkles, CheckCircle2,
  FileCheck2, FileType2, FileCode2, FileJson, Wand2,
  X, GraduationCap, BookOpen, Clock,
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

/* ===== LOGOS DES FORMATS ===== */
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

/* ===== FORMATS D'EXPORT ===== */
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

/* ===== TYPES DE DEVOIRS ===== */
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

const DUREES = ['1h', '1h30', '2h', '2h30', '3h', '3h30', '4h']

/* ===== MATIÈRES EN ARABE ===== */
const MATIERE_AR = {
  arabe: 'العربية', francais: 'الفرنسية', math: 'الرياضيات', maths: 'الرياضيات',
  mathematiques: 'الرياضيات', mathématiques: 'الرياضيات',
  eveil: 'الإيقاظ العلمي', eveil_scientifique: 'الإيقاظ العلمي',
  sciences: 'العلوم', islamique: 'التربية الإسلامية',
  education_islamique: 'التربية الإسلامية', histoire: 'التاريخ',
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
  exercice: 'التمرين', point: 'نقطة', points: 'نقاط', page: 'صفحة',
  pays: 'الجمهورية التونسية', ministere: 'وزارة التربية',
  etablissement: 'المؤسسة التربوية', annee: 'السنة الدراسية',
  matiere: 'المادة', niveau: 'المستوى', professeur: 'الأستاذ(ة)',
  nomPrenom: 'الاسم واللقب', classe: 'القسم', numero: 'العدد', date: 'التاريخ',
  note: 'العدد', bonCourage: 'بالتوفيق', vrai: 'صحيح', faux: 'خطأ',
  questionVide: 'سؤال فارغ', optionVide: 'خيار فارغ', aucuneQuestion: 'لا توجد أسئلة',
}

/* ===== TRADUCTIONS AR ===== */
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

/* ===== HELPERS ===== */
function normaliserType(t) {
  return String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
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
function estEnArabe(q, matiereEstArabe) {
  return matiereEstArabe || estLegende(q)
}

/* ===== IMAGE LEGENDE — FALLBACK MULTI-SOURCE ===== */
function recupererImageLegende() {
  try {
    const s = sessionStorage.getItem('examai_image_legende')
    if (s && s.length > 20) return s
  } catch {}
  try {
    const l = localStorage.getItem('examai_image_legende')
    if (l && l.length > 20) return l
  } catch {}
  return null
}
function recupererImageLegendeNom() {
  try { return sessionStorage.getItem('examai_image_legende_nom') || '' } catch { return '' }
}

function extraireUrlImage(q) {
  if (!q) return null
  if (q.image?.url && String(q.image.url).length > 20) return q.image.url
  if (q.image_url && String(q.image_url).length > 20) return q.image_url
  if (q.imageUrl && String(q.imageUrl).length > 20) return q.imageUrl
  if (q.illustration && String(q.illustration).length > 20) return q.illustration
  if (q.image_data && String(q.image_data).length > 20) return q.image_data
  return null
}

function enrichirQuestionsAvecImage(questions, imageFallback, nomFallback) {
  if (!Array.isArray(questions)) return []
  return questions.map((q) => {
    if (!estLegende(q)) return q
    const urlExistante = extraireUrlImage(q)
    if (urlExistante) {
      if (!q.image?.url) {
        return {
          ...q,
          image: {
            ...(q.image || {}),
            url: urlExistante,
            alt_text: q.image?.alt_text || nomFallback || '',
            description: q.image?.description || '',
          },
        }
      }
      return q
    }
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

/* ===== REGROUPEMENT GLOBAL PAR TYPE ===== */
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
  const { examen, exporterExamen, loading, error } = useWizard()

  const [langue, setLangue] = useState('fr')
  const [format, setFormat] = useState('pdf')
  const [enTete, setEnTete] = useState(true)
  const [pagination, setPagination] = useState(true)
  const [fichierUrl, setFichierUrl] = useState(null)
  const [fichierNom, setFichierNom] = useState(null)
  const [generation, setGeneration] = useState(false)
  const [lastError, setLastError] = useState(null)

  const [nomLycee, setNomLycee] = useState('')
  const [nomProfesseur, setNomProfesseur] = useState('')
  const [anneeScolaire, setAnneeScolaire] = useState('2024 / 2025')
  const [typeDevoir, setTypeDevoir] = useState('controle_1')
  const [showInfosTun, setShowInfosTun] = useState(true)

  const { exporterCorrection } = useWizard()
  const [genererCorrige, setGenererCorrige] = useState(false)
  const [erreurCorrige, setErreurCorrige] = useState(null)

  const matiereEstArabe = MATIERES_ARABES.has(examen.matiere)

  const imageLegendeFallback = recupererImageLegende()
  const imageLegendeNomFallback = recupererImageLegendeNom()

  const questionsEnrichies = enrichirQuestionsAvecImage(
    examen.questions || [],
    imageLegendeFallback,
    imageLegendeNomFallback,
  )

  /* ===== VALEURS PRÉ-REMPLIES ===== */
  const matiereLabel = MATIERE_LABEL[examen.matiere] || examen.matiere || '—'
  const niveauLabel = NIVEAU_LABEL[examen.niveau] || examen.niveau || '—'

  const matiereAr = (() => {
    if (MATIERE_AR[examen.matiere]) return MATIERE_AR[examen.matiere]
    const key = String(examen.matiere || '').toLowerCase()
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

  /* ===== GÉNÉRATION ===== */
  async function handleGenerer() {
    setGeneration(true)
    setLastError(null)

    try {
      const formatBackend = format === 'impression' ? 'pdf' : format

      const payload = {
        format: formatBackend,
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
        nb_questions: nbQuestions,
        contenu_langue: matiereEstArabe ? 'ar' : 'fr',
        pays_ar: L.pays,
        ministere_ar: L.ministere,
        pays_fr: 'République Tunisienne',
        ministere_fr: "Ministère de l'Éducation",
        exercices: exercices.map((ex) => ({
          numero: ex.numero, type: ex.type, total_points: ex.totalPoints,
          questions: ex.questions.map((q) => ({
            id: q.id,
            // ✅ Consigne traduite (legende → AR) pour le backend
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
            try { win.print() } catch { /* ignoré */ }
          })
        }
        return
      }

      if (formatSelectionne.nature === 'texte') {
        setFichierUrl(url)
        setFichierNom(nom)
        return
      }

      setFichierUrl(url)
      setFichierNom(nom)
      declencherTelechargement(url, nom)
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
        format: 'pdf',
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
        exercices: exercices.map((ex) => ({
          numero: ex.numero, type: ex.type, total_points: ex.totalPoints,
          questions: ex.questions.map((q) => ({
            ...q,
            question: enonceAffiche(q, matiereEstArabe),
          })),
        })),
      })
      const url = URL.createObjectURL(blob)
      const nom = `corrige_${examen.id}.pdf`
      declencherTelechargement(url, nom)
    } catch (err) {
      setErreurCorrige(err?.message || 'Erreur lors de la génération du corrigé.')
    } finally {
      setGenererCorrige(false)
    }
  }

  /* ===== GARDE ===== */
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

        .examai-a4 {
          width: 100%; max-width: 800px; margin: 0 auto; background: #ffffff;
          padding: 40px 44px;
          box-shadow: 0 1px 3px rgba(15,23,42,0.08), 0 10px 30px -10px rgba(15,23,42,0.18);
          border: 1px solid rgba(15,23,42,0.08);
          position: relative;
          font-feature-settings: 'kern';
          -webkit-font-smoothing: antialiased;
        }
        .examai-a4::before {
          content: ''; position: absolute; inset: 12px;
          border: 1px solid rgba(122,0,8,0.12); pointer-events: none; border-radius: 4px;
        }
        .examai-a4::after {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 4px;
          background: linear-gradient(90deg,
            #7a0008 0%, #7a0008 33%,
            rgba(122,0,8,0.4) 33%, rgba(122,0,8,0.4) 66%,
            rgba(122,0,8,0.15) 66%, rgba(122,0,8,0.15) 100%);
        }
        .examai-arabic {
          font-family: 'Amiri', 'Scheherazade New', 'Traditional Arabic', 'Times New Roman', serif;
          direction: rtl; unicode-bidi: embed;
        }
        .examai-serif-pdf { font-family: 'Georgia', 'Times New Roman', 'Cambria', serif; }
        @media print {
          .examai-a4 { box-shadow: none; border: none; max-width: 100%; padding: 20mm 15mm; }
          .examai-a4::before { inset: 8px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .examai-pulse, .examai-orbit, .examai-orbit-slow, .examai-orbit-pulse,
          .examai-scan, .examai-fade-in-up, .examai-dot-1, .examai-dot-2, .examai-dot-3 {
            animation: none !important;
          }
        }
      `}</style>

      <div className="w-full max-w-full overflow-x-hidden">

        {/* ===== EN-TÊTE PAGE ===== */}
        <div className="relative mb-6 w-full overflow-hidden rounded-[28px] border border-[#0f172a]/20 bg-white p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="examai-serif text-[30px] sm:text-[40px] lg:text-[42px] font-semibold tracking-[-0.025em] text-[#0f172a] leading-[1.15]">
                Finaliser{' '}
                <span className="text-[#7a0008] relative">
                  <span className="examai-underline-wave">et exporter.</span>
                </span>
              </h1>
              <p className="examai-serif mt-3 text-[14px] sm:text-[15px] font-normal italic leading-[1.6] text-[#0f172a]/75">
                Choisissez le format de votre choix et générez votre fichier.
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

        {/* ===== ERREURS ===== */}
        {(error || lastError) && (
          <div role="alert" className="mb-5 flex items-start gap-3 rounded-[16px] border border-[#7a0008]/40 bg-[#0f172a]/[0.035] p-4 text-[13px] text-[#0f172a]">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#7a0008]/10">
              <AlertTriangle size={14} className="text-[#7a0008]" />
            </span>
            <span className="min-w-0 break-words pt-0.5 font-medium">{lastError || error}</span>
          </div>
        )}

        {/* ===== STEPPER ===== */}
        <div className="mb-5 flex items-center rounded-[20px] border border-[#0f172a]/20 bg-white px-5 py-4" role="list">
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

        {/* ===== LOADER ===== */}
        {generation && <GenerationLoader formatLabel={formatSelectionne.label} />}

        {/* ===== CONTENU ===== */}
        {!generation && (
          <div className="grid gap-5 lg:grid-cols-[1fr_360px] lg:items-start">

            {/* ===== COLONNE PRINCIPALE ===== */}
            <div className="min-w-0 space-y-5">
              {/* APERÇU PDF */}
              <div className="rounded-[24px] border border-[#0f172a]/20 bg-[#f7f5f4] p-5 sm:p-6">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-[#0f172a]/[0.08] text-[#0f172a]">
                      <Eye size={17} />
                    </span>
                    <div className="min-w-0">
                      <p className="examai-serif truncate text-[16.5px] font-semibold text-[#0f172a]">Aperçu du rendu</p>
                      <p className="mt-0.5 truncate text-[11.5px] text-[#0f172a]/50">
                        Format officiel — République Tunisienne · A4
                      </p>
                    </div>
                  </div>
                  <div className="hidden shrink-0 items-center gap-1.5 rounded-full border border-[#0f172a]/15 bg-white px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-wider text-[#0f172a]/60 sm:flex">
                    <FileText size={11} />
                    A4 · 210 × 297 mm
                  </div>
                </div>

                <div className="examai-a4">
                  {enTete && (
                    <div className="mb-5">
                      <div className="examai-arabic text-center">
                        <p className="text-[15px] font-bold tracking-wide text-[#7a0008]">{L.pays}</p>
                        <p className="mt-1 text-[12px] font-semibold text-[#7a0008]/85">{L.ministere}</p>
                      </div>
                      <div className="my-3 h-[2px] bg-gradient-to-r from-transparent via-[#7a0008]/40 to-transparent" />
                      <div className="grid grid-cols-2 gap-4 text-[11px] leading-relaxed">
                        <div className="examai-arabic space-y-1 text-right">
                          <p>
                            <span className="font-bold text-[#7a0008]">{L.etablissement} : </span>
                            {nomLycee ? <span className="font-medium">{nomLycee}</span>
                              : <span className="text-[#4f0005]/40 tracking-widest">............................</span>}
                          </p>
                          <p>
                            <span className="font-bold text-[#7a0008]">{L.annee} : </span>
                            <span className="font-medium">{anneeScolaire}</span>
                          </p>
                          <p>
                            <span className="font-bold text-[#7a0008]">{L.matiere} : </span>
                            <span className="font-medium">{matiereAr}</span>
                            <span className="mx-1.5 text-[#7a0008]/40">•</span>
                            <span className="font-bold text-[#7a0008]">{L.niveau} : </span>
                            <span className="font-medium">{niveauAr}</span>
                          </p>
                          <p>
                            <span className="font-bold text-[#7a0008]">{L.professeur} : </span>
                            {nomProfesseur ? <span className="font-medium">{nomProfesseur}</span>
                              : <span className="text-[#4f0005]/40 tracking-widest">............................</span>}
                          </p>
                        </div>
                        <div className="examai-arabic space-y-1 border-r border-[#7a0008]/20 pr-4 text-right">
                          <p>
                            <span className="font-bold text-[#7a0008]">{L.nomPrenom} : </span>
                            <span className="text-[#4f0005]/40 tracking-widest">............................</span>
                          </p>
                          <p>
                            <span className="font-bold text-[#7a0008]">{L.classe} : </span>
                            <span className="text-[#4f0005]/40 tracking-widest">..............</span>
                            <span className="ml-2 font-bold text-[#7a0008]">{L.numero} : </span>
                            <span className="text-[#4f0005]/40 tracking-widest">........</span>
                          </p>
                          <p>
                            <span className="font-bold text-[#7a0008]">{L.date} : </span>
                            <span className="text-[#4f0005]/40 tracking-widest">......../......../..............</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="examai-arabic my-5 text-center">
                    <p className="text-[15px] font-bold tracking-wide text-[#250002]">{typeDevoirLabelAr}</p>
                    <div className="mx-auto mt-2 h-[2px] w-32 bg-[#7a0008]/30" />
                    {dureeLabel !== '—' && (
                      <p className="mt-2 text-[11px] italic text-[#4f0005]/60">Durée : {dureeLabel}</p>
                    )}
                  </div>

                  <div className={`space-y-5 ${matiereEstArabe ? 'examai-arabic' : 'examai-serif-pdf'}`} dir={matiereEstArabe ? 'rtl' : 'ltr'}>
                    {exercices.slice(0, 3).map((ex) => (
                      <div key={ex.numero} className="rounded-[6px] border border-[#7a0008]/20 bg-white/70 p-4">
                        <div className="examai-arabic flex items-baseline justify-between gap-3 border-b border-dashed border-[#7a0008]/30 pb-2">
                          <p className="text-[13px] font-bold tracking-wide text-[#7a0008]">
                            {L.exercice} {ex.numero}
                          </p>
                          <span className="shrink-0 rounded-full bg-[#7a0008]/[0.08] px-2.5 py-0.5 text-[11px] font-bold text-[#7a0008]">
                            {ex.totalPoints} {ex.totalPoints > 1 ? L.points : L.point}
                          </span>
                        </div>
                        <div className="mt-3 space-y-3">
                          {ex.questions.map((q, qi) => {
                            const rtl = estEnArabe(q, matiereEstArabe)
                            const imageUrl = extraireUrlImage(q)
                            return (
                              <div key={q.id ?? qi}>
                                <div className="flex items-start justify-between gap-3">
                                  <p
                                    className={`min-w-0 flex-1 text-[12px] font-medium leading-[1.85] text-[#250002] ${rtl ? 'examai-arabic' : ''}`}
                                    dir={rtl ? 'rtl' : 'ltr'}
                                  >
                                    <span className="font-bold text-[#7a0008]">{qi + 1}) </span>
                                    {enonceAffiche(q, matiereEstArabe) || <span className="italic text-[#4f0005]/40">{L.questionVide}</span>}
                                  </p>
                                  <span className="shrink-0 pt-0.5 text-[10.5px] font-semibold text-[#7a0008]/75">
                                    {q.points} {Number(q.points) > 1 ? L.points : L.point}
                                  </span>
                                </div>

                                {q.support && (
                                  <p className="mt-2 whitespace-pre-line rounded-[6px] bg-[#0f172a]/[0.03] px-2.5 py-2 text-[11.5px] italic text-[#4f0005]/85">
                                    {q.support}
                                  </p>
                                )}

                                {q.tableau && q.tableau.headers && q.tableau.rows && (
                                  <div className="mt-2 overflow-x-auto">
                                    <table className="w-full border-collapse text-[11.5px] text-[#250002]">
                                      <thead>
                                        <tr className="bg-[#7a0008]/[0.06]">
                                          {q.tableau.headers.map((h, hi) => (
                                            <th key={hi} className="border border-[#7a0008]/25 px-2 py-1 text-center font-bold">
                                              {h}
                                            </th>
                                          ))}
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {q.tableau.rows.map((row, ri) => (
                                          <tr key={ri}>
                                            {row.map((cell, ci) => (
                                              <td key={ci} className="border border-[#7a0008]/25 px-2 py-1 text-center">
                                                {cell}
                                              </td>
                                            ))}
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}

                                {/* ✅ IMAGE — affichée pour legende (aperçu A4) */}
                                {estLegende(q) && (
                                  <div className="mt-2.5 pl-4">
                                    {imageUrl ? (
                                      <img
                                        src={imageUrl}
                                        alt={q.image?.alt_text || ''}
                                        className="max-h-56 w-auto rounded-[6px] border border-[#7a0008]/25 object-contain"
                                      />
                                    ) : (
                                      <div className="flex h-28 w-full max-w-md flex-col items-center justify-center rounded-[6px] border border-dashed border-amber-400 bg-amber-50/50 px-3 text-center text-[10.5px] italic text-amber-700">
                                        <span className="font-bold not-italic">⚠ Image de la légende introuvable</span>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {q.type === 'qcm' && q.options && (
                                  <ul className="mt-2 space-y-1.5 pl-4">
                                    {q.options.slice(0, 4).map((o, j) => (
                                      <li key={j} className="flex items-center gap-2 text-[11.5px] text-[#4f0005]/85">
                                        <span className="shrink-0 font-bold text-[#7a0008]">{String.fromCharCode(97 + j)})</span>
                                        <span className="min-w-0 flex-1">
                                          {o || <span className="italic text-[#4f0005]/30">{L.optionVide}</span>}
                                        </span>
                                        <span className="ml-3 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[2px] border border-[#7a0008]/50" />
                                      </li>
                                    ))}
                                  </ul>
                                )}

                                {q.type === 'vrai_faux' && (
                                  <div className="mt-2 flex gap-6 pl-4 text-[11.5px] text-[#4f0005]/85">
                                    <span className="flex items-center gap-2">
                                      <span className="flex h-4 w-4 items-center justify-center rounded-[2px] border-2 border-[#7a0008]/50" />
                                      <span className="examai-arabic font-medium">{L.vrai}</span>
                                    </span>
                                    <span className="flex items-center gap-2">
                                      <span className="flex h-4 w-4 items-center justify-center rounded-[2px] border-2 border-[#7a0008]/50" />
                                      <span className="examai-arabic font-medium">{L.faux}</span>
                                    </span>
                                  </div>
                                )}

                                {(q.type === 'ouverte' || q.type === 'texte_trous') && (
                                  <div className="mt-3 space-y-4 pl-4">
                                    {[1, 2, 3].map((n) => (
                                      <div key={n} className="border-b border-dotted border-[#7a0008]/35" />
                                    ))}
                                  </div>
                                )}

                                {estLegende(q) && (
                                  <ul className="mt-2 space-y-1.5 pl-4">
                                    {(q.reponseCorrecte || []).map((_, i) => (
                                      <li key={i} className="flex items-center gap-2 text-[11.5px] text-[#4f0005]/85">
                                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-[#7a0008]/50 text-[9px] font-bold text-[#7a0008]">
                                          {i + 1}
                                        </span>
                                        <span className="inline-block min-w-[160px] flex-1 border-b border-dotted border-[#7a0008]/45" />
                                      </li>
                                    ))}
                                  </ul>
                                )}

                                {q.type === 'association' && (
                                  <ul className="mt-2 space-y-1 pl-4 text-[11.5px] text-[#4f0005]/85">
                                    {(q.colonne_gauche || []).map((g, i) => (
                                      <li key={i} className="flex items-center gap-2">
                                        <span className="font-bold text-[#7a0008]">{i + 1})</span>
                                        <span className="min-w-0 flex-1">{g}</span>
                                        <span className="text-[#7a0008]/50">→</span>
                                        <span className="inline-block min-w-[80px] border-b border-dotted border-[#7a0008]/45" />
                                      </li>
                                    ))}
                                  </ul>
                                )}

                                {q.type === 'remise_en_ordre' && (
                                  <ol className="mt-2 space-y-1 pl-4 text-[11.5px] text-[#4f0005]/85">
                                    {(q.elements || []).map((el, i) => (
                                      <li key={i} className="flex items-center gap-2">
                                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border border-[#7a0008]/50" />
                                        <span>{el}</span>
                                      </li>
                                    ))}
                                  </ol>
                                )}

                                {q.type === 'tri' && (
                                  <div className="mt-2 space-y-2 pl-4 text-[11.5px]">
                                    <div className="flex flex-wrap gap-2">
                                      {(q.categories || []).map((c, i) => (
                                        <span key={i} className="rounded-full border border-[#7a0008]/40 px-2 py-0.5 font-bold text-[#7a0008]">
                                          {c}
                                        </span>
                                      ))}
                                    </div>
                                    <ul className="space-y-1">
                                      {(q.elements || []).map((el, i) => (
                                        <li key={i} className="flex items-center gap-2 text-[#4f0005]/85">
                                          <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-[#7a0008]/50" />
                                          <span>{el}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                {q.type === 'calcul' && (
                                  <div className="mt-2 flex items-center gap-2 pl-4">
                                    <span className="inline-block min-w-[140px] border-b border-dotted border-[#7a0008]/45" />
                                    {q.unite && <span className="text-[11px] font-bold text-[#7a0008]/70">{q.unite}</span>}
                                  </div>
                                )}

                                {q.type === 'dictee' && (
                                  <div className="mt-3 space-y-4 pl-4">
                                    {[1, 2, 3, 4].map((n) => (
                                      <div key={n} className="border-b border-dotted border-[#7a0008]/35" />
                                    ))}
                                  </div>
                                )}

                                {q.type === 'redaction' && (
                                  <div className="mt-3 space-y-4 pl-4">
                                    {Array.from({ length: 6 }).map((_, n) => (
                                      <div key={n} className="border-b border-dotted border-[#7a0008]/35" />
                                    ))}
                                    {q.longueur_min_mots && (
                                      <p className="text-[10.5px] italic text-[#4f0005]/55">
                                        Longueur minimale : {q.longueur_min_mots} mots
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                    {nbExercices > 3 && (
                      <p className="examai-arabic text-center text-[11px] italic text-[#4f0005]/40">
                        … {nbExercices - 3} تمارين أخرى في الوثيقة الكاملة
                      </p>
                    )}
                  </div>

                  {pagination && (
                    <div className="examai-arabic mt-6 border-t border-[#7a0008]/15 pt-3 text-center">
                      <p className="text-[10.5px] italic text-[#4f0005]/45">{L.page} 1</p>
                    </div>
                  )}
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-2 text-[11px] text-[#0f172a]/55">
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
                  <div className="mt-4 flex items-center justify-between gap-3 rounded-[14px] border border-emerald-500/30 bg-emerald-50/40 p-3.5">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                        <CheckCircle2 size={15} className="text-emerald-600" strokeWidth={2.4} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[12.5px] font-bold text-emerald-800">Fichier généré</p>
                        <p className="truncate text-[11px] italic text-emerald-700/70">{fichierNom}</p>
                      </div>
                    </div>
                    <button
                      onClick={handleReinitialiser}
                      className={`shrink-0 rounded-full border border-emerald-500/40 bg-white px-3 py-1.5 text-[11px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-50 ${FOCUS_RING}`}
                    >
                      Régénérer
                    </button>
                  </div>
                )}
              </div>

              {/* CORRIGÉ */}
              <div className="rounded-[24px] border border-emerald-300/70 bg-emerald-50/40 p-5">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-emerald-100 text-emerald-700">
                    <FileCheck2 size={15} />
                  </span>
                  <div className="min-w-0">
                    <p className="examai-serif text-[15px] font-semibold text-[#0f172a]">Corrigé de l'examen</p>
                    <p className="text-[10.5px] font-bold italic text-[#0f172a]/45">Réponses, barème et explications</p>
                  </div>
                </div>
                <p className="mt-3 text-[11.5px] leading-snug text-[#0f172a]/60">
                  Aperçu ci-dessous. Le PDF (réservé à l'enseignant) reprend l'en-tête officiel tunisien.
                </p>
                <div className="mt-3 max-h-72 space-y-2 overflow-y-auto rounded-[14px] border border-emerald-200 bg-white p-3">
                  {exercices.length === 0 ? (
                    <p className="text-[11px] italic text-[#0f172a]/40">{L.aucuneQuestion}</p>
                  ) : (
                    exercices.map((ex) => (
                      <div key={ex.numero} className="rounded-[10px] border border-emerald-200/70 bg-emerald-50/30 p-2.5">
                        <p className="examai-arabic mb-1.5 text-[11px] font-bold tracking-wide text-emerald-700">
                          {L.exercice} {ex.numero} — {ex.totalPoints} {ex.totalPoints > 1 ? L.points : L.point}
                        </p>
                        <div className="space-y-1.5">
                          {ex.questions.map((q, i) => {
                            const rtl = estEnArabe(q, matiereEstArabe)
                            const imageUrl = extraireUrlImage(q)
                            return (
                              <div key={q.id ?? i} className="rounded-[8px] border border-[#0f172a]/10 bg-white p-2">
                                <p
                                  className={`text-[11px] font-semibold text-[#0f172a] ${rtl ? 'examai-arabic' : ''}`}
                                  dir={rtl ? 'rtl' : 'ltr'}
                                >
                                  {i + 1}. {enonceAffiche(q, matiereEstArabe) || <span className="italic text-[#0f172a]/40">—</span>}
                                </p>

                                {q.support && (
                                  <p className="mt-1 whitespace-pre-line rounded-[6px] bg-[#0f172a]/[0.03] px-2 py-1 text-[10px] italic text-[#0f172a]/60">
                                    {q.support}
                                  </p>
                                )}

                                {/* ✅ IMAGE dans le corrigé — affichée pour legende */}
                                {estLegende(q) && (
                                  <div className="mt-1.5">
                                    {imageUrl ? (
                                      <img
                                        src={imageUrl}
                                        alt={q.image?.alt_text || ''}
                                        className="max-h-40 w-auto rounded-[6px] border border-emerald-200 object-contain"
                                      />
                                    ) : (
                                      <div className="flex h-16 w-full max-w-xs items-center justify-center rounded-[6px] border border-dashed border-amber-300 bg-amber-50/50 text-center text-[10px] italic text-amber-700">
                                        ⚠ Image introuvable
                                      </div>
                                    )}
                                  </div>
                                )}

                                {q.type === 'qcm' && (
                                  <ul className="mt-1 space-y-0.5">
                                    {(q.options || []).map((o, j) => (
                                      <li key={j} className={`flex items-center gap-1.5 text-[10.5px] ${
                                        j === q.reponseCorrecteIndex ? 'font-bold text-emerald-700' : 'text-[#0f172a]/55'
                                      }`}>
                                        {j === q.reponseCorrecteIndex && (
                                          <Check size={9} strokeWidth={3} className="shrink-0 text-emerald-600" />
                                        )}
                                        {String.fromCharCode(97 + j)}) {o}
                                      </li>
                                    ))}
                                  </ul>
                                )}

                                {q.type === 'vrai_faux' && (
                                  <p className="examai-arabic mt-1 text-[10.5px] font-bold text-emerald-700">
                                    الإجابة الصحيحة : {q.reponseCorrecte ? L.vrai : L.faux}
                                  </p>
                                )}

                                {(q.type === 'ouverte' || q.type === 'texte_trous') && (
                                  <p className="mt-1 text-[10.5px] font-bold text-emerald-700">
                                    <span className="examai-arabic">الإجابة المنتظرة</span> :{' '}
                                    {q.reponseAttendue || <span className="italic font-normal text-[#0f172a]/40">—</span>}
                                  </p>
                                )}

                                {estLegende(q) && (
                                  <ul className="mt-1 space-y-0.5 text-[10.5px] font-bold text-emerald-700">
                                    {(q.reponseCorrecte || []).map((r, ri) => (
                                      <li key={ri} className="flex items-center gap-1.5">
                                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[9px] font-bold text-emerald-700">
                                          {ri + 1}
                                        </span>
                                        <span>{r || '—'}</span>
                                      </li>
                                    ))}
                                  </ul>
                                )}

                                {q.type === 'association' && (
                                  <ul className="mt-1 space-y-0.5 text-[10.5px] text-emerald-700">
                                    {(q.colonne_gauche || []).map((g, gi) => (
                                      <li key={gi}>
                                        <span className="font-bold">{g}</span>
                                        {' → '}
                                        <span className="font-bold">{q.colonne_droite?.[q.reponseCorrecte?.[gi]] ?? '?'}</span>
                                      </li>
                                    ))}
                                  </ul>
                                )}

                                {q.type === 'remise_en_ordre' && (
                                  <p className="mt-1 text-[10.5px] font-bold text-emerald-700">
                                    Ordre : {(q.reponseCorrecte || []).map((idx) => q.elements?.[idx]).join(' → ')}
                                  </p>
                                )}

                                {q.type === 'tri' && (
                                  <ul className="mt-1 space-y-0.5 text-[10.5px] text-emerald-700">
                                    {(q.elements || []).map((el, ei) => (
                                      <li key={ei}>
                                        <span className="font-bold">{el}</span>
                                        {' — '}
                                        <span className="font-bold">{q.categories?.[q.reponseCorrecte?.[ei]] ?? '?'}</span>
                                      </li>
                                    ))}
                                  </ul>
                                )}

                                {q.type === 'calcul' && (
                                  <p className="mt-1 text-[10.5px] font-bold text-emerald-700">
                                    Réponse : {q.reponseAttendue} {q.unite || ''}
                                  </p>
                                )}

                                {q.type === 'dictee' && (
                                  <p className="mt-1 text-[10.5px] font-bold text-emerald-700">
                                    Texte : {q.texte_dictee}
                                  </p>
                                )}

                                {q.type === 'redaction' && (
                                  <p className="mt-1 text-[10.5px] italic text-emerald-700/80">
                                    {(q.criteres_evaluation || []).join(' · ') || 'Évaluée sur critères (pas de réponse unique)'}
                                  </p>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                {erreurCorrige && (
                  <p className="mt-2 text-[11.5px] font-medium text-[#7a0008]">{erreurCorrige}</p>
                )}
                <button
                  onClick={handleTelechargerCorrige}
                  disabled={genererCorrige}
                  className={`mt-3 flex w-full items-center justify-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2.5 text-[12.5px] font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-emerald-700 active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING} ${HOVER_LIFT}`}
                >
                  {genererCorrige ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} strokeWidth={2.4} />}
                  {genererCorrige ? 'Génération…' : 'Télécharger le corrigé (PDF)'}
                </button>
              </div>
            </div>

            {/* ===== COLONNE DROITE ===== */}
            <div className="space-y-4">

              <div className="rounded-[24px] border border-[#7a0008]/25 bg-[#7a0008]/[0.02] p-5">
                <button
                  type="button"
                  onClick={() => setShowInfosTun((v) => !v)}
                  className={`flex w-full items-center gap-2.5 text-left ${FOCUS_RING}`}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[#7a0008]/10 text-[#7a0008]">
                    🇹🇳
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="examai-serif text-[15px] font-semibold text-[#0f172a]">
                      En-tête officiel tunisien
                    </p>
                    <p className="text-[10.5px] font-bold italic text-[#0f172a]/45">
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
                    <label className="block">
                      <span className="block text-[11px] font-bold uppercase tracking-wider text-[#0f172a]/60">Ecole</span>
                      <input
                        type="text"
                        value={nomLycee}
                        onChange={(e) => setNomLycee(e.target.value)}
                        placeholder="مثال : معهد ابن خلدون — تونس"
                        className={`examai-arabic mt-1 w-full rounded-[10px] border border-[#0f172a]/20 bg-white px-3 py-2 text-[12.5px] text-[#0f172a] placeholder:text-[#0f172a]/30 focus:border-[#7a0008]/60 ${FOCUS_RING}`}
                      />
                    </label>

                    <label className="block">
                      <span className="block text-[11px] font-bold uppercase tracking-wider text-[#0f172a]/60">Professeur</span>
                      <input
                        type="text"
                        value={nomProfesseur}
                        onChange={(e) => setNomProfesseur(e.target.value)}
                        placeholder="مثال : الأستاذ محمد بن صالح"
                        className={`examai-arabic mt-1 w-full rounded-[10px] border border-[#0f172a]/20 bg-white px-3 py-2 text-[12.5px] text-[#0f172a] placeholder:text-[#0f172a]/30 focus:border-[#7a0008]/60 ${FOCUS_RING}`}
                      />
                    </label>

                    <label className="block">
                      <span className="block text-[11px] font-bold uppercase tracking-wider text-[#0f172a]/60">Année scolaire</span>
                      <input
                        type="text"
                        value={anneeScolaire}
                        onChange={(e) => setAnneeScolaire(e.target.value)}
                        placeholder="2024 / 2025"
                        className={`mt-1 w-full rounded-[10px] border border-[#0f172a]/20 bg-white px-3 py-2 text-[12.5px] text-[#0f172a] placeholder:text-[#0f172a]/30 focus:border-[#7a0008]/60 ${FOCUS_RING}`}
                      />
                    </label>

                    <label className="block">
                      <span className="block text-[11px] font-bold uppercase tracking-wider text-[#0f172a]/60">Type de devoir</span>
                      <select
                        value={typeDevoir}
                        onChange={(e) => setTypeDevoir(e.target.value)}
                        className={`mt-1 w-full rounded-[10px] border border-[#0f172a]/20 bg-white px-3 py-2 text-[12.5px] text-[#0f172a] focus:border-[#7a0008]/60 ${FOCUS_RING}`}
                      >
                        {TYPES_DEVOIR.map((t) => (
                          <option key={t.id} value={t.id}>
                            {TYPES_DEVOIR_AR[t.id]} — {t.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="space-y-2 pt-1">
                      <p className="text-[10.5px] font-bold uppercase tracking-wider text-[#0f172a]/45">
                        Issus de votre sélection
                      </p>

                      <div className="flex items-center gap-2.5 rounded-[10px] border border-[#0f172a]/10 bg-white/70 p-2.5">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] bg-[#0f172a]/[0.06] text-[#0f172a]/70">
                          <BookOpen size={13} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-[#0f172a]/50">Matière</p>
                          <p className="examai-arabic truncate text-[12px] font-semibold text-[#0f172a]">{matiereAr}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 rounded-[10px] border border-[#0f172a]/10 bg-white/70 p-2.5">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] bg-[#0f172a]/[0.06] text-[#0f172a]/70">
                          <GraduationCap size={13} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-[#0f172a]/50">Niveau</p>
                          <p className="examai-arabic truncate text-[12px] font-semibold text-[#0f172a]">{niveauAr}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 rounded-[10px] border border-[#0f172a]/10 bg-white/70 p-2.5">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] bg-[#0f172a]/[0.06] text-[#0f172a]/70">
                          <Clock size={13} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-[#0f172a]/50">Durée</p>
                          <p className="truncate text-[12px] font-semibold text-[#0f172a]">{dureeLabel}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-[24px] border border-[#0f172a]/20 bg-white p-5">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[#0f172a]/[0.08] text-[#0f172a]">
                    <Globe size={15} />
                  </span>
                  <div className="min-w-0">
                    <p className="examai-serif text-[15px] font-semibold text-[#0f172a]">Langue du rendu</p>
                    <p className="text-[10.5px] font-bold italic text-[#0f172a]/45">Langue du document</p>
                  </div>
                </div>
                <div className="mt-3 space-y-1.5">
                  {[
                    { id: 'fr', label: 'Français' },
                    { id: 'ar', label: 'العربية', disabled: true, tag: 'Bientôt' },
                    { id: 'bilingue', label: 'Bilingue FR + AR', disabled: true, tag: 'Bientôt' },
                  ].map((opt) => (
                    <label
                      key={opt.id}
                      className={`flex items-center justify-between gap-2 rounded-[12px] border px-3 py-2 text-[13px] transition-colors ${
                        opt.disabled
                          ? 'cursor-not-allowed border-[#0f172a]/10 bg-[#0f172a]/[0.02] text-[#0f172a]/35'
                          : langue === opt.id
                            ? 'cursor-pointer border-[#7a0008]/40 bg-[#7a0008]/[0.04] text-[#0f172a]'
                            : 'cursor-pointer border-[#0f172a]/15 text-[#0f172a]/70 hover:border-[#0f172a]/30'
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <input
                          type="radio" name="langue" checked={langue === opt.id}
                          disabled={opt.disabled}
                          onChange={() => setLangue(opt.id)}
                          className="h-4 w-4 border-[#0f172a]/30 text-[#7a0008] focus:ring-[#7a0008]/30 disabled:cursor-not-allowed"
                        />
                        <span className="font-medium">{opt.label}</span>
                      </span>
                      {opt.tag && (
                        <span className={`rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider ${TAG_TONES.amber}`}>
                          {opt.tag}
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </div>

              <div className="rounded-[24px] border border-[#0f172a]/20 bg-white p-5">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[#0f172a]/[0.08] text-[#0f172a]">
                    <FileText size={15} />
                  </span>
                  <div className="min-w-0">
                    <p className="examai-serif text-[15px] font-semibold text-[#0f172a]">Format de sortie</p>
                    <p className="text-[10.5px] font-bold italic text-[#0f172a]/45">Type de fichier</p>
                  </div>
                </div>
                <div className="mt-3 space-y-1.5">
                  {FORMATS.map((opt) => {
                    const Icon = opt.icon
                    const active = format === opt.id
                    return (
                      <label
                        key={opt.id}
                        className={`flex cursor-pointer items-start justify-between gap-2 rounded-[12px] border px-3 py-2.5 transition-colors ${
                          active ? 'border-[#7a0008]/40 bg-[#7a0008]/[0.04]' : 'border-[#0f172a]/15 hover:border-[#0f172a]/30'
                        }`}
                      >
                        <span className="flex min-w-0 items-start gap-2.5">
                          <input
                            type="radio" name="format" checked={active}
                            onChange={() => setFormat(opt.id)}
                            className="mt-0.5 h-4 w-4 shrink-0 border-[#0f172a]/30 text-[#7a0008] focus:ring-[#7a0008]/30"
                          />
                          <span className="mt-0.5 shrink-0"><Icon size={18} /></span>
                          <span className="min-w-0">
                            <span className="block text-[13px] font-medium text-[#0f172a]">{opt.label}</span>
                            <span className="mt-0.5 block text-[10.5px] italic text-[#0f172a]/50">{opt.description}</span>
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
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[#0f172a]/[0.08] text-[#0f172a]">
                    <Settings2 size={15} />
                  </span>
                  <div className="min-w-0">
                    <p className="examai-serif text-[15px] font-semibold text-[#0f172a]">Options avancées</p>
                    <p className="text-[10.5px] font-bold italic text-[#0f172a]/45">Personnalisation</p>
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  <Toggle
                    label="En-tête de l'établissement"
                    description="Ajoute le bloc officiel en haut du document"
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
                        ? 'Le fichier texte sera généré puis téléchargé automatiquement.'
                        : 'Le fichier sera téléchargé automatiquement une fois la génération terminée.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===== BARRE FLOTTANTE ===== */}
        {!generation && (
          <div className="sticky bottom-4 z-20 mt-5 w-full">
            <div className="w-full overflow-hidden rounded-[20px] border border-[#0f172a]/20 bg-white shadow-[0_14px_32px_-14px_rgba(15,23,42,0.25)]">
              <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
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
                  <span className="h-3 w-px bg-[#0f172a]/15" />
                  <span className="flex items-center gap-1.5 rounded-full bg-[#0f172a]/[0.05] px-2 py-0.5 font-semibold text-[#0f172a]/70">
                    <formatSelectionne.icon size={12} /> {formatSelectionne.label}
                  </span>
                  <span className="h-3 w-px bg-[#0f172a]/15" />
                  <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10.5px] font-bold text-emerald-700">
                    🇹🇳 Tunisien
                  </span>
                  {pret && (
                    <>
                      <span className="h-3 w-px bg-[#0f172a]/15" />
                      <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10.5px] font-bold text-emerald-700">
                        <Check size={10} strokeWidth={3} /> Prêt
                      </span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => navigate('/wizard/validation')}
                    className={`group flex shrink-0 items-center justify-center gap-1.5 rounded-full border-2 border-[#0f172a]/25 bg-white px-4 py-2.5 text-[12.5px] font-semibold text-[#0f172a] transition-all hover:-translate-y-0.5 hover:border-[#0f172a]/60 hover:bg-[#0f172a]/[0.04] active:scale-[0.985] ${FOCUS_RING} ${HOVER_LIFT}`}
                  >
                    <ArrowLeft size={14} strokeWidth={2.4} />
                    Retour à la validation
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
                    ) : (
                      <formatSelectionne.icon size={14} className="relative" />
                    )}
                    <span className="relative">
                      {loading ? 'Génération…' : format === 'impression' ? 'Imprimer' : `Générer le ${formatSelectionne.label}`}
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

/* ===== TOGGLE ===== */
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

/* ===== LOADER ===== */
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