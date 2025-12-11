import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../src/firebase';
import { Citizen } from '../types';

export const getCitizen = async (id: string): Promise<Citizen | null> => {
  try {
    const docRef = doc(db, 'citizens', id);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as Citizen;
    }
    return null;
  } catch (error) {
    console.error("Error fetching citizen:", error);
    return null;
  }
};

export const getCitizensByIds = async (ids: string[]): Promise<Citizen[]> => {
  if (ids.length === 0) return [];
  // Para simplificar y evitar límites de consultas 'in', usamos Promise.all
  const uniqueIds = Array.from(new Set(ids));
  const promises = uniqueIds.map(id => getCitizen(id));
  const results = await Promise.all(promises);
  return results.filter(c => c !== null) as Citizen[];
};

export const createOrUpdateCitizen = async (id: string, data: Partial<Citizen>) => {
  const docRef = doc(db, 'citizens', id);
  await setDoc(docRef, {
    ...data,
    updatedAt: serverTimestamp()
  }, { merge: true });
};

export const updateCitizenProfile = async (id: string, data: { notes?: string; tags?: string[] }) => {
  const docRef = doc(db, 'citizens', id);
  await updateDoc(docRef, {
    ...data,
    updatedAt: serverTimestamp()
  });
};