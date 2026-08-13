// server.js
// Backend Express pour TikShorte — expose l'endpoint de génération vidéo IA.
// La clé API Runway ne doit JAMAIS être exposée côté app mobile : tout passe par ce serveur.

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { generateVideoFromText } = require('./runwayService');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Petit garde-fou anti-abus très simple (à remplacer par un vrai rate limiter en prod, ex: express-rate-limit)
const requestLog = new Map();
function simpleRateLimit(req, res, next) {
  const ip = req.ip;
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequests = 3;

  const timestamps = (requestLog.get(ip) || []).filter((t) => now - t < windowMs);
  if (timestamps.length >= maxRequests) {
    return res.status(429).json({ error: 'Trop de requêtes, réessaie dans une minute.' });
  }
  timestamps.push(now);
  requestLog.set(ip, timestamps);
  next();
}

app.post('/api/generate-video', simpleRateLimit, async (req, res) => {
  const { prompt } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Le champ "prompt" est requis et doit être une chaîne de caractères.' });
  }

  try {
    console.log(`[generate-video] Nouvelle demande: "${prompt.slice(0, 80)}..."`);
    const result = await generateVideoFromText(prompt);
    return res.status(200).json(result);
  } catch (error) {
    console.error('[generate-video] Erreur:', error.message);
    return res.status(500).json({ error: "La génération vidéo a échoué. Réessaie dans quelques instants." });
  }
});

app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`TikShorte backend démarré sur le port ${PORT}`);
});
