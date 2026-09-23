import React, { useState, useEffect } from 'react';
import { X, Save, FileText, Hash, Calendar, Building2, User, AlertTriangle } from 'lucide-react';
import { CreditPayment, CreditPaymentMethod } from '../../types/creditPayment';
import { updateCreditPayment } from '../../lib/credit-payment-db';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { useSettings } from '../../contexts/SettingsContext';

interface EditCreditPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment: CreditPayment | null;
  onSuccess: () => void;
}

export function EditCreditPaymentModal({
  isOpen,
  onClose,
  payment,
  onSuccess
}: EditCreditPaymentModalProps) {
  const { user } = useAuth();
  const { showToast } = useNotification();
  const { settings } = useSettings();

  const [paymentMethod, setPaymentMethod] = useState<CreditPaymentMethod>('EFECTIVO');
  const [isTransfer, setIsTransfer] = useState(false);
  const [bankName, setBankName] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [collectorName, setCollectorName] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const defaultBanksList = ['Banco Pichincha', 'Banco Guayaquil', 'Banco del Pacífico', 'Produbanco', 'Banco Bolivariano', 'Banco Internacional', 'Cooperativa JEP', 'Cooperativa 29 de Octubre'];
  const availableBanks = React.useMemo(() => {
    const fromSettings = (settings.banks || []).filter(b => b && b.trim() !== '');
    const combined = [...fromSettings];
    defaultBanksList.forEach(b => {
      if (!combined.some(item => item.toLowerCase() === b.toLowerCase())) {
        combined.push(b);
      }
    });
    return combined;
  }, [settings.banks]);

  useEffect(() => {
    if (isOpen && payment) {
      setPaymentMethod(payment.paymentMethod || 'EFECTIVO');
      setIsTransfer(payment.isTransfer || payment.paymentMethod === 'TRANSFERENCIA');
      setBankName(payment.bankName || availableBanks[0] || 'Banco Pichincha');
      setReferenceNumber(payment.referenceNumber || '');
      setCollectorName(payment.collectorName || '');
      setNotes(payment.notes || '');
    }
  }, [isOpen, payment, availableBanks]);

  if (!isOpen || !payment) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      setIsSubmitting(true);
      const effectivePaymentMethod = isTransfer ? 'TRANSFERENCIA' : paymentMethod;

      await updateCreditPayment(payment.id, {
        paymentMethod: effectivePaymentMethod,
        isTransfer,
        bankName: isTransfer ? bankName : undefined,
        referenceNumber: referenceNumber.trim() || undefined,
        collectorName: collectorName.trim() || payment.collectorName,
        notes: notes.trim() || undefined
      });

      showToast('Comprobante de cobro actualizado correctamente', 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error updating payment receipt:', err);
      showToast(err.message || 'Error al actualizar el comprobante', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl w-full max-w-xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-neutral-900 dark:text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-amber-500" />
              <span>Editar Comprobante #{payment.receiptNumber}</span>
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              Modifique comentarios, forma de pago, banco o número de transacción
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Summary Box */}
          <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700/60 text-xs grid grid-cols-2 gap-3">
            <div>
              <span className="text-neutral-400 block font-semibold">Cliente:</span>
              <span className="font-bold text-neutral-800 dark:text-neutral-200">{payment.clientName}</span>
              <span className="text-neutral-500 block text-[11px]">{payment.clientIdCard}</span>
            </div>
            <div className="text-right">
              <span className="text-neutral-400 block font-semibold">Monto Cobrado:</span>
              <span className="font-mono text-base font-black text-emerald-600 dark:text-emerald-400">
                ${payment.totalAmountPaid.toFixed(2)}
              </span>
              <span className="text-neutral-500 block text-[11px]">Fecha: {payment.paymentDate}</span>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                Forma de Pago
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => {
                  const val = e.target.value as CreditPaymentMethod;
                  setPaymentMethod(val);
                  if (val === 'TRANSFERENCIA') setIsTransfer(true);
                }}
                className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-bold"
              >
                <option value="EFECTIVO">Efectivo</option>
                <option value="TRANSFERENCIA">Transferencia Bancaria</option>
                <option value="DEPOSITO">Depósito Bancario</option>
                <option value="CHEQUE">Cheque</option>
                <option value="TARJETA">Tarjeta de Débito/Crédito</option>
                <option value="OTRO">Otro</option>
              </select>
            </div>

            {/* Toggle Es Transferencia y Banco */}
            <div className="p-3 bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-800 rounded-xl space-y-3">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isTransfer || paymentMethod === 'TRANSFERENCIA'}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setIsTransfer(checked);
                    if (checked) {
                      setPaymentMethod('TRANSFERENCIA');
                      if (!bankName) setBankName(availableBanks[0] || 'Banco Pichincha');
                    } else {
                      setPaymentMethod('EFECTIVO');
                    }
                  }}
                  className="w-4 h-4 text-indigo-600 rounded border-neutral-300 focus:ring-indigo-500"
                />
                <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                  ¿Es transferencia bancaria / depósito?
                </span>
              </label>

              {(isTransfer || paymentMethod === 'TRANSFERENCIA') && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-neutral-200 dark:border-neutral-700/60">
                  <div>
                    <label className="block text-[11px] font-bold text-neutral-700 dark:text-neutral-300 mb-1 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Entidad Bancaria</span>
                    </label>
                    <select
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-bold"
                    >
                      {availableBanks.map((b, idx) => (
                        <option key={idx} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                      No. Referencia / Comprobante
                    </label>
                    <input
                      type="text"
                      value={referenceNumber}
                      onChange={(e) => setReferenceNumber(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-mono"
                      placeholder="ej. Trx #849102"
                    />
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                Recaudador / Cobrador
              </label>
              <input
                type="text"
                value={collectorName}
                onChange={(e) => setCollectorName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                Observaciones / Comentario
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Añadir nota o aclaración de este cobro..."
                className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs resize-none"
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-neutral-200 dark:border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
            >
              {isSubmitting ? (
                <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>Guardar Modificaciones</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
