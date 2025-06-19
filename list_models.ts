import { GoogleGenerativeAI } from '@google/generative-ai';
import 'dotenv/config'; // Load environment variables from .env

// Get API key from environment variables
const API_KEY = process.env.GOOGLE_GENAI_API_KEY;

async function listModels() {
  if (!API_KEY) {
    console.error('GOOGLE_GENAI_API_KEY not found in .env file.');
    return;
  }

  const genAI = new GoogleGenerativeAI(API_KEY);
  try {
    console.log('Fetching available models...');
    const models = await genAI.getModels();
    console.log('Available Models:');
    models.forEach((model: any) => {
      console.log(`- ${model.name} (Supported methods: ${model.supportedGenerationMethods?.join(', ') || 'N/A'})`);
    });
  } catch (error) {
    console.error('Error listing models:', error);
  }
}

listModels();
