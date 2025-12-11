import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp,
  getDoc,
  setDoc,
  increment,
  getDocs
} from 'firebase/firestore';
import { db } from '../src/firebase';
import { Conversation, Message, SystemSettings } from '../types';

export const subscribeToConversations = (callback: (convos: Conversation[]) => void) => {
  const q = query(
    collection(db, 'conversations'),
    orderBy('lastMessageAt', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    const convos = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Conversation));
    callback(convos);
  });
};

export const subscribeToMessages = (conversationId: string, callback: (msgs: Message[]) => void) => {
  const q = query(
    collection(db, 'messages'),
    where('conversationId', '==', conversationId),
    orderBy('createdAt', 'asc')
  );

  return onSnapshot(q, (snapshot) => {
    const msgs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Message));
    callback(msgs);
  });
};

// Obtener mensajes una sola vez (para historial/lectura)
export const getMessagesOnce = async (conversationId: string): Promise<Message[]> => {
  const q = query(
    collection(db, 'messages'),
    where('conversationId', '==', conversationId),
    orderBy('createdAt', 'asc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as Message));
};

export const sendMessageAsAgent = async (
  conversationId: string, 
  content: string, 
  agentId: string,
  attachments: string[] = [],
  isInternal: boolean = false
) => {
  // 1. Add message to 'messages' collection
  await addDoc(collection(db, 'messages'), {
    conversationId,
    senderType: 'agent',
    senderId: agentId,
    content,
    attachments,
    isInternal,
    createdAt: serverTimestamp()
  });

  // 2. Update conversation (Only update lastMessageAt if it's NOT an internal note, usually)
  // However, updating updatedAt is useful. We might not want to bump unreadCount or lastMessageAt for internal notes
  // to avoid making it look like a response to the citizen if sorting by last interaction.
  // For simplicity in this MVP, we treat it as an activity update.
  
  await updateDoc(doc(db, 'conversations', conversationId), {
    updatedAt: serverTimestamp(),
    // Optional: Update status to IN_PROGRESS if open
    status: 'IN_PROGRESS'
  });
};

export const assignConversation = async (conversationId: string, agentId: string) => {
  const docRef = doc(db, 'conversations', conversationId);
  await updateDoc(docRef, {
    assignedAgentId: agentId,
    status: 'IN_PROGRESS',
    updatedAt: serverTimestamp()
  });
};

export const transferConversation = async (conversationId: string, toAgentId: string, fromAgentName: string) => {
  const docRef = doc(db, 'conversations', conversationId);
  
  // Registrar mensaje de sistema indicando transferencia
  await addDoc(collection(db, 'messages'), {
    conversationId,
    senderType: 'bot',
    senderId: 'system',
    content: `♻️ Chat transferido por ${fromAgentName}`,
    createdAt: serverTimestamp()
  });

  await updateDoc(docRef, {
    assignedAgentId: toAgentId,
    updatedAt: serverTimestamp()
  });
};

export const closeConversation = async (conversationId: string, disposition: string, notes?: string) => {
  const ref = doc(db, 'conversations', conversationId);
  await updateDoc(ref, { 
    status: 'CLOSED', 
    disposition, 
    closingNotes: notes || null,
    updatedAt: serverTimestamp() 
  });
};

export const getSystemSettings = async (): Promise<SystemSettings | null> => {
  const docRef = doc(db, 'systemSettings', 'default');
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return docSnap.data() as SystemSettings;
  }
  return null;
};

export const updateSystemSettings = async (settings: Partial<SystemSettings>, userId: string) => {
  const docRef = doc(db, 'systemSettings', 'default');
  await setDoc(docRef, {
    ...settings,
    lastUpdatedAt: serverTimestamp(),
    lastUpdatedBy: userId
  }, { merge: true });
};

// --- WEB CHAT FUNCTIONS ---

export const startWebConversation = async (name: string, phone: string) => {
    // 1. Crear o Actualizar Ciudadano
    const citizenRef = doc(db, 'citizens', phone);
    await setDoc(citizenRef, {
        name,
        phoneNumber: phone,
        channel: 'web',
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp() // setDoc con merge ignorará esto si ya existe, idealmente
    }, { merge: true });

    // 2. Buscar si ya tiene una conversación abierta
    const q = query(
      collection(db, 'conversations'),
      where('citizenId', '==', phone),
      where('status', 'in', ['OPEN', 'IN_PROGRESS'])
    );
    const snap = await getDocs(q);
    
    if (!snap.empty) {
      return snap.docs[0].id;
    }

    // 3. Crear Nueva Conversación
    const convRef = await addDoc(collection(db, 'conversations'), {
        citizenId: phone,
        status: 'OPEN',
        sourceChannel: 'web',
        assignedAgentId: null,
        lastMessageAt: serverTimestamp(),
        unreadCount: 1,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });

    // 4. Mensaje de bienvenida automático si aplica (opcional aquí, o manejado por trigger)
    // Por simplicidad, añadimos un mensaje de sistema de inicio
    await addDoc(collection(db, 'messages'), {
      conversationId: convRef.id,
      senderType: 'bot',
      senderId: 'system',
      content: '¡Bienvenido al chat de atención! Un agente se conectará pronto.',
      createdAt: serverTimestamp()
    });

    return convRef.id;
};

export const sendMessageAsCitizen = async (conversationId: string, content: string, citizenId: string) => {
    await addDoc(collection(db, 'messages'), {
        conversationId,
        senderType: 'citizen',
        senderId: citizenId,
        content,
        createdAt: serverTimestamp()
    });

    await updateDoc(doc(db, 'conversations', conversationId), {
        lastMessageAt: serverTimestamp(),
        unreadCount: increment(1),
        updatedAt: serverTimestamp()
    });
};

export const getCitizenHistory = async (citizenId: string): Promise<Conversation[]> => {
  const q = query(
    collection(db, 'conversations'),
    where('citizenId', '==', citizenId),
    where('status', '==', 'CLOSED'),
    orderBy('createdAt', 'desc')
  );
  
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as Conversation));
};