import { auth } from '../src/firebase';

// URL base de la función Cloud Function
const getBaseUrl = () => {
  const meta = import.meta as any;
  // Fallback seguro a localhost si no está definida la variable
  return (meta.env && meta.env.VITE_FUNCTIONS_BASE_URL) || "https://us-central1-chat-inteligente-fdeb8.cloudfunctions.net";
};

const FUNCTIONS_BASE_URL = getBaseUrl();

export const sendWhatsAppMessage = async (
  conversationId: string, 
  toPhoneNumber: string, 
  text: string, 
  agentId: string,
  mediaUrl?: string // Nuevo parámetro opcional
) => {
  try {
    // Obtener el token de seguridad del usuario actual
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error("No hay sesión de usuario activa para autorizar el envío.");
    }

    // Forzar refresco del token si es necesario para asegurar validez
    const idToken = await currentUser.getIdToken();

    const response = await fetch(`${FUNCTIONS_BASE_URL}/sendWhatsAppMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}` // Autenticación crítica
      },
      body: JSON.stringify({
        conversationId,
        to: toPhoneNumber,
        text,
        senderAgentId: agentId,
        mediaUrl // Se envía al backend
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Error HTTP ${response.status} enviando mensaje`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error en whatsappService:", error);
    throw error;
  }
};