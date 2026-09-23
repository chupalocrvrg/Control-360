import React, { useState, useMemo } from 'react';
import {
  Users,
  UserCheck,
  UserX,
  Database,
  FileSpreadsheet,
  Upload,
  RefreshCw,
  Search,
  AlertTriangle,
  CheckCircle2,
  Phone,
  MessageCircle,
  Eye,
  ArrowUpDown,
  Filter,
  Layers,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { PortfolioSnapshot, PortfolioClient, AgingBracket, AGING_BRACKETS } from '../../types/portfolio';
import { round2, formatEcuadorianPhone, getWhatsAppUrl } from '../../lib/portfolioUtils';
import { exportPortfolioClientsToExcel } from '../../lib/portfolioExportUtils';

interface PortfolioCrossAssignmentViewProps {
  masterSnapshot: PortfolioSnapshot | null;
  currentSnapshot: PortfolioSnapshot | null;
  snapshots: PortfolioSnapshot[];
  assignmentStats: {
    totalCount: number;
    totalAmount: number;
    assignedCount: number;
    assignedAmount: number;
    unassignedCount: number;
    unassignedAmount: number;
    collectorBreakdown: Record<string, { count: number; amount: number }>;
    coveragePercent: number;
    unassignedPercent: number;
  };
  assignmentFilter: 'TODOS' | 'ASIGNADOS' | 'SIN_ASIGNAR';
  setAssignmentFilter: (filter: 'TODOS' | 'ASIGNADOS' | 'SIN_ASIGNAR') => void;
  onCrossAssignments: () => Promise<void>;
  onExportUnassignedExcel: () => void;
  onOpenImportMaster: () => void;
  isSaving: boolean;
  onViewClientDetails?: (client: PortfolioClient) => void;
  onOpenWhatsAppModal?: (client: PortfolioClient) => void;
  registeredCollectors: string[];
}

export const PortfolioCrossAssignmentView: React.FC<PortfolioCrossAssignmentViewProps> = ({
  masterSnapshot,
  currentSnapshot,
  snapshots,
  assignmentStats,
  assignmentFilter,
  setAssignmentFilter,
  onCrossAssignments,
  onExportUnassignedExcel,
  onOpenImportMaster,
  isSaving,
  onViewClientDetails,
  onOpenWhatsAppModal,
  registeredCollectors
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCollectorFilter, setSelectedCollectorFilter] = useState<string>('TODOS');
  const [selectedBracketFilter, setSelectedBracketFilter] = useState<string>('TODOS');
  const [sortField, setSortField] = useState<'clientName' | 'amount' | 'overdueDays'>('amount');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Base list of records to inspect (prefer Master Snapshot if present, otherwise current snapshot)
  const baseRecords = useMemo(() => {
    return masterSnapshot?.records || currentSnapshot?.records || [];
  }, [masterSnapshot, currentSnapshot]);

  // Filtered records based on controls
  const filteredList = useMemo(() => {
    return baseRecords.filter(r => {
      const col = (r.collectorName || '').trim();
      const isUnassigned = Boolean(
        r.isUnassigned ||
        !col ||
        col.toLowerCase().includes('sin asignar') ||
        col.toLowerCase().includes('oficina')
      );

      // Assignment filter
      if (assignmentFilter === 'ASIGNADOS' && isUnassigned) return false;
      if (assignmentFilter === 'SIN_ASIGNAR' && !isUnassigned) return false;

      // Collector filter
      if (selectedCollectorFilter !== 'TODOS') {
        if (selectedCollectorFilter === 'SIN_ASIGNAR') {
          if (!isUnassigned) return false;
        } else if (r.collectorName !== selectedCollectorFilter) {
          return false;
        }
      }

      // Bracket filter
      if (selectedBracketFilter !== 'TODOS') {
        const b = r.bracket;
        if (selectedBracketFilter === '0' && r.overdueDays !== 0 && b !== '0') return false;
        if (selectedBracketFilter === '1-30' && (r.overdueDays <= 0 || r.overdueDays > 30) && b !== '1-30') return false;
        if (selectedBracketFilter !== '0' && selectedBracketFilter !== '1-30' && b !== selectedBracketFilter) return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const matchName = (r.clientName || '').toLowerCase().includes(term);
        const matchId = (r.identification || '').toLowerCase().includes(term);
        const matchOp = (r.operationNumber || '').toLowerCase().includes(term);
        const matchCol = (r.collectorName || '').toLowerCase().includes(term);
        const matchItem = (r.itemSold || '').toLowerCase().includes(term);
        const matchPhone = (r.phone || '').toLowerCase().includes(term);
        const matchAddress = (r.address || '').toLowerCase().includes(term);

        if (!matchName && !matchId && !matchOp && !matchCol && !matchItem && !matchPhone && !matchAddress) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      let diff = 0;
      if (sortField === 'overdueDays') {
        diff = (a.overdueDays || 0) - (b.overdueDays || 0);
      } else if (sortField === 'amount') {
        diff = (a.amount || 0) - (b.amount || 0);
      } else if (sortField === 'clientName') {
        diff = (a.clientName || '').localeCompare(b.clientName || '', 'es', { sensitivity: 'base' });
      }
      return sortDirection === 'asc' ? diff : -diff;
    });
  }, [baseRecords, assignmentFilter, selectedCollectorFilter, selectedBracketFilter, searchTerm, sortField, sortDirection]);

  // Reset page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCollectorFilter, selectedBracketFilter, assignmentFilter, pageSize]);

  // Paginated records
  const totalPages = Math.max(1, Math.ceil(filteredList.length / pageSize));
  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredList.slice(start, start + pageSize);
  }, [filteredList, currentPage, pageSize]);

  return (
    <div className="space-y-6">
      {/* Header Banner with Context */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 text-white p-6 rounded-2xl border border-indigo-500/20 shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center space-x-1">
                <Users className="w-3.5 h-3.5" />
                <span>Auditoría de Rutas y Cobertura</span>
              </span>
              {masterSnapshot && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center space-x-1">
                  <Database className="w-3.5 h-3.5" />
                  <span>Cartera Maestra Conectada</span>
                </span>
              )}
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white">
              Cruce de Asignaciones y Cobertura de Cartera
            </h2>
            <p className="text-xs text-indigo-200/90 max-w-3xl leading-relaxed">
              Cruce automatizado entre la <strong>Cartera General Maestra</strong> (universo total obtenido con fecha adelantada en GADA, e.g. 31/12/2026) y los <strong>Reportes de Cobradores</strong>. Permite identificar con certeza matemática a los clientes en gestión de cobro y aislar a los <strong>clientes sin cobrador asignado</strong> (vencidos, créditos dados por fuga o en oficina).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 lg:self-center">
            <button
              onClick={onCrossAssignments}
              disabled={isSaving || baseRecords.length === 0}
              className="flex items-center space-x-2 bg-purple-600 hover:bg-purple-700 active:scale-95 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
              title="Cruza la huella de 4 factores con todas las carteras de cobradores guardadas"
            >
              <RefreshCw className={`w-4 h-4 ${isSaving ? 'animate-spin' : ''}`} />
              <span>{isSaving ? 'Procesando Cruce...' : 'Ejecutar Cruce de Asignaciones'}</span>
            </button>

            <button
              onClick={onExportUnassignedExcel}
              disabled={assignmentStats.unassignedCount === 0}
              className="flex items-center space-x-2 bg-amber-500 hover:bg-amber-600 active:scale-95 text-neutral-950 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
              title="Exporta a Excel solo los clientes sin cobrador asignado"
            >
              <FileSpreadsheet className="w-4 h-4 text-neutral-900" />
              <span>Exportar Sin Asignar ({assignmentStats.unassignedCount})</span>
            </button>

            <button
              onClick={onOpenImportMaster}
              className="flex items-center space-x-2 bg-white/10 hover:bg-white/20 active:scale-95 text-white border border-white/20 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              <Upload className="w-4 h-4 text-indigo-300" />
              <span>Cargar Cartera Maestra</span>
            </button>
          </div>
        </div>
      </div>

      {/* Primary KPI Dashboard: Total Cartera, Asignados, Sin Asignar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Cartera */}
        <div className="bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              Total Cartera General
            </span>
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <Database className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-neutral-900 dark:text-neutral-100 mt-2 font-mono">
            ${assignmentStats.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 flex items-center justify-between">
            <span className="font-semibold text-indigo-600 dark:text-indigo-400">{assignmentStats.totalCount} clientes</span>
            <span>Universo completo</span>
          </div>
        </div>

        {/* Card 2: Asignados */}
        <div className="bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-emerald-200 dark:border-emerald-900/40 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Cartera Asignada
            </span>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2 font-mono">
            ${assignmentStats.assignedAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 flex items-center justify-between">
            <span className="font-semibold text-emerald-700 dark:text-emerald-300">{assignmentStats.assignedCount} clientes</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              {assignmentStats.coveragePercent}% Cobertura
            </span>
          </div>
        </div>

        {/* Card 3: Sin Asignar / En Oficina / Fugas */}
        <div className="bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-amber-200 dark:border-amber-900/40 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Sin Asignar / Fugas / Oficina
            </span>
            <div className="p-2 bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-xl">
              <UserX className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-2 font-mono">
            ${assignmentStats.unassignedAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 flex items-center justify-between">
            <span className="font-semibold text-amber-700 dark:text-amber-300">{assignmentStats.unassignedCount} clientes</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
              {assignmentStats.unassignedPercent}% Fuera de Ruta
            </span>
          </div>
        </div>

        {/* Card 4: Master Portfolio Status */}
        <div className="bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              Fuente de Verdad
            </span>
            <div className="p-2 bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 rounded-xl">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-base font-bold text-neutral-900 dark:text-neutral-100 mt-2 truncate" title={masterSnapshot?.title || 'Sin Cartera Maestra'}>
            {masterSnapshot ? (masterSnapshot.title || `Corte ${masterSnapshot.cutoffDate}`) : 'Corte Regular Actual'}
          </div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            {masterSnapshot ? (
              <span className="text-purple-600 dark:text-purple-400 font-semibold flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 inline" />
                <span>Corte Adelantado: {masterSnapshot.cutoffDate}</span>
              </span>
            ) : (
              <span className="text-amber-600 dark:text-amber-400 font-medium">
                Tip: Sube corte 31/12/2026 como Maestra
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Collector Allocation Distribution Chips */}
      {Object.keys(assignmentStats.collectorBreakdown).length > 0 && (
        <div className="bg-white dark:bg-neutral-900 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              Distribución de Clientes por Cobrador / Ruta
            </span>
            <span className="text-xs font-medium text-neutral-400">
              Haz clic en una ruta para filtrar la lista
            </span>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={() => setSelectedCollectorFilter('TODOS')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                selectedCollectorFilter === 'TODOS'
                  ? 'bg-neutral-900 text-white border-neutral-900 dark:bg-white dark:text-neutral-900'
                  : 'bg-neutral-50 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100'
              }`}
            >
              Todos ({assignmentStats.totalCount})
            </button>

            {Object.entries(assignmentStats.collectorBreakdown).map(([colName, data]: [string, { count: number; amount: number }]) => (
              <button
                key={colName}
                onClick={() => setSelectedCollectorFilter(colName)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center space-x-1.5 ${
                  selectedCollectorFilter === colName
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-neutral-50 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100'
                }`}
              >
                <span>{colName}</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 text-current">
                  {data.count}
                </span>
                <span className="font-mono text-[11px] opacity-80">
                  (${Math.round(data.amount).toLocaleString('en-US')})
                </span>
              </button>
            ))}

            {assignmentStats.unassignedCount > 0 && (
              <button
                onClick={() => {
                  setSelectedCollectorFilter('SIN_ASIGNAR');
                  setAssignmentFilter('SIN_ASIGNAR');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center space-x-1.5 ${
                  selectedCollectorFilter === 'SIN_ASIGNAR'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                    : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800 hover:bg-amber-100'
                }`}
              >
                <AlertTriangle className="w-3 h-3 text-amber-500" />
                <span>Sin Cobrador / En Oficina</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-200 text-amber-900 font-extrabold">
                  {assignmentStats.unassignedCount}
                </span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-neutral-900 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Assignment filter pills: TODOS, ASIGNADOS, SIN_ASIGNAR */}
        <div className="flex items-center space-x-1 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-xl w-full md:w-auto">
          <button
            onClick={() => setAssignmentFilter('TODOS')}
            className={`flex-1 md:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              assignmentFilter === 'TODOS'
                ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-xs'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
            }`}
          >
            Todos ({baseRecords.length})
          </button>
          <button
            onClick={() => setAssignmentFilter('ASIGNADOS')}
            className={`flex-1 md:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center space-x-1 ${
              assignmentFilter === 'ASIGNADOS'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-emerald-600'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Asignados ({assignmentStats.assignedCount})</span>
          </button>
          <button
            onClick={() => setAssignmentFilter('SIN_ASIGNAR')}
            className={`flex-1 md:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center space-x-1 ${
              assignmentFilter === 'SIN_ASIGNAR'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-amber-600'
            }`}
          >
            <UserX className="w-3.5 h-3.5" />
            <span>Sin Asignar ({assignmentStats.unassignedCount})</span>
          </button>
        </div>

        {/* Search input and secondary filters */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto flex-1 justify-end">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Buscar cliente, cédula, artículo, operación..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-neutral-100 dark:bg-neutral-800 rounded-xl text-xs font-medium border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <select
            value={selectedBracketFilter}
            onChange={(e) => setSelectedBracketFilter(e.target.value)}
            className="bg-neutral-100 dark:bg-neutral-800 text-xs font-bold text-neutral-800 dark:text-neutral-200 px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 focus:outline-none cursor-pointer"
          >
            <option value="TODOS">Todos los Rangos</option>
            {AGING_BRACKETS.map(b => (
              <option key={b.key} value={b.key}>{b.label}</option>
            ))}
          </select>

          {/* Sort selector */}
          <div className="flex items-center space-x-1 bg-neutral-100 dark:bg-neutral-800 px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-bold">
            <ArrowUpDown className="w-3.5 h-3.5 text-neutral-400" />
            <select
              value={`${sortField}-${sortDirection}`}
              onChange={(e) => {
                const [f, d] = e.target.value.split('-');
                setSortField(f as any);
                setSortDirection(d as any);
              }}
              className="bg-transparent focus:outline-none cursor-pointer text-neutral-800 dark:text-neutral-200"
            >
              <option value="amount-desc">Mayor Saldo Exigible</option>
              <option value="amount-asc">Menor Saldo Exigible</option>
              <option value="overdueDays-desc">Mayor Días de Atraso</option>
              <option value="overdueDays-asc">Menor Días de Atraso</option>
              <option value="clientName-asc">Cliente (A - Z)</option>
            </select>
          </div>

          {/* Export filtered list to Excel with canonical format */}
          <button
            onClick={() => {
              if (filteredList.length === 0) return;
              const fileName = `Cartera_Cruce_${assignmentFilter.toLowerCase()}_${currentSnapshot?.cutoffDate || 'Corte'}`;
              exportPortfolioClientsToExcel(filteredList, fileName, {
                sheetName: `Cruce_${assignmentFilter}`,
                extraColumnsGenerator: (r) => ({
                  'Tramo de Mora': AGING_BRACKETS.find(b => b.key === r.bracket)?.label || (r.overdueDays === 0 ? '0 Días' : r.bracket),
                  'Cobrador / Ruta Asignada': r.collectorName || 'Sin Asignar',
                  'N° Operación': r.operationNumber || '',
                  'Cédula / RUC': r.identification || '',
                  'Estado Asignación': r.isUnassigned ? 'Sin Asignar (Oficina / Vencido)' : 'Asignado a Cobrador',
                  'Observaciones': r.notes || ''
                })
              });
            }}
            disabled={filteredList.length === 0}
            className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
            title="Exportar registros filtrados a Excel respetando las 15 columnas canónicas"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-white" />
            <span>Exportar ({filteredList.length})</span>
          </button>
        </div>
      </div>

      {/* Main Table */}
      {filteredList.length > 0 ? (
        <div className="space-y-4">
          {/* Top Pagination & Sizing Controls */}
          <div className="bg-white dark:bg-neutral-900 p-3.5 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center space-x-2">
              <span className="font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                Por página:
              </span>
              <div className="flex items-center space-x-1 bg-neutral-100 dark:bg-neutral-800 p-0.5 rounded-xl border border-neutral-200 dark:border-neutral-700">
                {[10, 25, 50, 100].map(sz => (
                  <button
                    key={sz}
                    onClick={() => {
                      setPageSize(sz);
                      setCurrentPage(1);
                    }}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                      pageSize === sz
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                    }`}
                  >
                    {sz}
                  </button>
                ))}
              </div>
              <span className="text-neutral-400 font-medium">
                ({(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, filteredList.length)} de {filteredList.length})
              </span>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center space-x-1.5 font-bold">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="px-2 py-1 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 disabled:opacity-40 hover:bg-neutral-100"
                >
                  &laquo;
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 disabled:opacity-40 hover:bg-neutral-100"
                >
                  Anterior
                </button>
                <span className="px-2.5 py-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-700">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-2.5 py-1 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 disabled:opacity-40 hover:bg-neutral-100"
                >
                  Siguiente
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-2 py-1 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 disabled:opacity-40 hover:bg-neutral-100"
                >
                  &raquo;
                </button>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 dark:bg-neutral-800/60 border-b border-neutral-200 dark:border-neutral-800 text-neutral-500 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="p-3.5">N° Operación</th>
                    <th className="p-3.5">Cliente &amp; Identificación</th>
                    <th className="p-3.5">Artículo / Factura</th>
                    <th className="p-3.5">Saldo Capital Exigible</th>
                    <th className="p-3.5">Atraso &amp; Mora</th>
                    <th className="p-3.5">Estado Asignación</th>
                    <th className="p-3.5 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 font-medium">
                  {paginatedList.map((client, idx) => {
                    const col = (client.collectorName || '').trim();
                    const isUnassigned = Boolean(
                      client.isUnassigned ||
                      !col ||
                      col.toLowerCase().includes('sin asignar') ||
                      col.toLowerCase().includes('oficina')
                    );
                    const bracketMeta = AGING_BRACKETS.find(b => b.key === client.bracket);

                    return (
                      <tr
                        key={client.id || `${client.operationNumber}_${idx}`}
                        className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/30 transition-colors"
                      >
                        <td className="p-3.5 font-mono font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                          {client.operationNumber || 'S/N'}
                        </td>
                        <td className="p-3.5 font-bold text-neutral-900 dark:text-neutral-100">
                          <div>{client.clientName}</div>
                          <div className="text-[10px] text-neutral-400 font-mono font-normal flex items-center space-x-2 mt-0.5">
                            {client.identification && <span>CI: {client.identification}</span>}
                            {client.phone && (
                              <span className="flex items-center space-x-0.5 text-neutral-500">
                                <Phone className="w-2.5 h-2.5" />
                                <span>{client.phone}</span>
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3.5 text-neutral-700 dark:text-neutral-300">
                          <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                            {client.itemSold || 'Art. No especificado'}
                          </div>
                          <div className="text-[10px] text-neutral-500 flex items-center space-x-2 mt-0.5">
                            {client.saleDate && <span>Venta: {client.saleDate}</span>}
                            {client.saleValue !== undefined && client.saleValue > 0 && (
                              <span className="font-mono">PVP: ${client.saleValue.toFixed(2)}</span>
                            )}
                          </div>
                        </td>
                        <td className="p-3.5 font-mono whitespace-nowrap">
                          <div className="text-sm font-black text-neutral-900 dark:text-neutral-100">
                            ${client.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </div>
                          {client.pendingDownPayment !== undefined && client.pendingDownPayment > 0 && (
                            <div className="text-[10px] text-rose-500 font-bold">
                              Entrada pend.: ${client.pendingDownPayment.toFixed(2)}
                            </div>
                          )}
                        </td>
                        <td className="p-3.5 font-mono whitespace-nowrap">
                          <div className="flex items-center space-x-1.5">
                            <span className={`inline-block w-2 h-2 rounded-full ${
                              client.overdueDays === 0 ? 'bg-emerald-500' :
                              client.overdueDays <= 30 ? 'bg-indigo-500' :
                              client.overdueDays <= 60 ? 'bg-amber-500' : 'bg-rose-500'
                            }`} />
                            <span className="font-bold text-neutral-800 dark:text-neutral-200">
                              {client.overdueDays} días
                            </span>
                          </div>
                          <div className="text-[10px] text-neutral-400 mt-0.5">
                            {bracketMeta?.label || (client.overdueDays === 0 ? '0 Días (Al Día)' : `${client.overdueDays}d`)}
                            {client.overdueAmount !== undefined && client.overdueAmount > 0 && (
                              <span className="ml-1 text-rose-500 font-bold">(${client.overdueAmount.toFixed(2)})</span>
                            )}
                          </div>
                        </td>
                        <td className="p-3.5 whitespace-nowrap">
                          {isUnassigned ? (
                            <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                              <UserX className="w-3.5 h-3.5 text-amber-600" />
                              <span>Sin Cobrador / En Oficina</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                              <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{client.collectorName}</span>
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center space-x-1.5">
                            {onViewClientDetails && (
                              <button
                                onClick={() => onViewClientDetails(client)}
                                title="Ver ficha completa"
                                className="p-1.5 text-neutral-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg cursor-pointer transition-colors"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            )}
                            {onOpenWhatsAppModal && (
                              <button
                                onClick={() => onOpenWhatsAppModal(client)}
                                title="Contactar vía WhatsApp"
                                className="p-1.5 text-neutral-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg cursor-pointer transition-colors"
                              >
                                <MessageCircle className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-neutral-50 dark:bg-neutral-800/80 border-t border-neutral-200 dark:border-neutral-800">
                  <tr>
                    <td colSpan={3} className="p-3.5 font-bold text-neutral-900 dark:text-neutral-100">
                      Total Filtrado ({filteredList.length} clientes)
                    </td>
                    <td className="p-3.5 font-mono font-black text-sm text-neutral-900 dark:text-neutral-100">
                      ${filteredList.reduce((acc, r) => acc + (r.amount || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td colSpan={3} className="p-3.5 text-neutral-500 text-xs">
                      {assignmentFilter === 'SIN_ASIGNAR' ? 'Cuentas identificadas para reasignación o gestión de cobranza prejudicial' : 'Cuentas bajo supervisión'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Bottom Pagination */}
          {totalPages > 1 && (
            <div className="bg-white dark:bg-neutral-900 p-3 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm flex items-center justify-between text-xs">
              <span className="text-neutral-500 dark:text-neutral-400 font-medium">
                Página {currentPage} de {totalPages} • Total: {filteredList.length} clientes
              </span>
              <div className="flex items-center space-x-1.5 font-bold">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 disabled:opacity-40"
                >
                  Primera
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 disabled:opacity-40"
                >
                  Anterior
                </button>
                <span className="px-3 py-1 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded-lg border border-indigo-200 dark:border-indigo-800">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-2.5 py-1 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 disabled:opacity-40"
                >
                  Siguiente
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-2.5 py-1 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 disabled:opacity-40"
                >
                  Última
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
            No se encontraron clientes con los filtros aplicados
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-md mx-auto">
            Intenta cambiar el filtro de asignación, seleccionar otro cobrador o limpiar el término de búsqueda.
          </p>
        </div>
      )}
    </div>
  );
};
