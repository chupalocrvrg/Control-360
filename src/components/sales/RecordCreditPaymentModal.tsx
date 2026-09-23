import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  DollarSign, 
  Calendar, 
  CreditCard, 
  User, 
  Receipt, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  ArrowRight, 
  Sparkles, 
  Coins, 
  Check, 
  Hash,
  BadgePercent
} from 'lucide-react';
import { CreditSale, CreditInstallment, EarlySettlementOption } from '../../types/creditSale';
import { CreditPayment, CreditPaymentMethod, CreditPaymentInstallmentAllocation } from '../../types/creditPayment';
import { executeCreditPaymentTransaction } from '../../lib/credit-payment-db';
import { formatCurrency } from '../../lib/utils';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { useSettings } from '../../contexts/SettingsContext';
import { Building2 } from 'lucide-react';

interface Employee {
  id: string;
  name: string;
  lastName: string;
  role: string;
}

interface RecordCreditPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  creditSale: CreditSale | null;
  onPaymentSuccess: (payment: CreditPayment) => void;
  employees: Employee[];
}

export function RecordCreditPaymentModal({
  isOpen,
  onClose,
  creditSale,
  onPaymentSuccess,
  employees
}: RecordCreditPaymentModalProps) {
  const { user, profile } = useAuth();
  const { showToast } = useNotification();
  const { settings } = useSettings();

  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<CreditPaymentMethod>('EFECTIVO');
  const [isTransfer, setIsTransfer] = useState(false);
  const [bankName, setBankName] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [collectorId, setCollectorId] = useState('');
  const [notes, setNotes] = useState('');
  
  // Available bank entities: company configured banks + standard banks in Ecuador
  const defaultBanksList = ['Banco Pichincha', 'Banco Guayaquil', 'Banco del Pacífico', 'Produbanco', 'Banco Bolivariano', 'Banco Internacional', 'Cooperativa JEP', 'Cooperativa 29 de Octubre'];
  const availableBanks = useMemo(() => {
    const fromSettings = (settings.banks || []).filter(b => b && b.trim() !== '');
    const combined = [...fromSettings];
    defaultBanksList.forEach(b => {
      if (!combined.some(item => item.toLowerCase() === b.toLowerCase())) {
        combined.push(b);
      }
    });
    return combined;
  }, [settings.banks]);

  // Payment amount & distribution
  const [amountInput, setAmountInput] = useState<string>('');
  const [isEarlySettlement, setIsEarlySettlement] = useState(false);
  const [selectedEarlyOption, setSelectedEarlyOption] = useState<EarlySettlementOption | null>(null);
  const [manualAllocations, setManualAllocations] = useState<Record<number, number>>({});
  const [isManualMode, setIsManualMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize or reset when modal opens
  useEffect(() => {
    if (isOpen && creditSale) {
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setPaymentMethod('EFECTIVO');
      setIsTransfer(false);
      setBankName(availableBanks[0] || 'Banco Pichincha');
      setReferenceNumber('');
      setNotes('');
      setIsEarlySettlement(false);
      setSelectedEarlyOption(null);
      setIsManualMode(false);
      setManualAllocations({});

      // Pre-select collector
      const defaultCollector = employees.find(e => ['cobrador', 'ambos', 'supervisor_cobranza'].includes(e.role));
      setCollectorId(defaultCollector?.id || employees[0]?.id || user?.uid || '');

      // Suggest amount of the earliest pending installment
      const earliestUnpaid = (creditSale.installments || []).find(
        inst => inst.status !== 'PAGADO' && (inst.amount - (inst.paidAmount || 0)) > 0.01
      );
      if (earliestUnpaid) {
        const pendingAmount = Number((earliestUnpaid.amount - (earliestUnpaid.paidAmount || 0)).toFixed(2));
        setAmountInput(pendingAmount.toString());
      } else {
        setAmountInput((creditSale.remainingBalance || 0).toString());
      }
    }
  }, [isOpen, creditSale, employees, user]);

  // Current balance calculations
  const remainingBalance = useMemo(() => {
    if (!creditSale) return 0;
    return creditSale.remainingBalance ?? (creditSale.netFinancedAmount || 0);
  }, [creditSale]);

  const parsedAmount = useMemo(() => {
    const val = parseFloat(amountInput);
    return isNaN(val) ? 0 : Math.max(0, val);
  }, [amountInput]);

  // Auto calculate distribution across installments
  const computedAllocations = useMemo((): CreditPaymentInstallmentAllocation[] => {
    if (!creditSale || !creditSale.installments) return [];

    if (isEarlySettlement && selectedEarlyOption) {
      // Early settlement settles all remaining pending installments
      return creditSale.installments
        .filter(i => (i.amount - (i.paidAmount || 0)) > 0.01)
        .map(i => {
          const prevDue = Number((i.amount - (i.paidAmount || 0)).toFixed(2));
          return {
            installmentNumber: i.number,
            dueDate: i.dueDate,
            amountApplied: prevDue,
            previousBalance: prevDue,
            remainingBalance: 0,
            isFullyPaid: true
          };
        });
    }

    if (isManualMode) {
      // User entered custom amounts for installments
      return creditSale.installments
        .filter(i => (manualAllocations[i.number] || 0) > 0)
        .map(i => {
          const applied = manualAllocations[i.number] || 0;
          const prevDue = Number((i.amount - (i.paidAmount || 0)).toFixed(2));
          const rem = Math.max(0, Number((prevDue - applied).toFixed(2)));
          return {
            installmentNumber: i.number,
            dueDate: i.dueDate,
            amountApplied: applied,
            previousBalance: prevDue,
            remainingBalance: rem,
            isFullyPaid: rem <= 0.01
          };
        });
    }

    // Default Waterfall / Cascade mode (earliest due to latest)
    let moneyLeft = parsedAmount;
    const result: CreditPaymentInstallmentAllocation[] = [];

    for (const inst of creditSale.installments) {
      if (moneyLeft <= 0.001) break;

      const instDue = Number((inst.amount - (inst.paidAmount || 0)).toFixed(2));
      if (instDue <= 0.001) continue; // already paid

      const applied = Math.min(moneyLeft, instDue);
      const rem = Math.max(0, Number((instDue - applied).toFixed(2)));
      result.push({
        installmentNumber: inst.number,
        dueDate: inst.dueDate,
        amountApplied: Number(applied.toFixed(2)),
        previousBalance: instDue,
        remainingBalance: rem,
        isFullyPaid: rem <= 0.01
      });

      moneyLeft = Number((moneyLeft - applied).toFixed(2));
    }

    return result;
  }, [creditSale, parsedAmount, isEarlySettlement, selectedEarlyOption, isManualMode, manualAllocations]);

  const totalAllocated = useMemo(() => {
    return computedAllocations.reduce((sum, a) => sum + a.amountApplied, 0);
  }, [computedAllocations]);

  // Handle early settlement selection
  const handleSelectEarlySettlement = (opt: EarlySettlementOption) => {
    setSelectedEarlyOption(opt);
    setIsEarlySettlement(true);
    setIsManualMode(false);
    setAmountInput(opt.settlementAmount.toString());
  };

  const handleCancelEarlySettlement = () => {
    setIsEarlySettlement(false);
    setSelectedEarlyOption(null);
    const earliestUnpaid = (creditSale?.installments || []).find(
      inst => inst.status !== 'PAGADO' && (inst.amount - (inst.paidAmount || 0)) > 0.01
    );
    if (earliestUnpaid) {
      setAmountInput(Number((earliestUnpaid.amount - (earliestUnpaid.paidAmount || 0)).toFixed(2)).toString());
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creditSale) return;

    if (parsedAmount <= 0) {
      showToast('El monto a cobrar debe ser mayor a $0.00', 'error');
      return;
    }

    if (!isEarlySettlement && parsedAmount > (remainingBalance + 0.05)) {
      showToast(`El monto no puede ser mayor al saldo pendiente total ($${remainingBalance.toFixed(2)})`, 'error');
      return;
    }

    if (computedAllocations.length === 0) {
      showToast('No se asignó monto a ninguna cuota.', 'error');
      return;
    }

    const selectedCollector = employees.find(e => e.id === collectorId);
    const collectorName = selectedCollector
      ? `${selectedCollector.name} ${selectedCollector.lastName}`
      : profile?.displayName || user?.email || 'Cajero / Cobrador';

    const enterpriseId = creditSale.enterpriseId || profile?.enterpriseId || user?.uid || '';

    try {
      setIsSubmitting(true);

      const effectivePaymentMethod = isTransfer ? 'TRANSFERENCIA' : paymentMethod;

      const paymentResult = await executeCreditPaymentTransaction(
        enterpriseId,
        user?.uid || '',
        {
          creditSaleId: creditSale.id,
          paymentMethod: effectivePaymentMethod,
          isTransfer,
          bankName: isTransfer ? bankName : undefined,
          referenceNumber,
          totalAmountPaid: Number(parsedAmount.toFixed(2)),
          paymentDate,
          collectorId,
          collectorName,
          isEarlySettlement,
          discountApplied: isEarlySettlement && selectedEarlyOption ? selectedEarlyOption.discountPercentage : 0,
          settlementDescription: isEarlySettlement && selectedEarlyOption ? selectedEarlyOption.description : undefined,
          allocations: computedAllocations,
          notes
        }
      );

      showToast(`Cobro registrado con éxito. Comprobante #${paymentResult.receiptNumber}`, 'success');
      onPaymentSuccess(paymentResult);
      onClose();
    } catch (err: any) {
      console.error('Error executing credit payment:', err);
      showToast(err.message || 'Error al procesar el pago', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !creditSale) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-2xl max-w-4xl w-full my-6 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 text-white flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl backdrop-blur-md">
              <Receipt className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-tight">Cobro de Cuota / Abono a Crédito</h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-white/20 text-white">
                  Pagaré {creditSale.promissoryNoteNumber}
                </span>
              </div>
              <p className="text-xs text-white/80 mt-0.5">
                Cliente: <strong className="text-white">{creditSale.clientName}</strong> (C.I. {creditSale.clientIdCard})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/20 text-white/80 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Financial Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-neutral-50 dark:bg-neutral-950/60 border-b border-neutral-200 dark:border-neutral-800 text-xs">
          <div className="p-3 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
            <span className="text-neutral-500 block">Total Financiado</span>
            <span className="text-sm font-bold text-neutral-900 dark:text-white">
              {formatCurrency(creditSale.netFinancedAmount || creditSale.grossTotal)}
            </span>
          </div>

          <div className="p-3 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
            <span className="text-neutral-500 block">Total Abonado Previo</span>
            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
              {formatCurrency(creditSale.totalPaid || 0)}
            </span>
          </div>

          <div className="p-3 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
            <span className="text-neutral-500 block">Saldo Pendiente Actual</span>
            <span className="text-sm font-bold text-red-600 dark:text-red-400">
              {formatCurrency(remainingBalance)}
            </span>
          </div>

          <div className="p-3 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
            <span className="text-neutral-500 block">Liberación de Cupo</span>
            <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              +{formatCurrency(parsedAmount)}
            </span>
          </div>
        </div>

        {/* Main Content Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Early Settlement Option Banner (if configured in Tramo 2) */}
          {creditSale.earlySettlementOptions && creditSale.earlySettlementOptions.length > 0 && (
            <div className="p-4 rounded-xl border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BadgePercent className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  <span className="text-sm font-bold text-amber-900 dark:text-amber-200">
                    Opciones de Liquidación Anticipada Inteligente Pactadas
                  </span>
                </div>
                {isEarlySettlement ? (
                  <button
                    type="button"
                    onClick={handleCancelEarlySettlement}
                    className="text-xs text-red-600 hover:text-red-700 font-bold underline"
                  >
                    Cancelar Liquidación Anticipada
                  </button>
                ) : null}
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                El cliente puede saldar todo el crédito con descuento preferencial acordado en la venta.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                {creditSale.earlySettlementOptions.map((opt, idx) => {
                  const isSelected = isEarlySettlement && selectedEarlyOption?.targetMonths === opt.targetMonths;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectEarlySettlement(opt)}
                      className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 shadow-sm'
                          : 'border-amber-200 dark:border-amber-800 bg-white dark:bg-neutral-900 hover:border-amber-400'
                      }`}
                    >
                      <div>
                        <span className="text-xs font-bold text-neutral-900 dark:text-white block">
                          {opt.description || `Liquidación a ${opt.targetMonths} meses`}
                        </span>
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                          Descuento: ${opt.discountPercentage.toFixed(2)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-neutral-400 block">Total a Cancelar</span>
                        <span className="text-sm font-black text-neutral-900 dark:text-white">
                          ${opt.settlementAmount.toFixed(2)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Payment Amount & Method Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                Monto del Abono / Cobro ($) *
              </label>
              <div className="relative">
                <DollarSign className="w-4 h-4 text-emerald-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={isEarlySettlement ? undefined : remainingBalance}
                  disabled={isEarlySettlement}
                  value={amountInput}
                  onChange={(e) => {
                    setAmountInput(e.target.value);
                    setIsManualMode(false);
                  }}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-base font-black focus:ring-2 focus:ring-emerald-500"
                  placeholder="0.00"
                  required
                />
              </div>
              <span className="text-[11px] text-neutral-500 mt-1 block">
                {isEarlySettlement ? 'Monto fijo por liquidación anticipada' : `Saldo pendiente total: $${remainingBalance.toFixed(2)}`}
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                Fecha del Cobro *
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-bold"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                Forma de Pago *
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => {
                  const val = e.target.value as CreditPaymentMethod;
                  setPaymentMethod(val);
                  if (val === 'TRANSFERENCIA') {
                    setIsTransfer(true);
                  }
                }}
                className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-bold"
              >
                <option value="EFECTIVO">Efectivo</option>
                <option value="TRANSFERENCIA">Transferencia Bancaria</option>
                <option value="DEPOSITO">Depósito Bancario</option>
                <option value="CHEQUE">Cheque</option>
                <option value="TARJETA">Tarjeta de Débito/Crédito</option>
                <option value="OTRO">Otro</option>
              </select>
            </div>
          </div>

          {/* Toggle Es Transferencia y Banco */}
          <div className="p-3 bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isTransfer || paymentMethod === 'TRANSFERENCIA'}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setIsTransfer(checked);
                    if (checked) {
                      setPaymentMethod('TRANSFERENCIA');
                      if (!bankName) setBankName(availableBanks[0] || 'Banco Pichincha');
                    } else {
                      setPaymentMethod('EFECTIVO');
                    }
                  }}
                  className="w-4 h-4 text-indigo-600 rounded border-neutral-300 focus:ring-indigo-500"
                />
                <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                  ¿Es transferencia bancaria / depósito?
                </span>
              </label>
              {(isTransfer || paymentMethod === 'TRANSFERENCIA') && (
                <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-md">
                  Aplica a Bancos (No suma a Efectivo en Caja)
                </span>
              )}
            </div>

            {(isTransfer || paymentMethod === 'TRANSFERENCIA') && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-neutral-200 dark:border-neutral-700/60">
                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 dark:text-neutral-300 mb-1 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Entidad Bancaria *</span>
                  </label>
                  <select
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-bold"
                  >
                    {availableBanks.map((b, idx) => (
                      <option key={idx} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                    Número de Comprobante / Trx (Opcional)
                  </label>
                  <input
                    type="text"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-mono"
                    placeholder="ej. Trx #983412"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Reference & Collector Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                No. Comprobante / Voucher / Referencia (Opcional)
              </label>
              <div className="relative">
                <Hash className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs"
                  placeholder="ej. Trx #482910 o Cheque #004"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                Cobrador / Recaudador *
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <select
                  value={collectorId}
                  onChange={(e) => setCollectorId(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-bold"
                  required
                >
                  <option value="">Seleccione Cobrador</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} {emp.lastName} ({emp.role})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Installment Breakdown & Allocation Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-white flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-emerald-500" />
                  Distribución del Pago en la Tabla de Cuotas
                </h3>
                <span className="text-[11px] text-neutral-500">
                  {isEarlySettlement 
                    ? 'Liquidación anticipada: se liquidan todas las cuotas pendientes.' 
                    : 'Las cuotas se amortizan en orden cronológico automáticamente.'}
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                  Asignado: {formatCurrency(totalAllocated)}
                </span>
              </div>
            </div>

            <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden shadow-sm">
              <div className="max-h-60 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 sticky top-0 font-bold border-b border-neutral-200 dark:border-neutral-700">
                    <tr>
                      <th className="px-3 py-2"># Cuota</th>
                      <th className="px-3 py-2">Vencimiento</th>
                      <th className="px-3 py-2 text-right">Valor Cuota</th>
                      <th className="px-3 py-2 text-right">Abonado Previo</th>
                      <th className="px-3 py-2 text-right">Pendiente</th>
                      <th className="px-3 py-2 text-right">Abono Actual</th>
                      <th className="px-3 py-2 text-center">Estado Resultante</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                    {(creditSale.installments || []).map((inst) => {
                      const alloc = computedAllocations.find(a => a.installmentNumber === inst.number);
                      const currentPaid = inst.paidAmount || 0;
                      const instDue = Number((inst.amount - currentPaid).toFixed(2));
                      const applied = alloc?.amountApplied || 0;
                      const resultingPending = isEarlySettlement ? 0 : Math.max(0, Number((instDue - applied).toFixed(2)));
                      const isComplete = resultingPending <= 0.01;

                      return (
                        <tr key={inst.number} className={applied > 0 ? 'bg-emerald-50/60 dark:bg-emerald-950/20' : ''}>
                          <td className="px-3 py-2 font-bold text-neutral-900 dark:text-white">
                            Cuota #{inst.number}
                          </td>
                          <td className="px-3 py-2 text-neutral-600 dark:text-neutral-400">
                            {inst.dueDate}
                          </td>
                          <td className="px-3 py-2 text-right font-medium text-neutral-900 dark:text-white">
                            {formatCurrency(inst.amount)}
                          </td>
                          <td className="px-3 py-2 text-right text-neutral-500">
                            {formatCurrency(currentPaid)}
                          </td>
                          <td className="px-3 py-2 text-right font-bold text-red-600 dark:text-red-400">
                            {formatCurrency(instDue)}
                          </td>
                          <td className="px-3 py-2 text-right font-black text-emerald-600 dark:text-emerald-400">
                            {applied > 0 ? `+${formatCurrency(applied)}` : '-'}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {isComplete ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                                <Check className="w-3 h-3" />
                                {inst.status === 'PAGADO' ? 'PAGADA' : 'SALDADA'}
                              </span>
                            ) : applied > 0 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                                <Clock className="w-3 h-3" />
                                PARCIAL (${resultingPending.toFixed(2)})
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                                PENDIENTE
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Observations / Notes */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
              Notas u Observaciones del Cobro
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs"
              placeholder="Detalles adicionales, acuerdos de pago o comentarios..."
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-neutral-200 dark:border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isSubmitting || parsedAmount <= 0}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Procesando Cobro...
                </>
              ) : (
                <>
                  <Receipt className="w-4 h-4" />
                  Confirmar Cobro e Imprimir Comprobante
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
