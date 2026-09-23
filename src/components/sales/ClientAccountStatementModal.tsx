import React, { useState, useRef } from 'react';
import { 
  X, 
  Printer, 
  Download, 
  FileText, 
  CheckCircle2, 
  ShieldCheck, 
  User, 
  Calendar, 
  DollarSign, 
  MapPin, 
  Phone, 
  CreditCard,
  Receipt,
  Share2,
  Award
} from 'lucide-react';
import { Client } from '../../types/client';
import { CreditSale } from '../../types/creditSale';
import { CreditPayment } from '../../types/creditPayment';
import { formatCurrency } from '../../lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuth } from '../../contexts/AuthContext';
import { formatEcuadorianPhone } from '../../lib/portfolioUtils';
import { useNotification } from '../../contexts/NotificationContext';
import { printElement, downloadElementAsPdf } from '../../lib/printUtils';

interface ClientAccountStatementModalProps {
  client: Client;
  credits: CreditSale[];
  payments: CreditPayment[];
  isOpen: boolean;
  onClose: () => void;
}

export const ClientAccountStatementModal: React.FC<ClientAccountStatementModalProps> = ({
  client,
  credits,
  payments,
  isOpen,
  onClose
}) => {
  const { profile, user } = useAuth();
  const { showToast } = useNotification();
  const printRef = useRef<HTMLDivElement>(null);

  const [printFormat, setPrintFormat] = useState<'A4' | 'TICKET'>('A4');

  if (!isOpen) return null;

  const enterpriseName = profile?.name || 'CONTROL FINANCIERO 360°';
  const enterpriseRuc = profile?.ruc || '1790012345001';
  const enterpriseAddress = profile?.phone ? `Telf: ${profile.phone}` : 'Ecuador';
  const todayStr = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: es });

  // Totals calculations
  const totalFinanced = credits
    .filter(c => c.status !== 'ANULADO')
    .reduce((sum, c) => sum + (c.grossTotal || c.netFinancedAmount || 0), 0);

  const totalPaid = credits
    .filter(c => c.status !== 'ANULADO')
    .reduce((sum, c) => sum + (c.totalPaid || 0), 0);

  const totalRemaining = credits
    .filter(c => c.status === 'ACTIVO' || c.status === 'EN_MORA')
    .reduce((sum, c) => sum + (c.remainingBalance ?? (c.netFinancedAmount || 0)), 0);

  const isSolventAndPaidOff = totalRemaining <= 0;

  // Filter payments for this client
  const clientPayments = payments.filter(p => p.clientId === client.id && p.status === 'VALID');

  // Flatten installments from all credits with context
  const allInstallmentsWithDetails = credits.flatMap(credit => {
    return (credit.installments || []).map(inst => {
      // Find associated payment if paidDate is not directly set on installment
      let paymentDate = inst.paidDate;
      if (!paymentDate && inst.status === 'PAGADO') {
        const relatedPayment = clientPayments.find(p => p.creditSaleId === credit.id || p.promissoryNoteNumber === credit.promissoryNoteNumber);
        if (relatedPayment?.paymentDate) {
          paymentDate = relatedPayment.paymentDate;
        } else if (relatedPayment?.createdAt) {
          paymentDate = relatedPayment.createdAt.split('T')[0];
        } else if (credit.updatedAt) {
          paymentDate = credit.updatedAt.split('T')[0];
        }
      }

      return {
        ...inst,
        creditId: credit.id,
        promissoryNoteNumber: credit.promissoryNoteNumber,
        articleName: credit.items?.map(i => i.articleName).join(', ') || credit.article || 'Mercadería',
        computedPaidDate: paymentDate
      };
    });
  });

  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const handlePrint = async () => {
    if (printRef.current) {
      await printElement(printRef.current, {
        title: `Estado_Cuenta_${client.idCard}`,
        pageFormat: printFormat
      });
    } else {
      window.print();
    }
  };

  const handleDownloadPdf = async () => {
    if (!printRef.current) return;
    try {
      setIsExportingPdf(true);
      await downloadElementAsPdf(printRef.current, `Estado_Cuenta_${client.idCard}`, {
        pageFormat: printFormat
      });
    } catch (err) {
      console.error('Error al descargar PDF:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleShareWhatsApp = () => {
    const phone = formatEcuadorianPhone(client.phone);
    if (!phone) {
      showToast('El cliente no tiene un teléfono celular válido', 'warning');
      return;
    }

    const text = `Estimado(a) *${client.firstName} ${client.lastName}*, le compartimos el resumen de su Estado de Cuenta en *${enterpriseName}* a la fecha ${todayStr}:\n` +
      `• Total compras a crédito: ${formatCurrency(totalFinanced)}\n` +
      `• Total amortizado: ${formatCurrency(totalPaid)}\n` +
      `• Saldo actual pendiente: *${formatCurrency(totalRemaining)}*\n` +
      `• Cupo de crédito disponible: ${formatCurrency(Math.max(0, (client.creditLimit || 0) - (client.creditUsed || 0)))}\n` +
      (isSolventAndPaidOff ? '🎉 ¡Felicitaciones! Se encuentra al día y en PAZ Y SALVO con todas sus obligaciones.' : 'Le recordamos mantener sus cuotas al día para acceder a mayores cupos.');

    const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden my-8">
        
        {/* Modal Top Bar (Hidden on print) */}
        <div className="print:hidden flex flex-col sm:flex-row sm:items-center justify-between p-5 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/50 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/30">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                Estado de Cuenta Consolidado
                {isSolventAndPaidOff && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
                    Paz y Salvo
                  </span>
                )}
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {client.firstName} {client.lastName} • CI: {client.idCard}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex bg-neutral-200 dark:bg-neutral-800 p-1 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setPrintFormat('A4')}
                className={`px-3 py-1 rounded-lg transition-all ${printFormat === 'A4' ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm' : 'text-neutral-500'}`}
              >
                Formato A4
              </button>
              <button
                type="button"
                onClick={() => setPrintFormat('TICKET')}
                className={`px-3 py-1 rounded-lg transition-all ${printFormat === 'TICKET' ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm' : 'text-neutral-500'}`}
              >
                Ticket 80mm
              </button>
            </div>

            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              WhatsApp
            </button>

            <button
              type="button"
              disabled={isExportingPdf}
              onClick={handleDownloadPdf}
              className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border border-neutral-700 shadow-sm disabled:opacity-50"
              title="Descargar Estado de Cuenta en PDF"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>{isExportingPdf ? 'Generando...' : 'Descargar PDF'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Imprimir
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-white rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Content */}
        <div ref={printRef} className="p-6 max-h-[calc(85vh-100px)] overflow-y-auto print:max-h-none print:p-0">
          
          {/* FORMATO A4 */}
          {printFormat === 'A4' && (
            <div className="space-y-6 text-neutral-900 dark:text-neutral-100 print:text-black">
              
              {/* Encabezado Corporativo */}
              <div className="flex justify-between items-start border-b border-neutral-300 pb-4">
                <div>
                  <h1 className="text-xl font-black tracking-tight text-neutral-900 dark:text-white print:text-black">
                    {enterpriseName}
                  </h1>
                  <p className="text-xs text-neutral-500 print:text-neutral-600">RUC: {enterpriseRuc} • {enterpriseAddress}</p>
                  <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 print:text-neutral-800 mt-1">
                    DEPARTAMENTO DE CRÉDITO Y COBRANZAS
                  </p>
                </div>

                <div className="text-right">
                  <div className="inline-block px-3 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 print:bg-neutral-100 border border-neutral-200 print:border-neutral-400">
                    <span className="text-xs font-black uppercase tracking-wider block">
                      {isSolventAndPaidOff ? 'CERTIFICADO DE PAZ Y SALVO' : 'ESTADO DE CUENTA'}
                    </span>
                    <span className="text-[11px] text-neutral-500 font-mono">
                      Emisión: {todayStr}
                    </span>
                  </div>
                </div>
              </div>

              {/* Ficha del Cliente */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-neutral-50 dark:bg-neutral-800/40 print:bg-neutral-50 p-4 rounded-xl border border-neutral-200 print:border-neutral-300 text-xs">
                <div className="space-y-1.5">
                  <div>
                    <span className="text-neutral-400 print:text-neutral-600 font-semibold block text-[10px] uppercase">Cliente / Titular</span>
                    <strong className="text-sm text-neutral-900 dark:text-white print:text-black">
                      {client.lastName} {client.firstName}
                    </strong>
                  </div>
                  <div>
                    <span className="text-neutral-400 print:text-neutral-600 font-semibold block text-[10px] uppercase">Cédula / RUC</span>
                    <span className="font-mono">{client.idCard}</span>
                  </div>
                  <div>
                    <span className="text-neutral-400 print:text-neutral-600 font-semibold block text-[10px] uppercase">Dirección & Ciudad</span>
                    <span>{client.address || 'No especificada'} • {client.city || 'Ecuador'}</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div>
                    <span className="text-neutral-400 print:text-neutral-600 font-semibold block text-[10px] uppercase">Teléfono de Contacto</span>
                    <span>{client.phone || 'Sin registrar'}</span>
                  </div>
                  <div>
                    <span className="text-neutral-400 print:text-neutral-600 font-semibold block text-[10px] uppercase">Garante Solidario Registrado</span>
                    <span>{client.guarantorName ? `${client.guarantorName} (CI: ${client.guarantorIdCard || 'S/N'})` : 'Sin garante asignado'}</span>
                  </div>
                  <div>
                    <span className="text-neutral-400 print:text-neutral-600 font-semibold block text-[10px] uppercase">Línea de Crédito Autorizada</span>
                    <span className="font-bold text-emerald-600 print:text-black">
                      {formatCurrency(client.creditLimit || 0)} (Disponible: {formatCurrency(Math.max(0, (client.creditLimit || 0) - (client.creditUsed || 0)))})
                    </span>
                  </div>
                </div>
              </div>

              {/* Resumen Financiero Consolidado */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 print:border-neutral-400 bg-white dark:bg-neutral-900 print:bg-white text-center">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Total Financiado</span>
                  <span className="text-lg font-black text-neutral-900 dark:text-white print:text-black mt-0.5 block">
                    {formatCurrency(totalFinanced)}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 print:border-neutral-400 bg-white dark:bg-neutral-900 print:bg-white text-center">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Total Amortizado</span>
                  <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 print:text-black mt-0.5 block">
                    {formatCurrency(totalPaid)}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 print:border-neutral-400 bg-white dark:bg-neutral-900 print:bg-white text-center">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Saldo Pendiente</span>
                  <span className={`text-lg font-black mt-0.5 block ${totalRemaining > 0 ? 'text-rose-600 print:text-black' : 'text-emerald-600 print:text-black'}`}>
                    {formatCurrency(totalRemaining)}
                  </span>
                </div>
              </div>

              {/* Banner de Paz y Salvo (Si aplica) */}
              {isSolventAndPaidOff && (
                <div className="p-5 rounded-2xl bg-emerald-50 print:bg-neutral-50 border-2 border-emerald-500/50 print:border-neutral-500 flex items-start gap-4">
                  <Award className="w-8 h-8 text-emerald-600 print:text-black shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h3 className="text-sm font-black text-emerald-900 print:text-black uppercase tracking-wider">
                      DECLARACIÓN DE PAZ Y SALVO DEFINITIVO
                    </h3>
                    <p className="text-xs text-emerald-800 print:text-black leading-relaxed">
                      Por medio del presente instrumento se CERTIFICA que el señor(a) <strong>{client.lastName} {client.firstName}</strong> con identificación <strong>{client.idCard}</strong> ha cumplido a cabalidad y cancelado la totalidad de sus obligaciones crediticias con <strong>{enterpriseName}</strong>, no adeudando valor alguno por concepto de capital, cuotas, intereses ni recargos a la fecha de emisión. Sus respectivos pagarés se declaran extinguidos.
                    </p>
                  </div>
                </div>
              )}

              {/* Tabla de Créditos Otorgados */}
              <div>
                <h3 className="text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-2">
                  Detalle de Operaciones de Crédito ({credits.length})
                </h3>
                <div className="overflow-x-auto border border-neutral-200 dark:border-neutral-800 print:border-neutral-400 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-neutral-100 dark:bg-neutral-800 print:bg-neutral-200 text-[10px] font-bold text-neutral-600 uppercase">
                      <tr>
                        <th className="p-2.5">Pagaré N°</th>
                        <th className="p-2.5">Fecha</th>
                        <th className="p-2.5">Artículos / Detalle</th>
                        <th className="p-2.5 text-right">Financiado</th>
                        <th className="p-2.5 text-right">Abonado</th>
                        <th className="p-2.5 text-right">Saldo Restante</th>
                        <th className="p-2.5 text-center">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 print:divide-neutral-300">
                      {credits.map((c) => (
                        <tr key={c.id}>
                          <td className="p-2.5 font-mono font-bold">{c.promissoryNoteNumber}</td>
                          <td className="p-2.5 text-neutral-500">{c.createdAt ? c.createdAt.split('T')[0] : 'S/F'}</td>
                          <td className="p-2.5 max-w-[200px] truncate">{c.items?.map(i => i.articleName).join(', ') || c.article || 'Mercadería'}</td>
                          <td className="p-2.5 text-right font-medium">{formatCurrency(c.grossTotal || c.netFinancedAmount || 0)}</td>
                          <td className="p-2.5 text-right font-medium text-emerald-600 print:text-black">{formatCurrency(c.totalPaid || 0)}</td>
                          <td className="p-2.5 text-right font-bold">{formatCurrency(c.remainingBalance ?? (c.netFinancedAmount || 0))}</td>
                          <td className="p-2.5 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                              c.status === 'LIQUIDADO' 
                                ? 'bg-emerald-100 text-emerald-800 print:border print:border-black' 
                                : c.status === 'ACTIVO' 
                                  ? 'bg-blue-100 text-blue-800' 
                                  : 'bg-neutral-100 text-neutral-800'
                            }`}>
                              {c.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Cronograma Detallado de Cuotas y Fechas de Pagos Cancelados */}
              {allInstallmentsWithDetails.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                      Cronograma de Cuotas y Fechas de Cancelación ({allInstallmentsWithDetails.length})
                    </h3>
                    <span className="text-[10px] text-neutral-400 print:text-neutral-600 font-medium">
                      Fechas exactas de pagos amortizados
                    </span>
                  </div>
                  <div className="overflow-x-auto border border-neutral-200 dark:border-neutral-800 print:border-neutral-400 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-neutral-100 dark:bg-neutral-800 print:bg-neutral-200 text-[10px] font-bold text-neutral-600 uppercase">
                        <tr>
                          <th className="p-2.5">Pagaré</th>
                          <th className="p-2.5 text-center">Cuota</th>
                          <th className="p-2.5">Vencimiento</th>
                          <th className="p-2.5 text-right">Monto Cuota</th>
                          <th className="p-2.5 text-right">Monto Pagado</th>
                          <th className="p-2.5">Fecha de Pago / Cancelación</th>
                          <th className="p-2.5 text-center">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 print:divide-neutral-300">
                        {allInstallmentsWithDetails.map((inst, idx) => {
                          const isPaid = inst.status === 'PAGADO';
                          const isPartial = inst.status === 'PARCIAL';
                          const isOverdue = inst.status === 'VENCIDO';
                          return (
                            <tr key={`${inst.creditId}-${inst.number}-${idx}`} className="hover:bg-neutral-50/50">
                              <td className="p-2.5 font-mono font-bold text-indigo-600 print:text-black">{inst.promissoryNoteNumber}</td>
                              <td className="p-2.5 text-center font-bold">Cuota #{inst.number}</td>
                              <td className="p-2.5 font-mono text-neutral-600 print:text-black">{inst.dueDate}</td>
                              <td className="p-2.5 text-right font-medium">{formatCurrency(inst.amount)}</td>
                              <td className="p-2.5 text-right font-bold text-emerald-600 print:text-black">
                                {formatCurrency(inst.paidAmount ?? (isPaid ? inst.amount : 0))}
                              </td>
                              <td className="p-2.5">
                                {isPaid ? (
                                  <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 print:text-black font-semibold text-[11px]">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 print:hidden shrink-0" />
                                    Cancelado el {inst.computedPaidDate || 'al día'}
                                  </span>
                                ) : isPartial ? (
                                  <span className="text-amber-600 print:text-black font-semibold text-[11px]">
                                    Abono parcial ({inst.computedPaidDate ? `Abonado el ${inst.computedPaidDate}` : 'En amortización'})
                                  </span>
                                ) : isOverdue ? (
                                  <span className="text-rose-600 print:text-black font-bold text-[11px]">
                                    Vencido (Pendiente de pago)
                                  </span>
                                ) : (
                                  <span className="text-neutral-400 print:text-neutral-600 text-[11px]">
                                    Pendiente / Por vencer
                                  </span>
                                )}
                              </td>
                              <td className="p-2.5 text-center">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                  isPaid
                                    ? 'bg-emerald-100 text-emerald-800 print:border print:border-black'
                                    : isOverdue
                                      ? 'bg-rose-100 text-rose-800'
                                      : isPartial
                                        ? 'bg-amber-100 text-amber-800'
                                        : 'bg-neutral-100 text-neutral-700'
                                }`}>
                                  {inst.status}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Historial de Pagos / Recibos */}
              {clientPayments.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-2">
                    Historial de Recibos de Pago Emitidos ({clientPayments.length})
                  </h3>
                  <div className="overflow-x-auto border border-neutral-200 dark:border-neutral-800 print:border-neutral-400 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-neutral-100 dark:bg-neutral-800 print:bg-neutral-200 text-[10px] font-bold text-neutral-600 uppercase">
                        <tr>
                          <th className="p-2.5">Recibo N°</th>
                          <th className="p-2.5">Fecha</th>
                          <th className="p-2.5">Pagaré Asociado</th>
                          <th className="p-2.5">Método</th>
                          <th className="p-2.5">Recaudador</th>
                          <th className="p-2.5 text-right">Valor Pagado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 print:divide-neutral-300">
                        {clientPayments.map((p) => (
                          <tr key={p.id}>
                            <td className="p-2.5 font-mono font-bold text-indigo-600 print:text-black">{p.receiptNumber}</td>
                            <td className="p-2.5 text-neutral-500">{p.createdAt ? p.createdAt.split('T')[0] : 'S/F'}</td>
                            <td className="p-2.5 font-mono">{p.promissoryNoteNumber}</td>
                            <td className="p-2.5">{p.paymentMethod}</td>
                            <td className="p-2.5">{p.collectorName || 'Caja'}</td>
                            <td className="p-2.5 text-right font-black text-emerald-600 print:text-black">{formatCurrency(p.totalAmountPaid)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Firmas de Conformidad */}
              <div className="grid grid-cols-2 gap-12 pt-12 text-center text-xs print:pt-16">
                <div>
                  <div className="border-t border-neutral-400 pt-2 w-48 mx-auto">
                    <p className="font-bold text-neutral-900 print:text-black">{client.lastName} {client.firstName}</p>
                    <p className="text-[10px] text-neutral-500 print:text-neutral-700">CI: {client.idCard}</p>
                    <p className="text-[10px] text-neutral-400">Firma del Cliente</p>
                  </div>
                </div>
                <div>
                  <div className="border-t border-neutral-400 pt-2 w-48 mx-auto">
                    <p className="font-bold text-neutral-900 print:text-black">{enterpriseName}</p>
                    <p className="text-[10px] text-neutral-500 print:text-neutral-700">Dpto. Crédito y Cobranzas</p>
                    <p className="text-[10px] text-neutral-400">Autorización & Sello</p>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* FORMATO TICKET 80MM */}
          {printFormat === 'TICKET' && (
            <div className="max-w-[320px] mx-auto text-black font-mono text-[11px] space-y-2 p-2 bg-white border border-neutral-200 print:border-none">
              <div className="text-center pb-2 border-b border-dashed border-neutral-400">
                <p className="font-bold text-xs uppercase">{enterpriseName}</p>
                <p className="text-[10px]">RUC: {enterpriseRuc}</p>
                <p className="text-[10px] font-bold mt-1 uppercase">
                  {isSolventAndPaidOff ? '*** CERTIFICADO DE PAZ Y SALVO ***' : '*** ESTADO DE CUENTA ***'}
                </p>
                <p className="text-[9px] text-neutral-600">Fecha: {todayStr}</p>
              </div>

              <div className="space-y-0.5 border-b border-dashed border-neutral-400 pb-2">
                <p><strong>CLIENTE:</strong> {client.lastName} {client.firstName}</p>
                <p><strong>CI/RUC:</strong> {client.idCard}</p>
                <p><strong>TELF:</strong> {client.phone || 'S/N'}</p>
                {client.guarantorName && <p><strong>GARANTE:</strong> {client.guarantorName}</p>}
              </div>

              <div className="space-y-0.5 border-b border-dashed border-neutral-400 pb-2">
                <div className="flex justify-between">
                  <span>TOTAL FINANCIADO:</span>
                  <span className="font-bold">{formatCurrency(totalFinanced)}</span>
                </div>
                <div className="flex justify-between">
                  <span>TOTAL AMORTIZADO:</span>
                  <span className="font-bold">{formatCurrency(totalPaid)}</span>
                </div>
                <div className="flex justify-between font-bold text-xs pt-1">
                  <span>SALDO ACTUAL:</span>
                  <span>{formatCurrency(totalRemaining)}</span>
                </div>
              </div>

              {/* Detalle compacto de cuotas en ticket */}
              {allInstallmentsWithDetails.length > 0 && (
                <div className="border-b border-dashed border-neutral-400 pb-2">
                  <p className="font-bold text-[9px] uppercase mb-1">DETALLE DE CUOTAS Y PAGOS:</p>
                  <div className="space-y-1">
                    {allInstallmentsWithDetails.slice(0, 15).map((inst, idx) => (
                      <div key={`ticket-inst-${idx}`} className="flex justify-between text-[9px]">
                        <span>#{inst.number} {inst.dueDate.slice(5)} [{inst.status.slice(0, 3)}]</span>
                        <span className="font-bold">
                          {inst.status === 'PAGADO' && inst.computedPaidDate 
                            ? `PAG ${inst.computedPaidDate.slice(5)}` 
                            : formatCurrency(inst.amount)}
                        </span>
                      </div>
                    ))}
                    {allInstallmentsWithDetails.length > 15 && (
                      <p className="text-[8px] text-center italic text-neutral-500">
                        ...y {allInstallmentsWithDetails.length - 15} cuotas más (ver formato A4)
                      </p>
                    )}
                  </div>
                </div>
              )}

              {isSolventAndPaidOff && (
                <div className="py-2 text-center border-b border-dashed border-neutral-400">
                  <p className="font-bold text-[10px]">¡FELICITACIONES!</p>
                  <p className="text-[9px]">CUENTA TOTALMENTE LIQUIDADA Y EN PAZ Y SALVO.</p>
                </div>
              )}

              <div className="text-center pt-4 space-y-4">
                <div className="border-t border-black pt-1 w-32 mx-auto">
                  <p className="text-[9px]">Firma de Conformidad</p>
                </div>
                <p className="text-[8px] text-neutral-500">Documento informativo generado por Control Financiero 360°</p>
              </div>
            </div>
          )}

        </div>

      </div>

      <style>{`
        @media print {
          @page {
            size: auto;
            margin: 8mm 10mm;
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
};
