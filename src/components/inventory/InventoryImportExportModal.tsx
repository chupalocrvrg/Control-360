import React, { useState } from 'react';
import { Article, Warehouse } from '../../types/inventory';
import { db } from '../../firebase';
import { collection, doc, writeBatch, Timestamp } from 'firebase/firestore';
import { X, Upload, Download, FileSpreadsheet, FileText, CheckCircle2, AlertTriangle, Loader2, Sparkles, Building2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNotification } from '../../contexts/NotificationContext';
import * as pdfjsLib from 'pdfjs-dist';

// Configure pdfjs worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export interface ParsedInventoryItem {
  code: string;
  description: string;
  line: string;
  reference?: string;
  characteristic?: string;
  size?: string;
  unit?: string;
  quantity: number;
}

interface InventoryImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'import' | 'export';
  articles: Article[];
  warehouses: Warehouse[];
  currentEnterpriseId: string;
  onRefresh: () => void;
}

export default function InventoryImportExportModal({
  isOpen,
  onClose,
  mode,
  articles,
  warehouses,
  currentEnterpriseId,
  onRefresh
}: InventoryImportExportModalProps) {
  const { showToast } = useNotification();
  const [activeTab, setActiveTab] = useState<'import' | 'export'>(mode);

  // Import State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedItems, setParsedItems] = useState<ParsedInventoryItem[]>([]);
  const [targetWarehouseId, setTargetWarehouseId] = useState<string>(warehouses[0]?.id || '');
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Export State
  const [exportFormat, setExportFormat] = useState<'xlsx' | 'pdf'>('xlsx');
  const [isExporting, setIsExporting] = useState(false);

  // Sync tab mode when opened
  React.useEffect(() => {
    if (!isOpen) return;
    setActiveTab(mode);
    if (warehouses.length > 0 && !targetWarehouseId) {
      setTargetWarehouseId(warehouses[0].id);
    }
  }, [isOpen, mode, warehouses, targetWarehouseId]);

  if (!isOpen) return null;

  // Handle file drop / select
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setIsParsing(true);
    setParsedItems([]);

    try {
      const extension = file.name.split('.').pop()?.toLowerCase();

      if (extension === 'xlsx' || extension === 'xls') {
        await parseExcelFile(file);
      } else if (extension === 'pdf') {
        await parsePDFFile(file);
      } else if (extension === 'xml') {
        await parseXMLInvoiceFile(file);
      } else {
        showToast('Formato no soportado. Por favor suba un archivo .xlsx, .xls, .pdf o .xml', 'error');
      }
    } catch (err: any) {
      console.error('Error al parsear archivo de inventario:', err);
      showToast('No se pudo procesar el archivo. Verifique el formato e intente nuevamente.', 'error');
    } finally {
      setIsParsing(false);
    }
  };

  // Parse Excel Files (.xlsx, .xls)
  const parseExcelFile = async (file: File) => {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    // Convert sheet to json matrix
    const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
    const parsed: ParsedInventoryItem[] = [];

    // Detect header row index
    let startRowIndex = 0;
    for (let i = 0; i < Math.min(rows.length, 15); i++) {
      const rowStr = (rows[i] || []).join(' ').toLowerCase();
      if (rowStr.includes('código') || rowStr.includes('codigo') || rowStr.includes('descripción') || rowStr.includes('descripcion') || rowStr.includes('existencia')) {
        startRowIndex = i + 1;
        break;
      }
    }

    for (let i = startRowIndex; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const code = String(row[0] || '').trim();
      const description = String(row[1] || '').trim();
      const line = String(row[2] || '').trim();
      const reference = String(row[3] || '').trim();
      const characteristic = String(row[4] || '').trim();
      const size = String(row[5] || '').trim();
      const unit = String(row[6] || '').trim();
      const qtyRaw = row[7] !== undefined && row[7] !== null ? row[7] : row[row.length - 1];

      let quantity = typeof qtyRaw === 'number' ? qtyRaw : parseFloat(String(qtyRaw || '0').replace(',', '.'));
      if (isNaN(quantity)) quantity = 0;

      if (code || description) {
        parsed.push({
          code,
          description: description || 'Artículo Importado',
          line,
          reference,
          characteristic,
          size,
          unit,
          quantity
        });
      }
    }

    setParsedItems(parsed);
    showToast(`Se extrajeron ${parsed.length} artículos del archivo Excel`, 'success');
  };

  // Parse PDF Files (.pdf)
  const parsePDFFile = async (file: File) => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const parsed: ParsedInventoryItem[] = [];

    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const textContent = await page.getTextContent();
      
      // Group items by vertical position (Y coordinate)
      const linesMap = new Map<number, { x: number; text: string }[]>();
      
      textContent.items.forEach((item: any) => {
        if ('str' in item && item.str.trim()) {
          const y = Math.round(item.transform[5]);
          const x = item.transform[4];
          if (!linesMap.has(y)) linesMap.set(y, []);
          linesMap.get(y)!.push({ x, text: item.str.trim() });
        }
      });

      // Sort lines top to bottom
      const sortedYs = Array.from(linesMap.keys()).sort((a, b) => b - a);

      for (const y of sortedYs) {
        const lineItems = linesMap.get(y)!.sort((a, b) => a.x - b.x);
        const fullLineStr = lineItems.map(i => i.text).join(' ');

        // Skip header lines
        if (fullLineStr.includes('Código') || fullLineStr.includes('Descripción') || fullLineStr.includes('Toma Física') || fullLineStr.includes('RUC')) {
          continue;
        }

        // Check if line starts with code (digits/letters) and ends with a number (stock existence)
        const codeToken = lineItems[0]?.text || '';
        const lastToken = lineItems[lineItems.length - 1]?.text || '0';
        
        let quantity = parseFloat(lastToken.replace(',', '.'));
        if (isNaN(quantity)) {
          // Check if second to last token is the quantity
          const secondLast = lineItems[lineItems.length - 2]?.text || '0';
          quantity = parseFloat(secondLast.replace(',', '.'));
        }

        if (!isNaN(quantity) && codeToken.length >= 3) {
          // Extract description and category line
          let description = '';
          let lineCategory = '';

          if (lineItems.length >= 3) {
            description = lineItems.slice(1, lineItems.length - 1).map(i => i.text).join(' ');
            if (lineItems.length >= 4) {
              lineCategory = lineItems[lineItems.length - 2].text;
            }
          }

          if (codeToken && description) {
            parsed.push({
              code: codeToken,
              description: description,
              line: lineCategory,
              quantity: isNaN(quantity) ? 0 : quantity
            });
          }
        }
      }
    }

    setParsedItems(parsed);
    if (parsed.length > 0) {
      showToast(`Se extrajeron ${parsed.length} artículos del PDF`, 'success');
    } else {
      showToast('No se detectaron tablas de inventario en el PDF. Intente con Excel o XML.', 'warning');
    }
  };

  // Parse Factura Electrónica XML (SRI Ecuador y estándar comprobantes electrónicos)
  const parseXMLInvoiceFile = async (file: File) => {
    const text = await file.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(text, 'text/xml');

    // Check for parse error
    const parserError = xmlDoc.querySelector('parsererror');
    if (parserError) {
      throw new Error('El archivo XML no tiene un formato válido.');
    }

    // SRI standard: <detalle> or <detalles><detalle>
    const detalles = xmlDoc.querySelectorAll('detalle');
    const parsed: ParsedInventoryItem[] = [];

    detalles.forEach(det => {
      const codigoPrincipal = det.querySelector('codigoPrincipal')?.textContent?.trim() || 
                             det.querySelector('codigoInterno')?.textContent?.trim() || 
                             det.querySelector('codigo')?.textContent?.trim() || '';
      
      const descripcion = det.querySelector('descripcion')?.textContent?.trim() || 
                          det.querySelector('nombre')?.textContent?.trim() || '';

      const cantidadRaw = det.querySelector('cantidad')?.textContent?.trim() || '1';
      let cantidad = parseFloat(cantidadRaw.replace(',', '.'));
      if (isNaN(cantidad)) cantidad = 1;

      if (descripcion || codigoPrincipal) {
        parsed.push({
          code: codigoPrincipal,
          description: descripcion || 'Ítem Factura',
          line: 'Factura Compra',
          quantity: cantidad
        });
      }
    });

    if (parsed.length === 0) {
      // Intentar buscar tags genéricos como <item>, <producto>, <linea>
      const genericItems = xmlDoc.querySelectorAll('item, producto, lineItem');
      genericItems.forEach(item => {
        const code = item.querySelector('code, id, codigo')?.textContent?.trim() || '';
        const name = item.querySelector('name, descripcion, description')?.textContent?.trim() || '';
        const qty = parseFloat((item.querySelector('qty, quantity, cantidad')?.textContent?.trim() || '1').replace(',', '.'));
        if (name || code) {
          parsed.push({
            code,
            description: name || 'Ítem Importado',
            line: 'Factura Compra',
            quantity: isNaN(qty) ? 1 : qty
          });
        }
      });
    }

    setParsedItems(parsed);
    if (parsed.length > 0) {
      showToast(`Factura electrónica XML procesada: ${parsed.length} artículos extraídos`, 'success');
    } else {
      showToast('No se encontraron ítems o detalles en el archivo XML de factura.', 'warning');
    }
  };

  // Confirm Import into Firestore
  const handleConfirmImport = async () => {
    if (parsedItems.length === 0) return;
    if (!targetWarehouseId) {
      showToast('Por favor seleccione una bodega de destino', 'warning');
      return;
    }

    setIsImporting(true);
    try {
      const batch = writeBatch(db);
      let countNew = 0;
      let countUpdated = 0;

      for (const item of parsedItems) {
        // Find if article exists by barcode/code or exact description
        const existingArt = articles.find(a => 
          (a.barcode && a.barcode === item.code) ||
          (a.name && a.name.toLowerCase() === item.description.toLowerCase())
        );

        let articleId = existingArt?.id;

        if (!existingArt) {
          // Create new article doc
          const artRef = doc(collection(db, 'articles'));
          articleId = artRef.id;

          batch.set(artRef, {
            name: item.description,
            category: item.line || 'General',
            barcode: item.code,
            quantity: item.quantity, // can be negative!
            minStockAlert: 5,
            requiresSeries: false,
            createdAt: Timestamp.now(),
            userId: currentEnterpriseId,
            enterpriseId: currentEnterpriseId
          });
          countNew++;
        } else {
          // Update global article quantity
          const artRef = doc(db, 'articles', existingArt.id);
          batch.update(artRef, {
            quantity: item.quantity
          });
          countUpdated++;
        }

        // Set or update warehouse_inventory
        const invId = `${targetWarehouseId}_${articleId}`;
        const invRef = doc(db, 'warehouse_inventory', invId);
        batch.set(invRef, {
          id: invId,
          warehouseId: targetWarehouseId,
          articleId: articleId,
          quantity: item.quantity, // can be negative!
          userId: currentEnterpriseId,
          enterpriseId: currentEnterpriseId
        }, { merge: true });
      }

      await batch.commit();
      showToast(`Importación exitosa: ${countNew} nuevos y ${countUpdated} actualizados`, 'success');
      onRefresh();
      onClose();
    } catch (err: any) {
      console.error('Error al guardar importación en Firestore:', err);
      showToast('Ocurrió un error al guardar los inventarios.', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  // Export Inventory (Excel or PDF)
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const exportData = articles.map(art => {
        return {
          'Código': art.barcode || art.id.slice(0, 8),
          'Descripción': art.name,
          'Línea': art.category || 'General',
          'Referencia': art.brand || '',
          'Característica': art.model || '',
          'Tamaño': '',
          'Unidad': 'Uds',
          'Existencia': art.quantity.toFixed(2)
        };
      });

      const fileName = `Inventario_TomaFisica_${format(new Date(), 'ddMMyyyy')}`;

      if (exportFormat === 'xlsx') {
        // Create Excel Workbook
        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Toma Física');
        
        // Save Excel file
        XLSX.writeFile(workbook, `${fileName}.xlsx`);
        showToast('Inventario exportado a Excel con éxito', 'success');
      } else {
        // Create PDF Document matching user screenshot format
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

        // Header Title
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('RUC: 0302370432001', 14, 15);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text('Dirección: AV ALFONSO ANDRADE Y CALLE DEL ARTESANO', 14, 19);
        doc.text('Teléfono: 072422025    Fax: 987045405', 14, 23);

        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(`Inventario - Toma Física al ${format(new Date(), "dd/MMM/yyyy", { locale: es })}`, 105, 30, { align: 'center' });

        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(`Fecha Impresión: ${format(new Date(), 'dd/MM/yyyy')}`, 196, 15, { align: 'right' });

        // Table Columns
        const headers = [['Código', 'Descripción', 'Línea', 'Referencia', 'Característica', 'Tamaño', 'Unidad', 'Existencia']];
        const body = articles.map(art => [
          art.barcode || art.id.slice(0, 8),
          art.name,
          art.category || '',
          art.brand || '',
          art.model || '',
          '',
          'Uds',
          art.quantity.toFixed(2)
        ]);

        autoTable(doc, {
          startY: 35,
          head: headers,
          body: body,
          theme: 'plain',
          styles: {
            fontSize: 7.5,
            cellPadding: 1.5,
            textColor: [40, 40, 40]
          },
          headStyles: {
            fontStyle: 'bold',
            fillColor: [240, 240, 240],
            textColor: [0, 0, 0],
            lineWidth: 0.2,
            lineColor: [180, 180, 180]
          },
          columnStyles: {
            0: { cellWidth: 22 },
            1: { cellWidth: 60 },
            2: { cellWidth: 25 },
            3: { cellWidth: 20 },
            4: { cellWidth: 20 },
            5: { cellWidth: 15 },
            6: { cellWidth: 12 },
            7: { cellWidth: 20, halign: 'right', fontStyle: 'bold' }
          }
        });

        doc.save(`${fileName}.pdf`);
        showToast('Reporte PDF de Toma Física generado con éxito', 'success');
      }
      onClose();
    } catch (err: any) {
      console.error('Error al exportar inventario:', err);
      showToast('Ocurrió un error al generar el archivo.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-neutral-900 w-full max-w-3xl rounded-3xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Tabs */}
        <div className="p-5 bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('import')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'import'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100'
              }`}
            >
              <Upload className="w-4 h-4" />
              <span>Importar Inventario</span>
            </button>
            <button
              onClick={() => setActiveTab('export')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'export'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100'
              }`}
            >
              <Download className="w-4 h-4" />
              <span>Exportar Toma Física</span>
            </button>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 rounded-xl hover:bg-neutral-200/50 dark:hover:bg-neutral-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {activeTab === 'import' ? (
            <div className="space-y-6">
              {/* Warehouse Selection */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-indigo-500" />
                  <span>Bodega de Destino para el Stock:</span>
                </label>
                <select
                  value={targetWarehouseId}
                  onChange={(e) => setTargetWarehouseId(e.target.value)}
                  className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl text-xs font-bold text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-indigo-500"
                >
                  {warehouses.map(wh => (
                    <option key={wh.id} value={wh.id}>{wh.name} ({wh.assignedPerson || 'Principal'})</option>
                  ))}
                </select>
              </div>

              {/* Upload Drop Zone */}
              <div className="border-2 border-dashed border-neutral-300 dark:border-neutral-700 hover:border-indigo-500 dark:hover:border-indigo-400 transition-colors rounded-3xl p-8 text-center bg-neutral-50/50 dark:bg-neutral-800/30">
                <input
                  type="file"
                  accept=".xlsx, .xls, .pdf, .xml"
                  onChange={handleFileChange}
                  className="hidden"
                  id="inventory-file-input"
                />
                <label htmlFor="inventory-file-input" className="cursor-pointer flex flex-col items-center justify-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    {isParsing ? <Loader2 className="w-7 h-7 animate-spin" /> : <Upload className="w-7 h-7" />}
                  </div>
                  <div>
                    <span className="text-sm font-bold text-neutral-800 dark:text-neutral-100 block">
                      {selectedFile ? selectedFile.name : 'Haga clic o arrastre un archivo (.xlsx, .xls, .pdf, .xml)'}
                    </span>
                    <span className="text-xs text-neutral-400 mt-1 block">
                      Admite reportes de toma física Excel/PDF y Facturas Electrónicas XML (SRI) para carga rápida de artículos.
                    </span>
                  </div>
                </label>
              </div>

              {/* Parsed Preview Table */}
              {parsedItems.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      Vista Previa de Artículos Extraídos ({parsedItems.length}):
                    </span>
                  </div>

                  <div className="max-h-60 overflow-y-auto border border-neutral-200 dark:border-neutral-800 rounded-2xl divide-y divide-neutral-100 dark:divide-neutral-800 bg-white dark:bg-neutral-900">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-neutral-50 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 font-bold">
                          <th className="p-3">Código</th>
                          <th className="p-3">Descripción</th>
                          <th className="p-3">Línea</th>
                          <th className="p-3 text-right">Existencia</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                        {parsedItems.map((item, i) => (
                          <tr key={i} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/40">
                            <td className="p-3 font-mono font-bold text-neutral-600 dark:text-neutral-400">{item.code || '-'}</td>
                            <td className="p-3 font-bold text-neutral-800 dark:text-neutral-200">{item.description}</td>
                            <td className="p-3 text-neutral-500">{item.line || 'General'}</td>
                            <td className="p-3 text-right">
                              <span className={`px-2.5 py-1 rounded-lg font-black text-xs ${
                                item.quantity < 0 
                                  ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400' 
                                  : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
                              }`}>
                                {item.quantity} uds
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Export Tab */
            <div className="space-y-6">
              <div className="p-4 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/50 rounded-2xl text-xs text-indigo-800 dark:text-indigo-300 font-medium leading-relaxed">
                📄 La exportación de <strong>Toma Física</strong> genera el reporte detallado con las columnas estándar de inventario (Código, Descripción, Línea, Referencia, Característica, Unidad, Existencia).
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-3">
                  Seleccione el formato de exportación:
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <div
                    onClick={() => setExportFormat('xlsx')}
                    className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex flex-col items-center gap-3 ${
                      exportFormat === 'xlsx'
                        ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300'
                        : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300'
                    }`}
                  >
                    <FileSpreadsheet className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-xs font-black">Excel (.xlsx)</span>
                  </div>

                  <div
                    onClick={() => setExportFormat('pdf')}
                    className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex flex-col items-center gap-3 ${
                      exportFormat === 'pdf'
                        ? 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300'
                        : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300'
                    }`}
                  >
                    <FileText className="w-8 h-8 text-rose-600 dark:text-rose-400" />
                    <span className="text-xs font-black">Reporte PDF Imprimible</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-5 bg-neutral-50 dark:bg-neutral-800/50 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/50 dark:hover:bg-neutral-700 transition-colors"
          >
            Cancelar
          </button>

          {activeTab === 'import' ? (
            <button
              onClick={handleConfirmImport}
              disabled={parsedItems.length === 0 || isImporting}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/20 flex items-center gap-2"
            >
              {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              <span>Confirmar e Importar {parsedItems.length} Ítems</span>
            </button>
          ) : (
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/20 flex items-center gap-2"
            >
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span>Generar {exportFormat.toUpperCase()}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
