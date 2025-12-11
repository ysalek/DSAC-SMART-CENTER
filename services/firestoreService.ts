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
  QueryDocumentSnapshot,
  FirestoreError,
  Timestamp
} from 'firebase/firestore';
import { db } from '../src/firebase';
import { Conversation, Message, SystemSettings } from '../types';

// --- CONVERSATIONS ---

export const subscribeToConversations = (callback: (convos: Conversation[]) => void) => {
  // Requiere índice compuesto: status (ASC) + lastMessageAt (DESC)
  // Este índice debe estar en firestore.indexes.json y desplegado.
  const q = query(
    collection(db, 'conversations'),
    where('status', 'in', ['OPEN', 'IN_PROGRESS']),
    orderBy('lastMessageAt', 'desc'),
    limit(100)
  );

  return onSnapshot(q, {
    next: (snapshot) => {
      const convos = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Conversation));
      callback(convos);
    },
    error: (error: FirestoreError) => {
      // Detección específica de error de índice
      if (error.code === 'failed-precondition' || error.message.includes('index')) {
        if (error.message.includes('building')) {
           console.warn("⚠️ EL ÍNDICE SE ESTÁ CONSTRUYENDO... ESPERA UNOS MINUTOS PARA VER LOS CHATS ⚠️");
        } else {
           console.error("🚨 FALTA ÍNDICE DE CONVERSACIONES 🚨");
           console.error("Abre este enlace para crearlo automáticamente:", error.message);
           console.info("O ejecuta: firebase deploy --only firestore:indexes");
        }
      } else {
        console.error("Error suscripción conversaciones:", error);
      }
    }
  });
};

// --- MESSAGES ---

export const subscribeToMessages = (conversationId: string, callback: (msgs: Message[]) => void) => {
  if (!conversationId) return () => {};

  // Requiere índice: conversationId (ASC) + createdAt (DESC)
  const q = query(
    collection(db, 'messages'),
    where('conversationId', '==', conversationId),
    orderBy('createdAt', 'desc'), 
    limit(100)
  );

  return onSnapshot(q, {
    next: (snapshot) => {
      const rawMsgs = snapshot.docs.map(doc => {
        const data = doc.data();
        const safeCreatedAt = data.createdAt || Timestamp.now();
        return {
          id: doc.id,
          ...data,
          createdAt: safeCreatedAt
        } as Message;
      });
      // Invertimos para mostrar cronológicamente (antiguos arriba, nuevos abajo)
      callback(rawMsgs.reverse());
    },
    error: (error: FirestoreError) => {
      if (error.code === 'failed-precondition') {
         console.error("🚨 FALTA ÍNDICE DE MENSAJES. Revisa la consola para el enlace de creación.");
      }
      console.error("Error suscripción mensajes:", error);
    }
  });
};

// Para paginación histórica (scrollear hacia arriba)
export const getMessagesPage = async (conversationId: string, lastDoc: QueryDocumentSnapshot, pageSize: number = 50) => {
  const q = query(
    collection(db, 'messages'),
    where('conversationId', '==', conversationId),
    orderBy('createdAt', 'desc'),
    startAfter(lastDoc),
    limit(pageSize)
  );
  
  const snapshot = await getDocs(q);
  // Invertimos porque vienen DESC pero queremos mostrarlos ASC al insertarlos arriba
  const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message)).reverse();
  
  return {
    messages,
    lastDoc: snapshot.docs[snapshot.docs.length - 1]
  };
};

export const getMessagesOnce = async (conversationId: string): Promise<Message[]> => {
  const q = query(
    collection(db, 'messages'),
    where('conversationId', '==', conversationId),
    orderBy('createdAt', 'desc'), // Coincide con índice
    limit(100)
  );
  
  const snapshot = await getDocs(q);
  const msgs = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as Message));
  
  return msgs.reverse();
};

// --- ACTIONS ---

export const sendMessageAsAgent = async (
  conversationId: string, 
  content: string, 
  agentId: string, 
  attachments: string[] = [],
  isInternal: boolean = false
) => {
  try {
    // 1. Crear Mensaje
    await addDoc(collection(db, 'messages'), {
      conversationId,
      senderType: 'agent',
      senderId: agentId,
      content,
      attachments,
      isInternal,
      createdAt: serverTimestamp()
    });

    // 2. Actualizar Conversación
    const updateData: any = {
      updatedAt: serverTimestamp()
    };

    if (!isInternal) {
      updateData.lastMessageAt = serverTimestamp();
      updateData.status = 'IN_PROGRESS';
    }

    await updateDoc(doc(db, 'conversations', conversationId), updateData);

  } catch (error) {
    console.error("Error enviando mensaje agente:", error);
    throw error;
  }
};

export const sendMessageAsCitizen = async (conversationId: string, content: string, citizenId: string) => {
    try {
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
    } catch (error) {
      console.error("Error enviando mensaje ciudadano:", error);
      throw error;
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

export const startWebConversation = async (name: string, phone: string) => {
    const citizenRef = doc(db, 'citizens', phone);
    await setDoc(citizenRef, {
        name,
        phoneNumber: phone,
        channel: 'web',
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp() 
    }, { merge: true });

    try {
      // Requiere índice: citizenId (ASC) + status (ASC)
      const q = query(
        collection(db, 'conversations'),
        where('citizenId', '==', phone),
        where('status', 'in', ['OPEN', 'IN_PROGRESS']),
        limit(1)
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
    } catch (error: any) {
      if (error.code === 'failed-precondition') {
        console.error("🚨 FALTA ÍNDICE PARA WEBCHAT: citizenId + status", error);
      }
      throw error;
    }
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

export const getCitizenHistory = async (citizenId: string): Promise<Conversation[]> => {
  const q = query(
    collection(db, 'conversations'),
    where('citizenId', '==', citizenId),
    orderBy('createdAt', 'desc'),
    limit(20)
  );
  
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as Conversation));
};