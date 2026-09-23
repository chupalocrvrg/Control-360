import React, { useState } from 'react';
import { X, Download, FileSpreadsheet, FileText, Calendar, Filter, Loader2, CheckCircle2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNotification } from '../../contexts/NotificationContext';

export interface PortfolioRecordExport {
  clientName: string;
  identification?: string;
  operationNumber?: string;
  collectorName?: string;
  amount: number;
  overdueDays: number;
  dueDate?: string;
  phone?: string;
  address?: string;
  status?: string;
  itemSold?: string;
}

interface PortfolioExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: PortfolioRecordExport[];
  enterpriseName?: string;
}

export default function PortfolioExportModal({
  isOpen,
  onClose,
  records,
  enterpriseName = 'Control Financiero 360'
}: PortfolioExportModalProps) {
  const { showToast } = useNotification();
  
  const [exportType, setExportType] = useState<'a_la_fecha' | 'adelantada'>('a_la_fecha');
  const [exportFormat, setExportFormat] = useState<'xlsx' | 'pdf'>('xlsx');
  const [cutoffDate, setCutoffDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen) return null;

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const targetCutoff = new Date(cutoffDate + 'T23:59:59');
      const todayStr = format(new Date(), 'yyyy-MM-dd');

      // Filter records according to exportType and cutoffDate
      let filteredRecords = records.filter(r => {
        const recordDueDateStr = r.dueDate || todayStr;
        const isOverdueOrToday = r.overdueDays > 0 || recordDueDateStr <= todayStr;

        if (exportType === 'a_la_fecha') {
          // Cartera a la Fecha: Clientes con atraso o cuya fecha de cobro es <= hoy
          return isOverdueOrToday;
        } else {
          // Cartera Adelantada: Clientes que van adelantados o con fecha de pago <= fecha de corte seleccionada
          return recordDueDateStr <= cutoffDate;
        }
      });

      if (filteredRecords.length === 0) {
        showToast('No existen clientes en la cartera para los criterios seleccionados.', 'warning');
        setIsExporting(false);
        return;
      }

      const reportTitle = exportType === 'a_la_fecha' 
        ? 'Reporte de Cartera a la Fecha (Saldos Vencidos y Al Día Hoy)' 
        : `Reporte de Cartera Adelantada Proyectada al ${format(targetCutoff, 'dd/MM/yyyy')}`;

      const fileName = `Cartera_${exportType}_${format(new Date(), 'yyyyMMdd_HHmm')}`;

      if (exportFormat === 'xlsx') {
        const dataForExcel = filteredRecords.map((r, i) => ({
          'N°': i + 1,
          'Cliente': r.clientName,
          'Cédula / RUC': r.identification || '-',
          'N° Operación / Pagaré': r.operationNumber || '-',
          'Gestor / Cobrador': r.collectorName || 'Sin Asignar',
          'Teléfono': r.phone || '-',
          'Dirección': r.address || '-',
          'Fecha Vencimiento': r.dueDate || '-',
          'Días Atraso': r.overdueDays > 0 ? `${r.overdueDays} días` : 'Al día',
          'Saldo Adeudado ($)': r.amount.toFixed(2)
        }));

        const worksheet = XLSX.utils.json_to_sheet(dataForExcel);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Cartera');
        XLSX.writeFile(workbook, `${fileName}.xlsx`);

        showToast(`Cartera exportada a Excel (${filteredRecords.length} registros)`, 'success');
      } else {
        // Export PDF
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(enterpriseName, 14, 15);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(reportTitle, 14, 21);
        doc.text(`Fecha de Emisión: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 280, 15, { align: 'right' });

        const totalAmount = filteredRecords.reduce((acc, r) => acc + r.amount, 0);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text(`Total Clientes: ${filteredRecords.length}   |   Total Cartera Filtrada: $${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 14, 27);

        const tableHead = [['#', 'Cliente', 'Cédula', 'Gestor', 'Teléfono', 'F. Vencimiento', 'Días Atraso', 'Saldo ($)']];
        const tableBody = filteredRecords.map((r, i) => [
          i + 1,
          r.clientName,
          r.identification || '-',
          r.collectorName || 'Sin Asignar',
          r.phone || '-',
          r.dueDate || '-',
          r.overdueDays > 0 ? `${r.overdueDays}d` : 'Al día',
          `$${r.amount.toFixed(2)}`
        ]);

        autoTable(doc, {
          startY: 32,
          head: tableHead,
          body: tableBody,
          theme: 'striped',
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold' },
          columnStyles: {
            0: { cellWidth: 10 },
            1: { cellWidth: 65 },
            2: { cellWidth: 30 },
            3: { cellWidth: 45 },
            4: { cellWidth: 30 },
            5: { cellWidth: 30 },
            6: { cellWidth: 25 },
            7: { cellWidth: 30, halign: 'right', fontStyle: 'bold' }
          }
        });

        doc.save(`${fileName}.pdf`);
        showToast(`Reporte PDF de Cartera generado (${filteredRecords.length} registros)`, 'success');
      }

      onClose();
    } catch (err: any) {
      console.error('Error al exportar cartera:', err);
      showToast('Ocurrió un error al generar la exportación de cartera.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-neutral-900 w-full max-w-xl rounded-3xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-indigo-600 to-violet-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-2xl backdrop-blur-md">
              <Download className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight">Exportar Cartera de Clientes</h3>
              <p className="text-xs text-indigo-100 font-medium">Filtro de Cartera a la Fecha y Cartera Adelantada</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Tipo de Cartera */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Filter className="w-4 h-4 text-indigo-500" />
              <span>Modalidad de Cartera a Exportar:</span>
            </label>
            <div className="grid grid-cols-2 gap-4">
              <div
                onClick={() => setExportType('a_la_fecha')}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col gap-2 ${
                  exportType === 'a_la_fecha'
                    ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-200'
                    : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black">1. Cartera a la Fecha</span>
                  {exportType === 'a_la_fecha' && <CheckCircle2 className="w-4 h-4 text-indigo-600" />}
                </div>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium leading-relaxed">
                  Clientes con saldos vencidos o con fecha de pago al día de hoy.
                </p>
              </div>

              <div
                onClick={() => setExportType('adelantada')}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col gap-2 ${
                  exportType === 'adelantada'
                    ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-200'
                    : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black">2. Cartera Adelantada</span>
                  {exportType === 'adelantada' && <CheckCircle2 className="w-4 h-4 text-indigo-600" />}
                </div>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium leading-relaxed">
                  Clientes al día o compras nuevas que pagarán hasta una fecha de corte.
                </p>
              </div>
            </div>
          </div>

          {/* Fecha de Corte (Si es Adelantada) */}
          {exportType === 'adelantada' && (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl space-y-2 animate-in fade-in duration-200">
              <label className="block text-xs font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-600" />
                <span>Seleccionar Fecha de Corte Futura:</span>
              </label>
              <input
                type="date"
                value={cutoffDate}
                onChange={(e) => setCutoffDate(e.target.value)}
                className="w-full px-4 py-2.5 bg-white dark:bg-neutral-900 border border-amber-300 dark:border-amber-800 rounded-xl text-xs font-bold text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">
                Incluirá todos los clientes cuyo vencimiento sea menor o igual al {format(new Date(cutoffDate + 'T00:00:00'), 'dd/MM/yyyy')}.
              </p>
            </div>
          )}

          {/* Formato de Descarga */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-3">
              Seleccione el Formato de Salida:
            </label>
            <div className="grid grid-cols-2 gap-4">
              <div
                onClick={() => setExportFormat('xlsx')}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-center gap-3 ${
                  exportFormat === 'xlsx'
                    ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300'
                    : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300'
                }`}
              >
                <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
                <span className="text-xs font-black">Excel (.xlsx)</span>
              </div>

              <div
                onClick={() => setExportFormat('pdf')}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-center gap-3 ${
                  exportFormat === 'pdf'
                    ? 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300'
                    : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300'
                }`}
              >
                <FileText className="w-6 h-6 text-rose-600" />
                <span className="text-xs font-black">Documento PDF</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 bg-neutral-50 dark:bg-neutral-800/50 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/50 dark:hover:bg-neutral-700 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/20 flex items-center gap-2"
          >
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span>Exportar Cartera ({exportFormat.toUpperCase()})</span>
          </button>
        </div>
      </div>
    </div>
  );
}
