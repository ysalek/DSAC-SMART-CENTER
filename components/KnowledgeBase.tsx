import React, { useEffect, useState } from 'react';
import { Plus, Search, Edit2, Trash2, BookOpen, Save, X } from 'lucide-react';
import { getArticles, addArticle, updateArticle, deleteArticle } from '../services/knowledgeBaseService';
import { KnowledgeArticle } from '../types';

const KnowledgeBase: React.FC = () => {
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [currentArticle, setCurrentArticle] = useState<Partial<KnowledgeArticle>>({});

  useEffect(() => {
    loadArticles();
  }, []);

  const loadArticles = async () => {
    setLoading(true);
    try {
      const data = await getArticles();
      setArticles(data);
    } catch (error) {
      console.error("Error loading articles:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const articleData = {
        title: currentArticle.title || '',
        category: currentArticle.category || 'General',
        content: currentArticle.content || '',
        tags: typeof currentArticle.tags === 'string' ? (currentArticle.tags as string).split(',').map((t: string) => t.trim()) : (currentArticle.tags || [])
      };

      if (currentArticle.id) {
        await updateArticle(currentArticle.id, articleData);
      } else {
        await addArticle(articleData);
      }
      
      setIsEditing(false);
      setCurrentArticle({});
      loadArticles();
    } catch (error) {
      alert("Error guardando el artículo");
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Estás seguro de eliminar este artículo?')) {
      await deleteArticle(id);
      loadArticles();
    }
  };

  const openEdit = (article: KnowledgeArticle) => {
    setCurrentArticle(article);
    setIsEditing(true);
  };

  const openNew = () => {
    setCurrentArticle({ category: 'General', tags: [] });
    setIsEditing(true);
  };

  const filteredArticles = articles.filter(a => 
    a.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    a.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-8 h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Base de Conocimiento</h1>
          <p className="text-gray-500 text-sm">Gestiona respuestas frecuentes y procedimientos.</p>
        </div>
        <button 
          onClick={openNew}
          className="bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-800 transition"
        >
          <Plus size={18} /> Nuevo Artículo
        </button>
      </div>

      {isEditing ? (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 max-w-3xl mx-auto w-full">
          <h2 className="text-lg font-bold mb-4">{currentArticle.id ? 'Editar Artículo' : 'Nuevo Artículo'}</h2>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
              <input 
                type="text" 
                required
                className="w-full border border-gray-300 rounded-lg px-4 py-2"
                value={currentArticle.title || ''}
                onChange={e => setCurrentArticle({...currentArticle, title: e.target.value})}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                <select 
                  className="w-full border border-gray-300 rounded-lg px-4 py-2"
                  value={currentArticle.category || 'General'}
                  onChange={e => setCurrentArticle({...currentArticle, category: e.target.value})}
                >
                  <option>General</option>
                  <option>Trámites</option>
                  <option>Impuestos</option>
                  <option>Salud</option>
                  <option>Emergencias</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Etiquetas (separadas por coma)</label>
                <input 
                  type="text" 
                  className="w-full border border-gray-300 rounded-lg px-4 py-2"
                  value={Array.isArray(currentArticle.tags) ? currentArticle.tags.join(', ') : currentArticle.tags || ''}
                  onChange={e => setCurrentArticle({...currentArticle, tags: e.target.value as any})}
                  placeholder="ej. impuestos, inmuebles, 2024"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contenido</label>
              <textarea 
                required
                rows={8}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 font-mono text-sm"
                value={currentArticle.content || ''}
                onChange={e => setCurrentArticle({...currentArticle, content: e.target.value})}
              ></textarea>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button 
                type="button" 
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                className="bg-green-700 text-white px-6 py-2 rounded-lg flex items-center gap-2 hover:bg-green-800"
              >
                <Save size={18} /> Guardar
              </button>
            </div>
          </form>
        </div>
      ) : (
        <>
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text" 
              placeholder="Buscar en la base de conocimiento..." 
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          {loading ? (
            <div className="text-center py-12 text-gray-500">Cargando artículos...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto pb-6">
              {filteredArticles.map(article => (
                <div key={article.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition flex flex-col">
                  <div className="flex justify-between items-start mb-2">
                    <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-medium">
                      {article.category}
                    </span>
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(article)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => handleDelete(article.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <h3 className="font-bold text-gray-800 mb-2">{article.title}</h3>
                  <p className="text-sm text-gray-600 line-clamp-3 mb-4 flex-1">
                    {article.content}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-auto">
                    {article.tags?.map((tag, idx) => (
                      <span key={idx} className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">#{tag}</span>
                    ))}
                  </div>
                </div>
              ))}
              {filteredArticles.length === 0 && (
                <div className="col-span-full text-center py-12 text-gray-400 flex flex-col items-center">
                  <BookOpen size={48} className="mb-4 opacity-20" />
                  <p>No se encontraron artículos.</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default KnowledgeBase;