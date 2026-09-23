import React, { useRef, useState } from 'react';
import { CreditSale } from '../../types/creditSale';
import { formatCurrency, numberToSpanishWords } from '../../lib/utils';
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

  const rawClientName = creditSale.clientName || '';
  const clientLastName = creditSale.clientLastName || (rawClientName.includes(' ') ? rawClientName.split(' ')[0] : rawClientName);
  const clientFirstName = creditSale.clientFirstName || (rawClientName.includes(' ') ? rawClientName.split(' ').slice(1).join(' ') : '');
  const clientFullName = `${clientLastName} ${clientFirstName}`.trim() || rawClientName;

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

  const lastInstallmentDate = creditSale.installments && creditSale.installments.length > 0
    ? creditSale.installments[creditSale.installments.length - 1].dueDate
    : '';

  const formatLegalDate = (dateStr?: string) => {
    if (!dateStr) return formattedCreatedDate;
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

  const finalDueDateLegal = lastInstallmentDate ? formatLegalDate(lastInstallmentDate) : formattedCreatedDate;
  const startDateLegal = creditSale.startDate ? formatLegalDate(creditSale.startDate) : formattedCreatedDate;

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
        <div className="flex justify-between items-start border-b-2 border-neutral-800 pb-4 mb-4">
          <div>
            <h1 className="text-xl font-bold uppercase tracking-wider font-sans text-neutral-900">
              {companyName}
            </h1>
            <p className="text-xs text-neutral-600 font-sans">RUC: {companyRuc} | Tel: {companyPhone}</p>
            <p className="text-xs text-neutral-600 font-sans">{companyAddress}</p>
          </div>
          <div className="text-right space-y-1">
            <div className="border border-neutral-800 px-4 py-1.5 rounded text-center bg-neutral-50 print:bg-transparent">
              <span className="text-[10px] font-bold block uppercase tracking-widest font-sans text-neutral-600">PAGARÉ A LA ORDEN Nº</span>
              <span className="text-base font-black font-mono text-neutral-900">{creditSale.promissoryNoteNumber || 'PAG-0001'}</span>
            </div>
            <div className="text-xs font-sans text-neutral-700">
              <span className="font-bold">Vence el: </span>
              <span className="font-bold text-neutral-900">{finalDueDateLegal}</span>
            </div>
            <div className="text-xs font-sans">
              <span className="font-bold">Por: </span>
              <span className="font-bold text-sm text-emerald-800 font-mono">
                $ {creditSale.netFinancedAmount.toFixed(2)} USD
              </span>
            </div>
          </div>
        </div>

        {/* Título Principal */}
        <div className="text-center my-3">
          <h2 className="text-base font-black uppercase tracking-widest font-sans border-b inline-block pb-1">
            PAGARÉ A LA ORDEN CON VENCIMIENTOS SUCESIVOS
          </h2>
        </div>

        {/* Cláusulas Legales Fortalecidas */}
        <div className="space-y-3 text-justify my-4 leading-relaxed text-xs">
          <p>
            Debo(emos) y pagaré(mos) incondicionalmente por este <strong>PAGARÉ A LA ORDEN</strong>, a la orden de <strong>{companyName} (o de su titular propietario legal)</strong>, con R.U.C. N° <strong>{companyRuc}</strong>, en esta ciudad o en el lugar donde fuera convenido, la cantidad de <strong>{numberToSpanishWords(creditSale.netFinancedAmount)} DÓLARES DE LOS ESTADOS UNIDOS DE AMÉRICA (US $ {creditSale.netFinancedAmount.toFixed(2)})</strong>, que en concepto de capital me obligo incondicionalmente a pagar a partir del <strong>{startDateLegal}</strong> hasta el <strong>{finalDueDateLegal}</strong>, mediante <strong>{creditSale.installmentsCount} cuotas o dividendos sucesivos</strong> de periodicidad <strong>{creditSale.frequency}</strong>, por el valor de <strong>{formatCurrency(creditSale.installmentAmount)} USD</strong> cada una, valor recibido a mi entera y cabal satisfacción en mercaderías y artículos de comercio detallados en este instrumento.
          </p>

          <p>
            En la fecha de vencimiento de los antedichos valores, me obligo además incondicionalmente a pagar a <strong>{companyName} (o de su titular propietario legal)</strong> la tasa de interés pactada para la presente operación crediticia desde la fecha de suscripción de este pagaré hasta el vencimiento del plazo de los respectivos valores. En caso de mora o retraso en el pago de uno o más de los dividendos del capital, la mora se liquidará desde la fecha de vencimiento respectivo y devengará automáticamente la <strong>tasa máxima de interés de mora permitida por las regulaciones vigentes del Banco Central del Ecuador</strong>, la cual correrá hasta la fecha en que se efectúe la cancelación total de la obligación.
          </p>

          <p>
            <strong>{companyName} (o de su titular propietario legal)</strong> podrá declarar de plazo vencido anticipado todas las obligaciones y dividendos que estuvieren vigentes, aun cuando no estuvieren vencidos, y proceder al recaudo judicial de todo lo debido. Me obligo además a cubrir los impuestos, tasas, gastos judiciales y extrajudiciales, inclusive honorarios profesionales, que ocasione la suscripción de este Pagaré y su cobro, siendo suficiente prueba para establecer tales gastos la sola liquidación o aseveración del acreedor. En caso de incumplimiento de todo lo estipulado, me obligo con todos mis bienes presentes o futuros, propios y gananciales.
          </p>

          <p>
            Siempre que los suscriptores de este pagaré, en su calidad de deudor o garante sean más de uno, los términos del presente documento se entenderán en plural; igualmente, si el deudor es una persona jurídica, las declaraciones se entienden hechas por su representante legal por sus propios derechos y por los que representa de ella.
          </p>

          <p>
            En caso de controversia las partes acuerdan someterse a cualquiera de los jueces competentes de lo civil en la ciudad o cantón de <strong>{jurisdictionCanton}</strong> y en la <strong>vía ejecutiva</strong>, para cuyo efecto renuncio expresamente a fuero y domicilio. Con la cláusula <strong>SIN PROTESTO</strong>, eximiendo al acreedor de presentación para el pago y de aviso por falta del mismo. Para constancia se firma en la ciudad de <strong>{jurisdictionCanton}</strong>, el <strong>{formattedCreatedDate}</strong>.
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
                  <td className="p-2 border-r border-neutral-300">
                    <span className="font-bold block uppercase">{item.articleName}</span>
                    {item.technicalDetails && (
                      <div className="text-[9px] text-neutral-600 space-y-0.5 mt-0.5">
                        {item.technicalDetails.brand && <span>Marca: {item.technicalDetails.brand} </span>}
                        {item.technicalDetails.model && <span>Modelo: {item.technicalDetails.model} </span>}
                        {item.technicalDetails.year && <span>Año: {item.technicalDetails.year} </span>}
                        {item.technicalDetails.color && <span>Color: {item.technicalDetails.color} </span>}
                      </div>
                    )}
                  </td>
                  <td className="p-2 border-r border-neutral-300 font-mono text-[11px]">
                    {item.technicalDetails?.chassis ? (
                      <div className="space-y-0.5">
                        <div className="flex justify-between"><span>Chasis:</span> <span>{item.technicalDetails.chassis}</span></div>
                        {item.technicalDetails.engine && <div className="flex justify-between"><span>Motor:</span> <span>{item.technicalDetails.engine}</span></div>}
                        {item.technicalDetails.camv && <div className="flex justify-between"><span>CAMV:</span> <span>{item.technicalDetails.camv}</span></div>}
                      </div>
                    ) : (
                      item.selectedSeries && item.selectedSeries.length > 0 ? item.selectedSeries.join(', ') : 'S/N'
                    )}
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

        {/* Autorización de Burós de Crédito y Central de Riesgos */}
        <div className="my-4 p-3 border border-neutral-300 rounded bg-neutral-50/60 print:bg-transparent text-[10.5px] space-y-1 font-sans">
          <strong className="block text-[11px] uppercase text-neutral-900 tracking-wide">
            AUTORIZACIÓN DE RIESGOS CREDITICIOS (LEY ORGÁNICA DE PROTECCIÓN DE DATOS PERSONALES):
          </strong>
          <p className="text-justify leading-normal text-neutral-700">
            Autorizo(amos) expresa, previa e irrevocablemente a <strong>{companyName} (o de su titular propietario legal)</strong>, con R.U.C. N° <strong>{companyRuc}</strong>, para que obtenga cuantas veces sean necesarias, de cualquier fuente de información, incluidos los burós de crédito legalmente autorizados y la Dirección Nacional de Registro de Datos Públicos / Central de Riesgos, mi información de riesgos crediticios y comportamiento comercial; de igual manera <strong>{companyName} (o de su titular propietario legal)</strong> queda expresamente autorizado para que pueda transferir o entregar dicha información a los burós de crédito y/o a la Central de Riesgos de conformidad con la legislación aplicable.
          </p>
        </div>

        {/* Firma del Deudor Principal */}
        <div className="my-4 pt-2 border-t border-neutral-300 font-sans">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
            <div className="space-y-1">
              <p className="text-[10px] text-neutral-500">Firma: ................................................................................</p>
              <div className="mt-1 text-[11px] space-y-0.5">
                <p><strong>DEUDOR:</strong> <span className="uppercase">{clientFullName}</span></p>
                <p><strong>C.C./RUC:</strong> <span className="font-mono">{creditSale.clientIdCard}</span></p>
                <p><strong>Dirección:</strong> {creditSale.clientAddress || 'S/N'}</p>
                <p><strong>Teléfono:</strong> {creditSale.clientPhone || 'S/N'}</p>
              </div>
              <p className="text-[10px] font-semibold text-neutral-800 pt-1">
                Para los fines de ley, expresamos nuestro visto bueno, <strong>SIN PROTESTO</strong>. {jurisdictionCanton}, {formattedCreatedDate}.
              </p>
            </div>
            <div className="text-center sm:text-right">
              <div className="w-14 h-16 border border-neutral-300 rounded inline-block bg-neutral-50/50 print:bg-transparent">
                <span className="text-[8px] text-neutral-400 block pt-10">Huella Digital</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sección POR AVAL (Garante Solidario) */}
        {creditSale.guarantorName ? (
          <div className="my-4 pt-3 border-t-2 border-neutral-800 font-sans space-y-2 text-xs">
            <p className="text-justify leading-relaxed">
              <strong>POR AVAL:</strong> Me constituyo en garantía y codeudor solidario del deudor <strong>{clientFullName}</strong> en todas y cada una de las obligaciones contraídas por el mismo en este documento a la orden de <strong>{companyName} (o de su titular propietario legal)</strong>, por lo que estipulo expresamente mi obligación incondicional de pagar las antedichas obligaciones comprometiéndome con todos mis bienes presentes y futuros, propios y gananciales, y renuncio expresamente a los beneficios de orden, excusión de domicilio, división y otros que pudieran favorecerme. Asimismo me constituyo pagador de las obligaciones del deudor contraídas en este pagaré, <strong>haciendo de deuda ajena deuda propia</strong>.
            </p>
            <p className="text-justify leading-relaxed">
              La presente garantía y obligación solidaria suscrita por todo el tiempo que duren o se encuentren vigentes las obligaciones a cargo del deudor principal y aún cuando venciere el plazo estipulado de las obligaciones a que accede este aval. Acepto que mi obligación como garante será válida aún cuando la obligación principal fuere nula por cualquier causa. <strong>SIN PROTESTO</strong>, exímese de presentación para el pago y de aviso por falta del mismo, para constancia se firma en <strong>{jurisdictionCanton}</strong>, el <strong>{formattedCreatedDate}</strong>.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start pt-2">
              <div className="space-y-1">
                <p className="text-[10px] text-neutral-500">Firma: ................................................................................</p>
                <div className="mt-1 text-[11px] space-y-0.5">
                  <p><strong>AVAL / GARANTE SOLIDARIO:</strong> <span className="uppercase">{creditSale.guarantorName}</span></p>
                  <p><strong>C.C./RUC:</strong> <span className="font-mono">{creditSale.guarantorIdCard}</span></p>
                  <p><strong>Dirección:</strong> {creditSale.guarantorAddress || 'S/N'}</p>
                  <p><strong>Teléfono:</strong> {creditSale.guarantorPhone || 'S/N'}</p>
                </div>
              </div>
              <div className="text-center sm:text-right">
                <div className="w-14 h-16 border border-neutral-300 rounded inline-block bg-neutral-50/50 print:bg-transparent">
                  <span className="text-[8px] text-neutral-400 block pt-10">Huella Digital</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="my-4 pt-3 border-t border-neutral-300 text-xs text-neutral-600 italic font-sans">
            Obligación crediticia aprobada bajo solvencia y responsabilidad patrimonial exclusiva de EL DEUDOR principal (sin aval adicional).
          </div>
        )}

        {/* Advertencia Legal al pie */}
        <div className="mt-6 pt-3 border-t border-neutral-200 text-center text-[10px] text-neutral-400 font-sans">
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
