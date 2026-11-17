
import { useCallback, useEffect, useRef, useState } from 'react'
import { decouperEnPhrases, detecterLangue, nettoyerPourLecture } from './voixUtils.js'

const synth = typeof window !== 'undefined' ? window.speechSynthesis : null

function scoreVoix(v) {
  const n = v.name.toLowerCase()
  let s = 0
  if (/natural|neural|online/.test(n)) s += 4
  if (/google/.test(n)) s += 3
  if (/premium|enhanced|amélioré/.test(n)) s += 2
  if (v.localService === false) s += 1
  return s
}

export function useTTS({ syntheseServeur, vitesse = 1.02 } = {}) {
  const [voix, setVoix] = useState([])
  const [idEnCours, setIdEnCours] = useState(null)
  const [chargement, setChargement] = useState(false)

  const jetonRef = useRef(0)
  const audioRef = useRef(null)
  const finEnAttenteRef = useRef(null)
  const syntheseRef = useRef(syntheseServeur)
  useEffect(() => { syntheseRef.current = syntheseServeur }, [syntheseServeur])

  useEffect(() => {
    if (!synth) return
    const charger = () => setVoix(synth.getVoices())
    charger()
    synth.addEventListener?.('voiceschanged', charger)
    return () => synth.removeEventListener?.('voiceschanged', charger)
  }, [])

  const choisirVoix = useCallback((langue) => {
    const prefixe = langue.slice(0, 2)
    const liste = synth?.getVoices()?.length ? synth.getVoices() : voix
    const candidates = liste.filter((v) => v.lang?.toLowerCase().startsWith(prefixe))
    if (!candidates.length) return null
    return candidates.sort((a, b) =>
      scoreVoix(b) - scoreVoix(a)
      || (b.lang === langue) - (a.lang === langue))[0]
  }, [voix])

  const arreter = useCallback(() => {
    jetonRef.current += 1
    synth?.cancel()
    if (audioRef.current) {
      audioRef.current.pause()
      URL.revokeObjectURL(audioRef.current.src)
      audioRef.current = null
    }
    setIdEnCours(null)
    setChargement(false)
    finEnAttenteRef.current?.()
    finEnAttenteRef.current = null
  }, [])

  const enonceRef = useRef(null)

  const parlerNavigateur = (morceaux, voixChoisie, langue, jeton) =>
    new Promise((resolve) => {
      finEnAttenteRef.current = resolve
      let i = 0
      let garde = 0
      const suivant = () => {
        clearTimeout(garde)
        if (jeton !== jetonRef.current || i >= morceaux.length) { enonceRef.current = null; resolve(); return }
        const texte = morceaux[i++]
        const u = new SpeechSynthesisUtterance(texte)
        if (voixChoisie) u.voice = voixChoisie
        u.lang = voixChoisie?.lang || langue
        u.rate = vitesse
        let fini = false
        const fin = () => { if (!fini) { fini = true; suivant() } }
        u.onend = fin
        u.onerror = fin
        enonceRef.current = u
        synth.resume()
        synth.speak(u)
        garde = setTimeout(fin, 4000 + texte.length * 90)
      }
      setTimeout(suivant, 80)
    })

  const parlerServeur = async (texte, langue, jeton) => {
    setChargement(true)
    let blob
    try {
      blob = await syntheseRef.current({ texte, langue })
    } finally {
      setChargement(false)
    }
    if (jeton !== jetonRef.current) return
    const audio = new Audio(URL.createObjectURL(blob))
    audioRef.current = audio
    await new Promise((resolve) => {
      finEnAttenteRef.current = resolve
      audio.onended = resolve
      audio.onerror = resolve
      audio.play().catch(resolve)
    })
    if (audioRef.current === audio) {
      URL.revokeObjectURL(audio.src)
      audioRef.current = null
    }
  }

  
  const parler = useCallback(async (texte, id = 'tts', langue) => {
    arreter()
    const jeton = jetonRef.current
    const propre = nettoyerPourLecture(texte)
    if (!propre) return

    const code = (langue || detecterLangue(propre)).slice(0, 2)
    const langueComplete = code === 'ar' ? 'ar-TN' : 'fr-FR'
    const voixChoisie = synth ? choisirVoix(langueComplete) : null

    setIdEnCours(id)
    try {
      if (voixChoisie) {
        await parlerNavigateur(decouperEnPhrases(propre), voixChoisie, langueComplete, jeton)
        return
      }
      if (syntheseRef.current) {
        try {
          await parlerServeur(propre, code, jeton)
          return
        } catch (e) {
          if (!synth) throw e
        }
      }
      if (synth) {
        await parlerNavigateur(decouperEnPhrases(propre), null, langueComplete, jeton)
        return
      }
      throw new Error("La synthèse vocale n'est pas disponible sur ce navigateur.")
    } finally {
      if (jeton === jetonRef.current) setIdEnCours(null)
    }
  }, [arreter, choisirVoix, vitesse])

  useEffect(() => () => arreter(), [arreter])

  return {
    parler,
    arreter,
    idEnCours,
    enLecture: idEnCours !== null,
    chargement,
    disponible: !!synth || !!syntheseServeur,
  }
}