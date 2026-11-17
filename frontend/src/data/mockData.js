
export const NIVEAU_LABEL = {
  '1': '1ere annee',
  '2': '2eme annee',
  '3': '3eme annee',
  '4': '4eme annee',
  '5': '5eme annee',
  '6': '6eme annee',
}

export const MATIERE_LABEL = {
  mathematique: 'Mathematiques',
  arabe: 'Arabe',
  science: 'Sciences de la vie',
  francais: 'Francais',
  histoire_geo: 'Histoire-Geographie',
}

export const TYPES_QUESTIONS = [
  { id: 'qcm', label: 'QCM' },
  { id: 'vrai_faux', label: 'Vrai / Faux' },
  { id: 'ouverte', label: 'Questions ouvertes' },
  { id: 'texte_trous', label: 'Texte a trous' },
  { id: 'association', label: 'Association (relier)' },
  { id: 'remise_en_ordre', label: 'Remise en ordre' },
  { id: 'tri', label: 'Tri / Classement' },
  { id: 'calcul', label: 'Calcul' },
  { id: 'legende', label: 'Legender un schema' },
  { id: 'dictee', label: 'Dictee' },
  { id: 'redaction', label: 'Redaction' },
  { id: 'lecture', label: 'Lecture / Comprehension' },
]

export const NIVEAUX = Object.entries(NIVEAU_LABEL).map(([id, label]) => ({ id, label }))