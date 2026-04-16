import { useState, useEffect } from 'react';
import Loader from '../components/Loader';

const SuperAdminDashboard = () => {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginData, setLoginData] = useState({ user: '', password: '' });
  
  const [newTenant, setNewTenant] = useState({
    slug: '',
    store_name: '',
    primary_color: '#ef811e',
    bg_color: '#0cf0f172a'
  });

  useEffect(() => {
    if (sessionStorage.getItem('isSuperAdmin') === 'true') {
      setIsAuthenticated(true);
      fetchTenants();
    } else {
      setLoading(false);
    }
  }, []);

  const fetchTenants = async () => {
    try {
      const res = await fetch('/api/tenants');
      const data = await res.json();
      setTenants(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (loginData.user === 'superadmin' && loginData.password === 'superadmin2026') {
      sessionStorage.setItem('isSuperAdmin', 'true');
      setIsAuthenticated(true);
      setLoading(true);
      fetchTenants();
    } else {
      alert("Credenciales incorrectas");
    }
  };

  const handleCreateTenant = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    // Default categories & sizes payload
    const defaultCategories = [
      { id: 'cat-adulto', name: 'Adulto' },
      { id: 'cat-nino', name: 'Niño' }
    ];
    const defaultSizes = {
      'cat-adulto': ['S', 'M', 'L', 'XL'],
      'cat-nino': ['2', '4', '6', '8', '10', '12', '14', '16']
    };

    try {
      const res = await fetch('/api/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: newTenant.slug.toLowerCase().trim().replace(/[^a-z0-9-]/g, ''),
          store_name: newTenant.store_name,
          logo_url: '/logo.png',
          theme_colors: { primary: newTenant.primary_color, bg: newTenant.bg_color },
          categories: defaultCategories,
          sizes_by_category: defaultSizes
        })
      });

      if (!res.ok) throw new Error("Error creando tenant (puede que el list slug ya exista).");
      
      alert("Store (Tenant) creado exitosamente!");
      setNewTenant({ slug: '', store_name: '', primary_color: '#ef811e', bg_color: '#0cf0f172a' });
      fetchTenants();
    } catch (err) {
      alert(err.message);
      setLoading(false);
    }
  };

  if (loading) return <Loader show={true} />;

  if (!isAuthenticated) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#000' }}>
      <form className="glass" style={{ padding: '3rem', display: 'flex', flexDirection: 'column', gap: '1rem', width: '350px' }} onSubmit={handleLogin}>
        <h2 style={{ textAlign: 'center', color: '#ff0055' }}>SUPER ADMIN</h2>
        <input type="text" placeholder="User" className="glass" style={{ padding: '1rem' }} onChange={e => setLoginData({...loginData, user: e.target.value})} />
        <input type="password" placeholder="Pass" className="glass" style={{ padding: '1rem' }} onChange={e => setLoginData({...loginData, password: e.target.value})} />
        <button className="btn" style={{ background: '#ff0055', color: 'white', padding: '1rem' }}>ENTER SYSTEM</button>
      </form>
    </div>
  );

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ color: '#ff0055', margin: 0 }}>PLATFORM SUPERADMIN</h1>
        <button onClick={() => { sessionStorage.clear(); window.location.reload(); }} className="btn btn-danger">Cerrar Sesión</button>
      </header>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
        <div className="glass" style={{ padding: '2rem', height: 'fit-content' }}>
          <h3 style={{ marginBottom: '1rem' }}>Create New Store (Tenant)</h3>
          <form style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }} onSubmit={handleCreateTenant}>
            <input 
              type="text" required placeholder="Tenant Slug (e.g. mitienda)" 
              className="glass" style={{ padding: '0.8rem' }}
              value={newTenant.slug} onChange={e => setNewTenant({...newTenant, slug: e.target.value})} 
            />
            <input 
              type="text" required placeholder="Store Name" 
              className="glass" style={{ padding: '0.8rem' }}
              value={newTenant.store_name} onChange={e => setNewTenant({...newTenant, store_name: e.target.value})} 
            />
            <div>
              <label style={{ fontSize: '0.8rem', opacity: 0.8 }}>Primary Color</label>
              <input 
                type="color" className="glass" style={{ padding: '0.2rem', width: '100%' }}
                value={newTenant.primary_color} onChange={e => setNewTenant({...newTenant, primary_color: e.target.value})} 
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', opacity: 0.8 }}>Background Color</label>
              <input 
                type="color" className="glass" style={{ padding: '0.2rem', width: '100%' }}
                value={newTenant.bg_color} onChange={e => setNewTenant({...newTenant, bg_color: e.target.value})} 
              />
            </div>
            <button className="btn" style={{ background: '#ff0055', color: 'white', padding: '1rem', marginTop: '1rem' }}>🚀 CREATE TENANT</button>
          </form>
        </div>

        <div className="glass" style={{ padding: '2rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>Active Tenants ({tenants.length})</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {tenants.map(t => {
              const bg = (typeof t.theme_colors === 'string' ? JSON.parse(t.theme_colors).bg : t.theme_colors?.bg) || '#000';
              const primary = (typeof t.theme_colors === 'string' ? JSON.parse(t.theme_colors).primary : t.theme_colors?.primary) || '#ef811e';
              return (
                <div key={t.slug} className="glass" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: bg }}>
                  <div>
                    <h4 style={{ color: primary, fontSize: '1.2rem', margin: '0 0 0.5rem 0' }}>{t.store_name}</h4>
                    <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Slug: /{t.slug} | Created: {new Date(t.created_at).toLocaleDateString()}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <a href={`/${t.slug}`} target="_blank" className="btn glass" style={{ padding: '0.5rem 1rem' }}>Visit Store</a>
                    <a href={`/${t.slug}/admin`} target="_blank" className="btn glass" style={{ padding: '0.5rem 1rem' }}>Admin</a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
