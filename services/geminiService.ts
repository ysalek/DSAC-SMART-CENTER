import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { Message } from "../types";

// Inicializar cliente Gemini
// En Vite usamos import.meta.env.VITE_... pero respetamos la guía si process.env está configurado por el bundler.
// Por robustez en este entorno mixto, intentamos leer la key disponible.
const meta = import.meta as any;
const apiKey = meta.env?.VITE_GEMINI_API_KEY || process.env.API_KEY || "";
const ai = new GoogleGenAI({ apiKey });

// Modelo optimizado para tareas generales y rapidez
const MODEL_NAME = "gemini-2.5-flash";

/**
 * Genera una sugerencia de respuesta (Smart Reply)
 * Optimizado: Envía historial estructurado y limita tokens.
 */
export const generateSmartReply = async (
  conversationHistory: Message[],
  citizenName: string,
  knowledgeBaseContext: string = "",
  customSystemPrompt: string = ""
): Promise<string> => {
  if (conversationHistory.length === 0) return "";

  // 1. Filtrar y formatear historial (últimos 8 mensajes para ahorrar tokens)
  // Mapeamos 'citizen' -> 'user' y 'agent' -> 'model'
  const relevantHistory = conversationHistory.slice(-8);
  
  const historyParts = relevantHistory.map(m => ({
    role: m.senderType === 'agent' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  const systemInstruction = `
    Eres un asistente oficial de la Dirección de Atención al Ciudadano (DSAC) de Santa Cruz de la Sierra, Bolivia.
    
    TUS OBJETIVOS:
    1. Sugerir una respuesta empática, profesional y directa para el operador.
    2. Usar español neutro latinoamericano.
    3. Basarte EXCLUSIVAMENTE en el contexto proporcionado (Base de Conocimiento).
    4. Si no hay info en el contexto, sugiere pedir más detalles amablemente o derivar.
    
    CONTEXTO (RAG):
    ${knowledgeBaseContext || "No hay información adicional disponible."}
    
    ${customSystemPrompt ? `INSTRUCCIÓN EXTRA: ${customSystemPrompt}` : ''}
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [
        ...historyParts, // Historial previo
        { role: 'user', parts: [{ text: `Genera una respuesta sugerida para ${citizenName} basada en lo anterior.` }] }
      ],
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.3,
        maxOutputTokens: 150, // Respuesta breve
      }
    });

    return response.text?.trim() || "";
  } catch (error) {
    console.error("Gemini API Error (Smart Reply):", error);
    return ""; 
  }
};

/**
 * Analiza el caso completo para generar resumen y etiquetas (Structured Output)
 * Optimizado: Usa responseSchema para garantizar JSON válido.
 */
export const analyzeCaseConversation = async (
  messages: Message[],
  citizenName: string
): Promise<{ summary: string; tags: string[] }> => {
  if (messages.length === 0) return { summary: "", tags: [] };

  // Convertimos la conversación a un formato de texto claro para el análisis
  const conversationText = messages
    .map(m => `${m.senderType === 'agent' ? 'Operador' : 'Ciudadano'}: ${m.content}`)
    .join('\n');

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [{
          text: `Analiza la siguiente conversación de soporte y extrae los datos solicitados:\n\n${conversationText}`
        }]
      },
      config: {
        systemInstruction: `
          Eres un analista de calidad de Call Center. 
          Tu tarea es resumir el caso y asignar etiquetas de categoría.
          Las etiquetas permitidas son: TRAMITE, IMPUESTOS, SALUD, EMERGENCIA, QUEJA, INFORMACION, OTRO.
          El resumen debe ser de máximo 2 oraciones.
        `,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { 
              type: Type.STRING, 
              description: "Resumen ejecutivo del problema y solución (si la hubo)." 
            },
            tags: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "Lista de categorías aplicables al caso."
            }
          },
          required: ["summary", "tags"]
        },
        temperature: 0.1, // Baja temperatura para análisis factual
      }
    });

    // Al usar responseMimeType json, response.text es un string JSON válido.
    if (response.text) {
      return JSON.parse(response.text);
    }
    return { summary: "No se pudo generar el análisis.", tags: [] };
    
  } catch (error) {
    console.error("Gemini API Error (Analysis):", error);
    return { summary: "Error al conectar con IA.", tags: [] };
  }
};

/**
 * Clasificador rápido de intención
 */
export const analyzeIntent = async (text: string): Promise<string> => {
  if (!text) return "OTRO";
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash", // Usar modelo rápido
      contents: {
         parts: [{
             text: `Clasifica este mensaje de un ciudadano en UNA sola palabra: TRAMITE, EMERGENCIA, IMPUESTOS, SALUD, QUEJA, SALUDO, OTRO. Mensaje: "${text}"`
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