import { config } from 'dotenv';
config();

import '@/ai/flows/summarize-code-snippet.ts';
import '@/ai/flows/generate-code-from-prompt.ts';
import '@/ai/flows/code-refactoring-suggestions.ts';
import '@/ai/flows/find-codebase-examples.ts';
import '@/ai/flows/enhanced-code-generation.ts';
import '@/ai/tools/file-system-operations.ts';
import '@/ai/tools/file-system-tree-generator.ts';
import '@/ai/tools/codebase-search.ts';
import '@/ai/tools/error-validation.ts';
import '@/ai/tools/code-usage-analysis.ts';
import '@/ai/tools/operation-progress.ts';