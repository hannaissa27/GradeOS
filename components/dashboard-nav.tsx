'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useCanvas } from '@/lib/canvas-context';
import { useTheme } from '@/hooks/use-theme';
import { ConnectionModal } from './connection-modal';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import {
  Sun, Moon, RefreshCw, CheckCircle2, Eye, EyeOff, CheckSquare,
  Settings, LogOut, ExternalLink, ChevronDown, ChevronUp,
  Loader2, Bot, Database, Unplug, AlertCircle, CheckCircle2 as Check,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface DashboardNavProps {
  isZenMode?: boolean;
  onToggleZenMode?: () => void;
  onSync?: () => void;
}

// ─── Settings Panel ──────────────────────────────────────────────────────────

function SettingsPanel() {
  const { isConnected, connection, disconnect } = useCanvas();
  const { theme, toggle } = useTheme();
  const [aiKey, setAiKey] = useState('');
  const [aiKeySet, setAiKeySet] = useState(() => !!localStorage.getItem('gradeos-ai-key'));
  const [aiStep, setAiStep] = useState(1);
  const [showUrlEdit, setShowUrlEdit] = useState(false);
  const [supaStatus, setSupaStatus] = useState<'idle'|'checking'|'ok'|'error'>('idle');
  const [open, setOpen] = useState(false);

  const checkSupabase = async () => {
    setSupaStatus('checking');
    try {
      const supabase = createClient();
      const { error } = await supabase.from('todos').select('id').limit(1);
      setSupaStatus(error ? 'error' : 'ok');
    } catch {
      setSupaStatus('error');
    }
  };

  const saveAiKey = () => {
    if (!aiKey.trim()) return;
    localStorage.setItem('gradeos-ai-key', aiKey.trim());
    setAiKeySet(true);
    setAiKey('');
  };

  const removeAiKey = () => {
    localStorage.removeItem('gradeos-ai-key');
    setAiKeySet(false);
    setAiStep(1);
  };

  return (
    <Sheet open={open} onOpenChange={(v) => { setOpen(v); if (v) checkSupabase(); }}>
      <SheetTrigger asChild>
        <button
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer"
          title="Settings"
        >
          <Settings className="w-4 h-4" />
          <span className="hidden sm:inline">Settings</span>
        </button>
      </SheetTrigger>

      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Settings</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">

          {/* Account */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Account</h3>
            {isConnected ? (
              <div className="rounded-xl border border-border p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm flex-shrink-0">
                    {connection.userName?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{connection.userName}</p>
                    <p className="text-xs text-muted-foreground truncate max-w-[220px]">{connection.domain}</p>
                  </div>
                  <div className="ml-auto flex items-center gap-1 text-xs text-green-500">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Connected
                  </div>
                </div>
                <button
                  onClick={() => { disconnect(); setOpen(false); }}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-destructive/30 text-red-500 text-sm hover:bg-destructive/10 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  Disconnect from Canvas
                </button>
              </div>
            ) : (
              <div className="rounded-xl border border-border p-4 text-sm text-muted-foreground">
                Not connected to Canvas.
              </div>
            )}
          </section>

          {/* Appearance */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Appearance</h3>
            <div className="rounded-xl border border-border p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Theme</p>
                <p className="text-xs text-muted-foreground">Currently {theme === 'dark' ? 'dark' : 'light'} mode</p>
              </div>
              <button
                onClick={toggle}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary text-sm cursor-pointer hover:bg-secondary/80 transition-colors"
              >
                {theme === 'light' ? <><Moon className="w-4 h-4" /> Dark</> : <><Sun className="w-4 h-4" /> Light</>}
              </button>
            </div>
          </section>

          {/* AI Features */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">AI Features</h3>
            <div className="rounded-xl border border-border p-4 space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">Anthropic API Key</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Required for First Move, Grade Autopsy, and Exam Brain. Free to get — you need your own key.
                  </p>
                </div>
                <div className={`flex items-center gap-1 text-xs flex-shrink-0 ${aiKeySet ? 'text-green-500' : 'text-muted-foreground'}`}>
                  {aiKeySet ? <><Check className="w-3.5 h-3.5" />Active</> : <><AlertCircle className="w-3.5 h-3.5" />Not set</>}
                </div>
              </div>

              {aiKeySet ? (
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
                    <p className="font-medium text-foreground mb-1">AI features unlocked:</p>
                    <p>• First Move — "How do I start?" on any assignment</p>
                    <p>• Grade Autopsy — automatic diagnosis when you bomb a test</p>
                    <p>• Syllabus Spy — extract all dates from your syllabus</p>
                  </div>
                  <button onClick={removeAiKey} className="text-xs text-red-500 hover:text-red-600 cursor-pointer underline">
                    Remove API key
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Step 1 */}
                  <div className={`rounded-lg border p-3 space-y-2 ${aiStep >= 1 ? 'border-primary/30 bg-primary/5' : 'border-border opacity-50'}`}>
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>
                      <p className="text-xs font-medium">Create a free Anthropic account</p>
                    </div>
                    <p className="text-xs text-muted-foreground pl-7">Sign up at console.anthropic.com — free, gives you $5 credit (enough for thousands of uses).</p>
                    <div className="pl-7">
                      <a href="https://console.anthropic.com/login" target="_blank" rel="noopener noreferrer"
                        onClick={() => setAiStep(2)}
                        className="inline-flex items-center gap-1 text-xs text-primary font-medium hover:underline">
                        Open Anthropic Console <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className={`rounded-lg border p-3 space-y-2 ${aiStep >= 2 ? 'border-primary/30 bg-primary/5' : 'border-border opacity-40'}`}>
                    <div className="flex items-center gap-2">
                      <span className={`w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 ${aiStep >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>2</span>
                      <p className="text-xs font-medium">Create an API key</p>
                    </div>
                    <div className="pl-7 text-xs text-muted-foreground space-y-1">
                      <p>Click <strong className="text-foreground">API Keys</strong> in the sidebar → <strong className="text-foreground">Create Key</strong></p>
                      <p>Name it anything. Copy the key — it starts with <code className="bg-muted px-1 rounded">sk-ant-</code></p>
                    </div>
                    {aiStep >= 2 && (
                      <div className="pl-7 flex items-center gap-3">
                        <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer"
                          onClick={() => setAiStep(3)}
                          className="inline-flex items-center gap-1 text-xs text-primary font-medium hover:underline">
                          Go to API Keys <ExternalLink className="w-3 h-3" />
                        </a>
                        <button onClick={() => setAiStep(3)} className="text-xs text-muted-foreground hover:text-foreground cursor-pointer underline">
                          I have my key →
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Step 3 */}
                  <div className={`rounded-lg border p-3 space-y-2 ${aiStep >= 3 ? 'border-primary/30 bg-primary/5' : 'border-border opacity-40'}`}>
                    <div className="flex items-center gap-2">
                      <span className={`w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 ${aiStep >= 3 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>3</span>
                      <p className="text-xs font-medium">Paste your key here</p>
                    </div>
                    {aiStep >= 3 ? (
                      <div className="pl-7 space-y-2">
                        <Input
                          type="password"
                          placeholder="sk-ant-api03-..."
                          value={aiKey}
                          onChange={e => setAiKey(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && saveAiKey()}
                          className="text-xs h-8"
                          autoFocus
                        />
                        <button
                          onClick={saveAiKey}
                          disabled={!aiKey.trim()}
                          className="w-full py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium cursor-pointer hover:bg-primary/90 transition-colors disabled:opacity-50"
                        >
                          Activate AI Features
                        </button>
                        <p className="text-xs text-muted-foreground">Stored only in your browser. Never sent to any server.</p>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground pl-7">Paste your key here once you have it.</p>
                    )}
                  </div>

                  {aiStep < 3 && (
                    <button onClick={() => setAiStep(3)} className="text-xs text-muted-foreground hover:text-foreground cursor-pointer underline">
                      Already have a key? Skip to step 3
                    </button>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* System status */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">System Status</h3>
            <div className="rounded-xl border border-border p-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Canvas connection</span>
                <span className={isConnected ? 'text-green-500' : 'text-red-500'}>
                  {isConnected ? 'Connected' : 'Not connected'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Database (schedules, todos)</span>
                <span className={supaStatus === 'ok' ? 'text-green-500' : supaStatus === 'error' ? 'text-red-500' : 'text-muted-foreground'}>
                  {supaStatus === 'ok' ? 'Connected' : supaStatus === 'error' ? 'Not set up' : 'Checking...'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">AI features</span>
                <span className={aiKeySet ? 'text-green-500' : 'text-muted-foreground'}>
                  {aiKeySet ? 'Active' : 'No key set'}
                </span>
              </div>
              {supaStatus === 'error' && (
                <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded-lg px-3 py-2 mt-2">
                  Todos and Schedule saving won't work until you run the SQL setup. Go to Supabase → SQL Editor → run <code className="bg-muted px-1 rounded">scripts/001_create_tables.sql</code>
                </div>
              )}
            </div>
          </section>

          {/* About */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">About</h3>
            <div className="rounded-xl border border-border p-4 space-y-1.5 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">GradeOS</p>
              <p>A smarter interface for Canvas LMS. Your grades, assignments, and study tools — all in one place.</p>
              <p className="mt-2">Your Canvas token is stored only in your browser and never sent to any GradeOS server.</p>
            </div>
          </section>

        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Nav ─────────────────────────────────────────────────────────────────────

export function DashboardNav({ isZenMode, onToggleZenMode, onSync }: DashboardNavProps) {
  const { isConnected, connection } = useCanvas();
  const [syncing, setSyncing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const { theme } = useTheme();

  const handleSync = async () => {
    setSyncing(true);
    onSync?.();
    setTimeout(() => setSyncing(false), 1500);
  };

  return (
    <TooltipProvider>
      <nav className="sticky top-0 z-50 bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-bold text-lg">G</div>
            <span className="font-semibold text-lg">GradeOS</span>
          </Link>

          {/* Connection status */}
          {isConnected && (
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
              <span className="text-muted-foreground hidden sm:inline">Connected</span>
              <span className="font-medium">{connection.userName}</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={handleSync} disabled={syncing}
                    className="p-1.5 hover:bg-secondary rounded-lg transition-colors disabled:opacity-50 cursor-pointer ml-1">
                    <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Refresh grades from Canvas</TooltipContent>
              </Tooltip>
            </div>
          )}

          {/* Right controls */}
          <div className="flex items-center gap-1">
            {/* Hide grades */}
            {onToggleZenMode && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={onToggleZenMode}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${isZenMode ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}>
                    {isZenMode ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    <span className="hidden sm:inline">{isZenMode ? 'Show grades' : 'Hide grades'}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent>{isZenMode ? 'Show your grade numbers' : 'Hide all grade numbers (useful in class)'}</TooltipContent>
              </Tooltip>
            )}

            {/* Todos */}
            {isConnected && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link href="/todos" className="p-2 hover:bg-secondary rounded-lg transition-colors text-muted-foreground hover:text-foreground flex items-center" title="My Todos">
                    <CheckSquare className="w-4 h-4" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent>My Todos</TooltipContent>
              </Tooltip>
            )}

            {/* Settings — the main one */}
            <SettingsPanel />

            {/* Connect button when not connected */}
            {!isConnected && (
              <button onClick={() => setShowModal(true)}
                className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium cursor-pointer hover:bg-primary/90 transition-colors">
                Connect Canvas
              </button>
            )}
          </div>
        </div>

        {/* Banner when disconnected */}
        {!isConnected && (
          <div className="border-t border-border bg-muted/30 px-4 py-2 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Viewing demo data — connect Canvas to see your real grades.</span>
            <button onClick={() => setShowModal(true)}
              className="text-xs px-3 py-1 rounded-lg border border-border hover:bg-accent cursor-pointer transition-colors">
              Connect
            </button>
          </div>
        )}
      </nav>

      <ConnectionModal open={showModal} onOpenChange={setShowModal} />
    </TooltipProvider>
  );
}
