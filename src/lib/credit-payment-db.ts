import { db } from '../firebase';
import {
  collection,
  doc,
  runTransaction,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  Timestamp
} from 'firebase/firestore';
import { CreditPayment, CreditPaymentInstallmentAllocation } from '../types/creditPayment';
import { CreditSale, CreditInstallment } from '../types/creditSale';

export interface ExecutePaymentInput {
  creditSaleId: string;
  paymentMethod: any;
  isTransfer?: boolean;
  bankName?: string;
  referenceNumber?: string;
  totalAmountPaid: number;
  paymentDate: string;
  collectorId: string;
  collectorName: string;
  isEarlySettlement?: boolean;
  discountApplied?: number;
  settlementDescription?: string;
  allocations: CreditPaymentInstallmentAllocation[];
  notes?: string;
}

/**
 * Generates the next sequential Receipt Number (REC-YYYY-XXXXX) for an enterprise.
 */
export async function getNextReceiptNumber(enterpriseId: string): Promise<string> {
  const currentYear = new Date().getFullYear();
  const prefix = `REC-${currentYear}-`;

  try {
    const q = query(
      collection(db, 'credit_payments'),
      where('enterpriseId', '==', enterpriseId),
      orderBy('receiptNumber', 'desc'),
      limit(1)
    );
    const snap = await getDocs(q);

    if (!snap.empty) {
      const lastRec = snap.docs[0].data().receiptNumber || '';
      if (lastRec.startsWith(prefix)) {
        const numPart = parseInt(lastRec.replace(prefix, ''), 10);
        if (!isNaN(numPart)) {
          const next = numPart + 1;
          return `${prefix}${String(next).padStart(5, '0')}`;
        }
      }
    }
  } catch (err) {
    console.warn('Fallback generating receipt number:', err);
  }

  // Fallback random / timestamp sequential
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}${String(randomSuffix).padStart(5, '0')}`;
}

/**
 * Atomically executes a Credit Payment:
 * 1. Updates Credit Sale installments, totalPaid, and remainingBalance.
 * 2. Deducts Client's creditUsed (libera cupo).
 * 3. Creates the Credit Payment receipt document.
 */
export async function executeCreditPaymentTransaction(
  enterpriseId: string,
  userId: string,
  input: ExecutePaymentInput
): Promise<CreditPayment> {
  const receiptNumber = await getNextReceiptNumber(enterpriseId);
  let createdPayment: CreditPayment | null = null;

  await runTransaction(db, async (transaction) => {
    // 1. Read Credit Sale
    const creditSaleRef = doc(db, 'credit_sales', input.creditSaleId);
    const creditSnap = await transaction.get(creditSaleRef);
    if (!creditSnap.exists()) {
      throw new Error('El crédito seleccionado no existe.');
    }
    const creditData = creditSnap.data() as CreditSale;

    if (creditData.status === 'ANULADO') {
      throw new Error('No se pueden registrar pagos a un crédito anulado.');
    }

    // 2. Read Client
    const clientRef = doc(db, 'clients', creditData.clientId);
    const clientSnap = await transaction.get(clientRef);
    if (!clientSnap.exists()) {
      throw new Error('El cliente asociado no existe en el catálogo.');
    }
    const clientData = clientSnap.data();

    // 3. Calculate installment updates
    const updatedInstallments: CreditInstallment[] = (creditData.installments || []).map((inst) => {
      const allocation = input.allocations.find((a) => a.installmentNumber === inst.number);
      if (!allocation) {
        if (input.isEarlySettlement) {
          // If early settlement, mark all as paid/settled
          return {
            ...inst,
            status: 'PAGADO',
            paidAmount: inst.amount,
            paidDate: input.paymentDate
          };
        }
        return { ...inst };
      }

      const currentPaid = inst.paidAmount || 0;
      const newPaid = currentPaid + allocation.amountApplied;
      const isComplete = newPaid >= inst.amount - 0.01;

      return {
        ...inst,
        paidAmount: Math.min(inst.amount, Number(newPaid.toFixed(2))),
        paidDate: input.paymentDate,
        status: isComplete ? 'PAGADO' : (newPaid > 0 ? 'PARCIAL' : inst.status)
      };
    });

    const previousBalance = creditData.remainingBalance ?? (creditData.netFinancedAmount || 0);
    let newBalance = 0;
    let newStatus: 'ACTIVO' | 'LIQUIDADO' = 'ACTIVO';

    if (input.isEarlySettlement) {
      newBalance = 0;
      newStatus = 'LIQUIDADO';
    } else {
      newBalance = Math.max(0, Number((previousBalance - input.totalAmountPaid).toFixed(2)));
      if (newBalance <= 0.01) {
        newBalance = 0;
        newStatus = 'LIQUIDADO';
      }
    }

    const newTotalPaid = Number(((creditData.totalPaid || 0) + input.totalAmountPaid).toFixed(2));

    // Update credit sale
    transaction.update(creditSaleRef, {
      installments: updatedInstallments,
      totalPaid: newTotalPaid,
      remainingBalance: newBalance,
      status: newStatus,
      updatedAt: new Date().toISOString()
    });

    // 4. Update Client creditUsed (Libera cupo disponible)
    const prevCreditUsed = clientData.creditUsed || 0;
    // We reduce the used credit by the amount paid plus any early settlement discount
    const principalRelief = input.totalAmountPaid + (input.discountApplied || 0);
    const newCreditUsed = Math.max(0, Number((prevCreditUsed - principalRelief).toFixed(2)));

    transaction.update(clientRef, {
      creditUsed: newCreditUsed,
      updatedAt: new Date().toISOString()
    });

    // 5. Create Payment Receipt in 'credit_payments'
    const paymentDocRef = doc(collection(db, 'credit_payments'));
    const paymentRecord: CreditPayment = {
      id: paymentDocRef.id,
      enterpriseId,
      receiptNumber,
      creditSaleId: input.creditSaleId,
      promissoryNoteNumber: creditData.promissoryNoteNumber || '',
      clientId: creditData.clientId,
      clientName: creditData.clientName,
      clientIdCard: creditData.clientIdCard,
      clientPhone: creditData.clientPhone,
      clientAddress: creditData.clientAddress,
      paymentDate: input.paymentDate,
      paymentTime: new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }),
      paymentMethod: input.paymentMethod,
      isTransfer: !!input.isTransfer,
      bankName: input.bankName || '',
      referenceNumber: input.referenceNumber || '',
      totalAmountPaid: input.totalAmountPaid,
      isEarlySettlement: !!input.isEarlySettlement,
      discountApplied: input.discountApplied || 0,
      settlementDescription: input.settlementDescription || '',
      allocations: input.allocations,
      previousCreditBalance: previousBalance,
      newCreditBalance: newBalance,
      previousClientCreditUsed: prevCreditUsed,
      newClientCreditUsed: newCreditUsed,
      collectorId: input.collectorId,
      collectorName: input.collectorName,
      notes: input.notes || '',
      status: 'VALID',
      createdAt: new Date().toISOString(),
      createdBy: userId
    };

    transaction.set(paymentDocRef, paymentRecord);
    createdPayment = paymentRecord;
  });

  if (!createdPayment) {
    throw new Error('Error al procesar la transacción de cobro.');
  }

  return createdPayment;
}

/**
 * Updates editable fields of a credit payment (notes, reference, paymentMethod, bankName, collector)
 * or if totalAmountPaid was updated, safely adjusts balances if possible.
 */
export async function updateCreditPayment(
  paymentId: string,
  updates: {
    notes?: string;
    referenceNumber?: string;
    paymentMethod?: any;
    isTransfer?: boolean;
    bankName?: string;
    collectorId?: string;
    collectorName?: string;
    paymentDate?: string;
  }
) {
  const paymentRef = doc(db, 'credit_payments', paymentId);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(paymentRef);
    if (!snap.exists()) {
      throw new Error('El comprobante de cobro no existe.');
    }
    const data = snap.data();
    if (data.status === 'ANULADO') {
      throw new Error('No se puede editar un cobro que ha sido anulado.');
    }

    transaction.update(paymentRef, {
      ...updates,
      updatedAt: new Date().toISOString()
    });
  });
}

/**
 * Reverts / Anula un pago de crédito en caso de error administrativo.
 * Restaura el cupo del cliente y los saldos de las cuotas del crédito.
 */
export async function revertCreditPaymentTransaction(
  enterpriseId: string,
  userId: string,
  paymentId: string
) {
  await runTransaction(db, async (transaction) => {
    const paymentRef = doc(db, 'credit_payments', paymentId);
    const paymentSnap = await transaction.get(paymentRef);
    if (!paymentSnap.exists()) {
      throw new Error('El comprobante de pago no existe.');
    }
    const paymentData = paymentSnap.data() as CreditPayment;
    if (paymentData.status === 'ANULADO') {
      throw new Error('Este pago ya fue anulado previamente.');
    }

    const creditSaleRef = doc(db, 'credit_sales', paymentData.creditSaleId);
    const creditSnap = await transaction.get(creditSaleRef);
    if (!creditSnap.exists()) {
      throw new Error('El crédito asociado no fue encontrado.');
    }
    const creditData = creditSnap.data() as CreditSale;

    const clientRef = doc(db, 'clients', paymentData.clientId);
    const clientSnap = await transaction.get(clientRef);
    if (!clientSnap.exists()) {
      throw new Error('El cliente asociado no fue encontrado.');
    }
    const clientData = clientSnap.data();

    // Revert allocations from installments
    const restoredInstallments: CreditInstallment[] = (creditData.installments || []).map((inst) => {
      const alloc = paymentData.allocations.find((a) => a.installmentNumber === inst.number);
      if (!alloc) return { ...inst };

      const curPaid = inst.paidAmount || 0;
      const restoredPaid = Math.max(0, Number((curPaid - alloc.amountApplied).toFixed(2)));
      const todayStr = new Date().toISOString().split('T')[0];
      const isOverdue = inst.dueDate < todayStr;
      return {
        ...inst,
        paidAmount: restoredPaid,
        status: restoredPaid <= 0 ? (isOverdue ? 'VENCIDO' : 'PENDIENTE') : 'PARCIAL'
      };
    });

    const restoredRemaining = Number(((creditData.remainingBalance || 0) + paymentData.totalAmountPaid).toFixed(2));
    const restoredTotalPaid = Math.max(0, Number(((creditData.totalPaid || 0) - paymentData.totalAmountPaid).toFixed(2)));

    transaction.update(creditSaleRef, {
      installments: restoredInstallments,
      remainingBalance: restoredRemaining,
      totalPaid: restoredTotalPaid,
      status: 'ACTIVO',
      updatedAt: new Date().toISOString()
    });

    // Restore Client creditUsed
    const relief = paymentData.totalAmountPaid + (paymentData.discountApplied || 0);
    const restoredCreditUsed = Number(((clientData.creditUsed || 0) + relief).toFixed(2));

    transaction.update(clientRef, {
      creditUsed: restoredCreditUsed,
      updatedAt: new Date().toISOString()
    });

    // Mark payment as ANULADO
    transaction.update(paymentRef, {
      status: 'ANULADO',
      updatedAt: new Date().toISOString(),
      annulledBy: userId,
      annulledAt: new Date().toISOString()
    });
  });
}
