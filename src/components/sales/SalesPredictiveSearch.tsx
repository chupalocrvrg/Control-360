import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  X, 
  User, 
  ShoppingCart, 
  Calendar, 
  DollarSign, 
  Pencil, 
  Trash2, 
  Bike, 
  Sparkles, 
  ArrowUpRight, 
  Receipt,
  Layers,
  ChevronRight,
  TrendingUp,
  Tag,
  Coins,
  FileText,
  Printer
} from 'lucide-react';
import { cn } from '../../lib/utils';

export interface SaleItem {
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
  creditSaleId?: string;
  promissoryNoteNumber?: string;
}

export interface EmployeeItem {
  id: string;
  name: string;
  lastName: string;
  role: string;
  enterpriseId?: string;
}

interface SalesPredictiveSearchProps {
  sales: SaleItem[];
  employees: EmployeeItem[];
  onEditSale: (sale: SaleItem) => void;
  onDeleteSale: (id: string) => void;
  onPayCredit?: (sale: SaleItem) => void;
  onOpenPromissoryNote?: (sale: SaleItem) => void;
  onOpenCreditApplication?: (sale: SaleItem) => void;
  onOpenDocumentPrintCenter?: (sale: SaleItem) => void;
}

export default function SalesPredictiveSearch({
  sales,
  employees,
  onEditSale,
  onDeleteSale,
  onPayCredit,
  onOpenPromissoryNote,
  onOpenCreditApplication,
  onOpenDocumentPrintCenter,
}: SalesPredictiveSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [activeFilterType, setActiveFilterType] = useState<'all' | 'contado' | 'credito'>('all');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'value_desc' | 'value_asc'>('date_desc');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Normalize string for accent-insensitive and case-insensitive search
  const normalizeStr = (str: string = '') => {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  };

  // Extract all unique clients with their stats
  const clientStats = useMemo(() => {
    const map = new Map<string, { name: string; count: number; total: number; lastDate: string; articles: Set<string> }>();
    
    sales.forEach(sale => {
      const rawName = sale.clientName?.trim();
      if (!rawName) return;
      const key = normalizeStr(rawName);
      
      const existing = map.get(key);
      const val = parseFloat(sale.totalValue as any) || 0;
      if (existing) {
        existing.count += 1;
        existing.total += val;
        if (sale.date > existing.lastDate) {
          existing.lastDate = sale.date;
        }
        if (sale.article) existing.articles.add(sale.article);
      } else {
        const set = new Set<string>();
        if (sale.article) set.add(sale.article);
        map.set(key, {
          name: rawName,
          count: 1,
          total: val,
          lastDate: sale.date || '',
          articles: set
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [sales]);

  // Predictive suggestions based on searchTerm
  const suggestions = useMemo(() => {
    const query = normalizeStr(searchTerm);
    if (!query) {
      // Return top 5 most frequent clients as default suggestions
      return clientStats.slice(0, 5);
    }

    return clientStats
      .filter(client => {
        const clientNorm = normalizeStr(client.name);
        const hasArticleMatch = Array.from(client.articles).some((art: string) => normalizeStr(String(art || '')).includes(query));
        return clientNorm.includes(query) || hasArticleMatch;
      })
      .slice(0, 8);
  }, [searchTerm, clientStats]);

  // Filtered sales in cascade format
  const cascadeSales = useMemo(() => {
    const query = normalizeStr(searchTerm);
    if (!query) return [];

    let results = sales.filter(sale => {
      const clientNorm = normalizeStr(sale.clientName || '');
      const articleNorm = normalizeStr(sale.article || '');
      const dateNorm = normalizeStr(sale.date || '');
      
      const matchesQuery = clientNorm.includes(query) || articleNorm.includes(query) || dateNorm.includes(query);
      if (!matchesQuery) return false;

      if (activeFilterType !== 'all' && sale.type !== activeFilterType) {
        return false;
      }

      return true;
    });

    // Sorting
    results.sort((a, b) => {
      if (sortBy === 'date_desc') return (b.date || '').localeCompare(a.date || '');
      if (sortBy === 'date_asc') return (a.date || '').localeCompare(b.date || '');
      if (sortBy === 'value_desc') return (b.totalValue || 0) - (a.totalValue || 0);
      if (sortBy === 'value_asc') return (a.totalValue || 0) - (b.totalValue || 0);
      return 0;
    });

    return results;
  }, [sales, searchTerm, activeFilterType, sortBy]);

  // Metrics for the current search results
  const metrics = useMemo(() => {
    const totalPurchases = cascadeSales.length;
    const totalSpent = cascadeSales.reduce((acc, s) => acc + (parseFloat(s.totalValue as any) || 0), 0);
    const avgTicket = totalPurchases > 0 ? totalSpent / totalPurchases : 0;
    const uniqueClientsCount = new Set(cascadeSales.map(s => normalizeStr(s.clientName || ''))).size;

    return { totalPurchases, totalSpent, avgTicket, uniqueClientsCount };
  }, [cascadeSales]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(e.target as Node) &&
        searchInputRef.current && 
        !searchInputRef.current.contains(e.target as Node)
      ) {
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectSuggestion = (clientName: string) => {
    setSearchTerm(clientName);
    setIsFocused(false);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isFocused && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setIsFocused(true);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
        handleSelectSuggestion(suggestions[selectedIndex].name);
      } else if (searchTerm.trim()) {
        setIsFocused(false);
      }
    } else if (e.key === 'Escape') {
      setIsFocused(false);
      setSelectedIndex(-1);
    }
  };

  const getEmployeeName = (id: string) => {
    const emp = employees.find(e => e.id === id);
    return emp ? `${emp.name} ${emp.lastName}`.trim() : 'Vendedor no asignado';
  };

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return 'Sin fecha';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const year = parts[0];
        const month = parts[1];
        const day = parts[2];
        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const monthName = months[parseInt(month, 10) - 1] || month;
        return `${day} ${monthName}, ${year}`;
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-4">
      {/* Predictive Search Bar Box */}
      <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200/80 dark:border-neutral-800 p-5 shadow-sm relative">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
              <Search className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-black text-neutral-900 dark:text-neutral-100 uppercase tracking-wider flex items-center gap-2">
                Búsqueda Predictiva de Ventas
                <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded-full flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" />
                  Predictivo
                </span>
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Escriba el nombre del cliente para desplegar en cascada su historial de artículos, valor y fecha.
              </p>
            </div>
          </div>

          {searchTerm.trim() && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400">
                {cascadeSales.length} {cascadeSales.length === 1 ? 'coincidencia' : 'coincidencias'}
              </span>
              <button
                onClick={() => setSearchTerm('')}
                className="px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Limpiar
              </button>
            </div>
          )}
        </div>

        {/* Input Wrapper */}
        <div className="relative">
          <div className="relative flex items-center">
            <Search className="w-5 h-5 absolute left-4 text-neutral-400 dark:text-neutral-500 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setIsFocused(true);
                setSelectedIndex(-1);
              }}
              onFocus={() => setIsFocused(true)}
              onKeyDown={handleKeyDown}
              placeholder="Buscar cliente (ej. Juan Pérez, Carlos, María...), artículo o fecha..."
              className="w-full pl-12 pr-12 py-3.5 bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 rounded-2xl text-sm font-medium text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-inner"
            />
            {searchTerm && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  searchInputRef.current?.focus();
                }}
                className="absolute right-4 p-1 rounded-full text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Predictive Dropdown */}
          <AnimatePresence>
            {isFocused && suggestions.length > 0 && (
              <motion.div
                ref={dropdownRef}
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                className="absolute left-0 right-0 top-full mt-2 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-2xl z-50 overflow-hidden max-h-80 overflow-y-auto"
              >
                <div className="p-2.5 bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-indigo-500" />
                    Sugerencias Predictivas de Clientes ({suggestions.length})
                  </span>
                  <span className="text-[10px] text-neutral-400">Presione Enter o clic para seleccionar</span>
                </div>
                <div className="p-1.5 space-y-1">
                  {suggestions.map((client, idx) => {
                    const isSelected = idx === selectedIndex;
                    return (
                      <button
                        key={client.name + idx}
                        type="button"
                        onClick={() => handleSelectSuggestion(client.name)}
                        className={cn(
                          "w-full px-3.5 py-2.5 rounded-xl text-left flex items-center justify-between gap-3 transition-colors",
                          isSelected
                            ? "bg-indigo-600 text-white font-bold"
                            : "hover:bg-neutral-100 dark:hover:bg-neutral-800/80 text-neutral-800 dark:text-neutral-200"
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={cn(
                            "w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-black",
                            isSelected 
                              ? "bg-white/20 text-white" 
                              : "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400"
                          )}>
                            <User className="w-4 h-4" />
                          </div>
                          <div className="truncate">
                            <span className={cn(
                              "text-xs font-bold block truncate",
                              isSelected ? "text-white" : "text-neutral-900 dark:text-neutral-100"
                            )}>
                              {client.name}
                            </span>
                            <span className={cn(
                              "text-[10px] block truncate",
                              isSelected ? "text-white/80" : "text-neutral-400"
                            )}>
                              {client.count} {client.count === 1 ? 'compra registrada' : 'compras registradas'} • Última: {client.lastDate || 'N/A'}
                            </span>
                          </div>
                        </div>

                        <div className="text-right flex-shrink-0">
                          <span className={cn(
                            "text-xs font-extrabold block",
                            isSelected ? "text-white" : "text-emerald-600 dark:text-emerald-400"
                          )}>
                            ${client.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <span className={cn(
                            "text-[9px] font-medium block",
                            isSelected ? "text-white/70" : "text-neutral-400"
                          )}>
                            Total compras
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Quick Suggestion Chips */}
        {!searchTerm.trim() && clientStats.length > 0 && (
          <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-neutral-400 dark:text-neutral-500 mr-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-indigo-500" />
              Clientes frecuentes:
            </span>
            {clientStats.slice(0, 6).map(client => (
              <button
                key={client.name}
                type="button"
                onClick={() => handleSelectSuggestion(client.name)}
                className="px-2.5 py-1 bg-neutral-100 dark:bg-neutral-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 dark:hover:text-indigo-400 text-neutral-600 dark:text-neutral-300 rounded-lg text-[11px] font-semibold transition-colors flex items-center gap-1 border border-neutral-200/60 dark:border-neutral-700/60 active:scale-95"
              >
                <span>{client.name}</span>
                <span className="text-[9px] font-extrabold px-1.5 py-0.2 bg-neutral-200 dark:bg-neutral-700 rounded-md text-neutral-700 dark:text-neutral-300">
                  {client.count}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* CASCADE RESULTS VIEW */}
      <AnimatePresence>
        {searchTerm.trim().length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="space-y-4"
          >
            {/* Header / Summary Bar for Cascade Search */}
            <div className="p-4 bg-gradient-to-r from-indigo-900/90 via-indigo-800 to-neutral-900 text-white rounded-3xl shadow-md border border-indigo-700/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center flex-shrink-0 text-white">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-wider text-indigo-200">
                      Resultados de Búsqueda en Cascada
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-white/20 rounded-full">
                      {cascadeSales.length} compras
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
                    Cliente: "{searchTerm}"
                  </h3>
                </div>
              </div>

              {/* Metrics Pills */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="bg-white/10 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-white/10">
                  <span className="text-[10px] font-bold text-indigo-200 block uppercase tracking-wider">Monto Total</span>
                  <span className="text-sm font-black text-emerald-300">
                    ${metrics.totalSpent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="bg-white/10 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-white/10">
                  <span className="text-[10px] font-bold text-indigo-200 block uppercase tracking-wider">Ticket Promedio</span>
                  <span className="text-sm font-black text-white">
                    ${metrics.avgTicket.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Filter and Sorting Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-neutral-900 p-3 rounded-2xl border border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-neutral-400 mr-1 pl-1">Tipo:</span>
                {(['all', 'contado', 'credito'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => setActiveFilterType(type)}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-xs font-bold transition-all uppercase tracking-wider",
                      activeFilterType === type
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                    )}
                  >
                    {type === 'all' ? 'Todos' : type}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-neutral-400">Ordenar por:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs font-bold text-neutral-800 dark:text-neutral-200 rounded-xl px-3 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="date_desc">Fecha más reciente</option>
                  <option value="date_asc">Fecha más antigua</option>
                  <option value="value_desc">Mayor valor ($)</option>
                  <option value="value_asc">Menor valor ($)</option>
                </select>
              </div>
            </div>

            {/* CASCADE CARDS LIST */}
            {cascadeSales.length === 0 ? (
              <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-10 text-center shadow-sm">
                <div className="w-14 h-14 bg-neutral-100 dark:bg-neutral-800 rounded-2xl flex items-center justify-center mx-auto mb-3 text-neutral-400">
                  <Search className="w-7 h-7" />
                </div>
                <h4 className="text-base font-bold text-neutral-900 dark:text-white">
                  No se encontraron ventas para "{searchTerm}"
                </h4>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-md mx-auto">
                  Verifique el nombre ingresado o intente seleccionar una de las sugerencias predictivas de la barra de búsqueda.
                </p>
                <button
                  onClick={() => setSearchTerm('')}
                  className="mt-4 px-4 py-2 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-xs font-bold rounded-xl text-neutral-700 dark:text-neutral-300 transition-colors"
                >
                  Ver todas las ventas
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {cascadeSales.map((sale, index) => {
                  const sellerName = getEmployeeName(sale.employeeId);
                  return (
                    <motion.div
                      key={sale.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.4) }}
                      className="bg-white dark:bg-neutral-900 border border-neutral-200/90 dark:border-neutral-800 rounded-3xl p-5 shadow-sm hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-900/50 transition-all group relative overflow-hidden"
                    >
                      {/* Top Header: Client name & Date */}
                      <div className="flex items-start justify-between gap-3 pb-3 border-b border-neutral-100 dark:border-neutral-800">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-sm flex-shrink-0">
                            <User className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block">
                              Cliente
                            </span>
                            <h4 className="text-sm sm:text-base font-extrabold text-neutral-900 dark:text-neutral-50 truncate">
                              {sale.clientName || 'Sin Nombre Registrado'}
                            </h4>
                          </div>
                        </div>

                        <div className="text-right flex-shrink-0">
                          <span className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 flex items-center justify-end gap-1">
                            <Calendar className="w-3 h-3" />
                            Fecha de Compra
                          </span>
                          <span className="text-xs font-extrabold text-neutral-700 dark:text-neutral-200">
                            {formatDateDisplay(sale.date)}
                          </span>
                        </div>
                      </div>

                      {/* Main Cascade Body: Article and Value */}
                      <div className="py-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Article Box */}
                        <div className="bg-neutral-50 dark:bg-neutral-800/50 p-3 rounded-2xl border border-neutral-100 dark:border-neutral-800">
                          <div className="flex items-center gap-1.5 text-neutral-400 dark:text-neutral-500 mb-1">
                            <ShoppingCart className="w-3.5 h-3.5 text-indigo-500" />
                            <span className="text-[10px] font-black uppercase tracking-wider">Artículo</span>
                          </div>
                          <p className="text-sm font-bold text-neutral-900 dark:text-neutral-100 leading-snug line-clamp-2">
                            {sale.article || 'Artículo no especificado'}
                          </p>
                        </div>

                        {/* Value Box */}
                        <div className="bg-emerald-50/50 dark:bg-emerald-950/20 p-3 rounded-2xl border border-emerald-100/80 dark:border-emerald-900/30 flex flex-col justify-center">
                          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 mb-1">
                            <DollarSign className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-black uppercase tracking-wider">Valor de Compra</span>
                          </div>
                          <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                            ${(sale.totalValue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>

                      {/* Badges and Footer: Type, Moto, Seller, Actions */}
                      <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Payment Type Badge */}
                          <span className={cn(
                            "px-2.5 py-1 text-[10px] uppercase tracking-wider font-extrabold rounded-xl border",
                            sale.type === 'contado'
                              ? "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                              : "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800"
                          )}>
                            {sale.type}
                          </span>

                          {/* Moto Badge if applicable */}
                          {sale.isMoto && (
                            <span className={cn(
                              "px-2.5 py-1 text-[10px] uppercase tracking-wider font-extrabold rounded-xl flex items-center gap-1 border",
                              sale.motoType === 'electrico'
                                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                                : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                            )}>
                              <Bike className="w-3 h-3" />
                              Moto {sale.motoType}
                            </span>
                          )}

                          {/* Seller */}
                          <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium">
                            Por: <strong className="text-neutral-700 dark:text-neutral-300">{sellerName}</strong>
                          </span>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1.5 ml-auto">
                          {sale.type === 'credito' && (
                            <>
                              {onPayCredit && (
                                <button
                                  onClick={() => onPayCredit(sale)}
                                  title="Cobrar Cuota / Registrar Abono"
                                  className="px-2.5 py-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-xl flex items-center gap-1 text-xs font-bold border border-emerald-200 dark:border-emerald-800 transition-colors"
                                >
                                  <Coins className="w-3.5 h-3.5" />
                                  <span>Cobrar</span>
                                </button>
                              )}
                              {onOpenPromissoryNote && (
                                <button
                                  onClick={() => onOpenPromissoryNote(sale)}
                                  title="Ver / Imprimir Pagaré a la Orden"
                                  className="p-1.5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-xl transition-colors"
                                >
                                  <FileText className="w-4 h-4" />
                                </button>
                              )}
                            </>
                          )}

                          {/* Botón Universal del Ícono de Impresora: Abre Centro de Documentos Flotante (Solicitudes, Pagarés, Contratos, Notas de Venta) */}
                          {onOpenDocumentPrintCenter && (
                            <button
                              onClick={() => onOpenDocumentPrintCenter(sale)}
                              title="Centro de Impresión de Documentos (Solicitud, Pagaré, Contrato, Carta de Venta)"
                              className="p-1.5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-xl transition-colors border border-indigo-200 dark:border-indigo-800/60"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => onEditSale(sale)}
                            title="Editar esta venta"
                            className="p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-xl transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onDeleteSale(sale.id)}
                            title="Eliminar esta venta"
                            className="p-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
