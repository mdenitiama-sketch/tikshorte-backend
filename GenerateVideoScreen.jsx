// GenerateVideoScreen.jsx
// Écran principal de TikShorte : l'utilisateur décrit sa vidéo, l'app appelle le backend,
// puis affiche la vidéo générée (ou un aperçu vidéo natif).

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
} from 'react-native';
import { Video } from 'expo-av'; // ou react-native-video selon ta config

// Remplace par l'URL de ton backend déployé (Render, Railway, Fly.io, etc.)
const API_BASE_URL = 'https://ton-backend.exemple.com';

export default function GenerateVideoScreen() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState(null);
  const [thumbnailUrl, setThumbnailUrl] = useState(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      Alert.alert('Oups', 'Décris la vidéo que tu veux générer.');
      return;
    }

    setLoading(true);
    setVideoUrl(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/generate-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erreur inconnue');
      }

      setVideoUrl(data.videoUrl);
      setThumbnailUrl(data.thumbnailUrl);
    } catch (error) {
      Alert.alert('Génération échouée', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Crée ta vidéo</Text>
      <Text style={styles.subtitle}>Décris le contenu, l'IA fait le reste</Text>

      <TextInput
        style={styles.input}
        placeholder="Ex: un chat astronaute qui flotte dans l'espace, style cartoon"
        placeholderTextColor="#888"
        value={prompt}
        onChangeText={setPrompt}
        multiline
        numberOfLines={3}
      />

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleGenerate}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Générer la vidéo</Text>
        )}
      </TouchableOpacity>

      {loading && (
        <Text style={styles.loadingHint}>
          Ça peut prendre 1 à 2 minutes, le temps que l'IA fasse son travail ✨
        </Text>
      )}

      {thumbnailUrl && !videoUrl && (
        <Image source={{ uri: thumbnailUrl }} style={styles.preview} resizeMode="cover" />
      )}

      {videoUrl && (
        <Video
          source={{ uri: videoUrl }}
          style={styles.preview}
          useNativeControls
          resizeMode="cover"
          isLooping
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#0d0d0d',
    flexGrow: 1,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#fff',
    marginTop: 20,
  },
  subtitle: {
    fontSize: 14,
    color: '#aaa',
    marginBottom: 24,
  },
  input: {
    width: '100%',
    minHeight: 80,
    backgroundColor: '#1a1a1a',
    color: '#fff',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#6c5ce7',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 30,
    width: '100%',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  loadingHint: {
    color: '#aaa',
    marginTop: 12,
    fontSize: 13,
    textAlign: 'center',
  },
  preview: {
    width: '100%',
    aspectRatio: 9 / 16,
    borderRadius: 16,
    marginTop: 24,
    backgroundColor: '#000',
  },
});
