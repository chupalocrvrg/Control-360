import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  ArrowRight, 
  CheckCircle2, 
  AlertTriangle, 
  Calendar, 
  Filter, 
  Download, 
  ChevronDown, 
  ChevronUp, 
  Users, 
  DollarSign, 
  Eye, 
  X, 
  FileSpreadsheet,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Minus
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { PortfolioSnapshot, PortfolioClient, AgingBracket, AGING_BRACKETS } from '../../types/portfolio';
import { round2, getRecordKey } from '../../lib/portfolioUtils';
import { exportPortfolioClientsToExcel } from '../../lib/portfolioExportUtils';

interface PortfolioTransitionAnalysisProps {
  initialSnapshot: PortfolioSnapshot | null;
  closingSnapshot: PortfolioSnapshot | null;
  initialDate: string;
  closingDate: string;
  availableCutoffDates: string[];
  onSelectStartDate: (date: string) => void;
  onSelectEndDate: (date: string) => void;
  collectors: string[];
  selectedCollectorFilter: string;
  onCollectorFilterChange: (collector: string) => void;
  onSaveClosure?: () => void;
  isSavingClosure?: boolean;
}

const ORDERED_BRACKETS: { key: AgingBracket; label: string; min: number; max: number }[] = [
  { key: '0', label: '0 Días (Al Día)', min: 0, max: 0 },
  { key: '1-30', label: '1 - 30 Días', min: 1, max: 30 },
  { key: '31-60', label: '31 - 60 Días', min: 31, max: 60 },
  { key: '61-90', label: '61 - 90 Días', min: 61, max: 90 },
  { key: '91-180', label: '91 - 180 Días', min: 91, max: 180 },
  { key: '>181', label: '> 181 Días (Crítica)', min: 181, max: 99999 }
];

export const PortfolioTransitionAnalysis: React.FC<PortfolioTransitionAnalysisProps> = ({
  initialSnapshot,
  closingSnapshot,
  initialDate,
  closingDate,
  availableCutoffDates,
  onSelectStartDate,
  onSelectEndDate,
  collectors,
  selectedCollectorFilter,
  onCollectorFilterChange,
  onSaveClosure,
  isSavingClosure = false
}) => {
  const [viewMetric, setViewMetric] = useState<'amount' | 'count'>('amount');
  const [isMatrixExpanded, setIsMatrixExpanded] = useState<boolean>(true);
  const [selectedCellDetail, setSelectedCellDetail] = useState<{
    title: string;
    clients: {
      client: PortfolioClient;
      initialAmount?: number;
      initialDays?: number;
      closingAmount?: number;
      closingDays?: number;
      transitionType: 'recuperado' | 'mejorado' | 'mantenido' | 'deteriorado' | 'nuevo';
    }[];
  } | null>(null);

  // Filtered records by collector
  const initialRecords = useMemo(() => {
    if (!initialSnapshot) return [];
    if (selectedCollectorFilter === 'TODOS') return initialSnapshot.records || [];
    return (initialSnapshot.records || []).filter(r => r.collectorName === selectedCollectorFilter);
  }, [initialSnapshot, selectedCollectorFilter]);

  const closingRecords = useMemo(() => {
    if (!closingSnapshot) return [];
    if (selectedCollectorFilter === 'TODOS') return closingSnapshot.records || [];
    return (closingSnapshot.records || []).filter(r => r.collectorName === selectedCollectorFilter);
  }, [closingSnapshot, selectedCollectorFilter]);

  // Transition Engine
  const transitionData = useMemo(() => {
    const initialMap = new Map<string, PortfolioClient>();
    initialRecords.forEach(r => initialMap.set(getRecordKey(r), r));

    const closingMap = new Map<string, PortfolioClient>();
    closingRecords.forEach(r => closingMap.set(getRecordKey(r), r));

    // Matrix storage: row = initialBracket (or 'NEW'), col = closingBracket (or 'RECOVERED')
    // key: `${row}->${col}`
    const matrixCells: Record<string, {
      count: number;
      amount: number;
      clients: {
        client: PortfolioClient;
        initialAmount?: number;
        initialDays?: number;
        closingAmount?: number;
        closingDays?: number;
        transitionType: 'recuperado' | 'mejorado' | 'mantenido' | 'deteriorado' | 'nuevo';
      }[];
    }> = {};

    const getBracketRank = (b: string) => {
      const idx = ORDERED_BRACKETS.findIndex(ob => ob.key === b);
      return idx >= 0 ? idx : 0;
    };

    // Analyze Initial Clients
    initialMap.forEach((initClient, key) => {
      const initBracket = initClient.bracket || '0';
      const closingClient = closingMap.get(key);

      if (!closingClient) {
        // Exited portfolio: Recovered 100% / Paid
        const cellKey = `${initBracket}->RECOVERED`;
        if (!matrixCells[cellKey]) matrixCells[cellKey] = { count: 0, amount: 0, clients: [] };
        matrixCells[cellKey].count += 1;
        matrixCells[cellKey].amount = round2(matrixCells[cellKey].amount + round2(initClient.amount));
        matrixCells[cellKey].clients.push({
          client: initClient,
          initialAmount: round2(initClient.amount),
          initialDays: initClient.overdueDays,
          closingAmount: 0,
          closingDays: 0,
          transitionType: 'recuperado'
        });
      } else {
        const closeBracket = closingClient.bracket || '0';
        const cellKey = `${initBracket}->${closeBracket}`;
        if (!matrixCells[cellKey]) matrixCells[cellKey] = { count: 0, amount: 0, clients: [] };
        matrixCells[cellKey].count += 1;
        matrixCells[cellKey].amount = round2(matrixCells[cellKey].amount + round2(closingClient.amount));

        const initRank = getBracketRank(initBracket);
        const closeRank = getBracketRank(closeBracket);
        let transType: 'mejorado' | 'mantenido' | 'deteriorado' = 'mantenido';
        if (closeRank < initRank) transType = 'mejorado';
        else if (closeRank > initRank) transType = 'deteriorado';

        matrixCells[cellKey].clients.push({
          client: closingClient,
          initialAmount: round2(initClient.amount),
          initialDays: initClient.overdueDays,
          closingAmount: round2(closingClient.amount),
          closingDays: closingClient.overdueDays,
          transitionType: transType
        });
      }
    });

    // Analyze New Clients (in closing but not in initial)
    closingMap.forEach((closeClient, key) => {
      if (!initialMap.has(key)) {
        const closeBracket = closeClient.bracket || '0';
        const cellKey = `NEW->${closeBracket}`;
        if (!matrixCells[cellKey]) matrixCells[cellKey] = { count: 0, amount: 0, clients: [] };
        matrixCells[cellKey].count += 1;
        matrixCells[cellKey].amount = round2(matrixCells[cellKey].amount + round2(closeClient.amount));
        matrixCells[cellKey].clients.push({
          client: closeClient,
          initialAmount: 0,
          initialDays: 0,
          closingAmount: round2(closeClient.amount),
          closingDays: closeClient.overdueDays,
          transitionType: 'nuevo'
        });
      }
    });

    // Flow by Bracket
    const bracketFlows = ORDERED_BRACKETS.map((b, bIdx) => {
      // Initial stats
      const initClientsInB = initialRecords.filter(r => (r.bracket || '0') === b.key);
      const initCount = initClientsInB.length;
      const initAmount = round2(initClientsInB.reduce((acc, r) => acc + round2(r.amount), 0));

      // Recovered from this bracket
      const recCell = matrixCells[`${b.key}->RECOVERED`] || { count: 0, amount: 0, clients: [] };

      // Improved from this bracket to lower brackets
      let improvedCount = recCell.count;
      let improvedAmount = recCell.amount;
      const improvedClients = [...recCell.clients];

      for (let i = 0; i < bIdx; i++) {
        const toKey = ORDERED_BRACKETS[i].key;
        const c = matrixCells[`${b.key}->${toKey}`];
        if (c) {
          improvedCount += c.count;
          improvedAmount = round2(improvedAmount + c.amount);
          improvedClients.push(...c.clients);
        }
      }

      // Maintained in this bracket
      const maintCell = matrixCells[`${b.key}->${b.key}`] || { count: 0, amount: 0, clients: [] };

      // Deteriorated from this bracket to higher brackets
      let deterioratedCount = 0;
      let deterioratedAmount = 0;
      const deterioratedClients: typeof maintCell.clients = [];
      for (let i = bIdx + 1; i < ORDERED_BRACKETS.length; i++) {
        const toKey = ORDERED_BRACKETS[i].key;
        const c = matrixCells[`${b.key}->${toKey}`];
        if (c) {
          deterioratedCount += c.count;
          deterioratedAmount = round2(deterioratedAmount + c.amount);
          deterioratedClients.push(...c.clients);
        }
      }

      // Inflow into this bracket from lower brackets or new
      let inflowCount = 0;
      let inflowAmount = 0;
      const inflowClients: typeof maintCell.clients = [];
      // From lower brackets that deteriorated into this bracket
      for (let i = 0; i < bIdx; i++) {
        const fromKey = ORDERED_BRACKETS[i].key;
        const c = matrixCells[`${fromKey}->${b.key}`];
        if (c) {
          inflowCount += c.count;
          inflowAmount = round2(inflowAmount + c.amount);
          inflowClients.push(...c.clients);
        }
      }
      // From NEW into this bracket
      const newIntoB = matrixCells[`NEW->${b.key}`];
      if (newIntoB) {
        inflowCount += newIntoB.count;
        inflowAmount = round2(inflowAmount + newIntoB.amount);
        inflowClients.push(...newIntoB.clients);
      }

      // Closing stats
      const closeClientsInB = closingRecords.filter(r => (r.bracket || '0') === b.key);
      const closeCount = closeClientsInB.length;
      const closeAmount = round2(closeClientsInB.reduce((acc, r) => acc + round2(r.amount), 0));

      const deltaAmount = round2(closeAmount - initAmount);
      const deltaCount = closeCount - initCount;

      return {
        bracket: b,
        initCount,
        initAmount,
        closeCount,
        closeAmount,
        deltaAmount,
        deltaCount,
        recoveredCount: recCell.count,
        recoveredAmount: recCell.amount,
        improvedCount,
        improvedAmount,
        improvedClients,
        maintainedCount: maintCell.count,
        maintainedAmount: maintCell.amount,
        maintainedClients: maintCell.clients,
        deterioratedCount,
        deterioratedAmount,
        deterioratedClients,
        inflowCount,
        inflowAmount,
        inflowClients
      };
    });

    // Global Totals
    const totalInitAmount = round2(initialRecords.reduce((acc, r) => acc + round2(r.amount), 0));
    const totalCloseAmount = round2(closingRecords.reduce((acc, r) => acc + round2(r.amount), 0));
    const totalRecoveredAmount = round2(
      ORDERED_BRACKETS.reduce((acc, b) => acc + (matrixCells[`${b.key}->RECOVERED`]?.amount || 0), 0)
    );
    const totalRecoveredCount = ORDERED_BRACKETS.reduce((acc, b) => acc + (matrixCells[`${b.key}->RECOVERED`]?.count || 0), 0);

    const totalNewAmount = round2(
      ORDERED_BRACKETS.reduce((acc, b) => acc + (matrixCells[`NEW->${b.key}`]?.amount || 0), 0)
    );
    const totalNewCount = ORDERED_BRACKETS.reduce((acc, b) => acc + (matrixCells[`NEW->${b.key}`]?.count || 0), 0);

    return {
      matrixCells,
      bracketFlows,
      totalInitAmount,
      totalCloseAmount,
      totalRecoveredAmount,
      totalRecoveredCount,
      totalNewAmount,
      totalNewCount,
      totalInitClients: initialRecords.length,
      totalCloseClients: closingRecords.length
    };
  }, [initialRecords, closingRecords]);

  // Export Transition Matrix to Excel
  const handleExportMatrixExcel = () => {
    const wb = XLSX.utils.book_new();

    // 1. Resumen de Flujo
    const flowRows = transitionData.bracketFlows.map(f => ({
      'Tramo Morosidad': f.bracket.label,
      'Clientes Iniciales': f.initCount,
      'Monto Inicial ($)': f.initAmount,
      'Recuperados / Cancelados ($)': f.recoveredAmount,
      'Mejoraron Tramo ($)': f.improvedAmount,
      'Mantenidos ($)': f.maintainedAmount,
      'Deteriorados ($)': f.deterioratedAmount,
      'Nuevos / Entradas ($)': f.inflowAmount,
      'Clientes Cierre': f.closeCount,
      'Monto Cierre ($)': f.closeAmount,
      'Variación Saldo ($)': f.deltaAmount
    }));
    const wsFlow = XLSX.utils.json_to_sheet(flowRows);
    XLSX.utils.book_append_sheet(wb, wsFlow, 'Flujo_por_Cartera');

    // 2. Matriz Cruzada de Transición
    const matrixExportRows: any[] = [];
    ORDERED_BRACKETS.forEach(rowB => {
      const rowData: any = { 'Tramo Origen': rowB.label };
      rowData['Cancelado / Saneado 100%'] = viewMetric === 'amount' 
        ? transitionData.matrixCells[`${rowB.key}->RECOVERED`]?.amount || 0
        : transitionData.matrixCells[`${rowB.key}->RECOVERED`]?.count || 0;

      ORDERED_BRACKETS.forEach(colB => {
        const cell = transitionData.matrixCells[`${rowB.key}->${colB.key}`];
        rowData[colB.label] = viewMetric === 'amount' ? (cell?.amount || 0) : (cell?.count || 0);
      });

      const initB = transitionData.bracketFlows.find(f => f.bracket.key === rowB.key);
      rowData['Total Inicial'] = viewMetric === 'amount' ? (initB?.initAmount || 0) : (initB?.initCount || 0);
      matrixExportRows.push(rowData);
    });

    // Add New row
    const newRowData: any = { 'Tramo Origen': 'Nuevos Ingresos en Mora' };
    newRowData['Cancelado / Saneado 100%'] = 0;
    ORDERED_BRACKETS.forEach(colB => {
      const cell = transitionData.matrixCells[`NEW->${colB.key}`];
      newRowData[colB.label] = viewMetric === 'amount' ? (cell?.amount || 0) : (cell?.count || 0);
    });
    newRowData['Total Inicial'] = viewMetric === 'amount' ? transitionData.totalNewAmount : transitionData.totalNewCount;
    matrixExportRows.push(newRowData);

    const wsMatrix = XLSX.utils.json_to_sheet(matrixExportRows);
    XLSX.utils.book_append_sheet(wb, wsMatrix, 'Matriz_Transicion');

    XLSX.writeFile(wb, `Matriz_Movimiento_Carteras_${initialDate}_vs_${closingDate}.xlsx`);
  };

  const minDate = availableCutoffDates[0] || '';
  const maxDate = availableCutoffDates[availableCutoffDates.length - 1] || '';

  return (
    <div className="space-y-8">
      {/* Header Banner & Date Range Selector */}
      <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-900 text-white p-6 rounded-2xl shadow-lg border border-indigo-500/30">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold uppercase tracking-wider bg-indigo-500/30 text-indigo-300 border border-indigo-400/30">
                Evaluación e Inicio vs Cierre
              </span>
              <span className="text-xs text-indigo-200">
                • Movimiento Integral de Todas las Carteras
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-black mt-1 tracking-tight">
              Análisis de Migración y Flujo de Cartera
            </h2>
            <p className="text-xs md:text-sm text-indigo-200 mt-1 max-w-3xl leading-relaxed">
              Compara de manera interactiva cómo evolucionaron todos los clientes entre dos fechas reales de corte.
              Visualiza la variación tramo a tramo y la matriz cruzada de origen versus destino.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleExportMatrixExcel}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all border border-white/15 cursor-pointer shadow-sm"
              title="Descargar matriz y resumen en Excel"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Exportar Excel</span>
            </button>

            {onSaveClosure && (
              <button
                onClick={onSaveClosure}
                disabled={isSavingClosure}
                className="flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSavingClosure ? 'Guardando...' : 'Guardar como Corte Oficial'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Date Controls & Filters Bar */}
        <div className="mt-6 pt-5 border-t border-white/10 grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Base Cutoff Date (Fecha Origen) */}
          <div className="bg-black/30 p-3.5 rounded-xl border border-white/10 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-indigo-200 font-bold uppercase tracking-wider">
              <span className="flex items-center space-x-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                <span>1. Fecha Corte Origen (Inicio)</span>
              </span>
              {minDate && <span className="text-[10px] text-neutral-400">Mín: {minDate}</span>}
            </div>
            <div className="flex items-center space-x-2">
              <select
                value={initialDate}
                onChange={(e) => onSelectStartDate(e.target.value)}
                className="w-full bg-white/10 text-white text-xs md:text-sm font-semibold px-3 py-2 rounded-lg border border-white/20 focus:outline-none focus:border-indigo-400 cursor-pointer"
              >
                {availableCutoffDates.map(d => (
                  <option key={`start-${d}`} value={d} className="bg-neutral-900 text-white">
                    Corte: {d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Comparison Cutoff Date (Fecha Cierre) */}
          <div className="bg-black/30 p-3.5 rounded-xl border border-white/10 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-indigo-200 font-bold uppercase tracking-wider">
              <span className="flex items-center space-x-1.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                <span>2. Fecha Corte Destino (Cierre)</span>
              </span>
              {maxDate && <span className="text-[10px] text-neutral-400">Máx: {maxDate}</span>}
            </div>
            <div className="flex items-center space-x-2">
              <select
                value={closingDate}
                onChange={(e) => onSelectEndDate(e.target.value)}
                className="w-full bg-white/10 text-white text-xs md:text-sm font-semibold px-3 py-2 rounded-lg border border-white/20 focus:outline-none focus:border-emerald-400 cursor-pointer"
              >
                {availableCutoffDates.map(d => (
                  <option key={`end-${d}`} value={d} className="bg-neutral-900 text-white">
                    Corte: {d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Collector / Route Filter */}
          <div className="bg-black/30 p-3.5 rounded-xl border border-white/10 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-indigo-200 font-bold uppercase tracking-wider">
              <span className="flex items-center space-x-1.5">
                <Filter className="w-3.5 h-3.5 text-amber-400" />
                <span>3. Filtrar por Cobrador / Ruta</span>
              </span>
              <span className="text-[10px] text-neutral-400">
                {selectedCollectorFilter === 'TODOS' ? 'Consolidado' : 'Individual'}
              </span>
            </div>
            <select
              value={selectedCollectorFilter}
              onChange={(e) => onCollectorFilterChange(e.target.value)}
              className="w-full bg-white/10 text-white text-xs md:text-sm font-semibold px-3 py-2 rounded-lg border border-white/20 focus:outline-none focus:border-amber-400 cursor-pointer"
            >
              <option value="TODOS" className="bg-neutral-900 text-white font-bold">
                ★ Toda la Empresa (Consolidado Global)
              </option>
              {collectors.map(c => (
                <option key={c} value={c} className="bg-neutral-900 text-white">
                  Ruta / Cobrador: {c}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Global Performance Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Cartera Inicial */}
        <div className="bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
            Cartera en Origen ({initialDate})
          </span>
          <div className="text-2xl font-black text-neutral-900 dark:text-neutral-100 mt-1 font-mono">
            ${transitionData.totalInitAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 flex items-center space-x-1">
            <Users className="w-3.5 h-3.5" />
            <span>{transitionData.totalInitClients} clientes registrados</span>
          </div>
        </div>

        {/* Cartera Cierre */}
        <div className="bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
            Cartera en Destino ({closingDate})
          </span>
          <div className="text-2xl font-black text-neutral-900 dark:text-neutral-100 mt-1 font-mono">
            ${transitionData.totalCloseAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 flex items-center space-x-1">
            <Users className="w-3.5 h-3.5" />
            <span>{transitionData.totalCloseClients} clientes registrados</span>
          </div>
        </div>

        {/* Clientes Recuperados / Al Día */}
        <div className="bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/20 dark:bg-emerald-950/10 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Recuperado / Saneado 100%
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200">
              Exitoso
            </span>
          </div>
          <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400 mt-1 font-mono">
            ${transitionData.totalRecoveredAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-emerald-700 dark:text-emerald-300 mt-1 flex items-center space-x-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{transitionData.totalRecoveredCount} clientes cancelaron / al día</span>
          </div>
        </div>

        {/* Variación Neta */}
        {(() => {
          const delta = round2(transitionData.totalCloseAmount - transitionData.totalInitAmount);
          const isReduced = delta <= 0;
          return (
            <div className={`p-5 rounded-2xl border shadow-sm ${
              isReduced 
                ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800' 
                : 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800'
            }`}>
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Variación Neta de Cartera
              </span>
              <div className={`text-2xl font-black mt-1 font-mono flex items-center space-x-1 ${
                isReduced ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'
              }`}>
                {isReduced ? <ArrowDownRight className="w-6 h-6" /> : <ArrowUpRight className="w-6 h-6" />}
                <span>${Math.abs(delta).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="text-xs text-neutral-600 dark:text-neutral-400 mt-1 font-medium">
                {isReduced 
                  ? `Disminución de morosidad (${((Math.abs(delta) / (transitionData.totalInitAmount || 1)) * 100).toFixed(1)}%)`
                  : `Incremento de mora (${((delta / (transitionData.totalInitAmount || 1)) * 100).toFixed(1)}%)`}
              </div>
            </div>
          );
        })()}
      </div>

      {/* ========================================================================= */}
      {/* 1. SECCIÓN 1: RESUMEN DE FLUJO NETO POR TRAMO DE MOROSIDAD (AMBAS: OPCIÓN 1) */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-neutral-50/50 dark:bg-neutral-950/50">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Opción A: Resumen Tramo a Tramo
            </span>
            <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-50">
              Movimiento y Comportamiento por Tramo de Cartera
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              Visualiza cómo fluctuó el saldo en cada rango de atraso: cuántos clientes mejoraron su tramo, cuántos se mantuvieron y cuántos envejecieron.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-neutral-500">
              Ruta: <strong className="text-neutral-900 dark:text-neutral-100">{selectedCollectorFilter}</strong>
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-100 dark:bg-neutral-800/80 text-neutral-600 dark:text-neutral-300 font-bold uppercase tracking-wider border-b border-neutral-200 dark:border-neutral-700">
              <tr>
                <th className="py-3 px-4">Tramo de Cartera</th>
                <th className="py-3 px-4 text-right">Inicio ({initialDate})</th>
                <th className="py-3 px-4 text-center text-emerald-700 dark:text-emerald-400">Mejoraron / Saneados</th>
                <th className="py-3 px-4 text-center text-neutral-600 dark:text-neutral-300">Mantenidos</th>
                <th className="py-3 px-4 text-center text-rose-700 dark:text-rose-400">Deteriorados</th>
                <th className="py-3 px-4 text-center text-indigo-600 dark:text-indigo-400">Nuevas Entradas</th>
                <th className="py-3 px-4 text-right">Cierre ({closingDate})</th>
                <th className="py-3 px-4 text-center">Variación Neta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 font-medium">
              {transitionData.bracketFlows.map(flow => {
                const isImproved = flow.deltaAmount <= 0;
                return (
                  <tr key={flow.bracket.key} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors">
                    {/* Tramo */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-neutral-900 dark:text-neutral-100 text-sm">
                        {flow.bracket.label}
                      </div>
                      <div className="text-[11px] text-neutral-400">
                        {flow.bracket.key === '0' ? 'Al día o por vencer' : `${flow.bracket.min} a ${flow.bracket.max} días`}
                      </div>
                    </td>

                    {/* Saldo Inicial */}
                    <td className="py-3.5 px-4 text-right font-mono">
                      <div className="font-bold text-neutral-900 dark:text-neutral-100">
                        ${flow.initAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div className="text-[11px] text-neutral-400">
                        {flow.initCount} clientes
                      </div>
                    </td>

                    {/* Mejoraron / Saneados */}
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => {
                          if (flow.improvedClients.length === 0) return;
                          setSelectedCellDetail({
                            title: `Clientes que Mejoraron / Cancelaron desde ${flow.bracket.label}`,
                            clients: flow.improvedClients
                          });
                        }}
                        disabled={flow.improvedClients.length === 0}
                        className={`inline-flex flex-col items-center px-2.5 py-1 rounded-lg border transition-all ${
                          flow.improvedClients.length > 0 
                            ? 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 cursor-pointer'
                            : 'bg-neutral-100 dark:bg-neutral-800 border-transparent text-neutral-400 opacity-60'
                        }`}
                      >
                        <span className="font-bold font-mono">
                          ${flow.improvedAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className="text-[10px]">
                          {flow.improvedCount} clientes ({flow.recoveredCount} cancelaron)
                        </span>
                      </button>
                    </td>

                    {/* Mantenidos */}
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => {
                          if (flow.maintainedClients.length === 0) return;
                          setSelectedCellDetail({
                            title: `Clientes que se Mantuvieron en ${flow.bracket.label}`,
                            clients: flow.maintainedClients
                          });
                        }}
                        disabled={flow.maintainedClients.length === 0}
                        className={`inline-flex flex-col items-center px-2.5 py-1 rounded-lg border transition-all ${
                          flow.maintainedClients.length > 0 
                            ? 'bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 cursor-pointer'
                            : 'bg-neutral-100 dark:bg-neutral-800 border-transparent text-neutral-400 opacity-60'
                        }`}
                      >
                        <span className="font-bold font-mono">
                          ${flow.maintainedAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className="text-[10px]">
                          {flow.maintainedCount} clientes
                        </span>
                      </button>
                    </td>

                    {/* Deteriorados */}
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => {
                          if (flow.deterioratedClients.length === 0) return;
                          setSelectedCellDetail({
                            title: `Clientes que Empeoraron / Envejecieron desde ${flow.bracket.label}`,
                            clients: flow.deterioratedClients
                          });
                        }}
                        disabled={flow.deterioratedClients.length === 0}
                        className={`inline-flex flex-col items-center px-2.5 py-1 rounded-lg border transition-all ${
                          flow.deterioratedClients.length > 0 
                            ? 'bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 cursor-pointer'
                            : 'bg-neutral-100 dark:bg-neutral-800 border-transparent text-neutral-400 opacity-60'
                        }`}
                      >
                        <span className="font-bold font-mono">
                          ${flow.deterioratedAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className="text-[10px]">
                          {flow.deterioratedCount} clientes
                        </span>
                      </button>
                    </td>

                    {/* Nuevas Entradas */}
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => {
                          if (flow.inflowClients.length === 0) return;
                          setSelectedCellDetail({
                            title: `Nuevas Entradas / Migraciones hacia ${flow.bracket.label}`,
                            clients: flow.inflowClients
                          });
                        }}
                        disabled={flow.inflowClients.length === 0}
                        className={`inline-flex flex-col items-center px-2.5 py-1 rounded-lg border transition-all ${
                          flow.inflowClients.length > 0 
                            ? 'bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 border-indigo-200 dark:border-indigo-800 text-indigo-800 dark:text-indigo-200 cursor-pointer'
                            : 'bg-neutral-100 dark:bg-neutral-800 border-transparent text-neutral-400 opacity-60'
                        }`}
                      >
                        <span className="font-bold font-mono">
                          ${flow.inflowAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className="text-[10px]">
                          {flow.inflowCount} clientes
                        </span>
                      </button>
                    </td>

                    {/* Saldo Cierre */}
                    <td className="py-3.5 px-4 text-right font-mono">
                      <div className="font-bold text-neutral-900 dark:text-neutral-100">
                        ${flow.closeAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div className="text-[11px] text-neutral-400">
                        {flow.closeCount} clientes
                      </div>
                    </td>

                    {/* Variación Neta */}
                    <td className="py-3.5 px-4 text-center">
                      <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                        isImproved 
                          ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300' 
                          : 'bg-rose-100 dark:bg-rose-900/50 text-rose-800 dark:text-rose-300'
                      }`}>
                        {isImproved ? <TrendingDown className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />}
                        <span>
                          {isImproved ? '-' : '+'}${Math.abs(flow.deltaAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-neutral-100 dark:bg-neutral-800 font-bold border-t-2 border-neutral-300 dark:border-neutral-700">
              <tr>
                <td className="py-3.5 px-4 text-neutral-900 dark:text-neutral-100 uppercase">
                  TOTAL CONSOLIDADO
                </td>
                <td className="py-3.5 px-4 text-right font-mono text-neutral-900 dark:text-neutral-100">
                  ${transitionData.totalInitAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  <div className="text-[10px] text-neutral-500 font-normal">
                    {transitionData.totalInitClients} clientes
                  </div>
                </td>
                <td className="py-3.5 px-4 text-center font-mono text-emerald-700 dark:text-emerald-300">
                  ${transitionData.totalRecoveredAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  <div className="text-[10px] text-emerald-600 font-normal">
                    {transitionData.totalRecoveredCount} cancelaron
                  </div>
                </td>
                <td className="py-3.5 px-4 text-center font-mono text-neutral-500">
                  -
                </td>
                <td className="py-3.5 px-4 text-center font-mono text-neutral-500">
                  -
                </td>
                <td className="py-3.5 px-4 text-center font-mono text-indigo-600 dark:text-indigo-400">
                  ${transitionData.totalNewAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  <div className="text-[10px] text-indigo-500 font-normal">
                    {transitionData.totalNewCount} nuevos
                  </div>
                </td>
                <td className="py-3.5 px-4 text-right font-mono text-neutral-900 dark:text-neutral-100">
                  ${transitionData.totalCloseAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  <div className="text-[10px] text-neutral-500 font-normal">
                    {transitionData.totalCloseClients} clientes
                  </div>
                </td>
                <td className="py-3.5 px-4 text-center">
                  {(() => {
                    const deltaTotal = round2(transitionData.totalCloseAmount - transitionData.totalInitAmount);
                    const isRed = deltaTotal <= 0;
                    return (
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        isRed 
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300' 
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300'
                      }`}>
                        {isRed ? '-' : '+'}${Math.abs(deltaTotal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    );
                  })()}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. SECCIÓN 2: MATRIZ DE TRANSICIÓN DETALLADA (AMBAS: OPCIÓN 2)             */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-neutral-50/50 dark:bg-neutral-950/50">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Opción B: Matriz Cruzada
              </span>
              <button
                onClick={() => setIsMatrixExpanded(!isMatrixExpanded)}
                className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors cursor-pointer"
              >
                {isMatrixExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
            <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-50">
              Matriz Cruzada de Transición (Origen vs. Destino)
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              Mapea el destino exacto de cada cliente desde su tramo inicial ({initialDate}) hacia su tramo final ({closingDate}). Haz clic en cualquier celda para auditar la lista de clientes.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            {/* View Mode Toggle: Amount ($) vs Count (#) */}
            <div className="flex items-center bg-neutral-200 dark:bg-neutral-800 p-1 rounded-xl">
              <button
                onClick={() => setViewMetric('amount')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMetric === 'amount'
                    ? 'bg-white dark:bg-neutral-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
                }`}
              >
                Ver en Montos ($)
              </button>
              <button
                onClick={() => setViewMetric('count')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMetric === 'count'
                    ? 'bg-white dark:bg-neutral-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
                }`}
              >
                Ver en N° Clientes (#)
              </button>
            </div>
          </div>
        </div>

        {isMatrixExpanded && (
          <div className="overflow-x-auto">
            <table className="w-full text-center text-xs border-collapse">
              <thead>
                <tr className="bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-bold uppercase tracking-wider border-b border-neutral-200 dark:border-neutral-700">
                  <th className="py-3 px-3 text-left min-w-[140px] sticky left-0 bg-neutral-100 dark:bg-neutral-800 z-10">
                    Tramo Origen \ Destino
                  </th>
                  <th className="py-3 px-3 text-emerald-800 dark:text-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/40 min-w-[120px]">
                    Cancelado / Saneado 100%
                  </th>
                  {ORDERED_BRACKETS.map(b => (
                    <th key={`head-${b.key}`} className="py-3 px-3 min-w-[100px]">
                      {b.label}
                    </th>
                  ))}
                  <th className="py-3 px-3 bg-neutral-200/70 dark:bg-neutral-800/90 text-neutral-900 dark:text-neutral-100 min-w-[110px]">
                    Total Origen
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {/* Regular Brackets Rows */}
                {ORDERED_BRACKETS.map((rowB, rIdx) => {
                  const initBStats = transitionData.bracketFlows.find(f => f.bracket.key === rowB.key);

                  return (
                    <tr key={`row-${rowB.key}`} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30">
                      {/* Row Header (Origin) */}
                      <td className="py-3 px-3 text-left font-bold text-neutral-900 dark:text-neutral-100 bg-neutral-50 dark:bg-neutral-900/80 sticky left-0 z-10 border-r border-neutral-200 dark:border-neutral-800">
                        <div>{rowB.label}</div>
                        <div className="text-[10px] text-neutral-400 font-normal">
                          {initBStats?.initCount || 0} cl. (${(initBStats?.initAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                        </div>
                      </td>

                      {/* Cell: Recovered / Cancelled (exited portfolio) */}
                      {(() => {
                        const cell = transitionData.matrixCells[`${rowB.key}->RECOVERED`];
                        const count = cell?.count || 0;
                        const amount = cell?.amount || 0;
                        return (
                          <td className="p-1.5 bg-emerald-50/40 dark:bg-emerald-950/20 border-r border-neutral-200 dark:border-neutral-800">
                            <button
                              onClick={() => {
                                if (count === 0) return;
                                setSelectedCellDetail({
                                  title: `Clientes que Cancelaron 100% desde ${rowB.label}`,
                                  clients: cell.clients
                                });
                              }}
                              disabled={count === 0}
                              className={`w-full py-2 px-2 rounded-lg transition-all text-center ${
                                count > 0 
                                  ? 'bg-emerald-100/70 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:hover:bg-emerald-900/70 text-emerald-900 dark:text-emerald-200 cursor-pointer font-bold shadow-xs' 
                                  : 'text-neutral-300 dark:text-neutral-700 font-normal'
                              }`}
                            >
                              {count > 0 ? (
                                <>
                                  <div className="font-mono">
                                    {viewMetric === 'amount' 
                                      ? `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                      : `${count} clientes`}
                                  </div>
                                  <div className="text-[10px] opacity-75">
                                    {viewMetric === 'amount' ? `${count} clientes` : `$${amount.toFixed(2)}`}
                                  </div>
                                </>
                              ) : '-'}
                            </button>
                          </td>
                        );
                      })()}

                      {/* Destination Brackets Columns */}
                      {ORDERED_BRACKETS.map((colB, cIdx) => {
                        const cellKey = `${rowB.key}->${colB.key}`;
                        const cell = transitionData.matrixCells[cellKey];
                        const count = cell?.count || 0;
                        const amount = cell?.amount || 0;

                        // Identify cell type:
                        // Diagonal: Maintained
                        // Left of diagonal: Improved
                        // Right of diagonal: Deteriorated
                        const isMaintained = rIdx === cIdx;
                        const isImproved = cIdx < rIdx;
                        const isDeteriorated = cIdx > rIdx;

                        return (
                          <td 
                            key={`cell-${cellKey}`} 
                            className={`p-1.5 border-r border-neutral-100 dark:border-neutral-800/60 ${
                              isMaintained 
                                ? 'bg-neutral-100/60 dark:bg-neutral-800/40 font-bold' 
                                : isImproved 
                                  ? 'bg-emerald-50/20 dark:bg-emerald-950/10' 
                                  : isDeteriorated 
                                    ? 'bg-rose-50/30 dark:bg-rose-950/10' 
                                    : ''
                            }`}
                          >
                            <button
                              onClick={() => {
                                if (count === 0) return;
                                setSelectedCellDetail({
                                  title: `Clientes en transición de ${rowB.label} → ${colB.label}`,
                                  clients: cell.clients
                                });
                              }}
                              disabled={count === 0}
                              className={`w-full py-2 px-1.5 rounded-lg transition-all text-center ${
                                count > 0 
                                  ? isMaintained
                                    ? 'bg-neutral-200/70 hover:bg-neutral-300 dark:bg-neutral-700/60 dark:hover:bg-neutral-700 text-neutral-900 dark:text-neutral-100 cursor-pointer shadow-xs'
                                    : isImproved
                                      ? 'bg-emerald-100/60 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 cursor-pointer shadow-xs'
                                      : 'bg-rose-100/60 hover:bg-rose-200 dark:bg-rose-900/30 dark:hover:bg-rose-900/50 text-rose-800 dark:text-rose-300 cursor-pointer shadow-xs'
                                  : 'text-neutral-300 dark:text-neutral-700 font-normal'
                              }`}
                            >
                              {count > 0 ? (
                                <>
                                  <div className="font-mono">
                                    {viewMetric === 'amount' 
                                      ? `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                      : `${count} clientes`}
                                  </div>
                                  <div className="text-[10px] opacity-75">
                                    {viewMetric === 'amount' ? `${count} clientes` : `$${amount.toFixed(2)}`}
                                  </div>
                                </>
                              ) : '-'}
                            </button>
                          </td>
                        );
                      })}

                      {/* Row Total (Initial) */}
                      <td className="py-3 px-3 font-mono font-bold bg-neutral-100/70 dark:bg-neutral-800/50 text-neutral-900 dark:text-neutral-100">
                        {viewMetric === 'amount'
                          ? `$${(initBStats?.initAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : `${initBStats?.initCount || 0} cl.`}
                      </td>
                    </tr>
                  );
                })}

                {/* New Clients Row (Clients in closing but not in initial) */}
                <tr className="bg-indigo-50/30 dark:bg-indigo-950/20 hover:bg-indigo-50/50">
                  <td className="py-3 px-3 text-left font-bold text-indigo-950 dark:text-indigo-200 bg-indigo-100/50 dark:bg-indigo-950/60 sticky left-0 z-10 border-r border-indigo-200 dark:border-indigo-900">
                    <div>Nuevos Ingresos en Mora</div>
                    <div className="text-[10px] text-indigo-500 font-normal">
                      Créditos nuevos o sin registro inicial
                    </div>
                  </td>

                  {/* Cancelled: 0 */}
                  <td className="py-3 px-3 text-neutral-300 dark:text-neutral-700 border-r border-neutral-200 dark:border-neutral-800">
                    -
                  </td>

                  {/* New by Bracket */}
                  {ORDERED_BRACKETS.map(colB => {
                    const cellKey = `NEW->${colB.key}`;
                    const cell = transitionData.matrixCells[cellKey];
                    const count = cell?.count || 0;
                    const amount = cell?.amount || 0;

                    return (
                      <td key={`new-cell-${cellKey}`} className="p-1.5 border-r border-neutral-100 dark:border-neutral-800/60">
                        <button
                          onClick={() => {
                            if (count === 0) return;
                            setSelectedCellDetail({
                              title: `Nuevos Clientes ingresados en tramo ${colB.label}`,
                              clients: cell.clients
                            });
                          }}
                          disabled={count === 0}
                          className={`w-full py-2 px-1.5 rounded-lg transition-all text-center ${
                            count > 0 
                              ? 'bg-indigo-100/70 hover:bg-indigo-200 dark:bg-indigo-900/40 dark:hover:bg-indigo-900/60 text-indigo-900 dark:text-indigo-200 font-bold cursor-pointer shadow-xs'
                              : 'text-neutral-300 dark:text-neutral-700 font-normal'
                          }`}
                        >
                          {count > 0 ? (
                            <>
                              <div className="font-mono">
                                {viewMetric === 'amount' 
                                  ? `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                  : `${count} clientes`}
                              </div>
                              <div className="text-[10px] opacity-75">
                                {viewMetric === 'amount' ? `${count} clientes` : `$${amount.toFixed(2)}`}
                              </div>
                            </>
                          ) : '-'}
                        </button>
                      </td>
                    );
                  })}

                  {/* Total New */}
                  <td className="py-3 px-3 font-mono font-bold bg-indigo-100/60 dark:bg-indigo-950/70 text-indigo-900 dark:text-indigo-200">
                    {viewMetric === 'amount'
                      ? `$${transitionData.totalNewAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : `${transitionData.totalNewCount} cl.`}
                  </td>
                </tr>
              </tbody>

              {/* Column Totals (Closing) */}
              <tfoot className="bg-neutral-200/70 dark:bg-neutral-800/90 font-bold border-t-2 border-neutral-300 dark:border-neutral-700">
                <tr>
                  <td className="py-3.5 px-3 text-left uppercase text-neutral-900 dark:text-neutral-100 sticky left-0 bg-neutral-200/90 dark:bg-neutral-800 z-10 border-r border-neutral-300 dark:border-neutral-700">
                    TOTAL CIERRE
                  </td>
                  <td className="py-3.5 px-3 text-emerald-800 dark:text-emerald-300 bg-emerald-100/60 dark:bg-emerald-950/60 font-mono border-r border-neutral-300 dark:border-neutral-700">
                    {viewMetric === 'amount'
                      ? `$${transitionData.totalRecoveredAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : `${transitionData.totalRecoveredCount} cl.`}
                  </td>
                  {ORDERED_BRACKETS.map(colB => {
                    const closeB = transitionData.bracketFlows.find(f => f.bracket.key === colB.key);
                    return (
                      <td key={`tot-col-${colB.key}`} className="py-3.5 px-3 font-mono text-neutral-900 dark:text-neutral-100 border-r border-neutral-300 dark:border-neutral-700">
                        {viewMetric === 'amount'
                          ? `$${(closeB?.closeAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : `${closeB?.closeCount || 0} cl.`}
                      </td>
                    );
                  })}
                  <td className="py-3.5 px-3 font-mono text-neutral-900 dark:text-neutral-100">
                    {viewMetric === 'amount'
                      ? `$${transitionData.totalCloseAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : `${transitionData.totalCloseClients} cl.`}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Matrix Legend */}
        <div className="p-4 bg-neutral-50 dark:bg-neutral-950/60 border-t border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-600 dark:text-neutral-400">
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded bg-emerald-500 inline-block" />
              <span>Cancelado / Saneado 100% (Salió de morosidad)</span>
            </span>
            <span className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded bg-emerald-200 dark:bg-emerald-800 inline-block" />
              <span>Mejoró (Migró a un tramo menor)</span>
            </span>
            <span className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded bg-neutral-300 dark:bg-neutral-700 inline-block" />
              <span>Mantuvo (Permaneció en el mismo tramo)</span>
            </span>
            <span className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded bg-rose-200 dark:bg-rose-800 inline-block" />
              <span>Deterioró (Envejeció a mayor mora)</span>
            </span>
            <span className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded bg-indigo-300 dark:bg-indigo-700 inline-block" />
              <span>Nuevo Ingreso</span>
            </span>
          </div>

          <div className="text-[11px] text-neutral-400">
            * Valores calculados con redondeo financiero estricto a 2 decimales.
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. MODAL DE AUDITORÍA DETALLADA DE CLIENTES POR CELDA O TRAMO              */}
      {/* ========================================================================= */}
      {selectedCellDetail && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-neutral-900 w-full max-w-4xl rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50 dark:bg-neutral-950">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  Auditoría Detallada de Transición
                </span>
                <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-50 mt-0.5">
                  {selectedCellDetail.title}
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Total de registros en esta categoría: {selectedCellDetail.clients.length} cliente(s)
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    const clientList = selectedCellDetail.clients.map(c => c.client);
                    const safeTitle = selectedCellDetail.title.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30);
                    const fileName = `Detalle_Transicion_${safeTitle}_${initialDate}_vs_${closingDate}`;
                    exportPortfolioClientsToExcel(clientList, fileName, {
                      sheetName: 'Detalle_Clientes',
                      extraColumnsGenerator: (r, idx) => {
                        const item = selectedCellDetail.clients[idx];
                        return {
                          'Estado Transición': item?.transitionType?.toUpperCase() || '',
                          'Saldo Inicial ($)': item?.initialAmount ?? 0,
                          'Días Mora Inicial': item?.initialDays ?? 0,
                          'Saldo Cierre ($)': item?.closingAmount ?? 0,
                          'Días Mora Cierre': item?.closingDays ?? 0,
                          'Cobrador Asignado': r.collectorName || '',
                          'Cédula / RUC': r.identification || '',
                          'N° Operación': r.operationNumber || '',
                          'Detalle / Observación': r.notes || ''
                        };
                      }
                    });
                  }}
                  className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                  title="Exportar estos clientes a Excel con las 15 columnas canónicas"
                >
                  <FileSpreadsheet className="w-4 h-4 text-white" />
                  <span>Exportar Excel ({selectedCellDetail.clients.length})</span>
                </button>

                <button
                  onClick={() => setSelectedCellDetail(null)}
                  className="p-2 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-xl hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Content Table */}
            <div className="p-5 overflow-y-auto flex-1">
              <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 font-bold uppercase tracking-wider border-b border-neutral-200 dark:border-neutral-700">
                    <tr>
                      <th className="py-2.5 px-3">Cliente</th>
                      <th className="py-2.5 px-3">Cédula / N° Op</th>
                      <th className="py-2.5 px-3">Cobrador</th>
                      <th className="py-2.5 px-3 text-right">Saldo Inicial ({initialDate})</th>
                      <th className="py-2.5 px-3 text-center">Días Mora Inicial</th>
                      <th className="py-2.5 px-3 text-right">Saldo Cierre ({closingDate})</th>
                      <th className="py-2.5 px-3 text-center">Días Mora Cierre</th>
                      <th className="py-2.5 px-3 text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                    {selectedCellDetail.clients.map((item, idx) => (
                      <tr key={`${item.client.id || idx}`} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40">
                        <td className="py-2.5 px-3 font-bold text-neutral-900 dark:text-neutral-100">
                          {item.client.clientName}
                        </td>
                        <td className="py-2.5 px-3 text-neutral-600 dark:text-neutral-400 font-mono">
                          {item.client.identification || item.client.operationNumber || '-'}
                        </td>
                        <td className="py-2.5 px-3 text-neutral-700 dark:text-neutral-300">
                          {item.client.collectorName}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-neutral-700 dark:text-neutral-300">
                          ${(item.initialAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono">
                          {item.initialDays ?? '-'} d
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-neutral-900 dark:text-neutral-100">
                          ${(item.closingAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono">
                          {item.closingDays ?? '-'} d
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            item.transitionType === 'recuperado'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300'
                              : item.transitionType === 'mejorado'
                                ? 'bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-300'
                                : item.transitionType === 'mantenido'
                                  ? 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-300'
                                  : item.transitionType === 'deteriorado'
                                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300'
                                    : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300'
                          }`}>
                            {item.transitionType}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50 dark:bg-neutral-950">
              <span className="text-xs text-neutral-500 font-mono">
                Suma saldo cierre en esta vista: $
                {round2(selectedCellDetail.clients.reduce((acc, c) => acc + (c.closingAmount || c.initialAmount || 0), 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <button
                onClick={() => setSelectedCellDetail(null)}
                className="px-4 py-2 bg-neutral-800 dark:bg-neutral-700 hover:bg-neutral-900 dark:hover:bg-neutral-600 text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
