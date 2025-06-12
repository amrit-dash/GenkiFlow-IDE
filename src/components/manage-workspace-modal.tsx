
"use client";
import React, { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, UploadCloud, Loader2, AlertTriangle, FileWarning, Settings2, RotateCcwIcon, FileArchive, FileUp, Cog, Palette } from 'lucide-react';
import { useIde } from '@/contexts/ide-context';
import { useToast } from '@/hooks/use-toast';
import { downloadWorkspaceAsZip, processZipFile } from '@/lib/workspace-utils';
import type { FileSystemNode } from '@/lib/types';
import { mockFileSystem } from '@/lib/mock-data';
import { cn } from '@/lib/utils';

interface ManageWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ProcessingStep = 'idle' | 'confirmUnsupported' | 'confirmOverwrite' | 'confirmReset';

const ACCENT_COLOR_PALETTE = [
  { name: 'Default Purple', value: '270 70% 55%', cssColor: 'hsl(270, 70%, 55%)' },
  { name: 'Vibrant Blue', value: '210 70% 55%', cssColor: 'hsl(210, 70%, 55%)' },
  // { name: 'Forest Green', value: '145 60% 45%', cssColor: 'hsl(145, 60%, 45%)' }, // Removed
  { name: 'Sunset Orange', value: '30 80% 55%', cssColor: 'hsl(30, 80%, 55%)' },
  // { name: 'Ruby Red', value: '0 70% 50%', cssColor: 'hsl(0, 70%, 50%)' }, // Removed
  { name: 'Hot Pink', value: '330 80% 60%', cssColor: 'hsl(330, 80%, 60%)' },
  { name: 'Teal Aqua', value: '180 60% 45%', cssColor: 'hsl(180, 60%, 45%)' },
];


export function ManageWorkspaceModal({ isOpen, onClose }: ManageWorkspaceModalProps) {
  const { fileSystem, replaceWorkspace, accentColor, setAccentColor } = useIde();
  const { toast } = useToast();

  const [downloadProjectName, setDownloadProjectName] = useState("MyGenkiFlowProject");
  const downloadInputRef = useRef<HTMLInputElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedZipFile, setSelectedZipFile] = useState<File | null>(null);
  const [isProcessingZip, setIsProcessingZip] = useState(false);
  const [unsupportedFiles, setUnsupportedFiles] = useState<string[]>([]);
  const [processedZipFileSystem, setProcessedZipFileSystem] = useState<FileSystemNode[] | null>(null);
  const [zipProcessingStep, setZipProcessingStep] = useState<ProcessingStep>('idle');
  
  useEffect(() => {
    if (isOpen) {
      setDownloadProjectName("MyGenkiFlowProject");
      setSelectedZipFile(null);
      setIsProcessingZip(false);
      setUnsupportedFiles([]);
      setProcessedZipFileSystem(null);
      setZipProcessingStep('idle');
      // Don't focus download input immediately to allow accent color selection first
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

  const processAndPrepareWorkspaceImport = async (zipArrayBuffer: ArrayBuffer, source: 'Upload') => {
    setIsProcessingZip(true); 
    try {
      const { fileSystem: newFs, unsupportedFiles: newUnsupported } = await processZipFile(zipArrayBuffer);
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
    await processAndPrepareWorkspaceImport(await selectedZipFile.arrayBuffer(), 'Upload');
  };
  
  const completeWorkspaceReplacement = () => {
    if (processedZipFileSystem) {
      replaceWorkspace(processedZipFileSystem, null); 
      toast({ title: "Workspace Imported", description: "The new workspace has been loaded." });
      onClose();
    }
  };

  const handleResetWorkspace = () => {
    setZipProcessingStep('confirmReset'); 
  };

  const confirmAndExecuteReset = () => {
    replaceWorkspace(mockFileSystem, null); 
    toast({title: "Workspace Reset", description: "Workspace has been reset to default."});
    onClose();
  };

  const resetModalFlows = () => {
    setSelectedZipFile(null);
    setUnsupportedFiles([]);
    setProcessedZipFileSystem(null);
    setZipProcessingStep('idle');
    setIsProcessingZip(false);
  }

  const handleAccentColorChange = (newColorHsl: string) => {
    setAccentColor(newColorHsl);
    toast({ title: "Accent Color Updated", description: "The UI accent color has been changed." });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) { onClose(); resetModalFlows(); } }}>
      <DialogContent className="sm:max-w-lg md:max-w-xl lg:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center">
            <Settings2 className="mr-2 h-5 w-5 text-primary" />
            Manage Workspace
          </DialogTitle>
          <DialogDescription>
            Customize your IDE appearance, download/upload your workspace, or reset to default.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-grow pr-2 -mr-2"> {/* Added ScrollArea for content */}
          <div className="space-y-6 py-1">
            {/* Accent Color Section */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-md font-semibold flex items-center">
                  <Palette className="mr-2 h-4 w-4 text-primary" />
                  Change Accent Color
                </h3>
                <div className="flex flex-row gap-2">
                  {ACCENT_COLOR_PALETTE.map((color) => (
                    <Button
                      key={color.name}
                      variant="outline"
                      size="icon"
                      className={cn(
                        "h-10 w-10 rounded-full border-2 transition-all duration-150 ease-in-out", // Changed to rounded-full
                        accentColor === color.value 
                          ? 'ring-2 ring-offset-2 ring-offset-background ring-foreground dark:ring-background'
                          : 'hover:scale-110'
                      )}
                      style={{ backgroundColor: color.cssColor }}
                      onClick={() => handleAccentColorChange(color.value)}
                      title={color.name}
                    >
                      {accentColor === color.value && (
                        <span className="text-xs font-bold" style={{ color: parseInt(color.value.split(' ')[2]) > 50 ? 'black' : 'white' }}>✓</span>
                      )}
                      <span className="sr-only">{color.name}</span>
                    </Button>
                  ))}
                </div>
              </div>
            </section>

            <Separator />

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
                  <FileArchive className="mr-2 h-4 w-4" />
                  Download ZIP
                </Button>
              </div>
            </section>

            <Separator />
            
            {/* ZIP Upload Section */}
            <section>
              <h3 className="text-md font-semibold mb-2 flex items-center"><UploadCloud className="mr-2 h-4 w-4 text-primary" />Upload ZIP & Replace Workspace</h3>
              <p className="text-xs text-muted-foreground mb-2">
                Select a .zip file containing your project. Unsupported file types will be excluded.
              </p>
              <div className="flex items-center gap-2">
                <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="flex-shrink-0" disabled={isProcessingZip}>
                  <FileUp className="mr-2 h-4 w-4" />
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
                  {isProcessingZip && zipProcessingStep === 'idle' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Cog className="mr-2 h-4 w-4" />}
                  Process ZIP
                </Button>
              </div>
            </section>

            <Separator />

            {/* Reset Workspace Section */}
            <section>
              <h3 className="text-md font-semibold mb-2 flex items-center"><RotateCcwIcon className="mr-2 h-4 w-4 text-primary" />Reset Workspace</h3>
              <div className="flex items-center gap-4">
                <Button onClick={handleResetWorkspace} variant="destructive" disabled={isProcessingZip}>
                  Reset to Default
                </Button>
                <p className="text-xs text-muted-foreground">
                  This will clear all your current files and data, and restore the default example workspace. This action cannot be undone.
                </p>
              </div>
            </section>
          </div>
        </ScrollArea>
        
        <DialogFooter className="mt-auto pt-4 border-t">
          <Button type="button" variant="outline" onClick={() => { onClose(); resetModalFlows(); }}>Close</Button>
        </DialogFooter>
      </DialogContent>

      {/* Alert Dialog for Unsupported Files Confirmation */}
      <AlertDialog open={zipProcessingStep === 'confirmUnsupported'}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center"><FileWarning className="mr-2 h-5 w-5 text-yellow-500" />Unsupported Files Found</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p>
                  The following files in the ZIP are not supported or could not be read and will be excluded if you proceed:
                </p>
                <ScrollArea className="h-32 mt-2 border rounded-md p-2">
                  <ul className="list-disc list-inside text-xs">
                    {unsupportedFiles.map(f => <li key={f}>{f}</li>)}
                  </ul>
                </ScrollArea>
                <p className="mt-2">
                  Do you want to import the workspace excluding these files?
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={resetModalFlows}>Cancel Import</AlertDialogCancel>
            <AlertDialogAction onClick={() => setZipProcessingStep('confirmOverwrite')}>Proceed Excluding Files</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Alert Dialog for Workspace Overwrite Confirmation (from ZIP) */}
      <AlertDialog open={zipProcessingStep === 'confirmOverwrite'}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center"><AlertTriangle className="mr-2 h-5 w-5 text-destructive" />Confirm Workspace Replacement</AlertDialogTitle>
            <AlertDialogDescription>
              This will replace your entire current workspace with the contents of the ZIP file. This action cannot be undone.
              Are you sure you want to proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={resetModalFlows}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={completeWorkspaceReplacement} className="bg-destructive hover:bg-destructive/90">
              Yes, Replace Workspace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Alert Dialog for Reset Workspace Confirmation */}
      <AlertDialog open={zipProcessingStep === 'confirmReset'}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center"><AlertTriangle className="mr-2 h-5 w-5 text-destructive" />Confirm Workspace Reset</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all files and data in your current workspace and restore the default example project. This action cannot be undone.
              Are you sure you want to reset?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={resetModalFlows}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAndExecuteReset} className="bg-destructive hover:bg-destructive/90">
              Yes, Reset Workspace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </Dialog>
  );
}

