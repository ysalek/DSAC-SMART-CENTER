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

// Caché simple en memoria (TTL 5 minutos)
let _kbCache: { data: KnowledgeArticle[]; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

export const getArticles = async (): Promise<KnowledgeArticle[]> => {
  if (_kbCache && (Date.now() - _kbCache.timestamp < CACHE_TTL)) {
    return _kbCache.data;
  }

  try {
    const q = query(collection(db, COLLECTION_NAME), orderBy('updatedAt', 'desc'));
    const snapshot = await getDocs(q);
    const articles = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as KnowledgeArticle));

    _kbCache = {
      data: articles,
      timestamp: Date.now()
    };

    return articles;
  } catch (error) {
    console.error("Error cargando base de conocimiento:", error);
    return [];
  }
};

export const findRelevantArticles = async (searchText: string): Promise<KnowledgeArticle[]> => {
  if (!searchText) return [];
  
  // Usamos la función con caché en lugar de consultar Firestore directamente
  const allArticles = await getArticles();
  const lowerSearch = searchText.toLowerCase().trim();
  const keywords = lowerSearch.split(/\s+/).filter(w => w.length > 3);

  return allArticles.filter(article => {
    const title = article.title.toLowerCase();
    const content = article.content.toLowerCase();
    const tags = article.tags?.map(t => t.toLowerCase()) || [];
    
    if (title.includes(lowerSearch)) return true;

    const keywordMatches = keywords.filter(k => 
      title.includes(k) || content.includes(k) || tags.some(t => t.includes(k))
    );
    
    return keywordMatches.length > 0;
  }).slice(0, 3);
};

export const addArticle = async (article: Omit<KnowledgeArticle, 'id' | 'updatedAt'>) => {
  _kbCache = null; // Invalidar caché
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