export type ClientType = 'CONTADO' | 'CREDITO';

export type CivilStatus = 'SOLTERO' | 'CASADO' | 'UNION_LIBRE' | 'DIVORCIADO' | 'VIUDO';

export type Gender = 'MASCULINO' | 'FEMENINO' | 'OTRO';

export type EducationLevel = 
  | 'PRIMARIA'
  | 'SECUNDARIA'
  | 'TECNICO'
  | 'UNIVERSITARIO'
  | 'POSTGRADO'
  | 'NINGUNO';

export type HousingType = 
  | 'PROPIA'
  | 'ARRENDADA'
  | 'FAMILIAR'
  | 'HIPOTECADA'
  | 'OTRO';

export interface PersonalReference {
  id: string;
  fullName: string;
  relationship: string;
  phone: string;
  city: string;
}

export interface ClientSpouseInfo {
  lastName?: string;
  firstName?: string;
  idCard?: string;
  phone?: string;
}

export interface ClientWorkInfo {
  workplace?: string;
  workAddress?: string;
  position?: string;
  workPhone?: string;
}

export interface Client {
  id: string;
  enterpriseId: string;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;

  // 1. Datos Principales (Obligatorios Contado y Crédito)
  idCard: string; // Cédula o RUC
  clientType: ClientType; // 'CONTADO' | 'CREDITO'
  lastName: string; // Apellido o Razón Social
  firstName: string; // Nombre
  phone: string;
  address: string;
  city: string; // Ciudad o sector
  email?: string; // Opcional
  creditLimit: number; // Cupo para crédito
  creditUsed?: number; // Crédito utilizado actualmente

  // 2. Datos Secundarios (Obligatorios en caso de Crédito)
  civilStatus?: CivilStatus;
  dependentsCount?: number; // Cargas familiares (hijos menores)
  birthPlace?: string; // Lugar de nacimiento
  birthDate?: string; // Fecha de nacimiento (YYYY-MM-DD)
  gender?: Gender;
  educationLevel?: EducationLevel;
  housingType?: HousingType;
  residenceTime?: string; // Tiempo de residencia
  landlordName?: string; // Arrendatario en caso de aplicar
  landlordPhone?: string; // Teléfono arrendatario

  // 3. Información Laboral
  workInfo?: ClientWorkInfo;

  // 4. Información Cónyuge
  spouseInfo?: ClientSpouseInfo;

  // 5. Referencias Personales
  references?: PersonalReference[];

  // 6. Garante Solidario (Seleccionado de la lista de clientes)
  guarantorClientId?: string;
  guarantorName?: string;
  guarantorIdCard?: string;
  guarantorPhone?: string;

  // Metadatos
  status?: 'ACTIVO' | 'INACTIVO' | 'BLOQUEADO';
  notes?: string;
}
