import { db } from '../firebase';
import { collection, getDocs, getDoc, setDoc, doc, deleteDoc } from 'firebase/firestore';

export interface ChangelogRelease {
  version: string;
  date: string;
  changes: string[];
  createdAt?: string;
}


export const staticChangelog: ChangelogRelease[] = [
  {
    version: "5.39.0",
    date: "2026-09-22",
    changes: [
      "Implementación obligatoria de números de serie en Ventas a Crédito: Se ha integrado la lógica de validación que obliga a seleccionar los números de serie si el artículo así lo requiere, con alertas visuales de estado.",
      "Desglose de Nombres (Apellidos y Nombres) en Comprobantes y Solicitudes: Se han separado los campos de nombre del cliente en Apellidos y Nombres en todos los formatos de impresión para mayor formalidad y cumplimiento legal.",
      "Ampliación de Datos en Solicitud de Crédito: Se añadieron campos de Lugar de Nacimiento, Nivel de Instrucción, Información de Arrendador (para vivienda alquilada) y Cargas Familiares al reporte imprimible.",
      "Optimización de Filtros en Cobranzas y Gestión de Cartera: Los registros marcados como ANULADO ahora se excluyen por defecto de los cálculos de KPI y de la visibilidad en las tablas de cartera y cobranza activa."
    ]
  },
  {
    version: "5.38.0",
    date: "2026-09-22",
    changes: [
      "Liquidación Automática de Deudas en Anulación: Implementación de lógica de cascada que anula automáticamente cuotas pendientes, registros de cobranza y restaura el cupo de crédito del cliente al eliminar una venta a crédito.",
      "Corrección de Contenido en Documentos PDF e Impresión: Resolución de error de 'hojas en blanco' mediante la optimización del motor de renderizado printUtils y la captura de estilos dinámicos, garantizando la fidelidad del documento descargado.",
      "Formalización Legal de Documentos y Reserva de Dominio: Actualización de Pagarés y Contratos de Compraventa con lenguaje legal estandarizado que incluye cláusulas de Reserva de Dominio y metadatos corporativos dinámicos (RUC, Dirección, Teléfono).",
      "Integración Unificada de Gestión de Clientes: Refactorización del catálogo de clientes para permitir su uso embebido dentro de los flujos de venta, facilitando el registro y edición inmediata de solicitantes sin interrumpir la operación comercial."
    ]
  },
  {
    version: "5.37.1",
    date: "2026-09-22",
    changes: [
      "Auditoría y Corrección de Integridad Transaccional: Revisión exhaustiva del sistema de ventas e inventario, garantizando fallback automático de creación de inventario si no existe registro previo y soporte unificado de campos 'stock' y 'quantity'.",
      "Reversión Completa de Stock y Series en Eliminación de Ventas: La anulación de ventas tanto a crédito como de contado con inventario ahora reintegra automáticamente las unidades y los números de serie a las bodegas y al catálogo maestro, generando el respectivo movimiento Kardex de reingreso.",
      "Optimización en Consultas Multi-Empresa y Búsqueda en Cartera: Soporte ampliado en consultas para coexistencia de 'enterpriseId' y 'userId', y capacidad de buscar ventas en cartera por el nombre de los artículos vendidos dentro del desglose de productos."
    ]
  },
  {
    version: "5.37.0",
    date: "2026-09-22",
    changes: [
      "Control y Selección de Números de Serie en Ventas a Crédito y Contado: Integración interactiva de selección de números de serie por bodega en ventas a crédito (NewCreditSaleModal) y contado (NewInventoryCashSaleModal), con conteo en tiempo real, selección manual con insignia y botón de auto-selección.",
      "Flexibilidad Operativa con Alertas de Regularización: Capacidad de concretar la venta de artículos aunque aún no tengan sus series registradas en el sistema, mostrando advertencias claras para permitir la facturación inmediata y el posterior ingreso o regularización de los seriales.",
      "Deducción Atómica y Registro en Kardex: Sincronización transaccional en Firestore que descuenta tanto el stock como la lista de series en bodega (warehouse_inventory) y en el catálogo maestro (articles), registrando simultáneamente el egreso físico en los movimientos de inventario."
    ]
  },
  {
    version: "5.36.4",
    date: "2026-09-22",
    changes: [
      "Permisos de Seguridad Firestore para Movimientos de Stock: Declaración y despliegue de reglas de acceso granular en Firestore para las colecciones 'stock_movements' e 'inventory_movements', subsanando el error de 'Missing or insufficient permissions' al recargar stock de artículos.",
      "Asignación de Autoría y Empresa en Transacciones de Ingreso: Vinculación explícita del UID de autenticación, empresa destino y creador en cada escritura atómica (artículo, bodega y movimiento), asegurando cumplimiento estricto de las reglas multi-empresa."
    ]
  },
  {
    version: "5.36.3",
    date: "2026-09-22",
    changes: [
      "Sincronización Automática de Bodega Destino en Recarga de Stock por Factura: Corrección del estado interno del selector de bodegas en el modal de ingreso, garantizando que la bodega seleccionada (o la bodega principal por defecto) se inicialice y valide de inmediato sin bloquear el guardado.",
      "Transacciones Atómicas de Inventario por Bodega: Migración del proceso de ingreso a runTransaction, garantizando el cálculo e incremento fiel tanto del stock total del artículo como del stock exclusivo de la bodega receptora.",
      "Soporte Opcional de Números de Serie: Inclusión de campo para registrar números de serie al ingresar lotes o artículos que requieren control de seriales."
    ]
  },
  {
    version: "5.36.2",
    date: "2026-09-22",
    changes: [
      "Préstamos Comerciales con Artículos en Stock Cero: Habilitación total para seleccionar artículos con stock en 0 en la modalidad de Préstamo (Ingreso de Mercadería), garantizando que las unidades prestadas se sumen al inventario de la bodega seleccionada.",
      "Validación Estricta en Devoluciones: Bloqueo activo de artículos con stock en 0 en la modalidad de Devolución (Egreso de Mercadería), impidiendo seleccionar ítems sin existencias físicas en la bodega y previniendo saldos negativos.",
      "Indicadores de Disponibilidad Contextual: Actualización de insignias visuales dinámicas en el selector predictivo ('Stock actual: 0 - Disponible para ingreso' en Préstamo vs 'Sin existencias' deshabilitado en Devolución) y visualización de unidades pendientes adeudadas por casa comercial."
    ]
  },
  {
    version: "5.36.1",
    date: "2026-09-21",
    changes: [
      "Ajuste y Depuración de Pestañas en Inventario: Remoción de las pestañas 'Transferencias' y 'Préstamos y Devoluciones' de la barra interna de navegación del módulo de Inventario, manteniendo un diseño limpio y enfocado exclusivamente en Catálogo de Artículos y Bodegas."
    ]
  },
  {
    version: "5.36.0",
    date: "2026-09-21",
    changes: [
      "Búsqueda Inteligente y Filtros Avanzados en Artículos: Se incorporó barra de búsqueda predictiva con filtros en tiempo real por Categoría, Marca, Condición de Stock (Estable, Bajo, Negativo) y Requiere Serie, permitiendo encontrar rápidamente cualquier ítem sin saturar la vista.",
      "Unificación de Submódulos de Inventario con Pestañas Internas Limpias: Integración fluida del catálogo de artículos, bodegas de almacenamiento, transferencias y préstamos comerciales bajo un mismo contenedor con barra de pestañas visualmente depurada y navegación inmediata.",
      "Creación Rápida de Artículos al Vuelo en Préstamos y Devoluciones: Habilitación de selector predictivo inteligente con botón '+ Crear Nuevo Artículo' directo desde el dropdown para registrar ítems inexistentes sin salir del flujo de trabajo.",
      "Depuración del Cuadro '¿Es Venta Directa?': Remoción completa de la casilla redundante en Préstamos y Devoluciones, estandarizando el ingreso o egreso de stock a través de bodegas físicas registradas con trazabilidad total."
    ]
  },
  {
    version: "5.35.1",
    date: "2026-09-21",
    changes: [
      "Búsqueda Predictiva Inteligente en Recarga de Stock: Reemplazo del selector rígido de artículos por un campo de búsqueda predictiva en tiempo real por nombre, marca, categoría o código de barras con menú desplegable flotante interactivo y selección instantánea."
    ]
  },
  {
    version: "5.35.0",
    date: "2026-09-20",
    changes: [
      "Protección y Reseteo Automático de Cupo de Crédito: Garantía estricta de que las ventas de contado no afectan el cupo del cliente. Restablecimiento automático y proporcional del cupo conforme se cobran cuotas o en un 100% al liquidar, anular o eliminar un crédito.",
      "Recarga de Stock e Ingreso con N° Factura de Compra: Incorporación de un botón de acción rápida 'Recargar Stock x Factura' en Inventarios > Artículos con registro del N° de factura de compra/proveedor, actualización atómica de existencias y trazabilidad de ingresos.",
      "Depuración del Submódulo Redundante 'Inventario > Ventas': Remoción completa de la ruta y menú lateral de ventas de inventario, canalizando todas las salidas comerciales de forma centralizada a través de 'Comercio > Ventas'.",
      "Exportación Dual de Cartera ('A la Fecha' y 'Adelantada'): Implementación del modal de exportación en 'Gestión de Carteras' con soporte para Cartera a la Fecha (saldos vencidos) y Cartera Adelantada con Selector de Fecha de Corte Futura, descargable en Excel (.xlsx) y PDF."
    ]
  },
  {
    version: "5.34.1",
    date: "2026-09-20",
    changes: [
      "Corrección de Reglas de Hooks de React: Se resolvió la llamada condicional a useEffect en `InventoryImportExportModal`, asegurando que todos los hooks se ejecuten en el orden estricto de renderizado antes de cualquier retorno temprano cuando el modal está cerrado."
    ]
  },
  {
    version: "5.34.0",
    date: "2026-09-20",
    changes: [
      "Fusión y Centralización de Clientes en Módulo 'Ventas': Se integró la gestión directa y creación de clientes en el módulo de Ventas con el botón 'Nuevo Cliente' y modal unificado, posicionando al cliente como el eje central operativo.",
      "Optimización de Búsqueda Predictiva de Ventas: El buscador interactivo con motor predictivo ahora se mantiene siempre accesible de forma reactiva e instantánea, eliminando la carga de listas masivas no solicitadas.",
      "Limpieza de Redundancias Arquitectónicas: Consolidación final de la migración de tarjetas de vendedores y metas hacia Presupuestos Mensuales (con selector desplegable de ventas reales), reduciendo el peso de la vista de Ventas."
    ]
  },
  {
    version: "5.33.0",
    date: "2026-09-20",
    changes: [
      "Unificación y Centralización del Módulo 'Ventas': Consolidación del módulo de Ventas con el cliente como eje central, optimizando la velocidad del sistema eliminando listas monolíticas masivas en favor de interacción y búsqueda instantánea.",
      "Integración de Acciones de Crédito en Búsqueda Predictiva: El buscador predictivo interactivo en cascada de Ventas ahora incorpora acciones directas para ventas a crédito: Cobro de cuotas/abonos ('Cobrar'), visualización e impresión de Pagaré a la Orden oficial, y Solicitud de Crédito de 1 hoja.",
      "Optimización de Rendimiento y Arquitectura Limpia: Reducción de carga computacional innecesaria al enfocar la pantalla en el buscador predictivo y los formularios de acción rápida (Ventas Manuales, Nueva Venta a Crédito, Nueva Venta Contado)."
    ]
  },
  {
    version: "5.32.1",
    date: "2026-09-20",
    changes: [
      "Mejora de Estilo y Relieve Visual en Cobranzas: Se incorporaron sombras suaves multicapa (`shadow-md`, `shadow-lg` con tinte tonal del color del botón), fondo diferenciado y sutil elevación (`hover:scale-105`) a los botones de acción de cada comprobante (Lupa/Ver, Lápiz/Editar y Basura/Revertir) para asegurar que resalten nítidamente en la tabla tanto en modo claro como oscuro."
    ]
  },
  {
    version: "5.32.0",
    date: "2026-09-20",
    changes: [
      "Reestructuración Operativa de Comercio > Cobranzas: Transformación integral de la vista de Cobranzas en un centro de operaciones conectado a créditos reales, con búsqueda predictiva, historial transaccional y métricas financieras en tiempo real.",
      "Búsqueda Inteligente de Deudas Activas (Botón '+'): Ventana modal para buscar deudores por Cédula/RUC, Nombre completo, Teléfono o Pagaré a la Orden, mostrando saldo pendiente y cuotas a vencer con acción directa 'Cobrar'.",
      "Soporte para Transferencias y Depósitos Bancarios: Incorporación del selector de medio de pago con opción '¿Es transferencia bancaria / depósito?', entidad bancaria dinámica (con bancos del sistema) y número de comprobante/referencia opcional en el cobro y en los comprobantes de pago (Térmico y A4).",
      "Control y Auditoría de Comprobantes de Cobro: Iconos integrados en la tabla para ver/reimprimir comprobantes (Lupa), editar observaciones/referencias/banco (Lápiz) y revertir/anular cobros erróneos restituyendo el cupo y saldo de cuotas (Basura).",
      "Botón 'Cobros Manuales' en Cobranzas: Acceso directo para registrar cobros manuales o directos en agencia sin crédito asociado.",
      "Duplicación a 'Comercio > Empleados > Presupuestos Mensuales': Nuevo botón 'Registrar cobro a presupuesto' para asentar cobros de ruta externa directamente en el cálculo de metas y comisiones de cobradores."
    ]
  },
  {
    version: "5.31.0",
    date: "2026-09-18",
    changes: [
      "Solución Definitiva a Impresión en Blanco: Reestructuración de la arquitectura de impresión mediante iframes aislados e independientes (printUtils), eliminando la supresión de estilos globales de React y garantizando impresión nítida e inmediata de Comprobantes de Cobro, Solicitud de Crédito, Pagarés a la Orden y Estados de Cuenta.",
      "Descarga Directa de Documentos en PDF: Integración nativa del botón 'Descargar PDF' en todos los modales de documentos oficiales para guardar y archivar copias digitales de alta resolución en un solo clic.",
      "Reimpresión Independiente en 'Clientes y Créditos': Incorporación de tres botones dedicados e independientes en la tabla de Cartera de Créditos para reimprimir de forma directa: 1) Solicitud de Crédito oficial de 1 hoja, 2) Pagaré a la Orden legal, y 3) Estado de Cuenta consolidado.",
      "Fechas de Pagos Cancelados en Estado de Cuenta: Nuevo 'Cronograma de Cuotas y Fechas de Cancelación' en el Estado de Cuenta (formato A4 y Ticket 80mm), detallando el historial de amortización con estado de cada cuota y la fecha exacta en que fue pagada."
    ]
  },
  {
    version: "5.30.1",
    date: "2026-09-18",
    changes: [
      "Corrección Crítica en Guardado de Clientes en Firestore: Solucionado el error 'Unsupported field value: undefined (found in field email/etc)' al crear o editar clientes mediante la función de sanitización recursiva `cleanFirestoreData` y valores predeterminados seguros para campos opcionales.",
      "Notificaciones Flotantes (Toast) de Confirmación: Reemplazo integral de los antiguos `alert()` del navegador por notificaciones flotantes animadas (`showToast`) con diseño moderno, confirmando con nombre propio el guardado exitoso del cliente y toda su información vinculada (crédito, laboral, cónyuge, referencias y garante).",
      "Validaciones Amigables sin Bloqueo: Mensajes flotantes de advertencia y guía rápida al validar campos obligatorios o formato de cédula/RUC sin interrumpir la experiencia del usuario."
    ]
  },
  {
    version: "5.30.0",
    date: "2026-09-18",
    changes: [
      "Botón 'Ventas Manuales' en Comercio > Ventas: Acceso directo y unificado para registrar ventas manuales/externas desde la pantalla de Ventas, replicando exactamente la funcionalidad del formulario de Presupuestos Mensuales para cumplimiento de metas sin alterar inventario de bodega.",
      "Impresión de Solicitud de Crédito y Datos del Cliente en 1 Hoja (A4): Nuevo documento oficial con diseño compacto y resumen ejecutivo que sintetiza los datos personales, laborales, referencias, cónyuge y garante del cliente, detalle de artículos comprados, condiciones de financiamiento (monto, cuotas, frecuencia, opciones de liquidación anticipada) y casilleros legales de firma.",
      "Doble Flujo de Impresión de Solicitud de Crédito: Posibilidad de imprimir la Solicitud de Crédito tanto en borrador previo a confirmar la venta (en el modal de Nueva Venta a Crédito) como posterior a su emisión (desde el modal del Pagaré y desde la tabla de ventas a crédito)."
    ]
  },
  {
    version: "5.29.0",
    date: "2026-09-18",
    changes: [
      "Reorganización del Módulo de Ventas & Presupuestos: Traslado de la gestión de ventas externas y manuales a Comercio > Empleados > Presupuestos.",
      "Modal de Venta Manual en Presupuestos: Registro ágil de ventas externas con el formulario clásico (Cliente, Artículo, Fecha, Tipo, Vendedor, ¿Incluye Moto?, Tipo Combustión/Eléctrica y Monto Total) con impacto 100% contable/financiero en las metas del vendedor sin afectar el inventario físico.",
      "Venta de Contado con Descuento Directo de Stock: En Comercio > Ventas, el registro de ventas al contado ahora selecciona productos de bodegas de inventario y descuenta existencias de forma atómica e inmediata.",
      "Purificación de Comercio > Ventas: Botones dedicados a ventas con inventario real (Venta Contado Stock y Venta Crédito Stock), preservando la visualización histórica completa de ventas previas.",
      "Auditoría y Trazabilidad: Registro formal de movimientos de stock con transacciones ACID para salidas directas de mercadería."
    ]
  },
  {
    version: "5.28.0",
    date: "2026-09-17",
    changes: [
      "Tramo 4 - Gestión Integral de Cartera Vencida y Mora 360°: Matriz de riesgo crediticio con categorización automática en 5 niveles regulatorios (Cat. A: Normal 0-30 días, Cat. B: Riesgo Potencial 31-60 días, Cat. C: Deficiente 61-90 días, Cat. D: Difícil Cobro 91-120 días, Cat. E: Castigada/Jurídica >120 días).",
      "Cálculo Dinámico de Indicador PAR > 30 (Portfolio At Risk): Monitoreo en tiempo real del saldo total de cartera en mora mayor a 30 días y porcentaje de riesgo sobre el activo crediticio.",
      "Cobranza Multicanal con WhatsApp Directo: Modal de mensajería con plantillas prediseñadas y personalizadas para Deudor y Garante Solidario con datos del pagaré, cuotas adeudadas, monto de liquidación y datos bancarios para depósito/transferencia.",
      "Bitácora de Acciones de Cobranza y Promesas de Pago: Registro formal de llamadas, visitas de campo y notificaciones por WhatsApp con seguimiento de promesas de pago, fechas de vencimiento de compromisos y cambio de estado.",
      "Estado de Cuenta y Certificado de Paz y Salvo Oficial: Generación e impresión en formato A4 y Ticket POS 80mm del historial integral de operaciones crediticias del cliente y emisión formal de finiquito con firmas autorizadas al saldar todas sus obligaciones.",
      "Exportación Ejecutiva a Excel (.xlsx): Reporte completo de cartera de crédito, clientes, garantes, días de atraso, mora devengada, saldos y calificación crediticia listo para auditoría y comités de crédito."
    ]
  },
  {
    version: "5.27.0",
    date: "2026-09-17",
    changes: [
      "Tramo 3 - Motor Integral de Cobranza de Cuotas y Abonos a Crédito: Amortización automática en orden de vencimiento y manual por cuota, con trazabilidad de saldo anterior, abono y saldo restante.",
      "Comprobante Oficial de Cobro Dual (Ticket 80mm & Documento A4): Generación instantánea de comprobantes de pago numerados (REC-YYYY-XXXXX) con datos del deudor, pagaré asociado, desglose de cuotas amortizadas y firmas.",
      "Liquidación Anticipada Inteligente: Ejecución de cancelaciones totales con aplicación de los descuentos preferenciales pactados en la venta a crédito.",
      "Liberación Dinámica de Cupo en Tiempo Real: Cada cobro o liquidación restituye de manera atómica el cupo crediticio del cliente en su ficha maestro.",
      "Pestañas de Cartera Activa e Historial de Recibos en Clientes y Créditos: Nueva navegación integrada con búsqueda de créditos, monitoreo de cuotas pendientes/vencidas, reimpresión de comprobantes y reversión transaccional en caso de anulación de pagos.",
      "Cobro Directo desde el Módulo de Ventas: Botón de cobro rápido en cada venta a crédito con apertura del formulario de recaudación e impresión inmediata de recibos."
    ]
  },
  {
    version: "5.26.0",
    date: "2026-09-17",
    changes: [
      "Tramo 2 - Motor Integral de Ventas a Crédito y Amortización: Emisión de ventas a crédito con cálculo automático de entrada/cuota inicial, saldo neto financiado, cuotas fijas y tabla de amortización por periodicidad (Semanal, Quincenal y Mensual).",
      "Liquidación Anticipada Inteligente (Smart Settlement): Configuración de condiciones y descuentos pactados por pronto pago (ej. liquidación antes de X meses con precio preferencial).",
      "Pagaré a la Orden con Validez Legal: Generación automática del título valor con numeración correlativa, cláusulas de vencimiento anticipado, tasas de mora legal, firmas de deudor y garante solidario.",
      "Impresión Dual Adaptativa: Soporte para formato ticket térmico de 80mm y formato formal de documento A4 con CSS Print limpio y sin dependencias externas pesadas.",
      "Integración Transaccional Atómica con Inventario y Cupos: Descuento inmediato de existencias físicas por bodega y serie, actualización de cupo consumido del cliente y sincronización con el historial general de ventas."
    ]
  },
  {
    version: "5.25.0",
    date: "2026-09-17",
    changes: [
      "Tramo 1 - Nuevo Módulo Centralizado 'Clientes y Créditos': Catálogo integral de clientes con soporte para clientes de Contado y Crédito con persistencia en tiempo real en Firestore.",
      "Validación de Cédula y RUC Ecuatoriano: Implementación de algoritmo oficial Módulo 10 con alerta preventiva interactiva y confirmación manual opcional para continuar.",
      "Ficha de Datos para Buró Equifax: Campos obligatorios de estado civil, cargas familiares (menores), fecha de nacimiento, educación, vivienda, referencias y empleador.",
      "Vinculación de Garante Solidario: Selección ágil de garantes solidarios a partir de la base de clientes registrados.",
      "Semáforo Visual de Cupo de Crédito: Monitoreo en tiempo real de cupo asignado, crédito en uso y saldo disponible."
    ]
  },
  {
    version: "5.24.3",
    date: "2026-09-13",
    changes: [
      "Generación y Restauración Completa de Iconos PWA: Regeneración limpia de todos los tamaños de iconos de aplicación (/pwa-192x192.png, /pwa-512x512.png, maskable y apple-touch-icon) basados en el logotipo oficial de Control Financiero 360°.",
      "Corrección de la Letra 'H' por Defecto en la Instalación del Navegador: Actualización del nombre oficial ('Control Financiero 360°') y short_name ('Control 360°') en el manifiesto PWA, eliminando el antiguo placeholder 'HQ Payments'.",
      "Inclusión de Favicon y Accesos Directos de Icono en HTML: Vinculación explícita de favicon.ico, apple-touch-icon y tamaños PWA estándar en el <head> de index.html para compatibilidad total con Chrome, Brave y Edge."
    ]
  },
  {
    version: "5.24.2",
    date: "2026-09-13",
    changes: [
      "Optimización Específica para Rastreador de WhatsApp: Reordenamiento de etiquetas <meta> al inicio absoluto del <head> para lectura prioritaria antes de scripts de aplicación.",
      "Inclusión de Formato JPEG Ultraligero (/public/og-image.jpg - 59 KB): Generación de versión JPEG optimizada para máxima compatibilidad con el límite estricto de peso y tiempo de respuesta de WhatsApp.",
      "Añadido de atributos prefix y og:locale (es_EC) para indexación y renderizado sin restricciones de caché."
    ]
  },
  {
    version: "5.24.1",
    date: "2026-09-13",
    changes: [
      "Configuración de Tarjetas de Vista Previa Social (Open Graph & Twitter Cards): Integración de metadatos optimizados para WhatsApp, X/Twitter, LinkedIn y Facebook.",
      "Generación de Banner de Alta Definición (/public/og-image.png): Miniatura vectorial nítida de 1200x630 px inspirada directamente en la identidad visual de la marca y comprimida a menos de 160 KB para carga instantánea.",
      "Vinculación con Dominio Vercel: Configuración de URL absoluta (https://control-de-cheques-060526.vercel.app/) asegurando que los rastreadores y aplicaciones de mensajería descarguen y muestren la miniatura sin fallos ni recortes."
    ]
  },
  {
    version: "5.24.0",
    date: "2026-09-13",
    changes: [
      "Migración Integral de Submódulos de Administración dentro de Configuración: Acceso unificado a Usuarios, Asignación/Migración, Respaldo Maestro, Versiones, Auditoría, Papelera y Notificaciones dentro de la pestaña 'Administración' en Configuración, sin duplicidades.",
      "Remoción del Módulo Admin de la Barra y Menús: El módulo y todos sus submódulos se movieron definitivamente dentro de Configuración, retirándolos de la barra lateral y accesos directos principales.",
      "Redirección Inteligente de Rutas: Cualquier enlace o acceso previo a /admin/* se redirige de forma transparente y fluida hacia su correspondiente subpestaña en /settings?tab=admin.",
      "Protección de Acceso Only Admin: Acceso estrictamente resguardado a nivel de vista y componente con bloqueo 404 para usuarios sin privilegios administrativos."
    ]
  },
  {
    version: "5.23.0",
    date: "2026-09-13",
    changes: [
      "Paginación Inteligente con Selector Dinámico (10 / 25 / 50 / 100): Implementación de particionado y renderizado optimizado en la Tabla Detallada de Clientes y en el Cruce de Asignaciones de Rutas.",
      "Navegación Rápida y Precisa: Controles de salto directo a Primera página, Anterior, Siguiente y Última página con indicador contextual de registros visibles vs universo global filtrado.",
      "Cálculos y Exportaciones 100% Globales e Intactos: Los totales del pie de tabla, tarjetas analíticas de flujo de caja y la exportación completa a Excel operan sobre el 100% del dataset filtrado, garantizando que la paginación no fragmente ni altere los totales financieros consolidados.",
      "Reset Reactivo de Paginación: Restablecimiento automático a la página 1 ante cualquier cambio de búsqueda, filtro de cobrador, rango de mora o selector de tamaño de página para evitar estados de vista vacíos."
    ]
  },
  {
    version: "5.22.0",
    date: "2026-09-13",
    changes: [
      "Tarjetas Analíticas de Flujo de Caja Exigible en Cartera: Visualización desglosada en la cabecera de la tabla con 'Meta Exigible Este Mes' ($), 'Cuotas Corrientes al Día' ($), 'Atrasos Exigibles (Mora)' ($) y 'Capital Futuro (2026-2027)' ($).",
      "Columna 'Exigible Mes ($)' en Tabla de Clientes: Incorporación de columna detallada por cliente indicando el valor líquido a cobrar en el mes en curso junto con su etiqueta de estado contextual.",
      "Integración de Métricas en el Pie de Tabla: Totalización diferenciada en el pie de tabla entre el Total Exigible del Mes y el Saldo Total a Largo Plazo de la cartera filtrada."
    ]
  },
  {
    version: "5.21.0",
    date: "2026-09-13",
    changes: [
      "Motor Financiero de Flujo de Caja (portfolioUtils): Diferenciación matemática entre el Saldo Total de Cartera (deuda global a largo plazo) y el Exigible Mensual Real según fecha de corte, fecha de venta y días de mora.",
      "Evaluación Precisa por Clasificación Financiera: Reglas de cálculo para 'EN_MORA' (Mora vencida + Cuota del mes), 'CUOTA_DEL_MES' (Cuota corriente), 'PRIMER_PAGO_FUTURO' (Periodo de gracia / Venta reciente) y 'PREPAGADO_ADELANTADO'.",
      "Soporte de Exigibilidad en Exportaciones Excel: Inclusión del estado y valor de exigibilidad del mes en las columnas analíticas enriquecidas de la exportación canónica."
    ]
  },
  {
    version: "5.20.0",
    date: "2026-09-13",
    changes: [
      "Integración del Módulo de Administración en Configuración: Reubicación de la gestión administrativa (usuarios, roles, permisos y notificaciones) como pestaña 'Administración' dentro de la vista de Configuración (/settings?tab=admin).",
      "Control Estricto de Seguridad y RBAC: Restricción absoluta de acceso para usuarios con rol 'admin', ocultando la pestaña y bloqueando rutas para usuarios regulares o cobradores.",
      "Redirección Transparente y Limpieza de Rutas: Mantenimiento de compatibilidad y centralización de la administración en un único punto de configuración del sistema."
    ]
  },
  {
    version: "5.19.0",
    date: "2026-09-13",
    changes: [
      "Estandarización Canónica de Exportación Excel (15 Columnas Estrictas): Todas las exportaciones a Excel de la cartera (Sectorización, Clientes Sin Cobrador, Recaudación y Abonos, Cruce y Asignaciones, y Auditoría de Transición) ahora generan exactamente las 15 columnas canónicas solicitadas en orden estricto (Fecha Venta, Cliente, Dirección, Entrada Pendiente, Articulo, Teléfono, Valor Venta, Abonos, Saldo, U.Pago, Valor U. Pago, Valor Cuota, Cuo, Días Mora, Valor Total Atraso).",
      "Columnas Enriquecidas al Extremo Derecho: Toda analítica calculada por el sistema (Tramo de Mora, Estado Asignación, Cobrador / Ruta, Tipo de Movimiento, etc.) se ubica a la derecha de las 15 columnas originales sin alterar el formato operativo de campo.",
      "Exportación Directa en Cruce de Asignaciones y Auditoría de Movimientos: Incorporación del botón de exportación Excel en la barra de filtros del Cruce de Asignaciones y en el modal de desglose de clientes de la Matriz de Transición.",
      "Utilidad Centralizada de Exportación (portfolioExportUtils): Módulo reutilizable que garantiza coherencia de anchos de columna, formato numérico financiero y paridad idéntica con el formato de subida de cartera."
    ]
  },
  {
    version: "5.18.0",
    date: "2026-09-13",
    changes: [
      "Conciliación y Reasignación Inteligente por Huella Cuádruple (Nombre + Fecha Venta + Ítem Vendido + Valor Venta): Al cargar la cartera de un cobrador específico sobre un corte o cartera existente, el sistema compara registro por registro y reasigna el cobrador sin inflar el total consolidado de la empresa.",
      "Actualización de Mora y Estados en Cascada: Al conciliar el cliente con la cartera del cobrador, se actualizan dinámicamente sus días de atraso, saldo vencido, valor de cuota y notas con los datos más recientes del archivo del cobrador.",
      "Reducción Progresiva de 'Sin Asignar': Los clientes identificados son transferidos de la bolsa de 'Sin Asignar / En Oficina' a la ruta del cobrador, manteniendo la integridad del universo total de clientes de la cartera global.",
      "Normalización Avanzada de Texto y Fechas: Algoritmo de comparación tolerante a acentos, espacios duplicados, formatos de fecha de Excel (números de serie o cadenas) y redondeos decimales para garantizar coincidencia exacta de ventas."
    ]
  },
  {
    version: "5.17.1",
    date: "2026-09-13",
    changes: [
      "Solución Definitiva al Límite de 1MB de Firestore (Error 1,048,576 bytes): Implementación de arquitectura de almacenamiento fragmentado (chunked subcollections) en subdocumentos de 'record_chunks' para portafolios y carteras de gran escala.",
      "Optimización de Carga y Lectura Reactiva: Los cortes de cartera ahora cargan sus metadatos de forma ultra-ligera en milisegundos, y obtienen los registros completos en paralelo bajo demanda al visualizar o cruzar carteras.",
      "Manejo de Memoria y Purga de Redundancias: Se eliminó la duplicación innecesaria de arreglos de clientes nuevos y clientes recuperados en el documento raíz, garantizando que el snapshot principal nunca exceda los límites de Firestore.",
      "Integridad y Limpieza en Cascada: Eliminación automática de fragmentos obsoletos y sanitización recursiva al actualizar, editar o borrar clientes o cortes de cartera."
    ]
  },
  {
    version: "5.17.0",
    date: "2026-09-13",
    changes: [
      "Modalidad de Carga Flexible de Cartera General: Incorporación del selector de modalidad en el importador de Excel, permitiendo cargar archivos globales de Cartera General y Cartera Maestra GADA sin necesidad de seleccionar un cobrador.",
      "Asignación Automática Multi-Cobrador desde Excel: El sistema ahora lee automáticamente el cobrador responsable de la columna 'Cobrador' o 'Ruta' de cada fila del archivo. Si un cliente no tiene cobrador o indica 'Oficina', se clasifica automáticamente como 'Sin Asignar / En Oficina'.",
      "Selector Directo de 'Cartera Maestra (GADA)': Añadido el tipo de corte 'Maestra' en la barra de selección rápida para agilizar la carga de carteras globales para la auditoría de cobertura en el Cruce de Asignaciones.",
      "Desbloqueo Inmediato de Zona de Carga: La zona de arrastre y selección de archivo Excel se habilita inmediatamente en modo Cartera General, eliminando cualquier bloqueo previo por falta de cobrador individual."
    ]
  },
  {
    version: "5.16.0",
    date: "2026-09-13",
    changes: [
      "Módulo y Pestaña 'Cruce y Asignación de Rutas': Nueva vista integral que compara la Cartera General Maestra de GADA (corte adelantado como 31/12/2026) contra los reportes de cobradores para auditar la cobertura operativa de rutas.",
      "Dashboard de Cobertura Tripartita: Métricas instantáneas de 'Total Cartera General', 'Clientes Asignados a Rutas' y 'Clientes Sin Asignar / En Oficina / Fugas' con montos capitales y porcentajes de cobertura.",
      "Diferenciación Estricta de Clientes 'Puestos Al Día' vs 'Liquidación Total Real': Integración de validación cruzada con la Cartera Maestra; los clientes que salen del reporte diario de mora pero continúan activos en la Maestra se clasifican como 'Puesto Al Día', mientras que solo quienes saldaron el 100% de su saldo y ya no existen en la Maestra califican como 'Liquidación Total Real'.",
      "Filtro Rápido de Asignaciones en Tabla y Cruce: Filtro interactivo ('TODOS', 'ASIGNADOS', 'SIN_ASIGNAR') con distintivos visuales en filas y distribución gráfica de cartera por cobrador.",
      "Exportación Contable de Clientes Sin Cobrador: Generación con un clic de reporte Excel especializado con todos los créditos sin cobrador asignado para reasignación de ruta o cobranza judicial."
    ]
  },
  {
    version: "5.15.1",
    date: "2026-09-12",
    changes: [
      "Extracción y Desglose de 'Valor Total Atraso': Se incorporó la lectura directa de la columna 'Valor Total Atraso' en el importador de Excel para distinguir el capital exigible vencido respecto al Saldo Capital total adeudado.",
      "Validación Temporal Estricta de Abonos por Fecha 'U.Pago': Se implementó la regla financiera donde un cliente solo califica como 'Abono Parcial' si su Saldo Capital disminuyó y la fecha registrada en 'U.Pago' está comprendida estrictamente dentro del rango de fechas entre la Cartera Base y la Cartera Actual.",
      "Cálculo de Recaudación por Diferencia de Saldos: El valor de efectivo ingresado a favor de la empresa se calcula con exactitud matemática mediante la disminución del Saldo Capital (Saldo Anterior - Saldo Actual).",
      "Estructuración de Columnas 1, 2 y 3 en Tabla y Reporte Excel: Visualización discriminada de Columna 1 (Saldo Capital Ant -> Act), Columna 2 (Valor Total Atraso en dólares junto a días de mora Ant -> Act) y Columna 3 (Abono Efectivo Recaudado), tanto en la interfaz interactiva como en la exportación contable a Excel."
    ]
  },
  {
    version: "5.15.0",
    date: "2026-09-12",
    changes: [
      "Huella Digital de 4 Factores (Identificación Unívoca): Implementación centralizada de la clave compuesta de 4 factores ('Cliente + Fecha de Venta + Artículo + Valor de Venta') y normalización de fechas ('parseDateToISO') para eliminar por completo la colisión de registros y permitir cargas múltiples de diferentes cobradores en una misma fecha sin sobreescrituras.",
      "Selector Dinámico de Cortes en 'Análisis de Recaudación y Abonos': La pestaña ahora permite comparar libremente cualquier Cartera Base (Anterior) contra cualquier Cartera Actual (A Evaluar), evaluando de forma inmediata los movimientos a favor de la empresa.",
      "Auditoría Diferenciada de Recuperación: Distinción matemática exacta entre 'Liquidación Total' (el crédito sale de cartera por cancelación total del saldo pendiente a $0.00) y 'Abono Parcial' (el cliente permanece en cartera con reducción comprobada de saldo o registro de pagos en el rango seleccionado).",
      "Métricas y Reporte Exportable Enriquecido: Cuatro tarjetas de KPI con desglose de Efectivo Recaudado, Liquidaciones y Abonos Parciales, además de exportación a Excel con columnas completas (Artículo, Fecha y Valor de Venta Original, Saldos Ant/Act, Valor de Abonos y Última Fecha de Pago)."
    ]
  },
  {
    version: "5.14.3",
    date: "2026-09-12",
    changes: [
      "Corrección de Cruce de Identidad y Clasificación de Abonos: Se eliminó el identificador temporal por fila ('OP-1', 'OP-2') que causaba que clientes con abonos parciales fueran erróneamente clasificados como 'Liquidación Total' por cambio de posición en el archivo Excel.",
      "Persistencia de Atributos de Recuperación: Se habilitó la persistencia completa de 'isPartialPayment', 'previousAmount' y 'previousOverdueDays' en Firestore para evitar que el estado se restableciera a liquidación al recargar.",
      "Consistencia de Métrica Saldo vs Atraso: Se prioriza el 'Saldo' capital como métrica contable uniforme en ambos cortes para detectar con exactitud la disminución de la deuda por abonos.",
      "Inferencia Resiliente de Abono Parcial en UI y Exportación: La tabla y los reportes de Excel ahora identifican y destacan con insignia ámbar los abonos parciales tanto en snapshots nuevos como en históricos."
    ]
  },
  {
    version: "5.14.2",
    date: "2026-09-12",
    changes: [
      "Lógica Avanzada de Recuperación Efectiva: El algoritmo ahora cruza matemáticamente la reducción de saldos. Se diferencia estrictamente entre 'Liquidación Total' y 'Abono Parcial'.",
      "Interfaz Analítica de Recaudación: La tabla de recuperación ahora expone visualmente el flujo exacto de la gestión con formato transicional (Atraso Ant -> Act, Deuda Ant -> Act).",
      "Validación de Fecha de Pago: Se integró la extracción y visualización de la 'Última F. Pago' en la tabla y en la exportación de reportes."
    ]
  },
  {
    version: "5.14.1",
    date: "2026-09-12",
    changes: [
      "Evolución a Módulo de Análisis de Recaudación y Abonos: El algoritmo comparativo de cortes de cartera ahora detecta inteligentemente tanto liquidaciones totales (desaparecidos) como abonos parciales, contrastando las reducciones de capital entre el archivo importado y la base vigente.",
      "Ampliación del Parser de Importación Excel: Integración nativa de las columnas 'Entrada Pendiente', 'Abonos (Total)', 'Valor Venta' y 'Nro. Cuota', extrayendo su valor para cálculos e historial.",
      "Columna 'Venta & Pagos' en Cartera: Nueva columna visible (en pantallas grandes) que desglosa en línea el Valor de la Venta, Abonos Acumulados, Entrada Pendiente y el Valor de la Cuota con su número correspondiente.",
      "Exportación de Reportes Enriquecida: Los reportes de Excel de la cartera sectorizada y de la recaudación ahora incluyen columnas de análisis expandidas para un cruce financiero exacto (Fecha Venta, Total Abonos, Entrada Pendiente, etc.)."
    ]
  },
  {
    version: "5.14.0",
    date: "2026-09-08",
    changes: [
      "Módulo Exclusivo de Respaldo Maestro Global Multiempresa: Implementación en el Panel de Administración (Superadmin) de una herramienta técnica de contingencia (Disaster Recovery) para exportar e importar la base de datos íntegra de la plataforma consolidando todas las organizaciones registradas.",
      "Exportación Global Multi-Colección y Detección de Tenants: Extracción sin restricciones de inquilino de las colecciones operativas y estructurales (usuarios, empresas, empleados, cheques, ventas, cobranzas, cartera, presupuestos e inventarios) con metadatos de auditoría y catálogos en formatos JSON estructurado y Excel multi-hoja.",
      "Importación con Auditoría Previa y Asignación Automática por Empresa: Análisis inteligente pre-restauración con desglose de empresas detectadas y volumen de registros, verificación en dos pasos (PIN de Superadmin y frase de seguridad tipográfica manual) y fusión segura por lotes (upsert/merge de 250 documentos) preservando estrictamente el enterpriseId de cada registro.",
      "Diagnóstico Global en Tiempo Real y Navegación Dedicada: Tarjetas con métricas en vivo de empresas registradas, usuarios, egresos y cortes históricos, enlace directo desde la configuración de respaldo y registro formal de auditoría institucional."
    ]
  },
  {
    version: "5.13.0",
    date: "2026-09-08",
    changes: [
      "Resumen de Evolución de Cartera en Tarjetas del Dashboard: Visualización compacta en la tarjeta de cada cobrador con métricas de Cartera Inicio vs. Cartera Cierre, variación neta/recuperada ($ y %), desglose al día (0-30 d) vs. vencida (>30 d) y panel desplegable con la comparativa por tramos de mora (0, 1-30, 31-60, 61-90, 91-180, >180 días).",
      "Continuación en Reporte General - Balance y Evolución de Cartera: Inclusión de la tabla 'Evolución de Cartera por Cobrador (Inicio de Mes vs. Fin de Mes)' a continuación de 'Balance de Cobranzas por Cobrador', incorporando montos de inicio, fin, recuperación, variación porcentual, tramos de morosidad y totales generales consolidados.",
      "Previsualización Interactiva en Pantalla y Exportación Unificada: Soporte completo para previsualizar ambas tablas en pantalla dentro del modal de reporte antes de exportar, con exportaciones idénticas e inmediatas a PDF y Excel.",
      "Determinación Automática de Cortes Mensuales: Aplicación de la regla de cortes automáticos, tomando el primer corte cargado del mes (o corte inicial marcado) como Inicio de Mes y el último corte subido como Fin de Mes."
    ]
  },
  {
    version: "5.12.0",
    date: "2026-09-07",
    changes: [
      "Matriz de Transición y Flujo Completo de Carteras (Inicio vs. Cierre): Nueva visualización cruzada que audita el movimiento de todos los tramos de mora (0 días, 1-30, 31-60, 61-90, 91-180, >181), identificando clientes retenidos, mejorados, deteriorados y recuperados/al día.",
      "Selector Dinámico por Fechas de Corte Subidas: Calendario y rango interactivo para comparar cualquier corte de origen y destino cargado en el sistema, agrupando automáticamente a todos los cobradores con cartera en esa fecha específica.",
      "Aislamiento de Supervisores en Asignación de Cartera: Exclusión estricta de supervisores (por rol del sistema y cargo/posición laboral) de las listas de asignación operativa, consolidando a la vez sus totales globales.",
      "Estandarización y Redondeo de Decimales (round2): Normalización matemática a 2 decimales en importación Excel, edición manual, agregaciones de cobradores y guardado en Firestore.",
      "Lanzador Robusto de Cobro por WhatsApp: Apertura optimizada compatible con WhatsApp Web y Aplicación de Escritorio con fallback y botón de copia directa de enlace."
    ]
  },
  {
    version: "5.11.1",
    date: "2026-09-07",
    changes: [
      "Optimización de Visualización y Espaciado con Dock Flotante: Se corrigió la superposición del dock de navegación sobre el pie de tabla (tfoot) de Clientes Recuperados y Cartera Filtrada mediante la ampliación del espaciado inferior (pb-48/pb-56 en Layout y pb-48 en PortfolioManagement).",
      "Rediseño y Realce de Celdas de Totales (tfoot): Se incrementó el padding vertical (py-4.5) y se aplicaron estilos de alto contraste en el Total de Capital Recuperado, montos destacados y conteos de clientes regularizados.",
      "Separación Estructural en Tablas de Cartera: Margen inferior dedicado en las tarjetas de tabla para asegurar una visibilidad y lectura 100% despejada en cualquier posición de dock y dispositivo móvil."
    ]
  },
  {
    version: "5.11.0",
    date: "2026-09-07",
    changes: [
      "Categoría Especial '0 Días (Al Día / Por Vencer)': Incorporación del tramo de 0 días de atraso en métricas principales, desglose por cobradores y filtros de tabla para clientes con fecha de corte adelantada o vencimiento en el día.",
      "Integración de Cobro Directo por WhatsApp: Generador dinámico de mensajes de cobro personalizados según los días de mora (al día, mora temprana, regularización o mora crítica), con formato para números de Ecuador (+593), edición previa al envío y enlaces directos a WhatsApp Web / App.",
      "Ampliación del Parser y Columnas de Cartera: Detección y visualización de columnas de Celular, Artículo / Ítem Vendido y Dirección domiciliaria desde el archivo Excel y formulario manual.",
      "Filtrado Estricto de Cabeceras: Se robusteció la detección de filas de encabezado para evitar que palabras reservadas o títulos como 'Cliente' se importen como nombres de clientes.",
      "Ordenamiento Multimétrico en Tabla: Controles dinámicos y encabezados interactivos para ordenar la cartera por Días de Mora, Monto de Saldo o Nombre de Cliente (ascendente y descendente)."
    ]
  },
  {
    version: "5.10.1",
    date: "2026-09-07",
    changes: [
      "Corrección de Guardado en Firestore: Se solucionó el error 'Function addDoc() called with invalid data. Unsupported field value: undefined' al registrar snapshots de cartera sin snapshot previo o con campos opcionales no definidos.",
      "Sanitización Integral de Objetos Firestore: Implementación de la función 'sanitizeForFirestore' para purificar y nullificar de forma recursiva cualquier campo undefined antes de ejecutar operaciones addDoc y updateDoc en portfolio_snapshots.",
      "Normalización de Interfaces de Cartera: Actualización de PortfolioSnapshot en tipos y blueprint para permitir valores null en previousSnapshotId y collectorName."
    ]
  },
  {
    version: "5.10.0",
    date: "2026-09-07",
    changes: [
      "Control de Cortes por Fecha y Prevención de Duplicidad: Se implementó la selección y registro de cartera por 'Fecha de Corte' exacta, evitando que las carteras subidas se sumen de forma errónea o imprecisa.",
      "Comparación Inteligente por N° de Operación: Algoritmo de contraste automatizado contra el corte inmediatamente anterior para clasificar clientes continuos, nuevos en mora y clientes recuperados.",
      "Nueva Pestaña 'Clientes Recuperados / Al Día': Sección dedicada con métricas de capital recuperado, desglose por cobrador, búsqueda en tiempo real y exportación de clientes saneados a Excel.",
      "Vista Global Consolidada para Supervisores: Detección de rol de supervisor con conmutador 'Global Consolidada' / 'Individual', tabla ejecutiva de participación de cobradores y sumatorias corporativas de morosidad sin duplicaciones."
    ]
  },
  {
    version: "5.9.3",
    date: "2026-09-07",
    changes: [
      "Filtro Estricto de Cobradores de la Empresa: En los selectores de asignación y carga de cartera (modal Excel y creación manual) ahora solo se muestran los cobradores y colaboradores efectivamente registrados en la empresa activa, eliminando las rutas y nombres de ejemplo previos.",
      "Plantilla Excel Dinámica: La generación y descarga del archivo de plantilla de cartera ahora incorpora automáticamente los nombres de los cobradores registrados en la empresa.",
      "Limpieza de Opciones Ficticias: Eliminación total de rutas estáticas de prueba ('Ruta Externa 1 - José Hidrobo', 'Ruta Externa 2 - Darwin Lema', 'Almacén') en los listados y estadísticas de cartera."
    ]
  },
  {
    version: "5.9.2",
    date: "2026-09-07",
    changes: [
      "Corrección de Permisos Firestore: Adición y despliegue de las reglas de seguridad para la colección 'portfolio_snapshots', resolviendo el error 'Missing or insufficient permissions' al consultar o guardar cortes de cartera.",
      "Definición en Blueprint: Registro de la entidad PortfolioSnapshot en firebase-blueprint.json para validación esquemática y tipado consistente.",
      "Endurecimiento de Manejo de Errores: Integración de handleFirestoreError en todas las operaciones asíncronas de cartera y alineación de registros de auditoría con la acción PORTFOLIO_UPDATE."
    ]
  },
  {
    version: "5.9.1",
    date: "2026-09-07",
    changes: [
      "Optimización de Carga de Cartera: Implementación de selector obligatorio de cobrador antes de la importación de Excel.",
      "Parser de Excel Inteligente: Adaptación del motor de lectura para el formato 'Reporte de Cobros de Cuotas', mapeando automáticamente Cliente, Saldo, Días Mora, Artículo y Dirección.",
      "Lógica de Adición de Registros: El sistema ahora permite acumular múltiples cargas de diferentes cobradores en el mismo mes sin sobreescribir datos previos."
    ]
  },
  {
    version: "5.9.0",
    date: "2026-09-07",
    changes: [
      "Módulo de Gestión y Sectorización de Carteras: Se implementó la nueva sección 'Gestión de Carteras' dentro del menú Comercio para cargar y clasificar clientes por tramos de mora (0-30, 31-60, 61-90, 91-180, >181 días).",
      "Carga Masiva desde Excel con Plantilla: Integración de lector flexible de archivos .xlsx / .xls con generador de plantilla descargable formateada de ejemplo.",
      "Análisis por Cobrador y Ruta: Sectorización detallada por rutas (Ruta Externa 1 - José Hidrobo, Ruta Externa 2 - Darwin Lema, Almacén, etc.) con métricas de capital y número de clientes.",
      "Evaluación Inicio vs. Cierre de Mes: Sistema de cortes mensuales (snapshots) para medir retención de clientes al día y tasa de recuperación de cartera por cobrador."
    ]
  },
  {
    version: "5.8.13",
    date: "2026-09-05",
    changes: [
      "Eliminación de Consultas Públicas: Se ha retirado el módulo experimental de consultas públicas para mantener la integridad de la interfaz."
    ]
  },
  {
    version: "5.8.12",
    date: "2026-09-05",
    changes: [
      "Persistencia de Aceptación de Términos: Se optimizó el flujo de aceptación de términos en Firestore para asegurar que la modal solo aparezca una vez por usuario.",
      "Portal de Consultas Públicas: Nueva sección integrada en el módulo de Comercio para acceso directo a portales gubernamentales de consulta (ANT, ATM, Registro Civil, IESS, etc.)."
    ]
  },
  {
    version: "5.8.11",
    date: "2026-09-01",
    changes: [
      "Reporte Comercial Avanzado - Desglose de Motos (Combustión vs. Eléctricas): Se implementó la discriminación detallada de motos a combustión y eléctricas en unidades y montos tanto para ventas al contado como a crédito en el Cuadro 2.",
      "Flujo Continuo de Tablas en Reporte: Se eliminó el salto de página forzado en PDF para que 'Balance de Ventas por Vendedor' y 'Balance de Cobranzas por Cobrador' fluyan inmediatamente después de 'Cuadro 2: Reporte General de Ventas'.",
      "Unificación de Hoja en Excel: En la exportación a Excel, todas las tablas principales se organizan secuencialmente en la hoja 'Reporte General' con el desglose detallado de tecnología de motocicletas."
    ]
  },
  {
    version: "5.8.10",
    date: "2026-09-01",
    changes: [
      "Navegación Rápida al Dashboard desde el Logo: Se convirtió el botón del logo principal (Control 360°) en la barra Dock y en la cabecera móvil en un enlace directo e interactivo hacia el Dashboard."
    ]
  },
  {
    version: "5.8.9",
    date: "2026-09-01",
    changes: [
      "Bloqueo y Validación por PIN en Configuración: Se implementó un escudo de seguridad con verificación de PIN transaccional de 6 dígitos para acceder al módulo de Configuración.",
      "Identificación Fiscal Dinámica (Cédula / RUC): En Configuración > General se integró un selector entre Cédula (validación estricta de 10 dígitos numéricos) y RUC (validación estricta de 13 dígitos numéricos terminados obligatoriamente en 001).",
      "Visualización de Correo Principal en Solo Lectura: Se añadió el campo informativo de correo electrónico vinculado protegido contra modificaciones accidentales."
    ]
  },
  {
    version: "5.8.8",
    date: "2026-09-01",
    changes: [
      "Implementación de modal de éxito: Al finalizar el procesamiento de Equifax, se muestra un modal centrado con el mensaje de éxito y la advertencia obligatoria sobre la revisión manual y el uso de la macro externa, reemplazando el mensaje lateral previo."
    ]
  },
  {
    version: "5.8.5",
    date: "2026-09-01",
    changes: [
      "Limpieza de datos en reporte Equifax: Las columnas REPORTADO y FACTURAS_PAGADAS ahora se generan vacías (en blanco) para cumplir con los estándares de validación de Equifax, eliminando el valor por defecto '0' que causaba rechazos."
    ]
  },
  {
    version: "5.8.4",
    date: "2026-08-29",
    changes: [
      "Corrección de Ambigüedad de Columnas: Se refinó el buscador de encabezados para evitar que 'cod_tipo_id' sea confundido con la columna de identificación real 'cod_id_sujeto'.",
      "Priorización de Etiquetas Técnicas: El sistema ahora prioriza nombres de columnas largos y específicos de Equifax antes de intentar con nombres cortos genéricos.",
      "Lógica de Rescate de ID: Se añadió una política de reversión que busca columnas alternativas si la primera opción no contiene valores numéricos válidos."
    ]
  },
  {
    version: "5.8.3",
    date: "2026-08-29",
    changes: [
      "Corrección Crítica de Lectura de Excel: Implementación de detección inteligente de hojas (Sheet Picker) que selecciona automáticamente la pestaña con datos (ej. 'DATOS') ignorando hojas vacías.",
      "Soporte de Fechas Nativas: Integración de 'cellDates' para reconocer objetos de fecha nativos de Excel y números de serie seriales, evitando el rechazo de registros por formato de fecha.",
      "Preservación de Cero Inicial: Mejora en el procesamiento de identificaciones para asegurar que las cédulas mantengan sus 10 dígitos (padding) incluso si Excel las entrega como números.",
      "Manejo de Nulos: Estabilización del procesamiento para ignorar celdas nulas sin romper la cadena de validación."
    ]
  },
  {
    version: "5.8.2",
    date: "2026-08-29",
    changes: [
      "Optimización de la Base de Cotejo: Compatibilidad total con la estructura técnica oficial de Equifax (cod_id_sujeto, fec_vencimiento, val_operacion).",
      "Buscador Inteligente de Columnas: Mejora en el reconocimiento de encabezados para permitir el uso de archivos exportados por el mismo sistema como base de referencia sin errores de lectura.",
      "Extracción Enriquecida de Datos: Ahora la base de cotejo también captura montos y fechas de concesión para una validación cruzada más robusta."
    ]
  },
  {
    version: "5.8.1",
    date: "2026-08-29",
    changes: [
      "Aviso de Seguridad y Responsabilidad en Macro VBA: Incorporación de un banner informativo destacando el carácter experimental de la ejecución de macros y recomendando el procedimiento oficial en Excel local.",
      "Descargo de Responsabilidad (Disclaimer): Nota explícita sobre el uso bajo riesgo del cliente en la herramienta experimental de interpretación VBA."
    ]
  },
  {
    version: "5.8.0",
    date: "2026-08-29",
    changes: [
      "Motor Dinámico de Macro Equifax (VBA): Implementación de un editor interactivo para pegar directamente el código VBA de Excel suministrado por Equifax, procesándolo de forma interna sin requerir cambios en el código fuente.",
      "Persistencia en Firestore de la Macro VBA: Almacenamiento seguro y multiempresa del script VBA personalizado en la colección buro_macro_configs con nombre de versión y control de activación/desactivación.",
      "Analizador & Intérprete Inteligente: Detección automática de delimitadores (;, |, ,, tab), extensión (.gjm, .txt, .csv), columnas oficiales, transformaciones de texto y formato numérico/fecha.",
      "Previsualización & Simulación en Tiempo Real: Capacidad de probar el código VBA con registros de prueba antes de guardarlo o aplicarlo a la cartera.",
      "Integración Transparente en Descargas: El archivo plano final se genera aplicando fielmente la lógica de la macro configurada por el usuario."
    ]
  },
  {
    version: "5.7.0",
    date: "2026-08-28",
    changes: [
      "Reestructuración y Unificación de Carga con Base de Cotejo (Regla 3): El cuadro superior de carga principal ha sido reemplazado íntegramente por el componente de gestión de Base de Cartera y Cotejo persistente en Firestore.",
      "Carga Directa a la Nube: Al arrastrar o seleccionar archivos (.xlsx, .gjm, .csv), estos se almacenan automáticamente en Firestore y quedan activados de inmediato para el procesamiento de cartera.",
      "Optimización del Panel de Parámetros: Eliminación de la sección redundante de cotejo en la cuadrícula inferior, consolidando un esquema limpio de 3 columnas (Código Equifax, Fecha de Corte y Límite de Antigüedad).",
      "Sincronización Total de Cartera & Cotejo: La base activa en la nube suministra automáticamente los registros y datos de vencimiento para la ejecución de las 10 fases ETL de Equifax."
    ]
  },
  {
    version: "5.6.0",
    date: "2026-08-28",
    changes: [
      "Parámetro Obligatorio de Código de Empresa / Negocio Equifax: Incorporación de una nueva casilla de configuración en la primera columna del panel de parámetros para ingresar el código asignado por Equifax (ej. 2968).",
      "Persistencia Automática entre Sesiones: El código de empresa se guarda localmente por empresa/cuenta para no tener que configurarlo en cada inicio de sesión.",
      "Bloqueo de Validación y Procesamiento: Si el código de negocio no ha sido establecido, el botón y pipeline de procesamiento permanecen estrictamente deshabilitados con advertencia visual.",
      "Nomenclatura Dinámica de Archivos Exportados: Integración del código ingresado en los nombres de salida del archivo principal ({CODIGO}_{FECHA_CORTE}.xlsx / .gjm) y del Libro de Rechazos ({CODIGO}_Rechazos_{FECHA_CORTE}.xlsx)."
    ]
  },
  {
    version: "5.5.0",
    date: "2026-08-28",
    changes: [
      "Persistencia de Bases de Referencia en Firestore (Opción A Nube): Almacenamiento permanente de múltiples bases de referencia en la nube para reutilización continua entre capturas de cartera sin necesidad de re-cargar el archivo.",
      "Casilla de Activación/Desactivación de Cotejo: Incorporación de una casilla de verificación interactiva ('Cotejo Activo') para aplicar o desactivar la base de referencia en el pipeline ETL.",
      "Gestor Multibase de Referencia: Modal de gestión completa para visualizar, activar, subir y eliminar permanentemente bases de referencia guardadas en Firestore.",
      "Actualización de Reglas de Seguridad & Blueprint: Integración de la colección buro_reference_bases en firebase-blueprint.json y despliegue de reglas Firestore para aislamiento por empresa."
    ]
  },
  {
    version: "5.4.1",
    date: "2026-08-28",
    changes: [
      "Optimización de Sincronización Firestore: Eliminación del filtro obsoleto de la serie V5.x que provocaba intentos de re-registro continuo de versiones.",
      "Manejo Resiliente Modo Sin Conexión (Offline): Supresión silenciosa de advertencias de red cuando Firestore opera en modo offline o sin alcance inmediato al backend."
    ]
  },
  {
    version: "5.4.0",
    date: "2026-08-28",
    changes: [
      "Implementación de las 5 Reglas Oficiales de Rechazos Equifax: Integración automatizada de las reglas exclusionRuleCaseOne (Fecha de Corte), ValidateSujetoAlDia (Clientes Sin Deuda), compareDates (Vencimientos Erróneos con Cotejo en Base de Referencia y +1 año), exclusionRuleCaseSix (Fecha Límite de Antigüedad) e isValidIdTypeC (Validación Módulo 10).",
      "Libro de Rechazos Multi-Hoja (.xlsx): Exportación automatizada de un archivo Excel de 5 pestañas categorizadas ('FUERA DE FECHA DE CORTE', 'CLIENTES SIN DEUDA', 'FECHA DE VENCIMIENTO ERRONEA', 'CLIENTES FUERA DE FECHA APLICABLE', 'IDENTIFICACIONES INCORRECTAS').",
      "Nuevos Controles de Interfaz: Botón para carga de Base de Referencia (.xlsx, .xls, .gjm, .txt, .csv) y selector para Fecha Límite de Antigüedad de Concesión (Opcional).",
      "Visualización Interactiva de Rechazos: Pestañas de inspección y tarjetas KPI con desglose directo de motivos de rechazo e inconsistencias detectadas."
    ]
  },
  {
    version: "5.3.0",
    date: "2026-08-28",
    changes: [
      "Reingeniería del Módulo Buró de Crédito: Reestructuración oficial del pipeline ETL de 12 a 10 fases secuenciales optimizadas.",
      "Formato Cronológico Estandarizado (Fase 3): Normalización estricta de todas las fechas al formato dd/mm/yyyy para compatibilidad total con Equifax.",
      "Configuración de Fecha de Corte (Fase 10): Selección e inyección interactiva de la Fecha de Corte antes del procesamiento para el renombrado dinámico del archivo resultante (2968_DDMMYYYY.xlsx).",
      "Reordenamiento Estratégico de Fases: Reubicación de la Validación de Identidad (Módulo 10 del Registro Civil) inmediatamente después de la Alineación de Morosidad.",
      "Optimización de Auditoría: Registro detallado y transparente en Firestore de la traza de ejecuciones por lote."
    ]
  },
  {
    version: "5.2.0",
    date: "2026-08-28",
    changes: [
      "Optimización Masiva de Rendimiento: Implementación de carga paralela (Promise.all) en el Dashboard, reduciendo tiempos de espera iniciales.",
      "Refactorización de Consultas de Inventario: Se eliminó el escaneo total de colecciones en Firestore, priorizando consultas indexadas para una carga instantánea de productos.",
      "Estabilización de Sesión: Ajuste en AuthContext para evitar parpadeos y re-conexiones innecesarias durante la validación de seguridad.",
      "Mejora en la Gestión de Estado: Optimización de listeners de perfil para garantizar una experiencia de usuario fluida y sin latencia percibida."
    ]
  },
  {
    version: "5.1.6",
    date: "2026-08-28",
    changes: [
      "Resolución de Bucle Crítico en Cuentas Administradoras: Unificación de la lógica de memoria local (locallyAccepted) para cubrir tanto el modal legal como la pantalla de bloqueo preventivo.",
      "Sincronización Atómica de Seguridad: Se eliminó el rebote de la pantalla naranja de Acceso Limitado al garantizar que el sistema ignore estados de base de datos obsoletos durante el proceso de firma.",
      "Optimización del Flujo Post-Aceptación: Los usuarios con requerimientos especiales (como Contrato Bilateral) ahora experimentan una transición fluida al dashboard tras la validación exitosa."
    ]
  },
  {
    version: "5.1.5",
    date: "2026-08-27",
    changes: [
      "Eliminación de Bucle de Sincronización: Implementación de un estado de validación local persistente durante la sesión para evitar que el modal legal reaparezca tras la aceptación.",
      "Bypass de Latencia: Se garantiza que la aplicación ignore datos obsoletos de la base de datos durante la transición post-aceptación, estabilizando el acceso inmediato.",
      "Refuerzo de Experiencia de Usuario: Transición fluida y unidireccional desde la firma legal hasta el dashboard principal sin rebotes de seguridad."
    ]
  },
  {
    version: "5.1.4",
    date: "2026-08-27",
    changes: [
      "Optimización de Transiciones de Seguridad: Se eliminó el retraso visual entre la validación del PIN y la aparición de los términos legales, eliminando falsos positivos de bloqueo.",
      "Clarificación de Mensajería Legal: Ajuste de textos en el modal de aceptación para guiar mejor al usuario final sobre el requisito de las casillas de verificación.",
      "Refuerzo de Estabilidad Post-PIN: Los usuarios finales ahora experimentan un flujo directo al contenido legal sin parpadeos de la pantalla de Acceso Limitado."
    ]
  },
  {
    version: "5.1.3",
    date: "2026-08-27",
    changes: [
      "Aceptación Legal Granular: Implementación de casillas de verificación obligatorias por separado para los Términos Generales y el Acuerdo Bilateral, asegurando una validación consciente de cada documento.",
      "Refuerzo de Sincronización Proactiva: Actualización inmediata del estado local del perfil tras la aceptación legal para eliminar rebotes de seguridad causados por la latencia de red de Firestore.",
      "Optimización de Flujo de Bienvenida: Garantía de que el Tour de Onboarding solo se active tras la validación exitosa y atómica de todos los documentos legales requeridos."
    ]
  },
  {
    version: "5.1.2",
    date: "2026-08-27",
    changes: [
      "Transparencia Legal Dual: Rediseño del modal de aceptación para el usuario administrador, permitiendo la revisión simultánea de los Términos Generales y el Acuerdo Bilateral Privado.",
      "Interfaz de Pestañas Legales: Implementación de un sistema de navegación interna en el modal para facilitar la lectura de múltiples documentos obligatorios.",
      "Sincronización de Aceptación Bilateral: Se garantiza que una sola acción del usuario valide ambos estatus legales (términos y contrato) de forma atómica en la base de datos."
    ]
  },
  {
    version: "5.1.1",
    date: "2026-08-27",
    changes: [
      "Corrección de Bloqueo Específico (Derick): Se habilitó la detección automática de falta de contrato para el usuario principal, permitiendo que el modal de aceptación se dispare incluso si los términos generales ya estaban actualizados.",
      "Estabilización de Flujo Post-PIN: Garantía de que tras validar la identidad, el sistema redirija correctamente al modal legal si existen documentos pendientes de firma."
    ]
  },
  {
    version: "5.1.0",
    date: "2026-08-27",
    changes: [
      "Sincronización en Tiempo Real: Implementación de listeners de Firestore en AuthContext para garantizar que el estado legal y de perfil sea siempre preciso y reactivo.",
      "Jerarquía de Seguridad Reforzada: Reordenamiento de validaciones para priorizar la identidad (PIN) antes que el bloqueo legal, eliminando conflictos de transición entre pantallas.",
      "Arquitectura Reactiva: El sistema ahora detecta automáticamente la aceptación de términos desde cualquier dispositivo sin requerir acciones manuales del usuario."
    ]
  },
  {
    version: "5.0.1",
    date: "2026-08-27",
    changes: [
      "Optimización de Sincronización de Seguridad: Implementación de un periodo de gracia (Optimistic Bypass) tras el tour de bienvenida para evitar bloqueos por latencia de base de datos.",
      "Mejora de UX en Transición: Eliminación de parpadeos visuales al cambiar del estado de bloqueo al estado operativo total."
    ]
  },
  {
    version: "5.0.0",
    date: "2026-08-27",
    changes: [
      "Lanzamiento de Experiencia de Bienvenida Interactiva: Implementación de un Tour Onboarding que guía al usuario tras la aceptación de términos.",
      "Solución Definitiva de Sincronización: El proceso interactivo garantiza que la base de datos y el estado local se sincronicen completamente antes de liberar el acceso al sistema principal.",
      "Rediseño de Transiciones Legales: Flujo más fluido y profesional desde el bloqueo preventivo hasta la operatividad total."
    ]
  },
  {
    version: "4.57.6",
    date: "2026-08-27",
    changes: [
      "Estabilización de Transición Legal: Se optimizó la sincronización de estado tras la aceptación de términos, eliminando latencias que mantenían el bloqueo visual de forma persistente.",
      "Consistencia de Perfil: Implementación de actualizaciones funcionales en el gestor de autenticación para garantizar que el perfil del usuario refleje instantáneamente los cambios de cumplimiento legal sin necesidad de recarga."
    ]
  },
  {
    version: "4.57.5",
    date: "2026-08-27",
    changes: [
      "Blindaje Ultra-Agresivo contra Ruido Externo: Se optimizó el script de interceptación de errores globales para capturar rechazos de promesas con estructuras de objeto complejas, garantizando el silenciamiento total de interferencias de MetaMask y otras extensiones Web3."
    ]
  },
  {
    version: "4.57.4",
    date: "2026-08-27",
    changes: [
      "Refuerzo de Silenciamiento de Extensiones: Se amplió la lista de filtros en el ErrorBoundary y el script global para incluir términos como 'extension' y 'wallet', y se mejoró la recuperación de estado para evitar bloqueos por ruido de MetaMask o Web3 externos."
    ]
  },
  {
    version: "4.57.3",
    date: "2026-08-27",
    changes: [
      "Corrección de flujo de aceptación: Se reestructuró la lógica del guardián de seguridad para permitir que el modal de términos y condiciones sea accesible incluso cuando el acceso está bloqueado preventivamente."
    ]
  },
  {
    version: "4.57.2",
    date: "2026-08-27",
    changes: [
      "Excepción para SuperAdmin: Se añadió una excepción en el guardián de seguridad para omitir el bloqueo por términos o contrato no aceptados cuando el SuperAdmin se encuentra simulando sesión en otra cuenta."
    ]
  },
  {
    version: "4.57.1",
    date: "2026-08-27",
    changes: [
      "Corrección de Componentes: Se solucionó el error de renderizado por la falta de importación del ícono AlertTriangle en el guardián de seguridad."
    ]
  },
  {
    version: "4.57.0",
    date: "2026-08-26",
    changes: [
      "Robustez en Modo Offline: Optimización del flujo de validación del PIN para funcionar correctamente en estados sin conexión, utilizando el caché local y evitando bloqueos al intentar actualizar datos en Firebase.",
      "Flujo de Aceptación Legal: Implementación de nueva política de aceptación de términos y contrato bilateral (específico para créditoDerick). Se bloquea el acceso total al sistema hasta la aceptación, con flujo de validación previo al PIN."
    ]
  },
  {
    version: "4.56.2",
    date: "2026-08-25",
    changes: [
      "Corrección de Visibilidad: Resuelto un problema crítico donde los cheques antiguos (creados antes del sistema de agrupación por facturas) o cheques huérfanos se sumaban en los totales de búsqueda pero no se mostraban en la lista de resultados."
    ]
  },
  {
    version: "4.56.1",
    date: "2026-08-25",
    changes: [
      "Optimización en Consultas: Los grupos de facturas se expanden automáticamente al realizar una búsqueda (por nombre, comprobante, concepto, etc.), permitiendo visualizar de forma inmediata los cheques individuales registrados sin necesidad de clics adicionales."
    ]
  },
  {
    version: "4.56.0",
    date: "2026-08-25",
    changes: [
      "Módulo de Términos y Condiciones: Implementación de un sistema de aceptación obligatoria de nuevos términos al iniciar sesión. Se añade un modal detallado con la versión actualizada de los términos, junto con el registro de la fecha y hora de aceptación en el perfil del usuario, la cual ahora se visualiza en la sección de información."
    ]
  },
  {
    version: "4.55.5",
    date: "2026-08-25",
    changes: [
      "Optimización de UI: Migración de generador de captura de pantalla a html-to-image para dar soporte a variables de color oklch de Tailwind v4 en la generación del PDF."
    ]
  },
  {
    version: "4.55.4",
    date: "2026-08-25",
    changes: [
      "Optimización de UI: Corrección en el botón 'Imprimir Constancia' para generar y descargar un documento PDF en lugar de utilizar el menú de impresión del sistema, el cual fallaba por restricciones del navegador."
    ]
  },
  {
    version: "4.55.3",
    date: "2026-08-25",
    changes: [
      "Actualización Legal: Renovación del Acuerdo Privado de Reconocimiento de Autoría Independiente y Condición de Cortesía con la inclusión de aceptación tácita por uso e información detallada de la Empresa."
    ]
  },
  {
    version: "4.55.2",
    date: new Date().toISOString().split('T')[0],
    changes: [
      "Actualización Legal: Renovación integral de los Términos y Condiciones Generales con la introducción explícita del mecanismo de 'Aceptación tácita por uso'."
    ]
  },
  {
    version: "4.55.1",
    date: new Date().toISOString().split('T')[0],
    changes: [
      "SEO & Privacidad: Creación del archivo robots.txt para bloquear indexación en buscadores y proteger la privacidad del sistema.",
      "UX/UI: Rediseño amigable y divertido de la página de error 404 para mejorar la experiencia del usuario."
    ]
  },
  {
    version: "4.55.0",
    date: new Date().toISOString().split('T')[0],
    changes: [
      "Refactorización del servidor: Extracción de la lógica de generación de plantillas de correo HTML hacia módulos separados, optimizando el tamaño y legibilidad de server.ts.",
      "Mantenimiento proactivo: Limpieza de scripts antiguos de mantenimiento (Python y TS) agrupándolos en una carpeta `scripts/archive/` dedicada para evitar confusión en producción.",
      "Pruebas Unitarias: Implementación de test suites automatizadas con Vitest para validar las reglas matemáticas críticas en algoritmos como el Módulo 10 (Ecuador)."
    ]
  },
  {
    version: "4.54.0",
    date: new Date().toISOString().split('T')[0],
    changes: [
      "Extracción y Unificación Total de la Base de Datos Rescatada: Reconstrucción exhaustiva y consolidación del 100% de los documentos históricos (386 registros en total), incluyendo 233 Cheques (lotes completos A-Z), 86 Cobranzas, 48 Ventas, 12 Presupuestos y 7 Empleados.",
      "Actualización del Respaldo Maestro JSON: Sincronización del archivo 'backup_restaurado_automatico.json' y 'recovered_backup_master.json' con la totalidad de registros rescatados.",
      "Optimización de Restauración en 1-Clic: Actualización de los indicadores y contadores en la interfaz de Configuración > Respaldos y Migración para restaurar o exportar la totalidad de registros con validación de integridad."
    ]
  },
  {
    version: "4.53.0",
    date: new Date().toISOString().split('T')[0],
    changes: [
      "Motor de Reconstrucción y Restauración de Base de Datos Rescatada: Reconstrucción integral de registros a partir del volcado de caché local fuera de línea (IndexedDB), recuperando 86 Cobranzas, 76 Cheques, 48 Ventas, 12 Presupuestos, 7 Empleados y configuraciones.",
      "Restauración Directa en 1-Clic desde Configuración > Respaldos: Incorporación de tarjeta de restauración y descarga inmediata del archivo de respaldo JSON generado con procesamiento por lotes (Batch Commits) y compatibilidad total con la estructura de Firestore.",
      "Descarga y Portabilidad de Respaldo: Generación del archivo JSON estándar de copia de seguridad ('backup_restaurado_automatico.json') descargable en cualquier momento para importación en modo Fusión (Merge) o Sobreescritura."
    ]
  },
  {
    version: "4.52.0",
    date: new Date().toISOString().split('T')[0],
    changes: [
      "Blindaje Crítico de Aislamiento y Eliminación de Cuentas: Refactorización radical de los procesos de eliminación y vaciado de usuarios en el Panel Administrativo para aislar estrictamente los registros al ID individual del usuario ('userId' / 'createdBy'), bloqueando cualquier eliminación en cascada de identificadores compartidos de empresa ('enterpriseId') o registros de otros usuarios y colaboradores.",
      "Eliminación de Escaneo Inseguro entre Colecciones: Erradicación definitiva de barridos globales no filtrados en ventas, cobranzas, cheques e inventarios durante la baja de cuentas individuales.",
      "Protección de Integridad Multiusuario: Blindaje de las colecciones operativas para garantizar que la remoción de un operador o cobrador nunca afecte los datos globales del ERP ni la base de datos empresarial."
    ]
  },
  {
    version: "4.51.2",
    date: new Date().toISOString().split('T')[0],
    changes: [
      "Corrección de Permisos de Auditoría (Firestore Security Rules): Ajuste en las reglas de seguridad de la colección auditLogs y en el helper isValidAudit para permitir el registro inmutable de auditoría de todas las acciones del sistema sin interrupciones de permisos.",
      "Optimización de Telemetría y Manejo de Errores: Eliminación del modificador redundante de combinación en nuevos documentos de auditoría y captura resiliente para evitar excepciones no deseadas en primer plano."
    ]
  },
  {
    version: "4.51.1",
    date: new Date().toISOString().split('T')[0],
    changes: [
      "Optimización de Centrado y Lectura de Términos y Condiciones: Centrado responsivo y estético del cuerpo del texto del documento legal en la pestaña de Información.",
      "Scroll y Desplazamiento Fluido Multiplataforma: Habilitación de navegación táctil y scroll bidireccional suave (overflow adaptativo y padding responsivo) para una lectura clara y sin recortes en móviles, tablets y pantallas de escritorio.",
      "Alineación y Jerarquía Visual Refinada: Ajuste tipográfico equilibrado con márgenes proporcionados en listas de cláusulas y bloque de firmas bilaterales."
    ]
  },
  {
    version: "4.51.0",
    date: new Date().toISOString().split('T')[0],
    changes: [
      "Acuerdo Privado y Bilateral Exclusivo (Almacenes Derick): Incorporación del 'ACUERDO PRIVADO DE RECONOCIMIENTO DE AUTORÍA INDEPENDIENTE Y CONDICIÓN DE CORTESÍA' visible de forma exclusiva y confidencial para la cuenta creditosderick15@gmail.com.",
      "Delimitación de Autoría y Cargo No Informático: Constancia expresa de las 9 cláusulas bilaterales (Objeto, Funciones delimitadas de Cobrador / Supervisor de Cartera, Origen de registro de cheques en Apps Script vs desarrollo independiente de ERP con recursos propios, Naturaleza no laboral del plan de cortesía sin incidencia salarial ni beneficios sociales, Terminación automática por cese laboral, No exclusividad y Libertad comercial, Confidencialidad y Vigencia permanente de declaraciones).",
      "Selector Dinámico de Documentos Legales: Selector dual para alternar fluidamente entre los Términos Generales Públicos y el Acuerdo Privado Bilateral con buscador de cláusulas, filtros y constancia imprimible con datos de RUC (0302370432001) y Representante Legal (DIAZ VASQUEZ MARIO JOE)."
    ]
  },
  {
    version: "4.50.1",
    date: new Date().toISOString().split('T')[0],
    changes: [
      "Incorporación del Texto Oficial y Definitivo de Términos y Condiciones: Actualización integral del documento contractual 'TÉRMINOS Y CONDICIONES DE USO Y LICENCIAMIENTO DE SOFTWARE' conforme a la versión revisada de agosto de 2026.",
      "Estructuración de 17 Cláusulas Contractuales: Desglose completo y detallado con buscador en tiempo real y filtrado temático por categorías (Aceptación, Propiedad Intelectual de Marcelo Enrique Gutama Chima, Otorgamiento de Licencia, Planes Especiales, Modo Solo Lectura de 30 días, Modelo de Suscripción, Propiedad de Información vs Sistema, Protección de Datos según LOPDP, Prohibición de Ingeniería Inversa, Rescisión Unilateral, Límites de Responsabilidad, Jurisdicción Ecuador, Seguridad de Accesos, SLA y Ratificación).",
      "Sincronización en Onboarding y Registro: Homogeneización del texto legal presentado en el modal de registro y consentimiento inicial para garantizar consistencia jurídica en todos los puntos de contacto del sistema."
    ]
  },
  {
    version: "4.50.0",
    date: new Date().toISOString().split('T')[0],
    changes: [
      "Nueva Pestaña de 'Información' en Configuración: Se incorporó una pestaña dedicada en el panel de Configuración que expone el marco legal, términos y condiciones fijos y la constancia inmutable de aceptación digital.",
      "Respaldo de Aceptación de Términos y Condiciones: Registro y visualización del titular, RUC/ID, correo electrónico, régimen jurídico ecuatoriano y la fecha/hora exacta en la que el usuario aceptó los términos contractuales.",
      "Texto Íntegro y Fijo de Términos Contractuales: Implementación como texto fijo de todos los capítulos y artículos regulatorios (Estatus Beta, Limitación de Responsabilidad, Principio GIGO, Propiedad Intelectual, Protección de Datos Personales según LOPDP, Ley de Comercio Electrónico y Código Civil).",
      "Soporte de Impresión y Certificación Legal: Botón de emisión e impresión de constancia de consentimiento electrónico bajo normativa ecuatoriana vigente.",
      "Validación de Esquema y Seguridad en Firestore: Incorporación del campo 'termsAcceptedAt' en la interfaz de perfil de usuario y en las reglas de seguridad de Firestore (firestore.rules) con despliegue verificado."
    ]
  },
  {
    version: "4.49.6",
    date: new Date().toISOString().split('T')[0],
    changes: [
      "Optimización en Manejo de Errores de Firestore: Refactorización de handleFirestoreError para evitar excepciones no capturadas (unhandled promise rejections) dentro de bloques catch y reducir exposición de datos de diagnóstico en consola.",
      "Fortalecimiento de Pipeline CI/CD: Inclusión de paso obligatorio de verificación de build ('npm run build') y análisis estático de reglas de seguridad ('npm run lint:rules') con instalación estricta 'npm ci' sin fallback silencioso.",
      "Consistencia de Verificación en Reglas de Firestore: Homogeneización de la función isAdmin() para utilizar isVerified(), alineando la política de verificación de correo e identidad en todo el esquema de seguridad.",
      "Conexión de Linter de Reglas: Integración del comando 'lint:rules' en package.json aprovechando eslint.config.js y @firebase/eslint-plugin-security-rules."
    ]
  },
  {
    version: "4.49.5",
    date: new Date().toISOString().split('T')[0],
    changes: [
      "Blindaje de Seguridad RBAC en Firestore: Se agregó la restricción estricta de igualdad para 'employeeRole' en las reglas de actualización de usuarios (firestore.rules), impidiendo que usuarios no administradores puedan auto-asignarse roles elevados o modificar su jerarquía corporativa.",
      "Prevención de Escalación de Privilegios: Aseguramiento de que cualquier intento de alteración directa de 'employeeRole' fuera del alcance de un administrador sea rechazado a nivel de base de datos."
    ]
  },
  {
    version: "4.49.4",
    date: new Date().toISOString().split('T')[0],
    changes: [
      "Blindaje Global Ultra-Temprano: El script de supresión de errores de extensiones externas se movió al inicio absoluto del <head> en index.html para garantizar la captura de eventos antes que cualquier otra librería.",
      "Expansión de Filtros de Consola: Se añadieron filtros para console.warn, console.info y console.debug, eliminando cualquier rastro de ruido de MetaMask en todos los niveles de log.",
      "Mejora de Compatibilidad en window.onerror: Refactorización del capturador global para preservar manejadores preexistentes mientras se bloquean errores de Web3."
    ]
  },
  {
    version: "4.49.3",
    date: new Date().toISOString().split('T')[0],
    changes: [
      "Blindaje Global contra Errores de Extensiones: Se inyectó un script de supresión de errores en el punto de entrada principal (index.html) para capturar y silenciar proactivamente fallos de MetaMask y Web3 antes de que alcancen los logs del sistema.",
      "Filtrado de Promesas no Manejadas: Implementación de listeners globales para unhandledrejection, garantizando que el ruido de extensiones externas no dispare falsas alarmas de estabilidad.",
      "Optimización de Consola: Limpieza proactiva de la consola de desarrollador para mantener el enfoque en la lógica de negocio del sistema financiero."
    ]
  },
  {
    version: "4.49.2",
    date: new Date().toISOString().split('T')[0],
    changes: [
      "Mitigación de Errores de Terceros: Se implementó un filtro en el ErrorBoundary global para ignorar y silenciar errores generados por extensiones de navegador externas (como MetaMask o Web3), evitando que interrumpan la experiencia del usuario o contaminen los registros del sistema.",
      "Optimización de Logs Críticos: Los errores no relacionados con el sistema ahora son degradados a advertencias en consola en lugar de ser reportados como fallos de la aplicación."
    ]
  },
  {
    version: "4.49.1",
    date: new Date().toISOString().split('T')[0],
    changes: [
      "Optimización de Reglas de Seguridad de Firestore: Se flexibilizaron las validaciones de 'isVerified' para soportar proveedores de Google y se expandió el esquema de 'isValidUser' para incluir campos dinámicos (lastLoginAt, lastIp, employeeRole) y roles adicionales.",
      "Corrección de Permisos de Usuario: Resolución del error de permisos insuficientes al actualizar perfiles de administrador y usuarios finales.",
      "Investigación de Error MetaMask: Confirmación de que el error de conexión es una interferencia de extensiones externas del navegador y no un fallo del sistema."
    ]
  },
  {
    version: "4.49.0",
    date: new Date().toISOString().split('T')[0],
    changes: [
      "Integridad de Datos en Transacciones de Inventario: Corrección crítica en la reversión de transferencias, préstamos y ventas para consolidar filas duplicadas de un mismo artículo por Map antes de ejecutar lecturas y escrituras atómicas.",
      "Protección contra Stock Negativo: Aplicación de acotamiento a cero (Math.max(0, ...)) en todas las deducciones de existencias para prevenir valores inconsistentes.",
      "Fortalecimiento Criptográfico del PIN con Salt: Implementación de hash SHA-256 con salt único por usuario y proceso transparente de migración automática de hashes legados.",
      "Persistencia de Sesión de PIN entre Días: Corrección de expiración prematura a medianoche mediante cálculo continuo de inactividad en minutos.",
      "Saneamiento de Código y Desacoplamiento de Cliente: Eliminación de código muerto y lógica empresarial hardcodeada en módulos de empleados, presupuestos y ventas.",
      "Tipado Estricto de TypeScript y Migración de Dependencias: Activación de strictNullChecks en tsconfig.json y migración de la dependencia xlsx al registro oficial de npm."
    ]
  },
  {
    version: "4.48.1",
    date: new Date().toISOString().split('T')[0],
    changes: [
      "Higiene del Repositorio y Reorganización de Scripts: Reubicación de todos los scripts ad-hoc y herramientas de parche a la carpeta dedicada `scripts/maintenance/` para mantener limpio el entorno de producción.",
      "Sanitización de Logs de Servidor (Privacidad): Supresión y enmascaramiento de información personal identificable (PII como direcciones de correo y UIDs completos) en los registros de consola de Express y Firebase Admin."
    ]
  },
  {
    version: "4.48.0",
    date: new Date().toISOString().split('T')[0],
    changes: [
      "Mitigación de Vulnerabilidades Moderadas y Privacidad: Resolución integral de 5 vectores de riesgo identificados en la auditoría de seguridad.",
      "Cierre de Brecha de Carrera en isEnterpriseData: Eliminación del comodín !exists(users/uid) en Firestore Rules para evitar cualquier ventana de acceso antes de la creación del perfil del usuario.",
      "Protección de Envío Directo de Correos (/api/emails/test-direct): Restricción del endpoint de pruebas de Resend a superadministradores autenticados con verificación de token.",
      "Limpieza de Datos Sensibles y Scripts de Depuración: Eliminación de archivos residuales (como query_user.js) que contenían identificadores UID reales de usuarios.",
      "Actualización de Política de Privacidad y Retención de IP: Incorporación de cláusula explícita en Términos y Condiciones sobre la recopilación, propósito de seguridad y rotación del campo lastIp."
    ]
  },
  {
    version: "4.47.0",
    date: new Date().toISOString().split('T')[0],
    changes: [
      "Blindaje y Mitigación de 7 Vulnerabilidades Críticas de Seguridad: Corrección integral de reglas de base de datos y endpoints de backend tras auditoría técnica.",
      "Prevención de Escalación de Privilegios en Firestore (/users/{userId}): Restricción estricta de actualización mediante validación de claves afectadas (affectedKeys), impidiendo modificaciones no autorizadas en roles, estados, empresas o suscripciones.",
      "Verificación Estricta de Correo (isVerified): Actualización de la función de reglas para exigir de forma obligatoria que el token contenga email_verified == true.",
      "Protección y Control de Acceso en Endpoints de Servidor (/api/diagnostics/db, /api/admin/sync-claims): Incorporación de middleware con Firebase Admin SDK para exigir credenciales autenticadas de administrador (Bearer ID Token) antes de exponer diagnósticos o sincronizar claims.",
      "Autenticación Segura de Perfil (/api/users/profile): Validación criptográfica del ID Token de Firebase para evitar suplantaciones de identidad (spoofing) o asociación arbitraria de correos de superadministradores.",
      "Eliminación Total de Backdoor en CRON (/api/cron/daily-report): Remoción completa de parámetros de omisión (?bypass=true y x-bypass-cron), requiriendo obligatoriamente CRON_SECRET o credenciales de administrador.",
      "Aislamiento Multi-Inquilino en Inventarios (articles, warehouses, warehouse_inventory): Implementación de la regla isEnterpriseData para bloquear lecturas no autenticadas y accesos cruzados entre empresas."
    ]
  },
  {
    version: "4.46.0",
    date: new Date().toISOString().split('T')[0],
    changes: [
      "Punto de Acceso y Restauración Registrado (Código: 22082026.1340): Se estableció y fijó formalmente el punto de control de acceso y referencia operativa 22082026.1340 para garantizar la trazabilidad y estado consolidado de la plataforma.",
      "Consolidación Integral de Módulos: Estado estable y sincronizado de los módulos de Comercio/Ventas, Inventario Multibodega, Buró de Crédito, Control de Egresos y Seguridad Multiempresa."
    ]
  },
  {
    version: "4.45.0",
    date: new Date().toISOString().split('T')[0],
    changes: [
      "Auditoría de Errores Críticos e Investigación de 'MetaMask': Se realizó un escaneo exhaustivo de la base de código para identificar referencias a MetaMask o Web3, concluyendo que el error reportado es externo (extensión del navegador) y no afecta la integridad del sistema.",
      "Optimización de Carga y Estabilidad: Verificación completa de compilación y limpieza de tipos, garantizando que todos los módulos operen sin fallos internos.",
      "Consolidación de Buscador Predictivo (Ventas): Ajustes de diseño en el despliegue de cascada para mejorar la legibilidad y asegurar el filtrado instantáneo."
    ]
  },
  {
    version: "4.44.0",
    date: new Date().toISOString().split('T')[0],
    changes: [
      "Buscador Predictivo de Ventas en Cascada (Comercio / Ventas): Implementación de la barra de búsqueda en tiempo real con sugerencias predictivas dinámicas por nombre de cliente, artículos comprados y fechas.",
      "Despliegue de Resultados en Formato Cascada: Estructura visual en cascada con animaciones progresivas que detalla para cada coincidencia el nombre del cliente, artículo adquirido, valor total ($) y fecha exacta de compra.",
      "Métricas y Filtros Predictivos: Indicadores automáticos de monto total acumulado y ticket promedio por cliente, filtros rápidos de tipo de pago (Contado/Crédito) y ordenamiento cronológico o por monto."
    ]
  },
  {
    version: "4.43.0",
    date: new Date().toISOString().split('T')[0],
    changes: [
      "Módulo de Importación y Exportación de Toma Física (.xlsx, .xls, .pdf): Implementación de la función para importar y exportar reportes de inventarios en formatos Excel y PDF manteniendo la estructura del formato de toma física.",
      "Soporte de Existencias y Stock Negativo: Eliminación de recortes automáticos a cero en transacciones para permitir el registro real de mercaderías vendidas o reubicadas sin ingreso previo, mostrando alertas visuales prominentes de stock negativo en el Dashboard y en el Catálogo de Artículos.",
      "Modal Flotante de Advertencia por Stock Negativo: Implementación de la modal interactiva `NegativeStockWarningModal` gatillada en ventas o traslados que lleven el stock por debajo de cero, ofreciendo tres opciones claras: 1) Corregir la venta, 2) Redirigir al registro de mercadería nueva, o 3) Confirmar la transacción estando consciente del saldo negativo."
    ]
  },
  {
    version: "4.42.2",
    date: new Date().toISOString().split('T')[0],
    changes: [
      "Verificación Global y Preparación para Producción: Se ejecutó el proceso de compilación de producción de Vite + esbuild, validación de tipos e inspección de reglas de seguridad de Firestore. Se confirmó que los demás módulos (Ventas, Finanzas, Usuarios, Transferencias, Prestamos, Configuración) no fueron alterados y continúan operando de forma aislada e íntegra."
    ]
  },
  {
    version: "4.42.1",
    date: new Date().toISOString().split('T')[0],
    changes: [
      "Corrección de Reglas de Seguridad en Firestore para Inventarios: Se añadieron y desplegaron permisos explícitos de creación, actualización y eliminación (`create`, `update`, `delete`) para la colección `warehouse_inventory` (así como `articles` y `warehouses`) en `firestore.rules`. Esto resuelve de forma definitiva el error de permisos insuficientes al eliminar o reasignar registros huérfanos de inventario."
    ]
  },
  {
    version: "4.42.0",
    date: new Date().toISOString().split('T')[0],
    changes: [
      "Herramienta de Autorrecuperación y Limpieza de Registros Huérfanos: Se implementó un panel banner interactivo y la modal `InventoryRecoveryModal` en la gestión de bodegas. Permite detectar automáticamente stock en bodega cuyos artículos fueron eliminados del catálogo principal, ofreciendo tres alternativas inmediatas: 1) Eliminar los registros huérfanos en lote o individualmente, 2) Vincular y reasignar las unidades a un artículo existente en el catálogo, o 3) Crear un nuevo artículo desde el formulario de autorrecuperación y vincularlo en un clic."
    ]
  },
  {
    version: "4.41.3",
    date: new Date().toISOString().split('T')[0],
    changes: [
      "Normalización Universal de Nombres de Artículos en Inventarios: Se implementó la función helper `normalizeArticleData` tanto en `fetchInventoryCollection` como en `ensureArticlesLoaded`, resolviendo de forma preventiva y retroactiva aquellos artículos cuyo nombre estuviese guardado bajo propiedades como `computedName`, `nombre` o combinación de campos (`category`, `brand`, `model`). Además, se actualizaron los filtros de búsqueda y renderizado de `ArticlesTab`, `WarehousesTab` y `ArticleSelector` para prevenir errores de referencia nula y asegurar la visualización correcta de artículos en la bodega de prueba."
    ]
  },
  {
    version: "4.41.2",
    date: new Date().toISOString().split('T')[0],
    changes: [
      "Corrección de Permisos de Firestore para la Colección /checks: Se actualizaron las reglas de seguridad en `firestore.rules` declarando directamente las cuentas superadministradoras dentro de `isAdmin()` y haciendo flexible la función de validación `isValidCheck` (permitiendo documentos sin `invoiceId` directo creados en la administración de usuarios y cobros). Además, se re-desplegaron las reglas en Firebase, resolviendo el error de 'Missing or insufficient permissions'."
    ]
  },
  {
    version: "4.41.1",
    date: new Date().toISOString().split('T')[0],
    changes: [
      "Resolución Inteligente de Artículos en Bodegas (Resolución de 'ARTÍCULO DESCONOCIDO' y Carga Completa): Se creó la función `ensureArticlesLoaded` y se integró un mecanismo de lectura fallback directa por ID de documento de Firestore (`getDoc`) en todas las pestañas de inventario (Artículos, Bodegas, Dashboard, Ventas, Traslados y Préstamos/Devoluciones). Esto garantiza que si existía un registro de stock o movimiento cuyo artículo fue guardado bajo un ID secundario de usuario, se resuelva el nombre e información completa del artículo instantáneamente en lugar de mostrar 'ARTÍCULO DESCONOCIDO'."
    ]
  },
  {
    version: "4.41.0",
    date: new Date().toISOString().split('T')[0],
    changes: [
      "Sincronización Multiorigen de Artículos e Inventario (Bodegueros y Empresas): Se implementó la función unificada `fetchInventoryCollection` para consultar artículos, bodegas, inventarios y movimientos evaluando de forma combinada los identificadores `enterpriseId`, `userId` y `createdBy`. Esto resuelve que los artículos registrados por bodegueros creados antes de sincronizar su empresa o con UIDs secundarios aparezcan inmediatamente reflejados en la pestaña de Artículos de Inventario."
    ]
  },
  {
    version: "4.40.4",
    date: new Date().toISOString().split('T')[0],
    changes: [
      "Solución de Edición y Eliminación de Artículos y Bodegas (Permisos Firestore): Se actualizaron las reglas de seguridad `isEnterpriseData` en Firestore para otorgar acceso de modificación y borrado tanto a administradores como a usuarios de tipo Bodeguero y Empleados (vinculados o autónomos). Adicionalmente, se ajustaron las consultas de eliminación de stock en `ArticlesTab` agregando filtrado seguro por `enterpriseId` y manejo preventivo no bloqueante."
    ]
  },
  {
    version: "4.40.3",
    date: new Date().toISOString().split('T')[0],
    changes: [
      "Corrección Definitiva de Permisos Firestore para Bodegueros y Creación de Artículos: Se optimizaron las reglas de seguridad en `firestore.rules` permitiendo lecturas seguras cuando se evalúan registros inexistentes (`resource == null`) en transacciones de stock, se añadió protección preventiva para accesos a la propiedad `enterpriseId` en documentos de usuario, y se flexibilizó la validación `isAccountActive()` para admitir estados implícitos sin bloquear operaciones de inventario a usuarios tipo Bodeguero."
    ]
  },
  {
    version: "4.40.2",
    date: new Date().toISOString().split('T')[0],
    changes: [
      "Solución de Guardado para Cuentas Bodeguero y Empleados (Permisos y Datos): Se actualizaron las reglas de seguridad de Firestore (`firestore.rules`) permitiendo que usuarios autenticados sin la bandera estricta de correo verificado (`email_verified`) pero habilitados y vinculados a una empresa puedan escribir en las colecciones de inventario. Asimismo, se sanitizó el campo `createdBy` en la función transaccional `saveArticleWithStockTransaction` para evitar errores por valores no definidos (`undefined`)."
    ]
  },
  {
    version: "4.40.1",
    date: new Date().toISOString().split('T')[0],
    changes: [
      "Ajuste Crítico de Contraste y Accesibilidad en Temas Claros (UI): Se corrigieron los estilos tipográficos del modal 'Ingreso de Mercadería' y formularios de inventario. Se actualizaron las etiquetas de campos (labels), descripciones secundarias y textos de reemplazo (placeholders) de tonos grises pálidos de bajo contraste (`text-neutral-400`) a colores neutros oscuros y contrastados (`text-neutral-700` en tema claro / `text-neutral-300` en tema oscuro), cumpliendo estrictamente los estándares de accesibilidad WCAG (ratio > 4.5:1)."
    ]
  },
  {
    version: "4.40.0",
    date: new Date().toISOString().split('T')[0],
    changes: [
      "Corrección del Orden de Ejecución en Transacciones de Firestore (Lecturas Antes de Escrituras): Se reestructuró la función `saveArticleWithStockTransaction` en `inventory-db` para separar explícitamente la Fase 1 (todas las lecturas `transaction.get` para artículos y stock de almacén) de la Fase 2 (escrituras `transaction.set` y `transaction.update`). Esto previene el error en tiempo de ejecución de Firestore que impide realizar lecturas tras haber iniciado escrituras."
    ]
  },
  {
    version: "4.39.0",
    date: new Date().toISOString().split('T')[0],
    changes: [
      "Blindaje Transaccional Completo en la Creación de Artículos: Se creó la función `saveArticleWithStockTransaction` en `inventory-db` y se integró en `ArticlesTab.tsx`, eliminando la última secuencia `getDoc` + `writeBatch` residual al registrar o sumar stock inicial a artículos existentes (`matchedArticle`). Toda la creación e incremento de inventario global y por almacén en el registro de artículos ahora se ejecuta bajo transacciones atómicas `runTransaction`, garantizando consistencia absoluta ante peticiones concurrentes."
    ]
  },
  {
    version: "4.38.0",
    date: new Date().toISOString().split('T')[0],
    changes: [
      "Transacciones Atómicas en Firestore e Integración de Validación de Cheques: Se refactorizó completamente el módulo `inventory-db` para migrar de `writeBatch` + `getDoc` a transacciones atómicas puras (`runTransaction`) en todas las operaciones de inventario (transferencias, ventas, préstamos, devoluciones y reversiones). Esto elimina de raíz el riesgo de carreras de condición (race conditions) en actualizaciones de stock concurrentes. Asimismo, se integró la función `isValidCheck` en las reglas de seguridad de Firestore para validar la estructura requerida de la colección `/checks/{id}` y se desplegó la versión más reciente en Firebase."
    ]
  },
  {
    version: "4.37.0",
    date: new Date().toISOString().split('T')[0],
    changes: [
      "Actualización Integral de Reglas de Seguridad de Firestore y Atributos de Documentos de Inventario: Se corrigió la función `isEnterpriseData` en `firestore.rules` para validar que el `userId` o `enterpriseId` guardado coincida tanto con el UID de usuario como con el `enterpriseId` asignado en la cuenta del empleado/bodeguero. Además, se incluyeron explícitamente los campos `enterpriseId` y `createdBy` en todas las escrituras y transacciones en lote de `inventory-db` (creación de bodegas, artículos, stock de almacenes, transferencias, ventas y préstamos/devoluciones). Despliegue de reglas ejecutado exitosamente en el servidor de Firebase."
    ]
  },
  {
    version: "4.36.0",
    date: new Date().toISOString().split('T')[0],
    changes: [
      "Solución Integral de Vinculación y Consultas para Bodegueros: Se implementó la resolución automática y autorreparación de `enterpriseId` en `AuthContext` para perfiles de bodeguero y empleados (incluyendo usuarios registrados vía Gmail como `bocansacadamian@gmail.com`). Se estandarizó la resolución del ID de empresa en todas las pestañas de inventario (Bodegas, Artículos, Ventas, Transferencias, Préstamos y Dashboard), asegurando sincronización completa en tiempo real con la empresa padre `creditosderick15@gmail.com`."
    ]
  },
  {
    version: "4.35.2",
    date: new Date().toISOString().split('T')[0],
    changes: [
      "Corrección de Referencia de Variable en Validación de PIN: Se solucionó el error 'hashedPin is not defined' en `AuthContext.tsx` definiendo correctamente el hash del PIN antes de evaluarlo contra el perfil de usuario. Las operaciones de vaciado de base de datos y eliminación de usuario ahora funcionan sin interrupciones."
    ]
  },
  {
    version: "4.35.1",
    date: new Date().toISOString().split('T')[0],
    changes: [
      "Optimización de Vaciado de Datos, Verificación de PIN y Feedback Visual Instantáneo: Se aceleró el escaneo de registros convirtiendo las lecturas secuenciales en consultas concurrentes con Promise.all (reduciendo la espera de 30s a menos de 1s). Se integraron estados de carga animados (Loader2 spinner) y banners informativos dentro de las ventanas modales de Vaciado y Eliminación de Usuario. Además, se ajustó la validación de PIN para permitir operaciones cuando el perfil del administrador no tiene un PIN configurado previa o explícitamente."
    ]
  },
  {
    version: "4.35.0",
    date: new Date().toISOString().split('T')[0],
    changes: [
      "Vaciado Exhaustivo de Ventas, Cobranzas y Empleados Vinculados: Se perfeccionó el algoritmo de 'Vaciar Base de Datos' y 'Eliminar Usuario' para rastrear recursivamente todos los identificadores del usuario (ID de Auth, Enterprise ID, Email e IDs de Empleados asociados). Se incorporó un escaneo de respaldo en memoria sobre las colecciones de Ventas y Cobranzas para asegurar la eliminación del 100% de los registros sin importar qué rol o empleado los haya registrado."
    ]
  },
  {
    version: "4.34.1",
    date: new Date().toISOString().split('T')[0],
    changes: [
      "Corrección de Tipo en Componente ErrorBoundary: Se resolvió la incompatibilidad del verificador de tipos de TypeScript (`tsc --noEmit`) en la invocación del método de reinicio del estado (`setState`), garantizando compilaciones y workflows de integración continua (CI/CD GitHub Actions) 100% exitosos sin errores de compilación."
    ]
  },
  {
    version: "4.34.0",
    date: new Date().toISOString().split('T')[0],
    changes: [
      "Vaciado Integral de Base de Datos Multicolección y Lotes Segmentados: Se expandió la función 'Vaciar Base de Datos' del SuperAdmin para escanear y purgar automáticamente TODOS los módulos y colecciones Firestore vinculados al usuario o empresa (Cheques, Facturas, Beneficiarios, Ventas, Cobranzas, Empleados, Presupuestos, Bodegas, Artículos, Inventario, Préstamos/Devoluciones, Transferencias y Logs de Buró). Se integró además procesamiento por lotes (chunked batch commit de máximo 400 operaciones) para garantizar una ejecución impecable sin importar el volumen de registros."
    ]
  },
  {
    version: "4.33.1",
    date: new Date().toISOString().split('T')[0],
    changes: [
      "Bloqueo de Desplazamiento de Fondo y Desenfoque Global Completo (100% Viewport): Se eliminó la aceleración GPU del contenedor principal de layout para permitir que las ventanas modales se fijen correctamente a la ventana del navegador. Además, se implementó un bloqueo automático de scroll (`body overflow: hidden`) para prevenir que el fondo se deslice al interactuar con cualquier modal (Ventas, Cobranzas, Simulación de Sesión, etc.), manteniendo la tarjeta perfectamente centrada y el efecto de desenfoque (`backdrop-blur-md`) cubriendo el 100% de la pantalla."
    ]
  },
  {
    version: "4.33.0",
    date: new Date().toISOString().split('T')[0],
    changes: [
      "Ocultamiento Automático del Dock en Modales (Opción A): Se implementó un detector reactivo inteligente que oculta de forma fluida la barra flotante (Dock) y botones flotantes cuando se abre cualquier ventana emergente o modal, garantizando un desenfoque de fondo limpio de borde a borde y previniendo cualquier obstrucción visual en las planillas de Ventas y Cobranzas."
    ]
  },
  {
    version: "4.32.2",
    date: new Date().toISOString().split('T')[0],
    changes: [
      "Ajuste de Superposición Visual (z-index): Se elevó la capa de superposición de las ventanas modales de Registro de Ventas, Cobranzas y Formularios (z-[100]) por encima de la barra de navegación flotante Dock (z-40), garantizando que los botones de acción e inputs inferiores no sean tapados ni obstruidos."
    ]
  },
  {
    version: "4.32.1",
    date: new Date().toISOString().split('T')[0],
    changes: [
      "Optimización en Dashboard: Eliminación del botón duplicado de 'Crear Reporte Personalizado' en la parte inferior del Dashboard, conservando únicamente el botón principal 'Generar Reporte' en la cabecera superior."
    ]
  },
  {
    version: "4.32.0",
    date: new Date().toISOString().split('T')[0],
    changes: [
      "Notificación Flotante con Progreso de Importación: Se implementó una tarjeta flotante dinámica en Configuración > Respaldos que muestra en tiempo real el porcentaje de avance (0% - 100%), la colección actual en proceso (Empleados, Ventas, Cobranzas, etc.) y la cantidad exacta de registros importados en la base de datos."
    ]
  },
  {
    version: "4.31.0",
    date: new Date().toISOString().split('T')[0],
    changes: [
      "Proyección Mensual en Rendimiento Comercial: Incorporación de cálculo automático de proyección a fin de mes (monto estimado y porcentaje respecto al presupuesto asignado) en cada tarjeta de empleado (ventas y cobranzas) utilizando la fórmula basada en el ritmo diario transcurrido del mes actual."
    ]
  },
  {
    version: "4.30.1",
    date: new Date().toISOString().split('T')[0],
    changes: [
      "Restricción Exclusiva a JSON en Importación de Respaldos: Se actualizó el selector de archivos y la validación en Configuración > Respaldos y Migración para permitir únicamente archivos en formato JSON (.json), deshabilitando la selección de hojas de cálculo Excel y mostrando un mensaje amigable al usuario."
    ]
  },
  {
    version: "4.30.0",
    date: new Date().toISOString().split('T')[0],
    changes: [
      "Manejo Amigable de Errores de Caché / Versión: Se implementó la detección automática de inconsistencias de carga de módulos (chunks) tras despliegues de actualización en ErrorBoundary, mostrando una notificación clara y un botón de actualización profunda del sistema.",
      "Aislamiento Multicuentas y Filtro Estricto de Empleados: Aplicación de filtro por empresa (`enterpriseId`) en los módulos de Empleados, Presupuestos y Ventas/Inventario, garantizando que cada empresa visualice única y exclusivamente su personal.",
      "Asignación Directa de Empleados por Empresa: Registro directo e independiente de empleados por cada cuenta sin reasignaciones automáticas ni intermediación.",
      "Gestión de Permisos y AuthContext: Inyección global de `isSuperAdmin` en el contexto de autenticación y protección de consultas sobre colecciones restringidas en Firestore.",
      "Asistente Guiado de Vinculación y Coexistencia Operativa: Incorporación de Wizard modal para vinculación de usuarios por correo a empresas matriz y unificación de personal en el Directorio Comercial."
    ]
  },
  {
    version: "4.26.0",
    date: new Date().toISOString(),
    changes: [
      "Optimización de Consultas de Respaldos (Exportación JSON/Excel): Se actualizaron las consultas de Firestore en la sección de Configuración para filtrar explícitamente por el identificador de empresa/usuario.",
      "Compatibilidad con Reglas de Seguridad en Producción: Garantiza que la exportación de copias de seguridad se complete exitosamente sin ser bloqueada por permisos en entornos de producción desplegados."
    ]
  },
  {
    version: "4.25.0",
    date: new Date().toISOString(),
    changes: [
      "Consolidación de Rol Supervisor de Cobranza: El total recaudado y efectivo retenido del Supervisor de Cobranza ahora refleja automáticamente la sumatoria global de todas las cobranzas del equipo.",
      "Restricción de Registro Individual: Se excluyó al Supervisor de Cobranza del formulario 'Nueva Cobranza' para evitar la asignación de cobranzas individuales a dicho rol.",
      "Desglose Consolidado: Al expandir la tarjeta del Supervisor de Cobranza se muestra el detalle con el nombre de cada cobrador y una etiqueta distintiva de sumatoria consolidada."
    ]
  },
  {
    version: "4.24.0",
    date: new Date().toISOString(),
    changes: [
      "Aislamiento Estricto Multitenant durante Simulación e Importación: Se eliminaron los fallbacks globales y las reasignaciones automáticas hacia cuentas superadministradoras.",
      "Garantía de Cuentas Limpias: Todo usuario nuevo o simulado que no tenga registros importados se mantendrá en estado completamente limpio (0 registros) sin heredar ni reasignar empleados, ventas, cobranzas o presupuestos de otros usuarios.",
      "Comportamiento de Simulación Preciso: Las acciones realizadas durante la simulación de sesión pertenecen y se guardan única y exclusivamente bajo el id del usuario simulado."
    ]
  },
  {
    version: "4.23.1",
    date: new Date().toISOString(),
    changes: [
      "Solución al Error de Reconciliación DOM 'insertBefore': Aislamiento de nodos de texto en etiquetas 'span' dentro del módulo de Cobranzas y modales, previniendo choques con extensiones de traducción automática del navegador.",
      "Sincronización Automática de Mes al Ingresar Cobranza Anterior: Al registrar o editar una cobranza con fecha correspondiente a un mes anterior, el sistema cambia automáticamente el filtro visual del mes para reflejar y mostrar inmediatamente la cobranza guardada.",
      "Recuperación Amigable en ErrorBoundary: Incorporación del botón 'Reintentar Acción' en la pantalla de captura de excepciones para restaurar la interfaz sin obligar al usuario a recargar la página completa."
    ]
  },
  {
    version: "4.23.0",
    date: new Date().toISOString(),
    changes: [
      "Diagnóstico y Corrección de Inflación de Valores Moneda: Identificación de la causa raíz de la variación de montos (donde $560K pasó a $5.84M en la macro Equifax).",
      "Tipificación Numérica Nativa en Celdas Excel: Aplicación de celda tipo 'n' (Native Number) con formato estándar '0.00' para todas las columnas de valor monetario (val_operacion, val_xvencer, val_vencido, val_dem_judicial, val_cart_castigada, deuda_refinanciada, VALOR_NDI).",
      "Eliminación de Advertencias 'Número como Texto': Eliminación completa de alertas de texto y triángulos verdes en Excel, permitiendo que la fórmula =SUMA(...) opere de forma nativa y evitando multiplicaciones indebidas durante la ejecución de la Macro Equifax."
    ]
  },
  {
    version: "4.22.3",
    date: new Date().toISOString(),
    changes: [
      "Análisis exhaustivo del código VBA de la Macro oficial Equifax (MACRO_SICOM_v2): Identificación del origen exacto del 'Error 13: No coinciden los tipos' en la función 'formatoFechaa'.",
      "Normalización Estricta de Exportación Excel: Aplicación obligatoria de parseAndFormatDate en todas las columnas de fecha (fec_corte_saldo, fec_concesion, fec_nacimiento, fec_vencimiento, FECHA_PAGO_CUOTA) garantizando cadenas de exactamente 10 caracteres ('yyyy/MM/dd').",
      "Omisión Total de Subrutina VBA conflictiva: Al ser celdas de texto plano de 10 caracteres, la condición 'If Len(cad) >= 11' de la macro se evalúa como Falsa, evitando por completo la casting de fecha que causaba el fallo."
    ]
  },
  {
    version: "4.22.2",
    date: new Date().toISOString(),
    changes: [
      "Solución Definitiva Error 13 Macro Equifax (Len >= 11): Exportación de fechas en celdas de texto estricto ('s') con longitud exacta de 10 caracteres ('yyyy/MM/dd').",
      "Prevención de Ejecución de Subrutina VBA 'formatoFechaa': Al garantizar Len(cad) = 10 en celdas de fecha, la macro de Equifax omite automáticamente la conversión de fecha-hora que provocaba el fallo 'Error 13: No coinciden los tipos' en Excel."
    ]
  },
  {
    version: "4.22.1",
    date: new Date().toISOString(),
    changes: [
      "Corrección de Incompatibilidad con Macro Equifax (Error 13 Tipo No Coinciden): Depuración estricta de componentes de hora/minuto en todas las columnas de fecha (fec_corte_saldo, fec_concesion, fec_nacimiento, fec_vencimiento, FECHA_PAGO_CUOTA).",
      "Asignación Explícita de Formato 'Fecha Corta' en Excel: Las celdas de fechas en el archivo .xlsx generado se exportan formalmente bajo el tipo y formato 'yyyy/mm/dd' (Fecha Corta), eliminando el formato 'General' que provocaba el fallo de conversión en VBA."
    ]
  },
  {
    version: "4.22.0",
    date: new Date().toISOString(),
    changes: [
      "Estructura de Nombre Oficial 2968_(FECHA_DE_CORTE): Implementado el cálculo dinámico del nombre del archivo principal de salida en formato '2968_DDMMYYYY.xlsx' (extraído de fec_corte_saldo del lote) y 'Cedulas_Incompletas_DDMMYYYY.xlsx'.",
      "Incorporación de Reglas de Validación Equifax: Añadida la depuración estricta de números telefónicos repetitivos (ej. 999999999) y la validación de género (M/F) según la Guía de Errores Equifax.",
      "Soporte Dual de Exportación (.xlsx y .gjm): Añadida la exportación directa en formato de texto plano delimitado por punto y coma (.gjm) con codificación UTF-8 preservando ceros a la izquierda."
    ]
  },
  {
    version: "4.21.2",
    date: new Date().toISOString(),
    changes: [
      "Corrección de Mapeo del Número de Operación (CRED-XXXXXXX): Se corrigió la regla de precedencia en la detección de cabeceras para evitar que la columna 'val_operacion' sobrescribiera el campo 'num_operacion', preservando intactos los códigos alfanuméricos de operación (ej. CRED-0506140) y asegurando su formato de texto en las exportaciones a Excel."
    ]
  },
  {
    version: "4.21.1",
    date: new Date().toISOString(),
    changes: [
      "Secuencia Oficial de 28 Columnas de Equifax: Se ajustó el motor de parsing y exportación Excel para respetar exactamente el orden secuencial de las 28 columnas de la matriz oficial de Equifax (cod_tipo_id, cod_id_sujeto, nom_sujeto, direccion, ciudad, telefono, fec_corte_saldo, tipo_deudor, num_operacion, fec_concesion, val_operacion, val_xvencer, val_vencido, val_dem_judicial, val_cart_castigada, num_dias_vencido, fec_nacimiento, deuda_refinanciada, fec_vencimiento, REPORTADO, FACTURAS_PAGADAS, PARROQUIA, EMAIL, GENERO, ESTADO_CIVIL, ESTADO_OPERACION, VALOR_NDI, FECHA_PAGO_CUOTA)."
    ]
  },
  {
    version: "4.21.0",
    date: new Date().toISOString(),
    changes: [
      "Compatibilidad Multiformato y Delimitación Flexible en Buró: Se añadió soporte nativo para importar archivos Excel (.xlsx, .xls) convirtiéndolos automáticamente a la estructura requerida, así como detección inteligente de delimitadores (;, coma, tabulación, tubería) y mapeo dinámico por nombres de columnas en la cabecera.",
      "Asignación Automatizada de Fecha de Corte y Tolerancia de Cartera: Se implementó la asignación automática de fecha de corte predeterminada (DD/MM/YYYY) cuando el archivo fuente carece de ella, evitando la eliminación masiva de registros en la Fase 7, y se flexibilizó el cálculo de deudas activas en la Fase 9."
    ]
  },
  {
    version: "4.20.0",
    date: new Date().toISOString(),
    changes: [
      "Rehabilitación del Módulo de Buró de Crédito: Se reincorporó la navegación y enrutamiento hacia la pestaña de Buró de Crédito (/buro) dentro del menú Finanzas, permitiendo procesar y estructurar la cartera mediante el motor de validación Módulo 10 de Equifax, auditoría en 12 fases y exportación de archivos limpios e incompletos.",
      "Reglas de Seguridad para Registros del Buró: Se habilitó el acceso seguro en Firestore para la colección 'buro_logs' vinculada al usuario/empresa actual."
    ]
  },
  {
    version: "4.19.3",
    date: new Date().toISOString(),
    changes: [
      "Ajuste de Reglas de Seguridad Firestore: Se actualizaron las reglas de seguridad desplegadas en Firebase para permitir que la importación y migración de respaldos en colecciones de cheques, facturas y beneficiarios reconozca la propiedad del usuario/empresa sin bloquearse por restricciones históricas de timestamp o referencias cruzadas."
    ]
  },
  {
    version: "4.19.2",
    date: new Date().toISOString(),
    changes: [
      "Migración Completa de Usuario: Se actualizó el motor de migración administrativa para buscar y transferir todas las colecciones (cheques, facturas, beneficiarios, ventas, cobranzas, empleados, presupuestos e inventario) identificando coincidencias por usuario o empresa y ejecutando cambios en lotes de 400 escrituras.",
      "Importación JSON Tolerante: Se mejoró la importación de respaldos JSON en Configuración para desempaquetar estructuras anidadas, normalizar nombres de colecciones y mostrar mensajes descriptivos de error."
    ]
  },
  {
    version: "4.19.1",
    date: new Date().toISOString(),
    changes: [
      "Optimización de Importación Masiva: Se corrigió el error al importar archivos JSON con más de 500 registros procesándolos en lotes fragmentados (batches) de 400 escrituras y limpiando valores no definidos para garantizar el guardado en Firestore sin sobrepasar los límites de transacción."
    ]
  },
  {
    version: "4.19.0",
    date: new Date().toISOString(),
    changes: [
      "Unificación de Personal y Presupuestos: Se consolidaron registros de empleados duplicados bajo Almacenes Derick (creditosderick15@gmail.com).",
      "Vincular Ventas y Cobranzas: Se asociaron todas las ventas, presupuestos y cobranzas guardadas a la empresa Almacenes Derick sin duplicar registros."
    ]
  },
  {
    version: "4.18.8",
    date: new Date().toISOString(),
    changes: [
      "Sistema reestablecido con éxito a la versión 4.18.8."
    ]
  },
  {
    version: "4.14.8",
    date: new Date().toISOString(),
    changes: [
      "Corrección de visualización en módulo de Cobranzas: Se asegura que se muestren todas las cobranzas de la empresa (sin ocultarlas por inconsistencias de empleados eliminados) y se evita el error de permisos en Firebase al buscar registros globales."
    ]
  },
  {
    version: "4.14.7",
    date: new Date().toISOString(),
    changes: [
      "Se ha silenciado el error inofensivo de permisos al intentar registrar versiones automáticamente por usuarios sin rol de administrador."
    ]
  },
  {
    version: "4.14.6",
    date: new Date().toISOString(),
    changes: [
      "Eliminación temporal de restricciones complejas en reglas de Firestore (users) para mitigar bloqueo de permisos al activar cuenta (Onboarding)."
    ]
  },
  {
    version: "4.14.5",
    date: new Date().toISOString(),
    changes: [
      "Relajación temporal de las reglas de actualización en base de datos para identificar el bloqueo de permisos al activar la cuenta (Onboarding).",
      "Optimización en la evaluación de campos durante la edición del perfil de usuario."
    ]
  },
  {
    version: "4.14.4",
    date: new Date().toISOString(),
    changes: [
      "Añadido botón de retroceso (volver al Login) en la vista de Configuración Maestro (Onboarding).",
      "Confirmación de resolución de permisos en Firestore que bloqueaban el registro del primer usuario."
    ]
  },
  {
    version: "4.14.3",
    date: new Date().toISOString(),
    changes: [
      "Implementado `checkUserExists` explícito en `AuthContext` durante el flujo de inicio de sesión con Google para asegurar la creación del perfil.",
      "Corrección de permisos en Firestore Rules permitiendo la creación de nuevos usuarios y administradores correctamente.",
    ]
  },
  {
    version: "4.14.2",
    date: new Date().toISOString(),
    changes: [
      "Corregido problema de permisos de Security Rules para la actualización de perfiles de usuario y administradores.",
      "Ajustes en Firestore Rules para evitar rechazos en el proceso de creación/actualización por campos faltantes o valores nulos.",
    ]
  },
  {
    version: "4.14.1",
    date: new Date().toISOString(),
    changes: [
      "Corregido error de permisos (Security Rules) al registrar nuevos usuarios mediante Google.",
      "Añadido borrado de PIN por seguridad al bloquear la sesión por inactividad.",
      "Optimización en la carga y separación de preferencias de usuario entre distintas cuentas.",
      "Implementación de Meta Tags Open Graph en index.html para Rich Link Previews."
    ]
  },
  {
    version: "4.14.0",
    date: new Date().toISOString(),
    changes: [
      "Refactorización profunda del submódulo Empleados integrando la gestión de Presupuestos.",
      "Implementación de nuevos roles para Supervisores de Ventas y Cobranza, con objetivos y metas globales.",
      "Mejoras en el Dashboard de Rendimiento Comercial con tarjetas dinámicas expandibles para vendedores y cobradores.",
      "Paginación implementada en Finanzas (Consultas) y Comercio (Cobranzas).",
      "El Registro de Cobranzas ahora agrupa registros por cobrador en tarjetas expandibles.",
      "Dashboard Bodegueros: visualización de stock real en préstamo en Casas Comerciales y alertas (>=3 uds).",
      "Lógica predictiva y restrictiva para Devoluciones de Casas Comerciales basada en stock real en consignación.",
      "Permiso para cargar, subir o importar foto de perfil (Google/URL/Archivo).",
      "Correcciones de usabilidad en inputs numéricos e inputs en versión móvil.",
    ],
  },
  {
    version: "4.18.0",
    date: new Date().toISOString(),
    changes: [
      "Aislamiento de Configuración de Simulación: Se rediseñó el SettingsProvider para usar useAuth, lo que permite cargar en tiempo real las preferencias (tema, estilo de UI, paleta de colores) del usuario simulado.",
      "Lógica Temporal de Preferencias en Simulación: Los cambios visuales realizados mientras el administrador simula la sesión de otro usuario son puramente en memoria, impidiendo que afecten o pisen de forma permanente la configuración propia del administrador.",
      "Permanencia de Tarjetas de Rendimiento Comercial: Se eliminó el botón de contracción y la lógica de colapso en las tarjetas del dashboard, dejándolas completamente desplegadas de forma estática para facilitar una lectura rápida.",
      "Mejora de Contraste en Recuperación de PIN: Se incrementó el contraste del texto en el modal de restablecimiento del PIN de seguridad en temas claros y oscuros, aplicando colores legibles y tipografía estilizada.",
    ],
  },
  {
    version: "4.17.0",
    date: new Date().toISOString(),
    changes: [
      "Rediseño del módulo de Comercio-Ventas: Ahora agrupa las ventas por vendedor en tarjetas expandibles, mostrando un resumen compacto y permitiendo ver el detalle de ventas del último mes seleccionado, similar al módulo de cobranzas.",
      "Mejora en Dashboard (Rendimiento Comercial): Se muestran únicamente los empleados con presupuestos asignados, e incluye agrupación jerárquica para supervisores de ventas y cobranzas. Las tarjetas ahora son expandibles.",
      "Mejora de UX en pantalla de seguridad (2FA): Restablecer el PIN con el código de autenticador ya no requiere doble clic, se inicia la sesión inmediatamente tras la validación exitosa.",
      "Corrección del estado global: Las preferencias de interfaz (modo oscuro/claro) se mantienen independientes por usuario, incluso al usar la simulación de administrador.",
    ],
  },
  {
    version: "4.16.6",
    date: new Date().toISOString(),
    changes: [
      "Corrección de renderizado en modal de recuperación: Se arregló un problema que impedía visualizar correctamente el flujo de verificación 2FA al hacer clic en '¿Olvidaste tu PIN?' dentro de la pantalla de bloqueo (SecurityGuard).",
    ],
  },
  {
    version: "4.16.5",
    date: new Date().toISOString(),
    changes: [
      "Aislamiento Absoluto de Preferencias Visuales: Se rediseñó el proceso de combinación de configuraciones para filtrar y descartar cualquier propiedad visual del documento compartido de la empresa (como tema, estilo de UI, paleta cromática de acento, tipografía, ubicación del dock, etc.).",
      "Independencia Completa por Usuario: Ahora todas las opciones de personalización visual de la interfaz se determinan y cargan exclusivamente desde la colección individual de cada usuario ('userSettings'), asegurando que no haya herencia ni contaminación de estilos compartidos, y solucionando el parpadeo o reversión de estilos al cambiar entre Classic, Glasmorfismo y Liquid Glass."
    ],
  },

  {
    version: "4.16.4",
    date: new Date().toISOString(),
    changes: [
      "Optimización de persistencia y separación de UI: Se corrigió el problema de resincronización de preferencias donde el tema visual y estilo de UI del usuario individual volvían erróneamente a los valores por defecto o globales.",
      "Aislamiento de Escrituras en Firestore: Se separó la lógica de escritura para que los cambios de interfaz (tema, glasmorfismo, liquid-glass, paleta de colores) se guarden exclusivamente en la colección 'userSettings', evitando que las actualizaciones globales de la empresa pisen las preferencias individuales."
    ],
  },

  {
    version: "4.16.3",
    date: new Date().toISOString(),
    changes: [
      "Corrección de Permisos en Base de Datos: Se ajustaron las reglas de seguridad de Firestore para permitir el acceso correcto a los ajustes visuales y preferencias personales de la interfaz por usuario.",
      "Separación de Configuraciones UI: Cada usuario dentro de la misma empresa ahora puede mantener su propia personalización visual (tema oscuro, estilo cristal, paleta de colores) sin afectar al resto del equipo.",
      "Ajuste en la fórmula de alerta inteligente de inventario para préstamos activos: Cálculo dinámico basado en límite mínimo: Math.round((límite / 2) + 0.1)."
    ],
  },

  {
    version: "4.13.4",
    date: new Date().toISOString(),
    changes: [
      "Corrección de Permisos en Base de Datos: Se ajustaron las reglas de seguridad de Firestore para permitir que los administradores puedan consultar correctamente el registro de errores del sistema sin encontrar alertas de acceso denegado."
    ],
  },
  {
    version: "4.13.3",
    date: new Date().toISOString(),
    changes: [
      "Autenticación de 2 Factores (2FA): Se integró el soporte para Google Authenticator, permitiendo a los usuarios configurar desde el módulo de Configuración-Seguridad una llave de autenticación TOTP.",
      "Recuperación de PIN Segura: Se añadió la opción de restablecer el PIN desde la pantalla de bloqueo de sesión, utilizando el código de 6 dígitos generado por Google Authenticator."
    ],
  },
  {
    version: "4.13.2",
    date: new Date().toISOString(),
    changes: [
      "Optimización de Interfaz de Novedades: Se ajustó el modal de actualizaciones recientes para ser desplazable (scrollable), asegurando que el botón 'Continuar a la Plataforma' siempre sea visible en pantallas móviles.",
      "Seguridad de Autenticación Mejorada: Se actualizaron todos los campos de entrada de PIN en el sistema para deshabilitar autocompletado y evitar que gestores de contraseñas interfieran o guarden códigos.",
      "Sistema de Bloqueo Progresivo: Se implementó un temporizador de bloqueo en la pantalla de ingreso; tras 3 intentos fallidos, el acceso se bloquea progresivamente duplicando el tiempo (iniciando en 1 minuto y topando a un máximo de 3 días)."
    ],
  },
  {
    version: "4.13.1",
    date: new Date().toISOString(),
    changes: [
      "Unificación de Copias de Seguridad: Se eliminó el botón redundante de exportación de reporte en el explorador de pagos (Finanzas - Consultas), centralizando todas las operaciones de respaldo de datos en el panel de Configuración.",
      "Respaldo Completo de Base de Datos: Se mejoró el sistema de exportación y restauración para incluir las 13 colecciones completas de la base de datos (empleados, cheques, ventas, cobranzas, artículos, facturas, beneficiarios, presupuestos, bodegas, inventarios de bodegas, préstamos, transferencias y ventas de inventario).",
      "Soporte Multitenant en Simulaciones: Se optimizó el filtrado por inquilino (enterpriseId/userId) para asegurar que, al simular una sesión como Super-Administrador, los respaldos descargados y restaurados correspondan estrictamente a los datos del usuario simulado.",
      "Relación de Datos en Reportes: Se optimizó el reporte de Excel para vincular correctamente los cheques con sus números de factura reales y los artículos de inventario con las cantidades distribuidas por bodega."
    ],
  },
  {
    version: "4.13.0",
    date: new Date().toISOString(),
    changes: [
      "Auto-bloqueo de Sesión: Se implementó un detector de inactividad que monitorea los eventos del usuario y bloquea automáticamente la terminal si se supera el tiempo establecido.",
      "Optimización de Interfaz: Se removió el ícono duplicado de Usuario en el dock de navegación inferior para evitar redundancias con la opción de Configuración.",
      "Exportación en Excel Avanzada: Ahora los respaldos en Excel cuentan con hojas estructuradas (Empleados, Cheques, Ventas, Cobranza, Inventario) y datos correctamente formateados de acuerdo con las especificaciones.",
      "Seguridad de PIN Mejorada: Se rediseñó el flujo de actualización de PIN, requiriendo validación previa del PIN actual y doble confirmación del nuevo PIN para prevenir alteraciones no autorizadas."
    ],
  },
  {
    version: "4.12.2",
    date: new Date().toISOString(),
    changes: [
      "Depuración Completa de Referencias de Auditoría: Se eliminó el correo de superadministrador hardcodeado que aún persistía en la sección de variables de ejemplo del archivo README.md, garantizando que ninguna traza del correo personal del desarrollador quede expuesta en la documentación o código de control de versiones. Se ajustó el archivo de especificación de seguridad para enfocar el testing de seguridad en simulaciones reales del Firebase Rules Playground."
    ],
  },
  {
    version: "4.12.1",
    date: new Date().toISOString(),
    changes: [
      "Eliminación de Datos Hardcodeados y Remoción de Vulnerabilidades: Se removió por completo la dirección de correo personal hardcodeada en el código fuente de 4 archivos (server.ts, src/lib/utils.ts, y sus correspondientes tests unitarios), de forma que toda validación de cuentas de superadministrador dependa estrictamente de las variables de entorno configurables en el servidor (VITE_SUPER_ADMIN_EMAIL y VITE_SUPER_ADMIN_EMAILS). Asimismo, se quitó el riesgo latente de exposición de claves API borrando el define de GEMINI_API_KEY de vite.config.ts para que no se inyecte en el bundle de cliente. Finalmente, se reescribió security_spec.md para reflejar con absoluta precisión las reglas reales e integras desplegadas en firestore.rules, incluyendo procedimientos de validación real en el simulador de Firebase."
    ],
  },
  {
    version: "4.12.0",
    date: new Date().toISOString(),
    changes: [
      "Seguridad Multi-inquilino de Extremo a Extremo en Finanzas (Checks, Invoices, Beneficiaries): Corrección integral de las reglas de seguridad de Firestore (`firestore.rules`) y de la validación lógica para listados y lecturas directas. Se migró la restricción estricta de propiedad por usuario creador (`userId == request.auth.uid`) hacia la política dinámica multi-inquilino corporativa unificada (`isEnterpriseData`). Esto soluciona de raíz el error donde el propietario de una cuenta corporativa o sus empleados autorizados (como bodegueros) veían la base de datos completamente vacía al iniciar sesión directamente, mientras que en la simulación administrativa sí se visualizaba. Ahora todos los datos financieros son legibles y protegidos de forma segura bajo el mismo Tenant ID empresarial (`enterpriseId`)."
    ],
  },
  {
    version: "4.11.1",
    date: new Date().toISOString(),
    changes: [
      "Optimización Index-Free para Multi-Inquilinato: Reestructuración de las consultas clave de Cheques, Ventas y Cobranzas en el Dashboard y reportes avanzados. Ahora realiza búsquedas rápidas por `enterpriseId` y delega las exclusiones de estados o rangos de fechas a filtros del lado del cliente. Esto soluciona por completo las excepciones silenciosas de Firestore por falta de índices compuestos, resolviendo el problema de registros invisibles en cuentas corporativas."
    ],
  },
  {
    version: "4.11.0",
    date: new Date().toISOString(),
    changes: [
      "Gestión Dinámica de Roles y Multi-Administrador: Transición de correos electrónicos administradores hardcodeados a un sistema dinámico basado en Custom Claims y base de datos Firestore. Permite la asignación instantánea de roles (SUPERADMIN, ADMIN, etc.) desde la aplicación y sincroniza las credenciales inmediatamente mediante el nuevo endpoint del servidor backend `/api/admin/sync-claims`.",
      "Ampliación del Registro de Auditoría (Audit Log): Implementación de trazabilidad granular para mutaciones de datos críticas en Empleados (`EMPLOYEE_UPDATE`), Presupuestos (`BUDGET_UPDATE`), Ventas (`SALE_UPDATE`) y Cobranzas (`COLLECTION_UPDATE`).",
      "Seguimiento de Lecturas Sensibles: Incorporación de registro de auditoría (`SENSITIVE_READ`) al descargar copias de seguridad de la base de datos (formatos JSON/Excel) y exportar reportes comerciales personalizados a PDF o Excel.",
      "Seguridad Multi-inquilino en el Dashboard: Refactorización y robustecimiento de las consultas de cheques de pago e indicadores clave del tablero de control principal, garantizando aislamiento estricto y total visibilidad mediante la segmentación exclusiva por `enterpriseId` (tenant) en lugar de filtros individuales de usuario.",
      "Función de Redondeo Financiero de Precisión: Adición de la utilidad matemática `roundToTwo` para evitar de forma garantizada los errores de punto flotante en cálculos de centavos, respaldada por su propia suite de pruebas unitarias automatizadas."
    ],
  },
  {
    version: "4.10.0",
    date: new Date().toISOString(),
    changes: [
      "Estructuración de Pruebas Unitarias Automatizadas: Integración del framework de pruebas ultra-rápido Vitest, con la creación de una suite de pruebas para funciones de cálculo matemático crítico (algoritmo Penny Drop para cuotas), formateadores de monedas ecuatorianas, generación incremental de números de cheques con padding, y detección de superadministradores.",
      "Configuración de CI/CD (Quality Assurance): Implementación de un flujo de integración continua en GitHub Actions (.github/workflows/ci.yml) para verificar de forma automatizada los tipos, la calidad del código mediante linter y la ejecución exitosa de pruebas unitarias ante cada push o pull request.",
      "Actualización e Identidad de Proyecto: Corrección del nombre del paquete en `package.json` de 'react-example' a 'control-financiero' para dotar al proyecto de una identidad pulida y profesional.",
      "Documentación Técnica Integral (README.md): Creación de un manual de arquitectura robusto que detalla el funcionamiento full-stack (React + Express), el modelo de seguridad por roles y Claims de Firebase, la estrategia de caché offline multidispositivo y las opciones de despliegue dual (Ventas/Producción VPS frente a Serverless en Vercel)."
    ],
  },
  {
    version: "4.9.1",
    date: new Date().toISOString(),
    changes: [
      "Auditoría y Corrección de Reglas de Seguridad (Firestore): Reestructuración de políticas de lectura para colecciones clave de finanzas (checks, invoices, beneficiaries). Ahora se restringe estrictamente el acceso de lectura para que solo el propietario (resource.data.userId == request.auth.uid) o un administrador puedan consultar estos registros de forma segura.",
      "Eliminación de Emails Hardcodeados en Reglas: Remoción de la verificación de email fija en firestore.rules para el rol SUPERADMIN. En su lugar, se implementó el uso estándar de Claims Personalizados de Firebase Auth y consultas dinámicas en la colección de usuarios.",
      "Sincronización de Custom Claims en Backend: Actualización del servidor Express en `/api/users/profile` para asignar y sincronizar automáticamente las credenciales personalizadas de administración (Custom Claims) en Firebase Auth utilizando el SDK Admin.",
      "Restauración de Verificación de Correo: Modificación del método isVerified() en las reglas para requerir que los usuarios tengan su correo verificado (email_verified == true) antes de otorgar acceso de escritura o lectura.",
      "Migración a Distribución Segura de SheetJS (xlsx): Reemplazo de la dependencia xlsx convencional de npm por el paquete empaquetado directamente desde su CDN oficial y seguro (https://cdn.sheetjs.com) para evitar vulnerabilidades críticas de Prototype Pollution y ReDoS.",
      "Eliminación de Archivos Temporales de Reglas: Limpieza de archivos de borrador obsoletos (como DRAFT_firestore.rules) en el repositorio para evitar despliegues accidentales inseguros."
    ],
  },
  {
    version: "4.9.0",
    date: new Date().toISOString(),
    changes: [
      "Persistencia de Caché Multitestaña en Firestore: Migración de la persistencia offline de una sola pestaña a la configuración moderna de caché persistente multi-pestaña (persistentLocalCache con persistentMultipleTabManager). Esto acelera drásticamente la velocidad de carga de la aplicación y previene errores y advertencias de 'failed-precondition' cuando múltiples pestañas del sistema están abiertas simultáneamente.",
      "Fragmentación Manual y Optimización de Carga (Vite / Rollup): Implementación de segmentación inteligente de dependencias pesadas (manualChunks) para separar módulos de Firebase, Lucide-React, Recharts y D3. Esto reduce el tamaño del bundle inicial descargado por el navegador, optimizando el rendimiento de la PWA sobre conexiones móviles lentas.",
      "Estructuración de Manejo de Errores Robustos: Preparación de la arquitectura de datos para diagnósticos óptimos ante posibles restricciones de permisos o límites de cuota diaria en el ecosistema de base de datos."
    ],
  },
  {
    version: "4.8.3",
    date: new Date().toISOString(),
    changes: [
      "Estandarización Absoluta del Dock Flotante: Unificación de todos los estilos de interfaz ('classic', 'glass', 'liquid-glass') bajo un diseño de dock flotante centrado y desacoplado, adaptándose fluidamente a cualquier posición (arriba, abajo, izquierda, derecha).",
      "Despliegue Dinámico de Submenús: Corrección del error que impedía visualizar los módulos y submódulos interactivos en las interfaces clásico y glassmorfismo al eliminar las restricciones de desborde y solapamientos.",
      "Ajuste de Espaciado del Canvas Principal: Corrección del padding de seguridad en el panel de contenidos de forma universal para evitar superposiciones con el dock en todas las configuraciones."
    ],
  },
  {
    version: "4.8.2",
    date: new Date().toISOString(),
    changes: [
      "Estandarización del Dock Flotante: Unificación de la estructura de dock flotante encapsulado para Glassmorfismo ('glass') y Liquid Glass ('liquid-glass'), corrigiendo el error que provocaba que se renderizara la barra rígida clásica.",
      "Solución de Posicionamiento de Submenús: Se resolvió el error de navegación donde las opciones secundarias o submódulos no se visualizaban o se solapaban al expandir el menú colapsable, permitiendo una apertura flotante perfecta en coordenadas dinámicas.",
      "Aislamiento de Paddings Clásicos: Restricción del padding de contención del contenido principal en el layout únicamente cuando el dock flotante está activo, previniendo el espacio vacío artificial de 128px al utilizar el estilo de barra rígida Sólido Clásico."
    ],
  },
  {
    version: "4.8.1",
    date: new Date().toISOString(),
    changes: [
      "Optimización Antiflicker en Liquid Glass: Implementación de contención de desborde elástico (overscroll-y-none) y promoción de capas con aceleración por hardware (transform-gpu, translate3d, will-change: transform) en los paneles acrílicos, eliminando por completo los parpadeos visuales al alcanzar los límites de scroll en el Dashboard.",
      "Ubicación Dinámica del Cuadro de Confirmación: Corrección del solapamiento del cuadro de confirmación de la posición de la barra de navegación; ahora, cuando el Dock está posicionado abajo (bottom), la confirmación se desplaza elegantemente a la parte superior (top-6) para no obstruir los botones de guardar cambios."
    ],
  },
  {
    version: "4.8.0",
    date: new Date().toISOString(),
    changes: [
      "Unificación de Barra de Navegación (Dock): Estandarización de toda la plataforma en una barra de navegación tipo Dock flotante unificada para los tres estilos de interfaz (Sólido Moderno, Glassmorfismo y Liquid Glass).",
      "Eliminación de Márgenes de Panel Sólido: Corrección estética para evitar que la barra lateral ocupe márgenes rígidos que bloqueaban la pantalla, abriendo todo el lienzo visual en una estructura integrada.",
      "Interacciones Fluidas: Soporte reactivo en el Dock que optimiza las burbujas flotantes de submenús, el efecto de magnificación macOS-style opcional, y transiciones dinámicas según el tema claro u oscuro."
    ],
  },
  {
    version: "4.7.4",
    date: new Date().toISOString(),
    changes: [
      "Optimización de Rendimiento GPU: Conversión de las animaciones de los globos de fondo a transformaciones 3D aceleradas por hardware (translate3d), aliviando la carga del CPU.",
      "Aislamiento de Capas de Renderizado: Implementación de la propiedad CSS de contención visual (contain: paint) y promoción de capa en el contenedor principal de fondos, previniendo re-cálculos de píxeles al hacer scroll.",
      "Fluidez en Desplazamiento: Eliminación absoluta de parpadeos y retrasos visuales durante la navegación e interacciones en toda la aplicación, logrando un rendimiento óptimo idéntico al Glassmorfismo."
    ],
  },
  {
    version: "4.7.3",
    date: new Date().toISOString(),
    changes: [
      "Ajuste y Sincronización de Fondos: Reversión de los cambios en el fondo de Glassmorfismo a su estado original óptimo y estático con su sutil pulso clásico.",
      "Vibración en Liquid Glass: Mantenimiento y perfeccionamiento de la paleta cromática profunda y la animación fluida en el fondo de Liquid Glass, garantizando una refracción acrílica de máxima fidelidad.",
      "Estabilidad Visual: Optimización de las transiciones de fondo al alternar entre ambos estilos de interfaz."
    ],
  },
  {
    version: "4.7.2",
    date: new Date().toISOString(),
    changes: [
      "Fondos Orgánicos Líquidos Avanzados: Integración de la paleta de colores profundos y vibrantes de Glassmorphism en el modo 'Liquid Glass' para maximizar su refracción translúcida y textura acrílica.",
      "Animaciones de Deriva Fluida (Fluid Drift): Creación de fotogramas de animación lenta en CSS para mover, pulsar y rotar de manera orgánica las esferas de color desenfocadas bajo los paneles de cristal.",
      "Optimización del Modo Oscuro: Ajuste de tonos, saturaciones de color y un 'wash overlay' en el modo oscuro para garantizar contrastes impecables, profundidad visual y un look premium consistente."
    ],
  },
  {
    version: "4.7.1",
    date: new Date().toISOString(),
    changes: [
      "Auto-colapso de Submenús en Liquid Glass: Corrección de comportamiento para garantizar que, al hacer clic en un módulo del dock, se contraigan y cierren automáticamente todos los demás submenús abiertos de manera elegante.",
      "Cierre de Submenús en Navegación Directa: Asegura que al hacer clic en enlaces directos sin submenús (como Configuración o Dashboard) o al cerrar sesión, se limpien todos los submenús activos del Dock.",
      "Animaciones de Cierre Premium: Implementación de transiciones de escala y opacidad con Framer Motion (<AnimatePresence>) para que los submenús se contraigan de forma fluida hacia el botón del que brotaron."
    ],
  },
  {
    version: "4.7.0",
    date: new Date().toISOString(),
    changes: [
      "Efecto de Magnificación del Dock: Implementación del efecto de magnificación de iconos al pasar el cursor (hover zoom) para la interfaz de 'Liquid Glass', configurable por el usuario.",
      "Configuración de Proximidad: Soporte para aumentar el tamaño de los iconos vecinos adyacentes para una fluidez interactiva premium idéntica a macOS.",
      "Modos de Magnificación: Inclusión de dos algoritmos de zoom ('Escala Visual' y 'Ajuste de Tamaño Físico') completamente controlables desde el apartado de Ajustes.",
      "Diseño Líquido Adaptativo: Optimización de los menús flotantes, globos de submenús con Glassmorphism translúcido (20px blur) y tooltips flotantes inteligentes para modos de escritorio y móviles."
    ],
  },
  {
    version: "4.6.7",
    date: new Date().toISOString(),
    changes: [
      "Optimización de PWA: Generación y despliegue de iconos PWA específicos ('maskable') de alta resolución (192x192 y 512x512) centrados en zona segura (65% del área con fondo blanco) para una visualización premium en launchers de Android e iOS.",
      "Ajuste del Manifiesto: Actualización en `vite.config.ts` vinculando los recursos específicos `/maskable-192x192.png` y `/maskable-512x512.png` con propósito 'maskable', garantizando compatibilidad y eliminando recortes indeseados."
    ],
  },
  {
    version: "4.6.6",
    date: new Date().toISOString(),
    changes: [
      "Identidad Visual: Integración del nuevo logotipo oficial corporativo en formato vectorial SVG (`logo.svg`) para una definición impecable y carga ultra-rápida.",
      "Integración de PWA: Generación y despliegue de los recursos estáticos del manifest (iconos PWA en 192x192, 512x512, maskable e icono Apple Touch) utilizando renderizado de alta fidelidad con Sharp.",
      "Consistencia de Interfaz: Actualización visual del acceso en la pantalla de inicio de sesión (`Login.tsx`) y del encabezado de la barra lateral (`Layout.tsx`) integrando el nuevo logotipo en marcos optimizados."
    ],
  },
  {
    version: "4.6.5",
    date: new Date().toISOString(),
    changes: [
      "Auditoría de Seguridad: Eliminación completa de correos electrónicos hardcodeados en las reglas de seguridad de Firestore, reemplazados por claims de autenticación y mapeo dinámico de roles.",
      "Reforzamiento de Reglas de Acceso: Restricción y validación estricta en colecciones empresariales (empleados, presupuestos, ventas, cobros, etc.) mediante el validador `isEnterpriseData` para evitar fugas de datos entre organizaciones.",
      "Limpieza de Workspace: Remoción total de scripts temporales y de diagnóstico obsoletos (`fix_*`, `patch_*`) del directorio raíz para asegurar un código base limpio y profesional."
    ],
  },
  {
    version: "4.6.4",
    date: new Date().toISOString(),
    changes: [
      "Solución al problema de 'Missing or insufficient permissions' para perfiles de Super Administrador en las reglas de seguridad de Firestore.",
      "Optimización de la creación de perfiles utilizando `serverTimestamp()` para cumplir estrictamente con los esquemas de validación de Firestore.",
      "Ajuste en la lógica de CheckSearch, CheckEntry y Sales para asegurar la visualización y permisos correctos con el rol 'SUPERADMIN'."
    ],
  },
  {
    version: "4.6.3",
    date: new Date().toISOString(),
    changes: [
      "Solución al problema de detección del rol de Super Administrador en producción.",
      "Asignación robusta y automática del rol 'SUPERADMIN' y omisión del flujo de onboarding para el correo principal.",
      "Soporte para administrar cuentas con el rol de SUPERADMIN desde la consola de administración de usuarios."
    ],
  },
  {
    version: "4.6.2",
    date: new Date().toISOString(),
    changes: [
      "Corrección de bug crítico de redirecciones infinitas durante el inicio de sesión",
      "Mejora en la creación de perfiles locales como respaldo"
    ],
  },
  {
    version: "4.6.1",
    date: new Date().toISOString(),
    changes: [
      "Corrección de layout cuando el menú está arriba o abajo (evita que el contenido principal desaparezca)",
      "Mejora del contraste y fondo de Liquid Glass para que los cambios sean notorios"
    ],
  },
  {
    version: "4.6.0",
    date: new Date().toISOString(),
    changes: [
      "Temporizador de confirmación de 15 segundos al cambiar la ubicación del panel lateral",
      "Nuevo estilo de interfaz Liquid Glass con fondos dinámicos",
      "Soporte para fondos personalizados, gradientes y animados en Liquid Glass",
      "Corrección de legibilidad del texto en el modo oscuro + glassmorfismo"
    ],
  },
  {
    version: "4.5.0",
    date: new Date().toISOString(),
    changes: [
      "Reestructuración completa del panel de Configuración con navegación por pestañas",
      "Añadida función de Respaldo y Migración de datos (JSON y Excel) con autenticación requerida",
      "Nuevas opciones de personalización visual: Paleta Cromática, Tipografías y Ubicación de Menú Dinámica",
      "Corrección de fijación del menú lateral para prevenir desplazamiento indeseado",
      "Optimización visual del modo Glassmorphism en temas oscuros",
      "Simplificación de la tabla de Administración de Usuarios (eliminación de iconos redundantes)",
    ],
  },
  {
    version: '4.4.1',
    date: new Date().toISOString(),
    changes: [
      'Corrección de bugs críticos: Reglas de permisos para lectura unificada en base de datos de facturas y beneficiarios.',
      'Corrección de orden de ejecución de hooks (useEffect) en Layout de la aplicación para evitar desbordamientos de renderizado.',
    ]
  },
  {
    version: '4.4.0',
    date: new Date().toISOString(),
    changes: [
      'Efecto Glassmorphism Avanzado implementado con gradientes CSS inspirados en diseño 3D y elementos flotantes.',
      'Separación de funcionalidades de Admin (Usuarios, Asignación, Versiones, Auditoría, Papelera) en rutas y vistas independientes en el menú.',
    ]
  },
  {
    version: '4.3.0',
    date: new Date().toISOString(),
    changes: [
      'Estilo visual "Glassmorfismo" con opciones de personalización (Sólido/Glass).',
      'Nueva barra lateral colapsable para maximizar el espacio de trabajo.',
      'Módulo de Inventario migrado a estructura de submódulos laterales.',
      'Panel de Administración reestructurado en submódulos para mejor organización.',
      'Nuevo submódulo de Notificaciones de Error en el Panel de Administración.',
      'Soporte robusto para manejo de estados de red (Cargando, Error, Vacío) en módulos.',
      'Corrección de flujo de Onboarding que impedía acceso a usuarios nuevos (loop infinito).',
      'Secciones inexistentes ahora muestran una página 404 detallada y un acceso rápido al Dashboard.',
      'Actualización en el icono de Inventario para distinguirlo del módulo de Comercio.'
    ]
  },

  {
    version: '4.2.4',
    date: new Date().toISOString().split('T')[0],
    changes: [
      'Seguridad: Se han movido los correos electrónicos de los administradores super usuarios del código fuente a variables de entorno (VITE_SUPER_ADMIN_EMAILS) para mayor protección y confidencialidad.'
    ]
  },

  {
    version: '4.2.3',
    date: new Date().toISOString().split('T')[0],
    changes: [
      'Validación Estricta de Código de Barras: Se añadió un cuadro de diálogo de confirmación obligatorio en Ingreso de Mercadería al detectar un código de barras ya registrado, previniendo duplicados.',
      'Mejora UI Ventas de Almacén: Reemplazada la lista desplegable nativa de artículos por el selector inteligente con búsqueda y soporte integrado para selección de series y lotes.'
    ]
  },

  {
    version: '4.2.2',
    date: new Date().toISOString().split('T')[0],
    changes: [
      'Actualización del nombre automático: El nombre de un artículo ahora se genera automáticamente utilizando la fórmula Categoría + Marca + Modelo + Código de Barras (opcional) de forma estandarizada.'
    ]
  },

  {
    version: '4.2.1',
    date: new Date().toISOString().split('T')[0],
    changes: [
      'Nombre Automático de Artículo: El campo "Nombre del Artículo" en el formulario de Ingreso de Mercadería ahora es de solo lectura y se genera automáticamente combinando la Marca y el Modelo ingresados, evitando errores de tipeo y asegurando un formato estandarizado.'
    ]
  },

  {
    version: '4.2.0',
    date: '2026-07-11',
    changes: [
      'Búsqueda Predictiva: Se reemplazaron las listas desplegables convencionales en Transferencias, Préstamos y Ventas por un nuevo componente avanzado de autocompletado y búsqueda predictiva (por nombre, modelo, marca y código de barras).',
      'Soporte de Códigos de Barras: Opción para enlazar artículos a códigos de barras que facilita el ingreso y salida de inventario rápido mediante escáneres.',
      'Control Estricto de Series: Implementación de la opción "Requerir Series/Seriales" para artículos de alto valor. Si se habilita, fuerza a ingresar o seleccionar exactamente los seriales de cada unidad individual que ingrese o salga de bodega.',
      'Ingreso Inteligente: El botón "Nuevo Artículo" se renombró a "Ingreso de Mercadería" y ahora detecta si un artículo ya existe para simplemente agregar el nuevo stock sin duplicar datos en la base principal.'
    ]
  },

  {
    version: '4.1.8',
    date: '2026-07-11',
    changes: [
      'Rebranding de la aplicación: Cambio general del nombre "HQ Intelligence" y otros nombres genéricos a "Control 360°", incluyendo la firma "by Trennd".'
    ]
  },

  {
    version: '4.1.7',
    date: '2026-07-11',
    changes: [
      'Corrección de Simulación de Sesión: Se ha resuelto el problema que impedía realizar acciones administrativas (como modificar o vaciar datos) al simular un usuario, debido a una validación errónea contra el PIN del usuario simulado en lugar del administrador.'
    ]
  },

  {
    version: '4.1.6',
    date: '2026-07-11',
    changes: [
      'Autorización de Super-Admin: Expansión de las reglas de Firestore para reconocer múltiples cuentas maestras de administrador y validaciones relajadas en campos opcionales del perfil.',
      'Resolución Onboarding: Solución al problema que impedía crear nuevos perfiles debido al bloqueo por rol de administrador.'
    ]
  },
  {
    version: '4.1.5',
    date: '2026-07-11',
    changes: [
      'Resolución de Seguridad: Corrección de las reglas de seguridad de Firestore para aceptar la creación de usuarios con PIN encriptado en formato hexadecimal SHA-256.'
    ]
  },
  {
    version: '4.1.4',
    date: '2026-07-11',
    changes: [
      'Optimización de UI: Los módulos de la barra lateral (Finanzas, Comercio) ahora inician colapsados por defecto para reducir el ruido visual en la interfaz.'
    ]
  },
  {
    version: '4.1.3',
    date: '2026-07-11',
    changes: [
      'Limpieza de Código: Eliminación del componente no utilizado GlobalCommerceCard del panel de control.',
      'Optimización de Dependencias: Eliminación de dependencias duplicadas en la configuración del proyecto.',
      'Páginas de Error Globales: Incorporación de un capturador de errores (ErrorBoundary) y página 404 para evitar pantallas en blanco al fallar la carga de un módulo.',
      'Optimización de Rendimiento de Arranque: Implementación de validación previa (getDoc) para evitar escrituras redundantes de versiones en Firestore.'
    ]
  },
  {
    version: '4.1.2',
    date: '2026-07-11',
    changes: [
      'Autorización Estricta de Simulación: Se requiere el ingreso del PIN de administrador obligatoriamente antes de activar el modo de suplantación de cuenta.',
      'Límites y Paginación de Consultas: Integración de filtros por fechas desde la base de datos limitando el flujo de información a 12 meses para acelerar la carga.',
      'Estados Cautelares de Sesión: Si el perfil del usuario no se ha resuelto correctamente, el sistema asume estado inactivo/caducado, previniendo accesos temporales.',
      'Filtros de Fechas Robustos: Transición de filtros lógicos usando comparación de strings a evaluación criptográfica en milisegundos evitando errores de sintaxis.'
    ]
  },
  {
    version: '4.1.1',
    date: '2026-07-11',
    changes: [
      'Seguridad de Credenciales: Migración de correo administrador quemado en código a variable de entorno global segura.',
      'Cifrado de PIN: Implementación de encriptación criptográfica SHA-256 para validación y almacenamiento del PIN de usuario.',
      'Resolución de Excepciones Reactivas: Reorganización del orden de ejecución de hooks en el Dashboard de Inventario resolviendo inconsistencias.',
      'Delegación de Permisos: Refinamiento de verificación de administrador dependiendo estrictamente de reglas robustas de datos y variables de entorno.'
    ]
  },
  {
    version: '4.1.0',
    date: '2026-07-11',
    changes: [
      'Validaciones de Reversión de Stock: Optimización matemática que impide saldos negativos durante la reversión de transferencias, ventas y préstamos, limitando la cantidad revertida al stock disponible real de forma segura.',
      'Sincronización y Búsqueda Predictiva: Integración de listas de autocompletado inteligente (datalists) en tiempo real para bodegas, clientes, asignados y encargados de préstamos en toda la interfaz de inventario.',
      'Sincronización de Versión Unificada: Conversión de las etiquetas de versión a una constante dinámica global importada, eliminando referencias estáticas duplicadas en la UI.'
    ]
  },
  {
    version: '4.0.0',
    date: '2026-07-10',
    changes: [
      'Sincronización Automática de Versiones: El sistema ahora detecta, calcula y propaga automáticamente las nuevas versiones de software directamente desde la base de código a la base de datos Firestore sin requerir intervención manual de los administradores.',
      'Eliminación del Gestor Manual de Plataforma: Se retiró la interfaz de registro manual en el Panel de Administración para automatizar completamente el control de versiones y evitar discrepancias de nomenclatura.',
      'Actualización Mayor de Arquitectura (V4.0.0): Sincronización transparente de hitos de desarrollo y despliegues con la base de datos en cada ciclo de arranque del sistema.',
      'Soporte Completo para Progressive Web App (PWA): Carga rápida, capacidades sin conexión y soporte de instalación nativo.',
      'Cuadro de Mando Analítico Avanzado: Tableros dinámicos interactivos de cheques con Recharts y filtros en tiempo real.'
    ]
  },
  {
    version: '3.1.5',
    date: '2026-05-08',
    changes: [
      'Transformación en PWA (Progressive Web App) con soporte instalable y manifiesto personalizado.',
      'Sistema de Auditoría: Registro de acciones críticas para administradores (Logs de Auditoría).',
      'Implementación de Papelera de Reciclaje (Soft Delete) para evitar pérdida accidental de datos.',
      'Optimización de rendimiento mediante Lazy Loading de módulos y rutas principales.',
      'Nuevo tablero de Gráficos Analíticos interactivos con Recharts.',
      'Mejoras en el motor de consultas y políticas de caché local.'
    ]
  },
  {
    version: '2.1.7',
    date: '2026-05-08',
    changes: [
      'Corrección del error 404 al recargar páginas secundarias mediante la implementación de middleware SPA en el servidor y configuración de reescritura para Vercel.',
      'Transición a una arquitectura full-stack (Express + Vite) para garantizar la persistencia del enrutamiento en entornos de producción y desarrollo.'
    ]
  },
  {
    version: '2.1.6',
    date: '2026-05-08',
    changes: [
      'Integración del Historial de Actualizaciones y notificaciones emergentes de novedades en la plataforma.',
      'El Panel de Administración ahora permite la eliminación permanente de usuarios y su información asociada.',
      'Inclusión de los Términos y Condiciones obligatorios durante el proceso de incorporación.',
      'Agregado el cálculo y despliegue del balance general (total, pendientes, pagados y vencidos) de cheques en interfaz y en reportes PDF.',
      'Actualización del Protocolo de Carga Masiva a V2.1.6.'
    ]
  },
  {
    version: '2.1.5',
    date: '2026-05-08',
    changes: [
      'Se incluyó la posibilidad de agregar y administrar Bancos en los ajustes.',
      'Mejoras en el registro manual para asociar cheques con los bancos guardados.'
    ]
  },
  {
    version: '2.1.4',
    date: '2026-05-08',
    changes: [
      'Correcciones internas en operaciones con la base de datos Firestore y optimización en las consultas de pagos.'
    ]
  }
];

// Fallback static exports for components expecting static access
export const changelog: ChangelogRelease[] = staticChangelog;
export const CURRENT_VERSION = staticChangelog[0].version;
export const CURRENT_ACCESS_POINT = '22082026.1340';
export const CURRENT_CHECKPOINT_CODE = '22082026.1340';

// Helper to compare version numbers (descending order)
export function compareVersions(a: string, b: string): number {
  const cleanA = a.replace(/^[Vv]/, '');
  const cleanB = b.replace(/^[Vv]/, '');
  const partsA = cleanA.split('.').map(Number);
  const partsB = cleanB.split('.').map(Number);
  
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const valA = partsA[i] || 0;
    const valB = partsB[i] || 0;
    if (valA !== valB) {
      return valB - valA; // Descending
    }
  }
  return 0;
}

// Function to fetch merged dynamic versions
export async function getDynamicVersions(): Promise<ChangelogRelease[]> {
  try {
    const versionsRef = collection(db, 'versions');
    const snapshot = await getDocs(versionsRef);
    const firestoreVersions: ChangelogRelease[] = [];
    
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const versionId = docSnap.id;
      const cleanVer = versionId.replace(/^[Vv]/, '').trim();

      // Clean up obsolete test or intermediate records (e.g., V4.27.x/V4.28.x/V4.3.0 superseded by V4.30.0)
      if (
        cleanVer.startsWith('4.27.') ||
        cleanVer.startsWith('4.28.') ||
        cleanVer.startsWith('4.29.') ||
        cleanVer === '4.3.0'
      ) {
        deleteDoc(doc(db, 'versions', versionId)).catch(() => {});
        return;
      }

      firestoreVersions.push({
        version: docSnap.id,
        date: data.date || new Date().toISOString().split('T')[0],
        changes: data.changes || [],
        createdAt: data.createdAt || ''
      });
    });

    // Merge static and firestore versions (avoiding duplicates)
    const mergedMap = new Map<string, ChangelogRelease>();
    
    // Add static ones first
    staticChangelog.forEach(v => {
      // Standardize static version key by converting to e.g. V3.1.5 or keeping as is
      mergedMap.set(v.version, v);
    });

    // Add firestore ones (will override or add new ones)
    firestoreVersions.forEach(v => {
      // If version is saved as V3.1.5 and we have static '3.1.5', normalize keys for lookup
      const lookupKey = v.version.replace(/^[Vv]/, '');
      const matchedKey = Array.from(mergedMap.keys()).find(k => k.replace(/^[Vv]/, '') === lookupKey);
      if (matchedKey) {
        mergedMap.set(matchedKey, v);
      } else {
        mergedMap.set(v.version, v);
      }
    });

    // Automatically register any static versions that do not exist in Firestore
    const firestoreCleanVersions = new Set(firestoreVersions.map(v => v.version.replace(/^[Vv]/, '').trim()));
    for (const v of staticChangelog) {
      const cleanV = v.version.replace(/^[Vv]/, '').trim();
      if (!firestoreCleanVersions.has(cleanV)) {
        try {
          const normalizedVersion = v.version.startsWith('V') || v.version.startsWith('v') ? v.version : `V${v.version}`;
          const versionDocRef = doc(db, 'versions', normalizedVersion);
          const vDoc = await getDoc(versionDocRef);
          if (!vDoc.exists()) {
            await saveNewVersion(v.version, v.changes);
            console.log(`[Auto-Version] Automatically registered V${cleanV} in Firestore.`);
          }
        } catch (err: any) {
          // Silently handle offline/unavailable or permission errors
          const isIgnored = 
            err?.code === "permission-denied" || 
            err?.code === "unavailable" || 
            err?.message?.includes("offline") || 
            err?.message?.includes("unavailable");

          if (!isIgnored) {
            console.warn(`[Auto-Version] Could not automatically register V${cleanV}:`, err?.message || err);
          }
        }
      }
    }

    const mergedList = Array.from(mergedMap.values());
    
    // Sort descending by version number
    mergedList.sort((a, b) => compareVersions(a.version, b.version));
    
    return mergedList;
  } catch (error) {
    console.error('Error fetching dynamic versions:', error);
    return staticChangelog;
  }
}

// Helper to calculate the next version number automatically
export function getNextVersion(currentVersion: string, type: 'minor' | 'medium' | 'major'): string {
  const clean = currentVersion.replace(/^[Vv]/, '');
  const parts = clean.split('.').map(Number);
  
  let [major, medium, minor] = parts.length === 3 ? parts : [3, 1, 5];
  if (isNaN(major)) major = 3;
  if (isNaN(medium)) medium = 1;
  if (isNaN(minor)) minor = 5;

  if (type === 'minor') {
    minor += 1;
  } else if (type === 'medium') {
    medium += 1;
    minor = 0;
  } else if (type === 'major') {
    major += 1;
    medium = 0;
    minor = 0;
  }

  return `V${major}.${medium}.${minor}`;
}

// Function to save a new version to Firestore
export async function saveNewVersion(version: string, changes: string[]): Promise<void> {
  const normalizedVersion = version.startsWith('V') || version.startsWith('v') ? version : `V${version}`;
  const versionDocRef = doc(db, 'versions', normalizedVersion);
  
  await setDoc(versionDocRef, {
    date: new Date().toISOString().split('T')[0],
    changes: changes,
    createdAt: new Date().toISOString()
  });
}
