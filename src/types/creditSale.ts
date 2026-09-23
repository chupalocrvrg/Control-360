export type CreditPaymentFrequency = 'SEMANAL' | 'QUINCENAL' | 'MENSUAL';

export interface CreditInstallment {
  number: number; // 1, 2, 3...
  dueDate: string; // YYYY-MM-DD
  amount: number; // Cuota normal
  status: 'PENDIENTE' | 'PARCIAL' | 'PAGADO' | 'VENCIDO';
  paidAmount?: number;
  paidDate?: string;
  notes?: string;
}

export interface EarlySettlementOption {
  targetMonths: number; // Por ejemplo, a los 3 meses, 6 meses...
  discountPercentage: number; // % de descuento sobre el saldo o interés
  settlementAmount: number; // Monto pactado para liquidar anticipadamente
  description: string;
}

export interface CreditSaleItem {
  articleId: string;
  articleName: string;
  quantity: number;
  warehouseId: string;
  warehouseName: string;
  unitPrice: number;
  totalPrice: number;
  selectedSeries?: string[];
  technicalDetails?: {
    brand?: string;
    model?: string;
    year?: string;
    origin?: string;
    cylinderCapacity?: string;
    tonnage?: string;
    passengers?: string;
    color?: string;
    camv?: string;
    chassis?: string;
    engine?: string;
    vehicleClass?: string;
    vehicleType?: string;
  };
}

export interface CreditSale {
  id: string;
  enterpriseId: string;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;

  // Cliente
  clientId: string;
  clientName: string;
  clientIdCard: string;
  clientPhone: string;
  clientAddress: string;
  clientCity: string;

  // Garante Solidario (si aplica)
  guarantorClientId?: string;
  guarantorName?: string;
  guarantorIdCard?: string;
  guarantorPhone?: string;

  // Vendedor
  sellerId: string;
  sellerName: string;

  // Artículos vendidos
  items: CreditSaleItem[];

  // Finanzas del Crédito
  grossSubtotal?: number;
  discountType?: 'VALUE' | 'PERCENT';
  discountValue?: number;
  discountAmount?: number;
  grossTotal: number; // Precio total de los artículos con descuento aplicado
  downPayment: number; // Entrada / Abono inicial en efectivo
  netFinancedAmount: number; // Saldo a financiar (grossTotal - downPayment)
  saleDate?: string;
  article?: string;
  termMonths?: number;
  paymentFrequency?: string;
  
  // Amortización
  frequency: CreditPaymentFrequency; // 'SEMANAL' | 'QUINCENAL' | 'MENSUAL'
  installmentsCount: number; // Número de cuotas (ej. 12 semanas, 6 meses)
  installmentAmount: number; // Valor de cada cuota
  startDate: string; // Primera fecha de pago
  installments: CreditInstallment[]; // Tabla de amortización

  // Condiciones de liquidación anticipada pactadas
  earlySettlementOptions?: EarlySettlementOption[];

  // Estado del crédito
  totalPaid: number;
  remainingBalance: number;
  status: 'ACTIVO' | 'LIQUIDADO' | 'ANULADO' | 'EN_MORA';

  // Número de pagaré y correlativo
  promissoryNoteNumber: string; // ej. PAG-2026-0001
  notes?: string;
}
