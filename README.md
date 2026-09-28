# ExamAI - Générateur d'Examens Éducatifs Tunisiens

[![Python](https://img.shields.io/badge/Python-3.11+-blue.svg)](https://python.org)
[![React](https://img.shields.io/badge/React-18+-61DAFB.svg)](https://reactjs.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg)](https://fastapi.tiangolo.com)
[![Gemini](https://img.shields.io/badge/Gemini-AI-blue.svg)](https://ai.google.dev)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-336791.svg)](https://postgresql.org)

## Description

**ExamAI** est une plateforme complète de génération d'examens éducatifs pour le système scolaire tunisien. Elle utilise une architecture IA avancée combinant **Gemini 3.6**, **RAG (Retrieval-Augmented Generation)** avec **ChromaDB**, et **analyse multimodale** pour créer des examens personnalisés de haute qualité pédagogique.

### Architecture IA/LLM

#### Système RAG Avancé
- **Base vectorielle ChromaDB** avec embeddings multilingues (français/arabe)
- **Recherche sémantique** dans le programme officiel tunisien
- **Context retrieval** intelligent par matière/niveau/chapitre
- **Sentence-transformers** pour embeddings de qualité

#### Modèles IA Utilisés
- **Gemini 3.6 (Texte)** - Génération de questions et chat assistant
- **Gemini 3.6 (Vision)** - Analyse d'images et génération de légendes  
- **Gemini Image** - Création d'illustrations éducatives
- **Embeddings Qwen3** - Support français + arabe pour RAG

#### Pipeline de Génération IA
1. **Query Processing** - Analyse de la requête enseignant
2. **RAG Retrieval** - Recherche vectorielle dans database_tunisienne/
3. **Context Augmentation** - Enrichissement avec programme officiel
4. **LLM Generation** - Génération par Gemini avec prompt engineering
5. **Validation** - Contrôle qualité automatique (règles + IA)
6. **Post-processing** - Formatage et images automatiques

#### Système RAG (Retrieval-Augmented Generation)
- **Index vectoriel** de 20+ fichiers JSON du programme tunisien
- **Embeddings Qwen3-0.6B** avec sentence-transformers
- **Recherche sémantique** par similarité cosinus
- **Filtrage contextuel** par matière/niveau/chapitre
- **Mise à jour automatique** lors de modifications du programme

#### Modèles LLM Utilisés
- **Gemini 3.6 (Text)** - Génération principale de questions
  - Prompt engineering spécialisé éducation tunisienne
  - Context window 32k tokens pour contexte RAG étendu
  - Support multilingue natif français/arabe
- **Gemini 3.6 (Vision)** - Analyse d'images uploadées
  - OCR automatique pour documents scannés
  - Génération de questions de légende à partir d'images réelles
  - Extraction de contenu depuis PDF image
- **Gemini Image** - Génération d'illustrations
  - Création automatique d'images pour questions visuelles
  - Prompts contextualisés par niveau scolaire
  - Génération adaptée aux standards éducatifs tunisiens

### Fonctionnalités Principales

#### Génération Multi-Mode avec IA
- **Depuis le programme officiel** - Système RAG avec ChromaDB sur base éducative tunisienne
- **Depuis un PDF** - Upload + extraction + génération contextuelle par LLM Gemini
- **Assemblage manuel** - Sélection depuis banque de questions avec recommandations IA

#### Intelligence Artificielle Avancée
- **RAG System** - ChromaDB + sentence-transformers pour recherche sémantique
- **LLM Generation** - Gemini 3.6 avec prompt engineering spécialisé éducation
- **Multimodal AI** - Analyse d'images, génération d'illustrations, OCR automatique
- **Validation IA** - Double contrôle : règles pédagogiques + recommandations LLM
- **Context Awareness** - Génération adaptée au niveau scolaire et matière tunisienne

#### 12 Types de Questions Supportés par IA
- **Basiques** : QCM, Vrai/Faux, Questions ouvertes, Rédaction
- **Avancés** : Texte à trous, Association, Remise en ordre, Tri/Classement
- **Spécialisés** : Calcul numérique, Légende d'image, Dictée
- **Complexes** : Compréhension de lecture avec sous-questions

#### Technologies IA Intégrées
- **ChromaDB** - Base vectorielle pour stockage embeddings
- **Sentence-Transformers** - Génération embeddings avec Qwen3-Embedding-0.6B
- **Gemini 3.6** - LLM principal pour génération texte et chat
- **Gemini Vision** - Analyse et compréhension d'images uploadées
- **Gemini Image** - Génération d'illustrations éducatives automatiques
- **Prompt Engineering** - Templates optimisés pour l'éducation tunisienne
- **Support multilingue** Arabe (RTL) + Français

#### 📤 **Export Professionnel**
- **PDF officiel tunisien** avec mise en page institutionnelle
- **Support bidirectionnel** Arabe (RTL) + Français (LTR)  
- **Polices dédiées** avec fallback Amiri
- **Mode corrigé** avec réponses colorées

## 🚀 Installation Rapide

### Prérequis
- Python 3.11+
- Node.js 18+
- PostgreSQL 14+
- Git

### 1. Cloner le projet
```bash
git clone https://github.com/VotreUsername/Educational_Content_Generator.git
cd Educational_Content_Generator
```

### 2. Backend Python (FastAPI)
```bash
# Créer environnement virtuel
python -m venv venv311
venv311\Scripts\activate  # Windows
# source venv311/bin/activate  # Linux/Mac

# Installer dépendances
pip install -r requirements.txt

# Configuration
cp .env.example .env
# Éditer .env avec vos clés API et base de données
```

### 3. Frontend React
```bash
cd frontend
npm install
npm run dev  # Démarrage sur http://localhost:5173
```

### 4. Base de données
```bash
# Créer base PostgreSQL
createdb examai

# Les tables se créent automatiquement au démarrage
cd ../backend
uvicorn main:app --reload  # API sur http://localhost:8000
```

## Configuration

### Variables d'environnement (.env)
```env
# IA Gemini (Obligatoire)
GEMINI_API_KEY=votre_cle_gemini_ici

# Base de données PostgreSQL  
DATABASE_URL=postgresql://username:password@localhost:5432/examai

# Configuration RAG ChromaDB (optionnel, chemins par défaut)
CHROMA_DB_PATH=./chroma_db
EMBEDDINGS_MODEL=Qwen/Qwen3-Embedding-0.6B

# Email (pour réinitialisation mot de passe)
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_EMAIL=votre.email@gmail.com
SMTP_PASSWORD=votre_mot_de_passe_app

# Google OAuth (Optionnel)
GOOGLE_CLIENT_ID=votre_google_client_id
GOOGLE_CLIENT_SECRET=votre_google_client_secret
```

### Clés API requises

#### Gemini AI (Obligatoire)
1. Aller sur [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Créer une nouvelle clé API
3. Ajouter dans `.env`: `GEMINI_API_KEY=votre_cle`

#### Google OAuth (Optionnel)
1. [Google Cloud Console](https://console.cloud.google.com)
2. Créer un projet → APIs & Services → Credentials
3. OAuth 2.0 Client ID → Web Application
4. Authorized redirect URIs: `http://localhost:5173`

## Structure du Projet

```
Educational_Content_Generator/
├── backend/              # API FastAPI
│   ├── main.py                     # Routes principales
│   ├── database.py                 # PostgreSQL + ORM
│   ├── quiz_engine.py              # Moteur génération IA
│   ├── pdf_export.py               # Export PDF bilingue
│   ├── validation.py               # Contrôle qualité
│   ├── assistant_engine.py         # Chat pédagogique
│   ├── image_service.py            # Génération images
│   ├── auth.py                     # Authentification
│   └── fonts/                      # Polices arabes Amiri
│
├── frontend/             # Interface React
│   ├── src/
│   │   ├── pages/wizard/           # Wizard 4 étapes
│   │   ├── context/                # Gestion état
│   │   ├── components/             # Composants UI
│   │   └── api/                    # Client HTTP
│   └── package.json
│
├── models/                       # Modèles Pydantic
│   └── models.py                   # 12 types questions
│
├── database_tunisienne/          # Programme officiel
│   ├── mathematique1-6.json        # Maths par niveau
│   ├── arabe1-6.json               # Arabe par niveau
│   ├── francais4-6.json            # Français par niveau
│   ├── science3-6.json             # Sciences par niveau
│   └── histoire_geo5-6.json        # Histoire-Géo
│
└── requirements.txt              # Dépendances Python
```

## Utilisation

### 1. Connexion Enseignant
- Inscription/connexion classique ou Google OAuth
- Interface personnalisée par rôle

### 2. Génération d'Examen - Wizard 4 Étapes

#### Étape 1 - Sélection
- Choix matière/niveau/chapitres
- Configuration nombre de questions
- Types de questions souhaités
- Upload optionnel d'image pour légende

#### Étape 2 - Édition
- Modification des questions générées
- Ajout/suppression/duplication
- Prévisualisation en temps réel

#### Étape 3 - Validation
- Analyse automatique qualité
- Recommandations pédagogiques IA
- Option de régénération ciblée

#### Étape 4 - Export
- Export PDF mise en page officielle
- Mode normal + mode corrigé
- Téléchargement direct

### 3. Chat Assistant
- Questions pédagogiques
- Upload PDF pour analyse
- Conseils personnalisés

## Sécurité

- Authentification JWT avec refresh tokens
- Hash bcrypt pour mots de passe
- Validation stricte côté serveur (Pydantic)
- Protection CORS configurée
- Variables sensibles dans .env (jamais committées)
- Pool connexions PostgreSQL sécurisé

## Tests

```bash
# Backend
cd backend
pytest

# Frontend  
cd frontend
npm test
```