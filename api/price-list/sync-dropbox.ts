import { syncDropboxExcel } from '../../src/lib/dropboxSyncService';

export default async function handler(req: any, res: any) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'online',
      service: 'Dropbox Price List Sync API (Vercel Serverless)',
      timestamp: new Date().toISOString()
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método no permitido (Use POST)' });
  }

  try {
    const { dropboxUrl, enterpriseId } = req.body || {};
    const result = await syncDropboxExcel(dropboxUrl, enterpriseId);
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.status(200).json(result);
  } catch (err: any) {
    console.error('Serverless error in /api/price-list/sync-dropbox:', err);
    return res.status(500).json({
      success: false,
      error: 'Error interno en función serverless al procesar archivo de Dropbox',
      details: err.message
    });
  }
}
