
import { useCallback, useEffect, useRef, useState } from 'react'
import { blobEnBase64 } from './voixUtils.js'

const NAVIGATEUR_SANS_RECO = typeof navigator !== 'undefined' && (
  /\bOPR\/|\bOpera\b/.test(navigator.userAgent) || !!navigator.brave
)

const SR = typeof window !== 'undefined' && !NAVIGATEUR_SANS_RECO
  ? window.SpeechRecognition || window.webkitSpeechRecognition
  : null

const SEUIL_PAROLE = 0.06
const SILENCE_FIN_MS = 1400
const SILENCE_DEBUT_MS = 7000
const DUREE_MAX_MS = 30000

export function useASR({ langue = 'fr-FR', transcrireServeur, onFin, onErreur } = {}) {
  const [ecoute, setEcoute] = useState(false)
  const [transcription, setTranscription] = useState('')
  const [niveau, setNiveau] = useState(0)
  const [transcriptionServeur, setTranscriptionServeur] = useState(false)
  const [moteur, setMoteur] = useState(SR ? 'navigateur' : 'serveur')

  const onFinRef = useRef(onFin)
  const onErreurRef = useRef(onErreur)
  const transcrireRef = useRef(transcrireServeur)
  useEffect(() => { onFinRef.current = onFin }, [onFin])
  useEffect(() => { onErreurRef.current = onErreur }, [onErreur])
  useEffect(() => { transcrireRef.current = transcrireServeur }, [transcrireServeur])

  const sessionRef = useRef(null)
  const moteurRef = useRef(moteur)
  useEffect(() => { moteurRef.current = moteur }, [moteur])

  
  function brancherAnalyseur(stream, { surSilenceFinal } = {}) {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return () => {}
    const ctx = new Ctx()
    const source = ctx.createMediaStreamSource(stream)
    const analyseur = ctx.createAnalyser()
    analyseur.fftSize = 1024
    source.connect(analyseur)
    const buf = new Float32Array(analyseur.fftSize)

    const debut = performance.now()
    let dernierSon = 0
    let aParle = false
    let raf = 0
    let fini = false

    const boucle = () => {
      if (fini) return
      analyseur.getFloatTimeDomainData(buf)
      let somme = 0
      for (let i = 0; i < buf.length; i++) somme += buf[i] * buf[i]
      const rms = Math.sqrt(somme / buf.length)
      setNiveau(Math.min(1, rms * 6))

      const maintenant = performance.now()
      if (rms > SEUIL_PAROLE) { aParle = true; dernierSon = maintenant }
      if (surSilenceFinal) {
        const tropLong = maintenant - debut > DUREE_MAX_MS
        const silenceApresParole = aParle && maintenant - dernierSon > SILENCE_FIN_MS
        const personne = !aParle && maintenant - debut > SILENCE_DEBUT_MS
        if (tropLong || silenceApresParole || personne) {
          fini = true
          surSilenceFinal({ aParle })
          return
        }
      }
      raf = requestAnimationFrame(boucle)
    }
    raf = requestAnimationFrame(boucle)

    return () => {
      fini = true
      cancelAnimationFrame(raf)
      try { source.disconnect() } catch {}
      ctx.close().catch(() => {})
      setNiveau(0)
    }
  }

  
  const demarrerNavigateur = useCallback(async () => {
    const rec = new SR()
    rec.lang = langue
    rec.interimResults = true
    rec.continuous = false
    rec.maxAlternatives = 1

    let final = ''
    let annule = false
    let basculerServeur = false
    let demarre = false
    let entendu = false

    rec.onstart = () => { demarre = true; console.info('[ASR] écoute démarrée', langue) }
    rec.onaudiostart = () => { console.info('[ASR] micro ouvert') ; setNiveau(0.15) }
    rec.onsoundstart = () => setNiveau(0.4)
    rec.onspeechstart = () => { entendu = true; setNiveau(0.7); console.info('[ASR] voix détectée') }
    rec.onspeechend = () => setNiveau(0.15)

    rec.onresult = (e) => {
      let provisoire = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) final += r[0].transcript
        else provisoire += r[0].transcript
      }
      setNiveau(0.5 + Math.random() * 0.4)
      setTranscription((final + ' ' + provisoire).trim())
    }

    rec.onerror = (e) => {
      console.warn('[ASR] erreur', e.error, e.message || '')
      if (e.error === 'no-speech' || e.error === 'aborted') return
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        onErreurRef.current?.("Accès au micro refusé. Cliquez sur l'icône à gauche de l'adresse et autorisez le micro.")
      } else if (e.error === 'audio-capture') {
        onErreurRef.current?.("Aucun micro détecté. Vérifiez qu'un micro est branché et choisi dans les réglages du navigateur.")
      } else if (e.error === 'network' || e.error === 'language-not-supported') {
        basculerServeur = true
      } else {
        onErreurRef.current?.(`Reconnaissance vocale : ${e.error}`)
      }
    }

    const garde = setTimeout(() => {
      if (!demarre) {
        console.warn("[ASR] l'écoute ne démarre pas, bascule serveur")
        basculerServeur = true
        try { rec.abort() } catch {}
      }
    }, 4000)

    rec.onend = () => {
      clearTimeout(garde)
      console.info('[ASR] fin', { final, entendu })
      sessionRef.current = null
      setNiveau(0)
      setEcoute(false)
      setTranscription('')
      if (annule) return
      if (basculerServeur) {
        if (transcrireRef.current) {
          setMoteur('serveur')
          onErreurRef.current?.('La reconnaissance du navigateur ne marche pas ici, je passe par le serveur. Touchez le cercle et réessayez.')
        } else {
          onErreurRef.current?.("La reconnaissance vocale du navigateur ne répond pas. Utilisez Chrome ou Edge, connecté à internet.")
        }
        onFinRef.current?.('')
        return
      }
      onFinRef.current?.(final.trim())
    }

    sessionRef.current = {
      arreter: () => { try { rec.stop() } catch {} },
      annuler: () => { annule = true; try { rec.abort() } catch {} },
    }
    setTranscription('')
    setEcoute(true)
    try {
      rec.start()
    } catch (err) {
      console.warn('[ASR] start() a échoué', err)
      clearTimeout(garde)
      sessionRef.current = null
      setEcoute(false)
      onErreurRef.current?.("Impossible de démarrer l'écoute. Rechargez la page et réessayez.")
    }
  }, [langue])

  
  const demarrerServeur = useCallback(async () => {
    if (!transcrireRef.current) {
      onErreurRef.current?.("La reconnaissance vocale n'est pas disponible sur ce navigateur. Essayez Chrome ou Edge.")
      return
    }
    let annuleAvantDebut = false
    sessionRef.current = { arreter: () => { annuleAvantDebut = true }, annuler: () => { annuleAvantDebut = true } }
    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      })
    } catch {
      sessionRef.current = null
      onErreurRef.current?.("Impossible d'accéder au microphone.")
      return
    }
    if (annuleAvantDebut) {
      stream.getTracks().forEach((t) => t.stop())
      sessionRef.current = null
      return
    }

    const mime = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm', 'audio/mp4']
      .find((m) => window.MediaRecorder?.isTypeSupported?.(m)) || ''
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
    const morceaux = []
    let annule = false
    let aParle = true

    rec.ondataavailable = (e) => { if (e.data?.size) morceaux.push(e.data) }

    const stopVad = brancherAnalyseur(stream, {
      surSilenceFinal: ({ aParle: p }) => { aParle = p; if (rec.state !== 'inactive') rec.stop() },
    })

    rec.onstop = async () => {
      stopVad()
      stream.getTracks().forEach((t) => t.stop())
      sessionRef.current = null
      setEcoute(false)
      if (annule) return
      if (!aParle || !morceaux.length) { onFinRef.current?.(''); return }

      setTranscriptionServeur(true)
      try {
        const blob = new Blob(morceaux, { type: rec.mimeType || 'audio/webm' })
        const base64 = await blobEnBase64(blob)
        const { texte } = await transcrireRef.current({ audio_base64: base64, langue })
        onFinRef.current?.((texte || '').trim())
      } catch (e) {
        onErreurRef.current?.(e.message || 'La transcription a échoué.')
        onFinRef.current?.('')
      } finally {
        setTranscriptionServeur(false)
      }
    }

    sessionRef.current = {
      arreter: () => { if (rec.state !== 'inactive') rec.stop() },
      annuler: () => { annule = true; if (rec.state !== 'inactive') rec.stop() },
    }
    setTranscription('')
    setEcoute(true)
    rec.start(250)
  }, [langue])

  const demarrer = useCallback(() => {
    if (sessionRef.current) return
    if (moteurRef.current === 'navigateur' && SR) return demarrerNavigateur()
    return demarrerServeur()
  }, [demarrerNavigateur, demarrerServeur])

  
  const arreter = useCallback(() => sessionRef.current?.arreter(), [])
  
  const annuler = useCallback(() => sessionRef.current?.annuler(), [])

  useEffect(() => () => sessionRef.current?.annuler(), [])

  return {
    ecoute,
    transcription,
    niveau,
    transcriptionServeur,
    moteur,
    disponible: !!SR || (typeof window !== 'undefined' && !!window.MediaRecorder),
    demarrer,
    arreter,
    annuler,
  }
}