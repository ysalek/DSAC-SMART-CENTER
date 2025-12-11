import React, { useEffect, useState } from 'react';
import { Save, AlertTriangle, Zap, Trash2, Plus } from 'lucide-react';
import { getSystemSettings, updateSystemSettings } from '../services/firestoreService';
import { getQuickReplies, addQuickReply, deleteQuickReply } from '../services/quickRepliesService';
import { SystemSettings, QuickReply } from '../types';

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'GENERAL' | 'SCRIPTS'>('GENERAL');
  
  // Settings State
  const [settings, setSettings] = useState<Partial<SystemSettings>>({
    whatsappEnabled: false,
    whatsappBusinessNumber: '',
    organizationName: '',
    systemPrompt: '',
    autoReplyEnabled: true
  });
  
  // Scripts State
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [newScript, setNewScript] = useState({ shortcut: '', text: '', category: 'General' });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getSystemSettings(),
      getQuickReplies()
    ]).then(([settingsData, repliesData]) => {
      if (settingsData) setSettings(settingsData);
      setQuickReplies(repliesData);
      setLoading(false);
    });
  }, []);

  const handleSaveSettings = async () => {
    try {
      await updateSystemSettings(settings, 'admin_user');
      alert('Configuración guardada correctamente');
    } catch (error) {
      alert('Error al guardar');
    }
  };

  const handleAddScript = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!newScript.shortcut || !newScript.text) return;
    try {
      await addQuickReply(newScript);
      setQuickReplies(await getQuickReplies());
      setNewScript({ shortcut: '', text: '', category: 'General' });
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteScript = async (id: string) => {
    if(confirm('¿Borrar este script?')) {
      await deleteQuickReply(id);
      setQuickReplies(await getQuickReplies());
    }
  };

  const getBaseUrl = () => {
    const meta = import.meta as any;
    return (meta.env && meta.env.VITE_FUNCTIONS_BASE_URL) || "https://us-central1-chat-inteligente-fdeb8.cloudfunctions.net";
  };

  const webhookUrl = `${getBaseUrl()}/whatsappWebhook`;

  if (loading) return <div className="p-8">Cargando...</div>;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Configuración del Sistema</h1>

      <div className="flex gap-4 mb-6">
        <button 
          onClick={() => setActiveTab('GENERAL')}
          className={`px-4 py-2 rounded-lg font-medium transition ${activeTab === 'GENERAL' ? 'bg-green-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
        >
          General y Canales
        </button>
        <button 
          onClick={() => setActiveTab('SCRIPTS')}
          className={`px-4 py-2 rounded-lg font-medium transition ${activeTab === 'SCRIPTS' ? 'bg-green-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
        >
          Respuestas Rápidas (Scripts)
        </button>
      </div>

      {activeTab === 'GENERAL' ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="font-bold text-lg text-gray-700 mb-2">Canal WhatsApp Business</h2>
            <p className="text-sm text-gray-500">Configura la integración con Meta Cloud API.</p>
          </div>
          
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <label className="font-medium text-gray-700">Estado del Canal</label>
                <p className="text-xs text-gray-500">Habilitar o deshabilitar la recepción de mensajes</p>
              </div>
              <button
                onClick={() => setSettings({...settings, whatsappEnabled: !settings.whatsappEnabled})}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.whatsappEnabled ? 'bg-green-600' : 'bg-gray-300'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.whatsappEnabled ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <label className="font-medium text-gray-700">Respuesta Automática (Bienvenida)</label>
                <p className="text-xs text-gray-500">Enviar mensaje de bienvenida a nuevos chats automáticamente</p>
              </div>
              <button
                onClick={() => setSettings({...settings, autoReplyEnabled: !settings.autoReplyEnabled})}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.autoReplyEnabled ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.autoReplyEnabled ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Número de WhatsApp Business</label>
                <input
                  type="text"
                  value={settings.whatsappBusinessNumber}
                  onChange={(e) => setSettings({...settings, whatsappBusinessNumber: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2"
                  placeholder="+591 XXXXXXXX"
                />
              </div>
              <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Organización</label>
                <input
                  type="text"
                  value={settings.organizationName}
                  onChange={(e) => setSettings({...settings, organizationName: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2"
                  placeholder="Gobierno Municipal..."
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prompt del Sistema (IA)</label>
              <textarea
                value={settings.systemPrompt}
                onChange={(e) => setSettings({...settings, systemPrompt: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 h-24 text-sm"
                placeholder="Define la personalidad del asistente inteligente (ej. Eres un agente formal...)"
              />
            </div>

            <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={16} className="text-blue-600" />
                <span className="font-bold text-sm text-blue-800">Configuración de Webhook</span>
              </div>
              <p className="text-xs text-blue-700 mb-2">
                Copia esta URL y pégala en el panel de desarrolladores de Meta (WhatsApp Configuration).
              </p>
              <code className="block bg-white p-3 rounded border border-blue-200 text-xs font-mono text-gray-600 break-all">
                {webhookUrl}
              </code>
              <p className="text-xs text-blue-700 mt-2">Verify Token: <span className="font-mono font-bold">dsac_santa_cruz_token</span></p>
            </div>
          </div>

          <div className="p-6 bg-gray-50 border-t border-gray-200 flex justify-end">
            <button
              onClick={handleSaveSettings}
              className="flex items-center gap-2 bg-green-700 text-white px-6 py-2 rounded-lg hover:bg-green-800 transition"
            >
              <Save size={18} />
              Guardar General
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
           <div className="p-6 border-b border-gray-200 flex justify-between items-center">
            <div>
              <h2 className="font-bold text-lg text-gray-700 mb-1">Respuestas Rápidas</h2>
              <p className="text-sm text-gray-500">Crea plantillas para agilizar la atención.</p>
            </div>
            <Zap className="text-yellow-500" size={24} />
          </div>

          <div className="p-6">
            <form onSubmit={handleAddScript} className="flex gap-3 mb-6 bg-gray-50 p-4 rounded-lg items-end">
              <div className="w-1/4">
                 <label className="text-xs font-bold text-gray-500 uppercase">Atajo (ej. /hola)</label>
                 <input 
                    type="text"
                    required 
                    placeholder="/atajo"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-1"
                    value={newScript.shortcut}
                    onChange={e => setNewScript({...newScript, shortcut: e.target.value})}
                 />
              </div>
              <div className="flex-1">
                 <label className="text-xs font-bold text-gray-500 uppercase">Texto del Mensaje</label>
                 <input 
                    type="text"
                    required 
                    placeholder="Escribe el mensaje completo..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-1"
                    value={newScript.text}
                    onChange={e => setNewScript({...newScript, text: e.target.value})}
                 />
              </div>
              <button type="submit" className="bg-blue-600 text-white p-2.5 rounded-lg hover:bg-blue-700 transition">
                <Plus size={20} />
              </button>
            </form>

            <div className="space-y-2">
              {quickReplies.length === 0 ? (
                <p className="text-center text-gray-400 py-4">No hay scripts definidos.</p>
              ) : (
                quickReplies.map(reply => (
                  <div key={reply.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                    <div className="flex items-center gap-4">
                      <span className="bg-gray-200 text-gray-700 font-mono text-xs px-2 py-1 rounded">
                        {reply.shortcut}
                      </span>
                      <p className="text-sm text-gray-800">{reply.text}</p>
                    </div>
                    <button onClick={() => handleDeleteScript(reply.id)} className="text-gray-400 hover:text-red-500">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;