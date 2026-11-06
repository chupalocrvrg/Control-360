import * as XLSX from 'xlsx';
import { parseRawRowsToPriceList } from './priceListService';
import { PriceListItem } from '../types/proforma';

export interface DropboxSyncResult {
  success: boolean;
  error?: string;
  details?: string;
  items?: PriceListItem[];
  sheetName?: string;
  count?: number;
  syncDate?: string;
}

/**
 * Downloads and parses an Excel price list from Dropbox server-side.
 * Tests multiple direct download candidate URLs to ensure reliable retrieval.
 */
export async function syncDropboxExcel(dropboxUrl: string, enterpriseId?: string): Promise<DropboxSyncResult> {
  if (!dropboxUrl || typeof dropboxUrl !== 'string') {
    return {
      success: false,
      error: "Falta el enlace de Dropbox ('dropboxUrl')."
    };
  }

  const cleanInput = dropboxUrl.trim();
  if (!cleanInput.startsWith('http://') && !cleanInput.startsWith('https://')) {
    return {
      success: false,
      error: 'El enlace proporcionado no es una URL válida (debe comenzar con https://).'
    };
  }

  // Generate candidate URLs for direct binary download
  const candidateUrls: string[] = [];

  const setUrlParam = (urlStr: string, paramName: string, paramValue: string): string => {
    try {
      const u = new URL(urlStr);
      u.searchParams.set(paramName, paramValue);
      u.searchParams.delete(paramName === 'raw' ? 'dl' : 'raw');
      return u.toString();
    } catch {
      let res = urlStr.replace(new RegExp(`([?&])${paramName}=[01]`), `$1${paramName}=${paramValue}`);
      if (!res.includes(`${paramName}=`)) {
        res += res.includes('?') ? `&${paramName}=${paramValue}` : `?${paramName}=${paramValue}`;
      }
      return res;
    }
  };

  if (cleanInput.includes('dropbox.com')) {
    const cdnBase = cleanInput
      .replace('www.dropbox.com', 'dl.dropboxusercontent.com')
      .replace('//dropbox.com', '//dl.dropboxusercontent.com');

    // 1. Direct CDN URL with raw=1
    candidateUrls.push(setUrlParam(cdnBase, 'raw', '1'));

    // 2. Direct CDN URL with dl=1
    candidateUrls.push(setUrlParam(cdnBase, 'dl', '1'));

    // 3. Original host with raw=1
    candidateUrls.push(setUrlParam(cleanInput, 'raw', '1'));

    // 4. Original host with dl=1
    candidateUrls.push(setUrlParam(cleanInput, 'dl', '1'));
  } else {
    candidateUrls.push(cleanInput);
  }

  let buffer: Buffer | null = null;
  let lastError = '';

  for (const targetUrl of candidateUrls) {
    try {
      console.log(`[Dropbox Sync Service] Trying candidate URL: ${targetUrl}`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

      const response = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, */*'
        },
        redirect: 'follow',
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        lastError = `El servidor de Dropbox respondió con código HTTP ${response.status}: ${response.statusText}.`;
        continue;
      }

      const arrayBuffer = await response.arrayBuffer();
      const candidateBuffer = Buffer.from(arrayBuffer);

      if (candidateBuffer.length < 100) {
        lastError = 'El archivo descargado está vacío o es demasiado pequeño para ser un archivo Excel.';
        continue;
      }

      // Check if response is HTML preview page instead of raw Excel
      const sampleHead = candidateBuffer.toString('utf-8', 0, 500);
      if (sampleHead.includes('<!DOCTYPE') || sampleHead.includes('<html') || sampleHead.includes('Dropbox - ')) {
        lastError = 'El enlace de Dropbox retornó una página web HTML en lugar del archivo Excel (.xlsx). Asegúrese de que el enlace sea de acceso público.';
        continue;
      }

      buffer = candidateBuffer;
      break;
    } catch (err: any) {
      lastError = err.name === 'AbortError' 
        ? 'Tiempo de espera agotado al descargar desde Dropbox (más de 20 segundos).' 
        : (err.message || 'Error de conexión con Dropbox.');
    }
  }

  if (!buffer) {
    return {
      success: false,
      error: lastError || 'No se pudo descargar el archivo de Dropbox. Verifique que el enlace sea accesible públicamente.'
    };
  }

  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return {
        success: false,
        error: 'El archivo Excel no contiene hojas de cálculo visibles.'
      };
    }

    const worksheet = workbook.Sheets[sheetName];
    const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    if (rawRows.length === 0) {
      return {
        success: false,
        error: 'La hoja de cálculo está vacía o no contiene filas de datos válidas.'
      };
    }

    const items = parseRawRowsToPriceList(rawRows, enterpriseId);

    if (items.length === 0) {
      return {
        success: false,
        error: 'No se encontraron artículos con la estructura esperada en el archivo Excel.'
      };
    }

    return {
      success: true,
      sheetName,
      count: items.length,
      items,
      syncDate: new Date().toISOString()
    };
  } catch (parseErr: any) {
    console.error('Error parsing Excel workbook:', parseErr);
    return {
      success: false,
      error: 'Error al procesar la estructura del archivo Excel. Asegúrese de que el formato sea .xlsx válido.',
      details: parseErr.message
    };
  }
}
