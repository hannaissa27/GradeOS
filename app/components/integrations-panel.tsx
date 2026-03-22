'use client';

import React, { useState, useEffect } from 'react';
import { useCanvas } from '@/lib/canvas-context';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Settings2, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  ExternalLink,
  Database,
  Bot,
  Unplug,
  Calendar,
  FileText
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

  // Status checks
  const [supabaseStatus, setSupabaseStatus] = useState<'checking' | 'ok' | 'error'>('checking');
  const [canvasStatus, setCanvasStatus] = useState<'checking' | 'ok' | 'error'>('checking');
  const [aiStatus, setAiStatus] = useState<'checking' | 'ok' | 'error' | 'not_set'>('checking');

  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) {
      runStatusChecks();
      // Check for existing AI key
      const existingKey = localStorage.getItem('gradeos-ai-key');
      if (existingKey) {
        setAiKeySet(true);
        setAiKey('');
      }
    }
  }, [open]);

  const runStatusChecks = async () => {
    // Reset statuses
    setSupabaseStatus('checking');
    setCanvasStatus('checking');
    setAiStatus('checking');

    // Check Supabase
    try {
      const supabase = createClient();
      const { error } = await supabase.from('todos').select('id').limit(1);
      setSupabaseStatus(error ? 'error' : 'ok');
    } catch {
      setSupabaseStatus('error');
    }

    // Check Canvas
    if (isConnected && connection.apiToken) {
      try {
        const response = await fetch(`${connection.domain}/api/v1/users/self`, {
          headers: { Authorization: `Bearer ${connection.apiToken}` },
        });
        setCanvasStatus(response.ok ? 'ok' : 'error');
      } catch {
        setCanvasStatus('error');
      }
    } else {
      setCanvasStatus('error');
    }

    // Check AI key
    const existingKey = localStorage.getItem('gradeos-ai-key');
    if (existingKey) {
      setAiStatus('ok');
    } else {
      setAiStatus('not_set');
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
  };

  const StatusBadge = ({ status }: { status: 'checking' | 'ok' | 'error' | 'not_set' }) => {
    if (status === 'checking') {
      return <Badge variant="secondary" className="gap-1"><AlertCircle className="w-3 h-3" />Checking</Badge>;
    }
    if (status === 'ok') {
      return <Badge variant="default" className="gap-1 bg-[oklch(var(--grade-safe))] text-white"><CheckCircle2 className="w-3 h-3" />Connected</Badge>;
    }
    if (status === 'not_set') {
      return <Badge variant="outline" className="gap-1"><AlertCircle className="w-3 h-3" />Not Set</Badge>;
    }
    return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" />Error</Badge>;
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="icon">
            <Settings2 className="w-4 h-4" />
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Integrations</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Canvas Section */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Unplug className="w-4 h-4" />
                  Canvas LMS
                </CardTitle>
                <StatusBadge status={canvasStatus} />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {isConnected ? (
                <>
                  <div className="space-y-1 text-sm">
                    <p className="text-muted-foreground">Connected as</p>
                    <p className="font-medium">{connection.userName}</p>
                  </div>
                  <div className="space-y-1 text-sm">
                    <p className="text-muted-foreground">Instance URL</p>
                    <p className="font-mono text-xs bg-secondary px-2 py-1 rounded truncate">
                      {connection.domain}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={disconnect} className="w-full">
                    Disconnect
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Not connected. Click Connect Canvas in the navbar.
                </p>
              )}
            </CardContent>
          </Card>

          {/* AI Features Section */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Bot className="w-4 h-4" />
                  AI Features
                </CardTitle>
                <StatusBadge status={aiStatus} />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {aiKeySet ? (
                <>
                  <div className="flex items-center gap-2 text-sm text-[oklch(var(--grade-safe))]">
                    <CheckCircle2 className="w-4 h-4" />
                    AI features enabled
                  </div>
                  <div className="space-y-2 text-sm">
                    <p className="font-medium">Unlocked features:</p>
                    <ul className="space-y-1 text-muted-foreground">
                      <li>Announcement Triage</li>
                      <li>Syllabus Spy</li>
                      <li>Assignment Chunker</li>
                    </ul>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleRemoveAiKey}>
                    Remove API Key
                  </Button>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Anthropic API Key</label>
                    <Input
                      type="password"
                      placeholder="sk-ant-..."
                      value={aiKey}
                      onChange={(e) => setAiKey(e.target.value)}
                    />
                  </div>
                  <Button onClick={handleSaveAiKey} disabled={!aiKey.trim() || saving} size="sm">
                    Save Key
                  </Button>
                  <a
                    href="https://console.anthropic.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    Get an API key <ExternalLink className="w-3 h-3" />
                  </a>
                  <p className="text-xs text-muted-foreground">
                    Stored locally only — never sent to GradeOS servers.
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* System Status Section */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  System Status
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={runStatusChecks}>
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span>Supabase Database</span>
                <StatusBadge status={supabaseStatus} />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Canvas API</span>
                <StatusBadge status={canvasStatus} />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>AI Features</span>
                <StatusBadge status={aiStatus} />
              </div>
            </CardContent>
          </Card>

          {/* Coming Soon Section */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Coming Soon</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  Google Calendar Sync
                </div>
                <Button variant="outline" size="sm" disabled>
                  Coming Soon
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  Notion Export
                </div>
                <Button variant="outline" size="sm" disabled>
                  Coming Soon
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
}
