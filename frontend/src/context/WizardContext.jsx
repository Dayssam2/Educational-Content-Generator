import { createContext, useContext, useState } from 'react'
import { api } from '../api/client.js'

const WizardContext = createContext(null)

const EXAMEN_VIDE = {
  id: null,
  matiere: '',
  niveau: '',
  chapitre: '',
  titre: '',
  statut: null,
  questions: [],
  validation: null,
}

export function WizardProvider({ children }) {
  const [examen, setExamen] = useState(EXAMEN_VIDE)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function genererExamen(params) {
    setLoading(true)
    setError(null)
    try {
      const data = await api.createExamen(params)
      setExamen(data)
      return data
    } catch (e) {
      setError(e.message)
      throw e
    } finally {
      setLoading(false)
    }
  }

  function updateQuestion(id, patch) {
    setExamen((prev) => ({
      ...prev,
      questions: prev.questions.map((q) => (q.id === id ? { ...q, ...patch } : q)),
    }))
  }

  function removeQuestion(id) {
    setExamen((prev) => ({ ...prev, questions: prev.questions.filter((q) => q.id !== id) }))
  }

  function duplicateQuestion(id) {
    setExamen((prev) => {
      const idx = prev.questions.findIndex((q) => q.id === id)
      if (idx === -1) return prev
      const copie = { ...prev.questions[idx], id: `${prev.questions[idx].id}-copie-${Date.now()}` }
      const questions = [...prev.questions]
      questions.splice(idx + 1, 0, copie)
      return { ...prev, questions }
    })
  }

  function addQuestion() {
    const nouvelle = {
      id: `q-nouvelle-${Date.now()}`,
      type: 'qcm',
      points: 2,
      question: 'Nouvelle question',
      options: ['Option 1', 'Option 2', 'Option 3', 'Option 4'],
      reponseCorrecteIndex: 0,
    }
    setExamen((prev) => ({ ...prev, questions: [...prev.questions, nouvelle] }))
    return nouvelle.id
  }

  async function sauvegarderQuestions() {
    if (!examen.id) return
    setLoading(true)
    setError(null)
    try {
      const data = await api.updateExamen(examen.id, examen.questions)
      setExamen(data)
      return data
    } catch (e) {
      setError(e.message)
      throw e
    } finally {
      setLoading(false)
    }
  }

  async function lancerValidation() {
    if (!examen.id) return
    setLoading(true)
    setError(null)
    try {
      const resultat = await api.validateExamen(examen.id)
      setExamen((prev) => ({ ...prev, validation: resultat, statut: resultat.peut_valider ? 'valide' : 'brouillon' }))
      return resultat
    } catch (e) {
      setError(e.message)
      throw e
    } finally {
      setLoading(false)
    }
  }

  async function regenererExamen(notes) {
    if (!examen.id) return
    setLoading(true)
    setError(null)
    try {
      const data = await api.regenerateExamen(examen.id, notes)
      setExamen(data)
      return data
    } catch (e) {
      setError(e.message)
      throw e
    } finally {
      setLoading(false)
    }
  }

  async function exporterExamen(options = {}) {
    if (!examen.id) return
    setLoading(true)
    setError(null)
    try {
      const format = options.format || 'pdf'
      return await api.exportExamen(examen.id, { ...options, format })
    } catch (e) {
      setError(e.message)
      throw e
    } finally {
      setLoading(false)
    }
  }

  async function exporterPdf(options = {}) {
    return exporterExamen({ format: 'pdf', ...options })
  }

  async function exporterCorrection(options = {}) {
    if (!examen.id) return
    setLoading(true)
    setError(null)
    try {
      const format = options.format || 'pdf'
      return await api.exportCorrection(examen.id, { ...options, format })
    } catch (e) {
      setError(e.message)
      throw e
    } finally {
      setLoading(false)
    }
  }

  async function chargerExamen(id) {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getExamen(id)
      setExamen(data)
      return data
    } catch (e) {
      setError(e.message)
      throw e
    } finally {
      setLoading(false)
    }
  }

  const value = {
    examen,
    loading,
    error,
    setError,
    genererExamen,
    chargerExamen,
    updateQuestion,
    removeQuestion,
    duplicateQuestion,
    addQuestion,
    sauvegarderQuestions,
    lancerValidation,
    regenererExamen,
    exporterExamen,
    exporterPdf,
    exporterCorrection,
  }

  return <WizardContext.Provider value={value}>{children}</WizardContext.Provider>
}

export function useWizard() {
  const ctx = useContext(WizardContext)
  if (!ctx) throw new Error('useWizard doit etre utilise a l\'interieur de <WizardProvider>')
  return ctx
}