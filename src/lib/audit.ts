import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { User } from 'firebase/auth';
import { handleFirestoreError, OperationType } from './firestore-errors';

export enum AuditAction {
  USER_LOGIN = 'USER_LOGIN',
  USER_LOGOUT = 'USER_LOGOUT',
  USER_DELETE = 'USER_DELETE',
  CHECK_CREATE = 'CHECK_CREATE',
  CHECK_UPDATE = 'CHECK_UPDATE',
  CHECK_DELETE = 'CHECK_DELETE', // Soft delete
  CHECK_RESTORE = 'CHECK_RESTORE',
  DB_VACUUM = 'DB_VACUUM',
  SETTINGS_UPDATE = 'SETTINGS_UPDATE',
  SENSITIVE_READ = 'SENSITIVE_READ',
  EMPLOYEE_UPDATE = 'EMPLOYEE_UPDATE',
  BUDGET_UPDATE = 'BUDGET_UPDATE',
  SALE_CREATE = 'SALE_CREATE',
  SALE_UPDATE = 'SALE_UPDATE',
  SALE_DELETE = 'SALE_DELETE',
  COLLECTION_CREATE = 'COLLECTION_CREATE',
  COLLECTION_UPDATE = 'COLLECTION_UPDATE',
  COLLECTION_DELETE = 'COLLECTION_DELETE',
  PORTFOLIO_UPDATE = 'PORTFOLIO_UPDATE',
  INVENTORY_UPDATE = 'INVENTORY_UPDATE',
  DATA_RESTORE = 'DATA_RESTORE',
  MASTER_BACKUP = 'MASTER_BACKUP',
}

export async function logAudit(action: AuditAction, details: string, targetId?: string, overrideUser?: User | null) {
  const path = 'auditLogs';
  try {
    const user = overrideUser || auth.currentUser;
    const docRef = doc(collection(db, path));
    await setDoc(docRef, {
      action,
      details,
      targetId: targetId || null,
      userId: user?.uid || 'system',
      userEmail: user?.email || 'system',
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    console.warn('Failed to log audit:', error);
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}
