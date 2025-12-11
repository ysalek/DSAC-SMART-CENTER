import React, { useState, useEffect, useRef } from 'react';
import { Send, Phone, User, Clock, CheckCircle, MessageSquare, AlertCircle, Sparkles, XCircle, Check, Search, Filter, Tag, StickyNote, Save, BookOpen, Inbox, Briefcase, Users, ArrowRightLeft, Zap, X, History, BrainCircuit, Eye, Copy, ClipboardCheck, ArrowDownLeft, FileCheck, Paperclip, FileText, Image as ImageIcon, Loader2, Lock, Unlock, Mic, Square, PlayCircle, MapPin, Download } from 'lucide-react';
import { subscribeToConversations, subscribeToMessages, sendMessageAsAgent, getSystemSettings, assignConversation, transferConversation, getCitizenHistory, getMessagesOnce, closeConversation } from '../services/firestoreService';
import { sendWhatsAppMessage } from '../services/whatsappService';
import { getCitizensByIds, updateCitizenProfile } from '../services/citizenService';
import { generateSmartReply, analyzeCaseConversation } from '../services/geminiService';
import { findRelevantArticles } from '../services/knowledgeBaseService';
import { getQuickReplies } from '../services/quickRepliesService';
import { uploadAttachment } from '../services/storageService';
import { Conversation, Message, Citizen, SystemSettings, Agent, QuickReply, KnowledgeArticle } from '../types';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'; 
import { db } from '../src/firebase';
import { useAuth } from '../src/contexts/AuthContext';
import { getAgents } from '../services/agentsService';

type InboxFilter = 'MINE' | 'UNASSIGNED' | 'ALL' | 'CLOSED';

// Base64 simple notification sound (short beep)
const NOTIFICATION_SOUND = "data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU"; 

const ChatConsole: React.FC = () => {
  const { currentUser, agentProfile } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [citizensMap, setCitizensMap] = useState<Record<string, Citizen>>({});
  const [agentsMap, setAgentsMap] = useState<Record<string, Agent>>({});
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Attachments State
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Internal Mode State (Whisper)
  const [isInternalMode, setIsInternalMode] = useState(false);

  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);

  // AI & Scripts State
  const [generatingAI, setGeneratingAI] = useState(false);
  const [analyzingCase, setAnalyzingCase] = useState(false);
  const [aiStatusText, setAiStatusText] = useState('');
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [showScripts, setShowScripts] = useState(false);
  
  // Modals State
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closingDisposition, setClosingDisposition] = useState('');
  const [closingNote, setClosingNote] = useState('');

  // History Inspector State
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyMessages, setHistoryMessages] = useState<Message[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // UI States
  const [searchTerm, setSearchTerm] = useState('');
  const [inboxFilter, setInboxFilter] = useState<InboxFilter>('MINE');
  const [showProfilePanel, setShowProfilePanel] = useState(true);
  const [editingNotes, setEditingNotes] = useState('');
  const [editingTags, setEditingTags] = useState('');
  const [profileTab, setProfileTab] = useState<'INFO' | 'HISTORY' | 'KB'>('INFO');
  const [citizenHistory, setCitizenHistory] = useState<Conversation[]>([]);
  
  // KB Tab State
  const [kbSearchTerm, setKbSearchTerm] = useState('');
  const [kbResults, setKbResults] = useState<KnowledgeArticle[]>([]);
  const [searchingKb, setSearchingKb] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Init Data
  useEffect(() => {
    getSystemSettings().then(setSystemSettings);
    getAgents().then(agents => {
      const map: Record<string, Agent> = {};
      agents.forEach(a => map[a.id] = a);
      setAgentsMap(map);
    });
    getQuickReplies().then(setQuickReplies);
    // Init Audio
    audioRef.current = new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg");
  }, []);

  // Subscriptions
  useEffect(() => {
    const unsubscribe = subscribeToConversations(setConversations);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const loadCitizens = async () => {
      const idsToFetch = conversations.map(c => c.citizenId).filter(id => !citizensMap[id]); 
      if (idsToFetch.length > 0) {
        const fetchedCitizens = await getCitizensByIds(idsToFetch);
        const newMap = { ...citizensMap };
        fetchedCitizens.forEach(c => newMap[c.id] = c);
        setCitizensMap(newMap);
      }
    };
    if (conversations.length > 0) loadCitizens();
  }, [conversations, citizensMap]);

  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }
    const unsubscribe = subscribeToMessages(activeConversationId, (newMessages) => {
      setMessages(prev => {
        // Sound Notification Check: If new message is from citizen and we have previous messages
        if (prev.length > 0 && newMessages.length > prev.length) {
          const lastMsg = newMessages[newMessages.length - 1];
          if (lastMsg.senderType === 'citizen') {
             audioRef.current?.play().catch(() => {}); // Catch autoplay errors
          }
        }
        return newMessages;
      });
    });
    return () => unsubscribe();
  }, [activeConversationId]);

  const activeConversation = conversations.find(c => c.id === activeConversationId);
  const activeCitizen = activeConversation ? citizensMap[activeConversation.citizenId] : null;

  useEffect(() => {
    if (activeCitizen) {
      setEditingNotes(activeCitizen.notes || '');
      setEditingTags(activeCitizen.tags ? activeCitizen.tags.join(', ') : '');
      // Cargar historial
      getCitizenHistory(activeCitizen.id).then(setCitizenHistory);
      // Reset KB search
      setKbSearchTerm('');
      setKbResults([]);
    }
  }, [activeCitizen?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // KB Search Effect
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (kbSearchTerm.trim().length > 2) {
        setSearchingKb(true);
        try {
          const results = await findRelevantArticles(kbSearchTerm);
          setKbResults(results);
        } catch (e) {
          console.error(e);
        } finally {
          setSearchingKb(false);
        }
      } else {
        setKbResults([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [kbSearchTerm]);

  const handleSendMessage = async (e?: React.FormEvent, attachmentUrl?: string) => {
    if (e) e.preventDefault();
    if ((!inputText.trim() && !attachmentUrl) || !activeConversationId || sending) return;

    const currentConvo = conversations.find(c => c.id === activeConversationId);
    if (!currentConvo) return;

    setSending(true);
    try {
      const agentId = agentProfile?.id || currentUser?.uid || "unknown_agent";
      
      if (!currentConvo.assignedAgentId) {
        await assignConversation(currentConvo.id, agentId);
      }

      const attachments = attachmentUrl ? [attachmentUrl] : [];
      
      // Enviar a Firestore (marcando si es interno)
      await sendMessageAsAgent(activeConversationId, inputText, agentId, attachments, isInternalMode);

      // Si NO es interno y el canal es WhatsApp, enviar a la API
      if (!isInternalMode && currentConvo.sourceChannel === 'whatsapp') {
        const citizen = citizensMap[currentConvo.citizenId];
        const phoneNumber = citizen?.phoneNumber || currentConvo.citizenId;
        await sendWhatsAppMessage(activeConversationId, phoneNumber, inputText, agentId, attachmentUrl);
      }

      setInputText('');
      setShowScripts(false);
      // Mantener el modo interno si estaba activo, o resetearlo?
      // Usualmente se resetea para evitar errores, pero si se está en "modo supervisión" quizás no.
      // Para seguridad, lo dejamos activo pero visualmente claro.
    } catch (error) {
      console.error(error);
      alert("Error enviando mensaje.");
    } finally {
      setSending(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeConversationId) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("El archivo es demasiado grande (Máx 5MB).");
      return;
    }

    setIsUploading(true);
    try {
      const url = await uploadAttachment(file, activeConversationId);
      await handleSendMessage(undefined, url);
    } catch (error) {
      alert("Error al subir el archivo.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // --- AUDIO RECORDING LOGIC ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      timerIntervalRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("No se pudo acceder al micrófono.");
    }
  };

  const stopRecording = (shouldSend: boolean) => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.onstop = async () => {
        if (shouldSend && activeConversationId) {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' }); // Browsers record in webm/ogg
          const audioFile = new File([audioBlob], "voice_note.webm", { type: 'audio/webm' });
          
          setIsUploading(true);
          try {
            const url = await uploadAttachment(audioFile, activeConversationId);
            // Send empty text, with audio attachment
            await handleSendMessage(undefined, url);
          } catch (error) {
            console.error(error);
            alert("Error enviando audio.");
          } finally {
            setIsUploading(false);
          }
        }
        // Cleanup
        audioChunksRef.current = [];
      };
      
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }

    setIsRecording(false);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAssignToMe = async () => {
    if (!activeConversationId || !agentProfile) return;
    try {
      await assignConversation(activeConversationId, agentProfile.id);
    } catch (error) {
      console.error(error);
    }
  };

  const handleTransfer = async (targetAgentId: string) => {
    if(!activeConversationId || !agentProfile) return;
    try {
      await transferConversation(activeConversationId, targetAgentId, agentProfile.displayName);
      setShowTransferModal(false);
      setInboxFilter('MINE'); 
      setActiveConversationId(null);
    } catch (error) {
      console.error("Error transfiriendo chat:", error);
    }
  };

  const handleSmartReply = async () => {
    if (!activeConversationId || generatingAI || messages.length === 0) return;
    
    const citizenName = activeCitizen?.name || "Ciudadano";
    const lastCitizenMessage = [...messages].reverse().find(m => m.senderType === 'citizen');
    
    setGeneratingAI(true);
    setAiStatusText("Analizando conversación...");

    try {
      let kbContext = "";
      if (lastCitizenMessage) {
        setAiStatusText("Buscando en Base de Conocimiento...");
        const relevantArticles = await findRelevantArticles(lastCitizenMessage.content);
        if (relevantArticles.length > 0) {
          kbContext = relevantArticles.map(a => `TÍTULO: ${a.title}\nCONTENIDO: ${a.content}`).join('\n---\n');
        }
      }
      if (activeCitizen?.notes) kbContext += `\nNOTA CIUDADANO: ${activeCitizen.notes}`;

      setAiStatusText("Generando respuesta...");
      const suggestion = await generateSmartReply(messages, citizenName, kbContext, systemSettings?.systemPrompt);
      if (suggestion) setInputText(suggestion);
    } catch (e) {
      console.error(e);
    } finally {
      setGeneratingAI(false);
      setAiStatusText("");
    }
  };

  const handleAutoAnalyzeCase = async () => {
    if (!messages.length || analyzingCase) return;
    
    setAnalyzingCase(true);
    try {
      const result = await analyzeCaseConversation(messages, activeCitizen?.name || "Ciudadano");
      
      if (result.summary) {
        const time = new Date().toLocaleDateString();
        const newSummary = `[IA ${time}]: ${result.summary}`;
        setEditingNotes(prev => prev ? `${prev}\n\n${newSummary}` : newSummary);
      }
      
      if (result.tags && result.tags.length > 0) {
         const currentTags = editingTags.split(',').map(t => t.trim()).filter(t => t);
         const newTagsSet = new Set([...currentTags, ...result.tags]);
         setEditingTags(Array.from(newTagsSet).join(', '));
      }

    } catch (error) {
      console.error(error);
      alert("No se pudo analizar el caso.");
    } finally {
      setAnalyzingCase(false);
    }
  };

  const handleConfirmClose = async () => {
    if (!activeConversationId || !closingDisposition) return;
    try {
      await closeConversation(activeConversationId, closingDisposition, closingNote);
      setShowCloseModal(false);
      setClosingDisposition('');
      setClosingNote('');
      setActiveConversationId(null);
    } catch (error) {
      console.error(error);
      alert("Error al cerrar conversación");
    }
  };

  const saveProfileChanges = async () => {
    if (!activeCitizen) return;
    try {
      const tagsArray = editingTags.split(',').map(t => t.trim()).filter(t => t);
      await updateCitizenProfile(activeCitizen.id, { notes: editingNotes, tags: tagsArray });
      setCitizensMap(prev => ({ ...prev, [activeCitizen.id]: { ...activeCitizen, notes: editingNotes, tags: tagsArray } }));
      alert("Perfil actualizado");
    } catch (e) { console.error(e); }
  };

  const handleViewHistory = async (historyId: string) => {
    setHistoryModalOpen(true);
    setHistoryLoading(true);
    setHistoryMessages([]);
    try {
      const msgs = await getMessagesOnce(historyId);
      setHistoryMessages(msgs);
    } catch (error) {
      console.error(error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const copyTranscript = () => {
    const transcript = messages.map(m => 
      `[${m.createdAt?.toDate ? m.createdAt.toDate().toLocaleString() : ''}] ${m.senderType === 'agent' ? 'Agente' : 'Ciudadano'}: ${m.content}`
    ).join('\n');
    
    navigator.clipboard.writeText(transcript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const exportChat = () => {
      // Función simple para imprimir la vista actual (o podríamos generar un PDF más complejo)
      window.print();
  };

  const filteredConversations = conversations.filter(convo => {
    const matchesSearch = () => {
      if (!searchTerm) return true;
      const citizen = citizensMap[convo.citizenId];
      const search = searchTerm.toLowerCase();
      return (citizen?.name?.toLowerCase().includes(search) || citizen?.phoneNumber?.includes(search) || convo.citizenId.includes(search));
    };

    if (!matchesSearch()) return false;

    switch (inboxFilter) {
      case 'MINE': return convo.status !== 'CLOSED' && convo.assignedAgentId === agentProfile?.id;
      case 'UNASSIGNED': return convo.status !== 'CLOSED' && !convo.assignedAgentId;
      case 'CLOSED': return convo.status === 'CLOSED';
      case 'ALL': default: return convo.status !== 'CLOSED';
    }
  });

  const getAssignedAgentName = (agentId: string | null) => agentId ? (agentId === agentProfile?.id ? "Mí" : agentsMap[agentId]?.displayName || "Otro") : "Sin Asignar";

  // Helper to render message attachments
  const renderAttachments = (msg: Message) => {
    const attachments = msg.attachments;
    const location = msg.location;

    if (location) {
        const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`;
        return (
             <div className="mt-2 rounded-lg overflow-hidden border border-gray-200">
                <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer" className="block relative">
                   <div className="bg-gray-100 p-4 flex flex-col items-center justify-center text-center gap-2 hover:bg-gray-200 transition h-32">
                      <MapPin size={32} className="text-red-500" />
                      <div className="text-xs font-bold text-gray-700">Ver Ubicación en Mapa</div>
                      <div className="text-[10px] text-gray-500">{location.address || `${location.latitude}, ${location.longitude}`}</div>
                   </div>
                </a>
             </div>
        );
    }

    if (!attachments || attachments.length === 0) return null;
    return (
      <div className="flex flex-col gap-1 mt-2">
        {attachments.map((url, idx) => {
          const isImage = url.includes('.jpg') || url.includes('.png') || url.includes('.jpeg') || url.includes('.gif') || url.includes('alt=media');
          const isAudio = url.includes('.webm') || url.includes('.ogg') || url.includes('.mp3') || url.includes('.wav');
          
          if (isAudio) {
            return (
              <div key={idx} className="flex items-center gap-2 bg-gray-100 p-2 rounded-lg min-w-[200px]">
                <PlayCircle size={20} className="text-gray-600" />
                <audio controls src={url} className="w-full h-8" />
              </div>
            );
          }
          
          return isImage ? (
            <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="block">
              <img src={url} alt="Adjunto" className="max-w-full rounded-lg border border-gray-200 max-h-48 object-cover hover:opacity-90 transition" />
            </a>
          ) : (
            <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-gray-100 p-2 rounded-lg text-xs hover:bg-gray-200 text-blue-600 truncate max-w-[200px]">
              <FileText size={16} /> Ver Documento Adjunto
            </a>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex h-full bg-white overflow-hidden relative print:block">
      
      {/* COLUMN 1: LIST (Oculto al imprimir) */}
      <div className="w-80 border-r border-gray-200 flex flex-col bg-gray-50 flex-shrink-0 print:hidden">
        <div className="p-4 border-b border-gray-200 bg-white shadow-sm z-10">
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg mb-3">
             <button onClick={() => setInboxFilter('MINE')} title="Mis Chats" className={`flex-1 flex justify-center py-1.5 rounded transition ${inboxFilter === 'MINE' ? 'bg-white text-green-700 shadow font-bold' : 'text-gray-500'}`}><Briefcase size={16} /></button>
             <button onClick={() => setInboxFilter('UNASSIGNED')} title="Sin Asignar" className={`flex-1 flex justify-center py-1.5 rounded transition ${inboxFilter === 'UNASSIGNED' ? 'bg-white text-orange-600 shadow font-bold' : 'text-gray-500'}`}><Inbox size={16} /></button>
             <button onClick={() => setInboxFilter('ALL')} title="Todos" className={`flex-1 flex justify-center py-1.5 rounded transition ${inboxFilter === 'ALL' ? 'bg-white text-blue-600 shadow font-bold' : 'text-gray-500'}`}><Users size={16} /></button>
             <button onClick={() => setInboxFilter('CLOSED')} title="Cerrados" className={`flex-1 flex justify-center py-1.5 rounded transition ${inboxFilter === 'CLOSED' ? 'bg-white text-gray-800 shadow font-bold' : 'text-gray-500'}`}><CheckCircle size={16} /></button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
            <input type="text" placeholder="Buscar..." className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-green-500" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm flex flex-col items-center">
              <Inbox size={48} className="mb-2 opacity-20" /> <p>No hay conversaciones.</p>
            </div>
          ) : (
            filteredConversations.map((convo) => {
              const citizen = citizensMap[convo.citizenId];
              const isSelected = activeConversationId === convo.id;
              return (
                <div key={convo.id} onClick={() => setActiveConversationId(convo.id)} className={`p-4 border-b border-gray-100 cursor-pointer transition-all ${isSelected ? 'bg-white border-l-4 border-l-green-600 shadow-md' : 'hover:bg-gray-100 border-l-4 border-l-transparent'}`}>
                  <div className="flex justify-between items-start mb-1">
                    <span className={`font-semibold text-sm flex items-center gap-1 truncate max-w-[150px] ${isSelected ? 'text-green-800' : 'text-gray-800'}`}>
                      {convo.sourceChannel === 'whatsapp' && <Phone size={12} />} {citizen?.name || convo.citizenId}
                    </span>
                    <span className="text-[10px] text-gray-400">{convo.lastMessageAt?.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 ${convo.assignedAgentId ? 'bg-gray-100 text-gray-600' : 'bg-orange-100 text-orange-700 font-bold'}`}>
                       {convo.assignedAgentId ? <><User size={8} /> {getAssignedAgentName(convo.assignedAgentId)}</> : 'SIN ASIGNAR'}
                    </span>
                    {convo.unreadCount > 0 && <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm min-w-[18px] text-center">{convo.unreadCount}</span>}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* COLUMN 2: CHAT */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative border-r border-gray-200 print:border-none print:w-full">
        {activeConversationId ? (
          <>
            <div className="p-4 border-b border-gray-200 bg-white shadow-sm flex justify-between items-center z-10 h-16 print:border-none">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-600 text-white rounded-full flex items-center justify-center shadow-sm"><User size={20} /></div>
                <div>
                  <h3 className="font-bold text-gray-800 text-sm">{activeCitizen?.name || activeConversation?.citizenId}</h3>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                     <span>{activeConversation?.sourceChannel === 'whatsapp' ? 'WhatsApp' : 'Web'}</span>
                     <span className="text-gray-300">|</span>
                     <span>Agente: <strong>{getAssignedAgentName(activeConversation?.assignedAgentId || null)}</strong></span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 print:hidden">
                 <button onClick={exportChat} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition" title="Imprimir / Exportar Chat">
                    <Download size={20} />
                 </button>
                 <button onClick={copyTranscript} className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition" title="Copiar Transcripción">
                    {copied ? <ClipboardCheck size={20} className="text-green-600" /> : <Copy size={20} />}
                 </button>
                {activeConversation?.status !== 'CLOSED' && (
                  <button onClick={() => setShowTransferModal(true)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Transferir Chat">
                    <ArrowRightLeft size={20} />
                  </button>
                )}
                <button onClick={() => setShowProfilePanel(!showProfilePanel)} className={`p-2 rounded-lg transition ${showProfilePanel ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:bg-gray-100'}`} title="Ver perfil"><StickyNote size={20} /></button>
                {activeConversation?.status !== 'CLOSED' && (
                   <button onClick={() => setShowCloseModal(true)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition" title="Finalizar"><CheckCircle size={20} /></button>
                )}
              </div>
            </div>

            {activeConversation && !activeConversation.assignedAgentId && activeConversation.status !== 'CLOSED' && (
              <div className="bg-orange-50 p-2 text-center border-b border-orange-100 print:hidden">
                <button onClick={handleAssignToMe} className="bg-orange-600 text-white text-xs px-3 py-1 rounded hover:bg-orange-700 font-bold">Tomar Caso</button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#e5ddd5] print:bg-white print:p-0 print:overflow-visible">
              {messages.map((msg) => {
                const isAgent = msg.senderType === 'agent';
                const isSystem = msg.senderId === 'system';
                const isInternal = msg.isInternal;

                if(isSystem) {
                  return <div key={msg.id} className="flex justify-center print:hidden"><span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-full">{msg.content}</span></div>
                }

                // Renderizado para notas internas
                if (isInternal) {
                  return (
                    <div key={msg.id} className="flex justify-center my-2 w-full print:hidden">
                      <div className="bg-yellow-50 border border-yellow-200 text-gray-700 text-xs px-4 py-2 rounded-lg max-w-[80%] flex flex-col gap-1 shadow-sm">
                        <div className="flex items-center gap-1 font-bold text-yellow-800 uppercase text-[10px]">
                          <Lock size={10} /> Nota Interna
                        </div>
                        <p>{msg.content}</p>
                        <span className="text-[9px] text-right text-yellow-600 mt-1">
                           {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '...'}
                        </span>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={msg.id} className={`flex ${isAgent ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] rounded-lg px-3 py-2 shadow-sm relative text-sm print:shadow-none print:border print:border-gray-200 print:max-w-full print:w-full print:mb-2 ${isAgent ? 'bg-[#d9fdd3] text-gray-900 rounded-tr-none' : 'bg-white text-gray-900 rounded-tl-none'}`}>
                      {msg.content && <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>}
                      
                      {/* Attachments & Location rendering */}
                      {renderAttachments(msg)}

                      <div className="text-[10px] mt-1 text-right text-gray-500 flex justify-end items-center gap-1 opacity-70">
                        {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '...'}
                        {isAgent && <Check size={12} className="text-blue-500" />}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {activeConversation?.status !== 'CLOSED' ? (
              <div className={`p-3 border-t border-gray-200 relative transition-colors print:hidden ${isInternalMode ? 'bg-yellow-50' : 'bg-[#f0f2f5]'}`}>
                {/* Script Popover */}
                {showScripts && (
                  <div className="absolute bottom-full left-4 mb-2 bg-white rounded-lg shadow-xl border border-gray-200 w-64 max-h-60 overflow-y-auto z-20">
                    <div className="p-2 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-lg">
                      <span className="text-xs font-bold text-gray-500 uppercase">Respuestas Rápidas</span>
                      <button onClick={() => setShowScripts(false)}><X size={14} className="text-gray-400" /></button>
                    </div>
                    {quickReplies.map(reply => (
                      <button 
                        key={reply.id} 
                        onClick={() => { setInputText(reply.text); setShowScripts(false); }}
                        className="w-full text-left p-2 hover:bg-green-50 text-sm border-b border-gray-50 last:border-0"
                      >
                        <span className="font-bold text-green-700 text-xs mr-2">{reply.shortcut}</span>
                        <span className="text-gray-600 truncate">{reply.text.substring(0, 30)}...</span>
                      </button>
                    ))}
                    {quickReplies.length === 0 && <div className="p-3 text-xs text-gray-400 text-center">No hay scripts configurados.</div>}
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  {generatingAI && <div className="flex items-center gap-2 text-xs text-purple-600 bg-purple-50 px-3 py-1 rounded-full w-fit mx-auto animate-pulse"><Sparkles size={12} />{aiStatusText}</div>}
                  
                  {isRecording ? (
                    <div className="flex gap-2 items-center bg-white p-3 rounded-xl shadow-sm border border-red-200 animate-pulse">
                      <div className="flex-1 flex items-center gap-3">
                        <div className="w-3 h-3 bg-red-600 rounded-full animate-ping"></div>
                        <span className="text-red-600 font-bold text-sm">Grabando... {formatTime(recordingTime)}</span>
                      </div>
                      <button onClick={() => stopRecording(false)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full"><X size={20} /></button>
                      <button onClick={() => stopRecording(true)} className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600"><Send size={18} /></button>
                    </div>
                  ) : (
                    <div className={`flex gap-2 items-center p-2 rounded-xl shadow-sm border ${isInternalMode ? 'bg-yellow-100 border-yellow-300' : 'bg-white border-gray-200'}`}>
                      {/* Whisper Mode Toggle */}
                      <button 
                        onClick={() => setIsInternalMode(!isInternalMode)}
                        className={`p-2 rounded-lg transition ${isInternalMode ? 'bg-yellow-500 text-white shadow-sm' : 'text-gray-400 hover:text-yellow-600 hover:bg-yellow-50'}`}
                        title={isInternalMode ? "Modo Nota Interna (Activo)" : "Activar Nota Interna"}
                      >
                        {isInternalMode ? <Lock size={20} /> : <Unlock size={20} />}
                      </button>

                      <button onClick={() => setShowScripts(!showScripts)} className={`p-2 rounded-lg transition ${showScripts ? 'bg-yellow-100 text-yellow-600' : 'text-gray-400 hover:text-yellow-500 hover:bg-yellow-50'}`} title="Respuestas Rápidas">
                        <Zap size={20} />
                      </button>
                      
                      {/* Attachment Button */}
                      <input 
                        type="file" 
                        ref={fileInputRef}
                        className="hidden" 
                        onChange={handleFileUpload} 
                        accept="image/*,application/pdf"
                      />
                      <button 
                        onClick={() => fileInputRef.current?.click()} 
                        disabled={isUploading || isInternalMode}
                        className={`p-2 rounded-lg transition ${isUploading ? 'bg-gray-100 text-gray-400 cursor-wait' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}
                        title="Adjuntar Archivo"
                      >
                        {isUploading ? <Loader2 size={20} className="animate-spin" /> : <Paperclip size={20} />}
                      </button>

                      <button onClick={handleSmartReply} disabled={generatingAI} className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition" title="IA Smart Reply"><BookOpen size={20} /></button>
                      
                      <textarea 
                        value={inputText} 
                        onChange={(e) => setInputText(e.target.value)} 
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }}} 
                        placeholder={isInternalMode ? "Escribe una nota interna (invisible para el ciudadano)..." : "Escribe un mensaje..."} 
                        className={`flex-1 border-none focus:ring-0 text-sm px-2 resize-none max-h-24 bg-transparent ${isInternalMode ? 'text-yellow-900 placeholder-yellow-700' : 'text-gray-700'}`} 
                        rows={1} 
                        disabled={sending} 
                      />
                      
                      {inputText.trim() || isInternalMode ? (
                         <button onClick={() => handleSendMessage()} disabled={sending} className={`${isInternalMode ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-[#00a884] hover:bg-[#008f6f]'} text-white p-2 rounded-full transition flex items-center justify-center w-10 h-10 shadow-sm`}><Send size={18} className="ml-0.5" /></button>
                      ) : (
                         <button onClick={startRecording} className="text-gray-500 p-2 rounded-full hover:bg-gray-100 transition"><Mic size={20} /></button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-4 bg-gray-100 border-t border-gray-200 text-center"><p className="text-sm text-gray-500 font-medium flex items-center justify-center gap-2"><XCircle size={16} /> Ticket Cerrado</p></div>
            )}
            
            {/* Modal Transferencia */}
            {showTransferModal && (
              <div className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
                  <h3 className="font-bold text-lg mb-4 text-gray-800">Transferir Chat</h3>
                  <p className="text-sm text-gray-600 mb-4">Selecciona el agente al que deseas derivar esta conversación:</p>
                  <div className="max-h-60 overflow-y-auto space-y-2 mb-4">
                    {Object.values(agentsMap).filter((a: Agent) => a.id !== agentProfile?.id && a.role !== 'ADMIN').map((agent: Agent) => (
                      <button
                        key={agent.id}
                        onClick={() => handleTransfer(agent.id)}
                        className="w-full flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-200 transition"
                      >
                         <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">{agent.displayName.charAt(0)}</div>
                           <div className="text-left">
                             <p className="text-sm font-bold text-gray-800">{agent.displayName}</p>
                             <p className="text-xs text-gray-500">{agent.online ? 'En Línea' : 'Desconectado'}</p>
                           </div>
                         </div>
                         {agent.online && <div className="w-2 h-2 rounded-full bg-green-500"></div>}
                      </button>
                    ))}
                    {Object.values(agentsMap).filter((a: Agent) => a.id !== agentProfile?.id).length === 0 && (
                      <p className="text-sm text-gray-400 text-center">No hay otros agentes disponibles.</p>
                    )}
                  </div>
                  <button onClick={() => setShowTransferModal(false)} className="w-full py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-medium">Cancelar</button>
                </div>
              </div>
            )}

            {/* Modal Cierre (Disposition) */}
            {showCloseModal && (
              <div className="absolute inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
                   <div className="flex items-center gap-2 mb-4 text-gray-800">
                      <FileCheck size={24} className="text-green-600" />
                      <h3 className="font-bold text-lg">Finalizar Atención</h3>
                   </div>
                   <p className="text-xs text-gray-500 mb-4">Selecciona el motivo de cierre para las estadísticas:</p>
                   
                   <div className="space-y-3 mb-4">
                      {['RESUELTO', 'INFORMACION', 'DERIVADO_EXTERNO', 'NO_RESPONDE', 'BROMA_SPAM'].map(disp => (
                         <label key={disp} className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition ${closingDisposition === disp ? 'bg-green-50 border-green-500 ring-1 ring-green-500' : 'hover:bg-gray-50 border-gray-200'}`}>
                            <input 
                              type="radio" 
                              name="disposition" 
                              value={disp} 
                              checked={closingDisposition === disp} 
                              onChange={(e) => setClosingDisposition(e.target.value)}
                              className="text-green-600 focus:ring-green-500"
                            />
                            <span className="text-sm font-medium text-gray-700">{disp.replace('_', ' ')}</span>
                         </label>
                      ))}
                   </div>
                   
                   <textarea 
                     className="w-full text-sm border border-gray-300 rounded-lg p-3 h-20 bg-gray-50 focus:bg-white resize-none mb-4" 
                     placeholder="Nota final de cierre (opcional)..." 
                     value={closingNote} 
                     onChange={e => setClosingNote(e.target.value)}
                   ></textarea>
                   
                   <div className="flex gap-2">
                     <button onClick={() => setShowCloseModal(false)} className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-medium text-sm">Cancelar</button>
                     <button 
                       onClick={handleConfirmClose} 
                       disabled={!closingDisposition}
                       className="flex-1 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-white font-medium text-sm disabled:opacity-50"
                     >
                       Confirmar Cierre
                     </button>
                   </div>
                </div>
              </div>
            )}

            {/* Modal Historial */}
            {historyModalOpen && (
               <div className="absolute inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                 <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full h-[80vh] flex flex-col overflow-hidden">
                   <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                     <div className="flex items-center gap-3">
                       <History size={20} className="text-blue-600" />
                       <div>
                         <h3 className="font-bold text-gray-800">Historial de Chat</h3>
                         <p className="text-xs text-gray-500">Modo lectura</p>
                       </div>
                     </div>
                     <button onClick={() => setHistoryModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-full text-gray-500">
                       <X size={20} />
                     </button>
                   </div>
                   
                   <div className="flex-1 overflow-y-auto p-6 bg-[#e5ddd5] space-y-3">
                      {historyLoading ? (
                        <div className="flex justify-center py-10"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>
                      ) : historyMessages.length === 0 ? (
                        <p className="text-center text-gray-500 py-10">No se encontraron mensajes en este historial.</p>
                      ) : (
                        historyMessages.map((msg) => {
                          const isAgent = msg.senderType === 'agent';
                          const isSystem = msg.senderId === 'system';
                          if (isSystem) return <div key={msg.id} className="flex justify-center"><span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-full">{msg.content}</span></div>;
                          return (
                            <div key={msg.id} className={`flex ${isAgent ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm shadow-sm ${isAgent ? 'bg-[#d9fdd3] text-gray-900' : 'bg-white text-gray-900'}`}>
                                {msg.content && <p className="whitespace-pre-wrap">{msg.content}</p>}
                                {renderAttachments(msg)}
                                <div className="text-[10px] text-right text-gray-500 mt-1">
                                  {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleString() : ''}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                   </div>
                   
                   <div className="p-3 bg-gray-50 border-t border-gray-200 text-right">
                      <button onClick={() => setHistoryModalOpen(false)} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm font-medium">Cerrar</button>
                   </div>
                 </div>
               </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-gray-50 border-t-4 border-green-600 relative overflow-hidden print:hidden">
             <div className="absolute inset-0 opacity-5 bg-[radial-gradient(#00a884_1px,transparent_1px)] [background-size:16px_16px]"></div>
             <div className="z-10 flex flex-col items-center">
                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-6 shadow-sm border border-gray-100"><img src="https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/WhatsApp.svg/1200px-WhatsApp.svg.png" alt="Logo" className="w-10 h-10 opacity-80"/></div>
                <h3 className="text-lg font-bold text-gray-700">DSAC Smart Center</h3>
                <p className="text-sm mt-2 text-gray-500">Selecciona una conversación</p>
             </div>
          </div>
        )}
      </div>

      {/* COLUMN 3: PROFILE (Oculto al imprimir) */}
      {showProfilePanel && activeConversationId && activeCitizen && (
        <div className="w-72 bg-white border-l border-gray-200 flex flex-col overflow-y-auto shadow-xl z-20 print:hidden">
          <div className="p-5 border-b border-gray-100 bg-gray-50">
             <h3 className="font-bold text-gray-700 text-sm mb-4">Información del Ciudadano</h3>
             <div className="flex flex-col items-center">
                <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xl font-bold mb-3 shadow-sm border border-white">{activeCitizen.name.charAt(0).toUpperCase()}</div>
                <h2 className="font-bold text-gray-800 text-center leading-tight">{activeCitizen.name}</h2>
                <p className="text-sm text-gray-500 mt-1">{activeCitizen.phoneNumber}</p>
             </div>
          </div>
          
          <div className="flex border-b border-gray-100">
            <button 
              className={`flex-1 py-3 text-[10px] font-bold transition ${profileTab === 'INFO' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-400'}`}
              onClick={() => setProfileTab('INFO')}
            >
              DATOS
            </button>
            <button 
              className={`flex-1 py-3 text-[10px] font-bold transition ${profileTab === 'KB' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-400'}`}
              onClick={() => setProfileTab('KB')}
            >
              RECURSOS
            </button>
            <button 
              className={`flex-1 py-3 text-[10px] font-bold transition ${profileTab === 'HISTORY' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-400'}`}
              onClick={() => setProfileTab('HISTORY')}
            >
              HISTORIAL
            </button>
          </div>

          {profileTab === 'INFO' && (
            <div className="p-5 space-y-6">
               <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase"><StickyNote size={14} /> Notas Internas</label>
                    <button 
                      onClick={handleAutoAnalyzeCase}
                      disabled={analyzingCase || messages.length === 0}
                      className={`text-[10px] px-2 py-1 rounded-full flex items-center gap-1 transition shadow-sm ${analyzingCase ? 'bg-purple-100 text-purple-700' : 'bg-purple-50 text-purple-600 hover:bg-purple-100'}`}
                      title="Analizar caso con IA y extraer resumen/tags"
                    >
                      {analyzingCase ? <Sparkles size={10} className="animate-spin" /> : <BrainCircuit size={12} />}
                      {analyzingCase ? 'Analizando...' : 'Autocompletar'}
                    </button>
                  </div>
                  <textarea className="w-full text-sm border border-gray-200 rounded-lg p-3 h-24 bg-yellow-50 focus:ring-1 focus:ring-yellow-400 resize-none" placeholder="Escribe notas..." value={editingNotes} onChange={e => setEditingNotes(e.target.value)}></textarea>
               </div>
               <div>
                  <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase mb-2"><Tag size={14} /> Etiquetas (Tags)</label>
                  <input type="text" className="w-full text-sm border border-gray-200 rounded-lg p-2.5 bg-gray-50" placeholder="ej. VIP, Reclamo" value={editingTags} onChange={e => setEditingTags(e.target.value)} />
                  <div className="flex flex-wrap gap-1 mt-3">{editingTags.split(',').filter(t => t.trim()).map((tag, idx) => (<span key={idx} className="bg-blue-100 text-blue-700 text-[10px] px-2 py-1 rounded-full font-medium">{tag.trim()}</span>))}</div>
               </div>
               <button onClick={saveProfileChanges} className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition flex justify-center items-center gap-2 shadow-sm"><Save size={16} /> Guardar Cambios</button>
            </div>
          )}

          {profileTab === 'KB' && (
            <div className="flex flex-col h-full overflow-hidden">
               <div className="p-4 bg-gray-50 border-b border-gray-200">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 text-gray-400" size={14} />
                    <input 
                      type="text" 
                      placeholder="Buscar en la base..." 
                      className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500" 
                      value={kbSearchTerm}
                      onChange={e => setKbSearchTerm(e.target.value)}
                    />
                    {searchingKb && <div className="absolute right-3 top-2.5"><Loader2 size={14} className="text-blue-500 animate-spin" /></div>}
                  </div>
               </div>
               <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white">
                 {kbResults.length === 0 ? (
                   <div className="text-center text-gray-400 py-6">
                     <BookOpen size={32} className="mx-auto mb-2 opacity-20" />
                     <p className="text-xs">Escribe para buscar artículos de ayuda.</p>
                   </div>
                 ) : (
                   kbResults.map(article => (
                     <div key={article.id} className="border border-gray-100 rounded-lg p-3 hover:bg-gray-50 transition shadow-sm">
                       <h4 className="text-xs font-bold text-gray-800 mb-1">{article.title}</h4>
                       <p className="text-[10px] text-gray-600 line-clamp-3 mb-2">{article.content}</p>
                       <button 
                         onClick={() => setInputText(article.content)}
                         className="w-full flex items-center justify-center gap-1 bg-green-50 text-green-700 text-[10px] py-1.5 rounded hover:bg-green-100 font-medium"
                       >
                         <ArrowDownLeft size={10} /> Insertar en Chat
                       </button>
                     </div>
                   ))
                 )}
               </div>
            </div>
          )}

          {profileTab === 'HISTORY' && (
            <div className="p-5 space-y-4">
              {citizenHistory.length === 0 ? (
                <p className="text-center text-gray-400 text-xs py-4">No hay atenciones previas.</p>
              ) : (
                citizenHistory.map(hist => (
                  <div key={hist.id} className="p-3 bg-gray-50 rounded-lg border border-gray-100 group hover:border-blue-200 transition">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-[10px] font-bold text-gray-600">
                        {hist.createdAt?.toDate ? hist.createdAt.toDate().toLocaleDateString() : 'N/A'}
                      </span>
                      <button onClick={() => handleViewHistory(hist.id)} className="text-[10px] bg-blue-50 text-blue-600 hover:bg-blue-100 px-2 py-1 rounded flex items-center gap-1">
                        <Eye size={10} /> VER
                      </button>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                       <p className="text-xs text-gray-500">
                         Atendido por: <span className="font-medium">{getAssignedAgentName(hist.assignedAgentId)}</span>
                       </p>
                       {hist.disposition && (
                         <span className="text-[9px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded uppercase font-bold">{hist.disposition}</span>
                       )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Simple loader helper for KB search
const Loader2 = ({size, className}: {size: number, className?: string}) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>
);

export default ChatConsole;