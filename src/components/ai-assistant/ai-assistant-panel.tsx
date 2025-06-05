
"use client";

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Sparkles, Wand2, TextQuote, SearchCode, Replace, Send, Loader2 } from 'lucide-react';
import { useIde } from '@/contexts/ide-context';
import { summarizeCodeSnippetServer, generateCodeServer, refactorCodeServer, findExamplesServer } from '@/app/(ide)/actions';
import type { AiSuggestion } from '@/lib/types';

export function AiAssistantPanel() {
  const { activeFilePath, openedFiles, updateFileContent } = useIde();
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeAccordion, setActiveAccordion] = useState<string | undefined>(undefined);

  // State for each AI feature's output
  const [summary, setSummary] = useState<string | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [refactorSuggestions, setRefactorSuggestions] = useState<AiSuggestion[] | null>(null);
  const [codeExamples, setCodeExamples] = useState<string[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const currentCode = activeFilePath && openedFiles.get(activeFilePath)?.content;

  const handleSummarize = async () => {
    if (!currentCode) {
      setErrorMessage("No active file or content to summarize.");
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const result = await summarizeCodeSnippetServer({ codeSnippet: currentCode });
      setSummary(result.summary);
      setActiveAccordion("summarize");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to summarize code.");
      setSummary(null);
    }
    setIsLoading(false);
  };

  const handleGenerateCode = async () => {
    if (!prompt) {
      setErrorMessage("Please enter a prompt to generate code.");
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const result = await generateCodeServer({ prompt });
      setGeneratedCode(result.code);
      setActiveAccordion("generate");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to generate code.");
      setGeneratedCode(null);
    }
    setIsLoading(false);
  };

  const handleRefactor = async () => {
    if (!currentCode) {
      setErrorMessage("No active file or content to refactor.");
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const result = await refactorCodeServer({ codeSnippet: currentCode, fileContext: `File: ${activeFilePath}\n\n${currentCode}` });
      setRefactorSuggestions(result.suggestions);
      setActiveAccordion("refactor");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to get refactoring suggestions.");
      setRefactorSuggestions(null);
    }
    setIsLoading(false);
  };
  
  const handleFindExamples = async () => {
    if (!prompt) {
      setErrorMessage("Please enter a query to find examples.");
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const result = await findExamplesServer({ query: prompt });
      setCodeExamples(result.examples);
      setActiveAccordion("examples");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to find examples.");
      setCodeExamples(null);
    }
    setIsLoading(false);
  };

  const handleApplySuggestion = (suggestedCode: string) => {
    if (activeFilePath) {
      updateFileContent(activeFilePath, suggestedCode);
      // Maybe add a toast notification
    }
  };

  const FeatureCard: React.FC<{ title: string; icon: React.ElementType; children: React.ReactNode; action?: () => void; actionLabel?: string; requiresCode?: boolean }> = 
    ({ title, icon: Icon, children, action, actionLabel, requiresCode = false }) => (
    <Card className="bg-card/50 w-full"> {/* Ensure card takes full width of trigger */}
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="w-5 h-5 text-primary" />
            <CardTitle className="text-base font-semibold">{title}</CardTitle>
          </div>
          {action && actionLabel && (
            <Button
              asChild
              size="sm"
              onClick={(e: React.MouseEvent<HTMLDivElement>) => {
                // Prevent the click from toggling the accordion
                e.stopPropagation();
                if (action) {
                  action();
                }
              }}
              disabled={isLoading || (requiresCode && !currentCode)}
            >
              <div
                role="button"
                tabIndex={isLoading || (requiresCode && !currentCode) ? -1 : 0}
                onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
                  if (!(isLoading || (requiresCode && !currentCode))) {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      if (action) {
                        action();
                      }
                    }
                  }
                }}
                aria-disabled={isLoading || (requiresCode && !currentCode)}
              >
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                {actionLabel}
              </div>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {children}
      </CardContent>
    </Card>
  );

  return (
    <div className="w-full border-l border-border bg-sidebar flex flex-col h-full">
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-primary" />
          <h2 className="text-lg font-headline font-semibold">AI Assistant</h2>
        </div>
      </div>
      
      <ScrollArea className="flex-1 p-1">
        <div className="p-3 space-y-4">
        {errorMessage && <Card className="bg-destructive/20 border-destructive"><CardContent className="p-3 text-destructive-foreground text-sm">{errorMessage}</CardContent></Card>}
        
        <Accordion type="single" collapsible value={activeAccordion} onValueChange={setActiveAccordion}>
          <AccordionItem value="summarize">
            <AccordionTrigger className="p-0 hover:no-underline flex"> {/* Added flex to allow card to fill width */}
              <FeatureCard title="Summarize Code" icon={TextQuote} action={handleSummarize} actionLabel="Summarize" requiresCode>
                {summary && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{summary}</p>}
                {!summary && !isLoading && <p className="text-sm text-muted-foreground">Summarize the code in the active editor tab.</p>}
              </FeatureCard>
            </AccordionTrigger>
            <AccordionContent className="p-2">
              {summary && <p className="text-sm text-foreground whitespace-pre-wrap bg-card p-2 rounded-md">{summary}</p>}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="generate">
             <AccordionTrigger className="p-0 hover:no-underline flex">
              <FeatureCard title="Generate Code" icon={Wand2}>
                 {!generatedCode && <p className="text-sm text-muted-foreground">Generate new code based on your prompt below.</p>}
                 {generatedCode && <p className="text-sm text-muted-foreground">Generated code based on your prompt. Displayed below.</p>}
              </FeatureCard>
            </AccordionTrigger>
            <AccordionContent className="p-2">
              {generatedCode && (
                <div className="space-y-2">
                  <pre className="text-sm bg-card p-2 rounded-md overflow-x-auto whitespace-pre-wrap max-h-60"><code>{generatedCode}</code></pre>
                  <Button size="sm" variant="outline" onClick={() => handleApplySuggestion(generatedCode)}>Insert into Editor</Button>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="refactor">
             <AccordionTrigger className="p-0 hover:no-underline flex">
              <FeatureCard title="Refactor Code" icon={Replace} action={handleRefactor} actionLabel="Suggest" requiresCode>
                {!refactorSuggestions && <p className="text-sm text-muted-foreground">Get refactoring suggestions for the active code.</p>}
                {refactorSuggestions && <p className="text-sm text-muted-foreground">{refactorSuggestions.length} suggestion(s) found. Displayed below.</p>}
              </FeatureCard>
            </AccordionTrigger>
            <AccordionContent className="p-2 space-y-3">
              {refactorSuggestions?.map((s, i) => (
                <Card key={i} className="bg-card">
                  <CardHeader className="p-3">
                    <CardDescription>{s.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <pre className="text-xs bg-muted p-2 rounded-md overflow-x-auto max-h-40 whitespace-pre-wrap"><code>{s.proposedCode}</code></pre>
                    <Button size="xs" variant="outline" className="mt-2" onClick={() => handleApplySuggestion(s.proposedCode)}>Apply</Button>
                  </CardContent>
                </Card>
              ))}
            </AccordionContent>
          </AccordionItem>
          
          <AccordionItem value="examples">
             <AccordionTrigger className="p-0 hover:no-underline flex">
              <FeatureCard title="Find Code Examples" icon={SearchCode}>
                {!codeExamples && <p className="text-sm text-muted-foreground">Find examples related to your query from the codebase.</p>}
                {codeExamples && <p className="text-sm text-muted-foreground">{codeExamples.length} example(s) found. Displayed below.</p>}
              </FeatureCard>
            </AccordionTrigger>
            <AccordionContent className="p-2 space-y-2">
              {codeExamples?.map((ex, i) => (
                <pre key={i} className="text-xs bg-card p-2 rounded-md overflow-x-auto max-h-40 whitespace-pre-wrap"><code>{ex}</code></pre>
              ))}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        </div>
      </ScrollArea>

      <div className="p-4 border-t border-sidebar-border mt-auto">
        <div className="relative">
          <Textarea
            placeholder="Type your prompt here or select a feature..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="pr-20 min-h-[80px] bg-input"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (prompt.toLowerCase().includes("generate") || prompt.toLowerCase().includes("create")) handleGenerateCode();
                else if (prompt.toLowerCase().includes("find") || prompt.toLowerCase().includes("example")) handleFindExamples();
                else if (prompt.toLowerCase().includes("summarize")) handleSummarize();
                else if (prompt.toLowerCase().includes("refactor")) handleRefactor();
                // else generic prompt to AI?
              }
            }}
          />
          <Button 
            type="submit" 
            size="icon" 
            className="absolute right-3 top-1/2 -translate-y-1/2" 
            disabled={isLoading || !prompt}
            onClick={() => {
              // Heuristic for action based on prompt
              if (prompt.toLowerCase().includes("generate") || prompt.toLowerCase().includes("create")) handleGenerateCode();
              else if (prompt.toLowerCase().includes("find") || prompt.toLowerCase().includes("example")) handleFindExamples();
              else handleGenerateCode(); // Default to generate if unsure
            }}
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
