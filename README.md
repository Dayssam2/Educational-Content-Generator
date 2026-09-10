# Générateur de Contenu Éducatif Tunisien

[![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)](https://python.org)
[![Gemini](https://img.shields.io/badge/Gemini-AI-blue.svg)](https://ai.google.dev)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Description

Générateur intelligent de quiz éducatifs utilisant l'IA Gemini et un système RAG (Retrieval-Augmented Generation) basé sur le programme scolaire tunisien.

### Fonctionnalités actuelles

- Base de données complète du programme tunisien (Arabe, Français, Mathématiques, Sciences, Histoire-Géo)
- IA Gemini pour génération intelligente de questions QCM, Vrai/Faux et ouvertes
- Système RAG pour recherche contextuelle dans les leçons
- Génération de rapports HTML interactifs
- Configuration par niveau scolaire (1ère à 6ème année)

## Installation

### Prérequis
- Python 3.8+
- Git

### 1. Cloner le repository
```bash
git clone https://github.com/VotreUsername/Educational_Content_Generator.git
cd Educational_Content_Generator
```

### 2. Configuration de l'environnement Python
```bash
# Créer environnement virtuel
python -m venv venv311

# Activer l'environnement (Windows)
venv311\Scripts\activate

# Installer les dépendances
pip install -r requirements.txt
```

### 3. Configuration des variables d'environnement
```bash
# Copier le template de configuration
cp .env.example .env

# Éditer .env et ajouter votre clé API Gemini
# GEMINI_API_KEY=votre_cle_gemini_ici
```

## Configuration des clés API

### Gemini AI (Obligatoire)
1. Aller sur [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Créer une nouvelle clé API
3. Ajouter dans `.env`: `GEMINI_API_KEY=votre_cle`

## Utilisation

### Génération de quiz avec configurations prédéfinies
```bash
# Lancer le générateur principal
python generateur_quiz_final_gemini.py
```

Le script génère automatiquement :
- Rapport HTML avec analyse RAG (`QUIZ_RAPPORT_FINAL_GEMINI.html`)
- Quiz interactif pour les étudiants (`QUIZ_INTERACTIF_ELEVES_GEMINI.html`)

## Structure du projet

```
Educational_Content_Generator/
├── database_tunisienne/            # Données programme tunisien
│   ├── arabe*.json                 # Leçons d'arabe par niveau
│   ├── mathematique*.json          # Leçons de mathématiques
│   ├── science*.json               # Leçons de sciences
│   ├── francais*.json              # Leçons de français
│   └── histoire_geo*.json          # Leçons d'histoire-géographie
├── rag_system/                     # Système RAG
│   ├── rag_engine.py              # Moteur principal
│   ├── embedder.py                # Génération embeddings
│   ├── vector_store.py            # Base vectorielle
│   └── chroma_db/                 # Base de données vectorielle
├── services/                       # Services IA
│   └── gemini_service.py          # Intégration Gemini
├── frontend/                       # Génération HTML
│   ├── quiz_viewer.py             # Quiz interactifs
│   └── rapport.py                 # Rapports d'analyse
├── generators/                     # Générateurs de quiz
├── models/                         # Modèles de données
├── prompts/                        # Templates de prompts IA
└── validators/                     # Validation des examens
```

## Exemple d'utilisation

```python
from rag_system import SimpleRAG
from services.gemini_service import generate_content

# Initialiser le système RAG
rag = SimpleRAG(lessons_dir="database_tunisienne")
rag.index_all()

# Rechercher du contenu
results = rag.search(
    query="الكسور", 
    matiere="mathematique", 
    niveau="5"
)

# Le système génère automatiquement des quiz basés sur ce contenu
print(f"Trouvé {len(results['results'])} leçons pertinentes")
```

## Sécurité

- Fichier `.env` contient vos clés API - **NE JAMAIS le committer**
- Repository privé recommandé pour protéger vos données
- Clés API avec permissions minimales nécessaires

## Contribution

1. Fork le projet
2. Créer une branche feature (`git checkout -b feature/AmazingFeature`)
3. Commit vos changements (`git commit -m 'Add some AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

## Licence

Distribué sous licence MIT. Voir `LICENSE` pour plus d'informations.

## Auteur

**Votre Nom** - [@VotreUsername](https://github.com/VotreUsername)

## Remerciements

- Programme scolaire tunisien officiel
- Google Gemini AI
- Communauté open source

---

N'oubliez pas de mettre une étoile si ce projet vous a aidé !