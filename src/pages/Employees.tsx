import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, Timestamp, query, where, writeBatch } from 'firebase/firestore';
import { Plus, Pencil, Trash2, Users, AlertCircle, Save, X, Target, Calendar, Search, ShoppingBag, ChevronDown, ChevronUp, DollarSign, TrendingUp, Award } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { logAudit, AuditAction } from '../lib/audit';
import { format, startOfMonth, addMonths, subMonths, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { NewManualSaleModal } from '../components/employees/NewManualSaleModal';
import { ManualCollectionModal } from '../components/collections/ManualCollectionModal';
import { BadgeDollarSign } from 'lucide-react';

export type EmployeeRole = 'vendedor' | 'cobrador' | 'ambos' | 'supervisor_ventas' | 'supervisor_cobranza' | 'supervisor_general';

export interface Employee {
  id: string;
  name: string;
  lastName: string;
  role: EmployeeRole;
  createdAt: any;
  enterpriseId: string;
}

export interface Budget {
  id: string;
  employeeId: string;
  month: string; // YYYY-MM
  salesBudget: number;
  collectionsBudget: number;
}

export default function Employees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [budgets, setBudgets] = useState<Record<string, Budget>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, profile, isSuperAdmin } = useAuth();
  const { showToast, showConfirm } = useNotification();
  const currentEnterpriseId = profile?.enterpriseId || user?.uid;
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [isManualSaleModalOpen, setIsManualSaleModalOpen] = useState(false);
  const [isManualCollectionModalOpen, setIsManualCollectionModalOpen] = useState(false);
  
  // Real sales and collections data for comparison
  const [salesRecords, setSalesRecords] = useState<any[]>([]);
  const [collectionRecords, setCollectionRecords] = useState<any[]>([]);
  const [manualCollections, setManualCollections] = useState<any[]>([]);
  const [expandedSellerId, setExpandedSellerId] = useState<string | null>(null);
  const [expandedCollectorId, setExpandedCollectorId] = useState<string | null>(null);
  
  // Search and tabs
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'PERSONAL' | 'PRESUPUESTOS'>('PERSONAL');
  const [currentMonth, setCurrentMonth] = useState(format(new Date(), 'yyyy-MM'));

  const [savingBudgets, setSavingBudgets] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({
    name: '',
    lastName: '',
    role: 'vendedor' as EmployeeRole
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchEmployees();
  }, [user, currentEnterpriseId]);

  useEffect(() => {
    if (activeTab === 'PRESUPUESTOS') {
      fetchBudgets();
    }
  }, [currentMonth, activeTab, employees]);

  const fetchEmployees = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const targetEntId = currentEnterpriseId || user.uid;

      // 1. Fetch from employees collection
      const q = query(collection(db, 'employees'), where('enterpriseId', '==', targetEntId));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee & { email?: string; userId?: string }));

      // 2. Also fetch users linked as employees to this enterprise (safely guarded)
      let userEmployees: (Employee & { email?: string; userId?: string })[] = [];
      try {
        if (isSuperAdmin) {
          const qUsers = query(collection(db, 'users'), where('enterpriseId', '==', targetEntId), where('role', '==', 'employee'));
          const snapshotUsers = await getDocs(qUsers);
          userEmployees = snapshotUsers.docs.map(uDoc => {
            const uData = uDoc.data();
            return {
              id: uDoc.id,
              name: uData.name || 'Empleado',
              lastName: uData.lastName || '',
              role: (uData.employeeRole || 'vendedor') as EmployeeRole,
              enterpriseId: targetEntId,
              email: uData.email,
              userId: uDoc.id,
              createdAt: uData.createdAt || Timestamp.now()
            };
          });
        }
      } catch (e) {
        // Non-admin users cannot list 'users' collection; safely ignore
      }

      const combined = [...data, ...userEmployees];

      // Deduplicate by normalized name or userId/email
      const uniqueEmps: (Employee & { email?: string; userId?: string })[] = [];
      const seenKeys = new Set<string>();

      combined.forEach(emp => {
        const nameKey = `${emp.name || ''} ${emp.lastName || ''}`.trim().toLowerCase();
        const emailKey = (emp as any).email ? (emp as any).email.toLowerCase() : '';
        const key = emailKey ? `email:${emailKey}` : `name:${nameKey}`;
        
        if (!seenKeys.has(key) && !seenKeys.has(`name:${nameKey}`)) {
          seenKeys.add(key);
          seenKeys.add(`name:${nameKey}`);
          uniqueEmps.push(emp);
        }
      });

      uniqueEmps.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
        return timeB - timeA;
      });
      setEmployees(uniqueEmps);
    } catch (err: any) {
      console.error('Error fetching employees:', err);
      setError('Error al cargar empleados');
    } finally {
      setLoading(false);
    }
  };

  const fetchBudgets = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const targetEntId = currentEnterpriseId || user.uid;
      
      // 1. Fetch budgets for the month
      const qBudgets = query(collection(db, 'budgets'), where('enterpriseId', '==', targetEntId), where('month', '==', currentMonth));
      const snap = await getDocs(qBudgets);
      const budgetMap: Record<string, Budget> = {};
      snap.docs.forEach(d => {
        const data = d.data();
        if (employees.some(e => e.id === data.employeeId)) {
          budgetMap[data.employeeId] = { id: d.id, ...data } as Budget;
        }
      });
      setBudgets(budgetMap);

      // 2. Fetch sales for the month to calculate real metrics
      const qSales = query(collection(db, 'sales'), where('enterpriseId', '==', targetEntId));
      const snapSales = await getDocs(qSales);
      const salesForMonth = snapSales.docs
        .map(d => ({ id: d.id, ...d.data() } as any))
        .filter(s => s.date && s.date.startsWith(currentMonth));
      setSalesRecords(salesForMonth);

      // 3. Fetch credit payments for the month to calculate collections metrics
      const qPayments = query(collection(db, 'credit_payments'), where('enterpriseId', '==', targetEntId));
      const snapPayments = await getDocs(qPayments);
      const paymentsForMonth = snapPayments.docs
        .map(d => ({ id: d.id, ...d.data() } as any))
        .filter(p => p.status !== 'ANULADO' && p.paymentDate && p.paymentDate.startsWith(currentMonth));
      setCollectionRecords(paymentsForMonth);

      // 4. Fetch manual collections (lotes) for the month
      const qManual = query(collection(db, 'collections'), where('enterpriseId', '==', targetEntId));
      const snapManual = await getDocs(qManual);
      const manualForMonth = snapManual.docs
        .map(d => ({ id: d.id, ...d.data() } as any))
        .filter(m => m.initialDate && m.initialDate.startsWith(currentMonth));
      setManualCollections(manualForMonth);

    } catch (err) {
      console.error('Error fetching budgets and operational data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (employee?: Employee) => {
    if (employee) {
      setEditingEmployee(employee);
      setFormData({
        name: employee.name,
        lastName: employee.lastName,
        role: employee.role
      });
    } else {
      setEditingEmployee(null);
      setFormData({
        name: '',
        lastName: '',
        role: 'vendedor'
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    try {
      setIsSubmitting(true);
      const targetEntId = currentEnterpriseId || user.uid;

      const normalizedNewName = `${formData.name} ${formData.lastName}`.trim().toLowerCase();
      const existingDup = employees.find(emp => 
        (!editingEmployee || emp.id !== editingEmployee.id) &&
        `${emp.name} ${emp.lastName}`.trim().toLowerCase() === normalizedNewName
      );

      if (existingDup) {
        const docRef = doc(db, 'employees', existingDup.id);
        await updateDoc(docRef, {
          name: formData.name,
          lastName: formData.lastName,
          role: formData.role,
          enterpriseId: targetEntId
        });
        await logAudit(AuditAction.EMPLOYEE_UPDATE, `Empleado actualizado (sin duplicar): ${formData.name} ${formData.lastName} (${formData.role})`, existingDup.id);
        showToast('Empleado actualizado exitosamente', 'success');
      } else if (editingEmployee) {
        const docRef = doc(db, 'employees', editingEmployee.id);
        await updateDoc(docRef, {
          name: formData.name,
          lastName: formData.lastName,
          role: formData.role,
          enterpriseId: targetEntId
        });
        await logAudit(AuditAction.EMPLOYEE_UPDATE, `Empleado modificado: ${formData.name} ${formData.lastName} (${formData.role})`, editingEmployee.id);
        showToast('Empleado modificado exitosamente', 'success');
      } else {
        const newDoc = await addDoc(collection(db, 'employees'), {
          name: formData.name,
          lastName: formData.lastName,
          role: formData.role,
          enterpriseId: targetEntId,
          createdAt: Timestamp.now()
        });
        await logAudit(AuditAction.EMPLOYEE_UPDATE, `Empleado creado: ${formData.name} ${formData.lastName} (${formData.role})`, newDoc.id);
        showToast('Empleado registrado exitosamente', 'success');
      }
      setIsModalOpen(false);
      fetchEmployees();
    } catch (err: any) {
      console.error('Error saving employee:', err);
      setError('Error al guardar empleado');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (await showConfirm('Eliminar Empleado', '¿Está seguro de eliminar este empleado?', { type: 'danger' })) {
      try {
        const empToDelete = employees.find(e => e.id === id);
        await deleteDoc(doc(db, 'employees', id));
        if (empToDelete) {
           await logAudit(AuditAction.EMPLOYEE_UPDATE, `Empleado eliminado: ${empToDelete.name} ${empToDelete.lastName}`, id);
        }
        fetchEmployees();
      } catch (err: any) {
        console.error('Error deleting employee:', err);
        setError('Error al eliminar empleado');
      }
    }
  };

  const handleBudgetChange = (employeeId: string, field: 'salesBudget' | 'collectionsBudget', value: string) => {
    const numValue = parseFloat(value) || 0;
    setBudgets(prev => ({
      ...prev,
      [employeeId]: {
        ...(prev[employeeId] || { id: '', employeeId, month: currentMonth, salesBudget: 0, collectionsBudget: 0 }),
        [field]: numValue
      }
    }));
  };

  const handleSaveBudgets = async () => {
    try {
      setSavingBudgets(true);
      const batch = writeBatch(db);
      const targetEntId = currentEnterpriseId || user?.uid;
      
      Object.values(budgets).forEach((budget: Budget) => {
        if (budget.id) {
          batch.update(doc(db, 'budgets', budget.id), {
            salesBudget: budget.salesBudget,
            collectionsBudget: budget.collectionsBudget,
            enterpriseId: targetEntId
          });
        } else {
          const newRef = doc(collection(db, 'budgets'));
          batch.set(newRef, {
            employeeId: budget.employeeId,
            month: budget.month,
            salesBudget: budget.salesBudget,
            collectionsBudget: budget.collectionsBudget,
            enterpriseId: targetEntId
          });
          budget.id = newRef.id;
        }
      });

      await batch.commit();
      showToast('Presupuestos guardados exitosamente', 'success');
    } catch (err) {
      console.error('Error saving budgets:', err);
      showToast('Error al guardar presupuestos', 'error');
    } finally {
      setSavingBudgets(false);
    }
  };

  const filteredEmployees = employees.filter(emp => 
    emp.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    emp.lastName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Budgets calculations
  const totalSalesBudget = employees
    .filter(e => ['vendedor', 'ambos'].includes(e.role))
    .reduce((sum, e) => sum + (budgets[e.id]?.salesBudget || 0), 0);
    
  const totalCollectionsBudget = employees
    .filter(e => ['cobrador', 'ambos'].includes(e.role))
    .reduce((sum, e) => sum + (budgets[e.id]?.collectionsBudget || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50 flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-500" />
            Directorio Comercial
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm mt-1">
            Gestiona el personal de ventas y cobranzas
          </p>
        </div>
        
        <div className="flex bg-neutral-100 dark:bg-neutral-800 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('PERSONAL')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'PERSONAL' ? 'bg-white dark:bg-neutral-900 text-indigo-600 shadow-sm' : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'}`}
          >
            Personal
          </button>
          <button
            onClick={() => setActiveTab('PRESUPUESTOS')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'PRESUPUESTOS' ? 'bg-white dark:bg-neutral-900 text-indigo-600 shadow-sm' : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'}`}
          >
            Presupuestos Mensuales
          </button>
        </div>

        {activeTab === 'PERSONAL' && (
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-colors"
          >
            <Plus className="w-4 h-4" /> Nuevo Empleado
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-4 rounded-xl flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {activeTab === 'PERSONAL' ? (
        <div className="bg-white dark:bg-neutral-900 rounded-[2rem] border border-neutral-200 dark:border-neutral-800 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-neutral-200 dark:border-neutral-800">
            <div className="relative max-w-md">
              <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                placeholder="Buscar empleado..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>
          
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-8 flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              </div>
            ) : filteredEmployees.length === 0 ? (
              <div className="p-8 text-center text-neutral-500">
                No hay empleados registrados.
              </div>
            ) : (
              <table className="w-full text-sm text-left">
                <thead className="bg-neutral-50 dark:bg-neutral-800/30 text-neutral-600 dark:text-neutral-400 font-medium border-b border-neutral-200 dark:border-neutral-800">
                  <tr>
                    <th className="px-6 py-4 rounded-tl-2xl">Nombre</th>
                    <th className="px-6 py-4">Apellidos</th>
                    <th className="px-6 py-4">Cargo / Rol</th>
                    <th className="px-6 py-4">Origen / Cuenta</th>
                    <th className="px-6 py-4 rounded-tr-2xl text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {filteredEmployees.map((employee) => {
                    const email = (employee as any).email;
                    return (
                      <tr key={employee.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                        <td className="px-6 py-4 font-bold text-neutral-900 dark:text-neutral-100">{employee.name}</td>
                        <td className="px-6 py-4 text-neutral-600 dark:text-neutral-400 font-medium">{employee.lastName || '-'}</td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-black bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                            {employee.role?.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {email ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                              Cuenta Correo ({email})
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400">
                              Empleado Interno (Sin Correo)
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleOpenModal(employee)}
                              className="p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                              title="Editar"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(employee.id)}
                              className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                              title="Eliminar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white dark:bg-neutral-900 rounded-[2rem] border border-neutral-200 dark:border-neutral-800 overflow-hidden shadow-sm flex flex-col">
            <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-center gap-2 bg-neutral-50 dark:bg-neutral-800 p-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700">
                <button 
                  onClick={() => { const [y, m] = currentMonth.split('-'); setCurrentMonth(format(subMonths(new Date(Number(y), Number(m) - 1, 15), 1), 'yyyy-MM')); }}
                  className="p-1.5 hover:bg-white dark:hover:bg-neutral-700 rounded-lg transition-colors"
                >
                  &larr;
                </button>
                <div className="flex items-center gap-2 px-3 font-medium text-neutral-900 dark:text-neutral-100">
                  <Calendar className="w-4 h-4 text-indigo-500" />
                  <span className="capitalize">{format(new Date(Number(currentMonth.split('-')[0]), Number(currentMonth.split('-')[1]) - 1, 15), 'MMMM yyyy', { locale: es })}</span>
                </div>
                <button 
                  onClick={() => { const [y, m] = currentMonth.split('-'); setCurrentMonth(format(addMonths(new Date(Number(y), Number(m) - 1, 15), 1), 'yyyy-MM')); }}
                  className="p-1.5 hover:bg-white dark:hover:bg-neutral-700 rounded-lg transition-colors"
                >
                  &rarr;
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setIsManualCollectionModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-bold hover:bg-teal-700 transition-colors shadow-sm"
                  title="Registrar cobro manual de ruta externa para cálculo de metas"
                >
                  <BadgeDollarSign className="w-4 h-4" />
                  Registrar cobro a presupuesto
                </button>
                <button
                  onClick={() => setIsManualSaleModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors shadow-sm"
                  title="Registrar venta externa o manual sin descuento de inventario"
                >
                  <ShoppingBag className="w-4 h-4" />
                  Venta Manual / Externa
                </button>
                <button
                  onClick={handleSaveBudgets}
                  disabled={savingBudgets}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {savingBudgets ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Guardar Cambios
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-neutral-50 dark:bg-neutral-800/30 text-neutral-600 dark:text-neutral-400 font-medium">
                  <tr>
                    <th className="px-4 py-3">Empleado / Supervisor</th>
                    <th className="px-4 py-3">Rol</th>
                    <th className="px-4 py-3 text-right">Presupuesto Ventas</th>
                    <th className="px-4 py-3 text-right">Presupuesto Cobranza</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {employees.map((emp) => {
                    const canSell = ['vendedor', 'ambos', 'supervisor_ventas', 'supervisor_general'].includes(emp.role);
                    const canCollect = ['cobrador', 'ambos', 'supervisor_cobranza', 'supervisor_general'].includes(emp.role);
                    const isSupervisor = emp.role.startsWith('supervisor');
                    
                    return (
                      <tr key={emp.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/30 transition-colors">
                        <td className="px-4 py-3 font-medium text-neutral-900 dark:text-neutral-100">
                          {emp.name} {emp.lastName}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[10px] uppercase tracking-wider font-bold text-neutral-500 dark:text-neutral-400">
                            {emp.role.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {canSell ? (
                            <div className="flex flex-col items-end gap-1">
                              <div className="flex items-center justify-end">
                                <span className="text-neutral-500 mr-2">$</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={budgets[emp.id]?.salesBudget || ''}
                                  onChange={(e) => handleBudgetChange(emp.id, 'salesBudget', e.target.value)}
                                  className="w-28 px-3 py-1.5 text-right bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                  placeholder="0.00"
                                />
                              </div>
                              {isSupervisor && (
                                <span className="text-[9px] text-indigo-500 font-bold uppercase">Meta Personal</span>
                              )}
                            </div>
                          ) : (
                            <div className="text-right text-neutral-400 text-xs italic">N/A</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {canCollect ? (
                            <div className="flex flex-col items-end gap-1">
                              <div className="flex items-center justify-end">
                                <span className="text-neutral-500 mr-2">$</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={budgets[emp.id]?.collectionsBudget || ''}
                                  onChange={(e) => handleBudgetChange(emp.id, 'collectionsBudget', e.target.value)}
                                  className="w-28 px-3 py-1.5 text-right bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                  placeholder="0.00"
                                />
                              </div>
                              {isSupervisor && (
                                <span className="text-[9px] text-emerald-500 font-bold uppercase">Meta Personal</span>
                              )}
                            </div>
                          ) : (
                            <div className="text-right text-neutral-400 text-xs italic">N/A</div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-sm p-6 text-white">
              <h3 className="text-indigo-100 text-sm font-medium mb-1">Presupuesto Global Ventas</h3>
              <div className="text-3xl font-bold mb-2">
                ${totalSalesBudget.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-indigo-200 mb-4 bg-indigo-950/25 p-2 rounded-lg">
                La sumatoria de las metas personales define el Presupuesto Global. Los supervisores también asumen esta meta global.
              </p>
              <div className="space-y-3 pt-4 border-t border-indigo-400/30">
                {employees.filter(e => ['vendedor', 'ambos'].includes(e.role)).map(emp => {
                  const b = budgets[emp.id]?.salesBudget || 0;
                  if (b === 0) return null;
                  const pct = totalSalesBudget > 0 ? (b / totalSalesBudget) * 100 : 0;
                  return (
                    <div key={emp.id} className="text-sm">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-indigo-100 truncate pr-2">{emp.name} {emp.lastName}</span>
                        <span className="font-bold bg-indigo-950/40 px-2 py-0.5 rounded text-xs">
                          {pct.toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-indigo-950/30 rounded-full h-1.5">
                        <div className="bg-indigo-300 rounded-full h-1.5" style={{ width: `${pct}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl shadow-sm p-6 text-white">
              <h3 className="text-emerald-100 text-sm font-medium mb-1">Presupuesto Global Cobranzas</h3>
              <div className="text-3xl font-bold mb-2">
                ${totalCollectionsBudget.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-emerald-100 mb-4 bg-emerald-950/25 p-2.5 rounded-lg border border-emerald-400/20 leading-relaxed">
                La sumatoria de las metas personales define el Presupuesto Global. Los supervisores también asumen esta meta global.
              </p>
              <div className="space-y-3 pt-4 border-t border-emerald-400/30">
                {employees.filter(e => ['cobrador', 'ambos'].includes(e.role)).map(emp => {
                  const b = budgets[emp.id]?.collectionsBudget || 0;
                  if (b === 0) return null;
                  const pct = totalCollectionsBudget > 0 ? (b / totalCollectionsBudget) * 100 : 0;
                  return (
                    <div key={emp.id} className="text-sm">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-emerald-100 truncate pr-2">{emp.name} {emp.lastName}</span>
                        <span className="font-bold bg-emerald-950/40 px-2 py-0.5 rounded text-xs">
                          {pct.toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-emerald-950/30 rounded-full h-1.5">
                        <div className="bg-emerald-300 rounded-full h-1.5" style={{ width: `${pct}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Sección de Rendimiento y Balance de Ventas: Meta vs Ventas Reales Desplegables */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm p-6 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-neutral-200 dark:border-neutral-800 pb-4">
            <div>
              <h2 className="text-lg font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                <Award className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                Rendimiento Individual de Vendedores: Meta vs Ventas Reales
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Supervisa el avance mensual individual frente a la meta y despliega el detalle de cada factura o recibo generado.
              </p>
            </div>
            <span className="text-xs px-3 py-1 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-bold rounded-lg border border-indigo-200 dark:border-indigo-800/60">
              Período: {format(parseISO(currentMonth + '-15'), 'MMMM yyyy', { locale: es })}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {employees.filter(e => ['vendedor', 'ambos', 'supervisor_ventas', 'supervisor_general'].includes(e.role)).map(seller => {
              const sellerSales = salesRecords.filter(s => s.employeeId === seller.id);
              const realSalesTotal = sellerSales.reduce((acc, s) => acc + (s.totalValue || 0), 0);
              const targetGoal = budgets[seller.id]?.salesBudget || 0;
              const percentage = targetGoal > 0 ? Math.min(Math.round((realSalesTotal / targetGoal) * 100), 200) : 0;
              const isExpanded = expandedSellerId === seller.id;

              return (
                <div
                  key={seller.id}
                  className="bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700/80 rounded-2xl p-4 transition-all hover:shadow-md"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-neutral-900 dark:text-white text-sm">
                        {seller.name} {seller.lastName}
                      </h3>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                        {seller.role.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">
                        {percentage}%
                      </span>
                      <p className="text-[10px] text-neutral-400">de meta</p>
                    </div>
                  </div>

                  {/* Barra de progreso */}
                  <div className="w-full bg-neutral-200 dark:bg-neutral-700 h-2 rounded-full overflow-hidden mb-3">
                    <div
                      className={`h-full transition-all duration-500 rounded-full ${
                        percentage >= 100
                          ? 'bg-emerald-500'
                          : percentage >= 70
                          ? 'bg-indigo-500'
                          : 'bg-amber-500'
                      }`}
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                  </div>

                  {/* Resumen numérico */}
                  <div className="grid grid-cols-2 gap-2 text-xs mb-3 p-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800">
                    <div>
                      <p className="text-[10px] text-neutral-400 font-medium">Meta Asignada</p>
                      <p className="font-bold text-neutral-700 dark:text-neutral-300">
                        ${targetGoal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-neutral-400 font-medium">Ventas Reales</p>
                      <p className="font-bold text-emerald-600 dark:text-emerald-400">
                        ${realSalesTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>

                  {/* Botón Desplegable */}
                  <button
                    type="button"
                    onClick={() => setExpandedSellerId(isExpanded ? null : seller.id)}
                    className="w-full py-1.5 px-3 rounded-xl bg-white dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs font-bold text-neutral-700 dark:text-neutral-200 flex items-center justify-between transition-colors"
                  >
                    <span>Detalle de ventas ({sellerSales.length})</span>
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {/* Listado Desplegable */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-700 space-y-2 max-h-56 overflow-y-auto pr-1">
                      {sellerSales.length === 0 ? (
                        <p className="text-[11px] text-neutral-400 text-center py-2">
                          Sin ventas registradas en este mes.
                        </p>
                      ) : (
                        sellerSales.map((s) => (
                          <div
                            key={s.id}
                            className="p-2 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800 text-[11px] flex justify-between items-center"
                          >
                            <div className="truncate pr-2">
                              <p className="font-bold text-neutral-900 dark:text-white truncate">
                                {s.clientName || 'Cliente sin nombre'}
                              </p>
                              <p className="text-[10px] text-neutral-400">
                                {s.article} • {s.date}
                              </p>
                            </div>
                            <div className="text-right whitespace-nowrap">
                              <span className="font-bold text-neutral-900 dark:text-neutral-100">
                                ${s.totalValue?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </span>
                              <span className={`block text-[9px] font-bold uppercase ${s.type === 'credito' ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                {s.type}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
           </div>
          </div>

          {/* Sección de Rendimiento y Balance de Cobranza: Meta vs Cobranza Real Desplegables */}
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm p-6 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-neutral-200 dark:border-neutral-800 pb-4">
              <div>
                <h2 className="text-lg font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  Rendimiento Individual de Cobradores: Meta vs Cobranza Real
                </h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Supervisa la recaudación mensual frente a la meta, detallando lotes de recibos manuales y pagos individuales.
                </p>
              </div>
              <span className="text-xs px-3 py-1 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 font-bold rounded-lg border border-emerald-200 dark:border-emerald-800/60">
                Período: {format(parseISO(currentMonth + '-15'), 'MMMM yyyy', { locale: es })}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {employees.filter(e => ['cobrador', 'ambos', 'supervisor_cobranza', 'supervisor_general'].includes(e.role)).map(collector => {
                const collectorManual = manualCollections.filter(m => m.employeeId === collector.id);
                const collectorIndividual = collectionRecords.filter(p => p.employeeId === collector.id);
                
                const manualTotal = collectorManual.reduce((acc, m) => acc + (m.totalCollected || 0), 0);
                const individualTotal = collectorIndividual.reduce((acc, p) => acc + (p.amount || 0), 0);
                const realCollectionsTotal = manualTotal + individualTotal;
                
                const targetGoal = budgets[collector.id]?.collectionsBudget || 0;
                const percentage = targetGoal > 0 ? Math.min(Math.round((realCollectionsTotal / targetGoal) * 100), 200) : 0;
                const isExpanded = expandedCollectorId === collector.id;

                return (
                  <div
                    key={collector.id}
                    className="bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700/80 rounded-2xl p-4 transition-all hover:shadow-md"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-bold text-neutral-900 dark:text-white text-sm">
                          {collector.name} {collector.lastName}
                        </h3>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                          {collector.role.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                          {percentage}%
                        </span>
                        <p className="text-[10px] text-neutral-400">de meta</p>
                      </div>
                    </div>

                    {/* Barra de progreso */}
                    <div className="w-full bg-neutral-200 dark:bg-neutral-700 h-2 rounded-full overflow-hidden mb-3">
                      <div
                        className={`h-full transition-all duration-500 rounded-full ${
                          percentage >= 100
                            ? 'bg-emerald-500'
                            : percentage >= 70
                            ? 'bg-emerald-400'
                            : 'bg-amber-500'
                        }`}
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                      />
                    </div>

                    {/* Resumen numérico */}
                    <div className="grid grid-cols-2 gap-2 text-xs mb-3 p-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800">
                      <div className="col-span-1">
                        <p className="text-[10px] text-neutral-400 font-medium">Meta Asignada</p>
                        <p className="font-bold text-neutral-700 dark:text-neutral-300">
                          ${targetGoal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div className="col-span-1 text-right">
                        <p className="text-[10px] text-neutral-400 font-medium">Total Recaudado</p>
                        <p className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                          ${realCollectionsTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div className="col-span-2 pt-2 mt-1 border-t border-neutral-100 dark:border-neutral-800 flex justify-between items-center text-[10px]">
                        <div className="flex flex-col">
                          <span className="text-neutral-400 uppercase text-[8px] font-bold">Efectivo</span>
                          <span className="text-emerald-700 dark:text-emerald-500 font-black">
                            ${(collectorManual.reduce((acc, m) => acc + (m.cashFinal || 0), 0) + collectorIndividual.filter(p => (p.paymentMethod || 'Efectivo').toLowerCase() === 'efectivo').reduce((acc, p) => acc + (p.amount || 0), 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex flex-col text-right">
                          <span className="text-neutral-400 uppercase text-[8px] font-bold">Transf / Dep</span>
                          <span className="text-blue-600 dark:text-blue-400 font-black">
                            ${(collectorManual.reduce((acc, m) => acc + (m.depositsTransfers || 0), 0) + collectorIndividual.filter(p => (p.paymentMethod || 'Efectivo').toLowerCase() !== 'efectivo').reduce((acc, p) => acc + (p.amount || 0), 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Botón Desplegable */}
                    <button
                      type="button"
                      onClick={() => setExpandedCollectorId(isExpanded ? null : collector.id)}
                      className="w-full py-1.5 px-3 rounded-xl bg-white dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs font-bold text-neutral-700 dark:text-neutral-200 flex items-center justify-between transition-colors"
                    >
                      <span>Detalle de cobranza ({collectorManual.length + collectorIndividual.length})</span>
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    {/* Listado Desplegable Mixto Ordenado Cronológicamente */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-700 space-y-2 max-h-80 overflow-y-auto pr-1">
                        {collectorManual.length === 0 && collectorIndividual.length === 0 ? (
                          <p className="text-[11px] text-neutral-400 text-center py-2">
                            Sin cobranzas registradas en este mes.
                          </p>
                        ) : (
                          <>
                            {[
                              ...collectorManual.map(m => ({ ...m, type: 'manual', date: m.initialDate })),
                              ...collectorIndividual.map(p => ({ ...p, type: 'individual', date: p.paymentDate }))
                            ]
                            .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
                            .map((item) => (
                              item.type === 'manual' ? (
                                <div
                                  key={item.id}
                                  className="p-2.5 rounded-lg bg-indigo-50/30 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 text-[11px]"
                                >
                                  <div className="flex justify-between items-start mb-1">
                                    <div className="pr-2">
                                      <p className="font-black text-indigo-900 dark:text-indigo-300 uppercase tracking-tighter">
                                        {item.noReceipt ? 'COBRO EN AGENCIA' : `RECIBOS: ${item.initialReceipt} AL ${item.finalReceipt}`}
                                      </p>
                                      <p className="text-[10px] text-neutral-500 font-medium italic">
                                        {item.initialDate} al {item.finalDate}
                                      </p>
                                      {item.clientName && <p className="text-[9px] text-neutral-400 mt-0.5">Cliente: {item.clientName}</p>}
                                    </div>
                                    <div className="text-right">
                                      <span className="font-black text-indigo-600 dark:text-indigo-400 text-xs">
                                        ${item.totalCollected?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                      </span>
                                      <div className="text-[9px] space-y-0.5 mt-1">
                                        <p className="text-emerald-600">Ef: ${item.cashFinal?.toFixed(2)}</p>
                                        <p className="text-blue-600">Tr: ${item.depositsTransfers?.toFixed(2)}</p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div
                                  key={item.id}
                                  className="p-2.5 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800 text-[11px] flex justify-between items-center"
                                >
                                  <div className="truncate pr-2">
                                    <p className="font-bold text-neutral-900 dark:text-white truncate uppercase">
                                      {item.clientName || 'Pago Individual'}
                                    </p>
                                    <p className="text-[10px] text-neutral-400">
                                      Recibo: {item.receiptNumber || 'S/N'} • {item.paymentDate}
                                    </p>
                                    <p className="text-[9px] text-neutral-500 italic uppercase">
                                      Modo: {item.paymentMethod || 'Efectivo'}
                                    </p>
                                  </div>
                                  <div className="text-right whitespace-nowrap">
                                    <span className="font-black text-emerald-600 dark:text-emerald-400">
                                      ${item.amount?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </span>
                                    <span className="block text-[9px] font-bold text-neutral-400 uppercase tracking-widest">
                                      INDIVIDUAL
                                    </span>
                                  </div>
                                </div>
                              )
                            ))}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modal Empleado */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl p-6 w-full max-w-md shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                {editingEmployee ? 'Editar Personal' : 'Nuevo Personal'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg">
                <X className="w-5 h-5 text-neutral-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Nombres</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="Ej. Juan Carlos"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Apellidos</label>
                <input
                  type="text"
                  required
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="Ej. Pérez Gómez"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Rol Operativo</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as EmployeeRole })}
                  className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="vendedor">Vendedor</option>
                  <option value="cobrador">Cobrador</option>
                  <option value="ambos">Ambos (Vendedor y Cobrador)</option>
                  <option value="supervisor_ventas">Supervisor de Ventas</option>
                  <option value="supervisor_cobranza">Supervisor de Cobranza</option>
                  <option value="supervisor_general">Supervisor General (Ambos)</option>
                </select>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2 text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-xl font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2 text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal de Venta Manual / Externa para Presupuestos */}
      <NewManualSaleModal
        isOpen={isManualSaleModalOpen}
        onClose={() => setIsManualSaleModalOpen(false)}
        employees={employees}
        currentMonth={currentMonth}
        onSuccess={() => {
          fetchBudgets();
          showToast('Venta registrada exitosamente', 'success');
        }}
      />
      {/* Modal de Cobro a Presupuesto / Ruta Externa */}
      <ManualCollectionModal
        isOpen={isManualCollectionModalOpen}
        onClose={() => setIsManualCollectionModalOpen(false)}
        employees={employees}
        defaultMonth={currentMonth}
        onSuccess={() => {
          fetchBudgets();
          showToast('Cobranza a presupuesto registrada con éxito', 'success');
        }}
      />
    </div>
  );
}
