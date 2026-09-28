import { Check } from 'lucide-react'

const STEPS = ['Selection', 'Edition', 'Validation', 'Export']

export default function Stepper({ current }) {
  return (
    <div className="flex items-center justify-center gap-3 py-4">
      {STEPS.map((label, i) => {
        const stepNum = i + 1
        const done = stepNum < current
        const active = stepNum === current
        return (
          <div key={label} className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div
                className={[
                  'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors',
                  done
                    ? 'bg-[#2f855a] text-white'
                    : active
                    ? 'bg-gradient-to-br from-[#961014] to-[#4f0005] text-white shadow-[0_4px_10px_-3px_rgba(122,0,8,0.5)]'
                    : 'bg-[#7a0008]/8 text-[#4f0005]/45',
                ].join(' ')}
              >
                {done ? <Check size={14} /> : stepNum}
              </div>
              <span
                className={[
                  'text-sm',
                  active ? 'font-semibold text-[#7a0008]' : done ? 'text-[#4f0005]/70' : 'text-[#4f0005]/35',
                ].join(' ')}
              >
                {label}
              </span>
            </div>
            {stepNum !== STEPS.length && <div className="h-px w-10 bg-[#7a0008]/12" />}
          </div>
        )
      })}
    </div>
  )
}
