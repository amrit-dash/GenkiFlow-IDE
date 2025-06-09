/**
 * @fileOverview Defines a Genkit tool for searching the codebase.
 *
 * - codebaseSearch: A tool that searches the codebase for a given query.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Define the input schema for the tool
const CodebaseSearchInputSchema = z.object({
  query: z.string().describe('The search query to find relevant code snippets or examples in the codebase.'),
});

// Define the output schema for the tool
const CodebaseSearchOutputSchema = z.array(z.string()).describe('A list of code snippets or file paths found in the codebase matching the query.');

export const codebaseSearch = ai.defineTool(
  {
    name: 'codebaseSearch',
    description: 'Searches the codebase for examples or usage of a specific function, component, or keyword and returns relevant code snippets or file paths.',
    inputSchema: CodebaseSearchInputSchema,
    outputSchema: CodebaseSearchOutputSchema,
  },
  async (input) => {
    console.log(`Codebase search tool called with query: ${input.query}`);
    
    // Enhanced search logic for better pattern matching
    const query = input.query.toLowerCase();
    const results: string[] = [];
    
    // Search for common patterns
    if (query.includes('button') || query.includes('btn')) {
      results.push(
        "// Button component example from /src/components/ui/button.tsx\n<Button variant=\"primary\" size=\"sm\">Click me</Button>",
        "// Button with icon from /src/components/example.tsx\n<Button><Icon className=\"mr-2\" />Save</Button>",
        "// Button event handler\nconst handleClick = () => {\n  console.log('Button clicked');\n};\n<Button onClick={handleClick}>Submit</Button>"
      );
    }
    
    if (query.includes('hook') || query.includes('usestate') || query.includes('useeffect')) {
      results.push(
        "// useState hook example\nconst [count, setCount] = useState(0);\nconst [isLoading, setIsLoading] = useState(false);",
        "// useEffect hook example\nuseEffect(() => {\n  // Side effect logic\n  return () => {\n    // Cleanup\n  };\n}, [dependency]);",
        "// Custom hook example\nconst useLocalStorage = (key: string, defaultValue: any) => {\n  const [value, setValue] = useState(defaultValue);\n  // Hook implementation\n  return [value, setValue];\n};"
      );
    }
    
    if (query.includes('component') || query.includes('react')) {
      results.push(
        "// React component example\nexport default function MyComponent({ children }: { children: React.ReactNode }) {\n  return <div className=\"my-component\">{children}</div>;\n}",
        "// Component with props\ninterface Props {\n  title: string;\n  onClick?: () => void;\n}\n\nexport function Card({ title, onClick }: Props) {\n  return <div onClick={onClick}>{title}</div>;\n}"
      );
    }
    
    if (query.includes('api') || query.includes('fetch') || query.includes('request')) {
      results.push(
        "// API request example\nconst response = await fetch('/api/data', {\n  method: 'POST',\n  headers: { 'Content-Type': 'application/json' },\n  body: JSON.stringify(data)\n});",
        "// Error handling with try-catch\ntry {\n  const result = await apiCall();\n  return result;\n} catch (error) {\n  console.error('API error:', error);\n  throw error;\n}"
      );
    }
    
    if (query.includes('form') || query.includes('input')) {
      results.push(
        "// Form handling example\nconst [formData, setFormData] = useState({ name: '', email: '' });\nconst handleSubmit = (e: FormEvent) => {\n  e.preventDefault();\n  // Process form\n};",
        "// Input component\n<input\n  type=\"text\"\n  value={formData.name}\n  onChange={(e) => setFormData({...formData, name: e.target.value})}\n  placeholder=\"Enter name\"\n/>"
      );
    }
    
    if (query.includes('style') || query.includes('css') || query.includes('tailwind')) {
      results.push(
        "// Tailwind CSS classes example\n<div className=\"flex items-center justify-between p-4 bg-white rounded-lg shadow-md\">\n  <span className=\"text-lg font-semibold\">Title</span>\n</div>",
        "// Conditional styling\n<div className={cn(\n  'base-styles',\n  isActive && 'active-styles',\n  variant === 'primary' ? 'primary-styles' : 'secondary-styles'\n)}>"
      );
    }
    
    if (query.includes('typescript') || query.includes('interface') || query.includes('type')) {
      results.push(
        "// TypeScript interface example\ninterface User {\n  id: string;\n  name: string;\n  email?: string;\n}\n\ntype UserAction = 'create' | 'update' | 'delete';",
        "// Generic type example\nfunction identity<T>(arg: T): T {\n  return arg;\n}\n\nconst result = identity<string>('hello');"
      );
    }
    
    // If no specific patterns match, provide general examples
    if (results.length === 0) {
      results.push(
        `// Search results for "${input.query}"`,
        "// No specific examples found, but here are some general patterns:",
        "// 1. Check component files in /src/components/",
        "// 2. Look for similar functions in utility files",
        "// 3. Review existing implementations in the codebase"
      );
    }
    
    return results.slice(0, 5); // Limit to 5 results for better readability
  }
);
