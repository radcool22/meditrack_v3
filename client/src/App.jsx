import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { LanguageProvider } from './context/LanguageContext'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import ReportPage from './pages/ReportPage'
import ElevenLabsTest from './pages/ElevenLabsTest'
import HealthSidebar from './components/HealthSidebar'
import VideoProgressCard from './components/VideoProgressCard'
import CalculatorsPage from './pages/CalculatorsPage'
import './utils/i18n.js'

// Redirects authenticated users away from public-only routes (e.g. /login)
function PublicRoute({ children }) {
  const { token, loading } = useAuth()
  if (loading) return null
  if (token) return <Navigate to="/dashboard" replace />
  return children
}

function AppShell() {
  const { token } = useAuth()
  const { pathname } = useLocation()
  const showSidebar = !!token && pathname !== '/login'

  return (
    <>
      <Routes>
        <Route path="/" element={<Navigate to={token ? '/dashboard' : '/login'} replace />} />
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
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
        <Route
          path="/calculators"
          element={
            <ProtectedRoute>
              <CalculatorsPage />
            </ProtectedRoute>
          }
        />
        <Route path="/test-voice" element={<ElevenLabsTest />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
      {showSidebar && <HealthSidebar />}
      {token && <VideoProgressCard />}
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
