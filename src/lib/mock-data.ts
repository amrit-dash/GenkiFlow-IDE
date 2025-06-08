
import type { FileSystemNode } from './types';

export const mockFileSystem: FileSystemNode[] = [
  {
    id: 'readme-md',
    name: 'README.md',
    type: 'file',
    path: '/README.md',
    content:
`# GenkiFlow IDE

This is an AI-powered IDE for developing and managing Genkit flows.

Welcome! You can start by:
- Creating new files or folders using the icons in the File Explorer header.
- Typing commands in the Terminal (e.g., 'mkdir my_project', 'touch app.py').
- Asking the AI Assistant for help (e.g., 'generate a python script for a simple web server').

---

## About the Developer

This IDE was created by **Amrit Dash**.

- **GitHub**: [amrit-dash](https://github.com/amrit-dash)
- **Website**: [amritdash.web.app](https://amritdash.web.app)
`
  }
];
