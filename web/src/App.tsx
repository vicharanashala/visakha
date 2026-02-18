import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './layouts/Layout';
import { Dashboard } from './pages/Dashboard';
import { Login } from './pages/Login';
import { TeamManagement } from './pages/TeamManagement';
import { DatabaseManagement } from './pages/DatabaseManagement';
import { FAQPage } from './pages/FAQPage';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<Layout><Dashboard /></Layout>} path="/" />
            <Route element={<Layout><Dashboard /></Layout>} path="/c/:id" />
          </Route>

          <Route element={<ProtectedRoute requireSuperAdmin />}>
            <Route element={<Layout><TeamManagement /></Layout>} path="/team" />
            <Route element={<Layout><DatabaseManagement /></Layout>} path="/database" />
            <Route element={<Layout><FAQPage /></Layout>} path="/faqs" />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
