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
    bg_color: '#0cf0f172a',
    secondary_color: '#1e3a8a',
    accent_color: '#fbbf24',
    logo_url: '/logo.png',
    slogan: '',
    contact_phones: '',
    font_url: '',
    font_family: '',
    layout_template: 'modern',
    categoriesArr: [
      { id: 'cat-adulto', name: 'Adulto', bg_image: '' },
      { id: 'cat-nino', name: 'Niño', bg_image: '' }
    ]
  });
  const [editingBlob, setEditingBlob] = useState(null);

  const uploadFileToBlob = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const res = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: file.name, base64: reader.result })
          });
          const data = await res.json();
          if (res.ok && data.url) resolve(data.url);
          else reject(new Error(data.error || 'Upload failed'));
        } catch(e) { reject(e); }
      };
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
    });
  };

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
    
    const validCategories = newTenant.categoriesArr.filter(c => c.name.trim() !== '');
    const configuredCategories = validCategories.map(c => ({
      ...c,
      id: c.id || `cat-${c.name.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
      name: c.name.trim()
    }));

    // Generate sizes structure keeping existing ones if editing
    let finalSizes = {};
    if (editingBlob && editingBlob.sizes_by_category) {
       finalSizes = typeof editingBlob.sizes_by_category === 'string' ? JSON.parse(editingBlob.sizes_by_category) : editingBlob.sizes_by_category;
    }
    configuredCategories.forEach(cat => {
       if (!finalSizes[cat.name]) finalSizes[cat.name] = [];
    });

    try {
      const isPut = !!editingBlob;
      const res = await fetch('/api/tenants', {
        method: isPut ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: isPut ? editingBlob.slug : newTenant.slug.toLowerCase().trim().replace(/[^a-z0-9-]/g, ''),
          store_name: newTenant.store_name,
          logo_url: newTenant.logo_url,
          slogan: newTenant.slogan,
          contact_phones: newTenant.contact_phones,
          font_url: newTenant.font_url,
          font_family: newTenant.font_family,
          layout_template: newTenant.layout_template,
          theme_colors: { 
            primary: newTenant.primary_color, 
            bg: newTenant.bg_color,
            secondary: newTenant.secondary_color,
            accent: newTenant.accent_color
          },
          categories: configuredCategories,
          sizes_by_category: finalSizes
        })
      });

      if (!res.ok) throw new Error("Error guardando tenant (puede que el slug ya exista).");
      
      alert(isPut ? "Store actualizado exitosamente!" : "Store (Tenant) creado exitosamente!");
      setNewTenant({ 
        slug: '', store_name: '', logo_url: '/logo.png', slogan: '', contact_phones: '', 
        primary_color: '#ef811e', bg_color: '#0cf0f172a', secondary_color: '#1e3a8a', accent_color: '#fbbf24',
        font_url: '', font_family: '', layout_template: 'modern',
        categoriesArr: [{ id: 'cat-adulto', name: 'Adulto', bg_image: '' }, { id: 'cat-nino', name: 'Niño', bg_image: '' }]
      });
      setEditingBlob(null);
      fetchTenants();
    } catch (err) {
      alert(err.message);
      setLoading(false);
    }
  };

  const startEdit = (t) => {
    const theme = typeof t.theme_colors === 'string' ? JSON.parse(t.theme_colors) : (t.theme_colors || {});
    const bg = theme.bg || '#0cf0f172a';
    const primary = theme.primary || '#ef811e';
    const secondary = theme.secondary || '#1e3a8a';
    const accent = theme.accent || '#fbbf24';
    const catsArr = typeof t.categories === 'string' ? JSON.parse(t.categories) : (t.categories || []);

    setEditingBlob(t);
    setNewTenant({
      slug: t.slug,
      store_name: t.store_name,
      logo_url: t.logo_url || '/logo.png',
      slogan: t.slogan || '',
      contact_phones: t.contact_phones || '',
      font_url: t.font_url || '',
      font_family: t.font_family || '',
      layout_template: t.layout_template || 'modern',
      primary_color: primary,
      bg_color: bg,
      secondary_color: secondary,
      accent_color: accent,
      categoriesArr: catsArr.length > 0 ? catsArr : [{ id: '', name: '', bg_image: '' }]
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteTenant = async (slug) => {
    if (!window.confirm(`¿Estás seguro de que quieres eliminar la tienda ${slug}? Esto no se puede deshacer.`)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/tenants?slug=${slug}`, { method: 'DELETE' });
      if (res.ok) fetchTenants();
      else alert('Error al eliminar');
    } catch (e) { alert('Error: ' + e.message); setLoading(false); }
  };

  if (loading) return <Loader show={true} />;

  if (!isAuthenticated) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#000' }}>
      <form className="glass" style={{ padding: '3rem', display: 'flex', flexDirection: 'column', gap: '1rem', width: '350px' }} onSubmit={handleLogin}>
        <h2 style={{ textAlign: 'center', color: '#ff0055' }}>SUPER ADMIN</h2>
        <input type="text" placeholder="User" className="glass" style={{ padding: '1rem', color: 'white' }} onChange={e => setLoginData({...loginData, user: e.target.value})} />
        <input type="password" placeholder="Pass" className="glass" style={{ padding: '1rem', color: 'white' }} onChange={e => setLoginData({...loginData, password: e.target.value})} />
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0 }}>{editingBlob ? 'Edit Store Configurations' : 'Create New Store (Tenant)'}</h3>
            {editingBlob && (
              <button 
                type="button" 
                onClick={() => { 
                  setEditingBlob(null); 
                  setNewTenant({ slug: '', store_name: '', primary_color: '#ef811e', bg_color: '#0cf0f172a', logo_url: '/logo.png', slogan: '', contact_phones: '', categoriesArr: [{ id: 'cat-adulto', name: 'Adulto', bg_image: '' }, { id: 'cat-nino', name: 'Niño', bg_image: '' }] }); 
                }}
                className="btn glass" 
                style={{ fontSize: '0.7rem', padding: '0.3rem 0.6rem' }}
              >
                Cancel Edit
              </button>
            )}
          </div>
          <form style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }} onSubmit={handleCreateTenant}>
            
            <div style={{ background: 'rgba(0,0,0,0.15)', padding: '1.5rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <h4 style={{ margin: '0 0 1rem 0', color: 'var(--primary)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Basic Info</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <input 
                  type="text" required placeholder="Tenant Slug (e.g. mitienda)" 
                  className="glass" style={{ padding: '1rem', opacity: editingBlob ? 0.5 : 1 }}
                  value={newTenant.slug} onChange={e => setNewTenant({...newTenant, slug: e.target.value})} 
                  disabled={!!editingBlob}
                />
                <input 
                  type="text" required placeholder="Store Name" 
                  className="glass" style={{ padding: '1rem' }}
                  value={newTenant.store_name} onChange={e => setNewTenant({...newTenant, store_name: e.target.value})} 
                />
              </div>
            </div>

            <div style={{ background: 'rgba(0,0,0,0.15)', padding: '1.5rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <h4 style={{ margin: '0 0 1rem 0', color: 'var(--primary)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Branding & Typography</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <input 
                  type="text" placeholder="Slogan (Optional)" 
                  className="glass" style={{ padding: '1rem' }}
                  value={newTenant.slogan} onChange={e => setNewTenant({...newTenant, slogan: e.target.value})} 
                />
                <input 
                  type="text" placeholder="Contact Phones (Optional, e.g. 555-1234)" 
                  className="glass" style={{ padding: '1rem' }}
                  value={newTenant.contact_phones} onChange={e => setNewTenant({...newTenant, contact_phones: e.target.value})} 
                />
                <input 
                  type="text" placeholder="Google Fonts CSS Link URL" 
                  className="glass" style={{ padding: '1rem' }}
                  value={newTenant.font_url} 
                  onChange={e => {
                    const url = e.target.value;
                    let detectedFamily = newTenant.font_family;
                    
                    // Logic to extract font family from Google Fonts URL
                    try {
                      if (url.includes('family=')) {
                        const familyPart = url.split('family=')[1].split('&')[0].split(':')[0];
                        detectedFamily = `'${familyPart.replace(/\+/g, ' ')}', sans-serif`;
                      }
                    } catch (err) { console.log('Font parse error', err); }

                    setNewTenant({...newTenant, font_url: url, font_family: detectedFamily});
                  }} 
                />
                <input 
                  type="text" placeholder="CSS Font Family (e.g. 'Roboto Condensed', sans-serif)" 
                  className="glass" style={{ padding: '1rem' }}
                  value={newTenant.font_family} onChange={e => setNewTenant({...newTenant, font_family: e.target.value})} 
                />
                <div style={{ marginTop: '0.5rem' }}>
                  <label style={{ fontSize: '0.8rem', opacity: 0.8, display: 'block', marginBottom: '0.5rem' }}>Store Logo</label>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div style={{ padding: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '50%' }}>
                      <img src={newTenant.logo_url} alt="Logo" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'contain', background: '#fff' }} />
                    </div>
                    <input 
                      type="file" className="glass" style={{ padding: '0.6rem', width: '100%', fontSize: '0.8rem' }}
                      onChange={async e => {
                        if (e.target.files[0]) {
                          setLoading(true);
                          try {
                            const url = await uploadFileToBlob(e.target.files[0]);
                            setNewTenant({...newTenant, logo_url: url});
                          } catch (err) { alert("Error uploading: " + err.message); }
                          setLoading(false);
                        }
                      }} 
                    />
                  </div>
                </div>
              </div>
            </div>

            <div style={{ background: 'rgba(0,0,0,0.15)', padding: '1.5rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <h4 style={{ margin: '0 0 1rem 0', color: 'var(--primary)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Theme Colors (4-Palette)</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.7rem', opacity: 0.8, display: 'block', marginBottom: '0.4rem' }}>Primary (Actions)</label>
                  <input 
                    type="color" className="glass" style={{ padding: '0.2rem', width: '100%', height: '40px', cursor: 'pointer' }}
                    value={newTenant.primary_color} onChange={e => setNewTenant({...newTenant, primary_color: e.target.value})} 
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', opacity: 0.8, display: 'block', marginBottom: '0.4rem' }}>Background (Base)</label>
                  <input 
                    type="color" className="glass" style={{ padding: '0.2rem', width: '100%', height: '40px', cursor: 'pointer' }}
                    value={newTenant.bg_color} onChange={e => setNewTenant({...newTenant, bg_color: e.target.value})} 
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', opacity: 0.8, display: 'block', marginBottom: '0.4rem' }}>Secondary (UI/Borders)</label>
                  <input 
                    type="color" className="glass" style={{ padding: '0.2rem', width: '100%', height: '40px', cursor: 'pointer' }}
                    value={newTenant.secondary_color} onChange={e => setNewTenant({...newTenant, secondary_color: e.target.value})} 
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', opacity: 0.8, display: 'block', marginBottom: '0.4rem' }}>Accent (Badges/Status)</label>
                  <input 
                    type="color" className="glass" style={{ padding: '0.2rem', width: '100%', height: '40px', cursor: 'pointer' }}
                    value={newTenant.accent_color} onChange={e => setNewTenant({...newTenant, accent_color: e.target.value})} 
                  />
                </div>
              </div>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.15)', padding: '1.5rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <h4 style={{ margin: '0 0 1rem 0', color: 'var(--primary)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Layout Template</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div 
                  onClick={() => setNewTenant({...newTenant, layout_template: 'modern'})}
                  className={`glass ${newTenant.layout_template === 'modern' ? 'active' : ''}`}
                  style={{ 
                    padding: '1rem', cursor: 'pointer', textAlign: 'center', 
                    border: newTenant.layout_template === 'modern' ? '2px solid var(--primary)' : '1px solid rgba(255,255,255,0.1)',
                    background: newTenant.layout_template === 'modern' ? 'rgba(239, 129, 30, 0.1)' : 'transparent'
                  }}
                >
                  <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🖼️</div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Modern Glass</div>
                </div>
                <div 
                  onClick={() => setNewTenant({...newTenant, layout_template: 'catalog'})}
                  className={`glass ${newTenant.layout_template === 'catalog' ? 'active' : ''}`}
                  style={{ 
                    padding: '1rem', cursor: 'pointer', textAlign: 'center', 
                    border: newTenant.layout_template === 'catalog' ? '2px solid var(--primary)' : '1px solid rgba(255,255,255,0.1)',
                    background: newTenant.layout_template === 'catalog' ? 'rgba(239, 129, 30, 0.1)' : 'transparent'
                  }}
                >
                  <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>📑</div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Pro Catalog</div>
                </div>
              </div>
            </div>

            <div style={{ background: 'rgba(0,0,0,0.15)', padding: '1.5rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h4 style={{ margin: 0, color: 'var(--primary)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Categories Config</h4>
                <button type="button" onClick={() => setNewTenant({...newTenant, categoriesArr: [...newTenant.categoriesArr, { id: `cat-${Date.now()}`, name: '', bg_image: '' }]})} className="btn" style={{ fontSize: '0.7rem', padding: '0.3rem 0.6rem', background: 'var(--primary)', color: '#fff' }}>+ Add Category</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                {newTenant.categoriesArr.map((cat, i) => (
                  <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input 
                      type="text" placeholder="Cat Name" className="glass" style={{ padding: '0.5rem', flex: 1 }}
                      value={cat.name} onChange={e => {
                        const arr = [...newTenant.categoriesArr];
                        arr[i].name = e.target.value;
                        setNewTenant({...newTenant, categoriesArr: arr});
                      }} 
                    />
                    <div style={{ position: 'relative', width: '35px', height: '35px', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.2)', flexShrink: 0, background: '#222' }}>
                      {cat.bg_image && <img src={cat.bg_image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                      <input 
                        type="file" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                        onChange={async e => {
                          if (e.target.files[0]) {
                            setLoading(true);
                            try {
                              const url = await uploadFileToBlob(e.target.files[0]);
                              const arr = [...newTenant.categoriesArr];
                              arr[i].bg_image = url;
                              setNewTenant({...newTenant, categoriesArr: arr});
                            } catch (err) { alert("Error uploading bg: " + err.message); }
                            setLoading(false);
                          }
                        }} 
                      />
                    </div>
                    <button type="button" onClick={() => {
                      setNewTenant({...newTenant, categoriesArr: newTenant.categoriesArr.filter((_, idx) => idx !== i)});
                    }} style={{ background: 'transparent', border: 'none', color: '#ff4444', cursor: 'pointer', fontSize: '1.2rem', padding: '0 0.5rem' }}>&times;</button>
                  </div>
                ))}
              </div>
            </div>
            <button className="btn" style={{ background: '#ff0055', color: 'white', padding: '1rem', marginTop: '1rem' }}>
              {editingBlob ? '💾 SAVE CHANGES' : '🚀 CREATE TENANT'}
            </button>
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
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div style={{ padding: '4px', background: 'rgba(255,255,255,0.3)', borderRadius: '50%' }}>
                      <img src={t.logo_url || '/logo.png'} alt="" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'contain', background: '#fff' }} />
                    </div>
                    <div>
                      <h4 style={{ color: primary, fontSize: '1.3rem', margin: '0 0 0.2rem 0' }}>{t.store_name}</h4>
                      <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>/{t.slug} | {new Date(t.created_at).toLocaleDateString()}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end', marginTop: '1rem' }}>
                    <button onClick={() => startEdit(t)} className="btn glass" style={{ padding: '0.5rem 1.2rem', fontSize: '0.8rem' }}>Edit</button>
                    <a href={`/${t.slug}`} target="_blank" className="btn glass" style={{ padding: '0.5rem 1.2rem', fontSize: '0.8rem', color: '#60a5fa' }}>Visit</a>
                    <a href={`/${t.slug}/admin`} target="_blank" className="btn glass" style={{ padding: '0.5rem 1.2rem', fontSize: '0.8rem', color: '#34d399' }}>Admin</a>
                    <button onClick={() => handleDeleteTenant(t.slug)} className="btn glass" style={{ padding: '0.5rem 1.2rem', fontSize: '0.8rem', color: '#ffaaaa' }}>Delete</button>
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
