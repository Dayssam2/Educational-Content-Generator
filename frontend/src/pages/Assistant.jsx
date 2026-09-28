import { useEffect, useRef, useState } from 'react'
import {
  Search, Plus, Send, Paperclip, X, Sparkles, RotateCcw,
  MessageSquare, Inbox, Loader2, AlertTriangle, Check,
  Copy, ThumbsUp, ThumbsDown, Mic, Square, ChevronLeft,
  ChevronRight, User, FileText,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import TopNav from '../components/TopNav.jsx'
import { api } from '../api/client.js'

/* ============ TOKENS (identiques au wizard) ============ */
const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f172a]/35 focus-visible:ring-offset-2'
const HOVER_LIFT = 'motion-reduce:transition-none motion-reduce:hover:translate-y-0'
const BRAND = '#7a0008'

const SUGGESTIONS_INITIALES = [
  { text: 'Comment créer un examen de maths pour des 3ème ?', icon: Sparkles },
  { text: 'Quels types de questions pour évaluer une compréhension ?', icon: MessageSquare },
  { text: 'Comment modifier les paramètres de mon examen ?', icon: FileText },
  { text: 'Des conseils pour des questions plus variées ?', icon: Sparkles },
]

const SUGGESTIONS_CONTEXTE = [
  { text: 'Peux-tu me donner un exemple concret ?' },
  { text: 'Quels sont les pièges à éviter ?' },
  { text: 'Comment adapter pour des élèves en difficulté ?' },
]

const STORAGE_KEY = 'examai_chat_history'

const MAX_TAILLE_PDF_OCTETS = 15 * 1024 * 1024 // 15 Mo

const MATIERES = [
  { id: 'mathematique', label: 'Mathématiques' },
  { id: 'arabe', label: 'Arabe' },
  { id: 'science', label: 'Sciences' },
  { id: 'francais', label: 'Français' },
  { id: 'histoire_geo', label: 'Histoire-Géo' },
]

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

export default function Assistant() {
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState([])
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState(null)
  const [pdfJoint, setPdfJoint] = useState(null)
  const [lecturePdf, setLecturePdf] = useState(false)
  const [dernierPdf, setDernierPdf] = useState(null)
  const [creationEnCours, setCreationEnCours] = useState(false)
  const [examenCree, setExamenCree] = useState(null)
  const [sidebarOuverte, setSidebarOuverte] = useState(true)
  const [historique, setHistorique] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') }
    catch { return [] }
  })
  const [convActive, setConvActive] = useState(null)
  const [rechercheConv, setRechercheConv] = useState('')
  const [enregistrement, setEnregistrement] = useState(false)
  const [copie, setCopie] = useState(null)

  const finDuFilRef = useRef(null)
  const inputRef = useRef(null)
  const fichierRef = useRef(null)
  const mediaRecorderRef = useRef(null)

  useEffect(() => {
    finDuFilRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, envoi])

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(historique)) }
    catch {}
  }, [historique])

  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault()
        setSidebarOuverte((v) => !v)
      }
      if (e.key === 'Escape') setErreur(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  async function envoyer(texteBrut, historiqueDepart) {
    const texte = (texteBrut || '').trim()
    if (!texte || envoi || lecturePdf) return

    const messagesDepart = historiqueDepart ?? messages
    const pdfPourEnvoi = pdfJoint
    if (pdfPourEnvoi) setDernierPdf(pdfPourEnvoi)
    const historique_ = messagesDepart.map((m) => ({ role: m.role, contenu: m.contenu }))

    const nouveauMsg = {
      role: 'user',
      contenu: texte,
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
      })

      const messagesFinal = [...messagesAvecQuestion, { role: 'assistant', contenu: reponse }]
      setMessages(messagesFinal)

      if (convActive) {
        setHistorique((h) => h.map((c) => (c.id === convActive ? { ...c, messages: messagesFinal } : c)))
      } else {
        const conv = {
          id: Date.now(),
          titre: texte.slice(0, 40) || 'Nouvelle conversation',
          date: new Date().toISOString(),
          messages: messagesFinal,
        }
        setHistorique((h) => [conv, ...h])
        setConvActive(conv.id)
      }
    } catch (e) {
      setErreur(e.message || "Une erreur est survenue, l'assistant n'a pas pu répondre.")
    } finally {
      setEnvoi(false)
      inputRef.current?.focus()
    }
  }

  function handleSend(e) {
    e?.preventDefault()
    envoyer(message)
  }

  function nouvelleConversation() {
    setMessages([])
    setErreur(null)
    setMessage('')
    setPdfJoint(null)
    setDernierPdf(null)
    setExamenCree(null)
    setConvActive(null)
    inputRef.current?.focus()
  }

  function chargerConversation(conv) {
    setMessages(conv.messages || [])
    setConvActive(conv.id)
    setErreur(null)
    setPdfJoint(null)
    setDernierPdf(null)
    setExamenCree(null)
  }

  function supprimerConversation(id, e) {
    e?.stopPropagation()
    setHistorique((h) => h.filter((c) => c.id !== id))
    if (convActive === id) nouvelleConversation()
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
    if (!dernierPdf || creationEnCours) return
    setCreationEnCours(true)
    setErreur(null)
    try {
      const examen = await api.createExamenDepuisPdf({
        pdf_base64: dernierPdf.base64,
        nom_fichier: dernierPdf.nom,
      })
      setExamenCree({
        id: examen.id, titre: examen.titre, matiere: examen.matiere, niveau: examen.niveau,
      })
    } catch (e) {
      setErreur(e.message || "Impossible de créer l'examen depuis ce PDF.")
    } finally {
      setCreationEnCours(false)
    }
  }

  async function toggleMicro() {
    if (enregistrement) {
      mediaRecorderRef.current?.stop()
      setEnregistrement(false)
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream)
      rec.ondataavailable = () => {}
      rec.onstop = () => stream.getTracks().forEach((t) => t.stop())
      rec.start()
      mediaRecorderRef.current = rec
      setEnregistrement(true)
    } catch {
      setErreur("Impossible d'accéder au microphone.")
    }
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
    envoyer(dernierUser.contenu, messagesTronques)
  }

  const conversationDemarree = messages.length > 0
  const historiqueFiltre = rechercheConv
    ? historique.filter((c) => c.titre.toLowerCase().includes(rechercheConv.toLowerCase()))
    : historique

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-[#f6f8fb] text-[#0f172a]">
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
        .examai-fade-up { animation: examaiFadeUp .34s cubic-bezier(.22,1,.36,1) both; }

        @keyframes examaiSlideLeft {
          from { opacity: 0; transform: translateX(-16px); }
          to   { opacity: 1; transform: none; }
        }
        .examai-slide-left { animation: examaiSlideLeft .4s cubic-bezier(.22,1,.36,1) both; }

        @keyframes examaiDot {
          0%, 20% { opacity: .3; transform: scale(.8); }
          50%     { opacity: 1; transform: scale(1.1); }
          80%, 100% { opacity: .3; transform: scale(.8); }
        }
        .examai-dot-1 { animation: examaiDot 1.4s ease-in-out infinite; }
        .examai-dot-2 { animation: examaiDot 1.4s ease-in-out .2s infinite; }
        .examai-dot-3 { animation: examaiDot 1.4s ease-in-out .4s infinite; }

        @keyframes examaiPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        .examai-pulse { animation: examaiPulse 1.6s ease-in-out infinite; }

        .examai-shine { position: relative; overflow: hidden; }
        .examai-shine::after {
          content: ''; position: absolute; inset: 0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent);
          transform: translateX(-100%);
          transition: transform .7s;
        }
        .examai-shine:hover::after { transform: translateX(100%); }

        .examai-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
        .examai-scroll::-webkit-scrollbar-track { background: transparent; }
        .examai-scroll::-webkit-scrollbar-thumb {
          background: rgba(15,23,42,0.15);
          border-radius: 999px;
        }
        .examai-scroll::-webkit-scrollbar-thumb:hover { background: rgba(15,23,42,0.28); }

        /* ===== Rendu markdown des réponses assistant ===== */
        .examai-prose > *:first-child { margin-top: 0; }
        .examai-prose > *:last-child  { margin-bottom: 0; }

        .examai-prose p {
          margin: 0.55em 0;
          line-height: 1.7;
        }

        .examai-prose strong {
          font-weight: 650;
          color: #0f172a;
        }
        .examai-prose em { font-style: italic; }

        .examai-prose h1,
        .examai-prose h2,
        .examai-prose h3,
        .examai-prose h4 {
          font-weight: 650;
          color: #0f172a;
          line-height: 1.3;
          margin: 1.05em 0 0.45em;
        }
        .examai-prose h1 { font-size: 1.18em; }
        .examai-prose h2 { font-size: 1.10em; }
        .examai-prose h3 { font-size: 1.02em; }
        .examai-prose h4 { font-size: 0.98em; }

        .examai-prose ul,
        .examai-prose ol {
          margin: 0.5em 0;
          padding-left: 1.35em;
        }
        .examai-prose li { margin: 0.3em 0; line-height: 1.6; }
        .examai-prose li::marker { color: rgba(122,0,8,0.65); }
        .examai-prose ul > li { list-style: disc; }
        .examai-prose ol > li { list-style: decimal; }
        .examai-prose li > ul,
        .examai-prose li > ol { margin: 0.3em 0 0.3em 0; }

        .examai-prose a {
          color: #7a0008;
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .examai-prose a:hover { color: #961014; }

        .examai-prose code {
          background: rgba(15,23,42,0.06);
          border: 1px solid rgba(15,23,42,0.08);
          border-radius: 6px;
          padding: 0.1em 0.38em;
          font-size: 0.88em;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        }

        .examai-prose pre {
          background: #0f172a;
          color: #e2e8f0;
          border-radius: 12px;
          padding: 0.85em 1em;
          overflow-x: auto;
          margin: 0.7em 0;
          font-size: 0.85em;
          line-height: 1.55;
        }
        .examai-prose pre code {
          background: transparent;
          border: none;
          padding: 0;
          color: inherit;
          font-size: 1em;
        }

        .examai-prose blockquote {
          border-left: 3px solid rgba(122,0,8,0.45);
          padding: 0.15em 0 0.15em 0.85em;
          margin: 0.6em 0;
          color: rgba(15,23,42,0.7);
          font-style: italic;
        }

        .examai-prose hr {
          border: none;
          border-top: 1px solid rgba(15,23,42,0.12);
          margin: 1em 0;
        }

        .examai-prose table {
          border-collapse: collapse;
          width: 100%;
          margin: 0.7em 0;
          font-size: 0.92em;
          overflow: hidden;
          border-radius: 10px;
        }
        .examai-prose th,
        .examai-prose td {
          border: 1px solid rgba(15,23,42,0.12);
          padding: 0.45em 0.7em;
          text-align: left;
          vertical-align: top;
        }
        .examai-prose th {
          background: rgba(15,23,42,0.04);
          font-weight: 600;
        }

        @media (prefers-reduced-motion: reduce) {
          .examai-fade-up, .examai-slide-left, .examai-dot-1, .examai-dot-2, .examai-dot-3, .examai-pulse {
            animation: none !important;
          }
        }
      `}</style>

      <TopNav />

      <div className="relative flex flex-1 overflow-hidden">

        {/* ============ SIDEBAR ============ */}
        {sidebarOuverte && (
          <aside className="examai-slide-left hidden w-[280px] shrink-0 flex-col border-r border-[#0f172a]/15 bg-white md:flex">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#0f172a]/10 p-3.5">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-[#7a0008]/[0.08] text-[#7a0008]">
                  <MessageSquare size={13} />
                </span>
                <span className="text-[11px] font-bold uppercase tracking-[0.10em] text-[#0f172a]/55">
                  Conversations
                </span>
              </div>
              <button
                onClick={() => setSidebarOuverte(false)}
                className={`flex h-7 w-7 items-center justify-center rounded-full border border-[#0f172a]/15 bg-white text-[#0f172a]/60 transition-all hover:border-[#0f172a]/40 hover:text-[#0f172a] ${FOCUS_RING}`}
                aria-label="Fermer la sidebar"
              >
                <ChevronLeft size={13} />
              </button>
            </div>

            {/* Nouvelle conv */}
            <button
              onClick={nouvelleConversation}
              className={`examai-shine mx-3 mt-3 flex items-center justify-center gap-2 rounded-full bg-[#7a0008] px-4 py-2.5 text-[12.5px] font-semibold text-white shadow-[0_1px_2px_rgba(79,0,5,0.2),0_8px_18px_-6px_rgba(122,0,8,0.5)] transition-all hover:-translate-y-0.5 active:scale-[0.98] ${FOCUS_RING} ${HOVER_LIFT}`}
            >
              <Plus size={14} strokeWidth={2.4} />
              Nouvelle conversation
            </button>

            {/* Recherche */}
            <div className="px-3 pt-3">
              <div className="relative">
                <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#0f172a]/40" />
                <input
                  value={rechercheConv}
                  onChange={(e) => setRechercheConv(e.target.value)}
                  placeholder="Rechercher..."
                  className={`w-full rounded-[10px] border border-[#0f172a]/15 bg-white py-2 pl-8 pr-3 text-[12px] text-[#0f172a] outline-none transition-all placeholder:text-[#0f172a]/40 focus:border-[#0f172a]/40 focus:shadow-[0_0_0_4px_rgba(15,23,42,0.08)] ${FOCUS_RING}`}
                />
              </div>
            </div>

            {/* Liste */}
            <div className="examai-scroll flex-1 overflow-y-auto px-2 py-3">
              {historiqueFiltre.length === 0 ? (
                <div className="px-3 py-8 text-center">
                  <span className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-[12px] bg-[#0f172a]/[0.05] text-[#0f172a]/45">
                    <Inbox size={16} />
                  </span>
                  <p className="text-[11.5px] font-bold italic text-[#0f172a]/50">
                    {historique.length === 0 ? 'Aucune conversation' : 'Aucun résultat'}
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {historiqueFiltre.map((conv) => {
                    const active = convActive === conv.id
                    return (
                      <button
                        key={conv.id}
                        onClick={() => chargerConversation(conv)}
                        className={`group relative flex w-full items-start gap-2.5 rounded-[10px] px-3 py-2.5 text-left transition-colors ${FOCUS_RING} ${
                          active
                            ? 'bg-[#7a0008]/[0.08]'
                            : 'hover:bg-[#0f172a]/[0.04]'
                        }`}
                      >
                        {active && (
                          <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-[#7a0008]" />
                        )}
                        <span
                          className="mt-1 h-2 w-2 shrink-0 rounded-full"
                          style={{ background: active ? BRAND : 'rgba(15,23,42,0.25)' }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className={`truncate text-[12.5px] font-semibold ${active ? 'text-[#7a0008]' : 'text-[#0f172a]'}`}>
                            {conv.titre}
                          </p>
                          <p className="truncate text-[10.5px] text-[#0f172a]/45">
                            {new Date(conv.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                          </p>
                        </div>
                        <span
                          onClick={(e) => supprimerConversation(conv.id, e)}
                          role="button"
                          tabIndex={0}
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[#0f172a]/40 opacity-0 transition-all hover:bg-[#7a0008]/[0.08] hover:text-[#7a0008] group-hover:opacity-100"
                          aria-label="Supprimer"
                        >
                          <X size={12} />
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </aside>
        )}

        {/* ============ ZONE PRINCIPALE ============ */}
        <main className="relative flex flex-1 flex-col overflow-hidden bg-[#f6f8fb]">

          {/* Header */}
          <div className="flex items-center justify-between gap-3 border-b border-[#0f172a]/15 bg-white px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              {!sidebarOuverte && (
                <button
                  onClick={() => setSidebarOuverte(true)}
                  className={`hidden h-9 w-9 items-center justify-center rounded-full border border-[#0f172a]/15 bg-white text-[#0f172a]/60 transition-all hover:border-[#0f172a]/40 hover:text-[#0f172a] md:flex ${FOCUS_RING}`}
                  aria-label="Ouvrir la sidebar"
                >
                  <ChevronRight size={14} />
                </button>
              )}

              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] bg-[#7a0008]/[0.08] text-[#7a0008]">
                <Sparkles size={18} />
              </span>

              <div className="min-w-0">
                <h1 className="examai-serif truncate text-[16px] font-semibold text-[#0f172a]">
                  ClassAssistant
                </h1>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              {conversationDemarree && (
                <>
                  <button
                    onClick={regenerer}
                    disabled={envoi}
                    className={`flex h-9 w-9 items-center justify-center rounded-full border border-[#0f172a]/15 bg-white text-[#0f172a]/60 transition-all hover:border-[#0f172a]/40 hover:text-[#0f172a] disabled:opacity-40 ${FOCUS_RING}`}
                    title="Régénérer"
                  >
                    <RotateCcw size={13} />
                  </button>
                  <button
                    onClick={nouvelleConversation}
                    className={`flex h-9 items-center gap-1.5 rounded-full border border-[#0f172a]/15 bg-white px-3 text-[11.5px] font-semibold text-[#0f172a]/70 transition-all hover:border-[#0f172a]/40 hover:text-[#0f172a] ${FOCUS_RING}`}
                  >
                    <Plus size={12} />
                    <span className="hidden sm:inline">Nouveau</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Fil de messages */}
          <div className="examai-scroll flex-1 overflow-y-auto px-4 py-6 sm:px-6">
            {!conversationDemarree ? (
              <WelcomeScreen onSuggestion={envoyer} disabled={envoi} />
            ) : (
              <div className="mx-auto max-w-3xl space-y-7">
                {messages.map((m, i) => (
                  <MessageBubble
                    key={i}
                    role={m.role}
                    contenu={m.contenu}
                    fichiers={m.fichiers}
                    index={i}
                    copie={copie === i}
                    onCopier={() => copierMessage(m.contenu, i)}
                    onSuggestion={envoyer}
                    disabled={envoi}
                    estDernier={i === messages.length - 1}
                  />
                ))}
                {envoi && <TypingIndicator />}
                <div ref={finDuFilRef} />
              </div>
            )}
          </div>

          {/* Erreur */}
          {erreur && (
            <div className="examai-fade-up mx-4 mb-2 flex items-start gap-3 rounded-[16px] border border-[#7a0008]/40 bg-[#0f172a]/[0.035] p-3.5 text-[12.5px] text-[#0f172a] sm:mx-6">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#7a0008]/10">
                <AlertTriangle size={13} className="text-[#7a0008]" />
              </span>
              <span className="min-w-0 flex-1 break-words pt-0.5 font-medium">{erreur}</span>
              <button onClick={() => setErreur(null)} className={`flex h-6 w-6 items-center justify-center rounded-full text-[#0f172a]/50 hover:bg-[#0f172a]/[0.06] hover:text-[#0f172a] ${FOCUS_RING}`}>
                <X size={12} />
              </button>
            </div>
          )}

          {/* Zone de saisie */}
          <div className="border-t border-[#0f172a]/15 bg-[#f6f8fb] px-4 pb-4 pt-3 sm:px-6">
            <div className="mx-auto max-w-3xl">
              {examenCree && (
                <div className="examai-fade-up mb-2 flex items-center justify-between gap-2 rounded-[14px] border border-emerald-500/30 bg-emerald-500/[0.06] px-3 py-2 text-[11.5px] font-medium text-emerald-700">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <Check size={12} strokeWidth={3} className="shrink-0" />
                    <span className="truncate">
                      Examen créé : « {examenCree.titre} » (
                      {MATIERES.find((m) => m.id === examenCree.matiere)?.label || examenCree.matiere}
                      {' · Niveau '}{examenCree.niveau}) — retrouvez-le dans « Mes examens ».
                    </span>
                  </span>
                  <button
                    onClick={() => setExamenCree(null)}
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-emerald-700/60 hover:bg-emerald-500/10 ${FOCUS_RING}`}
                  >
                    <X size={11} />
                  </button>
                </div>
              )}

              {dernierPdf && !examenCree && (
                <div className="examai-fade-up mb-2 flex items-center justify-between gap-2 rounded-[14px] border border-[#7a0008]/25 bg-[#7a0008]/[0.04] px-3 py-2">
                  <span className="flex min-w-0 items-center gap-1.5 text-[11.5px] font-medium text-[#0f172a]/70">
                    <FileText size={12} className="shrink-0 text-[#7a0008]" />
                    <span className="truncate">{dernierPdf.nom}</span>
                  </span>
                  <button
                    onClick={creerExamenDepuisPdf}
                    disabled={creationEnCours}
                    className={`flex shrink-0 items-center gap-1.5 rounded-full bg-[#7a0008] px-3 py-1.5 text-[11px] font-semibold text-white transition-all hover:bg-[#961014] disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
                  >
                    {creationEnCours && <Loader2 size={11} className="animate-spin" />}
                    {creationEnCours ? 'Création en cours...' : 'Créer un examen depuis ce PDF'}
                  </button>
                </div>
              )}

              {pdfJoint && (
                <div className="examai-fade-up mb-2 flex flex-wrap gap-2">
                  <div className="flex items-center gap-2 rounded-full border border-[#0f172a]/15 bg-white px-3 py-1.5 text-[11.5px] font-medium text-[#0f172a]/70">
                    <FileText size={11} className="text-[#0f172a]/45" />
                    <span className="max-w-[200px] truncate">{pdfJoint.nom}</span>
                    <span className="text-[#0f172a]/40">· {formatTaille(pdfJoint.taille)}</span>
                    <button
                      onClick={retirerPdf}
                      className={`flex h-4 w-4 items-center justify-center rounded-full text-[#0f172a]/50 transition-colors hover:bg-[#0f172a]/[0.08] hover:text-[#0f172a] ${FOCUS_RING}`}
                    >
                      <X size={10} />
                    </button>
                  </div>
                </div>
              )}
              {lecturePdf && (
                <div className="examai-fade-up mb-2 flex items-center gap-1.5 px-1 text-[11.5px] font-medium text-[#0f172a]/50">
                  <Loader2 size={12} className="animate-spin" />
                  Lecture du PDF...
                </div>
              )}

              <form
                onSubmit={handleSend}
                className="flex items-end gap-1.5 rounded-[24px] border border-[#0f172a]/20 bg-white px-2.5 py-2 shadow-[0_14px_32px_-14px_rgba(15,23,42,0.25)] transition-all focus-within:border-[#0f172a]/40 focus-within:shadow-[0_0_0_4px_rgba(15,23,42,0.10),0_14px_32px_-14px_rgba(15,23,42,0.3)]"
              >
                <input
                  ref={fichierRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={handlePdfSelectionne}
                />
                <button
                  type="button"
                  onClick={() => fichierRef.current?.click()}
                  disabled={!!pdfJoint || lecturePdf}
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#0f172a]/55 transition-all hover:bg-[#0f172a]/[0.06] hover:text-[#0f172a] disabled:opacity-30 ${FOCUS_RING}`}
                  title="Joindre un PDF (programme, fiche de cours...)"
                >
                  {lecturePdf ? <Loader2 size={15} className="animate-spin" /> : <Paperclip size={15} />}
                </button>

                <textarea
                  ref={inputRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      envoyer(message)
                    }
                  }}
                  placeholder="Écrivez votre message... (Entrée pour envoyer)"
                  disabled={envoi}
                  rows={1}
                  className="max-h-40 flex-1 resize-none bg-transparent py-2.5 text-[13.5px] leading-relaxed text-[#0f172a] outline-none placeholder:text-[#0f172a]/40 disabled:opacity-60"
                  style={{ minHeight: '24px' }}
                />

                <button
                  type="button"
                  onClick={toggleMicro}
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all ${FOCUS_RING} ${
                    enregistrement
                      ? 'examai-pulse bg-[#7a0008] text-white'
                      : 'text-[#0f172a]/55 hover:bg-[#0f172a]/[0.06] hover:text-[#0f172a]'
                  }`}
                  title={enregistrement ? 'Arrêter' : 'Dicter'}
                >
                  {enregistrement ? <Square size={13} /> : <Mic size={15} />}
                </button>

                <button
                  type="submit"
                  disabled={envoi || !message.trim() || lecturePdf}
                  aria-label="Envoyer"
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#7a0008] text-white shadow-[0_1px_2px_rgba(79,0,5,0.2),0_8px_18px_-6px_rgba(122,0,8,0.5),inset_0_1px_0_rgba(255,255,255,0.15)] transition-all hover:-translate-y-0.5 hover:bg-[#961014] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 ${FOCUS_RING} ${HOVER_LIFT}`}
                >
                  {envoi ? <Loader2 size={15} className="animate-spin" /> : <Send size={14} />}
                </button>
              </form>

              <p className="mt-2.5 flex items-center justify-center gap-1.5 text-center text-[10.5px] text-[#0f172a]/45">
                L'assistant peut se tromper. Vérifiez les informations importantes.
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

/* ============ ÉCRAN DE BIENVENUE ============ */
function WelcomeScreen({ onSuggestion, disabled }) {
  return (
    <div className="examai-fade-up mx-auto flex h-full max-w-2xl flex-col items-center justify-center py-8 text-center">
      <span className="flex h-24 w-24 items-center justify-center rounded-[28px] bg-[#7a0008] text-white shadow-[0_18px_40px_-12px_rgba(122,0,8,0.6)]">
        <Sparkles size={32} strokeWidth={2} />
      </span>

      <h2 className="examai-serif mt-7 text-[26px] font-semibold text-[#0f172a]">
        Bonjour
      </h2>
      <p className="mt-2.5 max-w-md text-[13.5px] leading-relaxed text-[#0f172a]/65">
        Je suis <span className="font-semibold text-[#7a0008]">ClassAssistant</span>.
        Posez-moi une question sur la création d'examens, la pédagogie ou la plateforme.
      </p>

      <div className="mt-9 grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
        {SUGGESTIONS_INITIALES.map(({ text, icon: Icon }) => (
          <button
            key={text}
            onClick={() => onSuggestion(text)}
            disabled={disabled}
            className={`group relative flex items-start gap-3 rounded-[16px] border border-[#0f172a]/20 bg-white p-4 text-left text-[12.5px] font-medium text-[#0f172a]/75 transition-all hover:-translate-y-1 hover:border-[#0f172a]/40 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING} ${HOVER_LIFT}`}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[#7a0008]/[0.08] text-[#7a0008] transition-transform group-hover:scale-105">
              <Icon size={15} />
            </span>
            <span className="min-w-0 flex-1 leading-snug">{text}</span>
            <ChevronRight
              size={14}
              className="mt-1 shrink-0 text-[#0f172a]/30 transition-all group-hover:translate-x-1 group-hover:text-[#7a0008]"
            />
          </button>
        ))}
      </div>
    </div>
  )
}

/* ============ BULLE DE MESSAGE ============ */
function MessageBubble({
  role, contenu, fichiers, index, copie,
  onCopier, onSuggestion, disabled, estDernier,
}) {
  const estUser = role === 'user'
  return (
    <div className={`examai-fade-up flex items-start gap-3 ${estUser ? 'flex-row-reverse' : ''}`}>
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] ${
          estUser
            ? 'bg-[#0f172a] text-white'
            : 'bg-[#7a0008] text-white shadow-[0_4px_10px_-4px_rgba(122,0,8,0.55)]'
        }`}
      >
        {estUser ? <User size={15} /> : <Sparkles size={15} />}
      </span>

      <div className={`group flex min-w-0 max-w-[85%] flex-col gap-2 ${estUser ? 'items-end' : 'items-start'}`}>
        {fichiers?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {fichiers.map((f, i) => (
              <span
                key={i}
                className="flex items-center gap-1.5 rounded-full border border-[#0f172a]/15 bg-white px-2.5 py-1 text-[10.5px] font-medium text-[#0f172a]/70"
              >
                <FileText size={10} />
                {f.nom}
                {f.type === 'application/pdf' && (
                  <span className="text-[#0f172a]/40">· lu par l'assistant</span>
                )}
              </span>
            ))}
          </div>
        )}

        <div
          className={`rounded-[16px] px-4 py-3 text-[13.5px] leading-relaxed ${
            estUser
              ? 'whitespace-pre-wrap rounded-tr-md bg-[#7a0008] text-white shadow-[0_10px_24px_-12px_rgba(122,0,8,0.55)]'
              : 'examai-prose rounded-tl-md border border-[#0f172a]/15 bg-white text-[#0f172a] shadow-[0_1px_2px_rgba(15,23,42,0.04)]'
          }`}
        >
          {estUser ? (
            contenu
          ) : (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{contenu}</ReactMarkdown>
          )}
        </div>

        {!estUser && (
          <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            <button
              onClick={onCopier}
              className={`flex h-7 items-center gap-1 rounded-full px-2.5 text-[11px] font-medium transition-colors hover:bg-[#0f172a]/[0.06] ${FOCUS_RING} ${
                copie ? 'text-emerald-600' : 'text-[#0f172a]/50'
              }`}
              title="Copier"
            >
              {copie ? <Check size={11} strokeWidth={3} /> : <Copy size={11} />}
              {copie ? 'Copié' : 'Copier'}
            </button>
            <button
              className={`flex h-7 items-center gap-1 rounded-full px-2.5 text-[11px] transition-colors hover:bg-emerald-500/10 hover:text-emerald-600 text-[#0f172a]/50 ${FOCUS_RING}`}
              title="Bonne réponse"
            >
              <ThumbsUp size={11} />
            </button>
            <button
              className={`flex h-7 items-center gap-1 rounded-full px-2.5 text-[11px] transition-colors hover:bg-red-500/10 hover:text-red-600 text-[#0f172a]/50 ${FOCUS_RING}`}
              title="Mauvaise réponse"
            >
              <ThumbsDown size={11} />
            </button>
          </div>
        )}

        {!estUser && estDernier && !disabled && (
          <div className="examai-fade-up mt-1.5 flex flex-wrap gap-1.5">
            {SUGGESTIONS_CONTEXTE.map(({ text }) => (
              <button
                key={text}
                onClick={() => onSuggestion(text)}
                className={`rounded-full border border-[#0f172a]/15 bg-white px-3.5 py-1.5 text-[11.5px] font-medium text-[#0f172a]/70 transition-all hover:-translate-y-0.5 hover:border-[#0f172a]/35 hover:text-[#0f172a] ${FOCUS_RING} ${HOVER_LIFT}`}
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

/* ============ INDICATEUR DE SAISIE ============ */
function TypingIndicator() {
  return (
    <div className="examai-fade-up flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[#7a0008] text-white shadow-[0_4px_10px_-4px_rgba(122,0,8,0.55)]">
        <Sparkles size={15} />
      </span>
      <div className="flex items-center gap-1.5 rounded-[16px] rounded-tl-md border border-[#0f172a]/15 bg-white px-4 py-3.5">
        <span className="examai-dot-1 h-2 w-2 rounded-full bg-[#7a0008]" />
        <span className="examai-dot-2 h-2 w-2 rounded-full bg-[#7a0008]/60" />
        <span className="examai-dot-3 h-2 w-2 rounded-full bg-[#7a0008]/40" />
      </div>
    </div>
  )
}