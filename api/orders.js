import { createPool } from '@vercel/postgres';

export default async function handler(request, response) {
  const connectionString = process.env.POSTGRES_URL || "postgresql://neondb_owner:npg_XB3SU0AthRFV@ep-mute-math-amplqkgj-pooler.c-5.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require";
  const isLocal = request.headers.host && (request.headers.host.includes('localhost') || request.headers.host.includes('127.0.0.1'));
  const pool = createPool({ connectionString });
  
  const T_ORDERS = isLocal ? 'test_orders' : 'orders';
  const T_DRAFT = isLocal ? 'test_draft_order' : 'draft_order';
  const tenant_id = request.query.tenant_id || (request.body && request.body.tenant_id) || 'deportux';

  try {
    // 1. Crear tablas si no existen
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${T_ORDERS} (
        id SERIAL PRIMARY KEY,
        items JSONB NOT NULL,
        total_price DECIMAL(10, 2) NOT NULL,
        total_cost DECIMAL(10, 2) DEFAULT 0,
        total_profit DECIMAL(10, 2) DEFAULT 0,
        is_entered BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Asegurar columnas
    try { await pool.query(`ALTER TABLE ${T_ORDERS} ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100) DEFAULT 'deportux';`); } catch (e) {}
    try { await pool.query(`ALTER TABLE ${T_ORDERS} ADD COLUMN IF NOT EXISTS total_cost DECIMAL(10, 2) DEFAULT 0;`); } catch(e) {}
    try { await pool.query(`ALTER TABLE ${T_ORDERS} ADD COLUMN IF NOT EXISTS total_profit DECIMAL(10, 2) DEFAULT 0;`); } catch(e) {}
    try { await pool.query(`ALTER TABLE ${T_ORDERS} ADD COLUMN IF NOT EXISTS is_entered BOOLEAN DEFAULT FALSE;`); } catch(e) {}

    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${T_DRAFT} (
        id INT PRIMARY KEY DEFAULT 1,
        items JSONB NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    try { await pool.query(`ALTER TABLE ${T_DRAFT} ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100) DEFAULT 'deportux';`); } catch (e) {}
    try { await pool.query(`ALTER TABLE ${T_DRAFT} ADD CONSTRAINT unique_tenant_${T_DRAFT} UNIQUE(tenant_id);`); } catch (e) {}

    const { type } = request.query;

    // 2. GET: Listar historial o Borrador
    if (request.method === 'GET') {
      if (type === 'draft') {
        const { rows } = await pool.query(`SELECT items FROM ${T_DRAFT} WHERE tenant_id = $1;`, [tenant_id]);
        return response.status(200).json(rows[0]?.items || []);
      }
      const { rows } = await pool.query(`SELECT * FROM ${T_ORDERS} WHERE tenant_id = $1 ORDER BY created_at DESC;`, [tenant_id]);
      return response.status(200).json(rows || []);
    }

    // 3. POST: Guardar nuevo pedido o Borrador
    if (request.method === 'POST') {
      const { items, total_price, total_cost, total_profit, is_entered } = request.body;
      
      if (type === 'draft') {
        // Obtenemos si ya existe para hacerlo con UPDATE o INSERT sin id=1 para evitar problemas
        const exist = await pool.query(`SELECT * FROM ${T_DRAFT} WHERE tenant_id = $1`, [tenant_id]);
        if (exist.rows.length > 0) {
          await pool.query(`UPDATE ${T_DRAFT} SET items = $1, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = $2`, [JSON.stringify(items), tenant_id]);
        } else {
          try {
            await pool.query(`INSERT INTO ${T_DRAFT} (tenant_id, items, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP)`, [tenant_id, JSON.stringify(items)]);
          } catch(e) {
            // Un probable conflicto de ID
            await pool.query(`UPDATE ${T_DRAFT} SET items = $1, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = $2`, [JSON.stringify(items), tenant_id]);
          }
        }
        return response.status(200).json({ message: 'Borrador guardado' });
      }

      const { rows } = await pool.query(`
        INSERT INTO ${T_ORDERS} (tenant_id, items, total_price, total_cost, total_profit, is_entered)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *;
      `, [tenant_id, JSON.stringify(items), total_price, total_cost || 0, total_profit || 0, is_entered || false]);
      
      await pool.query(`UPDATE ${T_DRAFT} SET items = '[]' WHERE tenant_id = $1;`, [tenant_id]);
      return response.status(201).json(rows[0]);
    }

    // 4. PUT: Actualizar un pedido
    if (request.method === 'PUT') {
      const { id, items, total_price, total_cost, total_profit, is_entered } = request.body;
      await pool.query(`
        UPDATE ${T_ORDERS} 
        SET items = $1, total_price = $2, total_cost = $3, total_profit = $4, is_entered = $5
        WHERE id = $6 AND tenant_id = $7;
      `, [JSON.stringify(items), total_price, total_cost, total_profit, is_entered || false, id, tenant_id]);
      return response.status(200).json({ message: 'Pedido actualizado' });
    }

    // 5. DELETE
    if (request.method === 'DELETE') {
      const { id } = request.query;
      await pool.query(`DELETE FROM ${T_ORDERS} WHERE id = $1 AND tenant_id = $2;`, [id, tenant_id]);
      return response.status(200).json({ message: 'Pedido eliminado' });
    }

    return response.status(405).json({ error: 'Método no permitido' });
  } catch (error) {
    console.error('Error Postgres:', error.message);
    return response.status(500).json({ error: error.message });
  }
}
