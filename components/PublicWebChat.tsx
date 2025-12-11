import React, { useState, useEffect, useRef } from 'react';
import { Send, User, MessageCircle, X, Loader2 } from 'lucide-react';
import { startWebConversation, sendMessageAsCitizen, subscribeToMessages } from '../services/firestoreService';
import { Message } from '../types';

const PublicWebChat: React.FC = () => {
  const [step, setStep] = useState<'LOGIN' | 'CHAT'>('LOGIN');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  
  // Estado visual para la UI
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Referencia para bloqueo lógico inmediato (soluciona el race condition del doble clic)
  const isSubmittingRef = useRef(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (conversationId) {
      const unsubscribe = subscribeToMessages(conversationId, (data) => {
        setMessages(data);
      });
      return () => unsubscribe();
    }
  }, [conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    // Verificación robusta: comprobamos tanto el estado como la referencia
    if (!name || !phone || isSubmitting || isSubmittingRef.current) return;
    
    // Bloqueo inmediato síncrono
    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      const id = await startWebConversation(name, phone);
      setConversationId(id);
      setStep('CHAT');
      // No desbloqueamos aquí para evitar clics extra durante la transición de vista
    } catch (error) {
      console.error(error);
      alert('Error al iniciar chat');
      // Solo desbloqueamos si hubo un error para permitir reintentar
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !conversationId) return;
    
    try {
      await sendMessageAsCitizen(conversationId, inputText, phone);
      setInputText('');
    } catch (error) {
      console.error(error);
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
             <button onClick={() => window.location.reload()} className="text-white/80 hover:text-white">
               <X size={20} />
             </button>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden bg-gray-50 relative">
          {step === 'LOGIN' ? (
            <div className="p-8 flex flex-col justify-center h-full">
              <h2 className="text-xl font-bold text-gray-800 mb-2 text-center">Bienvenido</h2>
              <p className="text-gray-500 text-center mb-8 text-sm">Ingresa tus datos para iniciar una consulta en línea con un agente.</p>
              
              <form onSubmit={handleStart} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nombre Completo</label>
                  <input
                    type="text"
                    required
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-green-500 outline-none transition"
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
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-green-500 outline-none transition"
                    placeholder="Ej. 70012345"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`w-full bg-green-600 text-white font-bold py-3 rounded-lg hover:bg-green-700 transition shadow-lg mt-4 flex items-center justify-center gap-2 ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={20} className="animate-spin" /> Iniciando...
                    </>
                  ) : (
                    'Iniciar Chat'
                  )}
                </button>
              </form>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg) => {
                  const isCitizen = msg.senderType === 'citizen';
                  const isSystem = msg.senderType === 'bot';
                  
                  if (isSystem) {
                    return (
                      <div key={msg.id} className="flex justify-center my-2">
                        <span className="text-xs bg-blue-50 text-blue-800 px-3 py-1 rounded-full border border-blue-100">
                          {msg.content}
                        </span>
                      </div>
                    );
                  }

                  return (
                    <div key={msg.id} className={`flex ${isCitizen ? 'justify-end' : 'justify-start'}`}>
                      <div className={`flex flex-col max-w-[80%] ${isCitizen ? 'items-end' : 'items-start'}`}>
                         <div className={`px-4 py-2 rounded-2xl text-sm shadow-sm ${
                           isCitizen 
                             ? 'bg-green-600 text-white rounded-tr-none' 
                             : 'bg-white text-gray-800 border border-gray-200 rounded-tl-none'
                         }`}>
                           {msg.content}
                         </div>
                         <span className="text-[10px] text-gray-400 mt-1 px-1">
                           {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '...'}
                         </span>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="p-3 bg-white border-t border-gray-200">
                <form onSubmit={handleSend} className="flex items-center gap-2">
                  <input
                    type="text"
                    className="flex-1 border border-gray-300 rounded-full px-4 py-2 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 text-sm"
                    placeholder="Escribe tu mensaje..."
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                  />
                  <button 
                    type="submit" 
                    disabled={!inputText.trim()}
                    className="bg-green-600 text-white p-2 rounded-full hover:bg-green-700 disabled:opacity-50 transition shadow-sm"
                  >
                    <Send size={20} />
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PublicWebChat;