import { db } from '../firebase';
import { collection, getDocs, updateDoc, query, where, addDoc, Timestamp } from 'firebase/firestore';

/**
 * Resolves a default enterprise UID for administrative wizard assignment.
 */
export async function getDefaultEnterpriseUid(): Promise<string> {
  try {
    const qEnt = query(collection(db, 'users'), where('role', '==', 'enterprise'));
    const snapEnt = await getDocs(qEnt);
    if (!snapEnt.empty) {
      return snapEnt.docs[0].id;
    }
  } catch (err) {
    console.error('Error resolving default enterprise UID:', err);
  }
  return '';
}

/**
 * Syncs a user designated as an employee with the `employees` collection.
 */
export async function syncLinkedUserToEmployees(
  userId: string,
  userEmail: string,
  userName: string,
  userLastName: string = '',
  enterpriseId: string,
  role: 'vendedor' | 'cobrador' | 'ambos' | 'supervisor_ventas' | 'supervisor_cobranza' | 'supervisor_general' = 'vendedor'
): Promise<string> {
  try {
    // Check if an employee record already exists for this userId
    const qUser = query(collection(db, 'employees'), where('userId', '==', userId));
    const snapUser = await getDocs(qUser);

    if (!snapUser.empty) {
      const empDoc = snapUser.docs[0];
      await updateDoc(empDoc.ref, {
        name: userName || empDoc.data().name,
        lastName: userLastName || empDoc.data().lastName || '',
        role,
        enterpriseId,
        email: userEmail
      });
      return empDoc.id;
    }

    // Check by email if userId not linked yet
    if (userEmail) {
      const qEmail = query(collection(db, 'employees'), where('email', '==', userEmail));
      const snapEmail = await getDocs(qEmail);
      if (!snapEmail.empty) {
        const empDoc = snapEmail.docs[0];
        await updateDoc(empDoc.ref, {
          userId,
          name: userName || empDoc.data().name,
          lastName: userLastName || empDoc.data().lastName || '',
          role,
          enterpriseId
        });
        return empDoc.id;
      }
    }

    // Create new employee record
    const newRef = await addDoc(collection(db, 'employees'), {
      userId,
      email: userEmail,
      name: userName || 'Empleado',
      lastName: userLastName || '',
      role,
      enterpriseId,
      createdAt: Timestamp.now()
    });
    return newRef.id;
  } catch (err) {
    console.error('Error syncing linked user to employees collection:', err);
    return '';
  }
}
