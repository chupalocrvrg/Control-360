import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  UserPlus, 
  Search, 
  CreditCard, 
  Filter, 
  Download, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  Phone, 
  MapPin, 
  Mail, 
  Calendar, 
  Edit, 
  Trash2,
  FileSpreadsheet,
  TrendingUp,
  Info,
  DollarSign,
  ChevronRight,
  Printer,
  Receipt,
  Coins,
  FileText,
  Clock,
  RotateCcw,
  Check,
  MessageCircle,
  PhoneCall,
  Award,
  AlertCircle,
  CheckSquare,
  Square,
  ExternalLink,
  FileCheck
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  orderBy
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { Client, ClientType } from '../types/client';
import { CreditSale } from '../types/creditSale';
import { CreditPayment } from '../types/creditPayment';
import { ClientModal } from '../components/ClientModal';
import { RecordCreditPaymentModal } from '../components/sales/RecordCreditPaymentModal';
import { CreditPaymentReceiptModal } from '../components/sales/CreditPaymentReceiptModal';
import { PromissoryNoteModal } from '../components/sales/PromissoryNoteModal';
import { CreditApplicationPrintModal, CreditApplicationPrintData } from '../components/sales/CreditApplicationPrintModal';
import { WhatsAppCollectionModal } from '../components/sales/WhatsAppCollectionModal';
import { CollectionActionModal } from '../components/sales/CollectionActionModal';
import { ClientAccountStatementModal } from '../components/sales/ClientAccountStatementModal';
import { exportCreditPortfolioToExcel } from '../lib/creditExportUtils';
import { 
  CreditCollectionLog, 
  CreditRiskCategory, 
  calculateCreditRiskAndAging 
} from '../types/creditCollection';
import { revertCreditPaymentTransaction } from '../lib/credit-payment-db';
import { formatCurrency, cleanFirestoreData } from '../lib/utils';
import { validateEcuadorId } from '../lib/ecuador-id';

interface Employee {
  id: string;
  name: string;
  lastName: string;
  role: string;
}

export default function ClientsAndCredits() {
  const { user, profile } = useAuth();
  const { showToast, showConfirm } = useNotification();
  const enterpriseId = profile?.enterpriseId || user?.uid;

  // Active Tab: 'directorio' | 'cartera' | 'recibos' | 'mora'
  const [activeTab, setActiveTab] = useState<'directorio' | 'cartera' | 'recibos' | 'mora'>('directorio');

  // Core Data
  const [clients, setClients] = useState<Client[]>([]);
  const [creditSales, setCreditSales] = useState<CreditSale[]>([]);
  const [creditPayments, setCreditPayments] = useState<CreditPayment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [collectionLogs, setCollectionLogs] = useState<CreditCollectionLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'CREDITO' | 'CONTADO'>('ALL');
  const [carteraStatusFilter, setCarteraStatusFilter] = useState<'ALL' | 'ACTIVO' | 'VENCIDO' | 'LIQUIDADO'>('ALL');
  const [moraRiskFilter, setMoraRiskFilter] = useState<string>('ALL');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [selectedClientDetail, setSelectedClientDetail] = useState<Client | null>(null);

  // Tramo 3 Payment & Receipt Modals
  const [activeCreditForPayment, setActiveCreditForPayment] = useState<CreditSale | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [activePaymentForReceipt, setActivePaymentForReceipt] = useState<CreditPayment | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [activeCreditForPromissory, setActiveCreditForPromissory] = useState<CreditSale | null>(null);
  const [isPromissoryModalOpen, setIsPromissoryModalOpen] = useState(false);
  const [activeApplicationData, setActiveApplicationData] = useState<CreditApplicationPrintData | null>(null);
  const [isApplicationModalOpen, setIsApplicationModalOpen] = useState(false);

  // Tramo 4 Modals (Cobranza WhatsApp, Bitácora y Estado de Cuenta / Paz y Salvo)
  const [activeCreditForWhatsApp, setActiveCreditForWhatsApp] = useState<CreditSale | null>(null);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [activeCreditForAction, setActiveCreditForAction] = useState<CreditSale | null>(null);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [activeClientForStatement, setActiveClientForStatement] = useState<Client | null>(null);
  const [isStatementModalOpen, setIsStatementModalOpen] = useState(false);

  const handleOpenCreditApplication = (cs: CreditSale) => {
    const cl = clients.find(c => c.id === cs.clientId);
    const appData: CreditApplicationPrintData = {
      applicationNumber: cs.promissoryNoteNumber ? `SOL-${cs.promissoryNoteNumber}` : `SOL-${cs.id.slice(0, 8).toUpperCase()}`,
      date: cs.saleDate || (cs.createdAt ? cs.createdAt.split('T')[0] : new Date().toISOString().split('T')[0]),
      client: cl || null,
      clientName: cs.clientName || (cl ? `${cl.lastName} ${cl.firstName}` : 'Consumidor Final'),
      clientIdCard: cs.clientIdCard || cl?.idCard,
      clientPhone: cs.clientPhone || cl?.phone,
      clientAddress: cs.clientAddress || cl?.address,
      clientCity: cs.clientCity || cl?.city,
      clientEmail: cl?.email,
      workplace: cl?.workInfo?.workplace,
      workPosition: cl?.workInfo?.position,
      workPhone: cl?.workInfo?.workPhone,
      workAddress: cl?.workInfo?.workAddress,
      spouseName: cl?.spouseInfo?.lastName ? `${cl.spouseInfo.lastName} ${cl.spouseInfo.firstName || ''}`.trim() : undefined,
      spouseIdCard: cl?.spouseInfo?.idCard,
      spousePhone: cl?.spouseInfo?.phone,
      guarantorName: cs.guarantorName || cl?.guarantorName,
      guarantorIdCard: cs.guarantorIdCard || cl?.guarantorIdCard,
      guarantorPhone: cs.guarantorPhone || cl?.guarantorPhone,
      references: cl?.references || [],
      items: (cs.items && cs.items.length > 0) ? cs.items.map(item => ({
        articleName: item.articleName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice
      })) : [{
        articleName: cs.article || 'Mercadería General',
        quantity: 1,
        unitPrice: cs.grossTotal || cs.netFinancedAmount || 0,
        totalPrice: cs.grossTotal || cs.netFinancedAmount || 0
      }],
      grossTotal: cs.grossTotal || cs.netFinancedAmount || 0,
      downPayment: cs.downPayment || 0,
      netFinancedAmount: cs.netFinancedAmount || 0,
      frequency: (cs.frequency as any) || (cs.paymentFrequency as any) || 'MENSUAL',
      installmentsCount: cs.installmentsCount || (cs.termMonths ? cs.termMonths : (cs.installments?.length || 1)),
      installmentAmount: cs.installmentAmount || (cs.installments?.[0]?.amount || 0),
      startDate: cs.startDate || cs.saleDate || (cs.createdAt ? cs.createdAt.split('T')[0] : ''),
      sellerName: cs.sellerName || 'Asesor de Crédito',
      earlySettlementOptions: cs.earlySettlementOptions || []
    };

    setActiveApplicationData(appData);
    setIsApplicationModalOpen(true);
  };

  // 1. Subscribe to Clients
  useEffect(() => {
    if (!enterpriseId) return;

    const q = query(
      collection(db, 'clients'),
      where('enterpriseId', '==', enterpriseId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: Client[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as Client);
        });
        list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        setClients(list);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching clients:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [enterpriseId]);

  // 2. Subscribe to Credit Sales
  useEffect(() => {
    if (!enterpriseId) return;

    const q = query(
      collection(db, 'credit_sales'),
      where('enterpriseId', '==', enterpriseId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: CreditSale[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as CreditSale);
        });
        list.sort((a, b) => (b.createdAt || b.saleDate || '').localeCompare(a.createdAt || a.saleDate || ''));
        setCreditSales(list);
      },
      (err) => {
        console.error('Error fetching credit sales:', err);
      }
    );

    return () => unsubscribe();
  }, [enterpriseId]);

  // 3. Subscribe to Credit Payments
  useEffect(() => {
    if (!enterpriseId) return;

    const q = query(
      collection(db, 'credit_payments'),
      where('enterpriseId', '==', enterpriseId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: CreditPayment[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as CreditPayment);
        });
        list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        setCreditPayments(list);
      },
      (err) => {
        console.error('Error fetching credit payments:', err);
      }
    );

    return () => unsubscribe();
  }, [enterpriseId]);

  // 4. Subscribe to Employees
  useEffect(() => {
    if (!enterpriseId) return;

    const q = query(
      collection(db, 'employees'),
      where('enterpriseId', '==', enterpriseId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: Employee[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as Employee);
        });
        setEmployees(list);
      },
      (err) => {
        console.error('Error fetching employees:', err);
      }
    );

    return () => unsubscribe();
  }, [enterpriseId]);

  // 5. Subscribe to Collection Logs (Tramo 4)
  useEffect(() => {
    if (!enterpriseId) return;

    const q = query(
      collection(db, 'credit_collection_logs'),
      where('enterpriseId', '==', enterpriseId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: CreditCollectionLog[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as CreditCollectionLog);
        });
        list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        setCollectionLogs(list);
      },
      (err) => {
        console.error('Error fetching collection logs:', err);
      }
    );

    return () => unsubscribe();
  }, [enterpriseId]);

  // Toggle promise fulfilled status
  const handleTogglePromiseFulfilled = async (log: CreditCollectionLog) => {
    try {
      const docRef = doc(db, 'credit_collection_logs', log.id);
      await updateDoc(docRef, {
        isPromiseFulfilled: !log.isPromiseFulfilled,
        updatedAt: new Date().toISOString()
      });
      showToast(!log.isPromiseFulfilled ? 'Promesa marcada como cumplida' : 'Promesa reabierta', 'success');
    } catch (err: any) {
      showToast('Error al actualizar promesa: ' + (err.message || err), 'error');
    }
  };

  // Save / Update client handler
  const handleSaveClient = async (clientData: Partial<Client>) => {
    if (!enterpriseId || !user) return;
    const sanitizedData = cleanFirestoreData(clientData);
    const clientFullName = `${sanitizedData.firstName || ''} ${sanitizedData.lastName || ''}`.trim() || 'Cliente';

    if (editingClient) {
      const docRef = doc(db, 'clients', editingClient.id);
      await updateDoc(docRef, {
        ...sanitizedData,
        updatedAt: new Date().toISOString()
      });
      showToast(`¡Cliente "${clientFullName}" y su información relacionada actualizada correctamente!`, 'success');
    } else {
      await addDoc(collection(db, 'clients'), {
        ...sanitizedData,
        enterpriseId,
        createdBy: user.uid,
        creditUsed: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      showToast(`¡Cliente "${clientFullName}" registrado y guardado exitosamente con toda su información!`, 'success');
    }
  };

  // Delete client handler
  const handleDeleteClient = async (client: Client) => {
    if (await showConfirm('Eliminar Cliente', `¿Está seguro de eliminar al cliente ${client.lastName} ${client.firstName}?`, { type: 'danger' })) {
      try {
        await deleteDoc(doc(db, 'clients', client.id));
        if (selectedClientDetail?.id === client.id) {
          setSelectedClientDetail(null);
        }
        showToast('Cliente eliminado', 'success');
      } catch (err: any) {
        showToast('Error al eliminar cliente: ' + (err.message || err), 'error');
      }
    }
  };

  // Anular / Revertir Pago
  const handleRevertPayment = async (payment: CreditPayment) => {
    if (payment.status === 'ANULADO') {
      showToast('Este pago ya fue anulado', 'info');
      return;
    }

    if (await showConfirm(
      'Anular Comprobante de Cobro',
      `¿Desea anular el comprobante #${payment.receiptNumber} por $${payment.totalAmountPaid.toFixed(2)}? Esta acción restaurará los saldos de las cuotas y el cupo en uso del cliente.`,
      { type: 'danger' }
    )) {
      try {
        await revertCreditPaymentTransaction(enterpriseId!, user?.uid || '', payment.id);
        showToast(`Comprobante #${payment.receiptNumber} anulado correctamente`, 'success');
      } catch (err: any) {
        console.error('Error revoking payment:', err);
        showToast(err.message || 'Error al anular pago', 'error');
      }
    }
  };

  // Filter clients
  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      if (typeFilter !== 'ALL' && c.clientType !== typeFilter) {
        return false;
      }
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      const fullName = `${c.firstName} ${c.lastName}`.toLowerCase();
      const idCard = (c.idCard || '').toLowerCase();
      const phone = (c.phone || '').toLowerCase();
      const city = (c.city || '').toLowerCase();
      return fullName.includes(term) || idCard.includes(term) || phone.includes(term) || city.includes(term);
    });
  }, [clients, searchTerm, typeFilter]);

  // Filter credit sales (Cartera)
  const filteredCartera = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return creditSales.filter((cs) => {
      if (carteraStatusFilter === 'ACTIVO' && cs.status !== 'ACTIVO') return false;
      if (carteraStatusFilter === 'LIQUIDADO' && cs.status !== 'LIQUIDADO') return false;
      if (carteraStatusFilter === 'VENCIDO') {
        const hasOverdue = (cs.installments || []).some(
          i => i.status !== 'PAGADO' && i.dueDate < today
        );
        if (!hasOverdue) return false;
      }

      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      const client = (cs.clientName || '').toLowerCase();
      const pagar = (cs.promissoryNoteNumber || '').toLowerCase();
      const ced = (cs.clientIdCard || '').toLowerCase();
      const art = ((cs as any).article || (cs.items || []).map(i => i.articleName).join(' ')).toLowerCase();
      return client.includes(term) || pagar.includes(term) || ced.includes(term) || art.includes(term);
    });
  }, [creditSales, carteraStatusFilter, searchTerm]);

  // Filter credit payments (Recibos)
  const filteredPayments = useMemo(() => {
    return creditPayments.filter((p) => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      const rec = (p.receiptNumber || '').toLowerCase();
      const pag = (p.promissoryNoteNumber || '').toLowerCase();
      const client = (p.clientName || '').toLowerCase();
      const ced = (p.clientIdCard || '').toLowerCase();
      const col = (p.collectorName || '').toLowerCase();
      return rec.includes(term) || pag.includes(term) || client.includes(term) || ced.includes(term) || col.includes(term);
    });
  }, [creditPayments, searchTerm]);

  // Financial Stats
  const stats = useMemo(() => {
    const totalCount = clients.length;
    const creditCount = clients.filter(c => c.clientType === 'CREDITO').length;
    const cashCount = clients.filter(c => c.clientType === 'CONTADO').length;

    const totalAssignedLimit = clients.reduce((sum, c) => sum + (c.creditLimit || 0), 0);
    const totalCreditUsed = clients.reduce((sum, c) => sum + (c.creditUsed || 0), 0);
    const totalAvailableLimit = Math.max(0, totalAssignedLimit - totalCreditUsed);

    const totalPortfolioPending = creditSales
      .filter(c => c.status !== 'ANULADO')
      .reduce((sum, c) => sum + (c.remainingBalance ?? (c.netFinancedAmount || 0)), 0);

    const totalCollected = creditPayments
      .filter(p => p.status === 'VALID')
      .reduce((sum, p) => sum + (p.totalAmountPaid || 0), 0);

    return {
      totalCount,
      creditCount,
      cashCount,
      totalAssignedLimit,
      totalCreditUsed,
      totalAvailableLimit,
      totalPortfolioPending,
      totalCollected
    };
  }, [clients, creditSales, creditPayments]);

  // Credits of currently selected client
  const clientCredits = useMemo(() => {
    if (!selectedClientDetail) return [];
    return creditSales.filter(cs => cs.clientId === selectedClientDetail.id);
  }, [selectedClientDetail, creditSales]);

  // Tramo 4: Mora Statistics & Aging Risk Breakdown
  const moraStats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    let catA = 0;
    let catB = 0;
    let catC = 0;
    let catD = 0;
    let catE = 0;
    let totalOverdueAmount = 0;
    let totalPortfolioOverdue = 0;
    let countOverdue = 0;
    let countUpcoming = 0;
    let promisesTodayCount = 0;

    collectionLogs.forEach((log) => {
      if (log.promiseDate === today && !log.isPromiseFulfilled) {
        promisesTodayCount++;
      }
    });

    const activeCredits = creditSales.filter(c => c.status === 'ACTIVO' || c.status === 'EN_MORA');
    const totalActiveBalance = activeCredits.reduce(
      (sum, c) => sum + (c.remainingBalance ?? (c.netFinancedAmount || 0)), 
      0
    );

    activeCredits.forEach((c) => {
      const risk = calculateCreditRiskAndAging(c, today);
      if (risk.overdueDays > 120) catE++;
      else if (risk.overdueDays > 90) catD++;
      else if (risk.overdueDays > 60) catC++;
      else if (risk.overdueDays > 30) catB++;
      else catA++;

      if (risk.isOverdue) {
        countOverdue++;
        totalOverdueAmount += risk.overdueAmount;
        totalPortfolioOverdue += (c.remainingBalance ?? (c.netFinancedAmount || 0));
      } else if (risk.isUpcomingDue) {
        countUpcoming++;
      }
    });

    // PAR > 30 (Portfolio At Risk over 30 days)
    const par30Balance = activeCredits.reduce((sum, c) => {
      const risk = calculateCreditRiskAndAging(c, today);
      return risk.overdueDays > 30 ? sum + (c.remainingBalance ?? (c.netFinancedAmount || 0)) : sum;
    }, 0);

    const par30Percent = totalActiveBalance > 0 
      ? ((par30Balance / totalActiveBalance) * 100).toFixed(1) 
      : '0.0';

    return {
      catA,
      catB,
      catC,
      catD,
      catE,
      totalOverdueAmount,
      totalPortfolioOverdue,
      countOverdue,
      countUpcoming,
      promisesTodayCount,
      par30Balance,
      par30Percent,
      totalActiveBalance
    };
  }, [creditSales, collectionLogs]);

  // Tramo 4: Filtered Cartera with Mora
  const filteredMoraCartera = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return creditSales.filter((c) => {
      const risk = calculateCreditRiskAndAging(c, today);
      const remaining = c.remainingBalance ?? (c.netFinancedAmount || 0);

      // Status filter
      if (moraRiskFilter === 'OVERDUE_ONLY' && !risk.isOverdue) return false;
      if (moraRiskFilter === 'UPCOMING_ONLY' && !risk.isUpcomingDue) return false;
      if (moraRiskFilter === 'PROMISES_TODAY') {
        const hasTodayPromise = collectionLogs.some(
          l => l.creditSaleId === c.id && l.promiseDate === today && !l.isPromiseFulfilled
        );
        if (!hasTodayPromise) return false;
      }
      if (['A', 'B', 'C', 'D', 'E'].includes(moraRiskFilter)) {
        if (risk.riskCategory !== moraRiskFilter) return false;
      }

      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      const client = (c.clientName || '').toLowerCase();
      const pagar = (c.promissoryNoteNumber || '').toLowerCase();
      const ced = (c.clientIdCard || '').toLowerCase();
      const guar = (c.guarantorName || '').toLowerCase();
      const art = ((c as any).article || (c.items || []).map(i => i.articleName).join(' ')).toLowerCase();
      return client.includes(term) || pagar.includes(term) || ced.includes(term) || guar.includes(term) || art.includes(term);
    });
  }, [creditSales, moraRiskFilter, searchTerm, collectionLogs]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-neutral-900 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 via-teal-600 to-emerald-600 text-white flex items-center justify-center font-bold shadow-lg shadow-indigo-500/20">
            <Coins className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-neutral-900 dark:text-white tracking-tight">
                Clientes, Cartera y Cobranzas
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                Tramo 4 • Mora & Cobranzas 360°
              </span>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              Directorio de clientes, ventas a crédito, cobranza con recibos POS, gestión de mora y WhatsApp, promesas de pago y paz y salvo
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => exportCreditPortfolioToExcel(creditSales, profile?.enterpriseName || 'Control Financiero')}
            className="px-3.5 py-2.5 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border border-neutral-200 dark:border-neutral-700"
            title="Exportar cartera, mora y buró a Excel"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Exportar Cartera (.xlsx)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setEditingClient(null);
              setIsModalOpen(true);
            }}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-500/20 transition-all flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            Nuevo Cliente
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex bg-neutral-100 dark:bg-neutral-900 p-1.5 rounded-2xl border border-neutral-200 dark:border-neutral-800 max-w-fit gap-1 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('directorio')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'directorio'
              ? 'bg-white dark:bg-neutral-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
              : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          Directorio & Fichas ({clients.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('cartera')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'cartera'
              ? 'bg-white dark:bg-neutral-800 text-emerald-600 dark:text-emerald-400 shadow-sm'
              : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          Cartera de Créditos ({creditSales.filter(c => c.status === 'ACTIVO').length} activos)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('recibos')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'recibos'
              ? 'bg-white dark:bg-neutral-800 text-teal-600 dark:text-teal-400 shadow-sm'
              : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
          }`}
        >
          <Receipt className="w-4 h-4" />
          Historial de Recibos ({creditPayments.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('mora')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'mora'
              ? 'bg-white dark:bg-neutral-800 text-rose-600 dark:text-rose-400 shadow-sm'
              : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
          }`}
        >
          <AlertTriangle className={`w-4 h-4 ${moraStats.countOverdue > 0 ? 'text-rose-500' : 'text-neutral-400'}`} />
          Gestión de Mora & Cobranzas
          {moraStats.countOverdue > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
              {moraStats.countOverdue}
            </span>
          )}
          {moraStats.promisesTodayCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300" title="Promesas para hoy">
              {moraStats.promisesTodayCount} hoy
            </span>
          )}
        </button>
      </div>

      {/* Global Financial KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-neutral-900 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Cupo Global Autorizado</span>
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {formatCurrency(stats.totalAssignedLimit)}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-900 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Crédito en Uso</span>
            <TrendingUp className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400">
              {formatCurrency(stats.totalCreditUsed)}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-900 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Saldo Total por Cobrar</span>
            <DollarSign className="w-4 h-4 text-red-500" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-red-600 dark:text-red-400">
              {formatCurrency(stats.totalPortfolioPending)}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-900 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Total Recaudado en Cobros</span>
            <Coins className="w-4 h-4 text-teal-500" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-teal-600 dark:text-teal-400">
              {formatCurrency(stats.totalCollected)}
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: DIRECTORIO & FICHAS DE CLIENTES                                    */}
      {/* ========================================================================= */}
      {activeTab === 'directorio' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Search & List */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white dark:bg-neutral-900 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 absolute left-3 top-3 text-neutral-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por cédula, apellidos, nombres, ciudad o teléfono..."
                  className="w-full pl-9 pr-4 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs font-medium text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Filter className="w-4 h-4 text-neutral-400 shrink-0" />
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as any)}
                  className="w-full sm:w-auto px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs font-bold text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="ALL">Todos los Tipos</option>
                  <option value="CREDITO">Sólo Crédito</option>
                  <option value="CONTADO">Sólo Contado</option>
                </select>
              </div>
            </div>

            {loading ? (
              <div className="bg-white dark:bg-neutral-900 p-12 rounded-xl border border-neutral-200 dark:border-neutral-800 text-center">
                <div className="w-8 h-8 border-3 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mx-auto mb-3" />
                <p className="text-xs text-neutral-500 font-medium">Cargando clientes...</p>
              </div>
            ) : filteredClients.length === 0 ? (
              <div className="bg-white dark:bg-neutral-900 p-12 rounded-xl border border-neutral-200 dark:border-neutral-800 text-center space-y-3">
                <Users className="w-10 h-10 text-neutral-400 mx-auto" />
                <h3 className="text-sm font-bold text-neutral-900 dark:text-white">No se encontraron clientes</h3>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredClients.map((client) => {
                  const isSelected = selectedClientDetail?.id === client.id;
                  const limit = client.creditLimit || 0;
                  const used = client.creditUsed || 0;
                  const available = Math.max(0, limit - used);
                  const percentUsed = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;

                  return (
                    <div
                      key={client.id}
                      onClick={() => setSelectedClientDetail(client)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/20 shadow-sm'
                          : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-300 dark:hover:border-neutral-700'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-neutral-900 dark:text-white">
                              {client.lastName} {client.firstName}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              client.clientType === 'CREDITO'
                                ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
                                : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                            }`}>
                              {client.clientType}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400 mt-1 font-mono">
                            <span>CI: {client.idCard}</span>
                            <span>•</span>
                            <span>{client.phone}</span>
                            <span>•</span>
                            <span>{client.city}</span>
                          </div>
                        </div>

                        {client.clientType === 'CREDITO' && (
                          <div className="sm:text-right">
                            <div className="text-xs text-neutral-400">Cupo Disponible:</div>
                            <div className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                              {formatCurrency(available)}
                            </div>
                            <div className="text-[10px] text-neutral-400">
                              de {formatCurrency(limit)} ({percentUsed}% en uso)
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Detailed Inspector Card */}
          <div className="space-y-4">
            {selectedClientDetail ? (
              <div className="bg-white dark:bg-neutral-900 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-6 sticky top-6">
                <div className="flex items-start justify-between border-b border-neutral-200 dark:border-neutral-800 pb-4">
                  <div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">
                      Cliente a {selectedClientDetail.clientType}
                    </span>
                    <h2 className="text-base font-black text-neutral-900 dark:text-white mt-2">
                      {selectedClientDetail.lastName} {selectedClientDetail.firstName}
                    </h2>
                    <p className="text-xs font-mono text-neutral-500">
                      Cédula / RUC: {selectedClientDetail.idCard}
                    </p>
                  </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveClientForStatement(selectedClientDetail);
                      setIsStatementModalOpen(true);
                    }}
                    className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-bold flex items-center gap-1.5 border border-blue-200 dark:border-blue-800"
                    title="Ver Estado de Cuenta y Certificado de Paz y Salvo"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Estado de Cuenta
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEditingClient(selectedClientDetail);
                      setIsModalOpen(true);
                    }}
                    className="px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg text-xs font-bold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    Editar
                  </button>
                </div>
                </div>

                {/* Cupo Gauge */}
                <div className="p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span>Estado de Cupo Crediticio</span>
                    <span className="text-indigo-600 dark:text-indigo-400 font-mono">
                      {formatCurrency(Math.max(0, (selectedClientDetail.creditLimit || 0) - (selectedClientDetail.creditUsed || 0)))} Disp.
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center pt-2">
                    <div className="p-2 bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
                      <div className="text-[10px] text-neutral-400 uppercase font-bold">Cupo</div>
                      <div className="text-xs font-black">{formatCurrency(selectedClientDetail.creditLimit || 0)}</div>
                    </div>
                    <div className="p-2 bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
                      <div className="text-[10px] text-neutral-400 uppercase font-bold">En Uso</div>
                      <div className="text-xs font-black text-amber-600">{formatCurrency(selectedClientDetail.creditUsed || 0)}</div>
                    </div>
                    <div className="p-2 bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
                      <div className="text-[10px] text-neutral-400 uppercase font-bold">Disponible</div>
                      <div className="text-xs font-black text-emerald-600">
                        {formatCurrency(Math.max(0, (selectedClientDetail.creditLimit || 0) - (selectedClientDetail.creditUsed || 0)))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Client's Active Credits */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-neutral-800 dark:text-neutral-200 text-xs flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4 text-emerald-500" />
                      Créditos Otorgados ({clientCredits.length})
                    </h4>
                  </div>

                  {clientCredits.length === 0 ? (
                    <p className="text-xs text-neutral-400 italic p-3 bg-neutral-50 dark:bg-neutral-800/40 rounded-xl">
                      El cliente no registra créditos en este momento.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto">
                      {clientCredits.map((cs) => {
                        const remaining = cs.remainingBalance ?? (cs.netFinancedAmount || 0);
                        const isSettled = cs.status === 'LIQUIDADO' || remaining <= 0.01;

                        return (
                          <div key={cs.id} className="p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-indigo-700 dark:text-indigo-400">
                                Pagaré {cs.promissoryNoteNumber}
                              </span>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isSettled ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                              }`}>
                                {isSettled ? 'LIQUIDADO' : 'ACTIVO'}
                              </span>
                            </div>

                            <div className="flex justify-between text-[11px] text-neutral-600 dark:text-neutral-400">
                              <span>Saldo por cobrar:</span>
                              <span className="font-bold text-red-600 dark:text-red-400">
                                {formatCurrency(remaining)}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 pt-1">
                              {!isSettled && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveCreditForPayment(cs);
                                    setIsPaymentModalOpen(true);
                                  }}
                                  className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] flex items-center justify-center gap-1 shadow-sm"
                                >
                                  <Coins className="w-3.5 h-3.5" />
                                  Cobrar Cuota
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveCreditForPromissory(cs);
                                  setIsPromissoryModalOpen(true);
                                }}
                                className="px-3 py-1.5 bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 text-neutral-800 dark:text-white rounded-lg font-bold text-[11px] flex items-center gap-1"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                Pagaré
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Contact info */}
                <div className="space-y-1.5 text-xs text-neutral-600 dark:text-neutral-300 pt-2 border-t border-neutral-200 dark:border-neutral-800">
                  <p className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-neutral-400" /> {selectedClientDetail.phone}</p>
                  {selectedClientDetail.email && (
                    <p className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-neutral-400" /> {selectedClientDetail.email}</p>
                  )}
                  <p className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-neutral-400" /> {selectedClientDetail.address}, {selectedClientDetail.city}</p>
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-neutral-900 p-8 rounded-2xl border border-neutral-200 dark:border-neutral-800 text-center space-y-2">
                <Info className="w-8 h-8 text-neutral-400 mx-auto" />
                <h3 className="text-sm font-bold">Ficha de Cliente</h3>
                <p className="text-xs text-neutral-500">Selecciona un cliente para inspeccionar su cartera y cupo disponible.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: CARTERA DE CRÉDITOS ACTIVOS & COBRANZAS                            */}
      {/* ========================================================================= */}
      {activeTab === 'cartera' && (
        <div className="space-y-4">
          {/* Filter Toolbar */}
          <div className="bg-white dark:bg-neutral-900 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3 top-3 text-neutral-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por cliente, pagaré #, cédula o artículo..."
                className="w-full pl-9 pr-4 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs font-medium text-neutral-900 dark:text-white"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-4 h-4 text-neutral-400 shrink-0" />
              <select
                value={carteraStatusFilter}
                onChange={(e) => setCarteraStatusFilter(e.target.value as any)}
                className="px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs font-bold"
              >
                <option value="ALL">Todos los Estados</option>
                <option value="ACTIVO">Sólo Activos con Saldo</option>
                <option value="VENCIDO">Con Cuotas Vencidas</option>
                <option value="LIQUIDADO">Liquidados / Saldados</option>
              </select>
            </div>
          </div>

          {/* Cartera Table */}
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 font-bold border-b border-neutral-200 dark:border-neutral-700">
                  <tr>
                    <th className="px-4 py-3">Pagaré #</th>
                    <th className="px-4 py-3">Cliente / Cédula</th>
                    <th className="px-4 py-3">Emisión</th>
                    <th className="px-4 py-3 text-center">Plazo</th>
                    <th className="px-4 py-3 text-right">Total Crédito</th>
                    <th className="px-4 py-3 text-right">Total Abonado</th>
                    <th className="px-4 py-3 text-right">Saldo Pendiente</th>
                    <th className="px-4 py-3 text-center">Estado</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {filteredCartera.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-neutral-400">
                        No se encontraron registros de crédito en cartera.
                      </td>
                    </tr>
                  ) : (
                    filteredCartera.map((cs) => {
                      const remaining = cs.remainingBalance ?? (cs.netFinancedAmount || 0);
                      const isSettled = cs.status === 'LIQUIDADO' || remaining <= 0.01;

                      return (
                        <tr key={cs.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40">
                          <td className="px-4 py-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            {cs.promissoryNoteNumber}
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-bold block text-neutral-900 dark:text-white">{cs.clientName}</span>
                            <span className="text-[11px] text-neutral-500 font-mono">CI: {cs.clientIdCard}</span>
                          </td>
                          <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                            {cs.saleDate}
                          </td>
                          <td className="px-4 py-3 text-center font-semibold">
                            {cs.termMonths} meses ({cs.paymentFrequency?.toLowerCase()})
                          </td>
                          <td className="px-4 py-3 text-right font-medium">
                            {formatCurrency(cs.netFinancedAmount || cs.grossTotal)}
                          </td>
                          <td className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400 font-bold">
                            {formatCurrency(cs.totalPaid || 0)}
                          </td>
                          <td className="px-4 py-3 text-right font-black text-red-600 dark:text-red-400">
                            {formatCurrency(remaining)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isSettled
                                ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                                : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                            }`}>
                              {isSettled ? 'LIQUIDADO' : 'ACTIVO'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              {!isSettled && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveCreditForWhatsApp(cs);
                                      setIsWhatsAppModalOpen(true);
                                    }}
                                    className="p-1.5 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 text-emerald-600 dark:text-emerald-400 rounded-lg border border-emerald-200 dark:border-emerald-800 cursor-pointer"
                                    title="Notificar por WhatsApp"
                                  >
                                    <MessageCircle className="w-4 h-4" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveCreditForPayment(cs);
                                      setIsPaymentModalOpen(true);
                                    }}
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] flex items-center gap-1 shadow-sm cursor-pointer"
                                    title="Cobrar Cuota"
                                  >
                                    <Coins className="w-3.5 h-3.5" />
                                    <span>Cobrar</span>
                                  </button>
                                </>
                              )}

                              {/* 1. Reimprimir Solicitud de Crédito */}
                              <button
                                type="button"
                                onClick={() => handleOpenCreditApplication(cs)}
                                className="p-1.5 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 rounded-lg border border-indigo-200 dark:border-indigo-800 transition-colors cursor-pointer"
                                title="Reimprimir Solicitud de Crédito (1 Hoja)"
                              >
                                <FileCheck className="w-4 h-4" />
                              </button>

                              {/* 2. Reimprimir Pagaré a la Orden */}
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveCreditForPromissory(cs);
                                  setIsPromissoryModalOpen(true);
                                }}
                                className="p-1.5 bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 text-purple-700 dark:text-purple-300 rounded-lg border border-purple-200 dark:border-purple-800 transition-colors cursor-pointer"
                                title="Reimprimir Pagaré a la Orden"
                              >
                                <Printer className="w-4 h-4" />
                              </button>

                              {/* 3. Reimprimir Estado de Cuenta */}
                              <button
                                type="button"
                                onClick={() => {
                                  const c = clients.find(cl => cl.id === cs.clientId);
                                  if (c) {
                                    setActiveClientForStatement(c);
                                    setIsStatementModalOpen(true);
                                  } else {
                                    showToast('Cliente no encontrado en el directorio', 'warning');
                                  }
                                }}
                                className="p-1.5 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 text-blue-700 dark:text-blue-300 rounded-lg border border-blue-200 dark:border-blue-800 transition-colors cursor-pointer"
                                title="Reimprimir Estado de Cuenta (con fechas de pagos cancelados)"
                              >
                                <Award className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: HISTORIAL DE RECIBOS Y COMPROBANTES DE PAGO                        */}
      {/* ========================================================================= */}
      {activeTab === 'recibos' && (
        <div className="space-y-4">
          {/* Filter Toolbar */}
          <div className="bg-white dark:bg-neutral-900 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-neutral-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por comprobante #, cliente, pagaré # o cobrador..."
                className="w-full pl-9 pr-4 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs font-medium text-neutral-900 dark:text-white"
              />
            </div>
          </div>

          {/* Payments Table */}
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 font-bold border-b border-neutral-200 dark:border-neutral-700">
                  <tr>
                    <th className="px-4 py-3">Recibo #</th>
                    <th className="px-4 py-3">Fecha & Hora</th>
                    <th className="px-4 py-3">Pagaré Ref.</th>
                    <th className="px-4 py-3">Cliente / Deudor</th>
                    <th className="px-4 py-3 text-right">Monto Cobrado</th>
                    <th className="px-4 py-3">Forma Pago</th>
                    <th className="px-4 py-3">Cobrador</th>
                    <th className="px-4 py-3 text-center">Estado</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {filteredPayments.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-neutral-400">
                        No se registran comprobantes de cobro emitidos.
                      </td>
                    </tr>
                  ) : (
                    filteredPayments.map((p) => {
                      const isAnnulled = p.status === 'ANULADO';

                      return (
                        <tr key={p.id} className={isAnnulled ? 'opacity-60 bg-red-50/20' : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/40'}>
                          <td className="px-4 py-3 font-mono font-bold text-neutral-900 dark:text-white">
                            {p.receiptNumber}
                          </td>
                          <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                            {p.paymentDate} {p.paymentTime || ''}
                          </td>
                          <td className="px-4 py-3 font-mono text-indigo-600 dark:text-indigo-400 font-semibold">
                            {p.promissoryNoteNumber}
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-bold block text-neutral-900 dark:text-white">{p.clientName}</span>
                            <span className="text-[11px] text-neutral-500 font-mono">CI: {p.clientIdCard}</span>
                          </td>
                          <td className="px-4 py-3 text-right font-black text-emerald-600 dark:text-emerald-400 text-sm">
                            {formatCurrency(p.totalAmountPaid)}
                          </td>
                          <td className="px-4 py-3 font-medium">
                            {p.paymentMethod}
                            {p.referenceNumber && <span className="block text-[10px] text-neutral-400 font-mono">Ref: {p.referenceNumber}</span>}
                          </td>
                          <td className="px-4 py-3 text-neutral-700 dark:text-neutral-300">
                            {p.collectorName}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isAnnulled
                                ? 'bg-red-100 text-red-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {isAnnulled ? 'ANULADO' : 'VÁLIDO'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setActivePaymentForReceipt(p);
                                  setIsReceiptModalOpen(true);
                                }}
                                className="px-2.5 py-1 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-lg font-bold text-[11px] flex items-center gap-1"
                                title="Reimprimir Comprobante Oficial"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                <span>Recibo</span>
                              </button>

                              {!isAnnulled && (
                                <button
                                  type="button"
                                  onClick={() => handleRevertPayment(p)}
                                  className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg"
                                  title="Anular Comprobante y Revertir Saldos"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: GESTIÓN DE MORA, COBRANZA MULTICANAL & BURÓ (TRAMO 4)               */}
      {/* ========================================================================= */}
      {activeTab === 'mora' && (
        <div className="space-y-6">
          
          {/* SEMÁFORO DE MORA Y RIESGO CREDITICIO (SUPERINTENDENCIA / BURÓ) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div 
              onClick={() => setMoraRiskFilter(moraRiskFilter === 'A' ? 'ALL' : 'A')}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                moraRiskFilter === 'A'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 shadow-sm'
                  : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 hover:border-emerald-300'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase">
                <span>Cat. A • Normal</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
              </div>
              <div className="text-xl font-black text-neutral-900 dark:text-white mt-1">
                {moraStats.catA}
              </div>
              <div className="text-[10px] text-neutral-400 mt-0.5">
                0 a 30 días mora
              </div>
            </div>

            <div 
              onClick={() => setMoraRiskFilter(moraRiskFilter === 'B' ? 'ALL' : 'B')}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                moraRiskFilter === 'B'
                  ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-500 shadow-sm'
                  : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 hover:border-amber-300'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase">
                <span>Cat. B • Potencial</span>
                <span className="w-2 h-2 rounded-full bg-amber-500" />
              </div>
              <div className="text-xl font-black text-neutral-900 dark:text-white mt-1">
                {moraStats.catB}
              </div>
              <div className="text-[10px] text-neutral-400 mt-0.5">
                31 a 60 días mora
              </div>
            </div>

            <div 
              onClick={() => setMoraRiskFilter(moraRiskFilter === 'C' ? 'ALL' : 'C')}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                moraRiskFilter === 'C'
                  ? 'bg-orange-50 dark:bg-orange-950/40 border-orange-500 shadow-sm'
                  : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 hover:border-orange-300'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] font-bold text-orange-700 dark:text-orange-400 uppercase">
                <span>Cat. C • Deficiente</span>
                <span className="w-2 h-2 rounded-full bg-orange-500" />
              </div>
              <div className="text-xl font-black text-neutral-900 dark:text-white mt-1">
                {moraStats.catC}
              </div>
              <div className="text-[10px] text-neutral-400 mt-0.5">
                61 a 90 días mora
              </div>
            </div>

            <div 
              onClick={() => setMoraRiskFilter(moraRiskFilter === 'D' ? 'ALL' : 'D')}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                moraRiskFilter === 'D'
                  ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-500 shadow-sm'
                  : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 hover:border-rose-300'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] font-bold text-rose-700 dark:text-rose-400 uppercase">
                <span>Cat. D • Difícil Cobro</span>
                <span className="w-2 h-2 rounded-full bg-rose-500" />
              </div>
              <div className="text-xl font-black text-neutral-900 dark:text-white mt-1">
                {moraStats.catD}
              </div>
              <div className="text-[10px] text-neutral-400 mt-0.5">
                91 a 120 días mora
              </div>
            </div>

            <div 
              onClick={() => setMoraRiskFilter(moraRiskFilter === 'E' ? 'ALL' : 'E')}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                moraRiskFilter === 'E'
                  ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-500 shadow-sm'
                  : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 hover:border-purple-300'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] font-bold text-purple-700 dark:text-purple-400 uppercase">
                <span>Cat. E • Castigada</span>
                <span className="w-2 h-2 rounded-full bg-purple-500" />
              </div>
              <div className="text-xl font-black text-neutral-900 dark:text-white mt-1">
                {moraStats.catE}
              </div>
              <div className="text-[10px] text-neutral-400 mt-0.5">
                &gt; 120 días mora
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/20">
              <div className="flex items-center justify-between text-[11px] font-bold text-rose-800 dark:text-rose-300 uppercase">
                <span>Índice PAR &gt; 30</span>
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              </div>
              <div className="text-xl font-black text-rose-700 dark:text-rose-400 mt-1">
                {moraStats.par30Percent}%
              </div>
              <div className="text-[10px] text-rose-600 dark:text-rose-400 truncate mt-0.5 font-semibold">
                {formatCurrency(moraStats.par30Balance)} en riesgo
              </div>
            </div>
          </div>

          {/* BANNER DE PROMESAS DE PAGO ACTIVAS */}
          {collectionLogs.filter(l => l.promiseDate && !l.isPromiseFulfilled).length > 0 && (
            <div className="bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 flex items-center justify-center">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-neutral-900 dark:text-white uppercase tracking-wider">
                      Compromisos y Promesas de Pago Registradas
                    </h3>
                    <p className="text-[11px] text-neutral-500">
                      Seguimiento de cuotas prometidas por deudores y garantes
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-1 rounded-full border border-indigo-200 dark:border-indigo-800">
                    {collectionLogs.filter(l => l.promiseDate && !l.isPromiseFulfilled).length} pendientes
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                {collectionLogs
                  .filter(l => l.promiseDate && !l.isPromiseFulfilled)
                  .slice(0, 6)
                  .map((log) => {
                    const isToday = log.promiseDate === new Date().toISOString().split('T')[0];
                    const isOverdue = (log.promiseDate || '') < new Date().toISOString().split('T')[0];

                    return (
                      <div 
                        key={log.id} 
                        className={`p-3 rounded-xl border flex items-start justify-between gap-3 ${
                          isOverdue 
                            ? 'bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-900' 
                            : isToday 
                              ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800' 
                              : 'bg-neutral-50 dark:bg-neutral-800/40 border-neutral-200 dark:border-neutral-700'
                        }`}
                      >
                        <div className="space-y-1 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-neutral-900 dark:text-white">{log.clientName}</span>
                            <span className="text-[10px] font-mono text-neutral-500">#{log.promissoryNoteNumber}</span>
                          </div>
                          <p className="text-[11px] text-neutral-500">
                            Prometió pagar: <strong className="text-emerald-600 font-mono">{formatCurrency(log.promiseAmount || 0)}</strong>
                          </p>
                          <div className="flex items-center gap-2 text-[10px]">
                            <span className={`px-2 py-0.5 rounded font-bold ${
                              isOverdue 
                                ? 'bg-red-100 text-red-700' 
                                : isToday 
                                  ? 'bg-amber-100 text-amber-800' 
                                  : 'bg-neutral-200 text-neutral-700'
                            }`}>
                              {isOverdue ? 'Venció' : isToday ? '¡Hoy!' : 'Fecha'}: {log.promiseDate}
                            </span>
                            <span className="text-neutral-400">({log.contactTarget})</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleTogglePromiseFulfilled(log)}
                          className="p-1.5 bg-white dark:bg-neutral-800 hover:bg-emerald-50 text-neutral-400 hover:text-emerald-600 rounded-lg border border-neutral-200 dark:border-neutral-700 transition-colors shadow-sm"
                          title="Marcar promesa como cumplida"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* FILTER TOOLBAR */}
          <div className="bg-white dark:bg-neutral-900 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col md:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3 top-3 text-neutral-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar en mora por deudor, pagaré, cédula, garante o artículo..."
                className="w-full pl-9 pr-4 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs font-medium text-neutral-900 dark:text-white"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
              <Filter className="w-4 h-4 text-neutral-400 shrink-0" />
              <select
                value={moraRiskFilter}
                onChange={(e) => setMoraRiskFilter(e.target.value)}
                className="px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs font-bold"
              >
                <option value="ALL">Todas las Categorías</option>
                <option value="OVERDUE_ONLY">Solo con Cuotas en Mora</option>
                <option value="UPCOMING_ONLY">Próximos a Vencer (1-5 días)</option>
                <option value="PROMISES_TODAY">Compromisos de Pago para Hoy</option>
                <option value="A">Cat. A (0 - 30 días)</option>
                <option value="B">Cat. B (31 - 60 días)</option>
                <option value="C">Cat. C (61 - 90 días)</option>
                <option value="D">Cat. D (91 - 120 días)</option>
                <option value="E">Cat. E (&gt; 120 días)</option>
              </select>
            </div>
          </div>

          {/* TABLA DE CARTERA CON MORA Y GESTIÓN */}
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 font-bold border-b border-neutral-200 dark:border-neutral-700">
                  <tr>
                    <th className="px-4 py-3">Pagaré / Emisión</th>
                    <th className="px-4 py-3">Deudor & Garante</th>
                    <th className="px-4 py-3 text-right">Saldo Deudor</th>
                    <th className="px-4 py-3 text-right">Valor en Mora</th>
                    <th className="px-4 py-3 text-center">Días Mora</th>
                    <th className="px-4 py-3 text-center">Riesgo Buró</th>
                    <th className="px-4 py-3 text-center">Próx. Vencimiento</th>
                    <th className="px-4 py-3 text-right">Acciones de Cobranza</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {filteredMoraCartera.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-neutral-400">
                        No se encontraron créditos que coincidan con los criterios de mora seleccionados.
                      </td>
                    </tr>
                  ) : (
                    filteredMoraCartera.map((cs) => {
                      const risk = calculateCreditRiskAndAging(cs);
                      const remaining = cs.remainingBalance ?? (cs.netFinancedAmount || 0);
                      const isSettled = cs.status === 'LIQUIDADO' || remaining <= 0.01;
                      
                      // Find latest log for this credit
                      const latestLog = collectionLogs.find(l => l.creditSaleId === cs.id);

                      return (
                        <tr 
                          key={cs.id} 
                          className={`hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors ${
                            risk.overdueDays > 60 
                              ? 'bg-rose-50/20 dark:bg-rose-950/10' 
                              : risk.overdueDays > 0 
                                ? 'bg-amber-50/20 dark:bg-amber-950/10' 
                                : ''
                          }`}
                        >
                          {/* Pagaré # y Fecha */}
                          <td className="px-4 py-3">
                            <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 block">
                              {cs.promissoryNoteNumber}
                            </span>
                            <span className="text-[11px] text-neutral-400 font-mono">
                              {cs.saleDate}
                            </span>
                          </td>

                          {/* Cliente y Garante */}
                          <td className="px-4 py-3">
                            <div className="font-bold text-neutral-900 dark:text-white flex items-center gap-1.5">
                              {cs.clientName}
                            </div>
                            <div className="text-[11px] text-neutral-500 font-mono flex items-center gap-2">
                              <span>CI: {cs.clientIdCard}</span>
                              {cs.clientPhone && (
                                <span className="text-neutral-400">• Telf: {cs.clientPhone}</span>
                              )}
                            </div>
                            {cs.guarantorName && (
                              <div className="text-[10px] text-neutral-500 dark:text-neutral-400 flex items-center gap-1 mt-0.5">
                                <ShieldCheck className="w-3 h-3 text-amber-500" />
                                <span>Garante: <strong>{cs.guarantorName}</strong> ({cs.guarantorPhone || 'Sin telf'})</span>
                              </div>
                            )}
                          </td>

                          {/* Saldo Deudor */}
                          <td className="px-4 py-3 text-right">
                            <span className="font-bold text-neutral-900 dark:text-white block">
                              {formatCurrency(remaining)}
                            </span>
                            <span className="text-[10px] text-neutral-400">
                              de {formatCurrency(cs.grossTotal || cs.netFinancedAmount || 0)}
                            </span>
                          </td>

                          {/* Valor en Mora */}
                          <td className="px-4 py-3 text-right">
                            <span className={`font-black text-sm block ${risk.overdueAmount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-neutral-400'}`}>
                              {formatCurrency(risk.overdueAmount)}
                            </span>
                            {risk.overdueInstallmentsCount > 0 && (
                              <span className="text-[10px] text-rose-500 font-semibold">
                                {risk.overdueInstallmentsCount} cuota(s) vencida(s)
                              </span>
                            )}
                          </td>

                          {/* Días Mora */}
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-block px-2.5 py-1 rounded-full font-black text-xs ${
                              risk.overdueDays > 60 
                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300' 
                                : risk.overdueDays > 0 
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' 
                                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            }`}>
                              {risk.overdueDays > 0 ? `${risk.overdueDays} días` : 'Al Día'}
                            </span>
                          </td>

                          {/* Categoría / Calificación Buró */}
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${risk.riskBadgeClass}`}>
                              {risk.riskLabel}
                            </span>
                            {latestLog && (
                              <span className="block text-[9px] text-neutral-400 mt-1 truncate max-w-[140px] mx-auto" title={latestLog.notes}>
                                Últ: {latestLog.contactType} ({latestLog.outcome})
                              </span>
                            )}
                          </td>

                          {/* Próximo Vencimiento */}
                          <td className="px-4 py-3 text-center font-mono text-neutral-600 dark:text-neutral-300">
                            {risk.earliestOverdueDueDate ? (
                              <span className="text-rose-600 font-bold block">
                                {risk.earliestOverdueDueDate}
                              </span>
                            ) : risk.nextInstallmentDueDate ? (
                              <span className="text-neutral-700 dark:text-neutral-300 block">
                                {risk.nextInstallmentDueDate}
                              </span>
                            ) : (
                              <span className="text-neutral-400">Cancelado</span>
                            )}
                          </td>

                          {/* Acciones de Cobranza */}
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* WhatsApp Directo con Plantillas */}
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveCreditForWhatsApp(cs);
                                  setIsWhatsAppModalOpen(true);
                                }}
                                className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors shadow-sm"
                                title="Notificar por WhatsApp con Plantilla"
                              >
                                <MessageCircle className="w-4 h-4" />
                              </button>

                              {/* Registrar Gestión Telefónica / Presencial */}
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveCreditForAction(cs);
                                  setIsActionModalOpen(true);
                                }}
                                className="p-1.5 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg transition-colors"
                                title="Registrar Llamada, Visita o Promesa de Pago"
                              >
                                <PhoneCall className="w-4 h-4" />
                              </button>

                              {/* Cobrar Cuota */}
                              {!isSettled && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveCreditForPayment(cs);
                                    setIsPaymentModalOpen(true);
                                  }}
                                  className="px-2 py-1 bg-neutral-800 hover:bg-black text-white rounded-lg text-[11px] font-bold flex items-center gap-1 shadow-sm"
                                  title="Registrar Abono o Cancelación"
                                >
                                  <Coins className="w-3.5 h-3.5" />
                                  <span>Cobrar</span>
                                </button>
                              )}

                              {/* Estado de Cuenta / Paz y Salvo */}
                              <button
                                type="button"
                                onClick={() => {
                                  const c = clients.find(cl => cl.id === cs.clientId);
                                  if (c) {
                                    setActiveClientForStatement(c);
                                    setIsStatementModalOpen(true);
                                  } else {
                                    showToast('Cliente no encontrado', 'warning');
                                  }
                                }}
                                className="p-1.5 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 text-blue-700 dark:text-blue-300 rounded-lg border border-blue-200 dark:border-blue-800"
                                title="Estado de Cuenta & Paz y Salvo"
                              >
                                <Award className="w-4 h-4" />
                              </button>

                              {/* Ver Pagaré */}
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveCreditForPromissory(cs);
                                  setIsPromissoryModalOpen(true);
                                }}
                                className="p-1.5 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 text-neutral-700 dark:text-neutral-300 rounded-lg"
                                title="Ver Pagaré a la Orden"
                              >
                                <FileText className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALS INTEGRATION                                                        */}
      {/* ========================================================================= */}

      {/* Modal de Creación / Edición de Cliente */}
      <ClientModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingClient(null);
        }}
        onSave={handleSaveClient}
        initialData={editingClient}
        existingClients={clients}
      />

      {/* Tramo 3: Modal de Cobro de Cuota / Abono */}
      <RecordCreditPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => {
          setIsPaymentModalOpen(false);
          setActiveCreditForPayment(null);
        }}
        creditSale={activeCreditForPayment}
        onPaymentSuccess={(payment) => {
          setActivePaymentForReceipt(payment);
          setIsReceiptModalOpen(true);
        }}
        employees={employees}
      />

      {/* Tramo 3: Modal de Comprobante Oficial de Cobro (Ticket 80mm & A4) */}
      <CreditPaymentReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => {
          setIsReceiptModalOpen(false);
          setActivePaymentForReceipt(null);
        }}
        payment={activePaymentForReceipt}
        enterpriseName={profile?.enterpriseName || 'Mi Empresa Comercial'}
      />

      {/* Tramo 2: Modal de Pagaré a la Orden */}
      <PromissoryNoteModal
        isOpen={isPromissoryModalOpen}
        onClose={() => {
          setIsPromissoryModalOpen(false);
          setActiveCreditForPromissory(null);
        }}
        creditSale={activeCreditForPromissory}
        companyName={profile?.name || profile?.enterpriseName || 'ELECTRO & CRÉDITOS S.A.'}
        companyRuc={profile?.ruc || '1790012345001'}
        companyAddress={profile?.address || 'Ecuador'}
        companyPhone={profile?.phone || '0999999999'}
        onOpenCreditApplication={activeCreditForPromissory ? () => handleOpenCreditApplication(activeCreditForPromissory) : undefined}
      />

      {/* Reimpresión Oficial de Solicitud de Crédito (1 Hoja) */}
      <CreditApplicationPrintModal
        isOpen={isApplicationModalOpen}
        onClose={() => {
          setIsApplicationModalOpen(false);
          setActiveApplicationData(null);
        }}
        data={activeApplicationData}
        companyName={profile?.name || profile?.enterpriseName || 'ELECTRO & CRÉDITOS S.A.'}
        companyRuc={profile?.ruc || '1790012345001'}
        companyAddress={profile?.address || 'Ecuador'}
        companyPhone={profile?.phone || '0999999999'}
      />

      {/* Tramo 4: Modal de Cobranza WhatsApp con Plantillas Deudor / Garante */}
      {activeCreditForWhatsApp && (
        <WhatsAppCollectionModal
          isOpen={isWhatsAppModalOpen}
          onClose={() => {
            setIsWhatsAppModalOpen(false);
            setActiveCreditForWhatsApp(null);
          }}
          credit={activeCreditForWhatsApp}
        />
      )}

      {/* Tramo 4: Modal de Registro de Gestión de Cobranza & Promesa de Pago */}
      {activeCreditForAction && (
        <CollectionActionModal
          isOpen={isActionModalOpen}
          onClose={() => {
            setIsActionModalOpen(false);
            setActiveCreditForAction(null);
          }}
          credit={activeCreditForAction}
          onSaved={() => {}}
        />
      )}

      {/* Tramo 4: Modal de Estado de Cuenta Consolidado & Certificado de Paz y Salvo */}
      {activeClientForStatement && (
        <ClientAccountStatementModal
          isOpen={isStatementModalOpen}
          onClose={() => {
            setIsStatementModalOpen(false);
            setActiveClientForStatement(null);
          }}
          client={activeClientForStatement}
          credits={creditSales.filter(cs => cs.clientId === activeClientForStatement.id)}
          payments={creditPayments}
        />
      )}

    </div>
  );
}
