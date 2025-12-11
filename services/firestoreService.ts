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
  getDocs,
  limit,
  startAfter,
  limitToLast,
  QueryDocumentSnapshot
} from 'firebase/firestore';
import { db } from '../src/firebase';
import { Conversation, Message, SystemSettings } from '../types';

// Escuchar solo conversaciones activas (Optimización: Ordenamiento en cliente para evitar error de índice)
export const subscribeToConversations = (callback: (convos: Conversation[]) => void) => {
  const q = query(
    collection(db, 'conversations'),
    where('status', 'in', ['OPEN', 'IN_PROGRESS']),
    // orderBy('lastMessageAt', 'desc'), // Eliminado para evitar error "failed-precondition" si falta índice
    limit(100)
  );

  return onSnapshot(q, (snapshot) => {
    const convos = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Conversation));
    
    // Ordenar en cliente
    convos.sort((a, b) => {
       const tA = a.lastMessageAt?.seconds || 0;
       const tB = b.lastMessageAt?.seconds || 0;
       return tB - tA;
    });

    callback(convos);
  });
};

// Escuchar últimos mensajes (Optimización: limitToLast)
export const subscribeToMessages = (conversationId: string, callback: (msgs: Message[]) => void) => {
  const q = query(
    collection(db, 'messages'),
    where('conversationId', '==', conversationId),
    orderBy('createdAt', 'asc'),
    limitToLast(200) // Límite duro para evitar carga masiva inicial
  );

  return onSnapshot(q, (snapshot) => {
    const msgs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Message));
    callback(msgs);
  });
};

// Paginación para historial antiguo
export const getMessagesPage = async (conversationId: string, lastDoc: QueryDocumentSnapshot, pageSize: number = 50) => {
  const q = query(
    collection(db, 'messages'),
    where('conversationId', '==', conversationId),
    orderBy('createdAt', 'desc'), // Inverso para paginar hacia atrás
    startAfter(lastDoc),
    limit(pageSize)
  );
  
  const snapshot = await getDocs(q);
  return {
    messages: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message)).reverse(),
    lastDoc: snapshot.docs[snapshot.docs.length - 1]
  };
};

// Obtener mensajes una sola vez (para historial/lectura)
export const getMessagesOnce = async (conversationId: string): Promise<Message[]> => {
  const q = query(
    collection(db, 'messages'),
    where('conversationId', '==', conversationId),
    orderBy('createdAt', 'asc'),
    limit(100)
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
  await addDoc(collection(db, 'messages'), {
    conversationId,
    senderType: 'agent',
    senderId: agentId,
    content,
    attachments,
    isInternal,
    createdAt: serverTimestamp()
  });

  // Solo actualizamos la conversación si NO es nota interna para no falsear tiempos de respuesta al ciudadano
  if (!isInternal) {
    await updateDoc(doc(db, 'conversations', conversationId), {
      updatedAt: serverTimestamp(),
      lastMessageAt: serverTimestamp(),
      status: 'IN_PROGRESS'
    });
  } else {
    // Para notas internas solo actualizamos updatedAt para auditoría
    await updateDoc(doc(db, 'conversations', conversationId), {
      updatedAt: serverTimestamp()
    });
  }
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
    const citizenRef = doc(db, 'citizens', phone);
    await setDoc(citizenRef, {
        name,
        phoneNumber: phone,
        channel: 'web',
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp()
    }, { merge: true });

    const q = query(
      collection(db, 'conversations'),
      where('citizenId', '==', phone),
      where('status', 'in', ['OPEN', 'IN_PROGRESS'])
    );
    const snap = await getDocs(q);
    
    if (!snap.empty) {
      return snap.docs[0].id;
    }

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
    // orderBy('createdAt', 'desc'), // Ordenar en cliente para evitar index
    limit(50)
  );
  
  const snap = await getDocs(q);
  const convos = snap.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as Conversation));

  // Filtrar y ordenar en cliente
  return convos
    .filter(c => c.status === 'CLOSED')
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
    .slice(0, 20);
};