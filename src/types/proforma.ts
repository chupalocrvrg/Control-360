export interface CreditPlanOption {
  months: number;        // e.g. 3, 6, 12, or custom like 10, 15, 20, 24, 28
  totalPrice: number;    // Precio total a ese plazo
  downPayment: number;   // Entrada sugerida para ese plazo
  monthlyPayment: number;// Cuota mensual sugerida
  isMaxTerm?: boolean;   // Si es el plazo máximo permitido
  planLabel?: string;    // Etiqueta descriptiva (ej. "3 Meses", "10 Meses (Máximo)")
}

export interface PriceListItem {
  id: string;
  category: string;          // CATEGORIA
  gift: string;              // REGALO (si aplica)
  item: string;              // ITEMS (Descripción / Nombre del producto, ej: TV 43")
  brand: string;             // MARCA
  minStorePrice: number;     // MIN/ALMACEN (Precio mínimo de almacén / contado)
  creditPrice: number;       // CREDITO (Precio crédito base / máximo)
  defaultDownPayment: number;// ENTRADA (Entrada sugerida base)
  maxMonths: number;         // MESES (Plazo máximo de crédito permitido)
  defaultMonthlyQuota: number;// CUOTA (Cuota mensual base)
  updateDate?: string;       // FECHA (Fecha de actualización del precio)
  internalCode?: string;     // Código enmascarado con precio mínimo embebido (ej. TV65IN695QLED)
  plans: CreditPlanOption[]; // Planes de crédito disponibles para este artículo
  enterpriseId?: string;
  updatedAt?: any;
}

export interface ProformaItem {
  id: string;
  priceListItemId?: string;
  internalCode?: string;      // Código enmascarado del artículo para control de precio piso
  item: string;               // Nombre / Descripción del artículo
  brand: string;              // Marca
  category: string;           // Categoría
  gift: string;               // Regalo (si aplica)
  minStorePrice: number;      // Precio de contado / almacén
  selectedPlanMonths: number; // Plazo de crédito seleccionado en meses
  totalCreditPrice: number;   // Precio de venta a crédito para ese plazo
  downPayment: number;        // Entrada pactada (editable por el usuario)
  calculatedQuota: number;    // Cuota mensual calculada: (totalCreditPrice - downPayment) / selectedPlanMonths
  originalPlanMonths?: number; // Plazo original antes de ser unificado en combo
  quantity: number;
}

export interface Proforma {
  id: string;
  proformaNumber: string;     // e.g. PROF-2026-0001
  date: string;               // YYYY-MM-DD
  validUntil: string;         // YYYY-MM-DD (validez de la cotización)
  clientId?: string;
  clientName: string;
  clientIdCard?: string;
  clientPhone?: string;
  clientEmail?: string;
  clientAddress?: string;
  sellerId: string;
  sellerName: string;
  enterpriseId?: string;
  items: ProformaItem[];
  totalCash: number;          // Total si paga de contado
  totalCredit: number;        // Total a crédito
  totalDownPayment: number;   // Total de entradas
  totalFinanced: number;      // Total financiado (totalCredit - totalDownPayment)
  isCombo?: boolean;          // Indica si es una Proforma Combo Unificada
  comboMonths?: number;       // Plazo unificado de meses del combo (ej. 12 meses)
  comboDownPayment?: number;  // Entrada inicial unificada del combo
  comboMonthlyQuota?: number; // Cuota mensual consolidada única del combo
  status: 'COTIZADA' | 'ACEPTADA' | 'RECHAZADA' | 'VENDIDA' | 'VENCIDA';
  notes?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface PriceListConfig {
  dropboxUrl: string;
  lastSyncAt: string | null;
  itemsCount: number;
  status: 'idle' | 'syncing' | 'success' | 'error';
  errorMessage?: string;
}
