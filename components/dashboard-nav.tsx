'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useCanvas } from '@/lib/canvas-context';
import { useTheme } from '@/hooks/use-theme';
import { ConnectionModal } from './connection-modal';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import {
  Sun, Moon, RefreshCw, CheckCircle2, Eye, EyeOff, CheckSquare,
  Settings, LogOut, ExternalLink,
  AlertCircle, Check,
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

      <SheetContent className="w-full sm:max-w-md overflow-y-auto px-6">
        <SheetHeader>
          <SheetTitle>Settings</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-7">

          {/* Account */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Account</h3>
            {isConnected ? (
              <div className="rounded-xl border border-border p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm flex-shrink-0">
                    {connection.userName?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{connection.userName}</p>
                    <p className="text-xs text-muted-foreground truncate max-w-[220px]">{connection.canvasUrl ? new URL(connection.canvasUrl).hostname : 'Demo mode'}</p>
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
            <div className="rounded-xl border border-border p-5 flex items-center justify-between">
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
            <div className="rounded-xl border border-border p-5 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">AI features</p>
                <span className="text-xs text-green-500 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />Included
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Grade Autopsy, How to start, and Syllabus Spy are all built in. No API key setup needed.
              </p>
            </div>
          </section>


          {/* System status */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">System Status</h3>
            <div className="rounded-xl border border-border p-5 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Canvas connection</span>
                <span className={isConnected ? 'text-green-500' : 'text-red-500'}>
                  {isConnected ? 'Connected' : 'Not connected'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Database (todos)</span>
                <span className={supaStatus === 'ok' ? 'text-green-500' : supaStatus === 'error' ? 'text-red-500' : 'text-muted-foreground'}>
                  {supaStatus === 'ok' ? 'Connected' : supaStatus === 'error' ? 'Not set up' : 'Checking...'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">AI features</span>
                <span className="text-green-500">Active</span>
              </div>
              {supaStatus === 'error' && (
                <div className="text-xs bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mt-1 space-y-2">
                  <p className="font-medium text-amber-600 dark:text-amber-400">Database not set up — Todos won't save</p>
                  <p className="text-muted-foreground">To fix this, go to your Supabase project and run this SQL once:</p>
                  <ol className="text-muted-foreground space-y-1 pl-3">
                    <li>1. Open <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-primary underline">supabase.com/dashboard</a></li>
                    <li>2. Click your GradeOS project</li>
                    <li>3. Click <strong className="text-foreground">SQL Editor</strong> in the left sidebar</li>
                    <li>4. Paste and run the contents of <code className="bg-muted px-1 rounded">scripts/001_create_tables.sql</code> from your repo</li>
                  </ol>
                  <p className="text-muted-foreground">After that, refresh this page and the status will turn green.</p>
                </div>
              )}
            </div>
          </section>

          {/* About */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">About</h3>
            <div className="rounded-xl border border-border p-5 space-y-2 text-xs text-muted-foreground">
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
