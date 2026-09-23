import React, { useState } from 'react';
import { useNotification } from "../contexts/NotificationContext";
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Building2, ShieldCheck, UserPlus, Fingerprint, X, ScrollText, ArrowLeft, CheckCircle2 } from 'lucide-react';

export default function Onboarding() {
  const { updateProfile, logout } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useNotification();
  const [loading, setLoading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    ruc: '',
    phone: '',
    pin: '',
  });

  const handleBack = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error("Error logging out", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateProfile({ 
        ...formData, 
        hasCompletedOnboarding: true,
        termsAcceptedAt: new Date().toISOString()
      });
      navigate('/');
    } catch (error) {
      console.error("Error updating profile:", error);
      showToast("Error al configurar tu cuenta. Intenta de nuevo.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 transition-colors duration-500 relative">
      <button
        onClick={handleBack}
        className="absolute top-4 left-4 sm:top-8 sm:left-8 p-3 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded-full transition-all"
        title="Volver"
      >
        <ArrowLeft className="w-6 h-6" />
      </button>
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-8">
          <div className="p-4 bg-indigo-600 text-white rounded-3xl shadow-xl shadow-indigo-100 dark:shadow-none animate-in zoom-in-50 duration-700">
            <UserPlus className="h-8 w-8" />
          </div>
        </div>
        <h2 className="text-center text-3xl font-black text-neutral-900 dark:text-neutral-50 tracking-tighter uppercase italic">
          Configuración Maestro
        </h2>
        <p className="mt-2 text-center text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em]">
          Establece los parámetros base de tu cuenta corporativa
        </p>
      </div>

      <div className="mt-12 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-neutral-900 py-10 px-8 shadow-xl shadow-neutral-200/50 dark:shadow-none sm:rounded-[3rem] border border-neutral-100 dark:border-neutral-800 animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <form className="space-y-8" onSubmit={handleSubmit}>
            <div className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="name" className="text-[10px] font-black text-neutral-400 uppercase tracking-widest pl-1">
                  Nombre o Razón Social
                </label>
                <div className="relative">
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700 rounded-2xl px-5 py-4 text-neutral-900 dark:text-neutral-50 focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-neutral-300"
                    placeholder="Ej: Inversiones Global S.A."
                  />
                  <Building2 className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-300" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="ruc" className="text-[10px] font-black text-neutral-400 uppercase tracking-widest pl-1">
                    ID / RUC
                  </label>
                  <input
                    id="ruc"
                    name="ruc"
                    type="text"
                    value={formData.ruc}
                    onChange={(e) => setFormData({ ...formData, ruc: e.target.value })}
                    className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700 rounded-2xl px-5 py-4 text-neutral-900 dark:text-neutral-50 focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-neutral-300"
                    placeholder="Opcional"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="phone" className="text-[10px] font-black text-neutral-400 uppercase tracking-widest pl-1">
                    Contacto
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700 rounded-2xl px-5 py-4 text-neutral-900 dark:text-neutral-50 focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-neutral-300"
                    placeholder="Opcional"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <label htmlFor="pin" className="text-[10px] font-black text-neutral-400 uppercase tracking-widest pl-1">
                  PIN Transaccional (6 dígitos)
                </label>
                <div className="relative">
                  <input
                    id="pin"
                    name="pin"
                    type="password"
                    autoComplete="new-password"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    data-bwignore="true"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    required
                    maxLength={6}
                    value={formData.pin}
                    onChange={(e) => setFormData({ ...formData, pin: e.target.value.replace(/\D/g, '') })}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-2xl px-5 py-5 text-white text-center text-2xl tracking-[0.6em] font-black focus:ring-4 focus:ring-indigo-500/20 outline-none transition-all placeholder:text-neutral-700"
                    placeholder="000000"
                  />
                  <Fingerprint className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-700" />
                </div>
                <p className="text-[9px] text-neutral-400 font-medium text-center mt-2">Este código será requerido para cada sesión de trabajo.</p>
              </div>
              
              <div className="flex items-start gap-3 mt-4 bg-indigo-50/50 dark:bg-indigo-900/10 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800/30">
                <input 
                  type="checkbox" 
                  id="terms" 
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-1 w-4 h-4 text-indigo-600 rounded border-neutral-300 focus:ring-indigo-500"
                />
                <label htmlFor="terms" className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
                  He leído y acepto los <button type="button" onClick={() => setShowTerms(true)} className="text-indigo-600 dark:text-indigo-400 underline font-bold uppercase tracking-wide cursor-pointer">Términos y Condiciones</button> de uso y licenciamiento del software.
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || formData.pin.length !== 6 || !termsAccepted}
              className="w-full flex items-center justify-center py-5 px-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[1.5rem] text-sm font-black uppercase tracking-widest shadow-xl shadow-indigo-500/20 disabled:opacity-30 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
            >
              {loading ? 'Inicializando...' : 'Activar Terminal de Pagos'}
            </button>
          </form>
        </div>
        <div className="mt-8 flex items-center justify-center gap-2">
          <ShieldCheck className="w-3 h-3 text-emerald-500" />
          <span className="text-[9px] font-black text-neutral-300 dark:text-neutral-700 uppercase tracking-widest">Protocolo de seguridad verificado</span>
        </div>
      </div>

      {showTerms && (
        <div className="fixed inset-0 z-[1000] bg-neutral-900/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 w-full max-w-3xl rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[88vh]">
            <div className="p-6 border-b border-neutral-100 dark:border-neutral-800 flex justify-between items-center bg-indigo-50 dark:bg-indigo-900/20">
              <div className="flex items-center gap-3 text-indigo-600 dark:text-indigo-400 font-bold">
                <ScrollText className="w-5 h-5" />
                <span className="text-sm uppercase tracking-wide">Términos y Condiciones de Licenciamiento</span>
              </div>
              <button onClick={() => setShowTerms(false)} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors p-1 cursor-pointer">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 md:p-8 overflow-y-auto flex-1 space-y-6 text-xs md:text-sm text-neutral-700 dark:text-neutral-300 text-justify leading-relaxed">
              <div className="text-center space-y-1 pb-4 border-b border-neutral-100 dark:border-neutral-800">
                <h2 className="text-base md:text-lg font-black uppercase tracking-tight text-neutral-900 dark:text-neutral-100">
                  TÉRMINOS Y CONDICIONES DE USO Y LICENCIAMIENTO DE SOFTWARE
                </h2>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium">
                  Documento marco de aplicación general — Versión revisada • Última actualización: 22 de agosto de 2026
                </p>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  Titular y Desarrollador: <strong>Marcelo Enrique Gutama Chima</strong> (C.I.: 0105884977)
                </p>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  Denominación: <strong>Sistema ERP de Gestión Comercial, Facturación, Inventarios y Cobranzas</strong> (en adelante, el «SISTEMA»)
                </p>
              </div>

              <div className="p-4 bg-neutral-50 dark:bg-neutral-800/40 rounded-xl text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                <strong>Nota:</strong> Este documento constituye la plantilla general de Términos y Condiciones aplicable a cualquier CLIENTE que licencie el SISTEMA, bajo el esquema estándar de período de prueba y planes de suscripción de 3, 6 o 12 meses. El TITULAR podrá, adicionalmente y a su discreción, otorgar planes especiales, promocionales o de cortesía mediante acuerdos privados con beneficiarios determinados, conforme a la Cláusula 4, los cuales no se publican ni se incorporan a este documento y no alteran su aplicación estándar frente a los demás CLIENTES.
              </div>

              <div className="space-y-3">
                <h3 className="font-black text-neutral-900 dark:text-neutral-100 uppercase">1. ACEPTACIÓN DE LOS TÉRMINOS</h3>
                <p>El presente documento constituye un contrato legalmente vinculante entre la persona natural o jurídica que accede, implementa o utiliza el SISTEMA (en adelante, el «CLIENTE» o «USUARIO») y Marcelo Enrique Gutama Chima (en adelante, el «TITULAR» o «DESARROLLADOR»). El acceso, registro, despliegue, configuración o uso del SISTEMA implica la aceptación plena, expresa y sin reservas de todas y cada una de las cláusulas aquí estipuladas. Si el CLIENTE no está de acuerdo con estos términos, deberá abstenerse de utilizar el software.</p>
                <p>El presente contrato solo se entenderá válidamente celebrado cuando sea suscrito por una persona que acredite representación legal vigente del CLIENTE (representante legal, apoderado o administrador con facultades suficientes conforme al nombramiento inscrito o poder correspondiente). El TITULAR podrá solicitar dicha acreditación como condición previa a la activación del SISTEMA.</p>
              </div>

              <div className="space-y-3">
                <h3 className="font-black text-neutral-900 dark:text-neutral-100 uppercase">2. DECLARACIÓN DE PROPIEDAD INTELECTUAL Y TITULARIDAD EXCLUSIVA</h3>
                <ul className="space-y-2 pl-2">
                  <li><strong>• Titularidad:</strong> El TITULAR declara y ratifica ser el único, legítimo y exclusivo autor, creador y titular de todos los derechos morales y patrimoniales de propiedad intelectual, derechos de autor y secretos comerciales sobre el SISTEMA, abarcando de forma enunciativa pero no limitativa: código fuente, código objeto, algoritmos, arquitectura de software, bases de datos base, diagramas de flujo, interfaces gráficas (UI/UX), lógica de negocio, módulos de cálculo, API y cualquier desarrollo derivado, mejora o actualización.</li>
                  <li><strong>• Origen y condiciones de desarrollo:</strong> El TITULAR declara expresamente que el SISTEMA fue concebido, diseñado y desarrollado por su exclusiva iniciativa, con equipos, herramientas, licencias de software, cuentas de servicios en la nube y demás recursos de su propiedad personal, fuera de la jornada laboral ordinaria y sin utilizar activos, credenciales, cuentas institucionales, información confidencial ni infraestructura pertenecientes a ningún empleador o contraparte comercial del TITULAR. Esta declaración podrá ser respaldada mediante evidencia técnica (control de versiones, historial de despliegue, facturación de servicios propios) en caso de controversia.</li>
                  <li><strong>• Inexistencia de obra por encargo o vínculo laboral:</strong> Ninguna relación comercial, prestación de servicios, contrato laboral presente o pasado, ni la emisión de honorarios, remuneraciones o beneficios de cualquier naturaleza transferirá, cederá o presumirá la cesión de los derechos de autor o propiedad industrial a favor del CLIENTE ni de terceras entidades. El SISTEMA no fue creado dentro del objeto, funciones o encargo de ninguna relación laboral del TITULAR, ni constituye una obra derivada de la actividad para la cual el TITULAR hubiera sido contratado por el CLIENTE, cuando dicho CLIENTE sea simultáneamente empleador del TITULAR.</li>
                  <li><strong>• Reserva de derechos de explotación:</strong> El TITULAR se reserva de manera irrestricta el derecho de explotar comercialmente, distribuir, sublicenciar, comercializar bajo modelo SaaS (Software as a Service) o modificar el SISTEMA con cualquier persona natural o jurídica, competidor o tercero del mercado, sin requerir autorización ni otorgar compensación o regalía alguna al CLIENTE.</li>
                </ul>
              </div>

              <div className="space-y-3">
                <h3 className="font-black text-neutral-900 dark:text-neutral-100 uppercase">3. OTORGAMIENTO DE LICENCIA DE USO (NO CESIÓN DE DERECHOS)</h3>
                <ul className="space-y-2 pl-2">
                  <li><strong>• Naturaleza de la licencia:</strong> El TITULAR otorga al CLIENTE una licencia de uso de software de carácter estrictamente temporal, revocable, no exclusiva, intransferible y no sublicenciable.</li>
                  <li><strong>• Alcance:</strong> La presente autorización faculta al CLIENTE exclusivamente a operar el software como herramienta interna de gestión comercial, control de cheques, cobranzas, presupuestos, facturación y control de inventarios.</li>
                  <li><strong>• Prohibición de transferencia:</strong> Bajo ninguna circunstancia el presente acuerdo se interpretará como una venta, cesión o traspaso del software. Queda expresamente prohibido vender, alquilar, arrendar, revender, redistribuir, sublicenciar o permitir el uso del SISTEMA a terceros ajenos a la estructura operativa autorizada del CLIENTE.</li>
                </ul>
              </div>

              <div className="space-y-3">
                <h3 className="font-black text-neutral-900 dark:text-neutral-100 uppercase">4. PLANES ESPECIALES, PROMOCIONALES O DE CORTESÍA; TRANSICIÓN Y SUSPENSIÓN</h3>
                <ul className="space-y-2 pl-2">
                  <li><strong>• Planes especiales:</strong> El TITULAR se reserva la facultad discrecional de otorgar planes especiales, promocionales o de cortesía, mediante acuerdos privados o mediante asignación directa de suscripción dentro de la plataforma, a favor de la persona natural o jurídica que estime conveniente. El otorgamiento de un plan especial a un beneficiario determinado no constituye precedente, práctica comercial uniforme, ni genera derecho adquirido u obligación de extenderlo a ningún otro CLIENTE o tercero.</li>
                  <li><strong>• Condiciones particulares no públicas:</strong> Los planes especiales podrán sujetarse a condiciones particulares acordadas de forma privada entre el TITULAR y el beneficiario correspondiente, las cuales prevalecerán sobre estos Términos únicamente en lo que expresamente modifiquen, rigiendo estos Términos Generales de forma supletoria en todo lo demás.</li>
                  <li><strong>• Terminación o vencimiento de un plan especial:</strong> Al finalizar, por cualquier causa, la vigencia de un plan especial, promocional o de cortesía —incluyendo el vencimiento del período de prueba estándar de tres (3) meses previsto en la Cláusula 5— el acceso completo del beneficiario al SISTEMA quedará sujeto a la contratación de alguno de los planes de suscripción comercial descritos en la Cláusula 5.</li>
                  <li><strong>• Aviso previo:</strong> El TITULAR notificará al beneficiario, a través de la interfaz del SISTEMA o por correo electrónico, la fecha de vencimiento o finalización del plan vigente, otorgando un plazo de hasta quince (15) días calendario para que este contrate el plan comercial de su elección antes de que el SISTEMA pase al modo de solo lectura descrito en el numeral siguiente.</li>
                  <li><strong>• Régimen de solo lectura:</strong> Vencido el plazo de quince (15) días indicado sin que se haya formalizado la contratación del plan comercial correspondiente, el SISTEMA ingresará automáticamente a un modo de solo lectura y exportación de datos por un período adicional de treinta (30) días calendario. Durante este período: (i) el beneficiario conservará acceso de consulta y exportación a la totalidad de su información histórica en formatos CSV, Excel o JSON; (ii) quedará bloqueado el registro de nuevas transacciones, facturas, cobros, ajustes de inventario o cualquier otra operación que modifique los datos; y (iii) los módulos de reportería y consulta permanecerán disponibles.</li>
                  <li><strong>• Suspensión definitiva:</strong> Transcurrido el período de solo lectura de treinta (30) días sin que se haya contratado un plan comercial, se suspenderán definitivamente los accesos, incluyendo los de sola consulta, sin perjuicio de la obligación del TITULAR de conservar copia de respaldo de los datos durante el plazo adicional que determine su propia política de retención.</li>
                </ul>
              </div>

              <div className="space-y-3">
                <h3 className="font-black text-neutral-900 dark:text-neutral-100 uppercase">5. MODELO DE NEGOCIO, PERÍODO DE PRUEBA Y PLANES DE SUSCRIPCIÓN</h3>
                <p>El acceso al SISTEMA se rige bajo el siguiente esquema de licenciamiento, salvo que un acuerdo privado suscrito conforme a la Cláusula 4 disponga un esquema particular para un beneficiario determinado:</p>
                <ul className="space-y-2 pl-2">
                  <li><strong>• Versión de prueba (Beta / Trial):</strong> Se otorga un período de prueba gratuito de hasta tres (3) meses calendario desde la habilitación de la cuenta, orientado a la validación de módulos y estabilización operativa.</li>
                  <li><strong>• Licencias comerciales temporales:</strong> Concluido el período de prueba o, en su caso, al activarse el esquema de suscripción conforme a la Cláusula 4, la continuidad del servicio requerirá la contratación de planes de suscripción temporal pagados por adelantado en las modalidades de tres (3), seis (6) o doce (12) meses.</li>
                  <li><strong>• Suspensión por falta de pago:</strong> El impago o vencimiento del período contratado facultará al TITULAR a restringir de forma inmediata el acceso operativo al SISTEMA hasta la regularización de los valores correspondientes.</li>
                </ul>
              </div>

              <div className="space-y-3">
                <h3 className="font-black text-neutral-900 dark:text-neutral-100 uppercase">6. PROPIEDAD DE LA INFORMACIÓN VS. PROPIEDAD DEL SISTEMA</h3>
                <ul className="space-y-2 pl-2">
                  <li><strong>• Custodia de datos del cliente:</strong> Todos los registros transaccionales, catálogos de productos, listas de clientes, documentos de facturación, comprobantes de cobro y datos financieros ingresados al SISTEMA son de propiedad única y exclusiva del CLIENTE.</li>
                  <li><strong>• Separación de activos:</strong> El CLIENTE es el dueño exclusivo de la información cargada; el TITULAR es el dueño exclusivo de la infraestructura, plataforma, arquitectura y código que procesa dicha información.</li>
                  <li><strong>• Disponibilidad para exportación:</strong> Ante la cancelación del servicio, el TITULAR garantizará los mecanismos para que el CLIENTE pueda exportar su información en formatos estructurados estándar (CSV, Excel o JSON), condicionado a que no existan controversias por uso indebido de la plataforma ni valores pendientes de pago.</li>
                </ul>
              </div>

              <div className="space-y-3">
                <h3 className="font-black text-neutral-900 dark:text-neutral-100 uppercase">7. POLÍTICA DE PRIVACIDAD, TRATAMIENTO DE DATOS Y CONFIDENCIALIDAD</h3>
                <ul className="space-y-2 pl-2">
                  <li><strong>• Uso restringido:</strong> Toda la información procesada a través del SISTEMA será tratada bajo rigurosos estándares de confidencialidad y se utilizará exclusivamente para la ejecución y mantenimiento de las funciones operativas del SISTEMA, así como para diagnóstico técnico, corrección de errores (debugging), monitoreo de rendimiento y optimización del software.</li>
                  <li><strong>• No comercialización:</strong> Los datos del CLIENTE no serán vendidos, cedidos, transferidos, alquilados ni divulgados a terceras personas ni entidades bajo ningún concepto, salvo notificación previa y consentimiento expreso del CLIENTE, o mandato legal expreso emitido por autoridad judicial o administrativa competente.</li>
                  <li><strong>• Marco normativo aplicable:</strong> El TITULAR tratará los datos personales que procese el SISTEMA con observancia de la Ley Orgánica de Protección de Datos Personales de la República del Ecuador (LOPDP) y su normativa reglamentaria.</li>
                  <li><strong>• Encargo de tratamiento:</strong> Para efectos de la LOPDP, el TITULAR actúa como encargado del tratamiento respecto de las bases de datos transaccionales ingresadas al SISTEMA.</li>
                  <li><strong>• Responsable de tratamiento:</strong> Respecto de los datos que el TITULAR recaba por cuenta propia para la gestión contractual (credenciales, logs de auditoría técnica, cobros), el TITULAR actúa como responsable del tratamiento conforme a la LOPDP.</li>
                </ul>
              </div>

              <div className="space-y-3">
                <h3 className="font-black text-neutral-900 dark:text-neutral-100 uppercase">8. PROHIBICIÓN ESTRICTA DE INGENIERÍA INVERSA Y EXPLOTACIÓN NO AUTORIZADA</h3>
                <p>Queda terminantemente prohibido descompilar, desensamblar, aplicar ingeniería inversa, clonar interfaces, extraer datos mediante bots o scrapers, o realizar pruebas de penetración no autorizadas.</p>
              </div>

              <div className="space-y-3">
                <h3 className="font-black text-neutral-900 dark:text-neutral-100 uppercase">9. DERECHO DE RESCISIÓN UNILATERAL INMEDIATA POR USO FRAUDULENTO</h3>
                <p>El TITULAR podrá revocar inmediatamente la licencia ante actividades ilícitas, intentos de elusión de controles de pago o violaciones a la propiedad intelectual.</p>
              </div>

              <div className="space-y-3">
                <h3 className="font-black text-neutral-900 dark:text-neutral-100 uppercase">10. LÍMITE DE RESPONSABILIDAD Y DESLINDE LEGAL</h3>
                <p>El SISTEMA se entrega «tal cual» (as-is). El CLIENTE es el único responsable de la exactitud de los datos contables y tributarios. El tope máximo de responsabilidad económica no excederá el monto efectivamente pagado por el CLIENTE durante los 3 meses previos al reclamo (USD 0,00 en esquemas gratuitos).</p>
              </div>

              <div className="space-y-3">
                <h3 className="font-black text-neutral-900 dark:text-neutral-100 uppercase">11. JURISDICCIÓN Y LEY APLICABLE</h3>
                <p>Legislación de la República del Ecuador y tribunales correspondientes al domicilio del TITULAR (con opción de mediación previa).</p>
              </div>

              <div className="space-y-3">
                <h3 className="font-black text-neutral-900 dark:text-neutral-100 uppercase">12 al 17. DISPOSICIONES COMPLEMENTARIAS Y RATIFICACIÓN</h3>
                <p>Incluye regulación sobre seguridad de credenciales y roles, SLA de mantenimiento programado, procedimiento de actualización con 15 días de aviso previo, subsistencia de cláusulas válidas y acuerdo íntegro.</p>
              </div>

              <div className="p-4 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl border border-indigo-100 dark:border-indigo-900/40 text-center space-y-1">
                <p className="font-black text-indigo-950 dark:text-indigo-200 text-xs uppercase">
                  DECLARACIÓN DE CONFORMIDAD Y RATIFICACIÓN
                </p>
                <p className="text-[11px] text-indigo-700 dark:text-indigo-300">
                  Al marcar la casilla y activar la cuenta, el CLIENTE declara haber leído, comprendido y aceptado en su totalidad las condiciones de licenciamiento, deslinde de responsabilidad y titularidad del software aquí detalladas.
                </p>
              </div>
            </div>

            <div className="p-4 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 flex justify-end gap-3 shrink-0">
              <button
                onClick={() => setShowTerms(false)}
                className="py-3 px-6 text-sm font-bold text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors cursor-pointer"
              >
                Cerrar
              </button>
              <button
                onClick={() => {
                  setTermsAccepted(true);
                  setShowTerms(false);
                }}
                className="py-3 px-6 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 transition-all text-sm cursor-pointer"
              >
                He leído y acepto los términos
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
