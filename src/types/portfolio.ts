export type AgingBracket = '0' | '1-30' | '31-60' | '61-90' | '91-180' | '>181' | '0-30';

export interface PortfolioClient {
  id: string;
  clientName: string;
  identification?: string;
  operationNumber?: string;
  collectorName: string;
  amount: number;
  overdueDays: number;
  overdueAmount?: number;
  previousOverdueAmount?: number;
  bracket: AgingBracket;
  phone?: string;
  itemSold?: string;
  address?: string;
  saleDate?: string;
  lastPaymentDate?: string;
  lastPaymentAmount?: number;
  installmentAmount?: number;
  pendingDownPayment?: number;
  totalPayments?: number;
  saleValue?: number;
  installmentNumber?: string | number;
  // Real monthly cash-flow attributes
  monthlyDueStatus?: 'EN_MORA' | 'CUOTA_DEL_MES' | 'PRIMER_PAGO_FUTURO' | 'PREPAGADO_ADELANTADO' | 'CANCELADO';
  monthlyDueAmount?: number;
  futureLongTermDebt?: number;
  previousAmount?: number;
  previousOverdueDays?: number;
  isPartialPayment?: boolean;
  isUnassigned?: boolean;
  recoveredStatus?: 'LIQUIDACION_TOTAL' | 'AL_DIA' | 'ABONO_PARCIAL';
  notes?: string;
}

export interface BracketSummaryItem {
  count: number;
  totalAmount: number;
}

export interface CollectorSummaryItem {
  collectorName: string;
  totalClients: number;
  totalAmount: number;
  brackets: Record<AgingBracket, BracketSummaryItem>;
}

export interface PortfolioSnapshot {
  id?: string;
  enterpriseId: string;
  month: string; // YYYY-MM
  cutoffDate?: string; // YYYY-MM-DD exact cutoff date
  snapshotType: 'CORTE_INICIAL' | 'CORTE_FINAL' | 'CARGA_GENERAL' | 'CARTERA_MAESTRA';
  isMasterPortfolio?: boolean;
  hasChunks?: boolean;
  chunkCount?: number;
  title: string;
  records: PortfolioClient[];
  totalClients: number;
  totalAmount: number;
  bracketSummary: Record<AgingBracket, BracketSummaryItem>;
  collectorSummary: Record<string, CollectorSummaryItem>;
  // Comparison & Recovery tracking
  recoveredClients?: PortfolioClient[];
  recoveredAmount?: number;
  recoveredCount?: number;
  newClients?: PortfolioClient[];
  newAmount?: number;
  newCount?: number;
  previousSnapshotId?: string | null;
  collectorName?: string | null; // Optional if this snapshot belongs to a specific collector
  createdAt?: any;
  updatedAt?: any;
}

export const AGING_BRACKETS: { key: AgingBracket; label: string; min: number; max: number; colorClass: string; badgeBg: string; isZeroOverdue?: boolean }[] = [
  { key: '0', label: 'Al Día / Por Vencer (0 Días)', min: 0, max: 0, colorClass: 'text-blue-600 dark:text-blue-400', badgeBg: 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800', isZeroOverdue: true },
  { key: '1-30', label: '1 a 30 Días (Temprana)', min: 1, max: 30, colorClass: 'text-emerald-600 dark:text-emerald-400', badgeBg: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800' },
  { key: '31-60', label: '31 a 60 Días (Preventiva)', min: 31, max: 60, colorClass: 'text-amber-600 dark:text-amber-400', badgeBg: 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800' },
  { key: '61-90', label: '61 a 90 Días (Vencida)', min: 61, max: 90, colorClass: 'text-orange-600 dark:text-orange-400', badgeBg: 'bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-800' },
  { key: '91-180', label: '91 a 180 Días (Crítica)', min: 91, max: 180, colorClass: 'text-rose-600 dark:text-rose-400', badgeBg: 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800' },
  { key: '>181', label: 'Mayor a 181 Días (Castigada)', min: 181, max: 99999, colorClass: 'text-purple-600 dark:text-purple-400', badgeBg: 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-800' },
];

export function getAgingBracket(days: number): AgingBracket {
  const d = Math.max(0, Math.floor(days || 0));
  if (d === 0) return '0';
  if (d <= 30) return '1-30';
  if (d <= 60) return '31-60';
  if (d <= 90) return '61-90';
  if (d <= 180) return '91-180';
  return '>181';
}
