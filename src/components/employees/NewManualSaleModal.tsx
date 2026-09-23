import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, getDocs, addDoc, query, where } from 'firebase/firestore';
import { X, User, ShoppingCart, DollarSign, Calendar, AlertCircle, Save, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { logAudit, AuditAction } from '../../lib/audit';
import { format } from 'date-fns';
import { Employee } from '../../pages/Employees';

interface NewManualSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  currentMonth?: string;
  onSuccess: () => void;
}

export function NewManualSaleModal({
  isOpen,
  onClose,
  employees,
  currentMonth,
  onSuccess
}: NewManualSaleModalProps) {
  const { user, profile } = useAuth();
  const { showToast } = useNotification();
  const currentEnterpriseId = profile?.enterpriseId || user?.uid;

  const [clientName, setClientName] = useState('');
  const [article, setArticle] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [type, setType] = useState<'contado' | 'credito'>('contado');
  const [employeeId, setEmployeeId] = useState('');
  const [isMoto, setIsMoto] = useState(false);
  const [motoType, setMotoType] = useState<'combustion' | 'electrico'>('combustion');
  const [totalValue, setTotalValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Clientes para sugerencia/autocompletado
  const [registeredClients, setRegisteredClients] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (isOpen && currentEnterpriseId) {
      // Reset form
      setClientName('');
      setArticle('');
      setDate(format(new Date(), 'yyyy-MM-dd'));
      setType('contado');
      setIsMoto(false);
      setMotoType('combustion');
      setTotalValue('');
      
      // Default employee if available
      const sellers = employees.filter(e => ['vendedor', 'ambos', 'supervisor_ventas', 'supervisor_general'].includes(e.role));
      if (sellers.length > 0 && !employeeId) {
        setEmployeeId(sellers[0].id);
      }

      // Fetch existing clients for rapid selection
      const fetchClients = async () => {
        try {
          const q = query(collection(db, 'clients'), where('enterpriseId', '==', currentEnterpriseId));
          const snap = await getDocs(q);
          const list = snap.docs.map(d => ({
            id: d.id,
            name: `${d.data().name || ''} ${d.data().lastName || ''}`.trim() || d.data().name || 'Sin nombre'
          }));
          setRegisteredClients(list);
        } catch (err) {
          console.error('Error fetching clients for suggestions:', err);
        }
      };
      fetchClients();
    }
  }, [isOpen, currentEnterpriseId]);

  if (!isOpen) return null;

  const sellers = employees.filter(e => ['vendedor', 'ambos', 'supervisor_ventas', 'supervisor_general'].includes(e.role));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentEnterpriseId) {
      showToast('Error: No se identificó la empresa del usuario.', 'error');
      return;
    }

    if (!employeeId) {
      showToast('Seleccione el vendedor responsable de la venta.', 'warning');
      return;
    }

    const numericValue = parseFloat(totalValue);
    if (isNaN(numericValue) || numericValue <= 0) {
      showToast('Ingrese un valor numérico válido mayor a 0.', 'warning');
      return;
    }

    try {
      setIsSubmitting(true);

      const newSaleData = {
        date,
        type,
        employeeId,
        isMoto,
        motoType: isMoto ? motoType : null,
        clientName: clientName.trim(),
        article: article.trim() || (isMoto ? `Moto ${motoType === 'combustion' ? 'Combustión' : 'Eléctrica'}` : 'Venta Externa'),
        totalValue: numericValue,
        enterpriseId: currentEnterpriseId,
        createdAt: new Date().toISOString(),
        isManual: true, // Indica venta manual/externa para presupuesto
        note: 'Venta manual registrada desde Presupuestos (sin descuento de stock)'
      };

      const docRef = await addDoc(collection(db, 'sales'), newSaleData);

      const assignedEmp = employees.find(e => e.id === employeeId);
      const sellerLabel = assignedEmp ? `${assignedEmp.name} ${assignedEmp.lastName}` : 'Vendedor';

      await logAudit(
        AuditAction.SALE_CREATE,
        `Venta manual/externa registrada para ${sellerLabel}. Cliente: ${clientName}, Monto: $${numericValue}, ¿Moto?: ${isMoto ? 'Sí (' + motoType + ')' : 'No'}`,
        docRef.id
      );

      showToast('Venta manual registrada exitosamente para el presupuesto', 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error saving manual sale:', err);
      showToast('Error al registrar la venta manual: ' + (err?.message || 'Error desconocido'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white dark:bg-neutral-900 rounded-3xl p-6 sm:p-8 w-full max-w-lg shadow-2xl border border-neutral-200 dark:border-neutral-800 animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex justify-between items-start pb-4 mb-4 border-b border-neutral-100 dark:border-neutral-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                Presupuestos & Metas
              </span>
              <span className="text-xs text-neutral-400 font-medium">Sin Afectar Stock</span>
            </div>
            <h2 className="text-xl font-black text-neutral-900 dark:text-white mt-1 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-emerald-600" />
              Nueva Venta Manual / Externa
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              Registra una venta que sumará al presupuesto y comisiones del vendedor sin alterar el inventario de bodega.
            </p>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl text-neutral-400 hover:text-neutral-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Cliente */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-1.5">
              Cliente
            </label>
            <input
              type="text"
              required
              list="registered-clients-list"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-medium text-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Nombre del cliente..."
            />
            <datalist id="registered-clients-list">
              {registeredClients.map(c => (
                <option key={c.id} value={c.name} />
              ))}
            </datalist>
          </div>

          {/* Artículo Vendido */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-1.5">
              Artículo Vendido
            </label>
            <input
              type="text"
              required
              value={article}
              onChange={(e) => setArticle(e.target.value)}
              className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-medium text-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Descripción del artículo (ej. Refrigeradora, Moto XYZ, Repuestos...)"
            />
          </div>

          {/* Fecha y Tipo de Venta */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-1.5">
                Fecha
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-medium text-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-1.5">
                Tipo de Venta
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as 'contado' | 'credito')}
                className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-bold text-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="contado">Contado</option>
                <option value="credito">Crédito</option>
              </select>
            </div>
          </div>

          {/* Vendedor */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-1.5">
              Vendedor Asignado
            </label>
            <select
              required
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-bold text-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">-- Seleccionar Vendedor --</option>
              {sellers.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} {emp.lastName} ({emp.role.replace('_', ' ')})
                </option>
              ))}
            </select>
          </div>

          {/* ¿Incluye Moto? */}
          <div className="p-4 bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700/80 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-neutral-900 dark:text-white block">
                  ¿La venta incluye una Moto?
                </span>
                <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  Suma a la meta física de motos del vendedor sin inflar dinero.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isMoto}
                  onChange={(e) => setIsMoto(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            {isMoto && (
              <div className="pt-3 border-t border-neutral-200 dark:border-neutral-700">
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-1.5">
                  Tipo de Moto
                </label>
                <select
                  value={motoType}
                  onChange={(e) => setMotoType(e.target.value as 'combustion' | 'electrico')}
                  className="w-full px-4 py-2 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs font-bold text-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="combustion">Combustión</option>
                  <option value="electrico">Eléctrica</option>
                </select>
              </div>
            )}
          </div>

          {/* Valor Total */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-1.5">
              Valor Total ($ USD)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 font-bold">$</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={totalValue}
                onChange={(e) => setTotalValue(e.target.value)}
                className="w-full pl-8 pr-4 py-3 bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 rounded-xl text-base font-black text-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-2xl text-xs font-bold uppercase tracking-wider transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Registrar Venta</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
