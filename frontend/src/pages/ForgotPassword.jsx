import { useState, useCallback, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Briefcase,
  Mail,
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  Loader2,
  ArrowRight,
  ArrowLeft,
  ChevronDown,
  Check,
  Circle,
  CheckCircle2,
  AlertCircle,
  X,
} from 'lucide-react'
import { api } from '../api/client.js'

let toastSeq = 0

const STRINGS = {
  fr: {
    langFlag: '🇫🇷',
    langNative: 'Français',
    langName: 'Français',
    langMenuTitle: 'Langue',
    langMenuLabel: 'Choisir la langue',
    closeToast: 'Fermer la notification',
    toastRegionLabel: 'Notifications',

    // Etape 1 : demande de code
    step1Heading1: 'Mot de passe',
    step1Heading2: 'oublié ?',
    step1Subtitle: "Indique ton adresse e-mail : si un compte existe, un code de réinitialisation valable 15 minutes t'est envoyé.",
    emailLabel: 'Adresse e-mail',
    emailPlaceholder: 'votre@email.com',
    emailRequired: "L'adresse e-mail est requise.",
    emailInvalid: 'Entrez une adresse e-mail valide.',
    sendCode: 'Envoyer le code',
    sendCodeLoading: 'Envoi en cours…',
    backToLogin: 'Retour à la connexion',

    // Etape 2 : code + nouveau mot de passe
    step2Heading1: 'Vérifie ton',
    step2Heading2: 'adresse e-mail.',
    step2Subtitle: (email) => `Un code à 6 chiffres a été envoyé à ${email}, valable 15 minutes.`,
    codeLabel: 'Code de vérification',
    codePlaceholder: '000000',
    codeRequired: 'Le code est requis.',
    codeInvalid: 'Le code doit contenir 6 chiffres.',
    newPasswordLabel: 'Nouveau mot de passe',
    newPasswordPlaceholder: 'Au moins 8 caractères',
    newPasswordRequired: 'Le mot de passe est requis.',
    newPasswordTooShort: 'Le mot de passe doit faire au moins 8 caractères.',
    strengthLabels: ['Faible', 'Moyen', 'Fort', 'Très fort'],
    hintLength: '8 caractères min.',
    hintUpper: 'Une majuscule',
    hintDigit: 'Un chiffre',
    hintSymbol: 'Un symbole',
    confirmLabel: 'Confirmer le mot de passe',
    confirmPlaceholder: 'Retape le mot de passe',
    confirmMismatch: 'Les mots de passe ne correspondent pas.',
    showPassword: 'Afficher le mot de passe',
    hidePassword: 'Masquer le mot de passe',
    resetSubmit: 'Réinitialiser le mot de passe',
    resetLoading: 'Réinitialisation…',
    changeEmail: "Changer d'adresse e-mail",
    resendCode: 'Renvoyer le code',
    resendCodeLoading: 'Envoi…',

    toastCodeSent: "Si un compte existe avec cet email, un code vient d'être envoyé.",
    toastResetSuccess: 'Mot de passe réinitialisé. Tu peux te reconnecter.',
    toastErrorDefault: 'Une erreur est survenue. Veuillez réessayer.',
    goToLogin: 'Se connecter',
  },
  ar: {
    langFlag: '🇹🇳',
    langNative: 'العربية',
    langName: 'Arabe',
    langMenuTitle: 'اللغة',
    langMenuLabel: 'اختر اللغة',
    closeToast: 'إغلاق الإشعار',
    toastRegionLabel: 'الإشعارات',

    step1Heading1: 'نسيت',
    step1Heading2: 'كلمة المرور؟',
    step1Subtitle: 'أدخل بريدك الإلكتروني: إذا كان الحساب موجودًا، سيصلك رمز لإعادة التعيين صالح لمدة 15 دقيقة.',
    emailLabel: 'البريد الإلكتروني',
    emailPlaceholder: 'بريدك@الإلكتروني.com',
    emailRequired: 'البريد الإلكتروني مطلوب.',
    emailInvalid: 'أدخل عنوان بريد إلكتروني صالحًا.',
    sendCode: 'إرسال الرمز',
    sendCodeLoading: 'جارٍ الإرسال…',
    backToLogin: 'الرجوع لتسجيل الدخول',

    step2Heading1: 'تحقّق من',
    step2Heading2: 'بريدك الإلكتروني.',
    step2Subtitle: (email) => `تم إرسال رمز من 6 أرقام إلى ${email}، صالح لمدة 15 دقيقة.`,
    codeLabel: 'رمز التحقق',
    codePlaceholder: '000000',
    codeRequired: 'الرمز مطلوب.',
    codeInvalid: 'يجب أن يتكون الرمز من 6 أرقام.',
    newPasswordLabel: 'كلمة المرور الجديدة',
    newPasswordPlaceholder: '8 أحرف على الأقل',
    newPasswordRequired: 'كلمة المرور مطلوبة.',
    newPasswordTooShort: 'يجب أن تحتوي كلمة المرور على 8 أحرف على الأقل.',
    strengthLabels: ['ضعيفة', 'متوسطة', 'قوية', 'قوية جدًا'],
    hintLength: '8 أحرف على الأقل',
    hintUpper: 'حرف كبير واحد',
    hintDigit: 'رقم واحد',
    hintSymbol: 'رمز واحد',
    confirmLabel: 'تأكيد كلمة المرور',
    confirmPlaceholder: 'أعد كتابة كلمة المرور',
    confirmMismatch: 'كلمتا المرور غير متطابقتين.',
    showPassword: 'إظهار كلمة المرور',
    hidePassword: 'إخفاء كلمة المرور',
    resetSubmit: 'إعادة تعيين كلمة المرور',
    resetLoading: 'جارٍ إعادة التعيين…',
    changeEmail: 'تغيير البريد الإلكتروني',
    resendCode: 'إعادة إرسال الرمز',
    resendCodeLoading: 'جارٍ الإرسال…',

    toastCodeSent: 'إذا كان الحساب موجودًا، تم إرسال رمز إليه للتو.',
    toastResetSuccess: 'تمت إعادة تعيين كلمة المرور. يمكنك تسجيل الدخول الآن.',
    toastErrorDefault: 'حدث خطأ ما. حاول مجددًا.',
    goToLogin: 'تسجيل الدخول',
  },
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const CODE_RE = /^\d{6}$/

// Indicateur visuel de force du mot de passe (faible -> tres fort). Le
// backend n'exige que 8 caracteres minimum ; ceci est purement indicatif
// cote client pour encourager un mot de passe plus solide, ca ne bloque
// jamais la soumission (seule la regle des 8 caracteres est obligatoire).
const STRENGTH_COLORS = [
  '#b91c1c', // faible -- rouge
  '#d97706', // moyen -- ambre
  '#2f855a', // fort -- vert (meme vert que les toasts de succes)
  '#15803d', // tres fort -- vert plus soutenu
]

function getPasswordStrength(password) {
  if (!password) return { score: 0, level: 0 }
  let score = 0
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++

  let level
  if (score <= 1) level = 0
  else if (score === 2) level = 1
  else if (score <= 4) level = 2
  else level = 3

  return { score, level }
}

export default function ForgotPassword() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1) // 1 = email, 2 = code + nouveau mot de passe
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [shakeFields, setShakeFields] = useState({ email: false, code: false, newPassword: false, confirm: false })
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [focusField, setFocusField] = useState(null)
  const [toasts, setToasts] = useState([])
  const [lang, setLang] = useState('fr')
  const [langOpen, setLangOpen] = useState(false)
  const tr = STRINGS[lang]
  const isRTL = lang === 'ar'

  const langMenuRef = useRef(null)
  const langButtonRef = useRef(null)
  const emailInputRef = useRef(null)
  const codeInputRef = useRef(null)
  const toastTimers = useRef(new Map())
  const mounted = useRef(true)

  useEffect(() => {
    emailInputRef.current?.focus()
    return () => {
      mounted.current = false
      toastTimers.current.forEach((timerId) => clearTimeout(timerId))
      toastTimers.current.clear()
    }
  }, [])

  useEffect(() => {
    if (step === 2) codeInputRef.current?.focus()
  }, [step])

  useEffect(() => {
    if (!langOpen) return undefined
    function handlePointerDown(e) {
      if (
        langMenuRef.current &&
        !langMenuRef.current.contains(e.target) &&
        !langButtonRef.current?.contains(e.target)
      ) {
        setLangOpen(false)
      }
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        setLangOpen(false)
        langButtonRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [langOpen])

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)))
    const removeTimer = setTimeout(() => {
      if (!mounted.current) return
      setToasts((prev) => prev.filter((t) => t.id !== id))
      toastTimers.current.delete(id)
    }, 250)
    toastTimers.current.set(id, removeTimer)
  }, [])

  const pushToast = useCallback(
    (type, message) => {
      const id = ++toastSeq
      setToasts((prev) => [...prev, { id, type, message, leaving: false }])
      const autoTimer = setTimeout(() => dismissToast(id), 4200)
      toastTimers.current.set(id, autoTimer)
    },
    [dismissToast]
  )

  // --- Etape 1 : demande de code -------------------------------------------

  async function handleSendCode(e) {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) {
      setShakeFields((prev) => ({ ...prev, email: true }))
      pushToast('error', tr.emailRequired)
      emailInputRef.current?.focus()
      return
    }
    if (!EMAIL_RE.test(trimmed)) {
      setShakeFields((prev) => ({ ...prev, email: true }))
      pushToast('error', tr.emailInvalid)
      emailInputRef.current?.focus()
      return
    }

    setLoading(true)
    try {
      // Le backend renvoie TOUJOURS le meme message generique, que le
      // compte existe ou non (protection anti-enumeration) -- on ne peut
      // donc pas, et ne doit pas, distinguer les deux cas ici.
      await api.forgotPassword({ email: trimmed })
      pushToast('success', tr.toastCodeSent)
      setStep(2)
    } catch (err) {
      pushToast('error', err?.message || tr.toastErrorDefault)
    } finally {
      setLoading(false)
    }
  }

  async function handleResendCode() {
    setResending(true)
    try {
      await api.forgotPassword({ email: email.trim() })
      pushToast('success', tr.toastCodeSent)
    } catch (err) {
      pushToast('error', err?.message || tr.toastErrorDefault)
    } finally {
      setResending(false)
    }
  }

  // --- Etape 2 : code + nouveau mot de passe --------------------------------

  function validateStep2() {
    const next = { code: '', newPassword: '', confirm: '' }
    if (!code.trim()) {
      next.code = tr.codeRequired
    } else if (!CODE_RE.test(code.trim())) {
      next.code = tr.codeInvalid
    }
    if (!newPassword) {
      next.newPassword = tr.newPasswordRequired
    } else if (newPassword.length < 8) {
      next.newPassword = tr.newPasswordTooShort
    }
    if (!confirm) {
      next.confirm = tr.newPasswordRequired
    } else if (newPassword !== confirm) {
      next.confirm = tr.confirmMismatch
    }
    return next
  }

  async function handleReset(e) {
    e.preventDefault()
    const errors = validateStep2()
    const hasError = Object.values(errors).some(Boolean)
    if (hasError) {
      setShakeFields((prev) => ({
        ...prev,
        code: Boolean(errors.code),
        newPassword: Boolean(errors.newPassword),
        confirm: Boolean(errors.confirm),
      }))
      Object.values(errors).forEach((msg) => msg && pushToast('error', msg))
      return
    }

    setLoading(true)
    try {
      await api.resetPassword({ email: email.trim(), code: code.trim(), nouveauPassword: newPassword })
      pushToast('success', tr.toastResetSuccess)
      setTimeout(() => {
        if (mounted.current) navigate('/login', { replace: true })
      }, 800)
    } catch (err) {
      // Le backend renvoie le meme message pour "code faux" et "code
      // expire" (volontairement generique, voir CHANGEMENTS.md du
      // backend) -- on l'affiche tel quel.
      pushToast('error', err?.message || tr.toastErrorDefault)
      setLoading(false)
    }
  }

  function handleFieldChange(setter, field, value) {
    setter(value)
    if (shakeFields[field]) {
      setShakeFields((prev) => ({ ...prev, [field]: false }))
    }
  }

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      style={{ width: '100vw', height: '100vh', background: '#ffffff' }}
      className={`examai-login relative overflow-hidden bg-white ${isRTL ? 'examai-ar' : ''}`}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700;9..144,900&family=Manrope:wght@400;500;600;700;800&family=Cairo:wght@400;500;600;700;800&display=swap');

        .examai-login { font-family: 'Manrope', system-ui, sans-serif; background: #ffffff; }
        .examai-serif { font-family: 'Fraunces', Georgia, serif; font-feature-settings: 'liga' 1; }
        .examai-ar, .examai-ar .examai-serif { font-family: 'Cairo', 'Manrope', system-ui, sans-serif; }

        @keyframes examaiFadeUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes examaiToastIn { from { opacity: 0; transform: translateX(-28px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes examaiToastOut { from { opacity: 1; transform: translateX(0); } to { opacity: 0; transform: translateX(-28px); } }
        @keyframes examaiSpinSlow { to { transform: rotate(360deg); } }
        @keyframes examaiShake { 10%, 90% { transform: translateX(-1px); } 20%, 80% { transform: translateX(2px); } 30%, 50%, 70% { transform: translateX(-3px); } 40%, 60% { transform: translateX(3px); } }
        @keyframes examaiStampIn { 0% { opacity: 0; transform: rotate(-24deg) scale(1.4); } 60% { opacity: 1; } 100% { opacity: 1; transform: rotate(-10deg) scale(1); } }
        @keyframes examaiLangMenuIn { from { opacity: 0; transform: translateY(-8px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }

        .examai-anim-1 { animation: examaiFadeUp 0.8s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .examai-anim-2 { animation: examaiFadeUp 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.1s both; }
        .examai-toast-enter { animation: examaiToastIn 0.32s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .examai-toast-leave { animation: examaiToastOut 0.24s ease-in both; }
        .examai-ring { animation: examaiSpinSlow 80s linear infinite; }
        .examai-shake { animation: examaiShake 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97) both; }
        .examai-stamp { animation: examaiStampIn 0.7s cubic-bezier(0.22, 1, 0.36, 1) 0.5s both; }
        .examai-lang-menu { animation: examaiLangMenuIn 0.22s cubic-bezier(0.22, 1, 0.36, 1) both; }

        .examai-underline-wave {
          background-color: rgba(122,0,8,0.12);
          background-repeat: no-repeat;
          background-size: 100% 0.35em;
          background-position: 0 88%;
          padding: 0 0.15em;
        }

        @media (prefers-reduced-motion: reduce) {
          .examai-anim-1, .examai-anim-2, .examai-toast-enter, .examai-toast-leave,
          .examai-ring, .examai-shake, .examai-stamp, .examai-lang-menu {
            animation: none !important;
          }
        }
      `}</style>

      <div className="examai-ring absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[720px] h-[720px] rounded-full border border-[#0f172a]/[0.07] pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#d4a76a]/70" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[#7a0008]/50" />
      </div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[560px] h-[560px] rounded-full border border-[#0f172a]/[0.05] pointer-events-none" />

      {/* ===== Toasts ===== */}
      <div
        className="fixed bottom-6 left-6 z-[100] flex flex-col gap-3 w-[min(360px,90vw)]"
        role="region"
        aria-live="polite"
        aria-label={tr.toastRegionLabel}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="alert"
            className={`flex items-start gap-3 rounded-2xl bg-white pl-4 pr-3 py-3.5 shadow-[0_16px_32px_-12px_rgba(15,23,42,0.35)] border-l-[3px] ${
              t.type === 'success' ? 'border-l-[#2f855a]' : 'border-l-[#7a0008]'
            } ${t.leaving ? 'examai-toast-leave' : 'examai-toast-enter'}`}
          >
            {t.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-[#2f855a] shrink-0 mt-0.5" strokeWidth={2} />
            ) : (
              <AlertCircle className="w-5 h-5 text-[#7a0008] shrink-0 mt-0.5" strokeWidth={2} />
            )}
            <p className="flex-1 text-[13px] leading-snug text-[#0f172a]">{t.message}</p>
            <button
              type="button"
              onClick={() => dismissToast(t.id)}
              className="text-[#0f172a]/30 hover:text-[#0f172a]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f172a]/30 rounded-full p-0.5 transition-colors"
              aria-label={tr.closeToast}
            >
              <X className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
          </div>
        ))}
      </div>

      {/* ===== Top bar ===== */}
      <header dir="ltr" className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-8 sm:px-12 py-6">
        <div className="flex items-center gap-3.5 examai-anim-1">
          <div className="relative shrink-0">
            <div className="relative w-12 h-12 rounded-[16px] bg-[#7a0008] flex items-center justify-center shadow-[0_6px_18px_-6px_rgba(122,0,8,0.55),0_2px_6px_-2px_rgba(122,0,8,0.35),inset_0_1px_0_rgba(255,255,255,0.22)] overflow-hidden">
              <div className="absolute top-1 left-1.5 w-5 h-2 rounded-full bg-white/30 blur-[3px]" />
              <Briefcase className="relative w-[22px] h-[22px] text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)]" strokeWidth={1.9} />
            </div>
          </div>
          <span className="examai-serif text-[22px] tracking-[-0.018em] leading-none">
            <span className="font-medium text-[#0f172a]">Class</span>
            <span className="font-semibold text-[#7a0008]">Assistant</span>
          </span>
        </div>

        <div className="relative examai-anim-1">
          <button
            ref={langButtonRef}
            type="button"
            onClick={() => setLangOpen((v) => !v)}
            aria-haspopup="listbox"
            aria-expanded={langOpen}
            aria-label={tr.langMenuLabel}
            className="group flex items-center gap-2.5 pl-1.5 pr-2 py-1.5 rounded-full bg-white border border-[#0f172a]/12 shadow-[0_1px_2px_rgba(15,23,42,0.06),0_6px_16px_-8px_rgba(15,23,42,0.18),inset_0_1px_0_rgba(255,255,255,0.8)] hover:border-[#0f172a]/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f172a]/30 transition-all duration-200"
          >
            <span className="relative flex items-center justify-center w-7 h-7 rounded-full bg-white ring-1 ring-[#d4a76a]/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
              <span className="text-[14px] leading-none" aria-hidden="true">{tr.langFlag}</span>
            </span>
            <span className="text-[12.5px] font-bold text-[#0f172a] tracking-wider">{lang.toUpperCase()}</span>
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#0f172a]/[0.06] group-hover:bg-[#0f172a]/[0.10] transition-colors">
              <ChevronDown className={`w-3 h-3 text-[#0f172a]/70 transition-transform duration-300 ${langOpen ? 'rotate-180' : ''}`} strokeWidth={2.4} />
            </span>
          </button>

          {langOpen && (
            <div
              ref={langMenuRef}
              role="listbox"
              aria-label={tr.langMenuLabel}
              className="examai-lang-menu absolute top-[calc(100%+10px)] right-0 w-56 rounded-2xl bg-white border border-[#0f172a]/12 shadow-[0_24px_48px_-16px_rgba(15,23,42,0.35),0_0_0_1px_rgba(255,255,255,0.6)_inset] overflow-hidden z-30"
            >
              <div className="px-4 pt-3 pb-2 border-b border-[#0f172a]/8">
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#0f172a]/60">{tr.langMenuTitle}</span>
              </div>
              <div className="p-1.5">
                {['fr', 'ar'].map((code2) => {
                  const active = lang === code2
                  const item = STRINGS[code2]
                  return (
                    <button
                      key={code2}
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => {
                        setLang(code2)
                        setLangOpen(false)
                        langButtonRef.current?.focus()
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] transition-all duration-150 ${
                        active ? 'bg-[#0f172a]/[0.08] text-[#0f172a] font-semibold' : 'text-[#0f172a]/75 hover:bg-[#0f172a]/[0.05]'
                      }`}
                    >
                      <span className={`flex items-center justify-center w-8 h-8 rounded-full ring-1 transition-all ${active ? 'bg-white ring-[#d4a76a]/50 shadow-[0_2px_6px_-2px_rgba(212,167,106,0.4)]' : 'bg-white ring-[#0f172a]/10'}`}>
                        <span className="text-[15px] leading-none" aria-hidden="true">{item.langFlag}</span>
                      </span>
                      <span className="flex flex-col items-start leading-tight flex-1">
                        <span className="text-[#0f172a]">{item.langNative}</span>
                        <span className="text-[10.5px] text-[#0f172a]/50 font-medium">{item.langName}</span>
                      </span>
                      {active && (
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#0f172a] shadow-[0_2px_6px_-2px_rgba(15,23,42,0.5)]">
                          <Check className="w-3 h-3 text-white" strokeWidth={3} />
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* ===== Main ===== */}
      <main className="relative z-10 w-full h-full flex items-center justify-center px-6 py-6 sm:py-8 overflow-y-auto">
        <div className="examai-anim-2 relative w-full max-w-[560px]">

          <div
            className="examai-stamp absolute -top-5 -right-4 sm:-top-6 sm:-right-6 z-20 pointer-events-none select-none"
            aria-hidden="true"
          >
            <div className="relative w-[68px] h-[68px] rotate-[-10deg]">
              <div className="absolute inset-0 rounded-full border-[1.5px] border-[#7a0008]/35" />
              <div className="absolute inset-[5px] rounded-full border border-[#7a0008]/25 bg-white flex items-center justify-center">
                <KeyRound className="w-5 h-5 text-[#7a0008]/70" strokeWidth={2} />
              </div>
            </div>
          </div>

          <div className="relative rounded-[32px] bg-white border border-[#0f172a]/10 shadow-[0_40px_80px_-24px_rgba(15,23,42,0.35),0_0_0_1px_rgba(255,255,255,0.5)_inset] overflow-hidden">
            <div className="h-1 w-full bg-[#7a0008]" />

            <div className="relative px-8 sm:px-10 py-9">
              {step === 1 ? (
                <>
                  <div className="text-center mb-8">
                    <h2 className="examai-serif text-[26px] sm:text-[32px] font-semibold tracking-[-0.025em] text-[#0f172a] leading-[1.15]">
                      {tr.step1Heading1}
                      <br />
                      <span className="text-[#7a0008] relative">
                        <span className="examai-underline-wave">{tr.step1Heading2}</span>
                      </span>
                    </h2>
                    <p className="examai-serif mt-4 text-[13px] sm:text-[13.5px] font-normal italic leading-[1.6] text-[#0f172a]/75 max-w-[380px] mx-auto">
                      {tr.step1Subtitle}
                    </p>
                  </div>

                  <form onSubmit={handleSendCode} noValidate className="space-y-5">
                    <div>
                      <label htmlFor="email" className="block text-[12px] font-semibold text-[#4f0005]/70 mb-1.5">
                        {tr.emailLabel}
                      </label>
                      <div className="relative">
                        <Mail
                          className={`absolute ${isRTL ? 'right-[15px]' : 'left-[15px]'} top-1/2 -translate-y-1/2 w-[17px] h-[17px] transition-colors duration-200 ${
                            focusField === 'email' ? 'text-[#7a0008]' : 'text-[#7a0008]/35'
                          }`}
                          strokeWidth={1.8}
                        />
                        <input
                          ref={emailInputRef}
                          id="email"
                          type="email"
                          autoComplete="email"
                          required
                          value={email}
                          onChange={(e) => handleFieldChange(setEmail, 'email', e.target.value)}
                          onFocus={() => setFocusField('email')}
                          onBlur={() => setFocusField(null)}
                          onAnimationEnd={() => setShakeFields((prev) => ({ ...prev, email: false }))}
                          placeholder={tr.emailPlaceholder}
                          className={`w-full ${isRTL ? 'pr-[44px] pl-4' : 'pl-[44px] pr-4'} py-[13px] bg-white border border-[#7a0008]/12 rounded-[14px] text-[14px] text-[#1a2332] placeholder:text-[#4f0005]/25 focus:outline-none focus:bg-white focus:border-[#7a0008]/40 focus:shadow-[0_0_0_4px_rgba(122,0,8,0.08)] transition-all duration-200 ${
                            shakeFields.email ? 'examai-shake border-red-400/60' : ''
                          }`}
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="relative w-full flex items-center justify-center gap-2 py-[15px] px-4 rounded-full bg-[#7a0008] text-white text-[14px] font-semibold shadow-[0_1px_2px_rgba(79,0,5,0.2),0_10px_24px_-8px_rgba(122,0,8,0.55),inset_0_1px_0_rgba(255,255,255,0.15)] hover:bg-[#961014] disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7a0008]/40 focus-visible:ring-offset-2"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                          {tr.sendCodeLoading}
                        </>
                      ) : (
                        <>
                          {tr.sendCode}
                          <ArrowRight className="w-4 h-4" strokeWidth={2.2} aria-hidden="true" />
                        </>
                      )}
                    </button>

                    <p className="pt-1 text-center text-[13px] text-[#4f0005]/55">
                      <Link
                        to="/login"
                        className="inline-flex items-center gap-1.5 font-semibold text-[#7a0008] hover:text-[#4f0005] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7a0008]/30 rounded transition-colors"
                      >
                        <ArrowLeft className={`w-3.5 h-3.5 ${isRTL ? 'rotate-180' : ''}`} strokeWidth={2.2} />
                        {tr.backToLogin}
                      </Link>
                    </p>
                  </form>
                </>
              ) : (
                <>
                  <div className="text-center mb-8">
                    <h2 className="examai-serif text-[26px] sm:text-[32px] font-semibold tracking-[-0.025em] text-[#0f172a] leading-[1.15]">
                      {tr.step2Heading1}
                      <br />
                      <span className="text-[#7a0008] relative">
                        <span className="examai-underline-wave">{tr.step2Heading2}</span>
                      </span>
                    </h2>
                    <p className="examai-serif mt-4 text-[13px] sm:text-[13.5px] font-normal italic leading-[1.6] text-[#0f172a]/75 max-w-[380px] mx-auto break-words">
                      {tr.step2Subtitle(email.trim())}
                    </p>
                  </div>

                  <form onSubmit={handleReset} noValidate className="space-y-4">
                    <div>
                      <label htmlFor="code" className="block text-[12px] font-semibold text-[#4f0005]/70 mb-1.5">
                        {tr.codeLabel}
                      </label>
                      <div className="relative">
                        <KeyRound
                          className={`absolute ${isRTL ? 'right-[15px]' : 'left-[15px]'} top-1/2 -translate-y-1/2 w-[17px] h-[17px] transition-colors duration-200 ${
                            focusField === 'code' ? 'text-[#7a0008]' : 'text-[#7a0008]/35'
                          }`}
                          strokeWidth={1.8}
                        />
                        <input
                          ref={codeInputRef}
                          id="code"
                          type="text"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          maxLength={6}
                          required
                          value={code}
                          onChange={(e) => handleFieldChange(setCode, 'code', e.target.value.replace(/\D/g, '').slice(0, 6))}
                          onFocus={() => setFocusField('code')}
                          onBlur={() => setFocusField(null)}
                          onAnimationEnd={() => setShakeFields((prev) => ({ ...prev, code: false }))}
                          placeholder={tr.codePlaceholder}
                          className={`w-full ${isRTL ? 'pr-[44px] pl-4' : 'pl-[44px] pr-4'} py-[13px] bg-white border border-[#7a0008]/12 rounded-[14px] text-[16px] tracking-[0.3em] text-[#1a2332] placeholder:text-[#4f0005]/20 placeholder:tracking-[0.3em] focus:outline-none focus:bg-white focus:border-[#7a0008]/40 focus:shadow-[0_0_0_4px_rgba(122,0,8,0.08)] transition-all duration-200 ${
                            shakeFields.code ? 'examai-shake border-red-400/60' : ''
                          }`}
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="newPassword" className="block text-[12px] font-semibold text-[#4f0005]/70 mb-1.5">
                        {tr.newPasswordLabel}
                      </label>
                      <div className="relative">
                        <Lock
                          className={`absolute ${isRTL ? 'right-[15px]' : 'left-[15px]'} top-1/2 -translate-y-1/2 w-[17px] h-[17px] transition-colors duration-200 ${
                            focusField === 'newPassword' ? 'text-[#7a0008]' : 'text-[#7a0008]/35'
                          }`}
                          strokeWidth={1.8}
                        />
                        <input
                          id="newPassword"
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="new-password"
                          required
                          value={newPassword}
                          onChange={(e) => handleFieldChange(setNewPassword, 'newPassword', e.target.value)}
                          onFocus={() => setFocusField('newPassword')}
                          onBlur={() => setFocusField(null)}
                          onAnimationEnd={() => setShakeFields((prev) => ({ ...prev, newPassword: false }))}
                          placeholder={tr.newPasswordPlaceholder}
                          className={`w-full ${isRTL ? 'pr-[44px] pl-12' : 'pl-[44px] pr-12'} py-[13px] bg-white border border-[#7a0008]/12 rounded-[14px] text-[14px] text-[#1a2332] placeholder:text-[#4f0005]/25 focus:outline-none focus:bg-white focus:border-[#7a0008]/40 focus:shadow-[0_0_0_4px_rgba(122,0,8,0.08)] transition-all duration-200 ${
                            shakeFields.newPassword ? 'examai-shake border-red-400/60' : ''
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className={`absolute ${isRTL ? 'left-[14px]' : 'right-[14px]'} top-1/2 -translate-y-1/2 text-[#7a0008]/35 hover:text-[#7a0008]/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7a0008]/30 rounded-full transition-colors`}
                          aria-label={showPassword ? tr.hidePassword : tr.showPassword}
                          aria-pressed={showPassword}
                        >
                          {showPassword ? <EyeOff className="w-[17px] h-[17px]" strokeWidth={1.8} /> : <Eye className="w-[17px] h-[17px]" strokeWidth={1.8} />}
                        </button>
                      </div>

                      {/* Barre de force -- visible seulement une fois que la
                          personne a commence a taper, jamais avant. */}
                      {newPassword && (() => {
                        const strength = getPasswordStrength(newPassword)
                        const color = STRENGTH_COLORS[strength.level]
                        return (
                          <div className="mt-2.5">
                            <div className="flex gap-1.5" dir="ltr">
                              {[0, 1, 2, 3].map((i) => (
                                <div
                                  key={i}
                                  className="h-[5px] flex-1 rounded-full transition-colors duration-300"
                                  style={{ backgroundColor: i <= strength.level ? color : 'rgba(15,23,42,0.08)' }}
                                />
                              ))}
                            </div>
                            <p className="mt-1.5 text-[11.5px] font-semibold transition-colors duration-300" style={{ color }}>
                              {tr.strengthLabels[strength.level]}
                            </p>

                            {/* Conseils -- s'allument en vert au fur et a
                                mesure que chaque critere est rempli. Purement
                                indicatif, comme la barre ci-dessus. */}
                            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5">
                              {[
                                { met: newPassword.length >= 8, label: tr.hintLength },
                                { met: /[A-Z]/.test(newPassword), label: tr.hintUpper },
                                { met: /\d/.test(newPassword), label: tr.hintDigit },
                                { met: /[^A-Za-z0-9]/.test(newPassword), label: tr.hintSymbol },
                              ].map((hint, i) => (
                                <span
                                  key={i}
                                  className={`inline-flex items-center gap-1 text-[11px] font-medium transition-colors duration-200 ${
                                    hint.met ? 'text-[#2f855a]' : 'text-[#0f172a]/35'
                                  }`}
                                >
                                  {hint.met ? (
                                    <Check className="w-3 h-3 shrink-0" strokeWidth={3} />
                                  ) : (
                                    <Circle className="w-3 h-3 shrink-0" strokeWidth={2} />
                                  )}
                                  {hint.label}
                                </span>
                              ))}
                            </div>
                          </div>
                        )
                      })()}
                    </div>

                    <div>
                      <label htmlFor="confirm" className="block text-[12px] font-semibold text-[#4f0005]/70 mb-1.5">
                        {tr.confirmLabel}
                      </label>
                      <div className="relative">
                        <Lock
                          className={`absolute ${isRTL ? 'right-[15px]' : 'left-[15px]'} top-1/2 -translate-y-1/2 w-[17px] h-[17px] transition-colors duration-200 ${
                            focusField === 'confirm' ? 'text-[#7a0008]' : 'text-[#7a0008]/35'
                          }`}
                          strokeWidth={1.8}
                        />
                        <input
                          id="confirm"
                          type={showConfirm ? 'text' : 'password'}
                          autoComplete="new-password"
                          required
                          value={confirm}
                          onChange={(e) => handleFieldChange(setConfirm, 'confirm', e.target.value)}
                          onFocus={() => setFocusField('confirm')}
                          onBlur={() => setFocusField(null)}
                          onAnimationEnd={() => setShakeFields((prev) => ({ ...prev, confirm: false }))}
                          placeholder={tr.confirmPlaceholder}
                          className={`w-full ${isRTL ? 'pr-[44px] pl-12' : 'pl-[44px] pr-12'} py-[13px] bg-white border border-[#7a0008]/12 rounded-[14px] text-[14px] text-[#1a2332] placeholder:text-[#4f0005]/25 focus:outline-none focus:bg-white focus:border-[#7a0008]/40 focus:shadow-[0_0_0_4px_rgba(122,0,8,0.08)] transition-all duration-200 ${
                            shakeFields.confirm ? 'examai-shake border-red-400/60' : ''
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirm((v) => !v)}
                          className={`absolute ${isRTL ? 'left-[14px]' : 'right-[14px]'} top-1/2 -translate-y-1/2 text-[#7a0008]/35 hover:text-[#7a0008]/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7a0008]/30 rounded-full transition-colors`}
                          aria-label={showConfirm ? tr.hidePassword : tr.showPassword}
                          aria-pressed={showConfirm}
                        >
                          {showConfirm ? <EyeOff className="w-[17px] h-[17px]" strokeWidth={1.8} /> : <Eye className="w-[17px] h-[17px]" strokeWidth={1.8} />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="relative w-full flex items-center justify-center gap-2 py-[15px] px-4 rounded-full bg-[#7a0008] text-white text-[14px] font-semibold shadow-[0_1px_2px_rgba(79,0,5,0.2),0_10px_24px_-8px_rgba(122,0,8,0.55),inset_0_1px_0_rgba(255,255,255,0.15)] hover:bg-[#961014] disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7a0008]/40 focus-visible:ring-offset-2"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                          {tr.resetLoading}
                        </>
                      ) : (
                        <>
                          {tr.resetSubmit}
                          <ArrowRight className="w-4 h-4" strokeWidth={2.2} aria-hidden="true" />
                        </>
                      )}
                    </button>

                    <div className="flex items-center justify-between pt-1 text-[13px]">
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="inline-flex items-center gap-1.5 font-semibold text-[#7a0008] hover:text-[#4f0005] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7a0008]/30 rounded transition-colors"
                      >
                        <ArrowLeft className={`w-3.5 h-3.5 ${isRTL ? 'rotate-180' : ''}`} strokeWidth={2.2} />
                        {tr.changeEmail}
                      </button>
                      <button
                        type="button"
                        onClick={handleResendCode}
                        disabled={resending}
                        className="font-semibold text-[#7a0008]/70 hover:text-[#7a0008] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7a0008]/30 rounded transition-colors"
                      >
                        {resending ? tr.resendCodeLoading : tr.resendCode}
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}