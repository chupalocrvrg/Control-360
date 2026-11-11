import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

export const duplicateDetection = {
  checkContadoSale: async (saleData: any) => {
    // Criterios: totalValue, clientName, employeeId, date
    const q = query(
      collection(db, 'sales'),
      where('totalValue', '==', saleData.totalValue),
      where('clientName', '==', saleData.clientName),
      where('employeeId', '==', saleData.employeeId),
      where('date', '==', saleData.date)
    );
    const snap = await getDocs(q);
    return !snap.empty;
  },

  checkCreditSale: async (saleData: any) => {
    // Criterios: grossTotal, clientName, sellerId, saleDate
    const q = query(
      collection(db, 'credit_sales'),
      where('grossTotal', '==', saleData.grossTotal),
      where('clientName', '==', saleData.clientName),
      where('sellerId', '==', saleData.sellerId),
      where('saleDate', '==', saleData.saleDate)
    );
    const snap = await getDocs(q);
    return !snap.empty;
  },

  checkCheck: async (checkData: any) => {
    // Criterios: beneficiaryName, amount, dueDate
    const q = query(
      collection(db, 'checks'),
      where('beneficiaryName', '==', checkData.beneficiaryName),
      where('amount', '==', checkData.amount),
      where('dueDate', '==', checkData.dueDate)
    );
    const snap = await getDocs(q);
    return !snap.empty;
  },

  checkCollection: async (colData: any) => {
    // Criterios: amount, reciboNumber, createdBy, date
    const q = query(
      collection(db, 'collections'),
      where('amount', '==', colData.amount),
      where('reciboNumber', '==', colData.reciboNumber),
      where('createdBy', '==', colData.createdBy),
      where('date', '==', colData.date)
    );
    const snap = await getDocs(q);
    return !snap.empty;
  }
};
