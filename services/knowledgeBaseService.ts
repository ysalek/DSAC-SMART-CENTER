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

// Cache en memoria
let _kbCache: { data: KnowledgeArticle[]; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

export const getArticles = async (): Promise<KnowledgeArticle[]> => {
  // Verificar caché
  if (_kbCache && (Date.now() - _kbCache.timestamp < CACHE_TTL)) {
    return _kbCache.data;
  }

  const q = query(collection(db, COLLECTION_NAME), orderBy('updatedAt', 'desc'));
  const snapshot = await getDocs(q);
  const articles = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as KnowledgeArticle));

  // Actualizar caché
  _kbCache = {
    data: articles,
    timestamp: Date.now()
  };

  return articles;
};

export const findRelevantArticles = async (searchText: string): Promise<KnowledgeArticle[]> => {
  if (!searchText) return [];
  
  // Usar versión con caché
  const allArticles = await getArticles();
  const lowerSearch = searchText.toLowerCase();
  
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