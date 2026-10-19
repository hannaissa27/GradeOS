'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCanvas } from '@/lib/canvas-context';
import { useTheme } from '@/hooks/use-theme';
import { ConnectionModal } from '@/components/connection-modal';
import { Button } from '@/components/ui/button';
import { Brain, Ghost, Timer, Package, Zap, Target, Sun, Moon } from 'lucide-react';

const FEATURES = [
  { icon: Target, title: 'Weekly plan', description: 'A short AI plan for the week, based on your grades and deadlines.' },
  { icon: Ghost, title: 'Grade planner', description: 'What you need on each remaining assignment to hit your target.' },
  { icon: Timer, title: 'Smart sorting', description: 'Assignments ordered by how much they move your grade.' },
  { icon: Zap, title: 'Assignment decoder', description: 'What the professor actually wants, and a first step to start.' },
  { icon: Brain, title: 'Grade autopsy', description: 'Why a grade went wrong, and how to avoid a repeat.' },
  { icon: Package, title: 'Grade trends', description: 'Your running grade over time, per course.' },
];

const STEPS = [
  { step: '1', title: 'Paste your Canvas token', description: 'Takes about a minute from Canvas settings.' },
  { step: '2', title: 'GradeOS syncs your data', description: 'Courses, grades and assignments load automatically.' },
  { step: '3', title: 'See what matters', description: 'Your week, sorted by what moves your grade.' },
];

export default function LandingPage() {
  const router = useRouter();
  const { isConnected, connection, connectWithToken } = useCanvas();
  const { theme, toggle } = useTheme();
  const [modalOpen, setModalOpen] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  const handleTryDemo = async () => {
    setDemoLoading(true);
    try {
      await connectWithToken('demo', 'demo');
      router.push('/dashboard');
    } catch (err) {
      console.error('Demo failed:', err);
    } finally {
      setDemoLoading(false);
    }
  };

  // Redirect if already connected (real or demo)
  const shouldRedirect = isConnected || !!connection.userName;

  useEffect(() => {
    if (shouldRedirect) router.push('/dashboard');
  }, [shouldRedirect, router]);

  if (shouldRedirect) return null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-background/90 backdrop-blur border-b border-border">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-foreground rounded-md flex items-center justify-center text-background font-bold">G</div>
            <span className="font-semibold">GradeOS</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggle}
              className="p-2 hover:bg-secondary rounded-lg transition-colors cursor-pointer"
              aria-label="Toggle theme"
            >
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>
            <Button size="sm" onClick={() => setModalOpen(true)}>Open app</Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-4 pt-20 pb-16">
        <h1 className="text-balance font-bold tracking-tight" style={{ fontSize: 'clamp(2.25rem, 5vw, 3.75rem)', lineHeight: 1.08 }}>
          Your Canvas grades,<br />
          <span className="text-muted-foreground font-normal">finally making sense.</span>
        </h1>
        <p className="mt-5 text-lg text-muted-foreground max-w-xl leading-relaxed">
          GradeOS reads your existing Canvas account and tells you what to work on, what you need to score, and why a grade dropped.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3">
          <Button size="lg" onClick={() => setModalOpen(true)}>Connect Canvas</Button>
          <Button size="lg" variant="outline" onClick={handleTryDemo} disabled={demoLoading}>
            {demoLoading ? 'Loading…' : 'Try the demo'}
          </Button>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">Read-only. Your Canvas token stays in your browser.</p>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-border">
        <div className="max-w-5xl mx-auto px-4 py-16">
          <h2 className="text-xl font-semibold mb-8">What you get</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-8">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div key={title} className="flex gap-3">
                <Icon className="w-5 h-5 mt-0.5 flex-shrink-0 text-foreground" />
                <div>
                  <h3 className="font-medium">{title}</h3>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-border bg-secondary/40">
        <div className="max-w-5xl mx-auto px-4 py-16">
          <h2 className="text-xl font-semibold mb-8">How it works</h2>
          <ol className="grid sm:grid-cols-3 gap-8">
            {STEPS.map(item => (
              <li key={item.step} className="flex gap-3">
                <span className="w-7 h-7 rounded-full bg-foreground text-background text-sm font-semibold flex items-center justify-center flex-shrink-0">
                  {item.step}
                </span>
                <div>
                  <h3 className="font-medium">{item.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-10">
            <Button onClick={() => setModalOpen(true)}>Connect Canvas</Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="max-w-5xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>© 2025 GradeOS. Built for students, by students.</span>
          <button onClick={() => setModalOpen(true)} className="hover:text-foreground transition-colors cursor-pointer">
            Connect Canvas
          </button>
        </div>
      </footer>

      <ConnectionModal open={modalOpen} onOpenChange={setModalOpen} />
    </div>
  );
}
