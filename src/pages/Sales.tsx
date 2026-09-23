import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, getDoc, Timestamp, query, orderBy, where } from 'firebase/firestore';
import { Plus, Pencil, Trash2, ShoppingCart, AlertCircle, Save, X, Calendar, User, DollarSign, Bike, FileText, BadgePercent, ShieldCheck, Coins, Receipt, ShoppingBag, Printer, UserPlus, Users } from 'lucide-react';
import SalesPredictiveSearch from '../components/sales/SalesPredictiveSearch';
import { ClientManagementModal } from '../components/sales/ClientManagementModal';
import { NewCreditSaleModal } from '../components/sales/NewCreditSaleModal';
import { NewInventoryCashSaleModal } from '../components/sales/NewInventoryCashSaleModal';
import { NewManualSaleModal } from '../components/employees/NewManualSaleModal';
import { PromissoryNoteModal } from '../components/sales/PromissoryNoteModal';
import { CreditApplicationPrintModal, CreditApplicationPrintData } from '../components/sales/CreditApplicationPrintModal';
import { DocumentPrintCenterModal } from '../components/sales/DocumentPrintCenterModal';
import { RecordCreditPaymentModal } from '../components/sales/RecordCreditPaymentModal';
import { CreditPaymentReceiptModal } from '../components/sales/CreditPaymentReceiptModal';
import { executeCreditSaleTransaction, fetchInventoryCollection } from '../lib/inventory-db';
import { CreditSale } from '../types/creditSale';
import { CreditPayment } from '../types/creditPayment';
import { Client } from '../types/client';
import { Warehouse, Article, WarehouseInventory } from '../types/inventory';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { logAudit, AuditAction } from '../lib/audit';
import { format } from 'date-fns';
import { isSuperAdminEmail } from '../lib/utils';

interface Employee {
  id: string;
  name: string;
  lastName: string;
  role: 'vendedor' | 'cobrador' | 'ambos';
}

interface Sale {
  id: string;
  date: string;
  type: 'contado' | 'credito';
  employeeId: string;
  isMoto: boolean;
  motoType: 'combustion' | 'electrico' | null;
  clientName?: string;
  article: string;
  totalValue: number;
  createdAt?: any;
  enterpriseId?: string;
  creditSaleId?: string;
  promissoryNoteNumber?: string;
}

export default function Sales() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, profile, originalUser, impersonatedUser } = useAuth();
  const { showToast, showConfirm } = useNotification();

  const isSuperAdmin = !impersonatedUser && (profile?.role === 'ADMIN' || profile?.role === 'SUPERADMIN' || isSuperAdminEmail(user?.email));

  const [enterprises, setEnterprises] = useState<{ id: string; name: string; email?: string }[]>([]);
  const [selectedEnterpriseId, setSelectedEnterpriseId] = useState<string>(''); // list filter
  const [formEnterpriseId, setFormEnterpriseId] = useState<string>(''); // form creator filter

  const currentEnterpriseId = isSuperAdmin
    ? (selectedEnterpriseId || user?.uid || '')
    : (profile?.role === 'enterprise' ? user?.uid : (profile?.enterpriseId || user?.uid || ''));
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isInventoryCashSaleModalOpen, setIsInventoryCashSaleModalOpen] = useState(false);
  const [isManualSaleModalOpen, setIsManualSaleModalOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);

  // Credit Sales Tramo 2 Modals and Data State
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isCreditSaleModalOpen, setIsCreditSaleModalOpen] = useState(false);
  const [promissoryNoteSale, setPromissoryNoteSale] = useState<CreditSale | null>(null);
  const [isPromissoryModalOpen, setIsPromissoryModalOpen] = useState(false);
  const [creditApplicationData, setCreditApplicationData] = useState<CreditApplicationPrintData | null>(null);
  const [isCreditApplicationModalOpen, setIsCreditApplicationModalOpen] = useState(false);
  const [printCenterSale, setPrintCenterSale] = useState<Sale | null>(null);
  const [printCenterCreditDetails, setPrintCenterCreditDetails] = useState<CreditSale | null>(null);
  const [printCenterClientDetails, setPrintCenterClientDetails] = useState<Client | null>(null);
  const [isPrintCenterModalOpen, setIsPrintCenterModalOpen] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [warehouseInventories, setWarehouseInventories] = useState<WarehouseInventory[]>([]);

  // Tramo 3: Cobro de Cuotas y Comprobantes
  const [activeCreditSaleForPayment, setActiveCreditSaleForPayment] = useState<CreditSale | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [lastGeneratedPayment, setLastGeneratedPayment] = useState<CreditPayment | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  // Filters
  const [filterEmployee, setFilterEmployee] = useState('');
  const [filterClient, setFilterClient] = useState('');
  const [filterDateType, setFilterDateType] = useState<'exacta' | 'rango'>('exacta');
  const [filterDateExact, setFilterDateExact] = useState('');
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');

  
  // Form State
  const [formData, setFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    type: 'contado' as 'contado' | 'credito',
    employeeId: '',
    isMoto: false,
    motoType: 'combustion' as 'combustion' | 'electrico' | null,
    totalValue: '',
    clientName: '',
    article: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const uniqueClients = Array.from(new Set(sales.map(s => s.clientName).filter(Boolean))) as string[];

  const filteredSales = sales.filter(sale => {
    let match = true;
    const emp = employees.find(e => e.id === sale.employeeId);
    const empName = emp ? `${emp.name} ${emp.lastName}`.toLowerCase() : '';
    
    if (filterEmployee && !empName.includes(filterEmployee.toLowerCase())) match = false;
    if (filterClient && !(sale.clientName || '').toLowerCase().includes(filterClient.toLowerCase())) match = false;
    
    if (filterDateType === 'exacta' && filterDateExact) {
      if (sale.date !== filterDateExact) match = false;
    } else if (filterDateType === 'rango') {
      if (filterDateStart && sale.date < filterDateStart) match = false;
      if (filterDateEnd && sale.date > filterDateEnd) match = false;
    }
    
    return match;
  });

  useEffect(() => {
    if (user) {
      fetchData();
      if (isSuperAdmin) {
        loadEnterprises();
      }
    }
  }, [user, isSuperAdmin, selectedEnterpriseId]);

  const loadEnterprises = async () => {
    try {
      const q = query(collection(db, 'users'), where('role', '==', 'enterprise'));
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || 'Empresa sin nombre',
        email: doc.data().email
      }));
      setEnterprises(list);
    } catch (error) {
      console.error('Error loading enterprises for SuperAdmin sales:', error);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      
      let salesList: Sale[] = [];
      let empList: Employee[] = [];

      if (isSuperAdmin) {
        // SuperAdmin fetches all documents and applies selectedEnterpriseId filter
        const [allSales, allEmployees, allClients, allWarehouses, allArticles, allInventories] = await Promise.all([
          getDocs(collection(db, 'sales')),
          getDocs(collection(db, 'employees')),
          getDocs(collection(db, 'clients')),
          getDocs(collection(db, 'warehouses')),
          getDocs(collection(db, 'articles')),
          getDocs(collection(db, 'warehouse_inventory'))
        ]);
        
        salesList = allSales.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale));
        empList = allEmployees.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
        
        let clientList = allClients.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
        let warehouseList = allWarehouses.docs.map(doc => ({ id: doc.id, ...doc.data() } as Warehouse));
        let articleList = allArticles.docs.map(doc => ({ id: doc.id, ...doc.data() } as Article));
        let inventoryList = allInventories.docs.map(doc => ({ id: doc.id, ...doc.data() } as WarehouseInventory));

        if (selectedEnterpriseId) {
          salesList = salesList.filter((s: any) => s.enterpriseId === selectedEnterpriseId || s.userId === selectedEnterpriseId);
          empList = empList.filter((e: any) => e.enterpriseId === selectedEnterpriseId);
          clientList = clientList.filter((c: any) => c.enterpriseId === selectedEnterpriseId);
          warehouseList = warehouseList.filter((w: any) => w.userId === selectedEnterpriseId || (w as any).enterpriseId === selectedEnterpriseId);
          articleList = articleList.filter((a: any) => a.userId === selectedEnterpriseId || (a as any).enterpriseId === selectedEnterpriseId);
          inventoryList = inventoryList.filter((inv: any) => inv.userId === selectedEnterpriseId || (inv as any).enterpriseId === selectedEnterpriseId);
        }
        setClients(clientList);
        setWarehouses(warehouseList);
        setArticles(articleList);
        setWarehouseInventories(inventoryList.map(i => ({ ...i, stock: (i.stock ?? i.quantity) || 0 })));
      } else {
        const tenantId = profile?.role === 'enterprise' ? user?.uid : (profile?.enterpriseId || user?.uid || '');
        if (!tenantId) {
          setSales([]);
          setEmployees([]);
          setClients([]);
          setWarehouses([]);
          setArticles([]);
          setWarehouseInventories([]);
          setLoading(false);
          return;
        }

        const salesQ = query(collection(db, 'sales'), where('enterpriseId', '==', tenantId));
        const empQ = query(collection(db, 'employees'), where('enterpriseId', '==', tenantId));
        const clientsQ = query(collection(db, 'clients'), where('enterpriseId', '==', tenantId));

        const [salesRes, empRes, clientsRes, warehousesList, articlesList, inventoryList] = await Promise.all([
          getDocs(salesQ),
          getDocs(empQ),
          getDocs(clientsQ),
          fetchInventoryCollection<Warehouse>('warehouses', tenantId, user?.uid, profile?.enterpriseId),
          fetchInventoryCollection<Article>('articles', tenantId, user?.uid, profile?.enterpriseId),
          fetchInventoryCollection<WarehouseInventory>('warehouse_inventory', tenantId, user?.uid, profile?.enterpriseId)
        ]);

        salesList = salesRes.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale));
        empList = empRes.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
        setClients(clientsRes.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));
        setWarehouses(warehousesList);
        setArticles(articlesList);
        setWarehouseInventories(inventoryList.map(doc => ({ ...doc, stock: (doc.stock ?? doc.quantity) || 0 })));
      }

      // Deduplicate employees by full name
      const uniqueEmps: Employee[] = [];
      const seenNames = new Set<string>();
      empList.forEach(e => {
        const key = `${e.name || ''} ${e.lastName || ''}`.trim().toLowerCase();
        if (!seenNames.has(key)) {
          seenNames.add(key);
          uniqueEmps.push(e);
        }
      });

      salesList.sort((a, b) => {
        if (b.date !== a.date) return b.date.localeCompare(a.date);
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
        return timeB - timeA;
      });
      setSales(salesList);

      uniqueEmps.sort((a, b) => a.name.localeCompare(b.name));
      setEmployees(uniqueEmps);
    } catch (err: any) {
      console.error('Error fetching data:', err);
      setError('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (sale?: Sale) => {
    if (sale) {
      setEditingSale(sale);
      setFormEnterpriseId((sale as any).enterpriseId || '');
      setFormData({
        date: sale.date,
        type: sale.type,
        employeeId: sale.employeeId,
        isMoto: sale.isMoto,
        motoType: sale.motoType || 'combustion',
        totalValue: sale.totalValue.toString(),
        clientName: sale.clientName || '',
        article: sale.article || ''
      });
    } else {
      setEditingSale(null);
      const initialEntId = selectedEnterpriseId || '';
      setFormEnterpriseId(initialEntId);
      
      // Filter employees of the chosen initial company to select a valid seller
      const validEmps = initialEntId
        ? employees.filter(e => e.enterpriseId === initialEntId && (e.role === 'vendedor' || e.role === 'ambos'))
        : employees.filter(e => e.role === 'vendedor' || e.role === 'ambos');

      setFormData({
        date: format(new Date(), 'yyyy-MM-dd'),
        type: 'contado',
        employeeId: validEmps[0]?.id || employees[0]?.id || '',
        isMoto: false,
        motoType: 'combustion',
        totalValue: '',
        clientName: '',
        article: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    try {
      setIsSubmitting(true);
      const targetEnterpriseId = isSuperAdmin
        ? (formEnterpriseId || selectedEnterpriseId || user.uid)
        : (profile?.role === 'enterprise' ? user.uid : (profile?.enterpriseId || user.uid || ''));

      const saleData = {
        date: formData.date,
        type: formData.type,
        employeeId: formData.employeeId,
        isMoto: formData.isMoto,
        motoType: formData.isMoto ? formData.motoType : null,
        totalValue: parseFloat(formData.totalValue) || 0,
        clientName: formData.clientName,
        article: formData.article,
        enterpriseId: targetEnterpriseId
      };

      if (editingSale) {
        await updateDoc(doc(db, 'sales', editingSale.id), saleData);
        await logAudit(AuditAction.SALE_UPDATE, `Venta modificada para cliente: ${saleData.clientName || 'Sin Nombre'}, Artículo: ${saleData.article}, Valor: $${saleData.totalValue}`, editingSale.id);
        showToast('Venta modificada exitosamente', 'success');
      } else {
        const newDoc = await addDoc(collection(db, 'sales'), {
          ...saleData,
          createdAt: Timestamp.now()
        });
        await logAudit(AuditAction.SALE_UPDATE, `Venta registrada para cliente: ${saleData.clientName || 'Sin Nombre'}, Artículo: ${saleData.article}, Valor: $${saleData.totalValue}`, newDoc.id);
        showToast('Venta registrada exitosamente', 'success');
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      console.error('Error saving sale:', err);
      setError('Error al guardar venta');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveCreditSale = async (creditSaleData: Partial<CreditSale>) => {
    try {
      const targetEnterpriseId = isSuperAdmin
        ? (formEnterpriseId || selectedEnterpriseId || user?.uid || '')
        : (profile?.role === 'enterprise' ? user?.uid : (profile?.enterpriseId || user?.uid || ''));

      const result = await executeCreditSaleTransaction(
        targetEnterpriseId,
        user?.uid || '',
        creditSaleData
      );

      await logAudit(
        AuditAction.SALE_UPDATE,
        `Venta a crédito procesada. Pagaré #${result.promissoryNoteNumber}, Cliente: ${creditSaleData.clientName}, Monto: $${creditSaleData.grossTotal}`,
        result.creditSaleId
      );

      showToast('Venta a crédito procesada exitosamente con reserva de stock y cupo', 'success');
      setIsCreditSaleModalOpen(false);
      await fetchData();

      // Automatically open Promissory Note modal for printing / saving
      const newCreditDoc = await getDoc(doc(db, 'credit_sales', result.creditSaleId));
      if (newCreditDoc.exists()) {
        const savedCredit = { id: newCreditDoc.id, ...newCreditDoc.data() } as CreditSale;
        setPromissoryNoteSale(savedCredit);
        setIsPromissoryModalOpen(true);

        const matchedClient = clients.find(c => c.id === savedCredit.clientId || c.idCard === savedCredit.clientIdCard) || null;
        setCreditApplicationData({
          applicationNumber: savedCredit.promissoryNoteNumber ? `SOL-${savedCredit.promissoryNoteNumber.replace('PAG-', '')}` : undefined,
          date: savedCredit.saleDate,
          client: matchedClient,
          clientName: savedCredit.clientName,
          clientIdCard: savedCredit.clientIdCard || matchedClient?.idCard,
          clientPhone: savedCredit.clientPhone || matchedClient?.phone,
          clientAddress: savedCredit.clientAddress || matchedClient?.address,
          clientCity: savedCredit.clientCity || matchedClient?.city,
          clientEmail: matchedClient?.email,
          workplace: matchedClient?.workInfo?.workplace,
          workPosition: matchedClient?.workInfo?.position,
          workPhone: matchedClient?.workInfo?.workPhone,
          workAddress: matchedClient?.workInfo?.workAddress,
          spouseName: matchedClient?.spouseInfo?.lastName ? `${matchedClient.spouseInfo.lastName} ${matchedClient.spouseInfo.firstName || ''}`.trim() : undefined,
          spouseIdCard: matchedClient?.spouseInfo?.idCard,
          spousePhone: matchedClient?.spouseInfo?.phone,
          guarantorName: savedCredit.guarantorName || matchedClient?.guarantorName,
          guarantorIdCard: savedCredit.guarantorIdCard || matchedClient?.guarantorIdCard,
          guarantorPhone: savedCredit.guarantorPhone || matchedClient?.guarantorPhone,
          references: matchedClient?.references,
          items: (savedCredit.items || []).map(it => ({
            articleName: it.articleName,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            totalPrice: it.totalPrice
          })),
          grossTotal: savedCredit.grossTotal,
          downPayment: savedCredit.downPayment,
          netFinancedAmount: savedCredit.netFinancedAmount,
          frequency: savedCredit.frequency,
          installmentsCount: savedCredit.installmentsCount,
          installmentAmount: savedCredit.installmentAmount,
          startDate: savedCredit.startDate,
          sellerName: savedCredit.sellerName,
          earlySettlementOptions: savedCredit.earlySettlementOptions
        });
      }
    } catch (err: any) {
      console.error('Error in credit sale transaction:', err);
      showToast(err.message || 'Error al procesar venta a crédito', 'error');
      throw err;
    }
  };

  const handleOpenCreditApplication = async (sale: Sale) => {
    try {
      let cSale: CreditSale | null = null;
      if (sale.creditSaleId) {
        const snap = await getDoc(doc(db, 'credit_sales', sale.creditSaleId));
        if (snap.exists()) {
          cSale = { id: snap.id, ...snap.data() } as CreditSale;
        }
      }
      if (!cSale) {
        const q = query(
          collection(db, 'credit_sales'),
          where('clientName', '==', sale.clientName || ''),
          where('saleDate', '==', sale.date)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          const first = snap.docs[0];
          cSale = { id: first.id, ...first.data() } as CreditSale;
        }
      }

      if (cSale) {
        const matchedClient = clients.find(c => c.id === cSale?.clientId || c.idCard === cSale?.clientIdCard) || null;
        setCreditApplicationData({
          applicationNumber: cSale.promissoryNoteNumber ? `SOL-${cSale.promissoryNoteNumber.replace('PAG-', '')}` : undefined,
          date: cSale.saleDate,
          client: matchedClient,
          clientName: cSale.clientName,
          clientIdCard: cSale.clientIdCard || matchedClient?.idCard,
          clientPhone: cSale.clientPhone || matchedClient?.phone,
          clientAddress: cSale.clientAddress || matchedClient?.address,
          clientCity: cSale.clientCity || matchedClient?.city,
          clientEmail: matchedClient?.email,
          workplace: matchedClient?.workInfo?.workplace,
          workPosition: matchedClient?.workInfo?.position,
          workPhone: matchedClient?.workInfo?.workPhone,
          workAddress: matchedClient?.workInfo?.workAddress,
          spouseName: matchedClient?.spouseInfo?.lastName ? `${matchedClient.spouseInfo.lastName} ${matchedClient.spouseInfo.firstName || ''}`.trim() : undefined,
          spouseIdCard: matchedClient?.spouseInfo?.idCard,
          spousePhone: matchedClient?.spouseInfo?.phone,
          guarantorName: cSale.guarantorName || matchedClient?.guarantorName,
          guarantorIdCard: cSale.guarantorIdCard || matchedClient?.guarantorIdCard,
          guarantorPhone: cSale.guarantorPhone || matchedClient?.guarantorPhone,
          references: matchedClient?.references,
          items: (cSale.items || []).map(it => ({
            articleName: it.articleName,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            totalPrice: it.totalPrice
          })),
          grossTotal: cSale.grossTotal,
          downPayment: cSale.downPayment,
          netFinancedAmount: cSale.netFinancedAmount,
          frequency: cSale.frequency,
          installmentsCount: cSale.installmentsCount,
          installmentAmount: cSale.installmentAmount,
          startDate: cSale.startDate,
          sellerName: cSale.sellerName,
          earlySettlementOptions: cSale.earlySettlementOptions
        });
        setIsCreditApplicationModalOpen(true);
      } else {
        showToast('No se encontró el registro completo de crédito para esta venta', 'warning');
      }
    } catch (err) {
      console.error('Error fetching credit application:', err);
      showToast('Error al abrir solicitud de crédito', 'error');
    }
  };

  const handleOpenPromissoryNote = async (sale: Sale) => {
    try {
      if (sale.creditSaleId) {
        const snap = await getDoc(doc(db, 'credit_sales', sale.creditSaleId));
        if (snap.exists()) {
          setPromissoryNoteSale({ id: snap.id, ...snap.data() } as CreditSale);
          setIsPromissoryModalOpen(true);
          return;
        }
      }
      // Look up credit sale by enterprise and clientName/date if creditSaleId was omitted
      const q = query(
        collection(db, 'credit_sales'),
        where('clientName', '==', sale.clientName || ''),
        where('saleDate', '==', sale.date)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const first = snap.docs[0];
        setPromissoryNoteSale({ id: first.id, ...first.data() } as CreditSale);
        setIsPromissoryModalOpen(true);
      } else {
        showToast('No se encontró el pagaré completo para esta venta', 'warning');
      }
    } catch (err) {
      console.error('Error fetching promissory note:', err);
      showToast('Error al obtener pagaré', 'error');
    }
  };

  const handleOpenDocumentPrintCenter = async (sale: Sale) => {
    try {
      setPrintCenterSale(sale);
      let cSale: CreditSale | null = null;

      if (sale.type === 'credito') {
        if (sale.creditSaleId) {
          const snap = await getDoc(doc(db, 'credit_sales', sale.creditSaleId));
          if (snap.exists()) {
            cSale = { id: snap.id, ...snap.data() } as CreditSale;
          }
        }
        if (!cSale) {
          const q = query(
            collection(db, 'credit_sales'),
            where('clientName', '==', sale.clientName || ''),
            where('saleDate', '==', sale.date)
          );
          const snap = await getDocs(q);
          if (!snap.empty) {
            cSale = { id: snap.docs[0].id, ...snap.docs[0].data() } as CreditSale;
          }
        }
      }

      setPrintCenterCreditDetails(cSale);

      // Find client details if exists
      const foundClient = clients.find(c => 
        (cSale?.clientId && c.id === cSale.clientId) || 
        (cSale?.clientIdCard && c.idCard === cSale.clientIdCard) ||
        (sale.clientName && `${c.lastName || ''} ${c.firstName || ''}`.toLowerCase().includes((sale.clientName || '').toLowerCase()))
      ) || null;

      setPrintCenterClientDetails(foundClient);
      setIsPrintCenterModalOpen(true);
    } catch (err) {
      console.error('Error al abrir centro de documentos:', err);
      // Even if fetch fails, still open with basic sale info
      setPrintCenterSale(sale);
      setIsPrintCenterModalOpen(true);
    }
  };

  const handleOpenPaymentModal = async (sale: Sale) => {
    try {
      if (sale.creditSaleId) {
        const snap = await getDoc(doc(db, 'credit_sales', sale.creditSaleId));
        if (snap.exists()) {
          setActiveCreditSaleForPayment({ id: snap.id, ...snap.data() } as CreditSale);
          setIsPaymentModalOpen(true);
          return;
        }
      }
      const q = query(
        collection(db, 'credit_sales'),
        where('clientName', '==', sale.clientName || ''),
        where('saleDate', '==', sale.date)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const first = snap.docs[0];
        setActiveCreditSaleForPayment({ id: first.id, ...first.data() } as CreditSale);
        setIsPaymentModalOpen(true);
      } else {
        showToast('No se encontró el crédito asociado para abonar cuotas', 'warning');
      }
    } catch (err) {
      console.error('Error loading credit for payment:', err);
      showToast('Error al abrir módulo de cobro', 'error');
    }
  };

  const handlePaymentSuccess = (payment: CreditPayment) => {
    setLastGeneratedPayment(payment);
    setIsReceiptModalOpen(true);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    if (await showConfirm('Eliminar Venta', '¿Está seguro de eliminar este registro? Si proviene de inventario o crédito, se reincorporará automáticamente el stock y las series a bodega y se reestablecerá el cupo del cliente.', { type: 'danger' })) {
      try {
        const saleToDelete = sales.find(s => s.id === id);
        const targetEnterpriseId = saleToDelete?.enterpriseId || currentEnterpriseId || user?.uid || '';
        
        // 1. If it's a credit sale, release client creditUsed, mark ANULADO and revert stock/series
        if (saleToDelete && saleToDelete.type === 'credito') {
          try {
            let creditDocSnap: any = null;
            if (saleToDelete.creditSaleId) {
              const directSnap = await getDoc(doc(db, 'credit_sales', saleToDelete.creditSaleId));
              if (directSnap.exists()) {
                creditDocSnap = directSnap;
              }
            }
            if (!creditDocSnap) {
              const q = query(
                collection(db, 'credit_sales'),
                where('clientName', '==', saleToDelete.clientName || ''),
                where('saleDate', '==', saleToDelete.date)
              );
              const snap = await getDocs(q);
              if (!snap.empty) {
                creditDocSnap = snap.docs[0];
              }
            }

            if (creditDocSnap) {
              const creditData = creditDocSnap.data();
              
              // Relieve client creditUsed
              if (creditData.clientId) {
                const clientRef = doc(db, 'clients', creditData.clientId);
                const clientSnap = await getDoc(clientRef);
                if (clientSnap.exists()) {
                  const currentUsed = clientSnap.data().creditUsed || 0;
                  const financed = creditData.netFinancedAmount || saleToDelete.totalValue || 0;
                  const paid = creditData.totalPaid || 0;
                  const remainingToRelieve = Math.max(0, financed - paid);
                  const newUsed = Math.max(0, Number((currentUsed - remainingToRelieve).toFixed(2)));
                  
                  await updateDoc(clientRef, {
                    creditUsed: newUsed,
                    updatedAt: new Date().toISOString()
                  });
                }
              }

              // Update credit sale status to ANULADO
              await updateDoc(creditDocSnap.ref, {
                status: 'ANULADO',
                remainingBalance: 0,
                installments: (creditData.installments || []).map((inst: any) => ({
                  ...inst,
                  status: 'ANULADO'
                })),
                updatedAt: new Date().toISOString()
              });

              // Also find and mark associated payments as ANULADO
              const paymentsQuery = query(
                collection(db, 'credit_payments'),
                where('creditSaleId', '==', creditDocSnap.id)
              );
              const paymentsSnap = await getDocs(paymentsQuery);
              for (const pDoc of paymentsSnap.docs) {
                if (pDoc.data().status !== 'ANULADO') {
                  await updateDoc(pDoc.ref, {
                    status: 'ANULADO',
                    updatedAt: new Date().toISOString(),
                    voidedReason: 'Anulación de venta origen'
                  });
                }
              }

              // Also mark associated collection logs as ANULADO or hidden if possible
              const logsQuery = query(
                collection(db, 'credit_collection_logs'),
                where('creditSaleId', '==', creditDocSnap.id)
              );
              const logsSnap = await getDocs(logsQuery);
              for (const lDoc of logsSnap.docs) {
                await updateDoc(lDoc.ref, {
                  status: 'ANULADO',
                  updatedAt: new Date().toISOString()
                });
              }

              // Restore client credit limit
              if (creditData.clientId || creditData.clientIdCard) {
                const clientQuery = creditData.clientId 
                  ? query(collection(db, 'clients'), where('id', '==', creditData.clientId))
                  : query(collection(db, 'clients'), where('idCard', '==', creditData.clientIdCard));
                const clientSnap = await getDocs(clientQuery);
                if (!clientSnap.empty) {
                  const clientRef = clientSnap.docs[0].ref;
                  const currentCreditUsed = clientSnap.docs[0].data().creditUsed || 0;
                  const refundAmount = creditData.netFinancedAmount || 0;
                  await updateDoc(clientRef, {
                    creditUsed: Math.max(0, currentCreditUsed - refundAmount),
                    updatedAt: new Date().toISOString()
                  });
                }
              }

              // Revert items stock and series
              if (Array.isArray(creditData.items) && creditData.items.length > 0) {
                for (const item of creditData.items) {
                  if (!item.articleId || !item.quantity) continue;
                  
                  // Restore warehouse_inventory
                  if (item.warehouseId) {
                    const invId = `${item.warehouseId}_${item.articleId}`;
                    const invRef = doc(db, 'warehouse_inventory', invId);
                    const invSnap = await getDoc(invRef);
                    if (invSnap.exists()) {
                      const curStock = (invSnap.data().stock ?? invSnap.data().quantity) || 0;
                      const curSeries: string[] = Array.isArray(invSnap.data().seriesList) ? invSnap.data().seriesList : [];
                      const returnedSeries = Array.isArray(item.selectedSeries) ? item.selectedSeries : [];
                      const mergedSeries = Array.from(new Set([...curSeries, ...returnedSeries]));
                      await updateDoc(invRef, {
                        stock: curStock + item.quantity,
                        quantity: curStock + item.quantity,
                        seriesList: mergedSeries,
                        updatedAt: new Date().toISOString()
                      });
                    }
                  }

                  // Restore articles
                  const artRef = doc(db, 'articles', item.articleId);
                  const artSnap = await getDoc(artRef);
                  if (artSnap.exists()) {
                    const curStock = Number(artSnap.data().quantity) || 0;
                    const curSeries: string[] = Array.isArray(artSnap.data().seriesList) ? artSnap.data().seriesList : [];
                    const returnedSeries = Array.isArray(item.selectedSeries) ? item.selectedSeries : [];
                    const mergedSeries = Array.from(new Set([...curSeries, ...returnedSeries]));
                    await updateDoc(artRef, {
                      quantity: curStock + item.quantity,
                      seriesList: mergedSeries,
                      updatedAt: new Date().toISOString()
                    });
                  }

                  // Log Kardex Movement
                  await addDoc(collection(db, 'inventory_movements'), {
                    articleId: item.articleId,
                    warehouseId: item.warehouseId || '',
                    type: 'IN',
                    quantity: item.quantity,
                    reference: `Reversión por anulación Venta Crédito (Pagaré ${creditData.promissoryNoteNumber || ''})`,
                    seriesList: item.selectedSeries || [],
                    date: new Date().toISOString().split('T')[0],
                    enterpriseId: targetEnterpriseId,
                    userId: targetEnterpriseId,
                    createdBy: user?.uid || '',
                    createdAt: new Date().toISOString()
                  });
                }
              }
            }
          } catch (cErr) {
            console.warn('No se pudo reestablecer cupo o inventario de la venta a crédito:', cErr);
          }
        } else if (saleToDelete && (saleToDelete.deductedFromStock || saleToDelete.articleId)) {
          // 2. If it's a cash sale deducted from stock, revert stock and series
          try {
            const artId = saleToDelete.articleId;
            const whId = saleToDelete.warehouseId;
            const qty = saleToDelete.quantity || 1;
            const returnedSeries = saleToDelete.selectedSeries || [];

            if (artId && whId) {
              const invId = `${whId}_${artId}`;
              const invRef = doc(db, 'warehouse_inventory', invId);
              const invSnap = await getDoc(invRef);
              if (invSnap.exists()) {
                const curStock = (invSnap.data().stock ?? invSnap.data().quantity) || 0;
                const curSeries: string[] = Array.isArray(invSnap.data().seriesList) ? invSnap.data().seriesList : [];
                const mergedSeries = Array.from(new Set([...curSeries, ...returnedSeries]));
                await updateDoc(invRef, {
                  stock: curStock + qty,
                  quantity: curStock + qty,
                  seriesList: mergedSeries,
                  updatedAt: new Date().toISOString()
                });
              }
            }

            if (artId) {
              const artRef = doc(db, 'articles', artId);
              const artSnap = await getDoc(artRef);
              if (artSnap.exists()) {
                const curStock = Number(artSnap.data().quantity) || 0;
                const curSeries: string[] = Array.isArray(artSnap.data().seriesList) ? artSnap.data().seriesList : [];
                const mergedSeries = Array.from(new Set([...curSeries, ...returnedSeries]));
                await updateDoc(artRef, {
                  quantity: curStock + qty,
                  seriesList: mergedSeries,
                  updatedAt: new Date().toISOString()
                });
              }

              await addDoc(collection(db, 'inventory_movements'), {
                articleId: artId,
                warehouseId: whId || '',
                type: 'IN',
                quantity: qty,
                reference: `Reversión por anulación Venta Contado (${saleToDelete.clientName || 'Consumidor Final'})`,
                seriesList: returnedSeries,
                date: new Date().toISOString().split('T')[0],
                enterpriseId: targetEnterpriseId,
                userId: targetEnterpriseId,
                createdBy: user?.uid || '',
                createdAt: new Date().toISOString()
              });
            }
          } catch (invErr) {
            console.warn('No se pudo revertir el inventario de la venta contado:', invErr);
          }
        }

        await deleteDoc(doc(db, 'sales', id));
        await logAudit(AuditAction.SALE_UPDATE, `Venta eliminada para cliente: ${saleToDelete?.clientName || 'Sin Nombre'}, Artículo: ${saleToDelete?.article}, Valor: $${saleToDelete?.totalValue}`, id);
        fetchData();
        showToast('Venta eliminada exitosamente y stock/cupo reincorporado', 'success');
      } catch (err: any) {
        console.error('Error deleting sale:', err);
        setError('Error al eliminar registro');
        showToast('Error al eliminar registro', 'error');
      }
    }
  };

  const handleSaveClient = async (clientData: Partial<Client>) => {
    try {
      const now = Timestamp.now();
      const docRef = await addDoc(collection(db, 'clients'), {
        ...clientData,
        enterpriseId: currentEnterpriseId,
        creditUsed: 0,
        createdAt: now,
        updatedAt: now
      });
      await logAudit(
        AuditAction.SALE_CREATE,
        `Cliente registrado desde Ventas: ${clientData.lastName} ${clientData.firstName} (${clientData.idCard})`,
        docRef.id
      );
      showToast('Cliente guardado exitosamente', 'success');
      setIsClientModalOpen(false);
      fetchData();
    } catch (err: any) {
      console.error('Error saving client:', err);
      showToast('Error al guardar cliente', 'error');
    }
  };

  const getEmployeeName = (id: string) => {
    const emp = employees.find(e => e.id === id);
    return emp ? `${emp.name} ${emp.lastName}` : 'Desconocido';
  };

  const [currentMonth, setCurrentMonth] = useState(format(new Date(), 'yyyy-MM'));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50 flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-indigo-500" />
            Ventas
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm mt-1">Gestión centralizada de ventas con el cliente como eje central</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-white dark:bg-neutral-900 p-1.5 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
            <button 
              onClick={() => setCurrentMonth(format(new Date(new Date(currentMonth + '-15').setMonth(new Date(currentMonth + '-15').getMonth() - 1)), 'yyyy-MM'))}
              className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
            >
              &larr;
            </button>
            <div className="flex items-center gap-2 px-3 font-medium text-neutral-900 dark:text-neutral-100">
              <Calendar className="w-4 h-4 text-indigo-500" />
              <span className="capitalize">{format(new Date(currentMonth + '-15'), 'MMMM yyyy')}</span>
            </div>
            <button 
              onClick={() => setCurrentMonth(format(new Date(new Date(currentMonth + '-15').setMonth(new Date(currentMonth + '-15').getMonth() + 1)), 'yyyy-MM'))}
              className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
            >
              &rarr;
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsClientModalOpen(true)}
              className="bg-neutral-800 hover:bg-neutral-900 dark:bg-neutral-700 dark:hover:bg-neutral-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors shadow-sm cursor-pointer"
              title="Gestión de clientes: Búsqueda, edición y registro"
            >
              <Users className="w-4 h-4 text-indigo-400" />
              Clientes
            </button>
            <button
              onClick={() => setIsManualSaleModalOpen(true)}
              className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors shadow-sm cursor-pointer"
              title="Registrar venta manual / externa para cumplimiento presupuestario sin descontar stock de bodega"
            >
              <ShoppingBag className="w-4 h-4" />
              Ventas Manuales
            </button>
            <button
              onClick={() => setIsCreditSaleModalOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors shadow-sm cursor-pointer"
              title="Crear Venta a Crédito con amortización, cupo y pagaré legal"
            >
              <FileText className="w-4 h-4" />
              Nueva Venta a Crédito
            </button>
            <button
              onClick={() => setIsInventoryCashSaleModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors shadow-sm cursor-pointer"
              title="Crear Venta de Contado vinculada a inventario de bodega"
            >
              <Plus className="w-4 h-4" />
              Nueva Venta Contado
            </button>
          </div>
        </div>
      </div>

      {isSuperAdmin && (
        <div className="bg-amber-50/40 dark:bg-amber-950/10 border border-amber-100 dark:border-amber-900/20 p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center text-amber-600">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-black text-amber-900 dark:text-amber-100 uppercase tracking-wider">Filtro de Empresa (SuperAdmin)</h4>
              <p className="text-[10px] text-amber-600 dark:text-amber-400">Verifique las ventas registradas filtrando por empresa matriz.</p>
            </div>
          </div>
          <select
            value={selectedEnterpriseId}
            onChange={(e) => setSelectedEnterpriseId(e.target.value)}
            className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl p-3 text-xs outline-none focus:ring-2 focus:ring-amber-500 font-bold dark:text-neutral-100 min-w-[240px]"
          >
            <option value="">-- Ver todas las empresas --</option>
            {enterprises.map((ent) => (
              <option key={ent.id} value={ent.id}>
                {ent.name} ({ent.email})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Buscador Predictivo con Formato en Cascada */}
      {!loading && (
        <SalesPredictiveSearch
          sales={sales}
          employees={employees}
          onEditSale={handleOpenModal}
          onDeleteSale={handleDelete}
          onPayCredit={handleOpenPaymentModal}
          onOpenPromissoryNote={handleOpenPromissoryNote}
          onOpenCreditApplication={handleOpenCreditApplication}
          onOpenDocumentPrintCenter={handleOpenDocumentPrintCenter}
        />
      )}

      {loading && (
        <div className="flex items-center justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      )}

      {!loading && sales.length === 0 && (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-3xl p-8 text-center shadow-sm">
          <ShoppingCart className="w-10 h-10 text-neutral-300 dark:text-neutral-700 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-neutral-900 dark:text-white mb-1">No hay ventas registradas para este periodo</h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-md mx-auto">
            Utilice los botones superiores para registrar un Nuevo Cliente, Venta a Crédito, Venta de Contado o Venta Manual.
          </p>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white dark:bg-neutral-900 rounded-3xl w-full max-w-lg shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden animate-in zoom-in-95 duration-200 my-auto">
            <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-800">
              <h2 className="text-xl font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-indigo-500" />
                {editingSale ? 'Editar Venta' : 'Registrar Venta'}
              </h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-full text-neutral-400 hover:text-neutral-700 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">

              {isSuperAdmin && (
                <div className="p-4 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-xl space-y-2">
                  <label className="block text-xs font-black text-amber-900 dark:text-amber-100 uppercase tracking-wider pl-1">
                    Asignar Empresa (SuperAdmin)
                  </label>
                  <select
                    value={formEnterpriseId}
                    onChange={(e) => {
                      const newEntId = e.target.value;
                      setFormEnterpriseId(newEntId);
                      
                      // Auto-select the first employee of this new company to prevent mismatch
                      const validEmps = newEntId
                        ? employees.filter(emp => emp.enterpriseId === newEntId && (emp.role === 'vendedor' || emp.role === 'ambos'))
                        : employees.filter(emp => emp.role === 'vendedor' || emp.role === 'ambos');
                      setFormData(prev => ({ ...prev, employeeId: validEmps[0]?.id || '' }));
                    }}
                    className="w-full px-4 py-2 bg-white dark:bg-neutral-800 border border-amber-200 dark:border-neutral-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-amber-500 font-bold dark:text-white"
                  >
                    <option value="">-- Asignar al SuperAdmin --</option>
                    {enterprises.map((ent) => (
                      <option key={ent.id} value={ent.id}>
                        {ent.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1 flex items-center gap-1.5">
                  <User className="w-4 h-4 text-neutral-400" /> Nombre del Cliente
                </label>
                <input
                  type="text"
                  required
                  list="clients-list"
                  value={formData.clientName}
                  onChange={(e) => setFormData({...formData, clientName: e.target.value})}
                  className="w-full px-4 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-neutral-900 dark:text-white"
                  placeholder="Ej. Juan Pérez"
                />
                <datalist id="clients-list">
                  {uniqueClients.map(client => (
                    <option key={client} value={client} />
                  ))}
                </datalist>
              </div>


              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1 flex items-center gap-1.5">
                  <ShoppingCart className="w-4 h-4 text-neutral-400" /> Artículo Vendido
                </label>
                <input
                  type="text"
                  required
                  value={formData.article}
                  onChange={(e) => setFormData({...formData, article: e.target.value})}
                  className="w-full px-4 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-neutral-900 dark:text-white"
                  placeholder="Ej. Moto XYZ / Repuestos"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-neutral-400" /> Fecha
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                    className="w-full px-4 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-neutral-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1 flex items-center gap-1.5">
                    <DollarSign className="w-4 h-4 text-neutral-400" /> Tipo
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({...formData, type: e.target.value as 'contado' | 'credito'})}
                    className="w-full px-4 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-neutral-900 dark:text-white"
                  >
                    <option value="contado">Contado</option>
                    <option value="credito">Crédito</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1 flex items-center gap-1.5">
                  <User className="w-4 h-4 text-neutral-400" /> Vendedor
                </label>
                <select
                  required
                  value={formData.employeeId}
                  onChange={(e) => setFormData({...formData, employeeId: e.target.value})}
                  className="w-full px-4 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-neutral-900 dark:text-white"
                >
                  <option value="" disabled>Seleccione un vendedor...</option>
                  {employees
                    .filter(e => {
                      if (e.role !== 'vendedor' && e.role !== 'ambos') return false;
                      if (isSuperAdmin) {
                        return e.enterpriseId === formEnterpriseId;
                      }
                      return true;
                    })
                    .map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name} {emp.lastName}</option>
                    ))
                  }
                </select>
              </div>

              <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800/50 space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isMoto}
                    onChange={(e) => setFormData({...formData, isMoto: e.target.checked})}
                    className="w-5 h-5 text-indigo-600 rounded border-neutral-300 focus:ring-indigo-500"
                  />
                  <span className="font-medium text-neutral-900 dark:text-white flex items-center gap-2">
                    <Bike className="w-4 h-4 text-indigo-500" />
                    ¿La venta incluye una Moto?
                  </span>
                </label>
                
                {formData.isMoto && (
                  <div className="pl-8 flex gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="motoType"
                        value="combustion"
                        checked={formData.motoType === 'combustion'}
                        onChange={() => setFormData({...formData, motoType: 'combustion'})}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm text-neutral-700 dark:text-neutral-300">Combustión</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="motoType"
                        value="electrico"
                        checked={formData.motoType === 'electrico'}
                        onChange={() => setFormData({...formData, motoType: 'electrico'})}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm text-neutral-700 dark:text-neutral-300">Eléctrica</span>
                    </label>
                  </div>
                )}
                {formData.isMoto && (
                  <p className="text-xs text-indigo-600/80 dark:text-indigo-400/80 pl-8">
                    * El valor de las motos no sumará al cumplimiento de presupuesto en dinero, solo sumará en el indicador de unidades.
                  </p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1 flex items-center gap-1.5">
                  Valor Total {formData.isMoto ? '(Final de la moto)' : ''}
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500 font-medium">$</span>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={formData.totalValue}
                    onChange={(e) => setFormData({...formData, totalValue: e.target.value})}
                    className="w-full pl-8 pr-4 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-neutral-900 dark:text-white"
                    placeholder="0.00"
                  />
                </div>
              </div>
              
              <div className="pt-4 flex justify-end gap-3 border-t border-neutral-200 dark:border-neutral-800 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Guardar Venta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Nueva Venta Contado con Inventario */}
      <NewInventoryCashSaleModal
        isOpen={isInventoryCashSaleModalOpen}
        onClose={() => setIsInventoryCashSaleModalOpen(false)}
        employees={employees}
        currentEnterpriseId={currentEnterpriseId}
        initialWarehouses={warehouses}
        initialArticles={articles}
        initialInventories={warehouseInventories}
        initialClients={clients}
        onSuccess={() => {
          fetchData();
          showToast('Venta de contado registrada con éxito', 'success');
        }}
      />

      {/* Tramo 2: Modal de Nueva Venta a Crédito */}
      <NewCreditSaleModal
        isOpen={isCreditSaleModalOpen}
        onClose={() => setIsCreditSaleModalOpen(false)}
        onSave={handleSaveCreditSale}
        clients={clients}
        warehouses={warehouses}
        articles={articles}
        warehouseInventories={warehouseInventories}
        employees={employees}
      />

      {/* Modal de Ventas Manuales (Replicado desde Presupuestos) */}
      <NewManualSaleModal
        isOpen={isManualSaleModalOpen}
        onClose={() => setIsManualSaleModalOpen(false)}
        employees={employees}
        currentMonth={currentMonth}
        onSuccess={() => {
          fetchData();
          showToast('Venta manual registrada exitosamente', 'success');
        }}
      />

      {/* Tramo 2: Modal de Visualización e Impresión de Pagaré a la Orden */}
      <PromissoryNoteModal
        isOpen={isPromissoryModalOpen}
        onClose={() => {
          setIsPromissoryModalOpen(false);
          setPromissoryNoteSale(null);
        }}
        creditSale={promissoryNoteSale}
        enterpriseName={
          enterprises.find(e => e.id === currentEnterpriseId)?.name ||
          profile?.name ||
          'Mi Empresa'
        }
        onOpenCreditApplication={() => {
          setIsPromissoryModalOpen(false);
          setIsCreditApplicationModalOpen(true);
        }}
      />

      {/* Modal de Impresión de Solicitud de Crédito en 1 Hoja */}
      <CreditApplicationPrintModal
        isOpen={isCreditApplicationModalOpen}
        onClose={() => {
          setIsCreditApplicationModalOpen(false);
          setCreditApplicationData(null);
        }}
        data={creditApplicationData}
        companyName={
          enterprises.find(e => e.id === currentEnterpriseId)?.name ||
          profile?.name ||
          'Mi Empresa'
        }
        companyRuc={profile?.ruc || '1790012345001'}
        companyAddress={profile?.address || 'Ecuador'}
        companyPhone={profile?.phone || '0999999999'}
      />

      {/* Modal Flotante: Centro de Impresión Unificado (Solicitudes, Pagarés, Contratos y Notas de Venta) */}
      <DocumentPrintCenterModal
        isOpen={isPrintCenterModalOpen}
        onClose={() => {
          setIsPrintCenterModalOpen(false);
          setPrintCenterSale(null);
          setPrintCenterCreditDetails(null);
          setPrintCenterClientDetails(null);
        }}
        sale={printCenterSale ? {
          id: printCenterSale.id,
          date: printCenterSale.date,
          type: printCenterSale.type,
          clientName: printCenterSale.clientName,
          article: printCenterSale.article,
          totalValue: printCenterSale.totalValue,
          employeeName: getEmployeeName(printCenterSale.employeeId),
          promissoryNoteNumber: printCenterCreditDetails?.promissoryNoteNumber,
          creditSaleId: printCenterSale.creditSaleId
        } : null}
        creditSaleDetails={printCenterCreditDetails}
        clientDetails={printCenterClientDetails}
        companyName={
          enterprises.find(e => e.id === currentEnterpriseId)?.name ||
          profile?.name ||
          'Mi Empresa Comercial'
        }
        companyRuc={profile?.ruc || '1790012345001'}
        companyAddress={profile?.address || 'Ecuador'}
        companyPhone={profile?.phone || '0999999999'}
      />

      {/* Tramo 3: Modal de Registro de Cobro de Cuota / Abono */}
      <RecordCreditPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => {
          setIsPaymentModalOpen(false);
          setActiveCreditSaleForPayment(null);
        }}
        creditSale={activeCreditSaleForPayment}
        onPaymentSuccess={handlePaymentSuccess}
        employees={employees}
      />

      {/* Tramo 3: Modal de Comprobante Oficial de Cobro (Ticket 80mm & A4) */}
      <CreditPaymentReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => {
          setIsReceiptModalOpen(false);
          setLastGeneratedPayment(null);
        }}
        payment={lastGeneratedPayment}
        enterpriseName={
          enterprises.find(e => e.id === currentEnterpriseId)?.name ||
          profile?.name ||
          'Mi Empresa Comercial'
        }
        enterpriseRuc={profile?.ruc || '1790012345001'}
        enterprisePhone={profile?.phone || '0991234567'}
        enterpriseAddress={profile?.address || 'Matriz Comercial'}
      />

      {/* Modal de Gestión de Clientes (Búsqueda y Registro) */}
      <ClientManagementModal
        isOpen={isClientModalOpen}
        onClose={() => setIsClientModalOpen(false)}
        onSave={handleSaveClient}
        clients={clients}
      />
    
    </div>
  );
}