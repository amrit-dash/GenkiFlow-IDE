
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
  const [githubZipUrl, setGithubZipUrl] = useState("");
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
      setGithubZipUrl("");
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
    setIsFetchingGitHub(source === 'GitHub'); 

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
      setIsFetchingGitHub(false);
    }
  };

  const handleGitHubImport = async () => {
    if (!githubZipUrl.trim()) {
      toast({ variant: "destructive", title: "Error", description: "GitHub ZIP URL cannot be empty." });
      return;
    }
    setIsFetchingGitHub(true);
    toast({ title: "Fetching from GitHub...", description: "Downloading repository ZIP." });
    try {
      const response = await fetch(githubZipUrl.trim());
      if (!response.ok) {
        throw new Error(`Failed to fetch ZIP: ${response.status} ${response.statusText}. Ensure the URL is a direct download link to a .zip file and is publicly accessible.`);
      }
      const zipArrayBuffer = await response.arrayBuffer();
      await processAndReplaceWorkspace(zipArrayBuffer, 'GitHub');
    } catch (error: any) {
      console.error("Failed to fetch or process GitHub ZIP:", error);
      let description = "Could not fetch or process the repository ZIP. Please check the URL and your network connection.";
      if (error.message.includes("Failed to fetch")) {
        description = "Failed to fetch the ZIP. This might be due to network issues, an incorrect URL, or CORS restrictions. Ensure you're using a direct .zip download link from a public repository.";
      } else if (error.message) {
        description = error.message;
      }
      toast({ 
        variant: "destructive", 
        title: "GitHub Import Failed", 
        description: description
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
              Paste the direct <code className="bg-muted px-1 py-0.5 rounded text-xs">.zip</code> download URL from a GitHub repository.
            </p>
             <p className="text-xs text-muted-foreground mb-2">
              Example: <code className="bg-muted px-1 py-0.5 rounded text-xs">https://github.com/&lt;user&gt;/&lt;repo&gt;/archive/refs/heads/main.zip</code>
            </p>
            <div className="flex items-center gap-2">
              <Label htmlFor="githubUrl" className="sr-only">GitHub ZIP URL</Label>
              <Input
                id="githubUrl"
                value={githubZipUrl}
                onChange={(e) => setGithubZipUrl(e.target.value)}
                className="flex-grow"
                placeholder="Direct .zip download URL from GitHub"
                disabled={isFetchingGitHub || isProcessingZip}
              />
              <Button onClick={handleGitHubImport} disabled={!githubZipUrl.trim() || isFetchingGitHub || isProcessingZip}>
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
              <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="flex-shrink-0" disabled={isProcessingZip}>
                {selectedZipFile ? `Selected: ${selectedZipFile.name}` : "Select .zip File"}
              </Button>
              <input
                type="file"
                ref={fileInputRef}
                accept=".zip"
                onChange={handleZipFileSelect}
                className="hidden"
                disabled={isProcessingZip}
              />
              <Button onClick={handleProcessZipUpload} disabled={!selectedZipFile || isProcessingZip}>
                {isProcessingZip && zipProcessingStep === 'idle' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
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
