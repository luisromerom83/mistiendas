import { createContext, useState, useEffect, useContext } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import Loader from '../components/Loader';

const TenantContext = createContext();

export const useTenantInfo = () => useContext(TenantContext);

export const TenantWrapper = ({ children }) => {
  const { tenantId } = useParams();
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // If we're on root path (should probably redirect)
    if (!tenantId) {
      setError('No tenant specified.');
      setLoading(false);
      return;
    }

    const fetchTenant = async () => {
      try {
        setLoading(true);
        const r = await fetch(`/api/tenants?slug=${tenantId}`);
        if (!r.ok) {
          throw new Error('Store not found.');
        }
        const data = await r.json();
        
        let theme = data.theme_colors || {};
        if (typeof theme === 'string') theme = JSON.parse(theme);

        // Apply CSS Variables globally
        const root = document.documentElement;
        if (theme.primary) root.style.setProperty('--primary', theme.primary);
        if (theme.bg) root.style.setProperty('--bg-color', theme.bg);
        // Can add more custom tokens here
        
        document.title = data.store_name || "Tienda";
        setTenant(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTenant();
  }, [tenantId]);

  if (loading) return <Loader show={true} />;
  
  if (error) return (
    <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#0f172a', color: 'white' }}>
      <div className="glass" style={{ padding: '3rem', textAlign: 'center' }}>
        <h2 style={{ color: '#ef4444', marginBottom: '1rem' }}>404</h2>
        <p>{error}</p>
      </div>
    </div>
  );

  return (
    <TenantContext.Provider value={{ tenant, setTenant }}>
      {children}
    </TenantContext.Provider>
  );
};
