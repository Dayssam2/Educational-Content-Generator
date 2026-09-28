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

  // Etape 1 -> genere un examen reel via le backend (matiere/niveau/chapitres
  // exacts, retournes par GET /api/matieres et /api/chapitres -- jamais de
  // valeur inventee cote frontend).
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

  // Etape 2 -> persiste les questions (potentiellement editees a la main)
  // avant de passer a la validation. Le backend repasse alors l'examen en
  // statut "brouillon" et invalide toute validation precedente -- normal,
  // une edition manuelle doit etre revalidee.
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

  // Etape 3 -> lance (ou relance) l'analyse reelle cote backend (regles +
  // suggestions IA, voir validation.py).
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

  // ===== AJOUT : Etape 3 -> regenere entierement les questions d'un examen
  // existant, avec les MEMES parametres qu'a l'origine (matiere/niveau/
  // chapitres/nb_questions/difficulte/types_questions, gardes cote backend --
  // voir database.py) + les recommandations de la derniere analyse et/ou
  // une consigne libre optionnelle -- voir POST /api/examens/{id}/regenerer
  // dans main.py. Necessite api.regenerateExamen(id, notes) cote
  // api/client.js -- meme forme que api.validateExamen(id) ci-dessus, mais
  // avec `notes` dans le corps de la requete POST.
  //
  // Le backend renvoie l'examen COMPLET (comme createExamen/getExamen) :
  // questions regenerees, statut remis a 'brouillon' et validation remise a
  // null y sont deja corrects -- on remplace donc tout l'etat en un coup
  // (comme chargerExamen()), plutot que de fusionner un patch partiel comme
  // le fait lancerValidation() pour son propre champ `validation` seul.
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
  // ===== FIN AJOUT =====

  // ===== ETAPE 4 : EXPORT =====
  // Renvoie un Blob pret a etre telecharge, dans le format demande.
  //
  // Formats supportes cote backend (a implementer) :
  //   - 'pdf'        -> PDF (defaut, deja fait)
  //   - 'docx'       -> Word (.docx)
  //   - 'md'         -> Markdown
  //   - 'json'       -> JSON structure
  //
  // Le format 'impression' n'existe PAS ici : c'est un mode d'ouverture cote
  // frontend (PDF + window.print()), donc on envoie toujours 'pdf' au backend.
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

  // Retrocompatibilite : d'autres pages (ou tests) peuvent encore appeler
  // exporterPdf() -- on garde l'alias. En interne, ca appelle exporterExamen
  // avec format='pdf' par defaut, sauf si options.format est fourni.
  async function exporterPdf(options = {}) {
    return exporterExamen({ format: 'pdf', ...options })
  }

  // ===== AJOUT : corrige (etape 4) -- copie exacte de exporterExamen()
  // ci-dessus, mais vers l'endpoint dedie POST /api/examens/{id}/export/corrige
  // (voir main.py), garde cote serveur par la validation (peut_valider doit
  // etre true). Necessite api.exportCorrection(id, options) cote
  // api/client.js -- a ajouter la en copiant api.exportExamen() et en
  // changeant uniquement l'URL (/export -> /export/corrige) ; le corps de la
  // requete et le retour (un Blob) sont identiques.
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
  // ===== FIN AJOUT =====

  // Utilise par "Mes examens" -> recharge un examen deja cree (au lieu d'en
  // generer un nouveau) pour continuer a l'editer / le valider / l'exporter.
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
    regenererExamen,    // ===== AJOUT : regeneration depuis Validation =====
    exporterExamen,   // ✅ nouveau : multi-format
    exporterPdf,      // ✅ conservé : alias rétrocompatible
    exporterCorrection, // ===== AJOUT : export du corrigé (PDF) =====
  }

  return <WizardContext.Provider value={value}>{children}</WizardContext.Provider>
}

export function useWizard() {
  const ctx = useContext(WizardContext)
  if (!ctx) throw new Error('useWizard doit etre utilise a l\'interieur de <WizardProvider>')
  return ctx
}