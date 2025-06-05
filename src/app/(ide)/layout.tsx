
import type React from 'react';
import { SidebarProvider } from "@/components/ui/sidebar";
import { IdeProvider } from '@/contexts/ide-context';

export default function IdeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <IdeProvider>
      <SidebarProvider defaultOpen>
        <div className="flex h-screen w-screen overflow-hidden">
          {children}
        </div>
      </SidebarProvider>
    </IdeProvider>
  );
}
