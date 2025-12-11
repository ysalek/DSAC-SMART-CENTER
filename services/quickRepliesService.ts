import { 
  collection, 
  getDocs, 
  addDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  query, 
  orderBy 
} from 'firebase/firestore';
import { db } from '../src/firebase';
import { QuickReply } from '../types';

const COLLECTION_NAME = 'quickReplies';

export const getQuickReplies = async (): Promise<QuickReply[]> => {
  const q = query(collection(db, COLLECTION_NAME), orderBy('shortcut', 'asc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as QuickReply));
};

export const addQuickReply = async (reply: Omit<QuickReply, 'id' | 'createdAt'>) => {
  return await addDoc(collection(db, COLLECTION_NAME), {
    ...reply,
    createdAt: serverTimestamp()
  });
};

export const deleteQuickReply = async (id: string) => {
  await deleteDoc(doc(db, COLLECTION_NAME, id));
};