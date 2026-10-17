import * as XLSX from 'xlsx';
import { db } from '../firebase';
import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  orderBy, 
  Timestamp, 
  setDoc,
  getDoc
} from 'firebase/firestore';
import { PriceListItem, CreditPlanOption, Proforma, ProformaItem, PriceListConfig } from '../types/proforma';

// Helper to sanitize numeric values from Excel (e.g. "$1,250.00", "1250,50", 1250)
export function parseExcelNumber(val: any): number {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const str = String(val).trim().replace(/[$]/g, '').replace(/,/g, '');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

// Helper to format date from Excel serial or string
export function parseExcelDate(val: any): string {
  if (!val) return '';
  if (typeof val === 'number') {
    try {
      // Excel serial date conversion
      const parsed = XLSX.SSF.parse_date_code(val);
      if (parsed) {
        const y = parsed.y;
        const m = String(parsed.m).padStart(2, '0');
        const d = String(parsed.d).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
    } catch {
      // Fallback
    }
  }
  return String(val).trim();
}

// Normalize column header keys for flexible matching
export function normalizeKey(key: string): string {
  return key
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9/]/g, '')
    .trim();
}

/**
 * Generates an internal encoded SKU / reference string embedding the minimum floor price
 * Example: Item "Smart TV Indurama 65TIKGF5QLED", Brand "Indurama", MinPrice $695
 * Generated code: "TV65IN695QLED"
 * This allows salespeople to know the minimum floor price without displaying it to the client.
 */
export function generateInternalItemCode(item: string, brand: string, minStorePrice: number): string {
  const priceFloor = Math.round(Number(minStorePrice) || 0);
  const cleanItem = (item || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const cleanBrand = (brand || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  
  // Extract primary digits (e.g. 65, 50, 43, 150, 18, 380)
  const numbersInItem = (item || '').match(/\d+/g) || [];
  const primaryNumber = numbersInItem.length > 0 ? numbersInItem[0] : '';
  
  // Prefix based on product type
  let prefix = 'ART';
  if (/TV|TELEVISOR|SMART/i.test(item)) prefix = 'TV';
  else if (/MOTO|MOTOCICLETA/i.test(item)) prefix = 'MOT';
  else if (/LAVADORA/i.test(item)) prefix = 'LAV';
  else if (/REFRIGERADORA|REFRI|NEVERA/i.test(item)) prefix = 'REF';
  else if (/COCINA/i.test(item)) prefix = 'COC';
  else if (/LAPTOP|COMPUTADORA/i.test(item)) prefix = 'PC';
  else if (/CELULAR|TELEFONO/i.test(item)) prefix = 'CEL';
  else {
    prefix = cleanItem.slice(0, 3) || 'ART';
  }

  // Brand abbreviation (2-3 chars)
  const brandCode = cleanBrand.slice(0, 2) || 'XX';

  // Suffix (from model or features like QLED, UHD, 4K, STD)
  let suffix = 'STD';
  if (/QLED/i.test(item)) suffix = 'QLED';
  else if (/OLED/i.test(item)) suffix = 'OLED';
  else if (/4K/i.test(item)) suffix = '4K';
  else if (/UHD/i.test(item)) suffix = 'UHD';
  else if (/FHD|FULL/i.test(item)) suffix = 'FHD';
  else if (/INVERTER/i.test(item)) suffix = 'INV';
  else if (/SPORT/i.test(item)) suffix = 'SPT';
  else if (/URBANA/i.test(item)) suffix = 'URB';
  else {
    const letters = cleanItem.replace(/^[A-Z]{2,4}/, '').slice(-3);
    if (letters.length >= 2) suffix = letters;
  }

  return `${prefix}${primaryNumber}${brandCode}${priceFloor}${suffix}`;
}

/**
 * Quota = (Total Credit Price - Down Payment) / Months
 */
export function calculateDynamicQuota(totalCreditPrice: number, downPayment: number, months: number): number {
  if (months <= 0) return 0;
  const financed = Math.max(0, totalCreditPrice - downPayment);
  return Number((financed / months).toFixed(2));
}

/**
 * Adapts items for a Combo Proforma:
 * - Unifies payment term to `targetMonths` (adapting items with fewer months to the longer term)
 * - Synchronizes payment schedule and values into a single consolidated monthly quota
 * - Allows unifying the initial down payment (cuota inicial unificada)
 */
export function calculateComboAdaptation(
  items: ProformaItem[],
  targetMonths: number,
  customTotalDownPayment?: number
): {
  adaptedItems: ProformaItem[];
  totalCredit: number;
  totalDownPayment: number;
  totalFinanced: number;
  comboMonthlyQuota: number;
} {
  const totalCredit = items.reduce((acc, it) => acc + (it.totalCreditPrice * it.quantity), 0);
  const defaultDownPaymentSum = items.reduce((acc, it) => acc + (it.downPayment * it.quantity), 0);
  const totalDownPayment = customTotalDownPayment !== undefined ? Math.max(0, customTotalDownPayment) : defaultDownPaymentSum;
  const totalFinanced = Math.max(0, totalCredit - totalDownPayment);
  const comboMonthlyQuota = targetMonths > 0 ? Number((totalFinanced / targetMonths).toFixed(2)) : 0;

  // Apportion down payment and quotas across items proportionally
  const adaptedItems: ProformaItem[] = items.map(item => {
    const itemTotalCredit = item.totalCreditPrice * item.quantity;
    const ratio = totalCredit > 0 ? itemTotalCredit / totalCredit : 1 / (items.length || 1);
    const itemDown = Number((totalDownPayment * ratio).toFixed(2));
    const itemFinanced = Math.max(0, itemTotalCredit - itemDown);
    const itemQuota = targetMonths > 0 ? Number((itemFinanced / targetMonths).toFixed(2)) : 0;

    return {
      ...item,
      originalPlanMonths: item.originalPlanMonths || item.selectedPlanMonths,
      selectedPlanMonths: targetMonths,
      downPayment: Number((itemDown / (item.quantity || 1)).toFixed(2)),
      calculatedQuota: Number((itemQuota / (item.quantity || 1)).toFixed(2))
    };
  });

  return {
    adaptedItems,
    totalCredit,
    totalDownPayment,
    totalFinanced,
    comboMonthlyQuota
  };
}

/**
 * Parse raw rows from an Excel sheet into structured PriceListItem[]
 */
export function parseRawRowsToPriceList(rows: any[], enterpriseId?: string): PriceListItem[] {
  const items: PriceListItem[] = [];

  rows.forEach((row, index) => {
    // Build a normalized row mapping
    const normalizedRow: Record<string, any> = {};
    Object.keys(row).forEach(k => {
      normalizedRow[normalizeKey(k)] = row[k];
    });

    // 1. Core item description
    const itemName = String(
      normalizedRow['ITEMS'] || 
      normalizedRow['ITEM'] || 
      normalizedRow['ARTICULO'] || 
      normalizedRow['DESCRIPCION'] || 
      normalizedRow['NOMBRE'] || 
      ''
    ).trim();

    if (!itemName) return; // Skip empty rows

    const category = String(normalizedRow['CATEGORIA'] || normalizedRow['CATEGORY'] || 'General').trim();
    const gift = String(normalizedRow['REGALO'] || normalizedRow['OBSEQUIO'] || '').trim();
    const brand = String(normalizedRow['MARCA'] || normalizedRow['BRAND'] || '').trim();
    const minStorePrice = parseExcelNumber(normalizedRow['MIN/ALMACEN'] || normalizedRow['MINALMACEN'] || normalizedRow['CONTADO'] || normalizedRow['MINIMO']);
    const creditPrice = parseExcelNumber(normalizedRow['CREDITO'] || normalizedRow['PRECIOCREDITO']);
    const defaultDownPayment = parseExcelNumber(normalizedRow['ENTRADA'] || normalizedRow['INICIAL']);
    const maxMonths = Math.round(parseExcelNumber(normalizedRow['MESES'] || normalizedRow['PLAZO'] || normalizedRow['PLAZOMAXIMO']));
    const defaultMonthlyQuota = parseExcelNumber(normalizedRow['CUOTA'] || normalizedRow['MENSUAL']);
    const updateDate = parseExcelDate(normalizedRow['FECHA']);
    const internalCode = generateInternalItemCode(itemName, brand, minStorePrice);

    // 2. Extract credit plans strictly bounded by maxMonths
    const plansMap = new Map<number, CreditPlanOption>();

    // Plan 3 Meses: only if 3 <= maxMonths (or maxMonths not set)
    const p3Total = parseExcelNumber(normalizedRow['3MESES'] || normalizedRow['3M']);
    const p3Down = parseExcelNumber(normalizedRow['ENTRADA3']);
    const p3Monthly = parseExcelNumber(normalizedRow['MENSUAL']);
    if ((p3Total > 0 || p3Monthly > 0 || (maxMonths >= 3 && creditPrice > 0)) && (maxMonths === 0 || 3 <= maxMonths)) {
      const tot = p3Total > 0 ? p3Total : creditPrice;
      const down = p3Down > 0 ? p3Down : defaultDownPayment;
      const quota = p3Monthly > 0 ? p3Monthly : calculateDynamicQuota(tot, down, 3);
      plansMap.set(3, {
        months: 3,
        totalPrice: tot,
        downPayment: down,
        monthlyPayment: quota,
        planLabel: '3 Meses'
      });
    }

    // Plan 6 Meses: only if 6 <= maxMonths (or maxMonths not set)
    const p6Total = parseExcelNumber(normalizedRow['6MESES'] || normalizedRow['6M']);
    const p6Down = parseExcelNumber(normalizedRow['ENTRADA4'] || normalizedRow['ENTRADA6']);
    const p6Monthly = parseExcelNumber(normalizedRow['MENSUAL3'] || normalizedRow['MENSUAL6']);
    if ((p6Total > 0 || p6Monthly > 0 || (maxMonths >= 6 && creditPrice > 0)) && (maxMonths === 0 || 6 <= maxMonths)) {
      const tot = p6Total > 0 ? p6Total : creditPrice;
      const down = p6Down > 0 ? p6Down : defaultDownPayment;
      const quota = p6Monthly > 0 ? p6Monthly : calculateDynamicQuota(tot, down, 6);
      plansMap.set(6, {
        months: 6,
        totalPrice: tot,
        downPayment: down,
        monthlyPayment: quota,
        planLabel: '6 Meses'
      });
    }

    // Plan 12 Meses: STRICTLY ONLY IF 12 <= maxMonths (or maxMonths not set)
    // NEVER add 12 months if the item's maximum term is e.g. 10 months, 8 months!
    const p12Total = parseExcelNumber(normalizedRow['12MESES'] || normalizedRow['12M']);
    const p12Down = parseExcelNumber(normalizedRow['ENTRAD'] || normalizedRow['ENTRADA12']);
    const p12Monthly = parseExcelNumber(normalizedRow['MENSUAL2'] || normalizedRow['MENSUAL12']);
    if ((p12Total > 0 || p12Monthly > 0 || (maxMonths >= 12 && creditPrice > 0)) && (maxMonths === 0 || 12 <= maxMonths)) {
      const tot = p12Total > 0 ? p12Total : creditPrice;
      const down = p12Down > 0 ? p12Down : defaultDownPayment;
      const quota = p12Monthly > 0 ? p12Monthly : calculateDynamicQuota(tot, down, 12);
      plansMap.set(12, {
        months: 12,
        totalPrice: tot,
        downPayment: down,
        monthlyPayment: quota,
        planLabel: '12 Meses'
      });
    }

    // Plan Máximo / MESES column (e.g. 10, 14, 15, 20, 24, 28)
    if (maxMonths > 0) {
      const isAlreadyIn = plansMap.has(maxMonths);
      const tot = creditPrice > 0 ? creditPrice : (plansMap.get(maxMonths)?.totalPrice || 0);
      const down = defaultDownPayment > 0 ? defaultDownPayment : (plansMap.get(maxMonths)?.downPayment || 0);
      const quota = defaultMonthlyQuota > 0 ? defaultMonthlyQuota : calculateDynamicQuota(tot, down, maxMonths);
      
      plansMap.set(maxMonths, {
        months: maxMonths,
        totalPrice: tot,
        downPayment: down,
        monthlyPayment: quota,
        isMaxTerm: true,
        planLabel: `${maxMonths} Meses (Plazo Máximo)`
      });
    }

    // Dynamic scan for other month columns (e.g. 10 MESES, 15 MESES, 20 MESES, 24 MESES, 28 MESES)
    Object.keys(normalizedRow).forEach(k => {
      const match = k.match(/^(\d+)MESES$/) || k.match(/^(\d+)M$/);
      if (match) {
        const m = parseInt(match[1], 10);
        if (m > 0 && !plansMap.has(m) && (maxMonths === 0 || m <= maxMonths)) {
          const tot = parseExcelNumber(normalizedRow[k]) || creditPrice;
          const quota = calculateDynamicQuota(tot, defaultDownPayment, m);
          plansMap.set(m, {
            months: m,
            totalPrice: tot,
            downPayment: defaultDownPayment,
            monthlyPayment: quota,
            isMaxTerm: m === maxMonths,
            planLabel: `${m} Meses`
          });
        }
      }
    });

    // Fallback: If no plan was added but credit price and maxMonths exist
    if (plansMap.size === 0 && maxMonths > 0 && creditPrice > 0) {
      plansMap.set(maxMonths, {
        months: maxMonths,
        totalPrice: creditPrice,
        downPayment: defaultDownPayment,
        monthlyPayment: defaultMonthlyQuota || calculateDynamicQuota(creditPrice, defaultDownPayment, maxMonths),
        isMaxTerm: true,
        planLabel: `${maxMonths} Meses (Plazo Máximo)`
      });
    }

    // CRITICAL FILTER: Ensure NO plan ever exceeds maxMonths
    const sortedPlans = Array.from(plansMap.values())
      .filter(p => p.months > 0 && (maxMonths === 0 || p.months <= maxMonths))
      .sort((a, b) => a.months - b.months);

    // Ensure the highest month plan has isMaxTerm: true
    if (sortedPlans.length > 0) {
      const highestMonth = Math.max(...sortedPlans.map(p => p.months));
      sortedPlans.forEach(p => {
        p.isMaxTerm = p.months === highestMonth;
        if (p.isMaxTerm) {
          p.planLabel = `${p.months} Meses (Plazo Máximo)`;
        } else {
          p.planLabel = `${p.months} Meses`;
        }
      });
    }

    items.push({
      id: `item-${index + 1}-${Date.now()}`,
      category,
      gift,
      item: itemName,
      brand,
      minStorePrice,
      creditPrice,
      defaultDownPayment,
      maxMonths,
      defaultMonthlyQuota,
      updateDate,
      internalCode,
      plans: sortedPlans,
      enterpriseId: enterpriseId || ''
    });
  });

  return items;
}

/**
 * Parse an Excel file ArrayBuffer or Buffer into PriceListItem[]
 */
export function parseExcelBufferToPriceList(buffer: ArrayBuffer | Uint8Array, enterpriseId?: string): PriceListItem[] {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];

  const worksheet = workbook.Sheets[sheetName];
  const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
  return parseRawRowsToPriceList(rawRows, enterpriseId);
}

/**
 * Demo sample catalog containing the exact examples from the business brief
 */
export const SAMPLE_PRICE_LIST: PriceListItem[] = [
  {
    id: 'sample-tv-43',
    category: 'AUDIO Y VIDEO',
    gift: 'Soporte de Pared + Cable HDMI',
    item: 'Smart TV 43" Full HD Google TV',
    brand: 'Samsung',
    minStorePrice: 380,
    creditPrice: 480,
    defaultDownPayment: 50,
    maxMonths: 10,
    defaultMonthlyQuota: 43,
    updateDate: '2026-09-25',
    internalCode: 'TV43SA380FHD',
    plans: [
      { months: 3, totalPrice: 410, downPayment: 40, monthlyPayment: 123.33, planLabel: '3 Meses' },
      { months: 6, totalPrice: 440, downPayment: 50, monthlyPayment: 65, planLabel: '6 Meses' },
      { months: 10, totalPrice: 480, downPayment: 50, monthlyPayment: 43, isMaxTerm: true, planLabel: '10 Meses (Plazo Máximo)' }
    ]
  },
  {
    id: 'sample-tv-50',
    category: 'AUDIO Y VIDEO',
    gift: 'Teclado Inalámbrico Smart',
    item: 'Smart TV 50" 4K UHD Crystal HDR',
    brand: 'LG',
    minStorePrice: 520,
    creditPrice: 650,
    defaultDownPayment: 70,
    maxMonths: 12,
    defaultMonthlyQuota: 48.33,
    updateDate: '2026-09-28',
    internalCode: 'TV50LG520UHD',
    plans: [
      { months: 3, totalPrice: 560, downPayment: 60, monthlyPayment: 166.67, planLabel: '3 Meses' },
      { months: 6, totalPrice: 600, downPayment: 70, monthlyPayment: 88.33, planLabel: '6 Meses' },
      { months: 12, totalPrice: 650, downPayment: 70, monthlyPayment: 48.33, isMaxTerm: true, planLabel: '12 Meses (Plazo Máximo)' }
    ]
  },
  {
    id: 'sample-tv-65',
    category: 'AUDIO Y VIDEO',
    gift: 'Barra de Sonido Bluetooth 120W',
    item: 'Smart TV 65" QLED 4K Cinema Vision',
    brand: 'TCL',
    minStorePrice: 850,
    creditPrice: 1100,
    defaultDownPayment: 120,
    maxMonths: 15,
    defaultMonthlyQuota: 65.33,
    updateDate: '2026-09-28',
    internalCode: 'TV65TC850QLED',
    plans: [
      { months: 3, totalPrice: 920, downPayment: 100, monthlyPayment: 273.33, planLabel: '3 Meses' },
      { months: 6, totalPrice: 980, downPayment: 110, monthlyPayment: 145, planLabel: '6 Meses' },
      { months: 15, totalPrice: 1100, downPayment: 120, monthlyPayment: 65.33, isMaxTerm: true, planLabel: '15 Meses (Plazo Máximo)' }
    ]
  },
  {
    id: 'sample-moto-150',
    category: 'MOTOS Y VEHICULOS',
    gift: 'Casco Certificado DOT + Matrícula + Chaleco',
    item: 'Motocicleta 150cc Urbana Sport Black Edition',
    brand: 'Daytona',
    minStorePrice: 1650,
    creditPrice: 2280,
    defaultDownPayment: 250,
    maxMonths: 28,
    defaultMonthlyQuota: 72.50,
    updateDate: '2026-09-29',
    internalCode: 'MOT150DA1650SPT',
    plans: [
      { months: 20, totalPrice: 2050, downPayment: 250, monthlyPayment: 90, planLabel: '20 Meses' },
      { months: 22, totalPrice: 2120, downPayment: 250, monthlyPayment: 85, planLabel: '22 Meses' },
      { months: 24, totalPrice: 2180, downPayment: 250, monthlyPayment: 80.42, planLabel: '24 Meses' },
      { months: 26, totalPrice: 2230, downPayment: 250, monthlyPayment: 76.15, planLabel: '26 Meses' },
      { months: 28, totalPrice: 2280, downPayment: 250, monthlyPayment: 72.50, isMaxTerm: true, planLabel: '28 Meses (Plazo Máximo)' }
    ]
  },
  {
    id: 'sample-refri-380',
    category: 'LINEA BLANCA',
    gift: 'Juego de Refractarios de Vidrio 5pz',
    item: 'Refrigeradora No Frost 380 Litros Inverter Acero',
    brand: 'Indurama',
    minStorePrice: 620,
    creditPrice: 790,
    defaultDownPayment: 80,
    maxMonths: 18,
    defaultMonthlyQuota: 39.44,
    updateDate: '2026-09-25',
    internalCode: 'REF380IN620INV',
    plans: [
      { months: 3, totalPrice: 660, downPayment: 70, monthlyPayment: 196.67, planLabel: '3 Meses' },
      { months: 6, totalPrice: 700, downPayment: 80, monthlyPayment: 103.33, planLabel: '6 Meses' },
      { months: 12, totalPrice: 750, downPayment: 80, monthlyPayment: 55.83, planLabel: '12 Meses' },
      { months: 18, totalPrice: 790, downPayment: 80, monthlyPayment: 39.44, isMaxTerm: true, planLabel: '18 Meses (Plazo Máximo)' }
    ]
  },
  {
    id: 'sample-lavadora-18kg',
    category: 'LINEA BLANCA',
    gift: 'Dispensador + Detergente Líquido',
    item: 'Lavadora Automática Carga Superior 18 Kg',
    brand: 'Mabe',
    minStorePrice: 480,
    creditPrice: 610,
    defaultDownPayment: 60,
    maxMonths: 12,
    defaultMonthlyQuota: 45.83,
    updateDate: '2026-09-27',
    internalCode: 'LAV18MA480STD',
    plans: [
      { months: 3, totalPrice: 520, downPayment: 50, monthlyPayment: 156.67, planLabel: '3 Meses' },
      { months: 6, totalPrice: 560, downPayment: 60, monthlyPayment: 83.33, planLabel: '6 Meses' },
      { months: 12, totalPrice: 610, downPayment: 60, monthlyPayment: 45.83, isMaxTerm: true, planLabel: '12 Meses (Plazo Máximo)' }
    ]
  }
];

// Local cache keys
const LOCAL_STORAGE_PRICE_LIST_KEY = 'control360_price_list_items';
const LOCAL_STORAGE_CONFIG_KEY = 'control360_price_list_config';

/**
 * Load price list from Firestore or fallback to localStorage / sample catalog
 */
export async function loadPriceList(enterpriseId: string): Promise<PriceListItem[]> {
  try {
    const q = query(
      collection(db, 'price_list_items'),
      where('enterpriseId', '==', enterpriseId)
    );
    const snap = await getDocs(q);

    if (!snap.empty) {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as PriceListItem));
      // Update local cache
      try {
        localStorage.setItem(`${LOCAL_STORAGE_PRICE_LIST_KEY}_${enterpriseId}`, JSON.stringify(items));
      } catch {}
      return items;
    }

    // Try localStorage cache
    const cached = localStorage.getItem(`${LOCAL_STORAGE_PRICE_LIST_KEY}_${enterpriseId}`);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (err) {
    console.warn('Could not load price list from Firestore, falling back to local cache/sample:', err);
    try {
      const cached = localStorage.getItem(`${LOCAL_STORAGE_PRICE_LIST_KEY}_${enterpriseId}`);
      if (cached) return JSON.parse(cached);
    } catch {}
  }

  // Fallback to sample items for immediate interactive experience
  return SAMPLE_PRICE_LIST;
}

/**
 * Save synced price list items to Firestore and local cache
 */
export async function savePriceList(enterpriseId: string, items: PriceListItem[]): Promise<void> {
  // Update local cache immediately
  try {
    localStorage.setItem(`${LOCAL_STORAGE_PRICE_LIST_KEY}_${enterpriseId}`, JSON.stringify(items));
  } catch {}

  // Batch or individual save in Firestore
  try {
    const existingSnap = await getDocs(
      query(collection(db, 'price_list_items'), where('enterpriseId', '==', enterpriseId))
    );
    
    // Delete old records if any
    const deletePromises = existingSnap.docs.map(d => deleteDoc(d.ref));
    await Promise.all(deletePromises);

    // Save new records (in chunks to respect Firestore limits)
    const chunkSize = 200;
    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);
      await Promise.all(
        chunk.map(item => 
          addDoc(collection(db, 'price_list_items'), {
            ...item,
            enterpriseId,
            updatedAt: Timestamp.now()
          })
        )
      );
    }
  } catch (err) {
    console.error('Error saving price list to Firestore:', err);
    // Non-blocking since local cache is already saved
  }
}

/**
 * Load Dropbox Price List Configuration
 */
export async function loadPriceListConfig(enterpriseId: string): Promise<PriceListConfig> {
  try {
    const docRef = doc(db, 'price_list_config', enterpriseId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as PriceListConfig;
    }
  } catch (err) {
    console.warn('Error reading price_list_config:', err);
  }

  // Local storage fallback
  try {
    const cached = localStorage.getItem(`${LOCAL_STORAGE_CONFIG_KEY}_${enterpriseId}`);
    if (cached) return JSON.parse(cached);
  } catch {}

  return {
    dropboxUrl: '',
    lastSyncAt: null,
    itemsCount: 0,
    status: 'idle'
  };
}

/**
 * Save Dropbox Price List Configuration
 */
export async function savePriceListConfig(enterpriseId: string, config: PriceListConfig): Promise<void> {
  try {
    localStorage.setItem(`${LOCAL_STORAGE_CONFIG_KEY}_${enterpriseId}`, JSON.stringify(config));
    const docRef = doc(db, 'price_list_config', enterpriseId);
    await setDoc(docRef, {
      ...config,
      enterpriseId,
      updatedAt: Timestamp.now()
    }, { merge: true });
  } catch (err) {
    console.error('Error saving price_list_config:', err);
  }
}

/**
 * Save a new Proforma to Firestore
 */
export async function saveProforma(proformaData: Omit<Proforma, 'id'>): Promise<string> {
  const docRef = await addDoc(collection(db, 'proformas'), {
    ...proformaData,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  });
  return docRef.id;
}

/**
 * Load Proformas from Firestore
 */
export async function loadProformas(enterpriseId: string): Promise<Proforma[]> {
  try {
    const q = query(
      collection(db, 'proformas'),
      where('enterpriseId', '==', enterpriseId)
    );
    const snap = await getDocs(q);
    const list: Proforma[] = snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    } as Proforma));
    return list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  } catch (err) {
    console.error('Error loading proformas:', err);
    return [];
  }
}

/**
 * Update Proforma status (e.g. COTIZADA, ACEPTADA, VENDIDA, RECHAZADA)
 */
export async function updateProformaStatus(id: string, status: Proforma['status']): Promise<void> {
  const docRef = doc(db, 'proformas', id);
  await updateDoc(docRef, {
    status,
    updatedAt: Timestamp.now()
  });
}
