import { useState, useCallback, useEffect, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import {
  Briefcase,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  ArrowRight,
  ChevronDown,
  Check,
  CheckCircle2,
  AlertCircle,
  X,
  PenLine,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'

let toastSeq = 0

// Vite n'expose au navigateur que les variables prefixees VITE_ (meme
// valeur que GOOGLE_CLIENT_ID cote backend, voir .env partage).
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

const STRINGS = {
  fr: {
    langName: 'Français',
    langNative: 'Français',
    langFlag: '🇫🇷',
    langMenuTitle: 'Langue',
    headingPart1: 'Accédez à votre',
    headingPart2: 'espace pédagogique.',
    subtitle: 'Connectez-vous pour créer vos examens en quelques clics.',
    emailLabel: 'Adresse e-mail',
    emailPlaceholder: 'votre@email.com',
    emailInvalid: 'Entrez une adresse e-mail valide.',
    emailRequired: "L'adresse e-mail est requise.",
    passwordLabel: 'Mot de passe',
    passwordPlaceholder: 'Votre mot de passe',
    passwordRequired: 'Le mot de passe est requis.',
    showPassword: 'Afficher le mot de passe',
    hidePassword: 'Masquer le mot de passe',
    remember: 'Se souvenir de moi',
    forgot: 'Mot de passe oublié ?',
    submitIdle: 'Se connecter',
    submitLoading: 'Connexion en cours…',
    or: 'ou',
    google: 'Continuer avec Google',
    googleLoading: 'Connexion…',
    googleNotReady: 'Google se charge encore, réessaie dans un instant.',
    noAccount: 'Pas encore de compte ?',
    createAccount: 'Créer un compte',
    readyBadge: 'Corrigé prêt',
    stampLabel: 'Vérifié',
    toastSuccess: 'Connexion réussie. Direction votre espace…',
    toastErrorDefault: 'Identifiants incorrects. Veuillez réessayer.',
    closeToast: 'Fermer la notification',
    langMenuLabel: 'Choisir la langue',
    toastRegionLabel: 'Notifications',
  },
  ar: {
    langName: 'Arabe',
    langNative: 'العربية',
    langFlag: '🇹🇳',
    langMenuTitle: 'اللغة',
    headingPart1: 'ادخل إلى',
    headingPart2: 'فضائك التربوي.',
    subtitle: 'سجّل الدخول لإنشاء امتحاناتك في بضع نقرات.',
    emailLabel: 'البريد الإلكتروني',
    emailPlaceholder: 'بريدك@الإلكتروني.com',
    emailInvalid: 'أدخل عنوان بريد إلكتروني صالحًا.',
    emailRequired: 'البريد الإلكتروني مطلوب.',
    passwordLabel: 'كلمة المرور',
    passwordPlaceholder: 'كلمة المرور الخاصة بك',
    passwordRequired: 'كلمة المرور مطلوبة.',
    showPassword: 'إظهار كلمة المرور',
    hidePassword: 'إخفاء كلمة المرور',
    remember: 'تذكّرني',
    forgot: 'نسيت كلمة المرور؟',
    submitIdle: 'تسجيل الدخول',
    submitLoading: 'جارٍ تسجيل الدخول…',
    or: 'أو',
    google: 'المتابعة باستخدام Google',
    googleLoading: 'جارٍ الاتصال…',
    googleNotReady: 'جوجل قيد التحميل، أعد المحاولة بعد لحظة.',
    noAccount: 'ليس لديك حساب؟',
    createAccount: 'إنشاء حساب',
    readyBadge: 'التصحيح جاهز',
    stampLabel: 'موثّق',
    toastSuccess: 'تم تسجيل الدخول بنجاح. جارٍ التوجيه…',
    toastErrorDefault: 'بيانات الدخول غير صحيحة. حاول مجددًا.',
    closeToast: 'إغلاق الإشعار',
    langMenuLabel: 'اختر اللغة',
    toastRegionLabel: 'الإشعارات',
  },
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, loginWithGoogle } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [form, setForm] = useState({ email: '', password: '', remember: true })
  const [shakeFields, setShakeFields] = useState({ email: false, password: false })
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [focusField, setFocusField] = useState(null)
  const [toasts, setToasts] = useState([])
  const [lang, setLang] = useState('fr')
  const [langOpen, setLangOpen] = useState(false)
  const tr = STRINGS[lang]
  const isRTL = lang === 'ar'

  const langMenuRef = useRef(null)
  const langButtonRef = useRef(null)
  const emailInputRef = useRef(null)
  const passwordInputRef = useRef(null)
  const toastTimers = useRef(new Map())
  const mounted = useRef(true)

  // Meme mecanique que sur Signup.jsx : un token client OAuth2 pilote "a
  // la main" pour garder notre propre bouton stylise plutot que celui de
  // Google, et une ref pour que le callback (fixe une fois pour toutes
  // par Google Identity Services) appelle toujours la derniere version
  // de la fonction (evite les "stale closures" sur tr/pushToast/etc.).
  const googleTokenClientRef = useRef(null)
  const handleGoogleResponseRef = useRef(() => {})

  useEffect(() => {
    emailInputRef.current?.focus()
    return () => {
      mounted.current = false
      toastTimers.current.forEach((timerId) => clearTimeout(timerId))
      toastTimers.current.clear()
    }
  }, [])

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

  // Reaffecte a chaque rendu pour que le callback Google appelle toujours
  // la version la plus recente (bonnes valeurs de tr/pushToast/navigate).
  useEffect(() => {
    handleGoogleResponseRef.current = async (response) => {
      if (response.error) {
        setGoogleLoading(false)
        if (response.error !== 'popup_closed' && response.error !== 'access_denied') {
          pushToast('error', tr.toastErrorDefault)
        }
        return
      }
      try {
        // Pas de champ "genre" sur cette page (pas d'inscription ici) :
        // s'il faut en creer un a la premiere connexion Google, le
        // backend applique son defaut ("femme") tout seul.
        await loginWithGoogle({ accessToken: response.access_token })
        pushToast('success', tr.toastSuccess)
        const from = location.state?.from?.pathname || '/wizard/selection'
        setTimeout(() => {
          if (mounted.current) navigate(from, { replace: true })
        }, 500)
      } catch (err) {
        pushToast('error', err?.message || tr.toastErrorDefault)
      } finally {
        setGoogleLoading(false)
      }
    }
  })

  // Chargement du script Google Identity Services + creation du token
  // client OAuth2, une seule fois au montage (voir Signup.jsx pour le
  // detail complet de ce mecanisme).
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      console.warn('[Login] VITE_GOOGLE_CLIENT_ID est manquant dans le .env du frontend.')
      return undefined
    }

    let cancelled = false

    function initTokenClient() {
      if (cancelled || !window.google?.accounts?.oauth2) return
      googleTokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: 'openid email profile',
        callback: (response) => handleGoogleResponseRef.current(response),
      })
    }

    if (window.google?.accounts?.oauth2) {
      initTokenClient()
    } else {
      const existing = document.getElementById('google-identity-services')
      if (existing) {
        existing.addEventListener('load', initTokenClient)
      } else {
        const script = document.createElement('script')
        script.id = 'google-identity-services'
        script.src = 'https://accounts.google.com/gsi/client'
        script.async = true
        script.defer = true
        script.onload = initTokenClient
        document.head.appendChild(script)
      }
    }

    return () => {
      cancelled = true
    }
  }, [])

  function handleGoogleClick() {
    if (!GOOGLE_CLIENT_ID) {
      pushToast('error', tr.toastErrorDefault)
      return
    }
    if (!googleTokenClientRef.current) {
      pushToast('error', tr.googleNotReady)
      return
    }
    setGoogleLoading(true)
    googleTokenClientRef.current.requestAccessToken()
  }

  function validate(values) {
    const next = { email: '', password: '' }
    if (!values.email.trim()) {
      next.email = tr.emailRequired
    } else if (!EMAIL_RE.test(values.email.trim())) {
      next.email = tr.emailInvalid
    }
    if (!values.password) {
      next.password = tr.passwordRequired
    }
    return next
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const nextErrors = validate(form)

    if (nextErrors.email || nextErrors.password) {
      setShakeFields({ email: Boolean(nextErrors.email), password: Boolean(nextErrors.password) })
      if (nextErrors.email) pushToast('error', nextErrors.email)
      if (nextErrors.password) pushToast('error', nextErrors.password)
      if (nextErrors.email) emailInputRef.current?.focus()
      else passwordInputRef.current?.focus()
      return
    }

    setLoading(true)
    try {
      await login({ email: form.email.trim(), password: form.password })
      pushToast('success', tr.toastSuccess)
      const from = location.state?.from?.pathname || '/wizard/selection'
      setTimeout(() => {
        if (mounted.current) navigate(from, { replace: true })
      }, 500)
    } catch (err) {
      pushToast(
        'error',
        err?.response?.data?.message || err?.message || tr.toastErrorDefault
      )
      setLoading(false)
    }
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
    if (shakeFields[name]) {
      setShakeFields((prev) => ({ ...prev, [name]: false }))
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
        @keyframes examaiFloat { 0%, 100% { transform: translateY(0) rotate(-4deg); } 50% { transform: translateY(-12px) rotate(-4deg); } }
        @keyframes examaiFloat2 { 0%, 100% { transform: translateY(0) rotate(5deg); } 50% { transform: translateY(-8px) rotate(5deg); } }
        @keyframes examaiPulse { 0% { box-shadow: 0 0 0 0 rgba(212,167,106,0.45); } 70% { box-shadow: 0 0 0 16px rgba(212,167,106,0); } 100% { box-shadow: 0 0 0 0 rgba(212,167,106,0); } }
        @keyframes examaiToastIn { from { opacity: 0; transform: translateX(-28px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes examaiToastOut { from { opacity: 1; transform: translateX(0); } to { opacity: 0; transform: translateX(-28px); } }
        @keyframes examaiSpinSlow { to { transform: rotate(360deg); } }
        @keyframes examaiShake { 10%, 90% { transform: translateX(-1px); } 20%, 80% { transform: translateX(2px); } 30%, 50%, 70% { transform: translateX(-3px); } 40%, 60% { transform: translateX(3px); } }
        @keyframes examaiStampIn { 0% { opacity: 0; transform: rotate(-24deg) scale(1.4); } 60% { opacity: 1; } 100% { opacity: 1; transform: rotate(-10deg) scale(1); } }
        @keyframes examaiLangMenuIn { from { opacity: 0; transform: translateY(-8px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }

        .examai-anim-1 { animation: examaiFadeUp 0.8s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .examai-anim-2 { animation: examaiFadeUp 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.1s both; }
        .examai-card-a { animation: examaiFloat 6s ease-in-out infinite; }
        .examai-card-b { animation: examaiFloat2 7s ease-in-out infinite; }
        .examai-badge { animation: examaiPulse 3s ease-out infinite; }
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
          .examai-anim-1, .examai-anim-2, .examai-card-a, .examai-card-b,
          .examai-badge, .examai-toast-enter, .examai-toast-leave,
          .examai-ring, .examai-shake, .examai-stamp,
          .examai-lang-menu {
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
      <header
        dir="ltr"
        className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-8 sm:px-12 py-6"
      >
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
            className="group flex items-center gap-2.5 pl-1.5 pr-2 py-1.5 rounded-full bg-white border border-[#0f172a]/12 shadow-[0_1px_2px_rgba(15,23,42,0.06),0_6px_16px_-8px_rgba(15,23,42,0.18),inset_0_1px_0_rgba(255,255,255,0.8)] hover:border-[#0f172a]/25 hover:shadow-[0_1px_2px_rgba(15,23,42,0.08),0_8px_20px_-8px_rgba(15,23,42,0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f172a]/30 transition-all duration-200"
          >
            <span className="relative flex items-center justify-center w-7 h-7 rounded-full bg-white ring-1 ring-[#d4a76a]/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
              <span className="text-[14px] leading-none" aria-hidden="true">
                {tr.langFlag}
              </span>
            </span>

            <span className="text-[12.5px] font-bold text-[#0f172a] tracking-wider">
              {lang.toUpperCase()}
            </span>

            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#0f172a]/[0.06] group-hover:bg-[#0f172a]/[0.10] transition-colors">
              <ChevronDown
                className={`w-3 h-3 text-[#0f172a]/70 transition-transform duration-300 ${langOpen ? 'rotate-180' : ''}`}
                strokeWidth={2.4}
              />
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
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#0f172a]/60">
                  {tr.langMenuTitle}
                </span>
              </div>

              <div className="p-1.5">
                {['fr', 'ar'].map((code) => {
                  const active = lang === code
                  const item = STRINGS[code]
                  return (
                    <button
                      key={code}
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => {
                        setLang(code)
                        setLangOpen(false)
                        langButtonRef.current?.focus()
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] transition-all duration-150 ${
                        active
                          ? 'bg-[#0f172a]/[0.08] text-[#0f172a] font-semibold'
                          : 'text-[#0f172a]/75 hover:bg-[#0f172a]/[0.05]'
                      }`}
                    >
                      <span
                        className={`flex items-center justify-center w-8 h-8 rounded-full ring-1 transition-all ${
                          active
                            ? 'bg-white ring-[#d4a76a]/50 shadow-[0_2px_6px_-2px_rgba(212,167,106,0.4)]'
                            : 'bg-white ring-[#0f172a]/10'
                        }`}
                      >
                        <span className="text-[15px] leading-none" aria-hidden="true">
                          {item.langFlag}
                        </span>
                      </span>

                      <span className="flex flex-col items-start leading-tight flex-1">
                        <span className={active ? 'text-[#0f172a]' : 'text-[#0f172a]'}>
                          {item.langNative}
                        </span>
                        <span className="text-[10.5px] text-[#0f172a]/50 font-medium">
                          {item.langName}
                        </span>
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

      {/* ===== Main centered content ===== */}
      <main className="relative z-10 w-full h-full flex items-center justify-center px-6 py-6 sm:py-8 overflow-y-auto">

        <div className="hidden xl:block absolute pointer-events-none inset-0" aria-hidden="true">

          <div className="examai-card-a absolute left-[8%] top-[26%] w-[220px] rounded-[18px] bg-white shadow-[0_24px_48px_-16px_rgba(15,23,42,0.35)] border border-[#0f172a]/8 overflow-hidden">
            <div className="flex items-center gap-1.5 px-4 py-3 border-b border-[#0f172a]/8 bg-white">
              <span className="w-2 h-2 rounded-full bg-[#0f172a]/20" />
              <span className="w-2 h-2 rounded-full bg-[#d4a76a]/60" />
              <span className="w-2 h-2 rounded-full bg-[#7a0008]/25" />
            </div>
            <div
              className="h-[140px]"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(to bottom, rgba(15,23,42,0.10) 0px, rgba(15,23,42,0.10) 0.5px, transparent 0.5px, transparent 28px)',
              }}
            />
          </div>

          <div className="examai-badge absolute left-[16%] top-[22%] w-16 h-16 rounded-full bg-[#7a0008] flex items-center justify-center shadow-[0_12px_24px_-8px_rgba(122,0,8,0.5)]">
            <PenLine className="w-7 h-7 text-white/95" strokeWidth={1.8} />
          </div>

          <div className="examai-card-b absolute right-[8%] top-[36%] w-[200px] rounded-[18px] bg-white shadow-[0_24px_48px_-16px_rgba(15,23,42,0.35)] border border-[#0f172a]/8 overflow-hidden">
            <div className="px-5 py-5">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-4 h-4 text-[#2f855a]" strokeWidth={2.4} />
                <span className="text-[10px] font-bold text-[#0f172a] uppercase tracking-wider">
                  {tr.readyBadge}
                </span>
              </div>
              <div className="examai-serif text-[30px] font-semibold text-[#0f172a] leading-none">
                20<span className="text-[16px] text-[#7a0008]/50">/20</span>
              </div>
              <div className="mt-3 h-1.5 rounded-full bg-[#0f172a]/10 overflow-hidden">
                <div className="h-full w-[92%] rounded-full bg-[#7a0008]" />
              </div>
            </div>
          </div>

          <div className="absolute right-[20%] top-[62%] w-12 h-12 rounded-full bg-white border border-[#d4a76a]/40 flex items-center justify-center shadow-[0_8px_16px_-6px_rgba(212,167,106,0.5)]">
            <Check className="w-5 h-5 text-[#d4a76a]" strokeWidth={2.6} />
          </div>
        </div>

        <div className="examai-anim-2 relative w-full max-w-[600px]">

          <div
            className="examai-stamp absolute -top-5 -right-4 sm:-top-6 sm:-right-6 z-20 pointer-events-none select-none"
            aria-hidden="true"
          >
            <div className="relative w-[68px] h-[68px] rotate-[-10deg]">
              <div className="absolute inset-0 rounded-full border-[1.5px] border-[#7a0008]/35" />
              <div className="absolute inset-[5px] rounded-full border border-[#7a0008]/25 bg-white flex flex-col items-center justify-center gap-0.5">
                <Check className="w-4 h-4 text-[#7a0008]/70" strokeWidth={3} />
                <span className="text-[7px] font-bold uppercase tracking-[0.1em] text-[#7a0008]/60 leading-none">
                  {tr.stampLabel}
                </span>
              </div>
            </div>
          </div>

          <div className="relative rounded-[32px] bg-white border border-[#0f172a]/10 shadow-[0_40px_80px_-24px_rgba(15,23,42,0.35),0_0_0_1px_rgba(255,255,255,0.5)_inset] overflow-hidden">

            <div className="h-1 w-full bg-[#7a0008]" />

            <div className="relative px-8 sm:px-10 py-9">

              <div className="text-center mb-8">
                <h2 className="examai-serif text-[26px] sm:text-[32px] lg:text-[36px] font-semibold tracking-[-0.025em] text-[#0f172a] leading-[1.15]">
                  {tr.headingPart1}
                  <br />
                  <span className="text-[#7a0008] relative">
                    <span className="examai-underline-wave">{tr.headingPart2}</span>
                  </span>
                </h2>
                <p className="examai-serif mt-4 text-[13px] sm:text-[13.5px] font-normal italic leading-[1.6] text-[#0f172a]/75 max-w-[360px] mx-auto">
                  {tr.subtitle}
                </p>
              </div>

              <form onSubmit={handleSubmit} noValidate className="space-y-4">

                {/* ✅ EMAIL — input style d'origine (bordure rouge, texte sombre) */}
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
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={form.email}
                      onChange={handleChange}
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

                {/* ✅ PASSWORD — input style d'origine (bordure rouge, texte sombre) */}
                <div>
                  <label htmlFor="password" className="block text-[12px] font-semibold text-[#4f0005]/70 mb-1.5">
                    {tr.passwordLabel}
                  </label>
                  <div className="relative">
                    <Lock
                      className={`absolute ${isRTL ? 'right-[15px]' : 'left-[15px]'} top-1/2 -translate-y-1/2 w-[17px] h-[17px] transition-colors duration-200 ${
                        focusField === 'password' ? 'text-[#7a0008]' : 'text-[#7a0008]/35'
                      }`}
                      strokeWidth={1.8}
                    />
                    <input
                      ref={passwordInputRef}
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      value={form.password}
                      onChange={handleChange}
                      onFocus={() => setFocusField('password')}
                      onBlur={() => setFocusField(null)}
                      onAnimationEnd={() => setShakeFields((prev) => ({ ...prev, password: false }))}
                      placeholder={tr.passwordPlaceholder}
                      className={`w-full ${isRTL ? 'pr-[44px] pl-12' : 'pl-[44px] pr-12'} py-[13px] bg-white border border-[#7a0008]/12 rounded-[14px] text-[14px] text-[#1a2332] placeholder:text-[#4f0005]/25 focus:outline-none focus:bg-white focus:border-[#7a0008]/40 focus:shadow-[0_0_0_4px_rgba(122,0,8,0.08)] transition-all duration-200 ${
                        shakeFields.password ? 'examai-shake border-red-400/60' : ''
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
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2.5 text-[13px] text-[#4f0005]/75 cursor-pointer select-none">
                    <span className="relative flex items-center justify-center">
                      <input
                        type="checkbox"
                        name="remember"
                        checked={form.remember}
                        onChange={handleChange}
                        className="peer appearance-none w-[18px] h-[18px] rounded-[5px] border border-[#7a0008]/25 bg-white cursor-pointer checked:bg-[#7a0008] checked:border-[#7a0008] transition-all duration-150"
                      />
                      <Check
                        className="absolute w-3 h-3 text-white pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity duration-150"
                        strokeWidth={3}
                      />
                    </span>
                    {tr.remember}
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-[13px] font-semibold text-[#7a0008] hover:text-[#4f0005] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7a0008]/30 rounded transition-colors"
                  >
                    {tr.forgot}
                  </Link>
                </div>

                <button
                  type="submit"
                  disabled={loading || googleLoading}
                  className="relative w-full flex items-center justify-center gap-2 py-[15px] px-4 rounded-full bg-[#7a0008] text-white text-[14px] font-semibold shadow-[0_1px_2px_rgba(79,0,5,0.2),0_10px_24px_-8px_rgba(122,0,8,0.55),inset_0_1px_0_rgba(255,255,255,0.15)] hover:bg-[#961014] disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7a0008]/40 focus-visible:ring-offset-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                      {tr.submitLoading}
                    </>
                  ) : (
                    <>
                      {tr.submitIdle}
                      <ArrowRight className="w-4 h-4" strokeWidth={2.2} aria-hidden="true" />
                    </>
                  )}
                </button>

                <div className="relative py-3">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full h-[1px] bg-[#7a0008]/15" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-white px-4 text-[11px] text-[#7a0008]/40 font-medium uppercase tracking-[0.15em]">
                      {tr.or}
                    </span>
                  </div>
                </div>

                {/* ✅ BOUTON GOOGLE — texte en rouge foncé, maintenant fonctionnel */}
                <button
                  type="button"
                  onClick={handleGoogleClick}
                  disabled={loading || googleLoading}
                  aria-busy={googleLoading}
                  className="w-full flex items-center justify-center gap-3 py-[12px] px-4 rounded-full bg-white border border-[#7a0008]/12 text-[13.5px] font-medium text-[#4f0005] shadow-[0_1px_2px_rgba(122,0,8,0.03)] hover:border-[#7a0008]/25 hover:shadow-[0_4px_12px_-4px_rgba(122,0,8,0.12)] disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7a0008]/30"
                >
                  {googleLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-[#7a0008]/70" aria-hidden="true" />
                      {tr.googleLoading}
                    </>
                  ) : (
                    <>
                      <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" aria-hidden="true">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
                        <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
                      </svg>
                      {tr.google}
                    </>
                  )}
                </button>

                <p className="pt-3 text-center text-[13px] text-[#4f0005]/55">
                  {tr.noAccount}{' '}
                  <Link
                    to="/signup"
                    className="font-semibold text-[#7a0008] underline decoration-[#7a0008]/30 underline-offset-2 hover:decoration-[#7a0008] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7a0008]/30 rounded transition-colors"
                  >
                    {tr.createAccount}
                  </Link>
                </p>
              </form>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}