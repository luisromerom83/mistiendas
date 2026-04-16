import { put } from '@vercel/blob';

export default async function handler(request, response) {
  console.log('--- API UPLOAD START ---');
  console.log('Method:', request.method);

  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { name, base64 } = request.body || {};
    
    console.log('Payload name:', name);
    console.log('Payload base64 size:', base64 ? base64.length : 'MISSING');

    if (!base64) {
      console.error('Error: No base64 data found in request body');
      return response.status(400).json({ error: 'No se recibió la imagen (base64 vacio)' });
    }

    const token = "vercel_blob_rw_y1S95NEz1bVZBwhb_eeBFCRiO99WL05KYlt9gClCl3ltlUY";

    // 1. Convertir Base64 a Buffer
    console.log('Converting Base64 to Buffer...');
    const base64Parts = base64.split(';base64,');
    if (base64Parts.length < 2) {
      throw new Error('Formato Base64 inválido');
    }
    const buffer = Buffer.from(base64Parts.pop(), 'base64');
    console.log('Buffer created. Size:', buffer.length);

    // 2. Subir desde el SERVIDOR
    console.log('Uploading to Vercel Blob...');
    const blob = await put(`products/${name}`, buffer, {
      access: 'public',
      token,
      contentType: 'image/jpeg',
      addRandomSuffix: true,
    });

    console.log('Upload SUCCESS. URL:', blob.url);
    return response.status(200).json(blob);
  } catch (error) {
    console.error('SERIOUS ERROR IN API UPLOAD:', error);
    return response.status(500).json({ error: error.message || 'Error interno del servidor' });
  }
}
