import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';

export interface MobileCheckResult {
  exists: boolean;
  message?: string;
  existingUser?: any;
}

/**
 * Checks if a given mobile number is already registered in the users or students collection.
 * 
 * @param mobileInput The phone/mobile number entered by the user
 * @param excludeUid Optional UID/DocumentId of current user being edited (to ignore self match)
 */
export async function checkMobileExists(
  mobileInput: string,
  excludeUid?: string | null
): Promise<MobileCheckResult> {
  if (!mobileInput) return { exists: false };

  const rawPhone = mobileInput.trim();
  const cleanPhone = rawPhone.replace(/[^0-9]/g, '');

  if (!cleanPhone || cleanPhone.length < 5) {
    return { exists: false };
  }

  try {
    const usersRef = collection(db, 'users');

    // Query terms to check
    const queries = [
      query(usersRef, where('phone', '==', cleanPhone)),
      query(usersRef, where('mobile', '==', cleanPhone)),
    ];

    if (rawPhone !== cleanPhone) {
      queries.push(query(usersRef, where('phone', '==', rawPhone)));
      queries.push(query(usersRef, where('mobile', '==', rawPhone)));
    }

    for (const q of queries) {
      const snapshot = await getDocs(q);
      for (const docSnap of snapshot.docs) {
        if (!excludeUid || docSnap.id !== excludeUid) {
          const userData = docSnap.data();
          return {
            exists: true,
            existingUser: { id: docSnap.id, ...userData },
            message: `The mobile number "${cleanPhone}" is already registered to another user (${userData.name || 'Existing Account'}). Each mobile number must be unique.`
          };
        }
      }
    }

    // Also check students collection
    const studentsRef = collection(db, 'students');
    const studentQueries = [
      query(studentsRef, where('phone', '==', cleanPhone)),
    ];
    if (rawPhone !== cleanPhone) {
      studentQueries.push(query(studentsRef, where('phone', '==', rawPhone)));
    }

    for (const sq of studentQueries) {
      const sSnapshot = await getDocs(sq);
      for (const sDoc of sSnapshot.docs) {
        const sData = sDoc.data();
        if (!excludeUid || (sData.userId !== excludeUid && sDoc.id !== excludeUid)) {
          return {
            exists: true,
            existingUser: { id: sDoc.id, ...sData },
            message: `The mobile number "${cleanPhone}" is already registered to another student. Each mobile number must be unique.`
          };
        }
      }
    }

    return { exists: false };
  } catch (error) {
    console.error("Error checking mobile uniqueness:", error);
    return { exists: false };
  }
}
