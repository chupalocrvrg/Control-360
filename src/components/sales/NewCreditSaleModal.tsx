import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  ShoppingCart, 
  User, 
  ShieldCheck, 
  CreditCard, 
  Calendar, 
  DollarSign, 
  Package, 
  Plus, 
  Trash2, 
  AlertTriangle, 
  CheckCircle2, 
  Sparkles,
  Percent,
  Clock,
  Building2,
  Info,
  Printer,
  Check,
  Hash,
  AlertCircle
} from 'lucide-react';
import { useNotification } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';
import { Client } from '../../types/client';
import { Warehouse, Article, WarehouseInventory } from '../../types/inventory';
import { 
  CreditSale, 
  CreditSaleItem, 
  CreditPaymentFrequency, 
  CreditInstallment, 
  EarlySettlementOption 
} from '../../types/creditSale';
import { CreditApplicationPrintModal } from './CreditApplicationPrintModal';
import { ManageArticleSeriesModal } from '../inventory/ManageArticleSeriesModal';
import { formatCurrency } from '../../lib/utils';
import { addDays, addWeeks, addMonths, format } from 'date-fns';

interface Employee {
  id: string;
  name: string;
  lastName: string;
  role: 'vendedor' | 'cobrador' | 'ambos';
  enterpriseId?: string;
}

interface NewCreditSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (saleData: Partial<CreditSale>) => Promise<void>;
  clients: Client[];
  warehouses: Warehouse[];
  articles: Article[];
  warehouseInventories: WarehouseInventory[];
  employees: Employee[];
}

export const NewCreditSaleModal: React.FC<NewCreditSaleModalProps> = ({
  isOpen,
  onClose,
  onSave,
  clients,
  warehouses,
  articles,
  warehouseInventories,
  employees
}) => {
  const { showToast } = useNotification();
  const { profile } = useAuth();

  // Client selection
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const selectedClient = useMemo(() => clients.find(c => c.id === selectedClientId) || null, [clients, selectedClientId]);

  // Seller selection
  const [selectedSellerId, setSelectedSellerId] = useState<string>('');
  const sellers = useMemo(() => employees.filter(e => e.role === 'vendedor' || e.role === 'ambos'), [employees]);

  // Articles in the sale
  const [saleItems, setSaleItems] = useState<CreditSaleItem[]>([]);

  // Down Payment / Entrada en efectivo
  const [downPayment, setDownPayment] = useState<number>(0);

  // Amortization Parameters
  const [frequency, setFrequency] = useState<CreditPaymentFrequency>('MENSUAL');
  const [installmentsCount, setInstallmentsCount] = useState<number>(6); // Default 6 cuotas
  const [startDate, setStartDate] = useState<string>(format(addMonths(new Date(), 1), 'yyyy-MM-dd'));

  // General Discount in Sale (en valor $ o %)
  const [discountType, setDiscountType] = useState<'VALUE' | 'PERCENT'>('VALUE');
  const [discountValueInput, setDiscountValueInput] = useState<number>(0);

  // Early settlement options (descuentos por liquidación anticipada)
  const [enableEarlySettlement, setEnableEarlySettlement] = useState<boolean>(true);
  const [discountOption1, setDiscountOption1] = useState<{ months: number; type: 'PERCENT' | 'VALUE'; value: number }>({ months: 3, type: 'PERCENT', value: 15 });
  const [discountOption2, setDiscountOption2] = useState<{ months: number; type: 'PERCENT' | 'VALUE'; value: number }>({ months: 6, type: 'PERCENT', value: 10 });

  // Loading & error
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal para imprimir solicitud de crédito en 1 hoja
  const [isApplicationPrintOpen, setIsApplicationPrintOpen] = useState(false);

  // Modal para ingreso de series durante la venta a crédito
  const [seriesArticleTarget, setSeriesArticleTarget] = useState<{ id: string; name: string; series: string[]; warehouseId?: string } | null>(null);

  // Initialize seller default
  useEffect(() => {
    if (sellers.length > 0 && !selectedSellerId) {
      setSelectedSellerId(sellers[0].id);
    }
  }, [sellers, selectedSellerId]);

  // Calculations
  const grossSubtotal = useMemo(() => {
    return saleItems.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
  }, [saleItems]);

  const generalDiscountAmount = useMemo(() => {
    if (discountValueInput <= 0) return 0;
    if (discountType === 'PERCENT') {
      return Number(((grossSubtotal * discountValueInput) / 100).toFixed(2));
    }
    return Math.min(grossSubtotal, discountValueInput);
  }, [grossSubtotal, discountType, discountValueInput]);

  const grossTotal = useMemo(() => {
    return Math.max(0, Number((grossSubtotal - generalDiscountAmount).toFixed(2)));
  }, [grossSubtotal, generalDiscountAmount]);

  const netFinancedAmount = useMemo(() => {
    return Math.max(0, Number((grossTotal - downPayment).toFixed(2)));
  }, [grossTotal, downPayment]);

  const installmentAmount = useMemo(() => {
    if (installmentsCount <= 0 || netFinancedAmount <= 0) return 0;
    return Number((netFinancedAmount / installmentsCount).toFixed(2));
  }, [netFinancedAmount, installmentsCount]);

  // Available credit quota for client
  const clientAvailableCredit = useMemo(() => {
    if (!selectedClient) return 0;
    const limit = selectedClient.creditLimit || 0;
    const used = selectedClient.creditUsed || 0;
    return Math.max(0, limit - used);
  }, [selectedClient]);

  const exceedsCreditLimit = useMemo(() => {
    if (!selectedClient) return false;
    return netFinancedAmount > clientAvailableCredit;
  }, [selectedClient, netFinancedAmount, clientAvailableCredit]);

  // Dynamic Installments Schedule
  const calculatedInstallments = useMemo<CreditInstallment[]>(() => {
    if (installmentsCount <= 0 || netFinancedAmount <= 0) return [];

    const list: CreditInstallment[] = [];
    const baseDate = new Date(startDate || new Date());

    let accumulated = 0;
    for (let i = 1; i <= installmentsCount; i++) {
      let dueDateObj = new Date(baseDate);
      if (frequency === 'SEMANAL') {
        dueDateObj = addWeeks(baseDate, i - 1);
      } else if (frequency === 'QUINCENAL') {
        dueDateObj = addDays(baseDate, (i - 1) * 15);
      } else {
        dueDateObj = addMonths(baseDate, i - 1);
      }

      // Adjust last installment for rounding
      let amount = installmentAmount;
      if (i === installmentsCount) {
        amount = Number((netFinancedAmount - accumulated).toFixed(2));
      } else {
        accumulated += amount;
      }

      list.push({
        number: i,
        dueDate: format(dueDateObj, 'yyyy-MM-dd'),
        amount: Math.max(0, amount),
        status: 'PENDIENTE'
      });
    }

    return list;
  }, [installmentsCount, netFinancedAmount, installmentAmount, frequency, startDate]);

  // Dynamic Early Settlement Options (con soporte tanto de porcentaje % como de valor fijo $)
  const calculatedEarlySettlements = useMemo<EarlySettlementOption[]>(() => {
    if (!enableEarlySettlement || netFinancedAmount <= 0) return [];

    const options: EarlySettlementOption[] = [];

    if (discountOption1.months > 0 && discountOption1.value > 0) {
      const discountValue = discountOption1.type === 'PERCENT'
        ? (netFinancedAmount * discountOption1.value) / 100
        : Math.min(netFinancedAmount, discountOption1.value);
      const discountPct = discountOption1.type === 'PERCENT'
        ? discountOption1.value
        : Number(((discountValue / netFinancedAmount) * 100).toFixed(1));

      options.push({
        targetMonths: discountOption1.months,
        discountPercentage: discountPct,
        settlementAmount: Number((netFinancedAmount - discountValue).toFixed(2)),
        description: `Liquidación antes de ${discountOption1.months} meses (${discountOption1.type === 'PERCENT' ? `${discountOption1.value}%` : `$${discountOption1.value.toFixed(2)}`} desc.)`
      });
    }

    if (discountOption2.months > 0 && discountOption2.value > 0) {
      const discountValue = discountOption2.type === 'PERCENT'
        ? (netFinancedAmount * discountOption2.value) / 100
        : Math.min(netFinancedAmount, discountOption2.value);
      const discountPct = discountOption2.type === 'PERCENT'
        ? discountOption2.value
        : Number(((discountValue / netFinancedAmount) * 100).toFixed(1));

      options.push({
        targetMonths: discountOption2.months,
        discountPercentage: discountPct,
        settlementAmount: Number((netFinancedAmount - discountValue).toFixed(2)),
        description: `Liquidación antes de ${discountOption2.months} meses (${discountOption2.type === 'PERCENT' ? `${discountOption2.value}%` : `$${discountOption2.value.toFixed(2)}`} desc.)`
      });
    }

    return options;
  }, [enableEarlySettlement, netFinancedAmount, discountOption1, discountOption2]);

  // Add Item to Sale
  const handleAddItem = () => {
    if (articles.length === 0 || warehouses.length === 0) return;
    const firstArticle = articles[0];
    const firstWarehouse = warehouses[0];

    setSaleItems(prev => [
      ...prev,
      {
        articleId: firstArticle.id,
        articleName: firstArticle.name,
        quantity: 1,
        warehouseId: firstWarehouse.id,
        warehouseName: firstWarehouse.name,
        unitPrice: 100,
        totalPrice: 100,
        selectedSeries: []
      }
    ]);
  };

  const handleUpdateItem = (index: number, field: keyof CreditSaleItem, value: any) => {
    setSaleItems(prev => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };

      if (field === 'articleId') {
        const art = articles.find(a => a.id === value);
        if (art) item.articleName = art.name;
        item.selectedSeries = [];
      }
      if (field === 'warehouseId') {
        const wh = warehouses.find(w => w.id === value);
        if (wh) item.warehouseName = wh.name;
        item.selectedSeries = [];
      }
      if (field === 'quantity' || field === 'unitPrice') {
        const qty = field === 'quantity' ? Math.max(1, Number(value) || 1) : item.quantity;
        const price = field === 'unitPrice' ? Number(value) : item.unitPrice;
        item.totalPrice = Math.max(0, qty * price);
        if (field === 'quantity' && item.selectedSeries && item.selectedSeries.length > qty) {
          item.selectedSeries = item.selectedSeries.slice(0, qty);
        }
      }

      updated[index] = item;
      return updated;
    });
  };

  const handleToggleSeriesOnItem = (itemIndex: number, series: string, itemQty: number) => {
    setSaleItems(prev => {
      const updated = [...prev];
      const currentItem = { ...updated[itemIndex] };
      const currentSelected = Array.isArray(currentItem.selectedSeries) ? [...currentItem.selectedSeries] : [];

      if (currentSelected.includes(series)) {
        currentItem.selectedSeries = currentSelected.filter(s => s !== series);
      } else {
        if (currentSelected.length >= itemQty) {
          showToast(`Ya ha seleccionado las ${itemQty} serie(s) correspondientes a este producto.`, 'info');
          return prev;
        }
        currentItem.selectedSeries = [...currentSelected, series];
      }

      updated[itemIndex] = currentItem;
      return updated;
    });
  };

  const handleAutoSelectSeriesOnItem = (itemIndex: number, availableSeries: string[], itemQty: number) => {
    setSaleItems(prev => {
      const updated = [...prev];
      const currentItem = { ...updated[itemIndex] };
      currentItem.selectedSeries = availableSeries.slice(0, itemQty);
      updated[itemIndex] = currentItem;
      return updated;
    });
  };

  const handleRemoveItem = (index: number) => {
    setSaleItems(prev => prev.filter((_, i) => i !== index));
  };

  // Helper to get available stock of article in warehouse
  const getWarehouseStock = (warehouseId: string, articleId: string) => {
    const inv = warehouseInventories.find(i => i.warehouseId === warehouseId && i.articleId === articleId);
    return (inv?.stock ?? inv?.quantity) || 0;
  };

  const [seriesOverrides, setSeriesOverrides] = useState<Record<string, string[]>>({});

  // Helper to get series list of article in warehouse
  const getWarehouseSeries = (warehouseId: string, articleId: string) => {
    const overrideKey = `${warehouseId}_${articleId}`;
    if (seriesOverrides[overrideKey]) return seriesOverrides[overrideKey];
    if (seriesOverrides[articleId]) return seriesOverrides[articleId];

    const inv = warehouseInventories.find(i => i.warehouseId === warehouseId && i.articleId === articleId);
    if (inv?.seriesList && inv.seriesList.length > 0) return inv.seriesList;
    const art = articles.find(a => a.id === articleId);
    return art?.seriesList || [];
  };

  // Submit Handler
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedClient) {
      setError('Por favor selecciona un cliente para la venta a crédito.');
      return;
    }

    if (selectedClient.clientType !== 'CREDITO') {
      setError('El cliente seleccionado está registrado como tipo CONTADO. Debes asignarle categoría CRÉDITO en el catálogo de clientes.');
      return;
    }

    if (saleItems.length === 0) {
      setError('Debes agregar al menos un artículo a la venta.');
      return;
    }

    if (netFinancedAmount <= 0) {
      setError('El saldo a financiar debe ser mayor a cero.');
      return;
    }

    if (exceedsCreditLimit) {
      setError(`El saldo a financiar (${formatCurrency(netFinancedAmount)}) excede el cupo disponible del cliente (${formatCurrency(clientAvailableCredit)}).`);
      return;
    }

    const seller = employees.find(e => e.id === selectedSellerId);

    // Validate stocks and series
    for (const item of saleItems) {
      const art = articles.find(a => a.id === item.articleId);
      const availableStock = getWarehouseStock(item.warehouseId, item.articleId);
      
      if (item.quantity > availableStock) {
        setError(`Stock insuficiente en bodega "${item.warehouseName}" para el artículo "${item.articleName}". Stock disponible: ${availableStock}`);
        return;
      }

      // Serial validation: if article requires series, they must be selected
      if (art?.requiresSeries) {
        const selectedCount = (item.selectedSeries || []).length;
        if (selectedCount < item.quantity) {
          setError(`Debe seleccionar ${item.quantity} número(s) de serie para el artículo "${item.articleName}". Solo ha seleccionado ${selectedCount}.`);
          return;
        }
      }
    }

    try {
      setSaving(true);
      const promissoryNumber = `PAG-${format(new Date(), 'yyyy')}-${Math.floor(1000 + Math.random() * 9000)}`;

      await onSave({
        clientId: selectedClient.id,
        clientName: `${selectedClient.lastName} ${selectedClient.firstName}`.trim(),
        clientIdCard: selectedClient.idCard,
        clientPhone: selectedClient.phone,
        clientAddress: selectedClient.address,
        clientCity: selectedClient.city,

        guarantorClientId: selectedClient.guarantorClientId || '',
        guarantorName: selectedClient.guarantorName || '',
        guarantorIdCard: selectedClient.guarantorIdCard || '',
        guarantorPhone: selectedClient.guarantorPhone || '',

        sellerId: selectedSellerId,
        sellerName: seller ? `${seller.name} ${seller.lastName}` : 'Vendedor',

        items: saleItems,
        grossSubtotal,
        discountType,
        discountValue: discountValueInput,
        discountAmount: generalDiscountAmount,
        grossTotal,
        downPayment,
        netFinancedAmount,

        frequency,
        installmentsCount,
        installmentAmount,
        startDate,
        installments: calculatedInstallments,

        earlySettlementOptions: calculatedEarlySettlements,

        totalPaid: 0,
        remainingBalance: netFinancedAmount,
        status: 'ACTIVO',
        promissoryNoteNumber: promissoryNumber
      });

      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al procesar la venta a crédito.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-5xl bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl border border-neutral-200 dark:border-neutral-800 my-8 overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-950/40 dark:to-neutral-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-md shadow-indigo-500/20">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-neutral-900 dark:text-white">
                Nueva Venta a Crédito & Amortización
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Descuento directo de stock en bodega, verificación de cupo y generación de Pagaré
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-neutral-700 dark:hover:text-white hover:bg-white/50 dark:hover:bg-neutral-800 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleFormSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center gap-3 text-rose-700 dark:text-rose-300 text-xs font-medium">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: Client & Seller Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Client Picker */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-indigo-500" />
                Cliente Solicitante *
              </label>
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                required
                className="w-full px-3 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs font-medium text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">-- Seleccionar cliente --</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.lastName} {c.firstName} ({c.idCard}) - Tipo: {c.clientType}
                  </option>
                ))}
              </select>

              {/* Client Quota Preview Card */}
              {selectedClient && (
                <div className={`p-3 rounded-xl border text-xs space-y-1 ${
                  selectedClient.clientType === 'CREDITO'
                    ? exceedsCreditLimit
                      ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/50 text-rose-900 dark:text-rose-200'
                      : 'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800/50 text-indigo-900 dark:text-indigo-200'
                    : 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/50 text-amber-900 dark:text-amber-200'
                }`}>
                  <div className="flex justify-between items-center font-bold">
                    <span>Cupo Asignado: {formatCurrency(selectedClient.creditLimit || 0)}</span>
                    <span>Disponible: {formatCurrency(clientAvailableCredit)}</span>
                  </div>
                  {selectedClient.guarantorName && (
                    <div className="text-[11px] text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-500" />
                      Garante: {selectedClient.guarantorName} (CI: {selectedClient.guarantorIdCard})
                    </div>
                  )}
                  {exceedsCreditLimit && (
                    <div className="text-[11px] font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1 mt-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      ¡El saldo a financiar excede el cupo disponible!
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Seller Picker */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-indigo-500" />
                Vendedor Responsable *
              </label>
              <select
                value={selectedSellerId}
                onChange={(e) => setSelectedSellerId(e.target.value)}
                required
                className="w-full px-3 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs font-medium text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">-- Seleccionar vendedor --</option>
                {sellers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.lastName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Section 2: Items in the Sale (Artículos & Bodegas) */}
          <div className="space-y-3 pt-4 border-t border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 flex items-center gap-1.5">
                <Package className="w-4 h-4 text-indigo-500" />
                Artículos a Entregar desde Bodega ({saleItems.length})
              </h3>
              <button
                type="button"
                onClick={handleAddItem}
                className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Agregar Artículo
              </button>
            </div>

            {saleItems.length === 0 ? (
              <div className="p-8 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl text-center space-y-2">
                <Package className="w-8 h-8 text-neutral-400 mx-auto" />
                <p className="text-xs text-neutral-500 font-medium">No hay artículos agregados aún.</p>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold shadow cursor-pointer"
                >
                  Agregar primer artículo
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {saleItems.map((item, idx) => {
                  const stock = getWarehouseStock(item.warehouseId, item.articleId);
                  const availableSeries = getWarehouseSeries(item.warehouseId, item.articleId);

                  return (
                    <div 
                      key={idx} 
                      className="p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-2xl border border-neutral-200 dark:border-neutral-700/80 space-y-3"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                        {/* Artículo */}
                        <div className="sm:col-span-4 space-y-1">
                          <label className="text-[11px] font-bold text-neutral-500">Artículo</label>
                          <select
                            value={item.articleId}
                            onChange={(e) => handleUpdateItem(idx, 'articleId', e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs font-medium text-neutral-900 dark:text-white"
                          >
                            {articles.map((art) => (
                              <option key={art.id} value={art.id}>
                                {art.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Bodega */}
                        <div className="sm:col-span-3 space-y-1">
                          <label className="text-[11px] font-bold text-neutral-500">Bodega de Salida</label>
                          <select
                            value={item.warehouseId}
                            onChange={(e) => handleUpdateItem(idx, 'warehouseId', e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs font-medium text-neutral-900 dark:text-white"
                          >
                            {warehouses.map((wh) => (
                              <option key={wh.id} value={wh.id}>
                                {wh.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Cantidad */}
                        <div className="sm:col-span-2 space-y-1">
                          <div className="flex justify-between items-center">
                            <label className="text-[11px] font-bold text-neutral-500">Cant.</label>
                            <span className="text-[10px] text-neutral-400">Stock: {stock}</span>
                          </div>
                          <input
                            type="number"
                            min="1"
                            max={stock || 9999}
                            value={item.quantity}
                            onChange={(e) => handleUpdateItem(idx, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-full px-2.5 py-1.5 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs font-bold text-neutral-900 dark:text-white"
                          />
                        </div>

                        {/* Precio Unitario */}
                        <div className="sm:col-span-2 space-y-1">
                          <label className="text-[11px] font-bold text-neutral-500">P. Unitario ($)</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.unitPrice}
                            onChange={(e) => handleUpdateItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                            className="w-full px-2.5 py-1.5 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs font-bold text-neutral-900 dark:text-white"
                          />
                        </div>

                        {/* Eliminar Fila */}
                        <div className="sm:col-span-1 flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                            title="Quitar artículo"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Control y Selección de Series si el artículo requiere o tiene series */}
                      {(() => {
                        const art = articles.find(a => a.id === item.articleId);
                        const hasOrRequiresSeries = art?.requiresSeries || availableSeries.length > 0;
                        const selectedItemSeries = item.selectedSeries || [];

                        if (!hasOrRequiresSeries) {
                          return null;
                        }

                        return (
                          <div className="pt-3 border-t border-neutral-200 dark:border-neutral-700/60 space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5">
                                <Hash className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                                <span className="text-[10px] font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wider">
                                  Series a entregar ({selectedItemSeries.length} de {item.quantity})
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                {availableSeries.length > 0 && item.quantity >= 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleAutoSelectSeriesOnItem(idx, availableSeries, item.quantity)}
                                    className="text-[10px] font-bold text-amber-700 dark:text-amber-300 hover:underline cursor-pointer"
                                  >
                                    Auto-seleccionar {Math.min(item.quantity, availableSeries.length)}
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setSeriesArticleTarget({
                                    id: item.articleId,
                                    name: item.articleName,
                                    series: availableSeries,
                                    warehouseId: item.warehouseId
                                  })}
                                  className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 flex items-center gap-1 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-lg border border-amber-200 dark:border-amber-800 transition-colors cursor-pointer"
                                  title="Ingresar nuevas series o números de chasis para este producto"
                                >
                                  <span>+ Ingresar / Editar Series</span>
                                </button>
                              </div>
                            </div>

                            {availableSeries.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5 p-2 bg-white/60 dark:bg-neutral-900/40 rounded-xl border border-neutral-200 dark:border-neutral-700/80 max-h-28 overflow-y-auto">
                                {availableSeries.map((s) => {
                                  const isSelected = selectedItemSeries.includes(s);
                                  return (
                                    <button
                                      key={s}
                                      type="button"
                                      onClick={() => handleToggleSeriesOnItem(idx, s, item.quantity)}
                                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer border ${
                                        isSelected
                                          ? 'bg-amber-600 text-white border-amber-700 shadow-sm'
                                          : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-300 dark:border-neutral-700 hover:border-amber-400'
                                      }`}
                                    >
                                      {isSelected && <Check className="w-3 h-3" />}
                                      <span>{s}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="p-2.5 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                                <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                                <span>No hay series registradas en bodega. Debe registrarlas para poder seleccionarlas.</span>
                              </div>
                            )}

                            {selectedItemSeries.length < item.quantity && (
                              <div className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg border ${
                                art?.requiresSeries 
                                  ? 'text-rose-800 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/40 font-black' 
                                  : 'text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/40'
                              }`}>
                                <AlertTriangle className={`w-3.5 h-3.5 flex-shrink-0 ${art?.requiresSeries ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`} />
                                <span>
                                  {art?.requiresSeries ? 'OBLIGATORIO: ' : ''}
                                  Faltan {item.quantity - selectedItemSeries.length} serie(s) por asignar.
                                  {art?.requiresSeries ? ' No podrá guardar la venta hasta seleccionarlas.' : ' Se permite procesar la venta y regularizar luego.'}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 3: Financial Calculations, Discount & Down Payment */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t border-neutral-200 dark:border-neutral-800">
            <div className="p-4 bg-neutral-50 dark:bg-neutral-800/40 rounded-xl space-y-1">
              <span className="text-xs font-bold text-neutral-500 uppercase">Subtotal Artículos</span>
              <div className="text-lg font-black text-neutral-900 dark:text-white font-mono">
                {formatCurrency(grossSubtotal)}
              </div>
            </div>

            {/* Descuento General de la Venta (Valor o Porcentaje) */}
            <div className="p-4 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40 rounded-xl space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase">Descuento Venta</span>
                <div className="flex rounded-md overflow-hidden border border-blue-300 dark:border-blue-700 text-[10px] font-black">
                  <button
                    type="button"
                    onClick={() => setDiscountType('VALUE')}
                    className={`px-1.5 py-0.5 ${discountType === 'VALUE' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300'}`}
                  >
                    $ Fijo
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscountType('PERCENT')}
                    className={`px-1.5 py-0.5 ${discountType === 'PERCENT' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300'}`}
                  >
                    % Porc.
                  </button>
                </div>
              </div>
              <div className="relative">
                {discountType === 'VALUE' && <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-blue-600">$</span>}
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={discountType === 'PERCENT' ? 100 : grossSubtotal}
                  value={discountValueInput || ''}
                  onChange={(e) => setDiscountValueInput(Math.max(0, parseFloat(e.target.value) || 0))}
                  placeholder="0.00"
                  className={`w-full py-1 bg-white dark:bg-neutral-800 border border-blue-300 dark:border-blue-700 rounded-lg text-sm font-black text-blue-700 dark:text-blue-300 font-mono ${discountType === 'VALUE' ? 'pl-6 pr-2' : 'px-2'}`}
                />
              </div>
              {generalDiscountAmount > 0 && (
                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 block">
                  Ahorro: -{formatCurrency(generalDiscountAmount)}
                </span>
              )}
            </div>

            <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-xl space-y-1">
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase">Entrada / Abono Inicial ($)</span>
              <input
                type="number"
                step="0.01"
                min="0"
                max={grossTotal}
                value={downPayment}
                onChange={(e) => setDownPayment(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full px-2.5 py-1 bg-white dark:bg-neutral-800 border border-emerald-300 dark:border-emerald-700 rounded-lg text-base font-black text-emerald-700 dark:text-emerald-400 font-mono"
              />
            </div>

            <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/40 rounded-xl space-y-1">
              <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 uppercase">Saldo a Financiar</span>
              <div className="text-lg font-black text-indigo-700 dark:text-indigo-400 font-mono">
                {formatCurrency(netFinancedAmount)}
              </div>
              <span className="text-[10px] text-neutral-400 block">Total Venta: {formatCurrency(grossTotal)}</span>
            </div>
          </div>

          {/* Section 4: Amortization Parameters */}
          <div className="space-y-4 pt-4 border-t border-neutral-200 dark:border-neutral-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-indigo-500" />
              Plan de Amortización y Cuotas
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-600 dark:text-neutral-300">Frecuencia de Pago</label>
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value as CreditPaymentFrequency)}
                  className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs font-bold text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="SEMANAL">Semanal</option>
                  <option value="QUINCENAL">Quincenal</option>
                  <option value="MENSUAL">Mensual</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-600 dark:text-neutral-300">Número de Cuotas</label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={installmentsCount}
                  onChange={(e) => setInstallmentsCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs font-bold text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-600 dark:text-neutral-300">Primera Fecha de Vencimiento</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs font-bold text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Installments Table Preview */}
            <div className="p-4 bg-neutral-50 dark:bg-neutral-800/30 rounded-2xl border border-neutral-200 dark:border-neutral-800 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-neutral-700 dark:text-neutral-300">
                <span>Resumen de Cuotas Calculadas:</span>
                <span className="text-indigo-600 dark:text-indigo-400">
                  {installmentsCount} cuotas de ~{formatCurrency(installmentAmount)} ({frequency})
                </span>
              </div>
              <div className="max-h-36 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 text-xs pt-2">
                {calculatedInstallments.map((inst) => (
                  <div key={inst.number} className="p-2 bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 flex justify-between">
                    <div>
                      <span className="font-bold text-neutral-700 dark:text-neutral-300">#{inst.number}</span>
                      <span className="block text-[10px] text-neutral-400">{inst.dueDate}</span>
                    </div>
                    <span className="font-mono font-bold text-neutral-900 dark:text-white">{formatCurrency(inst.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Section 5: Early Settlement Discount Conditions (Pacto de liquidación anticipada) */}
          <div className="space-y-3 pt-4 border-t border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 flex items-center gap-1.5 cursor-pointer">
                <Percent className="w-4 h-4 text-emerald-500" />
                Pacto de Liquidación Anticipada (Descuento por Pronto Pago)
              </label>
              <input
                type="checkbox"
                checked={enableEarlySettlement}
                onChange={(e) => setEnableEarlySettlement(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
            </div>

            {enableEarlySettlement && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-2xl text-xs">
                {/* Opción 1 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-800 dark:text-emerald-300 block">Opción 1: Pronto Pago Corto Plazo</span>
                    <div className="flex rounded overflow-hidden border border-emerald-300 dark:border-emerald-700 text-[9px] font-black">
                      <button
                        type="button"
                        onClick={() => setDiscountOption1(prev => ({ ...prev, type: 'PERCENT' }))}
                        className={`px-1.5 py-0.5 ${discountOption1.type === 'PERCENT' ? 'bg-emerald-600 text-white' : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300'}`}
                      >
                        % Porc.
                      </button>
                      <button
                        type="button"
                        onClick={() => setDiscountOption1(prev => ({ ...prev, type: 'VALUE' }))}
                        className={`px-1.5 py-0.5 ${discountOption1.type === 'VALUE' ? 'bg-emerald-600 text-white' : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300'}`}
                      >
                        $ Fijo
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-neutral-500 block">Antes de (meses):</label>
                      <input
                        type="number"
                        min="1"
                        value={discountOption1.months}
                        onChange={(e) => setDiscountOption1(prev => ({ ...prev, months: parseInt(e.target.value) || 1 }))}
                        className="w-full px-2 py-1 bg-white dark:bg-neutral-800 border rounded text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-neutral-500 block">
                        {discountOption1.type === 'PERCENT' ? '% Descuento:' : 'Monto Descuento ($):'}
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={discountOption1.type === 'PERCENT' ? 100 : netFinancedAmount}
                        step={discountOption1.type === 'PERCENT' ? 1 : 0.01}
                        value={discountOption1.value}
                        onChange={(e) => setDiscountOption1(prev => ({ ...prev, value: parseFloat(e.target.value) || 0 }))}
                        className="w-full px-2 py-1 bg-white dark:bg-neutral-800 border rounded text-xs font-bold text-emerald-600"
                      />
                    </div>
                  </div>
                  <div className="text-[11px] font-bold text-neutral-700 dark:text-neutral-300">
                    Monto con descuento:{' '}
                    <span className="font-mono text-emerald-600">
                      {formatCurrency(
                        discountOption1.type === 'PERCENT'
                          ? netFinancedAmount * (1 - discountOption1.value / 100)
                          : Math.max(0, netFinancedAmount - discountOption1.value)
                      )}
                    </span>
                  </div>
                </div>

                {/* Opción 2 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-800 dark:text-emerald-300 block">Opción 2: Pronto Pago Mediano Plazo</span>
                    <div className="flex rounded overflow-hidden border border-emerald-300 dark:border-emerald-700 text-[9px] font-black">
                      <button
                        type="button"
                        onClick={() => setDiscountOption2(prev => ({ ...prev, type: 'PERCENT' }))}
                        className={`px-1.5 py-0.5 ${discountOption2.type === 'PERCENT' ? 'bg-emerald-600 text-white' : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300'}`}
                      >
                        % Porc.
                      </button>
                      <button
                        type="button"
                        onClick={() => setDiscountOption2(prev => ({ ...prev, type: 'VALUE' }))}
                        className={`px-1.5 py-0.5 ${discountOption2.type === 'VALUE' ? 'bg-emerald-600 text-white' : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300'}`}
                      >
                        $ Fijo
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-neutral-500 block">Antes de (meses):</label>
                      <input
                        type="number"
                        min="1"
                        value={discountOption2.months}
                        onChange={(e) => setDiscountOption2(prev => ({ ...prev, months: parseInt(e.target.value) || 1 }))}
                        className="w-full px-2 py-1 bg-white dark:bg-neutral-800 border rounded text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-neutral-500 block">
                        {discountOption2.type === 'PERCENT' ? '% Descuento:' : 'Monto Descuento ($):'}
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={discountOption2.type === 'PERCENT' ? 100 : netFinancedAmount}
                        step={discountOption2.type === 'PERCENT' ? 1 : 0.01}
                        value={discountOption2.value}
                        onChange={(e) => setDiscountOption2(prev => ({ ...prev, value: parseFloat(e.target.value) || 0 }))}
                        className="w-full px-2 py-1 bg-white dark:bg-neutral-800 border rounded text-xs font-bold text-emerald-600"
                      />
                    </div>
                  </div>
                  <div className="text-[11px] font-bold text-neutral-700 dark:text-neutral-300">
                    Monto con descuento:{' '}
                    <span className="font-mono text-emerald-600">
                      {formatCurrency(
                        discountOption2.type === 'PERCENT'
                          ? netFinancedAmount * (1 - discountOption2.value / 100)
                          : Math.max(0, netFinancedAmount - discountOption2.value)
                      )}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-6 border-t border-neutral-200 dark:border-neutral-800">
            <button
              type="button"
              onClick={() => setIsApplicationPrintOpen(true)}
              disabled={!selectedClient || saleItems.length === 0}
              className="w-full sm:w-auto px-4 py-2.5 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 text-xs font-bold rounded-xl border border-neutral-300 dark:border-neutral-700 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
              title="Imprimir Solicitud de Crédito en 1 Hoja (Resumen ejecutivo y datos del cliente)"
            >
              <Printer className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              Imprimir Solicitud de Crédito (1 Hoja)
            </button>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving || exceedsCreditLimit || saleItems.length === 0}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2 cursor-pointer"
              >
                {saving ? 'Generando Crédito & Descontando Stock...' : 'Confirmar Venta y Generar Pagaré'}
              </button>
            </div>
          </div>
        </form>

      </div>

      {/* Modal de Impresión de Solicitud de Crédito en 1 Hoja (Pre-guardado o borrador) */}
      <CreditApplicationPrintModal
        isOpen={isApplicationPrintOpen}
        onClose={() => setIsApplicationPrintOpen(false)}
        companyName={profile?.name || 'ELECTRO & CRÉDITOS'}
        companyRuc={profile?.ruc || '1790012345001'}
        companyAddress={profile?.address || 'Ecuador'}
        companyPhone={profile?.phone || '0999999999'}
        data={{
          client: selectedClient,
          clientName: selectedClient ? `${selectedClient.lastName} ${selectedClient.firstName}`.trim() : '',
          clientIdCard: selectedClient?.idCard,
          clientPhone: selectedClient?.phone,
          clientAddress: selectedClient?.address,
          clientCity: selectedClient?.city,
          clientEmail: selectedClient?.email,
          workplace: selectedClient?.workInfo?.workplace,
          workPosition: selectedClient?.workInfo?.position,
          workPhone: selectedClient?.workInfo?.workPhone,
          workAddress: selectedClient?.workInfo?.workAddress,
          spouseName: selectedClient?.spouseInfo?.lastName ? `${selectedClient.spouseInfo.lastName} ${selectedClient.spouseInfo.firstName || ''}`.trim() : '',
          spouseIdCard: selectedClient?.spouseInfo?.idCard,
          spousePhone: selectedClient?.spouseInfo?.phone,
          guarantorName: selectedClient?.guarantorName,
          guarantorIdCard: selectedClient?.guarantorIdCard,
          guarantorPhone: selectedClient?.guarantorPhone,
          references: selectedClient?.references,
          items: saleItems.map(it => ({
            articleName: it.articleName,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            totalPrice: it.totalPrice
          })),
          grossTotal,
          downPayment,
          netFinancedAmount,
          frequency,
          installmentsCount,
          installmentAmount,
          startDate,
          sellerName: sellers.find(s => s.id === selectedSellerId) ? `${sellers.find(s => s.id === selectedSellerId)?.name} ${sellers.find(s => s.id === selectedSellerId)?.lastName}` : 'Vendedor Asignado',
          earlySettlementOptions: calculatedEarlySettlements
        }}
      />

      {/* Modal para ingresar series en tiempo real */}
      {seriesArticleTarget && (
        <ManageArticleSeriesModal
          isOpen={!!seriesArticleTarget}
          onClose={() => setSeriesArticleTarget(null)}
          articleId={seriesArticleTarget.id}
          articleName={seriesArticleTarget.name}
          currentSeries={seriesArticleTarget.series}
          warehouseId={seriesArticleTarget.warehouseId}
          globalStock={articles.find(a => a.id === seriesArticleTarget.id)?.quantity || 0}
          onSuccess={(updated) => {
            const targetArtId = seriesArticleTarget.id;
            const targetWhId = seriesArticleTarget.warehouseId;
            setSeriesOverrides(prev => ({
              ...prev,
              ...(targetWhId ? { [`${targetWhId}_${targetArtId}`]: updated } : {}),
              [targetArtId]: updated
            }));
            setSeriesArticleTarget(null);
          }}
        />
      )}
    </div>
  );
};
