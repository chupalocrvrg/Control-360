import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  X, 
  Search, 
  ShoppingCart, 
  FileSpreadsheet, 
  RefreshCw, 
  Upload, 
  Link2, 
  Calendar, 
  DollarSign, 
  CheckCircle2, 
  AlertCircle, 
  Plus, 
  Trash2, 
  Printer, 
  Share2, 
  User, 
  CreditCard, 
  Gift, 
  Tag, 
  Check, 
  Clock, 
  Layers, 
  ExternalLink,
  Phone,
  FileText,
  Percent,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Download,
  Pencil,
  Lock,
  Eye,
  Flame
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, addDays } from 'date-fns';
import { 
  PriceListItem, 
  CreditPlanOption, 
  Proforma, 
  ProformaItem, 
  PriceListConfig 
} from '../../types/proforma';
import { Client } from '../../types/client';
import { 
  loadPriceList, 
  savePriceList, 
  loadPriceListConfig, 
  savePriceListConfig,
  saveProforma, 
  loadProformas, 
  updateProformaStatus,
  calculateDynamicQuota,
  calculateComboAdaptation,
  generateInternalItemCode,
  parseExcelBufferToPriceList,
  SAMPLE_PRICE_LIST 
} from '../../lib/priceListService';
import { printElement, downloadElementAsPdf } from '../../lib/printUtils';
import { useNotification } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';

interface EmployeeItem {
  id: string;
  name: string;
  lastName: string;
  role: string;
}

interface ProformaPriceListModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
  employees: EmployeeItem[];
  enterpriseId: string;
  enterpriseName?: string;
  onConvertToCreditSale?: (proformaData: Proforma) => void;
  onConvertToCashSale?: (proformaData: Proforma) => void;
}

export default function ProformaPriceListModal({
  isOpen,
  onClose,
  clients,
  employees,
  enterpriseId,
  enterpriseName = 'Comercial 360',
  onConvertToCreditSale,
  onConvertToCashSale
}: ProformaPriceListModalProps) {
  const { showToast, showConfirm } = useNotification();
  const { user } = useAuth();

  // Active Tab: 'cotizador' | 'historial' | 'dropbox'
  const [activeTab, setActiveTab] = useState<'cotizador' | 'historial' | 'dropbox'>('cotizador');

  // Price list state
  const [catalog, setCatalog] = useState<PriceListItem[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [config, setConfig] = useState<PriceListConfig>({
    dropboxUrl: '',
    lastSyncAt: null,
    itemsCount: 0,
    status: 'idle'
  });

  // Dropbox sync state
  const [dropboxUrlInput, setDropboxUrlInput] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Search state in cotizador
  const [productSearch, setProductSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<PriceListItem | null>(null);
  const [selectedPlanMonths, setSelectedPlanMonths] = useState<number>(0);
  const [customDownPayment, setCustomDownPayment] = useState<number>(0);
  const [itemQuantity, setItemQuantity] = useState<number>(1);

  // Client Selection State
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientCustomName, setClientCustomName] = useState('Consumidor Final');
  const [clientCustomIdCard, setClientCustomIdCard] = useState('');
  const [clientCustomPhone, setClientCustomPhone] = useState('');
  const [clientCustomAddress, setClientCustomAddress] = useState('');
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);

  // Seller State
  const [selectedSellerId, setSelectedSellerId] = useState<string>('');

  // Proforma Items Cart
  const [proformaItems, setProformaItems] = useState<ProformaItem[]>([]);
  const [proformaNotes, setProformaNotes] = useState('');

  // Proforma Combo State
  const [isComboActive, setIsComboActive] = useState<boolean>(false);
  const [comboTargetMonths, setComboTargetMonths] = useState<number>(12);
  const [comboCustomDownPayment, setComboCustomDownPayment] = useState<number | null>(null);

  // Saved Proformas History
  const [savedProformas, setSavedProformas] = useState<Proforma[]>([]);
  const [loadingProformas, setLoadingProformas] = useState(false);
  const [proformaHistoryFilter, setProformaHistoryFilter] = useState('');

  // Print Preview Modal State
  const [previewProforma, setPreviewProforma] = useState<Proforma | null>(null);
  const printAreaRef = useRef<HTMLDivElement>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // In-cart editing state
  const [editingCartItemIndex, setEditingCartItemIndex] = useState<number | null>(null);
  const [editItemMonths, setEditItemMonths] = useState<number>(0);
  const [editItemDownPayment, setEditItemDownPayment] = useState<number>(0);
  const [editItemQuantity, setEditItemQuantity] = useState<number>(1);

  // Close preview on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && previewProforma) {
        setPreviewProforma(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewProforma]);

  // Load initial data
  useEffect(() => {
    if (isOpen && enterpriseId) {
      loadInitialData();
    }
  }, [isOpen, enterpriseId]);

  const loadInitialData = async () => {
    setLoadingCatalog(true);
    try {
      const [loadedItems, loadedConfig, proformas] = await Promise.all([
        loadPriceList(enterpriseId),
        loadPriceListConfig(enterpriseId),
        loadProformas(enterpriseId)
      ]);

      setCatalog(loadedItems);
      setConfig(loadedConfig);
      setDropboxUrlInput(loadedConfig.dropboxUrl || '');
      setSavedProformas(proformas);

      // Default seller if not set
      if (!selectedSellerId && employees.length > 0) {
        setSelectedSellerId(employees[0].id);
      }
    } catch (err) {
      console.error('Error loading proforma initial data:', err);
    } finally {
      setLoadingCatalog(false);
    }
  };

  // Product search filter
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return [];
    const term = productSearch.toLowerCase().trim();
    return catalog.filter(p => 
      p.item.toLowerCase().includes(term) ||
      p.brand.toLowerCase().includes(term) ||
      p.category.toLowerCase().includes(term)
    ).slice(0, 15);
  }, [catalog, productSearch]);

  // When a product is selected, initialize plan and default down payment
  const handleSelectProduct = (product: PriceListItem) => {
    setSelectedProduct(product);
    setProductSearch('');
    // Strictly filter plans so they never exceed maxMonths
    const allowedPlans = (product.plans || []).filter(p => product.maxMonths === 0 || p.months <= product.maxMonths);
    if (allowedPlans.length > 0) {
      const defaultPlan = allowedPlans[0];
      setSelectedPlanMonths(defaultPlan.months);
      setCustomDownPayment(defaultPlan.downPayment);
    } else {
      setSelectedPlanMonths(product.maxMonths || 1);
      setCustomDownPayment(product.defaultDownPayment || 0);
    }
    setItemQuantity(1);
  };

  // Calculate live quota for selected product & customized down payment
  const currentPlan = useMemo(() => {
    if (!selectedProduct || !selectedProduct.plans) return null;
    return selectedProduct.plans.find(p => p.months === selectedPlanMonths) || null;
  }, [selectedProduct, selectedPlanMonths]);

  const liveCalculatedQuota = useMemo(() => {
    if (!selectedProduct) return 0;
    const baseCreditPrice = currentPlan ? currentPlan.totalPrice : selectedProduct.creditPrice;
    return calculateDynamicQuota(baseCreditPrice, customDownPayment, selectedPlanMonths);
  }, [selectedProduct, currentPlan, customDownPayment, selectedPlanMonths]);

  // Add selected product to the current proforma
  const handleAddItemToProforma = () => {
    if (!selectedProduct) return;

    const baseCreditPrice = currentPlan ? currentPlan.totalPrice : selectedProduct.creditPrice;
    const quota = liveCalculatedQuota;
    const internalCode = selectedProduct.internalCode || generateInternalItemCode(selectedProduct.item, selectedProduct.brand, selectedProduct.minStorePrice);

    const newItem: ProformaItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      priceListItemId: selectedProduct.id,
      internalCode,
      item: selectedProduct.item,
      brand: selectedProduct.brand,
      category: selectedProduct.category,
      gift: selectedProduct.gift,
      minStorePrice: selectedProduct.minStorePrice,
      selectedPlanMonths: selectedPlanMonths,
      totalCreditPrice: baseCreditPrice,
      downPayment: customDownPayment,
      calculatedQuota: quota,
      quantity: itemQuantity
    };

    setProformaItems(prev => [...prev, newItem]);
    showToast(`"${selectedProduct.item}" agregado a la proforma`, 'success');
    setSelectedProduct(null);
  };

  // Start in-cart item editing
  const handleStartEditCartItem = (index: number) => {
    const item = proformaItems[index];
    if (!item) return;
    setEditingCartItemIndex(index);
    setEditItemMonths(item.selectedPlanMonths);
    setEditItemDownPayment(item.downPayment);
    setEditItemQuantity(item.quantity);
  };

  // Save changes to an in-cart item
  const handleSaveEditCartItem = () => {
    if (editingCartItemIndex === null) return;
    setProformaItems(prev => {
      const copy = [...prev];
      const target = copy[editingCartItemIndex];
      if (!target) return prev;

      const origProd = catalog.find(c => c.id === target.priceListItemId);
      const plan = origProd?.plans.find(p => p.months === editItemMonths);
      const baseCredit = plan ? plan.totalPrice : target.totalCreditPrice;
      const newQuota = calculateDynamicQuota(baseCredit, editItemDownPayment, editItemMonths);

      copy[editingCartItemIndex] = {
        ...target,
        selectedPlanMonths: editItemMonths,
        totalCreditPrice: baseCredit,
        downPayment: editItemDownPayment,
        calculatedQuota: newQuota,
        quantity: Math.max(1, editItemQuantity)
      };
      return copy;
    });
    setEditingCartItemIndex(null);
    showToast('Artículo actualizado con éxito', 'success');
  };

  const handleRemoveItem = (index: number) => {
    setProformaItems(prev => prev.filter((_, i) => i !== index));
    if (editingCartItemIndex === index) {
      setEditingCartItemIndex(null);
    }
  };

  // Calculate overall totals
  const proformaTotals = useMemo(() => {
    let totalCash = 0;
    let totalCredit = 0;
    let totalDownPayment = 0;
    let totalMonthlyQuotas = 0;

    proformaItems.forEach(it => {
      totalCash += (it.minStorePrice || 0) * it.quantity;
      totalCredit += (it.totalCreditPrice || 0) * it.quantity;
      totalDownPayment += (it.downPayment || 0) * it.quantity;
      totalMonthlyQuotas += (it.calculatedQuota || 0) * it.quantity;
    });

    const totalFinanced = Math.max(0, totalCredit - totalDownPayment);

    return {
      totalCash,
      totalCredit,
      totalDownPayment,
      totalFinanced,
      totalMonthlyQuotas
    };
  }, [proformaItems]);

  // Combo Logic & Dynamic Term Adaptation
  const maxTermInItems = useMemo(() => {
    if (proformaItems.length === 0) return 12;
    return Math.max(...proformaItems.map(it => it.selectedPlanMonths || 12));
  }, [proformaItems]);

  const minTermInItems = useMemo(() => {
    if (proformaItems.length === 0) return 12;
    return Math.min(...proformaItems.map(it => it.selectedPlanMonths || 12));
  }, [proformaItems]);

  const hasDifferentTerms = useMemo(() => {
    if (proformaItems.length < 2) return false;
    return minTermInItems !== maxTermInItems;
  }, [proformaItems, minTermInItems, maxTermInItems]);

  // When items change, synchronize default target combo months to the maximum term
  useEffect(() => {
    if (proformaItems.length >= 2) {
      setComboTargetMonths(prev => Math.max(prev, maxTermInItems));
    }
  }, [maxTermInItems, proformaItems.length]);

  // If proforma items drops below 2, turn off combo
  useEffect(() => {
    if (proformaItems.length < 2 && isComboActive) {
      setIsComboActive(false);
      setComboCustomDownPayment(null);
    }
  }, [proformaItems.length, isComboActive]);

  // Combo calculation adaptation
  const comboCalculation = useMemo(() => {
    if (!isComboActive || proformaItems.length < 2) return null;
    const defaultSum = proformaItems.reduce((acc, it) => acc + (it.downPayment * it.quantity), 0);
    const activeDownPayment = comboCustomDownPayment !== null ? comboCustomDownPayment : defaultSum;
    return calculateComboAdaptation(proformaItems, comboTargetMonths, activeDownPayment);
  }, [isComboActive, proformaItems, comboTargetMonths, comboCustomDownPayment]);

  // Active items and totals for current view, preview and proforma generation
  const activeProformaItems = useMemo(() => {
    if (isComboActive && comboCalculation && proformaItems.length >= 2) {
      return comboCalculation.adaptedItems;
    }
    return proformaItems;
  }, [isComboActive, comboCalculation, proformaItems]);

  const activeTotals = useMemo(() => {
    if (isComboActive && comboCalculation && proformaItems.length >= 2) {
      return {
        totalCash: proformaTotals.totalCash,
        totalCredit: comboCalculation.totalCredit,
        totalDownPayment: comboCalculation.totalDownPayment,
        totalFinanced: comboCalculation.totalFinanced,
        totalMonthlyQuotas: comboCalculation.comboMonthlyQuota
      };
    }
    return proformaTotals;
  }, [isComboActive, comboCalculation, proformaTotals, proformaItems.length]);

  // Handle client selection
  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return [];
    const term = clientSearch.toLowerCase().trim();
    return clients.filter(c => 
      `${c.firstName} ${c.lastName}`.toLowerCase().includes(term) ||
      (c.idCard && c.idCard.toLowerCase().includes(term)) ||
      (c.phone && c.phone.includes(term))
    ).slice(0, 6);
  }, [clients, clientSearch]);

  const handlePickClient = (client: Client) => {
    setSelectedClient(client);
    setClientCustomName(`${client.firstName} ${client.lastName}`.trim());
    setClientCustomIdCard(client.idCard || '');
    setClientCustomPhone(client.phone || '');
    setClientCustomAddress(client.address || '');
    setShowClientSuggestions(false);
    setClientSearch('');
  };

  // Sync with Dropbox via backend endpoint
  const handleSyncDropbox = async () => {
    if (!dropboxUrlInput.trim()) {
      showToast('Por favor ingrese el enlace de Dropbox del archivo Excel.', 'warning');
      return;
    }

    setIsSyncing(true);
    try {
      const response = await fetch('/api/price-list/sync-dropbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dropboxUrl: dropboxUrlInput.trim(),
          enterpriseId
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Error al sincronizar con Dropbox');
      }

      const syncedItems: PriceListItem[] = data.items;
      setCatalog(syncedItems);

      const newConfig: PriceListConfig = {
        dropboxUrl: dropboxUrlInput.trim(),
        lastSyncAt: new Date().toISOString(),
        itemsCount: syncedItems.length,
        status: 'success'
      };

      setConfig(newConfig);
      await Promise.all([
        savePriceList(enterpriseId, syncedItems),
        savePriceListConfig(enterpriseId, newConfig)
      ]);

      showToast(`¡Lista sincronizada con éxito! ${syncedItems.length} artículos cargados.`, 'success');
      setActiveTab('cotizador');
    } catch (err: any) {
      console.error('Dropbox sync failed:', err);
      showToast(err.message || 'Error al conectar con Dropbox. Verifique el enlace.', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // Local Excel file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsSyncing(true);
    try {
      const buffer = await file.arrayBuffer();
      const items = parseExcelBufferToPriceList(buffer, enterpriseId);

      if (items.length === 0) {
        throw new Error('No se encontraron artículos válidos en el archivo Excel.');
      }

      setCatalog(items);

      const newConfig: PriceListConfig = {
        dropboxUrl: config.dropboxUrl,
        lastSyncAt: new Date().toISOString(),
        itemsCount: items.length,
        status: 'success'
      };

      setConfig(newConfig);
      await Promise.all([
        savePriceList(enterpriseId, items),
        savePriceListConfig(enterpriseId, newConfig)
      ]);

      showToast(`¡Archivo importado con éxito! ${items.length} artículos cargados.`, 'success');
      setActiveTab('cotizador');
    } catch (err: any) {
      console.error('Excel file upload failed:', err);
      showToast(err.message || 'Error al leer el archivo Excel.', 'error');
    } finally {
      setIsSyncing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Generate Current Proforma Object
  const generateCurrentProforma = (): Proforma => {
    const now = new Date();
    const seller = employees.find(e => e.id === selectedSellerId);
    const sellerName = seller ? `${seller.name} ${seller.lastName}` : (user?.displayName || 'Asesor Comercial');
    const isCombo = isComboActive && proformaItems.length >= 2;

    return {
      id: `prof-${Date.now()}`,
      proformaNumber: `PROF-${format(now, 'yyyyMM')}-${Math.floor(1000 + Math.random() * 9000)}`,
      date: format(now, 'yyyy-MM-dd'),
      validUntil: format(addDays(now, 15), 'yyyy-MM-dd'),
      clientId: selectedClient?.id,
      clientName: clientCustomName || 'Consumidor Final',
      clientIdCard: clientCustomIdCard,
      clientPhone: clientCustomPhone,
      clientAddress: clientCustomAddress,
      sellerId: selectedSellerId,
      sellerName,
      enterpriseId,
      items: activeProformaItems,
      totalCash: activeTotals.totalCash,
      totalCredit: activeTotals.totalCredit,
      totalDownPayment: activeTotals.totalDownPayment,
      totalFinanced: activeTotals.totalFinanced,
      isCombo,
      comboMonths: isCombo ? comboTargetMonths : undefined,
      comboDownPayment: isCombo ? activeTotals.totalDownPayment : undefined,
      comboMonthlyQuota: isCombo ? activeTotals.totalMonthlyQuotas : undefined,
      status: 'COTIZADA',
      notes: proformaNotes
    };
  };

  // Save proforma to Firestore, register in history, and clean cotizador
  const handleSaveProforma = async () => {
    if (proformaItems.length === 0) {
      showToast('Agregue al menos un artículo a la proforma antes de guardarla.', 'warning');
      return;
    }

    try {
      const newProforma = generateCurrentProforma();
      const id = await saveProforma(newProforma);
      newProforma.id = id;
      setSavedProformas(prev => [newProforma, ...prev]);
      showToast(`¡Proforma ${newProforma.proformaNumber} guardada exitosamente y registrada en el Historial!`, 'success');

      // 1. Limpiar el cotizador por completo para una nueva cotización
      setProformaItems([]);
      setSelectedProduct(null);
      setSelectedClient(null);
      setClientCustomName('Consumidor Final');
      setClientCustomIdCard('');
      setClientCustomPhone('');
      setClientCustomAddress('');
      setClientSearch('');
      setProformaNotes('');
      setEditingCartItemIndex(null);
      setIsComboActive(false);
      setComboCustomDownPayment(null);

      // 2. Pasar automáticamente a la pestaña Historial de Proformas
      setActiveTab('historial');
    } catch (err) {
      console.error('Error saving proforma:', err);
      showToast('Error al guardar la proforma en la nube.', 'error');
    }
  };

  // Open Preview Modal
  const handleOpenPreview = () => {
    if (proformaItems.length === 0) {
      showToast('Agregue al menos un artículo a la proforma para ver la vista previa.', 'warning');
      return;
    }
    const prof = generateCurrentProforma();
    setPreviewProforma(prof);
  };

  // Print Document using isolated iframe printElement
  const handlePrintDocument = async () => {
    if (!printAreaRef.current) {
      window.print();
      return;
    }
    try {
      setIsPrinting(true);
      await printElement(printAreaRef.current, {
        title: `Proforma_${previewProforma?.proformaNumber || 'Oficial'}`,
        pageFormat: 'A4'
      });
    } catch (err) {
      console.error('Error al imprimir proforma:', err);
      window.print();
    } finally {
      setIsPrinting(false);
    }
  };

  // Download PDF Document
  const handleDownloadPdf = async () => {
    if (!printAreaRef.current || !previewProforma) return;
    try {
      setIsExportingPdf(true);
      await downloadElementAsPdf(
        printAreaRef.current,
        `Proforma_${previewProforma.proformaNumber}_${previewProforma.clientName.replace(/\s+/g, '_')}`,
        { pageFormat: 'A4' }
      );
      showToast('Documento PDF generado y descargado correctamente', 'success');
    } catch (err) {
      console.error('Error al descargar PDF:', err);
      showToast('No se pudo generar el archivo PDF', 'error');
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Share via WhatsApp (Without leaking minimum cash floor price to the customer)
  const handleShareWhatsApp = (proformaToShare?: Proforma) => {
    const prof = proformaToShare || generateCurrentProforma();
    if (prof.items.length === 0) {
      showToast('No hay artículos cotizados para compartir.', 'warning');
      return;
    }

    let msg = '';
    if (prof.isCombo) {
      msg += `🔥 *COTIZACIÓN ESPECIAL COMBO UNIFICADO - ${enterpriseName.toUpperCase()}* 🔥\n`;
      msg += `📄 *Proforma:* ${prof.proformaNumber}\n`;
      msg += `📅 *Fecha:* ${prof.date} (Válida hasta: ${prof.validUntil})\n`;
      msg += `👤 *Cliente:* ${prof.clientName}\n`;
      msg += `💼 *Asesor:* ${prof.sellerName}\n`;
      msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
      msg += `📦 *ARTÍCULOS INCLUIDOS EN EL COMBO:*\n`;
      prof.items.forEach((it, i) => {
        msg += `*${i + 1}. ${it.item}* (Cant: ${it.quantity} | Marca: ${it.brand || 'N/A'})\n`;
        if (it.internalCode) {
          msg += `   🏷️ *Cód. Ref:* ${it.internalCode}\n`;
        }
        if (it.gift) {
          msg += `   🎁 *Regalo incluido:* ${it.gift}\n`;
        }
        msg += `   💵 Valor individual a crédito: $${(it.totalCreditPrice * it.quantity).toFixed(2)}\n\n`;
      });
      msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
      msg += `✨ *CONDICIONES PLAN COMBO CONSOLIDADO:*\n`;
      msg += `⏱️ *Plazo Unificado:* *${prof.comboMonths || 12} Meses*\n`;
      msg += `💵 *Entrada Total Unificada:* *$${prof.totalDownPayment.toFixed(2)}*\n`;
      msg += `🗓️ *CUOTA MENSUAL ÚNICA: $${(prof.comboMonthlyQuota || (prof.totalFinanced / (prof.comboMonths || 12))).toFixed(2)} / mes*\n`;
      msg += `💰 *Total a Crédito:* $${prof.totalCredit.toFixed(2)}\n`;
      msg += `💳 *Saldo Total a Financiar:* $${prof.totalFinanced.toFixed(2)}\n\n`;
      msg += `📌 *Ventaja Combo:* Pagos y fechas sincronizados en un solo valor mensual con fecha fija de pago.\n\n`;
      msg += `¡Gracias por preferirnos! Si deseas separar tu combo o verificar la aprobación inmediata de tu crédito, contáctanos.`;
    } else {
      msg += `*COTIZACIÓN COMERCIAL - ${enterpriseName.toUpperCase()}*\n`;
      msg += `📄 *Proforma:* ${prof.proformaNumber}\n`;
      msg += `📅 *Fecha:* ${prof.date} (Válida hasta: ${prof.validUntil})\n`;
      msg += `👤 *Cliente:* ${prof.clientName}\n`;
      msg += `💼 *Asesor:* ${prof.sellerName}\n`;
      msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

      prof.items.forEach((it, i) => {
        msg += `*${i + 1}. ${it.item}* (Marca: ${it.brand || 'N/A'})\n`;
        if (it.internalCode) {
          msg += `   🏷️ *Cód. Ref:* ${it.internalCode}\n`;
        }
        if (it.gift) {
          msg += `   🎁 *Regalo incluido:* ${it.gift}\n`;
        }
        msg += `   💳 *Plan Crédito (${it.selectedPlanMonths} meses):*\n`;
        msg += `      • Entrada requerida: $${it.downPayment.toFixed(2)}\n`;
        msg += `      • *Cuota Mensual: $${it.calculatedQuota.toFixed(2)} / mes*\n`;
        msg += `      • Total a Crédito: $${(it.totalCreditPrice * it.quantity).toFixed(2)}\n\n`;
      });

      msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
      msg += `📊 *RESUMEN DE COTIZACIÓN:*\n`;
      msg += `• Total a Crédito: $${prof.totalCredit.toFixed(2)}\n`;
      msg += `• Total Entrada Requerida: $${prof.totalDownPayment.toFixed(2)}\n`;
      msg += `• Saldo a Financiar: $${prof.totalFinanced.toFixed(2)}\n\n`;
      msg += `¡Gracias por preferirnos! Si deseas separar tu artículo o necesitas aprobación inmediata de crédito, contáctanos.`;
    }

    const encoded = encodeURIComponent(msg);
    const cleanPhone = (prof.clientPhone || '').replace(/\D/g, '');
    const waUrl = cleanPhone 
      ? `https://wa.me/${cleanPhone}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;

    window.open(waUrl, '_blank');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl w-full max-w-6xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        
        {/* Top Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-neutral-900 via-indigo-950 to-neutral-900 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center text-indigo-400 shadow-inner">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black tracking-tight text-white">Módulo de Proformas y Cotizador</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 uppercase tracking-widest">
                  Excel & Dropbox
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Lista de precios sincronizada con planes dinámicos de crédito y cuotas automáticas
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            {/* Status indicator */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-neutral-800/80 border border-neutral-700/60 text-xs">
              <div className={`w-2 h-2 rounded-full ${catalog.length > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              <span className="text-neutral-300 font-medium">{catalog.length} artículos cargados</span>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-xl transition-colors cursor-pointer"
              title="Cerrar ventana"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 px-6 pt-3 gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('cotizador')}
            className={`px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer border-b-2 ${
              activeTab === 'cotizador'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-neutral-900 shadow-sm'
                : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            Nueva Proforma / Cotizador
          </button>

          <button
            onClick={() => setActiveTab('historial')}
            className={`px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer border-b-2 ${
              activeTab === 'historial'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-neutral-900 shadow-sm'
                : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            Historial de Proformas ({savedProformas.length})
          </button>

          <button
            onClick={() => setActiveTab('dropbox')}
            className={`px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer border-b-2 ${
              activeTab === 'dropbox'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-neutral-900 shadow-sm'
                : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            <Link2 className="w-4 h-4" />
            Conexión Dropbox & Lista de Precios
          </button>
        </div>

        {/* Tab Contents */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">

          {/* ======================================================== */}
          {/* TAB 1: NUEVA PROFORMA / COTIZADOR INTELIGENTE           */}
          {/* ======================================================== */}
          {activeTab === 'cotizador' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

              {/* Left Column: Product Search & Configuration */}
              <div className="lg:col-span-7 space-y-6">

                {/* 1. Intelligent Product Search Bar */}
                <div className="bg-neutral-50 dark:bg-neutral-800/40 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm relative">
                  <label className="block text-xs font-black uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-2 flex items-center justify-between">
                    <span>1. Buscar Artículo en Lista de Precios</span>
                    <span className="text-[10px] text-indigo-500 font-bold">Catálogo activo</span>
                  </label>

                  <div className="relative">
                    <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-neutral-400" />
                    <input
                      type="text"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      placeholder="Escribe el modelo o tipo... (Ej: TV 43, Moto, Samsung, Indurama)"
                      className="w-full bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-xl pl-10 pr-10 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 text-neutral-900 dark:text-neutral-100 font-medium"
                    />
                    {productSearch && (
                      <button
                        onClick={() => setProductSearch('')}
                        className="absolute right-3 top-3 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Dropdown Suggestions */}
                  {productSearch.trim().length > 0 && (
                    <div className="absolute left-4 right-4 top-[84px] z-30 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl shadow-2xl max-h-72 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800 animate-in fade-in zoom-in-95 duration-150">
                      {filteredProducts.length === 0 ? (
                        <div className="p-4 text-center text-xs text-neutral-500">
                          No se encontraron artículos con "{productSearch}". Intente con otra palabra clave o revise la pestaña de Dropbox.
                        </div>
                      ) : (
                        filteredProducts.map((prod) => (
                          <div
                            key={prod.id}
                            onClick={() => handleSelectProduct(prod)}
                            className="p-3 hover:bg-indigo-50 dark:hover:bg-neutral-800/80 cursor-pointer transition-colors flex items-center justify-between gap-3"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-neutral-900 dark:text-neutral-100 truncate">
                                  {prod.item}
                                </span>
                                {prod.brand && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                                    {prod.brand}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                                <span>{prod.category}</span>
                                {prod.gift && (
                                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                                    <Gift className="w-3 h-3" /> Regalo
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className="text-xs font-black text-indigo-600 dark:text-indigo-400">
                                Contado: ${prod.minStorePrice.toFixed(2)}
                              </div>
                              <div className="text-[11px] text-neutral-500">
                                Crédito: ${prod.creditPrice.toFixed(2)} (hasta {prod.maxMonths}m)
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* 2. Selected Article Configuration Card (Dynamic Credit Calculation) */}
                {selectedProduct ? (
                  <div className="bg-white dark:bg-neutral-900 border-2 border-indigo-500/40 rounded-3xl p-5 shadow-lg space-y-5 animate-in fade-in duration-200">
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 uppercase">
                            {selectedProduct.category}
                          </span>
                          {selectedProduct.brand && (
                            <span className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                              {selectedProduct.brand}
                            </span>
                          )}
                          {selectedProduct.updateDate && (
                            <span className="text-[11px] text-neutral-400 flex items-center gap-1">
                              <Calendar className="w-3 h-3" /> Actualizado: {selectedProduct.updateDate}
                            </span>
                          )}
                        </div>
                        <h3 className="text-lg font-black text-neutral-900 dark:text-neutral-50 mt-1">
                          {selectedProduct.item}
                        </h3>
                      </div>

                      <button
                        onClick={() => setSelectedProduct(null)}
                        className="p-1.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Gift Notification Banner */}
                    {selectedProduct.gift && (
                      <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 p-3 rounded-2xl flex items-center gap-3 text-emerald-800 dark:text-emerald-300">
                        <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center flex-shrink-0 text-emerald-600 dark:text-emerald-400">
                          <Gift className="w-4 h-4" />
                        </div>
                        <div className="text-xs">
                          <span className="font-bold">Obsequio Incluido con este artículo:</span>
                          <p className="text-emerald-700 dark:text-emerald-400 font-medium">{selectedProduct.gift}</p>
                        </div>
                      </div>
                    )}

                    {/* Quick Prices Overview (Piso Vendedor Confidencial + Crédito Base) */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-2xl border border-amber-200 dark:border-amber-800/40">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase text-amber-700 dark:text-amber-400 flex items-center gap-1">
                            <Lock className="w-3 h-3" /> Piso Vendedor
                          </span>
                          <span className="text-[9px] px-1 py-0.2 rounded font-bold bg-amber-200 dark:bg-amber-900 text-amber-800 dark:text-amber-200">
                            Interno
                          </span>
                        </div>
                        <p className="text-lg font-black text-amber-900 dark:text-amber-200 mt-1">
                          ${selectedProduct.minStorePrice.toFixed(2)}
                        </p>
                        <p className="text-[10px] font-mono font-bold text-amber-700 dark:text-amber-300 truncate mt-0.5" title="Código de referencia interna para no bajar de este precio">
                          Ref: {selectedProduct.internalCode || generateInternalItemCode(selectedProduct.item, selectedProduct.brand, selectedProduct.minStorePrice)}
                        </p>
                      </div>

                      <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-2xl border border-indigo-200 dark:border-indigo-800/40">
                        <span className="text-[10px] font-black uppercase text-indigo-700 dark:text-indigo-400">Precio Crédito Base</span>
                        <p className="text-lg font-black text-indigo-900 dark:text-indigo-200 mt-1">
                          ${selectedProduct.creditPrice.toFixed(2)}
                        </p>
                        <p className="text-[10px] text-indigo-500 dark:text-indigo-300 mt-0.5">
                          Plazo máx: {selectedProduct.maxMonths} meses
                        </p>
                      </div>
                    </div>

                    {/* DYNAMIC PLAN SELECTOR (Strictly bounded by maxMonths) */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-xs font-black uppercase tracking-wider text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-indigo-500" />
                          Plazos Disponibles para este Artículo
                        </label>
                        <span className="text-[10px] text-neutral-400 font-medium">
                          Máximo permitido: {selectedProduct.maxMonths} meses
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {selectedProduct.plans
                          .filter(p => selectedProduct.maxMonths === 0 || p.months <= selectedProduct.maxMonths)
                          .map((plan) => {
                          const isSelected = selectedPlanMonths === plan.months;
                          return (
                            <button
                              key={plan.months}
                              type="button"
                              onClick={() => {
                                setSelectedPlanMonths(plan.months);
                                setCustomDownPayment(plan.downPayment);
                              }}
                              className={`p-3 rounded-2xl text-left border transition-all cursor-pointer relative ${
                                isSelected
                                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-500/30'
                                  : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700 hover:border-indigo-400'
                              }`}
                            >
                              <div className="flex justify-between items-start">
                                <span className={`text-xs font-black ${isSelected ? 'text-white' : 'text-neutral-900 dark:text-neutral-100'}`}>
                                  {plan.months} Meses
                                </span>
                                {plan.isMaxTerm && (
                                  <span className={`text-[9px] px-1 py-0.2 rounded font-bold uppercase ${isSelected ? 'bg-indigo-700 text-indigo-100' : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-500'}`}>
                                    Máx
                                  </span>
                                )}
                              </div>
                              <div className={`text-[11px] font-bold mt-1 ${isSelected ? 'text-indigo-100' : 'text-indigo-600 dark:text-indigo-400'}`}>
                                Cuota: ${plan.monthlyPayment.toFixed(2)}/m
                              </div>
                              <div className={`text-[10px] mt-0.5 ${isSelected ? 'text-indigo-200' : 'text-neutral-400'}`}>
                                Total: ${plan.totalPrice.toFixed(2)}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* DYNAMIC DOWN PAYMENT ADJUSTMENT (Core requirement C & 5.2) */}
                    <div className="p-4 bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-xs font-black text-indigo-950 dark:text-indigo-200 uppercase tracking-wider flex items-center gap-1.5">
                            <DollarSign className="w-3.5 h-3.5 text-indigo-600" />
                            Entrada Pactada & Recálculo en Vivo
                          </h4>
                          <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                            Modifique la entrada para calcular la cuota exacta que pagará el cliente
                          </p>
                        </div>
                        {currentPlan && customDownPayment !== currentPlan.downPayment && (
                          <button
                            type="button"
                            onClick={() => setCustomDownPayment(currentPlan.downPayment)}
                            className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline font-bold"
                          >
                            Restablecer entrada sugerida (${currentPlan.downPayment})
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                        <div>
                          <label className="text-[10px] font-bold text-neutral-600 dark:text-neutral-300 uppercase block mb-1">
                            Entrada ($)
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-2 text-sm font-bold text-neutral-400">$</span>
                            <input
                              type="number"
                              min="0"
                              step="5"
                              value={customDownPayment}
                              onChange={(e) => setCustomDownPayment(parseFloat(e.target.value) || 0)}
                              className="w-full bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-xl pl-7 pr-3 py-1.5 text-sm font-black text-neutral-900 dark:text-neutral-100 outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-neutral-600 dark:text-neutral-300 uppercase block mb-1">
                            Saldo a Financiar
                          </label>
                          <div className="py-2 px-3 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 text-sm font-black text-neutral-900 dark:text-neutral-100">
                            ${Math.max(0, (currentPlan ? currentPlan.totalPrice : selectedProduct.creditPrice) - customDownPayment).toFixed(2)}
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase block mb-1">
                            Nueva Cuota Calculada
                          </label>
                          <div className="py-2 px-3 bg-indigo-600 text-white rounded-xl shadow-sm text-sm font-black flex items-center justify-between">
                            <span>${liveCalculatedQuota.toFixed(2)}</span>
                            <span className="text-[10px] font-medium opacity-80">x {selectedPlanMonths} meses</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-[10px] text-neutral-500 dark:text-neutral-400 bg-white/70 dark:bg-neutral-900/60 p-2 rounded-xl border border-neutral-200/60 dark:border-neutral-800/60 flex items-center justify-between">
                        <span>Fórmula aplicada: <code>(Precio Crédito - Entrada) / {selectedPlanMonths} meses</code></span>
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">
                          Total a Pagar: ${(customDownPayment + (liveCalculatedQuota * selectedPlanMonths)).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Quantity and Add Button */}
                    <div className="flex items-center gap-3 pt-2">
                      <div className="w-28">
                        <label className="text-[10px] font-black uppercase text-neutral-500 block mb-1">Cantidad</label>
                        <input
                          type="number"
                          min="1"
                          max="99"
                          value={itemQuantity}
                          onChange={(e) => setItemQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-full bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl px-3 py-2 text-sm font-bold text-neutral-900 dark:text-neutral-100 outline-none"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handleAddItemToProforma}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2.5 px-4 rounded-xl text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer mt-5"
                      >
                        <Plus className="w-4 h-4" />
                        Agregar a la Proforma
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-neutral-50 dark:bg-neutral-800/20 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-3xl p-8 text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 flex items-center justify-center mx-auto">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-neutral-700 dark:text-neutral-300">
                        Seleccione un artículo para cotizar
                      </h4>
                      <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
                        Use el buscador arriba para elegir cualquier artículo de la lista de precios. Los plazos de crédito y cuotas se cargarán automáticamente.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Client details & Proforma Summary */}
              <div className="lg:col-span-5 space-y-6">

                {/* 1. Client and Seller Information */}
                <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-5 shadow-sm space-y-4">
                  <h3 className="text-xs font-black uppercase tracking-wider text-neutral-900 dark:text-white flex items-center gap-2">
                    <User className="w-4 h-4 text-indigo-500" />
                    Datos del Cliente & Asesor
                  </h3>

                  {/* Client Search / Selector */}
                  <div className="relative">
                    <label className="text-[10px] font-bold text-neutral-500 block mb-1 uppercase">
                      Buscar Cliente Registrado
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={clientSearch}
                        onFocus={() => setShowClientSuggestions(true)}
                        onChange={(e) => {
                          setClientSearch(e.target.value);
                          setShowClientSuggestions(true);
                        }}
                        placeholder="Nombre, cédula o teléfono..."
                        className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl px-3 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500 text-neutral-900 dark:text-neutral-100"
                      />
                      {selectedClient && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedClient(null);
                            setClientCustomName('Consumidor Final');
                            setClientCustomIdCard('');
                            setClientCustomPhone('');
                          }}
                          className="absolute right-2.5 top-2 text-xs text-neutral-400 hover:text-neutral-600"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Client Dropdown */}
                    {showClientSuggestions && filteredClients.length > 0 && (
                      <div className="absolute left-0 right-0 top-14 z-20 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-xl max-h-48 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800">
                        {filteredClients.map(c => (
                          <div
                            key={c.id}
                            onClick={() => handlePickClient(c)}
                            className="p-2 hover:bg-neutral-50 dark:hover:bg-neutral-800 cursor-pointer text-xs"
                          >
                            <span className="font-bold text-neutral-900 dark:text-white">
                              {c.firstName} {c.lastName}
                            </span>
                            <div className="text-[10px] text-neutral-500 flex items-center gap-2">
                              <span>C.I: {c.idCard || 'N/A'}</span>
                              {c.phone && <span>Tel: {c.phone}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Manual Client Fields */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="text-[10px] font-bold text-neutral-500 block mb-0.5">Nombre / Razón Social</label>
                      <input
                        type="text"
                        value={clientCustomName}
                        onChange={(e) => setClientCustomName(e.target.value)}
                        className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl p-2 text-xs font-medium text-neutral-900 dark:text-neutral-100 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-neutral-500 block mb-0.5">Cédula / RUC</label>
                      <input
                        type="text"
                        value={clientCustomIdCard}
                        onChange={(e) => setClientCustomIdCard(e.target.value)}
                        placeholder="Opcional"
                        className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl p-2 text-xs font-medium text-neutral-900 dark:text-neutral-100 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-neutral-500 block mb-0.5">Teléfono / WhatsApp</label>
                      <input
                        type="text"
                        value={clientCustomPhone}
                        onChange={(e) => setClientCustomPhone(e.target.value)}
                        placeholder="099..."
                        className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl p-2 text-xs font-medium text-neutral-900 dark:text-neutral-100 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-neutral-500 block mb-0.5">Asesor Asignado</label>
                      <select
                        value={selectedSellerId}
                        onChange={(e) => setSelectedSellerId(e.target.value)}
                        className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl p-2 text-xs font-medium text-neutral-900 dark:text-neutral-100 outline-none"
                      >
                        {employees.map(emp => (
                          <option key={emp.id} value={emp.id}>
                            {emp.name} {emp.lastName}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* 2. Items in Current Proforma Cart */}
                <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-5 shadow-sm space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-black uppercase tracking-wider text-neutral-900 dark:text-white flex items-center gap-2">
                      <Layers className="w-4 h-4 text-indigo-500" />
                      Artículos en la Proforma ({proformaItems.length})
                    </h3>
                    {proformaItems.length > 0 && (
                      <button
                        onClick={() => {
                          setProformaItems([]);
                          setIsComboActive(false);
                          setComboCustomDownPayment(null);
                        }}
                        className="text-[10px] text-rose-500 hover:underline font-bold cursor-pointer"
                      >
                        Vaciar proforma
                      </button>
                    )}
                  </div>

                  {/* Combo Activation Card (Available when 2 or more items exist) */}
                  {proformaItems.length >= 2 && (
                    <div className={`p-4 rounded-2xl border-2 transition-all ${
                      isComboActive 
                        ? 'bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-amber-500/10 border-amber-500/60 shadow-md'
                        : hasDifferentTerms
                          ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700/60'
                          : 'bg-neutral-50 dark:bg-neutral-800/40 border-neutral-200 dark:border-neutral-700/60'
                    }`}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                            isComboActive 
                              ? 'bg-amber-500 text-neutral-950 shadow-sm animate-pulse'
                              : 'bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400'
                          }`}>
                            <Flame className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black uppercase text-neutral-900 dark:text-white tracking-wide">
                                Proforma Combo
                              </span>
                              {hasDifferentTerms && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-400/30 uppercase">
                                  Plazos Distintos ({minTermInItems}m y {maxTermInItems}m)
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                              {isComboActive 
                                ? 'Valores y fechas unificados a una sola cuota mensual recurrente.'
                                : 'Unifique el plazo al mayor tiempo, adapte cuotas y consolide la entrada.'}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            if (!isComboActive) {
                              setIsComboActive(true);
                              setComboTargetMonths(maxTermInItems);
                              setComboCustomDownPayment(null);
                              showToast(`¡Proforma Combo Activada! Artículos adaptados a ${maxTermInItems} meses.`, 'success');
                            } else {
                              setIsComboActive(false);
                              setComboCustomDownPayment(null);
                              showToast('Modo Combo desactivado.', 'info');
                            }
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer shadow-sm flex items-center gap-1.5 flex-shrink-0 ${
                            isComboActive
                              ? 'bg-amber-500 hover:bg-amber-600 text-neutral-950 ring-2 ring-amber-400/50'
                              : 'bg-neutral-900 hover:bg-black text-white dark:bg-white dark:text-neutral-900'
                          }`}
                        >
                          <Flame className="w-3.5 h-3.5" />
                          {isComboActive ? 'Combo Activo' : 'Activar Combo'}
                        </button>
                      </div>

                      {/* Active Combo Controls */}
                      {isComboActive && (
                        <div className="mt-4 pt-3 border-t border-amber-200 dark:border-amber-900/60 space-y-3 animate-in fade-in duration-150">
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div>
                              <label className="text-[10px] font-bold text-neutral-600 dark:text-neutral-300 block mb-1 uppercase">
                                Plazo Unificado (Meses)
                              </label>
                              <select
                                value={comboTargetMonths}
                                onChange={(e) => setComboTargetMonths(parseInt(e.target.value, 10))}
                                className="w-full bg-white dark:bg-neutral-900 border border-amber-300 dark:border-amber-700 rounded-xl p-2 text-xs font-black text-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500"
                              >
                                {[3, 6, 10, 12, 14, 15, 18, 20, 22, 24, 26, 28, 30, 36]
                                  .filter(m => m >= minTermInItems || m === maxTermInItems)
                                  .map(m => (
                                    <option key={m} value={m}>
                                      {m} meses {m === maxTermInItems ? '(Mayor plazo detectado)' : ''}
                                    </option>
                                  ))}
                              </select>
                            </div>

                            <div>
                              <div className="flex justify-between items-center mb-1">
                                <label className="text-[10px] font-bold text-neutral-600 dark:text-neutral-300 uppercase">
                                  Entrada Total Unificada ($)
                                </label>
                                {comboCustomDownPayment !== null && (
                                  <button
                                    type="button"
                                    onClick={() => setComboCustomDownPayment(null)}
                                    className="text-[9px] text-indigo-600 dark:text-indigo-400 hover:underline font-bold cursor-pointer"
                                    title="Restablecer a la suma de entradas individuales"
                                  >
                                    Restablecer
                                  </button>
                                )}
                              </div>
                              <input
                                type="number"
                                min="0"
                                step="5"
                                value={comboCustomDownPayment !== null ? comboCustomDownPayment : proformaTotals.totalDownPayment}
                                onChange={(e) => {
                                  const val = e.target.value === '' ? 0 : Math.max(0, parseFloat(e.target.value) || 0);
                                  setComboCustomDownPayment(val);
                                }}
                                className="w-full bg-white dark:bg-neutral-900 border border-amber-300 dark:border-amber-700 rounded-xl p-2 text-xs font-black text-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500"
                              />
                            </div>
                          </div>

                          {/* Live Combo Results Box */}
                          <div className="p-2.5 bg-amber-500/10 rounded-xl border border-amber-400/30 flex items-center justify-between text-xs">
                            <div>
                              <span className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase font-bold block">
                                Cuota Mensual Unificada
                              </span>
                              <span className="font-black text-amber-600 dark:text-amber-400 text-sm">
                                ${activeTotals.totalMonthlyQuotas.toFixed(2)} / mes
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase font-bold block">
                                Plan Consolidado
                              </span>
                              <span className="font-bold text-neutral-800 dark:text-neutral-200">
                                {comboTargetMonths} cuotas de pago único
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {proformaItems.length === 0 ? (
                    <div className="p-6 text-center text-xs text-neutral-400 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl">
                      Aún no hay artículos cotizados. Busque un producto a la izquierda para agregarlo.
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                      {activeProformaItems.map((item, idx) => (
                        <div key={item.id}>
                          {editingCartItemIndex === idx ? (
                            /* Inline Edit Mode */
                            <div className="p-3 bg-indigo-50/90 dark:bg-indigo-950/50 border-2 border-indigo-500 rounded-2xl space-y-3 animate-in fade-in duration-150">
                              <div className="flex justify-between items-center text-xs">
                                <span className="font-bold text-indigo-950 dark:text-indigo-200 truncate">
                                  Editar: {item.item}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setEditingCartItemIndex(null)}
                                  className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>

                              <div className="grid grid-cols-3 gap-2">
                                <div>
                                  <label className="text-[10px] font-bold text-neutral-600 dark:text-neutral-300 block mb-0.5">Plazo</label>
                                  <select
                                    value={editItemMonths}
                                    onChange={(e) => setEditItemMonths(parseInt(e.target.value, 10))}
                                    className="w-full bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-xl p-1.5 text-xs font-bold text-neutral-900 dark:text-neutral-100 outline-none"
                                  >
                                    {(() => {
                                      const prod = catalog.find(c => c.id === item.priceListItemId);
                                      const plans = (prod?.plans || []).filter(p => !prod?.maxMonths || p.months <= prod.maxMonths);
                                      if (plans.length > 0) {
                                        return plans.map(p => (
                                          <option key={p.months} value={p.months}>
                                            {p.months} meses
                                          </option>
                                        ));
                                      }
                                      return (
                                        <>
                                          <option value={3}>3 meses</option>
                                          <option value={6}>6 meses</option>
                                          <option value={item.selectedPlanMonths}>{item.selectedPlanMonths} meses</option>
                                        </>
                                      );
                                    })()}
                                  </select>
                                </div>

                                <div>
                                  <label className="text-[10px] font-bold text-neutral-600 dark:text-neutral-300 block mb-0.5">Entrada ($)</label>
                                  <input
                                    type="number"
                                    min="0"
                                    step="5"
                                    value={editItemDownPayment}
                                    onChange={(e) => setEditItemDownPayment(Math.max(0, parseFloat(e.target.value) || 0))}
                                    className="w-full bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-xl p-1.5 text-xs font-bold text-neutral-900 dark:text-neutral-100 outline-none"
                                  />
                                </div>

                                <div>
                                  <label className="text-[10px] font-bold text-neutral-600 dark:text-neutral-300 block mb-0.5">Cantidad</label>
                                  <input
                                    type="number"
                                    min="1"
                                    value={editItemQuantity}
                                    onChange={(e) => setEditItemQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                                    className="w-full bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-xl p-1.5 text-xs font-bold text-neutral-900 dark:text-neutral-100 outline-none"
                                  />
                                </div>
                              </div>

                              <div className="flex justify-between items-center pt-2 border-t border-indigo-200 dark:border-indigo-900/60 text-xs">
                                <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300">
                                  Nueva Cuota: ${(() => {
                                    const prod = catalog.find(c => c.id === item.priceListItemId);
                                    const plan = prod?.plans.find(p => p.months === editItemMonths);
                                    const baseCredit = plan ? plan.totalPrice : item.totalCreditPrice;
                                    return calculateDynamicQuota(baseCredit, editItemDownPayment, editItemMonths).toFixed(2);
                                  })()}/m
                                </span>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setEditingCartItemIndex(null)}
                                    className="px-2.5 py-1 text-xs text-neutral-500 hover:text-neutral-700 font-medium cursor-pointer"
                                  >
                                    Cancelar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleSaveEditCartItem}
                                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm cursor-pointer"
                                  >
                                    Guardar Cambios
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            /* Standard View Mode */
                            <div className={`p-3 border rounded-2xl flex items-center justify-between gap-3 text-xs transition-colors ${
                              isComboActive 
                                ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/60'
                                : 'bg-neutral-50 dark:bg-neutral-800/60 border-neutral-200 dark:border-neutral-700/60'
                            }`}>
                              <div className="flex-1 min-w-0">
                                <div className="font-bold text-neutral-900 dark:text-white truncate flex items-center gap-2">
                                  <span>{item.quantity > 1 ? `${item.quantity}x ` : ''}{item.item}</span>
                                  {isComboActive && (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 flex items-center gap-0.5">
                                      <Flame className="w-2.5 h-2.5 text-amber-500" /> Combo
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-neutral-500 flex items-center gap-2 flex-wrap mt-0.5">
                                  <span>Plazo: <strong>{item.selectedPlanMonths}m</strong></span>
                                  {isComboActive && item.originalPlanMonths && item.originalPlanMonths !== item.selectedPlanMonths && (
                                    <span className="text-[10px] text-amber-700 dark:text-amber-400 font-bold bg-amber-100/80 dark:bg-amber-900/40 px-1 rounded">
                                      Adaptado de {item.originalPlanMonths}m
                                    </span>
                                  )}
                                  <span>• Entrada: <strong>${item.downPayment.toFixed(2)}</strong></span>
                                  <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                                    Cuota: ${item.calculatedQuota.toFixed(2)}/m
                                  </span>
                                  {item.internalCode && (
                                    <span className="text-[10px] text-amber-700 dark:text-amber-400 font-mono font-bold bg-amber-100 dark:bg-amber-950/60 px-1.5 py-0.2 rounded" title="Código de referencia interna de precio piso">
                                      Ref: {item.internalCode}
                                    </span>
                                  )}
                                </div>
                                {item.gift && (
                                  <div className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-0.5">
                                    <Gift className="w-3 h-3" /> Regalo: {item.gift}
                                  </div>
                                )}
                              </div>

                              <div className="text-right flex items-center gap-1.5 flex-shrink-0">
                                <div className="font-black text-neutral-900 dark:text-white text-xs mr-1">
                                  ${(item.totalCreditPrice * item.quantity).toFixed(2)}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleStartEditCartItem(idx)}
                                  className="p-1.5 text-neutral-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
                                  title="Editar plazo, entrada o cantidad"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(idx)}
                                  className="p-1.5 text-neutral-400 hover:text-rose-500 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
                                  title="Eliminar de la proforma"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Financial Summary (Only Credit, Down Payment and Balance - Floor cash price is hidden) */}
                  {proformaItems.length > 0 && (
                    <div className="bg-neutral-900 text-white p-4 rounded-2xl space-y-2 text-xs">
                      {isComboActive && (
                        <div className="flex items-center gap-1.5 text-amber-400 font-black pb-1.5 border-b border-neutral-800 text-[11px] uppercase tracking-wider">
                          <Flame className="w-3.5 h-3.5" />
                          <span>Resumen Proforma Combo ({comboTargetMonths} Meses)</span>
                        </div>
                      )}
                      <div className="flex justify-between text-neutral-300">
                        <span>Total Venta a Crédito:</span>
                        <span className="font-bold text-white">${activeTotals.totalCredit.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-emerald-400">
                        <span>{isComboActive ? 'Entrada Total Unificada:' : 'Total Entradas Requeridas:'}</span>
                        <span className="font-bold">${activeTotals.totalDownPayment.toFixed(2)}</span>
                      </div>
                      <div className="border-t border-neutral-800 pt-2 flex justify-between font-black text-sm">
                        <span>Saldo Total a Financiar:</span>
                        <span className="text-indigo-400">${activeTotals.totalFinanced.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-xs font-bold text-neutral-300">
                        <span>{isComboActive ? 'Cuota Mensual Única Consolidada:' : 'Suma de Cuotas Mensuales:'}</span>
                        <span className={isComboActive ? 'text-amber-400 font-black text-sm' : ''}>
                          ${activeTotals.totalMonthlyQuotas.toFixed(2)} / mes
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <button
                      type="button"
                      onClick={handleOpenPreview}
                      disabled={proformaItems.length === 0}
                      className="p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-bold text-neutral-800 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40 cursor-pointer"
                    >
                      <Eye className="w-4 h-4 text-indigo-500" />
                      Vista Previa / Imprimir
                    </button>

                    <button
                      type="button"
                      onClick={() => handleShareWhatsApp()}
                      disabled={proformaItems.length === 0}
                      className="p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-sm disabled:opacity-40 cursor-pointer"
                    >
                      <Share2 className="w-4 h-4" />
                      WhatsApp
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveProforma}
                    disabled={proformaItems.length === 0}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-2.5 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md transition-all disabled:opacity-40 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Guardar Proforma Oficial
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 2: HISTORIAL DE PROFORMAS                          */}
          {/* ======================================================== */}
          {activeTab === 'historial' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3.5 top-3 w-4 h-4 text-neutral-400" />
                  <input
                    type="text"
                    value={proformaHistoryFilter}
                    onChange={(e) => setProformaHistoryFilter(e.target.value)}
                    placeholder="Filtrar por número, cliente o asesor..."
                    className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl pl-10 pr-3 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                </div>

                <button
                  onClick={loadInitialData}
                  className="px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-neutral-400" />
                  Actualizar Lista
                </button>
              </div>

              {savedProformas.length === 0 ? (
                <div className="bg-neutral-50 dark:bg-neutral-800/20 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-12 text-center text-neutral-400 space-y-2">
                  <FileText className="w-8 h-8 mx-auto text-neutral-400 opacity-60" />
                  <p className="font-bold text-sm">No se han emitido proformas todavía</p>
                  <p className="text-xs">Genere su primera cotización desde la pestaña "Nueva Proforma / Cotizador".</p>
                </div>
              ) : (
                <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-neutral-50 dark:bg-neutral-800/50 text-neutral-500 uppercase font-black tracking-wider text-[10px] border-b border-neutral-200 dark:border-neutral-800">
                        <tr>
                          <th className="py-3 px-4">No. Proforma</th>
                          <th className="py-3 px-4">Fecha</th>
                          <th className="py-3 px-4">Cliente</th>
                          <th className="py-3 px-4">Artículos</th>
                          <th className="py-3 px-4 text-right">Total Crédito</th>
                          <th className="py-3 px-4 text-right">Entrada</th>
                          <th className="py-3 px-4 text-center">Estado</th>
                          <th className="py-3 px-4 text-center">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                        {savedProformas
                          .filter(p => {
                            if (!proformaHistoryFilter) return true;
                            const term = proformaHistoryFilter.toLowerCase();
                            return (
                              p.proformaNumber.toLowerCase().includes(term) ||
                              p.clientName.toLowerCase().includes(term) ||
                              p.sellerName.toLowerCase().includes(term)
                            );
                          })
                          .map((prof) => (
                            <tr key={prof.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                              <td className="py-3 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span>{prof.proformaNumber}</span>
                                  {prof.isCombo && (
                                    <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 flex items-center gap-0.5 shadow-xs">
                                      <Flame className="w-2.5 h-2.5 text-amber-500" /> Combo {prof.comboMonths}m
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-4 text-neutral-500">
                                {prof.date}
                              </td>
                              <td className="py-3 px-4 font-bold text-neutral-900 dark:text-white">
                                {prof.clientName}
                              </td>
                              <td className="py-3 px-4 text-neutral-600 dark:text-neutral-400 max-w-xs truncate">
                                {prof.items.map(it => it.item).join(', ')}
                              </td>
                              <td className="py-3 px-4 text-right font-black text-neutral-900 dark:text-white">
                                ${prof.totalCredit.toFixed(2)}
                              </td>
                              <td className="py-3 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                                ${prof.totalDownPayment.toFixed(2)}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  prof.status === 'COTIZADA'
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                    : prof.status === 'ACEPTADA'
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                    : 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
                                }`}>
                                  {prof.status}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => setPreviewProforma(prof)}
                                    className="p-1.5 text-neutral-500 hover:text-indigo-600 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
                                    title="Ver e Imprimir"
                                  >
                                    <Printer className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleShareWhatsApp(prof)}
                                    className="p-1.5 text-neutral-500 hover:text-emerald-600 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
                                    title="Compartir por WhatsApp"
                                  >
                                    <Share2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 3: CONEXIÓN DROPBOX & LISTA DE PRECIOS             */}
          {/* ======================================================== */}
          {activeTab === 'dropbox' && (
            <div className="space-y-6">

              {/* Informative Header Banner */}
              <div className="bg-gradient-to-r from-blue-900/20 via-indigo-900/20 to-blue-900/20 border border-blue-200 dark:border-blue-900/40 p-5 rounded-3xl space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0">
                    <Link2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-blue-950 dark:text-blue-100">
                      Sincronización Automática con Excel de Dropbox
                    </h3>
                    <p className="text-xs text-blue-800/80 dark:text-blue-300">
                      Conecte el enlace público de Dropbox de su archivo de precios. El sistema descargará y procesará las columnas exactas de crédito.
                    </p>
                  </div>
                </div>

                <div className="bg-white/80 dark:bg-neutral-900/80 p-3 rounded-2xl text-xs space-y-1.5 border border-blue-100 dark:border-blue-950">
                  <span className="font-bold text-neutral-800 dark:text-neutral-200">
                    Estructura de Encabezados Soportada:
                  </span>
                  <div className="flex flex-wrap gap-1 text-[11px] font-mono text-indigo-600 dark:text-indigo-400">
                    {['CATEGORIA', 'REGALO', 'ITEMS', 'MARCA', 'MIN/ALMACEN', 'CREDITO', 'ENTRADA', 'MESES', 'CUOTA', '3 MESES', 'ENTRADA3', 'MENSUAL', '6 MESES', 'ENTRADA4', 'MENSUAL3', '12 MESES', 'ENTRAD', 'MENSUAL2', 'FECHA'].map(col => (
                      <span key={col} className="px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded border border-neutral-200 dark:border-neutral-700">
                        {col}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Dropbox URL Input & Sync Action */}
              <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm space-y-4">
                <label className="block text-xs font-black uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                  Enlace de Compartir de Dropbox (.xlsx)
                </label>

                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Link2 className="absolute left-3.5 top-3.5 w-4 h-4 text-neutral-400" />
                    <input
                      type="url"
                      value={dropboxUrlInput}
                      onChange={(e) => setDropboxUrlInput(e.target.value)}
                      placeholder="https://www.dropbox.com/scl/fi/.../precios.xlsx?dl=0"
                      className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl pl-10 pr-4 py-3 text-xs outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-neutral-900 dark:text-white"
                    />
                  </div>

                  <button
                    onClick={handleSyncDropbox}
                    disabled={isSyncing}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-6 py-3 rounded-2xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md transition-all disabled:opacity-50 cursor-pointer flex-shrink-0"
                  >
                    <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                    {isSyncing ? 'Sincronizando...' : 'Sincronizar Ahora'}
                  </button>
                </div>

                {/* Local Excel upload alternative */}
                <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                  <div className="text-neutral-500">
                    ¿Prefiere subir el archivo manualmente desde su computadora?
                  </div>
                  <div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept=".xlsx,.xls"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isSyncing}
                      className="px-4 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 font-bold hover:bg-neutral-50 dark:hover:bg-neutral-800 flex items-center gap-2 text-neutral-700 dark:text-neutral-300 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Subir archivo Excel local (.xlsx)
                    </button>
                  </div>
                </div>
              </div>

              {/* Catalog Inspector Table */}
              <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-5 shadow-sm space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-sm font-black text-neutral-900 dark:text-white">
                      Artículos Sincronizados en Memoria ({catalog.length})
                    </h3>
                    {config.lastSyncAt && (
                      <p className="text-[11px] text-neutral-400">
                        Última sincronización: {format(new Date(config.lastSyncAt), 'dd/MM/yyyy HH:mm:ss')}
                      </p>
                    )}
                  </div>
                </div>

                <div className="overflow-x-auto max-h-96 border border-neutral-100 dark:border-neutral-800 rounded-2xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-neutral-50 dark:bg-neutral-800/80 sticky top-0 text-[10px] font-black uppercase text-neutral-500 tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3">Categoría</th>
                        <th className="py-2.5 px-3">Artículo (ITEMS)</th>
                        <th className="py-2.5 px-3">Marca</th>
                        <th className="py-2.5 px-3">Regalo</th>
                        <th className="py-2.5 px-3 text-right">Contado Mín.</th>
                        <th className="py-2.5 px-3 text-right">Crédito Base</th>
                        <th className="py-2.5 px-3 text-center">Plazo Máx.</th>
                        <th className="py-2.5 px-3">Planes Detectados</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                      {catalog.map((item) => (
                        <tr key={item.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40">
                          <td className="py-2 px-3 text-neutral-500 text-[11px]">{item.category}</td>
                          <td className="py-2 px-3 font-bold text-neutral-900 dark:text-white">{item.item}</td>
                          <td className="py-2 px-3 text-neutral-600 dark:text-neutral-400">{item.brand || '-'}</td>
                          <td className="py-2 px-3 text-emerald-600 dark:text-emerald-400 font-medium">{item.gift || '-'}</td>
                          <td className="py-2 px-3 text-right font-bold">${item.minStorePrice.toFixed(2)}</td>
                          <td className="py-2 px-3 text-right font-black text-indigo-600 dark:text-indigo-400">${item.creditPrice.toFixed(2)}</td>
                          <td className="py-2 px-3 text-center font-bold">{item.maxMonths}m</td>
                          <td className="py-2 px-3">
                            <div className="flex gap-1 flex-wrap">
                              {item.plans.map(p => (
                                <span key={p.months} className="px-1.5 py-0.2 rounded text-[10px] bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                  {p.months}m: ${p.monthlyPayment.toFixed(0)}/m
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

        </div>

      </div>

      {/* ======================================================== */}
      {/* MODAL DE VISTA PREVIA E IMPRESIÓN FORMAL DE PROFORMA     */}
      {/* ======================================================== */}
      {previewProforma && (
        <div 
          onClick={(e) => { if (e.target === e.currentTarget) setPreviewProforma(null); }}
          className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-150"
        >
          <div className="bg-white text-neutral-900 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col my-6 border border-neutral-200">
            
            {/* Top Action Bar (Print / PDF / Prominent Return Button) */}
            <div className="p-4 bg-neutral-900 text-white flex flex-wrap justify-between items-center gap-3 print:hidden">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setPreviewProforma(null)}
                  className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-black flex items-center gap-2 transition-colors cursor-pointer border border-neutral-700 shadow-sm"
                  title="Volver al cotizador sin perder ningún artículo ni dato"
                >
                  <ArrowLeft className="w-4 h-4 text-amber-400" />
                  <span>← Regresar a la Proforma (Seguir Editando)</span>
                </button>
                <span className="hidden sm:inline-block text-xs text-neutral-400 font-mono">
                  {previewProforma.proformaNumber}
                </span>
                {previewProforma.isCombo && (
                  <span className="px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm">
                    <Flame className="w-3.5 h-3.5 text-amber-400" />
                    Proforma Combo ({previewProforma.comboMonths}m)
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={isExportingPdf}
                  className="px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-neutral-700 disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{isExportingPdf ? 'Generando PDF...' : 'Descargar PDF'}</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrintDocument}
                  disabled={isPrinting}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black flex items-center gap-1.5 transition-colors cursor-pointer shadow-md disabled:opacity-50"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>{isPrinting ? 'Preparando...' : 'Imprimir Proforma'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPreviewProforma(null)}
                  className="p-2 text-neutral-400 hover:text-white rounded-xl hover:bg-neutral-800 transition-colors cursor-pointer"
                  title="Cerrar vista previa y regresar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Document Sheet */}
            <div 
              ref={printAreaRef}
              className="p-8 sm:p-12 space-y-8 bg-white print:p-0 print:m-0" 
              id="printable-proforma"
            >
              
              {/* Document Header */}
              <div className="flex justify-between items-start border-b-2 border-neutral-900 pb-6">
                <div>
                  <h1 className="text-2xl font-black tracking-tight text-neutral-900 uppercase">
                    {enterpriseName}
                  </h1>
                  <p className="text-xs text-neutral-500 font-semibold mt-0.5">
                    Departamento de Ventas y Crédito Directo
                  </p>
                  <p className="text-[11px] text-neutral-400">
                    Matriz Comercial • Ecuador
                  </p>
                </div>

                <div className="text-right">
                  <div className="inline-block px-3 py-1 bg-neutral-900 text-white rounded-lg text-xs font-mono font-black">
                    {previewProforma.proformaNumber}
                  </div>
                  {previewProforma.isCombo && (
                    <div className="mt-1">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-md text-[10px] font-black uppercase tracking-wider">
                        🔥 Plan Combo ({previewProforma.comboMonths} Meses)
                      </span>
                    </div>
                  )}
                  <div className="text-xs text-neutral-600 mt-2 space-y-0.5">
                    <p><strong>Fecha:</strong> {previewProforma.date}</p>
                    <p><strong>Validez:</strong> Hasta {previewProforma.validUntil} (15 días)</p>
                  </div>
                </div>
              </div>

              {/* Client & Advisor Box */}
              <div className="grid grid-cols-2 gap-6 bg-neutral-50 p-4 rounded-2xl border border-neutral-200 text-xs">
                <div>
                  <span className="font-black text-neutral-400 uppercase text-[10px] block mb-1">Datos del Cliente</span>
                  <p className="font-black text-sm text-neutral-900">{previewProforma.clientName}</p>
                  <p className="text-neutral-600">C.I / RUC: {previewProforma.clientIdCard || 'Consumidor Final'}</p>
                  {previewProforma.clientPhone && <p className="text-neutral-600">Teléfono: {previewProforma.clientPhone}</p>}
                </div>
                <div>
                  <span className="font-black text-neutral-400 uppercase text-[10px] block mb-1">Asesor Comercial</span>
                  <p className="font-bold text-neutral-900">{previewProforma.sellerName}</p>
                  <p className="text-neutral-600">Atención Personalizada</p>
                  <p className="text-neutral-600">Estado: {previewProforma.status}</p>
                </div>
              </div>

              {/* Special Combo Notice & Terms Box */}
              {previewProforma.isCombo && (
                <div className="bg-amber-50/90 border border-amber-300 rounded-2xl p-4 text-xs space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-black text-amber-950 uppercase text-xs tracking-wider flex items-center gap-1.5">
                      ⭐ CONDICIONES ESPECIALES PLAN COMBO CONSOLIDADO
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 font-bold text-[10px]">
                      Plazo y Pagos Unificados
                    </span>
                  </div>
                  <p className="text-amber-900 text-[11px] leading-relaxed">
                    Los artículos de esta cotización han sido unificados bajo un solo plan de financiamiento a <strong>{previewProforma.comboMonths} meses</strong>. El cliente realiza una <strong>única entrada inicial</strong> y cancela <strong>una sola cuota mensual recurrente</strong> en una misma fecha fija de pago.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-amber-200/80">
                    <div className="bg-white/80 p-2 rounded-xl border border-amber-200">
                      <span className="text-[10px] text-amber-800 font-bold block uppercase">Entrada Unificada</span>
                      <span className="font-black text-sm text-neutral-900">${previewProforma.totalDownPayment.toFixed(2)}</span>
                    </div>
                    <div className="bg-white/80 p-2 rounded-xl border border-amber-200">
                      <span className="text-[10px] text-amber-800 font-bold block uppercase">Saldo Total Financiado</span>
                      <span className="font-black text-sm text-neutral-900">${previewProforma.totalFinanced.toFixed(2)}</span>
                    </div>
                    <div className="bg-amber-500 text-neutral-950 p-2 rounded-xl border border-amber-600 shadow-sm">
                      <span className="text-[10px] text-amber-950 font-black block uppercase">Cuota Mensual Única</span>
                      <span className="font-black text-base text-neutral-950">
                        ${(previewProforma.comboMonthlyQuota || (previewProforma.totalFinanced / (previewProforma.comboMonths || 12))).toFixed(2)} / mes
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Items Table */}
              <div>
                <table className="w-full text-left text-xs">
                  <thead className="border-b-2 border-neutral-900 font-black text-[10px] uppercase text-neutral-600">
                    <tr>
                      <th className="py-2.5">Cant</th>
                      <th className="py-2.5">Descripción del Artículo</th>
                      <th className="py-2.5">Obsequio</th>
                      <th className="py-2.5 text-center">Plazo</th>
                      <th className="py-2.5 text-right">Entrada</th>
                      <th className="py-2.5 text-right">Cuota Mensual</th>
                      <th className="py-2.5 text-right">Total Crédito</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {previewProforma.items.map((it, idx) => (
                      <tr key={idx} className="py-2">
                        <td className="py-2.5 font-bold align-top">{it.quantity}</td>
                        <td className="py-2.5 align-top">
                          <div className="font-bold text-neutral-900">{it.item}</div>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-neutral-500">
                            {it.brand && <span>Marca: {it.brand}</span>}
                            {it.internalCode && (
                              <span className="font-mono text-neutral-600 font-semibold bg-neutral-100 px-1 py-0.2 rounded">
                                Ref: {it.internalCode}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 text-emerald-700 font-semibold align-top">{it.gift || 'N/A'}</td>
                        <td className="py-2.5 text-center font-bold align-top">
                          {it.selectedPlanMonths} meses {previewProforma.isCombo ? '(Combo)' : ''}
                        </td>
                        <td className="py-2.5 text-right font-medium align-top">${(it.downPayment * it.quantity).toFixed(2)}</td>
                        <td className="py-2.5 text-right font-black text-indigo-700 align-top">
                          ${(it.calculatedQuota * it.quantity).toFixed(2)} / mes
                        </td>
                        <td className="py-2.5 text-right font-bold align-top">
                          ${(it.totalCreditPrice * it.quantity).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Financial Totals (Floor price hidden; only Credit, Down Payment and Financed Balance) */}
              <div className="flex justify-end">
                <div className="w-80 space-y-2 text-xs border-t-2 border-neutral-900 pt-3">
                  <div className="flex justify-between text-neutral-700">
                    <span className="font-semibold">Total Venta a Crédito:</span>
                    <span className="font-bold text-neutral-900">${previewProforma.totalCredit.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-700 font-bold">
                    <span>{previewProforma.isCombo ? 'Entrada Total Unificada:' : 'Entrada Total Pactada:'}</span>
                    <span>${previewProforma.totalDownPayment.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-black text-sm border-t border-neutral-300 pt-1.5 text-neutral-900">
                    <span>Saldo Financiado:</span>
                    <span className="text-indigo-700">${previewProforma.totalFinanced.toFixed(2)}</span>
                  </div>
                  {previewProforma.isCombo && (
                    <div className="flex justify-between items-center font-black text-xs text-amber-950 bg-amber-100 p-2.5 rounded-xl border border-amber-300 shadow-xs mt-1">
                      <span>Cuota Mensual Única Consolidada:</span>
                      <span className="text-sm">
                        ${(previewProforma.comboMonthlyQuota || (previewProforma.totalFinanced / (previewProforma.comboMonths || 12))).toFixed(2)} / mes
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Commercial Terms & Signatures */}
              <div className="border-t border-neutral-200 pt-6 text-[10px] text-neutral-500 space-y-2">
                <p><strong>Términos y Condiciones:</strong></p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>Esta proforma representa una cotización informativa y no constituye una factura definitiva ni reserva de stock.</li>
                  <li>Los valores a crédito y cuotas mensuales están sujetos a verificación crediticia y aprobación de cupo.</li>
                  <li>Los obsequios promocionales aplican exclusivamente para compras cerradas dentro del periodo de validez de esta proforma.</li>
                  {previewProforma.isCombo && (
                    <li className="font-bold text-amber-900">
                      Modalidad Proforma Combo: Todos los artículos están sincronizados a un único plazo de {previewProforma.comboMonths} meses, con una sola fecha fija de vencimiento mensual y cuota unificada.
                    </li>
                  )}
                </ul>

                <div className="grid grid-cols-2 gap-12 pt-12">
                  <div className="text-center border-t border-neutral-400 pt-2 font-bold text-neutral-800">
                    Firma del Asesor Comercial
                  </div>
                  <div className="text-center border-t border-neutral-400 pt-2 font-bold text-neutral-800">
                    Firma de Conformidad del Cliente
                  </div>
                </div>
              </div>

            </div>

            {/* Bottom Return Action Bar */}
            <div className="p-4 bg-neutral-50 border-t border-neutral-200 flex flex-col sm:flex-row justify-between items-center gap-3 print:hidden">
              <span className="text-xs text-neutral-500 font-medium">
                ¿Desea hacer cambios? Regrese a la pantalla de cotización para agregar más artículos o modificar valores.
              </span>
              <button
                type="button"
                onClick={() => setPreviewProforma(null)}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black flex items-center gap-2 transition-all shadow-md cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Regresar a Editar Proforma / Seguir Agregando</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
