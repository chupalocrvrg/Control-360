import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { useNotification } from '../contexts/NotificationContext';
import { db } from '../firebase';
import { doc, getDoc, updateDoc, collection, getDocs, writeBatch, query, where } from 'firebase/firestore';
import { storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { Save, Plus, Trash2, Shield, Globe, Palette, Monitor, Calculator, Sun, Moon, PaintBucket, Building, Building2, User, Database, Download, Upload, AlignLeft, AlignRight, ArrowUp, ArrowDown, Type, Loader2, CheckCircle2, Info, Lock, ShieldCheck, Mail, FileText, AlertCircle, Fingerprint, ArrowLeft, KeyRound, ArrowRight, ShieldAlert, Users, ArrowLeftRight, Clock, Bell } from 'lucide-react';
import TermsAndConditionsInfo from '../components/TermsAndConditionsInfo';
import { cn, isSuperAdminEmail } from '../lib/utils';
import { ECUADOR_PROVINCES } from '../lib/ecuadorLocations';
import * as XLSX from 'xlsx';
import { logAudit, AuditAction } from '../lib/audit';
import * as OTPAuth from 'otpauth';
import { QRCodeSVG } from 'qrcode.react';
import AdminUsers from './AdminUsers';
import AdminNotifications from './AdminNotifications';
import MasterBackup from './MasterBackup';
import NotFound from './NotFound';

export default function Settings() {
  const { user, profile, updateProfile, verifyPin, impersonatedUser, originalUser } = useAuth();
  const { settings, updateSettings } = useSettings();
  const { showToast } = useNotification();
  const isSuperAdmin = isSuperAdminEmail(originalUser?.email || user?.email);
  const isAdmin = profile?.role === 'admin' || profile?.role === 'superadmin' || isSuperAdmin || user?.email === 'marcelogutama3eroa@gmail.com';
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'GENERAL' | 'APPEARANCE' | 'SECURITY' | 'FINANCIAL' | 'BACKUP' | 'INFO' | 'ADMIN'>('GENERAL');
  const [adminSubTab, setAdminSubTab] = useState<'USERS' | 'MIGRATION' | 'MASTER_BACKUP' | 'VERSIONS' | 'AUDIT' | 'TRASH' | 'NOTIFICATIONS'>('USERS');

  // Security gate for Settings
  const [isSettingsUnlocked, setIsSettingsUnlocked] = useState(false);
  const [settingsUnlockPin, setSettingsUnlockPin] = useState('');
  const [settingsPinError, setSettingsPinError] = useState('');
  const [verifyingSettingsPin, setVerifyingSettingsPin] = useState(false);

  // Profile data state
  const [profileData, setProfileData] = useState({ 
    name: '', 
    businessName: '',
    commercialName: '',
    phone: '', 
    photoUrl: '', 
    country: 'Ecuador',
    province: '',
    canton: '',
    address: '' 
  });
  const [docType, setDocType] = useState<'CEDULA' | 'RUC'>('CEDULA');
  const [docNumber, setDocNumber] = useState('');

  const [securityData, setSecurityData] = useState({ oldPin: '', newPin: '', confirmPin: '', pinInactivityLimit: 60 });
  const [backupPin, setBackupPin] = useState('');
  const [totpSetup, setTotpSetup] = useState<{ secret: OTPAuth.Secret, uri: string } | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [showTotpModal, setShowTotpModal] = useState(false);
  const [positionConfirmTimer, setPositionConfirmTimer] = useState<number | null>(null);
  const [previousMenuPosition, setPreviousMenuPosition] = useState(settings.menuPosition);
  const [timeLeft, setTimeLeft] = useState(0);
  const [importProgress, setImportProgress] = useState<{
    active: boolean;
    stageName: string;
    currentCount: number;
    totalCount: number;
    percentage: number;
    mode: 'merge' | 'overwrite';
    collectionName?: string;
  } | null>(null);

  const handleUnlockSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (settingsUnlockPin.length !== 6 || verifyingSettingsPin) return;
    setVerifyingSettingsPin(true);
    setSettingsPinError('');
    try {
      const isValid = await verifyPin(settingsUnlockPin);
      if (isValid) {
        setIsSettingsUnlocked(true);
        setSettingsUnlockPin('');
        setSettingsPinError('');
        showToast("Acceso a Configuración concedido", "success");
      } else {
        setSettingsPinError('PIN incorrecto. Verifica e intenta nuevamente.');
        setSettingsUnlockPin('');
      }
    } catch (err) {
      setSettingsPinError('Error al validar el PIN.');
    } finally {
      setVerifyingSettingsPin(false);
    }
  };

  const handlePositionChange = (newPos: 'left' | 'right' | 'top' | 'bottom') => {
    if (newPos === (settings.menuPosition || 'left')) return;
    setPreviousMenuPosition(settings.menuPosition || 'left');
    updateSettings({ menuPosition: newPos });
    
    setTimeLeft(15);
    if (positionConfirmTimer) clearInterval(positionConfirmTimer);
    
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    setPositionConfirmTimer(interval as any);
  };

  useEffect(() => {
    if (timeLeft === 0 && positionConfirmTimer) {
       clearInterval(positionConfirmTimer);
       setPositionConfirmTimer(null);
       updateSettings({ menuPosition: previousMenuPosition });
       showToast("Se restableció la ubicación anterior", "info");
    }
  }, [timeLeft, positionConfirmTimer, previousMenuPosition, updateSettings, showToast]);

  const confirmPositionChange = () => {
    if (positionConfirmTimer) {
      clearInterval(positionConfirmTimer);
      setPositionConfirmTimer(null);
      setTimeLeft(0);
      showToast("Ubicación guardada", "success");
    }
  };

  const cancelPositionChange = () => {
    if (positionConfirmTimer) {
      clearInterval(positionConfirmTimer);
      setPositionConfirmTimer(null);
      setTimeLeft(0);
      updateSettings({ menuPosition: previousMenuPosition });
      showToast("Se restableció la ubicación anterior", "info");
    }
  };

  useEffect(() => {
    return () => {
      if (positionConfirmTimer) clearInterval(positionConfirmTimer);
    };
  }, [positionConfirmTimer]);


  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) {
      const upper = tab.toUpperCase();
      if (['GENERAL', 'APPEARANCE', 'SECURITY', 'FINANCIAL', 'BACKUP', 'INFO', 'ADMIN'].includes(upper)) {
        setActiveTab(upper as any);
      }
    }
    const sub = searchParams.get('subtab') || searchParams.get('sub');
    if (sub) {
      const subUpper = sub.toUpperCase();
      const validSubTabs = ['USERS', 'MIGRATION', 'MASTER_BACKUP', 'VERSIONS', 'AUDIT', 'TRASH', 'NOTIFICATIONS'];
      if (validSubTabs.includes(subUpper)) {
        setAdminSubTab(subUpper as any);
      }
    }
  }, [searchParams]);

  useEffect(() => {
    if (user && profile) {
      setProfileData({ 
        name: profile.name || '', 
        businessName: profile.businessName || '',
        commercialName: profile.commercialName || '',
        phone: profile.phone || '', 
        photoUrl: profile.photoUrl || '',
        country: profile.country || 'Ecuador',
        province: profile.province || '',
        canton: profile.canton || '',
        address: profile.address || ''
      });
      const rucVal = (profile.ruc || '').trim();
      if (rucVal.length === 13 && rucVal.endsWith('001')) {
        setDocType('RUC');
        setDocNumber(rucVal);
      } else if (rucVal.length === 10) {
        setDocType('CEDULA');
        setDocNumber(rucVal);
      } else {
        setDocType(rucVal.length > 10 ? 'RUC' : 'CEDULA');
        setDocNumber(rucVal);
      }
      setSecurityData({ oldPin: '', newPin: '', confirmPin: '', pinInactivityLimit: profile.pinInactivityLimit || 60 });
    }
  }, [user, profile]);


  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 256;
        const MAX_HEIGHT = 256;
        let width = img.width;
        let height = img.height;
        
        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setProfileData({ ...profileData, photoUrl: dataUrl });
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async () => {
    const mainName = profileData.name.trim() || profileData.commercialName.trim() || profileData.businessName.trim();
    if (!mainName) {
      showToast("El Nombre de la empresa o Razón Social es requerido", "warning");
      return;
    }

    const cleanDoc = docNumber.trim();
    if (docType === 'CEDULA') {
      if (cleanDoc && !/^\d{10}$/.test(cleanDoc)) {
        showToast("La Cédula debe contener exactamente 10 dígitos numéricos.", "warning");
        return;
      }
    } else if (docType === 'RUC') {
      if (cleanDoc && !/^\d{10}001$/.test(cleanDoc)) {
        showToast("El RUC debe tener exactamente 13 dígitos numéricos y terminar obligatoriamente en 001.", "warning");
        return;
      }
    }

    setLoading(true);
    try {
      await updateProfile({
        name: mainName,
        businessName: profileData.businessName.trim(),
        commercialName: profileData.commercialName.trim(),
        phone: profileData.phone.trim(),
        ruc: cleanDoc,
        country: profileData.country.trim() || 'Ecuador',
        province: profileData.province.trim(),
        canton: profileData.canton.trim(),
        address: profileData.address.trim(),
        photoUrl: profileData.photoUrl
      });
      showToast("Perfil y datos corporativos actualizados correctamente", "success");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
    } finally {
      setLoading(false);
    }
  };

  
  const handleSetupTotp = () => {
    const secret = new OTPAuth.Secret({ size: 20 });
    const totp = new OTPAuth.TOTP({
      issuer: 'Control Financiero',
      label: profile?.email || 'Usuario',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: secret
    });
    setTotpSetup({ secret, uri: totp.toString() });
    setShowTotpModal(true);
  };

  const handleVerifyAndSaveTotp = async () => {
    if (!totpSetup || !totpCode) return;
    
    const totp = new OTPAuth.TOTP({
      issuer: 'Control Financiero',
      label: profile?.email || 'Usuario',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: totpSetup.secret
    });

    const delta = totp.validate({ token: totpCode, window: 1 });
    if (delta === null) {
      showToast('Código incorrecto', 'error');
      return;
    }

    try {
      setLoading(true);
      await updateProfile({ 
        totpSecret: totpSetup.secret.base32,
        totpEnabled: true
      });
      showToast('Autenticador configurado exitosamente', 'success');
      setShowTotpModal(false);
      setTotpSetup(null);
      setTotpCode('');
    } catch (error) {
      showToast('Error al guardar configuración', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveTotp = async () => {
    if (!window.confirm('¿Está seguro de que desea eliminar el autenticador de dos pasos? Esto disminuirá la seguridad de su cuenta.')) return;
    try {
      setLoading(true);
      await updateProfile({
        totpSecret: '',
        totpEnabled: false
      });
      showToast('Autenticador removido', 'success');
    } catch (error) {
      showToast('Error al remover el autenticador', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSecurity = async () => {
    if (securityData.newPin || securityData.confirmPin || securityData.oldPin) {
      if (!securityData.oldPin || securityData.oldPin.length !== 6) {
        showToast("Debes ingresar tu PIN actual de 6 dígitos.", "warning");
        return;
      }
      if (securityData.newPin.length !== 6) {
        showToast("El nuevo PIN debe tener 6 dígitos numéricos.", "warning");
        return;
      }
      if (securityData.newPin !== securityData.confirmPin) {
        showToast("El nuevo PIN y su confirmación no coinciden.", "warning");
        return;
      }
      
      setLoading(true);
      try {
        const isOldPinValid = await verifyPin(securityData.oldPin);
        if (!isOldPinValid) {
          showToast("El PIN actual ingresado es incorrecto.", "error");
          setLoading(false);
          return;
        }
      } catch (error) {
        showToast("Error al verificar el PIN actual.", "error");
        setLoading(false);
        return;
      }
    }
    
    setLoading(true);
    try {
      const updateData: any = { pinInactivityLimit: securityData.pinInactivityLimit };
      if (securityData.newPin) {
        updateData.pin = securityData.newPin;
      }
      await updateProfile(updateData);
      setSecurityData(prev => ({ ...prev, oldPin: '', newPin: '', confirmPin: '' }));
      showToast("Seguridad actualizada correctamente", "success");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
    } finally {
      setLoading(false);
    }
  };

  const handleAddBank = () => {
    const newBanks = [...(settings.banks || []), ''];
    updateSettings({ banks: newBanks });
  };

  const handleBankChange = (index: number, value: string) => {
    const newBanks = [...(settings.banks || [])];
    newBanks[index] = value;
    updateSettings({ banks: newBanks });
  };

  const handleRemoveBank = (index: number) => {
    const newBanks = [...(settings.banks || [])];
    newBanks.splice(index, 1);
    updateSettings({ banks: newBanks });
  };

  const TABS = [
    { id: 'GENERAL', label: 'General', icon: User },
    { id: 'APPEARANCE', label: 'Personalización', icon: Palette },
    { id: 'SECURITY', label: 'Seguridad', icon: Shield },
    { id: 'FINANCIAL', label: 'Financiero', icon: Calculator },
    { id: 'BACKUP', label: 'Respaldos', icon: Database },
    { id: 'INFO', label: 'Información', icon: Info },
    ...(isAdmin ? [{ id: 'ADMIN', label: 'Administración', icon: ShieldAlert }] : []),
  ];

  const fontOptions = [
    { name: 'Inter (Predeterminada)', value: 'Inter, sans-serif' },
    { name: 'Space Grotesk', value: '"Space Grotesk", sans-serif' },
    { name: 'Playfair Display', value: '"Playfair Display", serif' },
    { name: 'JetBrains Mono', value: '"JetBrains Mono", monospace' }
  ];

  const colorOptions = [
    { name: 'Índigo (Por defecto)', value: 'indigo', hex: '#6366f1' },
    { name: 'Esmeralda', value: 'emerald', hex: '#10b981' },
    { name: 'Violeta', value: 'violet', hex: '#8b5cf6' },
    { name: 'Rosa', value: 'pink', hex: '#ec4899' },
    { name: 'Cian', value: 'cyan', hex: '#06b6d4' },
    { name: 'Ámbar', value: 'amber', hex: '#f59e0b' },
  ];

  const positionOptions = [
    { name: 'Izquierda', value: 'left', icon: AlignLeft },
    { name: 'Derecha', value: 'right', icon: AlignRight },
    { name: 'Arriba', value: 'top', icon: ArrowUp },
    { name: 'Abajo', value: 'bottom', icon: ArrowDown },
  ];

  // Backup handlers
  
  const fetchAllData = async () => {
    const tenantId = impersonatedUser 
      ? impersonatedUser.uid 
      : (profile?.role === 'enterprise' ? user?.uid : (profile?.enterpriseId || user?.uid || ''));
    if (!tenantId) throw new Error("No hay un identificador de empresa/inquilino activo");

    const fetchCollection = async (colName: string) => {
      const colRef = collection(db, colName);
      const qEnt = query(colRef, where('enterpriseId', '==', tenantId));
      const qUser = query(colRef, where('userId', '==', tenantId));
      
      const [snapEnt, snapUser] = await Promise.all([
        getDocs(qEnt).catch(() => ({ docs: [] })),
        getDocs(qUser).catch(() => ({ docs: [] }))
      ]);

      const itemMap = new Map<string, any>();
      snapEnt.docs?.forEach((d: any) => itemMap.set(d.id, { id: d.id, ...d.data() }));
      snapUser.docs?.forEach((d: any) => itemMap.set(d.id, { id: d.id, ...d.data() }));

      // Admin fallback if structured query returned empty
      if (itemMap.size === 0) {
        try {
          const snapAll = await getDocs(colRef);
          snapAll.docs?.forEach((d: any) => {
            const data = d.data();
            if (data.enterpriseId === tenantId || data.userId === tenantId) {
              itemMap.set(d.id, { id: d.id, ...data });
            }
          });
        } catch (_) {
          // Ignore permission error if not admin or constrained
        }
      }

      return Array.from(itemMap.values());
    };

    const [
      employees,
      checks,
      sales,
      collections,
      articles,
      invoices,
      beneficiaries,
      budgets,
      warehouses,
      warehouse_inventory,
      loans_returns,
      transfers,
      inventory_sales
    ] = await Promise.all([
      fetchCollection('employees'),
      fetchCollection('checks'),
      fetchCollection('sales'),
      fetchCollection('collections'),
      fetchCollection('articles'),
      fetchCollection('invoices'),
      fetchCollection('beneficiaries'),
      fetchCollection('budgets'),
      fetchCollection('warehouses'),
      fetchCollection('warehouse_inventory'),
      fetchCollection('loans_returns'),
      fetchCollection('transfers'),
      fetchCollection('inventory_sales'),
    ]);

    return {
      employees,
      checks,
      sales,
      collections,
      inventory: articles,
      invoices,
      beneficiaries,
      budgets,
      warehouses,
      warehouse_inventory,
      loans_returns,
      transfers,
      inventory_sales,
    };
  };

  const handleExport = async (format: 'json' | 'excel') => {
    if (!(await verifyPin(backupPin))) {
      showToast("El PIN de acceso es incorrecto", "error");
      return;
    }
    setLoading(true);
    try {
      showToast("Exportando base de datos...", "success");
      const dbData = await fetchAllData();
      
      if (format === 'json') {
        const blob = new Blob([JSON.stringify(dbData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup_control360_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        await logAudit(AuditAction.SENSITIVE_READ, 'Exportación de copia de seguridad (JSON) de la base de datos.');
      } else {
        const wb = XLSX.utils.book_new();
        
        // Empleados
        const empData = dbData.employees.map((e: any) => {
          const empBudgets = dbData.budgets.filter((b: any) => b.employeeId === e.id);
          const lastBudget = empBudgets[empBudgets.length - 1];
          return {
            'nombre': `${e.name || ''} ${e.lastName || ''}`.trim(),
            'Rol (cobrador - vendedor o ambos)': e.role || '',
            'Presupuesto Ventas': lastBudget?.salesBudget || 0,
            'Presupuesto Cobranza': lastBudget?.collectionsBudget || 0
          };
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(empData), "empleados");
        
        // Cheques
        const checkData = dbData.checks
          .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
          .map((c: any) => {
            const inv = dbData.invoices.find((i: any) => i.id === c.invoiceId);
            return {
              'Beneficiario': c.beneficiaryName || '',
              '# Factura': inv?.invoiceNumber || c.invoiceId || '',
              'Concepto': c.concept || '',
              '# Cheque': c.checkNumber || '',
              'Fecha Pago': c.dueDate || '',
              'Valor': c.amount || 0,
              'Banco': c.bank || '',
              'Estado': c.status === 'PAID' ? 'PAGADO' : 'PENDIENTE'
            };
          });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(checkData), "cheques");
        
        // Ventas
        const salesData = dbData.sales.map((s: any) => ({
          'fecha': s.date || '',
          'vendedor': dbData.employees.find((e: any) => e.id === s.employeeId)?.name || s.employeeId || '',
          'cliente': s.clientName || '',
          'tipo (contado o credito)': s.type || '',
          'articulo/producto detallado': s.article || '',
          'valor final': s.totalValue || 0
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(salesData), "ventas");
        
        // Cobranza
        const colData = dbData.collections.map((c: any) => ({
          'Fecha Inicio': c.initialDate || '',
          'Fecha Fin': c.finalDate || '',
          'Cobrador': dbData.employees.find((e: any) => e.id === c.employeeId)?.name || c.employeeId || '',
          'Recibo Inicial': c.initialReceipt || '',
          'Recibo Final': c.finalReceipt || '',
          'Total Cobrado': c.totalCollected || 0,
          'Depósitos': c.depositsTransfers || 0,
          'Efectivo': c.cashFinal || 0
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(colData), "cobranza");
        
        // Inventario
        const invData = dbData.inventory.map((i: any) => {
          const itemInvs = dbData.warehouse_inventory.filter((wi: any) => wi.articleId === i.id);
          const warehousesAssigned = itemInvs.map((wi: any) => {
            const wh = dbData.warehouses.find((w: any) => w.id === wi.warehouseId);
            return wh ? `${wh.name} (${wi.quantity})` : `Bodega ID: ${wi.warehouseId} (${wi.quantity})`;
          }).join(', ');

          return {
            'nombre del articulo': i.name || '',
            'categoria': i.category || '',
            'marca': i.brand || '',
            'modelo': i.model || '',
            'codigo de barras': i.barcode || '',
            'minimo para alerta': i.minStockAlert || 0,
            'Numero de serie': (i.seriesList || []).join(', '),
            'Bodega a la que fue asignada': warehousesAssigned || 'Ninguna'
          };
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(invData), "inventario");
        
        XLSX.writeFile(wb, `backup_control360_${new Date().toISOString().split('T')[0]}.xlsx`);
        await logAudit(AuditAction.SENSITIVE_READ, 'Exportación de copia de seguridad (Excel) de la base de datos.');
      }
    } catch (e) {
      console.error(e);
      showToast("Error exportando", "error");
    } finally {
      setLoading(false);
      setBackupPin('');
    }
  };

  const executeDataRestore = async (importedData: any, mode: 'overwrite' | 'merge') => {
    try {
      const activeUid = impersonatedUser 
        ? impersonatedUser.uid 
        : (profile?.role === 'enterprise' ? user?.uid : (profile?.enterpriseId || user?.uid || ''));
      if (!activeUid) throw new Error("No hay usuario activo");

      if (importedData.dbData) importedData = importedData.dbData;
      else if (importedData.data) importedData = importedData.data;
      else if (importedData.backup) importedData = importedData.backup;
      
      const cleanData = (obj: any): any => {
        if (obj === null || obj === undefined) return null;
        if (typeof obj !== 'object') return obj;
        if (obj instanceof Date) return obj.toISOString();
        if (Array.isArray(obj)) return obj.map(cleanData).filter(item => item !== undefined);
        const result: any = {};
        for (const [k, v] of Object.entries(obj)) {
          if (v !== undefined) {
            result[k] = cleanData(v);
          }
        }
        return result;
      };

      const collectionsMap: Record<string, { col: string; label: string }> = {
        employees: { col: 'employees', label: 'Empleados' },
        checks: { col: 'checks', label: 'Cheques' },
        sales: { col: 'sales', label: 'Ventas' },
        collections: { col: 'collections', label: 'Cobranzas' },
        inventory: { col: 'articles', label: 'Inventario / Artículos' },
        articles: { col: 'articles', label: 'Artículos' },
        invoices: { col: 'invoices', label: 'Facturas' },
        beneficiaries: { col: 'beneficiaries', label: 'Beneficiarios' },
        budgets: { col: 'budgets', label: 'Presupuestos' },
        warehouses: { col: 'warehouses', label: 'Bodegas' },
        warehouse_inventory: { col: 'warehouse_inventory', label: 'Inventario de Bodegas' },
        loans_returns: { col: 'loans_returns', label: 'Préstamos / Devoluciones' },
        transfers: { col: 'transfers', label: 'Transferencias' },
        inventory_sales: { col: 'inventory_sales', label: 'Ventas de Inventario' }
      };

      setImportProgress({
        active: true,
        stageName: "Analizando colecciones y verificando registros...",
        currentCount: 0,
        totalCount: 0,
        percentage: 15,
        mode
      });

      const operations: { docRef: any; data: any; label: string }[] = [];
      const processedDocKeys = new Set<string>();
      
      for (const [key, meta] of Object.entries(collectionsMap)) {
        const collectionName = meta.col;
        const label = meta.label;
        if (importedData[key] && Array.isArray(importedData[key])) {
           for (const item of importedData[key]) {
             const docId = item.id || crypto.randomUUID();
             const docKey = `${collectionName}_${docId}`;
             if (processedDocKeys.has(docKey)) continue;
             processedDocKeys.add(docKey);

             const docRef = doc(db, collectionName, docId);
             const dataToSave = cleanData({ ...item });
             delete dataToSave.id;
             
             dataToSave.enterpriseId = activeUid;
             dataToSave.userId = activeUid;
             
             operations.push({ docRef, data: dataToSave, label });
           }
        }
      }

      if (operations.length === 0) {
        showToast("No se encontraron registros para importar en el archivo JSON", "error");
        setLoading(false);
        setImportProgress(null);
        setBackupPin('');
        return;
      }

      const totalOps = operations.length;
      setImportProgress({
        active: true,
        stageName: `Iniciando guardado de ${totalOps} registros...`,
        currentCount: 0,
        totalCount: totalOps,
        percentage: 20,
        mode
      });

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
        const percentage = Math.round(20 + (currentCount / totalOps) * 75);
        const currentLabel = chunk[0]?.label || 'Registros';
        
        setImportProgress({
          active: true,
          stageName: `Importando ${currentLabel} (${currentCount} de ${totalOps})`,
          currentCount,
          totalCount: totalOps,
          percentage,
          mode,
          collectionName: currentLabel
        });
      }

      setImportProgress({
        active: true,
        stageName: "¡Importación completada con éxito!",
        currentCount: totalOps,
        totalCount: totalOps,
        percentage: 100,
        mode
      });

      showToast(`Base de datos restaurada con éxito (${totalOps} registros en modo ${mode === 'merge' ? 'Fusión' : 'Sobreescritura'})`, "success");
      await logAudit(AuditAction.SETTINGS_UPDATE, `Importación de base de datos completa (${totalOps} registros en modo ${mode})`);

      await new Promise(res => setTimeout(res, 1000));

    } catch (err: any) {
      console.error("Error importando:", err);
      showToast("Error importando: " + (err?.message || "Error desconocido al procesar el archivo JSON"), "error");
      try {
        handleFirestoreError(err, OperationType.WRITE, 'settings/import');
      } catch (e) {
        // Logged error details
      }
    } finally {
      setLoading(false);
      setImportProgress(null);
      setBackupPin('');
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>, mode: 'overwrite' | 'merge') => {
    if (!(await verifyPin(backupPin))) {
      showToast("El PIN de acceso es incorrecto", "error");
      if (e.target) e.target.value = '';
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;
    
    setLoading(true);
    setImportProgress({
      active: true,
      stageName: "Leyendo archivo JSON...",
      currentCount: 0,
      totalCount: 0,
      percentage: 5,
      mode
    });

    try {
      const fileText = await file.text();
      let importedData;
      if (file.name.toLowerCase().endsWith('.json')) {
        importedData = JSON.parse(fileText);
      } else {
         showToast("Formato no soportado. Para restaurar la base de datos, por favor seleccione un archivo en formato JSON.", "error");
         setLoading(false);
         setImportProgress(null);
         setBackupPin('');
         if (e.target) e.target.value = '';
         return;
      }
      
      await executeDataRestore(importedData, mode);
    } catch (err: any) {
      console.error("Error leyendo archivo:", err);
      showToast("Error leyendo archivo: " + (err?.message || "Error"), "error");
      setLoading(false);
      setImportProgress(null);
      setBackupPin('');
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const handleDirectRestoreRescued = async (mode: 'overwrite' | 'merge' = 'merge') => {
    if (!(await verifyPin(backupPin))) {
      showToast("El PIN de acceso es incorrecto", "error");
      return;
    }
    
    setLoading(true);
    setImportProgress({
      active: true,
      stageName: "Cargando copia de seguridad rescatada...",
      currentCount: 0,
      totalCount: 0,
      percentage: 10,
      mode
    });

    try {
      const response = await fetch('/backup_restaurado_automatico.json');
      if (!response.ok) throw new Error("No se pudo cargar el archivo de respaldo automático");
      const data = await response.json();
      await executeDataRestore(data, mode);
    } catch (err: any) {
      console.error("Error al restaurar copia rescatada:", err);
      showToast("Error al restaurar: " + (err?.message || "Error"), "error");
      setImportProgress(null);
      setBackupPin('');
      setLoading(false);
    }
  };


  if (!isSettingsUnlocked) {
    return (
      <div className="min-h-[70vh] flex flex-col justify-center items-center px-4 py-12 animate-in fade-in zoom-in-95 duration-300">
        <div className="max-w-md w-full bg-white dark:bg-neutral-900 rounded-[2.5rem] border border-neutral-100 dark:border-neutral-800 shadow-xl p-8 sm:p-10 text-center space-y-6">
          <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-3xl mx-auto flex items-center justify-center shadow-inner">
            <Lock className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-neutral-900 dark:text-neutral-50 tracking-tight">
              Acceso a Configuración
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2 leading-relaxed">
              Esta sección contiene parámetros críticos del sistema y datos corporativos. Por seguridad, ingresa tu <strong>PIN transaccional de 6 dígitos</strong> para desbloquear.
            </p>
          </div>
          
          <form onSubmit={handleUnlockSettings} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="settings-pin-input" className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block text-center">
                PIN de 6 dígitos
              </label>
              <div className="relative">
                <input
                  id="settings-pin-input"
                  type="password"
                  autoFocus
                  autoComplete="off"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={settingsUnlockPin}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    setSettingsUnlockPin(val);
                    setSettingsPinError('');
                  }}
                  placeholder="······"
                  className="w-full bg-neutral-900 text-white text-center text-3xl tracking-[0.6em] font-black py-4 px-5 rounded-2xl border border-neutral-800 focus:ring-4 focus:ring-indigo-500/20 outline-none transition-all placeholder:text-neutral-700"
                />
                <Fingerprint className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-700" />
              </div>
            </div>

            {settingsPinError && (
              <div className="flex items-center justify-center gap-2 text-xs font-bold text-red-500 bg-red-50 dark:bg-red-950/30 py-2.5 px-3 rounded-xl border border-red-200 dark:border-red-900/40 animate-shake">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{settingsPinError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={settingsUnlockPin.length !== 6 || verifyingSettingsPin}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm uppercase tracking-wider rounded-2xl transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {verifyingSettingsPin ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Validando PIN...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" /> Desbloquear Configuración
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <>
      {positionConfirmTimer && (
        <div className={cn(
          "fixed left-1/2 transform -translate-x-1/2 z-[100] bg-neutral-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-in",
          settings.menuPosition === 'bottom' 
            ? "top-6 slide-in-from-top-5" 
            : "bottom-6 slide-in-from-bottom-5"
        )}>
          <div>
            <p className="font-bold text-sm">¿Mantener esta ubicación?</p>
            <p className="text-xs text-neutral-400">Restableciendo en {timeLeft}s...</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={cancelPositionChange} className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-xl text-xs font-bold transition-colors">Revertir</button>
            <button onClick={confirmPositionChange} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-bold transition-colors">Mantener</button>
          </div>
        </div>
      )}

    <div className="max-w-7xl mx-auto space-y-6 lg:space-y-8 pb-20 animate-in fade-in duration-300">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Configuración</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Personaliza la experiencia, opciones financieras y seguridad de la plataforma.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-6 lg:gap-8">
        <div className="w-full md:w-64 shrink-0 space-y-2">
          {TABS.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  setSearchParams(tab.id === 'GENERAL' ? {} : { tab: tab.id.toLowerCase() });
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-200",
                  isActive 
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none"
                    : "bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                )}
              >
                <tab.icon className="w-5 h-5" />
                {tab.label}
              </button>
            )
          })}
        </div>

        <div className="flex-1 min-w-0 space-y-6">
          {activeTab === 'GENERAL' && (
            <section className="bg-white dark:bg-neutral-900 rounded-[2.5rem] border border-neutral-100 dark:border-neutral-800 shadow-sm overflow-hidden">
              <div className="p-8 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl text-indigo-600 dark:text-indigo-400">
                    <User className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">Perfil y Datos Corporativos</h2>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">Administra los datos personales, comerciales y fiscales de tu cuenta.</p>
                  </div>
                </div>
                <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 rounded-full text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="w-3.5 h-3.5" /> Acceso Validado con PIN
                </div>
              </div>
              <div className="p-8 space-y-6">
                <div className="flex items-center gap-6">
                  <div className="relative">
                    <img 
                      src={profileData.photoUrl || user?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(profileData.name || 'User')}&background=random`}
                      alt="Profile"
                      className="w-24 h-24 rounded-full object-cover border-4 border-white dark:border-neutral-800 shadow-xl"
                    />
                  </div>
                  <div className="space-y-3 flex-1">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Foto de Perfil</label>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <input
                        type="url"
                        value={profileData.photoUrl}
                        onChange={(e) => setProfileData({ ...profileData, photoUrl: e.target.value })}
                        className="flex-1 bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        placeholder="URL de la imagen"
                      />
                      <label className="cursor-pointer bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-4 py-3 rounded-xl font-bold text-sm text-center hover:bg-indigo-100 transition-colors whitespace-nowrap">
                        <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                        Subir Foto
                      </label>
                      {user?.photoURL && (
                        <button
                          onClick={() => setProfileData({ ...profileData, photoUrl: user.photoURL || '' })}
                          className="bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 px-4 py-3 rounded-xl font-bold text-sm hover:bg-neutral-200 transition-colors whitespace-nowrap"
                        >
                          Usar Google
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Razón Social (Nombre Legal) */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                      1. Razón Social (Nombre Legal / Jurídico)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={profileData.businessName}
                        onChange={(e) => setProfileData({ ...profileData, businessName: e.target.value })}
                        className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-800 rounded-2xl p-4 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-all pl-12"
                        placeholder="Ej: INVERSIONES Y COMERCIO S.A.S."
                      />
                      <Building className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                    </div>
                  </div>

                  {/* Nombre Comercial / Nombre de la Empresa */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                      2. Nombre Comercial / Marca de la Empresa
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={profileData.commercialName}
                        onChange={(e) => setProfileData({ ...profileData, commercialName: e.target.value })}
                        className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-800 rounded-2xl p-4 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-all pl-12"
                        placeholder="Ej: ELECTRO & CRÉDITOS EL VALLE"
                      />
                      <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                    </div>
                  </div>

                  {/* Nombre del Representante / Contacto Principal */}
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                      3. Nombre del Representante Legal o Titular Propietario <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={profileData.name}
                        onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                        className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-800 rounded-2xl p-4 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-all pl-12"
                        placeholder="Ej: Juan Carlos Pérez Gómez"
                      />
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                    </div>
                  </div>

                  {/* Documento de Identificación (Cédula o RUC) */}
                  <div className="space-y-3 md:col-span-2 p-5 bg-neutral-50/80 dark:bg-neutral-800/40 rounded-2xl border border-neutral-100 dark:border-neutral-800">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                        Documento de Identificación de la Empresa / Acreedor (Cédula / RUC)
                      </label>
                      <div className="inline-flex p-1 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700">
                        <button
                          type="button"
                          onClick={() => {
                            setDocType('CEDULA');
                            if (docNumber.length > 10) setDocNumber(docNumber.slice(0, 10));
                          }}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                            docType === 'CEDULA'
                              ? "bg-indigo-600 text-white shadow-sm"
                              : "text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200"
                          )}
                        >
                          Cédula (10 dígitos)
                        </button>
                        <button
                          type="button"
                          onClick={() => setDocType('RUC')}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                            docType === 'RUC'
                              ? "bg-indigo-600 text-white shadow-sm"
                              : "text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200"
                          )}
                        >
                          RUC (13 dígitos / 001)
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="relative">
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={docType === 'CEDULA' ? 10 : 13}
                          value={docNumber}
                          onChange={(e) => setDocNumber(e.target.value.replace(/\D/g, ''))}
                          className={cn(
                            "w-full bg-white dark:bg-neutral-900 border rounded-2xl p-4 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-all pl-12 font-mono text-sm tracking-wide",
                            docType === 'CEDULA'
                              ? (docNumber.length === 10 ? "border-emerald-300 dark:border-emerald-800" : "border-neutral-200 dark:border-neutral-700")
                              : (/^\d{10}001$/.test(docNumber) ? "border-emerald-300 dark:border-emerald-800" : "border-neutral-200 dark:border-neutral-700")
                          )}
                          placeholder={docType === 'CEDULA' ? "Ej: 0102030405 (10 dígitos numéricos)" : "Ej: 0102030405001 (13 dígitos terminados en 001)"}
                        />
                        <FileText className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-neutral-400">
                          {docNumber.length}/{docType === 'CEDULA' ? 10 : 13}
                        </div>
                      </div>

                      {docType === 'CEDULA' && docNumber.length > 0 && docNumber.length !== 10 && (
                        <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium pl-1">
                          ⚠️ La cédula debe tener exactamente 10 dígitos numéricos (faltan {10 - docNumber.length} dígitos).
                        </p>
                      )}
                      {docType === 'RUC' && docNumber.length > 0 && (!/^\d{10}001$/.test(docNumber)) && (
                        <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium pl-1">
                          ⚠️ El RUC debe tener 13 dígitos y los 3 últimos dígitos deben ser obligatoriamente <strong>001</strong>.
                        </p>
                      )}
                      {((docType === 'CEDULA' && docNumber.length === 10) || (docType === 'RUC' && /^\d{10}001$/.test(docNumber))) && (
                        <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium pl-1 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Formato de {docType} válido.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Ubicación Geográfica: País, Provincia y Cantón */}
                  <div className="space-y-4 md:col-span-2 p-5 bg-neutral-50/80 dark:bg-neutral-800/40 rounded-2xl border border-neutral-100 dark:border-neutral-800">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                      Ubicación Geográfica Jurídica (País, Provincia y Cantón)
                    </label>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* País */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 block">País</label>
                        <input
                          type="text"
                          value={profileData.country}
                          onChange={(e) => setProfileData({ ...profileData, country: e.target.value })}
                          className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl p-3 text-sm text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                          placeholder="Ecuador"
                        />
                      </div>

                      {/* Provincia */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 block">Provincia</label>
                        <select
                          value={profileData.province}
                          onChange={(e) => {
                            const newProv = e.target.value;
                            const provObj = ECUADOR_PROVINCES.find(p => p.name === newProv);
                            const defaultCanton = provObj && provObj.cantons.length > 0 ? provObj.cantons[0] : '';
                            setProfileData({
                              ...profileData,
                              province: newProv,
                              canton: provObj?.cantons.includes(profileData.canton) ? profileData.canton : defaultCanton
                            });
                          }}
                          className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl p-3 text-sm text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        >
                          <option value="">-- Seleccionar Provincia --</option>
                          {ECUADOR_PROVINCES.map((prov) => (
                            <option key={prov.name} value={prov.name}>
                              {prov.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Cantón */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 block">Cantón / Jurisdicción</label>
                        {profileData.province ? (
                          <select
                            value={profileData.canton}
                            onChange={(e) => setProfileData({ ...profileData, canton: e.target.value })}
                            className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl p-3 text-sm text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                          >
                            <option value="">-- Seleccionar Cantón --</option>
                            {(ECUADOR_PROVINCES.find(p => p.name === profileData.province)?.cantons || []).map((canton) => (
                              <option key={canton} value={canton}>
                                {canton}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={profileData.canton}
                            onChange={(e) => setProfileData({ ...profileData, canton: e.target.value })}
                            className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl p-3 text-sm text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            placeholder="Ej: La Troncal"
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Dirección de la Casa Comercial */}
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Dirección Exacta de la Casa Comercial</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={profileData.address}
                        onChange={(e) => setProfileData({ ...profileData, address: e.target.value })}
                        className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-800 rounded-2xl p-4 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-all pl-12"
                        placeholder="Ej: Av. Principal y Calle Secundaria, Edificio Sky, Local 4"
                      />
                      <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                    </div>
                  </div>

                  {/* Teléfono Móvil */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Teléfono / Contacto</label>
                    <input
                      type="tel"
                      value={profileData.phone}
                      onChange={(e) => setProfileData({ ...profileData, phone: e.target.value.replace(/\D/g, '') })}
                      className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-800 rounded-2xl p-4 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      placeholder="0999999999"
                    />
                  </div>

                  {/* Correo Electrónico (Solo Lectura) */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Correo Electrónico Principal</label>
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-md text-neutral-500">
                        <Lock className="w-3 h-3" /> Solo lectura
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type="email"
                        disabled
                        readOnly
                        value={profile?.email || user?.email || ''}
                        className="w-full bg-neutral-100/70 dark:bg-neutral-800/50 border border-neutral-200/60 dark:border-neutral-800 rounded-2xl p-4 text-neutral-500 dark:text-neutral-400 cursor-not-allowed outline-none pl-12"
                      />
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-8 py-4 bg-neutral-50 dark:bg-neutral-950/40 border-t border-neutral-100 dark:border-neutral-800 flex justify-end">
                <button onClick={handleSaveProfile} disabled={loading} className="px-6 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-bold hover:bg-indigo-700 transition-all flex items-center gap-2">
                  <Save className="w-4 h-4" /> Guardar Cambios
                </button>
              </div>
            </section>
          )}

          {activeTab === 'APPEARANCE' && (
            <section className="bg-white dark:bg-neutral-900 rounded-[2.5rem] border border-neutral-100 dark:border-neutral-800 shadow-sm overflow-hidden">
              <div className="p-8 border-b border-neutral-100 dark:border-neutral-800 flex items-center gap-4">
                <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl text-indigo-600 dark:text-indigo-400">
                  <Palette className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">Apariencia y Visualización</h2>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">Ajusta los colores, temas, tipografía y estilo general.</p>
                </div>
              </div>
              
              <div className="p-8 space-y-8">
                {/* Tema */}
                <div className="space-y-4">
                  <label className="text-sm font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-2">
                    <Monitor className="w-4 h-4" /> Tema Principal
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                      { id: 'light', icon: Sun, label: 'Modo Claro' },
                      { id: 'dark', icon: Moon, label: 'Modo Oscuro' },
                      { id: 'system', icon: Monitor, label: 'Sistema' }
                    ].map(t => (
                      <button
                        key={t.id}
                        onClick={() => updateSettings({ theme: t.id as any })}
                        className={cn(
                          "flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all font-bold gap-3",
                          settings.theme === t.id
                            ? "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-500 text-indigo-700 dark:text-indigo-300"
                            : "bg-white dark:bg-neutral-800/40 border-neutral-100 dark:border-neutral-800 text-neutral-500 hover:border-indigo-200"
                        )}
                      >
                        <t.icon className="w-6 h-6" />
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* UI Style */}
                <div className="space-y-4">
                  <label className="text-sm font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-2">
                    <Palette className="w-4 h-4" /> Estilo de Interfaz
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button
                      onClick={() => updateSettings({ uiStyle: 'classic' })}
                      className={cn(
                        "p-6 rounded-2xl border-2 transition-all font-bold text-left space-y-1",
                        settings.uiStyle === 'classic' ? "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-500 text-indigo-700 dark:text-indigo-300" : "bg-white dark:bg-neutral-800/40 border-neutral-100 dark:border-neutral-800 text-neutral-500"
                      )}
                    >
                      <div className="text-base">Sólido Moderno</div>
                      <div className="text-xs font-normal opacity-80">Colores sólidos y contrastes limpios.</div>
                    </button>
                    <button
                      onClick={() => updateSettings({ uiStyle: 'glass' })}
                      className={cn(
                        "p-6 rounded-2xl border-2 transition-all font-bold text-left space-y-1 relative overflow-hidden",
                        settings.uiStyle === 'glass' ? "bg-indigo-50/50 dark:bg-indigo-900/20 border-indigo-500 text-indigo-700 dark:text-indigo-300" : "bg-white dark:bg-neutral-800/40 border-neutral-100 dark:border-neutral-800 text-neutral-500"
                      )}
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent pointer-events-none backdrop-blur-sm" />
                      <div className="relative z-10 text-base">Glassmorfismo</div>
                      <div className="relative z-10 text-xs font-normal opacity-80">Transparencias, desenfoques y efectos de cristal.</div>
                    </button>
                    <button
                      onClick={() => updateSettings({ uiStyle: 'liquid-glass' })}
                      className={cn(
                        "p-6 rounded-2xl border-2 transition-all font-bold text-left space-y-1 relative overflow-hidden sm:col-span-2",
                        settings.uiStyle === 'liquid-glass' ? "bg-indigo-50/50 dark:bg-indigo-900/20 border-indigo-500 text-indigo-700 dark:text-indigo-300" : "bg-white dark:bg-neutral-800/40 border-neutral-100 dark:border-neutral-800 text-neutral-500"
                      )}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 pointer-events-none backdrop-blur-md" />
                      <div className="relative z-10 text-base">Liquid Glass</div>
                      <div className="relative z-10 text-xs font-normal opacity-80">Efecto avanzado con desenfoques acrílicos, transparencias orgánicas y texturas.</div>
                    </button>

                  </div>
                </div>


                {settings.uiStyle === 'liquid-glass' && (
                  <div className="space-y-4 p-6 bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/20 rounded-2xl animate-in slide-in-from-top-2">
                    <label className="text-sm font-bold text-indigo-900 dark:text-indigo-100 uppercase tracking-widest flex items-center gap-2">
                      <PaintBucket className="w-4 h-4" /> Fondo Liquid Glass
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {[
                        { id: 'gradient', label: 'Gradiente Vibrante' },
                        { id: 'animated', label: 'Fondo Animado' },
                        { id: 'custom', label: 'Fondo Personalizado' }
                      ].map(bg => (
                        <button
                          key={bg.id}
                          onClick={() => updateSettings({ liquidBackgroundType: bg.id as any })}
                          className={cn(
                            "p-4 rounded-xl border-2 transition-all font-bold text-center text-sm",
                            (settings.liquidBackgroundType || 'gradient') === bg.id
                              ? "bg-indigo-600 border-indigo-600 text-white"
                              : "bg-white dark:bg-neutral-800 border-transparent text-neutral-600 dark:text-neutral-400 hover:border-indigo-200"
                          )}
                        >
                          {bg.label}
                        </button>
                      ))}
                    </div>
                    

                    {settings.liquidBackgroundType === 'custom' && (
                      <div className="mt-4 space-y-2">
                        <label className="text-xs font-bold text-indigo-700 dark:text-indigo-300 block">URL de Imagen (o sube un archivo en Firebase)</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="url"
                            value={settings.liquidBackgroundValue || ''}
                            onChange={(e) => updateSettings({ liquidBackgroundValue: e.target.value })}
                            className="flex-1 bg-white dark:bg-neutral-800 border border-indigo-200 dark:border-indigo-800 rounded-xl p-3 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                            placeholder="https://ejemplo.com/imagen.jpg"
                          />
                          <label className="p-3 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-xl cursor-pointer hover:bg-indigo-200 transition-colors">
                            <Upload className="w-5 h-5" />
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                try {
                                  setLoading(true);
                                  showToast("Subiendo imagen...", "info");
                                  const storageRef = ref(storage, `backgrounds/${user?.uid || 'global'}_${Date.now()}_${file.name}`);
                                  await uploadBytes(storageRef, file);
                                  const url = await getDownloadURL(storageRef);
                                  updateSettings({ liquidBackgroundValue: url });
                                  showToast("Imagen subida y aplicada", "success");
                                } catch (error) {
                                  console.error("Error al subir:", error);
                                  showToast("Error al subir la imagen", "error");
                                } finally {
                                  setLoading(false);
                                }
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    )}

                  </div>
                )}

                {/* Opciones de Magnificación del Dock (Solo si liquid-glass está seleccionado) */}
                {settings.uiStyle === 'liquid-glass' && (
                  <div className="space-y-4 p-6 bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/20 rounded-2xl animate-in slide-in-from-top-2">
                    <label className="text-sm font-bold text-indigo-900 dark:text-indigo-100 uppercase tracking-widest flex items-center gap-2">
                      <Palette className="w-4 h-4" /> Efecto de Magnificación del Dock (macOS Style)
                    </label>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      Habilita la animación de lupa interactiva en la barra de navegación al pasar el cursor.
                    </p>

                    <div className="flex items-center justify-between p-4 bg-white dark:bg-neutral-800/40 rounded-xl border border-neutral-100 dark:border-neutral-800">
                      <div>
                        <div className="text-sm font-bold text-neutral-800 dark:text-neutral-200">Activar Magnificación</div>
                        <div className="text-xs text-neutral-500">Aumenta el tamaño del icono bajo el cursor.</div>
                      </div>
                      <button
                        onClick={() => updateSettings({ dockMagnification: !settings.dockMagnification })}
                        className={cn(
                          "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                          settings.dockMagnification ? "bg-indigo-600" : "bg-neutral-200 dark:bg-neutral-700"
                        )}
                      >
                        <span
                          className={cn(
                            "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                            settings.dockMagnification ? "translate-x-5" : "translate-x-0"
                          )}
                        />
                      </button>
                    </div>

                    {settings.dockMagnification && (
                      <>
                        <div className="flex items-center justify-between p-4 bg-white dark:bg-neutral-800/40 rounded-xl border border-neutral-100 dark:border-neutral-800 animate-in fade-in duration-200">
                          <div>
                            <div className="text-sm font-bold text-neutral-800 dark:text-neutral-200">Efecto de Proximidad</div>
                            <div className="text-xs text-neutral-500">Los iconos vecinos crecen ligeramente (estilo fluido orgánico).</div>
                          </div>
                          <button
                            onClick={() => updateSettings({ dockProximity: !settings.dockProximity })}
                            className={cn(
                              "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                              settings.dockProximity ? "bg-indigo-600" : "bg-neutral-200 dark:bg-neutral-700"
                            )}
                          >
                            <span
                              className={cn(
                                "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                                settings.dockProximity ? "translate-x-5" : "translate-x-0"
                              )}
                            />
                          </button>
                        </div>

                        <div className="space-y-2 animate-in fade-in duration-200">
                          <label className="text-xs font-bold text-indigo-700 dark:text-indigo-300 block">Tipo de Magnificación</label>
                          <div className="grid grid-cols-2 gap-4">
                            {[
                              { id: 'scale', label: 'Escalado Visual (Scale)', desc: 'Efecto de zoom fluido en 2D' },
                              { id: 'size', label: 'Tamaño Físico (Size)', desc: 'Desplaza los elementos vecinos físicamente' }
                            ].map(type => (
                              <button
                                key={type.id}
                                onClick={() => updateSettings({ dockMagnificationType: type.id as any })}
                                className={cn(
                                  "p-4 rounded-xl border-2 transition-all font-bold text-left text-sm flex flex-col justify-between h-20",
                                  settings.dockMagnificationType === type.id
                                    ? "bg-indigo-600 border-indigo-600 text-white"
                                    : "bg-white dark:bg-neutral-800 border-transparent text-neutral-600 dark:text-neutral-400 hover:border-indigo-200"
                                )}
                              >
                                <span>{type.label}</span>
                                <span className={cn("text-[10px] font-normal", settings.dockMagnificationType === type.id ? "text-indigo-100" : "text-neutral-400")}>
                                  {type.desc}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Tipografía */}
                <div className="space-y-4">
                  <label className="text-sm font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-2">
                    <Type className="w-4 h-4" /> Tipo de Letra
                  </label>
                  <select
                    value={settings.fontFamily || ''}
                    onChange={(e) => updateSettings({ fontFamily: e.target.value })}
                    className="w-full bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800 rounded-2xl p-4 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  >
                    {fontOptions.map(font => (
                      <option key={font.name} value={font.value} style={{ fontFamily: font.value }}>
                        {font.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Color de Acento */}
                <div className="space-y-4">
                  <label className="text-sm font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-2">
                    <PaintBucket className="w-4 h-4" /> Paleta Cromática de Acento
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {colorOptions.map(color => (
                      <button
                        key={color.value}
                        onClick={() => updateSettings({ accentColor: color.value })}
                        className={cn(
                          "flex items-center gap-3 p-4 rounded-2xl border-2 transition-all font-bold",
                          (settings.accentColor || 'indigo') === color.value
                            ? "bg-neutral-50 dark:bg-neutral-900 border-indigo-500 text-neutral-900 dark:text-white"
                            : "bg-white dark:bg-neutral-800/40 border-neutral-100 dark:border-neutral-800 text-neutral-500 hover:border-indigo-200"
                        )}
                      >
                        <div className="w-6 h-6 rounded-full shadow-inner" style={{ backgroundColor: color.hex }} />
                        <span className="text-sm">{color.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Posición del menú */}
                <div className="space-y-4">
                  <label className="text-sm font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-2">
                    <AlignLeft className="w-4 h-4" /> Ubicación del Panel de Módulos
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    {positionOptions.map(pos => (
                      <button
                        key={pos.value}
                        onClick={() => handlePositionChange(pos.value as any)}
                        className={cn(
                          "flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all font-bold gap-3",
                          (settings.menuPosition || 'left') === pos.value
                            ? "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-500 text-indigo-700 dark:text-indigo-300"
                            : "bg-white dark:bg-neutral-800/40 border-neutral-100 dark:border-neutral-800 text-neutral-500 hover:border-indigo-200"
                        )}
                      >
                        <pos.icon className="w-6 h-6" />
                        {pos.name}
                      </button>
                    ))}
                  </div>
                </div>

              </div>
            </section>
          )}

          {activeTab === 'SECURITY' && (
            <section className="bg-white dark:bg-neutral-900 rounded-[2.5rem] border border-neutral-100 dark:border-neutral-800 shadow-sm overflow-hidden">
              <div className="p-8 border-b border-neutral-100 dark:border-neutral-800 flex items-center gap-4">
                <div className="p-3 bg-red-50 dark:bg-red-900/30 rounded-2xl text-red-600 dark:text-red-400">
                  <Shield className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">Control de Accesos</h2>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">Protege tu terminal e información sensible.</p>
                </div>
              </div>
              <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">PIN Actual *</label>
                    <input
                      type="password" autoComplete="new-password" data-lpignore="true" data-1p-ignore="true" data-bwignore="true" inputMode="numeric" pattern="[0-9]*"
                      maxLength={6}
                      value={securityData.oldPin}
                      onChange={(e) => setSecurityData({ ...securityData, oldPin: e.target.value.replace(/\D/g, '') })}
                      className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-800 rounded-2xl p-4 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono tracking-widest text-lg"
                      placeholder="••••••"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Nuevo PIN (6 dígitos)</label>
                    <input
                      type="password" autoComplete="new-password" data-lpignore="true" data-1p-ignore="true" data-bwignore="true" inputMode="numeric" pattern="[0-9]*"
                      maxLength={6}
                      value={securityData.newPin}
                      onChange={(e) => setSecurityData({ ...securityData, newPin: e.target.value.replace(/\D/g, '') })}
                      className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-800 rounded-2xl p-4 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono tracking-widest text-lg"
                      placeholder="••••••"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Confirmar Nuevo PIN</label>
                    <input
                      type="password" autoComplete="new-password" data-lpignore="true" data-1p-ignore="true" data-bwignore="true" inputMode="numeric" pattern="[0-9]*"
                      maxLength={6}
                      value={securityData.confirmPin}
                      onChange={(e) => setSecurityData({ ...securityData, confirmPin: e.target.value.replace(/\D/g, '') })}
                      className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-800 rounded-2xl p-4 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono tracking-widest text-lg"
                      placeholder="••••••"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Sesión Auto-protegida</label>
                  <select
                    value={securityData.pinInactivityLimit}
                    onChange={(e) => setSecurityData({ ...securityData, pinInactivityLimit: parseInt(e.target.value) })}
                    className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-800 rounded-2xl p-4 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  >
                    <option value={1}>Bloqueo: 1 Minuto</option>
                    <option value={5}>Bloqueo: 5 Minutos</option>
                    <option value={15}>Bloqueo: 15 Minutos</option>
                    <option value={60}>Bloqueo: 1 Hora</option>
                    <option value={1440}>Bloqueo: 24 Horas</option>
                  </select>
                </div>
              </div>
                            <div className="p-8 border-t border-neutral-100 dark:border-neutral-800">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-50 mb-1">Autenticador de Google (2FA)</h3>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">
                      Utiliza Google Authenticator para reestablecer tu PIN en caso de olvido.
                    </p>
                  </div>
                  <div>
                    {profile?.totpEnabled ? (
                      <button 
                        onClick={handleRemoveTotp}
                        disabled={loading}
                        className="px-4 py-2 bg-red-50 text-red-600 rounded-xl text-sm font-bold hover:bg-red-100 transition-colors"
                      >
                        Desactivar
                      </button>
                    ) : (
                      <button 
                        onClick={handleSetupTotp}
                        className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-sm font-bold hover:bg-indigo-100 transition-colors"
                      >
                        Configurar
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="px-8 py-4 bg-neutral-50 dark:bg-neutral-950/40 border-t border-neutral-100 dark:border-neutral-800 flex justify-end">
                <button onClick={handleSaveSecurity} disabled={loading} className="px-6 py-3 bg-red-600 text-white rounded-2xl text-sm font-bold hover:bg-red-700 transition-all flex items-center gap-2">
                  <Save className="w-4 h-4" /> Guardar Seguridad
                </button>
              </div>
            </section>
          )}

          {activeTab === 'FINANCIAL' && profile?.role !== 'BODEGUERO' && (
            <section className="bg-white dark:bg-neutral-900 rounded-[2.5rem] border border-neutral-100 dark:border-neutral-800 shadow-sm overflow-hidden animate-in fade-in duration-300">
              <div className="p-8 border-b border-neutral-100 dark:border-neutral-800 flex items-center gap-4">
                <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-2xl text-blue-600 dark:text-blue-400">
                  <Building className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">Finanzas y Bancos</h2>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">Configura IVA, moneda y entidades bancarias.</p>
                </div>
              </div>
              <div className="p-8 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <label className="text-sm font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-2">
                      <Globe className="w-4 h-4" /> Moneda de Visualización
                    </label>
                    <select
                      value={settings.currency}
                      onChange={(e) => updateSettings({ currency: e.target.value as any })}
                      className="w-full bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800 rounded-2xl p-4 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    >
                      <option value="USD">Dólar Estadounidense (USD)</option>
                      <option value="EUR">Euro (EUR)</option>
                      <option value="ARS">Peso Argentino (ARS)</option>
                      <option value="CLP">Peso Chileno (CLP)</option>
                      <option value="BRL">Real Brasileño (BRL)</option>
                    </select>
                  </div>
                  <div className="space-y-4">
                    <label className="text-sm font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-2">
                      <Calculator className="w-4 h-4" /> Configuración de IVA (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={settings.iva}
                      onChange={(e) => updateSettings({ iva: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800 rounded-2xl p-4 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      placeholder="15"
                    />
                  </div>
                </div>

                <div className="space-y-4 pt-8 border-t border-neutral-100 dark:border-neutral-800">
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-neutral-900 dark:text-white uppercase tracking-wider text-sm">Entidades Bancarias</h3>
                    <button onClick={handleAddBank} className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl font-bold text-xs hover:bg-blue-100 transition-all flex items-center gap-2">
                      <Plus className="w-4 h-4" /> Nuevo Banco
                    </button>

                  </div>
                  {(!settings.banks || settings.banks.length === 0) ? (
                    <p className="text-sm text-neutral-500 italic">No tienes entidades bancarias configuradas.</p>
                  ) : (
                    <div className="space-y-3">
                      {settings.banks.map((bank, idx) => (
                        <div key={idx} className="flex gap-4">
                          <input 
                            type="text" 
                            value={bank}
                            onChange={e => handleBankChange(idx, e.target.value)}
                            className="flex-1 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800 rounded-2xl p-4 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            placeholder="Ej: Banco Pichincha"
                          />
                          <button onClick={() => handleRemoveBank(idx)} className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl hover:bg-red-100 transition-all">
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {activeTab === 'BACKUP' && (
            <section className="bg-white dark:bg-neutral-900 rounded-[2.5rem] border border-neutral-100 dark:border-neutral-800 shadow-sm overflow-hidden animate-in fade-in duration-300">
              <div className="p-8 border-b border-neutral-100 dark:border-neutral-800 flex items-center gap-4">
                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 rounded-2xl text-emerald-600 dark:text-emerald-400">
                  <Database className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">Respaldos y Migración</h2>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">Exporta e importa los datos del sistema (JSON).</p>
                </div>
              </div>

              <div className="p-8 space-y-8">
                {isSuperAdmin && (
                  <div className="p-5 bg-gradient-to-r from-indigo-900/90 to-purple-950 text-white rounded-2xl border border-indigo-700/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-md">
                    <div className="flex items-center gap-3.5">
                      <div className="p-2.5 bg-white/10 rounded-xl">
                        <Database className="w-5 h-5 text-indigo-300" />
                      </div>
                      <div>
                        <span className="px-2.5 py-0.5 bg-indigo-500/30 text-indigo-200 text-[9px] font-black uppercase tracking-wider rounded-md border border-indigo-400/20">
                          Exclusivo Superadmin
                        </span>
                        <p className="text-sm font-black text-white mt-1">
                          ¿Deseas respaldar o restaurar TODAS las empresas registradas?
                        </p>
                        <p className="text-xs text-indigo-200/80 mt-0.5">
                          Este panel exporta únicamente la empresa activa. Para respaldar o restaurar la base de datos íntegra global, utiliza el Respaldo Maestro.
                        </p>
                      </div>
                    </div>
                    <Link
                      to="/admin/master-backup"
                      className="px-5 py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-lg hover:scale-105 active:scale-95 shrink-0 flex items-center gap-2"
                    >
                      Ir a Respaldo Maestro <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                )}

                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 p-4 rounded-2xl">
                  <p className="text-sm font-bold text-amber-700 dark:text-amber-500">Autenticación Requerida</p>
                  <p className="text-xs text-amber-600/80 dark:text-amber-500/80 mt-1">Para exportar o importar datos, por favor ingresa tu PIN de seguridad actual.</p>
                  <input
                    type="password" autoComplete="new-password" data-lpignore="true" data-1p-ignore="true" data-bwignore="true" inputMode="numeric" pattern="[0-9]*"
                    maxLength={6}
                    value={backupPin}
                    onChange={e => setBackupPin(e.target.value.replace(/\D/g, ''))}
                    className="mt-4 w-full md:w-64 bg-white dark:bg-neutral-800 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-amber-500 outline-none font-mono tracking-widest"
                    placeholder="PIN de Acceso"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Exportar */}
                  <div className="border border-neutral-100 dark:border-neutral-800 rounded-3xl p-6 space-y-4 bg-neutral-50/50 dark:bg-neutral-800/20">
                    <div>
                      <h3 className="font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                        <Download className="w-5 h-5 text-indigo-500" /> Exportar Datos
                      </h3>
                      <p className="text-xs text-neutral-500 mt-1">Descarga una copia completa del sistema.</p>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => handleExport('json')} disabled={loading || backupPin.length !== 6} className="flex-1 py-3 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-bold hover:bg-neutral-50 disabled:opacity-50 transition-all">
                        Formato JSON
                      </button>
                      <button onClick={() => handleExport('excel')} disabled={loading || backupPin.length !== 6} className="flex-1 py-3 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-xl text-sm font-bold hover:bg-emerald-100 disabled:opacity-50 transition-all">
                        Formato Excel
                      </button>
                    </div>
                  </div>

                  {/* Importar */}
                  <div className="border border-neutral-100 dark:border-neutral-800 rounded-3xl p-6 space-y-4 bg-neutral-50/50 dark:bg-neutral-800/20">
                    <div>
                      <h3 className="font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                        <Upload className="w-5 h-5 text-indigo-500" /> Importar Datos
                      </h3>
                      <p className="text-xs text-neutral-500 mt-1">Restaura la base de datos (Requiere archivo JSON).</p>
                    </div>
                    <div className="flex gap-3 relative">
                      <input type="file" id="file-overwrite" className="hidden" accept=".json,application/json" onChange={(e) => handleImport(e, 'overwrite')} />
                      <input type="file" id="file-merge" className="hidden" accept=".json,application/json" onChange={(e) => handleImport(e, 'merge')} />
                      
                      <label htmlFor="file-overwrite" className={`flex-1 py-3 bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-xl text-sm font-bold text-center cursor-pointer hover:bg-red-100 transition-all ${loading || backupPin.length !== 6 ? 'opacity-50 pointer-events-none' : ''}`}>
                        Sobreescribir
                      </label>
                      <label htmlFor="file-merge" className={`flex-1 py-3 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-xl text-sm font-bold text-center cursor-pointer hover:bg-blue-100 transition-all ${loading || backupPin.length !== 6 ? 'opacity-50 pointer-events-none' : ''}`}>
                        Fusionar (Merge)
                      </label>
                    </div>
                    <p className="text-[10px] text-neutral-400 italic">
                      <b>Sobreescribir</b> elimina los datos actuales y carga los nuevos.<br/>
                      <b>Fusionar</b> mantiene los datos actuales y solo añade los que no existan.
                    </p>
                  </div>
                </div>

                {/* Respaldo Recuperado de la Caché Local */}
                <div className="bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent border border-indigo-500/30 rounded-3xl p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500 text-white">
                          Copia Rescatada Lista
                        </span>
                        <span className="text-xs text-neutral-500 dark:text-neutral-400">Extracción Local Verificada</span>
                      </div>
                      <h3 className="font-black text-neutral-900 dark:text-white text-base">
                        Base de Datos Recuperada de Caché Local
                      </h3>
                      <p className="text-xs text-neutral-600 dark:text-neutral-300">
                        Contiene <b>233 Cheques</b>, <b>86 Cobranzas</b>, <b>48 Ventas</b>, <b>12 Presupuestos</b> y <b>7 Empleados</b> recuperados íntegramente (Total: <b>386 registros</b>).
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <a
                        href="/backup_restaurado_automatico.json"
                        download="copia_seguridad_rescatada.json"
                        className="px-4 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700 text-neutral-900 dark:text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 shadow-sm"
                      >
                        <Download className="w-4 h-4 text-indigo-500" /> Descargar Archivo JSON
                      </a>
                      <button
                        onClick={() => handleDirectRestoreRescued('merge')}
                        disabled={loading || backupPin.length !== 6}
                        className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 shadow-md shadow-indigo-500/20"
                      >
                        <Database className="w-4 h-4" /> Restaurar en Base de Datos (1-Clic)
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'INFO' && (
            <TermsAndConditionsInfo />
          )}

          {activeTab === 'ADMIN' && (
            isAdmin ? (
              <div className="space-y-6">
                {/* Admin Submodules Navigation Bar */}
                <div className="bg-white dark:bg-neutral-900 rounded-[2rem] border border-neutral-100 dark:border-neutral-800 shadow-sm p-2 flex flex-wrap gap-1.5">
                  {[
                    { id: 'USERS', label: 'Usuarios', icon: Users },
                    { id: 'MIGRATION', label: 'Asignación / Migración', icon: ArrowLeftRight },
                    { id: 'MASTER_BACKUP', label: 'Respaldo Maestro', icon: Database },
                    { id: 'VERSIONS', label: 'Versiones', icon: Clock },
                    { id: 'AUDIT', label: 'Auditoría', icon: ShieldCheck },
                    { id: 'TRASH', label: 'Papelera', icon: Trash2 },
                    { id: 'NOTIFICATIONS', label: 'Notificaciones', icon: Bell },
                  ].map((subItem) => {
                    const isSubActive = adminSubTab === subItem.id;
                    const SubIcon = subItem.icon;
                    return (
                      <button
                        key={subItem.id}
                        onClick={() => {
                          setAdminSubTab(subItem.id as any);
                          setSearchParams({ tab: 'admin', subtab: subItem.id.toLowerCase() });
                        }}
                        className={cn(
                          "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-150",
                          isSubActive
                            ? "bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none"
                            : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                        )}
                      >
                        <SubIcon className="w-4 h-4" />
                        <span>{subItem.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Submodule View Content */}
                <div className="animate-in fade-in duration-200">
                  {adminSubTab === 'USERS' && <AdminUsers mode="USERS" />}
                  {adminSubTab === 'MIGRATION' && <AdminUsers mode="ENTITIES" />}
                  {adminSubTab === 'MASTER_BACKUP' && <MasterBackup />}
                  {adminSubTab === 'VERSIONS' && <AdminUsers mode="HISTORY" />}
                  {adminSubTab === 'AUDIT' && <AdminUsers mode="AUDIT" />}
                  {adminSubTab === 'TRASH' && <AdminUsers mode="TRASH" />}
                  {adminSubTab === 'NOTIFICATIONS' && <AdminNotifications />}
                </div>
              </div>
            ) : (
              <NotFound />
            )
          )}

        </div>
      </div>
    </div>


      {/* 2FA TOTP Setup Modal */}
      {showTotpModal && totpSetup && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-[100] animate-in fade-in duration-200">
          <div className="bg-white dark:bg-neutral-900 rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl relative border border-neutral-100 dark:border-neutral-800">
            <div className="text-center mb-6">
              <div className="mx-auto w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center mb-4 text-indigo-600 dark:text-indigo-400">
                <Shield className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-black text-neutral-900 dark:text-white uppercase tracking-tight">Configurar Autenticador</h3>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-2 font-medium">Escanea este código QR con la app de Google Authenticator u otra similar.</p>
            </div>
            
            <div className="flex justify-center bg-white p-4 rounded-3xl border border-neutral-200 shadow-sm mx-auto w-fit mb-6">
              <QRCodeSVG value={totpSetup.uri} size={180} />
            </div>
            
            <div className="text-center mb-6">
              <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1">Clave Secreta</p>
              <code className="bg-neutral-100 dark:bg-neutral-800 px-3 py-1.5 rounded-lg text-xs font-mono text-neutral-700 dark:text-neutral-300 break-all select-all">
                {totpSetup.secret.base32}
              </code>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block text-center">Código de Verificación (6 dígitos)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/D/g, ''))}
                  className="w-full text-center text-3xl tracking-[0.5em] font-black px-4 py-4 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl outline-none focus:border-indigo-500 transition-all"
                  placeholder="000000"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowTotpModal(false); setTotpSetup(null); setTotpCode(''); }}
                  className="flex-1 py-4 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white rounded-[1.5rem] font-bold active:scale-95 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleVerifyAndSaveTotp}
                  disabled={loading || totpCode.length !== 6}
                  className="flex-1 py-4 bg-indigo-600 text-white rounded-[1.5rem] font-bold shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:shadow-none active:scale-95 transition-all"
                >
                  {loading ? 'Verificando...' : 'Verificar y Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Import Progress Notification Card */}
      {importProgress && importProgress.active && (
        <div className="fixed bottom-6 right-6 z-[150] w-96 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-2xl animate-in fade-in slide-in-from-bottom-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/60 rounded-xl text-indigo-600 dark:text-indigo-400">
                {importProgress.percentage === 100 ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 animate-bounce" />
                ) : (
                  <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
                )}
              </div>
              <div>
                <h4 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-1.5">
                  Importando Datos
                </h4>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Modo: <span className="font-semibold capitalize text-neutral-700 dark:text-neutral-300">{importProgress.mode === 'merge' ? 'Fusión (Merge)' : 'Sobreescritura'}</span>
                </p>
              </div>
            </div>
            <span className="text-sm font-black text-indigo-600 dark:text-indigo-400 font-mono">
              {importProgress.percentage}%
            </span>
          </div>

          <div className="space-y-2">
            <div className="w-full bg-neutral-100 dark:bg-neutral-800 rounded-full h-2.5 overflow-hidden">
              <div 
                className="bg-indigo-600 dark:bg-indigo-500 h-2.5 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${importProgress.percentage}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-xs text-neutral-500 dark:text-neutral-400 pt-1">
              <span className="truncate pr-2 font-medium">{importProgress.stageName}</span>
              {importProgress.totalCount > 0 && (
                <span className="font-mono text-neutral-400 shrink-0">
                  {importProgress.currentCount}/{importProgress.totalCount}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

    </>
  );
}
