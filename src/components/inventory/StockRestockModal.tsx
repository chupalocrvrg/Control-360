import React, { useState, useRef, useEffect } from 'react';
import { Article, Warehouse } from '../../types/inventory';
import { db, auth } from '../../firebase';
import { collection, doc, Timestamp, runTransaction } from 'firebase/firestore';
import { X, PackagePlus, FileText, Building2, CheckCircle2, Loader2, Sparkles, Search, Check, Tag } from 'lucide-react';
import { useNotification } from '../../contexts/NotificationContext';

interface StockRestockModalProps {
  isOpen: boolean;
  onClose: () => void;
  articles: Article[];
  warehouses: Warehouse[];
  currentEnterpriseId: string;
  userId?: string;
  onRefresh: () => void;
}

export default function StockRestockModal({
  isOpen,
  onClose,
  articles,
  warehouses,
  currentEnterpriseId,
  userId,
  onRefresh
}: StockRestockModalProps) {
  const { showToast } = useNotification();
  
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [selectedArticleId, setSelectedArticleId] = useState('');
  const [articleSearchQuery, setArticleSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [quantity, setQuantity] = useState<string>('');
  const [supplierName, setSupplierName] = useState('');
  const [notes, setNotes] = useState('');
  const [seriesInput, setSeriesInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Sincronizar automáticamente la bodega seleccionada cuando el modal se abre o cambian las bodegas
  useEffect(() => {
    if (isOpen && warehouses.length > 0) {
      if (!selectedWarehouseId || !warehouses.some(w => w.id === selectedWarehouseId)) {
        setSelectedWarehouseId(warehouses[0].id);
      }
    }
  }, [isOpen, warehouses, selectedWarehouseId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter articles predictively
  const filteredArticles = articles.filter(art => {
    if (!articleSearchQuery.trim()) return true;
    const query = articleSearchQuery.toLowerCase();
    const nameMatch = (art.name || '').toLowerCase().includes(query);
    const barcodeMatch = (art.barcode || '').toLowerCase().includes(query);
    const categoryMatch = (art.category || '').toLowerCase().includes(query);
    const brandMatch = (art.brand || '').toLowerCase().includes(query);
    const modelMatch = (art.model || '').toLowerCase().includes(query);
    return nameMatch || barcodeMatch || categoryMatch || brandMatch || modelMatch;
  });

  if (!isOpen) return null;

  const selectedArticle = articles.find(a => a.id === selectedArticleId);
  const effectiveWarehouseId = selectedWarehouseId || (warehouses.length > 0 ? warehouses[0].id : '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedArticleId) {
      showToast('Seleccione un artículo para recargar stock', 'warning');
      return;
    }

    if (!effectiveWarehouseId) {
      showToast('Seleccione la bodega de destino', 'warning');
      return;
    }

    const qtyNumber = parseFloat(quantity);
    if (isNaN(qtyNumber) || qtyNumber <= 0) {
      showToast('Ingrese una cantidad mayor a 0', 'warning');
      return;
    }

    setSubmitting(true);

    try {
      const newSeriesList = seriesInput
        .split(/[\n,;]+/)
        .map(s => s.trim().toUpperCase())
        .filter(Boolean);

      if (selectedArticle?.requiresSeries && newSeriesList.length > qtyNumber) {
        showToast(
          `Ha ingresado ${newSeriesList.length} series, pero la cantidad recibida en esta recarga es de ${qtyNumber} unidad(es). Solo puede ingresar hasta ${qtyNumber} series.`,
          'warning'
        );
        setSubmitting(false);
        return;
      }

      await runTransaction(db, async (transaction) => {
        // 1. Read article and warehouse_inventory
        const articleRef = doc(db, 'articles', selectedArticleId);
        const invId = `${effectiveWarehouseId}_${selectedArticleId}`;
        const invRef = doc(db, 'warehouse_inventory', invId);

        const articleSnap = await transaction.get(articleRef);
        const invSnap = await transaction.get(invRef);

        const currentArtQty = articleSnap.exists() ? (Number(articleSnap.data().quantity) || 0) : 0;
        const newArtQty = currentArtQty + qtyNumber;

        const currentInvQty = invSnap.exists() ? (Number(invSnap.data().quantity) || 0) : 0;
        const newInvQty = currentInvQty + qtyNumber;

        let artSeries = articleSnap.exists() && Array.isArray(articleSnap.data().seriesList) ? [...articleSnap.data().seriesList] : [];
        let invSeries = invSnap.exists() && Array.isArray(invSnap.data().seriesList) ? [...invSnap.data().seriesList] : [];

        if (newSeriesList.length > 0) {
          artSeries = Array.from(new Set([...artSeries, ...newSeriesList]));
          invSeries = Array.from(new Set([...invSeries, ...newSeriesList]));
        }

        const authUid = auth.currentUser?.uid || userId || currentEnterpriseId;
        const enterpriseTargetId = currentEnterpriseId || authUid;

        // 2. Update Article
        transaction.set(articleRef, {
          quantity: newArtQty,
          ...(newSeriesList.length > 0 ? { seriesList: artSeries } : {}),
          updatedAt: Timestamp.now(),
          userId: articleSnap.exists() && articleSnap.data()?.userId ? articleSnap.data().userId : authUid,
          enterpriseId: articleSnap.exists() && articleSnap.data()?.enterpriseId ? articleSnap.data().enterpriseId : enterpriseTargetId,
          createdBy: articleSnap.exists() && articleSnap.data()?.createdBy ? articleSnap.data().createdBy : authUid
        }, { merge: true });

        // 3. Update or set warehouse_inventory quantity and stock
        transaction.set(invRef, {
          id: invId,
          warehouseId: effectiveWarehouseId,
          articleId: selectedArticleId,
          quantity: newInvQty,
          stock: newInvQty,
          ...(newSeriesList.length > 0 ? { seriesList: invSeries } : {}),
          userId: authUid,
          enterpriseId: enterpriseTargetId,
          createdBy: authUid,
          lastInvoiceNumber: invoiceNumber.trim() || null,
          updatedAt: Timestamp.now()
        }, { merge: true });

        // 4. Create stock_movements log with Invoice Number
        const movementRef = doc(collection(db, 'stock_movements'));
        transaction.set(movementRef, {
          id: movementRef.id,
          articleId: selectedArticleId,
          articleName: selectedArticle?.name || 'Artículo',
          warehouseId: effectiveWarehouseId,
          type: 'IN', // Stock Inflow
          quantity: qtyNumber,
          invoiceNumber: invoiceNumber.trim() || 'S/N',
          supplierName: supplierName.trim() || 'Proveedor',
          notes: notes.trim() || 'Ingreso / Recarga de mercadería por factura',
          createdAt: Timestamp.now(),
          userId: authUid,
          enterpriseId: enterpriseTargetId,
          createdBy: authUid
        });
      });

      showToast(`¡Stock recargado con éxito! (+${qtyNumber} uds)`, 'success');
      
      // Reset form
      setInvoiceNumber('');
      setSelectedArticleId('');
      setArticleSearchQuery('');
      setQuantity('');
      setSupplierName('');
      setNotes('');
      setSeriesInput('');
      
      onRefresh();
      onClose();
    } catch (err: any) {
      console.error('Error al recargar stock:', err);
      showToast('Ocurrió un error al registrar el ingreso de mercadería', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-neutral-900 w-full max-w-xl rounded-3xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-2xl backdrop-blur-md">
              <PackagePlus className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight">Ingreso de Mercadería y Recarga de Stock</h3>
              <p className="text-xs text-emerald-100 font-medium">Sume artículos recibidos por factura o lote</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Invoice Number */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Número de Factura de Compra / Proveedor:</span>
            </label>
            <input
              type="text"
              placeholder="Ej. FACT-001-98723 o 001-002-00004512"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl text-xs font-bold text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>

          {/* Article Predictive Search */}
          <div className="relative" ref={dropdownRef}>
            <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>Artículo a Recargar (Búsqueda Predictiva Inteligente):</span>
              </span>
              {selectedArticle && (
                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  <span>Seleccionado</span>
                </span>
              )}
            </label>

            {/* Input with Search Icon */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Escriba nombre, modelo, marca o código de barras del artículo..."
                value={articleSearchQuery}
                onFocus={() => setIsDropdownOpen(true)}
                onChange={(e) => {
                  setArticleSearchQuery(e.target.value);
                  setIsDropdownOpen(true);
                  if (selectedArticleId) setSelectedArticleId('');
                }}
                className={`w-full pl-11 pr-10 py-3.5 bg-neutral-50 dark:bg-neutral-800 border rounded-2xl text-xs font-bold text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 transition-all ${
                  selectedArticle 
                    ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/20 dark:bg-emerald-950/20' 
                    : 'border-neutral-200 dark:border-neutral-700 focus:ring-2 focus:ring-emerald-500'
                }`}
              />
              {articleSearchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setArticleSearchQuery('');
                    setSelectedArticleId('');
                    setIsDropdownOpen(true);
                  }}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-700"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Predictive Results Dropdown */}
            {isDropdownOpen && (
              <div className="absolute left-0 right-0 top-full mt-2 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl shadow-2xl z-30 max-h-60 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-700/60 animate-in fade-in duration-150">
                {filteredArticles.length > 0 ? (
                  filteredArticles.slice(0, 30).map((art) => {
                    const isSelected = art.id === selectedArticleId;
                    return (
                      <div
                        key={art.id}
                        onClick={() => {
                          setSelectedArticleId(art.id);
                          setArticleSearchQuery(art.name);
                          setIsDropdownOpen(false);
                        }}
                        className={`p-3.5 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer transition-colors flex items-center justify-between ${
                          isSelected ? 'bg-emerald-50/70 dark:bg-emerald-950/50' : ''
                        }`}
                      >
                        <div className="space-y-1 pr-2">
                          <div className="text-xs font-black text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                            <span>{art.name}</span>
                            {art.barcode && (
                              <span className="px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-700 text-[10px] font-mono font-normal text-neutral-600 dark:text-neutral-300">
                                {art.barcode}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium flex items-center gap-3">
                            {art.category && <span>Categoría: <b>{art.category}</b></span>}
                            {art.brand && <span>Marca: <b>{art.brand}</b></span>}
                          </div>
                        </div>

                        <div className="text-right flex-shrink-0">
                          <span className={`inline-block px-2.5 py-1 rounded-xl text-[11px] font-bold ${
                            Number(art.quantity || 0) > 0 
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300' 
                              : 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300'
                          }`}>
                            Stock: {art.quantity || 0}
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-4 text-center text-xs text-neutral-400">
                    No se encontraron artículos que coincidan con la búsqueda.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Warehouse Target */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-2 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Bodega de Destino:</span>
            </label>
            <select
              value={effectiveWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
              className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl text-xs font-bold text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-emerald-500"
              required
            >
              {warehouses.length === 0 ? (
                <option value="">No hay bodegas disponibles</option>
              ) : (
                warehouses.map((wh) => (
                  <option key={wh.id} value={wh.id}>
                    {wh.name} {wh.assignedPerson ? `(${wh.assignedPerson})` : ''}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Quantity & Supplier */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-2">
                Cantidad de Unidades Recibidas:
              </label>
              <input
                type="number"
                step="any"
                min="0.01"
                placeholder="Ej. 50"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl text-sm font-black text-emerald-600 dark:text-emerald-400 focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-2">
                Proveedor / Origen (Opcional):
              </label>
              <input
                type="text"
                placeholder="Ej. Distribuidora Central S.A."
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl text-xs font-bold text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Series if required */}
          {selectedArticle?.requiresSeries && (() => {
            const enteredCount = seriesInput.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean).length;
            const maxUnits = Math.floor(parseFloat(quantity) || 0);
            const isExceeded = maxUnits > 0 && enteredCount > maxUnits;

            return (
              <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-2xl space-y-2">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
                    Números de Serie Recibidos (Opcional)
                  </label>
                  {maxUnits > 0 && (
                    <span className={`text-[11px] font-bold ${isExceeded ? 'text-rose-600 dark:text-rose-400' : 'text-amber-700 dark:text-amber-400'}`}>
                      {enteredCount} / {maxUnits} permitidas
                    </span>
                  )}
                </div>
                <textarea
                  rows={2}
                  placeholder={`Ej. SN-001, SN-002 (Separadas por comas o saltos de línea - Máx: ${maxUnits || 'según cantidad'})`}
                  value={seriesInput}
                  onChange={(e) => setSeriesInput(e.target.value)}
                  className={`w-full px-4 py-2.5 bg-white dark:bg-neutral-800 border rounded-xl text-xs font-mono text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:ring-2 ${
                    isExceeded
                      ? 'border-rose-500 focus:ring-rose-500/30'
                      : 'border-amber-300 dark:border-amber-700/60 focus:ring-amber-500'
                  }`}
                />
                {isExceeded && (
                  <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400">
                    Ha ingresado {enteredCount} series. Solo puede registrar hasta {maxUnits} series en esta recarga.
                  </p>
                )}
                <p className="text-[10px] text-amber-700/80 dark:text-amber-400/80">
                  Puede ingresar las series ahora o dejarlas pendientes para ingresarlas posteriormente en la sección de artículos.
                </p>
              </div>
            );
          })()}

          {/* Projection badge */}
          {selectedArticle && quantity && !isNaN(parseFloat(quantity)) && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between font-bold">
              <span>Nuevo Stock Calculado:</span>
              <span className="text-sm font-black text-emerald-700 dark:text-emerald-400">
                {Number(selectedArticle.quantity || 0)} + {parseFloat(quantity)} = {Number(selectedArticle.quantity || 0) + parseFloat(quantity)} Uds.
              </span>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-2">
              Observaciones adicionales:
            </label>
            <input
              type="text"
              placeholder="Detalles sobre la compra o lote..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl text-xs font-bold text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/50 dark:hover:bg-neutral-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/20 flex items-center gap-2"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              <span>Confirmar y Recargar Stock</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
