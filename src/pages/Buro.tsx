import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Download,
  Search,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  Info,
  Calendar,
  DollarSign,
  Users,
  ChevronRight,
  Sparkles,
  Database,
  Clock,
  Layers,
  ArrowRight,
  Filter,
  Check,
  AlertCircle,
  Trash2,
  Plus,
  X,
  FolderOpen,
  CheckSquare,
  Square,
  Building2,
  Code2
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { db } from '../firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import {
  processBuroFile,
  exportBuroToExcel,
  exportBuroToGjm,
  exportRechazosToExcel,
  parseReferenceMap,
  BuroProcessingResult,
  BuroRecord,
  PhaseAudit
} from '../lib/buroProcessor';
import {
  DEFAULT_EQUIFAX_VBA_MACRO,
  executeVbaMacroOnRecords,
  MacroExecutionResult
} from '../lib/buroMacroEngine';
import { BuroMacroModal } from '../components/BuroMacroModal';
import { SuccessModal } from '../components/SuccessModal';
import { SAMPLE_GJM_FILE } from '../lib/sampleGjmData';
import { cn } from '../lib/utils';

export interface BuroRefBaseDoc {
  id: string;
  name: string;
  description?: string;
  recordCount: number;
  createdBy: string;
  userEmail?: string;
  enterpriseId: string;
  createdAt: any;
  recordsMap: Record<string, { fec_vencimiento?: string; fec_concesion?: string; val_operacion?: number }>;
  rawCsv?: string;
}

export default function Buro() {
  const { user, profile } = useAuth();
  const { showToast } = useNotification();
  const currentEnterpriseId = profile?.enterpriseId || user?.uid;

  const [fileContent, setFileContent] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [companyCode, setCompanyCode] = useState<string>(() => {
    if (typeof window !== 'undefined' && currentEnterpriseId) {
      return localStorage.getItem(`buro_equifax_code_${currentEnterpriseId}`) || '';
    }
    return '';
  });
  const [cutoffDate, setCutoffDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [expressMinDate, setExpressMinDate] = useState<string>('');
  const [refFileName, setRefFileName] = useState<string>('');
  const [refFileContent, setRefFileContent] = useState<string | ArrayBuffer | undefined>(undefined);
  const [useRefBase, setUseRefBase] = useState<boolean>(true);
  const [savedRefBases, setSavedRefBases] = useState<BuroRefBaseDoc[]>([]);
  const [selectedRefBaseId, setSelectedRefBaseId] = useState<string>('');
  const [loadingRefBases, setLoadingRefBases] = useState<boolean>(false);
  const [savingRefBase, setSavingRefBase] = useState<boolean>(false);
  const [showRefModal, setShowRefModal] = useState<boolean>(false);
  const [processing, setProcessing] = useState<boolean>(false);
  const [result, setResult] = useState<BuroProcessingResult | null>(null);
  const [activeTab, setActiveTab] = useState<'principal' | 'rechazos' | 'auditoria' | 'historial'>('principal');
  const [activeRechazoSubTab, setActiveRechazoSubTab] = useState<'fueraCorte' | 'sinDeuda' | 'fecVenc' | 'fueraAplicable' | 'identIncorrecta'>('fueraCorte');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [dragActive, setDragActive] = useState<boolean>(false);

  // Macro Equifax (VBA) state
  const [macroConfig, setMacroConfig] = useState<{
    docId?: string;
    macroCode: string;
    macroName: string;
    isActive: boolean;
  }>({
    macroCode: DEFAULT_EQUIFAX_VBA_MACRO,
    macroName: 'Macro Oficial Equifax',
    isActive: true
  });
  const [showMacroModal, setShowMacroModal] = useState<boolean>(false);
  const [showSuccessModal, setShowSuccessModal] = useState<boolean>(false);
  const [successModalMessage, setSuccessModalMessage] = useState<string>('');
  const [savingMacro, setSavingMacro] = useState<boolean>(false);
  const [macroResult, setMacroResult] = useState<MacroExecutionResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const refFileInputRef = useRef<HTMLInputElement>(null);
  const modalRefFileInputRef = useRef<HTMLInputElement>(null);

  // Fetch saved macro config from Firestore
  const fetchMacroConfig = async () => {
    if (!currentEnterpriseId) return;
    try {
      const q = query(
        collection(db, 'buro_macro_configs'),
        where('enterpriseId', '==', currentEnterpriseId)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const firstDoc = snap.docs[0];
        const data = firstDoc.data();
        setMacroConfig({
          docId: firstDoc.id,
          macroCode: data.macroCode || DEFAULT_EQUIFAX_VBA_MACRO,
          macroName: data.macroName || 'Macro Oficial Equifax',
          isActive: data.isActive ?? true
        });
      }
    } catch (err) {
      console.error('Error al cargar configuración de macro VBA:', err);
    }
  };

  // Save updated macro config to Firestore
  const handleSaveMacroConfig = async (code: string, name: string, active: boolean) => {
    if (!currentEnterpriseId) return;
    try {
      setSavingMacro(true);
      await addDoc(collection(db, 'buro_macro_configs'), {
        macroCode: code,
        macroName: name,
        isActive: active,
        enterpriseId: currentEnterpriseId,
        createdBy: user?.uid || '',
        userEmail: user?.email || '',
        updatedAt: Timestamp.now()
      });
      setMacroConfig({
        macroCode: code,
        macroName: name,
        isActive: active
      });
      await fetchMacroConfig();
    } finally {
      setSavingMacro(false);
    }
  };

  // Fetch saved reference bases from Firestore
  const fetchSavedRefBases = async () => {
    if (!currentEnterpriseId) return;
    try {
      setLoadingRefBases(true);
      const q = query(
        collection(db, 'buro_reference_bases'),
        where('enterpriseId', '==', currentEnterpriseId)
      );
      const snap = await getDocs(q);
      const docs: BuroRefBaseDoc[] = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      } as BuroRefBaseDoc));

      docs.sort((a, b) => {
        const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return tB - tA;
      });

      setSavedRefBases(docs);

      // Auto-select first/newest base if none selected
      if (docs.length > 0 && !selectedRefBaseId) {
        const firstDoc = docs[0];
        setSelectedRefBaseId(firstDoc.id);
        setRefFileName(firstDoc.name);
        setUseRefBase(true);
        if (firstDoc.rawCsv) {
          setFileContent(firstDoc.rawCsv);
          setFileName(firstDoc.name);
        }
      }
    } catch (err) {
      console.error('Error al cargar bases de referencia guardadas:', err);
    } finally {
      setLoadingRefBases(false);
    }
  };

  // Select a saved base from Firestore
  const handleSelectSavedBase = (id: string) => {
    setSelectedRefBaseId(id);
    setUseRefBase(true);
    const selected = savedRefBases.find(b => b.id === id);
    if (selected) {
      setRefFileName(selected.name);
      showToast(`Base de referencia "${selected.name}" activada (${selected.recordCount.toLocaleString()} registros)`, 'info');
    }
  };

  // Upload and permanently save reference base file to Firestore
  const handleSaveRefFileToFirestore = async (file: File) => {
    if (!currentEnterpriseId) {
      showToast('No se identificó la empresa actual', 'error');
      return;
    }

    try {
      setSavingRefBase(true);
      showToast(`Procesando y guardando "${file.name}" en Firestore...`, 'info');

      const isExcel = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls');
      const reader = new FileReader();

      reader.onload = async (evt) => {
        try {
          const rawResult = evt.target?.result;
          if (!rawResult) {
            showToast('El archivo seleccionado está vacío', 'error');
            setSavingRefBase(false);
            return;
          }

          let csvString = '';
          if (isExcel) {
            const data = new Uint8Array(rawResult as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            csvString = XLSX.utils.sheet_to_csv(worksheet, { FS: ';' });
          } else {
            csvString = typeof rawResult === 'string' ? rawResult : '';
          }

          const parsedMap = parseReferenceMap(isExcel ? rawResult : csvString);
          if (parsedMap.size === 0) {
            showToast('No se encontraron registros de cédula o fecha de vencimiento válidos', 'error');
            setSavingRefBase(false);
            return;
          }

          // Convert parsed map to plain object for Firestore storage
          const recordsMap: Record<string, { fec_vencimiento?: string; fec_concesion?: string; val_operacion?: number }> = {};
          parsedMap.forEach((val, key) => {
            recordsMap[key] = val;
          });

          // Store rawCsv if within reasonable Firestore document limit (~850KB max)
          const rawCsvToStore = csvString && csvString.length < 850000 ? csvString : undefined;

          const docRef = await addDoc(collection(db, 'buro_reference_bases'), {
            name: file.name,
            recordCount: parsedMap.size,
            createdBy: user?.uid || '',
            userEmail: user?.email || '',
            enterpriseId: currentEnterpriseId,
            createdAt: Timestamp.now(),
            recordsMap,
            rawCsv: rawCsvToStore
          });

          setRefFileName(file.name);
          setRefFileContent(rawResult);

          showToast(`✓ Base "${file.name}" (${parsedMap.size} registros) guardada en Firestore y activada`, 'success');

          await fetchSavedRefBases();
          setSelectedRefBaseId(docRef.id);
          setUseRefBase(true);
        } catch (err: any) {
          console.error('Error guardando base de referencia en Firestore:', err);
          showToast(`Error al guardar en la nube: ${err?.message || 'Falló la conexión'}`, 'error');
        } finally {
          setSavingRefBase(false);
        }
      };

      if (isExcel) {
        reader.readAsArrayBuffer(file);
      } else {
        reader.readAsText(file, 'ISO-8859-1');
      }
    } catch (err: any) {
      console.error(err);
      setSavingRefBase(false);
    }
  };

  // Handle direct upload from quick button
  const handleRefFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleSaveRefFileToFirestore(file);
    }
  };

  // Delete a saved reference base from Firestore
  const handleDeleteRefBase = async (id: string, name: string) => {
    if (!confirm(`¿Está seguro de eliminar permanentemente la base de referencia "${name}"?`)) return;
    try {
      await deleteDoc(doc(db, 'buro_reference_bases', id));
      showToast(`Base de referencia "${name}" eliminada de Firestore`, 'info');
      if (selectedRefBaseId === id) {
        setSelectedRefBaseId('');
      }
      await fetchSavedRefBases();
    } catch (err: any) {
      console.error('Error eliminando base de referencia:', err);
      showToast('Error al eliminar la base de referencia de Firestore', 'error');
    }
  };

  // Handle File Upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  const processSelectedFile = (file: File) => {
    setFileName(file.name);
    const lowerName = file.name.toLowerCase();
    const isExcel = lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls');

    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          // Convert sheet to semicolon-separated text
          const csvText = XLSX.utils.sheet_to_csv(worksheet, { FS: ';' });
          setFileContent(csvText || '');
          showToast(`Archivo Excel "${file.name}" leído exitosamente`, 'success');
        } catch (err: any) {
          console.error('Error leyendo Excel:', err);
          showToast(`Error al procesar hoja Excel: ${err?.message || 'Formato no soportado'}`, 'error');
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setFileContent(text || '');
        showToast(`Archivo "${file.name}" cargado exitosamente`, 'success');
      };
      reader.readAsText(file, 'ISO-8859-1'); // Common encoding for Latin systems/GJM
    }
  };

  // Load execution history from Firestore
  const fetchHistory = async () => {
    if (!currentEnterpriseId) return;
    try {
      setLoadingHistory(true);
      const q = query(
        collection(db, 'buro_logs'),
        where('enterpriseId', '==', currentEnterpriseId)
      );
      const snap = await getDocs(q);
      const docs = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      docs.sort((a: any, b: any) => {
        const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return tB - tA;
      });
      setHistoryLogs(docs);
    } catch (err) {
      console.error('Error fetching buro history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchHistory();
    fetchSavedRefBases();
    fetchMacroConfig();
    if (currentEnterpriseId) {
      const savedCode = localStorage.getItem(`buro_equifax_code_${currentEnterpriseId}`);
      if (savedCode) {
        setCompanyCode(savedCode);
      }
    }
  }, [currentEnterpriseId]);

  const handleCompanyCodeChange = (val: string) => {
    setCompanyCode(val);
    if (currentEnterpriseId) {
      localStorage.setItem(`buro_equifax_code_${currentEnterpriseId}`, val.trim());
    }
  };

  // Handle Drag and Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processSelectedFile(e.dataTransfer.files[0]);
    }
  };

  // Load sample file
  const handleLoadSample = () => {
    setFileName('cartera_ejemplo_equifax.gjm');
    setFileContent(SAMPLE_GJM_FILE);
    showToast('Datos de ejemplo .gjm cargados', 'info');
  };

  // Execute 10-Phase Processing
  const handleRunETL = async () => {
    if (!companyCode.trim()) {
      showToast('Debe ingresar el código de empresa / negocio asignado por Equifax (ej. 2968) antes de procesar', 'error');
      return;
    }

    if (!fileContent.trim()) {
      showToast('Por favor cargue un archivo .gjm o texto antes de procesar', 'error');
      return;
    }

    try {
      setProcessing(true);
      // Simulate pipeline animation
      await new Promise((resolve) => setTimeout(resolve, 600));

      // Resolve active reference map from selected Firestore doc or uploaded local file
      let activeRefContent: any = undefined;

      if (useRefBase) {
        if (selectedRefBaseId) {
          const selectedDoc = savedRefBases.find(b => b.id === selectedRefBaseId);
          if (selectedDoc && selectedDoc.recordsMap) {
            activeRefContent = selectedDoc.recordsMap;
          }
        } else if (refFileContent) {
          activeRefContent = refFileContent;
        }
      }

      const res = processBuroFile(fileContent, {
        companyCode: companyCode.trim(),
        customCutoffDate: cutoffDate,
        expressMinDate: expressMinDate || undefined,
        refFileContent: activeRefContent,
        useRefBase: useRefBase
      });

      // If VBA Macro engine is active, execute the macro transformations
      let macroExecResult: MacroExecutionResult | null = null;
      if (macroConfig.isActive && macroConfig.macroCode && res.principalRecords.length > 0) {
        macroExecResult = executeVbaMacroOnRecords(
          res.principalRecords,
          macroConfig.macroCode,
          res.principalFilename
        );
        setMacroResult(macroExecResult);
      } else {
        setMacroResult(null);
      }

      setResult(res);
      setActiveTab('principal');

      // Save execution audit log to Firestore
      if (currentEnterpriseId) {
        try {
          await addDoc(collection(db, 'buro_logs'), {
            enterpriseId: currentEnterpriseId,
            companyCode: companyCode.trim(),
            userEmail: user?.email || '',
            originalFileName: fileName || 'archivo_cartera.gjm',
            processedAt: Timestamp.now(),
            createdAt: Timestamp.now(),
            stats: res.stats,
            principalFilename: res.principalFilename,
            secondaryFilename: res.rechazosFilename,
            usedRefBase: useRefBase && !!activeRefContent,
            usedMacro: macroConfig.isActive,
            macroName: macroConfig.macroName
          });
          fetchHistory();
        } catch (dbErr) {
          console.error('Error saving buro audit log to Firestore:', dbErr);
        }
      }

      setSuccessModalMessage(`Procesamiento completado: ${res.stats.validCedulasCount} registros listos. IMPORTANTE: Revise los datos manualmente y utilice la macro externa proporcionada por Equifax para la estandarización final antes de subirlos.`);
      setShowSuccessModal(true);
    } catch (err: any) {
      console.error('Error processing buro file:', err);
      showToast('Error durante el procesamiento del archivo: ' + err.message, 'error');
    } finally {
      setProcessing(false);
    }
  };

  // Download Handlers
  const handleDownloadPrincipal = () => {
    if (!result || result.principalRecords.length === 0) {
      showToast('No hay registros principales para exportar', 'error');
      return;
    }
    exportBuroToExcel(result.principalRecords, result.principalFilename, false);
    showToast(`Descargado ${result.principalFilename}`, 'success');
  };

  const handleDownloadPrincipalGjm = () => {
    if (!result || result.principalRecords.length === 0) {
      showToast('No hay registros principales para exportar', 'error');
      return;
    }
    if (macroResult && macroResult.formattedOutput) {
      const blob = new Blob([macroResult.formattedOutput], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = macroResult.filename || result.principalFilename.replace(/\.xlsx$/i, '.gjm');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast(`Descargado ${macroResult.filename} (Generado con Macro Equifax)`, 'success');
    } else {
      const gjmName = result.principalFilename.replace(/\.xlsx$/i, '.gjm');
      exportBuroToGjm(result.principalRecords, gjmName);
      showToast(`Descargado ${gjmName}`, 'success');
    }
  };

  const handleDownloadRechazos = () => {
    if (!result || !result.rechazos) {
      showToast('No hay datos de rechazos generados', 'info');
      return;
    }
    exportRechazosToExcel(result.rechazos, result.rechazosFilename);
    showToast(`Descargado Libro de Rechazos: ${result.rechazosFilename}`, 'success');
  };

  // Filter principal records for search
  const filteredPrincipal = (result?.principalRecords || []).filter((r) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (r.cod_id_sujeto || '').toLowerCase().includes(term) ||
      (r.nom_sujeto || '').toLowerCase().includes(term) ||
      (r.num_operacion || '').toLowerCase().includes(term)
    );
  });

  // Filter invalid records for search
  const filteredInvalid = (result?.invalidRecords || []).filter((r) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (r.cod_id_sujeto || '').toLowerCase().includes(term) ||
      (r.nom_sujeto || '').toLowerCase().includes(term) ||
      (r.num_operacion || '').toLowerCase().includes(term) ||
      (r.validation_result?.reason || '').toLowerCase().includes(term)
    );
  });

  const currentMonthDisplay = format(new Date(), "MMMM 'de' yyyy", { locale: es }).toUpperCase();

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-900/40 p-6 md:p-8 text-white shadow-2xl">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              Módulo de Inteligencia de Cartera Equifax
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <FileSpreadsheet className="w-8 h-8 text-indigo-400" />
              Buró de Crédito — Validación de Cartera
            </h1>
            <p className="text-neutral-300 text-sm max-w-2xl">
              Procesamiento automatizado de 10 fases bajo el estándar de Equifax Ecuador.
              Estructura, limpia, valida cédulas mediante Módulo 10 y exporta archivos <code className="bg-black/40 px-1.5 py-0.5 rounded text-indigo-300 font-mono">{companyCode.trim() || 'CODIGO'}_(FECHA_DE_CORTE).xlsx</code> y el Libro de Rechazos de 5 Hojas.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-white/5 backdrop-blur-md p-3 rounded-2xl border border-white/10">
            <div className="text-left sm:text-right px-2">
              <p className="text-xs text-neutral-400 font-medium">Período de Envío</p>
              <p className="text-sm font-bold text-indigo-300 capitalize">{currentMonthDisplay}</p>
            </div>
            <button
              onClick={() => setShowMacroModal(true)}
              className="px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-white text-xs font-bold transition-all shadow-lg flex items-center justify-center gap-2 border border-slate-700 whitespace-nowrap"
              title="Configurar y editar la macro VBA de Equifax"
            >
              <Code2 className="w-4 h-4 text-emerald-400" />
              <span>Macro VBA Equifax</span>
              {macroConfig.isActive ? (
                <span className="w-2 h-2 rounded-full bg-emerald-400" title="Macro Activa" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-neutral-400" title="Macro Desactivada" />
              )}
            </button>
            <button
              onClick={handleLoadSample}
              className="px-4 py-2.5 rounded-xl bg-indigo-600/80 hover:bg-indigo-600 text-white text-xs font-bold transition-all shadow-lg flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <RefreshCw className="w-4 h-4" />
              Cargar Archivo Ejemplo
            </button>
          </div>
        </div>
      </div>

      {/* File Upload Dropzone */}
      <div className="bg-white dark:bg-neutral-900 rounded-3xl p-6 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center gap-3",
            dragActive
              ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 scale-[1.01]"
              : fileContent
              ? "border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20"
              : "border-neutral-300 dark:border-neutral-700 hover:border-indigo-400 dark:hover:border-indigo-500 bg-neutral-50/50 dark:bg-neutral-800/30"
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".gjm,.txt,.csv,.xlsx,.xls,.dat"
            onChange={handleFileChange}
            className="hidden"
          />

          <div className={cn(
            "w-14 h-14 rounded-2xl flex items-center justify-center transition-transform shadow-inner",
            fileContent ? "bg-emerald-500 text-white" : "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400"
          )}>
            {fileContent ? <CheckCircle2 className="w-7 h-7" /> : <Upload className="w-7 h-7" />}
          </div>

          <div className="space-y-1">
            <p className="text-sm font-bold text-neutral-800 dark:text-neutral-200">
              {fileName ? (
                <span className="text-indigo-600 dark:text-indigo-400">{fileName}</span>
              ) : (
                'Cargar Archivo Plano Fuente (.gjm / .txt / .csv / .xlsx)'
              )}
            </p>
            <p className="text-xs text-neutral-400">
              Arrastra tu archivo aquí o haz clic para seleccionarlo desde tu dispositivo
            </p>
          </div>

          {fileContent && (
            <div className="flex items-center gap-2 mt-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {fileContent.split('\n').filter(l => l.trim()).length} líneas detectadas
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setFileContent('');
                  setFileName('');
                  setResult(null);
                }}
                className="px-3 py-1 rounded-full bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-rose-100 hover:text-rose-700 text-xs font-semibold transition-colors"
              >
                Limpiar
              </button>
            </div>
          )}
        </div>

        {/* Parameters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          <div className="space-y-1">
            <label htmlFor="company-code" className="block text-xs font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-indigo-500" />
              <span>Código Equifax <span className="text-rose-500">*</span></span>
            </label>
            <input
              id="company-code"
              type="text"
              value={companyCode}
              onChange={(e) => handleCompanyCodeChange(e.target.value)}
              placeholder="Ej. 2968"
              className={cn(
                "w-full px-3.5 py-2 rounded-xl text-xs font-bold border bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none shadow-sm transition-colors",
                !companyCode.trim()
                  ? "border-amber-400 dark:border-amber-500/70 focus:border-indigo-500"
                  : "border-neutral-300 dark:border-neutral-700"
              )}
            />
            <p className="text-[11px] text-neutral-500 truncate">
              {!companyCode.trim() ? (
                <span className="text-amber-600 dark:text-amber-400 font-medium">Requerido (ej. 2968)</span>
              ) : (
                <span>Prefijo: <code className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">{companyCode.trim()}_</code></span>
              )}
            </p>
          </div>

          <div className="space-y-1">
            <label htmlFor="cutoff-date" className="block text-xs font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-indigo-500" />
              Fecha de Corte del Reporte
            </label>
            <input
              id="cutoff-date"
              type="date"
              value={cutoffDate}
              onChange={(e) => setCutoffDate(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl text-xs font-semibold border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none shadow-sm"
            />
            <p className="text-[11px] text-neutral-500 truncate">
              Corte (ej. <code className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">{companyCode.trim() || '2968'}_DDMMYYYY.xlsx</code>)
            </p>
          </div>

          <div className="space-y-1">
            <label htmlFor="express-date" className="block text-xs font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-indigo-500" />
              Límite Antigüedad (Opcional)
            </label>
            <input
              id="express-date"
              type="date"
              value={expressMinDate}
              onChange={(e) => setExpressMinDate(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl text-xs font-semibold border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none shadow-sm"
            />
            <p className="text-[11px] text-neutral-500 truncate">
              Remueve concesiones antiguas (Regla 4)
            </p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                <Database className="w-4 h-4 text-indigo-500" />
                Base de Cotejo (Regla 3)
              </label>
              <label className="inline-flex items-center gap-1 cursor-pointer select-none text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                <input
                  type="checkbox"
                  checked={useRefBase}
                  onChange={(e) => setUseRefBase(e.target.checked)}
                  className="rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500 w-3 h-3 cursor-pointer"
                />
                <span>Activar</span>
              </label>
            </div>

            {/* Selector of saved reference bases in Firestore + Upload/Manage buttons */}
            <div className="flex items-center gap-1.5">
              <input
                ref={refFileInputRef}
                type="file"
                accept=".xlsx,.xls,.gjm,.txt,.csv,.dat"
                onChange={handleRefFileChange}
                className="hidden"
              />

              {savedRefBases.length > 0 ? (
                <select
                  disabled={!useRefBase}
                  value={selectedRefBaseId}
                  onChange={(e) => setSelectedRefBaseId(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl text-xs font-semibold border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none shadow-sm disabled:opacity-50 truncate"
                >
                  <option value="">-- Usar archivo local subido --</option>
                  {savedRefBases.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.recordCount} reg.)
                    </option>
                  ))}
                </select>
              ) : (
                <button
                  type="button"
                  disabled={!useRefBase || savingRefBase}
                  onClick={() => refFileInputRef.current?.click()}
                  className="flex-1 px-3 py-2 rounded-xl text-xs font-semibold border border-dashed border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-100 text-neutral-700 dark:text-neutral-300 flex items-center justify-center gap-1.5 disabled:opacity-50 truncate"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{savingRefBase ? 'Guardando en Firestore...' : refFileName || 'Subir Base de Referencia'}</span>
                </button>
              )}

              <button
                type="button"
                disabled={!useRefBase}
                onClick={() => setShowRefModal(true)}
                title="Gestionar bases guardadas en la nube"
                className="p-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 transition-colors disabled:opacity-50 flex-shrink-0"
              >
                <FolderOpen className="w-4 h-4 text-indigo-500" />
              </button>

              <button
                type="button"
                disabled={!useRefBase || savingRefBase}
                onClick={() => refFileInputRef.current?.click()}
                title="Subir y guardar nueva base en Firestore"
                className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-50 flex-shrink-0"
              >
                {savingRefBase ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              </button>
            </div>

            <p className="text-[11px] text-neutral-500 truncate">
              {useRefBase ? (
                selectedRefBaseId ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">✓ Base guardada activa ({savedRefBases.find(b => b.id === selectedRefBaseId)?.recordCount} registros)</span>
                ) : refFileName ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">✓ {refFileName}</span>
                ) : (
                  'Guarda en Firestore para usar siempre'
                )
              ) : (
                'Desactivado (Regla 3 no cotejará fechas)'
              )}
            </p>
          </div>
        </div>

        {/* Action Row */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <div>
            {!companyCode.trim() && fileContent ? (
              <p className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>Ingrese el Código de Empresa Equifax en la primera casilla para habilitar el procesamiento</span>
              </p>
            ) : null}
          </div>

          <button
            onClick={handleRunETL}
            disabled={!fileContent || !companyCode.trim() || processing}
            className={cn(
              "px-6 py-3 rounded-2xl font-bold text-sm text-white shadow-xl flex items-center gap-2 transition-all duration-200 whitespace-nowrap",
              !fileContent || !companyCode.trim() || processing
                ? "bg-neutral-300 dark:bg-neutral-800 text-neutral-500 cursor-not-allowed shadow-none"
                : "bg-indigo-600 hover:bg-indigo-700 active:scale-95 shadow-indigo-500/25"
            )}
          >
            {processing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Ejecutando 10 Fases ETL Equifax...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Procesar y Validar Cartera Equifax</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Results Overview & Stats */}
      {result && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Summary KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-neutral-900 rounded-3xl p-5 border border-neutral-200 dark:border-neutral-800 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                  Cartera Limpia
                </p>
                <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
              </div>
              <p className="text-2xl font-black text-neutral-900 dark:text-neutral-100 mt-2">
                {result.stats.validCedulasCount}
              </p>
              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
                Destino: {result.principalFilename}
              </p>
            </div>

            <div className="bg-white dark:bg-neutral-900 rounded-3xl p-5 border border-neutral-200 dark:border-neutral-800 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                  Libro de Rechazos
                </p>
                <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400">
                  <ShieldAlert className="w-5 h-5" />
                </div>
              </div>
              <p className="text-2xl font-black text-neutral-900 dark:text-neutral-100 mt-2">
                {(result.stats.fueraFechaCorteCount || 0) + (result.stats.sinDeudaCount || 0) + (result.stats.fueraFechaAplicableCount || 0) + (result.stats.identificacionesIncorrectasCount || 0)}
              </p>
              <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 mt-1">
                Destino: {result.rechazosFilename}
              </p>
            </div>

            <div className="bg-white dark:bg-neutral-900 rounded-3xl p-5 border border-neutral-200 dark:border-neutral-800 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                  Monto Cartera Limpia
                </p>
                <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                  <DollarSign className="w-5 h-5" />
                </div>
              </div>
              <p className="text-2xl font-black text-neutral-900 dark:text-neutral-100 mt-2">
                $ {result.stats.totalDeudaProcessed.toLocaleString('es-EC', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mt-1">
                Suma de saldos activos procesados
              </p>
            </div>

            <div className="bg-white dark:bg-neutral-900 rounded-3xl p-5 border border-neutral-200 dark:border-neutral-800 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                  Vencimientos Corregidos
                </p>
                <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
                  <Filter className="w-5 h-5" />
                </div>
              </div>
              <p className="text-2xl font-black text-neutral-900 dark:text-neutral-100 mt-2">
                {result.stats.fecVencimientoErroneaCount || 0}
              </p>
              <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mt-1">
                Regla 3 (+1 año / Ref) mantenidos en limpia
              </p>
            </div>
          </div>

          {/* Quick Excel Downloads */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-indigo-500/10 p-5 rounded-3xl border border-indigo-200 dark:border-indigo-800/50">
            <div>
              <h4 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                Archivos Oficiales Listos para Exportación Equifax
              </h4>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                Archivos validados bajo especificación técnica. Descargue la Cartera Limpia y el Libro de Rechazos.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleDownloadPrincipal}
                className="flex-1 sm:flex-none px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all active:scale-95"
                title="Descargar Cartera Limpia Excel (.xlsx)"
              >
                <Download className="w-4 h-4" />
                Limpia Excel: {result.principalFilename}
              </button>
              <button
                onClick={handleDownloadPrincipalGjm}
                className="flex-1 sm:flex-none px-3.5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all active:scale-95"
                title="Descargar archivo plano procesado por la Macro VBA de Equifax"
              >
                <Download className="w-4 h-4" />
                <span>{macroResult?.filename || '.GJM (Macro)'}</span>
              </button>
              <button
                onClick={handleDownloadRechazos}
                className="flex-1 sm:flex-none px-4 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-lg shadow-rose-600/20 flex items-center justify-center gap-2 transition-all active:scale-95"
                title="Descargar Libro de Rechazos de 5 hojas Excel"
              >
                <Download className="w-4 h-4" />
                Libro de Rechazos (5 Hojas Excel)
              </button>
            </div>
          </div>

          {/* Main Inspection Tabs */}
          <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden">
            <div className="border-b border-neutral-200 dark:border-neutral-800 p-4 bg-neutral-50/50 dark:bg-neutral-800/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
              {/* Tab Navigation */}
              <div className="flex flex-wrap items-center gap-1.5 p-1 bg-neutral-200/60 dark:bg-neutral-800/80 rounded-2xl">
                <button
                  onClick={() => setActiveTab('principal')}
                  className={cn(
                    "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
                    activeTab === 'principal'
                      ? "bg-white dark:bg-neutral-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                      : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
                  )}
                >
                  <ShieldCheck className="w-4 h-4" />
                  Base Principal Limpia ({result.principalRecords.length})
                </button>

                <button
                  onClick={() => setActiveTab('rechazos')}
                  className={cn(
                    "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
                    activeTab === 'rechazos'
                      ? "bg-white dark:bg-neutral-900 text-rose-600 dark:text-rose-400 shadow-sm"
                      : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
                  )}
                >
                  <ShieldAlert className="w-4 h-4" />
                  Libro de Rechazos
                </button>

                <button
                  onClick={() => setActiveTab('auditoria')}
                  className={cn(
                    "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
                    activeTab === 'auditoria'
                      ? "bg-white dark:bg-neutral-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                      : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
                  )}
                >
                  <Layers className="w-4 h-4" />
                  Informe 10 Fases ({result.audits.length})
                </button>

                <button
                  onClick={() => setActiveTab('historial')}
                  className={cn(
                    "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
                    activeTab === 'historial'
                      ? "bg-white dark:bg-neutral-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                      : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
                  )}
                >
                  <Clock className="w-4 h-4" />
                  Historial de Envíos
                </button>
              </div>

              {/* Search Bar for Table Tabs */}
              {(activeTab === 'principal' || activeTab === 'incompletas') && (
                <div className="relative w-full md:w-72">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar cédula, cliente u operación..."
                    className="w-full pl-9 pr-4 py-2 rounded-xl text-xs border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}
            </div>

            {/* TAB 1: Base Principal */}
            {activeTab === 'principal' && (
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between text-xs text-neutral-500 px-2">
                  <span>Mostrando {filteredPrincipal.length} registros limpios y validados.</span>
                  <span>NDI = 0 inyectado en todos los registros.</span>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-neutral-200 dark:border-neutral-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-neutral-100 dark:bg-neutral-800/60 text-neutral-700 dark:text-neutral-300 font-bold uppercase tracking-wider border-b border-neutral-200 dark:border-neutral-800">
                      <tr>
                        <th className="p-3">Identificación</th>
                        <th className="p-3">Cliente / Sujeto</th>
                        <th className="p-3">N° Operación</th>
                        <th className="p-3">Fec. Corte</th>
                        <th className="p-3 text-right">Por Vencer</th>
                        <th className="p-3 text-right">Vencido</th>
                        <th className="p-3 text-right">Deuda Total</th>
                        <th className="p-3 text-center">Días Mora</th>
                        <th className="p-3 text-center">NDI</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 text-neutral-800 dark:text-neutral-200 font-medium">
                      {filteredPrincipal.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="p-8 text-center text-neutral-400">
                            No se encontraron registros que coincidan con la búsqueda.
                          </td>
                        </tr>
                      ) : (
                        filteredPrincipal.map((r, idx) => (
                          <tr key={idx} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors">
                            <td className="p-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                              {r.cod_id_sujeto}
                            </td>
                            <td className="p-3 max-w-xs truncate font-semibold">
                              {r.nom_sujeto}
                            </td>
                            <td className="p-3 font-mono text-neutral-500">
                              {r.num_operacion}
                            </td>
                            <td className="p-3 whitespace-nowrap text-neutral-500">
                              {r.fec_corte_saldo}
                            </td>
                            <td className="p-3 text-right font-mono">
                              $ {r.val_xvencer.toFixed(2)}
                            </td>
                            <td className={cn("p-3 text-right font-mono", r.val_vencido > 0 ? "text-amber-600 dark:text-amber-400 font-bold" : "text-neutral-500")}>
                              $ {r.val_vencido.toFixed(2)}
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              $ {(r.deuda_total || 0).toFixed(2)}
                            </td>
                            <td className="p-3 text-center font-mono">
                              <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold", r.num_dias_vencido > 0 ? "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300" : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500")}>
                                {r.num_dias_vencido}d
                              </span>
                            </td>
                            <td className="p-3 text-center font-mono font-bold text-neutral-400">
                              {r.VALOR_NDI}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 2: Libro de Rechazos Multi-Pestaña */}
            {activeTab === 'rechazos' && result.rechazos && (
              <div className="p-4 space-y-4">
                <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 flex items-start gap-3">
                  <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <div className="space-y-1 text-xs text-rose-900 dark:text-rose-200">
                    <p className="font-bold">Libro de Rechazos Oficial Equifax (5 Reglas de Negocio)</p>
                    <p>
                      Visualización interactiva de las 5 categorías de rechazos de Equifax. Puede descargar el informe completo multi-hoja haciendo clic en <strong>Libro de Rechazos (5 Hojas Excel)</strong>.
                    </p>
                  </div>
                </div>

                {/* Sub-Tabs for the 5 Rejection Rules */}
                <div className="flex flex-wrap gap-2 border-b border-neutral-200 dark:border-neutral-800 pb-3">
                  <button
                    onClick={() => setActiveRechazoSubTab('fueraCorte')}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5",
                      activeRechazoSubTab === 'fueraCorte'
                        ? "bg-rose-600 text-white shadow-sm"
                        : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200"
                    )}
                  >
                    1. Fuera Fecha Corte ({result.rechazos.fueraDeFechaCorte.length})
                  </button>
                  <button
                    onClick={() => setActiveRechazoSubTab('sinDeuda')}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5",
                      activeRechazoSubTab === 'sinDeuda'
                        ? "bg-rose-600 text-white shadow-sm"
                        : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200"
                    )}
                  >
                    2. Sin Deuda ({result.rechazos.clientesSinDeuda.length})
                  </button>
                  <button
                    onClick={() => setActiveRechazoSubTab('fecVenc')}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5",
                      activeRechazoSubTab === 'fecVenc'
                        ? "bg-blue-600 text-white shadow-sm"
                        : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200"
                    )}
                  >
                    3. Vencimiento Erróneo ({result.rechazos.fechaVencimientoErronea.length})
                  </button>
                  <button
                    onClick={() => setActiveRechazoSubTab('fueraAplicable')}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5",
                      activeRechazoSubTab === 'fueraAplicable'
                        ? "bg-rose-600 text-white shadow-sm"
                        : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200"
                    )}
                  >
                    4. Fuera Fecha Aplicable ({result.rechazos.clientesFueraFechaAplicable.length})
                  </button>
                  <button
                    onClick={() => setActiveRechazoSubTab('identIncorrecta')}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5",
                      activeRechazoSubTab === 'identIncorrecta'
                        ? "bg-amber-600 text-white shadow-sm"
                        : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200"
                    )}
                  >
                    5. Identificaciones Incorrectas ({result.rechazos.identificacionesIncorrectas.length})
                  </button>
                </div>

                {/* Sub-Tab Table Renderer */}
                {(() => {
                  let currentArr: BuroRecord[] = [];
                  let title = '';
                  let desc = '';

                  if (activeRechazoSubTab === 'fueraCorte') {
                    currentArr = result.rechazos.fueraDeFechaCorte;
                    title = 'Clientes Fuera de Fecha de Corte';
                    desc = 'Registros con fecha de concesión o saldo posterior a la fecha del reporte.';
                  } else if (activeRechazoSubTab === 'sinDeuda') {
                    currentArr = result.rechazos.clientesSinDeuda;
                    title = 'Clientes Sin Deuda / Saldo Cero';
                    desc = 'Registros con suma de saldos igual o menor a $0.00.';
                  } else if (activeRechazoSubTab === 'fecVenc') {
                    currentArr = result.rechazos.fechaVencimientoErronea;
                    title = 'Fecha de Vencimiento Errónea (Respaldados y Corregidos)';
                    desc = 'Registros donde vencimiento era menor a concesión. Se corrigieron con Base de Referencia o +1 año y SE MANTIENEN en la base limpia.';
                  } else if (activeRechazoSubTab === 'fueraAplicable') {
                    currentArr = result.rechazos.clientesFueraFechaAplicable;
                    title = 'Clientes Fuera de Fecha Aplicable';
                    desc = 'Registros con fecha de concesión anterior al límite de antigüedad configurado.';
                  } else if (activeRechazoSubTab === 'identIncorrecta') {
                    currentArr = result.rechazos.identificacionesIncorrectas;
                    title = 'Identificaciones Incorrectas (Módulo 10)';
                    desc = 'Cédulas o RUCs inválidos según algoritmo del Registro Civil.';
                  }

                  return (
                    <div className="space-y-3">
                      <div>
                        <h4 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wide">
                          {title} ({currentArr.length} registros)
                        </h4>
                        <p className="text-[11px] text-neutral-500">{desc}</p>
                      </div>

                      <div className="overflow-x-auto rounded-2xl border border-neutral-200 dark:border-neutral-800">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-neutral-100 dark:bg-neutral-800/60 text-neutral-800 dark:text-neutral-200 font-bold uppercase tracking-wider border-b border-neutral-200 dark:border-neutral-800">
                            <tr>
                              <th className="p-3">Identificación</th>
                              <th className="p-3">Motivo / Detalle</th>
                              <th className="p-3">Cliente / Sujeto</th>
                              <th className="p-3">N° Operación</th>
                              <th className="p-3">Fec. Concesión</th>
                              <th className="p-3">Fec. Vencimiento</th>
                              <th className="p-3 text-right">Deuda Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 text-neutral-800 dark:text-neutral-200 font-medium">
                            {currentArr.length === 0 ? (
                              <tr>
                                <td colSpan={7} className="p-8 text-center text-emerald-600 dark:text-emerald-400 font-bold">
                                  ✓ Sin registros en esta categoría de rechazo.
                                </td>
                              </tr>
                            ) : (
                              currentArr.map((r, idx) => (
                                <tr key={idx} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors">
                                  <td className="p-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                    {r.cod_id_sujeto || '(Vacío)'}
                                  </td>
                                  <td className="p-3">
                                    <span className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-[11px] font-semibold border border-rose-200 dark:border-rose-800/50">
                                      {r.motivo_rechazo || 'Rechazado'}
                                    </span>
                                  </td>
                                  <td className="p-3 max-w-xs truncate font-semibold">
                                    {r.nom_sujeto}
                                  </td>
                                  <td className="p-3 font-mono text-neutral-500">
                                    {r.num_operacion}
                                  </td>
                                  <td className="p-3 font-mono text-neutral-500">
                                    {r.fec_concesion}
                                  </td>
                                  <td className="p-3 font-mono text-neutral-500">
                                    {r.fec_vencimiento}
                                  </td>
                                  <td className="p-3 text-right font-mono font-bold">
                                    $ {(r.deuda_total || 0).toFixed(2)}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* TAB 3: Informe de Auditoría 10 Fases */}
            {activeTab === 'auditoria' && (
              <div className="p-6 space-y-4">
                <div className="mb-4">
                  <h4 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                    Desglose de Auditoría Técnica — 10 Fases Secuenciales ETL
                  </h4>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                    Historial de transformaciones, limpieza y depuración aplicadas a la cartera.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {result.audits.map((audit) => (
                    <div
                      key={audit.phase}
                      className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-1 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-bold font-mono">
                          FASE {audit.phase}
                        </span>
                        <span
                          className={cn(
                            "px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide",
                            audit.status === 'COMPLETED'
                              ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                              : audit.status === 'WARNED'
                              ? "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300"
                              : "bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300"
                          )}
                        >
                          {audit.status === 'COMPLETED' ? 'Ejecutado OK' : audit.status === 'WARNED' ? 'Ajustes Aplicados' : 'Informativo'}
                        </span>
                      </div>

                      <h5 className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                        {audit.name}
                      </h5>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                        {audit.description}
                      </p>

                      <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800 text-[11px] space-y-1">
                        {audit.details.map((dt, dIdx) => (
                          <div key={dIdx} className="flex items-start gap-1.5 text-neutral-700 dark:text-neutral-300">
                            <ChevronRight className="w-3 h-3 text-indigo-500 shrink-0 mt-0.5" />
                            <span>{dt}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 4: Historial de Envíos */}
            {activeTab === 'historial' && (
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                      Historial de Lotes Procesados en Firestore
                    </h4>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                      Registro persistente de validaciones de cartera mensuales.
                    </p>
                  </div>
                  <button
                    onClick={fetchHistory}
                    className="p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-600 hover:text-neutral-900 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>

                {loadingHistory ? (
                  <div className="py-8 text-center text-xs text-neutral-400">
                    Cargando historial de ejecuciones...
                  </div>
                ) : historyLogs.length === 0 ? (
                  <div className="py-8 text-center text-xs text-neutral-400">
                    No se han registrado envíos anteriores aún.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {historyLogs.map((log) => {
                      const logDate = log.processedAt?.toDate
                        ? format(log.processedAt.toDate(), "dd 'de' MMMM yyyy - HH:mm", { locale: es })
                        : 'Fecha desconocida';

                      return (
                        <div
                          key={log.id}
                          className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/30 dark:bg-neutral-800/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <FileSpreadsheet className="w-4 h-4 text-indigo-500" />
                              <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                                {log.originalFileName || 'cartera.gjm'}
                              </span>
                              <span className="px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold">
                                {log.principalFilename}
                              </span>
                            </div>
                            <p className="text-[11px] text-neutral-500">
                              Procesado por: {log.userEmail} • {logDate}
                            </p>
                          </div>

                          <div className="flex items-center gap-4 text-xs">
                            <div className="text-right">
                              <p className="font-bold text-emerald-600 dark:text-emerald-400">
                                {log.stats?.validCedulasCount || 0} Válidas
                              </p>
                              <p className="text-[11px] text-neutral-400">
                                $ {(log.stats?.totalDeudaProcessed || 0).toLocaleString('es-EC', { minimumFractionDigits: 2 })}
                              </p>
                            </div>

                            {log.stats?.invalidCedulasCount > 0 && (
                              <div className="text-right border-l border-neutral-200 dark:border-neutral-800 pl-4">
                                <p className="font-bold text-amber-600 dark:text-amber-400">
                                  {log.stats.invalidCedulasCount} Incompletas
                                </p>
                                <p className="text-[11px] text-neutral-400">
                                  {log.secondaryFilename}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Modal de Gestión de Bases de Referencia Guardadas en Firestore */}
      <AnimatePresence>
        {showRefModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-neutral-900 rounded-3xl p-6 border border-neutral-200 dark:border-neutral-800 shadow-2xl max-w-2xl w-full space-y-5"
            >
              <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                    <Database className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                      Bases de Referencia Guardadas en Firestore
                    </h3>
                    <p className="text-xs text-neutral-500">
                      Almacenamiento permanente en la nube para cotejo continuo de vencimientos (Regla 3)
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowRefModal(false)}
                  className="p-2 rounded-xl text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Action Toolbar inside Modal */}
              <div className="flex items-center justify-between gap-3 bg-neutral-50 dark:bg-neutral-800/50 p-3 rounded-2xl">
                <p className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">
                  {savedRefBases.length} {savedRefBases.length === 1 ? 'base guardada' : 'bases guardadas en Firestore'}
                </p>
                <input
                  ref={modalRefFileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.gjm,.txt,.csv"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleSaveRefFileToFirestore(file);
                  }}
                  className="hidden"
                />
                <button
                  onClick={() => modalRefFileInputRef.current?.click()}
                  disabled={savingRefBase}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-md"
                >
                  {savingRefBase ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  Subir y Guardar Nueva Base
                </button>
              </div>

              {/* Bases List */}
              <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                {savedRefBases.length === 0 ? (
                  <div className="text-center py-10 space-y-3 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl">
                    <Database className="w-10 h-10 text-neutral-400 mx-auto" />
                    <p className="text-sm font-bold text-neutral-700 dark:text-neutral-300">
                      No hay bases de referencia guardadas
                    </p>
                    <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                      Cargue archivos .xlsx, .xls, .gjm o .csv con datos de clientes para conservarlos en Firestore y reutilizarlos en cada captura de cartera.
                    </p>
                  </div>
                ) : (
                  savedRefBases.map((b) => {
                    const isSelected = selectedRefBaseId === b.id;
                    const formattedDate = b.createdAt?.toDate
                      ? format(b.createdAt.toDate(), "dd/MM/yyyy HH:mm")
                      : 'Reciente';

                    return (
                      <div
                        key={b.id}
                        className={cn(
                          "p-4 rounded-2xl border transition-all flex items-center justify-between gap-4",
                          isSelected
                            ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20 shadow-sm"
                            : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800/40 hover:border-neutral-300"
                        )}
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className={cn(
                            "p-2.5 rounded-xl flex-shrink-0",
                            isSelected
                              ? "bg-indigo-600 text-white"
                              : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500"
                          )}>
                            <FileSpreadsheet className="w-5 h-5" />
                          </div>
                          <div className="truncate space-y-0.5">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-bold text-neutral-900 dark:text-neutral-100 truncate">
                                {b.name}
                              </p>
                              {isSelected && (
                                <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold uppercase tracking-wider">
                                  Activa
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-neutral-500 flex items-center gap-3">
                              <span>📊 {b.recordCount.toLocaleString()} registros</span>
                              <span>📅 {formattedDate}</span>
                              {b.userEmail && <span>👤 {b.userEmail}</span>}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          {!isSelected ? (
                            <button
                              onClick={() => handleSelectSavedBase(b.id)}
                              className="px-3 py-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-indigo-100 hover:text-indigo-700 dark:hover:bg-indigo-950 text-neutral-700 dark:text-neutral-300 text-xs font-bold transition-all"
                            >
                              Seleccionar
                            </button>
                          ) : (
                            <span className="px-3 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" /> Seleccionada
                            </span>
                          )}

                          <button
                            onClick={() => handleDeleteRefBase(b.id, b.name)}
                            title="Eliminar de Firestore"
                            className="p-2 rounded-xl text-neutral-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="flex justify-end border-t border-neutral-100 dark:border-neutral-800 pt-3">
                <button
                  onClick={() => setShowRefModal(false)}
                  className="px-5 py-2.5 rounded-xl bg-neutral-200 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 text-xs font-bold hover:bg-neutral-300 dark:hover:bg-neutral-700 transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Equifax VBA Macro Modal */}
      <BuroMacroModal
        isOpen={showMacroModal}
        onClose={() => setShowMacroModal(false)}
        macroCode={macroConfig.macroCode}
        macroName={macroConfig.macroName}
        isActive={macroConfig.isActive}
        saving={savingMacro}
        onSaveMacro={handleSaveMacroConfig}
        sampleRecord={result?.principalRecords?.[0]}
      />
      <SuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        message={successModalMessage}
      />
    </div>
  );
}
