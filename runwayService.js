// runwayService.js
// Encapsule tous les appels à l'API Runway pour TikShorte.
// Pipeline : texte -> image de départ (textToImage) -> vidéo animée (imageToVideo)

const RunwayML = require('@runwayml/sdk').default;

const client = new RunwayML({
  apiKey: process.env.RUNWAYML_API_SECRET, // jamais en dur, toujours en variable d'env
});

const POLL_INTERVAL_MS = 4000; // 4s entre chaque vérification du statut de la tâche
const MAX_POLL_ATTEMPTS = 90; // ~6 minutes max avant timeout

/**
 * Attend qu'une tâche Runway passe à SUCCEEDED ou FAILED en la interrogeant régulièrement.
 * @param {string} taskId
 */
async function waitForTask(taskId) {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    const task = await client.tasks.retrieve(taskId);

    if (task.status === 'SUCCEEDED') {
      return task;
    }
    if (task.status === 'FAILED') {
      throw new Error(`Tâche Runway échouée: ${task.failure || 'raison inconnue'}`);
    }

    // PENDING, RUNNING, THROTTLED -> on continue d'attendre
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error('Timeout: la génération vidéo a dépassé le délai maximum');
}

/**
 * Étape 1 : génère une image de départ à partir d'un prompt texte.
 * @param {string} promptText
 * @param {string} ratio - format image, ex: "1080:1920" pour du vertical (TikTok/Shorts)
 */
async function generateStartFrame(promptText, ratio = '1080:1920') {
  const imageTask = await client.textToImage.create({
    model: 'gemini_image3_pro',
    promptText,
    ratio,
  });

  const result = await waitForTask(imageTask.id);
  const imageUrl = result.output?.[0];

  if (!imageUrl) {
    throw new Error("Aucune image générée par Runway");
  }

  return imageUrl;
}

/**
 * Étape 2 : anime l'image de départ en vidéo courte.
 * @param {string} imageUrl
 * @param {string} promptText - décrit le mouvement souhaité
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
    throw new Error("Aucune vidéo générée par Runway");
  }

  return videoUrl;
}

/**
 * Point d'entrée principal : texte -> vidéo courte verticale prête à publier.
 * @param {string} prompt - description du contenu souhaité par l'utilisateur
 * @returns {Promise<{videoUrl: string, thumbnailUrl: string}>}
 */
async function generateVideoFromText(prompt) {
  if (!prompt || prompt.trim().length === 0) {
    throw new Error('Le prompt ne peut pas être vide');
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
