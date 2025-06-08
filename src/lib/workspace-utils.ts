
import type { FileSystemNode } from './types';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

async function addNodesToZip(nodes: FileSystemNode[], currentZipFolder: JSZip) {
  for (const node of nodes) {
    if (node.type === 'file') {
      // Ensure content is a string, even if undefined
      currentZipFolder.file(node.name, node.content || '', { binary: false });
    } else if (node.type === 'folder') {
      const folder = currentZipFolder.folder(node.name);
      if (folder && node.children && node.children.length > 0) {
        await addNodesToZip(node.children, folder);
      }
    }
  }
}

export async function downloadWorkspaceAsZip(fileSystem: FileSystemNode[], projectName: string): Promise<void> {
  if (!projectName || projectName.trim() === "") {
    throw new Error("Project name cannot be empty.");
  }

  const zip = new JSZip();
  
  await addNodesToZip(fileSystem, zip);

  try {
    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 9 } });
    saveAs(blob, `${projectName.trim()}.zip`);
  } catch (error) {
    console.error("Error generating or saving zip file:", error);
    throw new Error("Failed to generate or save the zip file.");
  }
}

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2, 7);

const UNSUPPORTED_EXTENSIONS = [
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.mp3', '.wav', '.aac', '.ogg', '.flac',
  '.mp4', '.avi', '.mov', '.mkv', '.webm', '.flv',
  '.exe', '.dmg', '.iso', '.bin', '.app', '.msi', '.deb', '.rpm',
  '.zip', '.tar', '.gz', '.rar', '.7z', // Prevent importing archives within archives
  '.psd', '.ai', '.fig', '.sketch', // Design files
  '.o', '.obj', '.class', '.pyc', // Compiled object files
  // Potentially large image files - can be adjusted if needed
  '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp', '.heic', '.heif',
  '.ico' // Added .ico
];

export function isFileSupported(fileName: string): boolean {
  const lowerFileName = fileName.toLowerCase();
  // Allow files without extensions (e.g., Dockerfile, Procfile, .env files if they start with .)
  if (lowerFileName.lastIndexOf('.') === -1 || lowerFileName.startsWith('.')) {
    return true; 
  }
  return !UNSUPPORTED_EXTENSIONS.some(ext => lowerFileName.endsWith(ext));
}

// Helper function to determine if a folder is effectively empty
function isEffectivelyEmpty(node: FileSystemNode): boolean {
  if (node.type === 'file') {
    return false; // Files are never considered empty for pruning
  }
  if (node.type === 'folder') {
    if (!node.children || node.children.length === 0) {
      return true; // No children, definitely empty
    }
    // A folder is effectively empty if all its children are effectively empty
    return node.children.every(child => isEffectivelyEmpty(child));
  }
  return true; // Should not happen for valid FileSystemNode
}

// Recursive function to prune empty folders from a list of nodes
function pruneEmptyFoldersRecursive(nodes: FileSystemNode[]): FileSystemNode[] {
  if (!nodes) return [];

  // First, recursively prune children of all folders in the current list
  const processedNodes = nodes.map(node => {
    if (node.type === 'folder' && node.children) {
      const prunedChildren = pruneEmptyFoldersRecursive(node.children);
      return { ...node, children: prunedChildren };
    }
    return node; // Files or folders without children (or children already processed for this node)
  });

  // Then, filter out nodes that are effectively empty from the current list
  return processedNodes.filter(node => {
    if (node.type === 'file') {
      return true; // Always keep files
    }
    if (node.type === 'folder') {
      return !isEffectivelyEmpty(node); // Keep folder only if it's not effectively empty
    }
    return false; // Should not happen
  });
}


export async function processZipFile(zipData: ArrayBuffer): Promise<{ fileSystem: FileSystemNode[], unsupportedFiles: string[], singleRootDir: string | null }> {
  const zip = await JSZip.loadAsync(zipData);
  const files: { [path: string]: { type: 'file' | 'folder', content?: string, name: string } } = {};
  const unsupportedFiles: string[] = [];

  const promises: Promise<void>[] = [];

  zip.forEach((relativePath, zipEntry) => {
    // Skip Mac OS X metadata folders/files
    if (relativePath.startsWith('__MACOSX/')) {
      return;
    }
    // Skip .DS_Store files
    if (zipEntry.name.endsWith('.DS_Store')) {
        unsupportedFiles.push(relativePath); // Technically unsupported by not processing
        return;
    }

    if (zipEntry.dir) {
      files[relativePath] = { type: 'folder', name: zipEntry.name.split('/').filter(Boolean).pop()! };
    } else {
      const fileName = zipEntry.name.split('/').filter(Boolean).pop()!;
      if (isFileSupported(fileName)) {
        promises.push(
          zipEntry.async('string').then(content => {
            files[relativePath] = { type: 'file', content, name: fileName };
          }).catch(err => {
            console.warn(`Could not read content for ${relativePath} as string, likely binary or unsupported encoding. Excluding. Error: ${err.message}`);
            unsupportedFiles.push(relativePath);
          })
        );
      } else {
        unsupportedFiles.push(relativePath);
      }
    }
  });

  await Promise.all(promises);

  // Reconstruct FileSystemNode structure
  const pathMap: Map<string, FileSystemNode> = new Map();
  let rootNodes: FileSystemNode[] = [];

  const sortedPaths = Object.keys(files).sort((a, b) => a.localeCompare(b));

  for (const path of sortedPaths) {
    const entry = files[path];
    if (!entry) continue; 

    const parts = path.split('/').filter(p => p);
    const name = parts.pop()!;
    const parentPath = parts.join('/');
    
    const fullPath = '/' + path.replace(/\/$/, '');


    const node: FileSystemNode = {
      id: generateId(),
      name: entry.name || name,
      type: entry.type,
      path: fullPath,
      content: entry.type === 'file' ? entry.content : undefined,
      children: entry.type === 'folder' ? [] : undefined, // Initialize children for folders
    };
    if (node.type === 'file') {
        node.contentHistory = [node.content || ''];
        node.historyIndex = 0;
    }

    pathMap.set(path, node);

    if (!parentPath) {
      rootNodes.push(node);
    } else {
      const parentNode = pathMap.get(parentPath + '/'); 
      if (parentNode && parentNode.type === 'folder') {
        parentNode.children = parentNode.children || [];
        parentNode.children.push(node);
      } else {
        console.warn(`Parent for ${path} not found or not a folder. Adding to root.`);
        rootNodes.push(node);
      }
    }
  }
  
  // Prune empty folders from the constructed tree
  rootNodes = pruneEmptyFoldersRecursive(rootNodes);

  // Detect if there's a single root directory in the zip after pruning
  let singleRootDirName: string | null = null;
  let finalFileSystem = rootNodes;

  if (finalFileSystem.length === 1 && finalFileSystem[0].type === 'folder') {
    singleRootDirName = finalFileSystem[0].name;
    finalFileSystem = finalFileSystem[0].children || [];
    // Re-path children if we are "unwrapping" a single root directory
    const rePathChildren = (nodes: FileSystemNode[], parentPathPrefix: string) => {
        nodes.forEach(n => {
            n.path = (parentPathPrefix === '/' ? '' : parentPathPrefix) + '/' + n.name;
            if (n.path.startsWith('//')) n.path = n.path.substring(1);
            if (n.type === 'folder' && n.children) {
                rePathChildren(n.children, n.path);
            }
        });
    };
    rePathChildren(finalFileSystem, '/');
  }

  return { fileSystem: finalFileSystem, unsupportedFiles, singleRootDir: singleRootDirName };
}
