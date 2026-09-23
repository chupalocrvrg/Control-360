import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Penny Drop Algorithm
 * Distributes a total amount into a specific number of installments,
 * ensuring that the sum of the installments exactly equals the total amount.
 * The remainder (if any) is added to the last installment.
 */
export function calculateInstallments(totalNeto: number, meses: number): number[] {
  if (meses <= 0) return [];
  if (meses === 1) return [Math.round(totalNeto * 100) / 100];

  // Calculate base installment rounded to 2 decimals
  const base = Math.round((totalNeto / meses) * 100) / 100;
  const installments = Array(meses).fill(base);
  
  // Calculate the sum of all base installments
  const currentTotal = Math.round((base * meses) * 100) / 100;
  
  // Calculate the remainder
  const remainder = Math.round((totalNeto - currentTotal) * 100) / 100;
  
  // Add the remainder to the last installment
  installments[meses - 1] = Math.round((installments[meses - 1] + remainder) * 100) / 100;
  
  return installments;
}

export function formatCurrency(amount: number, currencyCode: string = 'USD'): string {
  try {
    return new Intl.NumberFormat('es-EC', {
      style: 'currency',
      currency: currencyCode,
    }).format(amount);
  } catch (e) {
    return `${currencyCode} ${amount.toFixed(2)}`;
  }
}

/**
 * Safely rounds any financial float to exactly 2 decimal places to avoid standard IEEE-754 binary representation float errors.
 */
export function roundToTwo(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

export function generateCheckNumber(baseNumber: string, index: number): string {
  if (!baseNumber) return '';
  const num = parseInt(baseNumber, 10);
  if (isNaN(num)) return `${baseNumber}-${index + 1}`;
  return (num + index).toString().padStart(baseNumber.length, '0');
}

/**
 * Computes a salted SHA-256 hash of a PIN using the user identifier/custom salt.
 * Ensures resistance against precomputed rainbow-table attacks.
 */
export async function hashPin(pin: string, salt: string = ''): Promise<string> {
  const encoder = new TextEncoder();
  const payload = salt ? `cf_salt_${salt}:${pin}` : `cf_default_salt_v1:${pin}`;
  const data = encoder.encode(payload);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Legacy plain SHA-256 PIN hash for seamless backward compatibility with existing stored user hashes.
 */
export async function legacyHashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export const SUPER_ADMIN_EMAILS = [
  import.meta.env.VITE_SUPER_ADMIN_EMAIL,
  ...(import.meta.env.VITE_SUPER_ADMIN_EMAILS || '').split(',').map(e => e.trim())
].filter(Boolean) as string[];

export function isSuperAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return SUPER_ADMIN_EMAILS.includes(email);
}

/**
 * Recursively strips keys with `undefined` values from an object or array.
 * This guarantees that objects sent to Firestore via `addDoc`, `updateDoc`, or `setDoc`
 * never throw the fatal "Function addDoc() called with invalid data. Unsupported field value: undefined" error.
 */
export function cleanFirestoreData<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => cleanFirestoreData(item)) as unknown as T;
  }
  if (typeof obj === 'object' && !(obj instanceof Date)) {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        result[key] = cleanFirestoreData(value);
      }
    }
    return result as T;
  }
  return obj;
}

