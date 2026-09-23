import React, { useState, useRef } from 'react';
import { useNotification } from '../contexts/NotificationContext';
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';
import { useAuth } from '../contexts/AuthContext';
import { 
  FileText, 
  ShieldCheck, 
  Clock, 
  UserCheck, 
  Printer, 
  CreditCard, 
  CheckCircle2, 
  Search, 
  Scale, 
  BookOpen, 
  Shield,
  Layers,
  Lock,
  Server,
  AlertTriangle,
  FileCode,
  Key,
  Briefcase,
  Building,
  User,
  Sparkles,
  Info
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ClauseSection, generalClauses, privateDerickClauses } from '../data/termsData';
import { es } from 'date-fns/locale';



export default function TermsAndConditionsInfo() {
  const { user, profile, isSuperAdmin } = useAuth();
  
  // Check if current account is the exclusive creditosderick15@gmail.com or master developer
  const currentUserEmail = (profile?.email || user?.email || '').toLowerCase().trim();
  const isDerickAccount = currentUserEmail === 'creditosderick15@gmail.com';
  const isDeveloperAccount = currentUserEmail === 'marcelogutama3eroa@gmail.com' || isSuperAdmin;
  const canViewPrivateAgreement = isDerickAccount || isDeveloperAccount;

  // Active document tab: 'GENERAL' or 'DERICK_PRIVATE'
  const [activeDocument, setActiveDocument] = useState<'GENERAL' | 'DERICK_PRIVATE'>(
    isDerickAccount ? 'DERICK_PRIVATE' : 'GENERAL'
  );

  const [searchTerm, setSearchTerm] = useState('');
  const { showToast } = useNotification();
  const [isPrinting, setIsPrinting] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Format acceptance date with high precision and fallback
  const getFormattedAcceptanceDate = () => {
    const rawDate = profile?.termsAcceptedAt || profile?.createdAt;
    if (!rawDate) {
      return {
        dateStr: 'Registro inicial de cuenta',
        timeStr: '',
        iso: new Date().toISOString()
      };
    }

    try {
      let d: Date;
      if (typeof rawDate === 'string') {
        d = parseISO(rawDate);
      } else if ((rawDate as any)?.toDate) {
        d = (rawDate as any).toDate();
      } else {
        d = new Date(rawDate);
      }

      if (isNaN(d.getTime())) {
        return {
          dateStr: 'Registro inicial de cuenta',
          timeStr: '',
          iso: new Date().toISOString()
        };
      }

      return {
        dateStr: format(d, "d 'de' MMMM 'de' yyyy", { locale: es }),
        timeStr: format(d, "HH:mm:ss '(GMT-5)'", { locale: es }),
        iso: d.toISOString()
      };
    } catch {
      return {
        dateStr: 'Registro inicial de cuenta',
        timeStr: '',
        iso: new Date().toISOString()
      };
    }
  };

  const acceptance = getFormattedAcceptanceDate();

  const handlePrintCertificate = async () => {
    if (!printRef.current) return;
    
    // Si estamos en iframe sin permisos, window.print falla silenciosamente.
    // En su lugar, generamos un PDF
    setIsPrinting(true);
    showToast('Generando documento PDF...', 'info');
    
    const el = printRef.current;
    
    try {
      // Configuramos el html2canvas para que renderice con fondo blanco y tome todo el scroll
      const imgData = await toPng(el, {
        cacheBust: true,
        backgroundColor: document.documentElement.classList.contains('dark') ? '#171717' : '#ffffff',
        pixelRatio: 2,
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left'
        }
      });
      
      const img = new Image();
      img.src = imgData;
      await new Promise((resolve) => (img.onload = resolve));

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (img.height * pdfWidth) / img.width;
      
      let heightLeft = pdfHeight;
      let position = 0;
      const pageHeight = pdf.internal.pageSize.getHeight();

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
      }
      
      pdf.save(`Constancia_Terminos_${activeDocument === 'DERICK_PRIVATE' ? 'Derick' : 'Generales'}.pdf`);
      showToast('Documento PDF generado y descargado con éxito', 'success');
    } catch (error) {
      console.error('Error al generar PDF:', error);
      showToast('Error al generar PDF. Tu navegador podría estar bloqueándolo.', 'error');
    } finally {
      setIsPrinting(false);
    }
  };

  // 1. Cláusulas del Documento General Público (17 Cláusulas)
  

  // 2. Cláusulas del Acuerdo Privado y Bilateral Exclusivo para creditosderick15@gmail.com (9 Cláusulas)
  

  // Current active clauses according to selected tab
  const activeClausesList = activeDocument === 'DERICK_PRIVATE' ? privateDerickClauses : generalClauses;

  // Filtering logic
  const filteredClauses = activeClausesList.filter((c) => {
    const matchesCategory = selectedCategory === 'ALL' || c.category === selectedCategory;
    const matchesSearch = searchTerm === '' || 
      c.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
      c.rawText.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <section className="space-y-6 animate-in fade-in duration-300">
      
      {/* Selector de Documento Exclusivo para creditosderick15@gmail.com / Administrador */}
      {canViewPrivateAgreement && (
        <div className="bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-emerald-500/10 border border-amber-200 dark:border-amber-800/40 p-4 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500 text-white rounded-2xl shadow-sm">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">
                Documentación Legal Bilateral Personalizada
              </span>
              <h3 className="text-sm font-black text-neutral-900 dark:text-neutral-100">
                Cuenta Identificada: <span className="font-mono text-indigo-600 dark:text-indigo-400">creditosderick15@gmail.com</span>
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-white dark:bg-neutral-900 p-1.5 rounded-2xl border border-neutral-200 dark:border-neutral-800 shrink-0">
            <button
              onClick={() => {
                setActiveDocument('DERICK_PRIVATE');
                setSelectedCategory('ALL');
                setSearchTerm('');
              }}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
                activeDocument === 'DERICK_PRIVATE'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              Acuerdo Privado Bilateral
            </button>
            <button
              onClick={() => {
                setActiveDocument('GENERAL');
                setSelectedCategory('ALL');
                setSearchTerm('');
              }}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
                activeDocument === 'GENERAL'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Términos Generales
            </button>
          </div>
        </div>
      )}

      {/* 1. Respaldo de Aceptación / Constancia de Auditoría Digital */}
      <div className="bg-white dark:bg-neutral-900 rounded-[2.5rem] border border-neutral-100 dark:border-neutral-800 shadow-sm overflow-hidden print:border-none print:shadow-none">
        <div className="p-8 border-b border-neutral-100 dark:border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-neutral-50/50 dark:bg-neutral-950/20">
          <div className="flex items-center gap-4">
            <div className={`p-3.5 rounded-2xl ring-1 ${
              activeDocument === 'DERICK_PRIVATE'
                ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 ring-amber-500/20'
                : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20'
            }`}>
              {activeDocument === 'DERICK_PRIVATE' ? <Shield className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-neutral-900 dark:text-neutral-50 tracking-tight">
                  {activeDocument === 'DERICK_PRIVATE' 
                    ? 'Constancia de Acuerdo Privado Bilateral'
                    : 'Constancia de Aceptación Legal y Licenciamiento'}
                </h2>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                  activeDocument === 'DERICK_PRIVATE'
                    ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                    : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                }`}>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {activeDocument === 'DERICK_PRIVATE' ? 'Plan de Cortesía Vigente' : 'Consentimiento Vigente'}
                </span>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                {activeDocument === 'DERICK_PRIVATE'
                  ? 'Reconocimiento de autoría independiente, delimitación de funciones y condición de cortesía no laboral.'
                  : 'Respaldo inmutable de aceptación de términos contractuales y fecha de vinculación jurídica.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 print:hidden">
            <button
              onClick={handlePrintCertificate}
              disabled={isPrinting}
              className="px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title="Imprimir o guardar constancia legal en PDF"
            >
              {isPrinting ? (
                <div className="w-4 h-4 border-2 border-neutral-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Printer className="w-4 h-4 text-neutral-500" />
              )}
              {isPrinting ? 'Generando...' : 'Imprimir Constancia'}
            </button>
          </div>
        </div>

        {/* Tarjetas de Datos de la Aceptación / Partes Intervinientes */}
        <div className="p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Titular / Cliente */}
            <div className="p-5 bg-neutral-50 dark:bg-neutral-800/40 rounded-2xl border border-neutral-100 dark:border-neutral-800 space-y-1.5">
              <div className="flex items-center gap-2 text-neutral-400 text-xs font-bold uppercase tracking-wider">
                <Building className="w-4 h-4 text-indigo-500" />
                <span>Empresa / Contraparte</span>
              </div>
              <p className="text-sm font-black text-neutral-900 dark:text-neutral-100 truncate">
                {activeDocument === 'DERICK_PRIVATE' ? 'Almacenes Derick' : (profile?.name || user?.displayName || 'Usuario Registrado')}
              </p>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                {activeDocument === 'DERICK_PRIVATE' ? 'creditosderick15@gmail.com' : (profile?.email || user?.email)}
              </p>
            </div>

            {/* Identificación / RUC */}
            <div className="p-5 bg-neutral-50 dark:bg-neutral-800/40 rounded-2xl border border-neutral-100 dark:border-neutral-800 space-y-1.5">
              <div className="flex items-center gap-2 text-neutral-400 text-xs font-bold uppercase tracking-wider">
                <CreditCard className="w-4 h-4 text-emerald-500" />
                <span>R.U.C. / Representante</span>
              </div>
              <p className="text-sm font-black text-neutral-900 dark:text-neutral-100 font-mono">
                {activeDocument === 'DERICK_PRIVATE' ? '0302370432001' : (profile?.ruc || 'Registrado en cuenta')}
              </p>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                {activeDocument === 'DERICK_PRIVATE' ? 'Rep: DIAZ VASQUEZ MARIO JOE' : `Rol: ${profile?.role || 'enterprise'}`}
              </p>
            </div>

            {/* Régimen / Fecha */}
            <div className="p-5 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 space-y-1.5">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider">
                <Clock className="w-4 h-4" />
                <span>Régimen y Fecha</span>
              </div>
              <p className="text-sm font-black text-indigo-950 dark:text-indigo-100 capitalize">
                {activeDocument === 'DERICK_PRIVATE' ? 'Cortesía Comercial' : acceptance.dateStr}
              </p>
              <p className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400">
                {activeDocument === 'DERICK_PRIVATE' ? 'Actualizado: 22/08/2026' : (acceptance.timeStr || 'Vigente')}
              </p>
            </div>

            {/* Titular y Desarrollador */}
            <div className="p-5 bg-neutral-50 dark:bg-neutral-800/40 rounded-2xl border border-neutral-100 dark:border-neutral-800 space-y-1.5">
              <div className="flex items-center gap-2 text-neutral-400 text-xs font-bold uppercase tracking-wider">
                <Scale className="w-4 h-4 text-amber-500" />
                <span>Titular y Desarrollador</span>
              </div>
              <p className="text-sm font-black text-neutral-900 dark:text-neutral-100 truncate">
                Marcelo Enrique Gutama Chima
              </p>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-mono">
                C.I.: 0105884977 • Ecuador
              </p>
            </div>
          </div>

          <div className="p-4 bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs text-emerald-900 dark:text-emerald-200/90 leading-relaxed">
              <p>
                {activeDocument === 'DERICK_PRIVATE' ? (
                  <>
                    <strong>Documento Privado y Bilateral Vinculante:</strong> Las declaraciones sobre cargo no informático (Cobrador/Supervisor), desarrollo fuera de jornada con medios propios y naturaleza no remunerativa del plan de cortesía tienen carácter permanente y plena validez bajo la legislación ecuatoriana (Código del Trabajo y Código Ingenios).
                  </>
                ) : (
                  <>
                    <strong>Certificación de Consentimiento Electrónico y Licenciamiento:</strong> La vinculación a este contrato de adhesión se formalizó válidamente conforme a la legislación de la <strong>República del Ecuador</strong> (Ley de Comercio Electrónico, Firmas Electrónicas y Mensajes de Datos, Código Civil y Ley Orgánica de Protección de Datos Personales).
                  </>
                )}
              </p>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                Denominación: <em>Sistema ERP de Gestión Comercial, Facturación, Inventarios y Cobranzas</em>.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Visualizador del Documento (General o Privado Derick) */}
      <div className="bg-white dark:bg-neutral-900 rounded-[2.5rem] border border-neutral-100 dark:border-neutral-800 shadow-sm overflow-hidden">
        
        {/* Cabecera de la Sección */}
        <div className="p-8 border-b border-neutral-100 dark:border-neutral-800 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-neutral-50/30 dark:bg-neutral-950/10">
          <div className="flex items-center gap-4">
            <div className={`p-3.5 rounded-2xl ${
              activeDocument === 'DERICK_PRIVATE'
                ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
            }`}>
              {activeDocument === 'DERICK_PRIVATE' ? <Lock className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
            </div>
            <div>
              <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">
                {activeDocument === 'DERICK_PRIVATE' 
                  ? 'Acuerdo Privado de Reconocimiento de Autoría Independiente y Cortesía'
                  : 'Términos y Condiciones de Uso y Licenciamiento'}
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                {activeDocument === 'DERICK_PRIVATE'
                  ? 'Documento privado y bilateral — no público, no incorporado a los Términos estándar de la plataforma.'
                  : 'Documento marco de aplicación general — Texto íntegro y fijo del contrato de adhesión.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar cláusula o texto..."
                className="pl-9 pr-4 py-2 bg-neutral-100 dark:bg-neutral-800 text-xs rounded-xl border border-transparent focus:border-indigo-500 focus:bg-white dark:focus:bg-neutral-900 outline-none transition-all w-48 sm:w-64 text-neutral-800 dark:text-neutral-200"
              />
            </div>
          </div>
        </div>

        {/* Barra de Filtro Rápido por Categorías */}
        <div className="px-4 sm:px-8 py-3 bg-neutral-50/80 dark:bg-neutral-950/40 border-b border-neutral-100 dark:border-neutral-800 flex items-center gap-2 overflow-x-auto text-xs no-scrollbar">
          <span className="text-[10px] font-bold uppercase text-neutral-400 tracking-wider shrink-0 mr-1 flex items-center gap-1">
            <BookOpen className="w-3.5 h-3.5" /> Cláusulas:
          </span>
          {(activeDocument === 'DERICK_PRIVATE'
            ? [
                { id: 'ALL', label: 'Todas las Cláusulas (1-9)' },
                { id: 'OBJETO', label: 'Objeto' },
                { id: 'LABORAL', label: 'Cargo y Naturaleza No Laboral' },
                { id: 'ORIGEN', label: 'Origen y Solicitud Inicial' },
                { id: 'PROPIEDAD', label: 'Desarrollo Independiente' },
                { id: 'TRANSICION', label: 'Cese Laboral' },
                { id: 'COMERCIAL', label: 'No Exclusividad' },
                { id: 'PRIVACIDAD', label: 'Confidencialidad' },
                { id: 'LEGAL', label: 'Vigencia Permanente' },
              ]
            : [
                { id: 'ALL', label: 'Todas las Cláusulas (1-17)' },
                { id: 'GENERAL', label: 'Aceptación y Ámbito' },
                { id: 'PROPIEDAD', label: 'Propiedad Intelectual y Datos' },
                { id: 'LICENCIAMIENTO', label: 'Licencia de Uso' },
                { id: 'PLANES', label: 'Planes, Prueba y Pagos' },
                { id: 'PRIVACIDAD', label: 'Privacidad y LOPDP' },
                { id: 'SEGURIDAD', label: 'Seguridad y Rescisión' },
                { id: 'LEGAL', label: 'Límites, Ley y Jurisdicción' },
                { id: 'SOPORTE', label: 'SLA y Soporte' },
              ]
          ).map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap cursor-pointer ${
                selectedCategory === cat.id
                  ? (activeDocument === 'DERICK_PRIVATE' ? 'bg-amber-600 text-white shadow-sm' : 'bg-indigo-600 text-white shadow-sm')
                  : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Contenido del Documento */}
        <div className="p-4 sm:p-6 md:p-8 lg:p-10 max-h-[75vh] overflow-y-auto overflow-x-auto overscroll-contain touch-pan-y">
          <div ref={printRef} className="w-full max-w-4xl mx-auto space-y-8 text-neutral-700 dark:text-neutral-300 text-xs sm:text-sm leading-relaxed text-left sm:text-justify break-words bg-white dark:bg-neutral-900 p-8 rounded-2xl">
            
            {/* Cabecera del Documento */}
            {activeDocument === 'DERICK_PRIVATE' ? (
              <div className="text-center pb-6 border-b border-neutral-100 dark:border-neutral-800 space-y-2.5 max-w-3xl mx-auto px-2">
                <span className="inline-block px-3.5 py-1 bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[10px] font-black uppercase tracking-widest rounded-full border border-amber-200 dark:border-amber-900/40">
                  Documento Privado y Bilateral — No Público
                </span>
                <h1 className="text-base sm:text-lg md:text-xl font-black text-neutral-900 dark:text-neutral-100 tracking-tight uppercase">
                  ACUERDO PRIVADO DE RECONOCIMIENTO DE AUTORÍA INDEPENDIENTE Y CONDICIÓN DE CORTESÍA
                </h1>
                <div className="text-xs text-neutral-500 dark:text-neutral-400 font-medium space-y-1">
                  <p>Última actualización: <strong>22 de agosto de 2026</strong></p>
                  {profile?.termsAcceptedAt && (
                    <p className="text-indigo-600 dark:text-indigo-400">
                      Términos Aceptados el: <strong>{format(parseISO(profile.termsAcceptedAt), "dd 'de' MMMM 'de' yyyy, 'a las' HH:mm:ss", { locale: es })}</strong>
                    </p>
                  )}
                  {profile?.termsAcceptedAt && (
                    <p className="text-indigo-600 dark:text-indigo-400">
                      Términos Aceptados el: <strong>{format(parseISO(profile.termsAcceptedAt), "dd 'de' MMMM 'de' yyyy, 'a las' HH:mm:ss", { locale: es })}</strong>
                    </p>
                  )}
                  <p>Entre: <strong>Marcelo Enrique Gutama Chima</strong> (el «TITULAR» - C.I.: 0105884977)</p>
                  <p>Y: <strong>Almacenes Derick / DIAZ VASQUEZ MARIO JOE</strong> (la «EMPRESA» - R.U.C.: 0302370432001)</p>
                </div>
              </div>
            ) : (
              <div className="text-center pb-6 border-b border-neutral-100 dark:border-neutral-800 space-y-2.5 max-w-3xl mx-auto px-2">
                <span className="inline-block px-3.5 py-1 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-black uppercase tracking-widest rounded-full border border-indigo-100 dark:border-indigo-900/40">
                  Documento Marco de Aplicación General — Versión Revisada
                </span>
                <h1 className="text-base sm:text-lg md:text-xl font-black text-neutral-900 dark:text-neutral-100 tracking-tight uppercase">
                  TÉRMINOS Y CONDICIONES DE USO Y LICENCIAMIENTO DE SOFTWARE
                </h1>
                <div className="text-xs text-neutral-500 dark:text-neutral-400 font-medium space-y-1">
                  <p>Última actualización: <strong>22 de agosto de 2026</strong></p>
                  {profile?.termsAcceptedAt && (
                    <p className="text-indigo-600 dark:text-indigo-400">
                      Términos Aceptados el: <strong>{format(parseISO(profile.termsAcceptedAt), "dd 'de' MMMM 'de' yyyy, 'a las' HH:mm:ss", { locale: es })}</strong>
                    </p>
                  )}
                  {profile?.termsAcceptedAt && (
                    <p className="text-indigo-600 dark:text-indigo-400">
                      Términos Aceptados el: <strong>{format(parseISO(profile.termsAcceptedAt), "dd 'de' MMMM 'de' yyyy, 'a las' HH:mm:ss", { locale: es })}</strong>
                    </p>
                  )}
                  <p>Titular y Desarrollador: <strong>Marcelo Enrique Gutama Chima</strong> (C.I.: 0105884977)</p>
                  <p>Denominación de la Plataforma: <strong>Sistema ERP de Gestión Comercial, Facturación, Inventarios y Cobranzas</strong> (en adelante, el «SISTEMA»)</p>
                </div>
              </div>
            )}

            {/* Preámbulo / Nota Aclaratoria */}
            {activeDocument === 'DERICK_PRIVATE' ? (
              <div className="p-4 sm:p-5 bg-amber-50/50 dark:bg-amber-950/20 rounded-2xl border border-amber-200/80 dark:border-amber-900/40 text-xs text-amber-950 dark:text-amber-200 leading-relaxed space-y-2 text-left sm:text-justify">
                <p>
                  Este documento es un <strong>acuerdo privado y bilateral</strong>, distinto de los «Términos y Condiciones de Uso y Licenciamiento de Software» que rigen de manera estándar y pública la plataforma frente a cualquier cliente. No se publica, no se expone a terceros, ni forma parte de la oferta comercial general del SISTEMA.
                </p>
                <p>
                  Su único objeto es <strong>dejar constancia expresa de los hechos y declaraciones aquí contenidos</strong>, para efectos probatorios frente a la EMPRESA, en su calidad de empleador actual del TITULAR. En lo relativo al uso operativo del SISTEMA por parte de la EMPRESA, resultan aplicables los Términos y Condiciones Generales de la plataforma, incluyendo la <strong>Cláusula 4</strong> relativa a planes especiales, promocionales o de cortesía, bajo la cual se enmarca el acceso otorgado a la EMPRESA.
                </p>
              </div>
            ) : (
              <div className="p-4 sm:p-5 bg-neutral-50 dark:bg-neutral-800/30 rounded-2xl border border-neutral-200 dark:border-neutral-700/60 text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed text-left sm:text-justify">
                <p>
                  <strong>Nota:</strong> Este documento constituye la plantilla general de Términos y Condiciones aplicable a cualquier CLIENTE que licencie el SISTEMA, bajo el esquema estándar de período de prueba y planes de suscripción de 3, 6 o 12 meses. El TITULAR podrá, adicionalmente y a su discreción, otorgar planes especiales, promocionales o de cortesía mediante acuerdos privados con beneficiarios determinados, conforme a la Cláusula 4, los cuales no se publican ni se incorporan a este documento y no alteran su aplicación estándar frente a los demás CLIENTES.
                </p>
              </div>
            )}

            {/* Lista de Cláusulas */}
            <div className="space-y-6">
              {filteredClauses.length === 0 ? (
                <div className="text-center py-12 text-neutral-400">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-medium">No se encontraron cláusulas que coincidan con la búsqueda.</p>
                </div>
              ) : (
                filteredClauses.map((clause) => (
                  <div 
                    key={clause.id} 
                    id={clause.id}
                    className="space-y-3 pb-6 border-b border-neutral-100 dark:border-neutral-800 last:border-b-0"
                  >
                    <div className="flex items-start sm:items-center gap-3">
                      <span className={`flex items-center justify-center w-7 h-7 rounded-xl font-black text-xs shrink-0 border mt-0.5 sm:mt-0 ${
                        activeDocument === 'DERICK_PRIVATE'
                          ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900/40'
                          : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/40'
                      }`}>
                        {clause.number}
                      </span>
                      <h3 className="text-sm sm:text-base font-black text-neutral-900 dark:text-neutral-100 uppercase tracking-tight">
                        {clause.title}
                      </h3>
                    </div>
                    <div className="pl-0 sm:pl-10 text-xs sm:text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed text-left sm:text-justify break-words">
                      {clause.content}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Firmas y Ratificación al Final del Documento */}
            <div className="mt-8 pt-8 border-t-2 border-neutral-100 dark:border-neutral-800">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-neutral-50 dark:bg-neutral-800/30 p-5 sm:p-6 md:p-8 rounded-3xl border border-neutral-100 dark:border-neutral-800">
                
                {/* Bloque Titular */}
                <div className="space-y-2 border-b md:border-b-0 md:border-r border-neutral-200 dark:border-neutral-700/60 pb-4 md:pb-0 md:pr-6">
                  <p className="text-[11px] font-black text-neutral-400 uppercase tracking-wider">
                    POR EL TITULAR / DESARROLLADOR:
                  </p>
                  <p className="text-sm font-black text-neutral-900 dark:text-neutral-100">
                    Marcelo Enrique Gutama Chima
                  </p>
                  <p className="text-xs font-mono text-neutral-600 dark:text-neutral-400">
                    C.I. : 0105884977
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {activeDocument === 'DERICK_PRIVATE' 
                      ? 'Titular del Software / Cobrador y Supervisor de Cartera'
                      : 'Titular de Propiedad Intelectual del Software'}
                  </p>
                </div>

                {/* Bloque Empresa / Cliente */}
                <div className="space-y-2 md:pl-2">
                  <p className="text-[11px] font-black text-neutral-400 uppercase tracking-wider">
                    {activeDocument === 'DERICK_PRIVATE' ? 'POR LA EMPRESA:' : 'POR EL CLIENTE / EMPRESA LICENCIATARIA:'}
                  </p>
                  <p className="text-sm font-black text-neutral-900 dark:text-neutral-100">
                    Razón Social: {activeDocument === 'DERICK_PRIVATE' ? 'Almacenes Derick / DIAZ VASQUEZ MARIO JOE' : (profile?.name || user?.displayName || '(NOMBRE REGISTRADO EN LA PLATAFORMA)')}
                  </p>
                  <p className="text-xs font-mono text-neutral-600 dark:text-neutral-400">
                    R.U.C.: {activeDocument === 'DERICK_PRIVATE' ? '0302370432001' : (profile?.ruc || '[INGRESADO EN EL REGISTRO]')}
                  </p>
                  {activeDocument === 'DERICK_PRIVATE' ? (
                    <p className="text-xs text-neutral-600 dark:text-neutral-400">
                      Nombre del Representante Legal: <strong>DIAZ VASQUEZ MARIO JOE</strong>
                    </p>
                  ) : (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Aceptado electrónicamente el {acceptance.dateStr} {acceptance.timeStr}
                    </p>
                  )}
                </div>

              </div>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}
