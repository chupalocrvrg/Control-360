import re

file_path = "src/components/TermsAndConditionsInfo.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

new_clauses = """const privateDerickClauses: ClauseSection[] = [
    {
      id: 'PRIV_CLAUSULA_1',
      number: '1',
      title: 'OBJETO DEL ACUERDO',
      category: 'OBJETO',
      rawText: 'El presente acuerdo tiene por objeto: (i) dejar constancia fidedigna del origen real del SISTEMA, delimitando el alcance de la solicitud informal que dio lugar al módulo inicial de registro de cheques, frente al desarrollo posterior realizado por iniciativa propia del TITULAR con orientación comercial; y (ii) precisar la naturaleza no laboral del acceso gratuito otorgado a la EMPRESA como plan de cortesía, conforme a la Cláusula 4 de los Términos y Condiciones Generales del SISTEMA, mientras subsista la relación laboral vigente entre las partes.',
      content: (
        <div className="space-y-3">
          <p>El presente acuerdo tiene por objeto:</p>
          <ul className="space-y-2 pl-2">
            <li className="flex items-start gap-2">
              <span className="font-bold text-indigo-600 dark:text-indigo-400 shrink-0">(i)</span>
              <span>Dejar constancia fidedigna del origen real del SISTEMA, delimitando el alcance de la solicitud informal que dio lugar al módulo inicial de registro de cheques, frente al desarrollo posterior realizado por iniciativa propia del TITULAR con orientación comercial; y</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-indigo-600 dark:text-indigo-400 shrink-0">(ii)</span>
              <span>Precisar la naturaleza no laboral del acceso gratuito otorgado a la EMPRESA como plan de cortesía, conforme a la Cláusula 4 de los Términos y Condiciones Generales del SISTEMA, mientras subsista la relación laboral vigente entre las partes.</span>
            </li>
          </ul>
        </div>
      )
    },
    {
      id: 'PRIV_CLAUSULA_2',
      number: '2',
      title: 'CARGO Y FUNCIONES DEL TITULAR DENTRO DE LA EMPRESA',
      category: 'LABORAL',
      rawText: 'El TITULAR desempeña dentro de la EMPRESA el cargo de Cobrador / Supervisor de Cartera, cuyas funciones se limitan a la gestión y supervisión de cobranzas y cuentas por cobrar. Las partes dejan expresa constancia de que dicho cargo, conforme consta en el contrato de trabajo vigente y en la descripción de funciones asociada al mismo, no incluye ni ha incluido en ningún momento el desarrollo, programación, mantenimiento, administración de sistemas informáticos, ni ninguna otra labor de naturaleza técnica o informática. En consecuencia, las partes reconocen que el diseño, programación y desarrollo del SISTEMA —incluido el módulo inicial de registro de cheques descrito en la Cláusula 3 y los módulos descritos en la Cláusula 4— no fue realizado por el TITULAR en cumplimiento de las funciones u obligaciones inherentes a su cargo, ni formó parte del objeto de su contrato de trabajo con la EMPRESA. Esta constancia resulta relevante a efectos de lo previsto en el Código Orgánico de la Economía Social de los Conocimientos, Creatividad e Innovación, cuya presunción de titularidad patronal sobre obras creadas por un trabajador se orienta a aquellas desarrolladas en cumplimiento de las funciones para las cuales dicho trabajador fue contratado.',
      content: (
        <div className="space-y-3">
          <ul className="space-y-2.5">
            <li className="flex items-start gap-2">
              <span className="font-bold text-neutral-900 dark:text-neutral-100 shrink-0">•</span>
              <span>El TITULAR desempeña dentro de la EMPRESA el cargo de Cobrador / Supervisor de Cartera, cuyas funciones se limitan a la gestión y supervisión de cobranzas y cuentas por cobrar. Las partes dejan expresa constancia de que dicho cargo, conforme consta en el contrato de trabajo vigente y en la descripción de funciones asociada al mismo, no incluye ni ha incluido en ningún momento el desarrollo, programación, mantenimiento, administración de sistemas informáticos, ni ninguna otra labor de naturaleza técnica o informática.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-neutral-900 dark:text-neutral-100 shrink-0">•</span>
              <span>En consecuencia, las partes reconocen que el diseño, programación y desarrollo del SISTEMA —incluido el módulo inicial de registro de cheques descrito en la Cláusula 3 y los módulos descritos en la Cláusula 4— no fue realizado por el TITULAR en cumplimiento de las funciones u obligaciones inherentes a su cargo, ni formó parte del objeto de su contrato de trabajo con la EMPRESA. Esta constancia resulta relevante a efectos de lo previsto en el Código Orgánico de la Economía Social de los Conocimientos, Creatividad e Innovación, cuya presunción de titularidad patronal sobre obras creadas por un trabajador se orienta a aquellas desarrolladas en cumplimiento de las funciones para las cuales dicho trabajador fue contratado.</span>
            </li>
          </ul>
        </div>
      )
    },
    {
      id: 'PRIV_CLAUSULA_3',
      number: '3',
      title: 'ORIGEN DEL SISTEMA Y DELIMITACIÓN DEL ALCANCE DE LA SOLICITUD INICIAL',
      category: 'PROPIEDAD',
      rawText: 'Las partes dejan constancia de que, en su origen, el TITULAR desarrolló una herramienta informal de registro de cheques por pagar (inicialmente en hoja de cálculo, con fórmulas básicas, y posteriormente con automatizaciones mediante Google Apps Script), a raíz de un comentario informal del representante de la EMPRESA orientado a sustituir el registro manual en libreta que se llevaba hasta ese momento. Las partes reconocen y acuerdan que dicha solicitud inicial se limitó, en su alcance, a la necesidad puntual de contar con un registro digital de cheques por pagar, y en ningún momento comprendió el encargo, instrucción o solicitud de desarrollo de un sistema ERP, de un producto de software comercializable, ni de los módulos adicionales descritos en el numeral siguiente. La solicitud inicial no estuvo acompañada de un contrato, orden de trabajo, ni compensación específica, ni definición alguna sobre titularidad de derechos de autor, y —conforme a lo señalado en la Cláusula 2— tampoco formó parte de las funciones, cargo o descripción de puesto del TITULAR dentro de la EMPRESA. El presente reconocimiento sobre el origen del módulo de registro de cheques no implica, por sí solo, cesión, renuncia expresa ni transferencia de derecho alguno a favor del TITULAR respecto de dicho módulo específico; su único efecto es dejar constancia fidedigna del alcance real de la solicitud original, a efectos de diferenciarlo del desarrollo descrito en la Cláusula 4.',
      content: (
        <div className="space-y-3">
          <ul className="space-y-2.5">
            <li className="flex items-start gap-2">
              <span className="font-bold text-neutral-900 dark:text-neutral-100 shrink-0">•</span>
              <span>Las partes dejan constancia de que, en su origen, el TITULAR desarrolló una herramienta informal de registro de cheques por pagar (inicialmente en hoja de cálculo, con fórmulas básicas, y posteriormente con automatizaciones mediante Google Apps Script), a raíz de un comentario informal del representante de la EMPRESA orientado a sustituir el registro manual en libreta que se llevaba hasta ese momento.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-neutral-900 dark:text-neutral-100 shrink-0">•</span>
              <span>Las partes reconocen y acuerdan que dicha solicitud inicial se limitó, en su alcance, a la necesidad puntual de contar con un registro digital de cheques por pagar, y en ningún momento comprendió el encargo, instrucción o solicitud de desarrollo de un sistema ERP, de un producto de software comercializable, ni de los módulos adicionales descritos en el numeral siguiente. La solicitud inicial no estuvo acompañada de un contrato, orden de trabajo, ni compensación específica, ni definición alguna sobre titularidad de derechos de autor, y —conforme a lo señalado en la Cláusula 2— tampoco formó parte de las funciones, cargo o descripción de puesto del TITULAR dentro de la EMPRESA.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-neutral-900 dark:text-neutral-100 shrink-0">•</span>
              <span>El presente reconocimiento sobre el origen del módulo de registro de cheques no implica, por sí solo, cesión, renuncia expresa ni transferencia de derecho alguno a favor del TITULAR respecto de dicho módulo específico; su único efecto es dejar constancia fidedigna del alcance real de la solicitud original, a efectos de diferenciarlo del desarrollo descrito en la Cláusula 4.</span>
            </li>
          </ul>
        </div>
      )
    },
    {
      id: 'PRIV_CLAUSULA_4',
      number: '4',
      title: 'DESARROLLO INDEPENDIENTE DEL SISTEMA COMO PRODUCTO COMERCIAL',
      category: 'PROPIEDAD',
      rawText: 'La EMPRESA reconoce y declara expresamente que, por iniciativa propia del TITULAR y sin mediar solicitud, encargo ni instrucción alguna de la EMPRESA, el TITULAR diseñó, programó y desarrolló los módulos de inventarios, presupuestos, avances, configuración, administración, asignación de roles, creación de usuarios, arquitectura multi-tenant, y demás funcionalidades del SISTEMA más allá del registro de cheques descrito en la Cláusula 3, en atención a necesidades operativas que el propio TITULAR identificó, y con una orientación explícita hacia su futura explotación comercial como producto de software independiente. Dicho desarrollo se realizó utilizando exclusivamente equipos informáticos, licencias de software, cuentas de servicios en la nube y demás herramientas de propiedad personal del TITULAR, fuera de la jornada laboral ordinaria, sin utilizar activos, credenciales, cuentas institucionales ni infraestructura de propiedad de la EMPRESA. En consecuencia, las partes reconocen que los módulos y funcionalidades descritos en este numeral no constituyen una obra creada por encargo ni un desarrollo realizado en cumplimiento de funciones laborales, por lo que la totalidad de los derechos de propiedad intelectual sobre ellos corresponden en exclusiva al TITULAR, conforme a la Cláusula 2 de los Términos y Condiciones Generales. El TITULAR podrá, a su discreción y como respaldo adicional de lo declarado en este numeral, conservar evidencia técnica tal como historial de control de versiones (Git), comprobantes de facturación de servicios en la nube (Firebase, Vercel, GitHub u otros) a su nombre personal, y registros de fecha/hora de despliegue, como elementos de prueba de la independencia y temporalidad de dicho desarrollo frente a la jornada laboral. Nota: este numeral no incluye una cesión formal de derechos por parte de la EMPRESA sobre el módulo de registro de cheques descrito en la Cláusula 3. En caso de que dicho módulo original se mantenga integrado como parte comercializable del SISTEMA, resulta recomendable gestionar en el futuro, mientras la relación con la EMPRESA se mantenga en buenos términos, una cesión o renuncia expresa adicional sobre ese componente específico, a efectos de eliminar por completo el riesgo residual que dicho origen conserva.',
      content: (
        <div className="space-y-3">
          <ul className="space-y-2.5">
            <li className="flex items-start gap-2">
              <span className="font-bold text-neutral-900 dark:text-neutral-100 shrink-0">•</span>
              <span>La EMPRESA reconoce y declara expresamente que, por iniciativa propia del TITULAR y sin mediar solicitud, encargo ni instrucción alguna de la EMPRESA, el TITULAR diseñó, programó y desarrolló los módulos de inventarios, presupuestos, avances, configuración, administración, asignación de roles, creación de usuarios, arquitectura multi-tenant, y demás funcionalidades del SISTEMA más allá del registro de cheques descrito en la Cláusula 3, en atención a necesidades operativas que el propio TITULAR identificó, y con una orientación explícita hacia su futura explotación comercial como producto de software independiente.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-neutral-900 dark:text-neutral-100 shrink-0">•</span>
              <span>Dicho desarrollo se realizó utilizando exclusivamente equipos informáticos, licencias de software, cuentas de servicios en la nube y demás herramientas de propiedad personal del TITULAR, fuera de la jornada laboral ordinaria, sin utilizar activos, credenciales, cuentas institucionales ni infraestructura de propiedad de la EMPRESA.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-neutral-900 dark:text-neutral-100 shrink-0">•</span>
              <span>En consecuencia, las partes reconocen que los módulos y funcionalidades descritos en este numeral no constituyen una obra creada por encargo ni un desarrollo realizado en cumplimiento de funciones laborales, por lo que la totalidad de los derechos de propiedad intelectual sobre ellos corresponden en exclusiva al TITULAR, conforme a la Cláusula 2 de los Términos y Condiciones Generales.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-neutral-900 dark:text-neutral-100 shrink-0">•</span>
              <span>El TITULAR podrá, a su discreción y como respaldo adicional de lo declarado en este numeral, conservar evidencia técnica tal como historial de control de versiones (Git), comprobantes de facturación de servicios en la nube (Firebase, Vercel, GitHub u otros) a su nombre personal, y registros de fecha/hora de despliegue, como elementos de prueba de la independencia y temporalidad de dicho desarrollo frente a la jornada laboral.</span>
            </li>
          </ul>
          <div className="bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg border border-amber-100 dark:border-amber-900/50 mt-4 text-xs text-amber-800 dark:text-amber-300">
            <strong>Nota:</strong> este numeral no incluye una cesión formal de derechos por parte de la EMPRESA sobre el módulo de registro de cheques descrito en la Cláusula 3. En caso de que dicho módulo original se mantenga integrado como parte comercializable del SISTEMA, resulta recomendable gestionar en el futuro, mientras la relación con la EMPRESA se mantenga en buenos términos, una cesión o renuncia expresa adicional sobre ese componente específico, a efectos de eliminar por completo el riesgo residual que dicho origen conserva.
          </div>
        </div>
      )
    },
    {
      id: 'PRIV_CLAUSULA_5',
      number: '5',
      title: 'NATURALEZA NO LABORAL DEL SERVICIO GRATUITO',
      category: 'LABORAL',
      rawText: 'El uso gratuito del SISTEMA por parte de la EMPRESA durante la vigencia de la relación laboral constituye una liberalidad y cortesía comercial otorgada por el TITULAR, revocable en cualquier momento con un preaviso razonable, y no genera derecho adquirido alguno a favor de la EMPRESA. Las partes declaran y acuerdan expresamente que este beneficio no constituye salario, remuneración adicional, bonificación, comisión, beneficio social, prestación en especie, ni ningún otro concepto de naturaleza laboral bajo el Código del Trabajo del Ecuador ni normativa conexa. En consecuencia, dicho beneficio no será considerado como parte integrante de la remuneración para efectos del cálculo de decimotercera y decimocuarta remuneración, vacaciones, fondos de reserva, aportes al IESS, indemnizaciones por despido intempestivo, desahucio, ni ningún otro rubro de carácter laboral. La EMPRESA renuncia expresamente a alegar, en cualquier instancia administrativa o judicial, que el uso gratuito del SISTEMA constituye una forma de retribución laboral encubierta.',
      content: (
        <div className="space-y-3">
          <ul className="space-y-2.5">
            <li className="flex items-start gap-2">
              <span className="font-bold text-neutral-900 dark:text-neutral-100 shrink-0">•</span>
              <span>El uso gratuito del SISTEMA por parte de la EMPRESA durante la vigencia de la relación laboral constituye una liberalidad y cortesía comercial otorgada por el TITULAR, revocable en cualquier momento con un preaviso razonable, y no genera derecho adquirido alguno a favor de la EMPRESA.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-neutral-900 dark:text-neutral-100 shrink-0">•</span>
              <span>Las partes declaran y acuerdan expresamente que este beneficio no constituye salario, remuneración adicional, bonificación, comisión, beneficio social, prestación en especie, ni ningún otro concepto de naturaleza laboral bajo el Código del Trabajo del Ecuador ni normativa conexa. En consecuencia, dicho beneficio no será considerado como parte integrante de la remuneración para efectos del cálculo de decimotercera y decimocuarta remuneración, vacaciones, fondos de reserva, aportes al IESS, indemnizaciones por despido intempestivo, desahucio, ni ningún otro rubro de carácter laboral.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-neutral-900 dark:text-neutral-100 shrink-0">•</span>
              <span>La EMPRESA renuncia expresamente a alegar, en cualquier instancia administrativa o judicial, que el uso gratuito del SISTEMA constituye una forma de retribución laboral encubierta.</span>
            </li>
          </ul>
        </div>
      )
    },
    {
      id: 'PRIV_CLAUSULA_6',
      number: '6',
      title: 'TERMINACIÓN DE LA RELACIÓN LABORAL',
      category: 'TRANSICION',
      rawText: 'Al momento en que finalice, por cualquier causa (renuncia, despido intempestivo, visto bueno, mutuo acuerdo, terminación de contrato a plazo fijo, o cualquier otra forma de terminación reconocida por la legislación laboral ecuatoriana), la relación laboral entre el TITULAR y la EMPRESA, el plan de cortesía aquí reconocido cesará de pleno derecho y de forma automática, sin necesidad de notificación previa, requerimiento judicial o extrajudicial. A partir de dicha terminación, el acceso de la EMPRESA al SISTEMA se regirá íntegramente por el esquema de transición, período de solo lectura y planes de suscripción comercial previstos en la Cláusula 4 de los Términos y Condiciones Generales del SISTEMA, sin que sea necesario suscribir un nuevo acuerdo para que dicho esquema resulte aplicable.',
      content: (
        <div className="space-y-3">
          <ul className="space-y-2.5">
            <li className="flex items-start gap-2">
              <span className="font-bold text-neutral-900 dark:text-neutral-100 shrink-0">•</span>
              <span>Al momento en que finalice, por cualquier causa (renuncia, despido intempestivo, visto bueno, mutuo acuerdo, terminación de contrato a plazo fijo, o cualquier otra forma de terminación reconocida por la legislación laboral ecuatoriana), la relación laboral entre el TITULAR y la EMPRESA, el plan de cortesía aquí reconocido cesará de pleno derecho y de forma automática, sin necesidad de notificación previa, requerimiento judicial o extrajudicial.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-neutral-900 dark:text-neutral-100 shrink-0">•</span>
              <span>A partir de dicha terminación, el acceso de la EMPRESA al SISTEMA se regirá íntegramente por el esquema de transición, período de solo lectura y planes de suscripción comercial previstos en la Cláusula 4 de los Términos y Condiciones Generales del SISTEMA, sin que sea necesario suscribir un nuevo acuerdo para que dicho esquema resulte aplicable.</span>
            </li>
          </ul>
        </div>
      )
    },
    {
      id: 'PRIV_CLAUSULA_7',
      number: '7',
      title: 'NO EXCLUSIVIDAD NI LIMITACIÓN A LA ACTIVIDAD COMERCIAL DEL TITULAR',
      category: 'COMERCIAL',
      rawText: 'El presente acuerdo no impone al TITULAR obligación de exclusividad alguna respecto de la EMPRESA. El TITULAR podrá ofrecer, comercializar, licenciar o desarrollar el SISTEMA o soluciones similares o derivadas para cualquier otra persona natural o jurídica, incluyendo competidores directos de la EMPRESA, sin restricción ni necesidad de autorización previa. Nada de lo aquí pactado limita la libertad del TITULAR para continuar su actividad profesional independiente de desarrollo de software fuera del horario y funciones correspondientes a la relación laboral vigente.',
      content: (
        <div className="space-y-3">
          <ul className="space-y-2.5">
            <li className="flex items-start gap-2">
              <span className="font-bold text-neutral-900 dark:text-neutral-100 shrink-0">•</span>
              <span>El presente acuerdo no impone al TITULAR obligación de exclusividad alguna respecto de la EMPRESA. El TITULAR podrá ofrecer, comercializar, licenciar o desarrollar el SISTEMA o soluciones similares o derivadas para cualquier otra persona natural o jurídica, incluyendo competidores directos de la EMPRESA, sin restricción ni necesidad de autorización previa.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-neutral-900 dark:text-neutral-100 shrink-0">•</span>
              <span>Nada de lo aquí pactado limita la libertad del TITULAR para continuar su actividad profesional independiente de desarrollo de software fuera del horario y funciones correspondientes a la relación laboral vigente.</span>
            </li>
          </ul>
        </div>
      )
    },
    {
      id: 'PRIV_CLAUSULA_8',
      number: '8',
      title: 'CONFIDENCIALIDAD DE LA INFORMACIÓN DE LA EMPRESA',
      category: 'PRIVACIDAD',
      rawText: 'El TITULAR se obliga a mantener estricta confidencialidad respecto de la información comercial, financiera y de clientes de la EMPRESA a la que tenga acceso en razón de la prestación del SISTEMA, absteniéndose de utilizarla para fines distintos a los propios de la operación, mantenimiento y soporte del SISTEMA, incluso después de finalizada la relación laboral y/o el presente acuerdo.',
      content: (
        <p>
          El TITULAR se obliga a mantener estricta confidencialidad respecto de la información comercial, financiera y de clientes de la EMPRESA a la que tenga acceso en razón de la prestación del SISTEMA, absteniéndose de utilizarla para fines distintos a los propios de la operación, mantenimiento y soporte del SISTEMA, incluso después de finalizada la relación laboral y/o el presente acuerdo.
        </p>
      )
    },
    {
      id: 'PRIV_CLAUSULA_9',
      number: '9',
      title: 'VIGENCIA Y ACEPTACIÓN',
      category: 'LEGAL',
      rawText: 'Las declaraciones y reconocimientos contenidos en las Cláusulas 2, 3, 4 y 5 de este documento (cargo y funciones del TITULAR, origen del sistema, desarrollo independiente y naturaleza no laboral del plan de cortesía) tienen carácter permanente y sobreviven a la terminación del presente acuerdo y de la relación laboral entre las partes, por constituir constancia de hechos y no una obligación de tracto sucesivo. Las demás disposiciones de este acuerdo se mantendrán vigentes mientras subsista el plan de cortesía aquí reconocido, rigiéndose en lo sucesivo por la Cláusula 4 de los Términos y Condiciones Generales del SISTEMA. Ambas partes declaran haber leído y comprendido el presente acuerdo y los Términos y Condiciones Generales del SISTEMA a los que se remite, y los suscriben en señal de conformidad. Aceptación tácita por uso: Sin perjuicio de la suscripción del presente acuerdo, las partes reconocen y acuerdan que el acceso, ingreso, operación o utilización del SISTEMA por parte de la EMPRESA, sus administradores, dependientes o cualquier persona autorizada por esta, implica de manera tácita la aceptación plena e irrestricta de la totalidad de las declaraciones, reconocimientos y condiciones establecidos en el presente acuerdo, así como de los Términos y Condiciones Generales del SISTEMA a los que este se remite. Dicha aceptación tácita por el uso resulta válida y exigible con independencia de que el presente documento cuente o no con firma física u holográfica, y opera desde el primer acceso de la EMPRESA al SISTEMA.',
      content: (
        <div className="space-y-3">
          <p>
            Las declaraciones y reconocimientos contenidos en las Cláusulas 2, 3, 4 y 5 de este documento (cargo y funciones del TITULAR, origen del sistema, desarrollo independiente y naturaleza no laboral del plan de cortesía) <strong>tienen carácter permanente y sobreviven a la terminación del presente acuerdo y de la relación laboral entre las partes</strong>, por constituir constancia de hechos y no una obligación de tracto sucesivo.
          </p>
          <p>
            Las demás disposiciones de este acuerdo se mantendrán vigentes mientras subsista el plan de cortesía aquí reconocido, rigiéndose en lo sucesivo por la Cláusula 4 de los Términos y Condiciones Generales del SISTEMA.
          </p>
          <p>
            Ambas partes declaran haber leído y comprendido el presente acuerdo y los Términos y Condiciones Generales del SISTEMA a los que se remite, y los suscriben en señal de conformidad.
          </p>
          <ul className="space-y-2.5">
            <li className="flex items-start gap-2">
              <span className="font-bold text-neutral-900 dark:text-neutral-100 shrink-0">• Aceptación tácita por uso:</span>
              <span>Sin perjuicio de la suscripción del presente acuerdo, las partes reconocen y acuerdan que el acceso, ingreso, operación o utilización del SISTEMA por parte de la EMPRESA, sus administradores, dependientes o cualquier persona autorizada por esta, implica de manera tácita la aceptación plena e irrestricta de la totalidad de las declaraciones, reconocimientos y condiciones establecidos en el presente acuerdo, así como de los Términos y Condiciones Generales del SISTEMA a los que este se remite. Dicha aceptación tácita por el uso resulta válida y exigible con independencia de que el presente documento cuente o no con firma física u holográfica, y opera desde el primer acceso de la EMPRESA al SISTEMA.</span>
            </li>
          </ul>
        </div>
      )
    }
];"""

# Replace in content
pattern = r"const privateDerickClauses: ClauseSection\[\] = \[\s*\{.*?\n  \];"
new_content = re.sub(pattern, new_clauses, content, flags=re.DOTALL)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(new_content)

print("Updated privateDerickClauses successfully.")
