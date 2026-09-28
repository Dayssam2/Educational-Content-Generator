// Ce fichier ne contient plus que des DICTIONNAIRES D'AFFICHAGE (id -> libelle
// lisible), utilises pour la mise en forme cote frontend. Il ne contient plus
// aucune donnee metier (matieres, chapitres, examens) : celles-ci viennent
// desormais reellement du backend (voir src/api/client.js), lui-meme branche
// sur rag_system -- jamais de liste figee ici, pour ne pas se desynchroniser
// du contenu reel du programme tunisien.

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

// MIS A JOUR : 4 types d'origine + 8 nouveaux (voir models.py / quiz_engine.py
// cote backend, mis a jour en meme temps). Les id ci-dessous DOIVENT
// correspondre exactement aux valeurs de "type" que quiz_engine.py sait
// generer -- sinon le backend recevrait un types_questions qu'il ne
// reconnait pas.
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