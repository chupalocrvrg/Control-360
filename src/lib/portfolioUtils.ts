import { 
  PortfolioClient, 
  PortfolioSnapshot, 
  AgingBracket, 
  BracketSummaryItem, 
  CollectorSummaryItem, 
  getAgingBracket 
} from '../types/portfolio';

// Strict exclusions list to discard header words and totals detected as client names
export const HEADER_EXCLUSIONS = new Set([
  'cliente',
  'clientes',
  'nombre',
  'nombres',
  'total',
  'totales',
  'subtotal',
  'subtotales',
  'fecha venta',
  'fecha',
  'direccion',
  'dirección',
  'entrada pendiente',
  'entrada',
  'articulo',
  'artículo',
  'item',
  'telefono',
  'teléfono',
  'celular',
  'telf',
  'valor venta',
  'abonos',
  'abono',
  'saldo',
  'u.pago',
  'u. pago',
  'ultimo pago',
  'último pago',
  'valor u. pago',
  'valor u pago',
  'valor cuota',
  'cuota',
  'cuo',
  'dias mora',
  'días mora',
  'mora',
  'dias atraso',
  'días atraso',
  'valor total atraso',
  'valor total',
  'n° operacion',
  'no operacion',
  'operacion',
  'operación',
  'ruc',
  'cedula',
  'cédula',
  'id',
  'detalle'
]);

/**
 * Validates if a string is likely a header row or invalid name
 */
export function isInvalidClientName(rawName: string): boolean {
  if (!rawName) return true;
  const clean = rawName.toLowerCase().trim();
  if (clean.length <= 1) return true;
  if (HEADER_EXCLUSIONS.has(clean)) return true;
  // If starts with "cliente" without numbers or last names (e.g. "Cliente", "CLIENTE -")
  if (clean === 'cliente' || clean === 'clientes') return true;
  // Check if it consists solely of repeated header tokens
  const tokens = clean.split(/[\s\-_/\\|]+/).filter(Boolean);
  if (tokens.length > 0 && tokens.every(t => HEADER_EXCLUSIONS.has(t))) {
    return true;
  }
  return false;
}

/**
 * Cleans and formats phone numbers assuming Ecuadorian destination (+593)
 * Standard Ecuadorian mobile numbers are 10 digits starting with 09 (e.g. 0987654321 -> 593987654321)
 */
export function formatEcuadorianPhone(rawPhone?: string): string | null {
  if (!rawPhone) return null;
  const digits = rawPhone.replace(/\D/g, '');
  if (!digits) return null;

  // Case 1: 09XXXXXXXX (10 digits starting with 09)
  if (digits.length === 10 && digits.startsWith('09')) {
    return `593${digits.substring(1)}`;
  }
  // Case 2: 9XXXXXXXX (9 digits starting with 9)
  if (digits.length === 9 && digits.startsWith('9')) {
    return `593${digits}`;
  }
  // Case 3: Already starts with 593 (e.g. 5939XXXXXXXX)
  if (digits.startsWith('593') && digits.length >= 11) {
    return digits;
  }
  // Case 4: 9 digits starting with 0 (landline e.g. 072... -> 5937...)
  if (digits.length === 9 && digits.startsWith('0')) {
    return `593${digits.substring(1)}`;
  }
  // Fallback if at least 8 digits
  if (digits.length >= 8) {
    return digits.startsWith('593') ? digits : `593${digits}`;
  }
  return null;
}

/**
 * Generates an empathetic, respectful, and legally sound WhatsApp collection message
 * specifically tailored to the client's overdue days bracket.
 */
export function generateWhatsAppMessage(client: {
  clientName: string;
  itemSold?: string;
  amount: number;
  overdueDays: number;
  operationNumber?: string;
}): string {
  const name = client.clientName ? client.clientName.trim() : 'Estimado(a) Cliente';
  const item = client.itemSold && client.itemSold.trim() ? ` por su artículo *${client.itemSold.trim()}*` : '';
  const formattedAmount = `$${Number(client.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const days = Math.max(0, Math.floor(client.overdueDays || 0));
  const opInfo = client.operationNumber && client.operationNumber.trim() ? ` (Operación: ${client.operationNumber})` : '';

  if (days === 0) {
    // 0 días de atraso: Recordatorio amistoso de pago al día / cuota por vencer en el corte
    return `Hola estimado(a) *${name}*, reciba un cordial saludo. Le recordamos amablemente que el valor de su cuota${item} por el monto de *${formattedAmount}*${opInfo} tiene fecha programada para el día de hoy / se encuentra al día por vencer. Si ya realizó su abono o cancelación, por favor haga caso omiso o compártanos su comprobante por este medio. ¡Muchas gracias por su puntualidad!`;
  }

  if (days <= 30) {
    // 1 a 30 días: Mora temprana / recordatorio cortés
    return `Estimado(a) *${name}*, le saludamos cordialmente del departamento de cobranzas. Le recordamos que registra un saldo pendiente de *${formattedAmount}* con *${days} día(s) de atraso* en su crédito${item}${opInfo}. Le invitamos a regularizar su cuota el día de hoy para mantener su crédito al día y evitar recargos adicionales. Si ya canceló, por favor envíenos la foto de su depósito o transferencia. ¡Que tenga un excelente día!`;
  }

  if (days <= 60) {
    // 31 a 60 días: Mora preventiva
    return `Estimado(a) *${name}*, nos comunicamos para notificarle que presenta un atraso de *${days} días* en su crédito${item}${opInfo}, con un saldo acumulado de *${formattedAmount}*. Le solicitamos coordinar su pago o abono el día de hoy para convenir una fecha y evitar la afectación de su historial crediticio y costos adicionales. Por favor confírmenos a qué hora puede realizar su cancelación.`;
  }

  if (days <= 90) {
    // 61 a 90 días: Cartera vencida
    return `AVISO DE COBRANZA: Estimado(a) *${name}*, le informamos que su cuenta presenta un atraso vencido de *${days} días* por un valor total de *${formattedAmount}* correspondiente a su compra${item}${opInfo}. Es indispensable que se comunique el día de hoy para suscribir un compromiso de pago formal antes de que su expediente pase a una instancia de recuperación superior. Agradecemos su pronta atención.`;
  }

  // Más de 90 días: Cartera crítica / castigada
  return `NOTIFICACIÓN URGENTE DE COBRANZA: Señor(a) *${name}*, su cuenta${item}${opInfo} registra una mora crítica de *${days} días* con un saldo deudor de *${formattedAmount}*. Se requiere la cancelación inmediata o un acuerdo formal de pago el día de hoy para evitar el traslado definitivo a gestión prejudicial y centrales de información crediticia. Por favor comuníquese de manera urgente a este canal.`;
}

/**
 * Rounds a number or string representation to strictly 2 decimal places to prevent floating point inaccuracies.
 */
export function round2(val: number | string | undefined | null): number {
  if (val === undefined || val === null || val === '') return 0;
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.-]+/g, ''));
  if (isNaN(num)) return 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Determines whether an employee is a supervisor based on both system role and organizational position / cargo.
 * Ensures supervisors never appear as collectors for portfolio assignment, while consolidating their global metrics.
 */
export function isSupervisorEmployee(e: { role?: string; position?: string; cargo?: string; puesto?: string; [key: string]: any } | null | undefined): boolean {
  if (!e) return false;
  const roleLower = String(e.role || '').toLowerCase().trim();
  const posLower = String(e.position || e.cargo || e.puesto || '').toLowerCase().trim();
  
  if (roleLower.includes('supervisor') || roleLower === 'admin' || roleLower === 'superadmin') {
    return true;
  }
  if (posLower.includes('supervisor') || posLower.includes('coordinador') || posLower.includes('gerente')) {
    return true;
  }
  return false;
}

/**
 * Returns direct wa.me link with encoded message for Ecuadorian phones.
 * Supports passing either a PortfolioClient object or directly a raw phone string.
 */
export function getWhatsAppUrl(
  phoneOrClient: string | { phone?: string; clientName?: string; [key: string]: any }, 
  customText?: string
): string | null {
  let rawPhone = '';
  let textToSend = '';

  if (typeof phoneOrClient === 'string') {
    rawPhone = phoneOrClient;
    textToSend = customText || '';
  } else if (phoneOrClient && typeof phoneOrClient === 'object') {
    rawPhone = phoneOrClient.phone || '';
    textToSend = customText || (phoneOrClient.clientName ? generateWhatsAppMessage(phoneOrClient as any) : '');
  }

  const cleanPhone = formatEcuadorianPhone(rawPhone);
  if (!cleanPhone) return null;
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(textToSend)}`;
}

/**
 * Parses diverse Excel date formats (serial numbers, DD/MM/YYYY, YYYY-MM-DD) to ISO YYYY-MM-DD.
 */
export function parseDateToISO(raw: any): string | null {
  if (!raw && raw !== 0) return null;
  if (typeof raw === 'number' && raw > 30000 && raw < 65000) {
    // Excel serial date number
    const date = new Date(Math.round((raw - 25569) * 86400 * 1000));
    if (!isNaN(date.getTime())) {
      return date.toISOString().substring(0, 10);
    }
  }
  const str = String(raw).trim();
  if (!str) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }
  return null;
}

/**
 * Normalizes text by removing accents/diacritics, extra spaces, and converting to lowercase.
 */
export function normalizeText(text?: string): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Normalizes an item/article name, stripping minor noise like serials or codes.
 */
export function normalizeItem(item?: string): string {
  if (!item) return '';
  return normalizeText(item)
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Generates the strict 4-Factor digital fingerprint:
 * (Nombre + Fecha Venta + Ítem Vendido + Valor Venta)
 */
export function getFourFactorKey(r: {
  clientName?: string;
  saleDate?: string;
  itemSold?: string;
  saleValue?: number;
}): string {
  const normName = normalizeText(r.clientName);
  const rawDate = r.saleDate ? String(r.saleDate).trim() : '';
  const cleanDate = (parseDateToISO(rawDate) || rawDate).trim();
  const normItem = normalizeItem(r.itemSold);
  const saleVal = (r.saleValue !== undefined && Number(r.saleValue) > 0)
    ? Math.round(Number(r.saleValue) * 100) / 100
    : 0;
  const saleValStr = saleVal > 0 ? saleVal.toFixed(2) : '';

  return `4f:${normName}|${cleanDate}|${normItem}|${saleValStr}`;
}

/**
 * Checks if two credit records match strictly on the 4 factors:
 * 1. Nombre del Cliente
 * 2. Fecha de Venta
 * 3. Ítem Vendido
 * 4. Valor de Venta
 */
export function matchFourFactors(
  a: { clientName?: string; saleDate?: string; itemSold?: string; saleValue?: number },
  b: { clientName?: string; saleDate?: string; itemSold?: string; saleValue?: number }
): boolean {
  // 1. Client Name match
  const nameA = normalizeText(a.clientName);
  const nameB = normalizeText(b.clientName);
  if (!nameA || !nameB || nameA !== nameB) return false;

  // 2. Sale Date match
  const rawDateA = a.saleDate ? String(a.saleDate).trim() : '';
  const rawDateB = b.saleDate ? String(b.saleDate).trim() : '';
  const dateA = parseDateToISO(rawDateA) || rawDateA;
  const dateB = parseDateToISO(rawDateB) || rawDateB;
  if (dateA && dateB && dateA !== dateB) return false;

  // 3. Item Sold match
  const itemA = normalizeItem(a.itemSold);
  const itemB = normalizeItem(b.itemSold);
  if (itemA && itemB && itemA !== itemB) return false;

  // 4. Sale Value match (tolerance of 0.05 for rounding differences)
  const valA = Number(a.saleValue) || 0;
  const valB = Number(b.saleValue) || 0;
  if (valA > 0 && valB > 0 && Math.abs(valA - valB) > 0.05) return false;

  return true;
}

/**
 * Returns a unique identity key for a credit record.
 * Uses 4-factor digital fingerprint first whenever sale attributes are present:
 * 1. Client Name (Cliente)
 * 2. Sale Date (Fecha de Venta)
 * 3. Item Sold / Article (Artículo)
 * 4. Sale Value (Valor Venta)
 * Falls back to genuine operation number or identification.
 */
export function getRecordKey(r: { 
  operationNumber?: string; 
  identification?: string; 
  clientName?: string; 
  itemSold?: string;
  saleDate?: string;
  saleValue?: number;
}): string {
  // If sale attributes exist to construct the 4-factor fingerprint, it takes precedence
  const rawDate = r.saleDate ? String(r.saleDate).trim() : '';
  const cleanDate = (parseDateToISO(rawDate) || rawDate).trim();
  const normItem = normalizeItem(r.itemSold);
  const saleVal = (r.saleValue !== undefined && Number(r.saleValue) > 0) ? Number(r.saleValue) : 0;

  if (r.clientName && (cleanDate || normItem || saleVal > 0)) {
    return getFourFactorKey(r);
  }

  // Fallback: If a real operation number was imported (not OP-1, OP-2 or OP-AUTO-...)
  if (
    r.operationNumber &&
    r.operationNumber.trim() &&
    !r.operationNumber.startsWith('OP-AUTO-') &&
    !/^op-\d+$/i.test(r.operationNumber.trim()) &&
    !r.operationNumber.startsWith('ID-')
  ) {
    return `op:${r.operationNumber.trim().toLowerCase()}`;
  }

  // Fallback: If a real identification (Cédula/RUC) is present
  if (
    r.identification &&
    r.identification.trim() &&
    !r.identification.startsWith('ID-')
  ) {
    return `id:${r.identification.trim().toLowerCase()}`;
  }

  return `name:${normalizeText(r.clientName)}`;
}

/**
 * Builds a standardized PortfolioSnapshot from a list of records, recalculating all brackets and collector summaries.
 */
export function buildSnapshotFromRecords(
  recordsList: PortfolioClient[],
  type: 'CORTE_INICIAL' | 'CORTE_FINAL' | 'CARGA_GENERAL',
  customTitle?: string,
  cutoffDateVal?: string,
  recoveredClients?: PortfolioClient[],
  recoveredAmount?: number,
  recoveredCount?: number
): PortfolioSnapshot {
  let totalAmount = 0;

  const bracketSummary: Record<AgingBracket, BracketSummaryItem> = {
    '0': { count: 0, totalAmount: 0 },
    '1-30': { count: 0, totalAmount: 0 },
    '31-60': { count: 0, totalAmount: 0 },
    '61-90': { count: 0, totalAmount: 0 },
    '91-180': { count: 0, totalAmount: 0 },
    '>181': { count: 0, totalAmount: 0 },
    '0-30': { count: 0, totalAmount: 0 }
  };

  const collectorSummary: Record<string, CollectorSummaryItem> = {};

  recordsList.forEach(r => {
    const cleanAmount = round2(r.amount);
    totalAmount = round2(totalAmount + cleanAmount);

    const bracketKey = r.bracket || getAgingBracket(r.overdueDays);
    if (bracketSummary[bracketKey]) {
      bracketSummary[bracketKey].count += 1;
      bracketSummary[bracketKey].totalAmount = round2(bracketSummary[bracketKey].totalAmount + cleanAmount);
    }

    const colKey = r.collectorName || 'Sin Asignar';
    if (!collectorSummary[colKey]) {
      collectorSummary[colKey] = {
        collectorName: colKey,
        totalClients: 0,
        totalAmount: 0,
        brackets: {
          '0': { count: 0, totalAmount: 0 },
          '1-30': { count: 0, totalAmount: 0 },
          '31-60': { count: 0, totalAmount: 0 },
          '61-90': { count: 0, totalAmount: 0 },
          '91-180': { count: 0, totalAmount: 0 },
          '>181': { count: 0, totalAmount: 0 },
          '0-30': { count: 0, totalAmount: 0 }
        }
      };
    }

    collectorSummary[colKey].totalClients += 1;
    collectorSummary[colKey].totalAmount = round2(collectorSummary[colKey].totalAmount + cleanAmount);
    if (collectorSummary[colKey].brackets[bracketKey]) {
      collectorSummary[colKey].brackets[bracketKey].count += 1;
      collectorSummary[colKey].brackets[bracketKey].totalAmount = round2(collectorSummary[colKey].brackets[bracketKey].totalAmount + cleanAmount);
    }
  });

  // Calculate composite 0-30 bracket
  bracketSummary['0-30'] = {
    count: bracketSummary['0'].count + bracketSummary['1-30'].count,
    totalAmount: round2(bracketSummary['0'].totalAmount + bracketSummary['1-30'].totalAmount)
  };

  Object.keys(collectorSummary).forEach(k => {
    collectorSummary[k].brackets['0-30'] = {
      count: collectorSummary[k].brackets['0'].count + collectorSummary[k].brackets['1-30'].count,
      totalAmount: round2(collectorSummary[k].brackets['0'].totalAmount + collectorSummary[k].brackets['1-30'].totalAmount)
    };
  });

  return {
    enterpriseId: '',
    month: cutoffDateVal ? cutoffDateVal.substring(0, 7) : new Date().toISOString().substring(0, 7),
    cutoffDate: cutoffDateVal,
    snapshotType: type,
    title: customTitle || `Corte de Cartera - ${cutoffDateVal || 'Sin Fecha'}`,
    records: recordsList,
    totalClients: recordsList.length,
    totalAmount: round2(totalAmount),
    bracketSummary,
    collectorSummary,
    recoveredClients: recoveredClients || [],
    recoveredAmount: round2(recoveredAmount || 0),
    recoveredCount: recoveredCount || 0
  };
}

/**
 * Consolidates all snapshot records matching a specific cutoff date.
 */
export function consolidateSnapshotsForDate(snapshots: PortfolioSnapshot[], dateStr: string): PortfolioSnapshot | null {
  if (!dateStr || !snapshots || snapshots.length === 0) return null;
  const matching = snapshots.filter(s => (s.cutoffDate || `${s.month}-01`) === dateStr);
  if (matching.length === 0) return null;
  if (matching.length === 1) return matching[0];

  const recordsMap = new Map<string, PortfolioClient>();
  matching.forEach(s => {
    (s.records || []).forEach(r => {
      recordsMap.set(getRecordKey(r), r);
    });
  });

  const mergedRecords = Array.from(recordsMap.values());
  const mergedRecoveredMap = new Map<string, PortfolioClient>();
  matching.forEach(s => {
    (s.recoveredClients || []).forEach(r => {
      mergedRecoveredMap.set(getRecordKey(r), r);
    });
  });
  const mergedRecovered = Array.from(mergedRecoveredMap.values());

  return buildSnapshotFromRecords(
    mergedRecords,
    'CARGA_GENERAL',
    `Corte Consolidado - ${dateStr}`,
    dateStr,
    mergedRecovered,
    round2(mergedRecovered.reduce((acc, r) => acc + round2(r.amount), 0)),
    mergedRecovered.length
  );
}

/**
 * Finds the automatic Start of Month and End of Month snapshots.
 * Rule: Start of month = first snapshot uploaded in that month (or marked as CORTE_INICIAL).
 *       End of month = latest snapshot uploaded in that month (or marked as CORTE_FINAL).
 */
export function getMonthlyPortfolioCutoffs(
  snapshots: PortfolioSnapshot[],
  targetMonth?: string
): {
  initialSnapshot: PortfolioSnapshot | null;
  closingSnapshot: PortfolioSnapshot | null;
  initialDate: string;
  closingDate: string;
} {
  if (!snapshots || snapshots.length === 0) {
    return { initialSnapshot: null, closingSnapshot: null, initialDate: '', closingDate: '' };
  }

  // Filter snapshots belonging to target month if provided, otherwise all
  const filtered = targetMonth
    ? snapshots.filter(s => s.month === targetMonth || (s.cutoffDate && s.cutoffDate.startsWith(targetMonth)))
    : snapshots;

  const pool = filtered.length > 0 ? filtered : snapshots;

  // Extract all unique cutoff dates sorted chronologically ascending
  const datesSet = new Set<string>();
  pool.forEach(s => {
    const d = s.cutoffDate || (s.month ? `${s.month}-01` : '');
    if (d) datesSet.add(d);
  });

  const sortedDates = Array.from(datesSet).sort();
  if (sortedDates.length === 0) {
    return { initialSnapshot: null, closingSnapshot: null, initialDate: '', closingDate: '' };
  }

  // Check for explicit CORTE_INICIAL / CORTE_FINAL markers
  const explicitInitial = pool.find(s => s.snapshotType === 'CORTE_INICIAL');
  const initialDate = explicitInitial?.cutoffDate || sortedDates[0];

  const explicitClosing = pool.find(s => s.snapshotType === 'CORTE_FINAL');
  const closingDate = explicitClosing?.cutoffDate || sortedDates[sortedDates.length - 1];

  const initialSnapshot = consolidateSnapshotsForDate(pool, initialDate);
  const closingSnapshot = consolidateSnapshotsForDate(pool, closingDate);

  return {
    initialSnapshot,
    closingSnapshot,
    initialDate,
    closingDate
  };
}

export interface CollectorPortfolioEvolution {
  collectorName: string;
  initialAmount: number;
  initialClients: number;
  initialOnTimeAmount: number; // 0 and 1-30 days
  initialOverdueAmount: number; // >30 days
  initialBrackets: Record<AgingBracket, BracketSummaryItem>;

  closingAmount: number;
  closingClients: number;
  closingOnTimeAmount: number; // 0 and 1-30 days
  closingOverdueAmount: number; // >30 days
  closingBrackets: Record<AgingBracket, BracketSummaryItem>;

  variationAmount: number; // closingAmount - initialAmount
  recoveredAmount: number; // Math.max(0, initialAmount - closingAmount)
  variationPct: number;
  hasData: boolean;
  initialDate: string;
  closingDate: string;
}

/**
 * Calculates portfolio evolution for a specific collector (or global if supervisor)
 * between initial and closing snapshots.
 */
export function getCollectorPortfolioEvolution(
  initialSnapshot: PortfolioSnapshot | null,
  closingSnapshot: PortfolioSnapshot | null,
  collectorName: string,
  isSupervisor: boolean = false,
  initialDate: string = '',
  closingDate: string = ''
): CollectorPortfolioEvolution {
  const emptyBrackets = (): Record<AgingBracket, BracketSummaryItem> => ({
    '0': { count: 0, totalAmount: 0 },
    '1-30': { count: 0, totalAmount: 0 },
    '31-60': { count: 0, totalAmount: 0 },
    '61-90': { count: 0, totalAmount: 0 },
    '91-180': { count: 0, totalAmount: 0 },
    '>181': { count: 0, totalAmount: 0 },
    '0-30': { count: 0, totalAmount: 0 }
  });

  // Helper to find collector summary with case/accent tolerance
  const findCollectorData = (snap: PortfolioSnapshot | null): { totalClients: number; totalAmount: number; brackets: Record<AgingBracket, BracketSummaryItem> } | null => {
    if (!snap) return null;
    if (isSupervisor && (!snap.collectorSummary || !snap.collectorSummary[collectorName])) {
      // For supervisors without specific portfolio, return company total
      return {
        totalClients: snap.totalClients || 0,
        totalAmount: round2(snap.totalAmount || 0),
        brackets: snap.bracketSummary || emptyBrackets()
      };
    }

    if (!snap.collectorSummary) return null;
    if (snap.collectorSummary[collectorName]) {
      return snap.collectorSummary[collectorName];
    }

    const cleanTarget = collectorName.toLowerCase().trim();
    const matchKey = Object.keys(snap.collectorSummary).find(k => {
      const cleanK = k.toLowerCase().trim();
      return cleanK === cleanTarget || cleanK.includes(cleanTarget) || cleanTarget.includes(cleanK);
    });

    return matchKey ? snap.collectorSummary[matchKey] : null;
  };

  const initialData = findCollectorData(initialSnapshot);
  const closingData = findCollectorData(closingSnapshot);

  const initialAmount = round2(initialData?.totalAmount || 0);
  const initialClients = initialData?.totalClients || 0;
  const initialBrackets = initialData?.brackets || emptyBrackets();

  const initial0 = round2(initialBrackets['0']?.totalAmount || 0);
  const initial1to30 = round2(initialBrackets['1-30']?.totalAmount || 0);
  const initialOnTimeAmount = round2(initial0 + initial1to30);
  const initialOverdueAmount = round2(Math.max(0, initialAmount - initialOnTimeAmount));

  const closingAmount = round2(closingData?.totalAmount || 0);
  const closingClients = closingData?.totalClients || 0;
  const closingBrackets = closingData?.brackets || emptyBrackets();

  const closing0 = round2(closingBrackets['0']?.totalAmount || 0);
  const closing1to30 = round2(closingBrackets['1-30']?.totalAmount || 0);
  const closingOnTimeAmount = round2(closing0 + closing1to30);
  const closingOverdueAmount = round2(Math.max(0, closingAmount - closingOnTimeAmount));

  const variationAmount = round2(closingAmount - initialAmount);
  const recoveredAmount = Math.max(0, round2(initialAmount - closingAmount));
  const variationPct = initialAmount > 0 ? round2(((closingAmount - initialAmount) / initialAmount) * 100) : 0;

  const hasData = (initialData !== null && (initialAmount > 0 || initialClients > 0)) ||
                  (closingData !== null && (closingAmount > 0 || closingClients > 0));

  return {
    collectorName,
    initialAmount,
    initialClients,
    initialOnTimeAmount,
    initialOverdueAmount,
    initialBrackets,
    closingAmount,
    closingClients,
    closingOnTimeAmount,
    closingOverdueAmount,
    closingBrackets,
    variationAmount,
    recoveredAmount,
    variationPct,
    hasData,
    initialDate: initialDate || initialSnapshot?.cutoffDate || initialSnapshot?.month || '',
    closingDate: closingDate || closingSnapshot?.cutoffDate || closingSnapshot?.month || ''
  };
}

/**
 * Client Monthly Due Status & Cash Flow Analysis:
 * Separates immediate monthly cash flow collectible from long-term capital debt up to 2027.
 *
 * Identifies:
 * 1. EN_MORA: Client has overdue days > 0 and overdue amount > 0.
 * 2. CUOTA_DEL_MES: Client is up to date (0 days mora) and has an active installment due in current cycle.
 * 3. PRIMER_PAGO_FUTURO: Client is newly contracted; first payment matures in a subsequent month.
 * 4. PREPAGADO_ADELANTADO: Client has made advance payments exceeding past due obligations; 0 due this month.
 * 5. CANCELADO: Balance is 0 or less.
 */
export interface MonthlyDueEvaluation {
  status: 'EN_MORA' | 'CUOTA_DEL_MES' | 'PRIMER_PAGO_FUTURO' | 'PREPAGADO_ADELANTADO' | 'CANCELADO';
  statusLabel: string;
  monthlyDueAmount: number;    // Exactly what must be collected this month
  futureLongTermDebt: number;  // Remainder that will be paid in future months/years
  explanation: string;
}

export function parseDateSafe(dateVal: any): Date | null {
  if (!dateVal) return null;
  if (dateVal instanceof Date && !isNaN(dateVal.getTime())) return dateVal;
  if (typeof dateVal === 'number') {
    const jsDate = new Date(Math.round((dateVal - 25569) * 86400 * 1000));
    return isNaN(jsDate.getTime()) ? null : jsDate;
  }
  const str = String(dateVal).trim();
  if (!str) return null;
  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 3) {
      if (parts[2].length === 4) {
        const d = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
        if (!isNaN(d.getTime())) return d;
      }
    }
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

export function evaluateMonthlyDue(client: PortfolioClient, cutoffDateStr?: string): MonthlyDueEvaluation {
  const totalBalance = round2(Math.max(0, client.amount || 0));
  const overdueAmount = round2(Math.max(0, client.overdueAmount || 0));
  const overdueDays = client.overdueDays || 0;
  const installment = round2(Math.max(0, client.installmentAmount || 0));
  const totalPayments = round2(Math.max(0, client.totalPayments || 0));

  // Case 1: Cancelled / Fully Paid
  if (totalBalance <= 0.01) {
    return {
      status: 'CANCELADO',
      statusLabel: 'Cancelado / Saldo $0',
      monthlyDueAmount: 0,
      futureLongTermDebt: 0,
      explanation: 'El crédito no presenta saldo exigible.'
    };
  }

  // Case 2: Overdue / En Mora
  if (overdueDays > 0 && overdueAmount > 0) {
    const dueNow = Math.min(totalBalance, overdueAmount);
    const futureDebt = round2(Math.max(0, totalBalance - dueNow));
    return {
      status: 'EN_MORA',
      statusLabel: 'En Mora / Cartera Vencida',
      monthlyDueAmount: dueNow,
      futureLongTermDebt: futureDebt,
      explanation: `Presenta ${overdueDays} días de mora. Valor vencido exigible: $${dueNow.toFixed(2)}.`
    };
  }

  // Case 3: Check if client is in Grace Period / Primer Pago Futuro
  if (client.saleDate && cutoffDateStr) {
    const saleD = parseDateSafe(client.saleDate);
    const cutoffD = parseDateSafe(cutoffDateStr);

    if (saleD && cutoffD) {
      const diffMs = cutoffD.getTime() - saleD.getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays < 25 && overdueDays === 0 && overdueAmount === 0 && (totalPayments === 0 || client.pendingDownPayment)) {
        return {
          status: 'PRIMER_PAGO_FUTURO',
          statusLabel: 'Primer Pago en Mes Posterior',
          monthlyDueAmount: 0,
          futureLongTermDebt: totalBalance,
          explanation: `Venta reciente (${client.saleDate}). Su primera cuota vence en el siguiente periodo.`
        };
      }
    }
  }

  // Case 4: Check if client is Prepaid / Pagos Adelantados
  if (overdueDays === 0 && overdueAmount === 0 && installment > 0) {
    const notesLower = (client.notes || '').toLowerCase();
    if (notesLower.includes('adelanto') || notesLower.includes('prepago') || notesLower.includes('adelantado')) {
      return {
        status: 'PREPAGADO_ADELANTADO',
        statusLabel: 'Pagos Adelantados / Al Día',
        monthlyDueAmount: 0,
        futureLongTermDebt: totalBalance,
        explanation: 'Cliente adelantó cuotas previamente; no tiene cuota exigible en este corte.'
      };
    }

    // Standard Case 5: Normal Active Client with Monthly Installment Due
    const dueNow = Math.min(totalBalance, installment > 0 ? installment : totalBalance);
    const futureDebt = round2(Math.max(0, totalBalance - dueNow));
    return {
      status: 'CUOTA_DEL_MES',
      statusLabel: 'Al Día - Cuota Corriente del Mes',
      monthlyDueAmount: dueNow,
      futureLongTermDebt: futureDebt,
      explanation: `Al día (0 días mora). Cuota ordinaria del mes: $${dueNow.toFixed(2)}.`
    };
  }

  // Fallback
  const dueNow = overdueAmount > 0 ? overdueAmount : (installment > 0 ? Math.min(totalBalance, installment) : totalBalance);
  const futureDebt = round2(Math.max(0, totalBalance - dueNow));
  return {
    status: 'CUOTA_DEL_MES',
    statusLabel: 'Al Día',
    monthlyDueAmount: dueNow,
    futureLongTermDebt: futureDebt,
    explanation: 'Crédito al día.'
  };
}

/**
 * Computes aggregate Monthly Cash-flow Summary for a group of portfolio clients.
 */
export interface MonthlyCashFlowSummary {
  totalPortfolioBalance: number;     // Grand total debt (to 2027)
  monthlyCollectableTarget: number;  // Real operational goal for the month (Overdue + Current Due)
  overdueArrearsTarget: number;      // Due from overdue customers
  currentInstallmentTarget: number;  // Due from up-to-date customers in current cycle
  longTermFutureDebt: number;        // Capital due in 2026/2027 and beyond
  clientsInArrearsCount: number;
  clientsCurrentCycleCount: number;
  clientsFutureGraceCount: number;
  clientsPrepaidCount: number;
}

export function calculateMonthlyCashFlowSummary(
  clients: PortfolioClient[],
  cutoffDateStr?: string
): MonthlyCashFlowSummary {
  let totalPortfolioBalance = 0;
  let overdueArrearsTarget = 0;
  let currentInstallmentTarget = 0;
  let longTermFutureDebt = 0;
  let clientsInArrearsCount = 0;
  let clientsCurrentCycleCount = 0;
  let clientsFutureGraceCount = 0;
  let clientsPrepaidCount = 0;

  clients.forEach(c => {
    const evalResult = evaluateMonthlyDue(c, cutoffDateStr);
    const bal = round2(Math.max(0, c.amount || 0));
    totalPortfolioBalance += bal;

    if (evalResult.status === 'EN_MORA') {
      overdueArrearsTarget += evalResult.monthlyDueAmount;
      longTermFutureDebt += evalResult.futureLongTermDebt;
      clientsInArrearsCount++;
    } else if (evalResult.status === 'CUOTA_DEL_MES') {
      currentInstallmentTarget += evalResult.monthlyDueAmount;
      longTermFutureDebt += evalResult.futureLongTermDebt;
      clientsCurrentCycleCount++;
    } else if (evalResult.status === 'PRIMER_PAGO_FUTURO') {
      longTermFutureDebt += evalResult.futureLongTermDebt;
      clientsFutureGraceCount++;
    } else if (evalResult.status === 'PREPAGADO_ADELANTADO') {
      longTermFutureDebt += evalResult.futureLongTermDebt;
      clientsPrepaidCount++;
    }
  });

  return {
    totalPortfolioBalance: round2(totalPortfolioBalance),
    monthlyCollectableTarget: round2(overdueArrearsTarget + currentInstallmentTarget),
    overdueArrearsTarget: round2(overdueArrearsTarget),
    currentInstallmentTarget: round2(currentInstallmentTarget),
    longTermFutureDebt: round2(longTermFutureDebt),
    clientsInArrearsCount,
    clientsCurrentCycleCount,
    clientsFutureGraceCount,
    clientsPrepaidCount
  };
}

