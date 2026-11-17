import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'
import ForgotPassword from './pages/ForgotPassword.jsx'
import Accueil from './pages/Accueil.jsx'
import Assistant from './pages/Assistant.jsx'
import MesExamens from './pages/MesExamens.jsx'
import BanqueQuestions from './pages/BanqueQuestions.jsx'
import Selection from './pages/wizard/Selection.jsx'
import Edition from './pages/wizard/Edition.jsx'
import Validation from './pages/wizard/Validation.jsx'
import Export from './pages/wizard/Export.jsx'
import { WizardProvider } from './context/WizardContext.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import RequireAuth from './components/RequireAuth.jsx'
import RedirectIfAuthed from './components/RedirectIfAuthed.jsx'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {}
        <Route path="/" element={<RedirectIfAuthed><Accueil /></RedirectIfAuthed>} />
        <Route path="/login" element={<RedirectIfAuthed><Login /></RedirectIfAuthed>} />
        <Route path="/signup" element={<RedirectIfAuthed><Signup /></RedirectIfAuthed>} />
        {}
        <Route path="/forgot-password" element={<RedirectIfAuthed><ForgotPassword /></RedirectIfAuthed>} />
        <Route path="/aide" element={<Navigate to="/assistant" replace />} />

        {}
        <Route
          element={
            <RequireAuth>
              <WizardProvider>
                <Outlet />
              </WizardProvider>
            </RequireAuth>
          }
        >
          <Route path="/assistant" element={<Assistant />} />
          <Route path="/mes-examens" element={<MesExamens />} />
          <Route path="/banque-questions" element={<BanqueQuestions />} />

          <Route path="/wizard" element={<Outlet />}>
            <Route index element={<Navigate to="selection" replace />} />
            <Route path="selection" element={<Selection />} />
            <Route path="edition" element={<Edition />} />
            <Route path="validation" element={<Validation />} />
            <Route path="export" element={<Export />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}