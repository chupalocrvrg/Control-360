import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, Timestamp, setDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { logAudit, AuditAction } from '../lib/audit';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { 
  FolderGit2, 
  Upload, 
  Download, 
  Plus, 
  Trash2, 
  Search, 
  Filter, 
  CheckCircle2, 
  AlertTriangle, 
  Users, 
  Calendar, 
  TrendingDown, 
  TrendingUp, 
  FileSpreadsheet, 
  RefreshCw, 
  ArrowRight, 
  PieChart, 
  UserCheck, 
  Layers, 
  FileText,
  Lock,
  Pencil,
  X,
  ShieldCheck,
  Receipt,
  Coins,
  Eye,
  Check,
  MessageCircle,
  Phone,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ShoppingBag,
  MapPin,
  Clock,
  Copy,
  ExternalLink,
  Link,
  UserX,
  CheckCircle,
  Database,
  Sparkles,
  Info,
  DollarSign,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { format, subMonths, addMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import PortfolioExportModal from '../components/portfolio/PortfolioExportModal';
import { 
  PortfolioClient, 
  PortfolioSnapshot, 
  AgingBracket, 
  getAgingBracket, 
  AGING_BRACKETS 
} from '../types/portfolio';
import { Employee } from './Employees';
import { 
  isInvalidClientName, 
  formatEcuadorianPhone, 
  generateWhatsAppMessage, 
  getWhatsAppUrl,
  round2,
  isSupervisorEmployee,
  getRecordKey,
  getFourFactorKey,
  matchFourFactors,
  normalizeText,
  parseDateToISO,
  evaluateMonthlyDue,
  calculateMonthlyCashFlowSummary
} from '../lib/portfolioUtils';
import { PortfolioTransitionAnalysis } from '../components/portfolio/PortfolioTransitionAnalysis';
import { PortfolioCrossAssignmentView } from '../components/portfolio/PortfolioCrossAssignmentView';
import {
  savePortfolioSnapshotToFirestore,
  fetchSnapshotRecords,
  deletePortfolioSnapshotFromFirestore
} from '../lib/portfolioStorage';
import { exportPortfolioClientsToExcel } from '../lib/portfolioExportUtils';

export default function PortfolioManagement() {
  const { user, profile, isSuperAdmin } = useAuth();
  const { showToast, showConfirm } = useNotification();
  const currentEnterpriseId = profile?.enterpriseId || user?.uid;

  // Tabs & Controls
  const [activeTab, setActiveTab] = useState<'ANALISIS' | 'RECUPERADOS' | 'COMPARATIVA' | 'TABLA' | 'HISTORIAL' | 'CRUCE_ASIGNACIONES'>('ANALISIS');
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), 'yyyy-MM'));
  const [selectedCutoffDate, setSelectedCutoffDate] = useState<string>('');
  const [selectedCollectorFilter, setSelectedCollectorFilter] = useState<string>('TODOS');
  const [selectedBracketFilter, setSelectedBracketFilter] = useState<string>('TODOS');
  const [assignmentFilter, setAssignmentFilter] = useState<'TODOS' | 'ASIGNADOS' | 'SIN_ASIGNAR'>('TODOS');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Pagination States for Client Table (10, 25, 50, 100)
  const [pageSize, setPageSize] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Table Sorting States
  const [sortField, setSortField] = useState<'overdueDays' | 'amount' | 'clientName'>('overdueDays');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // WhatsApp Interaction Modal States
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState<boolean>(false);
  const [activeWhatsAppClient, setActiveWhatsAppClient] = useState<PortfolioClient | null>(null);
  const [customWhatsAppPhone, setCustomWhatsAppPhone] = useState<string>('');
  const [customWhatsAppText, setCustomWhatsAppText] = useState<string>('');

  // Data States
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [snapshots, setSnapshots] = useState<PortfolioSnapshot[]>([]);
  const [currentSnapshot, setCurrentSnapshot] = useState<PortfolioSnapshot | null>(null);

  // Supervisor detection & mode: checks both role and cargo/position
  const isSupervisor = useMemo(() => {
    if (isSuperAdmin || profile?.role === 'ADMIN' || profile?.role === 'SUPERADMIN') return true;
    const matchingEmp = employees.find(e => e.userId === user?.uid || (e.email && e.email === user?.email));
    if (matchingEmp && isSupervisorEmployee(matchingEmp)) return true;
    if (profile && isSupervisorEmployee(profile as any)) return true;
    return false;
  }, [isSuperAdmin, profile, employees, user]);

  const [supervisorConsolidatedView, setSupervisorConsolidatedView] = useState<boolean>(true);

  // Dynamic Comparative Range States (Cutoff Dates selected from actual uploaded portfolios)
  const [compareStartDate, setCompareStartDate] = useState<string>('');
  const [compareEndDate, setCompareEndDate] = useState<string>('');

  // Recovery & Collection Analysis Custom Cutoffs (Tab: Análisis de Recaudación y Abonos)
  const [recoveryBaseDate, setRecoveryBaseDate] = useState<string>('');
  const [recoveryTargetDate, setRecoveryTargetDate] = useState<string>('');

  // Modals
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState<boolean>(false);
  const [editingClient, setEditingClient] = useState<PortfolioClient | null>(null);

  // Export Modal State
  const [isPortfolioExportOpen, setIsPortfolioExportOpen] = useState(false);
  const [importMode, setImportMode] = useState<'COLLECTOR' | 'MASTER'>('COLLECTOR');
  const [importAssignmentMode, setImportAssignmentMode] = useState<'GENERAL' | 'COLLECTOR'>('GENERAL');
  const [importSnapshotType, setImportSnapshotType] = useState<'CORTE_INICIAL' | 'CORTE_FINAL' | 'CARGA_GENERAL' | 'CARTERA_MAESTRA'>('CARGA_GENERAL');
  const [importCutoffDate, setImportCutoffDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [importTitle, setImportTitle] = useState<string>('');
  const [selectedCollectorForImport, setSelectedCollectorForImport] = useState<string>('');
  const [previewRecords, setPreviewRecords] = useState<PortfolioClient[]>([]);
  const [importFileName, setImportFileName] = useState<string>('');

  // Manual Client Form
  const [manualForm, setManualForm] = useState<{
    clientName: string;
    identification: string;
    operationNumber: string;
    collectorName: string;
    amount: number;
    overdueDays: number;
    phone: string;
    itemSold: string;
    address: string;
    notes: string;
  }>({
    clientName: '',
    identification: '',
    operationNumber: '',
    collectorName: '',
    amount: 0,
    overdueDays: 0,
    phone: '',
    itemSold: '',
    address: '',
    notes: ''
  });

  useEffect(() => {
    fetchData();
  }, [user, currentEnterpriseId, selectedMonth]);

  const fetchData = async () => {
    if (!user || !currentEnterpriseId) return;
    try {
      setLoading(true);

      // 1. Fetch Employees (Cobradores)
      const qEmp = query(collection(db, 'employees'), where('enterpriseId', '==', currentEnterpriseId));
      const empSnap = await getDocs(qEmp);
      const empList = empSnap.docs.map(d => ({ id: d.id, ...d.data() } as Employee));
      setEmployees(empList);

      // 2. Fetch Portfolio Snapshots for the Enterprise and Month
      const qSnap = query(
        collection(db, 'portfolio_snapshots'),
        where('enterpriseId', '==', currentEnterpriseId)
      );
      const snapSnap = await getDocs(qSnap);
      const allSnaps = snapSnap.docs.map(d => ({ id: d.id, ...d.data() } as PortfolioSnapshot));

      // Sort all snapshots by cutoffDate descending (or month/updatedAt)
      allSnaps.sort((a, b) => {
        const dateA = a.cutoffDate || `${a.month}-01`;
        const dateB = b.cutoffDate || `${b.month}-01`;
        return dateB.localeCompare(dateA);
      });

      setSnapshots(allSnaps);

      // Find snapshot matching current month
      const monthSnaps = allSnaps.filter(s => s.month === selectedMonth);
      if (monthSnaps.length > 0) {
        // If there's a selectedCutoffDate, try to match it
        const matchedSnap = selectedCutoffDate ? monthSnaps.find(s => s.cutoffDate === selectedCutoffDate) : null;
        const chosen = matchedSnap || monthSnaps[0];
        if (chosen) {
          if ((!chosen.records || chosen.records.length === 0) && chosen.totalClients > 0) {
            const records = await fetchSnapshotRecords(chosen);
            chosen.records = records;
          }
          setCurrentSnapshot({ ...chosen });
          if (chosen.cutoffDate) {
            setSelectedCutoffDate(chosen.cutoffDate);
          }
        }
      } else {
        setCurrentSnapshot(null);
        setSelectedCutoffDate('');
      }
    } catch (err: any) {
      console.error('Error fetching portfolio data:', err);
      handleFirestoreError(err, OperationType.LIST, 'portfolio_snapshots');
      showToast('Error al cargar datos de cartera', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Ensure active snapshot records are loaded if stored in chunks
  useEffect(() => {
    if (
      currentSnapshot &&
      currentSnapshot.id &&
      (!currentSnapshot.records || currentSnapshot.records.length === 0) &&
      currentSnapshot.totalClients > 0
    ) {
      let isCancelled = false;
      fetchSnapshotRecords(currentSnapshot).then(records => {
        if (!isCancelled && records.length > 0) {
          setCurrentSnapshot(prev => {
            if (prev && prev.id === currentSnapshot.id) {
              return { ...prev, records };
            }
            return prev;
          });
          setSnapshots(prev => prev.map(s => s.id === currentSnapshot.id ? { ...s, records } : s));
        }
      });
      return () => { isCancelled = true; };
    }
  }, [currentSnapshot?.id]);

  // Ensure comparison & master snapshots have their records loaded if chunked
  useEffect(() => {
    const targetDates = [compareStartDate, compareEndDate, recoveryBaseDate, recoveryTargetDate].filter(Boolean);
    const needed = snapshots.filter(s =>
      (targetDates.includes(s.cutoffDate || '') || s.isMasterPortfolio || s.snapshotType === 'CARTERA_MAESTRA') &&
      (!s.records || s.records.length === 0) &&
      s.totalClients > 0
    );

    if (needed.length > 0) {
      let isCancelled = false;
      Promise.all(needed.map(async s => {
        const records = await fetchSnapshotRecords(s);
        return { id: s.id || '', records };
      })).then(results => {
        if (!isCancelled && results.some(r => r.records.length > 0)) {
          const map = new Map<string, PortfolioClient[]>();
          results.forEach(r => {
            if (r.id) map.set(r.id, r.records);
          });
          setSnapshots(prev => prev.map(s => {
            const loaded = s.id ? map.get(s.id) : undefined;
            return (loaded && loaded.length > 0) ? { ...s, records: loaded } : s;
          }));
        }
      });
      return () => { isCancelled = true; };
    }
  }, [snapshots, compareStartDate, compareEndDate, recoveryBaseDate, recoveryTargetDate]);

  // Extract list of registered collectors for the enterprise (only real operational collectors, excluding supervisors)
  const registeredCollectors = useMemo(() => {
    const set = new Set<string>();

    // Add employees registered as cobrador or ambos, STRICTLY excluding supervisors by role or position
    employees.forEach(e => {
      if (isSupervisorEmployee(e)) return;

      if (['cobrador', 'ambos'].includes(e.role)) {
        const fullName = `${e.name || ''} ${e.lastName || ''}`.trim();
        if (fullName) set.add(fullName);
      }
    });

    // If no employee has a specific collector role, fallback to non-supervisor registered employees
    if (set.size === 0 && employees.length > 0) {
      employees.forEach(e => {
        if (!isSupervisorEmployee(e)) {
          const fullName = `${e.name || ''} ${e.lastName || ''}`.trim();
          if (fullName) set.add(fullName);
        }
      });
    }

    return Array.from(set).sort();
  }, [employees]);

  // Collectors for table filtering: registered collectors plus any other collector present in current records
  const availableFilterCollectors = useMemo(() => {
    const set = new Set<string>(registeredCollectors);
    if (currentSnapshot?.records) {
      currentSnapshot.records.forEach(r => {
        if (r.collectorName) set.add(r.collectorName);
      });
    }
    return Array.from(set).sort();
  }, [registeredCollectors, currentSnapshot]);

  // Download Sample Excel Template matching user format
  const handleDownloadTemplate = () => {
    const sampleCol1 = registeredCollectors[0] || 'Cobrador 1';
    const sampleCol2 = registeredCollectors[1] || registeredCollectors[0] || 'Cobrador 2';

    const sampleData = [
      {
        'Fecha Venta': '2024-01-15',
        'Cliente': 'Ana Lucía Morales',
        'Dirección': 'Av. Amazonas y Colón, Quito',
        'Entrada Pendiente': 0,
        'Articulo': 'Refrigeradora Indurama 14P',
        'Teléfono': '0987654321',
        'Valor Venta': 850.00,
        'Abonos': 450.00,
        'Saldo': 400.00,
        'U.Pago': '2024-02-15',
        'Valor U. Pago': 75.00,
        'Valor Cuota': 75.00,
        'Cuo': 3,
        'Días Mora': 0,
        'Valor Total Atraso': 75.00
      },
      {
        'Fecha Venta': '2024-01-10',
        'Cliente': 'Juan Carlos Pérez',
        'Dirección': 'Cdla. Martha de Roldós Mz 12',
        'Entrada Pendiente': 0,
        'Articulo': 'Smart TV Samsung 55 UHD',
        'Teléfono': '0991234567',
        'Valor Venta': 980.00,
        'Abonos': 300.00,
        'Saldo': 680.00,
        'U.Pago': '2024-02-01',
        'Valor U. Pago': 80.00,
        'Valor Cuota': 80.00,
        'Cuo': 4,
        'Días Mora': 18,
        'Valor Total Atraso': 160.00
      },
      {
        'Fecha Venta': '2023-11-20',
        'Cliente': 'Comercial López S.A.',
        'Dirección': 'Av. 9 de Octubre 415, Guayaquil',
        'Entrada Pendiente': 0,
        'Articulo': 'Cocina Haceb 4 Hornillas',
        'Teléfono': '0984567890',
        'Valor Venta': 620.00,
        'Abonos': 120.00,
        'Saldo': 500.00,
        'U.Pago': '2023-12-20',
        'Valor U. Pago': 60.00,
        'Valor Cuota': 60.00,
        'Cuo': 5,
        'Días Mora': 45,
        'Valor Total Atraso': 180.00
      },
      {
        'Fecha Venta': '2023-09-05',
        'Cliente': 'María Belén Torres',
        'Dirección': 'Calle Larga y Benigno Malo, Cuenca',
        'Entrada Pendiente': 0,
        'Articulo': 'Lavadora Mabe 19KG',
        'Teléfono': '0979876543',
        'Valor Venta': 1150.00,
        'Abonos': 250.00,
        'Saldo': 900.00,
        'U.Pago': '2023-11-05',
        'Valor U. Pago': 95.00,
        'Valor Cuota': 95.00,
        'Cuo': 6,
        'Días Mora': 85,
        'Valor Total Atraso': 285.00
      },
      {
        'Fecha Venta': '2023-06-12',
        'Cliente': 'Carlos Alfredo Mendoza',
        'Dirección': 'Av. Los Chillos Lote 5, Sangolquí',
        'Entrada Pendiente': 50.00,
        'Articulo': 'Motocicleta Daytona 150cc',
        'Teléfono': '0961122334',
        'Valor Venta': 2400.00,
        'Abonos': 400.00,
        'Saldo': 2000.00,
        'U.Pago': '2023-09-12',
        'Valor U. Pago': 120.00,
        'Valor Cuota': 120.00,
        'Cuo': 8,
        'Días Mora': 140,
        'Valor Total Atraso': 720.00
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    
    // Auto-width for columns
    worksheet['!cols'] = [
      { wch: 14 }, // Fecha Venta
      { wch: 28 }, // Cliente
      { wch: 32 }, // Dirección
      { wch: 18 }, // Entrada Pendiente
      { wch: 26 }, // Articulo
      { wch: 16 }, // Teléfono
      { wch: 14 }, // Valor Venta
      { wch: 12 }, // Abonos
      { wch: 12 }, // Saldo
      { wch: 14 }, // U.Pago
      { wch: 16 }, // Valor U. Pago
      { wch: 14 }, // Valor Cuota
      { wch: 8 },  // Cuo
      { wch: 12 }, // Días Mora
      { wch: 18 }  // Valor Total Atraso
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Plantilla Cartera');
    XLSX.writeFile(workbook, 'Plantilla_Carga_Cartera_Clientes.xlsx');
    showToast('Plantilla Excel descargada exitosamente', 'success');
  };

  // Parse Excel File on Import
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (importAssignmentMode === 'COLLECTOR' && !selectedCollectorForImport) {
      showToast('Por favor, selecciona primero un cobrador para asignar la cartera o elige Cartera General', 'error');
      e.target.value = ''; // Reset input
      return;
    }

    setImportFileName(file.name);
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const bstr = event.target?.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to raw rows to find the headers dynamically
        const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
        
        let headerRowIndex = -1;
        for (let i = 0; i < Math.min(rawRows.length, 30); i++) {
          const row = rawRows[i];
          if (!Array.isArray(row)) continue;
          const rowText = row.map((cell: any) => String(cell).toLowerCase().trim()).join(' ');
          // Check for signature column headers
          if (rowText.includes('cliente') && (
            rowText.includes('saldo') || 
            rowText.includes('días mora') || 
            rowText.includes('dias mora') || 
            rowText.includes('atraso') || 
            rowText.includes('valor total atraso') || 
            rowText.includes('abonos') ||
            rowText.includes('cuota')
          )) {
            headerRowIndex = i;
            break;
          }
        }

        if (headerRowIndex === -1) {
          showToast('No se encontró la fila de encabezados (Cliente, Saldo / Mora) en el archivo', 'error');
          return;
        }

        // Re-read with the correct header row
        const dataJson: any[] = XLSX.utils.sheet_to_json(worksheet, { 
          range: headerRowIndex,
          defval: '' 
        });

        const parsedRecords: PortfolioClient[] = [];

        dataJson.forEach((row, index) => {
          const keys = Object.keys(row);
          const findVal = (terms: string[]) => {
            const key = keys.find(k => {
              const cleanK = k.toLowerCase().trim();
              return terms.some(t => cleanK === t.toLowerCase().trim());
            });
            return key ? row[key] : '';
          };

          // Client name identification
          const clientName = String(findVal(['cliente', 'nombre', 'nombres', 'razon social', 'razón social']) || '').trim();
          
          // Strict filtering: discard empty rows, total rows, and repetitive header tokens
          if (!clientName || isInvalidClientName(clientName)) return;

          // Days of mora (overdue days)
          const rawDays = findVal(['días mora', 'dias mora', 'mora', 'atraso', 'días de atraso', 'dias atraso']);
          const overdueDays = typeof rawDays === 'number' 
            ? Math.max(0, Math.floor(rawDays)) 
            : Math.max(0, parseInt(String(rawDays).replace(/[^0-9-]+/g, ''), 10) || 0);

          // Overdue / Portfolio Amount calculation
          // Priority: If "Saldo" (capital balance) is present, use it consistently across cuts
          // Otherwise, use "Valor Total Atraso" (overdue debt).
          const rawSaldo = findVal(['saldo', 'saldo capital', 'saldo adeudado', 'saldo pendiente', 'capital']);
          const rawOverdueVal = findVal(['valor total atraso', 'total atraso', 'atraso total', 'valor atraso', 'total mora']);
          const rawCuota = findVal(['valor cuota', 'cuota', 'cuo']);

          const overdueAmount = round2(typeof rawOverdueVal === 'number' ? rawOverdueVal : parseFloat(String(rawOverdueVal).replace(/[^0-9.-]+/g, '')) || 0);

          let amount = 0;
          if (rawSaldo !== '' && rawSaldo !== null && rawSaldo !== undefined) {
            const parsedSaldo = typeof rawSaldo === 'number' ? rawSaldo : parseFloat(String(rawSaldo).replace(/[^0-9.-]+/g, '')) || 0;
            if (parsedSaldo > 0) {
              amount = round2(parsedSaldo);
            }
          }

          if (amount === 0 && overdueAmount > 0) {
            amount = overdueAmount;
          }

          if (amount === 0 && rawCuota !== '' && rawCuota !== null && rawCuota !== undefined) {
            amount = round2(typeof rawCuota === 'number' ? rawCuota : parseFloat(String(rawCuota).replace(/[^0-9.-]+/g, '')) || 0);
          }

          // Specific columns provided by the user
          const phone = String(findVal(['teléfono', 'telefono', 'celular', 'telf', 'movil', 'cel']) || '').trim();
          const itemSold = String(findVal(['articulo', 'artículo', 'item', 'producto', 'bien', 'descripcion']) || '').trim();
          const address = String(findVal(['dirección', 'direccion', 'domicilio', 'ubicacion']) || '').trim();
          
          const rawSaleDate = findVal(['fecha venta', 'f. venta', 'f.venta', 'fecha de venta', 'fecha']);
          const saleDate = parseDateToISO(rawSaleDate) || String(rawSaleDate || '').trim();

          const rawLastPaymentDate = findVal(['u.pago', 'u. pago', 'u pago', 'ultimo pago', 'último pago', 'f. u. pago', 'fecha ultimo pago']);
          const lastPaymentDate = parseDateToISO(rawLastPaymentDate) || String(rawLastPaymentDate || '').trim();
          
          const rawLastPaymentAmount = findVal(['valor u. pago', 'valor u pago', 'valor ultimo pago', 'valor último pago']);
          const lastPaymentAmount = round2(typeof rawLastPaymentAmount === 'number' ? rawLastPaymentAmount : parseFloat(String(rawLastPaymentAmount).replace(/[^0-9.-]+/g, '')) || 0);
          
          const rawInstallment = findVal(['valor cuota', 'cuota']);
          const installmentAmount = round2(typeof rawInstallment === 'number' ? rawInstallment : parseFloat(String(rawInstallment).replace(/[^0-9.-]+/g, '')) || 0);

          const rawPendingDownPayment = findVal(['entrada pendiente', 'saldo entrada', 'entrada']);
          const pendingDownPayment = round2(typeof rawPendingDownPayment === 'number' ? rawPendingDownPayment : parseFloat(String(rawPendingDownPayment).replace(/[^0-9.-]+/g, '')) || 0);

          const rawTotalPayments = findVal(['abonos', 'total abonos', 'abonado', 'abono acumulado']);
          const totalPayments = round2(typeof rawTotalPayments === 'number' ? rawTotalPayments : parseFloat(String(rawTotalPayments).replace(/[^0-9.-]+/g, '')) || 0);

          const rawSaleValue = findVal(['valor venta', 'total venta', 'precio', 'precio venta', 'v. venta', 'valor total venta']);
          const saleValue = round2(typeof rawSaleValue === 'number' ? rawSaleValue : parseFloat(String(rawSaleValue).replace(/[^0-9.-]+/g, '')) || 0);

          const installmentNumber = String(findVal(['cuo', 'nro cuota', 'numero cuota', 'cuotas']) || '').trim();

          // Identification (Cédula o RUC)
          const identification = String(findVal(['cédula', 'cedula', 'ruc', 'identificación', 'identificacion', 'ci', 'dni', 'id']) || '').trim();

          // N° Operación (Only real operation numbers, otherwise empty to trigger 4-factor fingerprint)
          const rawOp = findVal(['n° operación', 'no operacion', 'no. operacion', 'operación', 'operacion', 'nro operacion', 'factura', 'n° factura', 'no factura', 'contrato', 'credito', 'referencia', 'n° credito']);
          const operationNumber = String(rawOp || '').trim();

          const combinedNotes = [
            itemSold ? `Art: ${itemSold}` : '',
            phone ? `Tel: ${phone}` : '',
            address ? `Dir: ${address}` : '',
            lastPaymentDate ? `Últ. Pago: ${lastPaymentDate}` : ''
          ].filter(Boolean).join(' | ');

          const bracket = getAgingBracket(overdueDays);

          const rawCobrador = findVal(['cobrador', 'gestor', 'agente', 'responsable', 'ruta']);
          const rowCobrador = String(rawCobrador || '').trim();
          const finalCollectorName = selectedCollectorForImport || rowCobrador || 'Sin Asignar / En Oficina';
          const isUnassignedClient = !finalCollectorName || finalCollectorName.toLowerCase().includes('sin asignar') || finalCollectorName.toLowerCase().includes('oficina');

          if (clientName && !isNaN(amount)) {
            parsedRecords.push({
              id: `record_${Date.now()}_${index}`,
              clientName,
              identification,
              operationNumber,
              collectorName: finalCollectorName,
              isUnassigned: isUnassignedClient,
              amount,
              overdueDays,
              overdueAmount,
              bracket,
              phone,
              itemSold,
              address,
              saleDate,
              lastPaymentDate,
              lastPaymentAmount,
              installmentAmount,
              pendingDownPayment,
              totalPayments,
              saleValue,
              installmentNumber,
              notes: combinedNotes
            });
          }
        });

        if (parsedRecords.length === 0) {
          showToast('No se pudieron extraer registros válidos del archivo. Verifique que contenga datos de clientes.', 'error');
          return;
        }

        setPreviewRecords(parsedRecords);
        showToast(
          `Se leyeron exitosamente ${parsedRecords.length} registros ${selectedCollectorForImport ? `para ${selectedCollectorForImport}` : 'de Cartera General / Multi-Cobrador'}`,
          'success'
        );
      } catch (err) {
        console.error('Error parsing Excel:', err);
        showToast('Error al procesar el archivo Excel. Verifique el formato.', 'error');
      }
    };

    reader.readAsBinaryString(file);
  };

  // Find previous snapshot strictly before importCutoffDate
  const previousSnapshotForImport = useMemo(() => {
    const prior = snapshots.filter(s => {
      const sDate = s.cutoffDate || `${s.month}-01`;
      return sDate < importCutoffDate;
    });
    prior.sort((a, b) => {
      const dateA = a.cutoffDate || `${a.month}-01`;
      const dateB = b.cutoffDate || `${b.month}-01`;
      return dateB.localeCompare(dateA);
    });
    return prior[0] || null;
  }, [snapshots, importCutoffDate]);

  // Preview Comparison against Previous Snapshot
  const importComparison = useMemo(() => {
    if (previewRecords.length === 0) return null;

    // Previous records for this collector (or all if no collector specified)
    const prevCollectorRecords = previousSnapshotForImport
      ? previousSnapshotForImport.records.filter(r => !selectedCollectorForImport || r.collectorName === selectedCollectorForImport)
      : [];

    const prevMap = new Map<string, PortfolioClient>();
    prevCollectorRecords.forEach(r => {
      prevMap.set(getRecordKey(r), r);
    });

    const currentKeys = new Set<string>();
    let updatedCount = 0;
    let updatedAmount = 0;
    const newClientsList: PortfolioClient[] = [];
    let newAmount = 0;

    previewRecords.forEach(r => {
      const key = getRecordKey(r);
      currentKeys.add(key);
      if (prevMap.has(key)) {
        updatedCount++;
        updatedAmount += r.amount;
      } else {
        newClientsList.push(r);
        newAmount += r.amount;
      }
    });

    const recoveredList: PortfolioClient[] = [];
    let recoveredAmount = 0;

    // Master Portfolio lookup (to prevent false liquidations for clients who paid current dues and went to 0 days)
    const masterSnap = snapshots.find(s => 
      s.snapshotType === 'CARTERA_MAESTRA' || 
      s.isMasterPortfolio || 
      (s.cutoffDate && s.cutoffDate >= '2026-12-01') ||
      s.title?.toLowerCase().includes('maestra')
    );
    const masterMap = new Map<string, PortfolioClient>();
    if (masterSnap) {
      (masterSnap.records || []).forEach(r => masterMap.set(getRecordKey(r), r));
    }

    // Fast lookup for current records
    const currentRecordsMap = new Map<string, PortfolioClient>();
    previewRecords.forEach(r => currentRecordsMap.set(getRecordKey(r), r));

    const prevCutoff = previousSnapshotForImport?.cutoffDate || `${previousSnapshotForImport?.month || ''}-01`;

    prevMap.forEach((prevRecord, key) => {
      if (!currentKeys.has(key)) {
        const masterR = masterMap.get(key);
        if (masterR && masterR.amount > 0) {
          // El cliente pagó cuotas atrasadas, salió de mora pero continúa debiendo saldo en Cartera Maestra
          const debtDelta = round2(prevRecord.amount - masterR.amount);
          const effectivePaid = debtDelta > 0 
            ? debtDelta 
            : (prevRecord.overdueAmount && prevRecord.overdueAmount > 0 ? prevRecord.overdueAmount : (prevRecord.lastPaymentAmount || prevRecord.installmentAmount || 0));

          recoveredList.push({
            ...prevRecord,
            isPartialPayment: true,
            recoveredStatus: 'AL_DIA',
            amount: effectivePaid,
            previousAmount: prevRecord.amount,
            previousOverdueDays: prevRecord.overdueDays,
            previousOverdueAmount: prevRecord.overdueAmount || 0,
            overdueDays: 0,
            overdueAmount: 0,
            notes: `Puesto Al Día (Salió de mora en reporte diario - Saldo capital activo en Cartera Maestra: $${masterR.amount.toFixed(2)})`
          });
          recoveredAmount += effectivePaid;
        } else {
          // Liquidación Total Real (no figura en corte actual ni en Cartera Maestra)
          recoveredList.push({
            ...prevRecord,
            isPartialPayment: false,
            recoveredStatus: 'LIQUIDACION_TOTAL',
            previousAmount: prevRecord.amount,
            previousOverdueDays: prevRecord.overdueDays,
            previousOverdueAmount: prevRecord.overdueAmount || 0,
            overdueDays: 0,
            overdueAmount: 0,
            notes: `Liquidación Total Real (Canceló saldo capital anterior de $${prevRecord.amount.toFixed(2)})`
          });
          recoveredAmount += prevRecord.amount;
        }
      } else {
        // Sigue en la lista: verificar si realizó abono real (saldo capital disminuyó y pago dentro del rango)
        const currRecord = currentRecordsMap.get(key);
        if (currRecord) {
          const debtDecreased = currRecord.amount < prevRecord.amount;
          if (debtDecreased) {
            const abonoFromDelta = round2(prevRecord.amount - currRecord.amount);
            const rawPaymentDate = currRecord.lastPaymentDate || '';
            const paymentDateISO = parseDateToISO(rawPaymentDate) || rawPaymentDate;

            const isDateInRange = paymentDateISO && prevCutoff
              ? (paymentDateISO >= prevCutoff && paymentDateISO <= importCutoffDate)
              : false;

            if (isDateInRange && abonoFromDelta > 0) {
              recoveredList.push({
                ...currRecord,
                amount: abonoFromDelta,
                isPartialPayment: true,
                recoveredStatus: 'ABONO_PARCIAL',
                previousAmount: prevRecord.amount,
                previousOverdueDays: prevRecord.overdueDays,
                previousOverdueAmount: prevRecord.overdueAmount || 0,
                notes: `Abono Parcial Registrado (Saldo Capital: $${prevRecord.amount.toFixed(2)} → $${currRecord.amount.toFixed(2)} | Abono: $${abonoFromDelta.toFixed(2)}${rawPaymentDate ? ` | U.Pago: ${rawPaymentDate}` : ''})`
              });
              recoveredAmount += abonoFromDelta;
            }
          }
        }
      }
    });

    return {
      totalInFile: previewRecords.length,
      totalAmount: previewRecords.reduce((acc, r) => acc + r.amount, 0),
      updatedCount,
      updatedAmount,
      newCount: newClientsList.length,
      newAmount,
      newClientsList,
      recoveredCount: recoveredList.length,
      recoveredAmount,
      recoveredList,
      previousCutoffDate: previousSnapshotForImport?.cutoffDate || previousSnapshotForImport?.month || null
    };
  }, [previewRecords, previousSnapshotForImport, selectedCollectorForImport]);

  // Helper to strip or nullify undefined values so Firestore never rejects the document
  const sanitizeForFirestore = (obj: any): any => {
    if (obj === undefined) return null;
    if (obj === null || typeof obj !== 'object') return obj;
    // Keep Timestamp or Date instances intact
    if (obj instanceof Date || obj?.toMillis !== undefined || obj?.seconds !== undefined) {
      return obj;
    }
    if (Array.isArray(obj)) {
      return obj.map(item => sanitizeForFirestore(item));
    }
    const clean: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value === undefined) {
        clean[key] = null;
      } else if (value !== null && typeof value === 'object' && !(value instanceof Date) && (value as any)?.toMillis === undefined && (value as any)?.seconds === undefined) {
        clean[key] = sanitizeForFirestore(value);
      } else {
        clean[key] = value;
      }
    }
    return clean;
  };

  // Helper: Build Snapshot Object from Records List
  const buildSnapshotFromRecords = (
    recordsList: PortfolioClient[], 
    type: 'CORTE_INICIAL' | 'CORTE_FINAL' | 'CARGA_GENERAL' | 'CARTERA_MAESTRA',
    customTitle?: string,
    cutoffDateVal?: string,
    recoveredClients?: PortfolioClient[],
    recoveredAmount?: number,
    recoveredCount?: number,
    newClients?: PortfolioClient[],
    newAmount?: number,
    newCount?: number,
    previousSnapshotId?: string | null
  ): PortfolioSnapshot => {
    let totalClients = recordsList.length;
    let totalAmount = 0;

    const bracketSummary: Record<AgingBracket, { count: number; totalAmount: number }> = {
      '0': { count: 0, totalAmount: 0 },
      '1-30': { count: 0, totalAmount: 0 },
      '31-60': { count: 0, totalAmount: 0 },
      '61-90': { count: 0, totalAmount: 0 },
      '91-180': { count: 0, totalAmount: 0 },
      '>181': { count: 0, totalAmount: 0 },
      '0-30': { count: 0, totalAmount: 0 }
    };

    const collectorSummary: Record<string, any> = {};

    recordsList.forEach(r => {
      const cleanAmount = round2(r.amount);
      totalAmount = round2(totalAmount + cleanAmount);

      // Update Bracket Summary
      const bracketKey = r.bracket || getAgingBracket(r.overdueDays);
      if (bracketSummary[bracketKey]) {
        bracketSummary[bracketKey].count += 1;
        bracketSummary[bracketKey].totalAmount = round2(bracketSummary[bracketKey].totalAmount + cleanAmount);
      }

      // Update Collector Summary
      const colKey = r.collectorName || 'Sin Asignar';
      if (!collectorSummary[colKey]) {
        collectorSummary[colKey] = {
          collectorName: colKey,
          totalClients: 0,
          totalAmount: 0,
          brackets: {
            '0': { count: 0, totalAmount: 0 },
            '1-30': { count: 0, totalAmount: 0 },
            '31-60': { count: 0, totalAmount: 0 },
            '61-90': { count: 0, totalAmount: 0 },
            '91-180': { count: 0, totalAmount: 0 },
            '>181': { count: 0, totalAmount: 0 },
            '0-30': { count: 0, totalAmount: 0 }
          }
        };
      }

      collectorSummary[colKey].totalClients += 1;
      collectorSummary[colKey].totalAmount = round2(collectorSummary[colKey].totalAmount + cleanAmount);
      if (collectorSummary[colKey].brackets[bracketKey]) {
        collectorSummary[colKey].brackets[bracketKey].count += 1;
        collectorSummary[colKey].brackets[bracketKey].totalAmount = round2(collectorSummary[colKey].brackets[bracketKey].totalAmount + cleanAmount);
      }
    });

    const targetCutoff = cutoffDateVal || importCutoffDate || format(new Date(), 'yyyy-MM-dd');
    const targetMonth = targetCutoff.substring(0, 7);

    const title = customTitle || (
      type === 'CORTE_INICIAL' ? `Corte Inicial - ${targetCutoff}` :
      type === 'CORTE_FINAL' ? `Corte de Cierre - ${targetCutoff}` :
      `Corte de Cartera - ${targetCutoff}`
    );

    return {
      enterpriseId: currentEnterpriseId || '',
      month: targetMonth,
      cutoffDate: targetCutoff,
      snapshotType: type,
      isMasterPortfolio: type === 'CARTERA_MAESTRA' || Boolean(title?.toLowerCase().includes('maestra')),
      title,
      records: recordsList.map(r => ({
        id: r.id || '',
        clientName: r.clientName || '',
        identification: r.identification || '',
        operationNumber: r.operationNumber || '',
        collectorName: r.collectorName || 'Sin Asignar',
        isUnassigned: Boolean(r.isUnassigned || !r.collectorName || r.collectorName.toLowerCase().includes('sin asignar') || r.collectorName.toLowerCase().includes('oficina')),
        recoveredStatus: r.recoveredStatus,
        amount: round2(r.amount),
        overdueDays: Number(r.overdueDays) || 0,
        bracket: r.bracket || getAgingBracket(Number(r.overdueDays) || 0),
        phone: r.phone || '',
        itemSold: r.itemSold || '',
        address: r.address || '',
        saleDate: r.saleDate || '',
        lastPaymentDate: r.lastPaymentDate || '',
        lastPaymentAmount: round2(r.lastPaymentAmount),
        installmentAmount: round2(r.installmentAmount),
        pendingDownPayment: round2(r.pendingDownPayment),
        totalPayments: round2(r.totalPayments),
        saleValue: round2(r.saleValue),
        installmentNumber: r.installmentNumber || '',
        notes: r.notes || ''
      })),
      totalClients,
      totalAmount: round2(totalAmount),
      bracketSummary,
      collectorSummary,
      recoveredClients: (recoveredClients || []).map(r => ({
        id: r.id || '',
        clientName: r.clientName || '',
        identification: r.identification || '',
        operationNumber: r.operationNumber || '',
        collectorName: r.collectorName || 'Sin Asignar',
        isUnassigned: Boolean(r.isUnassigned || !r.collectorName || r.collectorName.toLowerCase().includes('sin asignar') || r.collectorName.toLowerCase().includes('oficina')),
        recoveredStatus: r.recoveredStatus,
        amount: round2(r.amount),
        overdueDays: Number(r.overdueDays) || 0,
        bracket: r.bracket || getAgingBracket(Number(r.overdueDays) || 0),
        phone: r.phone || '',
        itemSold: r.itemSold || '',
        address: r.address || '',
        saleDate: r.saleDate || '',
        lastPaymentDate: r.lastPaymentDate || '',
        lastPaymentAmount: round2(r.lastPaymentAmount),
        installmentAmount: round2(r.installmentAmount),
        pendingDownPayment: round2(r.pendingDownPayment),
        totalPayments: round2(r.totalPayments),
        saleValue: round2(r.saleValue),
        installmentNumber: r.installmentNumber || '',
        previousAmount: r.previousAmount !== undefined ? round2(r.previousAmount) : undefined,
        previousOverdueDays: r.previousOverdueDays !== undefined ? Number(r.previousOverdueDays) : undefined,
        isPartialPayment: Boolean(r.isPartialPayment || r.notes?.toLowerCase().includes('abono parcial') || r.recoveredStatus === 'ABONO_PARCIAL' || r.recoveredStatus === 'AL_DIA'),
        notes: r.notes || ''
      })),
      recoveredAmount: round2(recoveredAmount),
      recoveredCount: Number(recoveredCount) || (recoveredClients ? recoveredClients.length : 0),
      newClients: (newClients || []).map(r => ({
        id: r.id || '',
        clientName: r.clientName || '',
        identification: r.identification || '',
        operationNumber: r.operationNumber || '',
        collectorName: r.collectorName || 'Sin Asignar',
        amount: Number(r.amount) || 0,
        overdueDays: Number(r.overdueDays) || 0,
        bracket: r.bracket || getAgingBracket(Number(r.overdueDays) || 0),
        phone: r.phone || '',
        itemSold: r.itemSold || '',
        address: r.address || '',
        saleDate: r.saleDate || '',
        lastPaymentDate: r.lastPaymentDate || '',
        lastPaymentAmount: Number(r.lastPaymentAmount) || 0,
        installmentAmount: Number(r.installmentAmount) || 0,
        notes: r.notes || ''
      })),
      newAmount: Number(newAmount) || 0,
      newCount: Number(newCount) || (newClients ? newClients.length : 0),
      previousSnapshotId: previousSnapshotId || null,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };
  };

  // Confirm Import & Save to Firestore
  const handleConfirmImport = async () => {
    if (previewRecords.length === 0) {
      showToast('No hay registros cargados para guardar', 'error');
      return;
    }

    try {
      setSaving(true);
      
      const targetCutoff = importCutoffDate || format(new Date(), 'yyyy-MM-dd');
      const targetMonth = targetCutoff.substring(0, 7);

      // Check if a snapshot already exists for this exact cutoff date
      const existingSnapshotForDate = snapshots.find(s => s.cutoffDate === targetCutoff) ||
        (currentSnapshot?.cutoffDate === targetCutoff ? currentSnapshot : null);

      let finalRecordsList: PortfolioClient[] = [];
      let mergedRecoveredClients: PortfolioClient[] = [];

      if (existingSnapshotForDate) {
        if ((!existingSnapshotForDate.records || existingSnapshotForDate.records.length === 0) && existingSnapshotForDate.totalClients > 0) {
          existingSnapshotForDate.records = await fetchSnapshotRecords(existingSnapshotForDate);
        }
        if (selectedCollectorForImport) {
          // 4-FACTOR MATCH & REASSIGN LOGIC:
          // When importing a specific collector portfolio into an existing snapshot (e.g. Master Portfolio or General Portfolio cut),
          // we match against existing records using the 4-factor digital fingerprint:
          // 1. Client Name, 2. Sale Date, 3. Item Sold, 4. Sale Value.
          // If a match is found:
          //   - Reassign collectorName to selectedCollectorForImport
          //   - Update overdueDays, overdueAmount, bracket, lastPayment, notes with latest values from collector's file
          //   - Client is moved out of "Sin Asignar" WITHOUT increasing the total portfolio client count!
          // If no match found:
          //   - Kept as a new credit/client record.

          const collectorMap = new Map<string, PortfolioClient>();
          previewRecords.forEach(r => {
            collectorMap.set(getRecordKey(r), r);
          });

          const matchedCollectorKeys = new Set<string>();

          // Process existing records:
          finalRecordsList = existingSnapshotForDate.records.map(existingRec => {
            const key = getRecordKey(existingRec);
            const matchingCollectorRec = collectorMap.get(key) || previewRecords.find(p => matchFourFactors(p, existingRec));

            if (matchingCollectorRec) {
              matchedCollectorKeys.add(key);
              matchedCollectorKeys.add(getRecordKey(matchingCollectorRec));
              return {
                ...existingRec,
                collectorName: selectedCollectorForImport,
                isUnassigned: false,
                amount: matchingCollectorRec.amount > 0 ? matchingCollectorRec.amount : existingRec.amount,
                overdueDays: matchingCollectorRec.overdueDays !== undefined ? matchingCollectorRec.overdueDays : existingRec.overdueDays,
                overdueAmount: matchingCollectorRec.overdueAmount !== undefined ? matchingCollectorRec.overdueAmount : existingRec.overdueAmount,
                bracket: matchingCollectorRec.bracket || existingRec.bracket,
                lastPaymentDate: matchingCollectorRec.lastPaymentDate || existingRec.lastPaymentDate,
                lastPaymentAmount: matchingCollectorRec.lastPaymentAmount || existingRec.lastPaymentAmount,
                installmentAmount: matchingCollectorRec.installmentAmount || existingRec.installmentAmount,
                notes: matchingCollectorRec.notes || existingRec.notes,
                phone: matchingCollectorRec.phone || existingRec.phone,
                address: matchingCollectorRec.address || existingRec.address
              };
            } else if (existingRec.collectorName === selectedCollectorForImport) {
              // If an existing record was already marked with this collector but wasn't in this new file,
              // it means it was either recovered or unassigned.
              return existingRec;
            }
            return existingRec;
          });

          // Any record from previewRecords that did NOT match any existing credit is appended as genuine new sale
          const unmatchedNewCredits = previewRecords.filter(p => !matchedCollectorKeys.has(getRecordKey(p)));
          if (unmatchedNewCredits.length > 0) {
            finalRecordsList.push(...unmatchedNewCredits);
          }

          // Preserve other collectors' recovered clients and merge with new ones
          const otherRecovered = (existingSnapshotForDate.recoveredClients || []).filter(
            r => r.collectorName !== selectedCollectorForImport
          );
          mergedRecoveredClients = [...otherRecovered, ...(importComparison?.recoveredList || [])];
        } else {
          finalRecordsList = [...previewRecords];
          mergedRecoveredClients = [...(importComparison?.recoveredList || [])];
        }
      } else {
        finalRecordsList = [...previewRecords];
        mergedRecoveredClients = [...(importComparison?.recoveredList || [])];
      }

      const totalRecoveredAmount = mergedRecoveredClients.reduce((acc, r) => acc + r.amount, 0);
      const finalSnapshotType = importMode === 'MASTER' ? 'CARTERA_MAESTRA' : importSnapshotType;
      const finalTitle = importTitle || (importMode === 'MASTER' ? `Cartera General Maestra GADA (${targetCutoff})` : undefined);

      const snapshotObj = buildSnapshotFromRecords(
        finalRecordsList,
        finalSnapshotType,
        finalTitle,
        targetCutoff,
        mergedRecoveredClients,
        totalRecoveredAmount,
        mergedRecoveredClients.length,
        importComparison?.newClientsList || [],
        importComparison?.newAmount || 0,
        importComparison?.newCount || 0,
        previousSnapshotForImport?.id
      );

      if (importMode === 'MASTER' || finalSnapshotType === 'CARTERA_MAESTRA') {
        snapshotObj.isMasterPortfolio = true;
      }

      // Safe Firestore saving with subcollection chunking (prevents 1MB limit error)
      const savedSnapshot = await savePortfolioSnapshotToFirestore(
        snapshotObj,
        existingSnapshotForDate?.id
      );

      setCurrentSnapshot(savedSnapshot);
      setSelectedCutoffDate(targetCutoff);
      setSelectedMonth(targetMonth);
      setSnapshots(prev => {
        const idx = prev.findIndex(s => s.id === savedSnapshot.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = savedSnapshot;
          return next;
        }
        return [savedSnapshot, ...prev];
      });

      await logAudit(
        AuditAction.PORTFOLIO_UPDATE,
        `Carga de cartera al corte ${targetCutoff} para ${selectedCollectorForImport || 'General'}: ${previewRecords.length} clientes ($${previewRecords.reduce((acc, r) => acc + r.amount, 0).toFixed(2)}). Recuperados: ${importComparison?.recoveredCount || 0} ($${(importComparison?.recoveredAmount || 0).toFixed(2)})`,
        savedSnapshot.id
      );

      showToast(`Cartera guardada al corte ${targetCutoff}. Se identificaron ${importComparison?.recoveredCount || 0} clientes recuperados/al día.`, 'success');
      setIsImportModalOpen(false);
      setPreviewRecords([]);
      setImportFileName('');
      setImportTitle('');
      setSelectedCollectorForImport('');
    } catch (err: any) {
      console.error('Error saving portfolio snapshot:', err);
      handleFirestoreError(err, OperationType.WRITE, 'portfolio_snapshots');
      showToast('Error al guardar la cartera en Firestore', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Add / Edit Manual Client
  const handleSaveManualClient = async () => {
    if (!manualForm.clientName.trim() || manualForm.amount < 0) {
      showToast('Ingrese un nombre de cliente válido y un monto correcto', 'error');
      return;
    }

    const bracket = getAgingBracket(manualForm.overdueDays);
    const newRecord: PortfolioClient = {
      id: editingClient ? editingClient.id : `record_${Date.now()}`,
      clientName: manualForm.clientName.trim(),
      identification: manualForm.identification.trim(),
      operationNumber: manualForm.operationNumber.trim(),
      collectorName: manualForm.collectorName.trim() || 'Sin Asignar',
      amount: round2(manualForm.amount),
      overdueDays: Number(manualForm.overdueDays),
      bracket,
      phone: manualForm.phone.trim(),
      itemSold: manualForm.itemSold.trim(),
      address: manualForm.address.trim(),
      notes: manualForm.notes.trim()
    };

    let updatedRecords: PortfolioClient[] = [];

    if (currentSnapshot) {
      if (editingClient) {
        updatedRecords = currentSnapshot.records.map(r => r.id === editingClient.id ? newRecord : r);
      } else {
        updatedRecords = [newRecord, ...currentSnapshot.records];
      }
    } else {
      updatedRecords = [newRecord];
    }

    const updatedSnapshot = buildSnapshotFromRecords(
      updatedRecords,
      currentSnapshot?.snapshotType || 'CARGA_GENERAL',
      currentSnapshot?.title || `Cartera General - ${selectedMonth}`
    );

    try {
      setSaving(true);
      const savedSnapshot = await savePortfolioSnapshotToFirestore(
        updatedSnapshot,
        currentSnapshot?.id
      );
      setCurrentSnapshot(savedSnapshot);
      setSnapshots(prev => {
        const idx = prev.findIndex(s => s.id === savedSnapshot.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = savedSnapshot;
          return next;
        }
        return [savedSnapshot, ...prev];
      });

      showToast(editingClient ? 'Cliente actualizado correctamente' : 'Cliente registrado en cartera', 'success');
      setIsManualModalOpen(false);
      setEditingClient(null);
      resetManualForm();
    } catch (err) {
      console.error('Error saving client:', err);
      handleFirestoreError(err, OperationType.WRITE, 'portfolio_snapshots');
      showToast('Error al guardar registro en Firestore', 'error');
    } finally {
      setSaving(false);
    }
  };

  const resetManualForm = () => {
    setManualForm({
      clientName: '',
      identification: '',
      operationNumber: '',
      collectorName: registeredCollectors[0] || '',
      amount: 0,
      overdueDays: 0,
      phone: '',
      itemSold: '',
      address: '',
      notes: ''
    });
  };

  // Delete Client Record
  const handleDeleteClient = async (recordId: string) => {
    if (!currentSnapshot) return;
    const confirmed = await showConfirm(
      '¿Eliminar Registro de Cartera?',
      'Esta acción eliminará al cliente del snapshot de cartera actual. ¿Deseas continuar?'
    );
    if (!confirmed) return;

    const updatedRecords = currentSnapshot.records.filter(r => r.id !== recordId);
    const updatedSnapshot = buildSnapshotFromRecords(
      updatedRecords,
      currentSnapshot.snapshotType,
      currentSnapshot.title
    );

    try {
      setSaving(true);
      const savedSnapshot = await savePortfolioSnapshotToFirestore(
        updatedSnapshot,
        currentSnapshot.id
      );
      setCurrentSnapshot(savedSnapshot);
      setSnapshots(prev => prev.map(s => s.id === savedSnapshot.id ? savedSnapshot : s));
      showToast('Registro eliminado de la cartera', 'success');
    } catch (err) {
      console.error('Error deleting client:', err);
      handleFirestoreError(err, OperationType.UPDATE, 'portfolio_snapshots');
      showToast('Error al eliminar registro', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Delete Entire Snapshot
  const handleDeleteSnapshot = async (snapId: string) => {
    const confirmed = await showConfirm(
      '¿Eliminar Corte de Cartera?',
      'Se borrará permanentemente este corte de cartera guardado.'
    );
    if (!confirmed) return;

    try {
      await deletePortfolioSnapshotFromFirestore(snapId);
      setSnapshots(prev => prev.filter(s => s.id !== snapId));
      if (currentSnapshot?.id === snapId) {
        setCurrentSnapshot(null);
      }
      showToast('Corte de cartera eliminado', 'success');
    } catch (err) {
      console.error('Error deleting snapshot:', err);
      handleFirestoreError(err, OperationType.DELETE, `portfolio_snapshots/${snapId}`);
      showToast('Error al eliminar el corte', 'error');
    }
  };

  // Filtered Client List for Table View with Dynamic Multi-Metric Sorting
  const filteredRecords = useMemo(() => {
    if (!currentSnapshot?.records) return [];

    const filtered = currentSnapshot.records.filter(r => {
      // Collector Filter
      if (selectedCollectorFilter !== 'TODOS' && r.collectorName !== selectedCollectorFilter) {
        return false;
      }
      // Assignment Filter (Asignados vs Sin Asignar / En Oficina / Fugas)
      if (assignmentFilter === 'ASIGNADOS') {
        const isUnassigned = r.isUnassigned || !r.collectorName || r.collectorName.toLowerCase().includes('sin asignar') || r.collectorName.toLowerCase().includes('oficina');
        if (isUnassigned) return false;
      } else if (assignmentFilter === 'SIN_ASIGNAR') {
        const isUnassigned = r.isUnassigned || !r.collectorName || r.collectorName.toLowerCase().includes('sin asignar') || r.collectorName.toLowerCase().includes('oficina');
        if (!isUnassigned) return false;
      }
      // Bracket Filter (supporting separate '0' and '1-30' as well as legacy '0-30')
      if (selectedBracketFilter !== 'TODOS') {
        const clientBracket = r.bracket || getAgingBracket(r.overdueDays);
        if (selectedBracketFilter === '0') {
          if (r.overdueDays !== 0 && clientBracket !== '0') return false;
        } else if (selectedBracketFilter === '1-30') {
          if ((r.overdueDays <= 0 || r.overdueDays > 30) && clientBracket !== '1-30') return false;
        } else if (clientBracket !== selectedBracketFilter) {
          return false;
        }
      }
      // Search Term Filter
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const matchName = r.clientName.toLowerCase().includes(term);
        const matchId = (r.identification || '').toLowerCase().includes(term);
        const matchOp = (r.operationNumber || '').toLowerCase().includes(term);
        const matchCol = (r.collectorName || '').toLowerCase().includes(term);
        const matchPhone = (r.phone || '').toLowerCase().includes(term);
        const matchItem = (r.itemSold || '').toLowerCase().includes(term);
        const matchAddress = (r.address || '').toLowerCase().includes(term);
        if (!matchName && !matchId && !matchOp && !matchCol && !matchPhone && !matchItem && !matchAddress) {
          return false;
        }
      }
      return true;
    });

    // Dynamic Multi-Metric Sorting
    filtered.sort((a, b) => {
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

    return filtered;
  }, [currentSnapshot, selectedCollectorFilter, assignmentFilter, selectedBracketFilter, searchTerm, sortField, sortDirection]);

  // Reset to page 1 whenever search, filter or page size changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCollectorFilter, selectedBracketFilter, assignmentFilter, pageSize, selectedCutoffDate]);

  // Paginated Sliced Records
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, currentPage, pageSize]);

  // Global Cash Flow Valuation for Current Active Snapshot / Filtered Set
  const activeCashFlowSummary = useMemo(() => {
    if (!currentSnapshot?.records || currentSnapshot.records.length === 0) return null;
    return calculateMonthlyCashFlowSummary(currentSnapshot.records, currentSnapshot.cutoffDate);
  }, [currentSnapshot]);

  const filteredCashFlowSummary = useMemo(() => {
    if (filteredRecords.length === 0) return null;
    return calculateMonthlyCashFlowSummary(filteredRecords, currentSnapshot?.cutoffDate);
  }, [filteredRecords, currentSnapshot]);

  // Comparative Snapshots for Current Selected Month (Corte Inicial vs Corte Final / Cargas)
  const monthSnapshots = useMemo(() => {
    return snapshots.filter(s => s.month === selectedMonth);
  }, [snapshots, selectedMonth]);

  const initialSnapshot = useMemo(() => {
    return monthSnapshots.find(s => s.snapshotType === 'CORTE_INICIAL') || monthSnapshots[monthSnapshots.length - 1] || null;
  }, [monthSnapshots]);

  const closingSnapshot = useMemo(() => {
    return monthSnapshots.find(s => s.snapshotType === 'CORTE_FINAL') || (monthSnapshots.length > 1 ? monthSnapshots[0] : null);
  }, [monthSnapshots]);

  // Compute collector-specific stats for current snapshot
  const activeCollectorStats = useMemo(() => {
    if (!currentSnapshot?.records) return [];

    const statsMap: Record<string, {
      name: string;
      totalClients: number;
      totalAmount: number;
      brackets: Record<AgingBracket, { count: number; amount: number }>;
    }> = {};

    const initialBrackets = (): Record<AgingBracket, { count: number; amount: number }> => ({
      '0': { count: 0, amount: 0 },
      '1-30': { count: 0, amount: 0 },
      '31-60': { count: 0, amount: 0 },
      '61-90': { count: 0, amount: 0 },
      '91-180': { count: 0, amount: 0 },
      '>181': { count: 0, amount: 0 },
      '0-30': { count: 0, amount: 0 }
    });

    registeredCollectors.forEach(col => {
      statsMap[col] = {
        name: col,
        totalClients: 0,
        totalAmount: 0,
        brackets: initialBrackets()
      };
    });

    currentSnapshot.records.forEach(r => {
      const col = r.collectorName || 'Sin Asignar';
      if (!statsMap[col]) {
        statsMap[col] = {
          name: col,
          totalClients: 0,
          totalAmount: 0,
          brackets: initialBrackets()
        };
      }

      const cleanAmt = round2(r.amount);
      statsMap[col].totalClients += 1;
      statsMap[col].totalAmount = round2(statsMap[col].totalAmount + cleanAmt);

      const bKey = r.bracket || getAgingBracket(r.overdueDays);
      if (statsMap[col].brackets[bKey]) {
        statsMap[col].brackets[bKey].count += 1;
        statsMap[col].brackets[bKey].amount = round2(statsMap[col].brackets[bKey].amount + cleanAmt);
      }
    });

    return Object.values(statsMap).filter(s => s.totalClients > 0 || registeredCollectors.includes(s.name));
  }, [currentSnapshot, registeredCollectors]);

  // All unique cutoff dates in chronological order (earliest to latest)
  const availableCutoffDatesAsc = useMemo(() => {
    const dates = new Set<string>();
    snapshots.forEach(s => {
      if (s.cutoffDate) dates.add(s.cutoffDate);
      else if (s.month) dates.add(`${s.month}-01`);
    });
    return Array.from(dates).sort();
  }, [snapshots]);

  // Descending for header dropdowns
  const availableCutoffDates = useMemo(() => {
    return [...availableCutoffDatesAsc].reverse();
  }, [availableCutoffDatesAsc]);

  // Consolidate all records for a specific cutoff date across all snapshots
  const getConsolidatedSnapshotForDate = (dateStr: string): PortfolioSnapshot | null => {
    if (!dateStr) return null;
    const matchingSnaps = snapshots.filter(s => (s.cutoffDate || `${s.month}-01`) === dateStr);
    if (matchingSnaps.length === 0) return null;
    if (matchingSnaps.length === 1) return matchingSnaps[0];

    // Merge multiple snapshots on the same date (e.g. uploaded by different collectors)
    const recordsMap = new Map<string, PortfolioClient>();
    matchingSnaps.forEach(s => {
      (s.records || []).forEach(r => {
        recordsMap.set(getRecordKey(r), r);
      });
    });

    const mergedRecords = Array.from(recordsMap.values());
    const mergedRecoveredMap = new Map<string, PortfolioClient>();
    matchingSnaps.forEach(s => {
      (s.recoveredClients || []).forEach(r => {
        mergedRecoveredMap.set(getRecordKey(r), r);
      });
    });
    const mergedRecovered = Array.from(mergedRecoveredMap.values());

    return buildSnapshotFromRecords(
      mergedRecords,
      'CARGA_GENERAL',
      `Corte Consolidado - ${dateStr}`,
      dateStr,
      mergedRecovered,
      round2(mergedRecovered.reduce((acc, r) => acc + round2(r.amount), 0)),
      mergedRecovered.length
    );
  };

  const compareInitialSnapshot = useMemo(() => {
    return getConsolidatedSnapshotForDate(compareStartDate) || initialSnapshot || currentSnapshot;
  }, [compareStartDate, snapshots, initialSnapshot, currentSnapshot]);

  const compareClosingSnapshot = useMemo(() => {
    return getConsolidatedSnapshotForDate(compareEndDate) || closingSnapshot || currentSnapshot;
  }, [compareEndDate, snapshots, closingSnapshot, currentSnapshot]);

  // Synchronize initial, closing, and recovery dates when available dates change
  useEffect(() => {
    if (availableCutoffDatesAsc.length > 0) {
      if (!compareStartDate || !availableCutoffDatesAsc.includes(compareStartDate)) {
        setCompareStartDate(availableCutoffDatesAsc[0]);
      }
      if (!compareEndDate || !availableCutoffDatesAsc.includes(compareEndDate)) {
        setCompareEndDate(availableCutoffDatesAsc[availableCutoffDatesAsc.length - 1]);
      }

      // Synchronize recovery cutoffs
      const activeOrLatest = (selectedCutoffDate && availableCutoffDatesAsc.includes(selectedCutoffDate))
        ? selectedCutoffDate
        : availableCutoffDatesAsc[availableCutoffDatesAsc.length - 1];

      if (!recoveryTargetDate || !availableCutoffDatesAsc.includes(recoveryTargetDate)) {
        setRecoveryTargetDate(activeOrLatest);
      }

      if (!recoveryBaseDate || !availableCutoffDatesAsc.includes(recoveryBaseDate)) {
        const targetIdx = availableCutoffDatesAsc.indexOf(activeOrLatest);
        if (targetIdx > 0) {
          setRecoveryBaseDate(availableCutoffDatesAsc[targetIdx - 1]);
        } else {
          setRecoveryBaseDate(availableCutoffDatesAsc[0]);
        }
      }
    }
  }, [availableCutoffDatesAsc, selectedCutoffDate]);

  // Current Recovered Data for Active Snapshot & Filter using 4-Factor Fingerprint Comparison
  const currentRecoveredData = useMemo(() => {
    // 1. Determine base and target snapshots for comparison
    const baseSnap = getConsolidatedSnapshotForDate(recoveryBaseDate);
    const targetSnap = getConsolidatedSnapshotForDate(recoveryTargetDate);

    // If both snapshots are available, perform the precise 4-factor comparison
    if (baseSnap && targetSnap) {
      let baseRecords = baseSnap.records || [];
      let targetRecords = targetSnap.records || [];

      if (selectedCollectorFilter !== 'TODOS') {
        baseRecords = baseRecords.filter(r => r.collectorName === selectedCollectorFilter);
        targetRecords = targetRecords.filter(r => r.collectorName === selectedCollectorFilter);
      }

      // Check if a Master Portfolio is available as the source of truth
      const masterSnap = snapshots.find(s => 
        s.snapshotType === 'CARTERA_MAESTRA' || 
        s.isMasterPortfolio || 
        (s.cutoffDate && s.cutoffDate >= '2026-12-01') ||
        s.title?.toLowerCase().includes('maestra')
      );
      const masterMap = new Map<string, PortfolioClient>();
      if (masterSnap) {
        (masterSnap.records || []).forEach(r => masterMap.set(getRecordKey(r), r));
      }

      const targetMap = new Map<string, PortfolioClient>();
      targetRecords.forEach(r => {
        targetMap.set(getRecordKey(r), r);
      });

      const recoveredList: PortfolioClient[] = [];
      let totalRecoveredAmount = 0;
      let liquidationsCount = 0;
      let liquidationsAmount = 0;
      let alDiaCount = 0;
      let alDiaAmount = 0;
      let partialCount = 0;
      let partialAmount = 0;

      const baseDateStr = baseSnap.cutoffDate || `${baseSnap.month}-01`;
      const targetDateStr = targetSnap.cutoffDate || `${targetSnap.month}-01`;

      baseRecords.forEach(baseR => {
        const baseAmt = round2(baseR.amount);
        if (baseAmt <= 0) return; // Without pending debt, nothing to recover

        const key = getRecordKey(baseR);
        const targetR = targetMap.get(key);

        if (!targetR) {
          const masterR = masterMap.get(key);

          if (masterR && masterR.amount > 0) {
            // CASO 1B: CLIENTE PUESTO AL DÍA (NO ES LIQUIDACIÓN TOTAL)
            // Salió del reporte diario porque ya no tiene atraso, pero sigue activo con saldo en la Cartera Maestra
            const debtDelta = round2(baseAmt - masterR.amount);
            const effectivePaid = debtDelta > 0 
              ? debtDelta 
              : (baseR.overdueAmount && baseR.overdueAmount > 0 ? baseR.overdueAmount : (baseR.lastPaymentAmount || baseR.installmentAmount || 0));

            recoveredList.push({
              ...baseR,
              id: `rec_aldia_${baseR.id || key}`,
              amount: effectivePaid,
              isPartialPayment: true,
              recoveredStatus: 'AL_DIA',
              previousAmount: baseAmt,
              previousOverdueDays: baseR.overdueDays,
              previousOverdueAmount: baseR.overdueAmount || 0,
              overdueDays: 0,
              overdueAmount: 0,
              lastPaymentDate: baseR.lastPaymentDate || targetDateStr,
              lastPaymentAmount: effectivePaid,
              notes: `Puesto Al Día (Salió de mora en reporte diario - Saldo capital activo en Cartera Maestra: $${masterR.amount.toFixed(2)})`
            });
            totalRecoveredAmount = round2(totalRecoveredAmount + effectivePaid);
            alDiaCount += 1;
            alDiaAmount = round2(alDiaAmount + effectivePaid);
          } else {
            // CASO 1A: LIQUIDACIÓN TOTAL REAL (No figura en corte actual ni en Cartera Maestra)
            recoveredList.push({
              ...baseR,
              id: `rec_liq_${baseR.id || key}`,
              amount: baseAmt, // Saldo capital anterior cancelado al 100%
              isPartialPayment: false,
              recoveredStatus: 'LIQUIDACION_TOTAL',
              previousAmount: baseAmt,
              previousOverdueDays: baseR.overdueDays,
              previousOverdueAmount: baseR.overdueAmount || 0,
              overdueDays: 0,
              overdueAmount: 0,
              lastPaymentDate: baseR.lastPaymentDate || targetDateStr,
              lastPaymentAmount: baseAmt,
              notes: `Liquidación Total Real (Canceló saldo capital de $${baseAmt.toFixed(2)}${baseR.itemSold ? ` por ${baseR.itemSold}` : ''})`
            });
            totalRecoveredAmount = round2(totalRecoveredAmount + baseAmt);
            liquidationsCount += 1;
            liquidationsAmount = round2(liquidationsAmount + baseAmt);
          }
        } else {
          // CASO 2: CLIENTE CONTINÚA EN CARTERA - VALIDACIÓN ESTRICTA DE ABONO A CAPITAL
          const targetAmt = round2(targetR.amount);
          const debtDecreased = targetAmt < baseAmt;

          if (debtDecreased) {
            const deltaCapital = round2(baseAmt - targetAmt);

            const rawPaymentDate = targetR.lastPaymentDate || '';
            const paymentDateISO = parseDateToISO(rawPaymentDate) || rawPaymentDate;

            // Validación estricta: el pago debe haberse registrado entre las fechas de las carteras seleccionadas
            const isDateInRange = paymentDateISO 
              ? (paymentDateISO >= baseDateStr && paymentDateISO <= targetDateStr)
              : false;

            if (isDateInRange && deltaCapital > 0) {
              recoveredList.push({
                ...targetR,
                id: `rec_abono_${targetR.id || key}`,
                amount: deltaCapital, // Monto exacto recaudado por diferencia de saldo capital
                isPartialPayment: true,
                recoveredStatus: 'ABONO_PARCIAL',
                previousAmount: baseAmt,
                previousOverdueDays: baseR.overdueDays,
                previousOverdueAmount: baseR.overdueAmount || 0,
                notes: `Abono Parcial Registrado (Saldo Capital: $${baseAmt.toFixed(2)} → $${targetAmt.toFixed(2)} | Abono: $${deltaCapital.toFixed(2)}${rawPaymentDate ? ` | U.Pago: ${rawPaymentDate}` : ''})`
              });
              totalRecoveredAmount = round2(totalRecoveredAmount + deltaCapital);
              partialCount += 1;
              partialAmount = round2(partialAmount + deltaCapital);
            }
          }
        }
      });

      return {
        recoveredClients: recoveredList,
        recoveredAmount: totalRecoveredAmount,
        recoveredCount: recoveredList.length,
        liquidationsCount,
        liquidationsAmount,
        alDiaCount,
        alDiaAmount,
        partialCount,
        partialAmount,
        hasMasterPortfolio: Boolean(masterSnap),
        masterCutoffDate: masterSnap?.cutoffDate || masterSnap?.title || null,
        previousDate: baseDateStr,
        currentDate: targetDateStr
      };
    }

    // Fallback if only one snapshot exists
    if (!currentSnapshot) {
      return {
        recoveredClients: [] as PortfolioClient[],
        recoveredAmount: 0,
        recoveredCount: 0,
        liquidationsCount: 0,
        liquidationsAmount: 0,
        alDiaCount: 0,
        alDiaAmount: 0,
        partialCount: 0,
        partialAmount: 0,
        previousDate: '',
        currentDate: ''
      };
    }

    let list = currentSnapshot.recoveredClients || [];
    if (selectedCollectorFilter !== 'TODOS') {
      list = list.filter(r => r.collectorName === selectedCollectorFilter);
    }
    const normalizedList = list.map(r => ({
      ...r,
      isPartialPayment: Boolean(
        r.isPartialPayment ||
        r.notes?.toLowerCase().includes('abono parcial') ||
        (r.previousAmount !== undefined && r.previousAmount > r.amount && r.notes?.toLowerCase().includes('saldo anterior'))
      )
    }));

    const liqList = normalizedList.filter(r => !r.isPartialPayment);
    const partList = normalizedList.filter(r => r.isPartialPayment);

    return {
      recoveredClients: normalizedList,
      recoveredAmount: round2(normalizedList.reduce((acc, r) => acc + r.amount, 0)),
      recoveredCount: normalizedList.length,
      liquidationsCount: liqList.length,
      liquidationsAmount: round2(liqList.reduce((acc, r) => acc + r.amount, 0)),
      alDiaCount: 0,
      alDiaAmount: 0,
      partialCount: partList.length,
      partialAmount: round2(partList.reduce((acc, r) => acc + r.amount, 0)),
      previousDate: recoveryBaseDate || 'Corte anterior',
      currentDate: recoveryTargetDate || currentSnapshot.cutoffDate || ''
    };
  }, [recoveryBaseDate, recoveryTargetDate, snapshots, selectedCollectorFilter, currentSnapshot]);

  // Cartera General Maestra (Source of truth for all active accounts, e.g., cutoff 31/12/2026 or largest active base)
  const masterSnapshot = useMemo(() => {
    return snapshots.find(s => 
      s.snapshotType === 'CARTERA_MAESTRA' || 
      s.isMasterPortfolio || 
      (s.cutoffDate && s.cutoffDate >= '2026-12-01') ||
      s.title?.toLowerCase().includes('maestra')
    ) || null;
  }, [snapshots]);

  // Assignment and Coverage Stats (Total, Assigned, Unassigned / Oficina / Fugas)
  const assignmentStats = useMemo(() => {
    // If a master snapshot exists and we're looking at CRUCE_ASIGNACIONES or general universe, prioritize it
    const activeRecords = (activeTab === 'CRUCE_ASIGNACIONES' && masterSnapshot) 
      ? masterSnapshot.records 
      : (currentSnapshot?.records || masterSnapshot?.records || []);

    const totalCount = activeRecords.length;
    const totalAmount = activeRecords.reduce((acc, r) => acc + (r.amount || 0), 0);

    let assignedCount = 0;
    let assignedAmount = 0;
    let unassignedCount = 0;
    let unassignedAmount = 0;

    const collectorBreakdown: Record<string, { count: number; amount: number }> = {};

    activeRecords.forEach(r => {
      const col = (r.collectorName || '').trim();
      const isUnassigned = Boolean(
        r.isUnassigned || 
        !col || 
        col.toLowerCase().includes('sin asignar') || 
        col.toLowerCase().includes('oficina')
      );

      if (isUnassigned) {
        unassignedCount++;
        unassignedAmount = round2(unassignedAmount + (r.amount || 0));
      } else {
        assignedCount++;
        assignedAmount = round2(assignedAmount + (r.amount || 0));
        if (!collectorBreakdown[col]) {
          collectorBreakdown[col] = { count: 0, amount: 0 };
        }
        collectorBreakdown[col].count++;
        collectorBreakdown[col].amount = round2(collectorBreakdown[col].amount + (r.amount || 0));
      }
    });

    return {
      totalCount,
      totalAmount: round2(totalAmount),
      assignedCount,
      assignedAmount: round2(assignedAmount),
      unassignedCount,
      unassignedAmount: round2(unassignedAmount),
      collectorBreakdown,
      coveragePercent: totalCount > 0 ? Math.round((assignedCount / totalCount) * 100) : 0,
      unassignedPercent: totalCount > 0 ? Math.round((unassignedCount / totalCount) * 100) : 0
    };
  }, [currentSnapshot, masterSnapshot, activeTab]);

  // Cross-reference Master Portfolio against Collector Portfolios
  const handleCrossAssignments = async () => {
    const targetSnap = masterSnapshot || currentSnapshot;
    if (!targetSnap || !targetSnap.records || targetSnap.records.length === 0) {
      showToast('No se encontró una cartera para realizar el cruce de asignaciones', 'warning');
      return;
    }

    try {
      setSaving(true);
      // Map every known collector assignment and latest state from ALL collector snapshots using 4-factor fingerprint
      const collectorMap = new Map<string, { collector: string; record: PortfolioClient }>();
      snapshots.forEach(s => {
        if (s.id === targetSnap.id && targetSnap.snapshotType === 'CARTERA_MAESTRA') return;
        (s.records || []).forEach(r => {
          const col = (r.collectorName || '').trim();
          if (col && !col.toLowerCase().includes('sin asignar') && !col.toLowerCase().includes('oficina')) {
            collectorMap.set(getRecordKey(r), { collector: col, record: r });
          }
        });
      });

      let newlyAssigned = 0;
      let unassignedRemaining = 0;

      const updatedRecords = targetSnap.records.map(r => {
        const key = getRecordKey(r);
        const matchData = collectorMap.get(key);

        if (matchData) {
          if (r.isUnassigned || r.collectorName?.toLowerCase().includes('sin asignar') || r.collectorName?.toLowerCase().includes('oficina')) {
            newlyAssigned++;
          }
          const colRec = matchData.record;
          return {
            ...r,
            collectorName: matchData.collector,
            isUnassigned: false,
            amount: colRec.amount > 0 ? colRec.amount : r.amount,
            overdueDays: colRec.overdueDays !== undefined ? colRec.overdueDays : r.overdueDays,
            overdueAmount: colRec.overdueAmount !== undefined ? colRec.overdueAmount : r.overdueAmount,
            bracket: colRec.bracket || r.bracket,
            lastPaymentDate: colRec.lastPaymentDate || r.lastPaymentDate,
            lastPaymentAmount: colRec.lastPaymentAmount || r.lastPaymentAmount,
            installmentAmount: colRec.installmentAmount || r.installmentAmount,
            notes: colRec.notes || r.notes,
            phone: colRec.phone || r.phone,
            address: colRec.address || r.address
          };
        } else {
          const isUnassigned = !r.collectorName || r.collectorName.toLowerCase().includes('sin asignar') || r.collectorName.toLowerCase().includes('oficina');
          if (isUnassigned) {
            unassignedRemaining++;
            return {
              ...r,
              collectorName: 'Sin Asignar / En Oficina',
              isUnassigned: true
            };
          }
          return r;
        }
      });

      const updatedSnapObj = buildSnapshotFromRecords(
        updatedRecords,
        targetSnap.snapshotType || 'CARTERA_MAESTRA',
        targetSnap.title,
        targetSnap.cutoffDate,
        targetSnap.recoveredClients,
        targetSnap.recoveredAmount,
        targetSnap.recoveredCount,
        targetSnap.newClients,
        targetSnap.newAmount,
        targetSnap.newCount,
        targetSnap.previousSnapshotId
      );
      updatedSnapObj.isMasterPortfolio = true;

      if (targetSnap.id) {
        const saved = await savePortfolioSnapshotToFirestore(updatedSnapObj, targetSnap.id);
        setCurrentSnapshot(saved);
        setSnapshots(prev => prev.map(s => s.id === targetSnap.id ? saved : s));
        showToast(`Cruce exitoso: ${newlyAssigned} asignados a rutas de cobro. ${unassignedRemaining} identificados sin cobrador / en oficina.`, 'success');
      }
    } catch (err: any) {
      console.error('Error crossing assignments:', err);
      showToast('Error al procesar el cruce de asignaciones', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Export Unassigned Clients to Excel (Canonical 15 Columns + Enriched Analytics at far right)
  const handleExportUnassignedExcel = () => {
    const targetSnap = masterSnapshot || currentSnapshot;
    const records = targetSnap?.records || [];
    const unassigned = records.filter(r => 
      r.isUnassigned || 
      !r.collectorName || 
      r.collectorName.toLowerCase().includes('sin asignar') || 
      r.collectorName.toLowerCase().includes('oficina')
    );

    if (unassigned.length === 0) {
      showToast('No se encontraron clientes sin cobrador asignado en esta cartera', 'info');
      return;
    }

    const fileName = `Clientes_Sin_Cobrador_${targetSnap?.cutoffDate || 'Corte'}`;
    exportPortfolioClientsToExcel(unassigned, fileName, {
      sheetName: 'Sin_Cobrador',
      extraColumnsGenerator: (r) => ({
        'Tramo de Mora': AGING_BRACKETS.find(b => b.key === r.bracket)?.label || (r.overdueDays === 0 ? '0 Días' : r.bracket),
        'Cobrador Asignado': r.collectorName || 'Sin Asignar / Oficina',
        'N° Operación': r.operationNumber || '',
        'Cédula / RUC': r.identification || '',
        'Estado Asignación': 'Sin Cobrador / En Oficina / Vencido o Fuga',
        'Observaciones': r.notes || ''
      })
    });

    showToast(`Exportación completada: ${unassigned.length} clientes sin cobrador asignado`, 'success');
  };

  // Filtered Recovered Clients for Tab view
  const filteredRecoveredClients = useMemo(() => {
    return currentRecoveredData.recoveredClients.filter(r => {
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const matchName = r.clientName.toLowerCase().includes(term);
        const matchId = (r.identification || '').toLowerCase().includes(term);
        const matchOp = (r.operationNumber || '').toLowerCase().includes(term);
        const matchCol = (r.collectorName || '').toLowerCase().includes(term);
        if (!matchName && !matchId && !matchOp && !matchCol) return false;
      }
      return true;
    });
  }, [currentRecoveredData, searchTerm]);

  // Export Recovered Clients to Excel (Canonical 15 Columns + Enriched Analytics at far right)
  const handleExportRecoveredExcel = () => {
    if (filteredRecoveredClients.length === 0) {
      showToast('No hay clientes recuperados para exportar', 'error');
      return;
    }

    const prevDate = currentRecoveredData.previousDate || 'Base';
    const currDate = currentRecoveredData.currentDate || 'Actual';
    const fileName = `Reporte_Recaudacion_y_Abonos_${prevDate}_vs_${currDate}`;

    exportPortfolioClientsToExcel(filteredRecoveredClients, fileName, {
      sheetName: `Recaudacion_${currDate.substring(0, 15)}`,
      extraColumnsGenerator: (r) => {
        const isPartial = Boolean(
          r.isPartialPayment ||
          r.notes?.toLowerCase().includes('abono parcial') ||
          (r.previousAmount !== undefined && r.previousAmount > r.amount && r.notes?.toLowerCase().includes('saldo anterior'))
        );
        const prevDebt = r.previousAmount !== undefined ? r.previousAmount : r.amount;
        const currentDebt = isPartial ? Math.max(0, round2(prevDebt - r.amount)) : 0;

        return {
          'Tramo de Mora': AGING_BRACKETS.find(b => b.key === r.bracket)?.label || (r.overdueDays === 0 ? '0 Días' : r.bracket),
          'Cobrador Asignado': r.collectorName || '',
          'N° Operación': r.operationNumber || '',
          'Cédula / RUC': r.identification || '',
          'Tipo de Movimiento': isPartial ? 'Abono Parcial' : 'Liquidación Total',
          'Efectivo Recuperado / Abono': r.amount,
          'Saldo Capital Anterior': prevDebt,
          'Saldo Capital Actual': currentDebt,
          'Valor Total Atraso Anterior': r.previousOverdueAmount !== undefined ? r.previousOverdueAmount : (r.overdueAmount || 0),
          'Valor Total Atraso Actual': isPartial ? (r.overdueAmount || 0) : 0,
          'Días Mora Anterior': r.previousOverdueDays !== undefined ? r.previousOverdueDays : r.overdueDays,
          'Días Mora Actual': isPartial ? r.overdueDays : 0,
          'Detalle / Observación': r.notes || ''
        };
      }
    });

    showToast('Exportación de recaudación y abonos completada con éxito', 'success');
  };

  // Export Filtered Table to Excel (Canonical 15 Columns + Enriched Analytics at far right)
  const handleExportFilteredExcel = () => {
    if (filteredRecords.length === 0) {
      showToast('No hay registros para exportar', 'error');
      return;
    }

    const fileName = `Cartera_Sectorizada_${selectedMonth}`;
    exportPortfolioClientsToExcel(filteredRecords, fileName, {
      sheetName: `Cartera_${selectedMonth}`,
      extraColumnsGenerator: (r) => ({
        'Tramo de Mora': AGING_BRACKETS.find(b => b.key === r.bracket)?.label || (r.overdueDays === 0 ? '0 Días (Al Día / Por Vencer)' : r.bracket),
        'Cobrador / Ruta': r.collectorName || 'Sin Asignar',
        'N° Operación': r.operationNumber || '',
        'Cédula / RUC': r.identification || '',
        'Estado Asignación': r.isUnassigned ? 'Sin Cobrador / Oficina' : 'Asignado a Ruta',
        'Observaciones': r.notes || ''
      })
    });

    showToast('Exportación a Excel completada', 'success');
  };

  // Robust WhatsApp launcher supporting Web & Desktop App with fallback
  const handleOpenWhatsApp = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    const cleanPhone = formatEcuadorianPhone(customWhatsAppPhone);
    if (!cleanPhone) {
      showToast('Por favor ingrese un número de celular válido para Ecuador (ej: 0991234567)', 'warning');
      return;
    }
    const url = getWhatsAppUrl(customWhatsAppPhone, customWhatsAppText);
    if (!url) {
      showToast('No se pudo generar el enlace de WhatsApp', 'error');
      return;
    }

    let opened = false;
    try {
      const win = window.open(url, '_blank', 'noopener,noreferrer');
      if (win && !win.closed && typeof win.closed !== 'undefined') {
        opened = true;
      }
    } catch (err) {
      console.warn('window.open blocked:', err);
    }

    if (!opened) {
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }

    showToast('Abriendo WhatsApp...', 'success');
  };

  return (
    <div className="space-y-8 pb-36 md:pb-48">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-neutral-900 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <FolderGit2 className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50 tracking-tight">
                  Gestión y Sectorización de Carteras
                </h1>
                {isSupervisor && (
                  <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Supervisor</span>
                  </span>
                )}
              </div>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
                Comparación temporal, corte por fechas, clientes recuperados y control por cobrador
              </p>
            </div>
          </div>
        </div>

        {/* Date Selector & Main Actions */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Month Selector */}
          <div className="flex items-center space-x-2 bg-neutral-100 dark:bg-neutral-800 px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700">
            <Calendar className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                setSelectedCutoffDate('');
              }}
              className="bg-transparent text-sm font-semibold text-neutral-800 dark:text-neutral-100 focus:outline-none cursor-pointer"
            />
          </div>

          {/* Cutoff Date Selector if snapshots exist */}
          {availableCutoffDates.length > 0 && (
            <div className="flex items-center space-x-1.5 bg-neutral-100 dark:bg-neutral-800 px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700">
              <span className="text-xs font-bold text-neutral-500">Corte:</span>
              <select
                value={selectedCutoffDate || currentSnapshot?.cutoffDate || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedCutoffDate(val);
                  if (val) {
                    const consolidated = getConsolidatedSnapshotForDate(val);
                    if (consolidated) {
                      setCurrentSnapshot(consolidated);
                      setSelectedMonth(consolidated.month);
                    }
                  }
                }}
                className="bg-transparent text-sm font-semibold text-neutral-800 dark:text-neutral-100 focus:outline-none cursor-pointer"
              >
                <option value="">{currentSnapshot?.cutoffDate ? `Corte ${currentSnapshot.cutoffDate}` : 'Seleccionar Corte...'}</option>
                {availableCutoffDates.map(d => (
                  <option key={d} value={d}>Corte {d}</option>
                ))}
              </select>
            </div>
          )}

          {/* Supervisor Toggle */}
          {isSupervisor && (
            <div className="flex items-center bg-neutral-100 dark:bg-neutral-800 p-1 rounded-xl border border-neutral-200 dark:border-neutral-700">
              <button
                type="button"
                onClick={() => setSupervisorConsolidatedView(true)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  supervisorConsolidatedView
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
                }`}
              >
                Global Consolidada
              </button>
              <button
                type="button"
                onClick={() => setSupervisorConsolidatedView(false)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  !supervisorConsolidatedView
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
                }`}
              >
                Individual
              </button>
            </div>
          )}

          {/* Export Portfolio Button */}
          <button
            onClick={() => setIsPortfolioExportOpen(true)}
            className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Exportar Cartera</span>
          </button>

          {/* Import Excel Button */}
          <button
            onClick={() => {
              setPreviewRecords([]);
              setImportFileName('');
              setImportCutoffDate(format(new Date(), 'yyyy-MM-dd'));
              setImportTitle(`Corte Cartera - ${format(new Date(), 'yyyy-MM-dd')}`);
              setImportAssignmentMode('GENERAL');
              setSelectedCollectorForImport('');
              setImportSnapshotType('CARGA_GENERAL');
              setImportMode('COLLECTOR');
              setIsImportModalOpen(true);
            }}
            className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Cargar Cartera (Excel)</span>
          </button>

          {/* Manual Add Button */}
          <button
            onClick={() => {
              setEditingClient(null);
              resetManualForm();
              setIsManualModalOpen(true);
            }}
            className="flex items-center space-x-2 bg-neutral-800 hover:bg-neutral-900 dark:bg-neutral-700 dark:hover:bg-neutral-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Cliente</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-neutral-200 dark:border-neutral-800 overflow-x-auto space-x-2">
        <button
          onClick={() => setActiveTab('ANALISIS')}
          className={`flex items-center space-x-2 py-3 px-5 border-b-2 font-bold text-sm transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'ANALISIS'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
          }`}
        >
          <PieChart className="w-4 h-4" />
          <span>Análisis y Sectorización</span>
        </button>

        <button
          onClick={() => setActiveTab('RECUPERADOS')}
          className={`flex items-center space-x-2 py-3 px-5 border-b-2 font-bold text-sm transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'RECUPERADOS'
              ? 'border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400'
              : 'border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          <span>Análisis de Recaudación y Abonos</span>
          {currentRecoveredData.recoveredCount > 0 && (
            <span className="ml-1.5 px-2 py-0.5 text-xs font-extrabold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
              {currentRecoveredData.recoveredCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('CRUCE_ASIGNACIONES')}
          className={`flex items-center space-x-2 py-3 px-5 border-b-2 font-bold text-sm transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'CRUCE_ASIGNACIONES'
              ? 'border-purple-600 text-purple-600 dark:border-purple-400 dark:text-purple-400'
              : 'border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
          }`}
        >
          <Users className="w-4 h-4 text-purple-500" />
          <span>Cruce y Asignación de Rutas</span>
          {assignmentStats.unassignedCount > 0 && (
            <span className="ml-1.5 px-2 py-0.5 text-xs font-extrabold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">
              {assignmentStats.unassignedCount} sin asignar
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('COMPARATIVA')}
          className={`flex items-center space-x-2 py-3 px-5 border-b-2 font-bold text-sm transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'COMPARATIVA'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Evaluación e Inicio vs Cierre</span>
        </button>

        <button
          onClick={() => setActiveTab('TABLA')}
          className={`flex items-center space-x-2 py-3 px-5 border-b-2 font-bold text-sm transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'TABLA'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Listado de Clientes ({filteredRecords.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('HISTORIAL')}
          className={`flex items-center space-x-2 py-3 px-5 border-b-2 font-bold text-sm transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'HISTORIAL'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Histórico de Cortes ({snapshots.length})</span>
        </button>
      </div>

      {/* No Snapshot Banner if Empty */}
      {!loading && !currentSnapshot && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl p-6 text-center">
          <AlertTriangle className="w-10 h-10 text-amber-600 dark:text-amber-400 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-amber-900 dark:text-amber-200">
            No hay cartera registrada para el mes de {selectedMonth}
          </h3>
          <p className="text-sm text-amber-700 dark:text-amber-300 max-w-xl mx-auto mt-1 mb-4">
            Carga la cartera general mediante un archivo de Excel o agrega clientes manualmente para comenzar a clasificar por días de atraso y evaluar a tus cobradores.
          </p>
          <div className="flex items-center justify-center space-x-4">
            <button
              onClick={handleDownloadTemplate}
              className="flex items-center space-x-2 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 border border-neutral-300 dark:border-neutral-600 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-neutral-100 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Descargar Plantilla Excel</span>
            </button>
            <button
              onClick={() => {
                setPreviewRecords([]);
                setImportFileName('');
                setImportTitle(`Cartera General - ${selectedMonth}`);
                setImportAssignmentMode('GENERAL');
                setSelectedCollectorForImport('');
                setImportSnapshotType('CARGA_GENERAL');
                setImportMode('COLLECTOR');
                setIsImportModalOpen(true);
              }}
              className="flex items-center space-x-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-700 cursor-pointer shadow-md"
            >
              <Upload className="w-4 h-4" />
              <span>Cargar Cartera Ahora</span>
            </button>
          </div>
        </div>
      )}

      {/* ==================== TAB 1: ANÁLISIS Y SECTORIZACIÓN ==================== */}
      {activeTab === 'ANALISIS' && (
        <div className="space-y-8">
          {/* Supervisor Consolidated Banner */}
          {isSupervisor && supervisorConsolidatedView && currentSnapshot && (
            <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-6 rounded-2xl border border-indigo-500/20 shadow-lg space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <div className="p-3 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h2 className="text-lg font-bold">Vista Global Consolidada de Cartera (Supervisor)</h2>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                        Corte: {currentSnapshot.cutoffDate || selectedMonth}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-300 mt-0.5">
                      Sumatoria de todas las carteras y rutas registradas en la empresa sin duplicaciones.
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setActiveTab('RECUPERADOS')}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow transition-all flex items-center space-x-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Ver Recaudación Global ({currentRecoveredData.recoveredCount} registros)</span>
                  </button>
                </div>
              </div>

              {/* Consolidated Metrics Table by Collector */}
              <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/20 mt-3">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/5 border-b border-white/10 text-neutral-300 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="p-3">Cobrador / Ruta</th>
                      <th className="p-3 text-center">Clientes Mora</th>
                      <th className="p-3 text-right">Saldo Cartera</th>
                      <th className="p-3 text-center">% Empresa</th>
                      <th className="p-3 text-right">Sana (0-30d)</th>
                      <th className="p-3 text-right">Crítica (&gt;90d)</th>
                      <th className="p-3 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-medium">
                    {activeCollectorStats.map(col => {
                      const share = currentSnapshot.totalAmount > 0 ? (col.totalAmount / currentSnapshot.totalAmount) * 100 : 0;
                      const healthy = col.brackets['0-30']?.amount || 0;
                      const critical = (col.brackets['91-180']?.amount || 0) + (col.brackets['>181']?.amount || 0);

                      return (
                        <tr key={col.name} className="hover:bg-white/5 transition-colors">
                          <td className="p-3 font-bold text-white flex items-center space-x-2">
                            <span className="w-2 h-2 rounded-full bg-indigo-400" />
                            <span>{col.name}</span>
                          </td>
                          <td className="p-3 text-center font-bold text-neutral-300">
                            {col.totalClients}
                          </td>
                          <td className="p-3 text-right font-bold text-emerald-400 font-mono">
                            ${col.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-3 text-center font-semibold text-neutral-300">
                            {share.toFixed(1)}%
                          </td>
                          <td className="p-3 text-right text-emerald-300 font-mono">
                            ${healthy.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-3 text-right text-rose-300 font-mono">
                            ${critical.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => {
                                setSelectedCollectorFilter(col.name);
                                setActiveTab('TABLA');
                              }}
                              className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold cursor-pointer transition-all"
                            >
                              Auditar
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-white/10 border-t border-white/15 font-bold text-neutral-200">
                    <tr>
                      <td className="p-3">TOTAL CONSOLIDADO</td>
                      <td className="p-3 text-center">{currentSnapshot.totalClients}</td>
                      <td className="p-3 text-right font-mono text-emerald-300 text-sm">
                        ${currentSnapshot.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-center">100%</td>
                      <td className="p-3 text-right font-mono">
                        ${(currentSnapshot.bracketSummary['0-30']?.totalAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-right font-mono text-rose-300">
                        ${((currentSnapshot.bracketSummary['91-180']?.totalAmount || 0) + (currentSnapshot.bracketSummary['>181']?.totalAmount || 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-center">-</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Top Summary Metrics */}
          {currentSnapshot && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  Total Cartera General ({currentSnapshot.cutoffDate || selectedMonth})
                </span>
                <div className="text-2xl font-extrabold text-neutral-900 dark:text-neutral-50 mt-2">
                  ${currentSnapshot.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 font-medium">
                  {currentSnapshot.totalClients} clientes registrados
                </div>
              </div>

              <div className="bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-teal-200 dark:border-teal-900/50 bg-teal-50/20 dark:bg-teal-950/10 shadow-sm">
                <span className="text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                  0 Días (Al Día / Por Vencer)
                </span>
                <div className="text-2xl font-extrabold text-teal-600 dark:text-teal-400 mt-2">
                  ${((currentSnapshot.bracketSummary['0']?.totalAmount || 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 font-medium">
                  {currentSnapshot.bracketSummary['0']?.count || 0} clientes al día
                </div>
              </div>

              <div className="bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Cartera Vigente (1-30 Días)
                </span>
                <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-2">
                  ${((currentSnapshot.bracketSummary['1-30']?.totalAmount || currentSnapshot.bracketSummary['0-30']?.totalAmount || 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 font-medium">
                  {(currentSnapshot.bracketSummary['1-30']?.count || currentSnapshot.bracketSummary['0-30']?.count || 0)} clientes
                </div>
              </div>

              <div className="bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  Mora Temprana (31-90 Días)
                </span>
                <div className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-2">
                  ${((currentSnapshot.bracketSummary['31-60']?.totalAmount || 0) + (currentSnapshot.bracketSummary['61-90']?.totalAmount || 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 font-medium">
                  {(currentSnapshot.bracketSummary['31-60']?.count || 0) + (currentSnapshot.bracketSummary['61-90']?.count || 0)} clientes
                </div>
              </div>

              <div className="bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
                <span className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                  Mora Crítica (&gt;91 Días)
                </span>
                <div className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 mt-2">
                  ${((currentSnapshot.bracketSummary['91-180']?.totalAmount || 0) + (currentSnapshot.bracketSummary['>181']?.totalAmount || 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 font-medium">
                  {(currentSnapshot.bracketSummary['91-180']?.count || 0) + (currentSnapshot.bracketSummary['>181']?.count || 0)} clientes
                </div>
              </div>
            </div>
          )}

          {/* Aging Brackets Breakdown Grid */}
          <div>
            <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-50 mb-4 flex items-center space-x-2">
              <Layers className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <span>Distribución General por Días de Atraso</span>
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
              {AGING_BRACKETS.map(b => {
                const summary = currentSnapshot?.bracketSummary[b.key] || { count: 0, totalAmount: 0 };
                const pct = currentSnapshot?.totalAmount ? (summary.totalAmount / currentSnapshot.totalAmount) * 100 : 0;

                return (
                  <div
                    key={b.key}
                    onClick={() => {
                      setSelectedBracketFilter(b.key);
                      setActiveTab('TABLA');
                    }}
                    className={`bg-white dark:bg-neutral-900 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm hover:border-indigo-500 dark:hover:border-indigo-500 transition-all cursor-pointer group relative overflow-hidden`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`px-2 py-0.5 rounded-lg text-xs font-bold border ${b.badgeBg}`}>
                        {b.label}
                      </span>
                      <span className="text-[11px] font-semibold text-neutral-400">
                        {pct.toFixed(1)}%
                      </span>
                    </div>

                    <div className={`text-lg font-bold ${b.colorClass}`}>
                      ${summary.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>

                    <div className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mt-0.5">
                      {summary.count} clientes
                    </div>

                    {/* Progress indicator */}
                    <div className="w-full bg-neutral-100 dark:bg-neutral-800 h-1.5 rounded-full mt-2.5 overflow-hidden">
                      <div
                        className={`h-full ${
                          b.key === '0' ? 'bg-teal-500' :
                          b.key === '1-30' || b.key === '0-30' ? 'bg-emerald-500' :
                          b.key === '31-60' ? 'bg-amber-500' :
                          b.key === '61-90' ? 'bg-orange-500' :
                          b.key === '91-180' ? 'bg-rose-500' : 'bg-purple-600'
                        }`}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sectorization by Collector Cards */}
          <div>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
              <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-50 flex items-center space-x-2">
                <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <span>Sectorización por Cobrador / Ruta</span>
              </h2>

              <div className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                Haz clic en una ruta para filtrar la tabla detallada
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeCollectorStats.map(col => {
                return (
                  <div
                    key={col.name}
                    className="bg-white dark:bg-neutral-900 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm hover:shadow-md transition-all space-y-4"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                          Cobrador / Ruta
                        </span>
                        <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-50 mt-0.5">
                          {col.name}
                        </h3>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <button
                          onClick={() => {
                            setSelectedCollectorFilter(col.name);
                            setActiveTab('RECUPERADOS');
                          }}
                          title="Ver recaudación y abonos de este cobrador"
                          className="p-2 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 rounded-xl transition-colors text-xs font-bold flex items-center space-x-1 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Recaudación</span>
                        </button>
                        <button
                          onClick={() => {
                            setSelectedCollectorFilter(col.name);
                            setActiveTab('TABLA');
                          }}
                          className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900 rounded-xl transition-colors text-xs font-bold flex items-center space-x-1 cursor-pointer"
                        >
                          <span>Clientes</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Totals */}
                    <div className="grid grid-cols-2 gap-3 bg-neutral-50 dark:bg-neutral-800/50 p-3.5 rounded-xl border border-neutral-100 dark:border-neutral-800">
                      <div>
                        <div className="text-xs text-neutral-500 dark:text-neutral-400 font-semibold">Total Asignado</div>
                        <div className="text-lg font-extrabold text-neutral-900 dark:text-neutral-100">
                          ${col.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-neutral-500 dark:text-neutral-400 font-semibold">Clientes</div>
                        <div className="text-lg font-extrabold text-indigo-600 dark:text-indigo-400">
                          {col.totalClients}
                        </div>
                      </div>
                    </div>

                    {/* Aging Brackets Rows */}
                    <div className="space-y-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                      <div className="text-xs font-bold uppercase text-neutral-400 tracking-wider mb-1">
                        Desglose por Atraso
                      </div>

                      {AGING_BRACKETS.map(b => {
                        const bData = col.brackets[b.key] || { count: 0, amount: 0 };
                        return (
                          <div key={b.key} className="flex items-center justify-between text-xs py-1">
                            <span className="font-semibold text-neutral-700 dark:text-neutral-300 flex items-center space-x-2">
                              <span className={`w-2 h-2 rounded-full ${
                                b.key === '0-30' ? 'bg-emerald-500' :
                                b.key === '31-60' ? 'bg-amber-500' :
                                b.key === '61-90' ? 'bg-orange-500' :
                                b.key === '91-180' ? 'bg-rose-500' : 'bg-purple-600'
                              }`} />
                              <span>{b.label}</span>
                            </span>

                            <div className="text-right">
                              <span className="font-bold text-neutral-900 dark:text-neutral-100 mr-2">
                                ${bData.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </span>
                              <span className="text-neutral-400 font-medium">
                                ({bData.count})
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB 2: ANÁLISIS DE RECAUDACIÓN Y ABONOS ==================== */}
      {activeTab === 'RECUPERADOS' && (
        <div className="space-y-6">
          {/* Header Banner with Customizable Comparison Controls */}
          <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-emerald-950 text-white p-6 rounded-2xl shadow-lg border border-emerald-500/30 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                  Cartera Base: {currentRecoveredData.previousDate || 'Sin selección'}
                </span>
                <span className="text-xs text-emerald-200 font-bold">vs</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-400/20 text-teal-300 border border-teal-400/30">
                  Cartera a Evaluar: {currentRecoveredData.currentDate || 'Sin selección'}
                </span>
              </div>
              <h2 className="text-xl font-bold">
                Análisis de Recaudación y Abonos (Efectivo Recuperado)
              </h2>
              <p className="text-xs text-neutral-200 max-w-2xl leading-relaxed">
                Evaluación comparativa mediante la <strong>Huella Digital de 4 Factores</strong> (Cliente, Fecha de Venta, Artículo y Valor de Venta). Detecta liquidaciones totales de créditos y abonos parciales que disminuyen la deuda a favor de la empresa.
              </p>
            </div>

            {/* Cutoff Range Selectors & Export */}
            <div className="flex flex-wrap items-center gap-3 bg-white/10 p-3 rounded-xl backdrop-blur-sm border border-white/10">
              <div className="flex flex-col space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-emerald-200">
                  1. Cartera Base (Anterior)
                </label>
                <select
                  value={recoveryBaseDate}
                  onChange={(e) => setRecoveryBaseDate(e.target.value)}
                  className="px-3 py-1.5 bg-neutral-900/90 text-white border border-emerald-500/40 rounded-lg text-xs font-bold cursor-pointer focus:outline-none"
                >
                  {availableCutoffDatesAsc.map(d => (
                    <option key={`base_${d}`} value={d}>Corte: {d}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-teal-200">
                  2. Cartera Actual (A Evaluar)
                </label>
                <select
                  value={recoveryTargetDate}
                  onChange={(e) => setRecoveryTargetDate(e.target.value)}
                  className="px-3 py-1.5 bg-neutral-900/90 text-white border border-teal-500/40 rounded-lg text-xs font-bold cursor-pointer focus:outline-none"
                >
                  {availableCutoffDatesAsc.map(d => (
                    <option key={`target_${d}`} value={d}>Corte: {d}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-end self-end pt-1">
                <button
                  onClick={handleExportRecoveredExcel}
                  disabled={filteredRecoveredClients.length === 0}
                  className="flex items-center space-x-2 bg-white text-emerald-950 hover:bg-emerald-50 disabled:opacity-50 px-3.5 py-2 rounded-lg text-xs font-bold shadow-md transition-all cursor-pointer whitespace-nowrap"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>Exportar Reporte Excel</span>
                </button>
              </div>
            </div>
          </div>

          {/* Recovery KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white dark:bg-neutral-900 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Total Recaudado
                </span>
                <Coins className="w-5 h-5 text-emerald-500" />
              </div>
              <div className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-2 font-mono">
                ${currentRecoveredData.recoveredAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 font-medium">
                {currentRecoveredData.recoveredCount} créditos regularizados
              </div>
            </div>

            <div className="bg-white dark:bg-neutral-900 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                  Liquidación Total Real
                </span>
                <CheckCircle2 className="w-5 h-5 text-teal-500" />
              </div>
              <div className="text-xl font-extrabold text-teal-600 dark:text-teal-400 mt-2 font-mono">
                ${currentRecoveredData.liquidationsAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 font-medium">
                {currentRecoveredData.liquidationsCount} saldaron 100% de capital
              </div>
            </div>

            <div className="bg-white dark:bg-neutral-900 p-4 rounded-2xl border border-sky-200 dark:border-sky-900/50 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                  Puestos Al Día
                </span>
                <Sparkles className="w-5 h-5 text-sky-500" />
              </div>
              <div className="text-xl font-extrabold text-sky-600 dark:text-sky-400 mt-2 font-mono">
                ${currentRecoveredData.alDiaAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 font-medium">
                {currentRecoveredData.alDiaCount} cuotas al día (activos en Maestra)
              </div>
            </div>

            <div className="bg-white dark:bg-neutral-900 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  Abonos Parciales
                </span>
                <Clock className="w-5 h-5 text-amber-500" />
              </div>
              <div className="text-xl font-extrabold text-amber-600 dark:text-amber-400 mt-2 font-mono">
                ${currentRecoveredData.partialAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 font-medium">
                {currentRecoveredData.partialCount} clientes amortizaron cuota
              </div>
            </div>

            <div className="bg-white dark:bg-neutral-900 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  Validación Cruzada
                </span>
                <Database className="w-5 h-5 text-indigo-500" />
              </div>
              <div className="text-xs font-bold text-neutral-900 dark:text-neutral-100 mt-2">
                {masterSnapshot ? 'Cartera Maestra Activa' : 'Huella 4 Factores'}
              </div>
              <div className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-1 font-medium">
                {masterSnapshot ? `Corte ${masterSnapshot.cutoffDate}` : 'Corte Diario vs Base'}
              </div>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-neutral-900 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Buscar por cliente, artículo, cédula, operación..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs font-semibold focus:outline-none"
              />
            </div>

            <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
              <label className="text-xs font-bold text-neutral-500">Cobrador:</label>
              <select
                value={selectedCollectorFilter}
                onChange={(e) => setSelectedCollectorFilter(e.target.value)}
                className="px-3 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs font-bold cursor-pointer focus:outline-none"
              >
                <option value="TODOS">Todos los Cobradores</option>
                {registeredCollectors.map(col => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Recovered Clients Table */}
          {filteredRecoveredClients.length > 0 ? (
            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden mb-12">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 dark:bg-neutral-800/60 border-b border-neutral-200 dark:border-neutral-800 text-neutral-500 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="p-3.5">N° Operación</th>
                      <th className="p-3.5">Cliente</th>
                      <th className="p-3.5">Artículo / F. Venta</th>
                      <th className="p-3.5">Saldo Capital (Ant -&gt; Act)</th>
                      <th className="p-3.5">Valor Total Atraso &amp; Mora</th>
                      <th className="p-3.5 text-right">Abono Efectivo Recaudado</th>
                      <th className="p-3.5 text-center">F. Pago / Estado</th>
                      <th className="p-3.5">Cobrador Responsable</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 font-medium">
                    {filteredRecoveredClients.map((client, idx) => {
                      const isPartial = Boolean(
                        client.isPartialPayment ||
                        client.notes?.toLowerCase().includes('abono parcial') ||
                        (client.previousAmount !== undefined && client.previousAmount > client.amount && client.notes?.toLowerCase().includes('saldo anterior'))
                      );
                      const prevDebt = client.previousAmount !== undefined ? client.previousAmount : client.amount;
                      const currentDebt = isPartial ? Math.max(0, round2(prevDebt - client.amount)) : 0;
                      const prevOverdue = client.previousOverdueAmount !== undefined ? client.previousOverdueAmount : (client.overdueAmount || 0);
                      const currentOverdue = isPartial ? (client.overdueAmount || 0) : 0;

                      return (
                        <tr key={client.id || idx} className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/30 transition-colors">
                          <td className="p-3.5 font-mono font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                            {client.operationNumber || 'S/N'}
                          </td>
                          <td className="p-3.5 font-bold text-neutral-900 dark:text-neutral-100">
                            <div>{client.clientName}</div>
                            {client.identification && (
                              <div className="text-[10px] text-neutral-500 font-mono font-normal">
                                CI: {client.identification}
                              </div>
                            )}
                          </td>
                          <td className="p-3.5 text-neutral-700 dark:text-neutral-300">
                            <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                              {client.itemSold || 'Art. No especificado'}
                            </div>
                            <div className="text-[10px] text-neutral-500 flex items-center space-x-2">
                              {client.saleDate && <span>Venta: {client.saleDate}</span>}
                              {client.saleValue !== undefined && client.saleValue > 0 && (
                                <span className="font-mono">PVP: ${client.saleValue.toFixed(2)}</span>
                              )}
                            </div>
                          </td>
                          <td className="p-3.5 font-mono text-neutral-600 dark:text-neutral-300 whitespace-nowrap">
                            {isPartial ? (
                              <div className="flex items-center space-x-1.5 text-xs">
                                <span className="text-neutral-400 line-through decoration-neutral-400/50">${prevDebt.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                <span className="text-neutral-300">-&gt;</span>
                                <span className="font-bold text-amber-600 dark:text-amber-400">${currentDebt.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                              </div>
                            ) : (
                              <div className="flex items-center space-x-1.5 text-xs">
                                <span className="text-neutral-400 line-through decoration-neutral-400/50">${prevDebt.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                <span className="text-neutral-300">-&gt;</span>
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">$0.00</span>
                              </div>
                            )}
                          </td>
                          <td className="p-3.5 font-mono whitespace-nowrap">
                            {isPartial ? (
                              <div className="space-y-0.5">
                                <div className="flex items-center space-x-1.5 text-xs font-semibold">
                                  <span className="text-neutral-500">${prevOverdue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                  <span className="text-neutral-300">-&gt;</span>
                                  <span className="text-amber-600 dark:text-amber-400">${currentOverdue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="text-[10px] text-neutral-500 flex items-center space-x-1">
                                  <span>{client.previousOverdueDays !== undefined ? client.previousOverdueDays : 0}d</span>
                                  <span>-&gt;</span>
                                  <span className="font-bold text-amber-600">{client.overdueDays || 0}d mora</span>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-0.5">
                                <div className="flex items-center space-x-1.5 text-xs font-semibold">
                                  <span className="text-neutral-500">${prevOverdue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                  <span className="text-neutral-300">-&gt;</span>
                                  <span className="font-bold text-emerald-600 dark:text-emerald-400">$0.00</span>
                                </div>
                                <div className="text-[10px] text-neutral-500 flex items-center space-x-1">
                                  <span>{client.previousOverdueDays !== undefined ? client.previousOverdueDays : client.overdueDays || 0}d</span>
                                  <span>-&gt;</span>
                                  <span className="font-bold text-emerald-600">0d mora</span>
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="p-3.5 text-right font-mono text-[13px] font-black text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                            ${client.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-3.5 text-center flex flex-col items-center justify-center space-y-1">
                            {client.recoveredStatus === 'AL_DIA' ? (
                              <span className="inline-flex items-center justify-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-300 dark:border-sky-800" title="Al Día: Salió del reporte diario pero sigue activo en Cartera Maestra">
                                <Sparkles className="w-3 h-3 text-sky-600" />
                                <span>Puesto Al Día</span>
                              </span>
                            ) : (isPartial || client.recoveredStatus === 'ABONO_PARCIAL') ? (
                              <span className="inline-flex items-center justify-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400">
                                <Clock className="w-3 h-3" />
                                <span>Abono Parcial</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center justify-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Liquidación Total</span>
                              </span>
                            )}
                            {client.lastPaymentDate && (
                              <div className="text-[10px] font-mono text-neutral-500 font-medium">
                                U.Pago: {client.lastPaymentDate}
                                {client.lastPaymentAmount ? ` ($${client.lastPaymentAmount.toFixed(2)})` : ''}
                              </div>
                            )}
                          </td>
                          <td className="p-3.5 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold">
                              {client.collectorName}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-neutral-100/90 dark:bg-neutral-800/90 border-t-2 border-neutral-300 dark:border-neutral-700 font-bold text-neutral-800 dark:text-neutral-200">
                    <tr>
                      <td colSpan={5} className="py-4.5 px-4 text-right text-xs uppercase tracking-wider font-extrabold text-neutral-700 dark:text-neutral-200">
                        TOTAL CAPITAL RECUPERADO:
                      </td>
                      <td className="py-4.5 px-4 text-right font-mono text-sm md:text-base font-black text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        ${filteredRecoveredClients.reduce((acc, r) => acc + r.amount, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td colSpan={2} className="py-4.5 px-4 text-xs font-bold text-neutral-600 dark:text-neutral-300 whitespace-nowrap">
                        ({filteredRecoveredClients.length} créditos regularizados)
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-12 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                {currentRecoveredData.previousDate ? 'No se identificaron liquidaciones ni abonos en el período seleccionado' : 'Seleccione o cargue las carteras para comparar'}
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-md mx-auto mt-1">
                {currentRecoveredData.previousDate
                  ? 'Verifique que la Cartera Base sea anterior a la Cartera Actual, o ajuste el filtro de cobrador.'
                  : 'Al subir dos o más cortes de cartera, podrá comparar y auditar exactamente las recuperaciones efectivas.'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB: CRUCE Y COBERTURA DE RUTAS ==================== */}
      {activeTab === 'CRUCE_ASIGNACIONES' && (
        <PortfolioCrossAssignmentView
          masterSnapshot={masterSnapshot}
          currentSnapshot={currentSnapshot}
          snapshots={snapshots}
          assignmentStats={assignmentStats}
          assignmentFilter={assignmentFilter}
          setAssignmentFilter={setAssignmentFilter}
          onCrossAssignments={handleCrossAssignments}
          onExportUnassignedExcel={handleExportUnassignedExcel}
          onOpenImportMaster={() => {
            setImportMode('MASTER');
            setImportSnapshotType('CARTERA_MAESTRA');
            setImportAssignmentMode('GENERAL');
            setImportTitle('Cartera General Maestra GADA');
            setSelectedCollectorForImport('');
            setPreviewRecords([]);
            setImportFileName('');
            setIsImportModalOpen(true);
          }}
          isSaving={saving}
          onViewClientDetails={(client) => {
            setEditingClient(client);
            setManualForm({
              clientName: client.clientName,
              identification: client.identification || '',
              operationNumber: client.operationNumber || '',
              collectorName: client.collectorName,
              amount: round2(client.amount),
              overdueDays: client.overdueDays,
              phone: client.phone || '',
              itemSold: client.itemSold || '',
              address: client.address || '',
              notes: client.notes || ''
            });
            setIsManualModalOpen(true);
          }}
          onOpenWhatsAppModal={(client) => {
            setActiveWhatsAppClient(client);
            setCustomWhatsAppPhone(client.phone || '');
            setCustomWhatsAppText(generateWhatsAppMessage(client));
            setIsWhatsAppModalOpen(true);
          }}
          registeredCollectors={registeredCollectors}
        />
      )}

      {/* ==================== TAB 2: EVALUACIÓN INICIO VS CIERRE ==================== */}
      {activeTab === 'COMPARATIVA' && (
        <PortfolioTransitionAnalysis
          initialSnapshot={compareInitialSnapshot}
          closingSnapshot={compareClosingSnapshot}
          initialDate={compareStartDate || (currentSnapshot?.cutoffDate || selectedMonth)}
          closingDate={compareEndDate || (currentSnapshot?.cutoffDate || selectedMonth)}
          availableCutoffDates={availableCutoffDatesAsc}
          onSelectStartDate={setCompareStartDate}
          onSelectEndDate={setCompareEndDate}
          collectors={availableFilterCollectors}
          selectedCollectorFilter={selectedCollectorFilter}
          onCollectorFilterChange={setSelectedCollectorFilter}
          onSaveClosure={async () => {
            if (!currentSnapshot) return;
            const confirmed = await showConfirm(
              '¿Establecer como Corte Oficial de Cierre?',
              `¿Deseas guardar la cartera actual del corte ${compareEndDate || currentSnapshot.cutoffDate || selectedMonth} como el Corte Oficial de Cierre para la evaluación?`
            );
            if (!confirmed) return;

            try {
              setSaving(true);
              const closureSnap = buildSnapshotFromRecords(
                compareClosingSnapshot?.records || currentSnapshot.records,
                'CORTE_FINAL',
                `Corte Final de Cierre - ${compareEndDate || currentSnapshot.cutoffDate || selectedMonth}`,
                compareEndDate || currentSnapshot.cutoffDate
              );
              const savedSnap = await savePortfolioSnapshotToFirestore(closureSnap);
              setSnapshots(prev => [savedSnap, ...prev]);
              setCurrentSnapshot(savedSnap);
              showToast('Corte de Cierre guardado exitosamente', 'success');
            } catch (e) {
              console.error('Error saving closure snapshot:', e);
              handleFirestoreError(e, OperationType.CREATE, 'portfolio_snapshots');
              showToast('Error al guardar corte de cierre', 'error');
            } finally {
              setSaving(false);
            }
          }}
          isSavingClosure={saving}
        />
      )}

      {/* ==================== TAB 3: TABLA DETALLADA DE CLIENTES ==================== */}
      {activeTab === 'TABLA' && (
        <div className="space-y-6">
          {/* Real Monthly Cash-flow Analytical Summary Cards */}
          {filteredCashFlowSummary && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 text-white p-4.5 rounded-2xl shadow-sm space-y-1">
                <div className="flex items-center justify-between text-indigo-100 text-xs font-bold uppercase tracking-wider">
                  <span>Meta Exigible Este Mes</span>
                  <DollarSign className="w-4 h-4" />
                </div>
                <div className="text-2xl font-black font-mono">
                  ${filteredCashFlowSummary.monthlyCollectableTarget.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-[11px] text-indigo-100/90 font-medium">
                  Cuotas corrientes + atrasos exigibles en este corte
                </div>
              </div>

              <div className="bg-white dark:bg-neutral-900 p-4.5 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-1">
                <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider">
                  <span>Cuotas Corrientes al Día</span>
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                  ${filteredCashFlowSummary.currentInstallmentTarget.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium">
                  {filteredCashFlowSummary.clientsCurrentCycleCount} clientes al día con cuota del mes
                </div>
              </div>

              <div className="bg-white dark:bg-neutral-900 p-4.5 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-1">
                <div className="flex items-center justify-between text-rose-600 dark:text-rose-400 text-xs font-bold uppercase tracking-wider">
                  <span>Atrasos Exigibles (Mora)</span>
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div className="text-2xl font-black font-mono text-rose-600 dark:text-rose-400">
                  ${filteredCashFlowSummary.overdueArrearsTarget.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium">
                  {filteredCashFlowSummary.clientsInArrearsCount} clientes con valores vencidos
                </div>
              </div>

              <div className="bg-white dark:bg-neutral-900 p-4.5 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-1">
                <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 text-xs font-bold uppercase tracking-wider">
                  <span>Capital Futuro (2026-2027)</span>
                  <Layers className="w-4 h-4 text-neutral-400" />
                </div>
                <div className="text-2xl font-black font-mono text-neutral-800 dark:text-neutral-200">
                  ${filteredCashFlowSummary.longTermFutureDebt.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium">
                  Total Cartera: ${filteredCashFlowSummary.totalPortfolioBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          )}

          {/* Filters Bar */}
          <div className="bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto flex-1">
              {/* Search input */}
              <div className="relative flex-1 min-w-[240px] md:max-w-xs">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Buscar cliente, cédula, celular, ítem, dirección..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-neutral-100 dark:bg-neutral-800 rounded-xl text-sm border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Collector Filter */}
              <select
                value={selectedCollectorFilter}
                onChange={(e) => setSelectedCollectorFilter(e.target.value)}
                className="bg-neutral-100 dark:bg-neutral-800 text-sm font-semibold text-neutral-800 dark:text-neutral-200 px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 focus:outline-none cursor-pointer"
              >
                <option value="TODOS">Todos los Cobradores / Rutas</option>
                {availableFilterCollectors.map(col => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>

              {/* Assignment Filter */}
              <select
                value={assignmentFilter}
                onChange={(e) => setAssignmentFilter(e.target.value as 'TODOS' | 'ASIGNADOS' | 'SIN_ASIGNAR')}
                className="bg-neutral-100 dark:bg-neutral-800 text-sm font-semibold text-neutral-800 dark:text-neutral-200 px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 focus:outline-none cursor-pointer"
              >
                <option value="TODOS">Todas las Asignaciones</option>
                <option value="ASIGNADOS">Solo Asignados a Rutas</option>
                <option value="SIN_ASIGNAR">Sin Asignar / En Oficina / Fugas</option>
              </select>

              {/* Bracket Filter */}
              <select
                value={selectedBracketFilter}
                onChange={(e) => setSelectedBracketFilter(e.target.value)}
                className="bg-neutral-100 dark:bg-neutral-800 text-sm font-semibold text-neutral-800 dark:text-neutral-200 px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 focus:outline-none cursor-pointer"
              >
                <option value="TODOS">Todos los Rangos de Atraso</option>
                {AGING_BRACKETS.map(b => (
                  <option key={b.key} value={b.key}>{b.label}</option>
                ))}
              </select>

              {/* Sort Selector */}
              <div className="flex items-center space-x-1.5 bg-neutral-100 dark:bg-neutral-800 px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700">
                <ArrowUpDown className="w-3.5 h-3.5 text-neutral-500" />
                <span className="text-xs font-semibold text-neutral-500">Ordenar:</span>
                <select
                  value={`${sortField}-${sortDirection}`}
                  onChange={(e) => {
                    const [f, d] = e.target.value.split('-');
                    setSortField(f as 'overdueDays' | 'amount' | 'clientName');
                    setSortDirection(d as 'asc' | 'desc');
                  }}
                  className="bg-transparent text-xs font-bold text-neutral-800 dark:text-neutral-200 focus:outline-none cursor-pointer"
                >
                  <option value="overdueDays-desc">Días Mora (Mayor a Menor)</option>
                  <option value="overdueDays-asc">Días Mora (Menor a Mayor)</option>
                  <option value="amount-desc">Monto Saldo (Mayor a Menor)</option>
                  <option value="amount-asc">Monto Saldo (Menor a Mayor)</option>
                  <option value="clientName-asc">Nombre Cliente (A - Z)</option>
                  <option value="clientName-desc">Nombre Cliente (Z - A)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center space-x-3 w-full md:w-auto justify-end">
              <button
                onClick={handleExportFilteredExcel}
                className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer shadow-sm whitespace-nowrap"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Exportar Excel ({filteredRecords.length})</span>
              </button>
            </div>
          </div>

          {/* Top Prominent Pagination & Record Counter */}
          <div className="bg-white dark:bg-neutral-900 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Mostrar por página:
              </span>
              <div className="flex items-center space-x-1.5 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-xl border border-neutral-200 dark:border-neutral-700">
                {[10, 25, 50, 100].map(sz => (
                  <button
                    key={sz}
                    onClick={() => {
                      setPageSize(sz);
                      setCurrentPage(1);
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      pageSize === sz
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                    }`}
                  >
                    {sz}
                  </button>
                ))}
              </div>
              <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                (Mostrando {filteredRecords.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} - {Math.min(currentPage * pageSize, filteredRecords.length)} de {filteredRecords.length})
              </span>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="p-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 disabled:opacity-40 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 transition-colors text-xs font-bold"
                  title="Primera Página"
                >
                  &laquo;
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 disabled:opacity-40 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 transition-colors text-xs font-bold flex items-center space-x-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Anterior</span>
                </button>

                <span className="text-xs font-bold px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-xl text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-700">
                  Página {currentPage} de {totalPages}
                </span>

                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 disabled:opacity-40 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 transition-colors text-xs font-bold flex items-center space-x-1"
                >
                  <span className="hidden sm:inline">Siguiente</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 disabled:opacity-40 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 transition-colors text-xs font-bold"
                  title="Última Página"
                >
                  &raquo;
                </button>
              </div>
            )}
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden mb-6">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-neutral-50 dark:bg-neutral-800/60 text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider border-b border-neutral-200 dark:border-neutral-800">
                    <th 
                      onClick={() => {
                        if (sortField === 'clientName') {
                          setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortField('clientName');
                          setSortDirection('asc');
                        }
                      }}
                      className="py-3.5 px-4 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors select-none"
                      title="Ordenar por Nombre de Cliente"
                    >
                      <div className="flex items-center space-x-1">
                        <span>Cliente / Identificación</span>
                        {sortField === 'clientName' ? (
                          sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-indigo-600" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-600" />
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-neutral-400 opacity-40" />
                        )}
                      </div>
                    </th>
                    <th className="py-3.5 px-4">Contacto / Celular</th>
                    <th className="py-3.5 px-4">Articulo / Factura</th>
                    <th className="py-3.5 px-4 hidden lg:table-cell">Venta & Pagos</th>
                    <th className="py-3.5 px-4">Cobrador / Ruta</th>
                    <th 
                      onClick={() => {
                        if (sortField === 'overdueDays') {
                          setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortField('overdueDays');
                          setSortDirection('desc');
                        }
                      }}
                      className="py-3.5 px-4 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors select-none"
                      title="Ordenar por Días de Atraso"
                    >
                      <div className="flex items-center space-x-1">
                        <span>Días Atraso</span>
                        {sortField === 'overdueDays' ? (
                          sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-indigo-600" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-600" />
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-neutral-400 opacity-40" />
                        )}
                      </div>
                    </th>
                    <th className="py-3.5 px-4">Rango Atraso</th>
                    <th className="py-3.5 px-4 text-right">Exigible Mes ($)</th>
                    <th 
                      onClick={() => {
                        if (sortField === 'amount') {
                          setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortField('amount');
                          setSortDirection('desc');
                        }
                      }}
                      className="py-3.5 px-4 text-right cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors select-none"
                      title="Ordenar por Saldo Total"
                    >
                      <div className="flex items-center justify-end space-x-1">
                        <span>Saldo Total (2027)</span>
                        {sortField === 'amount' ? (
                          sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-indigo-600" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-600" />
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-neutral-400 opacity-40" />
                        )}
                      </div>
                    </th>
                    <th className="py-3.5 px-4 text-center">Gestión Cobro</th>
                    <th className="py-3.5 px-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 text-sm">
                  {paginatedRecords.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-8 text-center text-neutral-500 dark:text-neutral-400">
                        No se encontraron registros de clientes con los filtros aplicados.
                      </td>
                    </tr>
                  ) : (
                    paginatedRecords.map((r) => {
                      const bracketMeta = AGING_BRACKETS.find(b => b.key === r.bracket);
                      const isZeroDays = r.overdueDays === 0;
                      const monthlyEval = evaluateMonthlyDue(r, currentSnapshot?.cutoffDate);

                      return (
                        <tr key={r.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-neutral-900 dark:text-neutral-100">{r.clientName}</div>
                            {r.identification && (
                              <div className="text-xs text-neutral-400 font-mono">{r.identification}</div>
                            )}
                            {r.address && (
                              <div className="flex items-center space-x-1 text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5" title={r.address}>
                                <MapPin className="w-3 h-3 text-neutral-400 shrink-0" />
                                <span className="truncate max-w-[200px]">{r.address}</span>
                              </div>
                            )}
                          </td>

                          {/* Contacto / Celular */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {r.phone ? (
                              <button
                                onClick={() => {
                                  setActiveWhatsAppClient(r);
                                  setCustomWhatsAppPhone(r.phone || '');
                                  setCustomWhatsAppText(generateWhatsAppMessage(r));
                                  setIsWhatsAppModalOpen(true);
                                }}
                                className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800 transition-all cursor-pointer"
                                title="Enviar mensaje de cobro por WhatsApp"
                              >
                                <MessageCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                <span>{formatEcuadorianPhone(r.phone) || r.phone}</span>
                              </button>
                            ) : (
                              <span className="text-xs text-neutral-400 italic">Sin celular</span>
                            )}
                          </td>

                          {/* Articulo / Operación */}
                          <td className="py-3.5 px-4">
                            <div className="font-medium text-neutral-800 dark:text-neutral-200">
                              {r.itemSold || '-'}
                            </div>
                            {r.operationNumber && (
                              <div className="text-xs text-neutral-400 font-mono">
                                Op: {r.operationNumber}
                              </div>
                            )}
                          </td>

                          {/* Venta & Pagos */}
                          <td className="py-3.5 px-4 hidden lg:table-cell text-xs">
                            <div className="flex flex-col space-y-1">
                              {r.saleValue !== undefined && r.saleValue !== null && r.saleValue > 0 && (
                                <div className="flex justify-between items-center text-neutral-600 dark:text-neutral-400">
                                  <span>Venta:</span>
                                  <span className="font-bold text-neutral-800 dark:text-neutral-200">${r.saleValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                </div>
                              )}
                              {r.totalPayments !== undefined && r.totalPayments !== null && r.totalPayments > 0 && (
                                <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-500">
                                  <span>Abonos:</span>
                                  <span className="font-bold">${r.totalPayments.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                </div>
                              )}
                              {r.pendingDownPayment !== undefined && r.pendingDownPayment !== null && r.pendingDownPayment > 0 && (
                                <div className="flex justify-between items-center text-amber-600 dark:text-amber-500">
                                  <span>Entrada:</span>
                                  <span className="font-bold">${r.pendingDownPayment.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                </div>
                              )}
                              {r.installmentAmount !== undefined && r.installmentAmount !== null && r.installmentAmount > 0 && (
                                <div className="flex justify-between items-center text-indigo-600 dark:text-indigo-400 border-t border-neutral-100 dark:border-neutral-800 pt-1 mt-1">
                                  <span>Cuota {r.installmentNumber ? `(#${r.installmentNumber})` : ''}:</span>
                                  <span className="font-bold">${r.installmentAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                </div>
                              )}
                              {(!r.saleValue && !r.totalPayments && !r.pendingDownPayment && !r.installmentAmount) && (
                                <span className="text-neutral-400 italic">No registrado</span>
                              )}
                            </div>
                          </td>

                          {/* Cobrador */}
                          <td className="py-3.5 px-4 font-medium">
                            {r.isUnassigned || !r.collectorName || r.collectorName.toLowerCase().includes('sin asignar') || r.collectorName.toLowerCase().includes('oficina') ? (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800 whitespace-nowrap">
                                <UserX className="w-3 h-3 text-amber-600" />
                                <span>Sin Asignar / Oficina</span>
                              </span>
                            ) : (
                              <span className="text-neutral-800 dark:text-neutral-200 flex items-center space-x-1">
                                <UserCheck className="w-3.5 h-3.5 text-emerald-500 inline shrink-0" />
                                <span>{r.collectorName}</span>
                              </span>
                            )}
                          </td>

                          {/* Días Atraso */}
                          <td className="py-3.5 px-4">
                            {isZeroDays ? (
                              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                                <CheckCircle2 className="w-3 h-3 text-teal-600" />
                                <span>0 días (Al Día)</span>
                              </span>
                            ) : (
                              <div className="font-bold text-neutral-900 dark:text-neutral-100">
                                {r.overdueDays} días
                              </div>
                            )}
                          </td>

                          {/* Rango */}
                          <td className="py-3.5 px-4">
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${bracketMeta?.badgeBg || ''}`}>
                              {bracketMeta?.label || (isZeroDays ? '0 Días (Al Día / Por Vencer)' : r.bracket)}
                            </span>
                          </td>

                          {/* Exigible Este Mes */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="font-extrabold font-mono text-indigo-600 dark:text-indigo-400 text-sm">
                              ${monthlyEval.monthlyDueAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </div>
                            <div className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate max-w-[130px] ml-auto" title={monthlyEval.explanation}>
                              {monthlyEval.statusLabel}
                            </div>
                          </td>

                          {/* Monto Saldo Total */}
                          <td className="py-3.5 px-4 text-right font-extrabold text-neutral-900 dark:text-neutral-100 font-mono">
                            ${r.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>

                          {/* Gestión WhatsApp */}
                          <td className="py-3.5 px-4 text-center">
                            <button
                              onClick={() => {
                                setActiveWhatsAppClient(r);
                                setCustomWhatsAppPhone(r.phone || '');
                                setCustomWhatsAppText(generateWhatsAppMessage(r));
                                setIsWhatsAppModalOpen(true);
                              }}
                              className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-sm cursor-pointer"
                              title="Gestionar Cobro por WhatsApp"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              <span>Cobrar</span>
                            </button>
                          </td>

                          {/* Acciones */}
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center space-x-2">
                              <button
                                onClick={() => {
                                  setEditingClient(r);
                                  setManualForm({
                                    clientName: r.clientName,
                                    identification: r.identification || '',
                                    operationNumber: r.operationNumber || '',
                                    collectorName: r.collectorName,
                                    amount: round2(r.amount),
                                    overdueDays: r.overdueDays,
                                    phone: r.phone || '',
                                    itemSold: r.itemSold || '',
                                    address: r.address || '',
                                    notes: r.notes || ''
                                  });
                                  setIsManualModalOpen(true);
                                }}
                                className="p-1.5 text-neutral-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                                title="Editar Cliente"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => handleDeleteClient(r.id)}
                                className="p-1.5 text-neutral-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                                title="Eliminar Registro"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot className="bg-neutral-100/90 dark:bg-neutral-800/90 border-t-2 border-neutral-300 dark:border-neutral-700 font-bold text-neutral-800 dark:text-neutral-200">
                  <tr>
                    <td colSpan={7} className="py-4.5 px-4 text-right text-xs uppercase tracking-wider font-extrabold text-neutral-700 dark:text-neutral-200">
                      TOTAL GLOBAL (FILTRO COMPLETO):
                    </td>
                    <td className="py-4.5 px-4 text-right font-mono text-sm font-black text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                      ${(filteredCashFlowSummary?.monthlyCollectableTarget || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-4.5 px-4 text-right font-mono text-sm md:text-base font-black text-neutral-900 dark:text-neutral-100 whitespace-nowrap">
                      ${filteredRecords.reduce((acc, r) => acc + r.amount, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td colSpan={2} className="py-4.5 px-4 text-center text-xs font-bold text-neutral-600 dark:text-neutral-300 whitespace-nowrap">
                      ({filteredRecords.length} clientes totales)
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Bottom Pagination Bar */}
          {totalPages > 1 && (
            <div className="bg-white dark:bg-neutral-900 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 mb-12">
              <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                Página {currentPage} de {totalPages} • Mostrando {paginatedRecords.length} registros de {filteredRecords.length} filtrados
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 disabled:opacity-40 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 transition-colors text-xs font-bold"
                >
                  Primera
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 disabled:opacity-40 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 transition-colors text-xs font-bold flex items-center space-x-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Anterior</span>
                </button>
                <span className="text-xs font-extrabold px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded-xl border border-indigo-200 dark:border-indigo-800">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 disabled:opacity-40 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 transition-colors text-xs font-bold flex items-center space-x-1"
                >
                  <span>Siguiente</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 disabled:opacity-40 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 transition-colors text-xs font-bold"
                >
                  Última
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB 4: HISTORIAL DE CORTES ==================== */}
      {activeTab === 'HISTORIAL' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {snapshots.map(s => (
              <div key={s.id} className="bg-white dark:bg-neutral-900 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                      s.snapshotType === 'CORTE_INICIAL' ? 'bg-indigo-100 text-indigo-700' :
                      s.snapshotType === 'CORTE_FINAL' ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-100 text-neutral-700'
                    }`}>
                      {s.snapshotType.replace('_', ' ')}
                    </span>
                    <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-50 mt-2">
                      {s.title}
                    </h3>
                  </div>

                  <button
                    onClick={() => handleDeleteSnapshot(s.id!)}
                    className="p-1.5 text-neutral-400 hover:text-rose-600 transition-colors cursor-pointer"
                    title="Eliminar Corte"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 bg-neutral-50 dark:bg-neutral-800/50 p-3 rounded-xl">
                  <div>
                    <div className="text-xs text-neutral-400 font-semibold">Total Cartera</div>
                    <div className="text-base font-extrabold text-neutral-900 dark:text-neutral-100">
                      ${s.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-neutral-400 font-semibold">Total Clientes</div>
                    <div className="text-base font-extrabold text-indigo-600 dark:text-indigo-400">
                      {s.totalClients}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setCurrentSnapshot(s);
                    setSelectedMonth(s.month);
                    setActiveTab('ANALISIS');
                    showToast(`Corte "${s.title}" seleccionado para análisis`, 'info');
                  }}
                  className="w-full py-2 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-900 dark:text-neutral-100 font-bold text-xs rounded-xl transition-all cursor-pointer text-center"
                >
                  Cargar este Corte para Análisis
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================== MODAL: CARGAR EXCEL ==================== */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-neutral-900 max-w-3xl w-full rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-50">
                    Cargar Cartera General desde Excel
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Sube un archivo .xlsx para clasificar automáticamente por días de atraso
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsImportModalOpen(false)}
                className="p-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              {/* Type of Snapshot, Cutoff Date & Title */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-neutral-500 dark:text-neutral-400 mb-1.5">
                    Tipo de Carga
                  </label>
                  <div className="flex p-1 bg-neutral-100 dark:bg-neutral-800 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setImportSnapshotType('CARGA_GENERAL')}
                      className={`flex-1 py-1.5 px-2 rounded-lg text-[10px] font-bold uppercase transition-all ${
                        importSnapshotType === 'CARGA_GENERAL' ? 'bg-white dark:bg-neutral-700 shadow-sm text-indigo-600' : 'text-neutral-500'
                      }`}
                    >
                      General
                    </button>
                    <button
                      type="button"
                      onClick={() => setImportSnapshotType('CORTE_INICIAL')}
                      className={`flex-1 py-1.5 px-2 rounded-lg text-[10px] font-bold uppercase transition-all ${
                        importSnapshotType === 'CORTE_INICIAL' ? 'bg-white dark:bg-neutral-700 shadow-sm text-indigo-600' : 'text-neutral-500'
                      }`}
                    >
                      Inicio
                    </button>
                    <button
                      type="button"
                      onClick={() => setImportSnapshotType('CORTE_FINAL')}
                      className={`flex-1 py-1.5 px-2 rounded-lg text-[10px] font-bold uppercase transition-all ${
                        importSnapshotType === 'CORTE_FINAL' ? 'bg-white dark:bg-neutral-700 shadow-sm text-indigo-600' : 'text-neutral-500'
                      }`}
                    >
                      Cierre
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setImportSnapshotType('CARTERA_MAESTRA');
                        setImportAssignmentMode('GENERAL');
                        setSelectedCollectorForImport('');
                        if (!importTitle || importTitle.startsWith('Corte Cartera')) {
                          setImportTitle(`Cartera General Maestra GADA - ${importCutoffDate}`);
                        }
                      }}
                      className={`flex-1 py-1.5 px-2 rounded-lg text-[10px] font-bold uppercase transition-all ${
                        importSnapshotType === 'CARTERA_MAESTRA' ? 'bg-white dark:bg-neutral-700 shadow-sm text-indigo-600' : 'text-neutral-500'
                      }`}
                      title="Cartera Maestra de Toda la Empresa para Cruce y Auditoría de Rutas"
                    >
                      Maestra
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-neutral-500 dark:text-neutral-400 mb-1.5">
                    Fecha de Corte *
                  </label>
                  <div className="flex items-center space-x-2 bg-neutral-100 dark:bg-neutral-800 px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700">
                    <Calendar className="w-4 h-4 text-neutral-400" />
                    <input
                      type="date"
                      value={importCutoffDate}
                      onChange={(e) => setImportCutoffDate(e.target.value)}
                      className="bg-transparent text-xs font-bold text-neutral-800 dark:text-neutral-100 focus:outline-none w-full cursor-pointer"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-neutral-500 dark:text-neutral-400 mb-1.5">
                    Título descriptivo
                  </label>
                  <input
                    type="text"
                    value={importTitle}
                    onChange={(e) => setImportTitle(e.target.value)}
                    placeholder="ej. Cartera General GADA - Septiembre"
                    className="w-full px-3 py-2 bg-neutral-100 dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-semibold focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-4">
                {/* Paso 1: Modo de Asignación y Cobrador */}
                <div className="bg-neutral-50 dark:bg-neutral-800/50 p-4 rounded-xl border border-neutral-200 dark:border-neutral-700 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-bold text-neutral-800 dark:text-neutral-200">
                      1. Modalidad de Asignación de Cobrador
                    </label>
                    <span className="text-[11px] font-semibold text-neutral-500">
                      ¿Cómo vincular los clientes del archivo?
                    </span>
                  </div>

                  {/* Selector de Modalidad */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setImportAssignmentMode('GENERAL');
                        setSelectedCollectorForImport('');
                      }}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start space-x-2.5 ${
                        importAssignmentMode === 'GENERAL'
                          ? 'bg-indigo-50/90 dark:bg-indigo-950/60 border-indigo-500 text-indigo-900 dark:text-indigo-200 shadow-sm ring-1 ring-indigo-500'
                          : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                      }`}
                    >
                      <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                        importAssignmentMode === 'GENERAL' ? 'bg-indigo-600 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500'
                      }`}>
                        <FileSpreadsheet className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold">Cartera General / Multi-Cobrador</div>
                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 leading-snug">
                          <strong>Sin seleccionar cobrador.</strong> El sistema lee automáticamente la columna de cobrador de cada fila del Excel (o marca &quot;Sin Asignar / En Oficina&quot; si no tiene).
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setImportAssignmentMode('COLLECTOR');
                      }}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start space-x-2.5 ${
                        importAssignmentMode === 'COLLECTOR'
                          ? 'bg-indigo-50/90 dark:bg-indigo-950/60 border-indigo-500 text-indigo-900 dark:text-indigo-200 shadow-sm ring-1 ring-indigo-500'
                          : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                      }`}
                    >
                      <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                        importAssignmentMode === 'COLLECTOR' ? 'bg-indigo-600 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500'
                      }`}>
                        <Users className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold">Asignar a Cobrador Específico</div>
                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 leading-snug">
                          Fuerza la asignación de todos los clientes de este archivo a un cobrador determinado.
                        </p>
                      </div>
                    </button>
                  </div>

                  {/* Selector de Cobrador si es modo específico */}
                  {importAssignmentMode === 'COLLECTOR' && (
                    <div className="pt-2 animate-fade-in space-y-1.5">
                      <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300">
                        Selecciona el cobrador responsable:
                      </label>
                      <div className="relative">
                        <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                        <select
                          value={selectedCollectorForImport}
                          onChange={(e) => setSelectedCollectorForImport(e.target.value)}
                          className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-600 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all cursor-pointer"
                        >
                          <option value="">Seleccione un cobrador...</option>
                          {registeredCollectors.map(col => (
                            <option key={col} value={col}>{col}</option>
                          ))}
                        </select>
                      </div>
                      {registeredCollectors.length === 0 && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                          No se encontraron cobradores registrados en la empresa. Por favor regístrelos en la sección de Personal.
                        </p>
                      )}
                    </div>
                  )}

                  {importAssignmentMode === 'GENERAL' && (
                    <div className="flex items-center space-x-2 text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/30 px-3 py-2 rounded-xl border border-emerald-200 dark:border-emerald-800/50">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>
                        <strong>Modo Cartera General activo:</strong> Puedes subir tu archivo Excel inmediatamente sin seleccionar cobrador.
                      </span>
                    </div>
                  )}
                </div>

                {/* Paso 2: Dropzone */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold uppercase text-neutral-500 dark:text-neutral-400">
                      2. Subir Archivo Excel
                    </label>
                    <button
                      type="button"
                      onClick={handleDownloadTemplate}
                      className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold hover:underline flex items-center space-x-1 cursor-pointer"
                    >
                      <Download className="w-3 h-3" />
                      <span>Descargar Plantilla de Ejemplo</span>
                    </button>
                  </div>

                  {(() => {
                    const isFileDropAllowed = importAssignmentMode === 'GENERAL' || Boolean(selectedCollectorForImport);
                    return (
                      <div className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all ${
                        !isFileDropAllowed 
                          ? 'bg-neutral-100 dark:bg-neutral-800/20 border-neutral-200 dark:border-neutral-800 opacity-50 cursor-not-allowed'
                          : 'bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 hover:border-indigo-500 cursor-pointer'
                      }`}>
                        <FileSpreadsheet className={`w-10 h-10 mx-auto mb-2 ${isFileDropAllowed ? 'text-indigo-600' : 'text-neutral-400'}`} />
                        <p className="text-sm font-bold text-neutral-800 dark:text-neutral-200">
                          {importFileName ? importFileName : 'Seleccionar Excel (.xlsx / .xls)'}
                        </p>
                        <p className="text-[10px] text-neutral-400 mt-1 px-4">
                          Columnas: Cliente, Dirección, Articulo, Saldo, Días Mora, Cobrador
                        </p>

                        <input
                          type="file"
                          accept=".xlsx, .xls"
                          onChange={handleFileUpload}
                          className="hidden"
                          id="excel-file-input"
                          disabled={!isFileDropAllowed}
                        />
                        <label
                          htmlFor="excel-file-input"
                          className={`inline-block mt-4 px-4 py-2 text-white rounded-xl text-xs font-bold shadow-sm transition-all ${
                            !isFileDropAllowed ? 'bg-neutral-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 cursor-pointer'
                          }`}
                        >
                          {importFileName ? 'Cambiar Archivo' : 'Examinar Archivo'}
                        </label>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Preview & Comparison */}
              {previewRecords.length > 0 && (
                <div className="space-y-4">
                  {/* Comparison Summary against previous snapshot */}
                  {importComparison && (
                    <div className="bg-neutral-50 dark:bg-neutral-800/60 p-4 rounded-xl border border-neutral-200 dark:border-neutral-700 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100 flex items-center space-x-1.5">
                          <RefreshCw className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                          <span>Comparativa vs Corte Anterior ({importComparison.previousCutoffDate || 'Sin corte previo'})</span>
                        </span>
                        <span className="text-[11px] font-semibold text-neutral-500">
                          Criterio: Huella 4 Factores (Nombre + Fecha Venta + Ítem + Valor)
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="p-2.5 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700/60">
                          <div className="text-neutral-500 text-[10px] font-bold uppercase">Continúan en Mora</div>
                          <div className="text-base font-extrabold text-neutral-800 dark:text-neutral-200 mt-0.5">
                            {importComparison.updatedCount}
                          </div>
                          <div className="text-[10px] text-neutral-400 font-mono font-medium">
                            ${importComparison.updatedAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </div>
                        </div>

                        <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60">
                          <div className="text-amber-700 dark:text-amber-400 text-[10px] font-bold uppercase">Nuevos en Mora</div>
                          <div className="text-base font-extrabold text-amber-600 dark:text-amber-400 mt-0.5">
                            +{importComparison.newCount}
                          </div>
                          <div className="text-[10px] text-amber-600 dark:text-amber-400 font-mono font-medium">
                            +${importComparison.newAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </div>
                        </div>

                        <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60">
                          <div className="text-emerald-700 dark:text-emerald-400 text-[10px] font-bold uppercase">Total Recaudado</div>
                          <div className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
                            {importComparison.recoveredCount}
                          </div>
                          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-medium">
                            ${importComparison.recoveredAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                      </div>

                      <p className="text-[10px] text-neutral-500 dark:text-neutral-400 italic">
                        * Control de duplicidad y abonos activo: Se registrará la cartera al corte seleccionado. Los clientes que liquidaron su deuda y los abonos parciales realizados pasarán automáticamente a la pestaña "Análisis de Recaudación y Abonos".
                      </p>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase text-emerald-600 dark:text-emerald-400">
                      Vista Previa ({previewRecords.length} registros en archivo)
                    </span>
                    <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                      Total Archivo: ${previewRecords.reduce((acc, r) => acc + r.amount, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="max-h-48 overflow-y-auto border border-neutral-200 dark:border-neutral-800 rounded-xl divide-y text-xs">
                    {previewRecords.slice(0, 10).map((r, i) => (
                      <div key={i} className="p-2.5 flex items-center justify-between">
                        <div>
                          <span className="font-bold">{r.clientName}</span> ({r.collectorName})
                          {r.operationNumber && <span className="ml-2 text-[10px] text-neutral-400">Op: {r.operationNumber}</span>}
                        </div>
                        <div className="font-mono font-bold">
                          ${r.amount.toFixed(2)} | {r.overdueDays} días mora
                        </div>
                      </div>
                    ))}
                    {previewRecords.length > 10 && (
                      <div className="p-2 text-center text-neutral-400 text-xs">
                        ...y {previewRecords.length - 10} registros más.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-end space-x-3 bg-neutral-50 dark:bg-neutral-800/50">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-neutral-600 hover:bg-neutral-200 dark:text-neutral-300 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={saving || previewRecords.length === 0}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold shadow-md cursor-pointer flex items-center space-x-2"
              >
                {saving ? (
                  <span>Guardando...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Guardar Cartera ({previewRecords.length})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL: REGISTRO MANUAL ==================== */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-neutral-900 max-w-lg w-full rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
              <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-50">
                {editingClient ? 'Editar Cliente de Cartera' : 'Agregar Cliente a Cartera'}
              </h3>
              <button
                onClick={() => setIsManualModalOpen(false)}
                className="p-1.5 text-neutral-400 hover:text-neutral-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-sm max-h-[75vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-bold uppercase text-neutral-500 mb-1">Nombre / Razón Social *</label>
                <input
                  type="text"
                  value={manualForm.clientName}
                  onChange={(e) => setManualForm(prev => ({ ...prev, clientName: e.target.value }))}
                  placeholder="ej. Juan Pérez"
                  className="w-full px-3.5 py-2 bg-neutral-100 dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 font-semibold focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-neutral-500 mb-1">Cédula / RUC</label>
                  <input
                    type="text"
                    value={manualForm.identification}
                    onChange={(e) => setManualForm(prev => ({ ...prev, identification: e.target.value }))}
                    placeholder="1712345678"
                    className="w-full px-3.5 py-2 bg-neutral-100 dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 font-semibold focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-neutral-500 mb-1">N° Operación/Factura</label>
                  <input
                    type="text"
                    value={manualForm.operationNumber}
                    onChange={(e) => setManualForm(prev => ({ ...prev, operationNumber: e.target.value }))}
                    placeholder="FAC-001"
                    className="w-full px-3.5 py-2 bg-neutral-100 dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 font-semibold focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-neutral-500 mb-1">Celular / WhatsApp</label>
                  <input
                    type="text"
                    value={manualForm.phone}
                    onChange={(e) => setManualForm(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="0991234567"
                    className="w-full px-3.5 py-2 bg-neutral-100 dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 font-semibold focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-neutral-500 mb-1">Artículo / Ítem Vendido</label>
                  <input
                    type="text"
                    value={manualForm.itemSold}
                    onChange={(e) => setManualForm(prev => ({ ...prev, itemSold: e.target.value }))}
                    placeholder="ej. Televisor 55, Moto, etc."
                    className="w-full px-3.5 py-2 bg-neutral-100 dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 font-semibold focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-neutral-500 mb-1">Dirección Domiciliaria</label>
                <input
                  type="text"
                  value={manualForm.address}
                  onChange={(e) => setManualForm(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Calle principal, secundaria o referencia..."
                  className="w-full px-3.5 py-2 bg-neutral-100 dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 font-semibold focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-neutral-500 mb-1">Monto Adeudado ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={manualForm.amount}
                    onChange={(e) => setManualForm(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3.5 py-2 bg-neutral-100 dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 font-semibold focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-neutral-500 mb-1">Días de Atraso *</label>
                  <input
                    type="number"
                    value={manualForm.overdueDays}
                    onChange={(e) => setManualForm(prev => ({ ...prev, overdueDays: parseInt(e.target.value, 10) || 0 }))}
                    className="w-full px-3.5 py-2 bg-neutral-100 dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 font-semibold focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-neutral-500 mb-1">Cobrador / Ruta Asignada</label>
                <select
                  value={manualForm.collectorName}
                  onChange={(e) => setManualForm(prev => ({ ...prev, collectorName: e.target.value }))}
                  className="w-full px-3.5 py-2 bg-neutral-100 dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 font-semibold focus:outline-none cursor-pointer"
                >
                  <option value="">Seleccione un cobrador...</option>
                  {registeredCollectors.map(col => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
                {registeredCollectors.length === 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    No se encontraron cobradores registrados en la empresa.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-neutral-500 mb-1">Observaciones</label>
                <input
                  type="text"
                  value={manualForm.notes}
                  onChange={(e) => setManualForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Detalles adicionales..."
                  className="w-full px-3.5 py-2 bg-neutral-100 dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 font-semibold focus:outline-none"
                />
              </div>
            </div>

            <div className="p-6 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-end space-x-3 bg-neutral-50 dark:bg-neutral-800/50">
              <button
                type="button"
                onClick={() => setIsManualModalOpen(false)}
                className="px-4 py-2 rounded-xl font-semibold text-neutral-600 hover:bg-neutral-200 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveManualClient}
                disabled={saving}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-md cursor-pointer"
              >
                {saving ? 'Guardando...' : 'Guardar Cliente'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL: GESTIÓN DE COBRO POR WHATSAPP ==================== */}
      {isWhatsAppModalOpen && activeWhatsAppClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-neutral-900 max-w-lg w-full rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden flex flex-col">
            <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-emerald-50/50 dark:bg-emerald-950/20">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 rounded-xl">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-50">
                    Mensaje de Cobro por WhatsApp
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Notificación personalizada según días de mora (Ecuador +593)
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsWhatsAppModalOpen(false);
                  setActiveWhatsAppClient(null);
                }}
                className="p-1.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-sm flex-1 overflow-y-auto">
              {/* Client Info Card */}
              <div className="bg-neutral-50 dark:bg-neutral-800/60 p-4 rounded-xl border border-neutral-200 dark:border-neutral-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-neutral-900 dark:text-neutral-100 text-sm">
                    {activeWhatsAppClient.clientName}
                  </span>
                  {activeWhatsAppClient.overdueDays === 0 ? (
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                      0 días (Al Día)
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                      {activeWhatsAppClient.overdueDays} días de mora
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-neutral-600 dark:text-neutral-400">
                  <div>
                    <span className="text-neutral-400">Saldo pendiente: </span>
                    <span className="font-bold text-neutral-900 dark:text-neutral-100">
                      ${activeWhatsAppClient.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div>
                    <span className="text-neutral-400">Ítem: </span>
                    <span className="font-medium text-neutral-800 dark:text-neutral-200">
                      {activeWhatsAppClient.itemSold || 'Artículos varios'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Phone Input with Ecuador Country Code */}
              <div>
                <label className="block text-xs font-bold uppercase text-neutral-500 dark:text-neutral-400 mb-1.5 flex items-center justify-between">
                  <span>Número de Celular WhatsApp</span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold lowercase">
                    Prefijo Ecuador (+593)
                  </span>
                </label>
                <div className="flex items-center space-x-2 bg-neutral-100 dark:bg-neutral-800 px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700">
                  <Phone className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-xs font-bold text-neutral-500">+593</span>
                  <input
                    type="text"
                    value={customWhatsAppPhone}
                    onChange={(e) => setCustomWhatsAppPhone(e.target.value)}
                    placeholder="0991234567"
                    className="bg-transparent text-sm font-semibold text-neutral-800 dark:text-neutral-100 focus:outline-none w-full"
                  />
                </div>
              </div>

              {/* Message text area */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold uppercase text-neutral-500 dark:text-neutral-400">
                    Mensaje Personalizado
                  </label>
                  <button
                    type="button"
                    onClick={() => setCustomWhatsAppText(generateWhatsAppMessage(activeWhatsAppClient))}
                    className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold hover:underline cursor-pointer"
                  >
                    Restablecer Mensaje Predeterminado
                  </button>
                </div>
                <textarea
                  rows={6}
                  value={customWhatsAppText}
                  onChange={(e) => setCustomWhatsAppText(e.target.value)}
                  className="w-full p-3.5 bg-neutral-100 dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs leading-relaxed focus:outline-none focus:border-emerald-500 font-normal resize-none"
                  placeholder="Escribe el mensaje para el cliente..."
                />
              </div>
            </div>

            <div className="p-6 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50 dark:bg-neutral-800/50">
              <button
                type="button"
                onClick={() => {
                  if (!customWhatsAppText.trim()) return;
                  navigator.clipboard.writeText(customWhatsAppText);
                  showToast('Mensaje copiado al portapapeles', 'success');
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all flex items-center space-x-1.5 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copiar Mensaje</span>
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsWhatsAppModalOpen(false);
                    setActiveWhatsAppClient(null);
                  }}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-700 cursor-pointer"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const url = getWhatsAppUrl(customWhatsAppPhone, customWhatsAppText);
                    if (!url) {
                      showToast('Ingrese un número de celular válido para Ecuador', 'warning');
                      return;
                    }
                    navigator.clipboard.writeText(url);
                    showToast('Enlace directo de WhatsApp copiado al portapapeles', 'success');
                  }}
                  className="px-3 py-2 rounded-xl text-xs font-bold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all flex items-center space-x-1 cursor-pointer"
                  title="Copiar enlace directo de WhatsApp para usar en cualquier navegador"
                >
                  <Link className="w-3.5 h-3.5" />
                  <span>Copiar Enlace</span>
                </button>
                <button
                  type="button"
                  onClick={handleOpenWhatsApp}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center space-x-1.5 cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Abrir WhatsApp Web / App</span>
                  <ExternalLink className="w-3 h-3 ml-0.5 opacity-80" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Exportación Dual de Cartera */}
      <PortfolioExportModal
        isOpen={isPortfolioExportOpen}
        onClose={() => setIsPortfolioExportOpen(false)}
        records={(currentSnapshot?.records || []).map(r => ({
          clientName: r.clientName,
          identification: r.identification,
          operationNumber: r.operationNumber,
          collectorName: r.collectorName,
          amount: r.amount,
          overdueDays: r.overdueDays,
          dueDate: r.dueDate,
          phone: r.phone,
          address: r.address,
          status: r.status,
          itemSold: r.itemSold
        }))}
      />
    </div>
  );
}
