import React, { useRef } from 'react';
import { Printer, X, Download, Package, CheckCircle2, FileText, Store, User, Building, MapPin, Phone, ShieldCheck } from 'lucide-react';
import { printElement, downloadElementAsPdf } from '../../lib/printUtils';
import { formatCurrency } from '../../lib/utils';

export interface CashSaleLetterData {
  saleId: string;
  saleDate: string;
  clientName: string;
  clientIdCard?: string;
  clientPhone?: string;
  clientAddress?: string;
  clientCity?: string;
  sellerName: string;
  warehouseName: string;
  articleName: string;
  articleCode?: string;
  brand?: string;
  model?: string;
  seriesList?: string[];
  quantity: number;
  unitPrice: number;
  subtotal: number;
  discountType?: string;
  discountAmount?: number;
  totalAmount: number;
  isMoto?: boolean;
  motoDetails?: {
    chassis?: string;
    engine?: string;
    color?: string;
    year?: string;
    cylinderCapacity?: string;
  };
}

interface CashSaleLetterPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: CashSaleLetterData | null;
  companyName?: string;
  companyRuc?: string;
  companyAddress?: string;
  companyPhone?: string;
}

export const CashSaleLetterPrintModal: React.FC<CashSaleLetterPrintModalProps> = ({
  isOpen,
  onClose,
  data,
  companyName = 'ALMACENES DERICK',
  companyRuc = '1790012345001',
  companyAddress = 'Av. Principal y Secundaria, Ecuador',
  companyPhone = '0999999999'
}) => {
  const printAreaRef = useRef<HTMLDivElement>(null);
  const [isExportingPdf, setIsExportingPdf] = React.useState(false);

  if (!isOpen || !data) return null;

  const handlePrint = async () => {
    if (printAreaRef.current) {
      await printElement(printAreaRef.current, {
        title: `Carta_de_Venta_${data.saleId.slice(0, 8).toUpperCase()}`,
        pageFormat: 'A4'
      });
    } else {
      window.print();
    }
  };

  const handleDownloadPdf = async () => {
    if (!printAreaRef.current) return;
    try {
      setIsExportingPdf(true);
      await downloadElementAsPdf(
        printAreaRef.current,
        `Carta_de_Venta_${data.saleId.slice(0, 8).toUpperCase()}.pdf`
      );
    } catch (err) {
      console.error('Error generando PDF de carta de venta:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const receiptNumber = `CVC-${data.saleId.slice(0, 8).toUpperCase()}`;

  return (
    <div className="fixed inset-0 z-[160] bg-black/70 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Top Control Bar */}
        <div className="px-6 py-4 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                Carta de Venta al Contado
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {receiptNumber}
                </span>
              </h2>
              <p className="text-xs text-neutral-400">Comprobante oficial de transferencia de dominio y entrega directa</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPdf}
              disabled={isExportingPdf}
              className="px-3.5 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border border-neutral-700 disabled:opacity-50"
            >
              <Download className="w-4 h-4 text-indigo-400" />
              <span>{isExportingPdf ? 'Exportando...' : 'Descargar PDF'}</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-emerald-600/20"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Carta de Venta</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-xl transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Area Container */}
        <div className="flex-1 overflow-y-auto p-6 bg-neutral-950/50 flex justify-center">
          <div
            ref={printAreaRef}
            className="w-full max-w-[210mm] bg-white text-neutral-900 p-8 sm:p-10 shadow-2xl rounded-2xl font-sans print:shadow-none print:p-0 print:w-full"
            style={{ minHeight: '297mm' }}
          >
            {/* Header Document */}
            <div className="flex justify-between items-start border-b-2 border-neutral-900 pb-6 mb-6">
              <div className="space-y-1">
                <h1 className="text-2xl font-black tracking-tight text-neutral-900 uppercase">
                  {companyName}
                </h1>
                <p className="text-xs font-bold text-neutral-600">RUC: {companyRuc}</p>
                <p className="text-xs text-neutral-500">{companyAddress}</p>
                <p className="text-xs text-neutral-500">Telf: {companyPhone}</p>
              </div>

              <div className="text-right space-y-1">
                <div className="inline-block bg-neutral-900 text-white px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider">
                  CARTA DE VENTA AL CONTADO
                </div>
                <p className="text-sm font-black text-emerald-700 font-mono mt-1">{receiptNumber}</p>
                <p className="text-xs font-medium text-neutral-500">
                  Fecha de Emisión: <span className="font-bold text-neutral-800">{data.saleDate}</span>
                </p>
                <p className="text-xs font-medium text-neutral-500">
                  Bodega de Origen: <span className="font-bold text-neutral-800">{data.warehouseName}</span>
                </p>
              </div>
            </div>

            {/* Client & Seller Section */}
            <div className="grid grid-cols-2 gap-6 bg-neutral-50 p-4 rounded-xl border border-neutral-200 mb-6 text-xs">
              <div className="space-y-1.5">
                <div className="text-[10px] font-black text-neutral-400 uppercase tracking-widest flex items-center gap-1">
                  <User className="w-3 h-3 text-indigo-600" />
                  Datos del Comprador / Cliente
                </div>
                <p className="text-sm font-black text-neutral-900">{data.clientName}</p>
                <p className="font-mono text-neutral-600">Cédula / RUC: <span className="font-bold">{data.clientIdCard || 'N/A'}</span></p>
                <p className="text-neutral-600">Teléfono: <span className="font-bold">{data.clientPhone || 'N/A'}</span></p>
                <p className="text-neutral-600">Dirección: <span className="font-bold">{data.clientAddress || 'N/A'}, {data.clientCity || ''}</span></p>
              </div>

              <div className="space-y-1.5 border-l border-neutral-200 pl-6">
                <div className="text-[10px] font-black text-neutral-400 uppercase tracking-widest flex items-center gap-1">
                  <Building className="w-3 h-3 text-emerald-600" />
                  Datos de Almacén / Asesor
                </div>
                <p className="text-sm font-black text-neutral-900">{companyName}</p>
                <p className="text-neutral-600">Vendedor Asignado: <span className="font-bold">{data.sellerName}</span></p>
                <p className="text-neutral-600">Forma de Pago: <span className="font-bold text-emerald-700">CONTADO / EFECTIVO / TRANSFERENCIA</span></p>
                <p className="text-neutral-600">Estado de Entrega: <span className="font-bold text-emerald-700">ENTREGADO EN ALMACÉN</span></p>
              </div>
            </div>

            {/* Main Articles Table */}
            <div className="mb-6">
              <div className="text-xs font-black uppercase text-neutral-700 mb-2 flex items-center gap-2">
                <Package className="w-4 h-4 text-indigo-600" />
                Detalle del Bien / Artículo Adquirido
              </div>

              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-neutral-900 text-white font-bold">
                    <th className="p-2.5 rounded-tl-lg">Cant.</th>
                    <th className="p-2.5">Descripción del Artículo</th>
                    <th className="p-2.5">Marca / Modelo / Código</th>
                    <th className="p-2.5 text-right">Precio Unit.</th>
                    <th className="p-2.5 text-right rounded-tr-lg">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 border-b border-neutral-200">
                  <tr className="bg-white">
                    <td className="p-3 font-bold text-center border-r border-neutral-100">{data.quantity}</td>
                    <td className="p-3 font-black text-neutral-900">
                      {data.articleName}
                      {data.seriesList && data.seriesList.length > 0 && (
                        <div className="mt-1 text-[11px] font-mono text-indigo-700">
                          Series / Chasis: {data.seriesList.join(', ')}
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-neutral-600">
                      <div>{data.brand || 'N/A'} {data.model ? `- ${data.model}` : ''}</div>
                      {data.articleCode && <div className="text-[10px] font-mono text-neutral-400">Cód: {data.articleCode}</div>}
                    </td>
                    <td className="p-3 text-right font-bold">{formatCurrency(data.unitPrice)}</td>
                    <td className="p-3 text-right font-black text-neutral-900">{formatCurrency(data.subtotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Technical Details for Motorcycles / Heavy Goods */}
            {data.isMoto && data.motoDetails && (
              <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 mb-6 text-xs">
                <div className="font-black text-amber-900 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-600" />
                  Especificaciones Técnicas del Vehículo / Motocicleta
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
                  <div><span className="text-neutral-500">N° Chasis:</span> <span className="font-mono font-bold text-neutral-900">{data.motoDetails.chassis || 'N/A'}</span></div>
                  <div><span className="text-neutral-500">N° Motor:</span> <span className="font-mono font-bold text-neutral-900">{data.motoDetails.engine || 'N/A'}</span></div>
                  <div><span className="text-neutral-500">Color:</span> <span className="font-bold text-neutral-900">{data.motoDetails.color || 'N/A'}</span></div>
                  <div><span className="text-neutral-500">Año / Cincuenta:</span> <span className="font-bold text-neutral-900">{data.motoDetails.year || 'N/A'}</span></div>
                </div>
              </div>
            )}

            {/* Financial Summary Box */}
            <div className="flex justify-end mb-8">
              <div className="w-64 bg-neutral-50 p-4 rounded-xl border border-neutral-200 space-y-2 text-xs">
                <div className="flex justify-between text-neutral-600">
                  <span>Subtotal Bruto:</span>
                  <span className="font-bold">{formatCurrency(data.subtotal)}</span>
                </div>
                {data.discountAmount && data.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Descuento Aplicado:</span>
                    <span className="font-bold">-{formatCurrency(data.discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-black text-neutral-900 pt-2 border-t border-neutral-200">
                  <span>TOTAL PAGADO:</span>
                  <span className="text-emerald-700">{formatCurrency(data.totalAmount)}</span>
                </div>
              </div>
            </div>

            {/* Declaration & Clauses */}
            <div className="p-4 bg-neutral-100 rounded-xl border border-neutral-200 text-[10px] text-neutral-600 space-y-1 mb-12">
              <p className="font-bold text-neutral-800 uppercase">Cláusula de Transferencia y Recepción Directa:</p>
              <p>
                Por medio del presente documento, <strong>{companyName}</strong> declara haber vendido al contado y entregado a satisfacción del comprador Sr(a). <strong>{data.clientName}</strong> el bien o mercadería detallada anteriormente, habiendo recibido la totalidad del pago pactado. El cliente declara recibir el producto en perfecto estado físico y de funcionamiento, conforme a sus especificaciones.
              </p>
            </div>

            {/* Signatures */}
            <div className="grid grid-cols-2 gap-12 pt-8 border-t border-neutral-300 text-center">
              <div className="space-y-2">
                <div className="h-16 border-b border-dashed border-neutral-400"></div>
                <p className="text-xs font-black uppercase text-neutral-900">{companyName}</p>
                <p className="text-[10px] text-neutral-500 font-bold">ENTREGUÉ CONFORME (VENDEDOR)</p>
                <p className="text-[10px] font-mono text-neutral-400">{data.sellerName}</p>
              </div>

              <div className="space-y-2">
                <div className="h-16 border-b border-dashed border-neutral-400"></div>
                <p className="text-xs font-black uppercase text-neutral-900">{data.clientName}</p>
                <p className="text-[10px] text-neutral-500 font-bold">RECIBÍ CONFORME (CLIENTE)</p>
                <p className="text-[10px] font-mono text-neutral-400">CI/RUC: {data.clientIdCard || '....................'}</p>
              </div>
            </div>

            {/* Document Footer */}
            <div className="mt-12 text-center text-[9px] text-neutral-400 font-mono border-t border-neutral-100 pt-4">
              Documento generado por el Sistema de Control Financiero - Almacenes Derick • Venta de Contado registrada en inventario
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};
