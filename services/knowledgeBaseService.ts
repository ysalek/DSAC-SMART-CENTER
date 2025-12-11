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
import { KnowledgeArticle } from '../types';

const COLLECTION_NAME = 'knowledgeBaseArticles';

// --- CACHE EN MEMORIA ---
// Reducimos lecturas de Firestore almacenando los artículos localmente por 5 minutos.
let _kbCache: { data: KnowledgeArticle[]; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

export const getArticles = async (): Promise<KnowledgeArticle[]> => {
  // 1. Verificar si hay caché válida
  if (_kbCache && (Date.now() - _kbCache.timestamp < CACHE_TTL)) {
    return _kbCache.data;
  }

  // 2. Si no hay caché, consultar Firestore
  try {
    const q = query(collection(db, COLLECTION_NAME), orderBy('updatedAt', 'desc'));
    const snapshot = await getDocs(q);
    const articles = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as KnowledgeArticle));

    // 3. Actualizar caché
    _kbCache = {
      data: articles,
      timestamp: Date.now()
    };

    return articles;
  } catch (error) {
    console.error("Error fetching knowledge base:", error);
    return [];
  }
};

export const findRelevantArticles = async (searchText: string): Promise<KnowledgeArticle[]> => {
  if (!searchText) return [];
  
  // Usamos la función con caché interna en lugar de consultar Firestore directamente cada vez
  const allArticles = await getArticles();
  const lowerSearch = searchText.toLowerCase().trim();
  
  // Tokenización simple para búsqueda
  const keywords = lowerSearch.split(/\s+/).filter(w => w.length > 3);

  return allArticles.filter(article => {
    const title = article.title.toLowerCase();
    const content = article.content.toLowerCase();
    const tags = article.tags?.map(t => t.toLowerCase()) || [];
    
    // Coincidencia exacta en título
    if (title.includes(lowerSearch)) return true;

    // Coincidencia parcial de keywords en contenido o tags
    const keywordMatches = keywords.filter(k => 
      title.includes(k) || content.includes(k) || tags.some(t => t.includes(k))
    );
    
    // Devuelve true si coincide al menos una palabra clave significativa
    return keywordMatches.length > 0;
  }).slice(0, 3); // Top 3 resultados
};

export const addArticle = async (article: Omit<KnowledgeArticle, 'id' | 'updatedAt'>) => {
  // Invalidar caché al escribir
  _kbCache = null;
  return await addDoc(collection(db, COLLECTION_NAME), {
    ...article,
    updatedAt: serverTimestamp()
  });
};

export const updateArticle = async (id: string, article: Partial<KnowledgeArticle>) => {
  _kbCache = null;
  const docRef = doc(db, COLLECTION_NAME, id);
  await updateDoc(docRef, {
    ...article,
    updatedAt: serverTimestamp()
  });
};

export const deleteArticle = async (id: string) => {
  _kbCache = null;
  await deleteDoc(doc(db, COLLECTION_NAME, id));
};