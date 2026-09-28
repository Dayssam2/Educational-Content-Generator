import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  Briefcase,
  Sparkles,
  ArrowRight,
  Check,
  ChevronDown,
  CheckCircle2,
  Wand2,
  Stamp,
  Clock,
  BookOpen,
  Download,
  Twitter,
  Facebook,
  Linkedin,
  Mail,
} from 'lucide-react'

const STRINGS = {
  fr: {
    langName: 'Français',
    langNative: 'Français',
    langFlag: '🇫🇷',
    langMenuLabel: 'Choisir la langue',
    navSignIn: 'Se connecter',
    navSignUp: 'Commencer',
    heroHeadlinePart1: 'Créez vos examens',
    heroHeadlinePart2: 'en quelques minutes.',
    heroSubtitle:
      'ClassAssistant aide les enseignants du primaire à générer, personnaliser et corriger leurs examens grâce à l’intelligence artificielle.',
    heroCtaPrimary: 'Commencer gratuitement',
    heroCtaSecondary: 'J’ai déjà un compte',
    mockupTabLabel: '6ème année — Primaire',
    mockupGenerateBtn: 'Générer',
    mockupReadyLabel: 'Corrigé prêt',
    mockupVerified: 'Vérifié',
    howTitle: 'Comment ça marche',
    howSubtitle: 'Trois étapes simples pour un examen complet.',
    howStep1Title: 'Décrivez votre sujet',
    howStep1Desc: 'Choisissez la matière, le niveau et le thème. Ajoutez vos instructions.',
    howStep2Title: 'L’IA génère l’examen',
    howStep2Desc: 'En quelques secondes, obtenez un sujet structuré avec barème et corrigé.',
    howStep3Title: 'Personnalisez et exportez',
    howStep3Desc: 'Modifiez, réorganisez, puis exportez en PDF prêt à imprimer.',
    footerMadeIn: 'Conçu en Tunisie',
    footerRights: 'Tous droits réservés.',
  },
  ar: {
    langName: 'Arabe',
    langNative: 'العربية',
    langFlag: '🇹🇳',
    langMenuLabel: 'اختر اللغة',
    navSignIn: 'تسجيل الدخول',
    navSignUp: 'ابدأ الآن',
    heroHeadlinePart1: 'أنشئ امتحاناتك',
    heroHeadlinePart2: 'في دقائق معدودة.',
    heroSubtitle:
      'يساعد ClassAssistant معلمي المرحلة الابتدائية على إنشاء الامتحانات وتخصيصها وتصحيحها بالذكاء الاصطناعي.',
    heroCtaPrimary: 'ابدأ مجانًا',
    heroCtaSecondary: 'لدي حساب بالفعل',
    mockupTabLabel: 'السنة السادسة — ابتدائي',
    mockupGenerateBtn: 'إنشاء',
    mockupReadyLabel: 'التصحيح جاهز',
    mockupVerified: 'موثّق',
    howTitle: 'كيف يعمل',
    howSubtitle: 'ثلاث خطوات بسيطة للحصول على امتحان كامل.',
    howStep1Title: 'صِف موضوعك',
    howStep1Desc: 'اختر المادة والمستوى والموضوع. أضف تعليماتك.',
    howStep2Title: 'الذكاء الاصطناعي يُنشئ الامتحان',
    howStep2Desc: 'في ثوانٍ، احصل على امتحان منظّم مع سلّم التنقيط والتصحيح.',
    howStep3Title: 'خصّص وصدّر',
    howStep3Desc: 'عدّل، أعد الترتيب، ثم صدّر بصيغة PDF جاهزة للطباعة.',
    footerMadeIn: 'صُنع في تونس',
    footerRights: 'جميع الحقوق محفوظة.',
  },
}

export default function Home() {
  const [lang, setLang] = useState('fr')
  const [langOpen, setLangOpen] = useState(false)
  const tr = STRINGS[lang]
  const isRTL = lang === 'ar'

  const langMenuRef = useRef(null)
  const langButtonRef = useRef(null)

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

  return (
    <div
      dir="ltr"
      lang={lang}
      className={`examai-home relative min-h-screen flex flex-col bg-white text-[#0f172a] overflow-hidden ${isRTL ? 'examai-ar' : ''}`}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-full focus:bg-white focus:text-[#7a0008] focus:shadow-lg focus:px-4 focus:py-2 focus:text-[13px] focus:font-semibold"
      >
        {lang === 'ar' ? 'الانتقال إلى المحتوى الرئيسي' : 'Aller au contenu principal'}
      </a>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700;9..144,800;9..144,900&family=Manrope:wght@400;500;600;700;800&family=Cairo:wght@400;500;600;700;800;900&display=swap');

        html { scroll-behavior: smooth; }
        .examai-home {
          font-family: 'Manrope', system-ui, sans-serif;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          text-rendering: optimizeLegibility;
        }
        .examai-serif {
          font-family: 'Fraunces', Georgia, serif;
          font-feature-settings: 'liga' 1, 'kern' 1, 'ss01' 1;
          font-optical-sizing: auto;
        }
        .examai-ar, .examai-ar .examai-serif { font-family: 'Cairo', 'Manrope', system-ui, sans-serif; }

        @keyframes examaiFadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes examaiFloat { 0%, 100% { transform: translateY(0) rotate(-3deg); } 50% { transform: translateY(-10px) rotate(-3deg); } }
        @keyframes examaiFloat2 { 0%, 100% { transform: translateY(0) rotate(3deg); } 50% { transform: translateY(-8px) rotate(3deg); } }
        @keyframes examaiFloat3 { 0%, 100% { transform: translateY(0) rotate(2deg); } 50% { transform: translateY(-12px) rotate(2deg); } }
        @keyframes examaiBlob { 0%, 100% { border-radius: 42% 58% 63% 37% / 41% 44% 56% 59%; } 50% { border-radius: 58% 42% 37% 63% / 59% 56% 44% 41%; } }
        @keyframes examaiLangMenuIn { from { opacity: 0; transform: translateY(-8px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes examaiTwinkle { 0%, 100% { opacity: 1; transform: scale(1) rotate(0deg); } 50% { opacity: 0.55; transform: scale(0.85) rotate(15deg); } }
        @keyframes examaiSpinSlow { to { transform: rotate(360deg); } }
        @keyframes examaiShine { 0% { transform: translateX(-120%) skewX(-20deg); } 100% { transform: translateX(220%) skewX(-20deg); } }

        .examai-anim-1 { animation: examaiFadeUp 0.8s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .examai-anim-2 { animation: examaiFadeUp 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.1s both; }
        .examai-anim-3 { animation: examaiFadeUp 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.2s both; }
        .examai-card-a { animation: examaiFloat 6s ease-in-out infinite; }
        .examai-card-b { animation: examaiFloat2 7s ease-in-out infinite; }
        .examai-card-c { animation: examaiFloat3 8s ease-in-out infinite; }
        .examai-blob { animation: examaiBlob 18s ease-in-out infinite; }
        .examai-ring { animation: examaiSpinSlow 80s linear infinite; }
        .examai-lang-menu { animation: examaiLangMenuIn 0.22s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .examai-twinkle { animation: examaiTwinkle 2.4s ease-in-out infinite; }

        .examai-logo-shine::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 40%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent);
          animation: examaiShine 3.6s ease-in-out infinite;
          pointer-events: none;
        }

        .examai-underline-wave {
          background-color: rgba(122,0,8,0.12);
          background-repeat: no-repeat;
          background-size: 100% 0.35em;
          background-position: 0 88%;
          padding: 0 0.15em;
        }

        .examai-grid-bg {
          background-image: radial-gradient(circle, rgba(15,23,42,0.08) 1px, transparent 1px);
          background-size: 26px 26px;
        }

        @media (prefers-reduced-motion: reduce) {
          .examai-anim-1, .examai-anim-2, .examai-anim-3,
          .examai-card-a, .examai-card-b, .examai-card-c, .examai-blob,
          .examai-ring, .examai-lang-menu, .examai-twinkle,
          .examai-logo-shine::after, html {
            animation: none !important;
            scroll-behavior: auto !important;
          }
        }
      `}</style>

      {/* ===== Header ===== */}
      <header className="relative z-50 shrink-0 backdrop-blur-xl bg-white/85 border-b border-[#0f172a]/10">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 h-[60px] flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-3 shrink-0 group">
            <div className="relative shrink-0">
              <div className="examai-logo-shine relative w-9 h-9 rounded-[12px] bg-[#7a0008] flex items-center justify-center shadow-[0_5px_14px_-5px_rgba(122,0,8,0.55),inset_0_1px_0_rgba(255,255,255,0.22)] overflow-hidden">
                <div className="absolute top-0.5 left-1 w-3.5 h-1 rounded-full bg-white/30 blur-[2px]" />
                <Briefcase className="relative w-[17px] h-[17px] text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)]" strokeWidth={1.9} />
              </div>
            </div>
            <span className="examai-serif text-[17px] tracking-[-0.015em] leading-none">
              <span className="font-medium text-[#0f172a]">Class</span>
              <span className="font-semibold text-[#7a0008]">Assistant</span>
            </span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-2.5">
            <div className="relative">
              <button
                ref={langButtonRef}
                type="button"
                onClick={() => setLangOpen((v) => !v)}
                aria-haspopup="listbox"
                aria-expanded={langOpen}
                aria-label={tr.langMenuLabel}
                className="group flex items-center gap-1.5 pl-1 pr-1.5 py-1 rounded-full bg-white border border-[#0f172a]/15 shadow-[0_1px_2px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,0.8)] hover:border-[#0f172a]/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f172a]/30 transition-all"
              >
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#f6eeec] ring-1 ring-[#d4a76a]/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                  <span className="text-[11px] leading-none" aria-hidden="true">{tr.langFlag}</span>
                </span>
                <span className="text-[10.5px] font-bold text-[#0f172a] tracking-wider">{lang.toUpperCase()}</span>
                <span className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-[#0f172a]/[0.06] group-hover:bg-[#0f172a]/[0.10] transition-colors">
                  <ChevronDown
                    className={`w-2 h-2 text-[#0f172a]/70 transition-transform duration-300 ${langOpen ? 'rotate-180' : ''}`}
                    strokeWidth={2.6}
                  />
                </span>
              </button>

              {langOpen && (
                <div
                  ref={langMenuRef}
                  role="listbox"
                  aria-label={tr.langMenuLabel}
                  className="examai-lang-menu absolute top-[calc(100%+8px)] right-0 w-48 rounded-2xl bg-white border border-[#0f172a]/12 shadow-[0_24px_48px_-16px_rgba(15,23,42,0.35),0_0_0_1px_rgba(255,255,255,0.6)_inset] overflow-hidden z-30"
                >
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
                          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-[12.5px] transition-all duration-150 ${
                            active
                              ? 'bg-[#0f172a]/[0.08] text-[#0f172a] font-semibold'
                              : 'text-[#0f172a]/75 hover:bg-[#0f172a]/[0.05]'
                          }`}
                        >
                          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-white ring-1 ring-[#d4a76a]/30" aria-hidden="true">
                            <span className="text-[12px] leading-none">{item.langFlag}</span>
                          </span>
                          <span className="flex-1 text-left">{item.langNative}</span>
                          {active && <Check className="w-3 h-3 text-[#0f172a]" strokeWidth={3} />}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            <Link
              to="/login"
              className="hidden sm:inline-flex text-[12px] font-semibold text-[#0f172a]/80 hover:text-[#7a0008] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f172a]/25 rounded px-2 py-1"
            >
              {tr.navSignIn}
            </Link>
            <Link
              to="/signup"
              className="group inline-flex items-center gap-1.5 rounded-full bg-[#7a0008] text-white px-3.5 sm:px-4 py-2 text-[11.5px] sm:text-[12px] font-semibold shadow-[0_1px_2px_rgba(15,23,42,0.2),0_6px_16px_-5px_rgba(122,0,8,0.45),inset_0_1px_0_rgba(255,255,255,0.15)] hover:bg-[#961014] transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7a0008]/40 focus-visible:ring-offset-2"
            >
              {tr.navSignUp}
              <ArrowRight className="w-3 h-3 transition-transform duration-200 group-hover:translate-x-0.5" strokeWidth={2.2} />
            </Link>
          </div>
        </div>
      </header>

      {/* ===== Main ===== */}
      <main id="main-content" className="relative flex-1 flex flex-col min-h-0">
        <div className="absolute inset-0 examai-grid-bg opacity-[0.3] pointer-events-none" style={{ maskImage: 'radial-gradient(ellipse at center, black 0%, transparent 75%)', WebkitMaskImage: 'radial-gradient(ellipse at center, black 0%, transparent 75%)' }} />
        <div className="examai-blob absolute -top-32 -left-32 w-[480px] h-[480px] opacity-25 pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(15,23,42,0.14) 0%, transparent 65%)' }} />
        <div className="examai-blob absolute -bottom-40 -right-32 w-[500px] h-[500px] opacity-20 pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(122,0,8,0.14) 0%, transparent 65%)', animationDelay: '-8s' }} />

        <div className="relative flex-1 flex flex-col min-h-0 px-6 sm:px-10 py-4 sm:py-6">
          <div className="max-w-7xl mx-auto w-full flex-1 flex flex-col justify-center gap-4 sm:gap-6">

            {/* ===== HERO ===== */}
            <section className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
              <div className="examai-anim-1">
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-white border border-[#0f172a]/40 shadow-[0_2px_10px_-2px_rgba(15,23,42,0.4)]">
                  <Sparkles className="examai-twinkle w-4 h-4 text-[#7a0008]" strokeWidth={2} />
                </span>

                <h1 className={`examai-serif mt-3 text-[30px] sm:text-[40px] lg:text-[46px] font-semibold tracking-[-0.025em] text-[#0f172a] leading-[1.15]`}>
                  {tr.heroHeadlinePart1}
                  <br />
                  <span className="text-[#7a0008] relative">
                    <span className="examai-underline-wave">{tr.heroHeadlinePart2}</span>
                  </span>
                </h1>

                <p className="examai-serif mt-3 text-[14px] sm:text-[15px] font-normal italic leading-[1.6] text-[#0f172a]/75 max-w-[480px]">
                  {tr.heroSubtitle}
                </p>

                <div className="mt-5 flex flex-col sm:flex-row gap-3">
                  <Link
                    to="/signup"
                    className="group relative inline-flex items-center justify-center gap-2 rounded-full bg-[#7a0008] text-white px-6 py-3 text-[13px] font-semibold shadow-[0_1px_2px_rgba(15,23,42,0.2),0_10px_22px_-8px_rgba(122,0,8,0.55),inset_0_1px_0_rgba(255,255,255,0.15)] hover:bg-[#961014] transition-all active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7a0008]/40 focus-visible:ring-offset-2 overflow-hidden"
                  >
                    <span className="relative z-10 flex items-center gap-2">
                      {tr.heroCtaPrimary}
                      <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-1" strokeWidth={2.2} />
                    </span>
                  </Link>
                  <Link
                    to="/login"
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-white border border-[#0f172a]/15 text-[#0f172a] px-6 py-3 text-[13px] font-semibold hover:border-[#0f172a]/30 hover:shadow-[0_6px_16px_-6px_rgba(15,23,42,0.15)] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f172a]/25 focus-visible:ring-offset-2"
                  >
                    {tr.heroCtaSecondary}
                  </Link>
                </div>
              </div>

              {/* Mockup */}
              <div className="examai-anim-2 relative">
                <div className="absolute -inset-8 rounded-[48px] bg-[#0f172a]/[0.06] blur-3xl -z-10" />

                <div className="relative rounded-[26px] bg-white shadow-[0_36px_72px_-24px_rgba(15,23,42,0.32),inset_0_1px_0_rgba(255,255,255,0.7)] border border-[#0f172a]/8 overflow-hidden max-w-[440px] mx-auto">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[#0f172a]/8 bg-[#fdfbfc]">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#0f172a]/20" />
                      <span className="w-2 h-2 rounded-full bg-[#d4a76a]/60" />
                      <span className="w-2 h-2 rounded-full bg-[#7a0008]/25" />
                    </div>
                    <span className="text-[11px] font-semibold text-[#0f172a]/55">{tr.mockupTabLabel}</span>
                    <span className="w-3" />
                  </div>

                  <div className="p-5 space-y-3">
                    <div className="h-2.5 w-3/5 rounded-full bg-[#0f172a]/15" />
                    <div className="h-2 w-full rounded-full bg-[#0f172a]/8" />
                    <div className="h-2 w-4/5 rounded-full bg-[#0f172a]/8" />
                    <div className="h-2 w-full rounded-full bg-[#0f172a]/8" />
                    <div className="h-2 w-2/3 rounded-full bg-[#0f172a]/8" />

                    <div className="pt-3 mt-3 border-t border-dashed border-[#0f172a]/15">
                      <div className="flex items-start gap-2">
                        <div className="w-4 h-4 rounded-full bg-[#2f855a]/15 flex items-center justify-center shrink-0 mt-0.5">
                          <Check className="w-2.5 h-2.5 text-[#2f855a]" strokeWidth={3} />
                        </div>
                        <div className="flex-1 space-y-2">
                          <div className="h-1.5 w-5/6 rounded-full bg-[#0f172a]/10" />
                          <div className="h-1.5 w-3/4 rounded-full bg-[#0f172a]/10" />
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 flex items-center justify-between">
                      <div className="h-2 w-1/4 rounded-full bg-[#d4a76a]/40" />
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#7a0008] text-white text-[11px] font-semibold px-3.5 py-2 shadow-[0_4px_12px_-4px_rgba(122,0,8,0.5)]">
                        <Wand2 className="w-3 h-3" strokeWidth={2.2} />
                        {tr.mockupGenerateBtn}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="examai-card-b absolute -top-4 -right-3 sm:-right-6 rounded-[16px] bg-white shadow-[0_18px_36px_-14px_rgba(15,23,42,0.38)] border border-[#0f172a]/8 px-3.5 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#2f855a]" strokeWidth={2.4} />
                    <span className="text-[10px] font-bold text-[#0f172a] uppercase tracking-wider">{tr.mockupReadyLabel}</span>
                  </div>
                  <div className="examai-serif text-[22px] font-semibold text-[#0f172a] leading-none mt-1">
                    20<span className="text-[12px] text-[#7a0008]/50">/20</span>
                  </div>
                </div>

                <div className="examai-card-c absolute -bottom-2.5 -left-2.5 sm:-left-6 hidden sm:block">
                  <div className="relative w-[62px] h-[62px] rotate-[-12deg]">
                    <div className="absolute inset-0 rounded-full border-[1.5px] border-[#0f172a]/35 bg-white/70 backdrop-blur-sm" />
                    <div className="absolute inset-[5px] rounded-full border border-[#0f172a]/25 flex flex-col items-center justify-center gap-0.5">
                      <Stamp className="w-3.5 h-3.5 text-[#0f172a]/70" strokeWidth={2.2} />
                      <span className="text-[6px] font-bold uppercase tracking-[0.1em] text-[#0f172a]/60 leading-none">
                        {tr.mockupVerified}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="examai-card-a absolute top-1/2 -left-6 sm:-left-9 hidden lg:flex items-center gap-1.5 rounded-full bg-white shadow-[0_12px_24px_-8px_rgba(15,23,42,0.28)] border border-[#0f172a]/8 px-3 py-2">
                  <Clock className="w-3.5 h-3.5 text-[#7a0008]/60" strokeWidth={2.2} />
                  <span className="text-[11px] font-bold text-[#0f172a]">2 min</span>
                </div>
              </div>
            </section>

            {/* ===== COMMENT ÇA MARCHE ===== */}
            <section
              id="how"
              className="relative border-t border-[#0f172a]/8 pt-5 sm:pt-6"
            >
              <div className="text-center max-w-2xl mx-auto examai-anim-3">
                <h2 className="examai-serif text-[20px] sm:text-[26px] font-semibold text-[#0f172a] tracking-[-0.02em] leading-[1.15]">
                  {tr.howTitle}
                </h2>
                <p className="mt-1.5 text-[12px] text-[#0f172a]/65">
                  {tr.howSubtitle}
                </p>
              </div>

              <div className="mt-5 sm:mt-6 grid md:grid-cols-3 gap-5 relative">
                <div
                  className="hidden md:block absolute top-[30px] left-[16%] right-[16%] h-[1.5px] bg-[#0f172a]/15"
                  aria-hidden="true"
                />

                {[
                  { num: '1', icon: BookOpen, title: tr.howStep1Title, desc: tr.howStep1Desc },
                  { num: '2', icon: Wand2, title: tr.howStep2Title, desc: tr.howStep2Desc },
                  { num: '3', icon: Download, title: tr.howStep3Title, desc: tr.howStep3Desc },
                ].map(({ num, icon: Icon, title, desc }, idx) => (
                  <div
                    key={idx}
                    className="relative text-center examai-anim-3"
                    style={{ animationDelay: `${idx * 0.1}s` }}
                  >
                    <div className="relative inline-flex items-center justify-center w-[60px] h-[60px] rounded-full bg-white border border-[#0f172a]/15 shadow-[0_6px_18px_-6px_rgba(15,23,42,0.25)] mb-3">
                      <div className="w-9 h-9 rounded-[11px] bg-[#7a0008] flex items-center justify-center shadow-[0_4px_14px_-4px_rgba(122,0,8,0.5),inset_0_1px_0_rgba(255,255,255,0.22)]">
                        <Icon className="w-[16px] h-[16px] text-white" strokeWidth={1.9} />
                      </div>
                      <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-white border border-[#0f172a]/20 flex items-center justify-center text-[10px] font-bold text-[#0f172a]">
                        {num}
                      </span>
                    </div>
                    <h3 className="examai-serif text-[14.5px] font-semibold text-[#0f172a]">
                      {title}
                    </h3>
                    <p className="examai-serif mt-1.5 text-[13px] font-normal italic leading-[1.55] text-[#0f172a]/70 max-w-[260px] mx-auto">
                      {desc}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* ===== Footer ===== */}
      <footer className="relative z-10 shrink-0 border-t border-[#0f172a]/10 bg-white/40 px-6 sm:px-10 py-3">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <div className="w-6 h-6 rounded-[8px] bg-[#7a0008] flex items-center justify-center shadow-[0_3px_8px_-3px_rgba(122,0,8,0.4)]">
              <Briefcase className="w-[11px] h-[11px] text-white" strokeWidth={2} />
            </div>
            <span className="examai-serif text-[13px] tracking-[-0.01em] leading-none">
              <span className="font-medium text-[#0f172a]">Class</span>
              <span className="font-semibold text-[#7a0008]">Assistant</span>
            </span>
          </Link>

          <p className="text-[10.5px] text-[#0f172a]/55 text-center flex items-center gap-2 flex-wrap justify-center">
            <span className="inline-flex items-center gap-1">
              <span className="text-[11px] leading-none" aria-hidden="true">🇹🇳</span>
              {tr.footerMadeIn}
            </span>
            <span className="text-[#0f172a]/30">•</span>
            <span>© {new Date().getFullYear()} {tr.footerRights}</span>
          </p>

          <div className="flex items-center gap-1.5">
            {[
              { icon: Twitter, label: 'Twitter / X', href: '#' },
              { icon: Facebook, label: 'Facebook', href: '#' },
              { icon: Linkedin, label: 'LinkedIn', href: '#' },
              { icon: Mail, label: 'Email', href: 'mailto:contact@classassistant.tn' },
            ].map(({ icon: Icon, label, href }) => (
              <a
                key={label}
                href={href}
                aria-label={label}
                className="w-6 h-6 rounded-full bg-white border border-[#0f172a]/12 flex items-center justify-center text-[#0f172a]/65 hover:text-[#0f172a] hover:border-[#0f172a]/30 hover:shadow-[0_4px_12px_-4px_rgba(15,23,42,0.2)] transition-all"
              >
                <Icon className="w-2.5 h-2.5" strokeWidth={2} />
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  )
}