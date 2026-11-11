import React, { useState } from 'react';
import { X, Save } from 'lucide-react';
import { doc, updateDoc, arrayUnion, Timestamp } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { useNotification } from '../../contexts/NotificationContext';
import { logAudit, AuditAction } from '../../lib/audit';

interface Check {
  id: string;
  invoiceId: string;
  beneficiaryName: string;
  checkNumber: string;
  concept: string;
  amount: number;
  dueDate: string;
  status: 'PENDING' | 'PAID' | 'DELETED';
}

interface EditCheckModalProps {
  check: Check;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

export const EditCheckModal = ({ check, isOpen, onClose, onSave }: EditCheckModalProps) => {
  const [amount, setAmount] = useState(check.amount);
  const [dueDate, setDueDate] = useState(check.dueDate);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const { showToast } = useNotification();

  if (!isOpen) return null;

  const handleSave = async () => {
    if (reason.trim().length < 5) {
      showToast('Por favor ingrese una razón válida para el cambio (mínimo 5 caracteres).', 'warning');
      return;
    }

    setLoading(true);
    try {
      const checkRef = doc(db, 'checks', check.id);
      const user = auth.currentUser;
      
      const updateData = {
        amount,
        dueDate,
        editHistory: arrayUnion({
          date: Timestamp.now(),
          reason,
          userId: user?.uid || 'system',
          userEmail: user?.email || 'system',
          changedFields: {
            amount: amount !== check.amount ? amount : undefined,
            dueDate: dueDate !== check.dueDate ? dueDate : undefined
          }
        })
      };

      await updateDoc(checkRef, updateData as any);
      await logAudit(
        AuditAction.CHECK_UPDATE,
        `Cheque #${check.checkNumber} modificado. Razón: ${reason}.`,
        check.id
      );

      showToast('Cheque actualizado correctamente.', 'success');
      onSave();
      onClose();
    } catch (error) {
      console.error('Error updating cheque:', error);
      showToast('Error al actualizar el cheque.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl p-6 w-full max-w-md shadow-2xl border border-neutral-200 dark:border-neutral-800">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">Editar Cheque #{check.checkNumber}</h2>
          <button onClick={onClose} className="p-1 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Nuevo Monto</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(parseFloat(e.target.value))}
              className="w-full px-3 py-2 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Nueva Fecha de Pago</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Razón del cambio</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 h-24"
              placeholder="Indique el motivo de la modificación..."
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-neutral-600 dark:text-neutral-400">Cancelar</button>
          <button 
            onClick={handleSave} 
            disabled={loading}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {loading ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </div>
    </div>
  );
};
