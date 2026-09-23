import React, { useState, useMemo } from 'react';
import { 
  X, 
  MessageCircle, 
  Copy, 
  Check, 
  ExternalLink, 
  User, 
  ShieldCheck, 
  Phone, 
  Clock, 
  AlertTriangle, 
  Calendar,
  Send,
  FileText
} from 'lucide-react';
import { CreditSale } from '../../types/creditSale';
import { 
  calculateCreditRiskAndAging, 
  CreditRiskMetrics 
} from '../../types/creditCollection';
import { formatEcuadorianPhone, getWhatsAppUrl } from '../../lib/portfolioUtils';
import { formatCurrency } from '../../lib/utils';
import { db } from '../../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { logAudit, AuditAction } from '../../lib/audit';

interface WhatsAppCollectionModalProps {
  credit: CreditSale;
  isOpen: boolean;
  onClose: () => void;
  onLogSaved?: () => void;
}

export const WhatsAppCollectionModal: React.FC<WhatsAppCollectionModalProps> = ({
  credit,
  isOpen,
  onClose,
  onLogSaved
}) => {
  const { user, profile } = useAuth();
  const { showToast } = useNotification();
  const enterpriseId = profile?.enterpriseId || user?.uid;
  const currentUserName = profile?.name || user?.email || 'Asesor de Cobranzas';

  const metrics: CreditRiskMetrics = useMemo(() => {
    return calculateCreditRiskAndAging(credit);
  }, [credit]);

  // Target: 'DEUDOR' | 'GARANTE'
  const hasGuarantor = Boolean(credit.guarantorName && credit.guarantorPhone);
  const [target, setTarget] = useState<'DEUDOR' | 'GARANTE'>('DEUDOR');

  // Selected Template
  const [templateType, setTemplateType] = useState<string>(() => {
    if (metrics.overdueDays > 60) return 'EXTRAJUDICIAL';
    if (metrics.overdueDays > 30) return 'PREVENTIVA';
    if (metrics.overdueDays > 0) return 'TEMPRANA';
    return 'RECORDATORIO';
  });

  const [customText, setCustomText] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [autoLog, setAutoLog] = useState(true);
  const [savingLog, setSavingLog] = useState(false);

  // Generate target details
  const targetName = target === 'DEUDOR' ? credit.clientName : (credit.guarantorName || 'Garante');
  const targetRawPhone = target === 'DEUDOR' ? credit.clientPhone : (credit.guarantorPhone || '');
  const formattedTargetPhone = formatEcuadorianPhone(targetRawPhone);

  const itemsSummary = credit.items && credit.items.length > 0 
    ? credit.items.map(i => i.articleName).join(', ') 
    : (credit.article || 'Mercadería a crédito');

  // Pre-generate templates
  const templates = useMemo(() => {
    const formattedBalance = formatCurrency(metrics.totalRemainingBalance);
    const formattedOverdue = formatCurrency(metrics.overdueAmount > 0 ? metrics.overdueAmount : metrics.nextInstallmentAmount);
    const dueDateStr = metrics.earliestOverdueDueDate || metrics.nextInstallmentDueDate || 'inmediata';
    const noteNumber = credit.promissoryNoteNumber || 'S/N';

    return {
      RECORDATORIO: `Hola estimado(a) *${credit.clientName}*, reciba un cordial saludo. Le recordamos amablemente que su próxima cuota del crédito *${noteNumber}* (${itemsSummary}) por un valor de *${formattedOverdue}* tiene fecha programada para el *${dueDateStr}*. Mantener sus pagos al día le permite cuidar su récord crediticio y acceder a mayores beneficios con nosotros. Si ya realizó su abono, por favor compártanos su comprobante por este medio. ¡Muchas gracias!`,
      
      TEMPRANA: `Estimado(a) *${credit.clientName}*, le saludamos del departamento de cobranzas. Le notificamos que su crédito *${noteNumber}* registra un atraso de *${metrics.overdueDays} día(s)* con un valor pendiente de *${formattedOverdue}* (Saldo total: ${formattedBalance}). Le solicitamos coordinar su pago el día de hoy para mantener su cuenta regularizada y evitar recargos. Por favor infórmenos a qué hora podrá realizar su depósito o transferencia. ¡Quedamos atentos!`,
      
      PREVENTIVA: `AVISO DE COBRANZA: Estimado(a) *${credit.clientName}*, nos comunicamos debido a que su cuenta correspondiente al Pagaré *${noteNumber}* presenta un atraso de *${metrics.overdueDays} días*, acumulando un saldo en mora de *${formattedOverdue}*. Es indispensable regularizar este valor a la brevedad para evitar reportes negativos en el Buró de Información Crediticia y costos de gestión. Por favor contáctenos inmediatamente a este número para definir su fecha de pago.`,
      
      EXTRAJUDICIAL: `NOTIFICACIÓN URGENTE DE COBRANZA PREJUDICIAL: Señor(a) *${credit.clientName}*, su crédito *${noteNumber}* registra una mora crítica de *${metrics.overdueDays} días* con un saldo deudor de *${formattedBalance}*. De no verificarse un acuerdo formal o la cancelación del saldo el día de hoy, el expediente será derivado al Departamento Jurídico para la ejecución del Pagaré a la Orden, con las acciones legales pertinentes frente a usted y su Garante Solidario. Comuníquese de forma urgente a este canal para coordinar su regularización.`,
      
      GARANTE: `Estimado(a) *${credit.guarantorName || 'Garante'}*, le saludamos cordialmente. Nos comunicamos en relación a la fianza y garantía solidaria suscrita en el Pagaré *${noteNumber}* correspondiente al señor(a) *${credit.clientName}*. Le notificamos que la cuenta presenta actualmente un atraso de *${metrics.overdueDays} días* por un valor en mora de *${formattedOverdue}* (Saldo pendiente: ${formattedBalance}). En virtud de su calidad de Garante Solidario, le solicitamos interponer sus buenos oficios para que el deudor principal regularice la cuenta hoy mismo o comunicarse con nosotros para evitar el inicio de acciones de cobro sobre la fianza. Agradecemos su cooperación.`
    };
  }, [credit, metrics, itemsSummary]);

  // Update text when template or target changes
  React.useEffect(() => {
    if (target === 'GARANTE') {
      setCustomText(templates.GARANTE);
    } else if (templates[templateType as keyof typeof templates]) {
      setCustomText(templates[templateType as keyof typeof templates]);
    }
  }, [templateType, target, templates]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(customText);
      setCopied(true);
      showToast('Mensaje copiado al portapapeles', 'success');
      setTimeout(() => setCopied(false), 2500);

      if (autoLog) {
        await saveCollectionLog('WHATSAPP', 'COMPROMISO_PAGO', 'Mensaje copiado para envío externo');
      }
    } catch {
      showToast('No se pudo copiar el mensaje', 'error');
    }
  };

  const handleOpenWhatsApp = async () => {
    if (!formattedTargetPhone) {
      showToast('El contacto no posee un número de teléfono válido', 'error');
      return;
    }

    const url = `https://wa.me/${formattedTargetPhone}?text=${encodeURIComponent(customText)}`;
    window.open(url, '_blank');

    if (autoLog) {
      await saveCollectionLog('WHATSAPP', 'COMPROMISO_PAGO', 'Mensaje enviado vía WhatsApp Web/App');
    }
  };

  const saveCollectionLog = async (
    contactType: 'WHATSAPP' | 'LLAMADA' | 'VISITA' = 'WHATSAPP',
    outcome: 'COMPROMISO_PAGO' | 'NO_CONTESTA' | 'PAGO_CONFIRMADO' = 'COMPROMISO_PAGO',
    noteText = ''
  ) => {
    if (!enterpriseId) return;
    try {
      setSavingLog(true);
      await addDoc(collection(db, 'credit_collection_logs'), {
        enterpriseId,
        creditSaleId: credit.id,
        clientId: credit.clientId,
        clientName: credit.clientName,
        promissoryNoteNumber: credit.promissoryNoteNumber || 'S/N',
        contactType,
        contactTarget: target,
        targetName,
        targetPhone: targetRawPhone,
        outcome,
        notes: `${noteText} • Plantilla: ${target === 'GARANTE' ? 'GARANTE' : templateType}`,
        createdAt: new Date().toISOString(),
        serverCreatedAt: serverTimestamp(),
        createdBy: user?.uid || '',
        createdByName: currentUserName
      });

      logAudit(
        AuditAction.COLLECTION_CREATE,
        `Cobranza WhatsApp a ${target} (${targetRawPhone}) - Pagaré #${credit.promissoryNoteNumber} - ${credit.clientName} - Mora: ${metrics.overdueDays} días`,
        credit.id
      );

      showToast('Gestión registrada en la Bitácora de Cobranza', 'info');
      onLogSaved?.();
    } catch (err) {
      console.error('Error recording collection log:', err);
    } finally {
      setSavingLog(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden my-8">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-neutral-200 dark:border-neutral-800 bg-emerald-50 dark:bg-emerald-950/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/30">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                Centro de Notificación WhatsApp
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${metrics.riskBadgeClass}`}>
                  {metrics.riskLabel}
                </span>
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Pagaré: <span className="font-semibold text-neutral-700 dark:text-neutral-300">{credit.promissoryNoteNumber}</span> • Saldo: {formatCurrency(metrics.totalRemainingBalance)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-neutral-700 dark:hover:text-white rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[calc(85vh-120px)] overflow-y-auto">
          
          {/* Destinatario Switch */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-2">
              Seleccionar Destinatario
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setTarget('DEUDOR')}
                className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-all ${
                  target === 'DEUDOR'
                    ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 shadow-sm'
                    : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300'
                }`}
              >
                <div className={`p-2 rounded-lg ${target === 'DEUDOR' ? 'bg-emerald-600 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600'}`}>
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-neutral-900 dark:text-white block">
                    Deudor: {credit.clientName}
                  </span>
                  <span className="text-[11px] text-neutral-500 flex items-center gap-1 mt-0.5">
                    <Phone className="w-3 h-3" />
                    {credit.clientPhone || 'Sin teléfono registrado'}
                  </span>
                </div>
              </button>

              <button
                type="button"
                disabled={!hasGuarantor}
                onClick={() => setTarget('GARANTE')}
                className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-all ${
                  !hasGuarantor 
                    ? 'opacity-40 cursor-not-allowed border-dashed border-neutral-300 dark:border-neutral-700' 
                    : target === 'GARANTE'
                      ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 shadow-sm'
                      : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300'
                }`}
              >
                <div className={`p-2 rounded-lg ${target === 'GARANTE' ? 'bg-emerald-600 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600'}`}>
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-neutral-900 dark:text-white block">
                    Garante: {credit.guarantorName || 'No asignado'}
                  </span>
                  <span className="text-[11px] text-neutral-500 flex items-center gap-1 mt-0.5">
                    <Phone className="w-3 h-3" />
                    {credit.guarantorPhone || 'Sin número de garante'}
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* Plantillas (si es Deudor) */}
          {target === 'DEUDOR' && (
            <div>
              <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-2">
                Plantilla de Mensaje según Mora
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setTemplateType('RECORDATORIO')}
                  className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${
                    templateType === 'RECORDATORIO'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                  }`}
                >
                  Preventivo
                </button>
                <button
                  type="button"
                  onClick={() => setTemplateType('TEMPRANA')}
                  className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${
                    templateType === 'TEMPRANA'
                      ? 'bg-yellow-600 text-white border-yellow-600 shadow-sm'
                      : 'border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                  }`}
                >
                  Mora 1-30d
                </button>
                <button
                  type="button"
                  onClick={() => setTemplateType('PREVENTIVA')}
                  className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${
                    templateType === 'PREVENTIVA'
                      ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                      : 'border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                  }`}
                >
                  Mora 31-60d
                </button>
                <button
                  type="button"
                  onClick={() => setTemplateType('EXTRAJUDICIAL')}
                  className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${
                    templateType === 'EXTRAJUDICIAL'
                      ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                      : 'border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                  }`}
                >
                  Mora +60d
                </button>
              </div>
            </div>
          )}

          {/* Editor del Mensaje */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                Contenido del Mensaje
              </label>
              <span className="text-[11px] text-neutral-400">
                Puedes editar el texto antes de enviar
              </span>
            </div>
            <textarea
              rows={6}
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              className="w-full p-3.5 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs text-neutral-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all leading-relaxed"
            />
          </div>

          {/* Destino y Validación del Número */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl border border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-emerald-600" />
              <span className="text-xs text-neutral-600 dark:text-neutral-300">
                Número formateado para WhatsApp:{' '}
                <strong className="text-neutral-900 dark:text-white">
                  {formattedTargetPhone ? `+${formattedTargetPhone}` : 'Número inválido'}
                </strong>
              </span>
            </div>

            <label className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-300 cursor-pointer">
              <input
                type="checkbox"
                checked={autoLog}
                onChange={(e) => setAutoLog(e.target.checked)}
                className="rounded text-emerald-600 focus:ring-emerald-500"
              />
              Registrar en Bitácora de Cobranza
            </label>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 p-5 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white transition-colors"
          >
            Cerrar
          </button>

          <button
            type="button"
            onClick={handleCopy}
            className="w-full sm:w-auto px-4 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 text-neutral-800 dark:text-neutral-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            {copied ? '¡Copiado!' : 'Copiar Texto'}
          </button>

          <button
            type="button"
            onClick={handleOpenWhatsApp}
            disabled={!formattedTargetPhone || savingLog}
            className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-md shadow-emerald-600/30"
          >
            <Send className="w-4 h-4" />
            {savingLog ? 'Registrando...' : 'Abrir WhatsApp'}
          </button>
        </div>

      </div>
    </div>
  );
};
