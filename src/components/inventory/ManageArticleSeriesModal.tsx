import React, { useState } from 'react';
import { db } from '../../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useNotification } from '../../contexts/NotificationContext';
import { logAudit, AuditAction } from '../../lib/audit';
import { Hash, X, Check, Plus, AlertCircle } from 'lucide-react';

interface ManageArticleSeriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  articleId: string;
  articleName: string;
  currentSeries?: string[];
  warehouseId?: string;
  globalStock?: number;
  onSuccess?: (updatedSeries: string[]) => void;
}

export const ManageArticleSeriesModal: React.FC<ManageArticleSeriesModalProps> = ({
  isOpen,
  onClose,
  articleId,
  articleName,
  currentSeries = [],
  warehouseId,
  globalStock,
  onSuccess
}) => {
  const { showToast } = useNotification();
  const [seriesInput, setSeriesInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingSeries, setExistingSeries] = useState<string[]>(currentSeries);
  const [articleStock, setArticleStock] = useState<number>(globalStock ?? 0);
  const [loadingStock, setLoadingStock] = useState(false);

  // Sync existing series and load latest stock whenever modal opens
  React.useEffect(() => {
    setExistingSeries(currentSeries || []);
    setSeriesInput('');

    if (isOpen && articleId) {
      setLoadingStock(true);
      getDoc(doc(db, 'articles', articleId))
        .then(snap => {
          if (snap.exists()) {
            const data = snap.data();
            const qty = Number(data.quantity || 0);
            setArticleStock(qty);
            if (data.seriesList) {
              setExistingSeries(data.seriesList);
            }
          }
        })
        .catch(err => console.error('Error fetching article stock for series:', err))
        .finally(() => setLoadingStock(false));
    }
  }, [currentSeries, isOpen, articleId]);

  if (!isOpen) return null;

  const maxAllowed = articleStock;
  const remainingSlots = Math.max(0, maxAllowed - existingSeries.length);

  const handleAddSeries = async (e: React.FormEvent) => {
    e.preventDefault();

    if (articleStock <= 0) {
      showToast('No es posible registrar series cuando el stock es 0.', 'error');
      return;
    }

    if (!seriesInput.trim()) {
      showToast('Ingrese al menos una serie o número de chasis/motor', 'warning');
      return;
    }

    // Split series by commas, semicolons, line breaks or spaces
    const newItems = seriesInput
      .split(/[\n,;]+/)
      .map(s => s.trim().toUpperCase())
      .filter(s => s.length > 0);

    if (newItems.length === 0) {
      showToast('No se detectaron series válidas', 'warning');
      return;
    }

    // Deduplicate against existing
    const uniqueNew = newItems.filter(s => !existingSeries.includes(s));
    if (uniqueNew.length === 0) {
      showToast('Todas las series ingresadas ya se encuentran registradas', 'warning');
      return;
    }

    // Enforce stock ceiling
    if (existingSeries.length + uniqueNew.length > articleStock) {
      showToast(
        `Límite excedido: El stock es de ${articleStock} unidad(es). Ya tiene ${existingSeries.length} serie(s). Solo puede añadir hasta ${remainingSlots} serie(s) más.`,
        'error'
      );
      return;
    }

    try {
      setIsSubmitting(true);
      // Fetch latest article doc
      const artRef = doc(db, 'articles', articleId);
      const artSnap = await getDoc(artRef);

      let updatedList = [...existingSeries];
      if (artSnap.exists()) {
        const artData = artSnap.data();
        const currentInDb: string[] = artData.seriesList || [];
        const combined = Array.from(new Set([...currentInDb, ...uniqueNew]));
        updatedList = combined;

        await updateDoc(artRef, {
          requiresSeries: true,
          seriesList: combined,
          updatedAt: new Date().toISOString()
        });
      }

      // Also update warehouse_inventory if warehouseId is provided
      if (warehouseId) {
        const invId = `${warehouseId}_${articleId}`;
        const invRef = doc(db, 'warehouse_inventory', invId);
        const invSnap = await getDoc(invRef);
        if (invSnap.exists()) {
          const invSeries: string[] = invSnap.data().seriesList || [];
          const combinedInv = Array.from(new Set([...invSeries, ...uniqueNew]));
          await updateDoc(invRef, {
            seriesList: combinedInv,
            updatedAt: new Date().toISOString()
          });
        }
      }

      await logAudit(
        AuditAction.INVENTORY_UPDATE,
        `Series ingresadas para artículo: ${articleName} (${uniqueNew.length} series: ${uniqueNew.join(', ')})`,
        articleId
      );

      setExistingSeries(updatedList);
      setSeriesInput('');
      showToast(`${uniqueNew.length} serie(s) guardada(s) exitosamente`, 'success');
      if (onSuccess) {
        onSuccess(updatedList);
      }
      onClose();
    } catch (err: any) {
      console.error('Error guardando series:', err);
      showToast('Error al guardar las series del artículo', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveSeries = async (seriesToRemove: string) => {
    try {
      setIsSubmitting(true);
      const artRef = doc(db, 'articles', articleId);
      const updatedList = existingSeries.filter(s => s !== seriesToRemove);

      await updateDoc(artRef, {
        seriesList: updatedList,
        updatedAt: new Date().toISOString()
      });

      if (warehouseId) {
        const invId = `${warehouseId}_${articleId}`;
        const invRef = doc(db, 'warehouse_inventory', invId);
        const invSnap = await getDoc(invRef);
        if (invSnap.exists()) {
          const invSeries: string[] = invSnap.data().seriesList || [];
          await updateDoc(invRef, {
            seriesList: invSeries.filter(s => s !== seriesToRemove),
            updatedAt: new Date().toISOString()
          });
        }
      }

      setExistingSeries(updatedList);
      showToast(`Serie ${seriesToRemove} eliminada`, 'info');
      if (onSuccess) {
        onSuccess(updatedList);
      }
    } catch (err) {
      console.error('Error removing series:', err);
      showToast('Error al remover la serie', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white dark:bg-neutral-900 rounded-3xl w-full max-w-md shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        <div className="p-5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-bold shadow-md shadow-amber-500/20">
              <Hash className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-neutral-900 dark:text-white">
                Ingreso de Series / Chasis
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate max-w-[240px]">
                {articleName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleAddSeries} className="p-5 space-y-4">
          {/* Stock & Limits Indicator */}
          <div className={`p-3 rounded-2xl border text-xs flex items-start gap-2.5 ${
            articleStock <= 0
              ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-300'
              : remainingSlots === 0
              ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-300'
              : 'bg-indigo-50/60 dark:bg-indigo-950/20 border-indigo-200/80 dark:border-indigo-900/40 text-indigo-900 dark:text-indigo-200'
          }`}>
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2 font-bold">
                <span>Stock Global: {articleStock} unidad(es)</span>
                <span className="px-2 py-0.5 bg-white/80 dark:bg-black/30 rounded-full font-mono text-[11px]">
                  {existingSeries.length} / {articleStock} series
                </span>
              </div>
              {articleStock <= 0 ? (
                <p className="font-medium text-[11px] leading-relaxed">
                  <strong>Stock en 0:</strong> No es posible registrar números de serie si el artículo no tiene existencias. Primero debe ingresar o recargar stock mediante compra o factura.
                </p>
              ) : remainingSlots === 0 ? (
                <p className="font-medium text-[11px] leading-relaxed">
                  <strong>Cupo de series completado:</strong> Ya ha alcanzado el límite máximo de series según el stock disponible ({articleStock} de {articleStock}). Para agregar nuevas series, recargue stock o elimine alguna serie previa.
                </p>
              ) : (
                <p className="font-medium text-[11px] leading-relaxed">
                  Puede registrar hasta <strong>{remainingSlots}</strong> serie(s) adicional(es) para igualar el stock disponible de este producto.
                </p>
              )}
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                Nuevas Series / Números de Serie
              </label>
              {articleStock > 0 && (
                <span className="text-[10px] font-bold text-neutral-400 uppercase">
                  Cupo restante: {remainingSlots}
                </span>
              )}
            </div>
            <textarea
              rows={3}
              value={seriesInput}
              disabled={articleStock <= 0 || remainingSlots <= 0}
              onChange={(e) => setSeriesInput(e.target.value)}
              placeholder={
                articleStock <= 0
                  ? 'Bloqueado: Stock actual es 0'
                  : remainingSlots <= 0
                  ? 'Bloqueado: Cupo de series completado'
                  : 'Ej: SN-981203, SN-981204 (Separe por comas o saltos de línea)'
              }
              className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-xs font-mono text-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:bg-neutral-100 dark:disabled:bg-neutral-900"
            />
          </div>

          {existingSeries.length > 0 && (
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[11px] font-bold text-neutral-500 dark:text-neutral-400 block uppercase">
                  Series registradas ({existingSeries.length}):
                </span>
                <span className="text-[10px] text-neutral-400">Haga clic en ✕ para eliminar</span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2.5 bg-neutral-50 dark:bg-neutral-800/40 rounded-xl border border-neutral-200 dark:border-neutral-800">
                {existingSeries.map((s, idx) => (
                  <span 
                    key={idx} 
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-[11px] font-mono font-semibold text-neutral-700 dark:text-neutral-300 shadow-2xs"
                  >
                    <span>{s}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSeries(s)}
                      disabled={isSubmitting}
                      className="text-neutral-400 hover:text-rose-500 transition-colors cursor-pointer p-0.5"
                      title={`Eliminar serie ${s}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="pt-2 flex justify-end gap-2 border-t border-neutral-100 dark:border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors cursor-pointer"
            >
              Cerrar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !seriesInput.trim() || articleStock <= 0 || remainingSlots <= 0}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 shadow-sm shadow-indigo-500/30 cursor-pointer disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? 'Guardando...' : 'Guardar Series'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
