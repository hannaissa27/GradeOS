'use client';

import React, { useState, useEffect } from 'react';
import { useCanvas } from '@/lib/canvas-context';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';

interface ConnectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConnectionModal({ open, onOpenChange }: ConnectionModalProps) {
  const { connectWithToken, error } = useCanvas();
  const [canvasUrl, setCanvasUrl] = useState('https://canvas.instructure.com');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [userName, setUserName] = useState('');
  const [visibleError, setVisibleError] = useState<string | null>(null);

  // Auto-dismiss error after 4000ms
  useEffect(() => {
    if (error) {
      setVisibleError(error);
      const t = setTimeout(() => setVisibleError(null), 4000);
      return () => clearTimeout(t);
    }
  }, [error]);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setLoading(true);
    try {
      await connectWithToken(canvasUrl, token);
      setSuccess(true);
      setUserName('');
      setToken('');
      
      // Auto-close after 1.2s
      setTimeout(() => {
        onOpenChange(false);
        setSuccess(false);
      }, 1200);
    } catch (err) {
      console.error('Connection failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Connect Your Canvas Account</DialogTitle>
          <DialogDescription>
            Paste your Canvas API token to get started.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="space-y-4 py-4">
            <div className="text-center space-y-2">
              <div className="text-green-600 dark:text-green-500 text-lg font-semibold">Connected!</div>
              <p className="text-sm text-muted-foreground">Redirecting to dashboard...</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleConnect} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="canvas-url">Canvas URL</Label>
              <Input
                id="canvas-url"
                value={canvasUrl}
                onChange={(e) => setCanvasUrl(e.target.value)}
                placeholder="https://canvas.instructure.com"
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                Replace with your school's Canvas URL
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="token">Canvas API Token</Label>
              <Input
                id="token"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Paste your token here"
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                <a
                  href="https://canvas.instructure.com/doc/api/file.oauth.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  How do I get my token?
                </a>
              </p>
            </div>

            {visibleError && (
              <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                {visibleError}
              </div>
            )}

            <div className="bg-muted p-3 rounded-md text-xs text-muted-foreground">
              Your token is stored only in your browser. GradeOS never sends it to any server except your Canvas instance.
            </div>

            <Button
              type="submit"
              disabled={!token || loading}
              className="w-full"
            >
              {loading ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  Connecting...
                </>
              ) : (
                'Connect'
              )}
            </Button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={loading}
              onClick={async () => {
                setLoading(true);
                try {
                  await connectWithToken('demo', 'demo');
                  setSuccess(true);
                  setTimeout(() => {
                    onOpenChange(false);
                    setSuccess(false);
                  }, 1200);
                } catch (err) {
                  console.error('Demo mode failed:', err);
                } finally {
                  setLoading(false);
                }
              }}
            >
              Try Demo Mode
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              Explore GradeOS with sample data
            </p>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
