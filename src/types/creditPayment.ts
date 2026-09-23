export type CreditPaymentMethod = 'EFECTIVO' | 'TRANSFERENCIA' | 'DEPOSITO' | 'CHEQUE' | 'TARJETA' | 'OTRO';

export interface CreditPaymentInstallmentAllocation {
  installmentNumber: number;
  dueDate: string;
  amountApplied: number;
  previousBalance: number;
  remainingBalance: number;
  isFullyPaid: boolean;
}

export interface CreditPayment {
  id: string;
  enterpriseId: string;
  receiptNumber: string; // ej: REC-2026-0001
  creditSaleId: string;
  promissoryNoteNumber: string;
  
  // Cliente
  clientId: string;
  clientName: string;
  clientIdCard: string;
  clientPhone?: string;
  clientAddress?: string;

  // Detalles de la transacción
  paymentDate: string; // YYYY-MM-DD
  paymentTime?: string; // HH:mm
  paymentMethod: CreditPaymentMethod;
  isTransfer?: boolean;
  bankName?: string;
  referenceNumber?: string; // Número de comprobante / transferencia / cheque
  totalAmountPaid: number;
  
  // Liquidación anticipada (si aplica)
  isEarlySettlement?: boolean;
  discountApplied?: number;
  settlementDescription?: string;

  // Desglose de cuotas
  allocations: CreditPaymentInstallmentAllocation[];

  // Estados financieros resultantes
  previousCreditBalance: number;
  newCreditBalance: number;
  previousClientCreditUsed: number;
  newClientCreditUsed: number;

  // Recaudador / Cobrador
  collectorId: string;
  collectorName: string;

  notes?: string;
  status: 'VALID' | 'ANULADO';
  createdAt: string;
  createdBy: string;
}
