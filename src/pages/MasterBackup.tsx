import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { db } from '../firebase';
import { collection, getDocs, doc, writeBatch, Timestamp } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { cn, isSuperAdminEmail } from '../lib/utils';
import { format } from 'date-fns';
import {
  Database,
  Download,
  Upload,
  ShieldCheck,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Layers,
  Building2,
  Users,
  FileSpreadsheet,
  Lock,
  ArrowRight,
  ShieldAlert,
  Sparkles,
  Check,
  X,
  ChevronRight,
  AlertCircle,
  Clock,
  Loader2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { logAudit, AuditAction } from '../lib/audit';
import { CURRENT_VERSION } from '../lib/changelog';
import { getDefaultEnterpriseUid } from '../lib/enterprise';

interface GlobalStats {
  enterprises: number;
  users: number;
  employees: number;
  checks: number;
  sales: number;
  collections: number;
  portfolioSnapshots: number;
  budgets: number;
  articles: number;
  warehouses: number;
  totalRecords: number;
}

interface EnterpriseSummary {
  id: string;
  name: string;
  email: string;
  role: string;
  recordCount: number;
}

interface ImportPreAudit {
  fileName: string;
  fileSizeFormatted: string;
  exportedAt?: string;
  exportedBy?: string;
  appVersion?: string;
  totalEnterprises: number;
  totalDocuments: number;
  enterprisesBreakdown: { id: string; name: string; count: number }[];
  collectionsBreakdown: { collectionName: string; label: string; count: number }[];
  rawCollections: Record<string, any[]>;
}

export default function MasterBackup() {
  const { user, originalUser, verifyPin } = useAuth();
  const { showToast, showAlert } = useNotification();

  const isSuperAdmin = isSuperAdminEmail(originalUser?.email);

  // States
  const [loadingStats, setLoadingStats] = useState(false);
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [enterprisesList, setEnterprisesList] = useState<EnterpriseSummary[]>([]);

  // Export states
  const [exportPin, setExportPin] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportProgressText, setExportProgressText] = useState('');

  // Import states
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [analyzingFile, setAnalyzingFile] = useState(false);
  const [importPreAudit, setImportPreAudit] = useState<ImportPreAudit | null>(null);
  const [importPin, setImportPin] = useState('');
  const [confirmPhrase, setConfirmPhrase] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState<{
    stageName: string;
    currentCount: number;
    totalCount: number;
    percentage: number;
    collectionName: string;
  } | null>(null);

  const REQUIRED_PHRASE = 'RESTAURAR-SISTEMA-GLOBAL';

  // Master collections to backup and restore
  const MASTER_COLLECTIONS: { key: string; col: string; label: string }[] = [
    { key: 'users', col: 'users', label: 'Usuarios y Empresas' },
    { key: 'employees', col: 'employees', label: 'Empleados y Asesores' },
    { key: 'checks', col: 'checks', label: 'Cheques y Gastos' },
    { key: 'sales', col: 'sales', label: 'Ventas Comerciales' },
    { key: 'collections', col: 'collections', label: 'Cierres de Cobranza' },
    { key: 'portfolio_snapshots', col: 'portfolio_snapshots', label: 'Cortes de Cartera e Historial' },
    { key: 'budgets', col: 'budgets', label: 'Presupuestos Comerciales' },
    { key: 'articles', col: 'articles', label: 'Artículos e Inventario' },
    { key: 'warehouses', col: 'warehouses', label: 'Bodegas' },
    { key: 'warehouse_inventory', col: 'warehouse_inventory', label: 'Stock por Bodega' },
    { key: 'transfers', col: 'transfers', label: 'Transferencias de Inventario' },
    { key: 'loans_returns', col: 'loans_returns', label: 'Préstamos y Devoluciones' },
    { key: 'inventory_sales', col: 'inventory_sales', label: 'Ventas de Bodega' },
    { key: 'invoices', col: 'invoices', label: 'Facturas' },
    { key: 'beneficiaries', col: 'beneficiaries', label: 'Proveedores / Beneficiarios' }
  ];

  useEffect(() => {
    if (isSuperAdmin) {
      loadGlobalStats();
    }
  }, [isSuperAdmin]);

  const loadGlobalStats = async () => {
    setLoadingStats(true);
    try {
      // 1. Fetch users to detect enterprises
      const usersSnap = await getDocs(collection(db, 'users'));
      const allUsers = usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      const enterprises = allUsers.filter(u => u.role === 'enterprise');

      // 2. Fetch all collections in parallel for fast stats
      const [
        empSnap,
        checksSnap,
        salesSnap,
        collsSnap,
        portfolioSnap,
        budgetsSnap,
        articlesSnap,
        warehousesSnap
      ] = await Promise.all([
        getDocs(collection(db, 'employees')),
        getDocs(collection(db, 'checks')),
        getDocs(collection(db, 'sales')),
        getDocs(collection(db, 'collections')),
        getDocs(collection(db, 'portfolio_snapshots')),
        getDocs(collection(db, 'budgets')),
        getDocs(collection(db, 'articles')),
        getDocs(collection(db, 'warehouses'))
      ]);

      const totalDocs =
        usersSnap.size +
        empSnap.size +
        checksSnap.size +
        salesSnap.size +
        collsSnap.size +
        portfolioSnap.size +
        budgetsSnap.size +
        articlesSnap.size +
        warehousesSnap.size;

      setStats({
        enterprises: enterprises.length,
        users: usersSnap.size,
        employees: empSnap.size,
        checks: checksSnap.size,
        sales: salesSnap.size,
        collections: collsSnap.size,
        portfolioSnapshots: portfolioSnap.size,
        budgets: budgetsSnap.size,
        articles: articlesSnap.size,
        warehouses: warehousesSnap.size,
        totalRecords: totalDocs
      });

      // Build enterprise breakdown
      const entBreakdown: EnterpriseSummary[] = enterprises.map(ent => {
        const entChecks = checksSnap.docs.filter(d => (d.data() as any).enterpriseId === ent.id).length;
        const entSales = salesSnap.docs.filter(d => (d.data() as any).enterpriseId === ent.id).length;
        const entColls = collsSnap.docs.filter(d => (d.data() as any).enterpriseId === ent.id).length;
        const entEmps = empSnap.docs.filter(d => (d.data() as any).enterpriseId === ent.id).length;
        const entSnaps = portfolioSnap.docs.filter(d => (d.data() as any).enterpriseId === ent.id).length;
        const total = entChecks + entSales + entColls + entEmps + entSnaps;

        return {
          id: ent.id,
          name: ent.name || ent.displayName || 'Empresa Sin Nombre',
          email: ent.email || '',
          role: ent.role || 'enterprise',
          recordCount: total
        };
      });

      setEnterprisesList(entBreakdown);
    } catch (err: any) {
      console.error('Error cargando estadísticas globales:', err);
      handleFirestoreError(err, OperationType.LIST, 'admin/master-backup');
      showToast('Error al consultar diagnóstico global de la base de datos', 'error');
    } finally {
      setLoadingStats(false);
    }
  };

  const sanitizeData = (obj: any): any => {
    if (obj === null || obj === undefined) return null;
    if (typeof obj !== 'object') return obj;
    if (obj instanceof Date) return obj.toISOString();
    // Convert Firestore Timestamp to ISO string
    if (typeof obj.toDate === 'function') {
      return obj.toDate().toISOString();
    }
    if (Array.isArray(obj)) {
      return obj.map(sanitizeData).filter(item => item !== undefined);
    }
    const res: any = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined) {
        res[k] = sanitizeData(v);
      }
    }
    return res;
  };

  // 1. Export Master Global Backup
  const handleExportMaster = async (outputFormat: 'json' | 'excel') => {
    if (!exportPin || exportPin.length !== 6) {
      showToast('Ingresa el PIN de seguridad de 6 dígitos', 'warning');
      return;
    }

    const isValid = await verifyPin(exportPin);
    if (!isValid) {
      showToast('El PIN de seguridad ingresado es incorrecto', 'error');
      return;
    }

    setExporting(true);
    setExportProgressText('Consultando colecciones maestras...');

    try {
      const backupData: Record<string, any[]> = {};
      const countsMap: Record<string, number> = {};
      let grandTotal = 0;

      for (let i = 0; i < MASTER_COLLECTIONS.length; i++) {
        const item = MASTER_COLLECTIONS[i];
        setExportProgressText(`Extrayendo ${item.label} (${i + 1} de ${MASTER_COLLECTIONS.length})...`);
        const colSnap = await getDocs(collection(db, item.col));
        const records = colSnap.docs.map(docSnap => ({
          id: docSnap.id,
          ...sanitizeData(docSnap.data())
        }));

        backupData[item.key] = records;
        countsMap[item.key] = records.length;
        grandTotal += records.length;
      }

      // Detect enterprises inside exported users
      const allUsers = backupData['users'] || [];
      const enterprises = allUsers.filter((u: any) => u.role === 'enterprise');
      const enterprisesSummary = enterprises.map((ent: any) => ({
        id: ent.id,
        name: ent.name || ent.displayName || 'Empresa Sin Nombre',
        email: ent.email || '',
        role: ent.role || 'enterprise'
      }));

      const dateStr = format(new Date(), 'yyyy-MM-dd_HHmm');

      if (outputFormat === 'json') {
        const masterPayload = {
          metadata: {
            type: 'CONTROL360_MASTER_GLOBAL_BACKUP',
            formatVersion: '2.0',
            appVersion: CURRENT_VERSION,
            createdAt: new Date().toISOString(),
            exportedBy: user?.email || originalUser?.email || 'Superadmin',
            totalEnterprises: enterprises.length,
            enterprisesList: enterprisesSummary,
            totalDocuments: grandTotal,
            countsByCollection: countsMap
          },
          collections: backupData
        };

        const blob = new Blob([JSON.stringify(masterPayload, null, 2)], {
          type: 'application/json;charset=utf-8'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `respaldo_maestro_global_control360_${dateStr}.json`;
        a.click();
        URL.revokeObjectURL(url);

        await logAudit(
          AuditAction.MASTER_BACKUP,
          `Exportación de Respaldo Maestro Global (JSON): ${grandTotal} registros de ${enterprises.length} empresas registradas.`
        );

        showToast(`Respaldo maestro exportado con éxito (${grandTotal} registros)`, 'success');
      } else {
        // Excel multi-sheet export
        setExportProgressText('Generando libro Excel estructurado...');
        const wb = XLSX.utils.book_new();

        // 1. Resumen de Empresas
        const entRows = enterprisesSummary.map((ent: any) => ({
          'ID Empresa': ent.id,
          'Nombre Empresa': ent.name,
          'Correo': ent.email,
          'Rol': ent.role
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(entRows), 'Empresas');

        // 2. Empleados
        const empRows = (backupData['employees'] || []).map((e: any) => ({
          'ID': e.id,
          'ID Empresa': e.enterpriseId || '',
          'Nombre': `${e.name || ''} ${e.lastName || ''}`.trim(),
          'Correo': e.email || '',
          'Rol': e.role || ''
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(empRows), 'Empleados');

        // 3. Cheques
        const checkRows = (backupData['checks'] || []).map((c: any) => ({
          'ID': c.id,
          'ID Empresa': c.enterpriseId || '',
          'Beneficiario': c.beneficiaryName || '',
          '# Cheque': c.checkNumber || '',
          'Concepto': c.concept || '',
          'Monto': c.amount || 0,
          'Fecha Vencimiento': c.dueDate || '',
          'Banco': c.bank || '',
          'Estado': c.status || ''
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(checkRows), 'Cheques');

        // 4. Ventas
        const salesRows = (backupData['sales'] || []).map((s: any) => ({
          'ID': s.id,
          'ID Empresa': s.enterpriseId || '',
          'Fecha': s.date || '',
          'Cliente': s.clientName || '',
          'Tipo': s.type || '',
          'Articulo': s.article || '',
          'Monto': s.totalValue || 0
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(salesRows), 'Ventas');

        // 5. Cobranzas
        const collRows = (backupData['collections'] || []).map((c: any) => ({
          'ID': c.id,
          'ID Empresa': c.enterpriseId || '',
          'Fecha Inicio': c.initialDate || '',
          'Fecha Fin': c.finalDate || '',
          'Total Cobrado': c.totalCollected || 0,
          'Efectivo': c.cashFinal || 0,
          'Depósitos': c.depositsTransfers || 0
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(collRows), 'Cobranzas');

        // 6. Inventario
        const invRows = (backupData['articles'] || []).map((a: any) => ({
          'ID': a.id,
          'ID Empresa': a.enterpriseId || '',
          'Nombre': a.name || '',
          'Categoría': a.category || '',
          'Marca': a.brand || '',
          'Modelo': a.model || '',
          'Código': a.barcode || ''
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(invRows), 'Inventario');

        XLSX.writeFile(wb, `respaldo_maestro_global_control360_${dateStr}.xlsx`);

        await logAudit(
          AuditAction.MASTER_BACKUP,
          `Exportación de Respaldo Maestro Global (Excel): ${grandTotal} registros de ${enterprises.length} empresas registradas.`
        );

        showToast('Respaldo maestro en Excel exportado con éxito', 'success');
      }

      setExportPin('');
    } catch (err: any) {
      console.error('Error exportando respaldo maestro:', err);
      showToast('Ocurrió un error al exportar el respaldo maestro', 'error');
    } finally {
      setExporting(false);
      setExportProgressText('');
    }
  };

  // 2. Select & Parse JSON File for Pre-Audit
  const handleSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.json')) {
      showToast('Por favor selecciona un archivo de respaldo en formato JSON', 'error');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setAnalyzingFile(true);
    const reader = new FileReader();

    reader.onload = async event => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        // Normalize raw collections structure
        let rawCollections: Record<string, any[]> = {};
        let meta: any = null;

        if (parsed.collections && typeof parsed.collections === 'object') {
          rawCollections = parsed.collections;
          meta = parsed.metadata || null;
        } else if (parsed.dbData && typeof parsed.dbData === 'object') {
          rawCollections = parsed.dbData;
        } else if (parsed.data && typeof parsed.data === 'object') {
          rawCollections = parsed.data;
        } else {
          // Standard root object with collections as keys
          rawCollections = parsed;
        }

        // Calculate size in KB/MB
        const sizeKb = file.size / 1024;
        const fileSizeFormatted =
          sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(2)} MB` : `${sizeKb.toFixed(1)} KB`;

        // Extract and map collections
        const collectionsBreakdown: { collectionName: string; label: string; count: number }[] = [];
        let grandTotal = 0;

        for (const item of MASTER_COLLECTIONS) {
          const list = rawCollections[item.key] || rawCollections[item.col] || [];
          if (Array.isArray(list) && list.length > 0) {
            collectionsBreakdown.push({
              collectionName: item.col,
              label: item.label,
              count: list.length
            });
            grandTotal += list.length;
          }
        }

        if (grandTotal === 0) {
          showToast('El archivo JSON no contiene colecciones operativas reconocibles', 'error');
          setImportPreAudit(null);
          return;
        }

        // Extract enterprises map
        const enterpriseCounts: Record<string, number> = {};
        const enterpriseNames: Record<string, string> = {};

        // 1. If users collection is present, detect enterprises and their names
        const usersList = rawCollections['users'] || [];
        if (Array.isArray(usersList)) {
          usersList.forEach((u: any) => {
            if (u.role === 'enterprise' || !u.enterpriseId) {
              enterpriseNames[u.id] = u.name || u.displayName || u.email || 'Empresa';
            }
          });
        }

        // 2. Count records associated with each enterpriseId across all collections
        for (const key of Object.keys(rawCollections)) {
          const list = rawCollections[key];
          if (Array.isArray(list)) {
            list.forEach((item: any) => {
              const entId = item.enterpriseId || (item.role === 'enterprise' ? item.id : 'SIN_EMPRESA');
              enterpriseCounts[entId] = (enterpriseCounts[entId] || 0) + 1;
            });
          }
        }

        const enterprisesBreakdown = Object.entries(enterpriseCounts).map(([entId, count]) => ({
          id: entId,
          name: enterpriseNames[entId] || (entId === 'SIN_EMPRESA' ? 'Registros Base / Sin Empresa' : `Empresa [${entId.slice(0, 8)}...]`),
          count
        }));

        setImportPreAudit({
          fileName: file.name,
          fileSizeFormatted,
          exportedAt: meta?.createdAt,
          exportedBy: meta?.exportedBy,
          appVersion: meta?.appVersion,
          totalEnterprises: enterprisesBreakdown.length,
          totalDocuments: grandTotal,
          enterprisesBreakdown,
          collectionsBreakdown,
          rawCollections
        });

        showToast('Archivo analizado con éxito. Revisa el informe de auditoría previa.', 'success');
      } catch (err: any) {
        console.error('Error analizando archivo JSON:', err);
        showToast('Error al parsear el archivo JSON: ' + (err?.message || 'Estructura inválida'), 'error');
        setImportPreAudit(null);
      } finally {
        setAnalyzingFile(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.onerror = () => {
      showToast('Error al leer el archivo seleccionado', 'error');
      setAnalyzingFile(false);
    };

    reader.readAsText(file);
  };

  // 3. Execute Master Restore with Batched Writes
  const handleExecuteRestore = async () => {
    if (!importPreAudit) {
      showToast('No hay archivo cargado para restaurar', 'error');
      return;
    }

    if (!importPin || importPin.length !== 6) {
      showToast('Por favor ingresa tu PIN de seguridad de 6 dígitos', 'warning');
      return;
    }

    const isValid = await verifyPin(importPin);
    if (!isValid) {
      showToast('El PIN de seguridad de Superadmin es incorrecto', 'error');
      return;
    }

    if (confirmPhrase.trim() !== REQUIRED_PHRASE) {
      showToast(`Debes escribir exactamente la frase de confirmación: ${REQUIRED_PHRASE}`, 'warning');
      return;
    }

    setRestoring(true);

    try {
      const defaultEntId = await getDefaultEnterpriseUid();
      const operations: { docRef: any; data: any; label: string }[] = [];
      const processedDocKeys = new Set<string>();

      // Prepare operations
      for (const item of MASTER_COLLECTIONS) {
        const rawList =
          importPreAudit.rawCollections[item.key] ||
          importPreAudit.rawCollections[item.col] ||
          [];

        if (Array.isArray(rawList)) {
          for (const record of rawList) {
            const docId = record.id || crypto.randomUUID();
            const uniqueKey = `${item.col}_${docId}`;
            if (processedDocKeys.has(uniqueKey)) continue;
            processedDocKeys.add(uniqueKey);

            const docRef = doc(db, item.col, docId);
            const dataToSave = sanitizeData({ ...record });
            delete dataToSave.id;

            // Preserve enterpriseId strictly if already set, or fallback to default
            if (!dataToSave.enterpriseId && item.col !== 'users') {
              dataToSave.enterpriseId = defaultEntId || user?.uid;
            }

            operations.push({
              docRef,
              data: dataToSave,
              label: item.label
            });
          }
        }
      }

      const totalOps = operations.length;
      if (totalOps === 0) {
        showToast('No se encontraron registros válidos para restaurar', 'error');
        setRestoring(false);
        return;
      }

      setRestoreProgress({
        stageName: `Iniciando restauración de ${totalOps} registros...`,
        currentCount: 0,
        totalCount: totalOps,
        percentage: 5,
        collectionName: 'Iniciando lotes'
      });

      // Execute in batches of 250 (Firestore limit is 500)
      const BATCH_SIZE = 250;
      const totalBatches = Math.ceil(totalOps / BATCH_SIZE);

      for (let i = 0; i < totalBatches; i++) {
        const currentBatch = writeBatch(db);
        const chunk = operations.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);

        for (const op of chunk) {
          currentBatch.set(op.docRef, op.data, { merge: true });
        }

        await currentBatch.commit();

        const currentCount = Math.min((i + 1) * BATCH_SIZE, totalOps);
        const percentage = Math.round(5 + (currentCount / totalOps) * 90);
        const currentLabel = chunk[0]?.label || 'Colección';

        setRestoreProgress({
          stageName: `Restaurando ${currentLabel} (${currentCount} de ${totalOps})`,
          currentCount,
          totalCount: totalOps,
          percentage,
          collectionName: currentLabel
        });
      }

      setRestoreProgress({
        stageName: '¡Restauración global completada con éxito!',
        currentCount: totalOps,
        totalCount: totalOps,
        percentage: 100,
        collectionName: 'Finalizado'
      });

      await logAudit(
        AuditAction.DATA_RESTORE,
        `Restauración Maestra Global completada: ${totalOps} documentos restaurados en ${importPreAudit.totalEnterprises} empresas.`
      );

      showToast(`¡Sistema restaurado con éxito! Se sincronizaron ${totalOps} registros.`, 'success');

      // Refresh global statistics
      await loadGlobalStats();

      // Reset state after brief delay
      setTimeout(() => {
        setImportPreAudit(null);
        setImportPin('');
        setConfirmPhrase('');
        setRestoreProgress(null);
      }, 2000);
    } catch (err: any) {
      console.error('Error ejecutando restauración global:', err);
      showToast('Error durante la restauración: ' + (err?.message || 'Error desconocido'), 'error');
    } finally {
      setRestoring(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="max-w-4xl mx-auto p-8 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-3xl text-center space-y-4">
        <ShieldAlert className="w-16 h-16 text-amber-600 mx-auto" />
        <h2 className="text-2xl font-black text-amber-900 dark:text-amber-300">Acceso Exclusivo de Super-Administrador</h2>
        <p className="text-amber-700/80 dark:text-amber-400 text-sm max-w-lg mx-auto">
          El módulo de Respaldo Maestro Global gestiona la totalidad de las bases de datos de todas las empresas registradas. Esta sección está restringida exclusivamente a credenciales maestras autorizadas.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-in fade-in duration-300 pb-20">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-neutral-900 via-indigo-950 to-neutral-900 text-white rounded-[2.5rem] p-8 lg:p-10 shadow-xl border border-neutral-800 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
          <div className="space-y-3 max-w-3xl">
            <div className="flex items-center gap-2">
              <span className="px-3.5 py-1 bg-indigo-500/20 text-indigo-300 text-[10px] font-black uppercase tracking-widest rounded-full border border-indigo-400/30 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-indigo-400" /> Infraestructura & Recuperación ante Desastres
              </span>
              <span className="px-3 py-1 bg-amber-500/20 text-amber-300 text-[10px] font-black uppercase tracking-widest rounded-full border border-amber-400/30">
                Superadmin Only
              </span>
            </div>
            <h1 className="text-3xl lg:text-4xl font-black uppercase tracking-tight">
              Respaldo Maestro Global Multiempresa
            </h1>
            <p className="text-neutral-300 text-sm leading-relaxed">
              Herramienta centralizada para exportar e importar la base de datos íntegra de la plataforma. A diferencia del respaldo de una empresa individual, este módulo respalda <b>todas las empresas registradas</b> y reasigna automáticamente los registros a su respectiva empresa durante la restauración.
            </p>
          </div>

          <button
            onClick={loadGlobalStats}
            disabled={loadingStats}
            className="px-6 py-4 bg-white/10 hover:bg-white/20 text-white font-bold rounded-2xl text-xs uppercase tracking-wider transition-all flex items-center gap-2 shrink-0 border border-white/10"
          >
            <RefreshCw className={cn('w-4 h-4', loadingStats && 'animate-spin')} /> Actualizar Diagnóstico
          </button>
        </div>
      </div>

      {/* Global Diagnostics Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 rounded-3xl p-5 space-y-1 shadow-sm">
          <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5 text-indigo-500" /> Empresas
          </span>
          <p className="text-2xl font-black text-neutral-900 dark:text-neutral-50">
            {loadingStats ? '...' : stats?.enterprises || 0}
          </p>
          <p className="text-[11px] text-neutral-500">Organizaciones registradas</p>
        </div>

        <div className="bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 rounded-3xl p-5 space-y-1 shadow-sm">
          <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest flex items-center gap-1">
            <Users className="w-3.5 h-3.5 text-blue-500" /> Usuarios Totales
          </span>
          <p className="text-2xl font-black text-neutral-900 dark:text-neutral-50">
            {loadingStats ? '...' : stats?.users || 0}
          </p>
          <p className="text-[11px] text-neutral-500">Cuentas y perfiles activos</p>
        </div>

        <div className="bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 rounded-3xl p-5 space-y-1 shadow-sm">
          <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest flex items-center gap-1">
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" /> Cheques & Gastos
          </span>
          <p className="text-2xl font-black text-neutral-900 dark:text-neutral-50">
            {loadingStats ? '...' : stats?.checks || 0}
          </p>
          <p className="text-[11px] text-neutral-500">Comprobantes y egresos</p>
        </div>

        <div className="bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 rounded-3xl p-5 space-y-1 shadow-sm">
          <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-purple-500" /> Cortes Cartera
          </span>
          <p className="text-2xl font-black text-neutral-900 dark:text-neutral-50">
            {loadingStats ? '...' : stats?.portfolioSnapshots || 0}
          </p>
          <p className="text-[11px] text-neutral-500">Instantáneas históricas</p>
        </div>

        <div className="bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 rounded-3xl p-5 space-y-1 shadow-sm col-span-2 sm:col-span-1">
          <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest flex items-center gap-1">
            <Database className="w-3.5 h-3.5 text-amber-500" /> Total Registros
          </span>
          <p className="text-2xl font-black text-neutral-900 dark:text-neutral-50">
            {loadingStats ? '...' : stats?.totalRecords || 0}
          </p>
          <p className="text-[11px] text-neutral-500">Documentos consolidados</p>
        </div>
      </div>

      {/* Main Action Modules: Export & Import */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Module 1: Export Master Backup */}
        <div className="bg-white dark:bg-neutral-900 rounded-[2.5rem] border border-neutral-100 dark:border-neutral-800 p-8 shadow-sm flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-2xl">
                <Download className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Descarga Maestra</span>
                <h2 className="text-xl font-black text-neutral-900 dark:text-neutral-50">Exportar Base Global Completa</h2>
              </div>
            </div>

            <p className="text-neutral-600 dark:text-neutral-400 text-sm leading-relaxed">
              Genera una copia íntegra de seguridad con los datos de todas las empresas registradas: perfiles de usuarios, empleados, cheques, ventas, cobranzas, cartera de clientes, inventarios, bodegas y presupuestos.
            </p>

            <div className="p-4 bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-100 dark:border-neutral-800 rounded-2xl space-y-2">
              <p className="text-xs font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-500" /> Autenticación Requerida
              </p>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                Por motivos de seguridad y auditoría institucional, ingresa tu PIN de Superadmin de 6 dígitos para habilitar la descarga:
              </p>
              <input
                type="password"
                maxLength={6}
                value={exportPin}
                onChange={e => setExportPin(e.target.value.replace(/\D/g, ''))}
                placeholder="PIN de 6 dígitos"
                className="w-full sm:w-48 px-4 py-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl text-center font-mono tracking-widest font-bold text-lg outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="space-y-3">
            {exporting && (
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 rounded-xl flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-indigo-600 animate-spin shrink-0" />
                <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300">{exportProgressText}</p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() => handleExportMaster('json')}
                disabled={exporting || exportPin.length !== 6}
                className="py-4 px-6 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-2xl text-xs uppercase tracking-wider transition-all shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" /> Exportar JSON Maestro
              </button>
              <button
                onClick={() => handleExportMaster('excel')}
                disabled={exporting || exportPin.length !== 6}
                className="py-4 px-6 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-2xl text-xs uppercase tracking-wider transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2"
              >
                <FileSpreadsheet className="w-4 h-4" /> Exportar Excel Global
              </button>
            </div>
          </div>
        </div>

        {/* Module 2: Import & Restore Master Backup */}
        <div className="bg-white dark:bg-neutral-900 rounded-[2.5rem] border border-neutral-100 dark:border-neutral-800 p-8 shadow-sm flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-2xl">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest">Restauración y Migración</span>
                <h2 className="text-xl font-black text-neutral-900 dark:text-neutral-50">Restauración Maestra Global</h2>
              </div>
            </div>

            <p className="text-neutral-600 dark:text-neutral-400 text-sm leading-relaxed">
              Carga un archivo de respaldo JSON global. El sistema auditará y previsualizará las empresas contenidas en el archivo y, tras tu doble confirmación, insertará los datos <b>asignándolos automáticamente a su empresa correspondiente</b>.
            </p>

            <div className="p-4 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-2xl space-y-2">
              <p className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-500" /> Modo de Fusión Segura Inteligente
              </p>
              <p className="text-[11px] text-neutral-600 dark:text-neutral-400">
                La restauración se realiza mediante escritura por lotes <b>(Upsert/Merge)</b>. Preserva las relaciones de los documentos y actualiza los registros sin destruir datos no involucrados.
              </p>
            </div>
          </div>

          <div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleSelectFile}
              accept=".json,application/json"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={analyzingFile || restoring}
              className="w-full py-4 px-6 bg-neutral-900 dark:bg-neutral-800 hover:bg-neutral-800 dark:hover:bg-neutral-700 text-white font-bold rounded-2xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
            >
              {analyzingFile ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Analizando Archivo JSON...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" /> Seleccionar Archivo JSON para Auditar
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Pre-Audit & Confirmation Modal / Panel */}
      {importPreAudit && (
        <div className="bg-white dark:bg-neutral-900 rounded-[2.5rem] border-2 border-indigo-500/30 dark:border-indigo-500/30 p-8 shadow-2xl space-y-8 animate-in slide-in-from-bottom-6 duration-300">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-neutral-100 dark:border-neutral-800 pb-6">
            <div>
              <span className="px-3 py-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-widest rounded-full">
                Paso 1: Auditoría Previa del Archivo
              </span>
              <h2 className="text-2xl font-black text-neutral-900 dark:text-neutral-50 mt-2 flex items-center gap-2">
                <FileSpreadsheet className="w-6 h-6 text-indigo-600" /> {importPreAudit.fileName}
              </h2>
              <p className="text-xs text-neutral-500 mt-1">
                Tamaño: {importPreAudit.fileSizeFormatted} • Versión: {importPreAudit.appVersion || 'Desconocida'} • Fecha de Respaldo: {importPreAudit.exportedAt ? format(new Date(importPreAudit.exportedAt), 'dd/MM/yyyy HH:mm') : 'No especificada'}
              </p>
            </div>

            <button
              onClick={() => setImportPreAudit(null)}
              disabled={restoring}
              className="p-2.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-white rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Breakdown by Detected Enterprises */}
          <div className="space-y-4">
            <h3 className="text-sm font-black text-neutral-900 dark:text-neutral-100 uppercase tracking-wider flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-500" /> Empresas Detectadas en el Respaldo ({importPreAudit.enterprisesBreakdown.length})
            </h3>
            <p className="text-xs text-neutral-500">
              El sistema identificó los siguientes registros organizados por empresa. Cada registro será restaurado y asociado con su empresa correspondiente:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {importPreAudit.enterprisesBreakdown.map((ent, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-100 dark:border-neutral-800 flex justify-between items-center"
                >
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-neutral-800 dark:text-neutral-200">{ent.name}</p>
                    <p className="text-[10px] font-mono text-neutral-400">ID: {ent.id.slice(0, 16)}...</p>
                  </div>
                  <span className="px-2.5 py-1 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-black">
                    {ent.count} regs
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Breakdown by Collections */}
          <div className="space-y-4">
            <h3 className="text-sm font-black text-neutral-900 dark:text-neutral-100 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-500" /> Colecciones y Documentos a Restaurar ({importPreAudit.totalDocuments} en total)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {importPreAudit.collectionsBreakdown.map((col, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-neutral-50/70 dark:bg-neutral-800/30 rounded-xl border border-neutral-100 dark:border-neutral-800 text-center space-y-1"
                >
                  <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">{col.label}</p>
                  <p className="text-lg font-black text-neutral-900 dark:text-neutral-100">{col.count}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Security Verification & Confirmation Form */}
          <div className="p-6 bg-red-50/60 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-3xl space-y-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-sm font-black text-red-900 dark:text-red-300 uppercase tracking-wide">
                  Paso 2: Confirmación Estricta de Seguridad de Super-Administrador
                </h4>
                <p className="text-xs text-red-700/80 dark:text-red-400">
                  Esta acción sincronizará masivamente datos en las bases de datos de todas las empresas detectadas. Para proceder, completa ambas comprobaciones:
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                  1. PIN de Superadmin (6 dígitos)
                </label>
                <input
                  type="password"
                  maxLength={6}
                  value={importPin}
                  disabled={restoring}
                  onChange={e => setImportPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="w-full px-4 py-3 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-xl font-mono text-center tracking-widest font-bold text-lg outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                  2. Escribe la frase exacta: <span className="font-mono text-red-600 font-black">{REQUIRED_PHRASE}</span>
                </label>
                <input
                  type="text"
                  value={confirmPhrase}
                  disabled={restoring}
                  onChange={e => setConfirmPhrase(e.target.value)}
                  placeholder={REQUIRED_PHRASE}
                  className="w-full px-4 py-3 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-xl font-mono tracking-wider font-bold text-sm outline-none focus:ring-2 focus:ring-red-500 uppercase"
                />
              </div>
            </div>

            {/* Progress Bar */}
            {restoreProgress && (
              <div className="space-y-2 p-4 bg-white dark:bg-neutral-900 rounded-2xl border border-indigo-200 dark:border-indigo-800">
                <div className="flex justify-between items-center text-xs font-bold text-neutral-700 dark:text-neutral-300">
                  <span>{restoreProgress.stageName}</span>
                  <span>{restoreProgress.percentage}%</span>
                </div>
                <div className="w-full h-3 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-300"
                    style={{ width: `${restoreProgress.percentage}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row justify-end items-center gap-3 pt-2">
              <button
                onClick={() => setImportPreAudit(null)}
                disabled={restoring}
                className="w-full sm:w-auto px-6 py-3.5 bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-bold rounded-xl text-xs uppercase tracking-wider transition-all hover:bg-neutral-300 dark:hover:bg-neutral-700"
              >
                Cancelar
              </button>
              <button
                onClick={handleExecuteRestore}
                disabled={
                  restoring ||
                  importPin.length !== 6 ||
                  confirmPhrase.trim() !== REQUIRED_PHRASE
                }
                className="w-full sm:w-auto px-8 py-3.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-black rounded-xl text-xs uppercase tracking-wider transition-all shadow-lg shadow-red-600/30 flex items-center justify-center gap-2"
              >
                {restoring ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Restaurando por Lotes...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" /> Confirmar y Ejecutar Restauración Maestra
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enterprises Registered Directory */}
      <div className="bg-white dark:bg-neutral-900 rounded-[2.5rem] border border-neutral-100 dark:border-neutral-800 p-8 shadow-sm space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-50 flex items-center gap-2.5">
              <Building2 className="w-5 h-5 text-indigo-500" /> Directorio de Empresas Registradas ({enterprisesList.length})
            </h2>
            <p className="text-xs text-neutral-500 mt-1">
              Entidades independientes activas con aislamiento de datos en la plataforma.
            </p>
          </div>
          <span className="px-3 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-xs font-bold rounded-full border border-emerald-200 dark:border-emerald-800/40">
            Aislamiento Multi-Tenant Activo
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-neutral-100 dark:border-neutral-800 text-[10px] font-black text-neutral-400 uppercase tracking-widest">
                <th className="py-3 px-4">Empresa / Razón Social</th>
                <th className="py-3 px-4">Correo Vinculado</th>
                <th className="py-3 px-4">ID de Tenant</th>
                <th className="py-3 px-4 text-right">Registros Operativos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50 dark:divide-neutral-800/60 text-xs">
              {enterprisesList.map(ent => (
                <tr key={ent.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/20 transition-all">
                  <td className="py-3.5 px-4 font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-neutral-400" /> {ent.name}
                  </td>
                  <td className="py-3.5 px-4 text-neutral-600 dark:text-neutral-400 font-mono">
                    {ent.email || 'Sin correo'}
                  </td>
                  <td className="py-3.5 px-4 text-neutral-400 font-mono text-[11px]">
                    {ent.id}
                  </td>
                  <td className="py-3.5 px-4 text-right font-bold text-indigo-600 dark:text-indigo-400">
                    {ent.recordCount} documentos
                  </td>
                </tr>
              ))}
              {enterprisesList.length === 0 && !loadingStats && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-neutral-400 italic">
                    No se encontraron empresas registradas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
