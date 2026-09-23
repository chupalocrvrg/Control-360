import React, { useState, useMemo } from 'react';
import { Search, X, User, CreditCard, DollarSign, ArrowRight, AlertCircle, Phone, MapPin } from 'lucide-react';
import { CreditSale } from '../../types/creditSale';
import { Client } from '../../types/client';
import { formatCurrency } from '../../lib/utils';

interface ActiveDebtSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  creditSales: CreditSale[];
  clients: Client[];
  onSelectCredit: (credit: CreditSale) => void;
}

export function ActiveDebtSearchModal({
  isOpen,
  onClose,
  creditSales,
  clients,
  onSelectCredit
}: ActiveDebtSearchModalProps) {
  const [queryText, setQueryText] = useState('');

  // Filter only credits that have remaining debt (> 0.01) and are not annulled
  const activeDebts = useMemo(() => {
    return creditSales.filter(c => 
      c.status !== 'ANULADO' && 
      c.status !== 'LIQUIDADO' && 
      (c.remainingBalance || 0) > 0.01
    );
  }, [creditSales]);

  // Client lookup map for fast details
  const clientMap = useMemo(() => {
    const map = new Map<string, Client>();
    clients.forEach(cl => map.set(cl.id, cl));
    return map;
  }, [clients]);

  // Filtered by user search
  const filteredCredits = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    if (!q) return activeDebts.slice(0, 20); // Top 20 when empty

    return activeDebts.filter(cr => {
      const client = clientMap.get(cr.clientId);
      const name = (cr.clientName || '').toLowerCase();
      const idCard = (cr.clientIdCard || client?.idCard || '').toLowerCase();
      const code = (cr.id || '').toLowerCase();
      const promissory = (cr.promissoryNoteNumber || '').toLowerCase();
      const phone = (cr.clientPhone || client?.phone || '').toLowerCase();

      return (
        name.includes(q) ||
        idCard.includes(q) ||
        code.includes(q) ||
        promissory.includes(q) ||
        phone.includes(q)
      );
    });
  }, [activeDebts, queryText, clientMap]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white dark:bg-neutral-900 rounded-3xl w-full max-w-3xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-neutral-900 dark:text-white flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-indigo-600" />
              <span>Búsqueda Inteligente de Deudas Activas</span>
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              Encuentre rápidamente al deudor por Cédula / RUC, Nombre o Pagaré para registrar su abono
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Input Bar */}
        <div className="p-6 pb-3 border-b border-neutral-100 dark:border-neutral-800/80 bg-neutral-50/50 dark:bg-neutral-800/20">
          <div className="relative">
            <Search className="w-5 h-5 text-neutral-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              autoFocus
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              placeholder="Buscar por Cédula / RUC, Nombre completo, Teléfono o No. Pagaré..."
              className="w-full pl-12 pr-10 py-3 rounded-2xl bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white text-sm font-medium focus:ring-2 focus:ring-indigo-500 shadow-inner outline-none transition-all"
            />
            {queryText && (
              <button
                type="button"
                onClick={() => setQueryText('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 text-xs bg-neutral-100 dark:bg-neutral-700 px-2 py-1 rounded-md"
              >
                Limpiar
              </button>
            )}
          </div>
          <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 mt-2 px-1">
            <span>
              Mostrando <strong>{filteredCredits.length}</strong> de <strong>{activeDebts.length}</strong> créditos con deuda pendiente
            </span>
            <span className="hidden sm:inline">Presione &ldquo;Cobrar Cuota&rdquo; para abrir el recibo de cobro</span>
          </div>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {filteredCredits.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center mx-auto mb-3">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-neutral-800 dark:text-neutral-200">No se encontraron deudas activas</h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-md mx-auto">
                No hay créditos con saldo pendiente que coincidan con &ldquo;{queryText}&rdquo;. Verifique el número de cédula o nombre del cliente.
              </p>
            </div>
          ) : (
            filteredCredits.map((credit) => {
              const client = clientMap.get(credit.clientId);
              const nextPendingInst = (credit.installments || []).find(
                inst => inst.status !== 'PAGADO' && (inst.amount - (inst.paidAmount || 0)) > 0.01
              );

              return (
                <div
                  key={credit.id}
                  className="group bg-white dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700/80 hover:border-indigo-400 dark:hover:border-indigo-500 rounded-2xl p-4 transition-all shadow-sm hover:shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-neutral-900 dark:text-white text-base truncate">
                        {credit.clientName}
                      </span>
                      <span className="font-mono text-xs font-bold text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-md">
                        {credit.promissoryNoteNumber}
                      </span>
                      {credit.status === 'EN_MORA' && (
                        <span className="text-[10px] font-black uppercase tracking-wider text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-md">
                          En Mora
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-neutral-600 dark:text-neutral-300">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                        <span>C.I. / RUC: <strong className="text-neutral-800 dark:text-neutral-200">{credit.clientIdCard || client?.idCard || 'N/A'}</strong></span>
                      </div>
                      {(credit.clientPhone || client?.phone) && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                          <span>{credit.clientPhone || client?.phone}</span>
                        </div>
                      )}
                      {(credit.clientAddress || client?.address) && (
                        <div className="flex items-center gap-1.5 sm:col-span-2 truncate">
                          <MapPin className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                          <span className="truncate">{credit.clientAddress || client?.address} ({credit.clientCity || client?.city || ''})</span>
                        </div>
                      )}
                    </div>

                    {nextPendingInst && (
                      <div className="pt-1 text-[11px] text-neutral-500 dark:text-neutral-400 flex items-center gap-2">
                        <span>Próx. Cuota #{nextPendingInst.number}:</span>
                        <strong className="text-neutral-800 dark:text-neutral-200 font-mono">
                          ${(nextPendingInst.amount - (nextPendingInst.paidAmount || 0)).toFixed(2)}
                        </strong>
                        <span>• Vence: {nextPendingInst.dueDate}</span>
                      </div>
                    )}
                  </div>

                  {/* Financial Balance & Action */}
                  <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 sm:border-l sm:border-neutral-200 sm:dark:border-neutral-700 sm:pl-4">
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-neutral-400 block">
                        Saldo Pendiente
                      </span>
                      <span className="text-lg font-black text-rose-600 dark:text-rose-400 font-mono">
                        ${(credit.remainingBalance || 0).toFixed(2)}
                      </span>
                      <span className="text-[10px] text-neutral-400 block">
                        Total Crédito: ${(credit.grossTotal || 0).toFixed(2)}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        onSelectCredit(credit);
                        onClose();
                      }}
                      className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5 shrink-0"
                    >
                      <DollarSign className="w-4 h-4" />
                      <span>Cobrar</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
