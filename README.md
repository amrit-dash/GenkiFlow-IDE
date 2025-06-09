# GenkiFlow IDE

![Built with Next.js](https://img.shields.io/badge/-Next.js-000000?logo=nextdotjs&logoColor=white)
![Powered by React](https://img.shields.io/badge/-React-61DAFB?logo=react&logoColor=white)
![Written in TypeScript](https://img.shields.io/badge/-TypeScript-3178C6?logo=typescript&logoColor=white)
![Styled with Tailwind CSS](https://img.shields.io/badge/-Tailwind%20CSS-06B6D4?logo=tailwindcss&logoColor=white)
![Powered by Firebase Studio](https://img.shields.io/badge/-Firebase%20Studio-FFCA28?logo=firebase&logoColor=black)
![GenkiFlow IDE Screenshot](https://i.ibb.co/sdW4TcRn/image-2025-06-09-062711110.png)
[![Live Demo](https://img.shields.io/badge/Live%20Demo-GenkiFlow%20IDE-brightgreen)](https://studio--genkiflow-ide.us-central1.hosted.app/ide)

GenkiFlow IDE is a cutting-edge, web-based Integrated Development Environment (IDE) that harnesses the power of generative AI through Google Genkit to enhance your coding workflow. This IDE is designed to provide intelligent code assistance, making development faster, more efficient, and more enjoyable.

## Features

*   **Multi-file Support:** Seamlessly work with multiple files within a single IDE instance.
*   **AI Code Assistant:** Get intelligent suggestions, refactor code, generate new code snippets, and perform data manipulation with the help of the integrated AI assistant powered by Google Genkit.
*   **Interactive UI:** A user-friendly and interactive interface designed for a smooth development experience.
*   **File System Tool:** Navigate and manage your project files directly within the IDE.
*   **Codebase Search Tool:** Quickly search your entire codebase for files, symbols, or patterns.
*   **Edit File Tool:** Directly edit your project files with a robust code editor.
*   **RAG Integration:** Leveraging Retrieval Augmented Generation (RAG) to provide contextually relevant code assistance.

## Technology Stack

*   **Frontend:** Next.js, React, TypeScript, Tailwind CSS
*   **AI Backend:** Google Genkit

## Getting Started

To get started with GenkiFlow IDE, clone the repository and follow the setup instructions in the `docs/blueprint.md` file.

## Project Structure

*   `/src/app`: Contains the main application pages and routes, including the IDE layout and core pages.
*   `/src/components`: Reusable React components for the UI, including the AI assistant panel, code editor, and file explorer.
*   `/src/ai`: Houses the Genkit configurations, flows, and tools for the AI code assistance features.
*   `/src/lib`: Utility functions, types, and mock data.
*   `/src/hooks`: Custom React hooks.
*   `/docs`: Project documentation, including the blueprint.
*   `/.idx`: Development environment configurations.
*   `/.vscode`: VS Code settings.
