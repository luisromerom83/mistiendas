import { createPool } from '@vercel/postgres';

export default async function handler(request, response) {
  const connectionString = process.env.POSTGRES_URL || "postgresql://neondb_owner:npg_XB3SU0AthRFV@ep-mute-math-amplqkgj-pooler.c-5.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require";
  const isLocal = request.headers.host && (request.headers.host.includes('localhost') || request.headers.host.includes('127.0.0.1'));
  const pool = createPool({ connectionString });
  
  const T_RESERVATIONS = isLocal ? 'test_reservations' : 'reservations';
  const T_PRODUCTS = isLocal ? 'test_products' : 'products';
  const T_CUSTOMERS = isLocal ? 'test_customers' : 'customers';
  const tenant_id = request.query.tenant_id || (request.body && request.body.tenant_id) || 'deportux';

  try {
    // 1. Create table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${T_RESERVATIONS} (
        id SERIAL PRIMARY KEY,
        product_id INTEGER,
        customer_id INTEGER,
        order_id INTEGER, 
        quantity INTEGER NOT NULL,
        price_at_reservation DECIMAL(10, 2),
        paid_amount DECIMAL(10, 2) DEFAULT 0,
        status VARCHAR(20) DEFAULT 'Pending',
        is_received BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    try { await pool.query(`ALTER TABLE ${T_RESERVATIONS} ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100) DEFAULT 'deportux';`); } catch (e) {}
    
    // Asegurar columnas
    try { await pool.query(`ALTER TABLE ${T_RESERVATIONS} ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(10, 2) DEFAULT 0;`); } catch(e) {}
    try { await pool.query(`ALTER TABLE ${T_RESERVATIONS} ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'Pending';`); } catch(e) {}

    // 2. GET
    if (request.method === 'GET') {
      const { customer_id } = request.query;
      let q = `
        SELECT r.*, p.name as product_name, p.short_id, p.image_url, p.size as product_size
        FROM ${T_RESERVATIONS} r 
        JOIN ${T_PRODUCTS} p ON r.product_id = p.id 
        WHERE r.tenant_id = $1 AND p.tenant_id = $1
      `;
      let params = [tenant_id];
      if (customer_id) {
        q += ` AND r.customer_id = $2 `;
        params.push(customer_id);
      }
      q += ` ORDER BY r.created_at DESC `;
      
      const { rows } = await pool.query(q, params);
      return response.status(200).json(rows || []);
    }

    // 3. POST
    if (request.method === 'POST') {
      const { product_id, customer_id, order_id, quantity, price_at_reservation, is_received, paid_amount } = request.body;
      const { rows } = await pool.query(`
        INSERT INTO ${T_RESERVATIONS} (tenant_id, product_id, customer_id, order_id, quantity, price_at_reservation, is_received, paid_amount, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Pending')
        RETURNING *;
      `, [tenant_id, product_id, customer_id, order_id, quantity, price_at_reservation, is_received || false, paid_amount || 0]);
      return response.status(201).json(rows[0]);
    }

    // 4. PUT
    if (request.method === 'PUT') {
      const { id, is_received, quantity, paid_amount, status } = request.body;
      const updates = [];
      const params = [];
      
      if (is_received !== undefined) { params.push(is_received); updates.push(`is_received = $${params.length}`); }
      if (quantity !== undefined) { params.push(quantity); updates.push(`quantity = $${params.length}`); }
      if (paid_amount !== undefined) { params.push(paid_amount); updates.push(`paid_amount = $${params.length}`); }
      if (status !== undefined) { params.push(status); updates.push(`status = $${params.length}`); }
      
      if (updates.length === 0) return response.status(400).json({ error: 'No fields to update' });
      
      params.push(id);
      params.push(tenant_id);
      const finalQuery = `UPDATE ${T_RESERVATIONS} SET ${updates.join(', ')} WHERE id = $${params.length - 1} AND tenant_id = $${params.length} RETURNING *;`;
      const { rows } = await pool.query(finalQuery, params);
      return response.status(200).json(rows[0]);
    }

    // 5. DELETE
    if (request.method === 'DELETE') {
      const { id } = request.query;
      await pool.query(`DELETE FROM ${T_RESERVATIONS} WHERE id = $1 AND tenant_id = $2;`, [id, tenant_id]);
      return response.status(200).json({ message: 'Reservation deleted' });
    }

    return response.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Error Postgres:', error.message);
    return response.status(500).json({ error: error.message });
  }
}
