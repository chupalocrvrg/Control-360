import * as XLSX from 'xlsx';
import { CreditSale } from '../types/creditSale';
import { calculateCreditRiskAndAging } from '../types/creditCollection';
import { format } from 'date-fns';

/**
 * Exports credit portfolio and delinquency aging to an Excel file (.xlsx)
 * structured for internal management and Credit Bureau (Buró de Crédito / Equifax) reporting.
 */
export function exportCreditPortfolioToExcel(credits: CreditSale[], enterpriseName = 'Control Financiero') {
  const rows = credits.map((c) => {
    const metrics = calculateCreditRiskAndAging(c);
    const unpaidCount = (c.installments || []).filter(i => i.status !== 'PAGADO').length;
    const paidCount = (c.installments || []).filter(i => i.status === 'PAGADO').length;

    return {
      'Cédula / RUC': c.clientIdCard,
      'Apellidos y Nombres': c.clientName,
      'Teléfono': c.clientPhone || '',
      'Ciudad': c.clientCity || '',
      'Dirección': c.clientAddress || '',
      'N° Operación / Pagaré': c.promissoryNoteNumber,
      'Fecha Venta': c.createdAt ? c.createdAt.split('T')[0] : (c.saleDate || ''),
      'Artículos': (c.items || []).map(i => i.articleName).join(', ') || c.article || '',
      'Total Venta ($)': c.grossTotal || c.netFinancedAmount || 0,
      'Entrada / Inicial ($)': c.downPayment || 0,
      'Saldo Financiado ($)': c.netFinancedAmount || 0,
      'Total Abonado ($)': c.totalPaid || 0,
      'Saldo Pendiente Actual ($)': c.remainingBalance ?? (c.netFinancedAmount || 0),
      'Total Cuotas': c.installmentsCount || (c.installments || []).length,
      'Cuotas Pagadas': paidCount,
      'Cuotas Vencidas': metrics.overdueInstallmentsCount,
      'Cuotas Pendientes': unpaidCount,
      'Monto en Mora ($)': metrics.overdueAmount,
      'Días de Atraso / Mora': metrics.overdueDays,
      'Categoría de Riesgo': metrics.riskCategory,
      'Calificación Buró': metrics.riskLabel,
      'Próxima Fecha de Pago': metrics.nextInstallmentDueDate || metrics.earliestOverdueDueDate || '',
      'Garante Solidario': c.guarantorName || 'N/A',
      'Cédula Garante': c.guarantorIdCard || '',
      'Teléfono Garante': c.guarantorPhone || '',
      'Estado del Crédito': c.status
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Set column widths
  worksheet['!cols'] = [
    { wch: 14 }, // Cedula
    { wch: 28 }, // Nombres
    { wch: 14 }, // Telefono
    { wch: 15 }, // Ciudad
    { wch: 25 }, // Direccion
    { wch: 16 }, // Pagare
    { wch: 12 }, // Fecha
    { wch: 25 }, // Articulos
    { wch: 14 }, // Total venta
    { wch: 14 }, // Entrada
    { wch: 14 }, // Financiado
    { wch: 14 }, // Total abonado
    { wch: 16 }, // Saldo pendiente
    { wch: 12 }, // Total cuotas
    { wch: 14 }, // Cuotas pagadas
    { wch: 14 }, // Cuotas vencidas
    { wch: 14 }, // Cuotas pendientes
    { wch: 16 }, // Monto en mora
    { wch: 16 }, // Dias mora
    { wch: 16 }, // Categoria riesgo
    { wch: 24 }, // Calificacion buro
    { wch: 16 }, // Prox fecha
    { wch: 24 }, // Garante
    { wch: 14 }, // Cedula garante
    { wch: 14 }, // Telefono garante
    { wch: 14 }  // Estado
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Cartera y Mora');

  const fileName = `Cartera_Creditos_Mora_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}
