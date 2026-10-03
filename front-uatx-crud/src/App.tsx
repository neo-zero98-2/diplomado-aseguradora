import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import HomePage from './pages/HomePage.tsx'
import LoginPage from './pages/LoginPage.tsx'
import ProtectedRoute from './routes/ProtectedRoute.tsx'
import { useAppSelector } from './store/index.ts'

function App() {
  const haySesion = useAppSelector((state) => !!state.auth.accessToken)

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={haySesion ? <Navigate to="/home" replace /> : <LoginPage />}
        />
        <Route
          path="/home"
          element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
