import { CheckCircle2, Circle, Download } from 'lucide-react'

const STATUTS = {
  valide: { label: 'Valide', classes: 'bg-emerald-50 text-emerald-600', Icon: CheckCircle2 },
  exporte: { label: 'Exporte', classes: 'bg-sky-50 text-sky-600', Icon: Download },
  brouillon: { label: 'Brouillon', classes: 'bg-orange-50 text-orange-500', Icon: Circle },
}

export default function StatusBadge({ statut }) {
  const { label, classes, Icon } = STATUTS[statut] || STATUTS.brouillon
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${classes}`}>
      <Icon size={12} className={statut === 'brouillon' ? 'fill-current' : ''} />
      {label}
    </span>
  )
}
