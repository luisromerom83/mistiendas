import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Loader from '../components/Loader';
import { useTenantInfo } from '../context/TenantContext';

const Catalog = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState([]);
  const [isCartVisible, setIsCartVisible] = useState(false);
  const [filterType, setFilterType] = useState('all'); // all, favorites, stock, order
  
  const { tenant } = useTenantInfo();
  const { catName } = useParams();
  const navigate = useNavigate();
  const currentCategory = catName || 'home';

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    const startTime = Date.now();
    try {
      const response = await fetch(`/api/products?tenant_id=${tenant.slug}`);
      const data = await response.json();
      
      // Agrupar por nombre + categoría para evitar duplicados en el catálogo
      const grouped = data.reduce((acc, p) => {
        const key = `${p.name.toLowerCase()}-${(p.category || 'Adulto').toLowerCase()}`;
        if (!acc[key]) {
          acc[key] = { ...p };
        } else {
          // Fusionar tallas y stock
          acc[key].stock_by_size = { ...(acc[key].stock_by_size || {}), ...(p.stock_by_size || {}) };
          acc[key].stock_quantity = (acc[key].stock_quantity || 0) + (p.stock_quantity || 0);
          // Mantener la lista de tallas actualizada
          const allSizes = Object.keys(acc[key].stock_by_size).filter(k => acc[key].stock_by_size[k] > 0);
          acc[key].size = allSizes.join(', ');
        }
        return acc;
      }, {});

      setProducts(Object.values(grouped));
    } catch (error) {
      console.error("Error products:", error);
    } finally {
      const elapsedTime = Date.now() - startTime;
      const remainingTime = Math.max(0, 800 - elapsedTime);
      setTimeout(() => {
        setLoading(false);
      }, remainingTime);
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
  }).sort((a, b) => {
    // 1. Favoritos primero
    if (b.is_favorite !== a.is_favorite) return (b.is_favorite ? 1 : 0) - (a.is_favorite ? 1 : 0);
    // 2. Existencia (stock) segundo
    if (a.type !== b.type) return (a.type === 'stock' ? -1 : 1);
    // 3. Alfabético tercero
    return a.name.localeCompare(b.name);
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

  const removeFromCart = (cartId) => setCart(prev => prev.filter(item => item.cartId !== cartId));
  const updateQuantity = (cartId, delta) => {
    setCart(prev => prev.map(item => {
      if (item.cartId === cartId) {
        const newQ = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQ };
      }
      return item;
    }));
  };

  const checkoutToWhatsApp = () => {
    const phone = "525514512919";
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

    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/${phone}?text=${encoded}`, '_blank');
  };

  return (
    <div className="catalog-page">
      <header style={{ 
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem',
        padding: '1rem 0', borderBottom: '1px solid var(--glass-border)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }} onClick={() => navigate(`/${tenant.slug}`)} className="pointer">
          <img src={tenant.logo_url || '/logo.png'} alt={tenant.store_name} style={{ height: '60px', cursor: 'pointer' }} />
        </div>
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Elegancia Deportiva</span>
        </div>
      </header>

      <section style={{ marginBottom: '3rem', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          <a href="https://wa.me/525514512919" target="_blank" rel="noreferrer" className="btn" style={{ 
            background: '#25D366', color: 'white', fontSize: '0.75rem', padding: '0.5rem 1rem', borderRadius: '99px' 
          }}>
            📲 WhatsApp 5514512919
          </a>
          <a href="https://wa.me/522872360877" target="_blank" rel="noreferrer" className="btn" style={{ 
            background: '#25D366', color: 'white', fontSize: '0.75rem', padding: '0.5rem 1rem', borderRadius: '99px' 
          }}>
            📲 WhatsApp 2872360877
          </a>
        </div>
        <h1 style={{ fontSize: 'clamp(1.8rem, 5vw, 3rem)', marginBottom: '0.5rem', lineHeight: '1.1' }}>
          Tu Estilo, <br/> Bajo Tus Reglas
        </h1>
      </section>

      <Loader show={loading} />

      {currentCategory === 'home' ? (
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', marginTop: '2rem' }}>
          {tenant.categories.map((cat, i) => (
            <CategoryCard 
              key={cat.id || i}
              title={`Catálogo ${cat.name}`} 
              desc="" 
              img="https://images.unsplash.com/photo-1574629810360-7efbbe195018?q=80&w=2093&auto=format&fit=crop" 
              onClick={() => navigate(`/${tenant.slug}/category/${cat.name}`)} 
            />
          ))}
        </section>
      ) : (
        <section>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
            <button 
              onClick={() => navigate(`/${tenant.slug}`)} 
              className="btn glass" 
              style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', border: '1px solid var(--primary)' }}
            >
              ⬅️ Regresar a Inicio
            </button>
            <h2 style={{ fontSize: '1.5rem', textTransform: 'uppercase', letterSpacing: '2px', color: 'var(--primary)' }}>
              Catálogo {currentCategory}
            </h2>
            <div style={{ height: '1px', background: 'var(--glass-border)', flexGrow: 1 }}></div>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ position: 'relative' }}>
              <input 
                type="text" 
                placeholder="🔍 Buscar uniforme por nombre..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="glass"
                style={{ 
                  width: '100%', 
                  padding: '1.2rem 2rem', 
                  borderRadius: '99px', 
                  fontSize: '1.1rem',
                  border: '1px solid var(--primary)',
                  outline: 'none',
                  color: 'white',
                  background: 'rgba(16, 185, 129, 0.05)',
                  boxShadow: '0 0 20px rgba(16, 185, 129, 0.1)'
                }} 
              />
            </div>
          </div>

          {/* Filtros Rápidos */}
          <div style={{ display: 'flex', gap: '0.8rem', marginBottom: '2.5rem', flexWrap: 'wrap' }}>
            {[
              { id: 'all', label: '🏟️ Todos', color: 'var(--primary)' },
              { id: 'favorites', label: '✨ Favoritos', color: '#fbbf24' },
              { id: 'stock', label: '📦 En Stock', color: '#10b981' },
              { id: 'order', label: '🚚 Bajo Pedido', color: '#60a5fa' }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFilterType(f.id)}
                className="glass"
                style={{
                  padding: '0.6rem 1.2rem',
                  borderRadius: '99px',
                  fontSize: '0.85rem',
                  fontWeight: 'bold',
                  border: `1px solid ${filterType === f.id ? f.color : 'rgba(255,255,255,0.1)'}`,
                  background: filterType === f.id ? `${f.color}22` : 'transparent',
                  color: filterType === f.id ? f.color : 'white',
                  cursor: 'pointer',
                  transition: '0.3s'
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
          
          <div className="grid">
            {loading ? (
              Array(6).fill(0).map((_, i) => <ProductSkeleton key={i} />)
            ) : (
              <>
                {filteredProducts.map(product => (
                  <ProductCard 
                    key={product.id} 
                    product={product} 
                    onOpenImage={setSelectedImage} 
                    onAddToCart={(size) => addToCart(product, size)}
                  />
                ))}
                {filteredProducts.length === 0 && <p style={{ textAlign: 'center', width: '100%', opacity: 0.5 }}>Próximamente más modelos...</p>}
              </>
            )}
          </div>
        </section>
      )}

      {/* CARRITO FLOTANTE */}
      {cart.length > 0 && (
        <div style={{
          position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 500,
          display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '1rem'
        }}>
          {isCartVisible && (
            <div className="glass" style={{
              width: '320px', maxHeight: '450px', padding: '1.5rem', borderRadius: '1.5rem',
              display: 'flex', flexDirection: 'column', gap: '1rem',
              boxShadow: '0 20px 50px rgba(0,0,0,0.5)', overflowY: 'auto'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {cart.map(item => (
                  <div key={item.cartId} style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <img src={item.image_url} alt="" style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover' }} />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: '0.85rem', fontWeight: 'bold', margin:0 }}>{item.name}</p>
                      <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>
                        {item.selectedSize && `Talla: ${item.selectedSize} | `}
                        {item.type === 'order' ? 'Cotizar' : `$${item.price}`}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <button onClick={() => updateQuantity(item.cartId, -1)} className="glass" style={{ width: '24px', height: '24px', borderRadius: '50%', color: 'white' }}>-</button>
                      <span style={{ fontSize: '0.85rem' }}>{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.cartId, 1)} className="glass" style={{ width: '24px', height: '24px', borderRadius: '50%', color: 'white' }}>+</button>
                    </div>
                    <button onClick={() => removeFromCart(item.cartId)} style={{ color: '#ff4444', background: 'none', border: 'none' }}>×</button>
                  </div>
                ))}
              </div>
              <button 
                onClick={checkoutToWhatsApp}
                className="btn btn-primary" 
                style={{ background: '#25D366', color: 'white', width: '100%', marginTop: '0.5rem' }}
              >
                📲 Confirmar Pedido en WhatsApp
              </button>
            </div>
          )}
          
          <button 
            onClick={() => setIsCartVisible(!isCartVisible)}
            className="btn btn-primary" 
            style={{ 
              width: '64px', height: '64px', borderRadius: '50%', fontSize: '1.5rem',
              boxShadow: '0 10px 30px rgba(239, 129, 30, 0.4)', position: 'relative'
            }}
          >
            🛒
            <span style={{
              position: 'absolute', top: '-5px', right: '-5px', background: 'white', color: 'var(--primary)',
              width: '24px', height: '24px', borderRadius: '50%', fontSize: '0.75rem', fontWeight: 'bold',
              display: 'flex', justifyContent: 'center', alignItems: 'center'
            }}>{cart.reduce((acc, i) => acc + i.quantity, 0)}</span>
          </button>
        </div>
      )}

      {selectedImage && (
        <div 
          onClick={() => setSelectedImage(null)}
          style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            backgroundColor: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(10px)',
            display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, cursor: 'zoom-out'
          }}
        >
          <img src={selectedImage} alt="Preview" style={{ maxWidth: '90%', maxHeight: '90%', borderRadius: '12px' }} />
          <button style={{ position: 'absolute', top: '2rem', right: '2rem', background: 'none', border: 'none', color: 'white', fontSize: '3rem' }}>×</button>
        </div>
      )}

      <footer style={{ marginTop: '8rem', padding: '4rem 0', textAlign: 'center', borderTop: '1px solid var(--glass-border)' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>© {new Date().getFullYear()} {tenant.store_name}. Envíos a todo el país.</p>
      </footer>
    </div>
  );
};

const CategoryCard = ({ title, desc, img, onClick }) => (
  <div 
    onClick={onClick}
    className="glass" 
    style={{ 
      height: '400px', borderRadius: '1.5rem', overflow: 'hidden', cursor: 'pointer', position: 'relative',
      transition: 'transform 0.3s ease-out'
    }}
  >
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }}>
        <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.4 }} />
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'linear-gradient(to bottom, transparent 30%, #0f172a 100%)' }}></div>
    </div>
    <div style={{ position: 'relative', zIndex: 1, padding: '2rem', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
        <h3 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{title}</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '1rem', marginBottom: '1.5rem' }}>{desc}</p>
        <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>Ver Catálogo ➔</button>
    </div>
  </div>
);

const ProductCard = ({ product, onOpenImage, onAddToCart }) => {
  const [selectedSize, setSelectedSize] = useState('');
  const isOrder = product.type === 'order';
  const isOutOfStock = !isOrder && (product.stock_quantity !== undefined && product.stock_quantity <= 0);
  
  const sizes = (product.size || '').split(',').map(s => s.trim()).filter(s => s && s !== 'N/A');
  const needsSize = sizes.length > 0;

  return (
    <div className={`glass card ${isOutOfStock ? 'out-of-stock' : ''}`} style={{ opacity: isOutOfStock ? 0.7 : 1 }}>
      <div style={{ position: 'relative', cursor: 'zoom-in' }} onClick={() => onOpenImage(product.image_url)}>
        <img src={product.image_url} alt={product.name} className="product-img" loading="lazy" style={{ filter: isOutOfStock ? 'grayscale(1)' : 'none' }} />
        <span className="badge" style={{ 
          position: 'absolute', top: '1rem', left: '1rem', background: isOrder ? '#fbbf24' : (isOutOfStock ? '#ef4444' : '#10b981'),
          color: isOrder ? 'black' : 'white', fontWeight: 'bold', fontSize: '0.65rem'
        }}>{isOrder ? 'BAJO PEDIDO' : (isOutOfStock ? 'AGOTADO' : 'EN EXISTENCIA')}</span>
        <span className="badge" style={{ 
          position: 'absolute', bottom: '1rem', left: '1rem', background: 'rgba(255,255,255,0.15)',
          backdropFilter: 'blur(8px)', color: 'white', fontSize: '0.6rem', padding: '0.2rem 0.6rem',
          border: '1px solid rgba(255,255,255,0.2)'
        }}>{product.category?.toUpperCase() || 'ADULTO'}</span>
      </div>
      <div className="product-info">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.25rem' }}>{product.name}</h3>
          <span style={{ color: 'var(--primary)', fontWeight: 'bold', fontSize: '0.82rem', opacity: 0.9 }}>#{product.short_id}</span>
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
                    title={isOrder ? 'Bajo Pedido' : (isSizeOut ? 'Agotado' : `${stock} disponibles`)}
                  >
                    {s}
                    {isSizeOut && !isOrder && <div style={{ position: 'absolute', top: '-5px', right: '-5px', fontSize: '8px' }}>🚫</div>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
          <span className="price" style={{ color: isOrder ? '#fbbf24' : 'inherit' }}>
            {isOrder ? 'Cotizar' : `$${product.price}`}
          </span>
          <button 
            onClick={() => onAddToCart(selectedSize)} 
            className="btn btn-primary" 
            style={{ padding: '0.5rem 1rem' }} 
            disabled={isOutOfStock || (needsSize && !selectedSize)}
          >
            {isOrder ? 'Consultar' : (isOutOfStock ? 'Agotado' : 'Añadir 🛒')}
          </button>
        </div>
      </div>
    </div>
  );
};

const ProductSkeleton = () => (
  <div className="glass card" style={{ height: '380px' }}>
    <div className="skeleton" style={{ height: '240px', width: '100%' }}></div>
    <div className="product-info" style={{ gap: '1rem' }}>
      <div className="skeleton" style={{ height: '1.5rem', width: '100%' }}></div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'auto' }}>
        <div className="skeleton" style={{ height: '1.2rem', width: '80px' }}></div>
        <div className="skeleton" style={{ height: '2.5rem', width: '100px', borderRadius: 'var(--radius-md)' }}></div>
      </div>
    </div>
  </div>
);

export default Catalog;
