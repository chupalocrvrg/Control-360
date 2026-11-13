import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from './firestore-errors';

export const duplicateDetection = {
  checkContadoSale: async (saleData: {
    enterpriseId?: string;
    totalValue: number;
    clientName?: string;
    employeeId?: string;
    date: string;
    excludeId?: string;
  }) => {
    // Criterios: totalValue, clientName, employeeId, date
    const q = saleData.enterpriseId
      ? query(collection(db, 'sales'), where('enterpriseId', '==', saleData.enterpriseId))
      : query(collection(db, 'sales'), where('date', '==', saleData.date));

    try {
      const snap = await getDocs(q);
      const targetClient = String(saleData.clientName || '').trim().toUpperCase();
      return snap.docs.some((doc) => {
        if (saleData.excludeId && doc.id === saleData.excludeId) return false;
        const data = doc.data();
        return (
          Math.abs(Number(data.totalValue || 0) - Number(saleData.totalValue || 0)) < 0.001 &&
          String(data.clientName || '').trim().toUpperCase() === targetClient &&
          data.employeeId === saleData.employeeId &&
          data.date === saleData.date
        );
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'sales');
      throw error;
    }
  },

  checkCreditSale: async (saleData: {
    enterpriseId?: string;
    grossTotal?: number;
    clientName?: string;
    sellerId?: string;
    saleDate?: string;
    excludeId?: string;
  }) => {
    // Criterios: grossTotal, clientName, sellerId, saleDate
    const q = saleData.enterpriseId
      ? query(collection(db, 'credit_sales'), where('enterpriseId', '==', saleData.enterpriseId))
      : query(collection(db, 'credit_sales'), where('saleDate', '==', saleData.saleDate || ''));

    try {
      const snap = await getDocs(q);
      const targetClient = String(saleData.clientName || '').trim().toUpperCase();
      return snap.docs.some((doc) => {
        if (saleData.excludeId && doc.id === saleData.excludeId) return false;
        const data = doc.data();
        return (
          Math.abs(Number(data.grossTotal || 0) - Number(saleData.grossTotal || 0)) < 0.001 &&
          String(data.clientName || '').trim().toUpperCase() === targetClient &&
          data.sellerId === saleData.sellerId &&
          data.saleDate === saleData.saleDate
        );
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'credit_sales');
      throw error;
    }
  },

  checkCheck: async (checkData: {
    enterpriseId?: string;
    beneficiaryName: string;
    amount: number;
    dueDate: string;
    excludeId?: string;
  }) => {
    // Criterios: beneficiaryName, amount, dueDate
    const q = checkData.enterpriseId
      ? query(collection(db, 'checks'), where('enterpriseId', '==', checkData.enterpriseId))
      : query(collection(db, 'checks'), where('dueDate', '==', checkData.dueDate));

    try {
      const snap = await getDocs(q);
      const targetBeneficiary = String(checkData.beneficiaryName || '').trim().toUpperCase();
      return snap.docs.some((doc) => {
        if (checkData.excludeId && doc.id === checkData.excludeId) return false;
        const data = doc.data();
        return (
          String(data.beneficiaryName || '').trim().toUpperCase() === targetBeneficiary &&
          Math.abs(Number(data.amount || 0) - Number(checkData.amount || 0)) < 0.001 &&
          data.dueDate === checkData.dueDate
        );
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'checks');
      throw error;
    }
  },

  checkCollection: async (colData: {
    enterpriseId?: string;
    employeeId: string;
    initialReceipt: string;
    initialDate: string;
    totalCollected: number;
    excludeId?: string;
  }) => {
    // Criterios: Cobrador (employeeId) + Recibo Inicial (mayúsculas) + Fecha Inicial (initialDate) + Total Cobrado (totalCollected)
    const normalizedTargetReceipt = String(colData.initialReceipt || '').trim().toUpperCase();
    if (!normalizedTargetReceipt) return false;

    const q = colData.enterpriseId
      ? query(collection(db, 'collections'), where('enterpriseId', '==', colData.enterpriseId))
      : query(collection(db, 'collections'), where('initialDate', '==', colData.initialDate));

    try {
      const snap = await getDocs(q);
      return snap.docs.some((doc) => {
        if (colData.excludeId && doc.id === colData.excludeId) return false;
        const data = doc.data();
        const docReceipt = String(data.initialReceipt || '').trim().toUpperCase();
        return (
          data.employeeId === colData.employeeId &&
          docReceipt === normalizedTargetReceipt &&
          data.initialDate === colData.initialDate &&
          Math.abs(Number(data.totalCollected || 0) - Number(colData.totalCollected || 0)) < 0.001
        );
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'collections');
      throw error;
    }
  }
};
