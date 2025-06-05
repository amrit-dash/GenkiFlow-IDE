import { config } from 'dotenv';
config();

import '@/ai/flows/summarize-code-snippet.ts';
import '@/ai/flows/generate-code-from-prompt.ts';
import '@/ai/flows/code-refactoring-suggestions.ts';
import '@/ai/flows/find-codebase-examples.ts';