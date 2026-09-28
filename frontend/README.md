# ExamAI — Frontend (React + Vite + Tailwind)

Reproduction fidele des maquettes ExamAI : Accueil, Authentification
(connexion / inscription avec les roles Enseignant / Eleve / Administration),
Assistant (chatbot d'aide), et le wizard de generation d'examen en 4 etapes
(Selection → Edition → Validation → Export).

## Lancer le projet

```bash
npm install
npm run dev
```

Ouvre ensuite `http://localhost:5173`.

## Structure

```
src/
├── App.jsx                 # Toutes les routes (react-router-dom)
├── components/
│   ├── TopNav.jsx           # Bandeau du haut (bleu marine), partage par les pages internes
│   ├── Stepper.jsx           # Indicateur 1-2-3-4 du wizard
│   ├── WizardShell.jsx      # TopNav + Retour + Stepper + titre, commun aux 4 etapes
│   └── StatusBadge.jsx      # Pastille "Valide" / "Brouillon"
├── context/
│   └── WizardContext.jsx    # Etat partage entre les 4 etapes (parametres, questions, validation)
├── data/
│   └── mockData.js          # Donnees d'exemple -- chaque endroit a brancher sur l'API est
│                             # marque par un commentaire "// TODO API:"
└── pages/
    ├── Login.jsx / Signup.jsx
    ├── Accueil.jsx
    ├── Assistant.jsx
    └── wizard/
        ├── Selection.jsx     # Etape 1
        ├── Edition.jsx       # Etape 2
        ├── Validation.jsx    # Etape 3
        └── Export.jsx        # Etape 4
```

## Brancher le backend FastAPI

Le frontend tourne aujourd'hui entierement sur des donnees d'exemple
(`src/data/mockData.js`) pour rester navigable independamment du backend.
Chaque point d'integration est marque `// TODO API:` dans le code :

| Ecran | Fichier | A brancher sur |
|---|---|---|
| Connexion | `pages/Login.jsx` | `POST /api/auth/login` |
| Inscription | `pages/Signup.jsx` | `POST /api/auth/signup` |
| Accueil | `data/mockData.js` (`EXAMENS_RECENTS`) | `GET /api/examens` |
| Selection (etape 1) | `pages/wizard/Selection.jsx` | `GET /api/matieres`, `GET /api/chapitres`, puis `POST /api/generate-quiz` |
| Edition (etape 2) | `context/WizardContext.jsx` | reponse de `POST /api/generate-quiz` |
| Validation (etape 3) | `context/WizardContext.jsx` (`validation`) | endpoint de revalidation cote backend |
| Export (etape 4) | `pages/wizard/Export.jsx` | endpoint d'export PDF (reponse binaire) |

Le CORS cote FastAPI doit autoriser `http://localhost:5173` (deja fait dans
le backend precedent).

## Palette / design tokens

Definis dans `tailwind.config.js` :
- `navy` : bandeau de navigation (bleu marine fonce)
- `wine` : couleur de marque (bordeaux), boutons et accents
- `blush` : fond de page (rose tres clair)

## A noter

Un detail du mockup Export ("Le fichier sera telecharge... via
st.download_button") faisait reference a Streamlit ; il a ete corrige ici
puisque ce frontend est en React.
