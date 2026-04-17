import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Loader from '../components/Loader';
import { useTenantInfo } from '../context/TenantContext';

// --- SUB-COMPONENTS ---

const CategoryCard = ({ title, img, onClick }) => (
  <div 
    onClick={onClick}
    className="glass category-card" 
    style={{ 
      borderRadius: '1.5rem', overflow: 'hidden', cursor: 'pointer', position: 'relative',
      border: '1px solid #e2e8f0'
    }}
  >
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }}>
        <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.8) 100%)' }}></div>
    </div>
    <div className="category-card-info">
        <h3>{title}</h3>
        <button className="btn" style={{ background: 'var(--bg-color)', color: 'white' }}>Ver Catálogo ➔</button>
    </div>
  </div>
);

const ProductCard = ({ product, onOpenImage, onAddToCart, themeColor }) => {
  const [selectedSize, setSelectedSize] = useState('');
  const isOrder = product.type === 'order';
  const isOutOfStock = !isOrder && (product.stock_quantity !== undefined && product.stock_quantity <= 0);
  
  const sizes = (product.size || '').split(',').map(s => s.trim()).filter(s => s && s !== 'N/A');
  const needsSize = sizes.length > 0;

  return (
    <div className="glass card" style={{ 
      opacity: isOutOfStock ? 0.7 : 1,
      background: themeColor || 'white',
      color: themeColor ? 'white' : 'inherit',
      border: '1px solid #e2e8f0'
    }}>
      <div style={{ position: 'relative', cursor: 'zoom-in' }} onClick={() => onOpenImage(product.image_url)}>
        <img src={product.image_url} alt={product.name} className="product-img" loading="lazy" style={{ filter: isOutOfStock ? 'grayscale(1)' : 'none' }} />
        <span className="badge" style={{ 
          position: 'absolute', top: '1rem', left: '1rem', background: isOrder ? '#fbbf24' : (isOutOfStock ? '#ef4444' : 'var(--accent)'),
          color: isOrder ? 'black' : 'white', fontWeight: 'bold', fontSize: '0.65rem'
        }}>{isOrder ? 'BAJO PEDIDO' : (isOutOfStock ? 'AGOTADO' : 'EN EXISTENCIA')}</span>
        <span className="badge" style={{ 
          position: 'absolute', bottom: '1rem', left: '1rem', background: 'color-mix(in srgb, var(--secondary) 25%, transparent)',
          backdropFilter: 'blur(8px)', color: 'white', fontSize: '0.6rem', padding: '0.2rem 0.6rem',
          border: '1px solid color-mix(in srgb, var(--secondary) 50%, transparent)'
        }}>{product.category?.toUpperCase() || 'ADULTO'}</span>
      </div>
      <div className="product-info">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.25rem' }}>{product.name}</h3>
          <span style={{ color: themeColor ? 'white' : 'var(--primary)', fontWeight: 'bold', fontSize: '0.82rem', opacity: 0.9 }}>#{product.short_id}</span>
        </div>

        {needsSize && (
          <div style={{ margin: '0.8rem 0' }}>
            <div style={{ fontSize: '0.65rem', opacity: 0.6, marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Selecciona Talla:</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {sizes.map(s => {
                const stock = product.stock_by_size ? product.stock_by_size[s] : 0;
                const isSizeOut = !isOrder && (stock === 0 || stock === undefined);
                return (
                  <button 
                    key={s} 
                    disabled={isSizeOut}
                    onClick={() => setSelectedSize(s)}
                    className={`size-tag ${selectedSize === s ? 'active' : ''} ${isSizeOut ? 'disabled' : ''}`}
                    style={{ padding: '0.3rem 0.6rem', fontSize: '0.7rem', minWidth: '35px', position: 'relative' }}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
          <span className="price" style={{ color: themeColor ? 'white' : (isOrder ? '#fbbf24' : 'var(--primary)') }}>
            {isOrder ? 'Cotizar' : `$${product.price}`}
          </span>
          <button 
            onClick={() => onAddToCart(selectedSize)} 
            className="btn btn-primary" 
            style={{ 
              padding: '0.5rem 1rem',
              background: themeColor ? 'white' : 'var(--primary)',
              color: themeColor ? 'var(--primary)' : 'white'
            }} 
            disabled={isOutOfStock || (needsSize && !selectedSize)}
          >
            {isOrder ? 'Consultar' : (isOutOfStock ? 'Agotado' : 'Añadir 🛒')}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- MAIN COMPONENT ---

const Catalog = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState([]);
  const [isCartVisible, setIsCartVisible] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  
  const { tenant } = useTenantInfo();
  const { catName } = useParams();
  const navigate = useNavigate();
  const currentCategory = catName || 'home';

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    fetchProducts();
    return () => window.removeEventListener('resize', handleResize);
  }, [tenant.slug]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/products?tenant_id=${tenant.slug}`);
      const data = await response.json();
      const grouped = data.reduce((acc, p) => {
        const key = `${p.name.toLowerCase()}-${(p.category || 'Adulto').toLowerCase()}`;
        if (!acc[key]) {
          acc[key] = { ...p };
        } else {
          acc[key].stock_by_size = { ...(acc[key].stock_by_size || {}), ...(p.stock_by_size || {}) };
          acc[key].stock_quantity = (acc[key].stock_quantity || 0) + (p.stock_quantity || 0);
          const allSizes = Object.keys(acc[key].stock_by_size).filter(k => acc[key].stock_by_size[k] > 0);
          acc[key].size = allSizes.join(', ');
        }
        return acc;
      }, {});
      setProducts(Object.values(grouped));
    } catch (error) {
      console.error("Error products:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesCategory = currentCategory === 'home' ? true : 
                            ((p.category || 'Adulto').toLowerCase() === currentCategory.toLowerCase());
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    let matchesFilter = true;
    if (filterType === 'favorites') matchesFilter = p.is_favorite;
    if (filterType === 'stock') matchesFilter = p.type === 'stock';
    if (filterType === 'order') matchesFilter = p.type === 'order';
    return matchesCategory && matchesSearch && matchesFilter;
  });

  const addToCart = (product, selectedSize) => {
    if (!selectedSize && product.size && product.size !== 'N/A') return alert("Por favor selecciona una talla");
    setCart(prev => {
      const cartId = `${product.id}-${selectedSize || 'NA'}`;
      const existing = prev.find(item => item.cartId === cartId);
      if (existing) {
        return prev.map(item => item.cartId === cartId ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, cartId, selectedSize, quantity: 1 }];
    });
    setIsCartVisible(true);
  };

  const checkoutToWhatsApp = () => {
    const phone = tenant.contact_phones ? tenant.contact_phones.split(',')[0].trim() : "525514512919";
    let message = `*${tenant.store_name} - Nuevo Pedido* 🛒\n\n`;
    let total = 0;
    cart.forEach(item => {
      const priceText = item.type === 'order' ? 'Cotizar' : `$${item.price}`;
      const sizeText = item.selectedSize ? ` Talla: ${item.selectedSize}` : '';
      message += `• ${item.quantity}x [#${item.short_id}] ${item.name}${sizeText} - ${priceText}\n`;
      if (item.type !== 'order') total += item.price * item.quantity;
    });
    if (total > 0) message += `\n*TOTAL APROX:* $${total}`;
    message += `\n\n_Por favor confirmar existencias y tallas._`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  return (
    <div className="catalog-page" style={{ padding: '2rem 1rem', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div className="app-container">
        
        {/* HEADER */}
        <header style={{ 
          background: 'var(--primary)', 
          color: 'white', 
          padding: isMobile ? '0.8rem 1rem' : '1.2rem 2rem', 
          display: 'grid', 
          gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1.5fr 1fr', 
          alignItems: 'center' 
        }}>
          <div style={{ display: 'flex', alignItems: 'center' }} onClick={() => navigate(`/${tenant.slug}`)} className="pointer">
            <img src={tenant.logo_url || '/logo.png'} alt={tenant.store_name} style={{ height: isMobile ? '35px' : '50px', objectFit: 'contain' }} />
          </div>
          {!isMobile && (
            <div style={{ textAlign: 'center' }}>
              <a href={`https://wa.me/${tenant.contact_phones?.split(',')[0].trim()}`} target="_blank" rel="noreferrer" style={{ color: 'white', fontWeight: 'bold', textDecoration: 'none' }}>
                📲 WhatsApp {tenant.contact_phones?.split(',')[0].trim()}
              </a>
            </div>
          )}
          <div style={{ textAlign: 'right', fontWeight: 'bold', textTransform: 'uppercase', fontSize: isMobile ? '0.7rem' : '1rem' }}>{tenant.store_name}</div>
        </header>

        {/* CONTENT */}
        <div style={{ padding: '2rem' }}>
          <Loader show={loading} imgSrc={tenant?.logo_url} />

          {tenant.layout_template === 'catalog' ? (
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '250px 1fr', gap: isMobile ? '1rem' : '3rem' }}>
              <aside style={{ position: 'sticky', top: isMobile ? '0' : '2rem', zIndex: 10, background: isMobile ? 'white' : 'transparent', margin: isMobile ? '-1rem -1rem 1rem -1rem' : '0' }}>
                <div className={isMobile ? 'mobile-scroll-nav' : 'glass'} style={{ padding: isMobile ? '0.5rem 1rem' : '1.5rem', borderRadius: isMobile ? '0' : '1rem', border: isMobile ? 'none' : '1px solid #e2e8f0', borderBottom: isMobile ? '1px solid #e2e8f0' : '' }}>
                  {!isMobile && <h4 style={{ fontSize: '0.75rem', opacity: 0.5, textTransform: 'uppercase', marginBottom: '1rem' }}>Categorías</h4>}
                  <div style={{ display: 'flex', flexDirection: isMobile ? 'row' : 'column', gap: '0.5rem' }}>
                    <div onClick={() => navigate(`/${tenant.slug}`)} style={{ padding: '0.6rem 1rem', cursor: 'pointer', borderRadius: '8px', background: currentCategory === 'home' ? 'var(--bg-color)' : 'transparent', color: currentCategory === 'home' ? 'white' : (isMobile ? 'var(--primary)' : 'inherit'), border: isMobile ? '1px solid var(--bg-color)' : 'none', fontWeight: isMobile ? 'bold' : 'normal', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>🏠 Inicio</div>
                    {tenant.categories.map(cat => (
                      <div key={cat.id} onClick={() => navigate(`/${tenant.slug}/category/${cat.name}`)} style={{ padding: '0.6rem 1rem', cursor: 'pointer', borderRadius: '8px', background: currentCategory === cat.name ? 'var(--bg-color)' : 'transparent', color: currentCategory === cat.name ? 'white' : (isMobile ? 'var(--text-main)' : 'inherit'), border: isMobile ? (currentCategory === cat.name ? '1px solid var(--bg-color)' : '1px solid #e2e8f0') : 'none', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{cat.name}</div>
                    ))}
                  </div>
                </div>
              </aside>
              <main>
                <h1 style={{ marginBottom: '1.5rem', fontSize: isMobile ? '1.5rem' : '2.5rem' }}>{currentCategory === 'home' ? 'Novedades' : currentCategory}</h1>
                <div className="grid">
                  {filteredProducts.map(p => (
                    <ProductCard key={p.id} product={p} themeColor="var(--primary)" onOpenImage={setSelectedImage} onAddToCart={(sz) => addToCart(p, sz)} />
                  ))}
                </div>
              </main>
            </div>
          ) : (
            <div>
              <h1 style={{ textAlign: 'center', marginBottom: isMobile ? '1.5rem' : '3rem', fontSize: isMobile ? '1.8rem' : '3rem' }}>{tenant.slogan || 'Catálogo'}</h1>
              {currentCategory === 'home' ? (
                <div className="grid">
                  {tenant.categories.map(cat => (
                    <CategoryCard key={cat.id} title={cat.name} img={cat.bg_image} onClick={() => navigate(`/${tenant.slug}/category/${cat.name}`)} />
                  ))}
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <button onClick={() => navigate(`/${tenant.slug}`)} className="btn" style={{ border: '1px solid var(--primary)', padding: '0.5rem 1rem', fontSize: '0.8rem' }}>⬅ Volver</button>
                    <h2 style={{ textTransform: 'uppercase', fontSize: isMobile ? '1.2rem' : '2rem' }}>{currentCategory}</h2>
                    <div></div>
                  </div>
                  <div className="grid">
                    {filteredProducts.map(p => (
                      <ProductCard key={p.id} product={p} onOpenImage={setSelectedImage} onAddToCart={(sz) => addToCart(p, sz)} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <footer style={{ padding: '3rem', textAlign: 'center', opacity: 0.5, borderTop: '1px solid #f1f5f9' }}>
          © {new Date().getFullYear()} {tenant.store_name}
        </footer>
      </div>

      {/* MODALS */}
      {cart.length > 0 && (
        <div style={{ position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 2000 }}>
          <button onClick={() => setIsCartVisible(!isCartVisible)} className="btn btn-primary" style={{ width: '60px', height: '60px', borderRadius: '50%' }}>
            🛒 <span style={{ position: 'absolute', top: 0, right: 0, background: 'red', color: 'white', borderRadius: '50%', width: '20px', height: '20px', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{cart.length}</span>
          </button>
          {isCartVisible && (
            <div className="glass" style={{ position: 'absolute', bottom: '70px', right: 0, width: '300px', padding: '1.5rem', borderRadius: '1rem', border: '1px solid #e2e8f0' }}>
               <h4 style={{ marginBottom: '1rem' }}>Tu Carrito</h4>
               {cart.map(item => (
                 <div key={item.cartId} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                   <span>{item.quantity}x {item.name}</span>
                   <span>${item.price * item.quantity}</span>
                 </div>
               ))}
               <button onClick={checkoutToWhatsApp} className="btn btn-primary" style={{ width: '100%', marginTop: '1rem', background: '#25D366' }}>Pedir por WhatsApp</button>
            </div>
          )}
        </div>
      )}
      {selectedImage && (
        <div onClick={() => setSelectedImage(null)} style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.9)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src={selectedImage} alt="Zoom" style={{ maxHeight: '90%', maxWidth: '90%', borderRadius: '1rem' }} />
        </div>
      )}
    </div>
  );
};

export default Catalog;
