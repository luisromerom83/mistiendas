import { createPool } from '@vercel/postgres';

export default async function handler(request, response) {
  const connectionString = process.env.POSTGRES_URL || "postgresql://neondb_owner:npg_XB3SU0AthRFV@ep-mute-math-amplqkgj-pooler.c-5.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require";
  const isLocal = request.headers.host && (request.headers.host.includes('localhost') || request.headers.host.includes('127.0.0.1'));
  const pool = createPool({ connectionString });
  
  const T_SALES = isLocal ? 'test_sales' : 'sales';
  const T_CUSTOMERS = isLocal ? 'test_customers' : 'customers';
  const T_PRODUCTS = isLocal ? 'test_products' : 'products';
  const tenant_id = request.query.tenant_id || (request.body && request.body.tenant_id) || 'deportux';

  try {
    // 1. Create table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${T_SALES} (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER,
        items JSONB NOT NULL,
        total_amount DECIMAL(10, 2) NOT NULL,
        paid_amount DECIMAL(10, 2) DEFAULT 0,
        profit DECIMAL(10, 2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    try { await pool.query(`ALTER TABLE ${T_SALES} ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100) DEFAULT 'deportux';`); } catch (e) {}

    // 2. GET
    if (request.method === 'GET') {
      const { rows } = await pool.query(`SELECT * FROM ${T_SALES} WHERE tenant_id = $1 ORDER BY created_at DESC;`, [tenant_id]);
      return response.status(200).json(rows || []);
    }

    // 3. POST
    if (request.method === 'POST') {
      const { customer_id, items, total_amount, paid_amount, profit } = request.body;
      const { rows } = await pool.query(`
        INSERT INTO ${T_SALES} (tenant_id, customer_id, items, total_amount, paid_amount, profit)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *;
      `, [tenant_id, customer_id, JSON.stringify(items), total_amount, paid_amount, profit]);
      
      const newSale = rows[0];

      // Update customer balance if there is a difference between total and paid (Debt or Abono)
      if (customer_id && parseFloat(total_amount) !== parseFloat(paid_amount)) {
        const diff = parseFloat(total_amount) - parseFloat(paid_amount);
        await pool.query(`UPDATE ${T_CUSTOMERS} SET balance = balance + $1 WHERE id = $2 AND tenant_id = $3;`, [diff, customer_id, tenant_id]);
      }
      
      return response.status(201).json(newSale);
    }

    // 4. PUT (Re-assign customer)
    if (request.method === 'PUT') {
      const { id, customer_id } = request.body;
      
      // 1. Get current sale to calculate balance adjustment
      const { rows: saleRows } = await pool.query(`SELECT * FROM ${T_SALES} WHERE id = $1 AND tenant_id = $2;`, [id, tenant_id]);
      if (saleRows.length === 0) return response.status(404).json({ error: 'Sale not found' });
      
      const oldSale = saleRows[0];
      const oldCustomerId = oldSale.customer_id;
      const debt = parseFloat(oldSale.total_amount) - parseFloat(oldSale.paid_amount);

      // 2. Update sale customer_id
      await pool.query(`UPDATE ${T_SALES} SET customer_id = $1 WHERE id = $2 AND tenant_id = $3;`, [customer_id, id, tenant_id]);

      // 3. Adjust old customer balance (subtract the debt)
      if (oldCustomerId && debt !== 0) {
        await pool.query(`UPDATE ${T_CUSTOMERS} SET balance = balance - $1 WHERE id = $2 AND tenant_id = $3;`, [debt, oldCustomerId, tenant_id]);
      }

      // 4. Adjust new customer balance (add the debt)
      if (customer_id && debt !== 0) {
        await pool.query(`UPDATE ${T_CUSTOMERS} SET balance = balance + $1 WHERE id = $2 AND tenant_id = $3;`, [debt, customer_id, tenant_id]);
      }

      return response.status(200).json({ message: 'Sale re-assigned and balances updated' });
    }
    // 5. DELETE (Process Return)
    if (request.method === 'DELETE') {
      const { id } = request.query;
      
      // 1. Get sale details to reverse impact
      const { rows: saleRows } = await pool.query(`SELECT * FROM ${T_SALES} WHERE id = $1 AND tenant_id = $2;`, [id, tenant_id]);
      if (saleRows.length === 0) return response.status(404).json({ error: 'Sale not found' });
      
      const sale = saleRows[0];
      const items = Array.isArray(sale.items) ? sale.items : JSON.parse(sale.items || '[]');
      const debt = parseFloat(sale.total_amount) - parseFloat(sale.paid_amount);

      // 2. Reverse Inventory (Stock)
      for (const item of items) {
        if (item.id && item.size) {
          // Obtener stock actual para recalcular total
          const { rows: prodRows } = await pool.query(`SELECT * FROM ${T_PRODUCTS} WHERE id = $1 AND tenant_id = $2`, [item.id, tenant_id]);
          if (prodRows.length > 0) {
            const p = prodRows[0];
            const newStock = { ...p.stock_by_size };
            newStock[item.size] = (parseInt(newStock[item.size]) || 0) + parseInt(item.quantity);
            const newTotal = Object.values(newStock).reduce((a, b) => a + (parseInt(b) || 0), 0);
            
            await pool.query(`UPDATE ${T_PRODUCTS} SET stock_by_size = $1, stock_quantity = $2 WHERE id = $3 AND tenant_id = $4`, [JSON.stringify(newStock), newTotal, item.id, tenant_id]);
          }
        }
      }

      // 3. Reverse Customer Balance
      if (sale.customer_id && debt !== 0) {
        await pool.query(`UPDATE ${T_CUSTOMERS} SET balance = balance - $1 WHERE id = $2 AND tenant_id = $3`, [debt, sale.customer_id, tenant_id]);
      }

      // 4. Delete the sale record
      await pool.query(`DELETE FROM ${T_SALES} WHERE id = $1 AND tenant_id = $2`, [id, tenant_id]);

      return response.status(200).json({ message: 'Return processed, stock and balance restored' });
    }

    return response.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Error Postgres:', error.message);
    return response.status(500).json({ error: error.message });
  }
}
