

const ARABE = /[؀-ۿ]/

export function detecterLangue(texte = '') {
  const lettres = [...texte].filter((c) => /\p{L}/u.test(c))
  if (!lettres.length) return 'fr'
  const nbAr = lettres.filter((c) => ARABE.test(c)).length
  return nbAr / lettres.length > 0.3 ? 'ar' : 'fr'
}

export function nettoyerPourLecture(md = '') {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^[ \t]{0,3}#{1,6}[ \t]*/gm, '')
    .replace(/^[ \t]*[-*+][ \t]+/gm, '')
    .replace(/^[ \t]*\|?[ \t:|-]*-{2,}[ \t:|-]*$/gm, '')
    .replace(/^[ \t]*\|(.*)\|[ \t]*$/gm, (_, l) =>
      l.split('|').map((c) => c.trim()).filter(Boolean).join(', ') + '.')
    .replace(/[*_~>]+/g, '')
    .replace(/\n+/g, '\n')
    .replace(/([^.!?:;,؟\n])\n/g, '$1. ')
    .replace(/\s+/g, ' ')
    .trim()
}


export function decouperEnPhrases(texte, max = 220) {
  const phrases = texte.match(/[^.!?؟…]+[.!?؟…]*\s*/g) || [texte]
  const morceaux = []
  let courant = ''
  for (const p of phrases) {
    if ((courant + p).length > max && courant) {
      morceaux.push(courant.trim())
      courant = ''
    }
    if (p.length > max) {
      for (const bout of p.split(/(?<=[,،;])\s*/)) {
        if ((courant + bout).length > max && courant) {
          morceaux.push(courant.trim())
          courant = ''
        }
        courant += bout + ' '
      }
    } else {
      courant += p
    }
  }
  if (courant.trim()) morceaux.push(courant.trim())
  return morceaux
}

function normaliser(t = '') {
  return t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[إأآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[.,!?;:؟،"«»’'\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const COMMANDES = [
  { id: 'stop', motifs: ['stop', 'arrete', 'arrete toi', 'tais toi', 'silence', 'quitte', 'quitter',
    'fin', 'termine', 'au revoir', 'ca suffit', 'merci c est tout', 'توقف', 'اسكت', 'كفى', 'يزي', 'باهي يزي'] },
  { id: 'repeter', motifs: ['repete', 'repete s il te plait', 'tu peux repeter', 'redis', 'encore une fois',
    'pardon', 'quoi', 'اعد', 'عاود', 'كرر', 'شنوه'] },
  { id: 'nouvelle', motifs: ['nouvelle conversation', 'nouveau sujet', 'on recommence', 'efface tout',
    'محادثه جديده', 'من جديد'] },
  { id: 'oui', motifs: ['oui', 'ouais', 'oui vas y', 'vas y', 'd accord', 'ok', 'okay', 'confirme', 'je confirme',
    'c est ca', 'exactement', 'parfait', 'نعم', 'ايه', 'اي', 'باهي', 'موافق', 'اكيد'] },
  { id: 'non', motifs: ['non', 'non merci', 'annule', 'annuler', 'pas maintenant', 'laisse tomber',
    'لا', 'لا شكرا', 'الغ', 'الغاء', 'لالا'] },
]


export function commandeLocale(texte) {
  const t = normaliser(texte)
  if (!t || t.split(' ').length > 5) return null
  for (const { id, motifs } of COMMANDES) {
    if (motifs.some((m) => t === m || t === `${m} merci` || t === `merci ${m}`)) return id
  }
  return null
}

export const LANGUES_VOCALES = [
  { id: 'fr-FR', court: 'FR', label: 'Français' },
  { id: 'ar-TN', court: 'ع', label: 'العربية' },
]

export function blobEnBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}
