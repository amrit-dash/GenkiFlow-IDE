
"use client";
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface DownloadProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitProjectName: (projectName: string) => void;
}

export function DownloadProjectModal({ isOpen, onClose, onSubmitProjectName }: DownloadProjectModalProps) {
  const [projectName, setProjectName] = useState("MyGenkiFlowProject");
  const inputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Focus the input when the dialog opens
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 100); // Timeout helps ensure the element is in the DOM and visible
    }
  }, [isOpen]);

  const handleSubmit = () => {
    if (projectName.trim()) {
      onSubmitProjectName(projectName.trim());
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Download Workspace</DialogTitle>
          <DialogDescription>
            Enter a name for your project. This will be used as the name of the downloaded ZIP file.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="projectName" className="text-right">
              Project Name
            </Label>
            <Input
              ref={inputRef}
              id="projectName"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="col-span-3"
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" onClick={handleSubmit} disabled={!projectName.trim()}>Download</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
