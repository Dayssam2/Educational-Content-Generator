import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import TopNav from './TopNav.jsx'
import Stepper from './Stepper.jsx'

export default function WizardShell({ step, title, subtitle, backTo = null, hideStepper = false, children }) {
  return (
    <div className="examai-wizard relative min-h-screen overflow-hidden bg-white text-[#1a2332]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700;9..144,900&family=Manrope:wght@400;500;600;700;800&display=swap');

        .examai-wizard { font-family: 'Manrope', system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
        .examai-wizard .examai-serif { font-family: 'Fraunces', Georgia, serif; font-feature-settings: 'liga' 1, 'kern' 1; font-optical-sizing: auto; }
      `}</style>

      <div className="relative z-10">
        <TopNav />

        {/* Bandeau d'étapes intégré à WizardShell — une page peut le masquer
            via hideStepper si elle affiche déjà son propre indicateur. */}
        {!hideStepper && (
          <div className="border-b border-[#7a0008]/10 bg-white">
            <div className="mx-auto flex max-w-6xl items-center px-6">
              <div className="w-16 shrink-0">
                {backTo && (
                  <Link
                    to={backTo}
                    className="flex items-center gap-1.5 py-4 text-sm font-medium text-[#4f0005]/55 transition-colors hover:text-[#7a0008]"
                  >
                    <ArrowLeft size={14} /> Retour
                  </Link>
                )}
              </div>
              <div className="flex-1">
                <Stepper current={step} />
              </div>
              <div className="w-16 shrink-0" />
            </div>
          </div>
        )}

        <main className="mx-auto max-w-6xl px-6 py-8">
          {title && <h1 className="examai-serif text-[22px] font-semibold tracking-[-0.01em] text-[#250002]">{title}</h1>}
          {subtitle && <p className="mt-1.5 text-[13.5px] text-[#4f0005]/60">{subtitle}</p>}
          <div className={title ? 'mt-6' : ''}>{children}</div>
        </main>
      </div>
    </div>
  )
}