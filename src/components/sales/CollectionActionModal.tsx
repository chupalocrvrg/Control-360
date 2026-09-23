import React, { useState } from 'react';
import { 
  X, 
  PhoneCall, 
  MapPin, 
  MessageCircle, 
  FileText, 
  Scale, 
  Calendar, 
  DollarSign, 
  Save, 
  User, 
  ShieldCheck, 
  Clock,
  AlertCircle
} from 'lucide-react';
import { CreditSale } from '../../types/creditSale';
import { 
  CollectionContactType, 
  CollectionContactTarget, 
  CollectionOutcome 
} from '../../types/creditCollection';
import { formatCurrency } from '../../lib/utils';
import { db } from '../../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { logAudit, AuditAction } from '../../lib/audit';

interface CollectionActionModalProps {
  credit: CreditSale;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const CollectionActionModal: React.FC<CollectionActionModalProps> = ({
  credit,
  isOpen,
  onClose,
  onSaved
}) => {
  const { user, profile } = useAuth();
  const { showToast } = useNotification();
  const enterpriseId = profile?.enterpriseId || user?.uid;
  const currentUserName = profile?.name || user?.email || 'Gestor de Cobranzas';

  const [contactType, setContactType] = useState<CollectionContactType>('LLAMADA');
  const [contactTarget, setContactTarget] = useState<CollectionContactTarget>('DEUDOR');
  const [outcome, setOutcome] = useState<CollectionOutcome>('COMPROMISO_PAGO');
  const [notes, setNotes] = useState('');
  
  // Payment Promise
  const [hasPromise, setHasPromise] = useState(true);
  const [promiseDate, setPromiseDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().split('T')[0];
  });
  const [promiseAmount, setPromiseAmount] = useState<number>(credit.installmentAmount || 0);

  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const targetName = contactTarget === 'DEUDOR' 
    ? credit.clientName 
    : (credit.guarantorName || 'Garante');
  
  const targetPhone = contactTarget === 'DEUDOR' 
    ? credit.clientPhone 
    : (credit.guarantorPhone || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enterpriseId) return;

    if (!notes.trim()) {
      showToast('Por favor ingrese el detalle u observación de la gestión', 'warning');
      return;
    }

    if (hasPromise && (!promiseDate || promiseAmount <= 0)) {
      showToast('Por favor ingrese una fecha y monto válido para el compromiso de pago', 'warning');
      return;
    }

    try {
      setIsSubmitting(true);
      await addDoc(collection(db, 'credit_collection_logs'), {
        enterpriseId,
        creditSaleId: credit.id,
        clientId: credit.clientId,
        clientName: credit.clientName,
        promissoryNoteNumber: credit.promissoryNoteNumber || 'S/N',
        contactType,
        contactTarget,
        targetName,
        targetPhone,
        outcome,
        notes: notes.trim(),
        promiseDate: hasPromise ? promiseDate : null,
        promiseAmount: hasPromise ? Number(promiseAmount) : null,
        isPromiseFulfilled: false,
        createdAt: new Date().toISOString(),
        serverCreatedAt: serverTimestamp(),
        createdBy: user?.uid || '',
        createdByName: currentUserName
      });

      logAudit(
        AuditAction.COLLECTION_CREATE,
        `Cobranza ${contactType} a ${contactTarget} (${outcome}) - Pagaré #${credit.promissoryNoteNumber} - ${credit.clientName}${hasPromise ? ` - Promesa: $${promiseAmount} para ${promiseDate}` : ''}`,
        credit.id
      );

      showToast('Gestión de cobranza registrada exitosamente', 'success');
      onSaved();
      onClose();
    } catch (err: any) {
      console.error('Error saving collection log:', err);
      showToast(err.message || 'Error al guardar la gestión', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-xl bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden my-8">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/30">
              <PhoneCall className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-900 dark:text-white">
                Registrar Gestión de Cobranza
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Cliente: <span className="font-semibold text-neutral-800 dark:text-neutral-200">{credit.clientName}</span> • Pagaré: {credit.promissoryNoteNumber}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-neutral-700 dark:hover:text-white rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          
          {/* Canal de Contacto & Destinatario */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-1.5">
                Canal de Gestión
              </label>
              <select
                value={contactType}
                onChange={(e) => setContactType(e.target.value as CollectionContactType)}
                className="w-full p-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs text-neutral-900 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="LLAMADA">📞 Llamada Telefónica</option>
                <option value="WHATSAPP">💬 Mensaje de WhatsApp</option>
                <option value="VISITA">📍 Visita Domicilio / Trabajo</option>
                <option value="NOTIFICACION_ESCRITA">📄 Notificación Escrita / Físco</option>
                <option value="JUDICIAL">⚖️ Gestión Jurídica / Extrajudicial</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-1.5">
                Persona Contactada
              </label>
              <select
                value={contactTarget}
                onChange={(e) => setContactTarget(e.target.value as CollectionContactTarget)}
                className="w-full p-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs text-neutral-900 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="DEUDOR">👤 Deudor Principal ({credit.clientName})</option>
                {credit.guarantorName && (
                  <option value="GARANTE">🛡️ Garante Solidario ({credit.guarantorName})</option>
                )}
                <option value="CONYUGE">👥 Cónyuge / Pareja</option>
                <option value="REFERENCIA">📑 Referencia Personal / Laboral</option>
              </select>
            </div>
          </div>

          {/* Resultado de la gestión */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-1.5">
              Resultado de la Gestión
            </label>
            <select
              value={outcome}
              onChange={(e) => {
                const val = e.target.value as CollectionOutcome;
                setOutcome(val);
                setHasPromise(val === 'COMPROMISO_PAGO');
              }}
              className="w-full p-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs text-neutral-900 dark:text-white font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="COMPROMISO_PAGO">🤝 Compromiso / Promesa de Pago Acordada</option>
              <option value="PAGO_CONFIRMADO">✅ Pago ya Realizado (Solicita Verificación)</option>
              <option value="NO_CONTESTA">📵 No Contesta / Desvía Llamada</option>
              <option value="NUMERO_EQUIVOCADO">⚠️ Número Equivocado / Fuera de Servicio</option>
              <option value="ILOCALIZABLE">❓ No se Ubica en Dirección</option>
              <option value="DISPUTA">❌ Disputa / Se Niega a Pagar</option>
              <option value="SOLICITA_REFINANCIAMIENTO">🔄 Solicita Reestructuración / Convenio</option>
            </select>
          </div>

          {/* Bloque de Compromiso de Pago */}
          <div className="p-4 bg-indigo-50/60 dark:bg-indigo-950/30 rounded-xl border border-indigo-200 dark:border-indigo-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs font-bold text-indigo-900 dark:text-indigo-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasPromise}
                  onChange={(e) => setHasPromise(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                Registrar Compromiso / Promesa de Pago
              </label>
              <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">
                Alerta en Tablero
              </span>
            </div>

            {hasPromise && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    Fecha Prometida de Pago
                  </label>
                  <input
                    type="date"
                    value={promiseDate}
                    onChange={(e) => setPromiseDate(e.target.value)}
                    className="w-full p-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs font-bold text-neutral-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    Monto Acordado a Abonar ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={promiseAmount}
                    onChange={(e) => setPromiseAmount(parseFloat(e.target.value) || 0)}
                    className="w-full p-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs font-bold text-neutral-900 dark:text-white"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Observaciones detalladas */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-1.5">
              Observaciones & Detalle de la Conversación
            </label>
            <textarea
              rows={3}
              required
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: El cliente indica que cobrará su quincena este viernes y depositará a las 3:00 PM..."
              className="w-full p-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-200 dark:border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-md shadow-indigo-600/20"
            >
              <Save className="w-4 h-4" />
              {isSubmitting ? 'Guardando...' : 'Guardar Gestión'}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
