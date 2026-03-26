'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, useScroll, useMotionValueEvent } from 'framer-motion';
import { useCanvas } from '@/lib/canvas-context';
import { useTheme } from '@/hooks/use-theme';
import { ConnectionModal } from '@/components/connection-modal';
import { Button } from '@/components/ui/button';
import { Brain, Ghost, Timer, Package, Zap, Target, Github, Sun, Moon, AlertTriangle, MessageSquare, TrendingDown } from 'lucide-react';

const fadeInUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.45, ease: 'easeOut' },
};

const staggerContainer = {
  initial: {},
  whileInView: {
    transition: {
      staggerChildren: 0.08,
    },
  },
  viewport: { once: true },
};

const staggerItem = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  transition: { duration: 0.45, ease: 'easeOut' },
};

export default function LandingPage() {
  const router = useRouter();
  const { isConnected, connection, connectWithToken } = useCanvas();
  const { theme, toggle } = useTheme();
  const [modalOpen, setModalOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const { scrollY } = useScroll();

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

  useMotionValueEvent(scrollY, 'change', (latest) => {
    setScrolled(latest > 20);
  });

  // Redirect if already connected (real or demo with userName set)
  const shouldRedirect = isConnected || (!isConnected && !!connection.userName);

  useEffect(() => {
    if (shouldRedirect) {
      router.push('/dashboard');
    }
  }, [shouldRedirect, router]);

  if (shouldRedirect) {
    return null;
  }

  const handleScroll = (id: string) => {
    const element = document.getElementById(id);
    element?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation */}
      <motion.nav
        className={`sticky top-0 z-50 transition-all duration-300 ${
          scrolled 
            ? 'bg-background/80 backdrop-blur-lg border-b border-border shadow-sm' 
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-foreground rounded-lg flex items-center justify-center text-background font-bold text-lg">
              G
            </div>
            <span className="font-semibold text-lg">GradeOS</span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={toggle}
              className="p-2 hover:bg-secondary rounded-lg transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>
            <Button onClick={() => setModalOpen(true)}>Open App</Button>
          </div>
        </div>
      </motion.nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-4 py-24 space-y-8">
        <motion.div {...fadeInUp} className="space-y-4">
          <h1 className="text-balance" style={{ fontSize: 'clamp(2.5rem, 6vw, 5rem)', lineHeight: 1.1 }}>
            <span className="font-normal text-muted-foreground block">Canvas was built for professors.</span>
            <span className="font-bold text-foreground block">GradeOS was built for you.</span>
          </h1>
        </motion.div>

        <motion.p 
          {...fadeInUp}
          transition={{ ...fadeInUp.transition, delay: 0.1 }}
          className="text-lg text-muted-foreground max-w-3xl leading-relaxed"
        >
          The intelligence layer on top of Canvas. Grade planning, workload forecasting, AI diagnosis, and deep
          analytics — all from your existing Canvas account.
        </motion.p>

        <motion.div 
          {...fadeInUp}
          transition={{ ...fadeInUp.transition, delay: 0.2 }}
          className="flex flex-col sm:flex-row gap-4 pt-4"
        >
          <Button size="lg" onClick={() => setModalOpen(true)}>
            Connect Canvas
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={handleTryDemo}
            disabled={demoLoading}
          >
            {demoLoading ? 'Loading...' : 'Try Demo'}
          </Button>
        </motion.div>
      </section>

      {/* Problem Section */}
      <section className="bg-secondary/50 py-24">
        <div className="max-w-6xl mx-auto px-4 space-y-12">
          <motion.div {...fadeInUp} className="text-center space-y-2">
            <h2 className="text-4xl font-bold text-balance">Canvas shows you data.</h2>
            <p className="text-xl text-muted-foreground">GradeOS tells you what to do with it.</p>
          </motion.div>

          <motion.div 
            variants={staggerContainer}
            initial="initial"
            whileInView="whileInView"
            viewport={{ once: true }}
            className="grid md:grid-cols-3 gap-6"
          >
            {[
              {
                icon: AlertTriangle,
                title: 'Deadlines buried across 12 different course pages',
              },
              {
                icon: MessageSquare,
                title: "Professor feedback you can't act on",
              },
              {
                icon: TrendingDown,
                title: 'A grade that tells you nothing about why it\'s dropping',
              },
            ].map((item, idx) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={idx}
                  variants={staggerItem}
                  className="bg-card rounded-lg p-6 border border-border space-y-3 transition-all hover:border-primary/30 hover:shadow-md"
                >
                  <Icon className="w-8 h-8 text-foreground" />
                  <p className="text-lg font-medium text-pretty">{item.title}</p>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="max-w-6xl mx-auto px-4 py-24">
        <div className="space-y-12">
          <motion.div {...fadeInUp} className="text-center space-y-2">
            <h2 className="text-4xl font-bold text-balance">Everything Canvas should have shipped with</h2>
          </motion.div>

          <motion.div 
            variants={staggerContainer}
            initial="initial"
            whileInView="whileInView"
            viewport={{ once: true }}
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {[
              {
                icon: Brain,
                title: 'Grade Autopsy',
                description: 'AI diagnoses why you bombed an assignment and tells you how to fix it',
              },
              {
                icon: Zap,
                title: 'Assignment Decoder',
                description: 'AI breaks down what professors actually want — deliverable, hidden requirements, time estimate',
              },
              {
                icon: Target,
                title: 'Weekly Battle Plan',
                description: 'AI-generated priority plan every week based on your grades and deadlines',
              },
              {
                icon: Ghost,
                title: 'Grade Planner',
                description: 'Shows exactly what you need on every remaining assignment to hit your target',
              },
              {
                icon: Package,
                title: 'Grade Trajectory',
                description: 'Running grade over time with projected final for every course',
              },
              {
                icon: Timer,
                title: 'Smart Sorting',
                description: 'Assignments sorted by grade impact so you work on what moves the needle first',
              },
            ].map((feature, idx) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={idx}
                  variants={staggerItem}
                  className="bg-card rounded-lg p-6 border border-border space-y-3 transition-all hover:border-primary/30 hover:shadow-md"
                >
                  <Icon className="w-8 h-8 text-foreground" />
                  <h3 className="font-semibold text-lg">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-secondary/50 py-24">
        <div className="max-w-4xl mx-auto px-4 space-y-12">
          <motion.div {...fadeInUp} className="text-center space-y-2">
            <h2 className="text-4xl font-bold text-balance">Three steps to your battle plan</h2>
          </motion.div>

          <motion.div 
            variants={staggerContainer}
            initial="initial"
            whileInView="whileInView"
            viewport={{ once: true }}
            className="space-y-8"
          >
            {[
              {
                step: '01',
                title: 'Paste your Canvas token',
                description: 'Generated in 30 seconds from Canvas settings',
              },
              {
                step: '02',
                title: 'GradeOS pulls your data automatically',
                description: 'Your courses, grades, and assignments sync instantly',
              },
              {
                step: '03',
                title: 'Get your prioritized battle plan',
                description: 'See what matters this week, sorted by ROI',
              },
            ].map((item, idx) => (
              <motion.div
                key={idx}
                variants={staggerItem}
                className="flex gap-6 items-start relative"
              >
                <div 
                  className="font-bold text-muted-foreground/10 w-24 flex-shrink-0 select-none pointer-events-none"
                  style={{ fontSize: '6rem', fontWeight: 100, lineHeight: 1 }}
                >
                  {item.step}
                </div>
                <div className="flex-1 space-y-1 py-4">
                  <h3 className="text-xl font-semibold">{item.title}</h3>
                  <p className="text-muted-foreground">{item.description}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-4xl mx-auto px-4 py-24 text-center space-y-6">
        <motion.h2 {...fadeInUp} className="text-4xl font-bold text-balance">
          Stop reacting to Canvas.
        </motion.h2>
        <motion.p 
          {...fadeInUp} 
          transition={{ ...fadeInUp.transition, delay: 0.1 }}
          className="text-xl text-muted-foreground"
        >
          Start running it.
        </motion.p>
        <motion.div {...fadeInUp} transition={{ ...fadeInUp.transition, delay: 0.2 }}>
          <Button size="lg" onClick={() => setModalOpen(true)}>
            Connect Canvas
          </Button>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="bg-secondary/50 border-t border-border">
        <div className="max-w-6xl mx-auto px-4 py-12">
          <div className="flex flex-col md:flex-row items-start justify-between gap-8">
            {/* Left */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-foreground rounded-lg flex items-center justify-center text-background font-bold text-sm">
                  G
                </div>
                <span className="font-semibold">GradeOS</span>
              </div>
              <p className="text-sm text-muted-foreground">The student OS for Canvas LMS</p>
              <p className="text-xs text-muted-foreground">
                Your Canvas token never leaves your browser.
              </p>
            </div>

            {/* Right */}
            <div className="flex flex-col gap-2 text-sm">
              <button 
                onClick={() => handleScroll('features')} 
                className="text-muted-foreground hover:text-foreground transition-colors text-left"
              >
                How it works
              </button>
              <button 
                onClick={() => setModalOpen(true)} 
                className="text-muted-foreground hover:text-foreground transition-colors text-left"
              >
                Connect Canvas
              </button>
              <a 
                href="#" 
                className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
              >
                <Github className="w-4 h-4" />
                GitHub
              </a>
            </div>
          </div>

          <div className="pt-8 mt-8 border-t border-border">
            <p className="text-xs text-muted-foreground">
              2025 GradeOS. Built for students, by students.
            </p>
          </div>
        </div>
      </footer>

      <ConnectionModal open={modalOpen} onOpenChange={setModalOpen} />
    </div>
  );
}
