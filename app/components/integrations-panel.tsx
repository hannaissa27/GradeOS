'use client';

import React, { useState, useEffect } from 'react';
import { useCanvas } from '@/lib/canvas-context';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Settings2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ExternalLink,
  Database,
  Bot,
  Unplug,
  Copy,
  Check,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface IntegrationsPanelProps {
  trigger?: React.ReactNode;
}

export function IntegrationsPanel({ trigger }: IntegrationsPanelProps) {
  const { isConnected, connection, disconnect } = useCanvas();
  const [aiKey, setAiKey] = useState('');
  const [aiKeySet, setAiKeySet] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const [supabaseStatus, setSupabaseStatus] = useState<'checking' | 'ok' | 'error'>('checking');
  const [canvasStatus, setCanvasStatus] = useState<'checking' | 'ok' | 'error'>('checking');
  const [aiStatus, setAiStatus] = useState<'checking' | 'ok' | 'error' | 'not_set'>('not_set');
  const [step, setStep] = useState(1); // which step of the guide the user is on

  useEffect(() => {
    if (open) {
      const existingKey = localStorage.getItem('gradeos-ai-key');
      if (existingKey) {
        setAiKeySet(true);
        setAiStatus('ok');
      }
      runStatusChecks();
    }
  }, [open]);

  const runStatusChecks = async () => {
    setSupabaseStatus('checking');
    setCanvasStatus('checking');

    try {
      const supabase = createClient();
      const { error } = await supabase.from('todos').select('id').limit(1);
      setSupabaseStatus(error ? 'error' : 'ok');
    } catch {
      setSupabaseStatus('error');
    }

    if (isConnected) {
      setCanvasStatus('ok');
    } else {
      setCanvasStatus('error');
    }
  };

  const handleSaveAiKey = () => {
    if (!aiKey.trim()) return;
    setSaving(true);
    localStorage.setItem('gradeos-ai-key', aiKey.trim());
    setAiKeySet(true);
    setAiKey('');
    setAiStatus('ok');
    setSaving(false);
  };

  const handleRemoveAiKey = () => {
    localStorage.removeItem('gradeos-ai-key');
    setAiKeySet(false);
    setAiStatus('not_set');
    setStep(1);
  };

  const StatusDot = ({ status }: { status: 'checking' | 'ok' | 'error' | 'not_set' }) => {
    if (status === 'ok') return <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />;
    if (status === 'error') return <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />;
    if (status === 'not_set') return <span className="w-2 h-2 rounded-full bg-muted-foreground/40 inline-block" />;
    return <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse inline-block" />;
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger || (
          <button className="p-1.5 rounded hover:bg-accent transition-colors cursor-pointer text-muted-foreground hover:text-foreground">
            <Settings2 className="w-4 h-4" />
          </button>
        )}
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Settings & Integrations</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">

          {/* Canvas */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <StatusDot status={canvasStatus} />
              <h3 className="text-sm font-medium">Canvas LMS</h3>
            </div>
            {isConnected ? (
              <div className="space-y-2 pl-4">
                <p className="text-xs text-muted-foreground">Connected as <span className="text-foreground font-medium">{connection.userName}</span></p>
                <button
                  onClick={disconnect}
                  className="text-xs text-red-500 hover:text-red-600 cursor-pointer underline"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground pl-4">Not connected. Use the Connect button in the nav bar.</p>
            )}
          </section>

          <div className="border-t border-border" />

          {/* AI Features */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <StatusDot status={aiStatus} />
              <h3 className="text-sm font-medium">AI Features</h3>
              {aiKeySet && (
                <span className="text-xs text-green-500 font-medium ml-auto">Active</span>
              )}
            </div>

            <div className="pl-4 space-y-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                AI features use <strong>Claude</strong> (by Anthropic) to analyze your assignments, generate practice questions, and break down your work. Each user needs their own free API key — your key is stored only in your browser and never sent to GradeOS servers.
              </p>

              {aiKeySet ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs text-green-500">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>AI features are active</span>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p className="font-medium text-foreground mb-2">Unlocked features:</p>
                    <p>• Assignment Chunker — breaks any assignment into steps</p>
                    <p>• Syllabus Spy — extracts all dates from your syllabus</p>
                    <p>• Exam Brain — finds your weakest topics before exams</p>
                  </div>
                  <button
                    onClick={handleRemoveAiKey}
                    className="text-xs text-red-500 hover:text-red-600 cursor-pointer underline"
                  >
                    Remove API key
                  </button>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Step by step guide */}
                  <div className="space-y-4">
                    <p className="text-xs font-medium text-foreground">How to get your free API key:</p>

                    {/* Step 1 */}
                    <div className={`space-y-2 rounded-lg p-3 border transition-colors ${step >= 1 ? 'border-primary/30 bg-primary/5' : 'border-border'}`}>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${step >= 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>1</span>
                        <p className="text-xs font-medium">Create a free Anthropic account</p>
                      </div>
                      <p className="text-xs text-muted-foreground pl-7">
                        Go to console.anthropic.com and sign up. It's free — no credit card needed to start. You get $5 of free credit which is enough for thousands of AI uses.
                      </p>
                      <div className="pl-7">
                        <a
                          href="https://console.anthropic.com/login"
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setStep(2)}
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline cursor-pointer font-medium"
                        >
                          Open Anthropic Console <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>

                    {/* Step 2 */}
                    <div className={`space-y-2 rounded-lg p-3 border transition-colors ${step >= 2 ? 'border-primary/30 bg-primary/5' : 'border-border opacity-60'}`}>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${step >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>2</span>
                        <p className="text-xs font-medium">Create an API key</p>
                      </div>
                      <p className="text-xs text-muted-foreground pl-7">
                        Once logged in, click <strong>API Keys</strong> in the left sidebar, then click <strong>Create Key</strong>. Name it anything (e.g. "GradeOS"). Copy the key — it starts with <code className="bg-muted px-1 rounded text-[10px]">sk-ant-</code>
                      </p>
                      {step >= 2 && (
                        <div className="pl-7">
                          <a
                            href="https://console.anthropic.com/settings/keys"
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => setStep(3)}
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline cursor-pointer font-medium"
                          >
                            Go to API Keys <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Step 3 */}
                    <div className={`space-y-2 rounded-lg p-3 border transition-colors ${step >= 3 ? 'border-primary/30 bg-primary/5' : 'border-border opacity-60'}`}>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${step >= 3 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>3</span>
                        <p className="text-xs font-medium">Paste your key here</p>
                      </div>
                      {step >= 3 ? (
                        <div className="pl-7 space-y-2">
                          <Input
                            type="password"
                            placeholder="sk-ant-api03-..."
                            value={aiKey}
                            onChange={(e) => setAiKey(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveAiKey()}
                            className="text-xs h-8"
                            autoFocus
                          />
                          <button
                            onClick={handleSaveAiKey}
                            disabled={!aiKey.trim() || saving}
                            className="text-xs px-3 py-1.5 rounded bg-primary text-primary-foreground cursor-pointer hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                          >
                            {saving ? 'Saving...' : 'Activate AI Features'}
                          </button>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground pl-7">Paste your key here once you have it.</p>
                      )}
                    </div>
                  </div>

                  {/* Manual step bypass */}
                  {step < 3 && (
                    <button
                      onClick={() => setStep(3)}
                      className="text-xs text-muted-foreground hover:text-foreground cursor-pointer underline"
                    >
                      Already have a key? Skip to step 3
                    </button>
                  )}
                </div>
              )}
            </div>
          </section>

          <div className="border-t border-border" />

          {/* System status */}
          <section className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">System Status</h3>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Canvas API</span>
                <div className="flex items-center gap-1.5">
                  <StatusDot status={canvasStatus} />
                  <span>{canvasStatus === 'ok' ? 'Connected' : 'Not connected'}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Database (Supabase)</span>
                <div className="flex items-center gap-1.5">
                  <StatusDot status={supabaseStatus} />
                  <span>{supabaseStatus === 'ok' ? 'Connected' : supabaseStatus === 'checking' ? 'Checking...' : 'Error — run SQL setup'}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">AI Features</span>
                <div className="flex items-center gap-1.5">
                  <StatusDot status={aiStatus} />
                  <span>{aiStatus === 'ok' ? 'Active' : 'No key set'}</span>
                </div>
              </div>
            </div>
            {supabaseStatus === 'error' && (
              <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded p-2">
                Database not set up. Go to Supabase → SQL Editor and run the contents of <code className="bg-muted px-1 rounded">scripts/001_create_tables.sql</code> to enable Todos and Schedule features.
              </p>
            )}
          </section>

        </div>
      </SheetContent>
    </Sheet>
  );
}
