import { GoogleGenAI, Type } from "@google/genai";
import { Message } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const MODEL_NAME = "gemini-2.5-flash";

/**
 * Genera una sugerencia de respuesta (Smart Reply)
 */
export const generateSmartReply = async (
  conversationHistory: Message[],
  citizenName: string,
  knowledgeBaseContext: string = "",
  customSystemPrompt: string = ""
): Promise<string> => {
  if (conversationHistory.length === 0) return "";

  // Construir historial estructurado para la SDK
  // Nota: Mapeamos 'citizen' a 'user' y 'agent' a 'model' para contexto
  const historyParts = conversationHistory.slice(-8).map(m => {
    return {
      role: m.senderType === 'agent' ? 'model' : 'user',
      parts: [{ text: m.content }]
    };
  });

  const systemInstruction = `
    Actúa como un asistente oficial de la Dirección de Atención al Ciudadano (DSAC) de Santa Cruz.
    
    INSTRUCCIONES:
    1. Responde en español neutro (Latam), profesional y empático.
    2. Usa la BASE DE CONOCIMIENTO (RAG) proporcionada como única fuente de verdad para trámites.
    3. Si no sabes la respuesta, sugiere esperar a un humano.
    4. Sé breve (máx 60 palabras).
    
    ${customSystemPrompt ? `INSTRUCCIÓN PERSONALIZADA: ${customSystemPrompt}` : ''}
    
    BASE DE CONOCIMIENTO:
    ${knowledgeBaseContext || "No disponible."}
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [
        ...historyParts,
        { role: 'user', parts: [{ text: `Genera una respuesta sugerida para ${citizenName}.` }] }
      ],
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.3,
        maxOutputTokens: 150,
      }
    });
    return response.text?.trim() || "";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return ""; 
  }
};

/**
 * Clasificador de Intención
 */
export const analyzeIntent = async (text: string): Promise<string> => {
  if (!text) return "OTRO";
  
  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
         parts: [{
             text: `Analiza el mensaje y clasifícalo en UNA categoría: TRAMITE, EMERGENCIA, IMPUESTOS, SALUD, QUEJA, SALUDO, OTRO. Mensaje: "${text}"`
         }]
      },
      config: {
        temperature: 0,
        maxOutputTokens: 20,
      }
    });
    return response.text?.trim().toUpperCase() || "OTRO";
  } catch (e) {
    return "OTRO";
  }
};

/**
 * Analiza el caso completo para generar resumen y etiquetas (JSON Mode)
 */
export const analyzeCaseConversation = async (
  messages: Message[],
  citizenName: string
): Promise<{ summary: string; tags: string[] }> => {
  if (messages.length === 0) return { summary: "", tags: [] };

  const conversationText = messages
    .map(m => `${m.senderType === 'agent' ? 'Operador' : 'Ciudadano'}: ${m.content}`)
    .join('\n');

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [{
          text: `Analiza esta conversación con ${citizenName}:\n\n${conversationText}`
        }]
      },
      config: {
        systemInstruction: "Eres un analista de calidad. Genera un resumen breve y etiquetas clave.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING, description: "Resumen de 2 frases del caso." },
            tags: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "Lista de 1 a 4 etiquetas (ej. IMPUESTOS, SALUD)."
            }
          },
          required: ["summary", "tags"]
        },
        temperature: 0.1,
      }
    });

    const jsonText = response.text || "{}";
    return JSON.parse(jsonText);
    
  } catch (error) {
    console.error("Error analyzing case:", error);
    return { summary: "Error al analizar.", tags: [] };
  }
};