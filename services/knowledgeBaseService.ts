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

export const getArticles = async (): Promise<KnowledgeArticle[]> => {
  const q = query(collection(db, COLLECTION_NAME), orderBy('updatedAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as KnowledgeArticle));
};

/**
 * Busca artículos relevantes basados en un texto de consulta.
 * Realiza un filtrado simple del lado del cliente (suficiente para <500 artículos).
 */
export const findRelevantArticles = async (searchText: string): Promise<KnowledgeArticle[]> => {
  if (!searchText) return [];
  
  // Obtenemos todos los artículos (en producción se usaría Algolia o ElasticSearch)
  const allArticles = await getArticles();
  const lowerSearch = searchText.toLowerCase();
  
  // Dividimos la búsqueda en palabras clave (ignorando palabras cortas)
  const keywords = lowerSearch.split(/\s+/).filter(w => w.length > 3);

  return allArticles.filter(article => {
    const title = article.title.toLowerCase();
    const content = article.content.toLowerCase();
    const tags = article.tags?.map(t => t.toLowerCase()) || [];
    
    // Coincidencia directa fuerte
    if (title.includes(lowerSearch)) return true;

    // Coincidencia por palabras clave
    const keywordMatches = keywords.filter(k => 
      title.includes(k) || content.includes(k) || tags.some(t => t.includes(k))
    );
    
    // Retornar si hay coincidencia de al menos una palabra clave relevante
    return keywordMatches.length > 0;
  }).slice(0, 3); // Limitamos a los 3 más relevantes para no saturar el contexto
};

export const addArticle = async (article: Omit<KnowledgeArticle, 'id' | 'updatedAt'>) => {
  return await addDoc(collection(db, COLLECTION_NAME), {
    ...article,
    updatedAt: serverTimestamp()
  });
};

export const updateArticle = async (id: string, article: Partial<KnowledgeArticle>) => {
  const docRef = doc(db, COLLECTION_NAME, id);
  await updateDoc(docRef, {
    ...article,
    updatedAt: serverTimestamp()
  });
};

export const deleteArticle = async (id: string) => {
  await deleteDoc(doc(db, COLLECTION_NAME, id));
};