import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { Message } from "../types";

// Función segura para obtener la API Key en entorno Vite/Browser
const getApiKey = () => {
  const meta = import.meta as any;
  // 1. Intentar variable de entorno de Vite (Estándar)
  if (meta.env && meta.env.VITE_GEMINI_API_KEY) {
    return meta.env.VITE_GEMINI_API_KEY;
  }
  // 2. Intentar process.env (Polyfill o Node)
  if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
    return process.env.API_KEY;
  }
  return "";
};

const ai = new GoogleGenAI({ apiKey: getApiKey() });

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

  // 1. Filtrar historial (últimos 8 mensajes) para eficiencia de tokens
  const relevantHistory = conversationHistory.slice(-8);
  
  const historyParts = relevantHistory.map(m => ({
    role: m.senderType === 'agent' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  const systemInstruction = `
    Eres un asistente oficial de la Dirección de Atención al Ciudadano (DSAC) de Santa Cruz de la Sierra.
    Objetivo: Sugerir una respuesta útil, breve y empática para que el operador la envíe al ciudadano.
    Idioma: Español (Bolivia).
    Reglas:
    - Usa SOLO la información provista en el CONTEXTO.
    - Si no sabes la respuesta, sugiere pedir más datos o derivar al área correspondiente.
    - Sé profesional y amable.

    CONTEXTO (Base de Conocimiento):
    ${knowledgeBaseContext || "No hay información adicional."}
    
    ${customSystemPrompt ? `Instrucción del sistema: ${customSystemPrompt}` : ''}
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
        maxOutputTokens: 200,
      }
    });

    return response.text?.trim() || "";
  } catch (error) {
    console.error("Gemini Smart Reply Error:", error);
    return ""; 
  }
};

/**
 * Analiza el caso completo para generar resumen y etiquetas (Structured Output)
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
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [{
          text: `Analiza esta conversación:\n\n${conversationText}`
        }]
      },
      config: {
        systemInstruction: `
          Eres un analista de calidad. Resume el caso en máximo 2 oraciones y asigna etiquetas.
          Etiquetas permitidas: TRAMITE, IMPUESTOS, SALUD, EMERGENCIA, QUEJA, INFORMACION, OTRO.
        `,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { 
              type: Type.STRING, 
              description: "Resumen ejecutivo del problema y solución." 
            },
            tags: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "Categorías del caso."
            }
          },
          required: ["summary", "tags"]
        },
        temperature: 0.1,
      }
    });

    if (response.text) {
      return JSON.parse(response.text);
    }
    return { summary: "No se pudo generar análisis.", tags: [] };
    
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return { summary: "Error de IA.", tags: [] };
  }
};

/**
 * Clasificador rápido de intención (Single token/word)
 */
export const analyzeIntent = async (text: string): Promise<string> => {
  if (!text) return "OTRO";
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
         parts: [{
             text: `Clasifica este mensaje: "${text}". Categorías: TRAMITE, EMERGENCIA, IMPUESTOS, SALUD, QUEJA, SALUDO, OTRO. Solo responde con la categoría.`
         }]
      },
      config: {
        temperature: 0,
        maxOutputTokens: 10,
      }
    });
    return response.text?.trim().toUpperCase() || "OTRO";
  } catch (e) {
    return "OTRO";
  }
};