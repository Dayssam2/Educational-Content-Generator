import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Search, Plus, ArrowUp, ArrowDown, Paperclip, X, RotateCcw,
  MessageSquare, Inbox, Loader2, AlertTriangle, Check,
  Copy, ThumbsUp, ThumbsDown, Mic, Square, FileText, AudioLines,
  Volume2, Pause, Wand2, ExternalLink, Keyboard, Menu, Trash2,
  PanelLeftClose, ChevronRight, Maximize2, Pin, Pencil, Calculator, Languages, PenLine, BookOpen, FlaskConical, Globe, Lightbulb, ListChecks, Settings2,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import TopNav from '../components/TopNav.jsx'
import { api } from '../api/client.js'
import { useASR } from '../voice/useASR.js'
import { useTTS } from '../voice/useTTS.js'
import { commandeLocale, LANGUES_VOCALES } from '../voice/voixUtils.js'


const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1a1a]/35 focus-visible:ring-offset-2'
const HOVER_LIFT = 'motion-reduce:transition-none motion-reduce:hover:translate-y-0'

const SUGGESTIONS_INITIALES = [
  { titre: 'Créer un examen', text: 'Comment créer un examen de maths pour des 3ème ?', icon: FileText },
  { titre: 'Évaluer la compréhension', text: 'Quels types de questions pour évaluer une compréhension ?', icon: ListChecks },
  { titre: 'Paramètres', text: 'Comment modifier les paramètres de mon examen ?', icon: Settings2 },
  { titre: 'Varier les questions', text: 'Des conseils pour des questions plus variées ?', icon: Lightbulb },
]

const SUGGESTIONS_CONTEXTE = [
  { text: 'Peux-tu me donner un exemple concret ?' },
  { text: 'Quels sont les pièges à éviter ?' },
  { text: 'Comment adapter pour des élèves en difficulté ?' },
]

const STORAGE_KEY = 'examai_chat_history'
const STORAGE_LANGUE_VOCALE = 'examai_langue_vocale'

const MAX_TAILLE_PDF_OCTETS = 15 * 1024 * 1024

const MATIERES = [
  { id: 'mathematique', label: 'Mathématiques' },
  { id: 'arabe', label: 'Arabe' },
  { id: 'science', label: 'Sciences' },
  { id: 'francais', label: 'Français' },
  { id: 'histoire_geo', label: 'Histoire-Géo' },
]


const ROUTE_GENERATEUR = '/generateur'
const ROUTE_MES_EXAMENS = '/mes-examens'

const SEUIL_CONFIANCE_SLU = 0.6

const transcrireServeur = api.asrAssistant ? (d) => api.asrAssistant(d) : undefined
const syntheseServeur = api.ttsAssistant ? (d) => api.ttsAssistant(d) : undefined

function libelleMatiere(id) {
  return MATIERES.find((m) => m.id === id)?.label || id
}

function resumerParametres(p = {}, ar = false) {
  const morceaux = []
  if (p.matiere) morceaux.push(ar ? `مادة ${libelleMatiere(p.matiere)}` : libelleMatiere(p.matiere))
  if (p.niveau) morceaux.push(ar ? `السنة ${p.niveau}` : `${p.niveau}e année`)
  if (p.nb_questions) morceaux.push(ar ? `${p.nb_questions} أسئلة` : `${p.nb_questions} questions`)
  return morceaux.join(', ')
}

function manquants(p = {}) {
  return ['matiere', 'niveau'].filter((k) => !p[k])
}

function formatTaille(octets) {
  if (octets < 1024) return `${octets} o`
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`
}

function lireFichierEnBase64(fichier) {
  return new Promise((resolve, reject) => {
    const lecteur = new FileReader()
    lecteur.onload = () => resolve(lecteur.result)
    lecteur.onerror = () => reject(lecteur.error)
    lecteur.readAsDataURL(fichier)
  })
}


function texteALire(md) {
  const enLigne = (t) => t
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__|~~)(.+?)\1/g, '$2')
    .replace(/(^|[\s(])[*_](\S(?:.*?\S)?)[*_](?=[\s).,;:!?]|$)/g, '$1$2')
    .replace(/\s+/g, ' ')
    .trim()

  const phrases = []
  String(md || '')
    .replace(/```[\s\S]*?```/g, '\n')
    .split('\n')
    .forEach((brute) => {
      let ligne = brute.trim()
      if (!ligne || /^[-*_]{3,}$/.test(ligne)) return
      if (/^\|?[\s:|-]+\|[\s:|-]*$/.test(ligne)) return
      if (ligne.includes('|')) {
        ligne = ligne.replace(/^\||\|$/g, '').split('|').map((c) => c.trim()).filter(Boolean).join(', ')
      }
      ligne = ligne
        .replace(/^#{1,6}\s+/, '')
        .replace(/^>\s?/, '')
        .replace(/^[-*+•]\s+/, '')
      ligne = enLigne(ligne)
      if (ligne) phrases.push(ligne)
    })

  return phrases
    .map((p) => (/[.!?:;…»"]$/.test(p) ? p : `${p}.`))
    .join(' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim()
}


function groupeDate(iso) {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return 'Plus ancien'
  const maintenant = new Date()
  const debutJour = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate()).getTime()
  const jour = 24 * 3600 * 1000
  if (t >= debutJour) return "Aujourd'hui"
  if (t >= debutJour - jour) return 'Hier'
  if (t >= debutJour - 7 * jour) return '7 derniers jours'
  if (t >= debutJour - 30 * jour) return '30 derniers jours'
  return 'Plus ancien'
}
const ORDRE_GROUPES = ["Aujourd'hui", 'Hier', '7 derniers jours', '30 derniers jours', 'Plus ancien']

function salutation() {
  const h = new Date().getHours()
  return h >= 18 || h < 5 ? 'Bonsoir' : 'Bonjour'
}

export default function Assistant() {
  const [message, setMessage] = useState('')
  const [messages, setMessagesState] = useState([])
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState(null)
  const [pdfJoint, setPdfJoint] = useState(null)
  const [lecturePdf, setLecturePdf] = useState(false)
  const [dernierPdf, setDernierPdf] = useState(null)
  const [creationEnCours, setCreationEnCours] = useState(false)
  const [examenCree, setExamenCree] = useState(null)
  const [sidebarOuverte, setSidebarOuverte] = useState(false)
  const [sidebarMobile, setSidebarMobile] = useState(false)
  const [historique, setHistorique] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') }
    catch { return [] }
  })
  const [convActive, setConvActiveState] = useState(null)
  const [rechercheConv, setRechercheConv] = useState('')
  const [focusRecherche] = useState(0)
  const [copie, setCopie] = useState(null)

  const [langueVocale, setLangueVocale] = useState(() => {
    try { return localStorage.getItem(STORAGE_LANGUE_VOCALE) || 'fr-FR' }
    catch { return 'fr-FR' }
  })
  const [modeVocal, setModeVocal] = useState(false)
  const [vocalReduit, setVocalReduit] = useState(false)
  const [dictee, setDictee] = useState(false)
  const [reflexionVocale, setReflexionVocale] = useState(false)
  const [pauseVocale, setPauseVocale] = useState(false)
  const [actionProposee, setActionProposee] = useState(null)

  const finDuFilRef = useRef(null)
  const filRef = useRef(null)
  const contenuFilRef = useRef(null)
  const enBasRef = useRef(true)
  const inputRef = useRef(null)
  const fichierRef = useRef(null)
  const [afficherBas, setAfficherBas] = useState(false)
  const [indexAnime, setIndexAnime] = useState(null)

  const messagesRef = useRef([])
  const convActiveRef = useRef(null)
  const modeVocalRef = useRef(false)
  const dicteeRef = useRef(false)
  const baseDicteeRef = useRef('')
  const actionEnAttenteRef = useRef(null)

  const setMessages = useCallback((m) => { messagesRef.current = m; setMessagesState(m) }, [])
  const setConvActive = useCallback((id) => { convActiveRef.current = id; setConvActiveState(id) }, [])

  const ar = langueVocale.startsWith('ar')
  const dire = (fr, arabe) => (ar ? arabe : fr)

  const tts = useTTS({ syntheseServeur })
  const asr = useASR({
    langue: langueVocale,
    transcrireServeur,
    onErreur: (msg) => setErreur(msg),
    onFin: (texte) => {
      if (dicteeRef.current) {
        dicteeRef.current = false
        setDictee(false)
        const final = [baseDicteeRef.current, texte].filter(Boolean).join(' ')
        setMessage(final)
        inputRef.current?.focus()
        return
      }
      if (modeVocalRef.current) traiterEnonceVocal(texte)
    },
  })

  const ttsRef = useRef(tts)
  const asrRef = useRef(asr)
  ttsRef.current = tts
  asrRef.current = asr
  useEffect(() => () => {
    modeVocalRef.current = false
    try { asrRef.current.annuler() } catch {  }
    try { ttsRef.current.arreter() } catch {  }
  }, [])

  
  function allerEnBas(doux = true) {
    const el = filRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: doux ? 'smooth' : 'auto' })
  }

  function surDefilement() {
    const el = filRef.current
    if (!el) return
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight
    enBasRef.current = distance < 140
    setAfficherBas(distance > 320)
  }

  useEffect(() => {
    if (!messages.length) return
    const dernier = messages[messages.length - 1]
    if (dernier?.role === 'user') enBasRef.current = true
    if (enBasRef.current) allerEnBas()
  }, [messages, envoi])

  useEffect(() => {
    const cible = contenuFilRef.current
    if (!cible || typeof ResizeObserver === 'undefined') return
    const obs = new ResizeObserver(() => { if (enBasRef.current) allerEnBas(false) })
    obs.observe(cible)
    return () => obs.disconnect()
  }, [messages.length > 0])

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(historique)) }
    catch {  }
  }, [historique])

  useEffect(() => {
    try { localStorage.setItem(STORAGE_LANGUE_VOCALE, langueVocale) }
    catch {  }
  }, [langueVocale])

  useEffect(() => {
    if (dictee && asr.transcription) {
      setMessage([baseDicteeRef.current, asr.transcription].filter(Boolean).join(' '))
    }
  }, [dictee, asr.transcription])

  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`
  }, [message])

  useEffect(() => {
    function onKey(e) {
      const cible = e.target
      const dansChamp = cible && (cible.tagName === 'TEXTAREA' || cible.tagName === 'INPUT' || cible.isContentEditable)
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault()
        setSidebarOuverte((v) => !v)
      }
      if (e.key === 'Escape') {
        if (sidebarMobile) setSidebarMobile(false)
        else if (modeVocalRef.current) quitterModeVocal()
        else if (tts.enLecture) tts.arreter()
        else setErreur(null)
      }
      if (modeVocalRef.current && e.code === 'Space' && !dansChamp && !e.repeat) {
        e.preventDefault()
        if (asr.ecoute) asr.arreter()
        else if (!reflexionVocale && !envoi && !asr.transcriptionServeur) ecouter()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  
  function persister(messagesFinal, titreDepuis) {
    const id = convActiveRef.current
    const maintenant = new Date().toISOString()
    if (id) {
      setHistorique((h) => {
        const conv = h.find((c) => c.id === id)
        if (!conv) return h
        return [{ ...conv, messages: messagesFinal, date: maintenant }, ...h.filter((c) => c.id !== id)]
      })
    } else {
      const conv = {
        id: Date.now(),
        titre: (titreDepuis || '').slice(0, 48) || 'Nouvelle conversation',
        date: maintenant,
        messages: messagesFinal,
      }
      setHistorique((h) => [conv, ...h])
      setConvActive(conv.id)
    }
  }

  
  function ajouterEchangeLocal(texteUser, texteAssistant) {
    const final = [
      ...messagesRef.current,
      { role: 'user', contenu: texteUser, vocal: true, fichiers: [] },
      { role: 'assistant', contenu: texteAssistant },
    ]
    setMessages(final)
    persister(final, texteUser)
  }

  
  async function envoyer(texteBrut, historiqueDepart, { vocal = false } = {}) {
    const texte = (texteBrut || '').trim()
    if (!texte || envoi || lecturePdf) return null

    const messagesDepart = historiqueDepart ?? messagesRef.current
    const pdfPourEnvoi = pdfJoint
    if (pdfPourEnvoi) setDernierPdf(pdfPourEnvoi)
    const historique_ = messagesDepart.map((m) => ({ role: m.role, contenu: m.contenu }))

    const nouveauMsg = {
      role: 'user',
      contenu: texte,
      vocal,
      fichiers: pdfPourEnvoi
        ? [{ nom: pdfPourEnvoi.nom, taille: pdfPourEnvoi.taille, type: 'application/pdf' }]
        : [],
    }
    const messagesAvecQuestion = [...messagesDepart, nouveauMsg]

    setMessages(messagesAvecQuestion)
    setMessage('')
    setPdfJoint(null)
    setErreur(null)
    setEnvoi(true)

    try {
      const { reponse } = await api.chatAssistant({
        message: texte,
        historique: historique_,
        pdf_base64: pdfPourEnvoi?.base64 || null,
        nom_fichier_pdf: pdfPourEnvoi?.nom || null,
        mode_vocal: vocal,
      })

      const messagesFinal = [...messagesAvecQuestion, { role: 'assistant', contenu: reponse }]
      setIndexAnime(messagesFinal.length - 1)
      setMessages(messagesFinal)
      persister(messagesFinal, texte)
      return reponse
    } catch (e) {
      setErreur(e.message || "Une erreur est survenue, l'assistant n'a pas pu répondre.")
      return null
    } finally {
      setEnvoi(false)
      if (!modeVocalRef.current) inputRef.current?.focus()
    }
  }

  function handleSend(e) {
    e?.preventDefault()
    if (dicteeRef.current) annulerDictee()
    if (modeVocalRef.current) {
      asr.annuler()
      tts.arreter()
      const t = message
      setMessage('')
      traiterEnonceVocal(t)
      return
    }
    envoyer(message)
  }

  function nouvelleConversation() {
    setIndexAnime(null)
    setMessages([])
    setErreur(null)
    setMessage('')
    setPdfJoint(null)
    setDernierPdf(null)
    setExamenCree(null)
    setConvActive(null)
    setActionProposee(null)
    setSidebarMobile(false)
    actionEnAttenteRef.current = null
    tts.arreter()
    if (!modeVocalRef.current) inputRef.current?.focus()
  }

  function chargerConversation(conv) {
    tts.arreter()
    setIndexAnime(null)
    enBasRef.current = true
    setMessages(conv.messages || [])
    setConvActive(conv.id)
    setErreur(null)
    setPdfJoint(null)
    setDernierPdf(null)
    setExamenCree(null)
    setActionProposee(null)
    setSidebarMobile(false)
    actionEnAttenteRef.current = null
  }

  function supprimerConversation(id, e) {
    e?.stopPropagation()
    setHistorique((h) => h.filter((c) => c.id !== id))
    if (convActiveRef.current === id) nouvelleConversation()
  }

  async function handlePdfSelectionne(e) {
    const fichier = e.target.files?.[0]
    e.target.value = ''
    if (!fichier) return

    const estPdf = fichier.type === 'application/pdf' || fichier.name.toLowerCase().endsWith('.pdf')
    if (!estPdf) {
      setErreur('Seuls les fichiers PDF sont pris en charge pour le moment.')
      return
    }
    if (fichier.size > MAX_TAILLE_PDF_OCTETS) {
      setErreur('Ce PDF est trop volumineux (15 Mo maximum).')
      return
    }

    setErreur(null)
    setLecturePdf(true)
    try {
      const base64 = await lireFichierEnBase64(fichier)
      setPdfJoint({ nom: fichier.name, taille: fichier.size, base64 })
    } catch {
      setErreur('Impossible de lire ce fichier PDF, réessayez.')
    } finally {
      setLecturePdf(false)
    }
  }

  function retirerPdf() {
    setPdfJoint(null)
  }

  async function creerExamenDepuisPdf() {
    const pdf = dernierPdf || pdfJoint
    if (!pdf || creationEnCours) return null
    setCreationEnCours(true)
    setErreur(null)
    try {
      const examen = await api.createExamenDepuisPdf({
        pdf_base64: pdf.base64,
        nom_fichier: pdf.nom,
      })
      const cree = { id: examen.id, titre: examen.titre, matiere: examen.matiere, niveau: examen.niveau }
      setExamenCree(cree)
      return cree
    } catch (e) {
      setErreur(e.message || "Impossible de créer l'examen depuis ce PDF.")
      return null
    } finally {
      setCreationEnCours(false)
    }
  }

  
  function toggleDictee() {
    if (dicteeRef.current) { asr.arreter(); return }
    if (modeVocalRef.current) return
    tts.arreter()
    baseDicteeRef.current = message.trim()
    dicteeRef.current = true
    setDictee(true)
    asr.demarrer()
  }

  function annulerDictee() {
    dicteeRef.current = false
    setDictee(false)
    asr.annuler()
  }

  
  function entrerModeVocal() {
    if (!asr.disponible) {
      setErreur("La reconnaissance vocale n'est pas disponible sur ce navigateur. Essayez Chrome ou Edge.")
      return
    }
    if (dicteeRef.current) annulerDictee()
    tts.arreter()
    setErreur(null)
    modeVocalRef.current = true
    setModeVocal(true)
    setVocalReduit(false)
    setPauseVocale(false)
    parlerPuisEcouter(dire('Je vous écoute.', 'تفضّل، أنا أستمع إليك.'))
  }

  function quitterModeVocal() {
    modeVocalRef.current = false
    setModeVocal(false)
    setReflexionVocale(false)
    setPauseVocale(false)
    actionEnAttenteRef.current = null
    asr.annuler()
    tts.arreter()
  }

  function ecouter() {
    if (!modeVocalRef.current) return
    tts.arreter()
    setPauseVocale(false)
    asr.demarrer()
  }

  async function parlerPuisEcouter(texte, id = 'vocal') {
    if (!modeVocalRef.current) return
    setPauseVocale(false)
    try {
      await tts.parler(texteALire(texte), id)
    } catch (e) {
      setErreur(e.message)
    }
    if (!modeVocalRef.current) return
    asr.demarrer()
  }

  function proposerAction(action, texteUser, phrase) {
    actionEnAttenteRef.current = action
    setActionProposee(action)
    ajouterEchangeLocal(texteUser, phrase)
    return parlerPuisEcouter(phrase)
  }

  async function executerAction(action) {
    actionEnAttenteRef.current = null
    setActionProposee(null)

    if (action.type === 'creer_examen') {
      const q = new URLSearchParams()
      const p = action.parametres || {}
      if (p.matiere) q.set('matiere', p.matiere)
      if (p.niveau) q.set('niveau', String(p.niveau))
      if (p.nb_questions) q.set('nb_questions', String(p.nb_questions))
      if (p.types?.length) q.set('types', p.types.join(','))
      q.set('source', 'assistant_vocal')
      if (modeVocalRef.current) {
        await tts.parler(dire("J'ouvre le générateur.", 'سأفتح لك مولّد الامتحانات.')).catch(() => {})
      }
      quitterModeVocal()
      window.location.assign(`${ROUTE_GENERATEUR}?${q.toString()}`)
      return
    }

    if (action.type === 'creer_examen_pdf') {
      if (modeVocalRef.current) {
        setReflexionVocale(true)
        tts.parler(dire('Je crée l’examen, un instant.', 'جارٍ إنشاء الامتحان، لحظة من فضلك.')).catch(() => {})
      }
      const cree = await creerExamenDepuisPdf()
      setReflexionVocale(false)
      if (!modeVocalRef.current) return
      const phrase = cree
        ? dire(
          `C'est fait : l'examen « ${cree.titre} » est enregistré dans Mes examens.`,
          `تمّ إنشاء الامتحان «${cree.titre}». تجده في قائمة امتحاناتي.`,
        )
        : dire("Désolé, je n'ai pas pu créer l'examen depuis ce PDF.", 'عذرًا، لم أتمكن من إنشاء الامتحان من هذا الملف.')
      ajouterEchangeLocal(dire('Oui, crée l’examen.', 'نعم، أنشئ الامتحان.'), phrase)
      await parlerPuisEcouter(phrase)
      return
    }

    if (action.type === 'ouvrir_mes_examens') {
      quitterModeVocal()
      window.location.assign(ROUTE_MES_EXAMENS)
    }
  }

  function annulerAction() {
    actionEnAttenteRef.current = null
    setActionProposee(null)
  }

  async function analyserIntention(texte) {
    if (!api.sluAssistant) return null
    try { return await api.sluAssistant({ texte }) }
    catch { return null }
  }

  async function demanderOuConfirmerExamen(parametres, texteUser) {
    const manque = manquants(parametres)
    if (manque.length) {
      const question = manque.length === 2
        ? dire("D'accord, pour quelle matière et quelle année ?", 'حسنًا، لأيّ مادة ولأيّ سنة؟')
        : manque[0] === 'matiere'
          ? dire(`Pour la ${parametres.niveau}e année, dans quelle matière ?`, `للسنة ${parametres.niveau}، في أيّ مادة؟`)
          : dire(`En ${libelleMatiere(parametres.matiere)}, pour quelle année ?`, `في ${libelleMatiere(parametres.matiere)}، لأيّ سنة؟`)
      return proposerAction({ type: 'creer_examen', parametres, incomplet: true }, texteUser, question)
    }
    const resume = resumerParametres(parametres, ar)
    return proposerAction(
      { type: 'creer_examen', parametres, resume },
      texteUser,
      dire(
        `J'ai compris : un examen de ${resume}. J'ouvre le générateur avec ces paramètres ? Dites oui ou non.`,
        `فهمت: امتحان ${resume}. هل أفتح المولّد بهذه الإعدادات؟ قل نعم أو لا.`,
      ),
    )
  }

  async function traiterEnonceVocal(texteBrut) {
    const texte = (texteBrut || '').trim()
    if (!modeVocalRef.current) return
    if (!texte) { setPauseVocale(true); return }

    const cmd = commandeLocale(texte)
    const enAttente = actionEnAttenteRef.current

    if (cmd === 'stop') {
      tts.parler(dire('À bientôt !', 'إلى اللقاء!')).catch(() => {})
      modeVocalRef.current = false
      setModeVocal(false)
      actionEnAttenteRef.current = null
      return
    }
    if (cmd === 'repeter') {
      const dernier = [...messagesRef.current].reverse().find((m) => m.role === 'assistant')
      return parlerPuisEcouter(dernier?.contenu || dire("Je n'ai encore rien dit.", 'لم أقل شيئًا بعد.'))
    }
    if (cmd === 'nouvelle') {
      nouvelleConversation()
      return parlerPuisEcouter(dire('Nouvelle conversation. Je vous écoute.', 'محادثة جديدة. أنا أستمع إليك.'))
    }

    if (enAttente) {
      if (cmd === 'non') {
        annulerAction()
        ajouterEchangeLocal(texte, dire("D'accord, j'annule.", 'حسنًا، تمّ الإلغاء.'))
        return parlerPuisEcouter(dire("D'accord, j'annule. Autre chose ?", 'حسنًا، تمّ الإلغاء. هل من شيء آخر؟'))
      }
      if (cmd === 'oui' && !enAttente.incomplet) {
        ajouterEchangeLocal(texte, dire('Très bien.', 'حسنًا.'))
        return executerAction(enAttente)
      }
      if (enAttente.type === 'creer_examen' && enAttente.incomplet) {
        setReflexionVocale(true)
        const slu = await analyserIntention(texte)
        setReflexionVocale(false)
        if (!modeVocalRef.current) return
        const fusion = { ...enAttente.parametres, ...(slu?.parametres || {}) }
        if (manquants(fusion).length < manquants(enAttente.parametres).length) {
          return demanderOuConfirmerExamen(fusion, texte)
        }
      }
      annulerAction()
    }

    setReflexionVocale(true)
    const slu = await analyserIntention(texte)
    setReflexionVocale(false)
    if (!modeVocalRef.current) return

    if (slu && slu.confiance >= SEUIL_CONFIANCE_SLU) {
      if (slu.intention === 'creer_examen') {
        return demanderOuConfirmerExamen(slu.parametres || {}, texte)
      }
      if (slu.intention === 'creer_examen_pdf') {
        if (!dernierPdf && !pdfJoint) {
          const phrase = dire(
            "Joignez d'abord votre PDF avec le trombone, puis redemandez-moi.",
            'أرفق ملف PDF أولًا بزرّ المشبك، ثم اطلب مني ذلك من جديد.',
          )
          ajouterEchangeLocal(texte, phrase)
          return parlerPuisEcouter(phrase)
        }
        const nom = (dernierPdf || pdfJoint).nom
        return proposerAction(
          { type: 'creer_examen_pdf', resume: nom },
          texte,
          dire(`Je crée un examen à partir de « ${nom} » ? Dites oui ou non.`, `هل أنشئ امتحانًا من الملف «${nom}»؟ قل نعم أو لا.`),
        )
      }
      if (slu.intention === 'ouvrir_mes_examens') {
        ajouterEchangeLocal(texte, dire("J'ouvre vos examens.", 'سأفتح امتحاناتك.'))
        await tts.parler(dire("J'ouvre vos examens.", 'سأفتح امتحاناتك.')).catch(() => {})
        return executerAction({ type: 'ouvrir_mes_examens' })
      }
    }

    const reponse = await envoyer(texte, undefined, { vocal: true })
    if (!modeVocalRef.current) return
    if (reponse) await parlerPuisEcouter(reponse, `msg-${messagesRef.current.length - 1}`)
    else setPauseVocale(true)
  }

  
  function lireMessage(contenu, index) {
    const id = `msg-${index}`
    if (tts.idEnCours === id) { tts.arreter(); return }
    tts.parler(texteALire(contenu), id).catch((e) => setErreur(e.message))
  }

  function copierMessage(contenu, index) {
    navigator.clipboard?.writeText(contenu)
    setCopie(index)
    setTimeout(() => setCopie(null), 1600)
  }

  function regenerer() {
    const dernierUser = [...messages].reverse().find((m) => m.role === 'user')
    if (!dernierUser) return
    const idx = messages.findIndex((m) => m === dernierUser)
    const messagesTronques = messages.slice(0, idx)
    setMessages(messagesTronques)
    envoyer(dernierUser.contenu, messagesTronques, { vocal: !!dernierUser.vocal })
  }

  const phaseVocale = !modeVocal ? null
    : asr.ecoute ? 'ecoute'
      : asr.transcriptionServeur ? 'transcription'
        : reflexionVocale || envoi || creationEnCours ? 'reflexion'
          : tts.chargement || tts.enLecture ? 'parole'
            : pauseVocale ? 'pause'
              : 'attente'

  const conversationDemarree = messages.length > 0
  const historiqueFiltre = rechercheConv
    ? historique.filter((c) => {
      const q = rechercheConv.toLowerCase()
      return c.titre.toLowerCase().includes(q)
        || (c.messages || []).some((m) => String(m.contenu || '').toLowerCase().includes(q))
    })
    : historique
  const derniereReponse = [...messages].reverse().find((m) => m.role === 'assistant')?.contenu || ''
  const dernierUser = [...messages].reverse().find((m) => m.role === 'user')?.contenu || ''

  const propsSidebar = {
    historique,
    historiqueFiltre,
    convActive,
    rechercheConv,
    setRechercheConv,
    onNouvelle: nouvelleConversation,
    onCharger: chargerConversation,
    onSupprimer: supprimerConversation,
    onRenommer: (id, titre) => setHistorique((h) => h.map((c) => (c.id === id ? { ...c, titre } : c))),
    onEpingler: (id) => setHistorique((h) => h.map((c) => (c.id === id ? { ...c, epinglee: !c.epinglee } : c))),
    onToutEffacer: () => { setHistorique([]); nouvelleConversation() },
  }

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-white text-[#1a1a1a]">
      <style>{STYLES}</style>

      <TopNav />

      <div className="relative flex flex-1 overflow-hidden">

        {}
        <aside
          className={`relative hidden shrink-0 overflow-hidden border-r border-[#1a1a1a]/10 bg-[#f7f7f7] transition-[width] duration-300 ease-[cubic-bezier(.22,1,.36,1)] motion-reduce:transition-none md:block ${
            sidebarOuverte ? 'w-[284px]' : 'w-0 border-r-0'
          }`}
        >
          {}
          <div
            aria-hidden={!sidebarOuverte}
            className={`absolute inset-y-0 left-0 flex w-[284px] flex-col transition-opacity duration-200 ${sidebarOuverte ? 'opacity-100 delay-100' : 'invisible opacity-0'}`}
          >
            <Sidebar {...propsSidebar} focusRecherche={focusRecherche} onFermer={() => setSidebarOuverte(false)} />
          </div>
        </aside>

        {}
        {sidebarMobile && (
          <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Conversations">
            <button
              className="absolute inset-0 bg-[#1a1a1a]/30 backdrop-blur-[2px]"
              onClick={() => setSidebarMobile(false)}
              aria-label="Fermer"
            />
            <aside className="examai-slide-left relative flex h-full w-[86%] max-w-[300px] flex-col bg-[#f7f7f7] shadow-2xl">
              <Sidebar {...propsSidebar} onFermer={() => setSidebarMobile(false)} />
            </aside>
          </div>
        )}

        {}
        <main className="relative flex flex-1 flex-col overflow-hidden">

          {}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between p-3 sm:p-4">
            <div className="pointer-events-auto flex items-center gap-1">
              <BoutonFlottant onClick={() => setSidebarMobile(true)} titre="Ouvrir les conversations" className="md:hidden">
                <Menu size={17} />
              </BoutonFlottant>
              <BoutonFlottant
                onClick={() => setSidebarOuverte(true)}
                titre="Ouvrir les conversations (Ctrl+B)"
                className={`hidden transition-opacity duration-200 md:flex ${sidebarOuverte ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
              >
                <ChevronRight size={16} />
              </BoutonFlottant>
            </div>
            {conversationDemarree && (
              <div className="pointer-events-auto flex items-center gap-1">
                <BoutonFlottant onClick={regenerer} disabled={envoi} titre="Régénérer la dernière réponse">
                  <RotateCcw size={15} />
                </BoutonFlottant>
                <BoutonFlottant onClick={nouvelleConversation} titre="Nouvelle conversation">
                  <Plus size={17} />
                </BoutonFlottant>
              </div>
            )}
          </div>

          {}
          <div ref={filRef} onScroll={surDefilement} className="examai-scroll relative flex-1 overflow-y-auto">
            {!conversationDemarree ? (
              <WelcomeScreen
                onSuggestion={(t) => (modeVocal ? traiterEnonceVocal(t) : envoyer(t))}
                onModeVocal={entrerModeVocal}
                disabled={envoi}
                modeVocal={modeVocal}
              />
            ) : (
              <div ref={contenuFilRef} className="mx-auto max-w-3xl space-y-7 px-4 pb-6 pt-16 sm:px-6 sm:pb-10 sm:pt-16">
                {messages.map((m, i) => (
                  <MessageBubble
                    key={i}
                    role={m.role}
                    contenu={m.contenu}
                    anime={indexAnime === i}
                    onFinAnimation={() => setIndexAnime((x) => (x === i ? null : x))}
                    fichiers={m.fichiers}
                    vocal={m.vocal}
                    enLecture={tts.idEnCours === `msg-${i}`}
                    onLire={() => lireMessage(m.contenu, i)}
                    copie={copie === i}
                    onCopier={() => copierMessage(m.contenu, i)}
                    onSuggestion={(t) => (modeVocal ? traiterEnonceVocal(t) : envoyer(t))}
                    disabled={envoi || modeVocal}
                    estDernier={i === messages.length - 1}
                  />
                ))}
                {envoi && <TypingIndicator />}
                <div ref={finDuFilRef} className="h-2" />
              </div>
            )}
          </div>

          {}
          <div className="relative shrink-0 bg-white px-3 pb-3 pt-2 sm:px-6 sm:pb-4">
            {}
            <button
              onClick={() => { enBasRef.current = true; allerEnBas() }}
              aria-label="Revenir au dernier message"
              tabIndex={afficherBas ? 0 : -1}
              className={`absolute -top-12 left-1/2 z-10 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full bg-white text-[#1a1a1a]/70 shadow-[0_8px_20px_-8px_rgba(26,26,26,0.35)] ring-1 ring-[#1a1a1a]/10 transition-all duration-200 hover:text-[#1a1a1a] ${FOCUS_RING} ${
                afficherBas ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0'
              }`}
            >
              <ArrowDown size={16} />
            </button>
            <div className="mx-auto max-w-3xl space-y-2">
              {erreur && (
                <BandeauErreur message={erreur} onFermer={() => setErreur(null)} />
              )}

              {modeVocal && vocalReduit && (
                <BarreVocale
                  phase={phaseVocale}
                  niveau={asr.niveau}
                  transcription={asr.transcription}
                  ar={ar}
                  onEcouter={ecouter}
                  onTerminerEcoute={asr.arreter}
                  onInterrompre={() => tts.arreter()}
                  onAgrandir={() => setVocalReduit(false)}
                  onQuitter={quitterModeVocal}
                />
              )}

              {actionProposee && !actionProposee.incomplet && (!modeVocal || vocalReduit) && (
                <CarteAction
                  action={actionProposee}
                  onConfirmer={() => executerAction(actionProposee)}
                  onAnnuler={annulerAction}
                  enCours={creationEnCours}
                />
              )}

              {examenCree && (
                <div className="examai-fade-up flex items-center justify-between gap-2 rounded-[14px] border border-emerald-500/25 bg-emerald-50 px-3.5 py-2.5 text-[12px] font-medium text-emerald-800">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                      <Check size={12} strokeWidth={3} />
                    </span>
                    <span className="truncate">
                      Examen créé : « {examenCree.titre} » ({libelleMatiere(examenCree.matiere)}
                      {' · Niveau '}{examenCree.niveau}) — retrouvez-le dans « Mes examens ».
                    </span>
                  </span>
                  <button
                    onClick={() => setExamenCree(null)}
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-emerald-700/60 hover:bg-emerald-500/10 ${FOCUS_RING}`}
                    aria-label="Fermer"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}

              {dernierPdf && !examenCree && (
                <div className="examai-fade-up flex items-center justify-between gap-2 rounded-[14px] border border-[#1a1a1a]/10 bg-white px-3 py-2 shadow-[0_1px_2px_rgba(26,26,26,0.04)]">
                  <span className="flex min-w-0 items-center gap-2 text-[12px] font-medium text-[#1a1a1a]/75">
                    <IconePdf />
                    <span className="truncate">{dernierPdf.nom}</span>
                  </span>
                  <button
                    onClick={creerExamenDepuisPdf}
                    disabled={creationEnCours}
                    className={`flex shrink-0 items-center gap-1.5 rounded-full bg-[#7a0008] px-3.5 py-1.5 text-[11.5px] font-semibold text-white transition-all hover:bg-[#961014] disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
                  >
                    {creationEnCours ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
                    {creationEnCours ? 'Création…' : 'Créer un examen depuis ce PDF'}
                  </button>
                </div>
              )}

              <form
                onSubmit={handleSend}
                className="rounded-[22px] border border-[#1a1a1a]/[0.12] bg-white shadow-[0_1px_2px_rgba(26,26,26,0.04),0_16px_36px_-20px_rgba(26,26,26,0.35)] transition-all focus-within:border-[#1a1a1a]/30 focus-within:shadow-[0_0_0_4px_rgba(26,26,26,0.06),0_16px_36px_-20px_rgba(26,26,26,0.35)]"
              >
                {(pdfJoint || lecturePdf) && (
                  <div className="flex flex-wrap gap-2 px-3 pt-3">
                    {pdfJoint && (
                      <div className="examai-fade-up flex items-center gap-2.5 rounded-[12px] border border-[#1a1a1a]/10 bg-[#f7f7f7] py-1.5 pl-1.5 pr-2">
                        <IconePdf grand />
                        <div className="min-w-0">
                          <p className="max-w-[220px] truncate text-[12px] font-semibold text-[#1a1a1a]">{pdfJoint.nom}</p>
                          <p className="text-[10.5px] text-[#1a1a1a]/45">PDF · {formatTaille(pdfJoint.taille)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={retirerPdf}
                          className={`ml-1 flex h-6 w-6 items-center justify-center rounded-full text-[#1a1a1a]/45 transition-colors hover:bg-[#1a1a1a]/[0.08] hover:text-[#1a1a1a] ${FOCUS_RING}`}
                          aria-label="Retirer le PDF"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    )}
                    {lecturePdf && (
                      <div className="flex items-center gap-1.5 px-1 py-2 text-[11.5px] font-medium text-[#1a1a1a]/50">
                        <Loader2 size={12} className="animate-spin" />
                        Lecture du PDF…
                      </div>
                    )}
                  </div>
                )}

                <textarea
                  ref={inputRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault()
                      handleSend()
                    }
                  }}
                  placeholder={
                    dictee ? (ar ? 'تكلّم، أنا أستمع...' : 'Parlez, je vous écoute…')
                      : modeVocal ? 'Parlez, ou écrivez ici…'
                        : 'Posez votre question à ClassAssistant…'
                  }
                  dir="auto"
                  disabled={envoi}
                  rows={1}
                  aria-label="Votre message"
                  className="block max-h-[180px] w-full resize-none bg-transparent px-4 pb-1 pt-3.5 text-[14px] leading-relaxed text-[#1a1a1a] outline-none placeholder:text-[#1a1a1a]/40 disabled:opacity-60"
                />

                <div className="flex items-center justify-between gap-2 px-2 pb-2">
                  <div className="flex items-center gap-0.5">
                    <input
                      ref={fichierRef}
                      type="file"
                      accept="application/pdf,.pdf"
                      className="hidden"
                      onChange={handlePdfSelectionne}
                    />
                    <BoutonOutil
                      onClick={() => fichierRef.current?.click()}
                      disabled={!!pdfJoint || lecturePdf}
                      titre="Joindre un PDF (programme, fiche de cours…)"
                    >
                      {lecturePdf ? <Loader2 size={16} className="animate-spin" /> : <Paperclip size={16} />}
                      <span className="hidden sm:inline">PDF</span>
                    </BoutonOutil>
                    <BoutonOutil
                      onClick={toggleDictee}
                      disabled={modeVocal || asr.transcriptionServeur}
                      actif={dictee}
                      titre={dictee ? 'Terminer la dictée' : 'Dicter le message'}
                    >
                      {asr.transcriptionServeur && !modeVocal
                        ? <Loader2 size={16} className="animate-spin" />
                        : dictee ? <Square size={13} /> : <Mic size={16} />}
                      <span className="hidden sm:inline">{dictee ? 'Terminer' : 'Dicter'}</span>
                    </BoutonOutil>
                    {dictee && (
                      <span className="ml-1 flex items-center gap-1.5 text-[11px] font-medium text-[#7a0008]">
                        <NiveauMicro niveau={asr.niveau} /> {ar ? 'أستمع…' : 'Écoute…'}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <SelecteurLangue langue={langueVocale} onChange={setLangueVocale} disabled={asr.ecoute} compact />
                    <button
                      type="button"
                      onClick={modeVocal ? quitterModeVocal : entrerModeVocal}
                      className={`flex h-9 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold transition-all ${FOCUS_RING} ${
                        modeVocal
                          ? 'bg-[#1a1a1a] text-white hover:bg-[#2b2b2b]'
                          : 'bg-[#7a0008]/[0.07] text-[#7a0008] hover:bg-[#7a0008]/[0.13]'
                      }`}
                      title={modeVocal ? 'Quitter le mode vocal (Échap)' : 'Conversation vocale mains libres'}
                      aria-pressed={modeVocal}
                    >
                      <AudioLines size={15} />
                      <span className="hidden sm:inline">{modeVocal ? 'Quitter' : 'Mode vocal'}</span>
                    </button>
                    <button
                      type="submit"
                      disabled={envoi || !message.trim() || lecturePdf}
                      aria-label="Envoyer"
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#7a0008] text-white shadow-[0_6px_14px_-6px_rgba(122,0,8,0.7)] transition-all hover:bg-[#961014] active:scale-95 disabled:cursor-not-allowed disabled:bg-[#1a1a1a]/15 disabled:shadow-none ${FOCUS_RING}`}
                    >
                      {envoi ? <Loader2 size={16} className="animate-spin" /> : <ArrowUp size={17} strokeWidth={2.4} />}
                    </button>
                  </div>
                </div>
              </form>

              <p className="text-center text-[10.5px] text-[#1a1a1a]/40">
                L'assistant peut se tromper. Vérifiez les informations importantes.
              </p>
            </div>
          </div>

          {}
          {modeVocal && !vocalReduit && (
            <SceneVocale
              phase={phaseVocale}
              niveau={asr.niveau}
              transcription={asr.transcription}
              moteur={asr.moteur}
              ar={ar}
              langue={langueVocale}
              onLangue={setLangueVocale}
              derniereQuestion={dernierUser}
              derniereReponse={texteALire(derniereReponse)}
              erreur={erreur}
              action={actionProposee && !actionProposee.incomplet ? actionProposee : null}
              enCours={creationEnCours}
              onConfirmer={() => actionProposee && executerAction(actionProposee)}
              onAnnuler={annulerAction}
              onEcouter={ecouter}
              onTerminerEcoute={asr.arreter}
              onInterrompre={() => tts.arreter()}
              onReduire={() => setVocalReduit(true)}
              onQuitter={quitterModeVocal}
            />
          )}
        </main>
      </div>
    </div>
  )
}




const STYLES = `
  .examai-underline-wave {
    background-color: rgba(122,0,8,0.12);
    background-repeat: no-repeat;
    background-size: 100% 0.35em;
    background-position: 0 88%;
    padding: 0 0.15em;
  }
  @keyframes examaiFadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
  .examai-fade-up { animation: examaiFadeUp .32s cubic-bezier(.22,1,.36,1) both; }
  @keyframes examaiFade { from { opacity: 0; } to { opacity: 1; } }
  .examai-fade { animation: examaiFade .25s ease-out both; }
  @keyframes examaiSlideLeft { from { opacity: 0; transform: translateX(-14px); } to { opacity: 1; transform: none; } }
  .examai-slide-left { animation: examaiSlideLeft .32s cubic-bezier(.22,1,.36,1) both; }

  @keyframes examaiDot { 0%, 20% { opacity: .3; transform: scale(.8); } 50% { opacity: 1; transform: scale(1.1); } 80%, 100% { opacity: .3; transform: scale(.8); } }
  .examai-dot-1 { animation: examaiDot 1.4s ease-in-out infinite; }
  .examai-dot-2 { animation: examaiDot 1.4s ease-in-out .2s infinite; }
  .examai-dot-3 { animation: examaiDot 1.4s ease-in-out .4s infinite; }

  @keyframes examaiPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
  .examai-pulse { animation: examaiPulse 1.6s ease-in-out infinite; }

  .examai-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
  .examai-scroll::-webkit-scrollbar-track { background: transparent; }
  .examai-scroll::-webkit-scrollbar-thumb { background: rgba(26,26,26,0.13); border-radius: 999px; }
  .examai-scroll::-webkit-scrollbar-thumb:hover { background: rgba(26,26,26,0.25); }

  
  .examai-prose { font-size: 14.5px; line-height: 1.75; color: #2b2b2b; }
  .examai-prose > *:first-child { margin-top: 0; }
  .examai-prose > *:last-child  { margin-bottom: 0; }
  .examai-prose p { margin: 0.6em 0; }
  .examai-prose strong { font-weight: 650; color: #1a1a1a; }
  .examai-prose em { font-style: italic; }
  .examai-prose h1, .examai-prose h2, .examai-prose h3, .examai-prose h4 {
    font-weight: 650; color: #1a1a1a; line-height: 1.3; margin: 1.2em 0 0.45em;
  }
  .examai-prose h1 { font-size: 1.22em; }
  .examai-prose h2 { font-size: 1.12em; }
  .examai-prose h3 { font-size: 1.04em; }
  .examai-prose h4 { font-size: 0.98em; }
  .examai-prose ul, .examai-prose ol { margin: 0.55em 0; padding-inline-start: 1.4em; }
  .examai-prose li { margin: 0.3em 0; }
  .examai-prose li::marker { color: rgba(122,0,8,0.7); }
  .examai-prose ul > li { list-style: disc; }
  .examai-prose ol > li { list-style: decimal; }
  .examai-prose li > ul, .examai-prose li > ol { margin: 0.25em 0; }
  .examai-prose a { color: #7a0008; text-decoration: underline; text-underline-offset: 2px; }
  .examai-prose a:hover { color: #961014; }
  .examai-prose code {
    background: rgba(26,26,26,0.06); border: 1px solid rgba(26,26,26,0.08); border-radius: 6px;
    padding: 0.1em 0.38em; font-size: 0.86em; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }
  .examai-prose pre {
    background: #1a1a1a; color: #ececec; border-radius: 12px; padding: 0.9em 1em;
    overflow-x: auto; margin: 0.8em 0; font-size: 0.85em; line-height: 1.55;
  }
  .examai-prose pre code { background: transparent; border: none; padding: 0; color: inherit; font-size: 1em; }
  .examai-prose blockquote {
    border-inline-start: 3px solid rgba(122,0,8,0.45); padding: 0.15em 0.9em; margin: 0.7em 0;
    color: rgba(26,26,26,0.72); font-style: italic;
  }
  .examai-prose hr { border: none; border-top: 1px solid rgba(26,26,26,0.1); margin: 1.1em 0; }
  .examai-prose table {
    border-collapse: separate; border-spacing: 0; width: 100%; margin: 0.8em 0; font-size: 0.92em;
    border: 1px solid rgba(26,26,26,0.12); border-radius: 12px; overflow: hidden;
  }
  .examai-prose { overflow-wrap: anywhere; }
  .examai-prose th, .examai-prose td {
    border-bottom: 1px solid rgba(26,26,26,0.08); padding: 0.5em 0.8em; text-align: start; vertical-align: top;
  }
  .examai-prose tr:last-child td { border-bottom: none; }
  .examai-prose th { background: #f7f7f7; font-weight: 600; }

  
  @keyframes examaiOnde { 0% { transform: scale(1); opacity: .35; } 100% { transform: scale(1.8); opacity: 0; } }
  .examai-onde { animation: examaiOnde 2s cubic-bezier(.22,1,.36,1) infinite; }
  .examai-onde-2 { animation-delay: .65s; }
  .examai-onde-3 { animation-delay: 1.3s; }
  @keyframes examaiBarre { 0%, 100% { transform: scaleY(.3); } 50% { transform: scaleY(1); } }
  .examai-barre { animation: examaiBarre .9s ease-in-out infinite; transform-origin: center; }
  @keyframes examaiRespire { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.04); } }
  .examai-respire { animation: examaiRespire 3.2s ease-in-out infinite; }
  @keyframes examaiTourne { to { transform: rotate(360deg); } }
  .examai-tourne { animation: examaiTourne 1.6s linear infinite; }
  .examai-orbe {
    background:
      radial-gradient(circle at 32% 28%, rgba(255,255,255,0.55), rgba(255,255,255,0) 42%),
      radial-gradient(circle at 70% 78%, #4f0005 0%, rgba(79,0,5,0) 55%),
      radial-gradient(circle at 50% 50%, #a3121c 0%, #7a0008 62%, #5a0006 100%);
    box-shadow: 0 30px 70px -22px rgba(122,0,8,0.65), inset 0 -10px 30px rgba(0,0,0,0.18);
  }
  .examai-anneau {
    background: conic-gradient(from 0deg, rgba(122,0,8,0) 0deg, rgba(122,0,8,0.85) 300deg, rgba(122,0,8,0) 360deg);
    -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3px));
            mask: radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3px));
  }


  
  @keyframes examaiCurseur { 0%, 45% { opacity: 1; } 50%, 100% { opacity: 0; } }
  .examai-ecriture > :is(p, h1, h2, h3, h4):last-child::after,
  .examai-ecriture > :is(ul, ol):last-child > li:last-child::after,
  .examai-ecriture > blockquote:last-child > :last-child::after {
    content: ''; display: inline-block; width: 0.5em; height: 1.05em; margin-inline-start: 2px;
    vertical-align: -0.15em; border-radius: 2px; background: #7a0008;
    animation: examaiCurseur 1s steps(1) infinite;
  }
  @keyframes examaiBrillance { from { background-position: 200% 0; } to { background-position: -200% 0; } }
  .examai-brillance {
    background: linear-gradient(90deg, rgba(26,26,26,0.38) 0%, rgba(26,26,26,0.85) 50%, rgba(26,26,26,0.38) 100%);
    background-size: 200% 100%; -webkit-background-clip: text; background-clip: text; color: transparent;
    animation: examaiBrillance 2.2s linear infinite;
  }
  .examai-message-user { animation: examaiFadeUp .28s cubic-bezier(.22,1,.36,1) both; transform-origin: bottom right; }
  @media (prefers-reduced-motion: reduce) {
    .examai-ecriture :is(p, h1, h2, h3, h4, li)::after, .examai-brillance { animation: none !important; }
  }

  @media (prefers-reduced-motion: reduce) {
    .examai-onde, .examai-barre, .examai-respire, .examai-tourne,
    .examai-fade-up, .examai-fade, .examai-slide-left, .examai-dot-1, .examai-dot-2, .examai-dot-3, .examai-pulse {
      animation: none !important;
    }
  }
`




function BoutonIcone({ onClick, disabled, titre, children, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={titre}
      aria-label={titre}
      className={`flex h-9 w-9 items-center justify-center rounded-full text-[#1a1a1a]/55 transition-colors hover:bg-[#1a1a1a]/[0.06] hover:text-[#1a1a1a] disabled:opacity-35 ${FOCUS_RING} ${className}`}
    >
      {children}
    </button>
  )
}

function BoutonFlottant({ onClick, disabled, titre, children, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={titre}
      aria-label={titre}
      className={`flex h-9 w-9 items-center justify-center rounded-full bg-white/85 text-[#1a1a1a]/60 shadow-[0_4px_14px_-6px_rgba(26,26,26,0.3)] ring-1 ring-[#1a1a1a]/[0.08] backdrop-blur transition-colors hover:bg-white hover:text-[#1a1a1a] disabled:opacity-40 ${FOCUS_RING} ${className}`}
    >
      {children}
    </button>
  )
}

function BoutonOutil({ onClick, disabled, actif = false, titre, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={titre}
      aria-label={titre}
      aria-pressed={actif}
      className={`flex h-9 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium transition-colors disabled:opacity-35 ${FOCUS_RING} ${
        actif
          ? 'bg-[#7a0008] text-white'
          : 'text-[#1a1a1a]/60 hover:bg-[#1a1a1a]/[0.06] hover:text-[#1a1a1a]'
      }`}
    >
      {children}
    </button>
  )
}

function IconePdf({ grand = false }) {
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-[8px] bg-[#7a0008]/[0.09] font-bold text-[#7a0008] ${grand ? 'h-9 w-9 text-[9.5px]' : 'h-6 w-6 text-[8px]'}`}>
      PDF
    </span>
  )
}

function NiveauMicro({ niveau = 0 }) {
  return (
    <span className="flex h-3.5 items-center gap-[2px]" aria-hidden>
      {[0.55, 1, 0.75].map((k, i) => (
        <span
          key={i}
          className="block w-[3px] rounded-full bg-[#7a0008] transition-[height] duration-100"
          style={{ height: `${Math.max(3, Math.min(14, 3 + niveau * 14 * k))}px` }}
        />
      ))}
    </span>
  )
}

function BandeauErreur({ message, onFermer }) {
  return (
    <div role="alert" className="examai-fade-up flex items-start gap-3 rounded-[14px] border border-[#7a0008]/25 bg-[#fff5f5] px-3.5 py-2.5 text-[12.5px] text-[#4f0005]">
      <AlertTriangle size={15} className="mt-0.5 shrink-0 text-[#7a0008]" />
      <span className="min-w-0 flex-1 break-words font-medium">{message}</span>
      <button
        onClick={onFermer}
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[#7a0008]/60 hover:bg-[#7a0008]/10 hover:text-[#7a0008] ${FOCUS_RING}`}
        aria-label="Fermer"
      >
        <X size={12} />
      </button>
    </div>
  )
}


const SUJETS = [
  { cle: /math|calcul|addition|soustraction|multipli|géom|geom|nombre|fraction/i, Icone: Calculator, nom: 'Maths' },
  { cle: /arabe|عرب|قراءة|إملاء/i, Icone: Languages, nom: 'Arabe' },
  { cle: /dictée|dictee|orthograph|conjug|grammaire/i, Icone: PenLine, nom: 'Français' },
  { cle: /fran[cç]ais|lecture|texte|compréhension|comprehension|vocabulaire/i, Icone: BookOpen, nom: 'Lecture' },
  { cle: /science|éveil|eveil|biolog|plante|corps|énergie/i, Icone: FlaskConical, nom: 'Sciences' },
  { cle: /histoire|géo|geo|carte|civique/i, Icone: Globe, nom: 'Histoire-Géo' },
  { cle: /pdf|document|fichier/i, Icone: FileText, nom: 'Document' },
]
function sujetConv(conv) {
  const texte = `${conv.titre} ${(conv.messages || []).slice(0, 2).map((m) => m.contenu).join(' ')}`
  return SUJETS.find((x) => x.cle.test(texte)) || { Icone: MessageSquare, nom: 'Discussion' }
}

function tempsRelatif(iso) {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const s = Math.round((Date.now() - t) / 1000)
  if (s < 60) return "à l'instant"
  if (s < 3600) return `${Math.floor(s / 60)} min`
  if (s < 86400) return `${Math.floor(s / 3600)} h`
  if (s < 172800) return 'hier'
  return new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function apercuConv(conv) {
  const dernier = [...(conv.messages || [])].reverse().find((m) => m.role === 'assistant') || (conv.messages || []).slice(-1)[0]
  const t = texteALire(dernier?.contenu || '')
  return t.length > 70 ? `${t.slice(0, 70)}…` : t
}

function Sidebar({
  historique, historiqueFiltre, convActive, rechercheConv, setRechercheConv,
  onNouvelle, onCharger, onSupprimer, onRenommer, onEpingler, onToutEffacer, onFermer, focusRecherche = 0,
}) {
  const [confirmerToutEffacer, setConfirmerToutEffacer] = useState(false)
  const rechercheRef = useRef(null)
  const listeRef = useRef(null)

  useEffect(() => {
    if (!focusRecherche) return undefined
    const t = setTimeout(() => rechercheRef.current?.focus(), 220)
    return () => clearTimeout(t)
  }, [focusRecherche])

  function naviguerClavier(e) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    const items = [...(listeRef.current?.querySelectorAll('[data-conv]') || [])]
    if (!items.length) return
    e.preventDefault()
    const i = items.indexOf(document.activeElement)
    const suivant = e.key === 'ArrowDown' ? Math.min(items.length - 1, i + 1) : Math.max(0, i - 1)
    items[i === -1 ? 0 : suivant]?.focus()
  }

  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        rechercheRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const epinglees = historiqueFiltre.filter((c) => c.epinglee)
  const autres = historiqueFiltre.filter((c) => !c.epinglee)
  const groupes = [
    ...(epinglees.length ? [{ nom: 'Épinglées', convs: epinglees }] : []),
    ...ORDRE_GROUPES
      .map((g) => ({ nom: g, convs: autres.filter((c) => groupeDate(c.date) === g) }))
      .filter((g) => g.convs.length),
  ]

  return (
    <>
      {}
      <div className="flex h-14 shrink-0 items-center justify-between px-3">
        <div className="flex items-center gap-2 px-1">
          <span className="text-[13.5px] font-bold text-[#1a1a1a]">Conversations</span>
          {historique.length > 0 && (
            <span className="rounded-full bg-[#1a1a1a]/[0.07] px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums text-[#1a1a1a]/55">
              {historique.length}
            </span>
          )}
        </div>
        <button
          onClick={onFermer}
          className={`flex h-8 w-8 items-center justify-center rounded-[9px] text-[#1a1a1a]/45 transition-colors hover:bg-[#1a1a1a]/[0.06] hover:text-[#1a1a1a] ${FOCUS_RING}`}
          aria-label="Fermer la barre latérale"
          title="Fermer (Ctrl+B)"
        >
          <PanelLeftClose size={16} />
        </button>
      </div>

      {}
      <div className="space-y-2 px-3">
        <button
          onClick={onNouvelle}
          className={`group flex w-full items-center gap-2.5 rounded-[12px] bg-[#7a0008] py-2.5 pl-3 pr-2.5 text-[12.5px] font-semibold text-white shadow-[0_8px_18px_-12px_rgba(122,0,8,0.8)] transition-all hover:bg-[#961014] active:scale-[0.98] ${FOCUS_RING}`}
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-[8px] bg-white/15">
            <Plus size={14} strokeWidth={2.6} />
          </span>
          <span className="flex-1 text-left">Nouvelle conversation</span>
        </button>

        <div className="relative">
          <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#1a1a1a]/35" />
          <input
            ref={rechercheRef}
            value={rechercheConv}
            onChange={(e) => setRechercheConv(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { setRechercheConv(''); e.currentTarget.blur() }
              if (e.key === 'ArrowDown') { e.preventDefault(); listeRef.current?.querySelector('[data-conv]')?.focus() }
            }}
            placeholder="Rechercher"
            aria-label="Rechercher une conversation"
            className={`w-full rounded-[10px] border border-[#1a1a1a]/[0.08] bg-white py-2 pl-8 pr-14 text-[12.5px] text-[#1a1a1a] outline-none transition-all placeholder:text-[#1a1a1a]/40 focus:border-[#1a1a1a]/25 ${FOCUS_RING}`}
          />
          {rechercheConv ? (
            <button
              onClick={() => setRechercheConv('')}
              className={`absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-[#1a1a1a]/45 hover:bg-[#1a1a1a]/[0.06] hover:text-[#1a1a1a] ${FOCUS_RING}`}
              aria-label="Effacer la recherche"
            >
              <X size={12} />
            </button>
          ) : (
            <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-[5px] border border-[#1a1a1a]/10 bg-[#f7f7f7] px-1.5 py-0.5 font-sans text-[10px] font-medium text-[#1a1a1a]/40">
              Ctrl K
            </kbd>
          )}
        </div>
      </div>

      {}
      <nav ref={listeRef} onKeyDown={naviguerClavier} className="examai-scroll mt-2 flex-1 overflow-y-auto px-2 pb-3" aria-label="Historique des conversations">
        {groupes.length === 0 ? (
          <div className="mx-1 mt-6 rounded-[14px] border border-dashed border-[#1a1a1a]/15 px-4 py-8 text-center">
            <span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#1a1a1a]/40 shadow-[0_2px_8px_-4px_rgba(26,26,26,0.3)]">
              {historique.length === 0 ? <Inbox size={17} /> : <Search size={16} />}
            </span>
            <p className="text-[12.5px] font-semibold text-[#1a1a1a]/70">
              {historique.length === 0 ? 'Aucune conversation' : 'Aucun résultat'}
            </p>
            <p className="mt-1 text-[11.5px] leading-snug text-[#1a1a1a]/45">
              {historique.length === 0
                ? 'Vos échanges avec l’assistant apparaîtront ici.'
                : `Rien ne correspond à « ${rechercheConv} ».`}
            </p>
          </div>
        ) : (
          groupes.map((g) => (
            <section key={g.nom} className="mt-4 first:mt-2">
              <h3 className="flex items-center gap-1.5 px-3 pb-1.5 text-[10.5px] font-bold uppercase tracking-[0.09em] text-[#1a1a1a]/40">
                {g.nom === 'Épinglées' && <Pin size={10} />}
                {g.nom}
              </h3>
              <ul className="space-y-0.5">
                {g.convs.map((conv, idx) => (
                  <ElementConversation
                    key={conv.id}
                    delai={Math.min(idx, 8) * 30}
                    conv={conv}
                    active={convActive === conv.id}
                    recherche={rechercheConv}
                    onCharger={onCharger}
                    onSupprimer={onSupprimer}
                    onRenommer={onRenommer}
                    onEpingler={onEpingler}
                  />
                ))}
              </ul>
            </section>
          ))
        )}
      </nav>

      {}
      {historique.length > 0 && (
        <div className="shrink-0 border-t border-[#1a1a1a]/[0.07] px-3 py-2.5">
          {confirmerToutEffacer ? (
            <div className="examai-fade flex items-center justify-between gap-2">
              <span className="text-[11.5px] font-medium text-[#1a1a1a]/70">Tout effacer ?</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setConfirmerToutEffacer(false)}
                  className={`rounded-full px-2.5 py-1 text-[11.5px] font-medium text-[#1a1a1a]/60 hover:bg-[#1a1a1a]/[0.06] ${FOCUS_RING}`}
                >
                  Annuler
                </button>
                <button
                  onClick={() => { setConfirmerToutEffacer(false); onToutEffacer() }}
                  className={`rounded-full bg-[#7a0008] px-2.5 py-1 text-[11.5px] font-semibold text-white hover:bg-[#961014] ${FOCUS_RING}`}
                >
                  Effacer
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmerToutEffacer(true)}
              className={`flex w-full items-center gap-2 rounded-[9px] px-2 py-1.5 text-[11.5px] font-medium text-[#1a1a1a]/50 transition-colors hover:bg-[#1a1a1a]/[0.05] hover:text-[#7a0008] ${FOCUS_RING}`}
            >
              <Trash2 size={13} />
              Effacer l’historique
            </button>
          )}
        </div>
      )}
    </>
  )
}

function SurlignerRecherche({ texte, recherche }) {
  if (!recherche) return texte
  const i = texte.toLowerCase().indexOf(recherche.toLowerCase())
  if (i < 0) return texte
  return (
    <>
      {texte.slice(0, i)}
      <mark className="rounded-[3px] bg-[#7a0008]/15 px-0.5 text-inherit">{texte.slice(i, i + recherche.length)}</mark>
      {texte.slice(i + recherche.length)}
    </>
  )
}

function ElementConversation({ conv, active, recherche, onCharger, onSupprimer, onRenommer, onEpingler, delai = 0 }) {
  const [edition, setEdition] = useState(false)
  const [titre, setTitre] = useState(conv.titre)
  const [confirmer, setConfirmer] = useState(false)
  const champRef = useRef(null)

  useEffect(() => { if (edition) { champRef.current?.focus(); champRef.current?.select() } }, [edition])
  useEffect(() => { if (!confirmer) return undefined; const t = setTimeout(() => setConfirmer(false), 3000); return () => clearTimeout(t) }, [confirmer])

  function valider() {
    const t = titre.trim()
    if (t && t !== conv.titre) onRenommer(conv.id, t)
    else setTitre(conv.titre)
    setEdition(false)
  }

  const apercu = apercuConv(conv)
  const { Icone, nom: sujet } = sujetConv(conv)
  const nbMessages = (conv.messages || []).length

  return (
    <li className="examai-fade-up group relative" style={{ animationDelay: `${delai}ms` }}>
      {active && <span className="absolute -left-2 top-3 bottom-3 z-10 w-[3px] rounded-r-full bg-[#7a0008]" />}
      {edition ? (
        <div className="rounded-[11px] bg-white px-2 py-1.5 shadow-[0_2px_10px_-4px_rgba(26,26,26,0.25)] ring-1 ring-[#7a0008]/30">
          <input
            ref={champRef}
            value={titre}
            onChange={(e) => setTitre(e.target.value)}
            onBlur={valider}
            onKeyDown={(e) => {
              if (e.key === 'Enter') valider()
              if (e.key === 'Escape') { setTitre(conv.titre); setEdition(false) }
            }}
            maxLength={60}
            aria-label="Nouveau titre"
            className="w-full bg-transparent px-1 py-1 text-[12.5px] font-semibold text-[#1a1a1a] outline-none"
          />
        </div>
      ) : (
        <button
          onClick={() => onCharger(conv)}
          onDoubleClick={() => setEdition(true)}
          aria-current={active ? 'true' : undefined}
          data-conv
          className={`flex w-full items-start gap-2.5 rounded-[12px] py-2.5 pl-2.5 pr-3 text-left transition-all group-hover:pr-[88px] ${FOCUS_RING} ${
            active
              ? 'bg-white shadow-[0_2px_10px_-4px_rgba(26,26,26,0.22)] ring-1 ring-[#1a1a1a]/[0.06]'
              : 'hover:bg-white/70'
          }`}
        >
          <span
            title={sujet}
            className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] transition-colors ${
              active ? 'bg-[#7a0008] text-white' : 'bg-white text-[#7a0008]/80 ring-1 ring-[#1a1a1a]/[0.06] group-hover:ring-[#7a0008]/20'
            }`}
          >
            <Icone size={15} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-center gap-2">
            <span className={`min-w-0 flex-1 truncate text-[12.5px] ${active ? 'font-bold text-[#7a0008]' : 'font-semibold text-[#1a1a1a]/85'}`}>
              <SurlignerRecherche texte={conv.titre} recherche={recherche} />
            </span>
            <span className="shrink-0 text-[10.5px] tabular-nums text-[#1a1a1a]/35 transition-opacity group-hover:opacity-0">
              {tempsRelatif(conv.date)}
            </span>
          </span>
          <span className="flex items-center gap-1.5 text-[11.5px] leading-snug text-[#1a1a1a]/45">
            <span className="min-w-0 flex-1 truncate">{apercu || 'Conversation vide'}</span>
            {nbMessages > 0 && (
              <span className="shrink-0 rounded-full bg-[#1a1a1a]/[0.06] px-1.5 text-[10px] font-semibold tabular-nums text-[#1a1a1a]/45 transition-opacity group-hover:opacity-0">
                {nbMessages}
              </span>
            )}
          </span>
          </span>
        </button>
      )}

      {}
      {!edition && (
        <div className={`absolute right-1.5 top-1.5 flex items-center gap-0.5 rounded-[9px] bg-white/95 p-0.5 shadow-[0_2px_8px_-3px_rgba(26,26,26,0.25)] ring-1 ring-[#1a1a1a]/[0.06] transition-opacity ${
          confirmer ? 'opacity-100' : 'opacity-0 focus-within:opacity-100 group-hover:opacity-100'
        }`}>
          {confirmer ? (
            <button
              onClick={(e) => onSupprimer(conv.id, e)}
              className={`flex h-6 items-center gap-1 rounded-[7px] bg-[#7a0008] px-2 text-[11px] font-semibold text-white ${FOCUS_RING}`}
            >
              <Trash2 size={11} /> Supprimer ?
            </button>
          ) : (
            <>
              <ActionConv titre={conv.epinglee ? 'Désépingler' : 'Épingler'} actif={conv.epinglee} onClick={() => onEpingler(conv.id)}>
                <Pin size={12} />
              </ActionConv>
              <ActionConv titre="Renommer" onClick={() => setEdition(true)}>
                <Pencil size={12} />
              </ActionConv>
              <ActionConv titre="Supprimer" danger onClick={() => setConfirmer(true)}>
                <Trash2 size={12} />
              </ActionConv>
            </>
          )}
        </div>
      )}
    </li>
  )
}

function ActionConv({ titre, onClick, danger = false, actif = false, children }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick() }}
      title={titre}
      aria-label={titre}
      className={`flex h-6 w-6 items-center justify-center rounded-[7px] transition-colors ${FOCUS_RING} ${
        actif ? 'text-[#7a0008]' : 'text-[#1a1a1a]/50'
      } ${danger ? 'hover:bg-[#7a0008]/10 hover:text-[#7a0008]' : 'hover:bg-[#1a1a1a]/[0.06] hover:text-[#1a1a1a]'}`}
    >
      {children}
    </button>
  )
}


function WelcomeScreen({ onSuggestion, onModeVocal, disabled, modeVocal }) {
  return (
    <div className="relative min-h-full overflow-hidden">
    <div className="examai-fade-up relative mx-auto flex min-h-full max-w-2xl flex-col items-center justify-center px-4 py-10 text-center sm:px-6">

      <h2 className="examai-serif text-[28px] font-extrabold tracking-[-0.025em] text-[#1a1a1a] sm:text-[32px]">
        {salutation()}, comment puis-je <span className="examai-underline-wave text-[#7a0008]">vous aider ?</span>
      </h2>

      {!modeVocal && (
        <button
          onClick={onModeVocal}
          className={`group mt-7 flex w-full max-w-md items-center gap-3.5 rounded-[18px] border border-[#7a0008]/20 bg-white p-3.5 text-left shadow-[0_14px_30px_-22px_rgba(122,0,8,0.6)] transition-all hover:-translate-y-0.5 hover:border-[#7a0008]/45 ${FOCUS_RING} ${HOVER_LIFT}`}
        >
          <span className="examai-orbe flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white">
            <AudioLines size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13.5px] font-semibold text-[#1a1a1a]">Parler à l'assistant</span>
            <span className="block truncate text-[12px] text-[#1a1a1a]/50">« Crée un examen de maths pour la 3e année »</span>
          </span>
          <span className="shrink-0 rounded-full bg-[#7a0008]/[0.07] px-2.5 py-1 text-[10.5px] font-semibold text-[#7a0008]">
            Mains libres
          </span>
        </button>
      )}

      <div className="mt-8 grid w-full grid-cols-1 gap-2.5 sm:grid-cols-2">
        {SUGGESTIONS_INITIALES.map(({ titre, text, icon: Icon }, idx) => (
          <button
            key={text}
            onClick={() => onSuggestion(text)}
            disabled={disabled}
            style={{ animationDelay: `${120 + idx * 70}ms` }}
            className={`examai-fade-up group flex items-start gap-3 backdrop-blur-sm rounded-[16px] border border-[#1a1a1a]/10 bg-white/80 p-3.5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:bg-white hover:border-[#1a1a1a]/25 hover:shadow-[0_12px_26px_-18px_rgba(26,26,26,0.4)] disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING} ${HOVER_LIFT}`}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[#f7f7f7] text-[#7a0008] transition-colors group-hover:bg-[#7a0008]/[0.08]">
              <Icon size={15} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[12.5px] font-semibold text-[#1a1a1a]">{titre}</span>
              <span className="mt-0.5 block text-[12px] leading-snug text-[#1a1a1a]/55">{text}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
    </div>
  )
}



function BlocCode({ node, children, ...props }) {
  const ref = useRef(null)
  const [ok, setOk] = useState(false)
  return (
    <div className="group/code relative">
      <pre ref={ref} {...props}>{children}</pre>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(ref.current?.innerText || '')
          setOk(true)
          setTimeout(() => setOk(false), 1500)
        }}
        className={`absolute right-2 top-2 flex items-center gap-1 rounded-[8px] bg-white/10 px-2 py-1 text-[11px] font-medium text-white/80 opacity-0 transition-opacity hover:bg-white/20 group-hover/code:opacity-100 focus-visible:opacity-100 ${FOCUS_RING}`}
      >
        {ok ? <Check size={12} strokeWidth={3} /> : <Copy size={12} />}
        {ok ? 'Copié' : 'Copier'}
      </button>
    </div>
  )
}
const COMPOSANTS_MD = { pre: BlocCode }


function fermerMarkdown(t) {
  let x = t
  if ((x.match(/\*\*/g) || []).length % 2) x += '**'
  if ((x.match(/`/g) || []).length % 2) x += '`'
  return x
}


function TexteProgressif({ texte, actif, onFin }) {
  const [n, setN] = useState(actif ? 0 : texte.length)
  const finRef = useRef(onFin)
  finRef.current = onFin

  useEffect(() => {
    if (!actif) { setN(texte.length); return undefined }
    const reduit = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduit || texte.length < 40) { setN(texte.length); finRef.current?.(); return undefined }
    const duree = Math.min(3200, 450 + texte.length * 9)
    const debut = performance.now()
    let raf
    const pas = (t) => {
      const p = Math.min(1, (t - debut) / duree)
      const e = 1 - (1 - p) ** 2
      setN(Math.round(e * texte.length))
      if (p < 1) raf = requestAnimationFrame(pas)
      else finRef.current?.()
    }
    raf = requestAnimationFrame(pas)
    return () => cancelAnimationFrame(raf)
  }, [texte, actif])

  const enCours = n < texte.length
  let visible = texte.slice(0, n)
  if (enCours) {
    const coupe = visible.lastIndexOf(' ')
    if (coupe > 0) visible = visible.slice(0, coupe)
    const lignes = visible.split('\n')
    let fin = lignes.length
    let nbTableau = 0
    while (fin - nbTableau - 1 >= 0 && lignes[fin - nbTableau - 1].trim().startsWith('|')) nbTableau += 1
    if (nbTableau > 0) {
      const derniere = lignes[fin - 1].trim()
      if (nbTableau < 3) fin -= nbTableau
      else if (!derniere.endsWith('|')) fin -= 1
    } else if (/^(#{1,6}|>|`{3}|\d+[.)]|[-*+])\s*\S{0,2}$/.test(lignes[fin - 1].trim())) {
      fin -= 1
    }
    visible = fermerMarkdown(lignes.slice(0, fin).join('\n'))
  }

  return (
    <div dir="auto" className={`examai-prose ${enCours ? 'examai-ecriture' : ''}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPOSANTS_MD}>{visible}</ReactMarkdown>
    </div>
  )
}

function MessageBubble({
  role, contenu, fichiers, vocal, copie, enLecture, anime = false, onFinAnimation,
  onCopier, onLire, onSuggestion, disabled, estDernier,
}) {
  const [avis, setAvis] = useState(null)
  const [ecrit, setEcrit] = useState(!anime)
  const estUser = role === 'user'

  if (estUser) {
    return (
      <div className="examai-message-user flex flex-col items-end gap-1.5">
        {fichiers?.length > 0 && (
          <div className="flex flex-wrap justify-end gap-1.5">
            {fichiers.map((f, i) => (
              <span key={i} className="flex items-center gap-2 rounded-[12px] border border-[#1a1a1a]/10 bg-white py-1 pl-1 pr-2.5 text-[11.5px] font-medium text-[#1a1a1a]/75">
                <IconePdf />
                <span className="max-w-[200px] truncate">{f.nom}</span>
              </span>
            ))}
          </div>
        )}
        <div
          dir="auto"
          className="max-w-[85%] whitespace-pre-wrap rounded-[20px] rounded-br-[6px] bg-[#1a1a1a] px-4 py-2.5 text-[14px] leading-relaxed text-white"
        >
          {contenu}
        </div>
        {vocal && (
          <span className="flex items-center gap-1 pr-1 text-[10.5px] font-medium text-[#1a1a1a]/40">
            <Mic size={10} /> dicté à la voix
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="examai-fade-up group flex items-start">
      <div className="min-w-0 flex-1">
        <TexteProgressif
          texte={contenu || ''}
          actif={anime}
          onFin={() => { setEcrit(true); onFinAnimation?.() }}
        />

        <div className={`mt-2 flex items-center gap-0.5 transition-opacity duration-300 group-hover:opacity-100 focus-within:opacity-100 ${!ecrit ? 'pointer-events-none !opacity-0' : enLecture || estDernier ? 'opacity-100' : 'opacity-0'}`}>
          <ActionMessage onClick={onLire} actif={enLecture} titre={enLecture ? 'Arrêter la lecture' : 'Écouter la réponse'}>
            {enLecture ? <Pause size={13} /> : <Volume2 size={13} />}
            <span>{enLecture ? 'Arrêter' : 'Écouter'}</span>
          </ActionMessage>
          <ActionMessage onClick={onCopier} actif={copie} couleur="emerald" titre="Copier">
            {copie ? <Check size={13} strokeWidth={3} /> : <Copy size={13} />}
            <span>{copie ? 'Copié' : 'Copier'}</span>
          </ActionMessage>
          <span className="mx-1 h-4 w-px bg-[#1a1a1a]/10" />
          <ActionMessage onClick={() => setAvis(avis === 'bon' ? null : 'bon')} actif={avis === 'bon'} couleur="emerald" titre="Bonne réponse">
            <ThumbsUp size={13} />
          </ActionMessage>
          <ActionMessage onClick={() => setAvis(avis === 'mauvais' ? null : 'mauvais')} actif={avis === 'mauvais'} couleur="red" titre="Réponse à améliorer">
            <ThumbsDown size={13} />
          </ActionMessage>
        </div>

        {estDernier && !disabled && ecrit && (
          <div className="examai-fade-up mt-3 flex flex-wrap gap-1.5">
            {SUGGESTIONS_CONTEXTE.map(({ text }) => (
              <button
                key={text}
                onClick={() => onSuggestion(text)}
                className={`rounded-full border border-[#1a1a1a]/10 bg-white px-3.5 py-1.5 text-[12px] font-medium text-[#1a1a1a]/70 transition-all hover:border-[#7a0008]/30 hover:text-[#7a0008] ${FOCUS_RING}`}
              >
                {text}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ActionMessage({ onClick, actif, couleur = 'brand', titre, children }) {
  const couleurs = {
    brand: 'text-[#7a0008] bg-[#7a0008]/[0.07]',
    emerald: 'text-emerald-600 bg-emerald-500/10',
    red: 'text-red-600 bg-red-500/10',
  }
  return (
    <button
      onClick={onClick}
      title={titre}
      aria-label={titre}
      aria-pressed={actif}
      className={`flex h-7 items-center gap-1.5 rounded-[8px] px-2 text-[11.5px] font-medium transition-colors ${FOCUS_RING} ${
        actif ? couleurs[couleur] : 'text-[#1a1a1a]/45 hover:bg-[#1a1a1a]/[0.05] hover:text-[#1a1a1a]'
      }`}
    >
      {children}
    </button>
  )
}


function TypingIndicator() {
  return (
    <div className="examai-fade-up flex items-center">
      <div className="flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2.5 shadow-[0_1px_2px_rgba(26,26,26,0.06)]">
        <span className="examai-dot-1 h-1.5 w-1.5 rounded-full bg-[#7a0008]" />
        <span className="examai-dot-2 h-1.5 w-1.5 rounded-full bg-[#7a0008]/70" />
        <span className="examai-dot-3 h-1.5 w-1.5 rounded-full bg-[#7a0008]/45" />
        <span className="examai-brillance ml-1 text-[12px] font-medium">ClassAssistant réfléchit…</span>
      </div>
    </div>
  )
}


function SelecteurLangue({ langue, onChange, disabled, sombre = false, compact = false }) {
  return (
    <div
      role="radiogroup"
      aria-label="Langue de la voix"
      className={`flex items-center rounded-full p-0.5 ${compact ? 'h-8' : 'h-9'} ${sombre ? 'bg-white/70 ring-1 ring-[#1a1a1a]/10' : 'bg-[#f7f7f7] ring-1 ring-[#1a1a1a]/[0.06]'}`}
    >
      {LANGUES_VOCALES.map((l) => {
        const actif = langue === l.id
        return (
          <button
            key={l.id}
            role="radio"
            aria-checked={actif}
            disabled={disabled}
            onClick={() => onChange(l.id)}
            title={`Parler en ${l.label}`}
            className={`${compact ? 'h-7 min-w-7 px-2' : 'h-8 min-w-8 px-2.5'} rounded-full text-[11.5px] font-semibold transition-all disabled:opacity-50 ${FOCUS_RING} ${
              actif ? 'bg-white text-[#1a1a1a] shadow-[0_1px_3px_rgba(26,26,26,0.15)]' : 'text-[#1a1a1a]/50 hover:text-[#1a1a1a]'
            }`}
          >
            {l.court}
          </button>
        )
      })}
    </div>
  )
}


const PHASES = {
  attente: { fr: 'Préparation…', ar: 'جارٍ التحضير…' },
  ecoute: { fr: 'Je vous écoute', ar: 'أنا أستمع إليك' },
  transcription: { fr: 'Transcription…', ar: 'جارٍ تحويل الكلام إلى نص…' },
  reflexion: { fr: 'Je réfléchis…', ar: 'أفكّر…' },
  parole: { fr: 'Je vous réponds', ar: 'أجيبك' },
  pause: { fr: 'En pause', ar: 'متوقف' },
}

function aideVocale(phase, moteur, ar) {
  if (phase === 'ecoute') {
    return moteur === 'serveur'
      ? (ar ? 'سأتوقف تلقائيًا عند الصمت' : 'Je m’arrête tout seul quand vous vous taisez.')
      : (ar ? 'تكلّم بشكل طبيعي، ثم اضغط على الدائرة' : 'Parlez naturellement, puis touchez la sphère.')
  }
  if (phase === 'parole') return ar ? 'اضغط على الدائرة لمقاطعتي' : 'Touchez la sphère pour m’interrompre.'
  if (phase === 'pause') return ar ? 'اضغط على الدائرة أو مفتاح المسافة للتحدث' : 'Touchez la sphère ou appuyez sur Espace pour parler.'
  return ar ? 'جرّب: «أنشئ امتحان رياضيات للسنة الثالثة»' : 'Essayez : « Crée un examen de sciences pour la 5e année ».'
}


function SceneVocale({
  phase, niveau, transcription, moteur, ar, langue, onLangue,
  derniereQuestion, derniereReponse, erreur, action, enCours, onConfirmer, onAnnuler,
  onEcouter, onTerminerEcoute, onInterrompre, onReduire, onQuitter,
}) {
  const libelle = PHASES[phase] || PHASES.attente
  const ecoute = phase === 'ecoute'
  const parle = phase === 'parole'
  const occupe = phase === 'reflexion' || phase === 'transcription' || phase === 'attente'
  const actionCentrale = ecoute ? onTerminerEcoute : onEcouter
  const titreCentral = ecoute ? "J'ai fini de parler" : parle ? 'Interrompre et parler' : 'Parler'

  const sousTitre = ecoute
    ? transcription
    : parle
      ? derniereReponse
      : phase === 'reflexion' || phase === 'transcription'
        ? derniereQuestion
        : ''

  const orbeRef = useRef(null)
  const halosRef = useRef(null)
  const niveauRef = useRef(0)
  niveauRef.current = ecoute ? Math.min(Math.max(niveau || 0, 0), 1) : 0
  useEffect(() => {
    let raf
    let v = 0
    const tick = () => {
      const cible = niveauRef.current
      v += (cible - v) * (cible > v ? 0.28 : 0.1)
      if (orbeRef.current) orbeRef.current.style.transform = `scale(${1 + v * 0.2})`
      if (halosRef.current) {
        halosRef.current.style.transform = `scale(${1 + v * 0.55})`
        halosRef.current.style.opacity = String(0.25 + v * 0.6)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div
      className="examai-fade absolute inset-0 z-30 flex flex-col overflow-hidden bg-white"
      role="dialog"
      aria-label="Mode vocal"
    >
      {}
      <div className="relative flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <span className="flex items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 text-[11.5px] font-semibold text-[#1a1a1a]/70 ring-1 ring-[#1a1a1a]/10">
          <span className={`h-2 w-2 rounded-full ${ecoute ? 'examai-pulse bg-[#7a0008]' : parle ? 'bg-emerald-500' : 'bg-[#1a1a1a]/30'}`} />
          Mode vocal
        </span>
        <SelecteurLangue langue={langue} onChange={onLangue} disabled={ecoute} sombre />
      </div>

      {}
      <div className="relative flex flex-1 flex-col items-center justify-center px-5 text-center" aria-live="polite">
        <button
          onClick={actionCentrale}
          disabled={occupe}
          title={titreCentral}
          aria-label={titreCentral}
          className={`group relative flex h-44 w-44 items-center justify-center rounded-full disabled:cursor-wait sm:h-52 sm:w-52 ${FOCUS_RING}`}
        >
          {}
          <span ref={halosRef} className="absolute inset-0 rounded-full bg-[#7a0008]/25 blur-2xl" style={{ opacity: 0.25 }} />
          {ecoute && (
            <>
              <span className="examai-onde absolute inset-0 rounded-full bg-[#7a0008]/35" />
              <span className="examai-onde examai-onde-2 absolute inset-0 rounded-full bg-[#7a0008]/25" />
              <span className="examai-onde examai-onde-3 absolute inset-0 rounded-full bg-[#7a0008]/15" />
            </>
          )}
          <span className={`examai-anneau examai-tourne absolute -inset-3 rounded-full transition-opacity duration-300 ${occupe ? 'opacity-100' : 'opacity-0'}`} />
          <span className={`relative h-full w-full ${!ecoute && !occupe ? 'examai-respire' : ''}`}>
          <span
            ref={orbeRef}
            className="examai-orbe relative flex h-full w-full items-center justify-center rounded-full text-white will-change-transform"
          >
            {occupe ? <Loader2 size={34} className="animate-spin opacity-90" />
              : parle ? <BarresAudio grand />
                : ecoute ? <Square size={28} fill="currentColor" className="opacity-95" />
                  : <Mic size={40} />}
          </span>
          </span>
        </button>

        <p key={phase} className="examai-fade-up mt-11 text-[19px] font-semibold text-[#1a1a1a] sm:text-[21px]" dir={ar ? 'rtl' : 'ltr'}>
          {ar ? libelle.ar : libelle.fr}
        </p>

        <div className="mt-3 min-h-[5.5em] w-full max-w-xl">
          {sousTitre ? (
            <p
              key={ecoute ? 'ecoute' : phase}
              dir="auto"
              className={`examai-fade line-clamp-4 text-[15px] leading-relaxed sm:text-[16px] ${ecoute ? 'font-medium text-[#1a1a1a]' : 'text-[#1a1a1a]/60'}`}
            >
              {ecoute ? sousTitre : `« ${sousTitre} »`}
            </p>
          ) : (
            <p className="text-[13.5px] text-[#1a1a1a]/45" dir={ar ? 'rtl' : 'ltr'}>
              {aideVocale(phase, moteur, ar)}
            </p>
          )}
          {sousTitre && (
            <p className="mt-2 text-[12px] text-[#1a1a1a]/40" dir={ar ? 'rtl' : 'ltr'}>{aideVocale(phase, moteur, ar)}</p>
          )}
        </div>

        {action && (
          <div className="mt-4 w-full max-w-md text-left">
            <CarteAction action={action} onConfirmer={onConfirmer} onAnnuler={onAnnuler} enCours={enCours} />
          </div>
        )}
        {erreur && (
          <p role="alert" className="mt-3 max-w-md rounded-[12px] bg-[#fff5f5] px-3 py-2 text-[12.5px] font-medium text-[#7a0008]">
            {erreur}
          </p>
        )}
      </div>

      {}
      <div className="relative flex flex-col items-center gap-3 px-4 pb-6 sm:pb-8">
        <div className="flex items-center gap-3">
          <BoutonRond onClick={onReduire} titre="Afficher la conversation et le clavier">
            <Keyboard size={18} />
          </BoutonRond>
          {parle ? (
            <BoutonRond onClick={onInterrompre} titre="Couper la lecture">
              <Pause size={18} />
            </BoutonRond>
          ) : (
            <BoutonRond onClick={actionCentrale} disabled={occupe} titre={titreCentral}>
              {ecoute ? <Square size={15} fill="currentColor" /> : <Mic size={18} />}
            </BoutonRond>
          )}
          <BoutonRond onClick={onQuitter} titre="Quitter le mode vocal (Échap)" danger>
            <X size={19} />
          </BoutonRond>
        </div>
        <p className="text-center text-[11px] text-[#1a1a1a]/40">
          <kbd className="rounded border border-[#1a1a1a]/15 bg-white px-1.5 py-0.5 font-sans text-[10px]">Espace</kbd> parler
          {' · '}
          <kbd className="rounded border border-[#1a1a1a]/15 bg-white px-1.5 py-0.5 font-sans text-[10px]">Échap</kbd> quitter
          {' · '}dites « répète », « nouvelle conversation » ou « stop »
        </p>
      </div>
    </div>
  )
}

function BoutonRond({ onClick, disabled, titre, danger = false, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={titre}
      aria-label={titre}
      className={`flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#1a1a1a]/70 shadow-[0_6px_16px_-8px_rgba(26,26,26,0.35)] ring-1 ring-[#1a1a1a]/10 transition-all hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-40 ${FOCUS_RING} ${HOVER_LIFT} ${
        danger ? 'hover:bg-[#7a0008] hover:text-white hover:ring-[#7a0008]' : 'hover:text-[#1a1a1a] hover:ring-[#1a1a1a]/25'
      }`}
    >
      {children}
    </button>
  )
}


function BarreVocale({
  phase, niveau, transcription, ar,
  onEcouter, onTerminerEcoute, onInterrompre, onAgrandir, onQuitter,
}) {
  const libelle = PHASES[phase] || PHASES.attente
  const ecoute = phase === 'ecoute'
  const parle = phase === 'parole'
  const occupe = phase === 'reflexion' || phase === 'transcription' || phase === 'attente'
  const actionCentrale = ecoute ? onTerminerEcoute : onEcouter
  const titreCentral = ecoute ? "J'ai fini de parler" : parle ? 'Interrompre et parler' : 'Parler'

  return (
    <div
      className="examai-fade-up flex items-center gap-3 rounded-[18px] border border-[#7a0008]/15 bg-white px-3 py-2.5 shadow-[0_14px_30px_-20px_rgba(122,0,8,0.55)]"
      aria-live="polite"
    >
      <button
        onClick={actionCentrale}
        disabled={occupe}
        title={titreCentral}
        aria-label={titreCentral}
        className={`examai-orbe relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white transition-transform active:scale-95 disabled:cursor-wait ${FOCUS_RING}`}
        style={ecoute ? { transform: `scale(${1 + Math.min(niveau, 1) * 0.15})` } : undefined}
      >
        {ecoute && <span className="examai-onde absolute inset-0 rounded-full bg-[#7a0008]/40" />}
        <span className="relative">
          {occupe ? <Loader2 size={17} className="animate-spin" />
            : parle ? <BarresAudio />
              : ecoute ? <Square size={13} fill="currentColor" />
                : <Mic size={17} />}
        </span>
      </button>

      <div className="min-w-0 flex-1" dir={ar ? 'rtl' : 'ltr'}>
        <p className="text-[12.5px] font-semibold text-[#1a1a1a]">{ar ? libelle.ar : libelle.fr}</p>
        <p className="truncate text-[12px] text-[#1a1a1a]/50" dir="auto">
          {ecoute && transcription ? transcription : aideVocale(phase, 'navigateur', ar)}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        {parle && (
          <BoutonIcone onClick={onInterrompre} titre="Couper la lecture"><Pause size={14} /></BoutonIcone>
        )}
        <BoutonIcone onClick={onAgrandir} titre="Agrandir le mode vocal"><Maximize2 size={14} /></BoutonIcone>
        <BoutonIcone onClick={onQuitter} titre="Quitter le mode vocal (Échap)"><X size={15} /></BoutonIcone>
      </div>
    </div>
  )
}

function BarresAudio({ grand = false }) {
  return (
    <span className={`flex items-center ${grand ? 'h-12 gap-[5px]' : 'h-5 gap-[3px]'}`} aria-hidden>
      {[0, 0.15, 0.3, 0.45, 0.2].slice(0, grand ? 5 : 4).map((d, i) => (
        <span
          key={i}
          className={`examai-barre block rounded-full bg-white ${grand ? 'h-12 w-[6px]' : 'h-5 w-[3px]'}`}
          style={{ animationDelay: `${d}s` }}
        />
      ))}
    </span>
  )
}


function CarteAction({ action, onConfirmer, onAnnuler, enCours }) {
  const pdf = action.type === 'creer_examen_pdf'
  const p = action.parametres || {}
  const puces = pdf
    ? [action.resume]
    : [
      p.matiere && libelleMatiere(p.matiere),
      p.niveau && `${p.niveau}e année`,
      p.nb_questions && `${p.nb_questions} questions`,
      ...(p.types || []).map((t) => ({
        qcm: 'QCM', texte_a_trous: 'Texte à trous', question_ouverte: 'Questions ouvertes', legende_image: 'Légende d’image',
      }[t] || t)),
    ].filter(Boolean)

  return (
    <div className="examai-fade-up rounded-[16px] border border-[#7a0008]/20 bg-white p-3.5 shadow-[0_14px_30px_-22px_rgba(122,0,8,0.6)]">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[#7a0008]/[0.08] text-[#7a0008]">
          <Wand2 size={15} />
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-[#1a1a1a]">{pdf ? 'Créer un examen depuis le PDF' : 'Créer un examen'}</p>
          <p className="text-[11px] text-[#1a1a1a]/45">Vérifiez puis confirmez — ou dites « oui » / « non »</p>
        </div>
      </div>
      {puces.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {puces.map((x) => (
            <span key={x} className="rounded-full bg-[#f7f7f7] px-2.5 py-1 text-[11.5px] font-medium text-[#1a1a1a]/75 ring-1 ring-[#1a1a1a]/[0.06]">
              {x}
            </span>
          ))}
        </div>
      )}
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={onConfirmer}
          disabled={enCours}
          className={`flex items-center gap-1.5 rounded-full bg-[#7a0008] px-4 py-2 text-[12px] font-semibold text-white transition-all hover:bg-[#961014] disabled:opacity-60 ${FOCUS_RING}`}
        >
          {enCours ? <Loader2 size={12} className="animate-spin" /> : pdf ? <Check size={12} strokeWidth={3} /> : <ExternalLink size={12} />}
          {pdf ? 'Créer l’examen' : 'Ouvrir le générateur'}
        </button>
        <button
          onClick={onAnnuler}
          className={`rounded-full px-3.5 py-2 text-[12px] font-medium text-[#1a1a1a]/60 transition-colors hover:bg-[#1a1a1a]/[0.06] hover:text-[#1a1a1a] ${FOCUS_RING}`}
        >
          Annuler
        </button>
      </div>
    </div>
  )
}