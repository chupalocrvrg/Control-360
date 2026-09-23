import React, { useRef } from 'react';
import { CreditPaymentFrequency, EarlySettlementOption } from '../../types/creditSale';
import { Client } from '../../types/client';
import { formatCurrency } from '../../lib/utils';
import { Printer, X, FileText, CheckCircle2, User, Phone, MapPin, Building, Briefcase, Users, Calendar, ShieldCheck, DollarSign, Download } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { printElement, downloadElementAsPdf } from '../../lib/printUtils';

export interface CreditApplicationPrintData {
  applicationNumber?: string;
  date?: string;
  client: Partial<Client> | null;
  clientName: string;
  clientIdCard?: string;
  clientPhone?: string;
  clientAddress?: string;
  clientCity?: string;
  clientEmail?: string;
  
  // Work & Spouse & Guarantor
  workplace?: string;
  workPosition?: string;
  workPhone?: string;
  workAddress?: string;
  spouseName?: string;
  spouseIdCard?: string;
  spousePhone?: string;
  guarantorName?: string;
  guarantorIdCard?: string;
  guarantorPhone?: string;
  references?: { fullName: string; relationship: string; phone: string; city?: string }[];

  // Sales and Financial Summary
  items: {
    articleName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }[];
  grossTotal: number;
  downPayment: number;
  netFinancedAmount: number;
  frequency: CreditPaymentFrequency;
  installmentsCount: number;
  installmentAmount: number;
  startDate: string;
  sellerName?: string;
  earlySettlementOptions?: EarlySettlementOption[];
}

interface CreditApplicationPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: CreditApplicationPrintData | null;
  companyName?: string;
  companyRuc?: string;
  companyAddress?: string;
  companyPhone?: string;
}

export const CreditApplicationPrintModal: React.FC<CreditApplicationPrintModalProps> = ({
  isOpen,
  onClose,
  data,
  companyName = 'ELECTRO & CRÉDITOS S.A.',
  companyRuc = '1790012345001',
  companyAddress = 'Av. Principal y Secundaria, Ecuador',
  companyPhone = '0999999999'
}) => {
  const printAreaRef = useRef<HTMLDivElement>(null);

  const [isExportingPdf, setIsExportingPdf] = React.useState(false);

  if (!isOpen || !data) return null;

  const handlePrint = async () => {
    if (printAreaRef.current) {
      await printElement(printAreaRef.current, {
        title: appNumber,
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
      await downloadElementAsPdf(printAreaRef.current, appNumber, {
        pageFormat: 'A4'
      });
    } catch (err) {
      console.error('Error al descargar PDF:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const client = data.client;
  const clientFullName = data.clientName || (client ? `${client.lastName || ''} ${client.firstName || ''}`.trim() : 'N/A');
  const idCard = data.clientIdCard || client?.idCard || 'N/A';
  const phone = data.clientPhone || client?.phone || 'N/A';
  const address = data.clientAddress || client?.address || 'N/A';
  const city = data.clientCity || client?.city || 'Ecuador';
  const email = data.clientEmail || client?.email || 'N/A';

  const workplace = data.workplace || client?.workInfo?.workplace || 'Independiente / No especificado';
  const workPosition = data.workPosition || client?.workInfo?.position || 'N/A';
  const workPhone = data.workPhone || client?.workInfo?.workPhone || 'N/A';
  const workAddress = data.workAddress || client?.workInfo?.workAddress || 'N/A';

  const spouseName = data.spouseName || (client?.spouseInfo?.lastName ? `${client.spouseInfo.lastName} ${client.spouseInfo.firstName || ''}`.trim() : 'No aplica');
  const spouseIdCard = data.spouseIdCard || client?.spouseInfo?.idCard || '';
  const spousePhone = data.spousePhone || client?.spouseInfo?.phone || '';

  const guarantorName = data.guarantorName || client?.guarantorName || '';
  const guarantorId = data.guarantorIdCard || client?.guarantorIdCard || '';
  const guarantorPhone = data.guarantorPhone || client?.guarantorPhone || '';

  const references = data.references || client?.references || [];

  const applicationDate = data.date 
    ? format(new Date(data.date + 'T12:00:00'), "d 'de' MMMM 'de' yyyy", { locale: es })
    : format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: es });

  const appNumber = data.applicationNumber || `SOL-${format(new Date(), 'yyyyMMdd')}-${Math.floor(100 + Math.random() * 900)}`;

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto print:p-0 print:bg-white print:static">
      
      {/* Action Bar (Hidden on print) */}
      <div className="fixed top-4 right-4 z-[140] flex items-center gap-3 print:hidden">
        <button
          type="button"
          disabled={isExportingPdf}
          onClick={handleDownloadPdf}
          className="px-3.5 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border border-neutral-700 shadow-md disabled:opacity-50"
          title="Descargar Solicitud en formato PDF"
        >
          <Download className="w-4 h-4 text-emerald-400" />
          <span>{isExportingPdf ? 'Generando...' : 'Descargar PDF'}</span>
        </button>
        <button
          type="button"
          onClick={handlePrint}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-xl shadow-indigo-500/30 transition-all cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          Imprimir Solicitud (1 Hoja)
        </button>
        <button
          type="button"
          onClick={onClose}
          className="p-2 bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-xl shadow-md transition-all cursor-pointer"
          title="Cerrar vista"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Printable Sheet Container */}
      <div 
        ref={printAreaRef}
        className="w-full max-w-4xl bg-white text-neutral-900 p-6 sm:p-8 rounded-2xl shadow-2xl my-4 print:m-0 print:p-0 print:shadow-none print:w-full print:max-w-none print:rounded-none font-sans text-[11px] leading-tight border border-neutral-200 print:border-none printable-sheet"
      >
        {/* Header Institucional */}
        <div className="flex justify-between items-start border-b-2 border-neutral-900 pb-2 mb-2.5">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-base uppercase tracking-wider text-neutral-900">
                {companyName}
              </span>
              <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-neutral-100 text-neutral-800 border border-neutral-300 print:border-neutral-800">
                Crédito Directo
              </span>
            </div>
            <p className="text-[10px] text-neutral-600 leading-tight mt-0.5">
              RUC: {companyRuc} • Tel: {companyPhone} • Matriz: {companyAddress}
            </p>
          </div>
          <div className="text-right">
            <div className="border-2 border-neutral-900 px-3 py-1 rounded-lg text-center bg-neutral-50 print:bg-transparent">
              <span className="text-[9px] font-black block uppercase tracking-wider text-neutral-700">SOLICITUD DE CRÉDITO Nº</span>
              <span className="text-xs font-black font-mono text-neutral-900">{appNumber}</span>
            </div>
            <span className="text-[9px] text-neutral-500 block mt-0.5 font-medium">
              Fecha: {applicationDate}
            </span>
          </div>
        </div>

        {/* Título Principal Compacto */}
        <div className="text-center py-1 mb-2 bg-neutral-900 text-white rounded print:bg-neutral-900 print:text-white">
          <h1 className="text-xs font-black uppercase tracking-widest">
            SOLICITUD DE APERTURA DE CRÉDITO Y FICHA INTEGRAL DEL CLIENTE
          </h1>
        </div>

        {/* SECCIÓN 1: DATOS PERSONALES DEL CLIENTE SOLICITANTE */}
        <div className="mb-2.5">
          <div className="bg-neutral-200 print:bg-neutral-200 px-2 py-0.5 rounded font-black text-[10px] uppercase tracking-wider text-neutral-800 mb-1 border-l-4 border-neutral-900">
            1. Datos Personales y Domiciliarios del Solicitante
          </div>
          <div className="grid grid-cols-3 gap-x-3 gap-y-1 p-2 bg-neutral-50 print:bg-transparent rounded-lg border border-neutral-200 print:border-neutral-400 text-[10px]">
            <div className="col-span-2">
              <span className="font-bold text-neutral-500 block text-[9px] uppercase">Apellidos / Razón Social:</span>
              <span className="font-black text-neutral-900 uppercase">{client?.lastName || (data.clientName ? data.clientName.split(' ')[0] : 'N/A')}</span>
            </div>
            <div>
              <span className="font-bold text-neutral-500 block text-[9px] uppercase">Nombres:</span>
              <span className="font-black text-neutral-900 uppercase">{client?.firstName || (data.clientName ? data.clientName.split(' ').slice(1).join(' ') : 'N/A')}</span>
            </div>
            <div>
              <span className="font-bold text-neutral-500 block text-[9px] uppercase">Cédula / RUC:</span>
              <span className="font-bold font-mono text-neutral-900">{idCard}</span>
            </div>
            <div>
              <span className="font-bold text-neutral-500 block text-[9px] uppercase">Teléfono / Móvil:</span>
              <span className="font-bold text-neutral-900">{phone}</span>
            </div>
            <div>
              <span className="font-bold text-neutral-500 block text-[9px] uppercase">Fecha y Lugar Nac.:</span>
              <span className="font-medium text-neutral-900">{client?.birthDate || 'S/N'} / {client?.birthPlace || 'S/N'}</span>
            </div>

            <div className="col-span-2">
              <span className="font-bold text-neutral-500 block text-[9px] uppercase">Dirección de Domicilio:</span>
              <span className="font-medium text-neutral-900">{address}</span>
            </div>
            <div>
              <span className="font-bold text-neutral-500 block text-[9px] uppercase">Ciudad / Cantón / Sector:</span>
              <span className="font-bold text-neutral-900">{city}</span>
            </div>

            <div>
              <span className="font-bold text-neutral-500 block text-[9px] uppercase">Estado Civil / Género:</span>
              <span className="font-medium text-neutral-900">{client?.civilStatus || 'S/N'} / {client?.gender || 'S/N'}</span>
            </div>
            <div>
              <span className="font-bold text-neutral-500 block text-[9px] uppercase">Vivienda / Cargas Fam.:</span>
              <span className="font-medium text-neutral-900">{client?.housingType || 'Propia'} {client?.residenceTime ? `(${client.residenceTime})` : ''} / {client?.dependentsCount || 0}</span>
            </div>
            {client?.housingType === 'ARRENDADA' && (
              <div className="col-span-1">
                <span className="font-bold text-neutral-500 block text-[9px] uppercase">Arrendador / Telf:</span>
                <span className="font-medium text-neutral-900 truncate">{client?.landlordName || 'S/N'} - {client?.landlordPhone || 'S/N'}</span>
              </div>
            )}
            <div>
              <span className="font-bold text-neutral-500 block text-[9px] uppercase">Nivel Instrucción:</span>
              <span className="font-medium text-neutral-900">{client?.educationLevel || 'S/N'}</span>
            </div>
          </div>
        </div>

        {/* SECCIÓN 2: INFORMACIÓN LABORAL Y CONYUGAL */}
        <div className="mb-2.5">
          <div className="bg-neutral-200 print:bg-neutral-200 px-2 py-0.5 rounded font-black text-[10px] uppercase tracking-wider text-neutral-800 mb-1 border-l-4 border-neutral-900">
            2. Actividad Económica / Laboral y Datos Conyugales
          </div>
          <div className="grid grid-cols-3 gap-x-3 gap-y-1 p-2 bg-neutral-50 print:bg-transparent rounded-lg border border-neutral-200 print:border-neutral-400 text-[10px]">
            <div>
              <span className="font-bold text-neutral-500 block text-[9px] uppercase">Lugar de Trabajo / Empresa:</span>
              <span className="font-bold text-neutral-900">{workplace}</span>
            </div>
            <div>
              <span className="font-bold text-neutral-500 block text-[9px] uppercase">Cargo u Ocupación:</span>
              <span className="font-medium text-neutral-900">{workPosition}</span>
            </div>
            <div>
              <span className="font-bold text-neutral-500 block text-[9px] uppercase">Teléfono Laboral:</span>
              <span className="font-medium text-neutral-900">{workPhone}</span>
            </div>

            <div className="col-span-2">
              <span className="font-bold text-neutral-500 block text-[9px] uppercase">Dirección Laboral:</span>
              <span className="font-medium text-neutral-900">{workAddress}</span>
            </div>
            <div>
              <span className="font-bold text-neutral-500 block text-[9px] uppercase">Cónyuge:</span>
              <span className="font-medium text-neutral-900">{spouseName} {spousePhone ? `(Tlf: ${spousePhone})` : ''}</span>
            </div>
          </div>
        </div>

        {/* SECCIÓN 3: REFERENCIAS Y GARANTÍA */}
        <div className="mb-2.5">
          <div className="bg-neutral-200 print:bg-neutral-200 px-2 py-0.5 rounded font-black text-[10px] uppercase tracking-wider text-neutral-800 mb-1 border-l-4 border-neutral-900">
            3. Referencias Personales y Garante Solidario
          </div>
          <div className="grid grid-cols-2 gap-3 p-2 bg-neutral-50 print:bg-transparent rounded-lg border border-neutral-200 print:border-neutral-400 text-[10px]">
            <div>
              <span className="font-bold text-neutral-500 block text-[9px] uppercase mb-0.5">Referencias Personales / Familiares:</span>
              {references.length > 0 ? (
                <div className="space-y-0.5 text-[9.5px]">
                  {references.slice(0, 2).map((ref, i) => (
                    <div key={i} className="flex justify-between border-b border-neutral-200 pb-0.5">
                      <span className="font-bold">{ref.fullName} ({ref.relationship})</span>
                      <span className="font-mono">{ref.phone}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-neutral-500 italic text-[9.5px]">Verificación directa por historial crediticio interno.</span>
              )}
            </div>

            <div>
              <span className="font-bold text-neutral-500 block text-[9px] uppercase mb-0.5">Garante Solidario (Co-deudor):</span>
              {guarantorName ? (
                <div className="space-y-0.5 text-[9.5px]">
                  <p><strong className="uppercase">{guarantorName}</strong></p>
                  <p>C.I.: <span className="font-mono font-bold">{guarantorId || 'S/N'}</span> • Tlf: {guarantorPhone || 'S/N'}</p>
                </div>
              ) : (
                <span className="text-neutral-500 italic text-[9.5px]">Sin garante solidario requerido (Aprobado bajo cupo individual).</span>
              )}
            </div>
          </div>
        </div>

        {/* SECCIÓN 4: RESUMEN EJECUTIVO DEL CRÉDITO Y PRODUCTOS ADQUIRIDOS */}
        <div className="mb-2.5">
          <div className="bg-neutral-200 print:bg-neutral-200 px-2 py-0.5 rounded font-black text-[10px] uppercase tracking-wider text-neutral-800 mb-1 border-l-4 border-neutral-900 flex justify-between items-center">
            <span>4. Resumen Ejecutivo del Crédito y Bienes Solicitados</span>
            <span className="text-[9px] text-neutral-600 font-bold">Asesor Comercial: {data.sellerName || 'Vendedor Autorizado'}</span>
          </div>

          {/* Tabla compacta de artículos */}
          <table className="w-full text-left border-collapse border border-neutral-300 text-[10px] mb-2">
            <thead>
              <tr className="bg-neutral-100 print:bg-neutral-100 border-b border-neutral-300">
                <th className="p-1 font-bold">Cant.</th>
                <th className="p-1 font-bold">Descripción del Artículo / Bien</th>
                <th className="p-1 text-right font-bold">P. Unitario</th>
                <th className="p-1 text-right font-bold">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item, idx) => (
                <tr key={idx} className="border-b border-neutral-200">
                  <td className="p-1 font-bold text-center w-12">{item.quantity}</td>
                  <td className="p-1 font-medium">{item.articleName}</td>
                  <td className="p-1 text-right font-mono">${(item.unitPrice || 0).toFixed(2)}</td>
                  <td className="p-1 text-right font-mono font-bold">${(item.totalPrice || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Cuadrícula Ejecutiva de Condiciones Financieras (6 Métricas clave) */}
          <div className="grid grid-cols-6 gap-1.5 p-2 bg-neutral-900 text-white rounded-lg print:bg-neutral-900 print:text-white text-center">
            <div className="border-r border-neutral-700 pr-1">
              <span className="text-[8px] uppercase tracking-wider text-neutral-400 block">Total Compra</span>
              <span className="text-xs font-black font-mono">${data.grossTotal.toFixed(2)}</span>
            </div>
            <div className="border-r border-neutral-700 pr-1">
              <span className="text-[8px] uppercase tracking-wider text-emerald-400 block font-bold">Entrada / Abono</span>
              <span className="text-xs font-black font-mono text-emerald-300">${data.downPayment.toFixed(2)}</span>
            </div>
            <div className="border-r border-neutral-700 pr-1">
              <span className="text-[8px] uppercase tracking-wider text-indigo-300 block font-bold">Neto Financiado</span>
              <span className="text-xs font-black font-mono text-indigo-200">${data.netFinancedAmount.toFixed(2)}</span>
            </div>
            <div className="border-r border-neutral-700 pr-1">
              <span className="text-[8px] uppercase tracking-wider text-neutral-400 block">Nº de Cuotas</span>
              <span className="text-xs font-black">{data.installmentsCount} ({data.frequency})</span>
            </div>
            <div className="border-r border-neutral-700 pr-1">
              <span className="text-[8px] uppercase tracking-wider text-neutral-400 block">Valor Cuota</span>
              <span className="text-xs font-black font-mono">${data.installmentAmount.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-[8px] uppercase tracking-wider text-neutral-400 block">1er Vencimiento</span>
              <span className="text-xs font-black">{data.startDate}</span>
            </div>
          </div>

          {/* Opciones de liquidación anticipada si existen */}
          {data.earlySettlementOptions && data.earlySettlementOptions.length > 0 && (
            <div className="mt-1 px-2 py-1 bg-emerald-50 print:bg-transparent border border-emerald-300 rounded text-[9px] text-emerald-900 flex items-center justify-between">
              <span className="font-bold">Pacto de Descuento por Pronto Pago:</span>
              <span className="space-x-3">
                {data.earlySettlementOptions.map((opt, i) => (
                  <span key={i} className="font-medium">
                    {opt.description}: <strong className="font-mono text-emerald-800">${opt.settlementAmount.toFixed(2)}</strong> (-{opt.discountPercentage}%)
                  </span>
                ))}
              </span>
            </div>
          )}
        </div>

        {/* SECCIÓN 5: DECLARACIÓN LEGAL Y FIRMAS DE RESPONSABILIDAD */}
        <div className="pt-1">
          <p className="text-[8.5px] text-neutral-600 text-justify leading-tight mb-4 italic">
            <strong>DECLARACIÓN Y AUTORIZACIÓN:</strong> Declaro bajo juramento que los datos e información consignados en la presente solicitud son verídicos, legítimos y comprobables. Autorizo expresa e irrevocablemente a <strong>{companyName}</strong> para consultar, verificar y reportar mi historial crediticio y de cumplimiento en las entidades de información crediticia legalmente autorizadas. La firma de este formulario ratifica el acuerdo sobre el plan de cuotas y la emisión del pagaré a la orden respectivo.
          </p>

          <div className="grid grid-cols-3 gap-6 text-center text-[10px] pt-4 border-t border-neutral-400">
            {/* Firma Solicitante */}
            <div>
              <div className="border-t-2 border-neutral-900 w-4/5 mx-auto mb-1 pt-1" />
              <p className="font-bold uppercase text-neutral-900">{clientFullName}</p>
              <p className="text-[9px] text-neutral-600 font-mono">C.I.: {idCard}</p>
              <p className="text-[9px] font-black text-neutral-700 tracking-wider">CLIENTE SOLICITANTE</p>
            </div>

            {/* Firma Garante Solidario o Aprobador */}
            <div>
              <div className="border-t-2 border-neutral-900 w-4/5 mx-auto mb-1 pt-1" />
              {guarantorName ? (
                <>
                  <p className="font-bold uppercase text-neutral-900">{guarantorName}</p>
                  <p className="text-[9px] text-neutral-600 font-mono">C.I.: {guarantorId}</p>
                  <p className="text-[9px] font-black text-indigo-800 tracking-wider">GARANTE SOLIDARIO</p>
                </>
              ) : (
                <>
                  <p className="font-bold uppercase text-neutral-900">DEPARTAMENTO DE CRÉDITO</p>
                  <p className="text-[9px] text-neutral-600">Verificado & Aprobado</p>
                  <p className="text-[9px] font-black text-neutral-700 tracking-wider">APROBACIÓN DE RIESGO</p>
                </>
              )}
            </div>

            {/* Firma Asesor Comercial */}
            <div>
              <div className="border-t-2 border-neutral-900 w-4/5 mx-auto mb-1 pt-1" />
              <p className="font-bold uppercase text-neutral-900">{data.sellerName || 'Asesor Comercial'}</p>
              <p className="text-[9px] text-neutral-600">{companyName}</p>
              <p className="text-[9px] font-black text-neutral-700 tracking-wider">ASESOR DE VENTAS</p>
            </div>
          </div>
        </div>

      </div>

      {/* Estilos específicos de impresión para garantizar UNA SOLA HOJA */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 6mm 8mm 6mm 8mm;
          }
          body {
            background-color: #ffffff !important;
            color: #000000 !important;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>

    </div>
  );
};
