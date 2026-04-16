import { createPool } from '@vercel/postgres';

export default async function handler(request, response) {
  const connectionString = process.env.POSTGRES_URL || "postgresql://neondb_owner:npg_XB3SU0AthRFV@ep-mute-math-amplqkgj-pooler.c-5.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require";
  const isLocal = request.headers.host && (request.headers.host.includes('localhost') || request.headers.host.includes('127.0.0.1'));
  const pool = createPool({ connectionString });
  
  const T_CUSTOMERS = isLocal ? 'test_customers' : 'customers';
  const tenant_id = request.query.tenant_id || (request.body && request.body.tenant_id) || 'deportux';

  try {
    // 1. Create table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${T_CUSTOMERS} (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        balance DECIMAL(10, 2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    try { await pool.query(`ALTER TABLE ${T_CUSTOMERS} ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100) DEFAULT 'deportux';`); } catch (e) {}

    // 2. GET
    if (request.method === 'GET') {
      const { rows } = await pool.query(`SELECT * FROM ${T_CUSTOMERS} WHERE tenant_id = $1 ORDER BY name ASC;`, [tenant_id]);
      return response.status(200).json(rows || []);
    }

    // 3. POST
    if (request.method === 'POST') {
      const { name, phone } = request.body;
      const { rows } = await pool.query(`
        INSERT INTO ${T_CUSTOMERS} (tenant_id, name, phone)
        VALUES ($1, $2, $3)
        RETURNING *;
      `, [tenant_id, name, phone]);
      return response.status(201).json(rows[0]);
    }

    // 4. PUT
    if (request.method === 'PUT') {
      const { id, name, phone, balance } = request.body;
      await pool.query(`
        UPDATE ${T_CUSTOMERS} 
        SET name = $1, phone = $2, balance = $3
        WHERE id = $4 AND tenant_id = $5;
      `, [name, phone, balance, id, tenant_id]);
      return response.status(200).json({ message: 'Customer updated' });
    }

    // 5. DELETE
    if (request.method === 'DELETE') {
      const { id } = request.query;
      await pool.query(`DELETE FROM ${T_CUSTOMERS} WHERE id = $1 AND tenant_id = $2;`, [id, tenant_id]);
      return response.status(200).json({ message: 'Customer deleted' });
    }

    return response.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Error Postgres:', error.message);
    return response.status(500).json({ error: error.message });
  }
}
