import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  // Le .env est partage avec le backend, un dossier au-dessus de celui-ci
  // (Educational_Conten_Generator/.env, pas backend_chatbot/.env ni
  // frontend/.env). Par defaut Vite ne regarde QUE dans son propre
  // dossier racine, jamais dans un parent (contrairement a python-dotenv
  // cote backend, qui remonte automatiquement) -- envDir corrige ca.
  //
  // Si ce fichier ne se trouve pas directement dans le dossier frontend
  // (a cote de package.json), ou si le .env est a un autre niveau,
  // ajuste le chemin ci-dessous en consequence.
  envDir: '../',
})