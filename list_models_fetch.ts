import 'dotenv/config';
import fetch from 'node-fetch';

const API_KEY = process.env.GOOGLE_GENAI_API_KEY;
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;

async function listModels() {
  if (!API_KEY) {
    console.error('GOOGLE_GENAI_API_KEY not found in .env file.');
    return;
  }
  try {
    console.log('Fetching available models from Google Generative Language API...');
    const res = await fetch(ENDPOINT);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    const data = await res.json();
    if (!data.models) {
      console.log('No models found in response:', data);
      return;
    }
    console.log('Available Models:');
    data.models.forEach((model: any) => {
      console.log(`- ${model.name} (Supported methods: ${(model.supportedGenerationMethods || []).join(', ')})`);
    });
  } catch (error) {
    console.error('Error listing models:', error);
  }
}

listModels();
