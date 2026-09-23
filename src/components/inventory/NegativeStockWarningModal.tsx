import React from 'react';
import { AlertTriangle, CornerDownLeft, PackagePlus, CheckCircle2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export interface NegativeStockItemInfo {
  articleId: string;
  articleName: string;
  currentStock: number;
  requestedQty: number;
  projectedStock: number;
  warehouseName?: string;
}

interface NegativeStockWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  negativeItems: NegativeStockItemInfo[];
  onConfirmProceed: () => void;
  onCorrection: () => void;
}

export default function NegativeStockWarningModal({
  isOpen,
  onClose,
  negativeItems,
  onConfirmProceed,
  onCorrection
}: NegativeStockWarningModalProps) {
  const navigate = useNavigate();

  if (!isOpen || negativeItems.length === 0) return null;

  const handleNewGoodsClick = () => {
    onClose();
    navigate('/inventory/articles', { state: { openNewArticleModal: true } });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-neutral-900 w-full max-w-xl rounded-3xl shadow-2xl border border-rose-200 dark:border-rose-900/50 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-rose-500/10 via-amber-500/10 to-transparent border-b border-rose-100 dark:border-rose-900/30 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h3 className="text-lg font-black text-neutral-900 dark:text-white tracking-tight">
                Advertencia de Stock Negativo
              </h3>
              <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                Atención: El movimiento dejará artículos con stock menor a cero.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed font-medium">
            Se detectó que el siguiente artículo (o artículos) quedará con existencia negativa. Esto podría provocar descuadres de inventario o indicar que la mercancía aún no ha sido registrada.
          </p>

          <div className="space-y-3">
            {negativeItems.map((item, idx) => (
              <div
                key={item.articleId + idx}
                className="p-4 bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-800/40 rounded-2xl space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-900 dark:text-white">
                    {item.articleName}
                  </span>
                  {item.warehouseName && (
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300 rounded-lg">
                      {item.warehouseName}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 text-[11px] pt-1 border-t border-rose-200/50 dark:border-rose-800/30">
                  <div>
                    <span className="text-neutral-500 dark:text-neutral-400 block text-[10px]">Stock Actual:</span>
                    <span className="font-bold text-neutral-700 dark:text-neutral-200">{item.currentStock} uds</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 dark:text-neutral-400 block text-[10px]">Solicitado:</span>
                    <span className="font-bold text-neutral-700 dark:text-neutral-200">-{item.requestedQty} uds</span>
                  </div>
                  <div>
                    <span className="text-rose-600 dark:text-rose-400 block text-[10px] font-bold">Proyección Final:</span>
                    <span className="font-black text-rose-600 dark:text-rose-400 text-xs">{item.projectedStock} uds</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 rounded-xl text-[11px] text-amber-800 dark:text-amber-300 font-medium">
            💡 Por favor elija una de las siguientes tres opciones para continuar:
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-5 bg-neutral-50 dark:bg-neutral-900/80 border-t border-neutral-100 dark:border-neutral-800 flex flex-col gap-2.5 sm:gap-2">
          {/* Button 1: Me he equivocado de item y corregido */}
          <button
            onClick={onCorrection}
            className="w-full py-3 px-4 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-100 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            <CornerDownLeft className="w-4 h-4 text-indigo-500" />
            <span>Me he equivocado de item / Corregir venta</span>
          </button>

          {/* Button 2: Es mercaderia nueva */}
          <button
            onClick={handleNewGoodsClick}
            className="w-full py-3 px-4 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2"
          >
            <PackagePlus className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Es mercadería nueva (Registrar en Inventario)</span>
          </button>

          {/* Button 3: Estoy consciente de que el stock estará en negativo y aun asi deseo proceder */}
          <button
            onClick={onConfirmProceed}
            className="w-full py-3 px-4 bg-rose-600 hover:bg-rose-700 active:scale-[0.99] text-white rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-rose-600/20"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Estoy consciente de que el stock estará en negativo y deseo proceder</span>
          </button>
        </div>
      </div>
    </div>
  );
}
