// runwayService.js
// Encapsule tous les appels a l'API Runway pour TikShorte.
// Pipeline : texte -> image de depart (Gemini) -> video animee (imageToVideo)

const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const RunwayML = (require('@runwayml/sdk').default || require('@runwayml/sdk'));

const client = new RunwayML({
  apiKey: process.env.RUNWAYML_API_SECRET, // jamais en dur, toujours en variable d'env
});

const POLL_INTERVAL_MS = 4000; // 4s entre chaque verification du statut de la tache
const MAX_POLL_ATTEMPTS = 90; // ~6 minutes max avant timeout

/**
 * Attend qu'une tache Runway passe a SUCCEEDED ou FAILED en la interrogeant regulierement.
 * @param {string} taskId
 */
async function waitForTask(taskId) {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    const task = await client.tasks.retrieve(taskId);

    if (task.status === 'SUCCEEDED') {
      return task;
    }
    if (task.status === 'FAILED') {
      throw new Error('La tache Runway a echoue: ' + (task.failure || 'raison inconnue'));
    }

    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  throw new Error('Timeout: la tache Runway a pris trop de temps');
}

/**
 * Etape 1 : genere une image de depart a partir d'un texte, via Gemini.
 * @param {string} promptText
 * @param {string} ratio
 */
async function generateStartFrame(promptText, ratio = '1080:1920') {
  const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-image' });

  const result = await model.generateContent({
    contents: [{
      role: 'user',
      parts: [{ text: `Generate an image: ${promptText}` }],
    }],
    generationConfig: {
      responseModalities: ['Text', 'Image'],
    },
  });

  const parts = result.response.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find(p => p.inlineData);

  if (!imagePart) {
    throw new Error('Aucune image generee par Gemini');
  }

  const base64Image = imagePart.inlineData.data;
  const mimeType = imagePart.inlineData.mimeType || 'image/png';

  return `data:${mimeType};base64,${base64Image}`;
}

/**
 * Etape 2 : anime l'image de depart en video courte.
 * @param {string} imageUrl
 * @param {string} promptText - decrit le mouvement souhaite
 * @param {string} ratio
 */
async function animateImage(imageUrl, promptText, ratio = '1080:1920') {
  const videoTask = await client.imageToVideo.create({
    model: 'gen4_turbo',
    promptImage: imageUrl,
    promptText,
    ratio,
  });

  const result = await waitForTask(videoTask.id);
  const videoUrl = result.output?.[0];

  if (!videoUrl) {
    throw new Error('Aucune video generee par Runway');
  }

  return videoUrl;
}

/**
 * Point d'entree principal : texte -> video courte verticale prete a publier.
 * @param {string} prompt - description du contenu souhaite par l'utilisateur
 * @returns {Promise<{videoUrl: string, thumbnailUrl: string}>}
 */
async function generateVideoFromText(prompt) {
  if (!prompt || prompt.trim().length === 0) {
    throw new Error('Le prompt ne peut pas etre vide');
  }

  const startFrameUrl = await generateStartFrame(prompt);
  const videoUrl = await animateImage(startFrameUrl, prompt);

  return {
    videoUrl,
    thumbnailUrl: startFrameUrl,
  };
}

module.exports = {
  generateVideoFromText,
};
