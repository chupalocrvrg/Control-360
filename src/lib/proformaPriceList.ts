import * as XLSX from 'xlsx';
import { db } from '../firebase';
import { collection, doc, setDoc, getDocs, getDoc, query, where } from 'firebase/firestore';
export interface PriceListCatalogItem {
  id: string;
  articleName: string;
  category: string;
  brand: string;
  cashPrice: number;
  downPayment: number;
  allowedTerms: number[];
  termQuotes: Record<number, number>;
  termTotals: Record<number, number>;
  gift?: string;
  updatedAt: string;
}

/**
 * Normalizes Dropbox sharing URL to a direct binary download link.
 */
export function normalizeDropboxUrl(url: string): string {
  if (!url) return '';
  let cleanUrl = url.trim();
  
  // Replace dl=0 with raw=1
  if (cleanUrl.includes('dropbox.com')) {
    if (cleanUrl.includes('dl=0')) {
      cleanUrl = cleanUrl.replace('dl=0', 'raw=1');
    } else if (!cleanUrl.includes('raw=1')) {
      cleanUrl += cleanUrl.includes('?') ? '&raw=1' : '?raw=1';
    }
    // Also support dl.dropboxusercontent.com
    cleanUrl = cleanUrl.replace('www.dropbox.com', 'dl.dropboxusercontent.com');
  }
  
  return cleanUrl;
}

/**
 * Helper to clean column keys for flexible header matching.
 */
function cleanKey(key: string): string {
  return key.toString().toLowerCase().trim().replace(/[^a-z0-9]/g, '');
}

/**
 * Parses raw Excel rows into structured PriceListCatalogItem array.
 */
export function parseExcelRowsToPriceList(jsonRows: any[]): PriceListCatalogItem[] {
  if (!Array.isArray(jsonRows) || jsonRows.length === 0) return [];

  const items: PriceListCatalogItem[] = [];

  jsonRows.forEach((row, idx) => {
    if (!row || typeof row !== 'object') return;

    // Build map of normalized keys to original values
    const keyMap: Record<string, any> = {};
    Object.keys(row).forEach(k => {
      keyMap[cleanKey(k)] = row[k];
    });

    // 1. Article Name
    const articleName = 
      keyMap['articulo'] || 
      keyMap['producto'] || 
      keyMap['descripcion'] || 
      keyMap['nombre'] || 
      keyMap['item'] || 
      '';

    if (!articleName || articleName.toString().trim() === '') return;

    // 2. Category & Brand
    const category = (keyMap['categoria'] || keyMap['linea'] || keyMap['grupo'] || 'General').toString().trim();
    const brand = (keyMap['marca'] || keyMap['fabricante'] || 'Generico').toString().trim();

    // 3. Cash Price & Down Payment
    const cashPrice = parseFloat(keyMap['preciocontado'] || keyMap['preciominimo'] || keyMap['contado'] || keyMap['precio'] || '0') || 0;
    const downPayment = parseFloat(keyMap['entrada'] || keyMap['enganche'] || keyMap['pie'] || '0') || 0;
    const gift = (keyMap['regalo'] || keyMap['promocion'] || keyMap['obsequio'] || '').toString().trim();

    // 4. Extract allowed credit terms & quotes
    const allowedTermsSet = new Set<number>();
    const termQuotes: Record<number, number> = {};
    const termTotals: Record<number, number> = {};

    // Check explicit term columns e.g. "3M", "6M", "12M", "15M", "20M", "24M", "Cuota 3m", "Precio 6m", etc.
    Object.keys(row).forEach(originalKey => {
      const val = parseFloat(row[originalKey]);
      if (isNaN(val) || val <= 0) return;

      const cleaned = cleanKey(originalKey);
      
      // Match month numbers like "3meses", "6m", "12meses", "20m", "cuota24m", "precio28m", "3", "6", "12", "15", "20", "24", "28"
      const monthMatch = cleaned.match(/^(?:cuota|precio|meses|m)?([0-9]{1,2})(?:m|meses)?$/);
      if (monthMatch && monthMatch[1]) {
        const months = parseInt(monthMatch[1], 10);
        // Valid month terms in retail financing (e.g. 1 to 60 months)
        if (months >= 1 && months <= 60) {
          allowedTermsSet.add(months);
          
          // Determine if val is monthly quote or total price
          if (cleaned.includes('precio') || val > cashPrice) {
            termTotals[months] = val;
            termQuotes[months] = Math.round((val - downPayment) / months * 100) / 100;
          } else {
            termQuotes[months] = val;
            termTotals[months] = Math.round((downPayment + (val * months)) * 100) / 100;
          }
        }
      }
    });

    // Check for "Plazos" or "Meses" text column e.g. "3, 6, 12, 18" or "20, 22, 24, 28"
    const plazosStr = (keyMap['plazos'] || keyMap['meses'] || keyMap['plazopermitido'] || '').toString();
    if (plazosStr) {
      const parsedMonths = plazosStr.match(/\d+/g);
      if (parsedMonths) {
        parsedMonths.forEach(mStr => {
          const m = parseInt(mStr, 10);
          if (m >= 1 && m <= 60) {
            allowedTermsSet.add(m);
            // If quote wasn't set from dynamic column, calculate estimated quote from cash price or base quote
            if (!termQuotes[m]) {
              const baseQuote = parseFloat(keyMap['cuota'] || keyMap['cuotabase'] || '0');
              if (baseQuote > 0) {
                termQuotes[m] = baseQuote;
                termTotals[m] = Math.round((downPayment + (baseQuote * m)) * 100) / 100;
              } else if (cashPrice > 0) {
                // Default 2.5% monthly interest estimation
                const financed = Math.max(0, cashPrice - downPayment);
                const estimatedQuote = Math.round((financed * (1 + (0.025 * m)) / m) * 100) / 100;
                termQuotes[m] = estimatedQuote;
                termTotals[m] = Math.round((downPayment + (estimatedQuote * m)) * 100) / 100;
              }
            }
          }
        });
      }
    }

    // Default fallbacks if no specific terms found
    const sortedTerms = Array.from(allowedTermsSet).sort((a, b) => a - b);
    if (sortedTerms.length === 0) {
      // Default retail terms e.g. [3, 6, 12]
      [3, 6, 12].forEach(m => {
        sortedTerms.push(m);
        const financed = Math.max(0, cashPrice - downPayment);
        const estimatedQuote = financed > 0 ? Math.round((financed / m) * 100) / 100 : 0;
        termQuotes[m] = estimatedQuote;
        termTotals[m] = cashPrice;
      });
    }

    items.push({
      id: `price-item-${idx + 1}-${Date.now()}`,
      articleName: articleName.toString().trim(),
      category,
      brand,
      cashPrice,
      downPayment,
      allowedTerms: sortedTerms,
      termQuotes,
      termTotals,
      gift: gift || undefined,
      updatedAt: new Date().toISOString()
    });
  });

  return items;
}

/**
 * Downloads and parses an Excel file from a direct URL (Dropbox or Web).
 */
export async function syncPriceListFromUrl(rawUrl: string): Promise<PriceListCatalogItem[]> {
  const directUrl = normalizeDropboxUrl(rawUrl);
  if (!directUrl) {
    throw new Error('Ingrese un enlace válido de Dropbox o servidor web.');
  }

  const response = await fetch(directUrl);
  if (!response.ok) {
    throw new Error(`No se pudo descargar el archivo desde el enlace. Código de estado: ${response.status}. Verifique que el enlace sea público.`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('El archivo Excel descargado no contiene hojas de datos.');
  }

  // Parse first sheet
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const jsonRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

  return parseExcelRowsToPriceList(jsonRows);
}

/**
 * Parses a uploaded file buffer (.xlsx, .xls, .csv).
 */
export function syncPriceListFromFileBuffer(arrayBuffer: ArrayBuffer): PriceListCatalogItem[] {
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('El archivo Excel subido no contiene hojas de datos.');
  }
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const jsonRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
  return parseExcelRowsToPriceList(jsonRows);
}

/**
 * Saves active price list to Firestore for the enterprise.
 */
export async function saveEnterprisePriceList(
  enterpriseId: string, 
  items: PriceListCatalogItem[], 
  sourceUrl?: string
): Promise<void> {
  if (!enterpriseId) return;

  const docRef = doc(db, 'enterprise_price_lists', enterpriseId);
  await setDoc(docRef, {
    enterpriseId,
    sourceUrl: sourceUrl || '',
    itemCount: items.length,
    items,
    updatedAt: new Date().toISOString()
  });
}

/**
 * Loads current active price list from Firestore for the enterprise.
 */
export async function loadEnterprisePriceList(enterpriseId: string): Promise<{ items: PriceListCatalogItem[]; sourceUrl?: string; updatedAt?: string }> {
  if (!enterpriseId) return { items: [] };

  try {
    const docRef = doc(db, 'enterprise_price_lists', enterpriseId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      return {
        items: Array.isArray(data.items) ? data.items : [],
        sourceUrl: data.sourceUrl || '',
        updatedAt: data.updatedAt || ''
      };
    }
  } catch (err) {
    console.error('Error loading enterprise price list:', err);
  }

  return { items: [] };
}
