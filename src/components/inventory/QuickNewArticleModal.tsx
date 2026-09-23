import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { Article, Warehouse } from '../../types/inventory';
import { saveArticleWithStockTransaction } from '../../lib/inventory-db';
import { X, Package, AlertTriangle, Layers, Tag, Laptop, Hash, Barcode } from 'lucide-react';

interface QuickNewArticleModalProps {
  isOpen: boolean;
  onClose: () => void;
  warehouses: Warehouse[];
  articles: Article[];
  currentEnterpriseId: string;
  initialName?: string;
  onArticleCreated: (newArticle: Article) => void;
}

export function QuickNewArticleModal({
  isOpen,
  onClose,
  warehouses,
  articles,
  currentEnterpriseId,
  initialName = '',
  onArticleCreated
}: QuickNewArticleModalProps) {
  const { user } = useAuth();
  const { showToast, showConfirm } = useNotification();

  const [formData, setFormData] = useState({
    category: '',
    brand: '',
    model: '',
    barcode: '',
    requiresSeries: false,
    seriesInput: '',
    minStockAlert: 5,
    initialQuantity: 0,
    initialWarehouseId: warehouses[0]?.id || ''
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      // Pre-fill model or category if initialName was provided
      setFormData({
        category: 'General',
        brand: '',
        model: initialName.trim(),
        barcode: '',
        requiresSeries: false,
        seriesInput: '',
        minStockAlert: 5,
        initialQuantity: 0,
        initialWarehouseId: warehouses[0]?.id || ''
      });
      setError('');
    }
  }, [isOpen, initialName, warehouses]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentEnterpriseId) return;

    if (!formData.category.trim()) {
      setError('La categoría es obligatoria.');
      return;
    }
    if (!formData.brand.trim()) {
      setError('La marca es obligatoria.');
      return;
    }
    if (!formData.model.trim()) {
      setError('El modelo o descripción es obligatorio.');
      return;
    }

    setSubmitting(true);
    setError('');

    let seriesArray: string[] = [];
    if (formData.requiresSeries && formData.seriesInput.trim()) {
      seriesArray = formData.seriesInput
        .split('\n')
        .map(s => s.trim())
        .filter(s => s.length > 0);
      
      const targetQty = Number(formData.initialQuantity || 0);
      if (seriesArray.length !== targetQty && targetQty > 0) {
        setError(`Debe ingresar exactamente ${targetQty} series (una por línea). Actual: ${seriesArray.length}`);
        setSubmitting(false);
        return;
      }
    }

    const computedName = `${formData.category.trim()} ${formData.brand.trim()} ${formData.model.trim()}${formData.barcode.trim() ? ' ' + formData.barcode.trim() : ''}`.trim().replace(/\s+/g, ' ');

    try {
      const createdArticle = await saveArticleWithStockTransaction(
        {
          category: formData.category.trim(),
          brand: formData.brand.trim(),
          model: formData.model.trim(),
          computedName,
          requiresSeries: formData.requiresSeries,
          seriesList: seriesArray,
          barcode: formData.barcode.trim(),
          minStockAlert: Number(formData.minStockAlert),
          initialQuantity: Number(formData.initialQuantity || 0),
          initialWarehouseId: formData.initialWarehouseId
        },
        null,
        currentEnterpriseId,
        user?.uid
      );

      showToast(`Artículo "${computedName}" creado exitosamente`, 'success');
      onArticleCreated(createdArticle as Article);
      onClose();
    } catch (err: any) {
      console.error('Error al crear nuevo artículo:', err);
      setError('No se pudo guardar el artículo. Intente nuevamente.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-neutral-900 w-full max-w-xl rounded-3xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-5 bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-50">Crear Nuevo Artículo en Inventario</h3>
              <p className="text-[11px] text-neutral-400">Registra un nuevo producto para préstamos, devoluciones y ventas</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 rounded-xl hover:bg-neutral-200/50 dark:hover:bg-neutral-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-xl text-red-600 dark:text-red-400 text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block mb-1.5 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-500" />
                Categoría *
              </label>
              <input
                type="text"
                required
                placeholder="Ej. Electrodomésticos, Motos..."
                value={formData.category}
                onChange={e => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs font-bold text-neutral-900 dark:text-neutral-100 outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block mb-1.5 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-indigo-500" />
                Marca *
              </label>
              <input
                type="text"
                required
                placeholder="Ej. Sony, Samsung, Shineray..."
                value={formData.brand}
                onChange={e => setFormData({ ...formData, brand: e.target.value })}
                className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs font-bold text-neutral-900 dark:text-neutral-100 outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block mb-1.5 flex items-center gap-1.5">
              <Laptop className="w-3.5 h-3.5 text-indigo-500" />
              Modelo / Descripción *
            </label>
            <input
              type="text"
              required
              placeholder="Ej. Smart TV 55 UHD 4K, XY-200..."
              value={formData.model}
              onChange={e => setFormData({ ...formData, model: e.target.value })}
              className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs font-bold text-neutral-900 dark:text-neutral-100 outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block mb-1.5 flex items-center gap-1.5">
                <Barcode className="w-3.5 h-3.5 text-neutral-400" />
                Código de Barras (Opcional)
              </label>
              <input
                type="text"
                placeholder="Ej. 7861234567890"
                value={formData.barcode}
                onChange={e => setFormData({ ...formData, barcode: e.target.value })}
                className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs font-mono font-bold text-neutral-900 dark:text-neutral-100 outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block mb-1.5 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-neutral-400" />
                Alerta de Stock Mínimo
              </label>
              <input
                type="number"
                min={0}
                value={formData.minStockAlert}
                onChange={e => setFormData({ ...formData, minStockAlert: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs font-bold text-neutral-900 dark:text-neutral-100 outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-neutral-50 dark:bg-neutral-800/40 rounded-2xl border border-neutral-200 dark:border-neutral-700">
            <input
              type="checkbox"
              id="quickRequiresSeries"
              checked={formData.requiresSeries}
              onChange={e => setFormData({ ...formData, requiresSeries: e.target.checked })}
              className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 border-neutral-300"
            />
            <label htmlFor="quickRequiresSeries" className="text-xs font-bold text-neutral-700 dark:text-neutral-300 cursor-pointer">
              ¿Este artículo requiere registro de serie o chasis único?
            </label>
          </div>

          <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50"
            >
              {submitting ? 'Guardando...' : 'Crear y Seleccionar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
