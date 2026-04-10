import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { LanguageProvider } from './context/LanguageContext'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import ReportPage from './pages/ReportPage'
import ElevenLabsTest from './pages/ElevenLabsTest'
import HealthSidebar from './components/HealthSidebar'
import './utils/i18n.js'

function AppShell() {
  const { token } = useAuth()
  const { pathname } = useLocation()
  const showSidebar = !!token && pathname !== '/login'

  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/report/:id"
          element={
            <ProtectedRoute>
              <ReportPage />
            </ProtectedRoute>
          }
        />
        <Route path="/test-voice" element={<ElevenLabsTest />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
      {showSidebar && <HealthSidebar />}
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <BrowserRouter>
          <AppShell />
        </BrowserRouter>
      </LanguageProvider>
    </AuthProvider>
  )
}
