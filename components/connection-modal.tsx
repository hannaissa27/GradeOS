'use client';

import React, { useState, useEffect } from 'react';
import { useCanvas } from '@/lib/canvas-context';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { CheckCircle2, ExternalLink, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';

interface ConnectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConnectionModal({ open, onOpenChange }: ConnectionModalProps) {
  const { connectWithToken, error } = useCanvas();
  const [canvasUrl, setCanvasUrl] = useState('https://alkhazneh.instructure.com');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [step, setStep] = useState(1);
  const [showUrlEdit, setShowUrlEdit] = useState(false);
  const [visibleError, setVisibleError] = useState<string | null>(null);

  useEffect(() => {
    if (error) {
      setVisibleError(error);
      const t = setTimeout(() => setVisibleError(null), 5000);
      return () => clearTimeout(t);
    }
  }, [error]);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) return;
    setLoading(true);
    try {
      await connectWithToken(canvasUrl, token.trim());
      setSuccess(true);
      setTimeout(() => { onOpenChange(false); setSuccess(false); }, 1500);
    } catch {}
    finally { setLoading(false); }
  };

  const canvasAccountUrl = `${canvasUrl}/profile/settings`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Connect to Canvas</DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            GradeOS reads your grades directly from Canvas. To do that, it needs a token — think of it as a read-only key to your account. It takes about 2 minutes to set up.
          </p>
        </DialogHeader>

        {success ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <CheckCircle2 className="h-14 w-14 text-green-500" />
            <p className="font-semibold text-lg">You're connected!</p>
            <p className="text-sm text-muted-foreground">Loading your grades now...</p>
          </div>
        ) : (
          <form onSubmit={handleConnect} className="space-y-4 mt-2">

            {/* Step 1 */}
            <div className={`rounded-xl border p-4 space-y-3 transition-all ${step >= 1 ? 'border-primary/30 bg-primary/5' : 'border-border'}`}>
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center flex-shrink-0">1</span>
                <p className="text-sm font-semibold">Open your Canvas account settings</p>
              </div>
              <p className="text-xs text-muted-foreground pl-10">
                Make sure you're logged into Canvas first, then click the link below.
              </p>
              <div className="pl-10">
                <a
                  href={canvasAccountUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setStep(2)}
                  className="inline-flex items-center gap-1.5 text-sm text-primary font-medium hover:underline"
                >
                  Open Canvas Settings <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
              <div className="pl-10">
                <button type="button" onClick={() => setShowUrlEdit(v => !v)} className="text-xs text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-1">
                  {showUrlEdit ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  My school uses a different Canvas URL
                </button>
                {showUrlEdit && (
                  <div className="mt-2 space-y-1">
                    <p className="text-xs text-muted-foreground">Your Canvas URL (e.g. canvas.harvard.edu)</p>
                    <Input value={canvasUrl} onChange={e => setCanvasUrl(e.target.value.replace(/\/$/, ''))} placeholder="https://canvas.instructure.com" className="text-xs h-8" />
                  </div>
                )}
              </div>
            </div>

            {/* Step 2 */}
            <div className={`rounded-xl border p-4 space-y-3 transition-all ${step >= 2 ? 'border-primary/30 bg-primary/5' : 'border-border opacity-40'}`}>
              <div className="flex items-center gap-3">
                <span className={`w-7 h-7 rounded-full text-sm font-bold flex items-center justify-center flex-shrink-0 ${step >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>2</span>
                <p className="text-sm font-semibold">Create a new Access Token</p>
              </div>
              <div className="pl-10 text-xs text-muted-foreground space-y-2">
                <p>On that page, scroll down until you see <strong className="text-foreground">Approved Integrations</strong>.</p>
                <p>Click <strong className="text-foreground">+ New Access Token</strong>.</p>
                <p>In the "Purpose" box, type <strong className="text-foreground">GradeOS</strong>. Leave expiry blank.</p>
                <p>Click <strong className="text-foreground">Generate Token</strong>.</p>
                <p className="font-medium text-foreground"> Copy the token that appears — you can only see it once!</p>
              </div>
              {step >= 2 && (
                <button type="button" onClick={() => setStep(3)} className="ml-10 text-xs font-medium text-primary hover:underline cursor-pointer">
                  I have my token, continue →
                </button>
              )}
            </div>

            {/* Step 3 */}
            <div className={`rounded-xl border p-4 space-y-3 transition-all ${step >= 3 ? 'border-primary/30 bg-primary/5' : 'border-border opacity-40'}`}>
              <div className="flex items-center gap-3">
                <span className={`w-7 h-7 rounded-full text-sm font-bold flex items-center justify-center flex-shrink-0 ${step >= 3 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>3</span>
                <p className="text-sm font-semibold">Paste it here</p>
              </div>
              {step >= 3 ? (
                <div className="pl-10 space-y-3">
                  {visibleError && (
                    <div className="text-xs text-red-500 bg-red-500/10 rounded-lg px-3 py-2">
                      {visibleError}
                    </div>
                  )}
                  <Input
                    type="password"
                    placeholder="Paste your Canvas token here..."
                    value={token}
                    onChange={e => setToken(e.target.value)}
                    className="text-sm"
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={!token.trim() || loading}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium cursor-pointer hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Connecting...</> : 'Connect Canvas'}
                  </button>
                  <p className="text-xs text-muted-foreground text-center">
                    Your token is stored only on your device. GradeOS never sends it to any server.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground pl-10">Paste your token here once you have it.</p>
              )}
            </div>

            {step < 3 && (
              <button type="button" onClick={() => setStep(3)} className="text-xs text-muted-foreground hover:text-foreground cursor-pointer underline w-full text-center">
                Already have a token? Skip to step 3
              </button>
            )}
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
