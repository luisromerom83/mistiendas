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
        slogan VARCHAR(255) DEFAULT '',
        contact_phones VARCHAR(255) DEFAULT '',
        font_url TEXT DEFAULT '',
        font_family VARCHAR(100) DEFAULT '',
        layout_template VARCHAR(50) DEFAULT 'modern',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Auto-migration for existing tenants table
    try {
      await pool.query("ALTER TABLE tenants ADD COLUMN slogan VARCHAR(255) DEFAULT '';");
    } catch(e) { /* column exists */ }
    try {
      await pool.query("ALTER TABLE tenants ADD COLUMN contact_phones VARCHAR(255) DEFAULT '';");
    } catch(e) { /* column exists */ }
    try {
      await pool.query("ALTER TABLE tenants ADD COLUMN font_url TEXT DEFAULT '';");
    } catch(e) { /* column exists */ }
    try {
      await pool.query("ALTER TABLE tenants ADD COLUMN font_family VARCHAR(100) DEFAULT '';");
    } catch(e) { /* column exists */ }
    try {
      await pool.query("ALTER TABLE tenants ADD COLUMN layout_template VARCHAR(50) DEFAULT 'modern';");
    } catch(e) { /* column exists */ }

    // Verify 'deportux' exists. If not, auto-seed it.
    const deportuxRes = await pool.query(`SELECT slug FROM tenants WHERE slug = 'deportux'`);
    if (deportuxRes.rowCount === 0) {
      await pool.query(`
        INSERT INTO tenants (slug, store_name, logo_url, theme_colors, categories, sizes_by_category, slogan, contact_phones)
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
      const { slug, store_name, logo_url, theme_colors, categories, sizes_by_category, slogan, contact_phones, font_url, font_family, layout_template } = request.body;
      const { rows } = await pool.query(`
        INSERT INTO tenants (slug, store_name, logo_url, theme_colors, categories, sizes_by_category, slogan, contact_phones, font_url, font_family, layout_template)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *;
      `, [
        slug, store_name || slug, logo_url || '/logo.png', 
        JSON.stringify(theme_colors || { primary: "#ef811e", bg: "#0f172a" }), 
        JSON.stringify(categories || []), 
        JSON.stringify(sizes_by_category || {}),
        slogan || '',
        contact_phones || '',
        font_url || '',
        font_family || '',
        layout_template || 'modern'
      ]);
      return response.status(201).json(rows[0]);
    }

    // PUT (Update)
    if (request.method === 'PUT') {
      const { slug, store_name, logo_url, theme_colors, categories, sizes_by_category, slogan, contact_phones, font_url, font_family, layout_template, old_category_name, new_category_name } = request.body;
      
      const { rows } = await pool.query(`
        UPDATE tenants
        SET store_name = $1, logo_url = $2, theme_colors = $3, categories = $4, sizes_by_category = $5, slogan = $6, contact_phones = $7, font_url = $8, font_family = $9, layout_template = $10
        WHERE slug = $11
        RETURNING *;
      `, [
        store_name, logo_url, JSON.stringify(theme_colors), JSON.stringify(categories), JSON.stringify(sizes_by_category), slogan, contact_phones, font_url, font_family, layout_template, slug
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

    // DELETE (Remove Tenant)
    if (request.method === 'DELETE') {
      const { slug } = request.query;
      if (!slug) return response.status(400).json({ error: 'Falta slug para borrar' });

      // We only delete the tenant entry. Linked data dynamically looks up by tenant_id, so it becomes orphaned
      // but theoretically shouldn't leak. Optionally we could delete them here.
      await pool.query(`DELETE FROM tenants WHERE slug = $1`, [slug]);
      return response.status(200).json({ success: true, slug });
    }

    return response.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Error Postgres Tenants:', error.message);
    return response.status(500).json({ error: error.message });
  }
}
