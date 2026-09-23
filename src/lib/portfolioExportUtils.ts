import * as XLSX from 'xlsx';
import { PortfolioClient, AGING_BRACKETS } from '../types/portfolio';
import { evaluateMonthlyDue } from './portfolioUtils';

export interface ExportClientsOptions {
  sheetName?: string;
  extraColumnsGenerator?: (client: PortfolioClient, index: number) => Record<string, any>;
  autoWidth?: boolean;
}

/**
 * Standard Canonical 15 Columns requested by user:
 * 1. Fecha Venta
 * 2. Cliente
 * 3. Dirección
 * 4. Entrada Pendiente
 * 5. Articulo
 * 6. Teléfono
 * 7. Valor Venta
 * 8. Abonos
 * 9. Saldo
 * 10. U.Pago
 * 11. Valor U. Pago
 * 12. Valor Cuota
 * 13. Cuo
 * 14. Días Mora
 * 15. Valor Total Atraso
 *
 * Followed by any enriched analytics columns at the far right.
 */
export function buildCanonicalClientRow(
  client: PortfolioClient,
  extraColumns?: Record<string, any>,
  cutoffDateStr?: string
): Record<string, any> {
  const evalResult = evaluateMonthlyDue(client, cutoffDateStr);

  const canonical15: Record<string, any> = {
    'Fecha Venta': client.saleDate || '',
    'Cliente': client.clientName || '',
    'Dirección': client.address || '',
    'Entrada Pendiente': (client.pendingDownPayment !== undefined && client.pendingDownPayment > 0)
      ? Number(client.pendingDownPayment.toFixed(2))
      : 0,
    'Articulo': client.itemSold || '',
    'Teléfono': client.phone || '',
    'Valor Venta': (client.saleValue !== undefined && client.saleValue > 0)
      ? Number(client.saleValue.toFixed(2))
      : '',
    'Abonos': (client.totalPayments !== undefined && client.totalPayments > 0)
      ? Number(client.totalPayments.toFixed(2))
      : 0,
    'Saldo': client.amount !== undefined ? Number(client.amount.toFixed(2)) : 0,
    'U.Pago': client.lastPaymentDate || '',
    'Valor U. Pago': (client.lastPaymentAmount !== undefined && client.lastPaymentAmount > 0)
      ? Number(client.lastPaymentAmount.toFixed(2))
      : '',
    'Valor Cuota': (client.installmentAmount !== undefined && client.installmentAmount > 0)
      ? Number(client.installmentAmount.toFixed(2))
      : '',
    'Cuo': client.installmentNumber !== undefined && client.installmentNumber !== ''
      ? client.installmentNumber
      : '',
    'Días Mora': client.overdueDays !== undefined ? client.overdueDays : 0,
    'Valor Total Atraso': (client.overdueAmount !== undefined && client.overdueAmount > 0)
      ? Number(client.overdueAmount.toFixed(2))
      : (client.amount !== undefined ? Number(client.amount.toFixed(2)) : 0)
  };

  const baseRow: Record<string, any> = {
    ...canonical15,
    'Exigible Este Mes ($)': evalResult.monthlyDueAmount,
    'Capital a Futuro (2026-2027) ($)': evalResult.futureLongTermDebt,
    'Estado Cuota Mensual': evalResult.statusLabel
  };

  if (extraColumns && Object.keys(extraColumns).length > 0) {
    Object.assign(baseRow, extraColumns);
  }

  return baseRow;
}

/**
 * Exports a list of PortfolioClient objects into an Excel file maintaining
 * the exact 15 standard canonical columns first, followed by any enriched columns.
 */
export function exportPortfolioClientsToExcel(
  clients: PortfolioClient[],
  fileName: string,
  options?: ExportClientsOptions
): void {
  const sheetName = (options?.sheetName || 'Cartera').substring(0, 31);
  const rows = clients.map((client, index) => {
    const extra = options?.extraColumnsGenerator ? options.extraColumnsGenerator(client, index) : undefined;
    return buildCanonicalClientRow(client, extra, undefined);
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Set standard column widths
  worksheet['!cols'] = [
    { wch: 14 }, // Fecha Venta
    { wch: 30 }, // Cliente
    { wch: 32 }, // Dirección
    { wch: 18 }, // Entrada Pendiente
    { wch: 28 }, // Articulo
    { wch: 16 }, // Teléfono
    { wch: 14 }, // Valor Venta
    { wch: 12 }, // Abonos
    { wch: 14 }, // Saldo
    { wch: 14 }, // U.Pago
    { wch: 16 }, // Valor U. Pago
    { wch: 14 }, // Valor Cuota
    { wch: 8 },  // Cuo
    { wch: 12 }, // Días Mora
    { wch: 18 }, // Valor Total Atraso
    // Enriched Cash-flow columns at far right
    { wch: 18 }, // Exigible Este Mes ($)
    { wch: 22 }, // Capital a Futuro (2026-2027) ($)
    { wch: 25 }, // Estado Cuota Mensual
    { wch: 20 }, // Tramo de Mora
    { wch: 22 }, // Cobrador Asignado
    { wch: 18 }, // N° Operación
    { wch: 16 }, // Cédula / RUC
    { wch: 22 }, // Estado Asignación
    { wch: 25 }, // Observaciones / Notas
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  const cleanFileName = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
  XLSX.writeFile(workbook, cleanFileName);
}
