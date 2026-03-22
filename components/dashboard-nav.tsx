'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useCanvas } from '@/lib/canvas-context';
import { useTheme } from '@/hooks/use-theme';
import { ConnectionModal } from './connection-modal';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Sun, Moon, LogOut, RefreshCw, Command, CheckCircle2, Eye, EyeOff, CheckSquare } from 'lucide-react';
import { HelpTip } from '@/components/help-tip';

interface DashboardNavProps {
  isZenMode?: boolean;
  onToggleZenMode?: () => void;
  onSync?: () => void;
}

export function DashboardNav({ isZenMode, onToggleZenMode, onSync }: DashboardNavProps) {
  const { isConnected, connection, disconnect } = useCanvas();
  const { theme, toggle } = useTheme();
  const [syncing, setSyncing] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    onSync?.();
    setTimeout(() => setSyncing(false), 1500);
  };

  return (
    <TooltipProvider>
      <nav className="sticky top-0 z-50 bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          {/* Left: Logo */}
          <Link href="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-bold text-lg">
              G
            </div>
            <span className="font-semibold text-lg">GradeOS</span>
          </Link>

          {/* Center: Connection Status */}
          <div className="flex items-center gap-4">
            {isConnected && (
              <>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-[oklch(var(--grade-safe))]" />
                  <span className="text-muted-foreground">Connected</span>
                  <span className="font-medium">{connection.userName}</span>
                </div>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleSync}
                      disabled={syncing}
                      className="p-2 hover:bg-secondary rounded-lg transition-colors disabled:opacity-50"
                      aria-label="Sync with Canvas"
                    >
                      <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Sync with Canvas</TooltipContent>
                </Tooltip>
              </>
            )}
          </div>

          {/* Right: Controls */}
          <div className="flex items-center gap-2">
            {/* Command Palette Hint */}
            <div className="hidden sm:flex items-center gap-1 px-2 py-1 bg-secondary rounded-lg text-xs text-muted-foreground">
              <Command className="w-3 h-3" />
              <span>K</span>
            </div>

            {/* Zen Mode Toggle */}
            {onToggleZenMode && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onToggleZenMode}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${isZenMode ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}
                    title={isZenMode ? 'Show grades' : 'Hide all grade numbers'}
                  >
                    {isZenMode ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    <span className="hidden sm:inline">{isZenMode ? 'Show grades' : 'Hide grades'}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  {isZenMode ? 'Click to show your grade numbers' : 'Hide all grade numbers from the screen (useful in class)'}
                </TooltipContent>
              </Tooltip>
            )}

            {/* Todos Link */}
            {isConnected && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link href="/todos">
                    <Button variant="ghost" size="icon" className="h-9 w-9">
                      <CheckSquare className="w-4 h-4" />
                    </Button>
                  </Link>
                </TooltipTrigger>
                <TooltipContent>Todos</TooltipContent>
              </Tooltip>
            )}

            {/* Theme Toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={toggle}
                  className="p-2 hover:bg-secondary rounded-lg transition-colors"
                  aria-label="Toggle theme"
                >
                  {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                </button>
              </TooltipTrigger>
              <TooltipContent>Toggle theme</TooltipContent>
            </Tooltip>

            {/* Connect/Disconnect */}
            {isConnected ? (
              <Button variant="ghost" size="sm" onClick={disconnect}>
                <LogOut className="w-4 h-4 mr-2" />
                Disconnect
              </Button>
            ) : (
              <Button size="sm" onClick={() => setShowModal(true)}>
                Connect Canvas
              </Button>
            )}
          </div>
        </div>

        {/* Yellow banner when disconnected */}
        {!isConnected && (
          <div className="bg-[oklch(var(--grade-warning)/0.1)] border-t border-[oklch(var(--grade-warning)/0.3)] px-4 py-2 flex items-center justify-between text-sm">
            <span className="text-foreground">
              Viewing demo data. Connect your Canvas account for live grades.
            </span>
            <Button size="sm" variant="outline" onClick={() => setShowModal(true)}>
              Connect
            </Button>
          </div>
        )}
      </nav>

      <ConnectionModal open={showModal} onOpenChange={setShowModal} />
    </TooltipProvider>
  );
}
