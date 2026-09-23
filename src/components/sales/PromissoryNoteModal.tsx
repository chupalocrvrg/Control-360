import React, { useRef, useState } from 'react';
import { CreditSale } from '../../types/creditSale';
import { formatCurrency } from '../../lib/utils';
import { Printer, X, ShieldCheck, Calendar, DollarSign, FileText, CheckCircle2, Download } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { printElement, downloadElementAsPdf } from '../../lib/printUtils';

interface PromissoryNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  creditSale: CreditSale | null;
  companyName?: string;
  companyRuc?: string;
  companyAddress?: string;
  companyPhone?: string;
  onOpenCreditApplication?: () => void;
}

export const PromissoryNoteModal: React.FC<PromissoryNoteModalProps> = ({
  isOpen,
  onClose,
  creditSale,
  companyName = 'ELECTRO & CRÉDITOS S.A.',
  companyRuc = '1790012345001',
  companyAddress = 'Av. Principal y Secundaria, Ecuador',
  companyPhone = '0999999999',
  onOpenCreditApplication
}) => {
  const printAreaRef = useRef<HTMLDivElement>(null);

  const [isExportingPdf, setIsExportingPdf] = useState(false);

  if (!isOpen || !creditSale) return null;

  const handlePrint = async () => {
    if (printAreaRef.current) {
      await printElement(printAreaRef.current, {
        title: `Pagare_${creditSale.promissoryNoteNumber}`,
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
      await downloadElementAsPdf(printAreaRef.current, `Pagare_${creditSale.promissoryNoteNumber}`, {
        pageFormat: 'A4'
      });
    } catch (err) {
      console.error('Error al descargar PDF:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const formattedCreatedDate = creditSale.createdAt
    ? format(new Date(creditSale.createdAt), "d 'de' MMMM 'de' yyyy", { locale: es })
    : format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: es });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto print:p-0 print:bg-white print:static">
      {/* Botones de acción fija en pantalla (ocultos al imprimir) */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-3 print:hidden">
        {onOpenCreditApplication && (
          <button
            type="button"
            onClick={onOpenCreditApplication}
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-900 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow transition-all cursor-pointer"
            title="Ver Solicitud de Crédito en 1 Hoja"
          >
            <FileText className="w-4 h-4 text-emerald-400" />
            Ver Solicitud (1 Hoja)
          </button>
        )}
        <button
          type="button"
          disabled={isExportingPdf}
          onClick={handleDownloadPdf}
          className="px-3.5 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border border-neutral-700 shadow-md disabled:opacity-50"
          title="Descargar Pagaré en formato PDF"
        >
          <Download className="w-4 h-4 text-emerald-400" />
          <span>{isExportingPdf ? 'Generando...' : 'Descargar PDF'}</span>
        </button>
        <button
          type="button"
          onClick={handlePrint}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-indigo-500/30 transition-all cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          Imprimir Pagaré a la Orden
        </button>
        <button
          type="button"
          onClick={onClose}
          className="p-2 bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-xl shadow transition-all cursor-pointer"
          title="Cerrar vista"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Contenedor del Documento Pagaré */}
      <div 
        ref={printAreaRef}
        className="w-full max-w-4xl bg-white text-neutral-900 p-8 sm:p-12 rounded-2xl shadow-2xl my-8 print:m-0 print:p-6 print:shadow-none print:w-full print:max-w-none print:rounded-none font-serif text-[13px] leading-relaxed border border-neutral-200 print:border-none"
      >
        {/* Cabecera del Documento */}
        <div className="flex justify-between items-start border-b-2 border-neutral-800 pb-4 mb-6">
          <div>
            <h1 className="text-xl font-bold uppercase tracking-wider font-sans text-neutral-900">
              {companyName}
            </h1>
            <p className="text-xs text-neutral-600 font-sans">RUC: {companyRuc} | Tel: {companyPhone}</p>
            <p className="text-xs text-neutral-600 font-sans">{companyAddress}</p>
          </div>
          <div className="text-right">
            <div className="border border-neutral-800 px-4 py-2 rounded text-center bg-neutral-50 print:bg-transparent">
              <span className="text-[11px] font-bold block uppercase tracking-widest font-sans text-neutral-600">PAGARÉ A LA ORDEN Nº</span>
              <span className="text-base font-black font-mono text-neutral-900">{creditSale.promissoryNoteNumber || 'PAG-0001'}</span>
            </div>
            <div className="mt-2 text-xs font-sans">
              <span className="font-bold">Por: </span>
              <span className="font-bold text-sm text-emerald-800 font-mono">
                {formatCurrency(creditSale.netFinancedAmount)} USD
              </span>
            </div>
          </div>
        </div>

        {/* Título Principal */}
        <div className="text-center my-4">
          <h2 className="text-lg font-black uppercase tracking-widest font-sans border-b inline-block pb-1">
            PAGARÉ A LA ORDEN CON VENCIMIENTOS SUCESIVOS
          </h2>
        </div>

        {/* Cláusula Principal */}
        <div className="space-y-4 text-justify my-6 leading-relaxed">
          <p>
            Debo(emos) y pagaré(mos) incondicionalmente por este <strong>PAGARÉ A LA ORDEN</strong>, en la ciudad de <strong>{creditSale.clientCity || 'la ciudad de emisión'}</strong>, 
            a la orden de <strong>{companyName}</strong>, o a quien sus derechos legalmente represente, la suma de:
          </p>
          
          <div className="p-3 bg-neutral-50 print:bg-transparent border border-neutral-300 rounded font-sans font-bold text-center text-sm">
            {formatCurrency(creditSale.netFinancedAmount)} DÓLARES DE LOS ESTADOS UNIDOS DE AMÉRICA (USD)
          </div>

          <p>
            Valor recibido a mi (nuestra) entera y cabal satisfacción en mercaderías y artículos de comercio detallados en este instrumento. 
            Esta obligación crediticia será pagadera en <strong>{creditSale.installmentsCount} cuotas sucesivas</strong> de periodicidad <strong>{creditSale.frequency}</strong>,
            por el valor de <strong>{formatCurrency(creditSale.installmentAmount)} USD</strong> cada una, iniciando indefectiblemente el día <strong>{creditSale.startDate}</strong>, 
            según el calendario de amortización anexo y suscrito a continuación.
          </p>

          <p>
            La falta de pago puntual de <strong>dos o más cuotas consecutivas</strong> dará derecho al acreedor a declarar de plazo vencido la totalidad de la deuda 
            y exigir el pago inmediato del saldo insoluto, más los intereses de mora calculados a la tasa máxima legal permitida por el Banco Central del Ecuador, 
            así como todos los gastos judiciales y extrajudiciales a los que diere lugar el cobro. 
            Aceptamos y nos sometemos a los jueces competentes de esta jurisdicción y al trámite ejecutivo o sumario a elección del actor, renunciando a fuero y domicilio.
          </p>
        </div>

        {/* Detalle de Mercadería Adquirida */}
        <div className="my-6">
          <h3 className="font-sans font-bold text-xs uppercase tracking-wider text-neutral-700 mb-2 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" />
            Detalle de Mercaderías y Artículos Entregados
          </h3>
          <table className="w-full text-left font-sans text-xs border border-neutral-300">
            <thead className="bg-neutral-100 print:bg-transparent border-b border-neutral-300">
              <tr>
                <th className="p-2 border-r border-neutral-300">Cant.</th>
                <th className="p-2 border-r border-neutral-300">Descripción del Artículo</th>
                <th className="p-2 border-r border-neutral-300">Series / Identificación</th>
                <th className="p-2 border-r border-neutral-300 text-right">P. Unitario</th>
                <th className="p-2 text-right">P. Total</th>
              </tr>
            </thead>
            <tbody>
              {creditSale.items.map((item, idx) => (
                <tr key={idx} className="border-b border-neutral-200">
                  <td className="p-2 border-r border-neutral-300 text-center font-bold">{item.quantity}</td>
                  <td className="p-2 border-r border-neutral-300">{item.articleName}</td>
                  <td className="p-2 border-r border-neutral-300 font-mono text-[11px]">
                    {item.selectedSeries && item.selectedSeries.length > 0 ? item.selectedSeries.join(', ') : 'S/N'}
                  </td>
                  <td className="p-2 border-r border-neutral-300 text-right font-mono">{formatCurrency(item.unitPrice)}</td>
                  <td className="p-2 text-right font-mono font-bold">{formatCurrency(item.totalPrice)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="font-bold bg-neutral-50 print:bg-transparent">
              <tr className="border-t border-neutral-300">
                <td colSpan={4} className="p-2 text-right border-r border-neutral-300">Precio Total de Lista:</td>
                <td className="p-2 text-right font-mono">{formatCurrency(creditSale.grossTotal)}</td>
              </tr>
              <tr>
                <td colSpan={4} className="p-2 text-right border-r border-neutral-300 text-emerald-700">Entrada / Abono Inicial Recibido:</td>
                <td className="p-2 text-right font-mono text-emerald-700 font-bold">-{formatCurrency(creditSale.downPayment)}</td>
              </tr>
              <tr className="border-t-2 border-neutral-800 text-sm">
                <td colSpan={4} className="p-2 text-right border-r border-neutral-300 uppercase">Saldo Neto a Pagar (Pagaré):</td>
                <td className="p-2 text-right font-mono text-indigo-900 font-black">{formatCurrency(creditSale.netFinancedAmount)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Tabla de Amortización / Cuotas */}
        <div className="my-6">
          <h3 className="font-sans font-bold text-xs uppercase tracking-wider text-neutral-700 mb-2 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            Tabla de Amortización y Vencimientos de Cuotas ({creditSale.frequency})
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 font-sans text-xs">
            {creditSale.installments.map((inst) => (
              <div key={inst.number} className="p-2 border border-neutral-300 rounded bg-neutral-50/50 print:bg-transparent flex justify-between items-center">
                <div>
                  <span className="font-bold text-neutral-800">Cuota #{inst.number}</span>
                  <span className="block text-[10px] text-neutral-500">{inst.dueDate}</span>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold text-neutral-900">{formatCurrency(inst.amount)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cláusula Especial: Condiciones de Liquidación Anticipada */}
        {creditSale.earlySettlementOptions && creditSale.earlySettlementOptions.length > 0 && (
          <div className="my-6 p-4 border border-dashed border-neutral-400 rounded-lg bg-neutral-50 print:bg-transparent font-sans">
            <h4 className="font-bold text-xs uppercase tracking-wider text-neutral-800 mb-2 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Pacto Especial de Liquidación Anticipada (Descuento por Pronto Pago)
            </h4>
            <p className="text-xs text-neutral-600 mb-3">
              El acreedor y deudor acuerdan que si el deudor decide cancelar la totalidad de la deuda antes del plazo pactado,
              podrá acogerse a los siguientes valores preferenciales de liquidación total:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {creditSale.earlySettlementOptions.map((opt, idx) => (
                <div key={idx} className="p-2.5 bg-white print:bg-transparent border border-neutral-300 rounded text-xs">
                  <span className="font-bold text-neutral-900 block">{opt.description}</span>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-[11px] text-emerald-700 font-bold">-{opt.discountPercentage}% Descto.</span>
                    <span className="font-mono font-black text-sm text-neutral-900">{formatCurrency(opt.settlementAmount)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lugar y Fecha */}
        <div className="my-8 text-right font-sans text-xs">
          <p>
            Emitido en <strong>{creditSale.clientCity || 'Ecuador'}</strong>, el <strong>{formattedCreatedDate}</strong>.
          </p>
        </div>

        {/* Sección de Firmas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-12 pt-12 mt-8 border-t border-neutral-400 font-sans">
          {/* Firma Deudor Principal */}
          <div className="text-center space-y-1">
            <div className="border-t border-neutral-800 w-3/4 mx-auto mb-2 pt-2"></div>
            <p className="font-bold text-xs uppercase text-neutral-900">
              {creditSale.clientLastName || creditSale.clientName.split(' ').slice(1).join(' ')}
            </p>
            <p className="font-bold text-xs uppercase text-neutral-900">
              {creditSale.clientFirstName || creditSale.clientName.split(' ')[0]}
            </p>
            <p className="text-[11px] text-neutral-600 font-mono">C.I. / RUC: {creditSale.clientIdCard}</p>
            <p className="text-[11px] text-neutral-600">Tlf: {creditSale.clientPhone}</p>
            <p className="text-[11px] text-neutral-500 font-bold">DEUDOR PRINCIPAL</p>
          </div>

          {/* Firma Garante Solidario o Acreedor */}
          <div className="text-center space-y-1">
            <div className="border-t border-neutral-800 w-3/4 mx-auto mb-2 pt-2"></div>
            {creditSale.guarantorName ? (
              <>
                <p className="font-bold text-xs uppercase text-neutral-900">
                  {creditSale.guarantorName}
                </p>
                <p className="text-[11px] text-neutral-600 font-mono">C.I. / RUC: {creditSale.guarantorIdCard}</p>
                <p className="text-[11px] text-neutral-600">Tlf: {creditSale.guarantorPhone}</p>
                <p className="text-[11px] text-indigo-700 font-bold">GARANTE SOLIDARIO</p>
              </>
            ) : (
              <>
                <p className="font-bold text-xs uppercase text-neutral-900">
                  {companyName}
                </p>
                <p className="text-[11px] text-neutral-600 font-mono">RUC: {companyRuc}</p>
                <p className="text-[11px] text-neutral-500 font-bold">POR EL ACREEDOR / AUTORIZADO</p>
              </>
            )}
          </div>
        </div>

        {/* Advertencia Legal al pie */}
        <div className="mt-8 pt-4 border-t border-neutral-200 text-center text-[10px] text-neutral-400 font-sans">
          Documento con fuerza ejecutiva según lo dispuesto en el Código de Comercio de la República del Ecuador.
        </div>
      </div>

      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm 10mm;
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
