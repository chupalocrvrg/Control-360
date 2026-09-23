import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, where, orderBy, deleteDoc, doc } from 'firebase/firestore';
import {
  Receipt,
  Plus,
  Trash2,
  Pencil,
  Search,
  Calendar,
  Printer,
  Building2,
  DollarSign,
  AlertCircle,
  Clock,
  ArrowUpRight,
  Filter,
  CheckCircle2,
  XCircle,
  FileText
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { logAudit, AuditAction } from '../lib/audit';
import { format, subMonths, addMonths, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

// Domain Types
import { CreditPayment } from '../types/creditPayment';
import { CreditSale } from '../types/creditSale';
import { Client } from '../types/client';

// Modals
import { ActiveDebtSearchModal } from '../components/collections/ActiveDebtSearchModal';
import { RecordCreditPaymentModal } from '../components/sales/RecordCreditPaymentModal';
import { CreditPaymentReceiptModal } from '../components/sales/CreditPaymentReceiptModal';
import { EditCreditPaymentModal } from '../components/collections/EditCreditPaymentModal';
import { ManualCollectionModal, ManualCollectionData } from '../components/collections/ManualCollectionModal';
import { revertCreditPaymentTransaction } from '../lib/credit-payment-db';

interface Employee {
  id: string;
  name: string;
  lastName: string;
  role: string;
}

export default function Collections() {
  const { user, profile } = useAuth();
  const { showToast, showConfirm } = useNotification();
  const currentEnterpriseId = profile?.enterpriseId || user?.uid;

  // Data states
  const [creditPayments, setCreditPayments] = useState<CreditPayment[]>([]);
  const [creditSales, setCreditSales] = useState<CreditSale[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [manualCollections, setManualCollections] = useState<ManualCollectionData[]>([]);
  const [loading, setLoading] = useState(true);

  // Month navigation filter
  const [currentMonth, setCurrentMonth] = useState(format(new Date(), 'yyyy-MM'));

  // Main Interactive Search Filter (Lupa)
  const [receiptSearchTerm, setReceiptSearchTerm] = useState('');
  const [filterMethod, setFilterMethod] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'VALID' | 'ANULADO'>('ALL');

  // Modal states
  const [isActiveDebtSearchOpen, setIsActiveDebtSearchOpen] = useState(false);
  const [isRecordPaymentModalOpen, setIsRecordPaymentModalOpen] = useState(false);
  const [selectedCreditForPayment, setSelectedCreditForPayment] = useState<CreditSale | null>(null);

  // Receipt Preview / Print Modal
  const [selectedPaymentForReceipt, setSelectedPaymentForReceipt] = useState<CreditPayment | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  // Edit Receipt Modal
  const [paymentToEdit, setPaymentToEdit] = useState<CreditPayment | null>(null);
  const [isEditPaymentModalOpen, setIsEditPaymentModalOpen] = useState(false);

  // Manual Collection Modal (Ruta Externa / Presupuestos)
  const [isManualCollectionModalOpen, setIsManualCollectionModalOpen] = useState(false);
  const [editingManualCollection, setEditingManualCollection] = useState<ManualCollectionData | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 12;

  useEffect(() => {
    fetchData();
  }, [user, currentEnterpriseId, currentMonth]);

  const fetchData = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const targetEntId = currentEnterpriseId || user.uid;

      // 1. Fetch Employees
      const qEmp = query(collection(db, 'employees'), where('enterpriseId', '==', targetEntId));
      const snapEmp = await getDocs(qEmp);
      const empList: Employee[] = snapEmp.docs.map(d => ({ id: d.id, ...d.data() } as Employee));
      setEmployees(empList);

      // 2. Fetch Clients
      const qClients = query(collection(db, 'clients'), where('enterpriseId', '==', targetEntId));
      const snapClients = await getDocs(qClients);
      const clientList: Client[] = snapClients.docs.map(d => ({ id: d.id, ...d.data() } as Client));
      setClients(clientList);

      // 3. Fetch Credit Sales (Active debts and history)
      const qCredits = query(collection(db, 'credit_sales'), where('enterpriseId', '==', targetEntId));
      const snapCredits = await getDocs(qCredits);
      const creditList: CreditSale[] = snapCredits.docs.map(d => ({ id: d.id, ...d.data() } as CreditSale));
      setCreditSales(creditList);

      // 4. Fetch Credit Payments (Comprobantes emitidos)
      const qPayments = query(
        collection(db, 'credit_payments'),
        where('enterpriseId', '==', targetEntId)
      );
      const snapPayments = await getDocs(qPayments);
      const paymentsList: CreditPayment[] = snapPayments.docs.map(d => ({ id: d.id, ...d.data() } as CreditPayment));

      // Sort by creation date or paymentDate descending
      paymentsList.sort((a, b) => {
        const dateA = a.paymentDate || '';
        const dateB = b.paymentDate || '';
        if (dateA !== dateB) return dateB.localeCompare(dateA);
        return (b.receiptNumber || '').localeCompare(a.receiptNumber || '');
      });
      setCreditPayments(paymentsList);

      // 5. Fetch legacy/manual collections for reference
      const qManual = query(collection(db, 'collections'), where('enterpriseId', '==', targetEntId));
      const snapManual = await getDocs(qManual);
      const manualList: ManualCollectionData[] = snapManual.docs.map(d => ({ id: d.id, ...d.data() } as ManualCollectionData));
      setManualCollections(manualList);

    } catch (err: any) {
      console.error('Error loading collections data:', err);
      showToast('Error al sincronizar datos de cobranza', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Filter Payments
  const filteredPayments = useMemo(() => {
    return creditPayments.filter((p) => {
      // Month match (optional or if month is strictly set)
      if (currentMonth && !p.paymentDate.startsWith(currentMonth)) {
        // If user typed a search term, allow searching across months
        if (!receiptSearchTerm.trim()) {
          return false;
        }
      }

      // Method filter
      if (filterMethod === 'TRANSFERENCIA' && !p.isTransfer && p.paymentMethod !== 'TRANSFERENCIA') {
        return false;
      }
      if (filterMethod === 'EFECTIVO' && (p.isTransfer || p.paymentMethod !== 'EFECTIVO')) {
        return false;
      }

      // Status filter
      if (filterStatus !== 'ALL' && p.status !== filterStatus) {
        return false;
      }

      // Search term (Cédula, RUC, Nombre, Fecha, Comprobante, Comentario, Banco)
      if (receiptSearchTerm.trim()) {
        const q = receiptSearchTerm.trim().toLowerCase();
        const clientName = (p.clientName || '').toLowerCase();
        const idCard = (p.clientIdCard || '').toLowerCase();
        const receipt = (p.receiptNumber || '').toLowerCase();
        const ref = (p.referenceNumber || '').toLowerCase();
        const note = (p.notes || '').toLowerCase();
        const date = (p.paymentDate || '').toLowerCase();
        const bank = (p.bankName || '').toLowerCase();
        const promissory = (p.promissoryNoteNumber || '').toLowerCase();
        const collector = (p.collectorName || '').toLowerCase();

        const matches =
          clientName.includes(q) ||
          idCard.includes(q) ||
          receipt.includes(q) ||
          ref.includes(q) ||
          note.includes(q) ||
          date.includes(q) ||
          bank.includes(q) ||
          promissory.includes(q) ||
          collector.includes(q);

        if (!matches) return false;
      }

      return true;
    });
  }, [creditPayments, currentMonth, receiptSearchTerm, filterMethod, filterStatus]);

  // Pagination for payments
  const totalPages = Math.ceil(filteredPayments.length / ITEMS_PER_PAGE);
  const paginatedPayments = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredPayments.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredPayments, currentPage, ITEMS_PER_PAGE]);

  // Financial Metrics of the selected month
  const metrics = useMemo(() => {
    let totalCollected = 0;
    let totalEfectivo = 0;
    let totalTransferencias = 0;
    let totalReceiptsCount = 0;

    filteredPayments.forEach((p) => {
      if (p.status !== 'ANULADO') {
        totalCollected += p.totalAmountPaid || 0;
        totalReceiptsCount += 1;
        if (p.isTransfer || p.paymentMethod === 'TRANSFERENCIA' || p.paymentMethod === 'DEPOSITO') {
          totalTransferencias += p.totalAmountPaid || 0;
        } else {
          totalEfectivo += p.totalAmountPaid || 0;
        }
      }
    });

    return { totalCollected, totalEfectivo, totalTransferencias, totalReceiptsCount };
  }, [filteredPayments]);

  // Action: Open smart debt selector
  const handleOpenSmartDebtSearch = () => {
    setIsActiveDebtSearchOpen(true);
  };

  // Action: Select credit from smart debt search and open payment modal
  const handleSelectCreditToPay = (credit: CreditSale) => {
    setSelectedCreditForPayment(credit);
    setIsRecordPaymentModalOpen(true);
  };

  // Action: View/Print receipt
  const handleViewReceipt = (payment: CreditPayment) => {
    setSelectedPaymentForReceipt(payment);
    setIsReceiptModalOpen(true);
  };

  // Action: Edit payment record
  const handleEditPayment = (payment: CreditPayment) => {
    if (payment.status === 'ANULADO') {
      showToast('No se puede modificar un cobro anulado', 'error');
      return;
    }
    setPaymentToEdit(payment);
    setIsEditPaymentModalOpen(true);
  };

  // Action: Delete / Revert payment record (with confirmation)
  const handleDeletePayment = async (payment: CreditPayment) => {
    if (payment.status === 'ANULADO') {
      showToast('Este comprobante ya se encuentra anulado', 'error');
      return;
    }

    const confirmed = await showConfirm(
      'Anular y Revertir Cobro',
      `¿Está seguro de anular el Comprobante #${payment.receiptNumber} por $${payment.totalAmountPaid.toFixed(2)} de ${payment.clientName}? Se revertirá el saldo de la deuda y se restituirá el cupo al cliente.`,
      { type: 'danger' }
    );

    if (!confirmed) return;

    try {
      const targetEntId = currentEnterpriseId || user?.uid || '';
      await revertCreditPaymentTransaction(targetEntId, user?.uid || '', payment.id);
      await logAudit(
        AuditAction.COLLECTION_DELETE,
        `Cobro #${payment.receiptNumber} revertido y anulado ($${payment.totalAmountPaid})`,
        payment.id
      );
      showToast(`Comprobante #${payment.receiptNumber} revertido exitosamente`, 'success');
      await fetchData();
    } catch (err: any) {
      console.error('Error reverting payment:', err);
      showToast(err.message || 'Error al revertir el cobro', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-neutral-900 dark:text-neutral-50 flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-500/20">
              <Receipt className="w-6 h-6" />
            </div>
            <span>Cobranzas &amp; Gestión de Cartera</span>
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400 text-xs sm:text-sm mt-1">
            Recepción de abonos directos, emisión y reimpresión de comprobantes, transferencias bancarias y auditoría
          </p>
        </div>

        {/* Action Buttons Group */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Smart Debt Search Button (+) */}
          <button
            type="button"
            onClick={handleOpenSmartDebtSearch}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all shadow-md shadow-indigo-600/20"
            title="Abrir buscador inteligente de deudas activas para cobrar"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Cobrar a Deuda Activa</span>
          </button>

          {/* Manual Collections Button */}
          <button
            type="button"
            onClick={() => {
              setEditingManualCollection(null);
              setIsManualCollectionModalOpen(true);
            }}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 border border-neutral-300 dark:border-neutral-700 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all shadow-sm"
            title="Formulario para registrar lotes o cobros manuales de ruta externa"
          >
            <FileText className="w-4 h-4 text-neutral-500" />
            <span>Cobros Manuales</span>
          </button>
        </div>
      </div>

      {/* Financial Overview Bento Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Recaudado */}
        <div className="bg-white dark:bg-neutral-900 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider block">Total Recaudado</span>
            <span className="text-xl font-black text-neutral-900 dark:text-white font-mono mt-0.5 block">
              ${metrics.totalCollected.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-neutral-400 mt-0.5 block">
              {metrics.totalReceiptsCount} comprobantes válidos
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        {/* Efectivo en Caja */}
        <div className="bg-white dark:bg-neutral-900 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider block">Efectivo Físico</span>
            <span className="text-xl font-black text-indigo-600 dark:text-indigo-400 font-mono mt-0.5 block">
              ${metrics.totalEfectivo.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-neutral-400 mt-0.5 block">
              Cobros directos en caja
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Receipt className="w-5 h-5" />
          </div>
        </div>

        {/* Transferencias y Depósitos */}
        <div className="bg-white dark:bg-neutral-900 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider block">Bancos &amp; Transf.</span>
            <span className="text-xl font-black text-cyan-600 dark:text-cyan-400 font-mono mt-0.5 block">
              ${metrics.totalTransferencias.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-neutral-400 mt-0.5 block">
              Acreditado en cuentas bancarias
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
            <Building2 className="w-5 h-5" />
          </div>
        </div>

        {/* Selector de Mes */}
        <div className="bg-white dark:bg-neutral-900 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider block">Período Fiscal</span>
          <div className="flex items-center justify-between bg-neutral-50 dark:bg-neutral-800/60 p-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700">
            <button
              type="button"
              onClick={() => setCurrentMonth(format(subMonths(parseISO(currentMonth + '-15'), 1), 'yyyy-MM'))}
              className="p-1 hover:bg-white dark:hover:bg-neutral-700 rounded-lg transition-colors text-neutral-600 dark:text-neutral-300 font-bold"
              title="Mes Anterior"
            >
              &larr;
            </button>
            <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-900 dark:text-neutral-100 capitalize">
              <Calendar className="w-3.5 h-3.5 text-indigo-500" />
              <span>{format(parseISO(currentMonth + '-15'), 'MMMM yyyy', { locale: es })}</span>
            </div>
            <button
              type="button"
              onClick={() => setCurrentMonth(format(addMonths(parseISO(currentMonth + '-15'), 1), 'yyyy-MM'))}
              className="p-1 hover:bg-white dark:hover:bg-neutral-700 rounded-lg transition-colors text-neutral-600 dark:text-neutral-300 font-bold"
              title="Mes Siguiente"
            >
              &rarr;
            </button>
          </div>
        </div>
      </div>

      {/* Main Search & Interactive Control Bar */}
      <div className="bg-white dark:bg-neutral-900 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col md:flex-row items-center gap-3">
        {/* Lupa Interactive Search Bar */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={receiptSearchTerm}
            onChange={(e) => {
              setReceiptSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Buscar cobros por Cédula / RUC, Nombre del cliente, No. Comprobante, Pagaré, Banco o Comentario..."
            className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
          />
          {receiptSearchTerm && (
            <button
              type="button"
              onClick={() => setReceiptSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 text-xs px-1.5 py-0.5 rounded"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          {/* Method Filter */}
          <select
            value={filterMethod}
            onChange={(e) => {
              setFilterMethod(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-xs font-bold text-neutral-700 dark:text-neutral-300 outline-none"
          >
            <option value="ALL">Todos los medios</option>
            <option value="EFECTIVO">Solo Efectivo</option>
            <option value="TRANSFERENCIA">Solo Transferencias/Bancos</option>
          </select>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value as any);
              setCurrentPage(1);
            }}
            className="px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-xs font-bold text-neutral-700 dark:text-neutral-300 outline-none"
          >
            <option value="ALL">Todos los estados</option>
            <option value="VALID">Válidos</option>
            <option value="ANULADO">Anulados</option>
          </select>
        </div>
      </div>

      {/* Receipts Table Container */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-wider">
              Historial Operativo de Cobros ({filteredPayments.length})
            </span>
          </div>
          <span className="text-xs text-neutral-400">
            Acciones: Reimprimir / Ver (Lupa/Impresora) • Modificar (Lápiz) • Revertir (Basura)
          </span>
        </div>

        {loading ? (
          <div className="py-16 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-3" />
            <p className="text-xs text-neutral-500 font-medium">Sincronizando cobros...</p>
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="py-16 text-center px-4">
            <div className="w-12 h-12 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-3 text-neutral-400">
              <Receipt className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-neutral-800 dark:text-neutral-200">
              No hay cobros registrados
            </h3>
            <p className="text-xs text-neutral-500 max-w-sm mx-auto mt-1">
              {receiptSearchTerm
                ? `No se encontraron resultados para "${receiptSearchTerm}".`
                : 'Presione el botón "Cobrar a Deuda Activa" (+) para registrar un cobro o abono a un crédito.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50 dark:bg-neutral-800/40 text-neutral-500 uppercase tracking-wider font-bold border-b border-neutral-200 dark:border-neutral-800">
                <tr>
                  <th className="px-4 py-3">Comprobante #</th>
                  <th className="px-4 py-3">Fecha &amp; Hora</th>
                  <th className="px-4 py-3">Cliente / Deudor</th>
                  <th className="px-4 py-3">Pagaré Asociado</th>
                  <th className="px-4 py-3">Forma de Pago / Banco</th>
                  <th className="px-4 py-3 text-right">Monto Cobrado</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {paginatedPayments.map((payment) => {
                  const isAnnulled = payment.status === 'ANULADO';

                  return (
                    <tr
                      key={payment.id}
                      className={`hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors ${
                        isAnnulled ? 'opacity-50 bg-rose-50/20 dark:bg-rose-950/10' : ''
                      }`}
                    >
                      {/* Receipt Number */}
                      <td className="px-4 py-3 font-mono font-bold text-indigo-700 dark:text-indigo-400">
                        {payment.receiptNumber}
                      </td>

                      {/* Date & Time */}
                      <td className="px-4 py-3 text-neutral-600 dark:text-neutral-300">
                        <div>{payment.paymentDate}</div>
                        {payment.paymentTime && (
                          <div className="text-[10px] text-neutral-400">{payment.paymentTime}</div>
                        )}
                      </td>

                      {/* Client */}
                      <td className="px-4 py-3">
                        <div className="font-bold text-neutral-900 dark:text-neutral-100">
                          {payment.clientName}
                        </div>
                        <div className="text-[10px] text-neutral-400 font-mono">
                          C.I.: {payment.clientIdCard}
                        </div>
                      </td>

                      {/* Promissory */}
                      <td className="px-4 py-3 font-mono text-neutral-600 dark:text-neutral-400">
                        <span className="bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded text-[11px] font-bold">
                          {payment.promissoryNoteNumber}
                        </span>
                      </td>

                      {/* Payment Method / Bank */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {payment.isTransfer || payment.paymentMethod === 'TRANSFERENCIA' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-cyan-100 dark:bg-cyan-950/60 text-cyan-800 dark:text-cyan-300">
                              <Building2 className="w-3 h-3" />
                              {payment.bankName || 'Transferencia'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                              <DollarSign className="w-3 h-3" />
                              Efectivo
                            </span>
                          )}
                        </div>
                        {payment.referenceNumber && (
                          <div className="text-[10px] text-neutral-400 font-mono mt-0.5">
                            Ref: {payment.referenceNumber}
                          </div>
                        )}
                      </td>

                      {/* Amount Paid */}
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`font-mono text-sm font-black ${
                            isAnnulled
                              ? 'line-through text-neutral-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          ${payment.totalAmountPaid.toFixed(2)}
                        </span>
                        {payment.discountApplied ? (
                          <div className="text-[10px] text-indigo-500 font-bold">
                            Desc. Liq: -{payment.discountApplied}%
                          </div>
                        ) : null}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        {isAnnulled ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                            <XCircle className="w-3 h-3" />
                            ANULADO
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                            <CheckCircle2 className="w-3 h-3" />
                            VÁLIDO
                          </span>
                        )}
                      </td>

                      {/* Actions: Lupa (Ver), Lápiz (Editar), Basura (Eliminar/Revertir) */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Lupa / Print: Ver e Imprimir Comprobante */}
                          <button
                            type="button"
                            onClick={() => handleViewReceipt(payment)}
                            className="p-2 text-indigo-600 dark:text-indigo-300 bg-white dark:bg-neutral-800 border border-indigo-200 dark:border-indigo-900/60 shadow-md shadow-indigo-500/10 hover:shadow-lg hover:shadow-indigo-500/25 hover:border-indigo-400 dark:hover:border-indigo-600 hover:bg-indigo-50/80 dark:hover:bg-neutral-700/80 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95"
                            title="Ver e Imprimir Comprobante de Cobro"
                          >
                            <Search className="w-4 h-4 drop-shadow-sm" />
                          </button>

                          {/* Lápiz: Editar Datos / Comentarios / Banco */}
                          {!isAnnulled && (
                            <button
                              type="button"
                              onClick={() => handleEditPayment(payment)}
                              className="p-2 text-amber-600 dark:text-amber-300 bg-white dark:bg-neutral-800 border border-amber-200 dark:border-amber-900/60 shadow-md shadow-amber-500/10 hover:shadow-lg hover:shadow-amber-500/25 hover:border-amber-400 dark:hover:border-amber-600 hover:bg-amber-50/80 dark:hover:bg-neutral-700/80 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95"
                              title="Editar comprobante (comentario, referencia, banco)"
                            >
                              <Pencil className="w-4 h-4 drop-shadow-sm" />
                            </button>
                          )}

                          {/* Basura: Anular y Revertir Cobro */}
                          {!isAnnulled && (
                            <button
                              type="button"
                              onClick={() => handleDeletePayment(payment)}
                              className="p-2 text-rose-600 dark:text-rose-300 bg-white dark:bg-neutral-800 border border-rose-200 dark:border-rose-900/60 shadow-md shadow-rose-500/10 hover:shadow-lg hover:shadow-rose-500/25 hover:border-rose-400 dark:hover:border-rose-600 hover:bg-rose-50/80 dark:hover:bg-neutral-700/80 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95"
                              title="Anular y revertir cobro a la cuenta del crédito"
                            >
                              <Trash2 className="w-4 h-4 drop-shadow-sm" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-xs">
            <span className="text-neutral-500">
              Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong> ({filteredPayments.length} comprobantes)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                className="px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 disabled:opacity-40 hover:bg-neutral-100 dark:hover:bg-neutral-800 font-bold"
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                className="px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 disabled:opacity-40 hover:bg-neutral-100 dark:hover:bg-neutral-800 font-bold"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL 1: Búsqueda Inteligente de Deudas Activas (+) */}
      <ActiveDebtSearchModal
        isOpen={isActiveDebtSearchOpen}
        onClose={() => setIsActiveDebtSearchOpen(false)}
        creditSales={creditSales}
        clients={clients}
        onSelectCredit={handleSelectCreditToPay}
      />

      {/* MODAL 2: Registrar Cobro de Crédito (Formulario con Transferencia y Banco) */}
      <RecordCreditPaymentModal
        isOpen={isRecordPaymentModalOpen}
        onClose={() => {
          setIsRecordPaymentModalOpen(false);
          setSelectedCreditForPayment(null);
        }}
        creditSale={selectedCreditForPayment}
        employees={employees}
        onPaymentSuccess={(newPayment) => {
          fetchData();
          // Automatically prompt receipt preview modal
          setSelectedPaymentForReceipt(newPayment);
          setIsReceiptModalOpen(true);
        }}
      />

      {/* MODAL 3: Comprobante Térmico / A4 con Botón Imprimir (Directo a window.print) */}
      <CreditPaymentReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => {
          setIsReceiptModalOpen(false);
          setSelectedPaymentForReceipt(null);
        }}
        payment={selectedPaymentForReceipt}
      />

      {/* MODAL 4: Editar Comprobante de Cobro (Lápiz) */}
      <EditCreditPaymentModal
        isOpen={isEditPaymentModalOpen}
        onClose={() => {
          setIsEditPaymentModalOpen(false);
          setPaymentToEdit(null);
        }}
        payment={paymentToEdit}
        onSuccess={() => {
          fetchData();
        }}
      />

      {/* MODAL 5: Cobros Manuales / Lotes de Ruta Externa */}
      <ManualCollectionModal
        isOpen={isManualCollectionModalOpen}
        onClose={() => {
          setIsManualCollectionModalOpen(false);
          setEditingManualCollection(null);
        }}
        editingCollection={editingManualCollection}
        employees={employees}
        defaultMonth={currentMonth}
        onSuccess={() => {
          fetchData();
          showToast('Cobranza manual procesada exitosamente', 'success');
        }}
      />
    </div>
  );
}
