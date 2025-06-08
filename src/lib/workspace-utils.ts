
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
  
  // Add all root nodes to the zip.
  // The project name is for the zip file itself, not a root folder within the zip.
  await addNodesToZip(fileSystem, zip);

  try {
    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 9 } });
    saveAs(blob, `${projectName.trim()}.zip`);
  } catch (error) {
    console.error("Error generating or saving zip file:", error);
    throw new Error("Failed to generate or save the zip file.");
  }
}
