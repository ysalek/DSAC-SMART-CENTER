import { auth } from '../src/firebase';

const getBaseUrl = () => {
  // Acceso seguro a variables de entorno en Vite
  const meta = import.meta as any;
  if (meta.env && meta.env.VITE_FUNCTIONS_BASE_URL) {
    return meta.env.VITE_FUNCTIONS_BASE_URL;
  }
  // Fallback por defecto
  return "https://us-central1-chat-inteligente-fdeb8.cloudfunctions.net";
};

const FUNCTIONS_BASE_URL = getBaseUrl();

export const sendWhatsAppMessage = async (
  conversationId: string, 
  toPhoneNumber: string, 
  text: string, 
  agentId: string,
  mediaUrl?: string
) => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error("No hay sesión de usuario activa.");
    }

    const idToken = await currentUser.getIdToken();

    const response = await fetch(`${FUNCTIONS_BASE_URL}/sendWhatsAppMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify({
        conversationId,
        to: toPhoneNumber,
        text,
        senderAgentId: agentId,
        mediaUrl
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Error HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error en whatsappService:", error);
    throw error;
  }
};