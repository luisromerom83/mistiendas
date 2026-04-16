import { createPool } from '@vercel/postgres';

export default async function handler(request, response) {
  const connectionString = process.env.POSTGRES_URL || "postgresql://neondb_owner:npg_XB3SU0AthRFV@ep-mute-math-amplqkgj-pooler.c-5.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require";
  const isLocal = request.headers.host && (request.headers.host.includes('localhost') || request.headers.host.includes('127.0.0.1'));
  const pool = createPool({ connectionString });
  
  // Dynamic table names for cloud isolation
  const TABLE = isLocal ? 'test_products' : 'products';
  
  const tenant_id = request.query.tenant_id || (request.body && request.body.tenant_id) || 'deportux';

  try {
    // 1. Crear/Actualizar Tabla (Test o Producicón)
    // Usamos query manual para nombres de tabla dinámicos
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${TABLE} (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        size VARCHAR(50) NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        image_url TEXT NOT NULL,
        type VARCHAR(50) DEFAULT 'stock',
        category VARCHAR(50) DEFAULT 'Adulto',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Aseguramos columnas necesarias
    try { await pool.query(`ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100) DEFAULT 'deportux';`); } catch (e) {}
    try { await pool.query(`ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'stock';`); } catch (e) {}
    try { await pool.query(`ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'Adulto';`); } catch (e) {}
    try { await pool.query(`ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT FALSE;`); } catch (e) {}
    try { await pool.query(`ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS short_id VARCHAR(10);`); } catch (e) {}
    try { await pool.query(`ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS stock_quantity INTEGER DEFAULT 0;`); } catch (e) {}
    try { await pool.query(`ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS stock_by_size JSONB DEFAULT '{}'::jsonb;`); } catch (e) {}

    // Migración para short_id si está vacío
    try {
      await pool.query(`
        UPDATE ${TABLE} 
        SET short_id = LPAD(id::text, 4, '0') 
        WHERE short_id IS NULL OR short_id = '';
      `);
    } catch (e) {}

    // 2. GET
    if (request.method === 'GET') {
      const result = await pool.query(`SELECT * FROM ${TABLE} WHERE tenant_id = $1 ORDER BY created_at DESC;`, [tenant_id]);
      return response.status(200).json(result.rows || []);
    }

    // 3. POST (Crear o Actualizar Variantes)
    if (request.method === 'POST') {
      const { name, size, price, imageURL, type, category, is_favorite, stock_quantity, stock_by_size, find_existing } = request.body;
      
      // Buscar si ya existe el producto BASE (mismo nombre y categoría) en el tenant
      const { rows: existing } = await pool.query(`SELECT * FROM ${TABLE} WHERE tenant_id = $1 AND name = $2 AND category = $3 LIMIT 1;`, [tenant_id, name, category || 'Adulto']);
      
      if (existing.length > 0) {
        const prod = existing[0];
        // Mezclar stock_by_size
        const newStock = { ...(prod.stock_by_size || {}), ...(stock_by_size || {}) };
        if (size && !newStock[size]) newStock[size] = stock_quantity || 0;
        
        // Calcular nuevo total y lista de tallas
        const totalStock = Object.values(newStock).reduce((a, b) => a + (parseInt(b) || 0), 0);
        const sizeList = Object.keys(newStock).filter(k => newStock[k] > 0).join(', ');

        const result = await pool.query(`
          UPDATE ${TABLE} 
          SET stock_by_size = $1, stock_quantity = $2, size = $3, price = $4, image_url = $5, is_favorite = $6
          WHERE id = $7 AND tenant_id = $8
          RETURNING *;
        `, [JSON.stringify(newStock), totalStock, sizeList, price || prod.price, imageURL || prod.image_url, is_favorite !== undefined ? is_favorite : prod.is_favorite, prod.id, tenant_id]);
        
        return response.status(200).json(result.rows[0]);
      }

      const result = await pool.query(`
        INSERT INTO ${TABLE} (tenant_id, name, size, price, image_url, type, category, is_favorite, stock_quantity, stock_by_size)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *;
      `, [tenant_id, name, size, price, imageURL, type || 'stock', category || 'Adulto', is_favorite || false, stock_quantity || 0, JSON.stringify(stock_by_size || {})]);
      
      const newProd = result.rows[0];
      const shortId = newProd.id.toString().padStart(4, '0');
      const finalResult = await pool.query(`UPDATE ${TABLE} SET short_id = $1 WHERE id = $2 RETURNING *;`, [shortId, newProd.id]);
      return response.status(201).json(finalResult.rows[0]);
    }

    // 4. PUT (Actualizar)
    if (request.method === 'PUT') {
      const { id, name, size, price, imageURL, type, category, is_favorite, stock_quantity, stock_by_size } = request.body;
      const result = await pool.query(`
        UPDATE ${TABLE} 
        SET name = $1, size = $2, price = $3, image_url = $4, type = $5, category = $6, is_favorite = $7, stock_quantity = $8, stock_by_size = $9
        WHERE id = $10 AND tenant_id = $11
        RETURNING *;
      `, [name, size, price, imageURL, type, category, is_favorite, stock_quantity, JSON.stringify(stock_by_size || {}), id, tenant_id]);
      return response.status(200).json(result.rows[0]);
    }

    // 5. DELETE
    if (request.method === 'DELETE') {
      const { id } = request.query;
      await pool.query(`DELETE FROM ${TABLE} WHERE id = $1 AND tenant_id = $2;`, [id, tenant_id]);
      return response.status(200).json({ message: 'Producto eliminado' });
    }

    return response.status(405).json({ error: 'Método no permitido' });
  } catch (error) {
    console.error('Error Postgres:', error.message);
    return response.status(500).json({ error: error.message });
  }
}
