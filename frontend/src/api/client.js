
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
    }
    throw new ApiError(detail, res.status)
  }

  if (isBlob) return res.blob()
  if (res.status === 204) return null
  return res.json()
}

export const api = {
  signup: ({ email, password, nom, genre }) =>
    request('/api/auth/signup', { method: 'POST', body: { email, password, nom, genre } }),
  login: ({ email, password }) =>
    request('/api/auth/login', { method: 'POST', body: { email, password } }),
  google: ({ accessToken, genre }) =>
    request('/api/auth/google', { method: 'POST', body: { access_token: accessToken, genre } }),
  forgotPassword: ({ email }) =>
    request('/api/auth/forgot-password', { method: 'POST', body: { email } }),
  resetPassword: ({ email, code, nouveauPassword }) =>
    request('/api/auth/reset-password', {
      method: 'POST',
      body: { email, code, nouveau_password: nouveauPassword },
    }),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  me: () => request('/api/auth/me'),

  getMatieres: (niveau) => request(`/api/matieres?niveau=${encodeURIComponent(niveau)}`),
  getChapitres: (matiere, niveau) =>
    request(`/api/chapitres?matiere=${encodeURIComponent(matiere)}&niveau=${encodeURIComponent(niveau)}`),

  listExamens: () => request('/api/examens'),
  getExamen: (id) => request(`/api/examens/${id}`),
  createExamen: (payload) => request('/api/examens', { method: 'POST', body: payload }),
  createExamenDepuisSelection: (payload) =>
    request('/api/examens/depuis-selection', { method: 'POST', body: payload }),
  updateExamen: (id, questions) => request(`/api/examens/${id}`, { method: 'PUT', body: { questions } }),
  deleteExamen: (id) => request(`/api/examens/${id}`, { method: 'DELETE' }),
  validateExamen: (id) => request(`/api/examens/${id}/valider`, { method: 'POST' }),
  regenerateExamen: (id, notes) =>
    request(`/api/examens/${id}/regenerer`, { method: 'POST', body: { notes } }),
  exportExamen: (id, options) =>
    request(`/api/examens/${id}/export`, { method: 'POST', body: options, isBlob: true }),
  exportCorrection: (id, options) =>
    request(`/api/examens/${id}/export/corrige`, { method: 'POST', body: options, isBlob: true }),

  chatAssistant: (payload) =>
    request('/api/assistant/chat', { method: 'POST', body: payload }),
  createExamenDepuisPdf: (payload) =>
    request('/api/examens/depuis-pdf', { method: 'POST', body: payload }),

  sluAssistant: ({ texte }) =>
    request('/api/assistant/slu', { method: 'POST', body: { texte } }),
  asrAssistant: ({ audio_base64, langue }) =>
    request('/api/assistant/asr', { method: 'POST', body: { audio_base64, langue } }),
  ttsAssistant: ({ texte, langue }) =>
    request('/api/assistant/tts', { method: 'POST', body: { texte, langue }, isBlob: true }),
}