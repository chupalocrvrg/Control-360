import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../../firebase';
import { collection, getDocs, addDoc, updateDoc, doc, query, where } from 'firebase/firestore';
import { X, User, ShoppingCart, DollarSign, Calendar, AlertCircle, Save, CheckCircle2, Search, ChevronDown, UserCheck, Bike } from 'lucide-react';
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
  initialSale?: any | null;
}

interface RegisteredClient {
  id: string;
  name: string;
  idCard?: string;
  phone?: string;
}

export function NewManualSaleModal({
  isOpen,
  onClose,
  employees,
  currentMonth,
  onSuccess,
  initialSale
}: NewManualSaleModalProps) {
  const { user, profile } = useAuth();
  const { showToast, showConfirm } = useNotification();
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

  // Clientes para sugerencia/autocompletado predictivo
  const [registeredClients, setRegisteredClients] = useState<RegisteredClient[]>([]);
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const clientInputContainerRef = useRef<HTMLDivElement>(null);

  // Cerrar sugerencias al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (clientInputContainerRef.current && !clientInputContainerRef.current.contains(event.target as Node)) {
        setShowClientSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && currentEnterpriseId) {
      if (initialSale) {
        setClientName(initialSale.clientName || '');
        setArticle(initialSale.article || '');
        setDate(initialSale.date || format(new Date(), 'yyyy-MM-dd'));
        setType(initialSale.type || 'contado');
        setEmployeeId(initialSale.employeeId || '');
        setIsMoto(!!initialSale.isMoto);
        setMotoType(initialSale.motoType || 'combustion');
        setTotalValue(initialSale.totalValue?.toString() || '');
      } else {
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
        if (sellers.length > 0) {
          setEmployeeId(sellers[0].id);
        }
      }

      // Fetch existing clients for rapid selection and predictive search
      const fetchClients = async () => {
        try {
          // 1. Fetch from 'clients' collection
          const q = query(collection(db, 'clients'), where('enterpriseId', '==', currentEnterpriseId));
          const snap = await getDocs(q);
          const clientMap = new Map<string, RegisteredClient>();

          snap.docs.forEach(d => {
            const data = d.data();
            const fullName = `${data.lastName || ''} ${data.name || data.firstName || ''}`.trim() || data.name || data.clientName || 'Sin nombre';
            const key = fullName.toLowerCase();
            if (!clientMap.has(key)) {
              clientMap.set(key, {
                id: d.id,
                name: fullName,
                idCard: data.idCard,
                phone: data.phone
              });
            }
          });

          // 2. Also fetch unique client names from past sales
          const salesQ = query(collection(db, 'sales'), where('enterpriseId', '==', currentEnterpriseId));
          const salesSnap = await getDocs(salesQ);
          salesSnap.docs.forEach(d => {
            const cName = (d.data().clientName || '').trim();
            if (cName) {
              const key = cName.toLowerCase();
              if (!clientMap.has(key)) {
                clientMap.set(key, {
                  id: `sale-client-${d.id}`,
                  name: cName
                });
              }
            }
          });

          const sortedList = Array.from(clientMap.values()).sort((a, b) => a.name.localeCompare(b.name));
          setRegisteredClients(sortedList);
        } catch (err) {
          console.error('Error fetching clients for suggestions:', err);
        }
      };
      fetchClients();
    }
  }, [isOpen, currentEnterpriseId, initialSale]);

  // Filtrado reactivo de sugerencias de clientes
  const filteredClientSuggestions = useMemo(() => {
    const term = clientName.trim().toLowerCase();
    if (!term) return registeredClients.slice(0, 10);
    return registeredClients.filter(c => 
      c.name.toLowerCase().includes(term) ||
      (c.idCard && c.idCard.includes(term)) ||
      (c.phone && c.phone.includes(term))
    ).slice(0, 15);
  }, [clientName, registeredClients]);

  const isExactClientMatch = useMemo(() => {
    const term = clientName.trim().toLowerCase();
    return registeredClients.some(c => c.name.toLowerCase() === term);
  }, [clientName, registeredClients]);

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

    const trimmedClient = clientName.trim();
    if (!trimmedClient) {
      showToast('Ingrese el nombre del cliente.', 'warning');
      return;
    }

    const finalArticle = article.trim() || (isMoto ? `Moto ${motoType === 'combustion' ? 'Combustión' : 'Eléctrica'}` : 'Venta Externa');

    try {
      setIsSubmitting(true);

      // Validación de duplicados:
      // Mismo Cliente + Mismo Artículo + Mismo Vendedor + Mismo Valor
      const qSales = query(collection(db, 'sales'), where('enterpriseId', '==', currentEnterpriseId));
      const salesSnap = await getDocs(qSales);

      const existingDuplicate = salesSnap.docs.find(d => {
        if (initialSale && d.id === initialSale.id) return false;
        const data = d.data();
        if (data.status === 'ANULADO') return false;

        const sameClient = (data.clientName || '').trim().toLowerCase() === trimmedClient.toLowerCase();
        const sameArticle = (data.article || '').trim().toLowerCase() === finalArticle.toLowerCase();
        const sameSeller = data.employeeId === employeeId;
        const sameValue = Math.abs(Number(data.totalValue || 0) - numericValue) < 0.01;

        return sameClient && sameArticle && sameSeller && sameValue;
      });

      if (existingDuplicate) {
        setIsSubmitting(false);
        const confirmMessage = `Atención: Ya existe una venta registrada con los mismos datos para este cliente [${trimmedClient} - ${finalArticle}]. ¿Desea generar esta nueva venta de todos modos?`;
        const proceed = await showConfirm(
          'Alerta: Venta Duplicada',
          confirmMessage,
          {
            type: 'warning',
            confirmText: 'Sí, generar venta',
            cancelText: 'No, cancelar'
          }
        );
        if (!proceed) {
          return;
        }
        setIsSubmitting(true);
      }

      const saleData = {
        date,
        type,
        employeeId,
        isMoto,
        motoType: isMoto ? motoType : null,
        clientName: trimmedClient,
        article: finalArticle,
        totalValue: numericValue,
        enterpriseId: currentEnterpriseId,
        isManual: true, // Indica venta manual/externa para presupuesto
        note: 'Venta manual registrada desde módulo de Comercio (sin descuento de stock)'
      };

      if (initialSale) {
        await updateDoc(doc(db, 'sales', initialSale.id), {
          ...saleData,
          updatedAt: new Date().toISOString()
        });
        await logAudit(AuditAction.SALE_UPDATE, `Venta manual/externa actualizada: ${initialSale.id}`, initialSale.id);
        showToast('Venta manual actualizada exitosamente', 'success');
      } else {
        const docRef = await addDoc(collection(db, 'sales'), {
          ...saleData,
          createdAt: new Date().toISOString()
        });
        await logAudit(
          AuditAction.SALE_CREATE,
          `Venta manual/externa registrada. Cliente: ${trimmedClient}, Monto: $${numericValue}`,
          docRef.id
        );
        showToast('Venta manual registrada exitosamente', 'success');
      }

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
                Comercio • Presupuestos
              </span>
              <span className="text-xs text-neutral-400 font-medium">Sin Afectar Stock</span>
            </div>
            <h2 className="text-xl font-black text-neutral-900 dark:text-white mt-1 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-emerald-600" />
              {initialSale ? 'Editar Venta Manual' : 'Generar Venta Manual'}
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
          
          {/* Cliente con Búsqueda Predictiva y Autocompletado */}
          <div ref={clientInputContainerRef} className="relative">
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400">
                Nombre del Cliente <span className="text-emerald-500 font-normal lowercase">(predictivo)</span>
              </label>
              {isExactClientMatch && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                  <UserCheck className="w-3 h-3" /> Cliente registrado
                </span>
              )}
            </div>

            <div className="relative">
              <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                required
                value={clientName}
                onFocus={() => setShowClientSuggestions(true)}
                onChange={(e) => {
                  setClientName(e.target.value);
                  setShowClientSuggestions(true);
                }}
                className="w-full pl-9 pr-14 py-2.5 bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-medium text-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                placeholder="Escriba o seleccione un cliente..."
                autoComplete="off"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {clientName && (
                  <button
                    type="button"
                    onClick={() => {
                      setClientName('');
                      setShowClientSuggestions(true);
                    }}
                    className="p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 rounded-lg"
                    title="Limpiar cliente"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowClientSuggestions(!showClientSuggestions)}
                  className="p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 rounded-lg"
                  title="Mostrar lista de clientes"
                >
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showClientSuggestions ? 'rotate-180' : ''}`} />
                </button>
              </div>
            </div>

            {/* Menú Flotante de Sugerencias Predictivas */}
            {showClientSuggestions && (
              <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl shadow-xl overflow-hidden max-h-56 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="p-2 border-b border-neutral-100 dark:border-neutral-700/60 bg-neutral-50 dark:bg-neutral-900/50 flex justify-between items-center text-[11px] text-neutral-500">
                  <span className="font-bold flex items-center gap-1">
                    <Search className="w-3 h-3 text-emerald-500" /> Clientes coincidentes
                  </span>
                  <span>{filteredClientSuggestions.length} encontrados</span>
                </div>

                {filteredClientSuggestions.length === 0 ? (
                  <div className="p-3 text-center">
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
                      No se encontraron clientes registrados con "{clientName}".
                    </p>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 font-bold">
                      Se registrará como un nuevo cliente.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-neutral-100 dark:divide-neutral-700/40">
                    {filteredClientSuggestions.map(client => (
                      <button
                        key={client.id}
                        type="button"
                        onClick={() => {
                          setClientName(client.name);
                          setShowClientSuggestions(false);
                        }}
                        className="w-full px-3.5 py-2.5 text-left hover:bg-emerald-50/70 dark:hover:bg-emerald-950/30 transition-colors flex items-center justify-between group"
                      >
                        <div>
                          <p className="text-xs font-bold text-neutral-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                            {client.name}
                          </p>
                          {(client.idCard || client.phone) && (
                            <p className="text-[10px] text-neutral-400">
                              {client.idCard ? `C.I: ${client.idCard}` : ''}
                              {client.idCard && client.phone ? ' • ' : ''}
                              {client.phone ? `Telf: ${client.phone}` : ''}
                            </p>
                          )}
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 font-bold group-hover:bg-emerald-100 group-hover:text-emerald-800 dark:group-hover:bg-emerald-900 dark:group-hover:text-emerald-200">
                          Seleccionar
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
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
              placeholder="Descripción del artículo (ej. Refrigeradora, Televisor, Cocina...)"
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
                <span className="text-xs font-bold text-neutral-900 dark:text-white block flex items-center gap-1.5">
                  <Bike className="w-4 h-4 text-emerald-600" />
                  ¿La venta incluye una Moto?
                </span>
                <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  Las motos suman solo como UNIDADES vendidas, no al monto monetario de la meta.
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
              Valor Total ($ USD) {isMoto ? '(Registrado para referencia, no suma a la meta monetaria)' : ''}
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
                  <span>{initialSale ? 'Actualizar Venta' : 'Registrar Venta'}</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
