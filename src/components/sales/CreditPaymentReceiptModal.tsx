import React, { useState, useRef } from 'react';
import { 
  X, 
  Printer, 
  Receipt, 
  CheckCircle2, 
  Calendar, 
  User, 
  DollarSign, 
  CreditCard, 
  FileText, 
  ShieldCheck, 
  QrCode, 
  Download,
  Share2
} from 'lucide-react';
import { CreditPayment } from '../../types/creditPayment';
import { formatCurrency } from '../../lib/utils';
import { printElement, downloadElementAsPdf } from '../../lib/printUtils';

interface CreditPaymentReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment: CreditPayment | null;
  enterpriseName?: string;
  enterpriseRuc?: string;
  enterprisePhone?: string;
  enterpriseAddress?: string;
}

export function CreditPaymentReceiptModal({
  isOpen,
  onClose,
  payment,
  enterpriseName = 'Mi Empresa Comercial',
  enterpriseRuc = '1790012345001',
  enterprisePhone = '0991234567',
  enterpriseAddress = 'Matriz Comercial'
}: CreditPaymentReceiptModalProps) {
  const [printFormat, setPrintFormat] = useState<'THERMAL' | 'A4'>('THERMAL');
  const thermalRef = useRef<HTMLDivElement>(null);
  const a4Ref = useRef<HTMLDivElement>(null);

  const [isExportingPdf, setIsExportingPdf] = useState(false);

  if (!isOpen || !payment) return null;

  const handlePrint = async (format: 'THERMAL' | 'A4') => {
    setPrintFormat(format);
    const target = format === 'THERMAL' ? thermalRef.current : a4Ref.current;
    if (target) {
      await printElement(target, {
        title: `Recibo_${payment.receiptNumber}`,
        pageFormat: format === 'THERMAL' ? 'TICKET' : 'A4'
      });
    } else {
      window.print();
    }
  };

  const handleDownloadPdf = async () => {
    const target = printFormat === 'THERMAL' ? thermalRef.current : a4Ref.current;
    if (!target) return;
    try {
      setIsExportingPdf(true);
      await downloadElementAsPdf(target, `Recibo_${payment.receiptNumber}`, {
        pageFormat: printFormat === 'THERMAL' ? 'TICKET' : 'A4'
      });
    } catch (err) {
      console.error('Error al generar PDF:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto print:p-0 print:bg-white print:static">
      
      {/* Container - In screen mode max-w-4xl, in print mode full width */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-2xl max-w-3xl w-full my-4 overflow-hidden flex flex-col max-h-[94vh] print:border-none print:shadow-none print:max-w-none print:m-0 print:h-auto">
        
        {/* Top Header & Format Selector (Hidden on print) */}
        <div className="px-6 py-4 bg-neutral-900 text-white flex flex-col sm:flex-row items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-base font-bold">Comprobante Oficial de Cobro</h2>
              <p className="text-xs text-neutral-400">Recibo #{payment.receiptNumber} • Pagaré #{payment.promissoryNoteNumber}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Format Toggle */}
            <div className="flex bg-neutral-800 p-1 rounded-xl border border-neutral-700 text-xs">
              <button
                type="button"
                onClick={() => setPrintFormat('THERMAL')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  printFormat === 'THERMAL' 
                    ? 'bg-emerald-600 text-white shadow-sm' 
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Ticket 80mm
              </button>
              <button
                type="button"
                onClick={() => setPrintFormat('A4')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  printFormat === 'A4' 
                    ? 'bg-indigo-600 text-white shadow-sm' 
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Formato A4
              </button>
            </div>

            <button
              type="button"
              disabled={isExportingPdf}
              onClick={handleDownloadPdf}
              className="px-3.5 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border border-neutral-700 disabled:opacity-50"
              title="Descargar comprobante en formato PDF"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>{isExportingPdf ? 'Generando...' : 'Descargar PDF'}</span>
            </button>

            <button
              type="button"
              onClick={() => handlePrint(printFormat)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Imprimir
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-neutral-400 hover:text-white rounded-xl hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Receipt Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-neutral-100 dark:bg-neutral-950 flex justify-center print:p-0 print:bg-white print:overflow-visible">
          
          {/* ========================================================= */}
          {/* 1. THERMAL TICKET FORMAT (80mm standard POS)             */}
          {/* ========================================================= */}
          {printFormat === 'THERMAL' && (
            <div 
              ref={thermalRef}
              className="w-full max-w-[340px] bg-white text-black p-4 font-mono text-[11px] leading-tight border border-neutral-300 shadow-lg rounded-lg print:border-none print:shadow-none print:p-0 print:m-0 print:max-w-none print:w-[80mm]"
              style={{ fontFamily: 'monospace' }}
            >
              {/* Header */}
              <div className="text-center pb-2 border-b border-dashed border-black mb-2">
                <h1 className="text-sm font-black tracking-tight uppercase">{enterpriseName}</h1>
                <p className="text-[10px]">RUC: {enterpriseRuc}</p>
                <p className="text-[10px]">{enterpriseAddress}</p>
                <p className="text-[10px]">Telf: {enterprisePhone}</p>
                <div className="my-1.5 py-1 bg-black text-white font-black text-xs uppercase tracking-wider">
                  RECIBO DE CAJA / ABONO
                </div>
                <p className="font-bold text-xs mt-1">No. {payment.receiptNumber}</p>
                <p className="text-[10px]">Fecha: {payment.paymentDate} {payment.paymentTime || ''}</p>
              </div>

              {/* Client Info */}
              <div className="pb-2 border-b border-dashed border-black mb-2 space-y-0.5">
                <p><strong>CLIENTE:</strong> {payment.clientName}</p>
                <p><strong>C.I./RUC:</strong> {payment.clientIdCard}</p>
                {payment.clientPhone && <p><strong>TELÉFONO:</strong> {payment.clientPhone}</p>}
                <p><strong>PAGARÉ REF:</strong> {payment.promissoryNoteNumber}</p>
              </div>

              {/* Installments Breakdown Table */}
              <div className="pb-2 border-b border-dashed border-black mb-2">
                <p className="font-bold uppercase text-[10px] mb-1">DETALLE DE CUOTAS AMORTIZADAS:</p>
                <table className="w-full text-left text-[10px]">
                  <thead>
                    <tr className="border-b border-black">
                      <th className="py-0.5">Cuota</th>
                      <th className="py-0.5">Vence</th>
                      <th className="py-0.5 text-right">Abono</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(payment.allocations || []).map((alloc, idx) => (
                      <tr key={idx} className="border-b border-dotted border-neutral-300">
                        <td className="py-0.5">Cuota #{alloc.installmentNumber}</td>
                        <td className="py-0.5">{alloc.dueDate}</td>
                        <td className="py-0.5 text-right font-bold">${alloc.amountApplied.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Early Settlement Discount (if applicable) */}
              {payment.isEarlySettlement && (
                <div className="pb-2 border-b border-dashed border-black mb-2 text-[10px]">
                  <p className="font-bold uppercase text-emerald-800">*** LIQUIDACIÓN ANTICIPADA ***</p>
                  {payment.settlementDescription && <p>{payment.settlementDescription}</p>}
                  {payment.discountApplied ? (
                    <p className="font-bold">Descuento aplicado: -${payment.discountApplied.toFixed(2)}</p>
                  ) : null}
                </div>
              )}

              {/* Financial Totals */}
              <div className="pb-2 border-b border-dashed border-black mb-2 space-y-1">
                <div className="flex justify-between text-xs font-black">
                  <span>TOTAL COBRADO:</span>
                  <span>${payment.totalAmountPaid.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span>Forma de Pago:</span>
                  <span className="font-bold">{payment.paymentMethod} {payment.bankName ? `(${payment.bankName})` : ''}</span>
                </div>
                {payment.referenceNumber && (
                  <div className="flex justify-between text-[10px]">
                    <span>Ref / Comprobante:</span>
                    <span>{payment.referenceNumber}</span>
                  </div>
                )}
              </div>

              {/* Account Balances */}
              <div className="pb-2 border-b border-dashed border-black mb-2 text-[10px] space-y-0.5 bg-neutral-50 p-1.5 border border-neutral-200">
                <div className="flex justify-between">
                  <span>Saldo Anterior Crédito:</span>
                  <span>${payment.previousCreditBalance.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Abono Aplicado:</span>
                  <span>-${payment.totalAmountPaid.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-black text-[11px] border-t border-black pt-0.5 mt-0.5">
                  <span>SALDO PENDIENTE CRÉDITO:</span>
                  <span>${payment.newCreditBalance.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-emerald-800 pt-0.5">
                  <span>Cupo Liberado al Cliente:</span>
                  <span>+${payment.totalAmountPaid.toFixed(2)}</span>
                </div>
              </div>

              {/* Collector & Notes */}
              <div className="pb-3 border-b border-dashed border-black mb-3 text-[10px] space-y-0.5">
                <p><strong>RECAUDADOR:</strong> {payment.collectorName}</p>
                {payment.notes && <p><strong>OBSERVACIONES:</strong> {payment.notes}</p>}
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-4 text-center text-[9px] pt-4 pb-2">
                <div>
                  <div className="border-b border-black mb-1 h-8" />
                  <p className="font-bold">FIRMA CLIENTE</p>
                  <p>C.I. {payment.clientIdCard}</p>
                </div>
                <div>
                  <div className="border-b border-black mb-1 h-8" />
                  <p className="font-bold">RECAUDADO POR</p>
                  <p>{payment.collectorName}</p>
                </div>
              </div>

              {/* Footer */}
              <div className="text-center pt-2 text-[9px] text-neutral-600">
                <p className="font-bold">¡GRACIAS POR SU PAGO PUNTUAL!</p>
                <p>Conserve este recibo como constancia de descargo.</p>
                <p className="mt-1 text-[8px]">Software de Control Financiero 360°</p>
              </div>

            </div>
          )}

          {/* ========================================================= */}
          {/* 2. FORMAL DOCUMENTAL A4 FORMAT                            */}
          {/* ========================================================= */}
          {printFormat === 'A4' && (
            <div 
              ref={a4Ref}
              className="w-full bg-white text-neutral-900 p-8 sm:p-10 border border-neutral-300 shadow-xl rounded-xl print:border-none print:shadow-none print:p-6 print:m-0 print:w-full"
            >
              {/* Header Letterhead */}
              <div className="flex items-start justify-between pb-6 border-b-2 border-neutral-900 mb-6">
                <div>
                  <h1 className="text-2xl font-black tracking-tight text-neutral-900 uppercase">
                    {enterpriseName}
                  </h1>
                  <p className="text-xs text-neutral-500 mt-1">R.U.C.: {enterpriseRuc} • Matriz: {enterpriseAddress}</p>
                  <p className="text-xs text-neutral-500">Teléfono: {enterprisePhone} • Ecuador</p>
                </div>

                <div className="text-right border-2 border-neutral-900 p-3 rounded-xl bg-neutral-50">
                  <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500 block">
                    COMPROBANTE DE PAGO
                  </span>
                  <span className="text-lg font-black text-neutral-900 font-mono">
                    {payment.receiptNumber}
                  </span>
                  <span className="text-[11px] text-neutral-600 block mt-1">
                    Fecha: {payment.paymentDate} • {payment.paymentTime || ''}
                  </span>
                </div>
              </div>

              {/* Client and Credit Overview Bento Box */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-neutral-50 border border-neutral-200 text-xs mb-6">
                <div className="space-y-1">
                  <span className="font-bold text-neutral-400 uppercase text-[10px] block">Datos del Deudor / Cliente</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[9px] text-neutral-500 uppercase font-bold block">Apellidos:</span>
                      <p className="text-sm font-bold text-neutral-900">{payment.clientName?.split(' ')[0] || 'S/N'}</p>
                    </div>
                    <div>
                      <span className="text-[9px] text-neutral-500 uppercase font-bold block">Nombres:</span>
                      <p className="text-sm font-bold text-neutral-900">{payment.clientName?.split(' ').slice(1).join(' ') || 'S/N'}</p>
                    </div>
                  </div>
                  <p className="text-neutral-600"><strong>Cédula / RUC:</strong> {payment.clientIdCard}</p>
                  {payment.clientPhone && <p className="text-neutral-600"><strong>Teléfono:</strong> {payment.clientPhone}</p>}
                  {payment.clientAddress && <p className="text-neutral-600"><strong>Dirección:</strong> {payment.clientAddress}</p>}
                </div>

                <div className="space-y-1 sm:border-l sm:border-neutral-200 sm:pl-4">
                  <span className="font-bold text-neutral-400 uppercase text-[10px] block">Referencia del Crédito</span>
                  <p className="text-sm font-bold text-indigo-700">PAGARÉ A LA ORDEN: {payment.promissoryNoteNumber}</p>
                  <p className="text-neutral-600"><strong>Forma de Pago:</strong> {payment.paymentMethod} {payment.bankName ? `(${payment.bankName})` : ''}</p>
                  {payment.referenceNumber && (
                    <p className="text-neutral-600"><strong>No. Referencia:</strong> {payment.referenceNumber}</p>
                  )}
                  <p className="text-neutral-600"><strong>Recaudador / Cobrador:</strong> {payment.collectorName}</p>
                </div>
              </div>

              {/* Amortization Installment Details Table */}
              <div className="mb-6">
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800 mb-2">
                  Cuotas Amortizadas con este Pago
                </h3>
                <table className="w-full text-left text-xs border border-neutral-300 rounded-lg overflow-hidden">
                  <thead className="bg-neutral-800 text-white font-bold">
                    <tr>
                      <th className="px-4 py-2"># Cuota</th>
                      <th className="px-4 py-2">Fecha Vencimiento</th>
                      <th className="px-4 py-2 text-right">Saldo Anterior</th>
                      <th className="px-4 py-2 text-right">Monto Abonado</th>
                      <th className="px-4 py-2 text-right">Saldo Restante</th>
                      <th className="px-4 py-2 text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {(payment.allocations || []).map((alloc, i) => (
                      <tr key={i} className="hover:bg-neutral-50">
                        <td className="px-4 py-2.5 font-bold">Cuota #{alloc.installmentNumber}</td>
                        <td className="px-4 py-2.5 text-neutral-600">{alloc.dueDate}</td>
                        <td className="px-4 py-2.5 text-right font-mono">${alloc.previousBalance.toFixed(2)}</td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-emerald-700">
                          ${alloc.amountApplied.toFixed(2)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono">${alloc.remainingBalance.toFixed(2)}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            alloc.isFullyPaid 
                              ? 'bg-emerald-100 text-emerald-800' 
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {alloc.isFullyPaid ? 'PAGADA COMPLETA' : 'ABONO PARCIAL'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Settlement Banner (if applicable) */}
              {payment.isEarlySettlement && (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-xs mb-6">
                  <span className="font-bold text-emerald-900 block text-sm">Liquidación Anticipada Inteligente Pactada</span>
                  <p className="text-emerald-700 mt-1">
                    {payment.settlementDescription || 'Crédito liquidado anticipadamente con descuento preferencial por pronto pago.'}
                  </p>
                  {payment.discountApplied ? (
                    <p className="font-bold text-emerald-800 mt-1">Descuento otorgado: ${payment.discountApplied.toFixed(2)}</p>
                  ) : null}
                </div>
              )}

              {/* Financial Balances Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50 text-xs space-y-1">
                  <span className="font-bold uppercase text-neutral-400 text-[10px] block">Estado de Cuenta del Crédito</span>
                  <div className="flex justify-between py-0.5">
                    <span>Saldo Anterior del Crédito:</span>
                    <span className="font-bold">${payment.previousCreditBalance.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-0.5 text-emerald-700">
                    <span>Abono Realizado:</span>
                    <span className="font-bold">-${payment.totalAmountPaid.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-t border-neutral-300 font-bold text-sm">
                    <span>Saldo Restante del Crédito:</span>
                    <span className={payment.newCreditBalance === 0 ? 'text-emerald-600' : 'text-neutral-900'}>
                      ${payment.newCreditBalance.toFixed(2)} {payment.newCreditBalance === 0 ? '(CANCELADO)' : ''}
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-neutral-900 bg-neutral-900 text-white flex flex-col justify-between">
                  <span className="text-[10px] uppercase tracking-wider text-neutral-400 font-bold">
                    TOTAL RECIBIDO EN ESTE COBRO
                  </span>
                  <div className="my-2">
                    <span className="text-3xl font-black tracking-tight text-emerald-400">
                      ${payment.totalAmountPaid.toFixed(2)}
                    </span>
                    <span className="text-xs text-neutral-400 block mt-1">Dólares de los Estados Unidos de América</span>
                  </div>
                  <span className="text-[11px] text-neutral-300">
                    Cupo liberado automáticamente en cuenta: +${payment.totalAmountPaid.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Legal note */}
              <p className="text-[10px] text-neutral-500 italic mb-8 border-l-2 border-neutral-400 pl-3">
                El presente recibo certifica fehacientemente el pago y amortización de las cuotas indicadas sobre el Pagaré a la Orden #{payment.promissoryNoteNumber}. La acreditación no extingue cuotas o intereses no especificados en este documento.
              </p>

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-12 pt-6 text-center text-xs">
                <div>
                  <div className="border-b-2 border-neutral-900 mb-2 h-14" />
                  <p className="font-bold text-neutral-900">{payment.clientName}</p>
                  <p className="text-neutral-500 text-[11px]">DEUDOR / CLIENTE • C.I. {payment.clientIdCard}</p>
                </div>

                <div>
                  <div className="border-b-2 border-neutral-900 mb-2 h-14" />
                  <p className="font-bold text-neutral-900">{payment.collectorName}</p>
                  <p className="text-neutral-500 text-[11px]">RECAUDADOR AUTORIZADO • {enterpriseName}</p>
                </div>
              </div>

            </div>
          )}

        </div>

      </div>

      {/* Print Specific CSS to isolate ticket and suppress margins */}
      <style>{`
        @media print {
          @page {
            margin: 0;
            size: auto;
          }
          body {
            background-color: #ffffff !important;
            color: #000000 !important;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>

    </div>
  );
}
