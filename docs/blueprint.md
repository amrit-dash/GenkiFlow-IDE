
# GenkiFlow IDE - Application Blueprint

## 1. Overview

**App Name:** GenkiFlow IDE

GenkiFlow IDE is an innovative web-based Integrated Development Environment (IDE) designed to enhance the coding experience, particularly for projects utilizing Google's Genkit. It leverages AI to assist with code generation, refactoring, and understanding, all within an interactive and user-friendly interface. The IDE is built using a modern web stack including Next.js (App Router), React, TypeScript, ShadCN UI components, Tailwind CSS for styling, and Google Genkit for its AI capabilities.

## 2. Core Features

As defined in the Project Requirements Document (PRD):

*   **Multi-File Support:** Enables users to work with multiple files and a structured folder system within the IDE. The AI agent has access to this structure for contextual understanding.
*   **AI Code Assistant:** Powered by Genkit, this assistant can rewrite existing code, add new code, and manipulate project files based on codebase understanding and reasoning.
*   **Interactive UI:** A responsive user interface for interacting with the AI, viewing code, managing files, and applying changes.
*   **File System Tool (Simulated):** The AI can interact with a simulated file system (managed in `IdeContext` and persisted to LocalStorage) to examine and suggest changes to the project structure.
*   **Codebase Search Tool:** Allows the AI to find relevant parts of the codebase to inform its responses and code edits (primarily through Genkit tools like `codebaseSearch`).
*   **Edit File Tool (AI-Driven):** The AI can propose code edits, which are then applied by the user or through automated actions via the `IdeContext`.
*   **RAG Integration (Planned):** Retrieval-Augmented Generation to use the codebase as rich context for the AI agent (intended via `advancedRagSystem.ts` and ChromaDB, currently facing import challenges).

## 3. Architectural Overview

*   **Frontend Stack:**
    *   **Framework:** Next.js 15+ (App Router)
    *   **UI Library:** React 18+
    *   **Language:** TypeScript
    *   **Component Library:** ShadCN UI
    *   **Styling:** Tailwind CSS
*   **AI Backend Integration:**
    *   **Core AI Logic:** Google Genkit
    *   **Communication:** Next.js Server Actions (`src/app/(ide)/actions.ts`) serve as the bridge between the client and Genkit flows/tools.
*   **State Management:**
    *   **Primary:** React Context API (`IdeContext` at `src/contexts/ide-context.tsx`) for managing global IDE state like file system, opened files, active file, UI preferences (e.g., accent color).
    *   **Local Component State:** `useState` and `useReducer` for component-specific UI states.
*   **File System Simulation:**
    *   The entire file system (`FileSystemNode[]`) is managed client-side within `IdeContext`.
    *   **Persistence:** The file system structure and content are saved to the browser's LocalStorage to maintain state across sessions.
    *   **File Operations:** CRUD operations (Create, Read, Update, Delete) for files and folders are handled by `IdeContext` methods.
*   **Data Flow (Typical AI Interaction):**
    1.  User interacts with `AiAssistantPanel` (e.g., types a prompt).
    2.  `useAIInteraction` hook prepares the prompt and relevant context (active file, attached files, file system tree summary).
    3.  A Server Action (e.g., `enhancedGenerateCodeServer`) is called.
    4.  The Server Action invokes the appropriate Genkit flow (e.g., `enhancedGenerateCodeFlow`).
    5.  The Genkit flow processes the input, potentially using various Genkit tools (e.g., `filenameSuggester`, `codebaseSearch`).
    6.  The Genkit flow returns a structured JSON response to the Server Action.
    7.  The Server Action returns the data to the client.
    8.  The `AiAssistantPanel` updates the chat history, displaying the AI's response and any actionable suggestions (code blocks, file operation buttons).
    9.  User can apply suggestions, which trigger methods in `useOperationHandler` that interact with `IdeContext` to modify files or editor content.

## 4. Key UI Components & Panels

The main IDE interface is structured within `src/app/(ide)/page.tsx`.

*   **`IdePage` (`src/app/(ide)/page.tsx`):**
    *   The root component for the IDE layout.
    *   Uses `ResizablePanelGroup` from ShadCN to create draggable panel divisions.
*   **`Sidebar` (`src/components/ui/sidebar.tsx`):**
    *   Hosts the `FileExplorer`. Collapsible.
*   **`FileExplorer` (`src/components/file-explorer/file-explorer.tsx`):**
    *   Displays the project's file and folder structure as a tree.
    *   Uses `FileTreeItem` to render individual nodes.
    *   Allows users to open files, create new files/folders, rename, delete, and (soon) drag-and-drop.
    *   **`FileTreeItem` (`src/components/file-explorer/file-tree-item.tsx`):** Represents a single file or folder in the explorer. Handles its own state (open/closed for folders), renaming logic, and context actions.
*   **`CodeEditorPanel` (`src/components/code-editor/code-editor-panel.tsx`):**
    *   A tabbed interface for displaying and editing the content of opened files.
    *   Uses a simple `Textarea` for code editing.
    *   Manages saving content (updates `IdeContext` which persists to LocalStorage).
    *   Shows unsaved changes indicators.
*   **`AiAssistantPanel` (`src/components/ai-assistant/ai-assistant-panel.tsx`):**
    *   The primary interface for user interaction with the Genkit AI.
    *   **`AiAssistantHeader`:** Title and "New Chat" button.
    *   **`ChatHistoryDisplay`:** Renders the conversation history using `ChatMessageItem`.
    *   **`ChatInputArea`:** Text input for prompts, includes an attachment button for selecting files/folders as context.
    *   **`ChatMessageItem` (`src/components/ai-assistant/chat-message-item.tsx`):** A versatile component that renders different types of messages based on `msg.type` (text, error, loading, generated code, refactor suggestions, file operation suggestions, etc.).
    *   **Various Message Renderers** (e.g., `GeneratedCodeDisplay`, `FilenameSuggestionDisplay`): Components specialized in displaying structured AI outputs.
*   **`TerminalPanel` (`src/components/terminal/terminal-panel.tsx`):**
    *   A basic terminal emulator.
    *   Supports a limited set of file system commands (`ls`, `cd`, `mkdir`, `touch`, `rm`, `cat`, `pwd`, `echo`, `clear`, `help`, `date`).
    *   Interacts with the `IdeContext` to reflect file system changes.
*   **`GlobalControls` (`src/components/global-controls.tsx`):**
    *   Located in the `SidebarFooter`.
    *   Provides toggle buttons for the AI Assistant and Terminal panels.
    *   Includes a button to open the `ManageWorkspaceModal`.
    *   Includes the `ThemeToggleButton`.
*   **`ManageWorkspaceModal` (`src/components/manage-workspace-modal.tsx`):**
    *   Allows users to:
        *   Change the IDE's accent color.
        *   Download the current workspace (files and folders) as a ZIP archive.
        *   Upload a ZIP archive to replace the current workspace (includes filtering of unsupported file types).
        *   Reset the workspace to a default mock project.
*   **ShadCN UI Components (`src/components/ui/`):**
    *   A suite of pre-built, accessible, and customizable UI components (Button, Dialog, Input, Card, Resizable, etc.) used throughout the application.

## 5. Core Functionalities & Implementation

*   **File System Management (`IdeContext`):**
    *   **Structure:** Manages an array of `FileSystemNode` objects. Each node has an `id`, `name`, `type` (`file` or `folder`), `path`, `content` (for files), and `children` (for folders).
    *   **Persistence:** Serializes `fileSystem`, `openedFiles`, and `activeFilePath` to LocalStorage on change, and loads them on initialization.
    *   **Operations:** Provides methods like `addNode`, `deleteNode`, `renameNode`, `moveNode`, `updateFileContent`, `saveFile`.
    *   **Opened Files:** Maintains a `Map` of `openedFiles` (path -> `FileSystemNode`) for tabs in the editor.
    *   **Active File:** Tracks the `activeFilePath` currently being edited.
    *   **Undo/Redo:** File content changes have a history stack (`contentHistory`, `historyIndex` on `FileSystemNode`) for undo/redo operations within the editor.
*   **AI Interaction (`AiAssistantPanel` and its hooks):**
    *   **`useChatManager`:** Manages the core chat state: `prompt`, `chatHistory`, `isLoading`, UI states for message actions (copying, applied status, loading for specific actions).
    *   **`useAttachmentManager`:** Handles selection and management of files/folders attached to the AI prompt for contextual input.
    *   **`useOperationHandler`:** Responsible for executing actions suggested by the AI. This includes:
        *   Applying code changes to the editor (using `intelligentCodeMergerServer` or direct replacement).
        *   Creating new files with AI-generated content.
        *   Triggering file system operations (delete, rename, move) based on AI suggestions, often after user confirmation.
        *   Managing an undo stack for file operations.
        *   Showing confirmation dialogs for potentially destructive operations.
    *   **`useAIInteraction`:** Orchestrates the entire AI interaction flow. It:
        *   Determines the user's intent (e.g., suggest name, run command, refactor, summarize, general code generation).
        *   Prepares contextual data (current file content, active file path, attached files content/summary, file system tree summary, project context).
        *   Calls the appropriate Server Action based on the intent.
        *   Processes the AI's response and updates the chat history with structured messages.
*   **Server Actions (`src/app/(ide)/actions.ts`):**
    *   Act as the API layer between the client and server-side Genkit logic.
    *   Each action typically corresponds to a Genkit flow or tool.
    *   They receive input from the client (prompt, context), invoke Genkit, and return structured JSON data.
    *   Examples: `enhancedGenerateCodeServer`, `summarizeCodeSnippetServer`, `refactorCodeServer`, `suggestFilenameServer`.
*   **Genkit Flows (`src/ai/flows/`):**
    *   These are the core AI logic units defined using Genkit.
    *   **`enhancedGenerateCodeFlow`:** The primary flow for most code-related requests. It takes a user prompt and extensive context (current file, attachments, file system tree, project info) and uses a sophisticated prompt to instruct the LLM. It can generate new code, modify existing code, and suggest file system operations. It leverages several Genkit tools.
    *   **`summarizeCodeSnippetFlow`:** Generates a summary of a given code snippet.
    *   **`codeRefactoringSuggestionsFlow`:** Analyzes a code snippet and its context to provide a single best refactoring suggestion.
    *   **`findCodebaseExamplesFlow`:** Uses the `codebaseSearch` tool to find examples of function/component usage.
*   **Genkit Tools (`src/ai/tools/`):**
    *   These are functions that Genkit flows can call to interact with the "outside world" or perform specific tasks.
    *   **`fileSystemExecutor`:** *Simulates* file system operations (create, delete, rename, move, list) and returns whether user confirmation is needed. Actual operations are client-side.
    *   **`fileSystemOperations`:** (Largely superseded by `enhancedGenerateCodeFlow` for main operations) Analyzes file system structure and *suggests* operations.
    *   **`filenameSuggester`:** Analyzes file content and suggests appropriate filenames, considering code structure and purpose.
    *   **`intelligentCodeMerger`:** Takes existing file content and new AI-generated content and intelligently merges them.
    *   **`fileContextAnalyzer`:** Analyzes a file's content to determine its language, purpose, main functions, dependencies, etc.
    *   **`smartFolderOperations`:** Provides intelligent suggestions for folder operations like move destinations or rename suggestions based on content.
    *   **`codebaseSearch`:** A basic tool to search for keywords or patterns in the (simulated) codebase.
    *   **`errorValidation`:** Validates code for syntax errors, type errors (using TypeScript compiler API and ESLint), and best practice violations.
    *   **`codeUsageAnalysis`:** Finds all usages of functions, classes, variables within the codebase (using TypeScript compiler API).
    *   **`operationProgress`:** Tool for AI to report progress on multi-step operations (not heavily used by current flows but available).
    *   **`terminalOperations`:** Simulates execution of allowed terminal commands.
    *   **`advancedRagSystem` (with `codeIndexer`, `codeRetriever`, `codeEvaluator`, `projectAnalyzer`):** This suite of tools is designed for a more sophisticated Retrieval-Augmented Generation system using ChromaDB and LangChain embeddings. It's currently facing import/bundling issues with `chromadb`.
    *   **`codebaseDataset`:** Intended to manage a dataset of codebase information for RAG, related to `advancedRagSystem`.
*   **Workspace Management (`ManageWorkspaceModal` & `src/lib/workspace-utils.ts`):**
    *   **Download:** Uses `JSZip` to create a ZIP archive of the current `fileSystem` (all files and folders) and triggers a browser download using `file-saver`.
    *   **Upload:** Allows users to select a ZIP file. `JSZip` is used to read the archive.
        *   **File Filtering:** `isFileSupported` function checks file extensions against a list of unsupported binary/large/non-code types. Unsupported files are skipped.
        *   The processed file structure replaces the current workspace in `IdeContext`.
    *   **Reset:** Replaces the current `fileSystem` in `IdeContext` with `mockFileSystem` (a basic README.md).
*   **Theming & Styling:**
    *   **`ThemeProvider` (`src/components/theme-provider.tsx`):** Uses `next-themes` to manage light/dark mode.
    *   **`ThemeToggleButton` (`src/components/theme-toggle-button.tsx`):** Allows users to switch between light and dark themes.
    *   **`globals.css`:** Defines CSS variables for light and dark themes, including primary (purple), background (grey for dark), and accent colors, following the PRD. Sets the `Century Gothic` font family for body and headlines.
    *   **Accent Color Customization:** The `IdeContext` manages the `accentColor` (an HSL string). `ManageWorkspaceModal` allows users to pick from a predefined palette. When changed, `applyAccentColorToDocument` in `IdeContext` updates CSS custom properties (`--primary`, `--accent`, `--ring`) on the `document.documentElement`.

## 6. Style Guidelines Implementation

*   **Primary Color:** `hsl(var(--primary))` and `hsl(var(--accent))` are set to shades of purple (default: `270 70% 55%` for light, `270 70% 65%` for dark) in `globals.css`. These are used by ShadCN components.
*   **Background Color (Dark):** `hsl(var(--background))` in dark mode is set to a dark slate grey (`220 3% 15%`).
*   **Text Color (Interactive):** The primary/accent colors are used for interactive elements by ShadCN's default styling (e.g., button variants, active states, rings).
*   **Fonts:** `Century Gothic` is set as `font-body` and `font-headline` in `tailwind.config.ts` and applied to the `body` in `RootLayout`. `font-code` (monospace) is used for code areas.
*   **Icons:** `lucide-react` is used extensively for Material Design-like icons.
*   **Layout:** The IDE follows the blueprint layout (File Explorer on left, Code Editor in center, AI Assistant on right, Terminal at bottom) using `ResizablePanelGroup`.
*   **Animations:** ShadCN components and Tailwind CSS provide subtle transitions and animations (e.g., accordion, dialogs).

## 7. Directory Structure (Key Areas)

*   `src/app/(ide)/`
    *   `layout.tsx`: Layout specific to the IDE page.
    *   `page.tsx`: Main IDE page component, assembling all panels.
    *   `actions.ts`: Server Actions for client-AI communication.
*   `src/components/`
    *   `ai-assistant/`: Components and hooks for the AI chat panel.
    *   `code-editor/`: Code editor panel component.
    *   `file-explorer/`: File explorer components.
    *   `terminal/`: Terminal panel component.
    *   `ui/`: ShadCN UI components (button, card, dialog, etc.).
    *   `global-controls.tsx`: Panel toggles, workspace manager button.
    *   `manage-workspace-modal.tsx`: Modal for workspace operations.
    *   `theme-provider.tsx`, `theme-toggle-button.tsx`: Theme management.
*   `src/ai/`
    *   `flows/`: Genkit flow definitions (e.g., `enhanced-code-generation.ts`).
    *   `tools/`: Genkit tool definitions (e.g., `filename-suggester.ts`, `file-system-executor.ts`).
    *   `genkit.ts`: Genkit initialization.
*   `src/contexts/`
    *   `ide-context.tsx`: Global IDE state management.
*   `src/hooks/`
    *   `use-toast.ts`: Custom toast hook.
    *   `use-mobile.ts`: Hook for detecting mobile view.
*   `src/lib/`
    *   `types.ts`: Core TypeScript type definitions for the application.
    *   `utils.ts`: Utility functions (e.g., `cn` for Tailwind class merging).
    *   `mock-data.ts`: Default file system structure for reset.
    *   `workspace-utils.ts`: Utilities for ZIP import/export.
*   `docs/`
    *   `blueprint.md`: This document.

This blueprint provides a snapshot of the GenkiFlow IDE's design and functionality as of the current state of development.

    