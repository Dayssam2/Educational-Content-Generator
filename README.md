# ClassAssistant — Générateur intelligent d'examens pour l'école primaire tunisienne

[![Python](https://img.shields.io/badge/Python-3.11+-blue.svg)](https://python.org)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg)](https://reactjs.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688.svg)](https://fastapi.tiangolo.com)
[![Gemini](https://img.shields.io/badge/Google-Gemini-blue.svg)](https://ai.google.dev)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-336791.svg)](https://postgresql.org)

**Technologies principales :** Python 3.11+ · React 18 · FastAPI · Google Gemini · PostgreSQL · ChromaDB

---

## 1. Présentation du projet

**ClassAssistant** est une plateforme web intelligente destinée aux enseignants de l'école primaire tunisienne. Elle permet de concevoir, générer, personnaliser, modifier, valider et exporter des examens et des exercices pédagogiques adaptés aux niveaux de la première à la sixième année primaire.

La plateforme exploite les technologies d'intelligence artificielle générative, notamment les modèles Google Gemini, un système RAG (Retrieval-Augmented Generation), des mécanismes de traitement documentaire et des technologies vocales. Elle s'appuie sur le programme officiel tunisien afin de produire des contenus pédagogiques cohérents avec les niveaux scolaires, les matières et les chapitres sélectionnés.

La plateforme repose sur plusieurs composants complémentaires :

| Composant | Description |
|---|---|
| **IA générative** | Utilisation de Google Gemini pour générer des questions, analyser des documents et accompagner les enseignants |
| **RAG** | Exploitation du programme officiel tunisien pour enrichir les générations avec des informations pédagogiques pertinentes |
| **Traitement documentaire** | Extraction et analyse du contenu des fichiers PDF fournis par les enseignants |
| **IA multimodale** | Analyse d'illustrations et génération de supports visuels destinés aux exercices pédagogiques |
| **Assistant conversationnel** | Interaction en français et en arabe pour répondre aux questions et accompagner la préparation des examens |
| **Technologies vocales** | Reconnaissance automatique de la parole, compréhension des commandes vocales et synthèse vocale |

---

## 2. Architecture générale

```
┌─────────────────────────────────────────────────┐
│              Frontend React (Vite)              │
│  Wizard 4 étapes · Assistant · Mode vocal       │
└────────────────────┬────────────────────────────┘
                     │ HTTP REST
┌────────────────────▼────────────────────────────┐
│              Backend FastAPI                    │
│                                                 │
│  quiz_engine ──► RAG (SimpleRAG + ChromaDB)     │
│                      │                          │
│                      ▼                          │
│              Google Gemini API                  │
│                                                 │
│  pdf_export    ──► ReportLab + arabic-reshaper  │
│  voice_engine  ──► faster-whisper + edge-tts    │
│  assistant     ──► Gemini (text)                │
│  image_service ──► Gemini (image)               │
└────────────────────┬────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        ▼                         ▼
  PostgreSQL                  ChromaDB
  (utilisateurs,              (vecteurs RAG)
   examens, tokens)
```

ClassAssistant adopte une architecture modulaire organisée autour de trois couches principales.

### 2.1. Frontend — React et Vite

Le frontend constitue l'interface d'interaction avec la plateforme. Il permet aux enseignants de :

| Fonctionnalité |
|---|
| Accéder à leur espace personnel |
| Sélectionner le niveau scolaire, la matière et les chapitres |
| Configurer les paramètres de génération |
| Interagir avec l'assistant pédagogique |
| Consulter et modifier les examens générés |
| Valider les contenus pédagogiques |
| Consulter l'historique et la banque de questions |
| Exporter les examens et leurs corrigés au format PDF |

### 2.2. Backend — FastAPI

Le backend assure la logique métier et coordonne les différents services de la plateforme. Il prend en charge :

| Responsabilité |
|---|
| L'authentification et la gestion des utilisateurs |
| La gestion des examens et des questions |
| L'intégration des modèles Google Gemini |
| L'exécution du système RAG |
| L'extraction et le traitement des documents PDF |
| L'analyse et la génération d'images |
| Le traitement des fonctionnalités vocales |
| La validation pédagogique |
| La génération des documents PDF |
| La communication avec PostgreSQL et ChromaDB |

### 2.3. Couche de données

| Stockage | Rôle |
|---|---|
| **PostgreSQL** | Stockage des comptes utilisateurs, des examens, des questions, des historiques et des informations nécessaires au fonctionnement de l'application |
| **ChromaDB** | Stockage des représentations vectorielles des contenus pédagogiques afin de permettre leur recherche sémantique dans le système RAG |

### 2.4. Architecture du système RAG

Le système RAG permet de connecter les capacités génératives de Gemini aux ressources du programme officiel tunisien. Son fonctionnement repose sur plusieurs étapes :

| Étape | Description |
|---|---|
| 1. Chargement | Récupération des ressources pédagogiques organisées par niveau et par matière |
| 2. Extraction | Lecture et extraction des informations textuelles à partir des documents |
| 3. Segmentation (Chunking) | Découpage des contenus en segments afin de faciliter leur traitement et leur recherche |
| 4. Vectorisation (Embedding) | Transformation des segments textuels en représentations vectorielles à l'aide de Sentence Transformers |
| 5. Indexation | Stockage des vecteurs et de leurs métadonnées dans ChromaDB |
| 6. Recherche sémantique | Récupération des passages les plus pertinents en fonction du niveau, de la matière et du chapitre |
| 7. Génération augmentée | Transmission du contexte récupéré à Google Gemini pour produire des questions adaptées |

---

## 3. Fonctionnalités principales

### 3.1. Génération intelligente d'examens — 3 modes

**A. Génération à partir du programme officiel tunisien**

L'enseignant sélectionne le niveau scolaire, la matière, un ou plusieurs chapitres et les paramètres de génération. Le système RAG récupère les contenus pédagogiques correspondants, puis Gemini les exploite pour générer un examen adapté.

**B. Génération à partir d'un document PDF**

L'enseignant importe un document pédagogique au format PDF. Le système procède à la lecture et l'extraction du contenu, l'analyse des informations pédagogiques, l'identification des notions importantes et la génération de questions contextualisées.

**C. Assemblage manuel à partir de la banque de questions**

L'enseignant construit un examen en sélectionnant des questions déjà disponibles dans la banque de questions.

### 3.2. Paramétrage des examens

| Paramètre | Détail |
|---|---|
| Niveau scolaire | De la 1ère à la 6ème année primaire |
| Matière et chapitres | Sélection multiple possible |
| Nombre de questions | Total et par type |
| Difficulté | Facile, normale, difficile |
| Durée | Configurable en minutes |
| Langue | Français ou arabe |
| Remarques | Contraintes pédagogiques complémentaires |

### 3.3. Types de questions

La plateforme prend en charge 12 types de questions pédagogiques :

| Type | Description |
|---|---|
| QCM | Questions à choix multiples avec propositions |
| Vrai ou faux | Identification de propositions correctes ou incorrectes |
| Question ouverte | Questions nécessitant une réponse rédigée |
| Rédaction | Production d'un texte structuré |
| Texte à trous | Complétion de phrases ou de paragraphes |
| Association | Mise en relation d'éléments correspondants |
| Remise en ordre | Organisation d'éléments dans un ordre logique |
| Tri | Classement d'éléments selon un critère |
| Calcul | Exercices et opérations mathématiques |
| Légende d'image | Identification et annotation d'éléments visuels |
| Dictée | Exercices de dictée adaptés au niveau scolaire |
| Compréhension de lecture | Questions portant sur un texte |

### 3.4. Édition et personnalisation

Après la génération, l'enseignant accède à un espace d'édition permettant de :

| Opération |
|---|
| Modifier les énoncés et les réponses |
| Ajouter, supprimer et dupliquer des questions |
| Réorganiser les questions |
| Ajuster les barèmes |
| Régénérer des questions ciblées à partir de remarques |

### 3.5. Validation pédagogique

Avant l'exportation, un mécanisme de validation évalue la qualité et la cohérence de l'examen :

| Contrôle |
|---|
| Cohérence des questions et de leurs réponses |
| Conformité du contenu avec les paramètres sélectionnés |
| Détection des questions incomplètes ou similaires |
| Cohérence des barèmes |
| Score de validation pédagogique et recommandations |

### 3.6. Assistant pédagogique

L'assistant conversationnel basé sur Google Gemini permet de :

| Fonctionnalité |
|---|
| Poser des questions sur les contenus scolaires |
| Obtenir des explications et des informations pédagogiques |
| Joindre des documents PDF à une conversation |
| Interagir en français et en arabe |
| Utiliser l'interface vocale en mode mains libres |

### 3.7. Analyse et génération d'images

**Analyse d'images :** un service basé sur les capacités de vision de Google Gemini permet d'analyser des illustrations et des schémas pédagogiques, d'identifier les éléments représentés et de proposer les légendes correspondantes.

**Génération d'images :** un service de génération produit des illustrations adaptées aux questions pédagogiques, utilisables dans les exercices de reconnaissance et de légende.

### 3.8. Interface vocale

| Module | Technologie | Détail |
|---|---|---|
| **ASR** | Web Speech API | Reconnaissance vocale navigateur (Chrome, Edge) |
| **ASR** | faster-whisper | Transcription côté serveur (repli automatique) |
| **ASR** | PyAV | Traitement des données audio |
| **TTS** | speechSynthesis | Synthèse vocale navigateur |
| **TTS** | edge-tts | Synthèse vocale côté serveur |
| **TTS** | Voix neurales | `fr-FR-DeniseNeural` et `ar-TN-ReemNeural` |
| **SLU** | Expressions régulières | Identification des intentions et extraction des paramètres |
| **SLU** | Google Gemini | Interprétation des intentions complexes |

Les intentions SLU reconnues :

| Intention | Déclenchée par |
|---|---|
| `creer_examen` | Demande de génération d'un examen |
| `creer_examen_pdf` | Demande de génération depuis un PDF |
| `ouvrir_mes_examens` | Demande de consultation de l'historique |
| `question` | Toute autre demande pédagogique |

### 3.9. Export PDF

| Version | Destinataire | Contenu |
|---|---|---|
| **Sujet** | Élèves | Questions et espaces de réponse |
| **Corrigé** | Enseignant | Réponses attendues mises en évidence en vert |

Mise en page :

| Élément | Détail |
|---|---|
| En-tête | Institutionnel tunisien en arabe |
| Direction | Support bidirectionnel RTL via arabic-reshaper + python-bidi |
| Polices | TraditionalArabic, SakkalMajalla et Amiri |
| Images | Intégration des illustrations dans les exercices |

### 3.10. Authentification

| Mécanisme | Détail |
|---|---|
| Email + mot de passe | Inscription et connexion sécurisée |
| Google OAuth | Connexion via compte Google |
| Réinitialisation | Code email à 6 chiffres, valable 15 min, max 5 tentatives |

---

## 4. Stack technique

### 4.1. Backend Python

| Package | Version | Rôle |
|---|---|---|
| fastapi | 0.115.0 | Framework API REST |
| uvicorn[standard] | 0.30.6 | Serveur ASGI |
| pydantic | 2.9.2 | Validation des données |
| python-dotenv | 1.0.1 | Variables d'environnement |
| google-generativeai | ≥ 0.8.0 | Gemini (texte + vision + image) |
| sentence-transformers | 3.2.1 | Embeddings pour RAG |
| chromadb | 0.5.20 | Base vectorielle (RAG) |
| requests | 2.33.1 | Appels HTTP externes |
| reportlab | 4.4.10 | Génération PDF |
| arabic-reshaper | 3.0.1 | Recomposition des caractères arabes |
| python-bidi | 0.6.11 | Algorithme bidirectionnel RTL |
| PyMuPDF | ≥ 1.23.0 | Extraction texte PDF |
| pdfplumber | ≥ 4.0.0 | Extraction texte PDF |
| pypdf | ≥ 4.0.0 | Lecture PDF |
| Pillow | ≥ 10.0.0 | Traitement d'images |
| psycopg[binary,pool] | 3.3.5 | Driver PostgreSQL |
| psycopg-pool | ≥ 3.2.0 | Pool de connexions |
| bcrypt | ≥ 4.0.0 | Hachage des mots de passe |
| python-email-validator | ≥ 2.0.0 | Validation adresses email |
| tenacity | ≥ 8.2.0 | Retry automatique |
| faster-whisper | ≥ 1.0.0 | ASR serveur |
| edge-tts | ≥ 6.1.9 | TTS neural serveur |
| av (PyAV) | ≥ 12.0.0 | Décodage audio |
| python-multipart | 0.0.9 | Upload fichiers |

### 4.2. Frontend JavaScript

| Package | Version | Rôle |
|---|---|---|
| react | 18 | Interface utilisateur |
| react-dom | 18 | Rendu DOM |
| react-router-dom | 6 | Routage SPA |
| react-markdown | 10 | Rendu Markdown dans l'assistant |
| remark-gfm | 4 | Tables et listes Markdown |
| lucide-react | 0.383 | Icônes |
| tailwindcss | 3 | Styles utilitaires |
| vite | 5 | Bundler et serveur de dev |

---

## 5. Prérequis

| Outil | Version minimale |
|---|---|
| Python | 3.11+ |
| Node.js | 18+ |
| PostgreSQL | 14+ |
| Clé API Google Gemini | Disponible sur [Google AI Studio](https://aistudio.google.com/apikey) |

---

## 6. Installation

### 6.1. Cloner le projet

```bash
git clone https://github.com/VotreUsername/Educational_Content_Generator.git
cd Educational_Content_Generator
```

### 6.2. Backend

```bash
python -m venv venv311

# Windows
venv311\Scripts\activate

# Linux / macOS
source venv311/bin/activate

pip install -r requirements.txt
```

> `faster-whisper` et `edge-tts` sont optionnels. Sans eux, l'ASR et le TTS fonctionnent uniquement via le navigateur. Le backend répond 503 si ces modules sont absents et le frontend bascule automatiquement.

### 6.3. Frontend

```bash
cd frontend
npm install
```

### 6.4. Base de données

```bash
createdb examai
```

Les tables se créent automatiquement au premier démarrage du backend.

---

## 7. Configuration — `.env`

Créer un fichier `.env` à la racine du projet :

```env
GEMINI_API_KEY=votre_cle_gemini

DATABASE_URL=postgresql://user:password@localhost:5432/examai

SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_EMAIL=votre.email@gmail.com
SMTP_PASSWORD=votre_mot_de_passe_app

GOOGLE_CLIENT_ID=votre_google_client_id

WHISPER_MODEL=small
TTS_VOIX_FR=fr-FR-DeniseNeural
TTS_VOIX_AR=ar-TN-ReemNeural
```

> Ne jamais publier le fichier `.env` sur GitHub. Les dossiers `database_tunisienne/`, `backend/eval_data/` et `backend/eval_resultats/` sont également exclus du dépôt.

---

## 8. Démarrage

**Terminal 1 — Backend :**

```bash
cd backend
uvicorn main:app --reload
```

- API REST : `http://localhost:8000`
- Documentation Swagger : `http://localhost:8000/docs`
- Documentation ReDoc : `http://localhost:8000/redoc`

**Terminal 2 — Frontend :**

```bash
cd frontend
npm run dev
```

Interface disponible sur `http://localhost:5173`

---

## 9. Structure du projet

```
Educational_Content_Generator/
│
├── backend/
│   ├── main.py                    # Routes FastAPI
│   ├── database.py                # PostgreSQL / pool psycopg
│   ├── auth.py                    # Hachage bcrypt, tokens
│   ├── google_auth.py             # OAuth Google
│   ├── email_service.py           # Envoi SMTP
│   ├── quiz_engine.py             # Génération quiz (RAG + Gemini)
│   ├── pdf_quiz_engine.py         # Génération depuis PDF
│   ├── assistant_engine.py        # Chat pédagogique Gemini
│   ├── voice_engine.py            # ASR / TTS / SLU
│   ├── pdf_export.py              # Export PDF (ReportLab)
│   ├── validation.py              # Contrôle qualité examens
│   ├── image_service.py           # Génération images Gemini
│   ├── image_analysis_service.py  # Analyse images Gemini Vision
│   ├── evaluation.py              # Scripts d'évaluation métriques
│   └── fonts/                     # Polices arabes (Amiri, etc.)
│
├── rag_system/
│   ├── document_loader.py         # Chargement JSON programme
│   ├── chunker.py                 # Découpage en chunks
│   ├── embedder.py                # Sentence Transformers
│   ├── vector_store.py            # ChromaDB
│   └── rag_engine.py              # SimpleRAG (recherche hybride)
│
├── services/
│   └── gemini_service.py          # Client Google Gemini unifié
│
├── models/
│   └── models.py                  # 12 types de questions Pydantic
│
├── prompts/
│   └── quiz_prompt.py             # Prompt engineering Gemini
│
├── frontend/
│   ├── src/
│   │   ├── pages/wizard/          # Wizard 4 étapes
│   │   ├── pages/Assistant.jsx    # Page assistant vocal
│   │   ├── voice/                 # useASR.js / useTTS.js
│   │   ├── components/            # Composants réutilisables
│   │   ├── context/               # État global React
│   │   └── api/client.js          # Client HTTP fetch
│   └── package.json
│
├── requirements.txt
├── .env
└── README.md
```

### Description des modules backend

| Module | Responsabilité |
|---|---|
| `main.py` | Initialisation de l'application et définition des routes API |
| `database.py` | Connexion et interactions avec PostgreSQL |
| `auth.py` | Authentification et gestion des comptes |
| `google_auth.py` | Authentification via Google OAuth |
| `email_service.py` | Envoi des e-mails de vérification |
| `quiz_engine.py` | Génération des examens à partir du programme officiel |
| `pdf_quiz_engine.py` | Génération d'examens à partir de documents PDF |
| `assistant_engine.py` | Gestion des conversations avec l'assistant |
| `voice_engine.py` | Gestion des traitements vocaux ASR, TTS et SLU |
| `pdf_export.py` | Création des sujets et corrigés PDF |
| `validation.py` | Contrôle et validation des examens |
| `image_service.py` | Génération des illustrations pédagogiques |
| `image_analysis_service.py` | Analyse multimodale des images |
| `evaluation.py` | Évaluation des générations et des fonctionnalités |
| `gemini_service.py` | Centralisation de l'intégration avec Google Gemini |

### Description du système RAG

| Module | Responsabilité |
|---|---|
| `document_loader.py` | Chargement et extraction des ressources pédagogiques |
| `chunker.py` | Segmentation des documents en passages |
| `embedder.py` | Transformation des textes en vecteurs |
| `vector_store.py` | Gestion de l'indexation et du stockage vectoriel |
| `rag_engine.py` | Recherche sémantique et récupération du contexte pertinent |

---

## 10. Routes API principales

### Authentification

| Méthode | Route | Description |
|---|---|---|
| POST | `/api/auth/signup` | Inscription |
| POST | `/api/auth/login` | Connexion |
| POST | `/api/auth/google` | Connexion Google OAuth |
| POST | `/api/auth/forgot-password` | Envoi code reset par email |
| POST | `/api/auth/reset-password` | Réinitialisation mot de passe |

### Programme scolaire

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/matieres` | Matières disponibles par niveau |
| GET | `/api/chapitres` | Chapitres par matière et niveau |

### Gestion des examens

| Méthode | Route | Description |
|---|---|---|
| POST | `/api/examens` | Génération depuis programme (RAG) |
| POST | `/api/examens/depuis-pdf` | Génération depuis PDF uploadé |
| POST | `/api/examens/depuis-selection` | Assemblage manuel |
| GET | `/api/examens` | Liste des examens de l'utilisateur |
| PUT | `/api/examens/{id}` | Modification des questions |
| POST | `/api/examens/{id}/valider` | Validation pédagogique |
| POST | `/api/examens/{id}/regenerer` | Régénération avec notes |
| POST | `/api/examens/{id}/export` | Export PDF élève |
| POST | `/api/examens/{id}/export/corrige` | Export PDF corrigé |

### Assistant et fonctionnalités vocales

| Méthode | Route | Description |
|---|---|---|
| POST | `/api/assistant/chat` | Conversation avec l'assistant |
| POST | `/api/assistant/slu` | Compréhension des commandes vocales |
| POST | `/api/assistant/asr` | Transcription audio (Whisper) |
| POST | `/api/assistant/tts` | Synthèse vocale (edge-tts) |

---

## 11. Sécurité

| Mécanisme | Détail |
|---|---|
| Hachage des mots de passe | bcrypt |
| Sessions | Token Bearer (table `tokens` PostgreSQL) |
| Validation des entrées | Pydantic sur toutes les routes |
| Isolation des données | Chaque utilisateur accède uniquement à ses données |
| Secrets | Variables sensibles dans `.env`, jamais committées |
| Réinitialisation | Code à 6 chiffres, expire après 15 min, max 5 tentatives |
| Anti-énumération | Réponse générique sur les endpoints de réinitialisation |
