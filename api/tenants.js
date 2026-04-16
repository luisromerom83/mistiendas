import { createPool } from '@vercel/postgres';

export default async function handler(request, response) {
  const connectionString = process.env.POSTGRES_URL || "postgresql://neondb_owner:npg_XB3SU0AthRFV@ep-mute-math-amplqkgj-pooler.c-5.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require";
  const pool = createPool({ connectionString });
  
  try {
    // 1. Create Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tenants (
        slug VARCHAR(100) PRIMARY KEY,
        store_name VARCHAR(255) NOT NULL,
        logo_url TEXT,
        theme_colors JSONB DEFAULT '{"primary": "#ef811e", "bg": "#062746"}'::jsonb,
        categories JSONB DEFAULT '[]'::jsonb,
        sizes_by_category JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Verify 'deportux' exists. If not, auto-seed it.
    const deportuxRes = await pool.query(`SELECT slug FROM tenants WHERE slug = 'deportux'`);
    if (deportuxRes.rowCount === 0) {
      await pool.query(`
        INSERT INTO tenants (slug, store_name, logo_url, theme_colors, categories, sizes_by_category)
        VALUES (
          'deportux', 
          'DEPORTUX', 
          '/logo.png', 
          '{"primary": "#ef811e", "bg": "#062746"}'::jsonb, 
          '[{"id": "cat-adulto", "name": "Adulto"}, {"id": "cat-nino", "name": "Niño"}]'::jsonb, 
          '{"cat-adulto": ["S", "M", "L", "XL"], "cat-nino": ["2", "4", "6", "8", "10", "12", "14", "16"]}'::jsonb
        )
      `);
    }

    // GET
    if (request.method === 'GET') {
      const { slug } = request.query;
      if (slug) {
        const { rows } = await pool.query(`SELECT * FROM tenants WHERE slug = $1`, [slug]);
        if (rows.length === 0) return response.status(404).json({ error: 'Tenant not found' });
        return response.status(200).json(rows[0]);
      } else {
        const { rows } = await pool.query(`SELECT * FROM tenants ORDER BY created_at ASC`);
        return response.status(200).json(rows);
      }
    }

    // POST (Create)
    if (request.method === 'POST') {
      const { slug, store_name, logo_url, theme_colors, categories, sizes_by_category } = request.body;
      const { rows } = await pool.query(`
        INSERT INTO tenants (slug, store_name, logo_url, theme_colors, categories, sizes_by_category)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *;
      `, [
        slug, store_name || slug, logo_url || '/logo.png', 
        JSON.stringify(theme_colors || { primary: "#ef811e", bg: "#0f172a" }), 
        JSON.stringify(categories || []), 
        JSON.stringify(sizes_by_category || {})
      ]);
      return response.status(201).json(rows[0]);
    }

    // PUT (Update)
    if (request.method === 'PUT') {
      const { slug, store_name, logo_url, theme_colors, categories, sizes_by_category, old_category_name, new_category_name } = request.body;
      
      const { rows } = await pool.query(`
        UPDATE tenants
        SET store_name = $1, logo_url = $2, theme_colors = $3, categories = $4, sizes_by_category = $5
        WHERE slug = $6
        RETURNING *;
      `, [
        store_name, logo_url, JSON.stringify(theme_colors), JSON.stringify(categories), JSON.stringify(sizes_by_category), slug
      ]);
      
      // Feature: Cascade rename category names in products securely
      if (old_category_name && new_category_name && old_category_name !== new_category_name) {
        // Find existing products for this tenant that have the old category name and rename them
        // Note: products and other tables will dynamically look at 'tenant_id'
        const isLocal = request.headers.host && (request.headers.host.includes('localhost') || request.headers.host.includes('127.0.0.1'));
        const PRODUCTS_TABLE = isLocal ? 'test_products' : 'products';
        try {
          await pool.query(`
            UPDATE ${PRODUCTS_TABLE}
            SET category = $1
            WHERE tenant_id = $2 AND category = $3
          `, [new_category_name, slug, old_category_name]);
        } catch (e) {
          console.error('Error cascading category rename to products:', e.message);
        }
      }

      return response.status(200).json(rows[0]);
    }

    return response.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Error Postgres Tenants:', error.message);
    return response.status(500).json({ error: error.message });
  }
}
