import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { addDoc, updateDoc, doc, collection, Timestamp, query, where, getDocs } from 'firebase/firestore';
import { X, Save, Calendar, FileText, User } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { logAudit, AuditAction } from '../../lib/audit';
import { format } from 'date-fns';

export interface ManualCollectionData {
  id: string;
  employeeId: string;
  initialDate: string;
  finalDate: string;
  noReceipt: boolean;
  initialReceipt: string | null;
  finalReceipt: string | null;
  totalCollected: number;
  depositsTransfers: number;
  cashFinal: number;
  createdAt: any;
  clientName?: string;
}

interface Employee {
  id: string;
  name: string;
  lastName: string;
  role: string;
}

interface ManualCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingCollection?: ManualCollectionData | null;
  employees: Employee[];
  onSuccess: () => void;
  defaultMonth?: string;
}

export function ManualCollectionModal({
  isOpen,
  onClose,
  editingCollection,
  employees,
  onSuccess,
  defaultMonth
}: ManualCollectionModalProps) {
  const { user, profile } = useAuth();
  const { showToast, showConfirm } = useNotification();
  const currentEnterpriseId = profile?.enterpriseId || user?.uid;

  const [formData, setFormData] = useState({
    employeeId: '',
    initialDate: format(new Date(), 'yyyy-MM-dd'),
    finalDate: format(new Date(), 'yyyy-MM-dd'),
    noReceipt: false,
    initialReceipt: '',
    finalReceipt: '',
    totalCollected: '',
    depositsTransfers: '',
    clientName: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (editingCollection) {
        setFormData({
          employeeId: editingCollection.employeeId,
          initialDate: editingCollection.initialDate,
          finalDate: editingCollection.finalDate,
          noReceipt: editingCollection.noReceipt || false,
          initialReceipt: editingCollection.initialReceipt || '',
          finalReceipt: editingCollection.finalReceipt || '',
          totalCollected: editingCollection.totalCollected.toString(),
          depositsTransfers: editingCollection.depositsTransfers.toString(),
          clientName: editingCollection.clientName || ''
        });
      } else {
        const selectableCollectors = employees.filter(e => ['cobrador', 'ambos', 'supervisor_cobranza', 'supervisor_general'].includes(e.role));
        const initialDateToSet = defaultMonth ? `${defaultMonth}-01` : format(new Date(), 'yyyy-MM-dd');
        setFormData({
          employeeId: selectableCollectors[0]?.id || employees[0]?.id || '',
          initialDate: initialDateToSet,
          finalDate: initialDateToSet,
          noReceipt: false,
          initialReceipt: '',
          finalReceipt: '',
          totalCollected: '',
          depositsTransfers: '0',
          clientName: ''
        });
      }
    }
  }, [isOpen, editingCollection, employees, defaultMonth]);

  const totalColl = parseFloat(formData.totalCollected) || 0;
  const depTrans = parseFloat(formData.depositsTransfers) || 0;
  const calculatedCashFinal = Math.max(0, totalColl - depTrans);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.noReceipt && (!formData.initialReceipt || !formData.finalReceipt)) {
      showToast('Por favor ingrese los números de recibo inicial y final', 'error');
      return;
    }

    if (formData.noReceipt && !formData.clientName.trim()) {
      showToast('Por favor ingrese el nombre del cliente para el cobro en agencia', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      const targetEntId = currentEnterpriseId || user.uid;

      // 1. Check for potential duplicate range for the same collector (only if receipts are used)
      if (!formData.noReceipt) {
        const qDup = query(
          collection(db, 'collections'), 
          where('enterpriseId', '==', targetEntId),
          where('employeeId', '==', formData.employeeId)
        );
        const snapDup = await getDocs(qDup);
        const existingCollections = snapDup.docs
          .map(d => ({ id: d.id, ...d.data() } as any))
          .filter(c => !editingCollection || c.id !== editingCollection.id);

        const newStart = formData.initialReceipt.toUpperCase();
        const newEnd = formData.finalReceipt.toUpperCase();

        const duplicate = existingCollections.find(c => 
          (c.initialReceipt === newStart && c.finalReceipt === newEnd) ||
          (c.initialReceipt === newStart) ||
          (c.finalReceipt === newEnd)
        );

        if (duplicate) {
          const proceed = await showConfirm(
            'Posible Cobranza Duplicada', 
            `Ya existe un registro de cobranza para este cobrador con recibos similares (${duplicate.initialReceipt} - ${duplicate.finalReceipt}). ¿Desea continuar de todas formas?`,
            { type: 'warning' }
          );
          if (!proceed) {
            setIsSubmitting(false);
            return;
          }
        }
      }

      const payload = {
        employeeId: formData.employeeId,
        initialDate: formData.initialDate,
        finalDate: formData.finalDate,
        noReceipt: formData.noReceipt,
        initialReceipt: formData.noReceipt ? null : formData.initialReceipt.toUpperCase(),
        finalReceipt: formData.noReceipt ? null : formData.finalReceipt.toUpperCase(),
        totalCollected: totalColl,
        depositsTransfers: depTrans,
        cashFinal: calculatedCashFinal,
        clientName: formData.noReceipt ? formData.clientName.trim() : null,
        enterpriseId: targetEntId,
        updatedAt: Timestamp.now()
      };

      if (editingCollection) {
        await updateDoc(doc(db, 'collections', editingCollection.id), payload);
        await logAudit(AuditAction.COLLECTION_UPDATE, `Lote de cobranza manual actualizado: $${totalColl}`, editingCollection.id);
        showToast('Cobranza actualizada exitosamente', 'success');
      } else {
        const docRef = await addDoc(collection(db, 'collections'), {
          ...payload,
          createdAt: Timestamp.now(),
          createdBy: user.uid
        });
        await logAudit(AuditAction.COLLECTION_CREATE, `Cobranza manual registrada: $${totalColl}`, docRef.id);
        showToast('Cobranza registrada exitosamente', 'success');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error saving manual collection:', err);
      showToast('Error al guardar la cobranza', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl p-6 w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto border border-neutral-200 dark:border-neutral-800">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-bold text-neutral-900 dark:text-white">
              {editingCollection ? 'Editar Cobranza Manual' : 'Registrar Cobro a Presupuesto / Manual'}
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              Registro estadístico de lotes o recibos para cálculo de metas y comisiones de cobradores.
            </p>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-neutral-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Cobrador Responsable *
              </label>
              <select
                required
                value={formData.employeeId}
                onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                className="w-full px-4 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-neutral-900 dark:text-white text-sm"
              >
                <option value="" disabled>Seleccione...</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name} {emp.lastName} ({emp.role})</option>
                ))}
              </select>
            </div>
            
            <div className="flex items-end">
              <label className="flex items-center gap-3 cursor-pointer p-2 w-full border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 rounded-xl hover:bg-amber-100 dark:hover:bg-amber-900/20 transition-colors h-[42px]">
                <input
                  type="checkbox"
                  checked={formData.noReceipt}
                  onChange={(e) => setFormData({
                    ...formData, 
                    noReceipt: e.target.checked,
                    initialReceipt: e.target.checked ? '' : formData.initialReceipt,
                    finalReceipt: e.target.checked ? '' : formData.finalReceipt,
                    clientName: e.target.checked ? formData.clientName : ''
                  })}
                  className="w-4 h-4 text-amber-600 rounded border-amber-300 focus:ring-amber-500"
                />
                <span className="text-xs font-bold text-amber-900 dark:text-amber-500 uppercase tracking-wider">
                  Cobro Directo en Agencia
                </span>
              </label>
            </div>
          </div>

          {formData.noReceipt && (
            <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-xl space-y-2">
              <label className="block text-sm font-medium text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                <User className="w-4 h-4 text-amber-500" />
                <span>Nombre del Cliente (Obligatorio)</span>
              </label>
              <input
                type="text"
                required
                value={formData.clientName}
                onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                className="w-full px-4 py-2 bg-white dark:bg-neutral-900 border border-amber-300 dark:border-amber-700 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-neutral-900 dark:text-white"
                placeholder="Ej. Juan Pérez"
              />
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Esta opción se utiliza cuando el cliente se acerca directamente a realizar un pago en la oficina sin la intervención física del cobrador con libreta de recibos.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-neutral-50 dark:bg-neutral-800/30 p-4 rounded-xl border border-neutral-100 dark:border-neutral-800">
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 border-b border-neutral-200 dark:border-neutral-700 pb-2">Datos Iniciales</h3>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-neutral-400" />
                  <span>Fecha Inicial</span>
                </label>
                <input
                  type="date"
                  required
                  value={formData.initialDate}
                  onChange={(e) => setFormData({ ...formData, initialDate: e.target.value })}
                  className="w-full px-4 py-2 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-neutral-900 dark:text-white text-sm"
                />
              </div>
              {!formData.noReceipt && (
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-neutral-400" />
                    <span>Recibo Inicial</span>
                  </label>
                  <input
                    type="text"
                    required={!formData.noReceipt}
                    value={formData.initialReceipt}
                    onChange={(e) => setFormData({ ...formData, initialReceipt: e.target.value })}
                    className="w-full px-4 py-2 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-neutral-900 dark:text-white font-mono uppercase text-sm"
                    placeholder="Ej. XXX001"
                  />
                </div>
              )}
            </div>
            
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 border-b border-neutral-200 dark:border-neutral-700 pb-2">Datos Finales</h3>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-neutral-400" />
                  <span>Fecha Final</span>
                </label>
                <input
                  type="date"
                  required
                  value={formData.finalDate}
                  onChange={(e) => setFormData({ ...formData, finalDate: e.target.value })}
                  className="w-full px-4 py-2 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-neutral-900 dark:text-white text-sm"
                />
              </div>
              {!formData.noReceipt && (
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-neutral-400" />
                    <span>Recibo Final</span>
                  </label>
                  <input
                    type="text"
                    required={!formData.noReceipt}
                    value={formData.finalReceipt}
                    onChange={(e) => setFormData({ ...formData, finalReceipt: e.target.value })}
                    className="w-full px-4 py-2 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-neutral-900 dark:text-white font-mono uppercase text-sm"
                    placeholder="Ej. XXX099"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-indigo-50/50 dark:bg-indigo-900/10 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800/30">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                <span>Valor Total Cobrado</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 font-medium">$</span>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={formData.totalCollected}
                  onChange={(e) => setFormData({ ...formData, totalCollected: e.target.value })}
                  className="w-full pl-8 pr-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold text-neutral-900 dark:text-white"
                  placeholder="0.00"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                <span>Depósitos / Transf.</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 font-medium">$</span>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={formData.depositsTransfers}
                  onChange={(e) => setFormData({ ...formData, depositsTransfers: e.target.value })}
                  className="w-full pl-8 pr-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm text-neutral-900 dark:text-white"
                  placeholder="0.00"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-bold text-emerald-700 dark:text-emerald-400 mb-1">
                <span>Efectivo Final</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600 dark:text-emerald-400 font-bold">$</span>
                <input
                  type="text"
                  disabled
                  value={calculatedCashFinal.toFixed(2)}
                  className={`w-full pl-8 pr-3 py-2 bg-emerald-50 dark:bg-emerald-900/20 border font-bold rounded-xl outline-none text-sm ${
                    calculatedCashFinal < 0 
                      ? 'border-red-300 text-red-600' 
                      : 'border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                  }`}
                />
              </div>
            </div>
          </div>
          
          <div className="pt-4 flex justify-end gap-3 border-t border-neutral-200 dark:border-neutral-800 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || calculatedCashFinal < 0}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
            >
              {isSubmitting ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>Guardar Cobranza</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
