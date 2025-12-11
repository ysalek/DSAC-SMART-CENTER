import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../src/firebase";

/**
 * Sube un archivo a Firebase Storage y retorna su URL pública.
 * Estructura: conversations/{conversationId}/{timestamp}_{filename}
 */
export const uploadAttachment = async (file: File, conversationId: string): Promise<string> => {
  try {
    // Sanitizar nombre de archivo
    const safeName = file.name.replace(/[^a-zA-Z0-9.]/g, "_");
    const path = `conversations/${conversationId}/${Date.now()}_${safeName}`;
    const storageRef = ref(storage, path);

    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    return downloadURL;
  } catch (error) {
    console.error("Error uploading file:", error);
    throw new Error("No se pudo subir el archivo.");
  }
};