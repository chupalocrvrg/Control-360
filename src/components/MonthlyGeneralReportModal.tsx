import React, { useState, useMemo } from 'react';
import { 
  X, FileText, Download, Calendar, Filter, Eye, CheckSquare, Square, 
  Store, Receipt, Banknote, Users, DollarSign, TrendingUp, Briefcase, 
  AlertCircle, CheckCircle2, Clock
} from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { formatCurrency, cn, isSaleMoto } from '../lib/utils';
import { getMonthlyPortfolioCutoffs, getCollectorPortfolioEvolution, round2 } from '../lib/portfolioUtils';
import { PortfolioSnapshot } from '../types/portfolio';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  allSales: any[];
  allCollections: any[];
  employees: any[];
  checks?: any[];
  allCommerceData?: any[];
  portfolioSnapshots?: PortfolioSnapshot[];
  currency?: string;
}

interface SellerGroup {
  sellerName: string;
  sales: any[];
  totalVal: number;
  totalContado: number;
  totalCredito: number;
}

interface CollectorGroup {
  collectorName: string;
  colls: any[];
  totalVal: number;
  totalEfectivo: number;
  totalTransferencia: number;
  totalAgencia: number;
}

type ReportType = 'GENERAL' | 'VENTAS_VENDEDOR' | 'VENTAS_TIPO' | 'COBROS_COBRADOR';

export const MonthlyGeneralReportModal: React.FC<Props> = ({ 
  isOpen, 
  onClose, 
  allSales = [], 
  allCollections = [], 
  employees = [],
  checks = [],
  allCommerceData = [],
  portfolioSnapshots = [],
  currency = 'USD'
}) => {
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [reportType, setReportType] = useState<ReportType>('GENERAL');
  const [showPreview, setShowPreview] = useState(false);
  
  // Selective filters
  const [selectedSeller, setSelectedSeller] = useState('');
  const [selectedCollector, setSelectedCollector] = useState('');
  const [selectedSaleType, setSelectedSaleType] = useState<'ALL' | 'contado' | 'credito'>('ALL');
  const [detallarVentas, setDetallarVentas] = useState(false);

  // Automatically reset preview when filters change
  const handleFilterChange = () => {
    setShowPreview(false);
  };

  // Filter sellers: only employees with role 'vendedor' or 'ambos' or supervisor
  const sellersList = useMemo(() => {
    return employees.filter((e: any) => ['vendedor', 'ambos', 'supervisor_ventas', 'supervisor_general'].includes(e.role));
  }, [employees]);

  // Filter collectors: only employees with role 'cobrador' or 'ambos' or supervisor
  const collectorsList = useMemo(() => {
    return employees.filter((e: any) => ['cobrador', 'ambos', 'supervisor_cobranza', 'supervisor_general'].includes(e.role));
  }, [employees]);

  // Process data based on report type and filters
  const processedData = useMemo(() => {
    const startStr = startDate.substring(0, 10);
    const endStr = endDate.substring(0, 10);

    // 1. Filter Sales within range and active
    const rawSales: any[] = allSales.filter((s: any) => {
      if (!s.date || s.status === 'ANULADO') return false;
      const d = s.date.substring(0, 10);
      return d >= startStr && d <= endStr;
    });

    // 2. Filter Collections within range and active
    const rawCollections: any[] = allCollections.filter((c: any) => {
      const dateStr = c.initialDate || c.paymentDate || c.date;
      if (!dateStr || c.status === 'ANULADO') return false;
      const d = dateStr.substring(0, 10);
      return d >= startStr && d <= endStr;
    });

    // 3. Filter Checks within range
    const rawChecks: any[] = checks.filter((c: any) => {
      if (!c.dueDate || c.status === 'DELETED') return false;
      const d = c.dueDate.substring(0, 10);
      return d >= startStr && d <= endStr && ['PENDING', 'PAID'].includes(c.status);
    }).sort((a: any, b: any) => (a.dueDate || '').localeCompare(b.dueDate || ''));

    // --- REPORT TYPE: GENERAL (Gerencial Consolidado) ---
    // A. Financial Overview
    const chequesCancelados = rawChecks.filter(c => c.status === 'PAID');
    const chequesPendientes = rawChecks.filter(c => c.status === 'PENDING');
    const totalChequesPeriodo = rawChecks.reduce((sum, c) => sum + (c.amount || 0), 0);
    const totalChequesCancelados = chequesCancelados.reduce((sum, c) => sum + (c.amount || 0), 0);
    const totalChequesPendientes = chequesPendientes.reduce((sum, c) => sum + (c.amount || 0), 0);

    const ventasContadoArticulos = rawSales
      .filter(s => !isSaleMoto(s) && s.type === 'contado')
      .reduce((sum, s) => sum + (s.totalValue || 0), 0);
    const ventasContadoMotos = rawSales
      .filter(s => isSaleMoto(s) && s.type === 'contado')
      .reduce((sum, s) => sum + (s.totalValue || 0), 0);
    const totalVentasContado = ventasContadoArticulos + ventasContadoMotos;

    const totalCobros = rawCollections.reduce((sum, c) => sum + (c.totalCollected || c.amount || 0), 0);
    const balanceNeto = totalVentasContado + totalCobros - totalChequesCancelados;

    // B. Sales by Seller (General)
    const salesBySellerMap: Record<string, any> = {};
    sellersList.forEach((e: any) => {
      const comm: any = allCommerceData.find((c: any) => c.employee?.id === e.id);
      salesBySellerMap[e.id] = {
        employee: e,
        name: `${e.name || ''} ${e.lastName || ''}`.trim(),
        motosCombUds: 0,
        motosElecUds: 0,
        motosContadoUds: 0,
        motosCreditoUds: 0,
        totalMotosUds: 0,
        totalArticulosVal: 0,
        salesBudget: comm?.salesBudget || 0,
        salesList: []
      };
    });

    rawSales.forEach((s: any) => {
      const target = salesBySellerMap[s.employeeId];
      if (!target) return;
      const val = s.totalValue || 0;
      target.salesList.push(s);

      if (isSaleMoto(s)) {
        if (s.motoType === 'electrico') {
          target.motosElecUds += 1;
        } else {
          target.motosCombUds += 1;
        }
        if (s.type === 'contado') {
          target.motosContadoUds += 1;
        } else {
          target.motosCreditoUds += 1;
        }
        target.totalMotosUds += 1;
      } else {
        target.totalArticulosVal += val;
      }
    });

    const salesBySellerArray = Object.values(salesBySellerMap).map((item: any) => {
      const pct = item.salesBudget > 0 ? ((item.totalArticulosVal / item.salesBudget) * 100).toFixed(1) + '%' : '0%';
      return { ...item, pct };
    });

    // C. Collections by Collector (General)
    const collsByCollectorMap: Record<string, any> = {};
    collectorsList.forEach((e: any) => {
      const comm: any = allCommerceData.find((c: any) => c.employee?.id === e.id);
      collsByCollectorMap[e.id] = {
        employee: e,
        name: `${e.name || ''} ${e.lastName || ''}`.trim(),
        agencia: 0,
        transferencia: 0,
        efectivo: 0,
        total: 0,
        budget: comm?.collectionsBudget || 0,
        collsList: []
      };
    });

    rawCollections.forEach((c: any) => {
      const target = collsByCollectorMap[c.employeeId];
      if (!target) return;
      target.collsList.push(c);

      const tot = c.totalCollected || c.amount || 0;
      target.total += tot;

      // Classify Agencia, Transferencia, Efectivo
      const isAgency = c.noReceipt || c.isAgency || c.origin === 'agency' || c.paymentMethod === 'AGENCIA' || (c.notes && c.notes.toLowerCase().includes('agencia'));
      const isTransfer = c.isTransfer || c.paymentMethod === 'TRANSFERENCIA';

      if (isAgency) {
        target.agencia += tot;
      } else if (isTransfer) {
        target.transferencia += tot;
      } else if (c.cashFinal !== undefined || c.depositsTransfers !== undefined) {
        // Manual batch breakdown
        const cash = Number(c.cashFinal || 0);
        const trans = Number(c.depositsTransfers || 0);
        target.efectivo += cash;
        target.transferencia += trans;
      } else {
        target.efectivo += tot;
      }
    });

    const collsByCollectorArray = Object.values(collsByCollectorMap).map((item: any) => {
      const pct = item.budget > 0 ? ((item.total / item.budget) * 100).toFixed(1) + '%' : '0%';
      return { ...item, pct };
    });

    // --- REPORT TYPE: VENTAS POR VENDEDOR ---
    const filteredSalesBySeller = rawSales.filter((s: any) => {
      if (selectedSeller && s.employeeId !== selectedSeller) return false;
      if (selectedSaleType !== 'ALL' && s.type !== selectedSaleType) return false;
      return true;
    });

    // Group filtered sales by seller
    const salesGroupedBySeller: Record<string, SellerGroup> = {};
    filteredSalesBySeller.forEach((s: any) => {
      const emp: any = employees.find((e: any) => e.id === s.employeeId);
      const name = emp ? `${emp.name || ''} ${emp.lastName || ''}`.trim() : 'Sin Vendedor';
      if (!salesGroupedBySeller[s.employeeId]) {
        salesGroupedBySeller[s.employeeId] = {
          sellerName: name,
          sales: [],
          totalVal: 0,
          totalContado: 0,
          totalCredito: 0
        };
      }
      salesGroupedBySeller[s.employeeId].sales.push(s);
      salesGroupedBySeller[s.employeeId].totalVal += (s.totalValue || 0);
      if (s.type === 'contado') {
        salesGroupedBySeller[s.employeeId].totalContado += (s.totalValue || 0);
      } else {
        salesGroupedBySeller[s.employeeId].totalCredito += (s.totalValue || 0);
      }
    });

    // --- REPORT TYPE: COBROS POR COBRADOR ---
    const filteredCollsByCollector = rawCollections.filter((c: any) => {
      if (selectedCollector && c.employeeId !== selectedCollector) return false;
      return true;
    });

    const collsGroupedByCollector: Record<string, CollectorGroup> = {};
    filteredCollsByCollector.forEach((c: any) => {
      const emp: any = employees.find((e: any) => e.id === c.employeeId);
      const name = emp ? `${emp.name || ''} ${emp.lastName || ''}`.trim() : 'Sin Cobrador';
      if (!collsGroupedByCollector[c.employeeId]) {
        collsGroupedByCollector[c.employeeId] = {
          collectorName: name,
          colls: [],
          totalVal: 0,
          totalEfectivo: 0,
          totalTransferencia: 0,
          totalAgencia: 0
        };
      }
      const tot = c.totalCollected || c.amount || 0;
      collsGroupedByCollector[c.employeeId].colls.push(c);
      collsGroupedByCollector[c.employeeId].totalVal += tot;

      const isAgency = c.noReceipt || c.isAgency || c.origin === 'agency' || c.paymentMethod === 'AGENCIA' || (c.notes && c.notes.toLowerCase().includes('agencia'));
      const isTransfer = c.isTransfer || c.paymentMethod === 'TRANSFERENCIA';

      if (isAgency) {
        collsGroupedByCollector[c.employeeId].totalAgencia += tot;
      } else if (isTransfer) {
        collsGroupedByCollector[c.employeeId].totalTransferencia += tot;
      } else if (c.cashFinal !== undefined || c.depositsTransfers !== undefined) {
        collsGroupedByCollector[c.employeeId].totalEfectivo += Number(c.cashFinal || 0);
        collsGroupedByCollector[c.employeeId].totalTransferencia += Number(c.depositsTransfers || 0);
      } else {
        collsGroupedByCollector[c.employeeId].totalEfectivo += tot;
      }
    });

    return {
      rawSales,
      rawCollections,
      rawChecks,
      chequesCancelados,
      chequesPendientes,
      totalChequesPeriodo,
      totalChequesCancelados,
      totalChequesPendientes,
      totalVentasContado,
      totalCobros,
      balanceNeto,
      salesBySellerArray,
      collsByCollectorArray,
      salesGroupedBySeller,
      collsGroupedByCollector,
      filteredSalesBySeller,
      filteredCollsByCollector
    };
  }, [allSales, allCollections, checks, employees, allCommerceData, startDate, endDate, selectedSeller, selectedCollector, selectedSaleType, sellersList, collectorsList]);

  // Export to PDF with guaranteed single-sheet-width auto-fit (Landscape A4: 297mm)
  const exportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth(); // 297mm
    const margin = 10;
    const contentWidth = pageWidth - (margin * 2); // 277mm

    let currentY = 15;

    // Header Branding
    doc.setFontSize(16);
    doc.setTextColor(30, 41, 59);
    doc.text("CONTROL FINANCIERO 360°", margin, currentY);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    const subtitle = reportType === 'GENERAL' 
      ? `Reporte General Gerencial • Periodo: ${startDate} al ${endDate}`
      : reportType === 'VENTAS_VENDEDOR' 
      ? `Reporte de Ventas por Vendedor • Periodo: ${startDate} al ${endDate}`
      : reportType === 'VENTAS_TIPO'
      ? `Reporte de Ventas por Tipo (${selectedSaleType.toUpperCase()}) • Periodo: ${startDate} al ${endDate}`
      : `Reporte de Cobranzas por Cobrador • Periodo: ${startDate} al ${endDate}`;
    doc.text(subtitle, margin, currentY + 6);
    currentY += 14;

    if (reportType === 'GENERAL') {
      // 1. Resumen Financiero de Ingresos y Flujo
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text("1. Resumen Financiero de Ingresos y Compromisos", margin, currentY);
      currentY += 3;

      autoTable(doc, {
        startY: currentY,
        margin: { left: margin, right: margin },
        tableWidth: contentWidth,
        head: [["Concepto", "Monto ($)", "Detalle / Estado"]],
        body: [
          ["Ventas en Efectivo / Contado (Artículos + Motos)", formatCurrency(processedData.totalVentasContado, currency), "Ingreso disponible de ventas contado directas"],
          ["Cobros Totales Realizados (Ruta + Oficina)", formatCurrency(processedData.totalCobros, currency), "Recaudación total de cobranza en el periodo"],
          ["Total Cheques Programados en el Mes", formatCurrency(processedData.totalChequesPeriodo, currency), `${processedData.rawChecks.length} cheques con vencimiento en el rango`],
          ["Cheques Cancelados (Pagados)", `-${formatCurrency(processedData.totalChequesCancelados, currency)}`, `${processedData.chequesCancelados.length} cheques efectivamente pagados`],
          ["Balance Neto Estimado de Operación", formatCurrency(processedData.balanceNeto, currency), "Ingresos Contado + Cobros - Cheques Cancelados"]
        ],
        theme: 'grid',
        styles: { fontSize: 7.5, cellPadding: 2, overflow: 'linebreak' },
        headStyles: { fillColor: [46, 204, 113], fontStyle: 'bold' }
      });

      currentY = (doc as any).lastAutoTable.finalY + 8;

      // 2. Resumen de Ventas por Vendedor (Unidades de motos y valores)
      if (currentY + 35 > doc.internal.pageSize.getHeight()) {
        doc.addPage();
        currentY = 15;
      }
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text("2. Resumen de Ventas por Vendedor", margin, currentY);
      currentY += 3;

      const salesBody = processedData.salesBySellerArray.map(s => [
        s.name,
        s.motosCombUds.toString(),
        s.motosElecUds.toString(),
        s.totalMotosUds.toString(),
        `Cont: ${s.motosContadoUds} / Créd: ${s.motosCreditoUds}`,
        formatCurrency(s.totalArticulosVal, currency),
        formatCurrency(s.salesBudget, currency),
        s.pct
      ]);

      autoTable(doc, {
        startY: currentY,
        margin: { left: margin, right: margin },
        tableWidth: contentWidth,
        head: [["Vendedor", "Motos Comb. (Uds)", "Motos Eléc. (Uds)", "Total Motos (Uds)", "Motos (Cont/Créd)", "Artículos ($)", "Presupuesto ($)", "% Cump."]],
        body: salesBody.length > 0 ? salesBody : [["Sin vendedores con actividad en el periodo", "-", "-", "-", "-", "-", "-", "-"]],
        theme: 'grid',
        styles: { fontSize: 7.5, cellPadding: 2, overflow: 'linebreak' },
        headStyles: { fillColor: [79, 70, 229], fontStyle: 'bold' }
      });

      currentY = (doc as any).lastAutoTable.finalY + 8;

      // 3. Resumen de Cobranza por Cobrador
      if (currentY + 35 > doc.internal.pageSize.getHeight()) {
        doc.addPage();
        currentY = 15;
      }
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text("3. Resumen de Cobranza por Cobrador", margin, currentY);
      currentY += 3;

      const collsBody = processedData.collsByCollectorArray.map(c => [
        c.name,
        formatCurrency(c.agencia, currency),
        formatCurrency(c.transferencia, currency),
        formatCurrency(c.efectivo, currency),
        formatCurrency(c.total, currency),
        formatCurrency(c.budget, currency),
        c.pct
      ]);

      autoTable(doc, {
        startY: currentY,
        margin: { left: margin, right: margin },
        tableWidth: contentWidth,
        head: [["Cobrador", "Agencia / Oficina ($)", "Transferencias ($)", "Efectivo Ruta ($)", "Total Cobranza ($)", "Presupuesto ($)", "% Cump."]],
        body: collsBody.length > 0 ? collsBody : [["Sin cobradores con actividad en el periodo", "-", "-", "-", "-", "-", "-"]],
        theme: 'grid',
        styles: { fontSize: 7.5, cellPadding: 2, overflow: 'linebreak' },
        headStyles: { fillColor: [14, 165, 233], fontStyle: 'bold' }
      });

      currentY = (doc as any).lastAutoTable.finalY + 8;

      // 4. Detalle de Cheques (Cancelados y Pendientes)
      if (processedData.rawChecks.length > 0) {
        if (currentY + 35 > doc.internal.pageSize.getHeight()) {
          doc.addPage();
          currentY = 15;
        }
        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42);
        doc.text("4. Detalle de Cheques (Cancelados y Pendientes del Periodo)", margin, currentY);
        currentY += 3;

        const checksBody = processedData.rawChecks.map(c => [
          c.dueDate || '-',
          c.beneficiaryName || 'S/N',
          c.checkNumber || 'S/N',
          formatCurrency(c.amount || 0, currency),
          c.status === 'PAID' ? 'CANCELADO / PAGADO' : 'PENDIENTE'
        ]);

        autoTable(doc, {
          startY: currentY,
          margin: { left: margin, right: margin },
          tableWidth: contentWidth,
          head: [["Vencimiento", "Beneficiario", "Cheque #", "Monto ($)", "Estado"]],
          body: checksBody,
          theme: 'striped',
          styles: { fontSize: 7.5, cellPadding: 2, overflow: 'linebreak' },
          headStyles: { fillColor: [71, 85, 105], fontStyle: 'bold' }
        });

        currentY = (doc as any).lastAutoTable.finalY + 8;
      }

      // 5. NUEVA FUNCIONALIDAD: Detalle de Ventas por Vendedor (si checkbox marcado)
      if (detallarVentas) {
        doc.addPage();
        currentY = 15;
        doc.setFontSize(13);
        doc.setTextColor(15, 23, 42);
        doc.text("5. Detalle de Ventas Sectorizado por Vendedor", margin, currentY);
        currentY += 6;

        (Object.values(processedData.salesGroupedBySeller) as SellerGroup[]).forEach((sellerGroup: SellerGroup) => {
          if (currentY + 30 > doc.internal.pageSize.getHeight()) {
            doc.addPage();
            currentY = 15;
          }

          doc.setFontSize(10);
          doc.setTextColor(79, 70, 229);
          doc.text(`Vendedor: ${sellerGroup.sellerName} (Total: ${formatCurrency(sellerGroup.totalVal, currency)})`, margin, currentY);
          currentY += 3;

          const rows = sellerGroup.sales.map((s: any) => [
            s.date || '-',
            s.clientName || 'Cliente General',
            s.article || 'Artículo',
            (s.type || 'contado').toUpperCase(),
            formatCurrency(s.totalValue || 0, currency)
          ]);

          autoTable(doc, {
            startY: currentY,
            margin: { left: margin, right: margin },
            tableWidth: contentWidth,
            head: [["Fecha", "Nombre del Cliente", "Artículo Vendido", "Tipo (Contado/Crédito)", "Valor Venta ($)"]],
            body: rows,
            foot: [["TOTAL VENTAS", "-", "-", `${sellerGroup.sales.length} transacciones`, formatCurrency(sellerGroup.totalVal, currency)]],
            theme: 'grid',
            styles: { fontSize: 7.5, cellPadding: 2, overflow: 'linebreak' },
            headStyles: { fillColor: [99, 102, 241], fontStyle: 'bold' },
            footStyles: { fillColor: [243, 244, 246], textColor: [0, 0, 0], fontStyle: 'bold' }
          });

          currentY = (doc as any).lastAutoTable.finalY + 8;
        });
      }

    } else if (reportType === 'VENTAS_VENDEDOR' || reportType === 'VENTAS_TIPO') {
      // REPORTE EXCLUSIVO DE VENTAS (CERO COBRANZAS)
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text("Detalle de Ventas", margin, currentY);
      currentY += 3;

      const sellerGroups = Object.values(processedData.salesGroupedBySeller) as SellerGroup[];

      if (sellerGroups.length === 0) {
        autoTable(doc, {
          startY: currentY,
          margin: { left: margin, right: margin },
          tableWidth: contentWidth,
          head: [["Fecha", "Vendedor", "Cliente", "Artículo", "Tipo", "Valor ($)"]],
          body: [["Sin registros de ventas en el periodo o filtros seleccionados", "-", "-", "-", "-", "-"]],
          styles: { fontSize: 7.5, cellPadding: 2 }
        });
      } else {
        sellerGroups.forEach((sellerGroup: SellerGroup) => {
          if (currentY + 25 > doc.internal.pageSize.getHeight()) {
            doc.addPage();
            currentY = 15;
          }

          doc.setFontSize(10);
          doc.setTextColor(79, 70, 229);
          doc.text(`Vendedor: ${sellerGroup.sellerName} • Total: ${formatCurrency(sellerGroup.totalVal, currency)} (Contado: ${formatCurrency(sellerGroup.totalContado, currency)} | Crédito: ${formatCurrency(sellerGroup.totalCredito, currency)})`, margin, currentY);
          currentY += 3;

          const rows = sellerGroup.sales.map((s: any) => [
            s.date || '-',
            s.clientName || 'Cliente',
            s.article || 'Artículo',
            (s.type || 'contado').toUpperCase(),
            formatCurrency(s.totalValue || 0, currency)
          ]);

          autoTable(doc, {
            startY: currentY,
            margin: { left: margin, right: margin },
            tableWidth: contentWidth,
            head: [["Fecha", "Nombre del Cliente", "Artículo Vendido", "Tipo de Venta", "Valor ($)"]],
            body: rows,
            foot: [["SUBTOTAL VENDEDOR", "-", "-", `${sellerGroup.sales.length} ventas`, formatCurrency(sellerGroup.totalVal, currency)]],
            theme: 'grid',
            styles: { fontSize: 7.5, cellPadding: 2, overflow: 'linebreak' },
            headStyles: { fillColor: [79, 70, 229], fontStyle: 'bold' },
            footStyles: { fillColor: [243, 244, 246], textColor: [0, 0, 0], fontStyle: 'bold' }
          });

          currentY = (doc as any).lastAutoTable.finalY + 8;
        });
      }

    } else if (reportType === 'COBROS_COBRADOR') {
      // REPORTE EXCLUSIVO DE COBRANZAS (CERO VENTAS)
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text("Detalle de Cobranzas", margin, currentY);
      currentY += 3;

      const collGroups = Object.values(processedData.collsGroupedByCollector) as CollectorGroup[];

      if (collGroups.length === 0) {
        autoTable(doc, {
          startY: currentY,
          margin: { left: margin, right: margin },
          tableWidth: contentWidth,
          head: [["Fecha / Periodo", "Cobrador", "Tipo de Cobro", "Detalle", "Monto ($)"]],
          body: [["Sin registros de cobranza en el periodo o filtros seleccionados", "-", "-", "-", "-"]],
          styles: { fontSize: 7.5, cellPadding: 2 }
        });
      } else {
        collGroups.forEach((collGroup: CollectorGroup) => {
          if (currentY + 25 > doc.internal.pageSize.getHeight()) {
            doc.addPage();
            currentY = 15;
          }

          doc.setFontSize(10);
          doc.setTextColor(14, 165, 233);
          doc.text(`Cobrador: ${collGroup.collectorName} • Total Cobrado: ${formatCurrency(collGroup.totalVal, currency)} (Agencia: ${formatCurrency(collGroup.totalAgencia, currency)} | Transf: ${formatCurrency(collGroup.totalTransferencia, currency)} | Efectivo: ${formatCurrency(collGroup.totalEfectivo, currency)})`, margin, currentY);
          currentY += 3;

          const rows = collGroup.colls.map((c: any) => [
            c.initialDate || c.paymentDate || c.date || '-',
            c.noReceipt ? 'COBRO EN AGENCIA / OFICINA' : (c.receiptNumber ? `RECIBO: ${c.receiptNumber}` : (c.initialReceipt ? `LOTES: ${c.initialReceipt} AL ${c.finalReceipt}` : 'COBRO RUTA')),
            c.clientName || 'Cliente / Cartera',
            c.isTransfer ? 'TRANSFERENCIA' : (c.paymentMethod || 'EFECTIVO'),
            formatCurrency(c.totalCollected || c.amount || 0, currency)
          ]);

          autoTable(doc, {
            startY: currentY,
            margin: { left: margin, right: margin },
            tableWidth: contentWidth,
            head: [["Fecha / Periodo", "Comprobante / Origen", "Cliente / Referencia", "Modalidad de Pago", "Monto ($)"]],
            body: rows,
            foot: [["SUBTOTAL COBRADOR", "-", "-", `${collGroup.colls.length} cobros`, formatCurrency(collGroup.totalVal, currency)]],
            theme: 'grid',
            styles: { fontSize: 7.5, cellPadding: 2, overflow: 'linebreak' },
            headStyles: { fillColor: [14, 165, 233], fontStyle: 'bold' },
            footStyles: { fillColor: [243, 244, 246], textColor: [0, 0, 0], fontStyle: 'bold' }
          });

          currentY = (doc as any).lastAutoTable.finalY + 8;
        });
      }
    }

    // Footer Watermark & Page Number
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(7.5);
      doc.setTextColor(150, 150, 150);
      doc.text(`Control Financiero 360° • Generado el ${format(new Date(), 'dd/MM/yyyy HH:mm')} por Administración`, margin, doc.internal.pageSize.getHeight() - 6);
      doc.text(`Página ${i} de ${totalPages}`, pageWidth - margin, doc.internal.pageSize.getHeight() - 6, { align: "right" });
    }

    const filename = `Reporte_${reportType}_${startDate}_a_${endDate}.pdf`;
    doc.save(filename);
  };

  // Export to Excel with clean formatted sheets
  const exportExcel = () => {
    const wb = XLSX.utils.book_new();

    if (reportType === 'GENERAL') {
      // Sheet 1: Resumen Financiero
      const finData = [
        ["REPORTE GENERAL GERENCIAL", `Periodo: ${startDate} al ${endDate}`],
        [],
        ["1. RESUMEN FINANCIERO DE INGRESOS Y EGRESOS", "MONTO ($)", "DETALLE"],
        ["Ventas en Efectivo / Contado", processedData.totalVentasContado, "Artículos + Motos Contado"],
        ["Cobros Totales Realizados", processedData.totalCobros, "Recaudación de ruta y agencia"],
        ["Total Cheques a Cancelarse en el Mes", processedData.totalChequesPeriodo, `${processedData.rawChecks.length} cheques programados`],
        ["Cheques Cancelados (Pagados)", -processedData.totalChequesCancelados, `${processedData.chequesCancelados.length} cheques cancelados`],
        ["BALANCE NETO ESTIMADO", processedData.balanceNeto, "Ingresos Contado + Cobros - Cheques Pagados"]
      ];
      const wsFin = XLSX.utils.aoa_to_sheet(finData);
      XLSX.utils.book_append_sheet(wb, wsFin, "Resumen Financiero");

      // Sheet 2: Ventas por Vendedor
      const salesHeader = ["Vendedor", "Motos Combustión (Uds)", "Motos Eléctricas (Uds)", "Total Motos (Uds)", "Motos Contado (Uds)", "Motos Crédito (Uds)", "Total Artículos ($)", "Presupuesto ($)", "% Cumplimiento"];
      const salesRows = processedData.salesBySellerArray.map(s => [
        s.name,
        s.motosCombUds,
        s.motosElecUds,
        s.totalMotosUds,
        s.motosContadoUds,
        s.motosCreditoUds,
        s.totalArticulosVal,
        s.salesBudget,
        s.pct
      ]);
      const wsSales = XLSX.utils.aoa_to_sheet([salesHeader, ...salesRows]);
      XLSX.utils.book_append_sheet(wb, wsSales, "Ventas x Vendedor");

      // Sheet 3: Cobranza por Cobrador
      const collHeader = ["Cobrador", "Cobro en Agencia ($)", "Cobro Transferencia ($)", "Cobro Efectivo ($)", "Total Cobrado ($)", "Presupuesto ($)", "% Cumplimiento"];
      const collRows = processedData.collsByCollectorArray.map(c => [
        c.name,
        c.agencia,
        c.transferencia,
        c.efectivo,
        c.total,
        c.budget,
        c.pct
      ]);
      const wsColls = XLSX.utils.aoa_to_sheet([collHeader, ...collRows]);
      XLSX.utils.book_append_sheet(wb, wsColls, "Cobros x Cobrador");

      // Sheet 4: Cheques
      if (processedData.rawChecks.length > 0) {
        const checkHeader = ["Vencimiento", "Beneficiario", "Cheque #", "Monto ($)", "Estado"];
        const checkRows = processedData.rawChecks.map(c => [
          c.dueDate || '',
          c.beneficiaryName || '',
          c.checkNumber || '',
          c.amount || 0,
          c.status === 'PAID' ? 'CANCELADO' : 'PENDIENTE'
        ]);
        const wsChecks = XLSX.utils.aoa_to_sheet([checkHeader, ...checkRows]);
        XLSX.utils.book_append_sheet(wb, wsChecks, "Cheques Periodo");
      }

      // Sheet 5: Detalle de Ventas si checkbox activo
      if (detallarVentas) {
        const detHeader = ["Vendedor", "Fecha", "Cliente", "Artículo", "Tipo", "Valor ($)"];
        const detRows = (Object.values(processedData.salesGroupedBySeller) as SellerGroup[]).flatMap((sg: SellerGroup) => 
          sg.sales.map((s: any) => [
            sg.sellerName,
            s.date || '',
            s.clientName || '',
            s.article || '',
            (s.type || '').toUpperCase(),
            s.totalValue || 0
          ])
        );
        const wsDet = XLSX.utils.aoa_to_sheet([detHeader, ...detRows]);
        XLSX.utils.book_append_sheet(wb, wsDet, "Detalle Ventas x Vendedor");
      }

    } else if (reportType === 'VENTAS_VENDEDOR' || reportType === 'VENTAS_TIPO') {
      const header = ["Vendedor", "Fecha", "Cliente", "Artículo", "Tipo de Venta", "Valor ($)"];
      const rows = (Object.values(processedData.salesGroupedBySeller) as SellerGroup[]).flatMap((sg: SellerGroup) => 
        sg.sales.map((s: any) => [
          sg.sellerName,
          s.date || '',
          s.clientName || '',
          s.article || '',
          (s.type || '').toUpperCase(),
          s.totalValue || 0
        ])
      );
      const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
      XLSX.utils.book_append_sheet(wb, ws, "Ventas");

    } else if (reportType === 'COBROS_COBRADOR') {
      const header = ["Cobrador", "Fecha", "Comprobante / Origen", "Cliente / Referencia", "Modalidad", "Monto ($)"];
      const rows = (Object.values(processedData.collsGroupedByCollector) as CollectorGroup[]).flatMap((cg: CollectorGroup) => 
        cg.colls.map((c: any) => [
          cg.collectorName,
          c.initialDate || c.paymentDate || c.date || '',
          c.noReceipt ? 'COBRO EN AGENCIA' : (c.receiptNumber ? `RECIBO ${c.receiptNumber}` : (c.initialReceipt ? `${c.initialReceipt} AL ${c.finalReceipt}` : 'RUTA')),
          c.clientName || 'Cliente',
          c.isTransfer ? 'TRANSFERENCIA' : (c.paymentMethod || 'EFECTIVO'),
          c.totalCollected || c.amount || 0
        ])
      );
      const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
      XLSX.utils.book_append_sheet(wb, ws, "Cobranzas");
    }

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const filename = `Reporte_${reportType}_${startDate}_a_${endDate}.xlsx`;
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), filename);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-3 sm:p-4 bg-neutral-950/70 backdrop-blur-md">
      <div className="bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl w-full max-w-5xl h-[92vh] flex flex-col overflow-hidden border border-neutral-200 dark:border-neutral-800 animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-neutral-100 dark:border-neutral-800 bg-indigo-600 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5" />
            <div>
              <h2 className="text-base sm:text-lg font-bold">Generación y Personalización de Reportes</h2>
              <p className="text-xs text-indigo-100">Control Financiero, Ventas y Cobranza Consolidada</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          
          {/* Main Controls Card */}
          <div className="p-4 bg-neutral-50 dark:bg-neutral-800/60 rounded-2xl border border-neutral-200 dark:border-neutral-700/80 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              
              {/* Report Type Selector */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-1.5">
                  Tipo de Reporte
                </label>
                <select 
                  value={reportType} 
                  onChange={e => {
                    setReportType(e.target.value as ReportType);
                    handleFilterChange();
                  }}
                  className="w-full bg-white dark:bg-neutral-900 p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs sm:text-sm font-bold text-neutral-800 dark:text-neutral-100 outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                >
                  <option value="GENERAL">📊 Reporte General (Gerencial Consolidado)</option>
                  <option value="VENTAS_VENDEDOR">🛍️ Ventas por Vendedor</option>
                  <option value="VENTAS_TIPO">💳 Ventas por Tipo (Contado / Crédito)</option>
                  <option value="COBROS_COBRADOR">🧾 Cobranzas por Cobrador</option>
                </select>
              </div>

              {/* Start Date */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-1.5">
                  Fecha Inicial
                </label>
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={e => {
                    setStartDate(e.target.value);
                    handleFilterChange();
                  }} 
                  className="w-full bg-white dark:bg-neutral-900 p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs sm:text-sm font-medium text-neutral-800 dark:text-neutral-100 outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                />
              </div>

              {/* End Date */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-1.5">
                  Fecha Final
                </label>
                <input 
                  type="date" 
                  value={endDate} 
                  onChange={e => {
                    setEndDate(e.target.value);
                    handleFilterChange();
                  }} 
                  className="w-full bg-white dark:bg-neutral-900 p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs sm:text-sm font-medium text-neutral-800 dark:text-neutral-100 outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                />
              </div>
            </div>

            {/* CONDITIONAL FILTERS DEPENDING ON REPORT TYPE */}
            {reportType === 'GENERAL' ? (
              <div className="pt-2 border-t border-neutral-200/80 dark:border-neutral-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>El Reporte General consolida automáticamente todos los ingresos, ventas, cobranzas y cheques sin filtros individuales de empleado.</span>
                </div>
                
                {/* NEW FEATURE: Checkbox Detallar Ventas */}
                <button
                  type="button"
                  onClick={() => {
                    setDetallarVentas(!detallarVentas);
                    handleFilterChange();
                  }}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all self-start sm:self-auto",
                    detallarVentas 
                      ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700 shadow-sm"
                      : "bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100"
                  )}
                >
                  {detallarVentas ? (
                    <CheckSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  ) : (
                    <Square className="w-4 h-4 text-neutral-400" />
                  )}
                  <span>[ ] Detallar ventas al final</span>
                </button>
              </div>
            ) : reportType === 'VENTAS_VENDEDOR' ? (
              <div className="pt-2 border-t border-neutral-200/80 dark:border-neutral-700/80 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-1">
                    Vendedor
                  </label>
                  <select 
                    value={selectedSeller} 
                    onChange={e => {
                      setSelectedSeller(e.target.value);
                      handleFilterChange();
                    }} 
                    className="w-full bg-white dark:bg-neutral-900 p-2.5 border rounded-xl text-xs sm:text-sm font-medium"
                  >
                    <option value="">Todos los Vendedores</option>
                    {sellersList.map(e => (
                      <option key={e.id} value={e.id}>{e.name} {e.lastName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-1">
                    Tipo de Venta
                  </label>
                  <select 
                    value={selectedSaleType} 
                    onChange={e => {
                      setSelectedSaleType(e.target.value as any);
                      handleFilterChange();
                    }} 
                    className="w-full bg-white dark:bg-neutral-900 p-2.5 border rounded-xl text-xs sm:text-sm font-medium"
                  >
                    <option value="ALL">Todas las ventas (Contado y Crédito)</option>
                    <option value="contado">Solo Ventas al Contado</option>
                    <option value="credito">Solo Ventas a Crédito</option>
                  </select>
                </div>
              </div>
            ) : reportType === 'VENTAS_TIPO' ? (
              <div className="pt-2 border-t border-neutral-200/80 dark:border-neutral-700/80 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-1">
                    Tipo de Venta Requerido
                  </label>
                  <select 
                    value={selectedSaleType === 'ALL' ? 'contado' : selectedSaleType} 
                    onChange={e => {
                      setSelectedSaleType(e.target.value as any);
                      handleFilterChange();
                    }} 
                    className="w-full bg-white dark:bg-neutral-900 p-2.5 border rounded-xl text-xs sm:text-sm font-bold"
                  >
                    <option value="contado">Ventas al Contado</option>
                    <option value="credito">Ventas a Crédito</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-neutral-500 mb-1">
                    Filtrar por Vendedor Específico (Opcional)
                  </label>
                  <select 
                    value={selectedSeller} 
                    onChange={e => {
                      setSelectedSeller(e.target.value);
                      handleFilterChange();
                    }} 
                    className="w-full bg-white dark:bg-neutral-900 p-2.5 border rounded-xl text-xs sm:text-sm font-medium"
                  >
                    <option value="">Todos los Vendedores</option>
                    {sellersList.map(e => (
                      <option key={e.id} value={e.id}>{e.name} {e.lastName}</option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <div className="pt-2 border-t border-neutral-200/80 dark:border-neutral-700/80 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-sky-600 dark:text-sky-400 mb-1">
                    Cobrador
                  </label>
                  <select 
                    value={selectedCollector} 
                    onChange={e => {
                      setSelectedCollector(e.target.value);
                      handleFilterChange();
                    }} 
                    className="w-full bg-white dark:bg-neutral-900 p-2.5 border rounded-xl text-xs sm:text-sm font-medium"
                  >
                    <option value="">Todos los Cobradores</option>
                    {collectorsList.map(e => (
                      <option key={e.id} value={e.id}>{e.name} {e.lastName}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center text-xs text-neutral-500 italic pt-4">
                  * Filtro exclusivo de cobranza. Se excluye toda actividad de venta para roles mixtos.
                </div>
              </div>
            )}
          </div>

          {/* Results Preview Section */}
          <div className="space-y-6">
            {!showPreview ? (
              <div className="text-center py-16 px-4 bg-neutral-50 dark:bg-neutral-900/40 rounded-2xl border border-dashed border-neutral-200 dark:border-neutral-800">
                <Eye className="w-10 h-10 text-neutral-400 mx-auto mb-3 opacity-60" />
                <h4 className="text-sm font-bold text-neutral-700 dark:text-neutral-200">Previsualización de Reporte</h4>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-md mx-auto">
                  Selecciona los parámetros deseados arriba y presiona <span className="font-bold text-indigo-600 dark:text-indigo-400">"Generar Vista Previa"</span> para revisar la información antes de descargar en PDF o Excel.
                </p>
              </div>
            ) : (
              <div className="space-y-6 animate-in fade-in duration-200">
                
                {/* 1. PREVIEW: GENERAL REPORT */}
                {reportType === 'GENERAL' && (
                  <>
                    {/* Cuadro 1: Resumen Financiero */}
                    <div className="space-y-2">
                      <h3 className="font-bold text-xs uppercase tracking-widest text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                        <DollarSign className="w-4 h-4" /> 1. Resumen Financiero de Ingresos y Flujo
                      </h3>
                      <div className="border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden bg-white dark:bg-neutral-900">
                        <table className="w-full text-xs">
                          <thead className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 border-b border-emerald-100 dark:border-emerald-900/50">
                            <tr>
                              <th className="py-2.5 px-3 text-left font-bold">Concepto</th>
                              <th className="py-2.5 px-3 text-right font-bold">Monto ($)</th>
                              <th className="py-2.5 px-3 text-left font-bold">Detalle Operativo</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 font-medium">
                            <tr>
                              <td className="py-2.5 px-3 font-semibold text-neutral-800 dark:text-neutral-200">Ventas en Efectivo / Contado (Artículos + Motos)</td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                {formatCurrency(processedData.totalVentasContado, currency)}
                              </td>
                              <td className="py-2.5 px-3 text-neutral-500">Ingresos líquidos directos por ventas de contado</td>
                            </tr>
                            <tr>
                              <td className="py-2.5 px-3 font-semibold text-neutral-800 dark:text-neutral-200">Cobros Totales Realizados</td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-sky-600 dark:text-sky-400">
                                {formatCurrency(processedData.totalCobros, currency)}
                              </td>
                              <td className="py-2.5 px-3 text-neutral-500">Recaudación global de cuotas, abonos y cobranza manual</td>
                            </tr>
                            <tr>
                              <td className="py-2.5 px-3 font-semibold text-neutral-800 dark:text-neutral-200">Cheques a Cancelarse en el Mes (Total Programado)</td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-neutral-700 dark:text-neutral-300">
                                {formatCurrency(processedData.totalChequesPeriodo, currency)}
                              </td>
                              <td className="py-2.5 px-3 text-neutral-500">{processedData.rawChecks.length} cheques con vencimiento en el mes</td>
                            </tr>
                            <tr>
                              <td className="py-2.5 px-3 font-semibold text-neutral-800 dark:text-neutral-200">Cheques Cancelados (Pagados)</td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-red-600 dark:text-red-400">
                                -{formatCurrency(processedData.totalChequesCancelados, currency)}
                              </td>
                              <td className="py-2.5 px-3 text-neutral-500">{processedData.chequesCancelados.length} cheques cancelados</td>
                            </tr>
                            <tr className="bg-neutral-50 dark:bg-neutral-800/70 font-bold border-t-2 border-neutral-200 dark:border-neutral-700">
                              <td className="py-3 px-3 uppercase text-neutral-900 dark:text-white">Balance Neto Estimado de Operación</td>
                              <td className={cn(
                                "py-3 px-3 text-right font-mono text-sm",
                                processedData.balanceNeto >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                              )}>
                                {formatCurrency(processedData.balanceNeto, currency)}
                              </td>
                              <td className="py-3 px-3 text-xs text-neutral-600 dark:text-neutral-400">
                                (Ventas Contado + Cobros) - Cheques Cancelados
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Cuadro 2: Ventas por Vendedor */}
                    <div className="space-y-2">
                      <h3 className="font-bold text-xs uppercase tracking-widest text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5">
                        <Store className="w-4 h-4" /> 2. Resumen de Ventas por Vendedor
                      </h3>
                      <div className="border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-x-auto bg-white dark:bg-neutral-900">
                        <table className="w-full text-xs">
                          <thead className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 border-b border-indigo-100 dark:border-indigo-900/50">
                            <tr>
                              <th className="py-2.5 px-3 text-left font-bold">Vendedor</th>
                              <th className="py-2.5 px-3 text-center font-bold">Motos Comb. (Uds)</th>
                              <th className="py-2.5 px-3 text-center font-bold">Motos Eléc. (Uds)</th>
                              <th className="py-2.5 px-3 text-center font-bold">Total Motos (Uds)</th>
                              <th className="py-2.5 px-3 text-center font-bold">Cont. / Créd.</th>
                              <th className="py-2.5 px-3 text-right font-bold">Total Artículos ($)</th>
                              <th className="py-2.5 px-3 text-right font-bold">Presupuesto ($)</th>
                              <th className="py-2.5 px-3 text-right font-bold">% Cump.</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                            {processedData.salesBySellerArray.length > 0 ? (
                              processedData.salesBySellerArray.map((s, idx) => (
                                <tr key={idx} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/40">
                                  <td className="py-2.5 px-3 font-semibold text-neutral-800 dark:text-neutral-200">{s.name}</td>
                                  <td className="py-2.5 px-3 text-center font-mono">{s.motosCombUds}</td>
                                  <td className="py-2.5 px-3 text-center font-mono">{s.motosElecUds}</td>
                                  <td className="py-2.5 px-3 text-center font-mono font-bold text-indigo-600 dark:text-indigo-400">{s.totalMotosUds}</td>
                                  <td className="py-2.5 px-3 text-center text-[10px] text-neutral-500 font-mono">
                                    {s.motosContadoUds} / {s.motosCreditoUds}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono font-bold">{formatCurrency(s.totalArticulosVal, currency)}</td>
                                  <td className="py-2.5 px-3 text-right font-mono text-neutral-500">{formatCurrency(s.salesBudget, currency)}</td>
                                  <td className="py-2.5 px-3 text-right font-bold text-indigo-600 dark:text-indigo-400">{s.pct}</td>
                                </tr>
                              ))
                            ) : (
                              <tr><td colSpan={8} className="py-3 text-center text-neutral-400 italic">Sin datos de ventas</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Cuadro 3: Cobranza por Cobrador */}
                    <div className="space-y-2">
                      <h3 className="font-bold text-xs uppercase tracking-widest text-sky-700 dark:text-sky-400 flex items-center gap-1.5">
                        <Receipt className="w-4 h-4" /> 3. Resumen de Cobranza por Cobrador
                      </h3>
                      <div className="border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-x-auto bg-white dark:bg-neutral-900">
                        <table className="w-full text-xs">
                          <thead className="bg-sky-50 dark:bg-sky-950/40 text-sky-900 dark:text-sky-200 border-b border-sky-100 dark:border-sky-900/50">
                            <tr>
                              <th className="py-2.5 px-3 text-left font-bold">Cobrador</th>
                              <th className="py-2.5 px-3 text-right font-bold">Agencia / Oficina ($)</th>
                              <th className="py-2.5 px-3 text-right font-bold">Transferencias ($)</th>
                              <th className="py-2.5 px-3 text-right font-bold">Efectivo Ruta ($)</th>
                              <th className="py-2.5 px-3 text-right font-bold">Total Cobrado ($)</th>
                              <th className="py-2.5 px-3 text-right font-bold">Presupuesto ($)</th>
                              <th className="py-2.5 px-3 text-right font-bold">% Cump.</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                            {processedData.collsByCollectorArray.length > 0 ? (
                              processedData.collsByCollectorArray.map((c, idx) => (
                                <tr key={idx} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/40">
                                  <td className="py-2.5 px-3 font-semibold text-neutral-800 dark:text-neutral-200">{c.name}</td>
                                  <td className="py-2.5 px-3 text-right font-mono text-neutral-600 dark:text-neutral-400">{formatCurrency(c.agencia, currency)}</td>
                                  <td className="py-2.5 px-3 text-right font-mono text-blue-600 dark:text-blue-400">{formatCurrency(c.transferencia, currency)}</td>
                                  <td className="py-2.5 px-3 text-right font-mono text-emerald-600 dark:text-emerald-400">{formatCurrency(c.efectivo, currency)}</td>
                                  <td className="py-2.5 px-3 text-right font-mono font-bold text-neutral-900 dark:text-neutral-100">{formatCurrency(c.total, currency)}</td>
                                  <td className="py-2.5 px-3 text-right font-mono text-neutral-500">{formatCurrency(c.budget, currency)}</td>
                                  <td className="py-2.5 px-3 text-right font-bold text-sky-600 dark:text-sky-400">{c.pct}</td>
                                </tr>
                              ))
                            ) : (
                              <tr><td colSpan={7} className="py-3 text-center text-neutral-400 italic">Sin datos de cobros</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Cuadro 4: Detalle de Cheques */}
                    {processedData.rawChecks.length > 0 && (
                      <div className="space-y-2">
                        <h3 className="font-bold text-xs uppercase tracking-widest text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                          <Banknote className="w-4 h-4" /> 4. Detalle de Cheques del Periodo
                        </h3>
                        <div className="border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-x-auto bg-white dark:bg-neutral-900 max-h-60">
                          <table className="w-full text-xs">
                            <thead className="bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 sticky top-0">
                              <tr>
                                <th className="py-2 px-3 text-left font-bold">Vencimiento</th>
                                <th className="py-2 px-3 text-left font-bold">Beneficiario</th>
                                <th className="py-2 px-3 text-left font-bold">Cheque #</th>
                                <th className="py-2 px-3 text-right font-bold">Monto ($)</th>
                                <th className="py-2 px-3 text-center font-bold">Estado</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                              {processedData.rawChecks.map((c, idx) => (
                                <tr key={idx} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/40">
                                  <td className="py-1.5 px-3 font-mono">{c.dueDate}</td>
                                  <td className="py-1.5 px-3 font-medium">{c.beneficiaryName}</td>
                                  <td className="py-1.5 px-3 font-mono text-neutral-500">{c.checkNumber}</td>
                                  <td className="py-1.5 px-3 text-right font-mono font-bold">{formatCurrency(c.amount, currency)}</td>
                                  <td className="py-1.5 px-3 text-center">
                                    <span className={cn(
                                      "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                                      c.status === 'PAID' ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300" : "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                                    )}>
                                      {c.status === 'PAID' ? 'Cancelado' : 'Pendiente'}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Cuadro 5: Detalle de Ventas si checkbox está activo */}
                    {detallarVentas && (
                      <div className="space-y-4 pt-2">
                        <div className="flex items-center gap-2">
                          <Store className="w-4 h-4 text-indigo-600" />
                          <h3 className="font-bold text-xs uppercase tracking-widest text-indigo-700 dark:text-indigo-400">
                            5. Detalle de Ventas Sectorizado por Vendedor
                          </h3>
                        </div>
                        {(Object.values(processedData.salesGroupedBySeller) as SellerGroup[]).map((sellerGroup: SellerGroup, idx: number) => (
                          <div key={idx} className="border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden bg-white dark:bg-neutral-900">
                            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 border-b border-indigo-100 dark:border-indigo-900/40 flex justify-between items-center text-xs font-bold text-indigo-900 dark:text-indigo-200">
                              <span>Vendedor: {sellerGroup.sellerName}</span>
                              <span className="font-mono">Total: {formatCurrency(sellerGroup.totalVal, currency)} ({sellerGroup.sales.length} ventas)</span>
                            </div>
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/40 text-neutral-500">
                                  <th className="py-2 px-3 text-left">Fecha</th>
                                  <th className="py-2 px-3 text-left">Nombre del Cliente</th>
                                  <th className="py-2 px-3 text-left">Artículo Vendido</th>
                                  <th className="py-2 px-3 text-center">Tipo</th>
                                  <th className="py-2 px-3 text-right">Valor Venta ($)</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                                {sellerGroup.sales.map((s: any, sIdx: number) => (
                                  <tr key={sIdx} className="hover:bg-neutral-50/50">
                                    <td className="py-1.5 px-3 font-mono text-neutral-500">{s.date}</td>
                                    <td className="py-1.5 px-3 font-medium text-neutral-900 dark:text-neutral-100">{s.clientName}</td>
                                    <td className="py-1.5 px-3 text-neutral-600 dark:text-neutral-300">{s.article}</td>
                                    <td className="py-1.5 px-3 text-center">
                                      <span className={cn(
                                        "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                                        s.type === 'contado' ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-blue-50 text-blue-700 border border-blue-200"
                                      )}>
                                        {s.type}
                                      </span>
                                    </td>
                                    <td className="py-1.5 px-3 text-right font-mono font-bold text-neutral-900 dark:text-neutral-100">{formatCurrency(s.totalValue, currency)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {/* 2. PREVIEW: VENTAS POR VENDEDOR / VENTAS POR TIPO */}
                {(reportType === 'VENTAS_VENDEDOR' || reportType === 'VENTAS_TIPO') && (
                  <div className="space-y-5">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-sm text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                        <Store className="w-4 h-4 text-indigo-600" />
                        Listado de Ventas Filtradas ({processedData.filteredSalesBySeller.length} registros encontrados)
                      </h3>
                      <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                        * Cero datos de cobranza incluidos
                      </span>
                    </div>

                    {(Object.values(processedData.salesGroupedBySeller) as SellerGroup[]).length > 0 ? (
                      (Object.values(processedData.salesGroupedBySeller) as SellerGroup[]).map((sellerGroup: SellerGroup, idx: number) => (
                        <div key={idx} className="border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden bg-white dark:bg-neutral-900">
                          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 border-b border-indigo-100 dark:border-indigo-900/40 flex flex-wrap justify-between items-center text-xs font-bold text-indigo-900 dark:text-indigo-200 gap-2">
                            <span>Vendedor: {sellerGroup.sellerName}</span>
                            <div className="flex items-center gap-3 font-mono text-[11px]">
                              <span>Contado: {formatCurrency(sellerGroup.totalContado, currency)}</span>
                              <span>Crédito: {formatCurrency(sellerGroup.totalCredito, currency)}</span>
                              <span className="bg-indigo-600 text-white px-2 py-0.5 rounded-lg text-xs">Total: {formatCurrency(sellerGroup.totalVal, currency)}</span>
                            </div>
                          </div>
                          <table className="w-full text-xs">
                            <thead className="bg-neutral-50 dark:bg-neutral-800/40 text-neutral-500 border-b border-neutral-100 dark:border-neutral-800">
                              <tr>
                                <th className="py-2 px-3 text-left">Fecha</th>
                                <th className="py-2 px-3 text-left">Nombre del Cliente</th>
                                <th className="py-2 px-3 text-left">Artículo Vendido</th>
                                <th className="py-2 px-3 text-center">Tipo de Venta</th>
                                <th className="py-2 px-3 text-right">Valor Venta ($)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                              {sellerGroup.sales.map((s: any, sIdx: number) => (
                                <tr key={sIdx} className="hover:bg-neutral-50/50">
                                  <td className="py-2 px-3 font-mono text-neutral-500">{s.date}</td>
                                  <td className="py-2 px-3 font-medium text-neutral-900 dark:text-neutral-100">{s.clientName}</td>
                                  <td className="py-2 px-3 text-neutral-600 dark:text-neutral-300">{s.article}</td>
                                  <td className="py-2 px-3 text-center">
                                    <span className={cn(
                                      "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                                      s.type === 'contado' ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-blue-50 text-blue-700 border border-blue-200"
                                    )}>
                                      {s.type}
                                    </span>
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono font-bold text-neutral-900 dark:text-neutral-100">{formatCurrency(s.totalValue, currency)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ))
                    ) : (
                      <div className="p-8 text-center text-neutral-400 text-xs italic bg-neutral-50 dark:bg-neutral-800/40 rounded-2xl border border-neutral-200 dark:border-neutral-700">
                        No se encontraron ventas para los filtros seleccionados.
                      </div>
                    )}
                  </div>
                )}

                {/* 3. PREVIEW: COBROS POR COBRADOR */}
                {reportType === 'COBROS_COBRADOR' && (
                  <div className="space-y-5">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-sm text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                        <Receipt className="w-4 h-4 text-sky-600" />
                        Listado de Cobranzas Filtradas ({processedData.filteredCollsByCollector.length} registros encontrados)
                      </h3>
                      <span className="text-xs font-bold text-sky-600 dark:text-sky-400">
                        * Cero datos de ventas incluidos
                      </span>
                    </div>

                    {(Object.values(processedData.collsGroupedByCollector) as CollectorGroup[]).length > 0 ? (
                      (Object.values(processedData.collsGroupedByCollector) as CollectorGroup[]).map((collGroup: CollectorGroup, idx: number) => (
                        <div key={idx} className="border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden bg-white dark:bg-neutral-900">
                          <div className="p-3 bg-sky-50 dark:bg-sky-950/40 border-b border-sky-100 dark:border-sky-900/40 flex flex-wrap justify-between items-center text-xs font-bold text-sky-900 dark:text-sky-200 gap-2">
                            <span>Cobrador: {collGroup.collectorName}</span>
                            <div className="flex items-center gap-3 font-mono text-[11px]">
                              <span>Agencia: {formatCurrency(collGroup.totalAgencia, currency)}</span>
                              <span>Transf: {formatCurrency(collGroup.totalTransferencia, currency)}</span>
                              <span>Efectivo: {formatCurrency(collGroup.totalEfectivo, currency)}</span>
                              <span className="bg-sky-600 text-white px-2 py-0.5 rounded-lg text-xs">Total: {formatCurrency(collGroup.totalVal, currency)}</span>
                            </div>
                          </div>
                          <table className="w-full text-xs">
                            <thead className="bg-neutral-50 dark:bg-neutral-800/40 text-neutral-500 border-b border-neutral-100 dark:border-neutral-800">
                              <tr>
                                <th className="py-2 px-3 text-left">Fecha / Periodo</th>
                                <th className="py-2 px-3 text-left">Comprobante / Origen</th>
                                <th className="py-2 px-3 text-left">Cliente / Referencia</th>
                                <th className="py-2 px-3 text-center">Modalidad de Pago</th>
                                <th className="py-2 px-3 text-right">Monto ($)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                              {collGroup.colls.map((c: any, cIdx: number) => (
                                <tr key={cIdx} className="hover:bg-neutral-50/50">
                                  <td className="py-2 px-3 font-mono text-neutral-500">{c.initialDate || c.paymentDate || c.date}</td>
                                  <td className="py-2 px-3 font-semibold text-neutral-800 dark:text-neutral-200">
                                    {c.noReceipt ? 'COBRO EN AGENCIA' : (c.receiptNumber ? `RECIBO ${c.receiptNumber}` : (c.initialReceipt ? `${c.initialReceipt} AL ${c.finalReceipt}` : 'RUTA'))}
                                  </td>
                                  <td className="py-2 px-3 text-neutral-600 dark:text-neutral-300">{c.clientName || 'Cliente'}</td>
                                  <td className="py-2 px-3 text-center">
                                    <span className={cn(
                                      "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                                      c.isTransfer ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    )}>
                                      {c.isTransfer ? 'Transferencia' : (c.paymentMethod || 'Efectivo')}
                                    </span>
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono font-bold text-neutral-900 dark:text-neutral-100">{formatCurrency(c.totalCollected || c.amount || 0, currency)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ))
                    ) : (
                      <div className="p-8 text-center text-neutral-400 text-xs italic bg-neutral-50 dark:bg-neutral-800/40 rounded-2xl border border-neutral-200 dark:border-neutral-700">
                        No se encontraron cobros para los filtros seleccionados.
                      </div>
                    )}
                  </div>
                )}

              </div>
            )}
          </div>
        </div>

        {/* Modal Sticky Footer */}
        <div className="p-4 sm:p-5 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 shrink-0 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-neutral-500 font-medium">
            Formato: <span className="font-bold text-neutral-700 dark:text-neutral-300">Horizontal (Landscape)</span> • Auto-ajuste de columnas por hoja
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3 w-full sm:w-auto justify-end">
            <button 
              type="button"
              onClick={() => setShowPreview(true)}
              className="px-4 py-2.5 bg-neutral-200 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 text-xs sm:text-sm rounded-xl font-bold hover:bg-neutral-300 dark:hover:bg-neutral-700 transition-all flex items-center gap-1.5"
            >
              <Eye className="w-4 h-4" />
              Vista Previa
            </button>
            <button 
              type="button"
              onClick={exportPDF}
              className="px-4 py-2.5 bg-indigo-600 text-white text-xs sm:text-sm rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-md hover:shadow-indigo-500/20 flex items-center gap-1.5 active:scale-95"
            >
              <FileText className="w-4 h-4" />
              Descargar PDF
            </button>
            <button 
              type="button"
              onClick={exportExcel}
              className="px-4 py-2.5 bg-emerald-600 text-white text-xs sm:text-sm rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-md hover:shadow-emerald-500/20 flex items-center gap-1.5 active:scale-95"
            >
              <Download className="w-4 h-4" />
              Descargar Excel
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
