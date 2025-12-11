import { GoogleGenAI } from "@google/genai";
import { Message } from "../types";

// Inicialización del cliente.
// NOTA: 'process.env.API_KEY' es inyectado por el entorno de Google AI Studio.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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

  // Modelo Flash para baja latencia
  const model = "gemini-2.5-flash";

  // Formato de historial para el prompt (Últimos 8 mensajes para contexto inmediato)
  const historyText = conversationHistory
    .slice(-8)
    .map(m => `[${m.senderType === 'agent' ? 'Operador' : 'Ciudadano'}]: ${m.content}`)
    .join('\n');

  // Instrucción del sistema robusta
  const defaultInstruction = `
    Actúa como un asistente oficial de la Dirección de Atención al Ciudadano (DSAC) de Santa Cruz.
    Tu tono debe ser profesional, empático, claro y en español neutro (Latam).
    Nunca inventes trámites, fechas ni requisitos que no estén en la BASE DE CONOCIMIENTO.
    Si no sabes la respuesta, sugiere amablemente que el ciudadano espere a un agente humano.
  `;

  const systemInstruction = `
    ${customSystemPrompt || defaultInstruction}
    
    INSTRUCCIONES CLAVE:
    1. Usa la "BASE DE CONOCIMIENTO" adjunta como verdad absoluta.
    2. Sé breve (máximo 50-60 palabras) para facilitar la lectura en WhatsApp.
    3. No saludes repetitivamente si el historial muestra que ya están hablando.
  `;

  const prompt = `
    DATOS DEL CIUDADANO: ${citizenName}
    
    === BASE DE CONOCIMIENTO (RAG) ===
    ${knowledgeBaseContext || "Sin información adicional disponible."}
    ==================================

    === HISTORIAL DE CONVERSACIÓN ===
    ${historyText}
    =================================

    Genera la siguiente respuesta sugerida para el Operador:
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.3, // Baja temperatura para respuestas más factuales y menos creativas
        maxOutputTokens: 150,
      }
    });
    return response.text?.trim() || "";
  } catch (error) {
    console.error("Gemini API Error:", error);
    // Fallback silencioso para no romper la UI
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
      model: "gemini-2.5-flash",
      contents: `Analiza el mensaje de este ciudadano y clasifícalo en UNA sola categoría: 
      TRAMITE, EMERGENCIA, IMPUESTOS, SALUD, QUEJA, SALUDO, OTRO.
      
      Mensaje: "${text}"
      
      Respuesta (solo la palabra):`,
      config: {
        temperature: 0,
      }
    });
    return response.text?.trim().toUpperCase() || "OTRO";
  } catch (e) {
    return "OTRO";
  }
};

/**
 * Analiza el caso completo para generar resumen y etiquetas
 */
export const analyzeCaseConversation = async (
  messages: Message[],
  citizenName: string
): Promise<{ summary: string; tags: string[] }> => {
  if (messages.length === 0) return { summary: "", tags: [] };

  const historyText = messages
    .map(m => `[${m.senderType === 'agent' ? 'Operador' : 'Ciudadano'}]: ${m.content}`)
    .join('\n');

  const prompt = `
    Analiza la siguiente conversación de atención al ciudadano y extrae información estructurada.
    
    CIUDADANO: ${citizenName}
    
    === CONVERSACIÓN ===
    ${historyText}
    ====================

    TAREA:
    1. Resumen: Escribe un resumen conciso (máx 2 frases) sobre qué trató el caso y cómo terminó (o si quedó pendiente).
    2. Etiquetas: Identifica de 1 a 4 etiquetas clave (palabras cortas, mayúsculas) que clasifiquen el problema (ej. IMPUESTOS, CONSULTA, RECLAMO, SALUD, BASURA).

    Responde ÚNICAMENTE con un objeto JSON válido con este formato:
    {
      "summary": "texto del resumen...",
      "tags": ["TAG1", "TAG2"]
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.1, // Muy determinista
      }
    });

    const text = response.text || "{}";
    const result = JSON.parse(text);
    
    return {
      summary: result.summary || "",
      tags: result.tags || []
    };
  } catch (error) {
    console.error("Error analyzing case:", error);
    return { summary: "Error al analizar con IA.", tags: [] };
  }
};