import React, { useState, useEffect, useRef } from 'react';
import { Send, MessageCircle, X, Loader2 } from 'lucide-react';
import { startWebConversation, sendMessageAsCitizen, subscribeToMessages } from '../services/firestoreService';
import { Message } from '../types';

const PublicWebChat: React.FC = () => {
  const [step, setStep] = useState<'LOGIN' | 'CHAT'>('LOGIN');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState(''); // Se usa como ID del ciudadano
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Suscripción a mensajes
  useEffect(() => {
    if (conversationId) {
      const unsubscribe = subscribeToMessages(conversationId, (data) => {
        setMessages(data);
      });
      return () => unsubscribe();
    }
  }, [conversationId]);

  // Scroll automático al fondo al recibir mensajes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      const id = await startWebConversation(name, phone);
      setConversationId(id);
      setStep('CHAT');
    } catch (error) {
      console.error("Error al iniciar chat:", error);
      alert('Error de conexión. Intente nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !conversationId) return;
    
    const content = inputText.trim();
    setInputText(''); // Limpieza optimista

    try {
      await sendMessageAsCitizen(conversationId, content, phone);
    } catch (error) {
      console.error("Error enviando mensaje:", error);
      alert("No se pudo enviar el mensaje.");
      setInputText(content); // Restaurar si falla
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[600px] border border-gray-200">
        
        {/* Header */}
        <div className="bg-green-600 p-4 flex items-center justify-between shadow-md z-10">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-full">
              <MessageCircle className="text-white" size={24} />
            </div>
            <div>
              <h1 className="font-bold text-white text-lg">Atención Ciudadana</h1>
              <p className="text-green-100 text-xs">Gobierno Municipal de Santa Cruz</p>
            </div>
          </div>
          {step === 'CHAT' && (
             <button onClick={() => window.location.reload()} className="text-white/80 hover:text-white" title="Salir">
               <X size={20} />
             </button>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden bg-gray-50 relative flex flex-col">
          {step === 'LOGIN' ? (
            <div className="p-8 flex flex-col justify-center h-full">
              <h2 className="text-xl font-bold text-gray-800 mb-2 text-center">Bienvenido</h2>
              <p className="text-gray-500 text-center mb-8 text-sm">Ingresa tus datos para iniciar una consulta en línea.</p>
              
              <form onSubmit={handleStart} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nombre Completo</label>
                  <input
                    type="text"
                    required
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-green-500 outline-none"
                    placeholder="Ej. Juan Pérez"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Teléfono / Celular</label>
                  <input
                    type="tel"
                    required
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-green-500 outline-none"
                    placeholder="Ej. 70012345"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-green-600 text-white font-bold py-3 rounded-lg hover:bg-green-700 transition shadow-lg mt-4 flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : 'Iniciar Chat'}
                </button>
              </form>
            </div>
          ) : (
            <>
              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#e5ddd5]">
                {messages.length === 0 && (
                   <p className="text-center text-gray-400 text-xs mt-4">Inicio de la conversación.</p>
                )}
                
                {messages.map((msg) => {
                  const isCitizen = msg.senderType === 'citizen';
                  const isSystem = msg.senderType === 'bot';
                  
                  if (isSystem) {
                    return (
                      <div key={msg.id} className="flex justify-center my-2">
                        <span className="text-xs bg-blue-50 text-blue-800 px-3 py-1 rounded-full border border-blue-100 shadow-sm text-center">
                          {msg.content}
                        </span>
                      </div>
                    );
                  }

                  if (msg.isInternal) return null;

                  return (
                    <div key={msg.id} className={`flex ${isCitizen ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm shadow-sm whitespace-pre-wrap ${
                           isCitizen 
                             ? 'bg-[#d9fdd3] text-gray-900 rounded-tr-none' 
                             : 'bg-white text-gray-800 border-gray-200 rounded-tl-none'
                         }`}>
                           {msg.content}
                           <div className="text-[10px] text-gray-500 mt-1 text-right opacity-70">
                             {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '...'}
                           </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="p-3 bg-[#f0f2f5] border-t border-gray-200">
                <form onSubmit={handleSend} className="flex items-center gap-2">
                  <input
                    type="text"
                    className="flex-1 border-none rounded-lg px-4 py-2 focus:outline-none focus:ring-1 focus:ring-gray-300 text-sm bg-white h-10"
                    placeholder="Escribe tu mensaje..."
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                  />
                  <button 
                    type="submit" 
                    disabled={!inputText.trim()}
                    className="bg-green-600 text-white p-2 rounded-full hover:bg-green-700 disabled:opacity-50 transition shadow-sm h-10 w-10 flex items-center justify-center"
                  >
                    <Send size={20} className="ml-0.5" />
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PublicWebChat;