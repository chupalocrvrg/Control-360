import React, { useState, useMemo } from 'react';
import { X, FileText, Download } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  allSales: any[];
  allCollections: any[];
  employees: any[];
}

export const MonthlyGeneralReportModal: React.FC<Props> = ({ isOpen, onClose, allSales, allCollections, employees }) => {
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-01'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [reportType, setReportType] = useState<'GENERAL' | 'VENTAS_VENDEDOR' | 'VENTAS_TIPO' | 'COBROS_COBRADOR'>('GENERAL');
  const [showPreview, setShowPreview] = useState(false);
  
  const [selectedSeller, setSelectedSeller] = useState('');
  const [selectedCollector, setSelectedCollector] = useState('');
  const [selectedSaleType, setSelectedSaleType] = useState('');

  // Reset preview on filter change
  useMemo(() => {
    setShowPreview(false);
  }, [startDate, endDate, reportType, selectedSeller, selectedCollector, selectedSaleType]);

  const filteredData = useMemo(() => {
    const start = parseISO(startDate).getTime();
    const end = parseISO(endDate).getTime();

    const sales = allSales.filter(s => {
      const d = parseISO(s.date).getTime();
      return d >= start && d <= end && 
             (selectedSeller ? s.employeeId === selectedSeller : true) &&
             (selectedSaleType ? s.type === selectedSaleType : true);
    });

    const collections = allCollections.filter(c => {
      const d = parseISO(c.initialDate).getTime();
      return d >= start && d <= end &&
             (selectedCollector ? c.employeeId === selectedCollector : true);
    });

    const salesByEmp = sales.reduce((acc: any, s: any) => {
      const emp = employees.find(e => e.id === s.employeeId);
      const empName = emp ? `${emp.name} ${emp.lastName}` : 'Sin Vendedor';
      if (!acc[empName]) acc[empName] = [];
      acc[empName].push(s);
      return acc;
    }, {});

    const collsByEmp = collections.reduce((acc: any, c: any) => {
      const emp = employees.find(e => e.id === c.employeeId);
      const empName = emp ? `${emp.name} ${emp.lastName}` : 'Sin Cobrador';
      if (!acc[empName]) acc[empName] = [];
      acc[empName].push(c);
      return acc;
    }, {});

    return { salesByEmp, collsByEmp };
  }, [allSales, allCollections, employees, startDate, endDate, selectedSeller, selectedCollector, selectedSaleType]);

  const exportPDF = () => {
    const doc = new jsPDF('landscape'); // Landscape orientation
    doc.setFontSize(14);
    doc.text(`Reporte Comercial (${startDate} - ${endDate})`, 14, 15);
    autoTable(doc, {
      head: [['Empleado', 'Tipo', 'Detalle', 'Valor']],
      body: [
        ...Object.entries(filteredData.salesByEmp).flatMap(([emp, sales]: any) => sales.map((s:any) => [emp, 'Venta', s.clientName, s.totalValue.toFixed(2)])),
        ...Object.entries(filteredData.collsByEmp).flatMap(([emp, colls]: any) => colls.map((c:any) => [emp, 'Cobro', 'Manual', c.totalCollected.toFixed(2)]))
      ],
      styles: { fontSize: 8, cellPadding: 2 }, // Smaller font and padding
      headStyles: { fillColor: [63, 81, 181] }, // Indigo color for header
      margin: { top: 25 },
    });
    doc.save('reporte.pdf');
  };

  const exportExcel = () => {
    const data = [
      ...Object.entries(filteredData.salesByEmp).flatMap(([emp, sales]: any) => sales.map((s:any) => ({Empleado: emp, Tipo: 'Venta', Cliente: s.clientName, Valor: s.totalValue}))),
      ...Object.entries(filteredData.collsByEmp).flatMap(([emp, colls]: any) => colls.map((c:any) => ({Empleado: emp, Tipo: 'Cobro', Detalle: 'Manual', Valor: c.totalCollected})))
    ];
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reporte");
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([wbout], {type: 'application/octet-stream'}), 'reporte.xlsx');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden">
        <div className="p-6 border-b border-neutral-100 dark:border-neutral-800 flex justify-between items-center shrink-0">
          <h2 className="text-lg font-bold">Reporte Comercial y Cartera Detallado</h2>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="p-2 border rounded-xl" />
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="p-2 border rounded-xl" />
            <select value={reportType} onChange={e => setReportType(e.target.value as any)} className="p-2 border rounded-xl">
              <option value="GENERAL">Reporte General</option>
              <option value="VENTAS_VENDEDOR">Ventas por Vendedor</option>
              <option value="VENTAS_TIPO">Ventas por Tipo</option>
              <option value="COBROS_COBRADOR">Cobros por Cobrador</option>
            </select>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <select value={selectedSeller} onChange={e => setSelectedSeller(e.target.value)} className="p-2 border rounded-xl text-sm">
                <option value="">Todos los Vendedores</option>
                {employees.filter(e => ['vendedor', 'ambos'].includes(e.role)).map(e => <option key={e.id} value={e.id}>{e.name} {e.lastName}</option>)}
            </select>
            <select value={selectedCollector} onChange={e => setSelectedCollector(e.target.value)} className="p-2 border rounded-xl text-sm">
                <option value="">Todos los Cobradores</option>
                {employees.filter(e => ['cobrador', 'ambos'].includes(e.role)).map(e => <option key={e.id} value={e.id}>{e.name} {e.lastName}</option>)}
            </select>
            <select value={selectedSaleType} onChange={e => setSelectedSaleType(e.target.value)} className="p-2 border rounded-xl text-sm">
                <option value="">Todos los Tipos de Venta</option>
                <option value="contado">Contado</option>
                <option value="credito">Crédito</option>
            </select>
          </div>

          <div id="report-results" className="space-y-6">
            {showPreview ? (
              <>
                {(reportType === 'GENERAL' || reportType === 'VENTAS_VENDEDOR' || reportType === 'VENTAS_TIPO') && (
                  Object.entries(filteredData.salesByEmp).map(([empName, sales]: any) => (
                    <div key={empName}>
                      <h3 className="font-bold text-sm bg-neutral-100 p-2 rounded-lg mb-2">Ventas: {empName}</h3>
                      <table className="w-full text-xs">
                        <thead><tr className="border-b"><th className="text-left py-1">Cliente</th><th className="text-left py-1">Art.</th><th className="text-left py-1">Tipo</th><th className="text-right py-1">Valor</th></tr></thead>
                        <tbody>{sales.map((s: any, i: number) => <tr key={i}><td className="py-1">{s.clientName}</td><td className="py-1">{s.article}</td><td className="py-1 uppercase">{s.type}</td><td className="text-right py-1">${s.totalValue?.toFixed(2)}</td></tr>)}</tbody>
                      </table>
                    </div>
                  ))
                )}
                
                {(reportType === 'GENERAL' || reportType === 'COBROS_COBRADOR') && (
                  Object.entries(filteredData.collsByEmp).map(([empName, colls]: any) => (
                    <div key={empName}>
                      <h3 className="font-bold text-sm bg-emerald-50 p-2 rounded-lg mb-2">Cobros: {empName}</h3>
                      <table className="w-full text-xs">
                        <thead><tr className="border-b"><th className="text-left py-1">Detalle</th><th className="text-right py-1">Total</th></tr></thead>
                        <tbody>{colls.map((c: any, i: number) => <tr key={i}><td className="py-1">Cobro Manual / Ruta</td><td className="text-right py-1">${c.totalCollected?.toFixed(2)}</td></tr>)}</tbody>
                      </table>
                    </div>
                  ))
                )}
              </>
            ) : (
              <p className="text-center text-neutral-400 py-10">Haz clic en "Generar Vista Previa" para mostrar el reporte.</p>
            )}
          </div>
        </div>

        {/* Sticky Footer for Controls */}
        <div className="p-6 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 shrink-0 flex items-center justify-end gap-3">
          <button 
            onClick={() => setShowPreview(true)}
            className="bg-neutral-200 text-neutral-800 px-6 py-3 rounded-xl font-bold hover:bg-neutral-300 transition-all"
          >
            Generar Vista Previa
          </button>
          <button 
            onClick={exportPDF}
            disabled={!showPreview}
            className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2"
          >
            <FileText className="w-4 h-4"/> PDF
          </button>
          <button 
            onClick={exportExcel}
            disabled={!showPreview}
            className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-emerald-700 transition-all disabled:opacity-50 flex items-center gap-2"
          >
            <Download className="w-4 h-4"/> Excel
          </button>
        </div>
      </div>
    </div>
  );
};
