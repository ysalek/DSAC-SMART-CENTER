import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  query, 
  orderBy 
} from 'firebase/firestore';
import { db } from '../src/firebase';
import { Agent } from '../types';

const COLLECTION_NAME = 'agents';

export const getAgents = async (): Promise<Agent[]> => {
  const q = query(collection(db, COLLECTION_NAME), orderBy('displayName', 'asc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as Agent));
};

export const addAgent = async (agent: Omit<Agent, 'id' | 'createdAt' | 'updatedAt'>) => {
  return await addDoc(collection(db, COLLECTION_NAME), {
    ...agent,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
};

export const toggleAgentStatus = async (id: string, currentStatus: boolean) => {
  const docRef = doc(db, COLLECTION_NAME, id);
  await updateDoc(docRef, {
    online: !currentStatus,
    updatedAt: serverTimestamp()
  });
};

export const deleteAgent = async (id: string) => {
  await deleteDoc(doc(db, COLLECTION_NAME, id));
};