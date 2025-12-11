import { Timestamp } from 'firebase/firestore';

export interface Citizen {
  id: string;
  name: string;
  phoneNumber: string;
  channel: 'whatsapp' | 'web';
  notes?: string;
  tags?: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Conversation {
  id: string;
  citizenId: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'CLOSED';
  sourceChannel: 'whatsapp' | 'web';
  assignedAgentId: string | null;
  lastMessageAt: Timestamp;
  lastDetectedIntent: string | null;
  lastSentiment: 'positive' | 'neutral' | 'negative' | null;
  lastUrgency: 'low' | 'medium' | 'high' | null;
  unreadCount: number;
  disposition?: string; // Motivo de cierre (ej. RESUELTO, ABANDONO)
  closingNotes?: string; // Nota final del agente
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Message {
  id: string;
  conversationId: string;
  senderType: 'citizen' | 'agent' | 'bot';
  senderId: string | null;
  content: string;
  attachments?: string[];
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };
  isInternal?: boolean;
  createdAt: Timestamp;
}

export interface Agent {
  id: string;
  displayName: string;
  email: string;
  role: 'AGENT' | 'SUPERVISOR' | 'ADMIN';
  online: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface KnowledgeArticle {
  id: string;
  title: string;
  category: string;
  content: string;
  tags: string[];
  updatedAt: Timestamp;
}

export interface QuickReply {
  id: string;
  shortcut: string; // ej: "/saludo"
  text: string;
  category: string;
  createdAt: Timestamp;
}

export interface SystemSettings {
  organizationName: string;
  timeZone: string;
  autoReplyEnabled: boolean;
  maintenanceMode: boolean;
  systemPrompt: string;
  whatsappEnabled: boolean;
  whatsappBusinessNumber: string;
  whatsappWebhookUrl: string;
  lastUpdatedAt: Timestamp;
  lastUpdatedBy: string;
}