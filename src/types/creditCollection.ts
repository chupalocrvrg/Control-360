import { CreditSale, CreditInstallment } from './creditSale';

export type CreditRiskCategory = 'A' | 'B' | 'C' | 'D' | 'E';

export type CollectionContactType = 
  | 'WHATSAPP' 
  | 'LLAMADA' 
  | 'VISITA' 
  | 'NOTIFICACION_ESCRITA' 
  | 'JUDICIAL';

export type CollectionContactTarget = 
  | 'DEUDOR' 
  | 'GARANTE' 
  | 'CONYUGE' 
  | 'REFERENCIA';

export type CollectionOutcome = 
  | 'COMPROMISO_PAGO' 
  | 'PAGO_CONFIRMADO' 
  | 'NO_CONTESTA' 
  | 'NUMERO_EQUIVOCADO' 
  | 'ILOCALIZABLE' 
  | 'DISPUTA' 
  | 'SOLICITA_REFINANCIAMIENTO';

export interface CreditCollectionLog {
  id: string;
  enterpriseId: string;
  creditSaleId: string;
  clientId: string;
  clientName: string;
  promissoryNoteNumber: string;
  contactType: CollectionContactType;
  contactTarget: CollectionContactTarget;
  targetName: string;
  targetPhone: string;
  outcome: CollectionOutcome;
  notes: string;
  promiseDate?: string; // YYYY-MM-DD
  promiseAmount?: number;
  isPromiseFulfilled?: boolean;
  createdAt: string;
  createdBy: string;
  createdByName?: string;
}

export interface CreditRiskMetrics {
  overdueDays: number;
  overdueInstallmentsCount: number;
  overdueAmount: number;
  totalRemainingBalance: number;
  riskCategory: CreditRiskCategory;
  riskLabel: string;
  riskBadgeClass: string;
  isOverdue: boolean;
  isUpcomingDue: boolean;
  earliestOverdueDueDate: string | null;
  nextInstallmentDueDate: string | null;
  nextInstallmentAmount: number;
}

/**
 * Calculates days difference between two YYYY-MM-DD date strings
 */
export function getDaysDiff(dateStr1: string, dateStr2: string): number {
  const d1 = new Date(dateStr1 + 'T00:00:00');
  const d2 = new Date(dateStr2 + 'T00:00:00');
  const diffTime = d2.getTime() - d1.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Evaluates the aging, overdue amount and risk category (A, B, C, D, E) for a credit sale
 */
export function calculateCreditRiskAndAging(credit: CreditSale, referenceDate?: string): CreditRiskMetrics {
  const today = referenceDate || new Date().toISOString().split('T')[0];
  const installments: CreditInstallment[] = credit.installments || [];

  if (credit.status === 'LIQUIDADO' || credit.status === 'ANULADO') {
    return {
      overdueDays: 0,
      overdueInstallmentsCount: 0,
      overdueAmount: 0,
      totalRemainingBalance: 0,
      riskCategory: 'A',
      riskLabel: credit.status === 'LIQUIDADO' ? 'Cancelado / Al Día' : 'Anulado',
      riskBadgeClass: 'bg-neutral-100 text-neutral-600 border-neutral-300 dark:bg-neutral-800 dark:text-neutral-400',
      isOverdue: false,
      isUpcomingDue: false,
      earliestOverdueDueDate: null,
      nextInstallmentDueDate: null,
      nextInstallmentAmount: 0
    };
  }

  const unpaid = installments.filter(inst => inst.status !== 'PAGADO');
  const overdueInsts = unpaid.filter(inst => inst.dueDate < today);

  let overdueDays = 0;
  let earliestOverdueDueDate: string | null = null;

  if (overdueInsts.length > 0) {
    // Sort by due date ascending
    overdueInsts.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    earliestOverdueDueDate = overdueInsts[0].dueDate;
    overdueDays = Math.max(0, getDaysDiff(earliestOverdueDueDate, today));
  }

  // Calculate overdue amount
  const overdueAmount = overdueInsts.reduce((sum, inst) => {
    const paid = inst.paidAmount || 0;
    return sum + Math.max(0, inst.amount - paid);
  }, 0);

  // Next upcoming installment
  const futureOrCurrentUnpaid = unpaid.filter(inst => inst.dueDate >= today).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const nextInstallment = futureOrCurrentUnpaid[0] || null;
  const nextInstallmentDueDate = nextInstallment?.dueDate || null;
  const nextInstallmentAmount = nextInstallment ? Math.max(0, nextInstallment.amount - (nextInstallment.paidAmount || 0)) : 0;

  // Is upcoming due in next 5 days
  let isUpcomingDue = false;
  if (nextInstallmentDueDate && overdueDays === 0) {
    const daysToDue = getDaysDiff(today, nextInstallmentDueDate);
    if (daysToDue >= 0 && daysToDue <= 5) {
      isUpcomingDue = true;
    }
  }

  // Categorize Risk Category according to Superintendencia / Equifax standards:
  // A: 0 - 30 días (Riesgo Normal)
  // B: 31 - 60 días (Riesgo Potencial)
  // C: 61 - 90 días (Riesgo Deficiente)
  // D: 91 - 120 días (Difícil Cobro)
  // E: > 120 días (Castigada / Irrecuperable)
  let riskCategory: CreditRiskCategory = 'A';
  let riskLabel = 'Categoría A • Normal';
  let riskBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800';

  if (overdueDays > 120) {
    riskCategory = 'E';
    riskLabel = 'Categoría E • Castigada (>120d)';
    riskBadgeClass = 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800';
  } else if (overdueDays > 90) {
    riskCategory = 'D';
    riskLabel = 'Categoría D • Difícil Cobro (91-120d)';
    riskBadgeClass = 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800';
  } else if (overdueDays > 60) {
    riskCategory = 'C';
    riskLabel = 'Categoría C • Deficiente (61-90d)';
    riskBadgeClass = 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-800';
  } else if (overdueDays > 30) {
    riskCategory = 'B';
    riskLabel = 'Categoría B • Potencial (31-60d)';
    riskBadgeClass = 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800';
  } else if (overdueDays > 0) {
    riskCategory = 'A';
    riskLabel = `Categoría A • Mora Temprana (${overdueDays}d)`;
    riskBadgeClass = 'bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-300 dark:border-yellow-800';
  } else if (isUpcomingDue) {
    riskCategory = 'A';
    riskLabel = 'Categoría A • Próximo a Vencer';
    riskBadgeClass = 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800';
  }

  const totalRemainingBalance = credit.remainingBalance ?? (credit.netFinancedAmount || 0);

  return {
    overdueDays,
    overdueInstallmentsCount: overdueInsts.length,
    overdueAmount,
    totalRemainingBalance,
    riskCategory,
    riskLabel,
    riskBadgeClass,
    isOverdue: overdueDays > 0,
    isUpcomingDue,
    earliestOverdueDueDate,
    nextInstallmentDueDate,
    nextInstallmentAmount
  };
}
