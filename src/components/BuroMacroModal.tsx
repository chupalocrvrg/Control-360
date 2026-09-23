import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Code2,
  Save,
  RotateCcw,
  Play,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  Copy,
  Check,
  X,
  Sparkles,
  Info,
  Layers,
  FileSpreadsheet,
  Download
} from 'lucide-react';
import {
  DEFAULT_EQUIFAX_VBA_MACRO,
  parseVbaMacro,
  executeVbaMacroOnRecords,
  testVbaMacroOnRecord,
  ParsedMacroRules
} from '../lib/buroMacroEngine';
import { BuroRecord } from '../lib/buroProcessor';
import { useNotification } from '../contexts/NotificationContext';

interface BuroMacroModalProps {
  isOpen: boolean;
  onClose: () => void;
  macroCode: string;
  onSaveMacro: (code: string, name: string, isActive: boolean) => Promise<void>;
  saving: boolean;
  macroName: string;
  isActive: boolean;
  sampleRecord?: BuroRecord;
}

export const BuroMacroModal: React.FC<BuroMacroModalProps> = ({
  isOpen,
  onClose,
  macroCode: initialCode,
  onSaveMacro,
  saving,
  macroName: initialName,
  isActive: initialIsActive,
  sampleRecord
}) => {
  const { showToast } = useNotification();
  const [code, setCode] = useState<string>(initialCode || DEFAULT_EQUIFAX_VBA_MACRO);
  const [name, setName] = useState<string>(initialName || 'Macro Oficial Equifax');
  const [isActive, setIsActive] = useState<boolean>(initialIsActive ?? true);
  const [copied, setCopied] = useState<boolean>(false);
  const [parsedRules, setParsedRules] = useState<ParsedMacroRules>(() => parseVbaMacro(initialCode || DEFAULT_EQUIFAX_VBA_MACRO));
  const [testOutput, setTestOutput] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'editor' | 'parsed' | 'test'>('editor');

  useEffect(() => {
    if (isOpen) {
      const currentCode = initialCode || DEFAULT_EQUIFAX_VBA_MACRO;
      setCode(currentCode);
      setName(initialName || 'Macro Oficial Equifax');
      setIsActive(initialIsActive ?? true);
      const parsed = parseVbaMacro(currentCode);
      setParsedRules(parsed);
      runTest(currentCode);
    }
  }, [isOpen, initialCode, initialName, initialIsActive]);

  const handleCodeChange = (newCode: string) => {
    setCode(newCode);
    const parsed = parseVbaMacro(newCode);
    setParsedRules(parsed);
  };

  const runTest = (codeToTest = code) => {
    const demoRecord: BuroRecord = sampleRecord || {
      cod_tipo_id: 'C',
      cod_id_sujeto: '1710034065',
      nom_sujeto: 'PEREZ ANDRADE JUAN CARLOS',
      direccion: 'AV AMAZONAS N24-100 Y COLON',
      ciudad: 'QUITO',
      telefono: '0998765432',
      fec_corte_saldo: '31/01/2026',
      tipo_deudor: 'TITULAR',
      num_operacion: 'OP-2026-9874',
      fec_concesion: '15/06/2024',
      val_operacion: 1250.50,
      monto_concedido: 1250.50,
      val_xvencer: 850.00,
      val_vencido: 400.50,
      val_dem_judicial: 0,
      val_cart_castigada: 0,
      num_dias_vencido: 45,
      fec_nacimiento: '14/08/1988',
      deuda_refinanciada: 0,
      fec_vencimiento: '15/06/2027',
      REPORTADO: 0,
      FACTURAS_PAGADAS: 0,
      PARROQUIA: 'MARISCAL SUCRE',
      EMAIL: 'juan.perez@example.com',
      GENERO: 'M',
      ESTADO_CIVIL: 'S',
      ESTADO_OPERACION: 'V',
      VALOR_NDI: 0,
      FECHA_PAGO_CUOTA: '15/02/2026'
    };

    try {
      const output = testVbaMacroOnRecord(demoRecord, codeToTest);
      setTestOutput(output);
    } catch (err: any) {
      setTestOutput(`Error al evaluar la macro: ${err?.message || 'Sintaxis no válida'}`);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    showToast('Código VBA copiado al portapapeles', 'info');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleResetToDefault = () => {
    if (confirm('¿Restaurar el código VBA oficial por defecto de Equifax?')) {
      setCode(DEFAULT_EQUIFAX_VBA_MACRO);
      setName('Macro Oficial Equifax');
      const parsed = parseVbaMacro(DEFAULT_EQUIFAX_VBA_MACRO);
      setParsedRules(parsed);
      runTest(DEFAULT_EQUIFAX_VBA_MACRO);
      showToast('Macro restablecida a la versión oficial', 'info');
    }
  };

  const handleSave = async () => {
    try {
      await onSaveMacro(code, name, isActive);
      showToast('✓ Configuración de Macro VBA guardada permanentemente en Firestore', 'success');
      onClose();
    } catch (err: any) {
      showToast(`Error al guardar macro: ${err?.message || 'Error desconocido'}`, 'error');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Code2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                Motor de Macro Equifax (VBA)
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold uppercase tracking-wider">
                  Dinámico
                </span>
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Pega el código de la macro VBA de Excel para que el sistema procese y genere los archivos automáticamente
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Macro Activation Checkbox */}
            <label className="inline-flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-neutral-700 dark:text-neutral-200 bg-neutral-100 dark:bg-neutral-800 px-3 py-1.5 rounded-xl border border-neutral-300 dark:border-neutral-700">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
              />
              <span>Aplicar Macro Automáticamente</span>
            </label>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Name & Quick Info Bar */}
        <div className="px-6 py-3 bg-neutral-100/70 dark:bg-neutral-800/40 border-b border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-1 min-w-[280px]">
            <label className="font-bold text-neutral-700 dark:text-neutral-300 whitespace-nowrap">
              Nombre / Versión:
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Macro Equifax v2026.1"
              className="w-full max-w-sm px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 font-medium">
              Delimitador: <strong className="text-indigo-600 dark:text-indigo-400 font-mono">"{parsedRules.delimiter}"</strong>
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 font-medium">
              Extensión: <strong className="text-indigo-600 dark:text-indigo-400 font-mono">{parsedRules.extension}</strong>
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 font-medium">
              Columnas: <strong className="text-indigo-600 dark:text-indigo-400">{parsedRules.headerColumns.length}</strong>
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 border-b border-neutral-200 dark:border-neutral-800 flex items-center gap-4 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('editor')}
            className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'editor'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
            }`}
          >
            <FileCode className="w-4 h-4" />
            <span>Código VBA ({code.split('\n').length} líneas)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('parsed');
            }}
            className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'parsed'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Reglas Extraídas ({parsedRules.headerColumns.length} vars)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              runTest();
              setActiveTab('test');
            }}
            className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'test'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
            }`}
          >
            <Play className="w-4 h-4" />
            <span>Previsualización de Línea Generada</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Experimental Warning Banner */}
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
                Aviso de Función Experimental
              </p>
              <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
                La integración y ejecución de código VBA de macros dentro de la aplicación es una herramienta experimental y se utiliza bajo la exclusiva responsabilidad del usuario. 
                Se recomienda continuar utilizando el procedimiento oficial de Equifax: ejecutar la macro directamente en Microsoft Excel de forma local en su PC antes de subir los archivos finales.
              </p>
            </div>
          </div>

          {activeTab === 'editor' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 flex items-center gap-1">
                  <Info className="w-3.5 h-3.5 text-indigo-500" />
                  Copia el código VBA desde Excel (Alt + F11) y pégalo directamente en este editor:
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 text-neutral-700 dark:text-neutral-300 text-xs font-semibold flex items-center gap-1 transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copiado' : 'Copiar'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleResetToDefault}
                    className="px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 text-neutral-700 dark:text-neutral-300 text-xs font-semibold flex items-center gap-1 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-amber-500" />
                    <span>Restaurar Oficial</span>
                  </button>
                </div>
              </div>

              {/* Code Textarea */}
              <div className="relative rounded-2xl border border-neutral-300 dark:border-neutral-700 bg-neutral-950 font-mono text-xs overflow-hidden shadow-inner">
                <textarea
                  value={code}
                  onChange={(e) => handleCodeChange(e.target.value)}
                  rows={18}
                  spellCheck={false}
                  placeholder="' Pega aquí tu código de Macro VBA de Equifax..."
                  className="w-full p-4 bg-transparent text-emerald-400 focus:outline-none focus:ring-0 resize-y leading-relaxed"
                />
              </div>
            </div>
          )}

          {activeTab === 'parsed' && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 space-y-2">
                  <p className="font-bold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                    <FileSpreadsheet className="w-4 h-4 text-indigo-500" />
                    Estructura Detectada
                  </p>
                  <ul className="space-y-1 text-neutral-600 dark:text-neutral-400">
                    <li>• Delimitador: <strong className="text-neutral-900 dark:text-neutral-100 font-mono">{parsedRules.delimiter}</strong></li>
                    <li>• Formato salida: <strong className="text-neutral-900 dark:text-neutral-100 font-mono">{parsedRules.extension}</strong></li>
                    <li>• Incluye Encabezado: <strong className="text-neutral-900 dark:text-neutral-100">{parsedRules.hasHeader ? 'Sí' : 'No'}</strong></li>
                    <li>• Total Columnas: <strong className="text-neutral-900 dark:text-neutral-100">{parsedRules.headerColumns.length}</strong></li>
                  </ul>
                </div>

                <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 space-y-2">
                  <p className="font-bold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-emerald-500" />
                    Transformaciones
                  </p>
                  <ul className="space-y-1 text-neutral-600 dark:text-neutral-400">
                    <li>• Fechas: {parsedRules.dateTransformations.join(', ') || 'dd/MM/yyyy'}</li>
                    <li>• Importes: {parsedRules.numericTransformations.join(', ') || '2 decimales'}</li>
                    <li>• Limpieza: Mayúsculas y sin caracteres conflictivos</li>
                  </ul>
                </div>

                <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 space-y-2">
                  <p className="font-bold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                    <Code2 className="w-4 h-4 text-amber-500" />
                    Procedimientos VBA
                  </p>
                  {parsedRules.detectedProcedures.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {parsedRules.detectedProcedures.map((proc, idx) => (
                        <span key={idx} className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-mono text-[11px]">
                          {proc}()
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-neutral-500">Reglas evaluadas globalmente</p>
                  )}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 space-y-2">
                <p className="font-bold text-neutral-800 dark:text-neutral-200">
                  Matriz de Columnas Extraídas de la Macro ({parsedRules.headerColumns.length}):
                </p>
                <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto p-2 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700">
                  {parsedRules.headerColumns.map((col, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-mono text-[11px] border border-indigo-200 dark:border-indigo-900 flex items-center gap-1"
                    >
                      <span className="text-[9px] text-indigo-400 font-bold">{idx + 1}.</span> {col}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'test' && (
            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Línea resultante del archivo final generada por el Motor VBA:
                  </p>
                  <button
                    type="button"
                    onClick={() => runTest()}
                    className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 transition-colors"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Re-evaluar</span>
                  </button>
                </div>

                <div className="p-3 rounded-xl bg-neutral-950 text-emerald-400 font-mono text-xs overflow-x-auto whitespace-pre select-all border border-neutral-800">
                  {testOutput || 'Ejecuta la prueba para ver el resultado.'}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 space-y-2">
                <p className="font-bold text-neutral-800 dark:text-neutral-200">
                  Valores del Registro de Prueba:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-neutral-600 dark:text-neutral-400">
                  <div>Cédula: <strong className="text-neutral-900 dark:text-neutral-100">1710034065</strong></div>
                  <div>Nombre: <strong className="text-neutral-900 dark:text-neutral-100">PEREZ JUAN</strong></div>
                  <div>Fecha Corte: <strong className="text-neutral-900 dark:text-neutral-100">31/01/2026</strong></div>
                  <div>Saldo Total: <strong className="text-neutral-900 dark:text-neutral-100">$1,250.50</strong></div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-800/50">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetToDefault}
              className="px-3.5 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-bold transition-colors"
            >
              Restablecer Oficial
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-bold transition-colors"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-md active:scale-95 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Guardando en Firestore...' : 'Guardar y Aplicar Macro'}</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
