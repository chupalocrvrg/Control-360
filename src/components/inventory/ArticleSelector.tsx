import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, CheckSquare, Square, Plus } from 'lucide-react';
import { Article, WarehouseInventory } from '../../types/inventory';
import { cn } from '../../lib/utils';

interface Props {
  articles: Article[];
  inventories: WarehouseInventory[];
  warehouseId: string;
  articleId: string;
  quantity: number;
  selectedSeries: string[];
  onChangeArticle: (articleId: string) => void;
  onChangeQuantity: (quantity: number) => void;
  onChangeSeries: (series: string[]) => void;
  maxQuantityStr?: string;
  className?: string;
}

interface ExtendedProps extends Props {
  isReceiving?: boolean;
  onQuickCreate?: (currentSearchText: string) => void;
}

export function ArticleSelector({ articles, inventories, warehouseId, articleId, quantity, selectedSeries, onChangeArticle, onChangeQuantity, onChangeSeries, maxQuantityStr, className, isReceiving = false, onQuickCreate }: ExtendedProps) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedArticle = articles.find(a => a.id === articleId);

  useEffect(() => {
    if (selectedArticle) {
      const artName = selectedArticle.name || (selectedArticle as any).computedName || (selectedArticle as any).nombre || '';
      setSearch(`${artName} ${selectedArticle.brand || ''} ${selectedArticle.model || ''}`.trim());
    } else {
      setSearch('');
    }
  }, [articleId, selectedArticle]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getAvailableStock = (artId: string) => {
    if (!warehouseId) return 0;
    const inv = inventories.find(i => i.warehouseId === warehouseId && i.articleId === artId);
    return inv ? inv.quantity : 0;
  };

  const filteredArticles = articles.filter(art => {
    const s = search.toLowerCase();
    const barcodeMatch = Boolean(art.barcode && art.barcode.toLowerCase().includes(s));
    const artName = art.name || (art as any).computedName || (art as any).nombre || [art.category, art.brand, art.model].filter(Boolean).join(' ') || '';
    const nameMatch = artName.toLowerCase().includes(s);
    const brandMatch = Boolean(art.brand && art.brand.toLowerCase().includes(s));
    const modelMatch = Boolean(art.model && art.model.toLowerCase().includes(s));
    const catMatch = Boolean(art.category && art.category.toLowerCase().includes(s));
    return barcodeMatch || nameMatch || brandMatch || modelMatch || catMatch;
  });

  const availableStock = articleId ? getAvailableStock(articleId) : 0;
  
  const handleSelect = (art: Article) => {
    onChangeArticle(art.id);
    setIsOpen(false);
    // Reset quantity and series when changing article
    onChangeQuantity(1);
    onChangeSeries([]);
  };

  const inv = inventories.find(i => i.warehouseId === warehouseId && i.articleId === articleId);
  const availableSeries = inv?.seriesList || [];

  const toggleSeries = (s: string) => {
    if (selectedSeries.includes(s)) {
      const next = selectedSeries.filter(x => x !== s);
      onChangeSeries(next);
      onChangeQuantity(next.length);
    } else {
      const next = [...selectedSeries, s];
      onChangeSeries(next);
      onChangeQuantity(next.length);
    }
  };

  return (
    <div className={cn("flex flex-col gap-2", className)} ref={containerRef}>
      <div className="flex gap-2 items-start">
        <div className="flex-1 relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Buscar artículo por nombre, código de barras, marca, modelo..."
              value={search}
              onChange={e => { setSearch(e.target.value); setIsOpen(true); if (articleId) onChangeArticle(''); }}
              onFocus={() => setIsOpen(true)}
              className="w-full pl-9 pr-4 py-2 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs outline-none focus:border-indigo-500 text-neutral-900 dark:text-neutral-50"
            />
            {isOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-lg z-50 max-h-60 overflow-y-auto">
                {onQuickCreate && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      onQuickCreate(search);
                    }}
                    className="w-full p-2.5 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border-b border-indigo-100 dark:border-indigo-800/40 text-left flex items-center justify-between transition-colors"
                  >
                    <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                      <Plus className="w-3.5 h-3.5" />
                      ¿No existe en inventario? Crear Nuevo Artículo
                    </span>
                    <span className="text-[10px] uppercase font-black text-indigo-500 bg-white dark:bg-neutral-800 px-1.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-700">
                      + Crear
                    </span>
                  </button>
                )}
                {filteredArticles.length === 0 ? (
                  <div className="p-4 text-xs text-neutral-500 text-center">
                    <p>No se encontraron artículos con "{search}"</p>
                    {onQuickCreate && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsOpen(false);
                          onQuickCreate(search);
                        }}
                        className="mt-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Registrar como nuevo artículo
                      </button>
                    )}
                  </div>
                ) : (
                  filteredArticles.map(art => {
                    const stock = getAvailableStock(art.id);
                    const canSelect = isReceiving || stock > 0;
                    return (
                      <div 
                        key={art.id} 
                        onClick={() => canSelect ? handleSelect(art) : null}
                        className={cn(
                          "p-2.5 text-xs border-b border-neutral-100 dark:border-neutral-700/50 last:border-0 transition-colors",
                          canSelect
                            ? "hover:bg-indigo-50 dark:hover:bg-indigo-900/30 cursor-pointer"
                            : "opacity-50 cursor-not-allowed bg-neutral-50/60 dark:bg-neutral-900/30"
                        )}
                      >
                        <div className="flex justify-between items-center gap-2">
                          <span className={cn("font-bold truncate", canSelect ? "text-neutral-900 dark:text-neutral-100" : "text-neutral-500 dark:text-neutral-400")}>
                            {art.name}
                          </span>
                          {isReceiving ? (
                            stock === 0 ? (
                              <span className="text-[10px] font-mono bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50 px-2 py-0.5 rounded font-bold whitespace-nowrap">
                                Stock actual: 0 (Disponible para ingreso)
                              </span>
                            ) : (
                              <span className="text-[10px] font-mono bg-neutral-100 dark:bg-neutral-700 px-2 py-0.5 rounded text-neutral-600 dark:text-neutral-300 whitespace-nowrap font-medium">
                                Stock actual: {stock} uds
                              </span>
                            )
                          ) : (
                            stock === 0 ? (
                              <span className="text-[10px] font-mono bg-red-50 dark:bg-red-950/40 text-red-500 dark:text-red-400 border border-red-200 dark:border-red-900/30 px-2 py-0.5 rounded font-bold whitespace-nowrap">
                                Sin existencias (0 uds)
                              </span>
                            ) : (
                              <span className="text-[10px] font-mono bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40 px-2 py-0.5 rounded font-bold whitespace-nowrap">
                                Disp: {stock} uds
                              </span>
                            )
                          )}
                        </div>
                        <div className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-1">
                          {art.brand} {art.model} {art.barcode ? `| COD: ${art.barcode}` : ''}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
          {articleId && (
            <span className="text-[9px] font-bold uppercase tracking-wider text-neutral-400 block px-1 mt-1">
              {isReceiving ? (
                <>
                  Stock Actual en Bodega: <strong className="text-indigo-600 dark:text-indigo-400">{availableStock} uds</strong> (Se sumará al inventario)
                </>
              ) : (
                <>
                  Stock Disponible en Bodega: <strong className="text-emerald-600 dark:text-emerald-400">{availableStock} uds</strong> {maxQuantityStr}
                </>
              )}
            </span>
          )}
        </div>
        
        {!selectedArticle?.requiresSeries && (
          <div className="w-24">
            <input
              type="number"
              min={1}
              
              value={quantity}
              onChange={(e) => onChangeQuantity(Math.max(1, parseInt(e.target.value) || 0))}
              disabled={!articleId}
              className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs text-center outline-none focus:border-indigo-500 text-neutral-900 dark:text-neutral-50 disabled:opacity-50"
              {...(isReceiving ? {} : { max: availableStock || 1 })}
            />
          </div>
        )}
      </div>

      {selectedArticle?.requiresSeries && (
        <div className="mt-2 bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/30 rounded-xl p-3">
          {isReceiving ? (
            <>
              <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-2">Ingrese Series ({selectedSeries.length} detectadas)</p>
              <textarea
                placeholder="Ingrese series separadas por coma o salto de línea"
                value={selectedSeries.join('\n')}
                onChange={(e) => {
                  const arr = e.target.value.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
                  onChangeSeries(arr);
                  onChangeQuantity(Math.max(1, arr.length));
                }}
                rows={3}
                className="w-full px-4 py-3 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs outline-none focus:border-indigo-500 text-neutral-900 dark:text-neutral-50 transition-all uppercase font-mono"
              />
            </>
          ) : (
            availableSeries.length > 0 ? (
              <>
                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-2">Seleccione Series ({selectedSeries.length} seleccionadas)</p>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                  {availableSeries.map(s => (
                    <label key={s} className={cn("flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-[10px] font-mono cursor-pointer transition-all", selectedSeries.includes(s) ? "bg-indigo-600 text-white border-indigo-600" : "bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:border-indigo-300")}>
                      <input type="checkbox" checked={selectedSeries.includes(s)} onChange={() => toggleSeries(s)} className="sr-only" />
                      {s}
                    </label>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-[10px] font-black uppercase tracking-widest text-red-500">No hay series disponibles para seleccionar.</p>
            )
          )}
        </div>
      )}
    </div>
  );
}
