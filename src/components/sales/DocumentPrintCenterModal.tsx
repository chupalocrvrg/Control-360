import React, { useRef, useState, useEffect } from 'react';
import { CreditSale } from '../../types/creditSale';
import { Client } from '../../types/client';
import { formatCurrency, numberToSpanishWords } from '../../lib/utils';
import { printElement, downloadElementAsPdf } from '../../lib/printUtils';
import { 
  Printer, 
  X, 
  FileText, 
  FileSignature, 
  Receipt, 
  Download, 
  CheckCircle2, 
  ShieldCheck, 
  Building2,
  Calendar,
  User,
  ShoppingBag,
  ExternalLink
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export type PrintableDocType = 
  | 'SOLICITUD_CREDITO'
  | 'PAGARE_ORDEN'
  | 'CONTRATO_COMPRAVENTA'
  | 'CARTA_VENTA_FACTURA';

interface DocumentPrintCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: {
    id: string;
    date: string;
    type: 'contado' | 'credito';
    clientName?: string;
    article: string;
    totalValue: number;
    employeeName?: string;
    promissoryNoteNumber?: string;
    creditSaleId?: string;
  } | null;
  creditSaleDetails?: CreditSale | null;
  clientDetails?: Client | null;
  companyName?: string;
  companyRuc?: string;
  companyAddress?: string;
  companyPhone?: string;
}

export const DocumentPrintCenterModal: React.FC<DocumentPrintCenterModalProps> = ({
  isOpen,
  onClose,
  sale,
  creditSaleDetails,
  clientDetails,
  companyName = 'ELECTRO & CRÉDITOS S.A.',
  companyRuc = '1790012345001',
  companyAddress = 'Av. Principal y Secundaria, Ecuador',
  companyPhone = '0999999999'
}) => {
  const [selectedDoc, setSelectedDoc] = useState<PrintableDocType>('SOLICITUD_CREDITO');
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const printAreaRef = useRef<HTMLDivElement>(null);

  // Auto-select based on sale type
  useEffect(() => {
    if (sale) {
      if (sale.type === 'contado') {
        setSelectedDoc('CARTA_VENTA_FACTURA');
      } else {
        setSelectedDoc('SOLICITUD_CREDITO');
      }
    }
  }, [sale]);

  if (!isOpen || !sale) return null;

  const handlePrint = async () => {
    if (printAreaRef.current) {
      await printElement(printAreaRef.current, {
        title: `${selectedDoc}_${sale.clientName?.replace(/\s+/g, '_') || 'Doc'}`,
        pageFormat: 'A4'
      });
    } else {
      window.print();
    }
  };

  const handleDownloadPdf = async () => {
    if (!printAreaRef.current) return;
    try {
      setIsExportingPdf(true);
      await downloadElementAsPdf(
        printAreaRef.current,
        `${selectedDoc}_${sale.clientName?.replace(/\s+/g, '_') || 'Doc'}_${format(new Date(), 'yyyyMMdd')}`,
        { pageFormat: 'A4' }
      );
    } catch (err) {
      console.error('Error al generar PDF:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Helper date
  const displayDate = sale.date 
    ? (() => {
        try {
          const parts = sale.date.split('-');
          return `${parts[2] || '01'} de ${format(new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1), 'MMMM', { locale: es })} del ${parts[0]}`;
        } catch {
          return sale.date;
        }
      })()
    : format(new Date(), "dd 'de' MMMM 'del' yyyy", { locale: es });

  const rawClientName = sale.clientName || (clientDetails?.lastName ? `${clientDetails?.lastName || ''} ${clientDetails?.firstName || ''}`.trim() : 'Consumidor Final');
  const clientLastName = clientDetails?.lastName || (rawClientName.includes(' ') ? rawClientName.split(' ')[0] : rawClientName);
  const clientFirstName = clientDetails?.firstName || (rawClientName.includes(' ') ? rawClientName.split(' ').slice(1).join(' ') : '');
  const clientName = clientLastName && clientFirstName ? `${clientLastName} ${clientFirstName}` : rawClientName;
  const clientIdCard = clientDetails?.idCard || creditSaleDetails?.clientIdCard || '9999999999';
  const clientPhone = clientDetails?.phone || creditSaleDetails?.clientPhone || 'S/N';
  const clientAddress = clientDetails?.address || creditSaleDetails?.clientAddress || 'Ciudad';
  const clientCity = clientDetails?.city || creditSaleDetails?.clientCity || 'Ecuador';

  const guarantorName = creditSaleDetails?.guarantorName || clientDetails?.guarantorName;
  const guarantorIdCard = creditSaleDetails?.guarantorIdCard || clientDetails?.guarantorIdCard;
  const guarantorPhone = creditSaleDetails?.guarantorPhone || clientDetails?.guarantorPhone;
  const guarantorAddress = clientDetails?.guarantorAddress || 'S/N';

  // Dynamic Jurisdiction Canton (e.g., La Troncal or extracted from companyAddress)
  const getJurisdictionCanton = (address: string, fallback = 'La Troncal') => {
    if (!address) return fallback;
    const matches = address.match(/\b(La Troncal|Guayaquil|Quito|Cuenca|Azogues|Cañar|Machala|Ambato|Riobamba|Manta|Portoviejo|Santo Domingo|Ibarra|Loja|Milagro|Duran|Quevedo|Babahoyo|Latacunga|Esmeraldas)\b/i);
    if (matches) return matches[1];
    const parts = address.split(',').map(p => p.trim());
    if (parts.length > 1) {
      const candidate = parts[parts.length - 1].replace(/\./g, '');
      if (candidate.length > 2 && !/ecuador/i.test(candidate)) return candidate;
    }
    return fallback;
  };
  const jurisdictionCanton = getJurisdictionCanton(companyAddress, 'La Troncal');

  // Financial values
  const grossTotal = creditSaleDetails?.grossTotal || sale.totalValue || 0;
  const downPayment = creditSaleDetails?.downPayment || 0;
  const netFinancedAmount = creditSaleDetails?.netFinancedAmount || Math.max(0, grossTotal - downPayment);
  const installmentsCount = creditSaleDetails?.installmentsCount || (creditSaleDetails?.installments?.length || 1);
  const frequency = creditSaleDetails?.frequency || 'MENSUAL';

  // Articles & Smart detection for motorcycles / vehicles
  const contractItems = (creditSaleDetails?.items && creditSaleDetails.items.length > 0)
    ? creditSaleDetails.items
    : [{
        articleId: '1',
        articleName: sale.article || 'Mercadería en General',
        quantity: 1,
        warehouseId: '',
        warehouseName: '',
        unitPrice: sale.totalValue,
        totalPrice: sale.totalValue,
        selectedSeries: [],
        technicalDetails: undefined
      }];

  const isMotorcycleOrVehicle = (name: string) => {
    return /moto|motocicleta|chasis|motor|vin|vehiculo|scooter|cuadron|pasola|trimoto|torito/i.test(name);
  };

  // Amortization Table with Cuota 0 (Entrada / Inicial)
  const amortizationTable = [
    {
      number: 0,
      dueDate: sale.date || format(new Date(), 'yyyy-MM-dd'),
      amount: downPayment,
      description: 'Cuota Inicial / Entrada (Contado a la firma)'
    },
    ...(creditSaleDetails?.installments && creditSaleDetails.installments.length > 0
      ? creditSaleDetails.installments.map(inst => ({
          number: inst.number,
          dueDate: inst.dueDate,
          amount: inst.amount,
          description: `Dividendo Periódico N° ${inst.number}`
        }))
      : Array.from({ length: installmentsCount }, (_, i) => ({
          number: i + 1,
          dueDate: '',
          amount: installmentsCount > 0 ? (netFinancedAmount / installmentsCount) : netFinancedAmount,
          description: `Dividendo Periódico N° ${i + 1}`
        }))
    )
  ];

  const formatAmortizationDate = (dateStr?: string) => {
    if (!dateStr) return '---';
    try {
      const [y, m, d] = dateStr.split('-');
      if (y && m && d) return `${d}/${m}/${y}`;
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  const installmentAmount = creditSaleDetails?.installmentAmount || (installmentsCount > 0 ? (netFinancedAmount / installmentsCount) : netFinancedAmount);
  const lastInstallmentDate = creditSaleDetails?.installments && creditSaleDetails.installments.length > 0
    ? creditSaleDetails.installments[creditSaleDetails.installments.length - 1].dueDate
    : '';

  const formatLegalDate = (dateStr?: string) => {
    if (!dateStr) return displayDate;
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parseInt(parts[2], 10)} de ${format(new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])), 'MMMM', { locale: es })} del ${parts[0]}`;
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  const finalDueDateLegal = lastInstallmentDate ? formatLegalDate(lastInstallmentDate) : displayDate;
  const startDateLegal = creditSaleDetails?.startDate ? formatLegalDate(creditSaleDetails.startDate) : displayDate;

  return (
    <div className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white dark:bg-neutral-900 rounded-3xl w-full max-w-5xl shadow-2xl border border-neutral-200 dark:border-neutral-800 flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Top Header */}
        <div className="p-4 sm:p-5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/70 dark:bg-neutral-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-md shadow-indigo-500/20">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-neutral-900 dark:text-white flex items-center gap-2">
                Centro de Impresión y Documentos Legales
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Imprima o descargue en PDF Solicitudes, Pagarés, Contratos o Notas de Venta
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPdf}
              disabled={isExportingPdf}
              className="px-3 py-2 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Descargar documento activo en PDF"
            >
              <Download className="w-4 h-4 text-indigo-500" />
              <span className="hidden sm:inline">{isExportingPdf ? 'Exportando...' : 'Descargar PDF'}</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-colors flex items-center gap-1.5 shadow-sm shadow-indigo-500/30 cursor-pointer"
              title="Imprimir documento en hoja limpia"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-neutral-400 hover:text-neutral-700 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors cursor-pointer ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Document Selector Tabs */}
        <div className="px-4 sm:px-6 pt-3 pb-2 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/40 dark:bg-neutral-800/20 flex flex-wrap gap-2">
          {sale.type === 'credito' && (
            <>
              <button
                type="button"
                onClick={() => setSelectedDoc('SOLICITUD_CREDITO')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  selectedDoc === 'SOLICITUD_CREDITO'
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/20'
                    : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 border border-neutral-200 dark:border-neutral-700'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>1. Solicitud de Crédito</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedDoc('PAGARE_ORDEN')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  selectedDoc === 'PAGARE_ORDEN'
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/20'
                    : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 border border-neutral-200 dark:border-neutral-700'
                }`}
              >
                <FileSignature className="w-3.5 h-3.5" />
                <span>2. Pagaré a la Orden</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedDoc('CONTRATO_COMPRAVENTA')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  selectedDoc === 'CONTRATO_COMPRAVENTA'
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/20'
                    : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 border border-neutral-200 dark:border-neutral-700'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>3. Contrato de Compra y Venta</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setSelectedDoc('CARTA_VENTA_FACTURA')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              selectedDoc === 'CARTA_VENTA_FACTURA'
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/20'
                : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 border border-neutral-200 dark:border-neutral-700'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>{sale.type === 'credito' ? '4. Nota de Entrega / Carta de Venta' : 'Nota de Venta / Factura de Entrega'}</span>
          </button>
        </div>

        {/* Document Preview Stage */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto bg-neutral-100/60 dark:bg-neutral-950/40">
          <div className="max-w-3xl mx-auto shadow-xl rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800">
            <div 
              ref={printAreaRef}
              className="bg-white text-neutral-900 p-8 sm:p-10 text-[10px] sm:text-xs leading-relaxed space-y-6 select-text"
              style={{ minHeight: '1120px', width: '100%', backgroundColor: '#ffffff', color: '#000000', fontFamily: 'serif' }}
            >
              {/* Common Header */}
              <div className="flex justify-between items-start border-b-2 border-neutral-800 pb-4">
                <div className="flex gap-4 items-center">
                  <div className="w-16 h-16 bg-neutral-900 rounded-lg flex items-center justify-center text-white font-black text-2xl">
                    {companyName.charAt(0)}
                  </div>
                  <div>
                    <h1 className="text-xl font-black uppercase tracking-tight text-neutral-900">
                      {companyName}
                    </h1>
                    <p className="text-[11px] font-semibold text-neutral-600 uppercase">RUC: {companyRuc}</p>
                    <p className="text-[11px] text-neutral-500 capitalize">{companyAddress}</p>
                    <p className="text-[11px] text-neutral-500">Telf: {companyPhone}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="inline-block px-3 py-1 bg-neutral-900 text-white font-mono font-bold text-xs uppercase rounded">
                    {selectedDoc === 'SOLICITUD_CREDITO' && 'SOLICITUD DE CRÉDITO DIRECTO'}
                    {selectedDoc === 'PAGARE_ORDEN' && `PAGARÉ A LA ORDEN N° ${sale.promissoryNoteNumber || 'PAG-2026-0001'}`}
                    {selectedDoc === 'CONTRATO_COMPRAVENTA' && 'CONTRATO DE COMPRAVENTA CON RESERVA'}
                    {selectedDoc === 'CARTA_VENTA_FACTURA' && 'CARTA DE VENTA / NOTA DE ENTREGA'}
                  </div>
                  <p className="text-[11px] text-neutral-500 mt-1.5 font-medium">
                    Fecha de Emisión: <strong>{displayDate}</strong>
                  </p>
                </div>
              </div>

              {/* DOCUMENT 1: SOLICITUD DE CRÉDITO */}
              {selectedDoc === 'SOLICITUD_CREDITO' && (
                <div className="space-y-4">
                  <div className="text-center font-bold text-sm tracking-wide text-neutral-800 uppercase border-b pb-2">
                    Formulario Oficial de Solicitud y Calificación de Crédito
                  </div>

                  {/* 1. Datos Personales */}
                  <div className="border border-neutral-300 rounded p-2.5 space-y-2">
                    <h3 className="font-black text-neutral-800 uppercase text-[10px] border-b pb-1 bg-neutral-50 px-1">1. Datos Personales del Solicitante</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-2 gap-x-4 text-[11px]">
                      <div className="col-span-1"><strong>Apellidos / Razón Social:</strong> {clientDetails?.lastName || (clientName ? clientName.split(' ')[0] : 'S/N')}</div>
                      <div className="col-span-1"><strong>Nombres:</strong> {clientDetails?.firstName || (clientName ? clientName.split(' ').slice(1).join(' ') : 'S/N')}</div>
                      <div><strong>Cédula / RUC:</strong> {clientIdCard}</div>
                      <div><strong>F. Nac. / Lugar:</strong> {clientDetails?.birthDate || 'S/N'} / {clientDetails?.birthPlace || 'S/N'}</div>
                      <div><strong>Est. Civil / Género:</strong> {clientDetails?.civilStatus || 'S/N'} / {clientDetails?.gender || 'S/N'}</div>
                      <div><strong>Teléfono:</strong> {clientPhone}</div>
                      <div className="col-span-2"><strong>Dirección Domicilio:</strong> {clientAddress}</div>
                      <div><strong>Ciudad:</strong> {clientCity}</div>
                      <div><strong>Vivienda / Tiempo:</strong> {clientDetails?.housingType || 'S/N'} ({clientDetails?.residenceTime || 'S/N'})</div>
                      {clientDetails?.housingType === 'ARRENDADA' && (
                        <div><strong>Arrendador / Telf:</strong> {clientDetails?.landlordName || 'S/N'} - {clientDetails?.landlordPhone || 'S/N'}</div>
                      )}
                      <div><strong>Cargas Fam.:</strong> {clientDetails?.dependentsCount || '0'}</div>
                      <div><strong>Instrucción:</strong> {clientDetails?.educationLevel || 'S/N'}</div>
                    </div>
                  </div>

                  {/* 2. Información Laboral */}
                  <div className="border border-neutral-300 rounded p-2.5 space-y-2">
                    <h3 className="font-black text-neutral-800 uppercase text-[10px] border-b pb-1 bg-neutral-50 px-1">2. Información Laboral y Económica</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-2 gap-x-4 text-[11px]">
                      <div className="col-span-2"><strong>Empresa / Lugar Trabajo:</strong> {clientDetails?.workInfo?.workplace || 'Particular / Independiente'}</div>
                      <div><strong>Cargo:</strong> {clientDetails?.workInfo?.position || 'S/N'}</div>
                      <div className="col-span-2"><strong>Dirección Trabajo:</strong> {clientDetails?.workInfo?.workAddress || 'S/N'}</div>
                      <div><strong>Telf. Trabajo:</strong> {clientDetails?.workInfo?.workPhone || 'S/N'}</div>
                    </div>
                  </div>

                  {/* 3. Datos del Cónyuge (si aplica) */}
                  {clientDetails?.civilStatus === 'CASADO' && (
                    <div className="border border-neutral-300 rounded p-2.5 space-y-2">
                      <h3 className="font-black text-neutral-800 uppercase text-[10px] border-b pb-1 bg-neutral-50 px-1">3. Información del Cónyuge</h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-2 gap-x-4 text-[11px]">
                        <div className="col-span-2"><strong>Nombres Cónyuge:</strong> {clientDetails?.spouseInfo?.lastName} {clientDetails?.spouseInfo?.firstName}</div>
                        <div><strong>Cédula:</strong> {clientDetails?.spouseInfo?.idCard || 'S/N'}</div>
                        <div><strong>Teléfono:</strong> {clientDetails?.spouseInfo?.phone || 'S/N'}</div>
                      </div>
                    </div>
                  )}

                  {/* 4. Referencias Personales */}
                  <div className="border border-neutral-300 rounded p-2.5 space-y-2">
                    <h3 className="font-black text-neutral-800 uppercase text-[10px] border-b pb-1 bg-neutral-50 px-1">4. Referencias Personales / Familiares</h3>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-[10px]">
                      {clientDetails?.references && clientDetails.references.length > 0 ? (
                        clientDetails.references.map((ref, idx) => (
                          <div key={idx} className="flex justify-between border-b border-dotted border-neutral-300 pb-0.5">
                            <span>{idx + 1}. {ref.fullName} ({ref.relationship})</span>
                            <span className="font-bold">{ref.phone} - {ref.city}</span>
                          </div>
                        ))
                      ) : (
                        <div className="col-span-2 italic text-neutral-400">No se registraron referencias adicionales.</div>
                      )}
                    </div>
                  </div>

                  {/* 5. Garante Solidario */}
                  {guarantorName && (
                    <div className="border border-neutral-300 rounded p-2.5 space-y-2 bg-indigo-50/10">
                      <h3 className="font-black text-neutral-800 uppercase text-[10px] border-b pb-1 bg-neutral-50 px-1">5. Información del Garante Solidario</h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-2 gap-x-4 text-[11px]">
                        <div className="col-span-2"><strong>Garante:</strong> {guarantorName}</div>
                        <div><strong>Cédula:</strong> {guarantorIdCard}</div>
                        <div><strong>Teléfono:</strong> {guarantorPhone}</div>
                        <div className="col-span-2"><strong>Dirección:</strong> {guarantorAddress}</div>
                      </div>
                    </div>
                  )}

                  {/* 6. Detalles de la Mercadería y Crédito */}
                  <div className="border border-neutral-300 rounded p-2.5 space-y-3">
                    <h3 className="font-black text-neutral-800 uppercase text-[10px] border-b pb-1 bg-neutral-50 px-1">6. Plan de Compra y Financiamiento</h3>
                    <div className="grid grid-cols-1 gap-2">
                      <div className="p-2 border rounded flex justify-between items-center bg-neutral-50">
                        <span className="font-bold uppercase">Artículo: {sale.article}</span>
                        <span className="font-black text-sm">{formatCurrency(sale.totalValue)}</span>
                      </div>
                      
                      {creditSaleDetails && (
                        <div className="grid grid-cols-4 gap-2 text-center text-[10px] border-t pt-2">
                          <div>
                            <span className="text-neutral-500 block uppercase">Subtotal</span>
                            <strong className="text-xs">{formatCurrency(creditSaleDetails.grossTotal)}</strong>
                          </div>
                          <div>
                            <span className="text-neutral-500 block uppercase">Entrada</span>
                            <strong className="text-xs text-emerald-700">{formatCurrency(creditSaleDetails.downPayment)}</strong>
                          </div>
                          <div>
                            <span className="text-neutral-500 block uppercase">Saldo</span>
                            <strong className="text-xs text-indigo-700">{formatCurrency(creditSaleDetails.netFinancedAmount)}</strong>
                          </div>
                          <div>
                            <span className="text-neutral-500 block uppercase">Plazo</span>
                            <strong className="text-xs">{creditSaleDetails.installmentsCount} {creditSaleDetails.frequency}</strong>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Firmas */}
                  <div className="grid grid-cols-3 gap-12 pt-16 text-center text-[10px]">
                    <div className="border-t-2 border-neutral-900 pt-1 space-y-1">
                      <div className="h-12"></div>
                      <strong className="uppercase">{clientName}</strong>
                      <p>C.I.: {clientIdCard}</p>
                      <p className="font-bold">EL SOLICITANTE</p>
                    </div>
                    {guarantorName ? (
                      <div className="border-t-2 border-neutral-900 pt-1 space-y-1">
                        <div className="h-12"></div>
                        <strong className="uppercase">{guarantorName}</strong>
                        <p>C.I.: {guarantorIdCard}</p>
                        <p className="font-bold">EL GARANTE</p>
                      </div>
                    ) : (
                      <div className="border-t-2 border-neutral-900 pt-1 space-y-1">
                        <div className="h-12"></div>
                        <strong className="uppercase">ASESOR DE CRÉDITO</strong>
                        <p>{sale.employeeName || 'VENTAS'}</p>
                        <p className="font-bold">VERIFICACIÓN</p>
                      </div>
                    )}
                    <div className="border-t-2 border-neutral-900 pt-1 space-y-1">
                      <div className="h-12"></div>
                      <strong className="uppercase">GERENCIA / AUTORIZADO</strong>
                      <p>{companyName}</p>
                      <p className="font-bold">APROBACIÓN FINAL</p>
                    </div>
                  </div>
                </div>
              )}

              {/* DOCUMENT 2: PAGARÉ A LA ORDEN */}
              {selectedDoc === 'PAGARE_ORDEN' && (
                <div className="space-y-4 text-[10.5px] font-sans leading-relaxed text-neutral-900">
                  {/* Encabezado Institucional y Metadatos */}
                  <div className="flex justify-between items-start border-b-2 border-neutral-900 pb-3">
                    <div>
                      <h2 className="font-black text-base uppercase tracking-wider text-neutral-900">
                        {companyName}
                      </h2>
                      <p className="text-[10px] text-neutral-600 font-medium">
                        R.U.C.: <strong>{companyRuc}</strong> | Tel: {companyPhone}
                      </p>
                      <p className="text-[10px] text-neutral-600 font-medium">
                        Dirección: {companyAddress}
                      </p>
                    </div>

                    <div className="text-right space-y-1">
                      <div className="font-bold text-xs uppercase tracking-widest text-neutral-800">
                        Pagaré a la Orden Nº <span className="font-mono font-black text-neutral-900">{sale.promissoryNoteNumber || creditSaleDetails?.promissoryNoteNumber || 'PAG-0001'}</span>
                      </div>
                      <div className="text-[11px] font-medium text-neutral-700">
                        <strong>Vence el:</strong> <span className="font-bold text-neutral-900">{finalDueDateLegal}</span>
                      </div>
                      <div className="text-sm font-black font-mono text-neutral-900 bg-neutral-100 px-2 py-0.5 rounded border border-neutral-300 inline-block">
                        Por $ : {netFinancedAmount.toFixed(2)} USD
                      </div>
                    </div>
                  </div>

                  {/* Cláusula Principal de Pago Incondicional */}
                  <p className="text-justify leading-relaxed">
                    Debo y pagaré incondicionalmente, a la orden de <strong>{companyName} (o de su titular propietario legal)</strong>, con R.U.C. N° <strong>{companyRuc}</strong>, en esta ciudad o en el lugar donde fuera convenido, la cantidad de <strong>{numberToSpanishWords(netFinancedAmount)} DÓLARES DE LOS ESTADOS UNIDOS DE AMÉRICA (US $ {netFinancedAmount.toFixed(2)})</strong>, que en concepto de capital me obligo incondicionalmente a pagar a partir del <strong>{startDateLegal}</strong> hasta el <strong>{finalDueDateLegal}</strong>, mediante <strong>{installmentsCount}</strong> cuotas o dividendos sucesivos de periodicidad <strong>{frequency}</strong> por el valor de <strong>{formatCurrency(installmentAmount)}</strong> cada una, valor recibido a mi entera satisfacción por concepto de saldo de compraventa de mercadería.
                  </p>

                  {/* Tasa Pactada e Interés Moratorio */}
                  <p className="text-justify leading-relaxed">
                    En la fecha de vencimiento de los antedichos valores, me obligo además incondicionalmente a pagar a <strong>{companyName} (o de su titular propietario legal)</strong> la tasa de interés pactada para la presente operación crediticia desde la fecha de suscripción de este pagaré hasta el vencimiento del plazo de los respectivos valores. En caso de mora o retraso en el pago de uno o más de los dividendos del capital, la mora se liquidará desde la fecha de vencimiento respectivo y devengará automáticamente la <strong>tasa máxima de interés de mora permitida por las regulaciones vigentes del Banco Central del Ecuador</strong>, la cual correrá hasta la fecha en que se efectúe la cancelación total de la obligación.
                  </p>

                  {/* Aceleración de Deuda y Vía Ejecutiva */}
                  <p className="text-justify leading-relaxed">
                    <strong>{companyName} (o de su titular propietario legal)</strong> podrá declarar de plazo vencido anticipado todas las obligaciones y dividendos que estuvieren vigentes, aun cuando no estuvieren vencidos, y proceder al recaudo judicial de todo lo debido. Me obligo además a cubrir los impuestos, tasas, gastos judiciales y extrajudiciales, inclusive honorarios profesionales, que ocasione la suscripción de este Pagaré y su cobro, siendo suficiente prueba para establecer tales gastos la sola aseveración o liquidación del acreedor. En caso de incumplimiento de todo lo estipulado, me obligo con todos mis bienes presentes o futuros, propios y gananciales.
                  </p>

                  {/* Pluralidad de partes */}
                  <p className="text-justify leading-relaxed">
                    Siempre que los suscriptores de este pagaré, en su calidad de deudor o garante sean más de uno, los términos del presente documento se entenderán en plural; igualmente, si el deudor es una persona jurídica, las declaraciones se entienden hechas por su representante legal por sus propios derechos y por los que representa de ella.
                  </p>

                  {/* Jurisdicción y Sin Protesto */}
                  <p className="text-justify leading-relaxed">
                    En caso de controversia las partes acuerdan someterse a cualquiera de los jueces competentes de lo civil en la ciudad o cantón de <strong>{jurisdictionCanton}</strong> y en la <strong>vía ejecutiva</strong>, para cuyo efecto renuncio expresamente a fuero y domicilio. Con la cláusula <strong>SIN PROTESTO</strong>, eximiendo al acreedor de presentación para el pago y de aviso por falta del mismo. Para constancia se firma en la ciudad de <strong>{jurisdictionCanton}</strong>, el <strong>{displayDate}</strong>.
                  </p>

                  {/* Autorización de Burós de Crédito y Central de Riesgos */}
                  <div className="p-2.5 border border-neutral-300 rounded bg-neutral-50/50 print:bg-transparent text-[10px] space-y-1">
                    <strong className="block text-[10.5px] uppercase text-neutral-900 tracking-wide">
                      AUTORIZACIÓN DE RIESGOS CREDITICIOS (LEY ORGÁNICA DE PROTECCIÓN DE DATOS PERSONALES):
                    </strong>
                    <p className="text-justify leading-normal text-neutral-700">
                      Autorizo(amos) expresa, previa e irrevocablemente a <strong>{companyName} (o de su titular propietario legal)</strong>, con R.U.C. N° <strong>{companyRuc}</strong>, para que obtenga cuantas veces sean necesarias, de cualquier fuente de información, incluidos los burós de crédito legalmente autorizados y la Dirección Nacional de Registro de Datos Públicos / Central de Riesgos, mi información de riesgos crediticios y comportamiento comercial; de igual manera <strong>{companyName} (o de su titular propietario legal)</strong> queda expresamente autorizado para que pueda transferir o entregar dicha información a los burós de crédito y/o a la Central de Riesgos de conformidad con la legislación aplicable.
                    </p>
                  </div>

                  {/* Firma del Deudor Principal */}
                  <div className="pt-2 space-y-2">
                    <div className="w-full max-w-sm">
                      <p className="text-[10px] text-neutral-500">Firma: ................................................................................</p>
                      <div className="mt-1 text-[10px] space-y-0.5">
                        <p><strong>DEUDOR:</strong> <span className="uppercase">{clientLastName} {clientFirstName}</span></p>
                        <p><strong>C.C./RUC:</strong> <span className="font-mono">{clientIdCard}</span></p>
                        <p><strong>Dirección:</strong> {clientAddress}</p>
                        <p><strong>Teléfono:</strong> {clientPhone}</p>
                      </div>
                    </div>
                    <p className="text-[10px] font-semibold text-neutral-800">
                      Para los fines de ley, expresamos nuestro visto bueno, <strong>SIN PROTESTO</strong>. {jurisdictionCanton}, {displayDate}.
                    </p>
                  </div>

                  {/* Bloque POR AVAL (Garante Solidario) */}
                  {guarantorName ? (
                    <div className="pt-2 border-t border-neutral-300 space-y-2">
                      <p className="text-justify leading-relaxed">
                        <strong>POR AVAL:</strong> Me constituyo en garantía y codeudor solidario del deudor <strong>{clientLastName} {clientFirstName}</strong> en todas y cada una de las obligaciones contraídas por el mismo en este documento a la orden de <strong>{companyName} (o de su titular propietario legal)</strong>, por lo que estipulo expresamente mi obligación incondicional de pagar las antedichas obligaciones comprometiéndome con todos mis bienes presentes y futuros, propios y gananciales, y renuncio expresamente a los beneficios de orden, excusión de domicilio, división y otros que pudieran favorecerme. Asimismo me constituyo pagador de las obligaciones del deudor contraídas en este pagaré, <strong>haciendo de deuda ajena deuda propia</strong>.
                      </p>
                      <p className="text-justify leading-relaxed">
                        La presente garantía y obligación solidaria suscrita por todo el tiempo que duren o se encuentren vigentes las obligaciones a cargo del deudor principal y aún cuando venciere el plazo estipulado de las obligaciones a que accede este aval. Acepto que mi obligación como garante será válida aún cuando la obligación principal fuere nula por cualquier causa. <strong>SIN PROTESTO</strong>, exímese de presentación para el pago y de aviso por falta del mismo, para constancia se firma en <strong>{jurisdictionCanton}</strong>, el <strong>{displayDate}</strong>.
                      </p>

                      <div className="w-full max-w-sm pt-2">
                        <p className="text-[10px] text-neutral-500">Firma: ................................................................................</p>
                        <div className="mt-1 text-[10px] space-y-0.5">
                          <p><strong>AVAL / GARANTE SOLIDARIO:</strong> <span className="uppercase">{guarantorName}</span></p>
                          <p><strong>C.C./RUC:</strong> <span className="font-mono">{guarantorIdCard}</span></p>
                          <p><strong>Dirección:</strong> {guarantorAddress}</p>
                          <p><strong>Teléfono:</strong> {guarantorPhone}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="pt-2 border-t border-neutral-200 text-[10px] text-neutral-600 italic">
                      Obligación aprobada bajo solvencia y responsabilidad patrimonial exclusiva de EL DEUDOR principal (sin aval adicional).
                    </div>
                  )}
                </div>
              )}

              {/* DOCUMENT 3: CONTRATO DE COMPRAVENTA CON RESERVA DE DOMINIO */}
              {selectedDoc === 'CONTRATO_COMPRAVENTA' && (
                <div className="space-y-4 text-[10.5px] font-sans leading-relaxed text-neutral-900">
                  {/* Encabezado Institucional */}
                  <div className="border-b-2 border-neutral-900 pb-2.5 text-center space-y-1">
                    <h2 className="font-black text-base uppercase tracking-wider text-neutral-900">
                      {companyName}
                    </h2>
                    <p className="text-[11px] font-semibold text-neutral-700 italic">
                      Líderes en atención personalizada
                    </p>
                    <div className="flex flex-wrap justify-center gap-x-6 text-[10px] text-neutral-600 font-medium">
                      <span><strong>Dirección:</strong> {companyAddress}</span>
                      <span><strong>Teléfono:</strong> {companyPhone}</span>
                      <span><strong>R.U.C.:</strong> {companyRuc}</span>
                    </div>
                  </div>

                  {/* Título Oficial */}
                  <div className="text-center font-black text-sm uppercase tracking-widest text-neutral-900 border-b border-neutral-400 pb-1.5 pt-1">
                    CONTRATO DE COMPRA VENTA - CON RESERVA DE DOMINIO
                  </div>

                  {/* Comparecencia */}
                  <p className="text-justify leading-relaxed">
                    Conste por el presente instrumento de contrato compraventa con reserva de dominio que se otorga de conformidad con lo que dispone la Ley de acuerdo a las siguientes cláusulas:
                  </p>

                  {/* CLÁUSULA PRIMERA: CONTRATANTES */}
                  <div className="space-y-1">
                    <p className="text-justify leading-relaxed">
                      <strong>PRIMER.- CONTRATANTES:</strong> Por una parte <strong>{companyName}</strong> con # de R.U.C.: <strong>{companyRuc}</strong>, con domicilio en <strong>{companyAddress}</strong>, a quien también se denominará propietario, vendedor o acreedor; y por otra parte el señor(a) <strong>{clientName}</strong> con C.I./RUC <strong>{clientIdCard}</strong>, domiciliado en las calles <strong>{clientAddress}</strong> de la ciudad de <strong>{clientCity}</strong>, teléfono <strong>{clientPhone}</strong>, a quien también se llamará comprador o deudor.
                    </p>
                  </div>

                  {/* CLÁUSULA SEGUNDA: DESCRIPCIÓN DE LOS BIENES */}
                  <div className="space-y-1">
                    <p className="text-justify leading-relaxed">
                      <strong>SEGUNDA.- DESCRIPCION DE LOS BIENES:</strong> El vendedor es propietario de los bienes muebles, cuyas características, especificaciones y valores se describen a continuación:
                    </p>

                    <div className="border border-neutral-300 rounded p-2 bg-neutral-50/60 print:bg-transparent space-y-2 text-[10px]">
                      {contractItems.map((item, idx) => {
                        const isMoto = isMotorcycleOrVehicle(item.articleName);
                        const seriesStr = item.selectedSeries && item.selectedSeries.length > 0 ? item.selectedSeries.join(' / ') : 'SEGÚN SERIE TÉCNICA EN SISTEMA';
                        return (
                          <div key={idx} className="border-b border-neutral-200 last:border-b-0 pb-1.5 last:pb-0">
                            <div className="flex justify-between items-center font-bold">
                              <span>Artículo {idx + 1}: <span className="uppercase text-neutral-900">{item.articleName}</span></span>
                              <span className="font-mono text-xs font-black">{formatCurrency(item.totalPrice || item.unitPrice * item.quantity)}</span>
                            </div>
                            
                            {isMoto ? (
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-1 text-[9.5px] bg-white print:bg-transparent p-1.5 rounded border border-neutral-200">
                                <div><strong>Clase/Tipo:</strong> {item.technicalDetails?.vehicleClass || 'MOTOCICLETA'} / {item.technicalDetails?.vehicleType || 'PASEO'}</div>
                                <div><strong>N° Chasis / Serie:</strong> <span className="font-mono font-bold">{item.technicalDetails?.chassis || seriesStr}</span></div>
                                <div><strong>N° de Motor:</strong> <span className="font-mono font-bold">{item.technicalDetails?.engine || 'S/N'}</span></div>
                                <div><strong>Marca/Modelo:</strong> {item.technicalDetails?.brand || 'S/N'} {item.technicalDetails?.model || ''}</div>
                                <div><strong>Año:</strong> {item.technicalDetails?.year || (sale.date ? sale.date.split('-')[0] : new Date().getFullYear())}</div>
                                <div><strong>Color:</strong> {item.technicalDetails?.color || 'S/N'}</div>
                                <div><strong>Cilindraje:</strong> {item.technicalDetails?.cylinderCapacity || 'S/N'}</div>
                                <div><strong>Procedencia:</strong> {item.technicalDetails?.origin || 'S/N'}</div>
                                <div className="col-span-2"><strong>CAMV:</strong> {item.technicalDetails?.camv || 'S/N'}</div>
                                <div className="col-span-2 text-right"><strong>Valor Unitario:</strong> {formatCurrency(item.unitPrice || item.totalPrice)}</div>
                              </div>
                            ) : (
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mt-1 text-[9.5px] bg-white print:bg-transparent p-1.5 rounded border border-neutral-200">
                                <div><strong>Cantidad:</strong> {item.quantity} Unidad(es)</div>
                                <div className="col-span-2"><strong>Serie(s) de Fábrica:</strong> <span className="font-mono font-bold">{seriesStr}</span></div>
                                <div className="col-span-3"><strong>Condición:</strong> NUEVO, EN PERFECTO FUNCIONAMIENTO A ENTERA SATISFACCIÓN</div>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      <div className="text-right pt-1 font-black text-[11px] border-t border-neutral-300">
                        VALOR TOTAL: {formatCurrency(grossTotal)} ({numberToSpanishWords(grossTotal)} DÓLARES)
                      </div>
                    </div>
                  </div>

                  {/* CLÁUSULA TERCERA: COMPRAVENTA */}
                  <div className="space-y-1">
                    <p className="text-justify leading-relaxed">
                      <strong>TERCERA.- COMPRAVENTA:</strong> El propietario vende los objetos detallados en la cláusula que antecede al comprador, reservándose el derecho de dominio que tiene sobre ellos hasta la total cancelación del precio estipulado; es decir, que la venta se perfeccionará en el instante exacto en que sea cubierta la totalidad del precio pactado.
                    </p>
                  </div>

                  {/* CLÁUSULA CUARTA: PRECIO Y FINANCIAMIENTO */}
                  <div className="space-y-1">
                    <p className="text-justify leading-relaxed">
                      <strong>CUARTA.- PRECIO Y FORMA DE PAGO:</strong> El precio pactado por los objetos materia de la compraventa es el de <strong>US $ {grossTotal.toFixed(2)} ({numberToSpanishWords(grossTotal)} DÓLARES AMERICANOS)</strong>, el cual se pagará de la siguiente forma: una cuota inicial (entrada) de <strong>US $ {downPayment.toFixed(2)} ({numberToSpanishWords(downPayment)} DÓLARES AMERICANOS)</strong> a la firma de este contrato, y el saldo restante de <strong>US $ {netFinancedAmount.toFixed(2)} ({numberToSpanishWords(netFinancedAmount)} DÓLARES AMERICANOS)</strong> financiado en <strong>{installmentsCount}</strong> dividendos con frecuencia <strong>{frequency}</strong> según la tabla adjunta, por el que se han suscrito las correspondientes obligaciones cambiarias:
                    </p>

                    {/* Tabla de amortización que incluye Cuota 0 */}
                    <div className="my-2 border border-neutral-300 rounded overflow-hidden">
                      <table className="w-full text-center border-collapse text-[10px]">
                        <thead>
                          <tr className="bg-neutral-900 text-white font-bold print:bg-neutral-900 print:text-white">
                            <th className="py-1 px-2 border-r border-neutral-700 w-16"># Cuota</th>
                            <th className="py-1 px-2 border-r border-neutral-700 w-28">Fecha Vence</th>
                            <th className="py-1 px-2 border-r border-neutral-700 text-right w-28">Dividendo</th>
                            <th className="py-1 px-2 text-left pl-3">Detalle de Obligación</th>
                          </tr>
                        </thead>
                        <tbody>
                          {amortizationTable.map((row, rIdx) => (
                            <tr key={rIdx} className={rIdx === 0 ? "bg-amber-50/80 font-bold border-b border-neutral-300" : "border-b border-neutral-200 even:bg-neutral-50/50"}>
                              <td className="py-0.5 px-2 border-r border-neutral-200 font-mono">{row.number}</td>
                              <td className="py-0.5 px-2 border-r border-neutral-200 font-mono">{formatAmortizationDate(row.dueDate)}</td>
                              <td className="py-0.5 px-2 border-r border-neutral-200 text-right font-mono font-bold">{formatCurrency(row.amount)}</td>
                              <td className="py-0.5 px-2 text-left pl-3">{row.description}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-neutral-100 font-black border-t-2 border-neutral-800">
                            <td colSpan={2} className="py-1 px-2 text-right uppercase">Suma Total del Contrato:</td>
                            <td className="py-1 px-2 text-right font-mono text-neutral-900 font-black">{formatCurrency(grossTotal)}</td>
                            <td className="py-1 px-2 text-left pl-3 text-[9px] text-neutral-600">Totalmente cancelado al liquidar el último dividendo</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    <p className="text-justify leading-relaxed">
                      {guarantorName ? (
                        <>
                          La misma que se encuentra afianzada y garantizada solidariamente por el señor(a) <strong>{guarantorName}</strong>, con Cédula de Identidad N° <strong>{guarantorIdCard}</strong>, con domicilio en <strong>{guarantorAddress}</strong>, quien se somete expresamente a todas las estipulaciones de este contrato.
                        </>
                      ) : (
                        <>
                          La presente obligación ha sido aprobada bajo la responsabilidad patrimonial y solvencia exclusiva de <strong>EL COMPRADOR</strong> en calidad de deudor principal, sin que se requiera codeudor solidario.
                        </>
                      )}
                    </p>
                  </div>

                  {/* CLÁUSULA QUINTA: RECEPCIÓN */}
                  <div className="space-y-1">
                    <p className="text-justify leading-relaxed">
                      <strong>QUINTA.- RECEPCIÓN:</strong> Lo descrito en la cláusula segunda lo ha recibido el comprador a su entera satisfacción y deberá conservarlo y mantenerlo durante la vigencia del contrato en su domicilio antes mencionado, con la obligación ineludible de notificar al vendedor el cambio de su domicilio o residencia, a más tardar en ocho (8) días posteriores a dicho cambio. En ningún caso podrá el comprador sacar fuera del país lo que es objeto de este contrato, ni entregarlo a otras personas sin autorización escrita del vendedor.
                    </p>
                  </div>

                  {/* CLÁUSULA SEXTA: RESERVA DE DOMINIO */}
                  <div className="space-y-1">
                    <p className="text-justify leading-relaxed">
                      <strong>SEXTA.- RESERVA DE DOMINIO:</strong> El vendedor se reserva el dominio de lo vendido hasta que el comprador haya pagado la totalidad del precio. El comprador adquirirá el dominio, esto es, será dueño de la cosa vendida únicamente cuando haya pagado la totalidad del precio y podrá entonces pedir al vendedor que le otorgue el respectivo título de propiedad. Sin embargo, el comprador asume los riesgos que corra tal cosa desde la fecha de este contrato por haberla recibido en poder del vendedor. En consecuencia, el comprador no podrá verificar contrato alguno de venta, permuta, arriendo, cesión ni constituir gravamen alguno sobre los bienes objeto de este instrumento.
                    </p>
                  </div>

                  {/* CLÁUSULA SÉPTIMA: FALTA DE PAGO */}
                  <div className="space-y-1">
                    <p className="text-justify leading-relaxed">
                      <strong>SEPTIMA.- FALTA DE PAGO:</strong> Si el comprador no pagare uno de los documentos o cuotas indicados en este contrato, el vendedor tiene derecho a dar por vencidos los plazos fijados y exigir el pago inmediato del saldo adeudado, devengándose desde la fecha de mora la <strong>tasa máxima de interés moratorio permitida por la regulación del Banco Central del Ecuador</strong>, más las costas procesales y honorarios profesionales que ocasione su cobro judicial o extrajudicial. Asimismo, el vendedor tiene la opción de proceder en cualquiera de las siguientes formas:
                    </p>
                    <div className="pl-3 space-y-1 text-justify leading-relaxed">
                      <p>
                        <strong>1)</strong> Acudir a un Juez presentando el respectivo contrato y certificado otorgado por el registrador de la propiedad o mercantil para que el Juez disponga que uno de los alguaciles aprehenda las cosas materia de este contrato dondequiera que se encuentren y las entregue al vendedor. En este caso, las cuotas parciales pagadas en concepto de precio y la cuota de contado quedarán a beneficio del vendedor a título de indemnización, pero esta en ningún caso podrá exceder de la <strong>tercera parte (1/3)</strong> del precio fijado en el contrato; si las cantidades abonadas excedieren de la tercera parte, el vendedor devolverá dicho exceso al comprador. Sin embargo, el comprador podrá recuperar los objetos adquiridos si dentro de los quince (15) días posteriores a dicho vencimiento se pone al día en el pago de sus cuotas u ofrece suficiente garantía a satisfacción del vendedor; o,
                      </p>
                      <p>
                        <strong>2)</strong> Pedir que el Juez disponga el remate de los objetos vendidos de acuerdo con lo dispuesto en el Art. 59 del Código de Comercio a que se refiere el artículo No. 10 enumeradas de la Ley de "La venta con reserva de dominio" y las disposiciones pertinentes del Código Orgánico General de Procesos, pudiendo además proceder el vendedor conforme el trámite establecido para el remate de la prenda comercial. El producto del remate se aplicará al pago de las cuotas vencidas y a cubrir además los gastos del remate y judiciales, debiendo entregarse al comprador el saldo que hubiere. Si dicho producto no alcanzare a cubrir el valor del crédito, el vendedor podrá iniciar una nueva acción contra el comprador y/o su garante solidario para obtener la cancelación del saldo que le quedare adeudando inclusive los gastos judiciales y honorarios.
                      </p>
                    </div>
                  </div>

                  {/* CLÁUSULA OCTAVA: LEGISLACIÓN */}
                  <div className="space-y-1">
                    <p className="text-justify leading-relaxed">
                      <strong>OCTAVA.- LEGISLACION:</strong> En todo cuanto no estuviere previsto en este contrato se someten las partes a la Ley sobre ventas con reserva de dominio y al Código de Comercio, la cual las partes declaran conocerla plenamente. Para constancia suscribe este contrato en tres (3) ejemplares de igual tenor, uno para cada parte y el tercer ejemplar para el Registro de la Propiedad o Registro Mercantil donde deberán inscribirse en el libro respectivo.
                    </p>
                  </div>

                  {/* CLÁUSULA NOVENA: JURISDICCIÓN */}
                  <div className="space-y-1">
                    <p className="text-justify leading-relaxed">
                      <strong>NOVENA.- JURISDICCION:</strong> Los contratantes para efectos de este contrato y de cualquier reclamación judicial derivada del mismo, renuncian expresamente a fuero y domicilio, y se someten expresamente a los jueces competentes del cantón <strong>{jurisdictionCanton}</strong> y al trámite ejecutivo o sumario a elección del actor.
                    </p>
                  </div>

                  {/* BLOQUE DE FIRMAS */}
                  <div className={guarantorName ? "grid grid-cols-3 gap-8 pt-12 text-center text-[10px]" : "grid grid-cols-2 gap-16 pt-12 text-center text-[10px]"}>
                    <div className="space-y-1">
                      <div className="border-t-2 border-neutral-900 pt-1">
                        <strong className="uppercase block text-xs">{companyName}</strong>
                        <p className="text-[10px] text-neutral-600 font-mono">R.U.C.: {companyRuc}</p>
                        <p className="font-bold text-[9px] uppercase tracking-wider text-neutral-800">AGENTE / VENDEDOR</p>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="border-t-2 border-neutral-900 pt-1">
                        <strong className="uppercase block text-xs">{clientLastName}</strong>
                        <strong className="uppercase block text-xs">{clientFirstName}</strong>
                        <p className="text-[10px] text-neutral-600 font-mono">C.I. / RUC: {clientIdCard}</p>
                        <p className="font-bold text-[9px] uppercase tracking-wider text-neutral-800">COMPRADOR</p>
                        <p className="text-[8px] text-neutral-400">Huella Digital</p>
                      </div>
                      <div className="w-14 h-16 border border-neutral-300 mx-auto rounded mt-1 bg-neutral-50/50 print:bg-transparent"></div>
                    </div>

                    {guarantorName && (
                      <div className="space-y-1">
                        <div className="border-t-2 border-neutral-900 pt-1">
                          <strong className="uppercase block text-xs">{guarantorName}</strong>
                          <p className="text-[10px] text-neutral-600 font-mono">C.I.: {guarantorIdCard}</p>
                          <p className="font-bold text-[9px] uppercase tracking-wider text-neutral-800">GARANTE</p>
                          <p className="text-[8px] text-neutral-400">Huella Digital</p>
                        </div>
                        <div className="w-14 h-16 border border-neutral-300 mx-auto rounded mt-1 bg-neutral-50/50 print:bg-transparent"></div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* DOCUMENT 4: CARTA DE VENTA / NOTA DE ENTREGA */}
              {selectedDoc === 'CARTA_VENTA_FACTURA' && (
                <div className="space-y-6 text-[11px]">
                  <div className="text-center font-black text-sm tracking-widest text-neutral-900 uppercase border-b-2 border-neutral-800 pb-2">
                    Nota de Entrega / Certificado de Propiedad
                  </div>

                  <div className="grid grid-cols-2 gap-4 border-2 border-neutral-800 p-4 rounded-lg bg-neutral-50/50">
                    <div className="space-y-1">
                      <p><strong className="uppercase">Cliente:</strong> {clientName}</p>
                      <p><strong className="uppercase">Identificación:</strong> {clientIdCard}</p>
                      <p><strong className="uppercase">Dirección:</strong> {clientAddress}</p>
                      <p><strong className="uppercase">Teléfono:</strong> {clientPhone}</p>
                    </div>
                    <div className="text-right space-y-1">
                      <p><strong className="uppercase">Fecha:</strong> {displayDate}</p>
                      <p><strong className="uppercase">Modalidad:</strong> {sale.type === 'credito' ? 'CRÉDITO DIRECTO' : 'CONTADO'}</p>
                      <p><strong className="uppercase">Vendedor:</strong> {sale.employeeName || 'Ventas'}</p>
                      <p><strong className="uppercase">Comprobante N°:</strong> {sale.id.slice(0, 12).toUpperCase()}</p>
                    </div>
                  </div>

                  <table className="w-full border-2 border-neutral-900 border-collapse">
                    <thead>
                      <tr className="bg-neutral-900 text-white text-[10px] uppercase tracking-widest">
                        <th className="p-3 border border-neutral-600 text-center w-16">Cant.</th>
                        <th className="p-3 border border-neutral-600 text-left">Descripción detallada del artículo</th>
                        <th className="p-3 border border-neutral-600 text-right w-24">P. Unitario</th>
                        <th className="p-3 border border-neutral-600 text-right w-24">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contractItems.map((item, idx) => (
                        <tr key={idx} className="align-top border-b border-neutral-200">
                          <td className="p-3 border border-neutral-300 text-center font-black">{item.quantity.toString().padStart(2, '0')}</td>
                          <td className="p-3 border border-neutral-300 font-bold uppercase text-[11px]">
                            {item.articleName}
                            {item.technicalDetails && (
                              <div className="mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[9px] text-neutral-600 font-normal normal-case">
                                {item.technicalDetails.chassis && <span><strong>Chasis:</strong> {item.technicalDetails.chassis}</span>}
                                {item.technicalDetails.engine && <span><strong>Motor:</strong> {item.technicalDetails.engine}</span>}
                                {item.technicalDetails.color && <span><strong>Color:</strong> {item.technicalDetails.color}</span>}
                                {item.technicalDetails.year && <span><strong>Año:</strong> {item.technicalDetails.year}</span>}
                                {item.technicalDetails.brand && <span><strong>Marca:</strong> {item.technicalDetails.brand}</span>}
                                {item.technicalDetails.model && <span><strong>Modelo:</strong> {item.technicalDetails.model}</span>}
                                {item.technicalDetails.camv && <span className="col-span-2"><strong>CAMV:</strong> {item.technicalDetails.camv}</span>}
                              </div>
                            )}
                          </td>
                          <td className="p-3 border border-neutral-300 text-right font-mono">{formatCurrency(item.unitPrice)}</td>
                          <td className="p-3 border border-neutral-300 text-right font-mono font-black">{formatCurrency(item.totalPrice)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-neutral-900 text-white font-black text-xs">
                        <td colSpan={3} className="p-3 text-right uppercase tracking-wider">Valor Total a Pagar / Cancelado:</td>
                        <td className="p-3 text-right font-mono">{formatCurrency(sale.totalValue)}</td>
                      </tr>
                    </tfoot>
                  </table>

                  <div className="grid grid-cols-1 gap-2 p-4 border-2 border-dashed border-neutral-400 rounded-lg bg-neutral-50">
                    <p className="font-bold text-[10px] uppercase">Cláusulas de Garantía:</p>
                    <p className="text-[10px] text-neutral-600 text-justify">
                      1. Este documento certifica la entrega del bien en perfectas condiciones. 2. La garantía cubre defectos de fabricación por el tiempo estipulado en la póliza del fabricante. 3. Para reclamos es indispensable presentar este comprobante. 4. No cubre daños por mal uso, golpes o variaciones de voltaje.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-20 pt-16 text-center text-[10px]">
                    <div className="border-t-2 border-neutral-900 pt-2 space-y-1">
                      <div className="h-12"></div>
                      <strong className="uppercase">BODEGA / DESPACHO</strong>
                      <p>{companyName}</p>
                    </div>
                    <div className="border-t-2 border-neutral-900 pt-2 space-y-1">
                      <div className="h-12"></div>
                      <strong className="uppercase">{clientName}</strong>
                      <p>C.I.: {clientIdCard}</p>
                      <p className="font-bold">RECIBÍ CONFORME</p>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
