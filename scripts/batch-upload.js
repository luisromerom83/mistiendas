import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * BATCH UPLOAD SCRIPT for DEPORTUX (Simplified)
 * Sube imágenes a la nube y crea registros base en la DB.
 * El usuario completa los detalles (precio, talla, etc) desde el Panel Admin.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BATCH_DIR = path.join(__dirname, '..', 'batch_upload');
const API_URL = 'http://localhost:3000/api'; 

async function runBatch() {
    console.log(`🔍 Buscando imágenes en: ${BATCH_DIR}`);
    
    if (!fs.existsSync(BATCH_DIR)) {
        console.error("❌ La carpeta 'batch_upload' no existe.");
        return;
    }

    const files = fs.readdirSync(BATCH_DIR).filter(f => /\.(jpg|jpeg|png|webp|gif)$/i.test(f));

    if (files.length === 0) {
        console.log("ℹ️ No hay imágenes nuevas para subir.");
        return;
    }

    console.log(`📦 Encontradas ${files.length} imágenes. Iniciando subida...`);

    for (const file of files) {
        try {
            console.log(`\n📄 Procesando: ${file}`);
            
            // Nombre inicial = nombre del archivo
            const name = path.parse(file).name;
            const category = 'Adulto'; // Default
            const type = 'order';      // Default (Bajo Pedido)
            const size = '?';          // Default
            const price = 0;           // Default

            const filePath = path.join(BATCH_DIR, file);
            const imageBuffer = fs.readFileSync(filePath);
            const base64Image = `data:image/${path.extname(file).slice(1)};base64,${imageBuffer.toString('base64')}`;

            console.log("   ☁️ Subiendo imagen a la nube...");
            const uploadResp = await fetch(`${API_URL}/upload`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: file, base64: base64Image })
            });

            if (!uploadResp.ok) throw new Error(`Error subiendo imagen: ${await uploadResp.text()}`);
            const blobData = await uploadResp.json();
            const imageURL = blobData.url;

            console.log("   🗄️ Registrando en base de datos...");
            const productResp = await fetch(`${API_URL}/products`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    size,
                    price,
                    imageURL,
                    type,
                    category
                })
            });

            if (!productResp.ok) throw new Error(`Error creando producto: ${await productResp.text()}`);
            
            console.log(`   ✅ ¡Éxito! "${name}" listo para editar en el Admin.`);

            // Opcional: Podríamos borrar el archivo local o moverlo a "subidos"
            // fs.unlinkSync(filePath);

        } catch (err) {
            console.error(`❌ Error con ${file}:`, err.message);
        }
    }

    console.log("\n🏁 Carga finalizada. Entra al Administrador para completar los datos.");
}

runBatch().catch(console.error);
