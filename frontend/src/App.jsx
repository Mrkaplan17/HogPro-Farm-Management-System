import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import Login from './pages/Login'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Onboard from './pages/Onboard'
import Contact from './pages/Contact'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Operations from './pages/Operations'
import GroupDetail from './pages/GroupDetail'
import Inventory from './pages/Inventory'
import Vitamins from './pages/Vitamins'
import Expenses from './pages/Expenses'
import Settings from './pages/Settings'
import ProtectedRoute from './components/ProtectedRoute'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/onboard" element={<Onboard />} />
        <Route path="/contact" element={<Contact />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="operations" element={<Operations />} />
          <Route path="operations/:id" element={<GroupDetail />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="vitamins" element={<Vitamins />} />
          <Route path="expenses" element={<Expenses />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}