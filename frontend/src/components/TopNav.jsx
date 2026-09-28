import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  Briefcase, ChevronDown, Check, Menu, X, LogOut,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'

const LINKS = [
  { to: '/wizard/selection', label: 'Nouvel examen' },
  { to: '/mes-examens',      label: 'Mes examens' },
  { to: '/banque-questions', label: 'Banque de questions' },
  { to: '/assistant',        label: 'Aide' },
]

const LANGS = {
  fr: { code: 'FR', flag: '🇫🇷', native: 'Français' },
  ar: { code: 'AR', flag: '🇹🇳', native: 'العربية' },
}

export default function TopNav() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const [lang, setLang] = useState('fr')
  const [langOpen, setLangOpen] = useState(false)
  const [menuMobile, setMenuMobile] = useState(false)
  const [menuUser, setMenuUser] = useState(false)

  const langMenuRef = useRef(null)
  const langButtonRef = useRef(null)
  const userMenuRef = useRef(null)
  const userButtonRef = useRef(null)

  useEffect(() => {
    function handlePointerDown(e) {
      if (
        langOpen &&
        langMenuRef.current && !langMenuRef.current.contains(e.target) &&
        !langButtonRef.current?.contains(e.target)
      ) setLangOpen(false)

      if (
        menuUser &&
        userMenuRef.current && !userMenuRef.current.contains(e.target) &&
        !userButtonRef.current?.contains(e.target)
      ) setMenuUser(false)
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        setLangOpen(false)
        setMenuUser(false)
        setMenuMobile(false)
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [langOpen, menuUser])

  useEffect(() => {
    if (menuMobile) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [menuMobile])

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  const initials = (user?.nom || '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const isActive = (to) =>
    location.pathname === to ||
    (to === '/wizard/selection' && location.pathname.startsWith('/wizard'))

  return (
    <header className="sticky top-0 z-30 border-b border-[#0f172a]/10 bg-white/85 backdrop-blur-xl shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-16px_rgba(15,23,42,0.18)]">
      <style>{`
        @keyframes examaiShine { 0% { transform: translateX(-120%) skewX(-20deg); } 100% { transform: translateX(220%) skewX(-20deg); } }
        @keyframes examaiMenuIn { from { opacity: 0; transform: translateY(-8px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes examaiNavIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes examaiMobileIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }

        .examai-logo-shine::after {
          content: '';
          position: absolute;
          top: 0; left: 0;
          width: 40%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent);
          animation: examaiShine 3.6s ease-in-out infinite;
          pointer-events: none;
        }
        .examai-menu { animation: examaiMenuIn 0.22s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .examai-nav-item { animation: examaiNavIn 0.3s ease-out both; }
        .examai-mobile-menu { animation: examaiMobileIn 0.25s cubic-bezier(0.22, 1, 0.36, 1) both; }

        @media (prefers-reduced-motion: reduce) {
          .examai-logo-shine::after, .examai-menu, .examai-nav-item, .examai-mobile-menu { animation: none !important; }
        }
      `}</style>

      {/* Grille de fond subtile */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.4]"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(15,23,42,0.06) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
          maskImage: 'linear-gradient(180deg, black 0%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(180deg, black 0%, transparent 100%)',
        }} />

      <div className="relative mx-auto flex h-[64px] max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">

        {/* ===== Logo ===== */}
        <Link to="/wizard/selection" className="group flex shrink-0 items-center gap-3">
          <div className="relative shrink-0">
            <div className="examai-logo-shine relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-[13px] bg-[#7a0008] shadow-[0_6px_16px_-6px_rgba(122,0,8,0.6),inset_0_1px_0_rgba(255,255,255,0.24)] transition-all duration-300 group-hover:scale-[1.05] group-hover:shadow-[0_8px_20px_-6px_rgba(122,0,8,0.7)]">
              <div className="absolute top-0.5 left-1 h-1 w-4 rounded-full bg-white/35 blur-[2px]" />
              <Briefcase className="relative h-[18px] w-[18px] text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]" strokeWidth={1.9} />
            </div>
          </div>
          <span className="examai-serif text-[17px] tracking-[-0.018em] leading-none">
            <span className="font-medium text-[#0f172a]">Class</span>
            <span className="font-semibold text-[#7a0008]">Assistant</span>
          </span>
        </Link>

        {/* ===== Nav desktop ===== */}
        <nav className="hidden items-center gap-0.5 text-[13.5px] md:flex">
          {LINKS.map(({ to, label }, idx) => {
            const active = isActive(to)
            return (
              <Link
                key={to}
                to={to}
                className={`examai-nav-item group relative flex items-center px-4 py-2.5 transition-colors duration-200 ${
                  active
                    ? 'font-bold text-[#7a0008]'
                    : 'font-medium text-[#0f172a]/70 hover:text-[#7a0008]'
                }`}
                style={{ animationDelay: `${idx * 40}ms` }}
              >
                <span className="relative">
                  {label}
                  {!active && (
                    <span className="absolute -bottom-1 left-0 right-0 h-[1.5px] origin-left scale-x-0 rounded-full bg-[#7a0008]/40 transition-transform duration-300 group-hover:scale-x-100" />
                  )}
                </span>

                {active && (
                  <span className="absolute bottom-0 left-4 right-4 h-[2px] rounded-full bg-[#7a0008]" />
                )}
              </Link>
            )
          })}
        </nav>

        {/* ===== Actions droite ===== */}
        <div className="flex items-center gap-2">

          {/* Sélecteur de langue */}
          <div className="relative hidden sm:block">
            <button
              ref={langButtonRef}
              type="button"
              onClick={() => setLangOpen((v) => !v)}
              aria-haspopup="listbox"
              aria-expanded={langOpen}
              aria-label="Choisir la langue"
              className="group flex items-center gap-1.5 rounded-full border border-[#0f172a]/12 bg-white py-1 pl-1 pr-1.5 shadow-[0_1px_2px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,0.8)] transition-all duration-200 hover:-translate-y-[1px] hover:border-[#0f172a]/25 hover:shadow-[0_4px_10px_-4px_rgba(15,23,42,0.25),inset_0_1px_0_rgba(255,255,255,0.8)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f172a]/30"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] ring-1 ring-[#d4a76a]/40">
                <span className="text-[11px] leading-none" aria-hidden="true">{LANGS[lang].flag}</span>
              </span>
              <span className="text-[10.5px] font-bold tracking-wider text-[#0f172a]">{LANGS[lang].code}</span>
              <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#0f172a]/[0.06] transition-colors group-hover:bg-[#0f172a]/[0.12]">
                <ChevronDown
                  className={`h-2 w-2 text-[#0f172a]/70 transition-transform duration-300 ${langOpen ? 'rotate-180' : ''}`}
                  strokeWidth={2.6}
                />
              </span>
            </button>

            {langOpen && (
              <div
                ref={langMenuRef}
                role="listbox"
                aria-label="Choisir la langue"
                className="examai-menu absolute right-0 top-[calc(100%+8px)] z-30 w-44 overflow-hidden rounded-2xl border border-[#0f172a]/12 bg-white shadow-[0_24px_48px_-16px_rgba(15,23,42,0.35),0_0_0_1px_rgba(255,255,255,0.6)_inset] backdrop-blur-xl"
              >
                <div className="p-1.5">
                  {Object.entries(LANGS).map(([code, item]) => {
                    const active = lang === code
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
                        className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-[12.5px] transition-all duration-150 ${
                          active
                            ? 'bg-[#0f172a]/[0.08] font-semibold text-[#0f172a]'
                            : 'text-[#0f172a]/75 hover:bg-[#0f172a]/[0.05]'
                        }`}
                      >
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white ring-1 ring-[#d4a76a]/30" aria-hidden="true">
                          <span className="text-[12px] leading-none">{item.flag}</span>
                        </span>
                        <span className="flex-1 text-left">{item.native}</span>
                        {active && <Check className="h-3 w-3 text-[#0f172a]" strokeWidth={3} />}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Avatar + nom dans un div rouge + bouton logout à droite */}
          <div className="relative">
            <div className="group flex items-center gap-2 rounded-full border border-[#0f172a]/10 bg-white py-1 pl-1 pr-1.5 transition-all duration-200 hover:border-[#0f172a]/25 hover:shadow-[0_6px_16px_-8px_rgba(15,23,42,0.3)]">

              {/* Zone cliquable : avatar + nom + chevron → ouvre le menu */}
              <button
                ref={userButtonRef}
                type="button"
                onClick={() => setMenuUser((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={menuUser}
                aria-label="Mon compte"
                className="flex items-center gap-2 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f172a]/30"
              >
                {/* Avatar rond rouge */}
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#7a0008] text-[11px] font-semibold text-white shadow-[0_3px_8px_-3px_rgba(122,0,8,0.4)]">
                  {initials}
                </div>

                {/* Nom dans un div rouge */}
                <div className="hidden items-center gap-1.5 rounded-full bg-[#7a0008]/[0.08] px-2.5 py-1 sm:flex">
                  <span className="text-[12.5px] font-semibold text-[#7a0008] max-w-[110px] truncate">
                    {user?.nom}
                  </span>
                  <ChevronDown
                    size={11}
                    className={`text-[#7a0008]/70 transition-transform duration-300 ${menuUser ? 'rotate-180' : ''}`}
                    strokeWidth={2.6}
                  />
                </div>
              </button>

              {/* Bouton de déconnexion à droite (indépendant) */}
              <button
                type="button"
                onClick={handleLogout}
                aria-label="Se déconnecter"
                className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-full text-[#7a0008]/70 transition-all duration-200 hover:bg-[#7a0008]/[0.08] hover:text-[#7a0008] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7a0008]/30 sm:flex"
              >
                <LogOut size={14} strokeWidth={2.4} />
              </button>
            </div>

            {menuUser && (
              <div
                ref={userMenuRef}
                role="menu"
                className="examai-menu absolute right-0 top-[calc(100%+8px)] z-30 w-56 overflow-hidden rounded-2xl border border-[#0f172a]/12 bg-white shadow-[0_24px_48px_-16px_rgba(15,23,42,0.35),0_0_0_1px_rgba(255,255,255,0.6)_inset] backdrop-blur-xl"
              >
                <div className="px-3 py-3 border-b border-[#0f172a]/8">
                  <p className="text-[13px] font-semibold text-[#0f172a] truncate">{user?.nom}</p>
                  {user?.email && (
                    <p className="text-[11px] text-[#0f172a]/55 truncate mt-0.5">{user.email}</p>
                  )}
                </div>
                <div className="p-1.5">
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[12.5px] font-medium text-red-600 transition-colors hover:bg-red-50"
                  >
                    <LogOut size={13} />
                    Se déconnecter
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Burger mobile */}
          <button
            type="button"
            onClick={() => setMenuMobile((v) => !v)}
            aria-label={menuMobile ? 'Fermer le menu' : 'Ouvrir le menu'}
            aria-expanded={menuMobile}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[#0f172a]/12 bg-white text-[#0f172a]/60 transition-all duration-200 hover:border-[#0f172a]/30 hover:text-[#7a0008] md:hidden"
          >
            {menuMobile ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>
      </div>

      {/* ===== Menu mobile ===== */}
      {menuMobile && (
        <div className="examai-mobile-menu md:hidden border-t border-[#0f172a]/8 bg-white">
          <nav className="mx-auto max-w-7xl px-4 py-3 space-y-1">
            {LINKS.map(({ to, label }) => {
              const active = isActive(to)
              return (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setMenuMobile(false)}
                  className={`flex items-center rounded-2xl px-3.5 py-3 text-[13.5px] transition-all ${
                    active
                      ? 'bg-[#7a0008]/[0.06] font-bold text-[#7a0008]'
                      : 'font-medium text-[#0f172a]/70 hover:bg-[#0f172a]/[0.05] hover:text-[#7a0008]'
                  }`}
                >
                  {label}
                </Link>
              )
            })}

            <div className="pt-2 mt-2 border-t border-[#0f172a]/8 sm:hidden">
              <div className="px-3 py-2 flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#0f172a]/50">Langue</span>
              </div>
              <div className="flex gap-2 px-3">
                {Object.entries(LANGS).map(([code, item]) => {
                  const active = lang === code
                  return (
                    <button
                      key={code}
                      onClick={() => setLang(code)}
                      className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-all ${
                        active
                          ? 'border-transparent bg-[#7a0008] text-white shadow-[0_4px_10px_-4px_rgba(122,0,8,0.45)]'
                          : 'border-[#0f172a]/12 bg-white text-[#0f172a]/70'
                      }`}
                    >
                      <span aria-hidden="true">{item.flag}</span>
                      {item.code}
                    </button>
                  )
                })}
              </div>
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}