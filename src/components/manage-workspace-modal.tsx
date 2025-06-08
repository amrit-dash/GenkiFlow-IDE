
"use client";
import React, { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, UploadCloud, Loader2, AlertTriangle, FileWarning, Settings2 } from 'lucide-react';
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
      setSelectedZipFile(null);
      setIsProcessingZip(false);
      setUnsupportedFiles([]);
      setProcessedZipFileSystem(null);
      setZipProcessingStep('idle');

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

  const processAndReplaceWorkspace = async (zipArrayBuffer: ArrayBuffer, source: 'Upload') => {
    setIsProcessingZip(true); 

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
          <DialogTitle className="text-xl flex items-center">
            <Settings2 className="mr-2 h-5 w-5 text-primary" />
            Manage Workspace
          </DialogTitle>
          <DialogDescription>
            Download your current workspace or import a new one by uploading a ZIP file. Importing will replace your current workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6">
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
          
          {/* ZIP Upload Section */}
          <section>
            <h3 className="text-md font-semibold mb-2 flex items-center"><UploadCloud className="mr-2 h-4 w-4 text-primary" />Upload ZIP & Replace Workspace</h3>
            <p className="text-xs text-muted-foreground mb-2">
              Select a .zip file containing your project. Unsupported file types (e.g., images, PDFs, executables) will be excluded.
            </p>
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
              <Button onClick={handleProcessZipUpload} disabled={!selectedZipFile || isProcessingZip || zipProcessingStep !== 'idle'}>
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
