import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import axios from "axios";

admin.initializeApp();
const db = admin.firestore();

// Configuración obligatoria mediante variables de entorno
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || "dsac_santa_cruz_token";
const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_ID;

if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
  console.warn("ADVERTENCIA: Tokens de WhatsApp no configurados en variables de entorno.");
}

/**
 * Webhook para recibir eventos de WhatsApp Cloud API
 */
export const whatsappWebhook = functions.https.onRequest(async (req, res) => {
  // 1. Verificación del Webhook (GET)
  if (req.method === "GET") {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      functions.logger.info("Webhook verificado correctamente.");
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
    return;
  }

  // 2. Procesamiento de Mensajes (POST)
  if (req.method === "POST") {
    try {
      const body = req.body;
      
      if (
        body.object &&
        body.entry &&
        body.entry[0].changes &&
        body.entry[0].changes[0].value.messages &&
        body.entry[0].changes[0].value.messages[0]
      ) {
        const value = body.entry[0].changes[0].value;
        const messageData = value.messages[0];
        const msgType = messageData.type;
        
        const from = messageData.from;
        const profileName = value.contacts?.[0]?.profile?.name || "Ciudadano";
        
        let textBody = "";
        let locationData = null;
        
        if (msgType === "text") {
            textBody = messageData.text?.body || "";
        } else if (msgType === "image") {
            textBody = messageData.image?.caption || "[ 📷 Imagen Recibida ]";
        } else if (msgType === "audio") {
            textBody = "[ 🎤 Audio Recibido ]";
        } else if (msgType === "document") {
            textBody = messageData.document?.caption || `[ 📄 Documento: ${messageData.document?.filename || 'Archivo'} ]`;
        } else if (msgType === "location") {
             textBody = `📍 Ubicación compartida`;
             const loc = messageData.location;
             locationData = {
                latitude: loc.latitude,
                longitude: loc.longitude,
                name: loc.name || "",
                address: loc.address || ""
             };
        } else {
            textBody = `[ Mensaje tipo: ${msgType} ]`;
        }

        // A. Buscar o crear Ciudadano
        const citizenRef = db.collection("citizens").doc(from);
        const citizenSnap = await citizenRef.get();

        if (!citizenSnap.exists) {
          await citizenRef.set({
            name: profileName,
            phoneNumber: from,
            channel: "whatsapp",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        } else {
          await citizenRef.update({ updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        }

        // B. Buscar Conversación Activa
        const conversationsRef = db.collection("conversations");
        const activeConvoQuery = await conversationsRef
          .where("citizenId", "==", from)
          .where("status", "in", ["OPEN", "IN_PROGRESS"])
          .limit(1)
          .get();

        let conversationId;
        let isNewConversation = false;

        if (activeConvoQuery.empty) {
          // Crear nueva
          const newConvo = await conversationsRef.add({
            citizenId: from,
            status: "OPEN",
            sourceChannel: "whatsapp",
            assignedAgentId: null,
            lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
            unreadCount: 1,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          conversationId = newConvo.id;
          isNewConversation = true;
        } else {
          // Actualizar existente
          const doc = activeConvoQuery.docs[0];
          conversationId = doc.id;
          await doc.ref.update({
            lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
            unreadCount: admin.firestore.FieldValue.increment(1),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }

        // C. Guardar Mensaje
        const messagePayload: any = {
          conversationId: conversationId,
          senderType: "citizen",
          senderId: from,
          content: textBody,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        if (locationData) {
            messagePayload.location = locationData;
        }

        await db.collection("messages").add(messagePayload);

        // D. Auto-Respuesta (Si está habilitada y es conversación nueva)
        if (isNewConversation) {
          const settingsDoc = await db.collection("systemSettings").doc("default").get();
          const settings = settingsDoc.data();
          
          if (settings?.autoReplyEnabled) {
            const welcomeText = "👋 ¡Hola! Bienvenido a la DSAC. Un agente atenderá tu consulta en breve.";
            
            await db.collection("messages").add({
              conversationId: conversationId,
              senderType: "bot",
              senderId: "system_auto_reply",
              content: welcomeText,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            if (WHATSAPP_TOKEN && PHONE_NUMBER_ID) {
              try {
                 await axios.post(
                  `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
                  {
                    messaging_product: "whatsapp",
                    recipient_type: "individual",
                    to: from,
                    type: "text",
                    text: { body: welcomeText },
                  },
                  {
                    headers: {
                      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
                      "Content-Type": "application/json",
                    },
                  }
                );
              } catch (e: any) {
                 functions.logger.error("Error enviando auto-reply:", e.response?.data || e.message);
              }
            }
          }
        }
      }
      res.sendStatus(200);
    } catch (error) {
      functions.logger.error("Error crítico en webhook:", error);
      res.sendStatus(500);
    }
  }
});

/**
 * Función para enviar mensaje desde el Operador hacia WhatsApp.
 */
export const sendWhatsAppMessage = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).send({ error: "No autorizado. Token faltante." });
    return;
  }

  const idToken = authHeader.split('Bearer ')[1];
  try {
    await admin.auth().verifyIdToken(idToken);
  } catch (error) {
    res.status(403).send({ error: "Token inválido o expirado." });
    return;
  }

  const { to, text, senderAgentId, mediaUrl } = req.body;

  if (!to || (!text && !mediaUrl)) {
    res.status(400).send({ error: "Faltan parámetros requeridos." });
    return;
  }

  if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
    res.status(503).send({ error: "WhatsApp no configurado en el servidor." });
    return;
  }

  try {
    let payload: any = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: to,
    };

    if (mediaUrl) {
      const url = mediaUrl.toLowerCase();
      if (url.includes(".pdf") || url.includes(".doc")) {
         payload.type = "document";
         payload.document = { link: mediaUrl, caption: text || "Documento" };
      } else if (url.includes(".mp3") || url.includes(".ogg") || url.includes(".wav")) {
         payload.type = "audio";
         payload.audio = { link: mediaUrl };
      } else {
         payload.type = "image";
         payload.image = { link: mediaUrl, caption: text || "" };
      }
    } else {
      payload.type = "text";
      payload.text = { body: text };
    }

    await axios.post(
      `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    res.status(200).send({ success: true, agent: senderAgentId });
  } catch (error: any) {
    functions.logger.error("Error WhatsApp API:", error.response?.data || error.message);
    res.status(500).send({ error: "Error externo en WhatsApp API" });
  }
});