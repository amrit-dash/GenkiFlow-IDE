
"use client";
import React, { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, Github, UploadCloud, Loader2, AlertTriangle, FileWarning } from 'lucide-react';
import { useIde } from '@/contexts/ide-context';
import { useToast } from '@/hooks/use-toast';
import { downloadWorkspaceAsZip, processZipFile } from '@/lib/workspace-utils';
import type { FileSystemNode } from '@/lib/types';

interface ManageWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ProcessingStep = 'idle' | 'confirmUnsupported' | 'confirmOverwrite' | 'processing';

export function ManageWorkspaceModal({ isOpen, onClose }: ManageWorkspaceModalProps) {
  const { fileSystem, replaceWorkspace } = useIde();
  const { toast } = useToast();

  // Download state
  const [downloadProjectName, setDownloadProjectName] = useState("MyGenkiFlowProject");
  const downloadInputRef = useRef<HTMLInputElement>(null);

  // GitHub Import state
  const [githubUrlInput, setGithubUrlInput] = useState("");
  const [isFetchingGitHub, setIsFetchingGitHub] = useState(false);

  // ZIP Upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedZipFile, setSelectedZipFile] = useState<File | null>(null);
  const [isProcessingZip, setIsProcessingZip] = useState(false);
  const [unsupportedFiles, setUnsupportedFiles] = useState<string[]>([]);
  const [processedZipFileSystem, setProcessedZipFileSystem] = useState<FileSystemNode[] | null>(null);
  const [zipProcessingStep, setZipProcessingStep] = useState<ProcessingStep>('idle');
  
  useEffect(() => {
    if (isOpen) {
      // Reset states when modal opens
      setDownloadProjectName("MyGenkiFlowProject");
      setGithubUrlInput("");
      setSelectedZipFile(null);
      setIsProcessingZip(false);
      setUnsupportedFiles([]);
      setProcessedZipFileSystem(null);
      setZipProcessingStep('idle');
      setIsFetchingGitHub(false);

      setTimeout(() => {
        downloadInputRef.current?.focus();
        downloadInputRef.current?.select();
      }, 100);
    }
  }, [isOpen]);

  const handleDownload = async () => {
    if (!downloadProjectName.trim()) {
      toast({ variant: "destructive", title: "Error", description: "Project name cannot be empty." });
      return;
    }
    toast({ title: "Preparing download...", description: "Your project is being zipped." });
    try {
      await downloadWorkspaceAsZip(fileSystem, downloadProjectName.trim());
      toast({ title: "Download Started!", description: `${downloadProjectName.trim()}.zip is downloading.` });
      onClose();
    } catch (error) {
      console.error("Failed to download workspace:", error);
      toast({ variant: "destructive", title: "Download Failed", description: (error as Error).message });
    }
  };

  const processAndReplaceWorkspace = async (zipArrayBuffer: ArrayBuffer, source: 'GitHub' | 'Upload') => {
    setIsProcessingZip(true); 
    if (source === 'GitHub') setIsFetchingGitHub(true); 

    try {
      const { fileSystem: newFs, unsupportedFiles: newUnsupported, singleRootDir } = await processZipFile(zipArrayBuffer);
      
      setProcessedZipFileSystem(newFs);
      setUnsupportedFiles(newUnsupported);

      if (newUnsupported.length > 0) {
        setZipProcessingStep('confirmUnsupported');
      } else {
        setZipProcessingStep('confirmOverwrite');
      }
    } catch (error) {
      console.error(`Error processing ${source} ZIP:`, error);
      toast({ variant: "destructive", title: `${source} Import Failed`, description: `Could not process the ZIP file. Error: ${(error as Error).message}` });
      setZipProcessingStep('idle');
    } finally {
      setIsProcessingZip(false);
      if (source === 'GitHub') setIsFetchingGitHub(false);
    }
  };

  const handleGitHubImport = async () => {
    const rawUrl = githubUrlInput.trim();
    if (!rawUrl) {
      toast({ variant: "destructive", title: "Error", description: "GitHub URL cannot be empty." });
      return;
    }

    let targetZipUrl = rawUrl;
    let isTransformedUrl = false;

    if (!rawUrl.endsWith('.zip')) {
      try {
        const parsedUrl = new URL(rawUrl); // This can throw if rawUrl is not a valid URL structure
        if (parsedUrl.hostname === 'github.com') {
          const pathSegments = parsedUrl.pathname.split('/').filter(Boolean); // Filter out empty strings from leading/trailing slashes
          if (pathSegments.length >= 2) {
            const user = pathSegments[0];
            let repo = pathSegments[1];
            // Remove .git suffix from repo name if present
            if (repo.endsWith('.git')) {
              repo = repo.substring(0, repo.length - 4);
            }
            targetZipUrl = `https://github.com/${user}/${repo}/archive/refs/heads/main.zip`;
            isTransformedUrl = true;
            toast({ 
              title: "Transforming URL", 
              description: `Attempting to fetch main branch ZIP for ${user}/${repo}` 
            });
          } else {
            throw new Error("Invalid GitHub repository URL format. Expected format like https://github.com/user/repo.");
          }
        } else {
          throw new Error("URL is not a direct .zip link or a standard github.com repository URL.");
        }
      } catch (e: any) {
        toast({ 
          variant: "destructive", 
          title: "Invalid URL", 
          description: e.message || "Could not parse the GitHub URL. Please provide a direct .zip link or a standard GitHub repository URL." 
        });
        setIsFetchingGitHub(false);
        return;
      }
    }

    setIsFetchingGitHub(true);
    toast({ title: "Fetching from GitHub...", description: `Downloading from ${targetZipUrl}` });
    
    try {
      const response = await fetch(targetZipUrl); // This is line 142 from the error
      if (!response.ok) {
        let errorDetail = `Failed to fetch ZIP: ${response.status} ${response.statusText}.`;
        if (isTransformedUrl && response.status === 404) {
          errorDetail += " This might mean the 'main' branch doesn't exist or the repository is private/incorrect. Try a direct .zip link for a specific branch or ensure the repository is public and 'main' is the default branch.";
        } else if (!isTransformedUrl) {
           errorDetail += " Ensure the URL is a direct download link to a .zip file and is publicly accessible.";
        }
        throw new Error(errorDetail);
      }
      const zipArrayBuffer = await response.arrayBuffer();
      await processAndReplaceWorkspace(zipArrayBuffer, 'GitHub');
    } catch (error: any) {
      console.error("Failed to fetch or process GitHub ZIP:", error);
      let descriptionToast = "An unexpected error occurred during GitHub import.";

      if (error.message.startsWith("Failed to fetch ZIP:")) { // My custom error for HTTP issues
        descriptionToast = error.message; // Contains status and text from response
      } else if (error.message.toLowerCase().includes("failed to fetch")) { // Generic browser fetch failure (network, CORS, etc.)
        descriptionToast = `The browser could not fetch the URL. This might be due to:
- Network connectivity issues.
- The URL being incorrect or inaccessible (${targetZipUrl}).
- Browser security (CORS) preventing the request.
- If you entered a repository URL, the default branch might not be 'main'.
Please verify the URL. Using a direct '.zip' download link from GitHub is often the most reliable.`;
      } else if (error.message) { // Other errors, e.g., from URL parsing, ZIP processing
        descriptionToast = `Error processing the data: ${error.message}`;
      }
      
      toast({ 
        variant: "destructive", 
        title: "GitHub Import Failed", 
        description: descriptionToast,
        duration: 9000, // Increased duration for more complex error messages
      });
      setIsFetchingGitHub(false);
    }
  };

  const handleZipFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === "application/zip") {
      setSelectedZipFile(file);
      setZipProcessingStep('idle'); 
      setUnsupportedFiles([]);
      setProcessedZipFileSystem(null);
    } else if (file) {
      toast({ variant: "destructive", title: "Invalid File", description: "Please select a .zip file." });
      setSelectedZipFile(null);
    }
    event.target.value = ''; 
  };

  const handleProcessZipUpload = async () => {
    if (!selectedZipFile) return;
    await processAndReplaceWorkspace(await selectedZipFile.arrayBuffer(), 'Upload');
  };
  
  const completeWorkspaceReplacement = () => {
    if (processedZipFileSystem) {
      replaceWorkspace(processedZipFileSystem);
      toast({ title: "Workspace Imported", description: "The new workspace has been loaded." });
      onClose();
    }
  };

  const resetZipUploadFlow = () => {
    setSelectedZipFile(null);
    setUnsupportedFiles([]);
    setProcessedZipFileSystem(null);
    setZipProcessingStep('idle');
    setIsProcessingZip(false);
  }


  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md md:max-w-lg lg:max-w-xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl">Manage Workspace</DialogTitle>
          <DialogDescription>
            Download your current workspace or import a new one. Importing will replace your current workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 pr-2 py-2">
          {/* Download Section */}
          <section>
            <h3 className="text-md font-semibold mb-2 flex items-center"><Download className="mr-2 h-4 w-4 text-primary" />Download Current Workspace</h3>
            <div className="flex items-center gap-2">
              <Label htmlFor="projectNameDownload" className="sr-only">Project Name</Label>
              <Input
                ref={downloadInputRef}
                id="projectNameDownload"
                value={downloadProjectName}
                onChange={(e) => setDownloadProjectName(e.target.value)}
                className="flex-grow"
                onKeyDown={(e) => { if (e.key === 'Enter') handleDownload(); }}
                placeholder="Project Name"
              />
              <Button onClick={handleDownload} disabled={!downloadProjectName.trim()}>
                Download ZIP
              </Button>
            </div>
          </section>

          <Separator />

          {/* GitHub Import Section */}
          <section>
            <h3 className="text-md font-semibold mb-2 flex items-center"><Github className="mr-2 h-4 w-4 text-primary" />Import from GitHub</h3>
             <p className="text-xs text-muted-foreground mb-1">
              Enter a GitHub repository URL (e.g., <code className="bg-muted px-1 py-0.5 rounded text-xs">https://github.com/user/repo</code>) 
              or a direct <code className="bg-muted px-1 py-0.5 rounded text-xs">.zip</code> download link.
            </p>
             <p className="text-xs text-muted-foreground mb-2">
              If a repository URL is provided, we'll attempt to download the <code className="bg-muted px-1 py-0.5 rounded text-xs">main</code> branch ZIP.
            </p>
            <div className="flex items-center gap-2">
              <Label htmlFor="githubUrl" className="sr-only">GitHub Repository or ZIP URL</Label>
              <Input
                id="githubUrl"
                value={githubUrlInput}
                onChange={(e) => setGithubUrlInput(e.target.value)}
                className="flex-grow"
                placeholder="GitHub Repo URL or direct .zip link"
                disabled={isFetchingGitHub || isProcessingZip}
              />
              <Button onClick={handleGitHubImport} disabled={!githubUrlInput.trim() || isFetchingGitHub || isProcessingZip}>
                {isFetchingGitHub ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Fetch & Process
              </Button>
            </div>
          </section>
          
          <Separator />

          {/* ZIP Upload Section */}
          <section>
            <h3 className="text-md font-semibold mb-2 flex items-center"><UploadCloud className="mr-2 h-4 w-4 text-primary" />Upload ZIP & Replace Workspace</h3>
            <div className="flex items-center gap-2">
              <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="flex-shrink-0" disabled={isProcessingZip || isFetchingGitHub}>
                {selectedZipFile ? `Selected: ${selectedZipFile.name}` : "Select .zip File"}
              </Button>
              <input
                type="file"
                ref={fileInputRef}
                accept=".zip"
                onChange={handleZipFileSelect}
                className="hidden"
                disabled={isProcessingZip || isFetchingGitHub}
              />
              <Button onClick={handleProcessZipUpload} disabled={!selectedZipFile || isProcessingZip || isFetchingGitHub}>
                {isProcessingZip && zipProcessingStep === 'idle' && !isFetchingGitHub ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Process ZIP
              </Button>
            </div>
          </section>
        </div>
        
        <DialogFooter className="mt-auto pt-4 border-t">
          <Button type="button" variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>

      {/* Alert Dialog for Unsupported Files Confirmation */}
      <AlertDialog open={zipProcessingStep === 'confirmUnsupported'} onOpenChange={(open) => !open && resetZipUploadFlow()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center"><FileWarning className="mr-2 h-5 w-5 text-yellow-500" />Unsupported Files Found</AlertDialogTitle>
            <AlertDialogDescription>
              The following files in the ZIP are not supported or could not be read and will be excluded if you proceed:
              <ScrollArea className="max-h-32 mt-2 border rounded-md p-2">
                <ul className="list-disc list-inside text-xs">
                  {unsupportedFiles.map(f => <li key={f}>{f}</li>)}
                </ul>
              </ScrollArea>
              Do you want to import the workspace excluding these files?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={resetZipUploadFlow}>Cancel Import</AlertDialogCancel>
            <AlertDialogAction onClick={() => setZipProcessingStep('confirmOverwrite')}>Proceed Excluding Files</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Alert Dialog for Workspace Overwrite Confirmation */}
      <AlertDialog open={zipProcessingStep === 'confirmOverwrite'} onOpenChange={(open) => !open && resetZipUploadFlow()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center"><AlertTriangle className="mr-2 h-5 w-5 text-destructive" />Confirm Workspace Replacement</AlertDialogTitle>
            <AlertDialogDescription>
              This will replace your entire current workspace. This action cannot be undone.
              Are you sure you want to proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={resetZipUploadFlow}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={completeWorkspaceReplacement} className="bg-destructive hover:bg-destructive/90">
              Yes, Replace Workspace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </Dialog>
  );
}
