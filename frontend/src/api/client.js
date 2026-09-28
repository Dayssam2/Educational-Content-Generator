// Point d'entree unique vers le backend FastAPI. Toutes les pages passent
// par ici plutot que d'appeler fetch() directement, pour que la gestion du
// token et des erreurs soit coherente partout.

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
const TOKEN_KEY = 'examai_token'

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

function authHeaders() {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function request(path, { method = 'GET', body, isBlob = false } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    let detail = `Erreur ${res.status}`
    try {
      const data = await res.json()
      detail = data.detail || detail
    } catch {
      // reponse non-JSON (ex: erreur reseau) : on garde le message par defaut
    }
    throw new ApiError(detail, res.status)
  }

  if (isBlob) return res.blob()
  if (res.status === 204) return null
  return res.json()
}

export const api = {
  // --- Auth ---
  signup: ({ email, password, nom, genre }) =>
    request('/api/auth/signup', { method: 'POST', body: { email, password, nom, genre } }),
  login: ({ email, password }) =>
    request('/api/auth/login', { method: 'POST', body: { email, password } }),
  // "Continuer avec Google" -- access_token obtenu cote navigateur via
  // Google Identity Services (voir Signup.jsx/Login.jsx). genre n'est
  // utilise par le backend que si un NOUVEAU compte est cree ; ignore si
  // le compte Google existe deja ou se rattache a un compte existant.
  google: ({ accessToken, genre }) =>
    request('/api/auth/google', { method: 'POST', body: { access_token: accessToken, genre } }),
  // "Mot de passe oublie" -- deux etapes. forgotPassword renvoie toujours
  // un message generique cote backend (email existe ou pas) : ne pas
  // s'en servir pour deviner si un compte existe. resetPassword ne
  // renvoie pas de session (juste {ok:true}) : la personne se reconnecte
  // ensuite normalement avec son nouveau mot de passe.
  forgotPassword: ({ email }) =>
    request('/api/auth/forgot-password', { method: 'POST', body: { email } }),
  resetPassword: ({ email, code, nouveauPassword }) =>
    request('/api/auth/reset-password', {
      method: 'POST',
      body: { email, code, nouveau_password: nouveauPassword },
    }),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  me: () => request('/api/auth/me'),

  // --- Matieres / chapitres (source de verite = rag_system, pas de mock) ---
  getMatieres: (niveau) => request(`/api/matieres?niveau=${encodeURIComponent(niveau)}`),
  getChapitres: (matiere, niveau) =>
    request(`/api/chapitres?matiere=${encodeURIComponent(matiere)}&niveau=${encodeURIComponent(niveau)}`),

  // --- Examens ---
  listExamens: () => request('/api/examens'),
  getExamen: (id) => request(`/api/examens/${id}`),
  createExamen: (payload) => request('/api/examens', { method: 'POST', body: payload }),
  // ===== AJOUT : examen personnalise assemble depuis la Banque de
  // Questions (voir BanqueQuestions.jsx) -- POST /api/examens/depuis-
  // selection dans main.py. Aucune IA impliquee : `questions` contient
  // les objets question DEJA existants, choisis a la main.
  createExamenDepuisSelection: (payload) =>
    request('/api/examens/depuis-selection', { method: 'POST', body: payload }),
  // ===== FIN AJOUT =====
  updateExamen: (id, questions) => request(`/api/examens/${id}`, { method: 'PUT', body: { questions } }),
  deleteExamen: (id) => request(`/api/examens/${id}`, { method: 'DELETE' }),
  validateExamen: (id) => request(`/api/examens/${id}/valider`, { method: 'POST' }),
  // ===== AJOUT : regeneration depuis Validation (etape 3) -- POST
  // /api/examens/{id}/regenerer dans main.py. `notes` est optionnel
  // (peut etre undefined) : consignes libres + recommandations de la
  // derniere analyse, fusionnees cote backend (voir
  // _construire_notes_regeneration dans main.py).
  regenerateExamen: (id, notes) =>
    request(`/api/examens/${id}/regenerer`, { method: 'POST', body: { notes } }),
  // ===== FIN AJOUT =====
  exportExamen: (id, options) =>
    request(`/api/examens/${id}/export`, { method: 'POST', body: options, isBlob: true }),
  // ===== AJOUT : corrige (etape 4) -- copie exacte de exportExamen ci-dessus,
  // seule l'URL change (/export -> /export/corrige), qui correspond a la
  // route POST /api/examens/{id}/export/corrige ajoutee dans main.py (gardee
  // cote serveur par la validation : peut_valider doit etre true).
  exportCorrection: (id, options) =>
    request(`/api/examens/${id}/export/corrige`, { method: 'POST', body: options, isBlob: true }),
  // ===== FIN AJOUT =====

  // --- Assistant pedagogique (chat en langage libre) ---
  // CORRIGE : la version precedente ne gardait que { message, historique }
  // de l'objet recu -- pdf_base64 et nom_fichier_pdf (voir Assistant.jsx)
  // etaient silencieusement ignores, jamais envoyes au backend. Le PDF
  // etait donc lu par FileReader cote navigateur, encode en base64...
  // puis jete a la premiere etape suivante. Ici, on transmet tout
  // l'objet tel quel : simple et ca evite d'oublier un futur champ.
  chatAssistant: (payload) =>
    request('/api/assistant/chat', { method: 'POST', body: payload }),
  // ===== AJOUT : bouton "Creer un examen depuis ce PDF" dans le chat
  // Assistant (voir Assistant.jsx) -- POST /api/examens/depuis-pdf dans
  // main.py, meme route que le flux "Nouvel examen depuis un PDF" du
  // wizard. Le PDF est deja en base64 en memoire cote frontend (celui
  // qu'on vient de discuter dans le chat) : pas de deuxieme upload,
  // juste le meme fichier renvoye a une route differente.
  createExamenDepuisPdf: (payload) =>
    request('/api/examens/depuis-pdf', { method: 'POST', body: payload }),
  // ===== FIN AJOUT =====
}