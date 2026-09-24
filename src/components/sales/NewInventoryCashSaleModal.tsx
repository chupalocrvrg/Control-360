import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../firebase';
import { collection, getDocs, query, where, runTransaction, doc } from 'firebase/firestore';
import { X, User, DollarSign, Save, Package, Store, Hash, Check, Search, Printer, FileText } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { logAudit, AuditAction } from '../../lib/audit';
import { format } from 'date-fns';
import { Warehouse, Article, WarehouseInventory } from '../../types/inventory';
import { Client } from '../../types/client';
import { ManageArticleSeriesModal } from '../inventory/ManageArticleSeriesModal';
import { CashSaleLetterPrintModal, CashSaleLetterData } from './CashSaleLetterPrintModal';
import { fetchInventoryCollection } from '../../lib/inventory-db';

interface Employee {
  name: string;
  lastName: string;
  role: string;
  id: string;
}

interface NewInventoryCashSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  currentEnterpriseId: string;
  onSuccess: () => void;
  initialWarehouses?: Warehouse[];
  initialArticles?: Article[];
  initialInventories?: WarehouseInventory[];
  initialClients?: Client[];
}

export function NewInventoryCashSaleModal({
  isOpen,
  onClose,
  employees,
  currentEnterpriseId,
  onSuccess,
  initialWarehouses,
  initialArticles,
  initialInventories,
  initialClients
}: NewInventoryCashSaleModalProps) {
  const { user, profile } = useAuth();
  const { showToast } = useNotification();

  // Estados de carga de datos
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [warehouses, setWarehouses] = useState<Warehouse[]>(initialWarehouses || []);
  const [articles, setArticles] = useState<Article[]>(initialArticles || []);
  const [inventories, setInventories] = useState<WarehouseInventory[]>(initialInventories || []);
  const [clients, setClients] = useState<Client[]>(initialClients || []);

  // Form states
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [selectedArticleId, setSelectedArticleId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState('');
  const [discountType, setDiscountType] = useState<'VALUE' | 'PERCENT'>('VALUE');
  const [discountValue, setDiscountValue] = useState<string>('');
  const [totalValue, setTotalValue] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientIdCard, setClientIdCard] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [clientCity, setClientCity] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [employeeId, setEmployeeId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSeriesModalOpen, setIsSeriesModalOpen] = useState(false);
  const [selectedSeries, setSelectedSeries] = useState<string[]>([]);

  // Smart Search States
  const [articleSearchTerm, setArticleSearchTerm] = useState('');
  const [isArticleDropdownOpen, setIsArticleDropdownOpen] = useState(false);
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);

  // Carta de Venta Modal State
  const [createdLetterData, setCreatedLetterData] = useState<CashSaleLetterData | null>(null);
  const [isLetterModalOpen, setIsLetterModalOpen] = useState(false);

  // Optimized Data Loading
  useEffect(() => {
    if (isOpen && currentEnterpriseId) {
      if (initialWarehouses && initialArticles && initialInventories && initialClients) {
        setWarehouses(initialWarehouses);
        setArticles(initialArticles);
        setInventories(initialInventories.map(i => ({ ...i, stock: (i.stock ?? i.quantity) || 0 })));
        setClients(initialClients);
        if (initialWarehouses.length > 0 && !selectedWarehouseId) {
          setSelectedWarehouseId(initialWarehouses[0].id);
        }
        const sellers = employees.filter(e => ['vendedor', 'ambos', 'supervisor_ventas', 'supervisor_general'].includes(e.role));
        if (sellers.length > 0 && !employeeId) {
          setEmployeeId(sellers[0].id);
        }
        setLoadingInitial(false);
        return; // Prevents slow background double fetch
      }

      setLoadingInitial(true);
      const loadData = async () => {
        try {
          const [whList, artList, invList, clSnap] = await Promise.all([
            fetchInventoryCollection<Warehouse>('warehouses', currentEnterpriseId, user?.uid, profile?.enterpriseId),
            fetchInventoryCollection<Article>('articles', currentEnterpriseId, user?.uid, profile?.enterpriseId),
            fetchInventoryCollection<WarehouseInventory>('warehouse_inventory', currentEnterpriseId, user?.uid, profile?.enterpriseId),
            getDocs(query(collection(db, 'clients'), where('enterpriseId', '==', currentEnterpriseId)))
          ]);

          const clList = clSnap.docs.map(d => ({ id: d.id, ...d.data() } as Client));
          const normalizedInvs = invList.map(i => ({
            ...i,
            stock: (i.stock ?? i.quantity) || 0
          }));

          setWarehouses(whList);
          setArticles(artList);
          setInventories(normalizedInvs);
          setClients(clList);

          if (whList.length > 0 && !selectedWarehouseId) {
            setSelectedWarehouseId(whList[0].id);
          }

          const sellers = employees.filter(e => ['vendedor', 'ambos', 'supervisor_ventas', 'supervisor_general'].includes(e.role));
          if (sellers.length > 0 && !employeeId) {
            setEmployeeId(sellers[0].id);
          }
        } catch (err) {
          console.error('Error loading inventory data for cash sale:', err);
          showToast('Error cargando inventarios y artículos', 'error');
        } finally {
          setLoadingInitial(false);
        }
      };
      loadData();
    }
  }, [isOpen, currentEnterpriseId]);

  // Selected Article & Stock
  const selectedArticle = articles.find(a => a.id === selectedArticleId);
  const selectedWarehouse = warehouses.find(w => w.id === selectedWarehouseId);

  const currentInvRecord = inventories.find(
    i => i.warehouseId === selectedWarehouseId && i.articleId === selectedArticleId
  );
  const currentStock = (currentInvRecord?.stock ?? currentInvRecord?.quantity ?? (warehouses.length <= 1 ? selectedArticle?.quantity : 0)) || 0;
  const availableSeries: string[] = (currentInvRecord?.seriesList && currentInvRecord.seriesList.length > 0)
    ? currentInvRecord.seriesList
    : (selectedArticle?.seriesList || []);

  useEffect(() => {
    setSelectedSeries([]);
    if (selectedArticle) {
      const price = (selectedArticle as any).cashPrice || (selectedArticle as any).price || (selectedArticle as any).costPrice || 0;
      if (price > 0) {
        setUnitPrice(price.toString());
        setTotalValue((price * quantity).toFixed(2));
      }
    }
  }, [selectedArticleId, selectedWarehouseId]);

  useEffect(() => {
    if (selectedSeries.length > quantity) {
      setSelectedSeries(prev => prev.slice(0, quantity));
    }
  }, [quantity]);

  useEffect(() => {
    const p = parseFloat(unitPrice) || 0;
    const sub = p * quantity;
    const disc = parseFloat(discountValue) || 0;
    let discAmount = 0;
    if (disc > 0) {
      discAmount = discountType === 'PERCENT' ? (sub * disc) / 100 : disc;
    }
    const finalVal = Math.max(0, sub - discAmount);
    setTotalValue(finalVal.toFixed(2));
  }, [quantity, unitPrice, discountType, discountValue]);

  // Article Search Filtering
  const filteredArticlesList = useMemo(() => {
    if (!articleSearchTerm.trim()) return articles.slice(0, 12);
    const term = articleSearchTerm.toLowerCase();
    return articles.filter(a =>
      a.name.toLowerCase().includes(term) ||
      (a.code || '').toLowerCase().includes(term) ||
      (a.brand || '').toLowerCase().includes(term) ||
      (a.category || '').toLowerCase().includes(term) ||
      (a.seriesList || []).some(s => s.toLowerCase().includes(term))
    ).slice(0, 15);
  }, [articles, articleSearchTerm]);

  // Client Search Filtering
  const filteredClientsList = useMemo(() => {
    if (!clientSearchTerm.trim()) return clients.slice(0, 8);
    const term = clientSearchTerm.toLowerCase();
    return clients.filter(c =>
      `${c.firstName} ${c.lastName}`.toLowerCase().includes(term) ||
      (c.idCard || '').toLowerCase().includes(term) ||
      (c.phone || '').toLowerCase().includes(term)
    ).slice(0, 10);
  }, [clients, clientSearchTerm]);

  const handleSelectClient = (c: Client) => {
    const fullName = `${c.lastName} ${c.firstName}`.trim();
    setClientName(fullName);
    setClientIdCard(c.idCard || '');
    setClientPhone(c.phone || '');
    setClientAddress(c.address || '');
    setClientCity(c.city || '');
    setClientSearchTerm(`${fullName} (CI: ${c.idCard || 'S/N'})`);
    setIsClientDropdownOpen(false);
  };

  const handleSelectArticle = (a: Article) => {
    setSelectedArticleId(a.id);
    setArticleSearchTerm(a.name);
    setIsArticleDropdownOpen(false);
  };

  if (!isOpen) return null;

  const sellers = employees.filter(e => ['vendedor', 'ambos', 'supervisor_ventas', 'supervisor_general'].includes(e.role));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedWarehouseId) {
      showToast('Seleccione la bodega de origen.', 'warning');
      return;
    }
    if (!selectedArticleId) {
      showToast('Seleccione el artículo a vender mediante el buscador inteligente.', 'warning');
      return;
    }
    if (!employeeId) {
      showToast('Seleccione el vendedor responsable.', 'warning');
      return;
    }
    if (quantity <= 0) {
      showToast('La cantidad debe ser mayor a 0.', 'warning');
      return;
    }
    if (quantity > currentStock) {
      showToast(`Stock insuficiente en bodega (${currentStock} disponible).`, 'error');
      return;
    }

    const finalTotal = parseFloat(totalValue) || 0;
    if (finalTotal <= 0) {
      showToast('El total de la venta debe ser mayor a 0.', 'warning');
      return;
    }

    try {
      setIsSubmitting(true);

      const invRecord = inventories.find(
        i => i.warehouseId === selectedWarehouseId && i.articleId === selectedArticleId
      );

      let createdSaleId = '';

      // Ejecutar transacción atómica en Firestore para descontar inventario y registrar la venta
      await runTransaction(db, async (transaction) => {
        const invId = invRecord ? invRecord.id : `${selectedWarehouseId}_${selectedArticleId}`;
        const invRef = doc(db, 'warehouse_inventory', invId);
        const invDoc = await transaction.get(invRef);

        const actualStock = invDoc.exists()
          ? ((invDoc.data().stock ?? invDoc.data().quantity) || 0)
          : (warehouses.length <= 1 ? (selectedArticle?.quantity || 0) : 0);

        if (actualStock < quantity) {
          throw new Error(`Stock insuficiente en bodega. Disponible: ${actualStock}, Solicitado: ${quantity}`);
        }

        // 1. Descontar stock y remover series vendidas de warehouse_inventory
        const invSeriesList: string[] = (invDoc.exists() && Array.isArray(invDoc.data().seriesList))
          ? invDoc.data().seriesList
          : (Array.isArray(selectedArticle?.seriesList) ? selectedArticle!.seriesList : []);
        const updatedInvSeries = invSeriesList.filter(s => !selectedSeries.includes(s));

        transaction.set(invRef, {
          id: invId,
          warehouseId: selectedWarehouseId,
          articleId: selectedArticleId,
          stock: Math.max(0, actualStock - quantity),
          quantity: Math.max(0, actualStock - quantity),
          seriesList: updatedInvSeries,
          userId: currentEnterpriseId,
          enterpriseId: currentEnterpriseId,
          updatedAt: new Date().toISOString()
        }, { merge: true });

        // 1b. Descontar stock y series en la colección global 'articles'
        const artRef = doc(db, 'articles', selectedArticleId);
        const artDoc = await transaction.get(artRef);
        if (artDoc.exists()) {
          const artCurrentStock = Number(artDoc.data().quantity) || 0;
          const artSeriesList: string[] = Array.isArray(artDoc.data().seriesList) ? artDoc.data().seriesList : [];
          const updatedArtSeries = artSeriesList.filter(s => !selectedSeries.includes(s));
          transaction.update(artRef, {
            quantity: Math.max(0, artCurrentStock - quantity),
            seriesList: updatedArtSeries,
            updatedAt: new Date().toISOString()
          });
        }

        // 2. Registrar movimiento de inventario (Kardex salida)
        const movementRef = doc(collection(db, 'inventory_movements'));
        transaction.set(movementRef, {
          articleId: selectedArticleId,
          articleName: selectedArticle?.name || 'Artículo',
          warehouseId: selectedWarehouseId,
          type: 'OUT',
          quantity: quantity,
          reference: `Venta Contado: ${clientName.trim() || 'Consumidor Final'}`,
          seriesList: selectedSeries,
          date: date,
          enterpriseId: currentEnterpriseId,
          userId: currentEnterpriseId,
          createdBy: user?.uid || '',
          createdAt: new Date().toISOString()
        });

        // 3. Registrar venta en 'sales'
        const isMotoCategory = selectedArticle?.category?.toLowerCase().includes('moto') || false;
        const motoType = isMotoCategory
          ? (selectedArticle?.name?.toLowerCase().includes('eléct') || selectedArticle?.name?.toLowerCase().includes('elect') ? 'electrico' : 'combustion')
          : null;

        const disc = parseFloat(discountValue) || 0;
        let discAmount = 0;
        const sub = (parseFloat(unitPrice) || 0) * quantity;
        if (disc > 0) {
          discAmount = discountType === 'PERCENT' ? (sub * disc) / 100 : disc;
        }

        const saleRef = doc(collection(db, 'sales'));
        createdSaleId = saleRef.id;

        transaction.set(saleRef, {
          date,
          type: 'contado',
          employeeId,
          isMoto: isMotoCategory,
          motoType,
          clientName: clientName.trim() || 'Consumidor Final',
          clientIdCard: clientIdCard.trim() || '',
          clientPhone: clientPhone.trim() || '',
          clientAddress: clientAddress.trim() || '',
          clientCity: clientCity.trim() || '',
          article: selectedArticle?.name || 'Artículo',
          articleId: selectedArticleId,
          warehouseId: selectedWarehouseId,
          quantity,
          selectedSeries: selectedSeries,
          requiresSeries: !!selectedArticle?.requiresSeries,
          unitPrice: parseFloat(unitPrice) || 0,
          grossSubtotal: sub,
          discountType: disc > 0 ? discountType : null,
          discountValue: disc,
          discountAmount: discAmount,
          totalValue: finalTotal,
          enterpriseId: currentEnterpriseId,
          userId: currentEnterpriseId,
          createdBy: user?.uid || '',
          isManual: false,
          deductedFromStock: true,
          createdAt: new Date().toISOString()
        });
      });

      const assignedEmp = employees.find(e => e.id === employeeId);
      const sellerLabel = assignedEmp ? `${assignedEmp.name} ${assignedEmp.lastName}` : 'Vendedor';

      await logAudit(
        AuditAction.SALE_CREATE,
        `Venta Contado con descuento de stock directo. Producto: ${selectedArticle?.name} (Cant: ${quantity}) de bodega ${selectedWarehouse?.name}. Vendedor: ${sellerLabel}, Total: $${finalTotal}`,
        selectedArticleId
      );

      const isMotoCategory = selectedArticle?.category?.toLowerCase().includes('moto') || false;
      const disc = parseFloat(discountValue) || 0;
      const sub = (parseFloat(unitPrice) || 0) * quantity;
      let discAmount = 0;
      if (disc > 0) {
        discAmount = discountType === 'PERCENT' ? (sub * disc) / 100 : disc;
      }

      // Prepare Carta de Venta Data
      const letterData: CashSaleLetterData = {
        saleId: createdSaleId || Date.now().toString(),
        saleDate: date,
        clientName: clientName.trim() || 'Consumidor Final',
        clientIdCard: clientIdCard.trim() || '1111111111',
        clientPhone: clientPhone.trim() || '',
        clientAddress: clientAddress.trim() || '',
        clientCity: clientCity.trim() || 'Ecuador',
        sellerName: sellerLabel,
        warehouseName: selectedWarehouse?.name || 'Almacén Principal',
        articleName: selectedArticle?.name || 'Artículo',
        articleCode: selectedArticle?.code,
        brand: selectedArticle?.brand,
        model: selectedArticle?.model,
        seriesList: selectedSeries,
        quantity,
        unitPrice: parseFloat(unitPrice) || 0,
        subtotal: sub,
        discountType: disc > 0 ? discountType : undefined,
        discountAmount: discAmount,
        totalAmount: finalTotal,
        isMoto: isMotoCategory,
        motoDetails: isMotoCategory ? {
          chassis: selectedSeries[0] || (selectedArticle as any)?.chassis || '',
          engine: selectedSeries[1] || (selectedArticle as any)?.engine || '',
          color: (selectedArticle as any)?.color || '',
          year: (selectedArticle as any)?.year || ''
        } : undefined
      };

      showToast('Venta de contado registrada y stock descontado exitosamente', 'success');
      onSuccess();
      setCreatedLetterData(letterData);
      setIsLetterModalOpen(true);
    } catch (err: any) {
      console.error('Error executing inventory cash sale:', err);
      showToast('Error al registrar venta con inventario: ' + (err?.message || 'Error desconocido'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
        <div className="bg-white dark:bg-neutral-900 rounded-3xl p-6 sm:p-8 w-full max-w-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto">
          
          {/* Header */}
          <div className="flex justify-between items-start pb-4 mb-4 border-b border-neutral-100 dark:border-neutral-800">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                  Inventario Vinculado
                </span>
                <span className="text-xs text-neutral-400 font-medium">Descuenta Stock Directo + Carta de Venta</span>
              </div>
              <h2 className="text-xl font-black text-neutral-900 dark:text-white mt-1 flex items-center gap-2">
                <Package className="w-5 h-5 text-indigo-600" />
                Nueva Venta Contado de Almacén
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                Buscador inteligente de artículos, consulta de stock y emisión de comprobante.
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

          {loadingInitial ? (
            <div className="py-12 text-center text-neutral-400">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-2"></div>
              <span className="text-xs font-bold uppercase tracking-wider">Cargando bodegas y stock...</span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Bodega y Buscador Inteligente de Artículo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-1.5 flex items-center gap-1.5">
                    <Store className="w-3.5 h-3.5 text-indigo-500" />
                    Bodega Origen
                  </label>
                  <select
                    required
                    value={selectedWarehouseId}
                    onChange={(e) => setSelectedWarehouseId(e.target.value)}
                    className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-bold text-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- Seleccionar Bodega --</option>
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>
                        {w.name} {w.code ? `(${w.code})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Smart Article Predictive Search Input */}
                <div className="relative">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 flex items-center gap-1.5">
                      <Search className="w-3.5 h-3.5 text-indigo-500" />
                      Buscador Inteligente de Producto
                    </label>
                    {selectedArticleId && (
                      <button
                        type="button"
                        onClick={() => setIsSeriesModalOpen(true)}
                        className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 flex items-center gap-1 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-lg border border-amber-200 dark:border-amber-800 transition-colors cursor-pointer"
                        title="Ingresar o consultar números de serie"
                      >
                        <Hash className="w-3 h-3" />
                        <span>Series ({selectedArticle?.seriesList?.length || 0})</span>
                      </button>
                    )}
                  </div>

                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Escriba nombre, código o marca..."
                      value={articleSearchTerm}
                      onFocus={() => setIsArticleDropdownOpen(true)}
                      onChange={(e) => {
                        setArticleSearchTerm(e.target.value);
                        setIsArticleDropdownOpen(true);
                        if (!e.target.value) setSelectedArticleId('');
                      }}
                      className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-bold text-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <Search className="w-4 h-4 text-neutral-400 absolute right-3 top-3 pointer-events-none" />
                  </div>

                  {/* Dropdown Menu */}
                  {isArticleDropdownOpen && (
                    <div className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl shadow-xl max-h-56 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-700">
                      {filteredArticlesList.length > 0 ? (
                        filteredArticlesList.map(a => {
                          const aInv = inventories.find(i => i.warehouseId === selectedWarehouseId && i.articleId === a.id);
                          const stk = (aInv?.stock ?? aInv?.quantity ?? a.quantity) || 0;
                          return (
                            <div
                              key={a.id}
                              onClick={() => handleSelectArticle(a)}
                              className="p-3 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 cursor-pointer flex items-center justify-between transition-colors"
                            >
                              <div>
                                <div className="font-bold text-xs text-neutral-900 dark:text-white">{a.name}</div>
                                <div className="text-[10px] text-neutral-400 flex items-center gap-2 mt-0.5">
                                  <span>Cód: {a.code || 'N/A'}</span>
                                  <span>•</span>
                                  <span>Marca: {a.brand || 'Genérica'}</span>
                                </div>
                              </div>
                              <div className="text-right">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  stk > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                }`}>
                                  Stock: {stk}
                                </span>
                                <div className="text-xs font-black text-indigo-600 dark:text-indigo-400 mt-0.5">
                                  ${((a as any).cashPrice || a.price || 0).toFixed(2)}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="p-4 text-xs text-center text-neutral-400 italic">
                          No se encontraron artículos con "{articleSearchTerm}"
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Badge de Stock Disponible */}
              {selectedWarehouseId && selectedArticleId && (
                <div className={`p-3 rounded-xl flex items-center justify-between text-xs font-bold ${
                  currentStock > 0 
                    ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50' 
                    : 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50'
                }`}>
                  <span>Stock Disponible en {selectedWarehouse?.name}:</span>
                  <span className="text-sm font-black">{currentStock} unidades</span>
                </div>
              )}

              {/* Cantidad y Precio Unitario */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-1.5 flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5 text-indigo-500" />
                    Cantidad a Vender
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={currentStock || 1}
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-black text-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-1.5 flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-indigo-500" />
                    Precio Unitario ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                    className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-black text-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Control y Selección de Series */}
              {(selectedArticle?.requiresSeries || availableSeries.length > 0) && (
                <div className="p-4 bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Hash className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      <span className="text-xs font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wider">
                        Selección de Series a Vender ({selectedSeries.length} de {quantity})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {availableSeries.length > 0 && quantity > 1 && (
                        <button
                          type="button"
                          onClick={() => setSelectedSeries(availableSeries.slice(0, quantity))}
                          className="text-[10px] font-bold text-amber-700 dark:text-amber-300 hover:underline cursor-pointer"
                        >
                          Auto-seleccionar {Math.min(quantity, availableSeries.length)}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setIsSeriesModalOpen(true)}
                        className="text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/60 px-2 py-0.5 rounded-lg border border-amber-300 dark:border-amber-700 transition-colors cursor-pointer hover:bg-amber-200"
                      >
                        + Gestionar Series
                      </button>
                    </div>
                  </div>

                  {availableSeries.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-[11px] text-neutral-600 dark:text-neutral-400">
                        Haga clic en las series que se entregarán en esta venta:
                      </p>
                      <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2.5 bg-white/70 dark:bg-neutral-800/60 rounded-xl border border-amber-200/80 dark:border-amber-800/40">
                        {availableSeries.map((s) => {
                          const isSelected = selectedSeries.includes(s);
                          return (
                            <button
                              key={s}
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedSeries(prev => prev.filter(item => item !== s));
                                } else {
                                  if (selectedSeries.length >= quantity) {
                                    showToast(`Ya ha seleccionado las ${quantity} serie(s) correspondientes a la venta.`, 'info');
                                    return;
                                  }
                                  setSelectedSeries(prev => [...prev, s]);
                                }
                              }}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer border ${
                                isSelected
                                  ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm'
                                  : 'bg-neutral-50 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border-neutral-300 dark:border-neutral-700 hover:border-indigo-400'
                              }`}
                            >
                              {isSelected && <Check className="w-3 h-3" />}
                              <span>{s}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-white/60 dark:bg-neutral-900/40 border border-amber-200 dark:border-amber-800/50 rounded-xl text-xs text-amber-800 dark:text-amber-300">
                      <p className="font-semibold">Sin series registradas en bodega:</p>
                      <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
                        Este producto está configurado para control de series, pero no tiene series ingresadas en bodega. Puede proceder con la venta y registrarlas después.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Descuento (Valor o Porcentaje) */}
              <div className="p-3 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700/60 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                    Descuento en Venta
                  </span>
                  <div className="flex rounded-lg overflow-hidden border border-neutral-300 dark:border-neutral-600 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setDiscountType('VALUE')}
                      className={`px-2 py-0.5 transition-colors ${discountType === 'VALUE' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300'}`}
                    >
                      $ Fijo
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscountType('PERCENT')}
                      className={`px-2 py-0.5 transition-colors ${discountType === 'PERCENT' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300'}`}
                    >
                      % Porc.
                    </button>
                  </div>
                </div>
                <div className="relative">
                  {discountType === 'VALUE' && (
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-neutral-400">$</span>
                  )}
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={discountType === 'PERCENT' ? 100 : (parseFloat(unitPrice) || 0) * quantity}
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    placeholder={discountType === 'PERCENT' ? 'Ej. 10 (%)' : 'Ej. 5.00 ($)'}
                    className={`w-full py-2 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs font-bold text-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 ${discountType === 'VALUE' ? 'pl-7 pr-3' : 'px-3'}`}
                  />
                </div>
              </div>

              {/* Total Calculado */}
              <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200 block uppercase tracking-wider">
                    Total de la Venta
                  </span>
                  <span className="text-[11px] text-indigo-600 dark:text-indigo-400">
                    {quantity} x ${parseFloat(unitPrice || '0').toFixed(2)}
                    {parseFloat(discountValue) > 0 && (
                      <span className="text-rose-500 font-bold ml-1">
                        (-{discountType === 'PERCENT' ? `${discountValue}%` : `$${parseFloat(discountValue).toFixed(2)}`})
                      </span>
                    )}
                  </span>
                </div>
                <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                  ${totalValue}
                </span>
              </div>

              {/* Smart Client Predictive Search / Reusable Data */}
              <div className="relative">
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-1.5 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-indigo-500" />
                  Cliente (Búsqueda de registrados Crédito/Contado o 'Consumidor Final')
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={clientSearchTerm || clientName}
                    onFocus={() => setIsClientDropdownOpen(true)}
                    onChange={(e) => {
                      setClientSearchTerm(e.target.value);
                      setClientName(e.target.value);
                      setIsClientDropdownOpen(true);
                    }}
                    className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-medium text-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Escriba nombre o cédula del cliente..."
                  />
                  <Search className="w-4 h-4 text-neutral-400 absolute right-3 top-3 pointer-events-none" />
                </div>

                {/* Client Dropdown List */}
                {isClientDropdownOpen && (
                  <div className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl shadow-xl max-h-48 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-700">
                    <div
                      onClick={() => {
                        setClientName('Consumidor Final');
                        setClientIdCard('1111111111');
                        setClientPhone('0999999999');
                        setClientAddress('Almacén');
                        setClientCity('Ecuador');
                        setClientSearchTerm('Consumidor Final');
                        setIsClientDropdownOpen(false);
                      }}
                      className="p-3 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 cursor-pointer text-xs font-bold text-indigo-600 dark:text-indigo-400"
                    >
                      ⚡ Usar "Consumidor Final" (Venta rápida sin datos)
                    </div>
                    {filteredClientsList.map(c => (
                      <div
                        key={c.id}
                        onClick={() => handleSelectClient(c)}
                        className="p-3 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 cursor-pointer flex items-center justify-between text-xs transition-colors"
                      >
                        <div>
                          <div className="font-bold text-neutral-900 dark:text-white">{c.lastName} {c.firstName}</div>
                          <div className="text-[10px] text-neutral-400">CI: {c.idCard} • {c.phone}</div>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-neutral-100 text-neutral-700">
                          {c.clientType}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Vendedor y Fecha */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-1.5">
                    Vendedor
                  </label>
                  <select
                    required
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-bold text-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- Seleccionar Vendedor --</option>
                    {sellers.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} {emp.lastName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-1.5">
                    Fecha
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-medium text-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Botones */}
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
                  disabled={isSubmitting || currentStock <= 0}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Descontando e Ingresando...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Guardar y Generar Carta de Venta</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          )}

        </div>

        {/* Modal para ingresar series en tiempo real */}
        {selectedArticle && (
          <ManageArticleSeriesModal
            isOpen={isSeriesModalOpen}
            onClose={() => setIsSeriesModalOpen(false)}
            articleId={selectedArticle.id}
            articleName={selectedArticle.name}
            currentSeries={availableSeries}
            warehouseId={selectedWarehouseId}
            globalStock={selectedArticle.quantity || 0}
            onSuccess={(updated) => {
              setArticles(prev => prev.map(a => a.id === selectedArticle.id ? { ...a, seriesList: updated } : a));
              setInventories(prev => {
                const exists = prev.some(i => i.warehouseId === selectedWarehouseId && i.articleId === selectedArticle.id);
                if (exists) {
                  return prev.map(i => (i.warehouseId === selectedWarehouseId && i.articleId === selectedArticle.id) ? { ...i, seriesList: updated } : i);
                }
                return [...prev, {
                  id: `${selectedWarehouseId}_${selectedArticle.id}`,
                  warehouseId: selectedWarehouseId,
                  articleId: selectedArticle.id,
                  stock: selectedArticle.quantity || 0,
                  quantity: selectedArticle.quantity || 0,
                  seriesList: updated,
                  userId: currentEnterpriseId
                }];
              });
            }}
          />
        )}
      </div>

      {/* Cash Sale Letter Print Modal */}
      {isLetterModalOpen && createdLetterData && (
        <CashSaleLetterPrintModal
          isOpen={isLetterModalOpen}
          onClose={() => {
            setIsLetterModalOpen(false);
            onClose();
          }}
          data={createdLetterData}
        />
      )}
    </>
  );
}

