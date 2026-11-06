# Módulo de Buró de Crédito: Política de Tolerancia de Mora y Control de Validación de Fechas

Plan de arquitectura y diseño para implementar la opción configurable de **tolerancia y perdón de mora** (hasta X días de atraso) y el **control desactivable del ajuste de fecha de vencimiento**, asegurando que los clientes tolerados se reporten 100% al día sin alterar su deuda total, y que las fechas incongruentes se deriven a revisión manual en el Libro de Rechazos.

---

### Decisiones Críticas Confirmadas por el Usuario

> [!IMPORTANT]
> Se han acordado los siguientes cuatro criterios rectores para el procesamiento de cartera en Buró de Crédito:

- **1. Fecha de Vencimiento Menor a Concesión (Regla 3):**
  - Se convierte en una opción **desactivable mediante casilla de verificación**.
  - Si no está activada o si no hay coincidencia en la base de cotejo, el registro se envía directamente al **Libro de Rechazos** (Hoja *FECHA DE VENCIMIENTO ERRONEA*) para revisión manual, sin inventar ni sumar años automáticamente en la cartera limpia.
- **2. Reclasificación Contable del Valor Perdonado:**
  - Cuando un cliente califica para el perdón ($\le X$ días de atraso), su saldo vencido se traslada íntegramente al saldo por vencer:
    $$\text{Nuevo } val\_xvencer = val\_xvencer + val\_vencido$$
  - Sus días de mora (`num_dias_vencido`) y cuotas vencidas pasan estrictamente a `0`, y su `val_vencido` pasa a `$0.00`.
  - La deuda total del sujeto se mantiene matemáticamente idéntica, reportándolo al día ante Equifax.
- **3. Umbral de Días de Tolerancia Configurable:**
  - Viene activable con valor predeterminado de **30 días**, con un campo numérico abierto para que el operador pueda digitar cualquier valor (ej. 15, 20, 30, 45 días).
- **4. Alineación de Morosidad para Clientes con Mora Mayor:**
  - Se mantiene la regla de seguridad de Equifax para clientes con atrasos que superen el umbral ($> X$ días): si registran valor vencido, deben tener al menos 1 día de mora para evitar rechazo por inconsistencia.

---

### 1. Visión General del Producto y Valor

- **Objetivo:** Brindar a la gerencia financiera y asesores de cobranza el control fino sobre la información que se transmite a Equifax, permitiendo proteger el score crediticio de clientes con retrasos operativos leves y evitando reportes erróneos por fechas mal ingresadas en el sistema origen.
- **Público Objetivo:** Analistas de crédito, administradores de cobranza y gerencia financiera de la empresa.
- **Beneficio Principal:** 
  1. Evita penalizar a clientes leales que se atrasaron por pocos días.
  2. Elimina la alteración silenciosa de fechas de contrato.
  3. Proporciona trazabilidad completa en el Libro de Rechazos y en la Auditoría de Fases.

---

### 2. Experiencia de Usuario y Diseño Visual

#### Panel de Configuración de Carga y Parámetros
En la vista principal de `Buro.tsx`, debajo de los parámetros de fecha de corte y código de empresa, se incorporará una nueva tarjeta de **Políticas de Cartera y Tolerancia** diseñada con alta densidad y micro-interacciones claras:

1. **Interruptor de Tolerancia de Mora:**
   - Control tipo switch o checkbox estilizado: *"Aplicar Política de Tolerancia / Poner al día mora leve"*.
   - Campo numérico adjunto: *"Atraso máximo tolerado:* `[ 30 ]` *días"*.
   - Texto informativo sutil: *"Los clientes con atraso menor o igual a este umbral reportarán $0.00 vencido y 0 días de mora, reclasificando el saldo a cartera por vencer."*
2. **Control de Ajuste de Fechas Incongruentes (Regla 3):**
   - Casilla de verificación: *"Permitir ajuste automático (+1 año) cuando Vencimiento sea menor a Concesión"*.
   - Estado por defecto: **Desmarcado**. Si está desmarcado, cualquier registro con fecha de vencimiento inconsistente saldrá de la base limpia y se archivará en la pestaña *FECHA DE VENCIMIENTO ERRONEA* del Libro de Rechazos para su corrección en el ERP.
3. **Auditoría Visual de Resultados:**
   - La pantalla de resultados de auditoría (Fase 8 y Fase 9) mostrará contadores específicos:
     - `Clientes perdonados / puestos al día: X registros ($ monto reclasificado)`.
     - `Fechas inconsistentes derivadas a rechazo: Y registros`.

```
┌────────────────────────────────────────────────────────────────────────┐
│  POLÍTICAS DE TOLERANCIA Y REGLAS DE CARTERA                           │
├────────────────────────────────────────────────────────────────────────┤
│  [✓] Aplicar tolerancia y poner al día clientes con mora leve           │
│      Atraso máximo tolerado: [  30  ] días                             │
│      ↳ Reclasifica valor vencido a valor por vencer (Días mora = 0)    │
│                                                                        │
│  [ ] Permitir ajuste forzado (+1 año) si Vencimiento < Concesión       │
│      ↳ Desactivado: Registros incongruentes van al Libro de Rechazos   │
└────────────────────────────────────────────────────────────────────────┘
```

---

### 3. Decisiones de Producto y Consideraciones Técnicas

| Aspecto | Enfoque Seleccionado | Justificación |
| :--- | :--- | :--- |
| **Punto de Ejecución de la Tolerancia** | En la Fase 8, justo antes o después de la validación de deuda, o como Fase dedicada 8.5 | Permite reclasificar los saldos de clientes vigentes antes de la Fase 9 de alineación de morosidad. |
| **Tratamiento del Libro de Rechazos** | Si el ajuste de +1 año está desactivado, el registro se excluye de la cartera limpia (`principalRecords`) y se almacena con su fecha original y motivo detallado en la hoja de rechazos. | Garantiza que no se reporte ninguna fecha ficticia a Equifax sin conocimiento del usuario. |
| **Persistencia de Parámetros** | Se guardan las preferencias (`toleranciaMoraActiva`, `diasTolerancia`, `autoAjusteAnioVencimiento`) en `localStorage` vinculadas a la empresa actual | Evita que el usuario deba reconfigurar los 30 días cada vez que ingresa al módulo. |

---

### 4. Arquitectura del Flujo de Datos

```
[ Archivo Fuente (.gjm / .xlsx) ]
               │
               ▼
   [ Fase 1 a 7: Mapeo, Limpieza y Formato ]
               │
               ▼
   [ Fase 8: Reglas Equifax ]
        ├── Regla 1: Fuera de Fecha de Corte ──> [ Rechazos ]
        ├── Regla 2: Clientes Sin Deuda ───────> [ Rechazos ]
        ├── Regla 3: Vencimiento < Concesión
        │      ├── ¿Base Cotejo? ──> Aplica fecha real
        │      ├── ¿Ajuste +1 año activo? ──> Corrige y conserva
        │      └── ¿Ajuste inactivo? ──────> [ Rechazos (Manual) ]
        ├── Regla 4: Antigüedad Express ───────> [ Rechazos ]
        └── Regla 5: Módulo 10 Cédulas ────────> [ Rechazos ]
               │
               ▼
   [ Fase 8.5: Política de Tolerancia de Mora ]
        ├── ¿Días mora <= Umbral (ej. 30)?
        │      ├── val_xvencer += val_vencido
        │      ├── val_vencido = 0
        │      ├── num_dias_vencido = 0
        │      └── num_cuotas_vencidas = 0
        └── ¿Días mora > Umbral?
               └── Conserva mora real intacta
               │
               ▼
   [ Fase 9: Alineación de Morosidad (para mora > Umbral) ]
               │
               ▼
   [ Fase 10: Exportación Cartera Limpia y Libro Rechazos ]
```

---

### 5. Archivos a Intervenir

1. `/src/lib/buroProcessor.ts`:
   - Extender la interfaz `BuroProcessorOptions` con:
     - `enableGracePeriod?: boolean`
     - `gracePeriodDays?: number`
     - `allowDateYearPatch?: boolean`
   - Modificar la **Regla 3** para respetar `allowDateYearPatch`.
   - Incorporar la etapa de reclasificación por tolerancia de mora.
   - Actualizar auditorías y estadísticas de retorno.
2. `/src/pages/Buro.tsx`:
   - Añadir los controles de interfaz para tolerancia (switch + input numérico) y ajuste de fecha.
   - Conectar los nuevos parámetros en `handleRunETL`.
   - Mostrar métricas de clientes perdonados en la interfaz de auditoría.
3. `/package.json` y `/src/lib/changelog.ts`:
   - Incrementar la versión del sistema y documentar los cambios.
