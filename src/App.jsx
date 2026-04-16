import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Catalog from './pages/Catalog';
import AdminDashboard from './pages/AdminDashboard';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import { TenantWrapper } from './context/TenantContext';
import './index.css';

function App() {
  return (
    <Router>
      <div className="app-container">
        <Routes>
          {/* Main Landing / Root Redirect */}
          <Route path="/" element={<Navigate to="/deportux" replace />} />
          
          <Route path="/superadmin" element={<SuperAdminDashboard />} />

          {/* Tenant Routes */}
          <Route path="/:tenantId" element={
            <TenantWrapper><Catalog /></TenantWrapper>
          } />
          <Route path="/:tenantId/category/:catName" element={
            <TenantWrapper><Catalog /></TenantWrapper>
          } />
          <Route path="/:tenantId/admin" element={
            <TenantWrapper><AdminDashboard /></TenantWrapper>
          } />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
