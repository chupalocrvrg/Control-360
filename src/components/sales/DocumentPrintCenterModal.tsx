import React, { useRef, useState, useEffect } from 'react';
import { CreditSale } from '../../types/creditSale';
import { Client } from '../../types/client';
import { formatCurrency } from '../../lib/utils';
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

  const clientName = sale.clientName || (clientDetails?.lastName ? `${clientDetails?.lastName || ''} ${clientDetails?.firstName || ''}`.trim() : 'Consumidor Final');
  const clientIdCard = clientDetails?.idCard || creditSaleDetails?.clientIdCard || '9999999999';
  const clientPhone = clientDetails?.phone || creditSaleDetails?.clientPhone || 'S/N';
  const clientAddress = clientDetails?.address || creditSaleDetails?.clientAddress || 'Ciudad';
  const clientCity = clientDetails?.city || creditSaleDetails?.clientCity || 'Ecuador';

  const guarantorName = creditSaleDetails?.guarantorName || clientDetails?.guarantorName;
  const guarantorIdCard = creditSaleDetails?.guarantorIdCard || clientDetails?.guarantorIdCard;
  const guarantorPhone = creditSaleDetails?.guarantorPhone || clientDetails?.guarantorPhone;
  const guarantorAddress = clientDetails?.guarantorAddress || 'S/N';

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
                <div className="space-y-8 py-4">
                  <div className="flex justify-between items-center bg-neutral-100 p-4 rounded border-2 border-neutral-800">
                    <div>
                      <span className="text-[11px] text-neutral-600 block uppercase font-bold tracking-wider">Por la cantidad de:</span>
                      <strong className="text-2xl text-neutral-900 font-serif font-black">
                        {formatCurrency(creditSaleDetails?.netFinancedAmount || sale.totalValue)}
                      </strong>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] text-neutral-600 block uppercase font-bold tracking-wider">Pagaré N°:</span>
                      <strong className="text-lg text-neutral-900 font-mono font-bold">
                        {sale.promissoryNoteNumber || 'PAG-2026-0001'}
                      </strong>
                    </div>
                  </div>

                  <div className="text-justify leading-loose space-y-6 text-[12px] font-serif px-2">
                    <p>
                      Por este <strong>PAGARÉ A LA ORDEN</strong>, yo <strong>{clientName}</strong> con Cédula de Identidad / RUC N° <strong>{clientIdCard}</strong>, mayor de edad, de nacionalidad ecuatoriana, domiciliado en la ciudad de <strong>{clientCity}</strong>, en la dirección <strong>{clientAddress}</strong>; debo y pagaré de manera incondicional, indivisible y solidaria a la orden de <strong>{companyName}</strong>, o a su cesionario o endosatario, en sus oficinas en la ciudad de <strong>{companyAddress}</strong>, la cantidad de:
                    </p>
                    
                    <p className="text-center text-lg font-black bg-neutral-50 py-3 border-y uppercase tracking-widest">
                      {formatCurrency(creditSaleDetails?.netFinancedAmount || sale.totalValue)} DÓLARES
                    </p>

                    <p>
                      Dicho valor ha sido recibido a mi entera satisfacción por concepto de compraventa de mercadería bajo <strong>CONTRATO DE COMPRAVENTA CON RESERVA DE DOMINIO</strong>. Me obligo a cancelar esta deuda mediante {creditSaleDetails?.installmentsCount || '___'} cuotas de {formatCurrency(creditSaleDetails?.installmentAmount || 0)} cada una, con vencimiento {creditSaleDetails?.frequency || 'MENSUAL'}, a partir del día <strong>{creditSaleDetails?.startDate || displayDate}</strong>.
                    </p>

                    <p>
                      La falta de pago de una o más de las cuotas dará derecho al acreedor a declarar de plazo vencido la totalidad de la obligación y exigir el pago inmediato del saldo insoluto, intereses de mora a la tasa máxima autorizada por la ley, y todos los gastos judiciales, extrajudiciales y honorarios profesionales que ocasione su cobro. Renuncio a fuero y domicilio y me someto a la jurisdicción de los Jueces de esta ciudad y al trámite ejecutivo o sumario a elección del actor.
                    </p>
                  </div>

                  {/* Firmas Pagaré */}
                  <div className="grid grid-cols-2 gap-16 pt-20 text-center text-[11px]">
                    <div className="space-y-2">
                      <div className="border-t-2 border-neutral-900 pt-2">
                        <strong className="uppercase text-xs">{clientName}</strong>
                        <p className="text-[10px] text-neutral-700">C.I.: {clientIdCard}</p>
                        <p className="font-bold mt-1">DEUDOR PRINCIPAL</p>
                        <p className="text-[9px] text-neutral-500">Huella Digital</p>
                      </div>
                      <div className="w-16 h-20 border border-neutral-300 mx-auto rounded mt-2"></div>
                    </div>
                    {guarantorName && (
                      <div className="space-y-2">
                        <div className="border-t-2 border-neutral-900 pt-2">
                          <strong className="uppercase text-xs">{guarantorName}</strong>
                          <p className="text-[10px] text-neutral-700">C.I.: {guarantorIdCard}</p>
                          <p className="font-bold mt-1">GARANTE SOLIDARIO (AVAL)</p>
                          <p className="text-[9px] text-neutral-500">Huella Digital</p>
                        </div>
                        <div className="w-16 h-20 border border-neutral-300 mx-auto rounded mt-2"></div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* DOCUMENT 3: CONTRATO DE COMPRAVENTA */}
              {selectedDoc === 'CONTRATO_COMPRAVENTA' && (
                <div className="space-y-4 text-[11px] font-serif">
                  <div className="text-center font-black text-sm tracking-widest text-neutral-900 uppercase border-b-2 border-neutral-800 pb-2">
                    Contrato de Compra y Venta con Reserva de Dominio
                  </div>

                  <p className="text-justify leading-relaxed">
                    Comparecen a la celebración del presente contrato de compraventa con reserva de dominio, por una parte la empresa <strong>{companyName}</strong> con RUC N° {companyRuc}, debidamente representada, a quien en adelante y para efectos de este contrato se le denominará "EL VENDEDOR"; y, por otra parte, el señor(a) <strong>{clientName}</strong> con Cédula de Identidad N° <strong>{clientIdCard}</strong>, a quien en adelante se le denominará "EL COMPRADOR". Los comparecientes acuerdan las siguientes cláusulas:
                  </p>

                  <div className="space-y-4 px-2">
                    <p>
                      <strong>CLÁUSULA PRIMERA: OBJETO.-</strong> EL VENDEDOR da en venta real y perpetua a EL COMPRADOR el siguiente bien: <strong>{sale.article}</strong>, nuevo y en perfecto estado.
                    </p>
                    <p>
                      <strong>CLÁUSULA SEGUNDA: PRECIO Y FINANCIAMIENTO.-</strong> El precio total de la mercadería es de <strong>{formatCurrency(sale.totalValue)}</strong>. EL COMPRADOR entrega como cuota inicial (entrada) la suma de {formatCurrency(creditSaleDetails?.downPayment || 0)} y el saldo de {formatCurrency(creditSaleDetails?.netFinancedAmount || 0)} será cancelado en {creditSaleDetails?.installmentsCount || '___'} cuotas periódicas.
                    </p>
                    <p>
                      <strong>CLÁUSULA TERCERA: RESERVA DE DOMINIO.-</strong> De conformidad con el Código de Comercio, EL VENDEDOR se reserva el dominio del bien objeto de este contrato hasta que EL COMPRADOR haya cancelado la totalidad del precio pactado. En consecuencia, EL COMPRADOR no podrá enajenar, hipotecar ni gravar el bien sin autorización escrita de EL VENDEDOR.
                    </p>
                    <p>
                      <strong>CLÁUSULA CUARTA: MORA.-</strong> El incumplimiento en el pago de dos o más cuotas dará lugar a la resolución del contrato, pudiendo EL VENDEDOR retirar el bien de manos de EL COMPRADOR sin necesidad de intervención judicial previa.
                    </p>
                    <p>
                      <strong>CLÁUSULA QUINTA: JURISDICCIÓN.-</strong> Las partes renuncian fuero y se someten a los jueces competentes de la ciudad de <strong>{companyAddress}</strong>.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-16 pt-24 text-center text-[10px]">
                    <div className="border-t-2 border-neutral-900 pt-2">
                      <strong className="uppercase">{companyName}</strong>
                      <p className="font-bold uppercase tracking-tighter">EL VENDEDOR</p>
                    </div>
                    <div className="border-t-2 border-neutral-900 pt-2">
                      <strong className="uppercase">{clientName}</strong>
                      <p>C.I.: {clientIdCard}</p>
                      <p className="font-bold uppercase tracking-tighter">EL COMPRADOR</p>
                    </div>
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
                      <tr className="h-20 align-top">
                        <td className="p-3 border border-neutral-300 text-center font-black">01</td>
                        <td className="p-3 border border-neutral-300 font-bold text-sm uppercase">{sale.article}</td>
                        <td className="p-3 border border-neutral-300 text-right font-mono">{formatCurrency(sale.totalValue)}</td>
                        <td className="p-3 border border-neutral-300 text-right font-mono font-black">{formatCurrency(sale.totalValue)}</td>
                      </tr>
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
