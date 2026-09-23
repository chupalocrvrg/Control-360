import os

file_path = "src/components/TermsAndConditionsInfo.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

new_clauses = """const generalClauses: ClauseSection[] = [
    {
      id: 'CLAUSULA_1',
      number: '1',
      title: 'ACEPTACIÓN DE LOS TÉRMINOS',
      category: 'GENERAL',
      rawText: 'El presente documento constituye un contrato legalmente vinculante entre la persona natural o jurídica que accede, implementa o utiliza el SISTEMA (en adelante, el «CLIENTE» o «USUARIO») y Marcelo Enrique Gutama Chima (en adelante, el «TITULAR» o «DESARROLLADOR»). El acceso, registro, despliegue, configuración o uso del SISTEMA implica la aceptación plena, expresa y sin reservas de todas y cada una de las cláusulas aquí estipuladas. Si el CLIENTE no está de acuerdo con estos términos, deberá abstenerse de utilizar el software. Aceptación tácita por uso: El presente contrato se entenderá válidamente celebrado y plenamente aceptado por el CLIENTE desde el momento en que este, por sí mismo o a través de cualquier persona natural que actúe en su nombre o con su autorización (incluyendo administradores, dependientes, empleados u operadores autorizados), registre una cuenta, acceda a la versión de prueba, configure, despliegue o utilice de cualquier forma el SISTEMA, con independencia de que exista o no una firma física, electrónica u holográfica del presente documento. Dicha aceptación tácita por el uso resulta suficiente, válida y exigible frente al CLIENTE, sin que sea necesaria la identificación previa de una persona natural específica que suscriba el contrato en su nombre. Sin perjuicio de lo anterior, el TITULAR podrá solicitar, a su discreción y en cualquier momento, que una persona que acredite representación legal vigente del CLIENTE (representante legal, apoderado o administrador con facultades suficientes conforme al nombramiento inscrito o poder correspondiente) suscriba el presente documento o cualquier acuerdo particular derivado de él, como condición adicional para la activación, continuidad o ampliación del SISTEMA, sin que ello sea un requisito de validez del contrato conforme al numeral anterior.',
      content: (
        <div className="space-y-3">
          <p>
            El presente documento constituye un contrato legalmente vinculante entre la persona natural o jurídica que accede, implementa o utiliza el SISTEMA (en adelante, el «CLIENTE» o «USUARIO») y Marcelo Enrique Gutama Chima (en adelante, el «TITULAR» o «DESARROLLADOR»). El acceso, registro, despliegue, configuración o uso del SISTEMA implica la aceptación plena, expresa y sin reservas de todas y cada una de las cláusulas aquí estipuladas. Si el CLIENTE no está de acuerdo con estos términos, deberá abstenerse de utilizar el software.
          </p>
          <ul className="space-y-2.5">
            <li className="flex items-start gap-2">
              <span className="font-bold text-neutral-900 dark:text-neutral-100 shrink-0">• Aceptación tácita por uso:</span>
              <span>El presente contrato se entenderá válidamente celebrado y plenamente aceptado por el CLIENTE desde el momento en que este, por sí mismo o a través de cualquier persona natural que actúe en su nombre o con su autorización (incluyendo administradores, dependientes, empleados u operadores autorizados), registre una cuenta, acceda a la versión de prueba, configure, despliegue o utilice de cualquier forma el SISTEMA, con independencia de que exista o no una firma física, electrónica u holográfica del presente documento. Dicha aceptación tácita por el uso resulta suficiente, válida y exigible frente al CLIENTE, sin que sea necesaria la identificación previa de una persona natural específica que suscriba el contrato en su nombre.</span>
            </li>
          </ul>
          <p>
            Sin perjuicio de lo anterior, el TITULAR podrá solicitar, a su discreción y en cualquier momento, que una persona que acredite representación legal vigente del CLIENTE (representante legal, apoderado o administrador con facultades suficientes conforme al nombramiento inscrito o poder correspondiente) suscriba el presente documento o cualquier acuerdo particular derivado de él, como condición adicional para la activación, continuidad o ampliación del SISTEMA, sin que ello sea un requisito de validez del contrato conforme al numeral anterior.
          </p>
        </div>
      )
    },
    {
      id: 'CLAUSULA_2',
      number: '2',
      title: 'DECLARACIÓN DE PROPIEDAD INTELECTUAL Y TITULARIDAD EXCLUSIVA',
      category: 'PROPIEDAD',
      rawText: 'Titularidad: El TITULAR declara y ratifica ser el único, legítimo y exclusivo autor, creador y titular de todos los derechos morales y patrimoniales de propiedad intelectual, derechos de autor y secretos comerciales sobre el SISTEMA, abarcando de forma enunciativa pero no limitativa: código fuente, código objeto, algoritmos, arquitectura de software, bases de datos base, diagramas de flujo, interfaces gráficas (UI/UX), lógica de negocio, módulos de cálculo, API y cualquier desarrollo derivado, mejora o actualización. Origen y condiciones de desarrollo: El TITULAR declara expresamente que el SISTEMA fue concebido, diseñado y desarrollado por su exclusiva iniciativa, con equipos, herramientas, licencias de software, cuentas de servicios en la nube y demás recursos de su propiedad personal, fuera de la jornada laboral ordinaria y sin utilizar activos, credenciales, cuentas institucionales, información confidencial ni infraestructura pertenecientes a ningún empleador o contraparte comercial del TITULAR. Esta declaración podrá ser respaldada mediante evidencia técnica (control de versiones, historial de despliegue, facturación de servicios propios) en caso de controversia. Inexistencia de obra por encargo o vínculo laboral: Ninguna relación comercial, prestación de servicios, contrato laboral presente o pasado, ni la emisión de honorarios, remuneraciones o beneficios de cualquier naturaleza transferirá, cederá o presumirá la cesión de los derechos de autor o propiedad industrial a favor del CLIENTE ni de terceras entidades. El SISTEMA no fue creado dentro del objeto, funciones o encargo de ninguna relación laboral del TITULAR, ni constituye una obra derivada de la actividad para la cual el TITULAR hubiera sido contratado por el CLIENTE, cuando dicho CLIENTE sea simultáneamente empleador del TITULAR. Reserva de derechos de explotación: El TITULAR se reserva de manera irrestricta el derecho de explotar comercialmente, distribuir, sublicenciar, comercializar bajo modelo SaaS (Software as a Service) o modificar el SISTEMA con cualquier persona natural o jurídica, competidor o tercero del mercado, sin requerir autorización ni otorgar compensación o regalía alguna al CLIENTE.',
      content: (
        <div className="space-y-3">
          <ul className="space-y-2.5">
            <li className="flex items-start gap-2">
              <span className="font-bold text-neutral-900 dark:text-neutral-100 shrink-0">• Titularidad:</span>
              <span>El TITULAR declara y ratifica ser el único, legítimo y exclusivo autor, creador y titular de todos los derechos morales y patrimoniales de propiedad intelectual, derechos de autor y secretos comerciales sobre el SISTEMA, abarcando de forma enunciativa pero no limitativa: código fuente, código objeto, algoritmos, arquitectura de software, bases de datos base, diagramas de flujo, interfaces gráficas (UI/UX), lógica de negocio, módulos de cálculo, API y cualquier desarrollo derivado, mejora o actualización.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-neutral-900 dark:text-neutral-100 shrink-0">• Origen y condiciones de desarrollo:</span>
              <span>El TITULAR declara expresamente que el SISTEMA fue concebido, diseñado y desarrollado por su exclusiva iniciativa, con equipos, herramientas, licencias de software, cuentas de servicios en la nube y demás recursos de su propiedad personal, fuera de la jornada laboral ordinaria y sin utilizar activos, credenciales, cuentas institucionales, información confidencial ni infraestructura pertenecientes a ningún empleador o contraparte comercial del TITULAR. Esta declaración podrá ser respaldada mediante evidencia técnica (control de versiones, historial de despliegue, facturación de servicios propios) en caso de controversia.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-neutral-900 dark:text-neutral-100 shrink-0">• Inexistencia de obra por encargo o vínculo laboral:</span>
              <span>Ninguna relación comercial, prestación de servicios, contrato laboral presente o pasado, ni la emisión de honorarios, remuneraciones o beneficios de cualquier naturaleza transferirá, cederá o presumirá la cesión de los derechos de autor o propiedad industrial a favor del CLIENTE ni de terceras entidades. El SISTEMA no fue creado dentro del objeto, funciones o encargo de ninguna relación laboral del TITULAR, ni constituye una obra derivada de la actividad para la cual el TITULAR hubiera sido contratado por el CLIENTE, cuando dicho CLIENTE sea simultáneamente empleador del TITULAR.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-neutral-900 dark:text-neutral-100 shrink-0">• Reserva de derechos de explotación:</span>
              <span>El TITULAR se reserva de manera irrestricta el derecho de explotar comercialmente, distribuir, sublicenciar, comercializar bajo modelo SaaS (Software as a Service) o modificar el SISTEMA con cualquier persona natural o jurídica, competidor o tercero del mercado, sin requerir autorización ni otorgar compensación o regalía alguna al CLIENTE.</span>
            </li>
          </ul>
        </div>
      )
    },
    {
      id: 'CLAUSULA_3',
      number: '3',
      title: 'OTORGAMIENTO DE LICENCIA DE USO (NO CESIÓN DE DERECHOS)',
      category: 'LICENCIAMIENTO',
      rawText: 'Naturaleza de la licencia: El TITULAR otorga al CLIENTE una licencia de uso de software de carácter estrictamente temporal, revocable, no exclusiva, intransferible y no sublicenciable. Alcance: La presente autorización faculta al CLIENTE exclusivamente a operar el software como herramienta interna de gestión comercial, control de cheques, cobranzas, presupuestos, facturación y control de inventarios. Prohibición de transferencia: Bajo ninguna circunstancia el presente acuerdo se interpretará como una venta, cesión o traspaso del software. Queda expresamente prohibido vender, alquilar, arrendar, revender, redistribuir, sublicenciar o permitir el uso del SISTEMA a terceros ajenos a la estructura operativa autorizada del CLIENTE.',
      content: (
        <div className="space-y-3">
          <ul className="space-y-2.5">
            <li className="flex items-start gap-2">
              <span className="font-bold text-neutral-900 dark:text-neutral-100 shrink-0">• Naturaleza de la licencia:</span>
              <span>El TITULAR otorga al CLIENTE una licencia de uso de software de carácter estrictamente temporal, revocable, no exclusiva, intransferible y no sublicenciable.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-neutral-900 dark:text-neutral-100 shrink-0">• Alcance:</span>
              <span>La presente autorización faculta al CLIENTE exclusivamente a operar el software como herramienta interna de gestión comercial, control de cheques, cobranzas, presupuestos, facturación y control de inventarios.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-neutral-900 dark:text-neutral-100 shrink-0">• Prohibición de transferencia:</span>
              <span>Bajo ninguna circunstancia el presente acuerdo se interpretará como una venta, cesión o traspaso del software. Queda expresamente prohibido vender, alquilar, arrendar, revender, redistribuir, sublicenciar o permitir el uso del SISTEMA a terceros ajenos a la estructura operativa autorizada del CLIENTE.</span>
            </li>
          </ul>
        </div>
      )
    },
    {
      id: 'CLAUSULA_4',
      number: '4',
      title: 'PLANES ESPECIALES, PROMOCIONALES O DE CORTESÍA; TRANSICIÓN Y SUSPENSIÓN',
      category: 'PLANES',
      rawText: 'Planes especiales: El TITULAR se reserva la facultad discrecional de otorgar planes especiales, promocionales o de cortesía, mediante acuerdos privados o mediante asignación directa de suscripción dentro de la plataforma, a favor de la persona natural o jurídica que estime conveniente. El otorgamiento de un plan especial a un beneficiario determinado no constituye precedente, práctica comercial uniforme, ni genera derecho adquirido u obligación de extenderlo a ningún otro CLIENTE o tercero. Condiciones particulares no públicas: Los planes especiales podrán sujetarse a condiciones particulares acordadas de forma privada entre el TITULAR y el beneficiario correspondiente, las cuales prevalecerán sobre estos Términos únicamente en lo que expresamente modifiquen, rigiendo estos Términos Generales de forma supletoria en todo lo demás. Terminación o vencimiento de un plan especial: Al finalizar, por cualquier causa, la vigencia de un plan especial, promocional o de cortesía —incluyendo el vencimiento del período de prueba estándar de tres (3) meses previsto en la Cláusula 5— el acceso completo del beneficiario al SISTEMA quedará sujeto a la contratación de alguno de los planes de suscripción comercial descritos en la Cláusula 5. Aviso previo: El TITULAR notificará al beneficiario, a través de la interfaz del SISTEMA o por correo electrónico, la fecha de vencimiento o finalización del plan vigente, otorgando un plazo de hasta quince (15) días calendario para que este contrate el plan comercial de su elección antes de que el SISTEMA pase al modo de solo lectura descrito en el numeral siguiente. Régimen de solo lectura: Vencido el plazo de quince (15) días indicado sin que se haya formalizado la contratación del plan comercial correspondiente, el SISTEMA ingresará automáticamente a un modo de solo lectura y exportación de datos por un período adicional de treinta (30) días calendario. Durante este período: (i) el beneficiario conservará acceso de consulta y exportación a la totalidad de su información histórica en formatos CSV, Excel o JSON; (ii) quedará bloqueado el registro de nuevas transacciones, facturas, cobros, ajustes de inventario o cualquier otra operación que modifique los datos; y (iii) los módulos de reportería y consulta permanecerán disponibles. Suspensión definitiva: Transcurrido el período de solo lectura de treinta (30) días sin que se haya contratado un plan comercial, se suspenderán definitivamente los accesos, incluyendo los de sola consulta, sin perjuicio de la obligación del TITULAR de conservar copia de respaldo de los datos durante el plazo adicional que determine su propia política de retención.',
      content: (
        <div className="space-y-3">
          <ul className="space-y-2.5">
            <li className="flex items-start gap-2">
              <span className="font-bold text-neutral-900 dark:text-neutral-100 shrink-0">• Planes especiales:</span>
              <span>El TITULAR se reserva la facultad discrecional de otorgar planes especiales, promocionales o de cortesía, mediante acuerdos privados o mediante asignación directa de suscripción dentro de la plataforma, a favor de la persona natural o jurídica que estime conveniente. El otorgamiento de un plan especial a un beneficiario determinado no constituye precedente, práctica comercial uniforme, ni genera derecho adquirido u obligación de extenderlo a ningún otro CLIENTE o tercero.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-neutral-900 dark:text-neutral-100 shrink-0">• Condiciones particulares no públicas:</span>
              <span>Los planes especiales podrán sujetarse a condiciones particulares acordadas de forma privada entre el TITULAR y el beneficiario correspondiente, las cuales prevalecerán sobre estos Términos únicamente en lo que expresamente modifiquen, rigiendo estos Términos Generales de forma supletoria en todo lo demás.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-neutral-900 dark:text-neutral-100 shrink-0">• Terminación o vencimiento de un plan especial:</span>
              <span>Al finalizar, por cualquier causa, la vigencia de un plan especial, promocional o de cortesía —incluyendo el vencimiento del período de prueba estándar de tres (3) meses previsto en la Cláusula 5— el acceso completo del beneficiario al SISTEMA quedará sujeto a la contratación de alguno de los planes de suscripción comercial descritos en la Cláusula 5.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-neutral-900 dark:text-neutral-100 shrink-0">• Aviso previo:</span>
              <span>El TITULAR notificará al beneficiario, a través de la interfaz del SISTEMA o por correo electrónico, la fecha de vencimiento o finalización del plan vigente, otorgando un plazo de hasta quince (15) días calendario para que este contrate el plan comercial de su elección antes de que el SISTEMA pase al modo de solo lectura descrito en el numeral siguiente.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-neutral-900 dark:text-neutral-100 shrink-0">• Régimen de solo lectura:</span>
              <span>Vencido el plazo de quince (15) días indicado sin que se haya formalizado la contratación del plan comercial correspondiente, el SISTEMA ingresará automáticamente a un modo de solo lectura y exportación de datos por un período adicional de treinta (30) días calendario. Durante este período: <strong>(i)</strong> el beneficiario conservará acceso de consulta y exportación a la totalidad de su información histórica en formatos CSV, Excel o JSON; <strong>(ii)</strong> quedará bloqueado el registro de nuevas transacciones, facturas, cobros, ajustes de inventario o cualquier otra operación que modifique los datos; y <strong>(iii)</strong> los módulos de reportería y consulta permanecerán disponibles.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-neutral-900 dark:text-neutral-100 shrink-0">• Suspensión definitiva:</span>
              <span>Transcurrido el período de solo lectura de treinta (30) días sin que se haya contratado un plan comercial, se suspenderán definitivamente los accesos, incluyendo los de sola consulta, sin perjuicio de la obligación del TITULAR de conservar copia de respaldo de los datos durante el plazo adicional que determine su propia política de retención.</span>
            </li>
          </ul>
        </div>
      )
    },
    {
      id: 'CLAUSULA_5',
      number: '5',
      title: 'MODELO DE NEGOCIO, PERÍODO DE PRUEBA Y PLANES DE SUSCRIPCIÓN',
      category: 'PLANES',
      rawText: 'El acceso al SISTEMA se rige bajo el siguiente esquema de licenciamiento, salvo que un acuerdo privado suscrito conforme a la Cláusula 4 disponga un esquema particular para un beneficiario determinado: Versión de prueba (Beta / Trial): Se otorga un período de prueba gratuito de hasta tres (3) meses calendario desde la habilitación de la cuenta, orientado a la validación de módulos y estabilización operativa. Licencias comerciales temporales: Concluido el período de prueba o, en su caso, al activarse el esquema de suscripción conforme a la Cláusula 4, la continuidad del servicio requerirá la contratación de planes de suscripción temporal pagados por adelantado en las modalidades de tres (3), seis (6) o doce (12) meses. Suspensión por falta de pago: El impago o vencimiento del período contratado facultará al TITULAR a restringir de forma inmediata el acceso operativo al SISTEMA hasta la regularización de los valores correspondientes.',
      content: (
        <div className="space-y-3">
          <p>
            El acceso al SISTEMA se rige bajo el siguiente esquema de licenciamiento, salvo que un acuerdo privado suscrito conforme a la Cláusula 4 disponga un esquema particular para un beneficiario determinado:
          </p>
          <ul className="space-y-2.5">
            <li className="flex items-start gap-2">
              <span className="font-bold text-neutral-900 dark:text-neutral-100 shrink-0">• Versión de prueba (Beta / Trial):</span>
              <span>Se otorga un período de prueba gratuito de hasta tres (3) meses calendario desde la habilitación de la cuenta, orientado a la validación de módulos y estabilización operativa.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-neutral-900 dark:text-neutral-100 shrink-0">• Licencias comerciales temporales:</span>
              <span>Concluido el período de prueba o, en su caso, al activarse el esquema de suscripción conforme a la Cláusula 4, la continuidad del servicio requerirá la contratación de planes de suscripción temporal pagados por adelantado en las modalidades de tres (3), seis (6) o doce (12) meses.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-neutral-900 dark:text-neutral-100 shrink-0">• Suspensión por falta de pago:</span>
              <span>El impago o vencimiento del período contratado facultará al TITULAR a restringir de forma inmediata el acceso operativo al SISTEMA hasta la regularización de los valores correspondientes.</span>
            </li>
          </ul>
        </div>
      )
    },
    {
      id: 'CLAUSULA_6',
      number: '6',
      title: 'PROPIEDAD DE LA INFORMACIÓN VS. PROPIEDAD DEL SISTEMA',
      category: 'PROPIEDAD',
      rawText: 'Custodia de datos del cliente: Todos los registros transaccionales, catálogos de productos, listas de clientes, documentos de facturación, comprobantes de cobro y datos financieros ingresados al SISTEMA son de propiedad única y exclusiva del CLIENTE. Separación de activos: El CLIENTE es el dueño exclusivo de la información cargada; el TITULAR es el dueño exclusivo de la infraestructura, plataforma, arquitectura y código que procesa dicha información. Disponibilidad para exportación: Ante la cancelación del servicio, el TITULAR garantizará los mecanismos para que el CLIENTE pueda exportar su información en formatos estructurados estándar (CSV, Excel o JSON), condicionado a que no existan controversias por uso indebido de la plataforma ni valores pendientes de pago.',
      content: (
        <div className="space-y-3">
          <ul className="space-y-2.5">
            <li className="flex items-start gap-2">
              <span className="font-bold text-neutral-900 dark:text-neutral-100 shrink-0">• Custodia de datos del cliente:</span>
              <span>Todos los registros transaccionales, catálogos de productos, listas de clientes, documentos de facturación, comprobantes de cobro y datos financieros ingresados al SISTEMA son de propiedad única y exclusiva del CLIENTE.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-neutral-900 dark:text-neutral-100 shrink-0">• Separación de activos:</span>
              <span>El CLIENTE es el dueño exclusivo de la información cargada; el TITULAR es el dueño exclusivo de la infraestructura, plataforma, arquitectura y código que procesa dicha información.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-neutral-900 dark:text-neutral-100 shrink-0">• Disponibilidad para exportación:</span>
              <span>Ante la cancelación del servicio, el TITULAR garantizará los mecanismos para que el CLIENTE pueda exportar su información en formatos estructurados estándar (CSV, Excel o JSON), condicionado a que no existan controversias por uso indebido de la plataforma ni valores pendientes de pago.</span>
            </li>
          </ul>
        </div>
      )
    },
    {
      id: 'CLAUSULA_7',
      number: '7',
      title: 'POLÍTICA DE PRIVACIDAD, TRATAMIENTO DE DATOS Y CONFIDENCIALIDAD',
      category: 'PRIVACIDAD',
      rawText: 'Uso restringido: Toda la información procesada a través del SISTEMA será tratada bajo rigurosos estándares de confidencialidad y se utilizará exclusivamente para la ejecución y mantenimiento de las funciones operativas del SISTEMA, así como para diagnóstico técnico, corrección de errores (debugging), monitoreo de rendimiento y optimización del software. No comercialización: Los datos del CLIENTE no serán vendidos, cedidos, transferidos, alquilados ni divulgados a terceras personas ni entidades bajo ningún concepto, salvo notificación previa y consentimiento expreso del CLIENTE, o mandato legal expreso emitido por autoridad judicial o administrativa competente. Marco normativo aplicable: El TITULAR tratará los datos personales que procese el SISTEMA con observancia de la Ley Orgánica de Protección de Datos Personales de la República del Ecuador (LOPDP) y su normativa reglamentaria. El CLIENTE, en su calidad de responsable del tratamiento respecto de los datos de sus propios clientes y colaboradores, será responsable de contar con las bases de licitud, avisos de privacidad y consentimientos que dicha ley exija frente a los titulares de los datos que ingrese al SISTEMA. Encargo de tratamiento (datos transaccionales del CLIENTE): Para efectos de la LOPDP, el TITULAR actúa como encargado del tratamiento respecto de las bases de datos transaccionales y de terceros que el CLIENTE ingresa, procesa o almacena en el SISTEMA (registros de clientes, facturación emitida a terceros, cobranzas e inventarios), limitándose a procesarlos conforme a las instrucciones del CLIENTE y a los fines descritos en esta cláusula. Responsable de tratamiento (datos propios del servicio): Respecto de los datos que el TITULAR recaba y procesa por cuenta propia para la gestión de la relación contractual con el CLIENTE —incluyendo credenciales y registros de acceso de los usuarios del CLIENTE, registros de auditoría técnica del SISTEMA (logs), y datos de facturación y cobro de la licencia del propio SISTEMA— el TITULAR actúa como responsable del tratamiento, y determinará las finalidades y medios de dicho procesamiento conforme a la LOPDP, debiendo observar frente a los titulares de esos datos (los usuarios/colaboradores del CLIENTE) los deberes de información y demás obligaciones que dicha ley exige a todo responsable.',
      content: (
        <div className="space-y-3">
          <ul className="space-y-2.5">
            <li className="flex items-start gap-2">
              <span className="font-bold text-neutral-900 dark:text-neutral-100 shrink-0">• Uso restringido:</span>
              <span>Toda la información procesada a través del SISTEMA será tratada bajo rigurosos estándares de confidencialidad y se utilizará exclusivamente para la ejecución y mantenimiento de las funciones operativas del SISTEMA, así como para diagnóstico técnico, corrección de errores (debugging), monitoreo de rendimiento y optimización del software.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-neutral-900 dark:text-neutral-100 shrink-0">• No comercialización:</span>
              <span>Los datos del CLIENTE no serán vendidos, cedidos, transferidos, alquilados ni divulgados a terceras personas ni entidades bajo ningún concepto, salvo notificación previa y consentimiento expreso del CLIENTE, o mandato legal expreso emitido por autoridad judicial o administrativa competente.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-neutral-900 dark:text-neutral-100 shrink-0">• Marco normativo aplicable:</span>
              <span>El TITULAR tratará los datos personales que procese el SISTEMA con observancia de la <strong>Ley Orgánica de Protección de Datos Personales de la República del Ecuador (LOPDP)</strong> y su normativa reglamentaria. El CLIENTE, en su calidad de responsable del tratamiento respecto de los datos de sus propios clientes y colaboradores, será responsable de contar con las bases de licitud, avisos de privacidad y consentimientos que dicha ley exija frente a los titulares de los datos que ingrese al SISTEMA.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-neutral-900 dark:text-neutral-100 shrink-0">• Encargo de tratamiento (datos transaccionales del CLIENTE):</span>
              <span>Para efectos de la LOPDP, el TITULAR actúa como <em>encargado del tratamiento</em> respecto de las bases de datos transaccionales y de terceros que el CLIENTE ingresa, procesa o almacena en el SISTEMA (registros de clientes, facturación emitida a terceros, cobranzas e inventarios), limitándose a procesarlos conforme a las instrucciones del CLIENTE y a los fines descritos en esta cláusula.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-neutral-900 dark:text-neutral-100 shrink-0">• Responsable de tratamiento (datos propios del servicio):</span>
              <span>Respecto de los datos que el TITULAR recaba y procesa por cuenta propia para la gestión de la relación contractual con el CLIENTE —incluyendo credenciales y registros de acceso de los usuarios del CLIENTE, registros de auditoría técnica del SISTEMA (logs), y datos de facturación y cobro de la licencia del propio SISTEMA— el TITULAR actúa como <em>responsable del tratamiento</em>, y determinará las finalidades y medios de dicho procesamiento conforme a la LOPDP, debiendo observar frente a los titulares de esos datos (los usuarios/colaboradores del CLIENTE) los deberes de información y demás obligaciones que dicha ley exige a todo responsable.</span>
            </li>
          </ul>
        </div>
      )
    },
    {
      id: 'CLAUSULA_8',
      number: '8',
      title: 'PROHIBICIÓN ESTRICTA DE INGENIERÍA INVERSA Y EXPLOTACIÓN NO AUTORIZADA',
      category: 'SEGURIDAD',
      rawText: 'Queda terminantemente prohibido al CLIENTE, sus empleados, contratistas, dependientes o cualquier tercero vinculado: Descompilar, desensamblar, aplicar ingeniería inversa, descifrar o intentar descubrir el código fuente, la arquitectura interna o los algoritmos del SISTEMA. Extraer, copiar, reproducir, plagiar o clonar las interfaces gráficas, esquemas de pantallas, flujos de trabajo, configuraciones o lógica de negocio para la creación de un producto competidor o derivado. Emplear herramientas automatizadas (scrapers, bots, crawlers) o técnicas de inyección de código para extraer datos o vulnerar la seguridad del entorno. Realizar pruebas de penetración, análisis de vulnerabilidades o explotación de fallos sin el consentimiento previo por escrito del TITULAR.',
      content: (
        <div className="space-y-3">
          <p>Queda terminantemente prohibido al CLIENTE, sus empleados, contratistas, dependientes o cualquier tercero vinculado:</p>
          <ul className="space-y-2.5">
            <li className="flex items-start gap-2">
              <span className="text-red-500 font-bold shrink-0">•</span>
              <span>Descompilar, desensamblar, aplicar ingeniería inversa, descifrar o intentar descubrir el código fuente, la arquitectura interna o los algoritmos del SISTEMA.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-500 font-bold shrink-0">•</span>
              <span>Extraer, copiar, reproducir, plagiar o clonar las interfaces gráficas, esquemas de pantallas, flujos de trabajo, configuraciones o lógica de negocio para la creación de un producto competidor o derivado.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-500 font-bold shrink-0">•</span>
              <span>Emplear herramientas automatizadas (scrapers, bots, crawlers) o técnicas de inyección de código para extraer datos o vulnerar la seguridad del entorno.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-500 font-bold shrink-0">•</span>
              <span>Realizar pruebas de penetración, análisis de vulnerabilidades o explotación de fallos sin el consentimiento previo por escrito del TITULAR.</span>
            </li>
          </ul>
        </div>
      )
    },
    {
      id: 'CLAUSULA_9',
      number: '9',
      title: 'DERECHO DE RESCISIÓN UNILATERAL INMEDIATA POR USO FRAUDULENTO',
      category: 'SEGURIDAD',
      rawText: 'El TITULAR se reserva la facultad de suspender, revocar o cancelar de forma inmediata, definitiva y unilateral la licencia de uso y el acceso al SISTEMA, sin derecho a reembolso ni indemnización alguna a favor del CLIENTE, cuando se compruebe o existan indicios fundamentados de que: El SISTEMA está siendo utilizado para actividades fraudulentas, ilícitas o violatorias de la normativa tributaria y comercial aplicable. Se esté intentando eludir los controles de licenciamiento, pagos, límites de cuentas o medidas de seguridad. Se haya incurrido en violaciones directas a los derechos de propiedad intelectual, ingeniería inversa o filtración de componentes técnicos de la plataforma.',
      content: (
        <div className="space-y-3">
          <p>
            El TITULAR se reserva la facultad de suspender, revocar o cancelar de forma inmediata, definitiva y unilateral la licencia de uso y el acceso al SISTEMA, sin derecho a reembolso ni indemnización alguna a favor del CLIENTE, cuando se compruebe o existan indicios fundamentados de que:
          </p>
          <ul className="space-y-2.5">
            <li className="flex items-start gap-2">
              <span className="text-amber-500 font-bold shrink-0">•</span>
              <span>El SISTEMA está siendo utilizado para actividades fraudulentas, ilícitas o violatorias de la normativa tributaria y comercial aplicable.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-500 font-bold shrink-0">•</span>
              <span>Se esté intentando eludir los controles de licenciamiento, pagos, límites de cuentas o medidas de seguridad.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-500 font-bold shrink-0">•</span>
              <span>Se haya incurrido en violaciones directas a los derechos de propiedad intelectual, ingeniería inversa o filtración de componentes técnicos de la plataforma.</span>
            </li>
          </ul>
        </div>
      )
    },
    {
      id: 'CLAUSULA_10',
      number: '10',
      title: 'LÍMITE DE RESPONSABILIDAD Y DESLINDE LEGAL',
      category: 'LEGAL',
      rawText: 'Suministro «tal cual» (as-is): El SISTEMA se entrega en su estado actual, con las funcionalidades disponibles en cada versión. El TITULAR no garantiza que el software opere de manera ininterrumpida o libre de incidencias menores derivadas de caídas de servidores en la nube, cortes de conectividad del CLIENTE o fallas en servicios de terceros (APIs externas, pasarelas o proveedores de infraestructura). Deslinde por errores de entrada y tributarios: El CLIENTE es el único responsable de la exactitud, veracidad y validación de los datos contables, valores de inventario, cálculos de impuestos y comprobantes de facturación emitidos. El TITULAR no asume responsabilidad civil, penal, laboral ni tributaria ante organismos de control (como el SRI u homólogos) por sanciones, multas o discrepancias contables derivadas del mal uso o error del operador. Exclusión de daños consecuenciales: Bajo ninguna circunstancia el TITULAR responderá por lucro cesante, pérdida de oportunidades de negocio, daños indirectos, punitivos o pérdidas económicas alegadas por la indisponibilidad temporal del SISTEMA. Tope máximo de responsabilidad: En el eventual supuesto de que el TITULAR resultare responsable frente al CLIENTE por cualquier concepto derivado del presente contrato, dicha responsabilidad no podrá exceder, en ningún caso, el monto efectivamente pagado por el CLIENTE al TITULAR durante los tres (3) meses previos al hecho que origina el reclamo. En los esquemas prestados de forma gratuita, el tope de responsabilidad será de cero dólares de los Estados Unidos de América (USD 0,00), en atención a la ausencia de contraprestación económica. Indemnidad: El CLIENTE se obliga a mantener indemne y a liberar de toda responsabilidad al TITULAR frente a cualquier reclamo, demanda, sanción o gasto (incluyendo honorarios legales razonables) que se derive de: (i) el uso indebido del SISTEMA por parte del CLIENTE, sus empleados o dependientes; (ii) la inexactitud de la información ingresada al SISTEMA; o (iii) el incumplimiento por parte del CLIENTE de la normativa tributaria, laboral o de protección de datos aplicable a su operación.',
      content: (
        <div className="space-y-3">
          <ul className="space-y-2.5">
            <li className="flex items-start gap-2">
              <span className="font-bold text-neutral-900 dark:text-neutral-100 shrink-0">• Suministro «tal cual» (as-is):</span>
              <span>El SISTEMA se entrega en su estado actual, con las funcionalidades disponibles en cada versión. El TITULAR no garantiza que el software opere de manera ininterrumpida o libre de incidencias menores derivadas de caídas de servidores en la nube, cortes de conectividad del CLIENTE o fallas en servicios de terceros (APIs externas, pasarelas o proveedores de infraestructura).</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-neutral-900 dark:text-neutral-100 shrink-0">• Deslinde por errores de entrada y tributarios:</span>
              <span>El CLIENTE es el único responsable de la exactitud, veracidad y validación de los datos contables, valores de inventario, cálculos de impuestos y comprobantes de facturación emitidos. El TITULAR no asume responsabilidad civil, penal, laboral ni tributaria ante organismos de control (como el SRI u homólogos) por sanciones, multas o discrepancias contables derivadas del mal uso o error del operador.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-neutral-900 dark:text-neutral-100 shrink-0">• Exclusión de daños consecuenciales:</span>
              <span>Bajo ninguna circunstancia el TITULAR responderá por lucro cesante, pérdida de oportunidades de negocio, daños indirectos, punitivos o pérdidas económicas alegadas por la indisponibilidad temporal del SISTEMA.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-neutral-900 dark:text-neutral-100 shrink-0">• Tope máximo de responsabilidad:</span>
              <span>En el eventual supuesto de que el TITULAR resultare responsable frente al CLIENTE por cualquier concepto derivado del presente contrato, dicha responsabilidad no podrá exceder, en ningún caso, el monto efectivamente pagado por el CLIENTE al TITULAR durante los tres (3) meses previos al hecho que origina el reclamo. En los esquemas prestados de forma gratuita, el tope de responsabilidad será de cero dólares de los Estados Unidos de América (USD 0,00), en atención a la ausencia de contraprestación económica.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-neutral-900 dark:text-neutral-100 shrink-0">• Indemnidad:</span>
              <span>El CLIENTE se obliga a mantener indemne y a liberar de toda responsabilidad al TITULAR frente a cualquier reclamo, demanda, sanción o gasto (incluyendo honorarios legales razonables) que se derive de: <strong>(i)</strong> el uso indebido del SISTEMA por parte del CLIENTE, sus empleados o dependientes; <strong>(ii)</strong> la inexactitud de la información ingresada al SISTEMA; o <strong>(iii)</strong> el incumplimiento por parte del CLIENTE de la normativa tributaria, laboral o de protección de datos aplicable a su operación.</span>
            </li>
          </ul>
        </div>
      )
    },
    {
      id: 'CLAUSULA_11',
      number: '11',
      title: 'JURISDICCIÓN Y LEY APLICABLE',
      category: 'LEGAL',
      rawText: 'Para la interpretación, cumplimiento y resolución de cualquier controversia derivada del presente documento, las partes se someten expresamente a la legislación aplicable en la República del Ecuador y a la competencia de los tribunales correspondientes al domicilio del TITULAR, renunciando a cualquier otro fuero que pudiera corresponderles por razón de sus domicilios presentes o futuros. Las partes podrán acordar, de manera adicional y previa a la vía judicial, someter sus controversias a un procedimiento de mediación ante un centro de mediación legalmente reconocido en el Ecuador.',
      content: (
        <div className="space-y-3">
          <p>
            Para la interpretación, cumplimiento y resolución de cualquier controversia derivada del presente documento, las partes se someten expresamente a la legislación aplicable en la <strong>República del Ecuador</strong> y a la competencia de los tribunales correspondientes al domicilio del TITULAR, renunciando a cualquier otro fuero que pudiera corresponderles por razón de sus domicilios presentes o futuros.
          </p>
          <p>
            Las partes podrán acordar, de manera adicional y previa a la vía judicial, someter sus controversias a un procedimiento de mediación ante un centro de mediación legalmente reconocido en el Ecuador.
          </p>
        </div>
      )
    },
    {
      id: 'CLAUSULA_12',
      number: '12',
      title: 'SEGURIDAD DE ACCESOS, CREDENCIALES Y RESPONSABILIDAD DE USUARIOS',
      category: 'SEGURIDAD',
      rawText: 'Custodia de credenciales: El CLIENTE es el único responsable de mantener la confidencialidad de las contraseñas, tokens de autenticación y accesos asignados a cada uno de sus colaboradores o roles administrativos. Toda acción realizada en el SISTEMA utilizando una cuenta válida se presumirá ejecutada directamente por el personal autorizado del CLIENTE. Notificación de vulnerabilidades: En caso de extravío, filtración de credenciales o sospecha de acceso no autorizado, el CLIENTE está obligado a notificar de forma inmediata al TITULAR para proceder con el bloqueo o restablecimiento de las sesiones activas. Control de perfiles y roles: Es potestad del CLIENTE configurar los permisos internos de sus operadores (cajas, cobranzas, facturación, auditoría). El TITULAR queda exonerado de cualquier perjuicio ocasionado por una mala asignación de permisos por parte de los administradores del CLIENTE.',
      content: (
        <div className="space-y-3">
          <ul className="space-y-2.5">
            <li className="flex items-start gap-2">
              <span className="font-bold text-neutral-900 dark:text-neutral-100 shrink-0">• Custodia de credenciales:</span>
              <span>El CLIENTE es el único responsable de mantener la confidencialidad de las contraseñas, tokens de autenticación y accesos asignados a cada uno de sus colaboradores o roles administrativos. Toda acción realizada en el SISTEMA utilizando una cuenta válida se presumirá ejecutada directamente por el personal autorizado del CLIENTE.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-neutral-900 dark:text-neutral-100 shrink-0">• Notificación de vulnerabilidades:</span>
              <span>En caso de extravío, filtración de credenciales o sospecha de acceso no autorizado, el CLIENTE está obligado a notificar de forma inmediata al TITULAR para proceder con el bloqueo o restablecimiento de las sesiones activas.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-neutral-900 dark:text-neutral-100 shrink-0">• Control de perfiles y roles:</span>
              <span>Es potestad del CLIENTE configurar los permisos internos de sus operadores (cajas, cobranzas, facturación, auditoría). El TITULAR queda exonerado de cualquier perjuicio ocasionado por una mala asignación de permisos por parte de los administradores del CLIENTE.</span>
            </li>
          </ul>
        </div>
      )
    },
    {
      id: 'CLAUSULA_13',
      number: '13',
      title: 'ACUERDO DE NIVEL DE SERVICIO (SLA), SOPORTE Y MANTENIMIENTO',
      category: 'SOPORTE',
      rawText: 'Ventanas de mantenimiento: El TITULAR se reserva el derecho de interrumpir temporalmente el acceso a la plataforma para aplicar actualizaciones de software, parches de seguridad, mejoras estructurales o mantenimiento de bases de datos. Dichas intervenciones se programarán preferentemente fuera de los horarios comerciales habituales. Alcance del soporte técnico: El soporte incluido en las licencias temporales cubre incidencias críticas operativas imputables directamente al código base del SISTEMA. No incluye la provisión de hardware, configuración de redes locales del CLIENTE, soporte a software de terceros ni capacitación de personal nuevo fuera de los planes acordados. Fuerza mayor y servicios de terceros: El TITULAR queda exento de responsabilidad ante caídas generales de infraestructura en la nube (como Google Cloud Platform, Firebase, Vercel, AWS), bloqueos de proveedores de internet (ISP) o interrupciones de servicios web gubernamentales (sistemas de validación tributaria).',
      content: (
        <div className="space-y-3">
          <ul className="space-y-2.5">
            <li className="flex items-start gap-2">
              <span className="font-bold text-neutral-900 dark:text-neutral-100 shrink-0">• Ventanas de mantenimiento:</span>
              <span>El TITULAR se reserva el derecho de interrumpir temporalmente el acceso a la plataforma para aplicar actualizaciones de software, parches de seguridad, mejoras estructurales o mantenimiento de bases de datos. Dichas intervenciones se programarán preferentemente fuera de los horarios comerciales habituales.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-neutral-900 dark:text-neutral-100 shrink-0">• Alcance del soporte técnico:</span>
              <span>El soporte incluido en las licencias temporales cubre incidencias críticas operativas imputables directamente al código base del SISTEMA. No incluye la provisión de hardware, configuración de redes locales del CLIENTE, soporte a software de terceros ni capacitación de personal nuevo fuera de los planes acordados.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-neutral-900 dark:text-neutral-100 shrink-0">• Fuerza mayor y servicios de terceros:</span>
              <span>El TITULAR queda exento de responsabilidad ante caídas generales de infraestructura en la nube (como Google Cloud Platform, Firebase, Vercel, AWS), bloqueos de proveedores de internet (ISP) o interrupciones de servicios web gubernamentales (sistemas de validación tributaria).</span>
            </li>
          </ul>
        </div>
      )
    },
    {
      id: 'CLAUSULA_14',
      number: '14',
      title: 'MODIFICACIONES A LOS TÉRMINOS Y CONDICIONES',
      category: 'GENERAL',
      rawText: 'Actualizaciones del contrato: El TITULAR se reserva el derecho de modificar, actualizar o complementar las cláusulas del presente documento para adaptarlo a nuevas regulaciones legales, normativas tributarias o evoluciones arquitectónicas de la plataforma. Notificación de cambios: Cualquier modificación sustancial será informada al CLIENTE con un mínimo de quince (15) días de anticipación a través de la interfaz del SISTEMA o mediante correo electrónico. Aceptación tácita: La continuidad en el uso del SISTEMA tras la entrada en vigor de las modificaciones implicará la aceptación plena de los nuevos términos.',
      content: (
        <div className="space-y-3">
          <ul className="space-y-2.5">
            <li className="flex items-start gap-2">
              <span className="font-bold text-neutral-900 dark:text-neutral-100 shrink-0">• Actualizaciones del contrato:</span>
              <span>El TITULAR se reserva el derecho de modificar, actualizar o complementar las cláusulas del presente documento para adaptarlo a nuevas regulaciones legales, normativas tributarias o evoluciones arquitectónicas de la plataforma.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-neutral-900 dark:text-neutral-100 shrink-0">• Notificación de cambios:</span>
              <span>Cualquier modificación sustancial será informada al CLIENTE con un mínimo de quince (15) días de anticipación a través de la interfaz del SISTEMA o mediante correo electrónico.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-neutral-900 dark:text-neutral-100 shrink-0">• Aceptación tácita:</span>
              <span>La continuidad en el uso del SISTEMA tras la entrada en vigor de las modificaciones implicará la aceptación plena de los nuevos términos.</span>
            </li>
          </ul>
        </div>
      )
    },
    {
      id: 'CLAUSULA_15',
      number: '15',
      title: 'NULIDAD PARCIAL Y SUBSISTENCIA DE CLÁUSULAS',
      category: 'LEGAL',
      rawText: 'Si cualquier tribunal u organismo competente declarase nula, inválida o inejecutable alguna disposición del presente contrato, dicha nulidad afectará únicamente a la cláusula en cuestión. El resto de los términos y condiciones mantendrán su plena vigencia, fuerza vinculante y efectividad jurídica.',
      content: (
        <p>
          Si cualquier tribunal u organismo competente declarase nula, inválida o inejecutable alguna disposición del presente contrato, dicha nulidad afectará únicamente a la cláusula en cuestión. El resto de los términos y condiciones mantendrán su plena vigencia, fuerza vinculante y efectividad jurídica.
        </p>
      )
    },
    {
      id: 'CLAUSULA_16',
      number: '16',
      title: 'ACUERDO ÍNTEGRO Y NO RENUNCIA TÁCITA',
      category: 'GENERAL',
      rawText: 'Acuerdo íntegro: El presente documento, junto con el acuerdo privado aplicable suscrito conforme a la Cláusula 4 (de existir), constituye el acuerdo íntegro entre las partes respecto de su objeto, y deja sin efecto cualquier entendimiento, negociación o acuerdo previo, oral o escrito, sobre la misma materia. No renuncia tácita: La tolerancia del TITULAR frente a un incumplimiento del CLIENTE (incluyendo demoras en el pago o continuidad del servicio pese a la falta de suscripción de un plan) no se interpretará como renuncia a exigir el cumplimiento estricto de esta u otra cláusula en el futuro, ni como modificación de los términos aquí pactados.',
      content: (
        <div className="space-y-3">
          <ul className="space-y-2.5">
            <li className="flex items-start gap-2">
              <span className="font-bold text-neutral-900 dark:text-neutral-100 shrink-0">• Acuerdo íntegro:</span>
              <span>El presente documento, junto con el acuerdo privado aplicable suscrito conforme a la Cláusula 4 (de existir), constituye el acuerdo íntegro entre las partes respecto de su objeto, y deja sin efecto cualquier entendimiento, negociación o acuerdo previo, oral o escrito, sobre la misma materia.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-neutral-900 dark:text-neutral-100 shrink-0">• No renuncia tácita:</span>
              <span>La tolerancia del TITULAR frente a un incumplimiento del CLIENTE (incluyendo demoras en el pago o continuidad del servicio pese a la falta de suscripción de un plan) no se interpretará como renuncia a exigir el cumplimiento estricto de esta u otra cláusula en el futuro, ni como modificación de los términos aquí pactados.</span>
            </li>
          </ul>
        </div>
      )
    },
    {
      id: 'CLAUSULA_17',
      number: '17',
      title: 'DECLARACIÓN DE CONFORMIDAD Y RATIFICACIÓN',
      category: 'GENERAL',
      rawText: 'Al registrar una cuenta, acceder a la versión de prueba, contratar cualquiera de los planes de licenciamiento temporal (3, 6 o 12 meses), o al utilizar el SISTEMA bajo cualquier otra modalidad prevista en este documento, el CLIENTE declara haber leído, comprendido y aceptado en su totalidad las condiciones de licenciamiento, deslinde de responsabilidad y titularidad del software aquí detalladas, conforme al mecanismo de aceptación tácita por uso descrito en la Cláusula 1. Nota: conforme a la Cláusula 1, el presente contrato es válido y vinculante por la sola aceptación tácita derivada del uso del SISTEMA, sin que se requiera firma física, electrónica u holográfica. El siguiente bloque de firma se incluye únicamente para los casos en que el TITULAR solicite, o el CLIENTE decida voluntariamente otorgar, una suscripción formal adicional.',
      content: (
        <div className="space-y-3">
          <p className="font-medium text-neutral-900 dark:text-neutral-100">
            Al registrar una cuenta, acceder a la versión de prueba, contratar cualquiera de los planes de licenciamiento temporal (3, 6 o 12 meses), o al utilizar el SISTEMA bajo cualquier otra modalidad prevista en este documento, el CLIENTE declara haber leído, comprendido y aceptado en su totalidad las condiciones de licenciamiento, deslinde de responsabilidad y titularidad del software aquí detalladas, conforme al mecanismo de aceptación tácita por uso descrito en la Cláusula 1.
          </p>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 italic">
            Nota: conforme a la Cláusula 1, el presente contrato es válido y vinculante por la sola aceptación tácita derivada del uso del SISTEMA, sin que se requiera firma física, electrónica u holográfica. El siguiente bloque de firma se incluye únicamente para los casos en que el TITULAR solicite, o el CLIENTE decida voluntariamente otorgar, una suscripción formal adicional.
          </p>
        </div>
      )
    }
  ];"""

# Replace generalClauses
import re
pattern = re.compile(r"const generalClauses: ClauseSection\[\] = \[.*?\];\n\n  // 2\. Cláusulas del Acuerdo Privado", re.DOTALL)
content = pattern.sub(new_clauses + "\n\n  // 2. Cláusulas del Acuerdo Privado", content)

# Header updates
header_pattern = re.compile(r'<h1 className="text-2xl sm:text-3xl font-black text-neutral-900 dark:text-white uppercase tracking-tighter mb-4">.*?</h1>', re.DOTALL)
new_header = """<h1 className="text-2xl sm:text-3xl font-black text-neutral-900 dark:text-white uppercase tracking-tighter mb-4">
            {activeDocument === 'DERICK_PRIVATE'
              ? 'Acuerdo Privado y Exclusivo de Cortesía Comercial'
              : 'TÉRMINOS Y CONDICIONES DE USO Y LICENCIAMIENTO DE SOFTWARE'}
          </h1>"""
content = header_pattern.sub(new_header, content)

sub_pattern = re.compile(r'<p className="text-neutral-500 dark:text-neutral-400 text-sm font-medium mb-1">.*?</p>\n\s*<p className="text-neutral-400 dark:text-neutral-500 text-xs">.*?</p>', re.DOTALL)
new_sub = """<p className="text-neutral-500 dark:text-neutral-400 text-sm font-medium mb-1">
            {activeDocument === 'DERICK_PRIVATE'
              ? 'Documento confidencial, aplicable únicamente a la entidad especificada.'
              : 'Documento marco de aplicación general — Versión revisada'}
          </p>
          <p className="text-neutral-400 dark:text-neutral-500 text-xs">
            Última actualización: {activeDocument === 'DERICK_PRIVATE' ? 'Agosto 2026' : '22 de agosto de 2026'}
          </p>"""
content = sub_pattern.sub(new_sub, content)

note_pattern = re.compile(r'<p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed font-medium">.*?</p>', re.DOTALL)
new_note = """<p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed font-medium">
            {activeDocument === 'DERICK_PRIVATE'
              ? 'El presente documento es estrictamente confidencial y vinculante, y tiene por objeto dejar constancia de la titularidad y las condiciones operativas vigentes.'
              : 'Nota: este documento constituye la plantilla general de Términos y Condiciones aplicable a cualquier CLIENTE que licencie el SISTEMA, bajo el esquema estándar de período de prueba y planes de suscripción de 3, 6 o 12 meses. El TITULAR podrá, adicionalmente y a su discreción, otorgar planes especiales, promocionales o de cortesía mediante acuerdos privados con beneficiarios determinados, conforme a la Cláusula 4, los cuales no se publican ni se incorporan a este documento y no alteran su aplicación estándar frente a los demás CLIENTES.'}
          </p>"""
content = note_pattern.sub(new_note, content)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Updated successfully via python.")
