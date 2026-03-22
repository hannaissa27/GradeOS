'use client';

import React, { useState } from 'react';
import { HelpCircle, X } from 'lucide-react';

interface HelpTipProps {
  text: string;
}

export function HelpTip({ text }: HelpTipProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(v => !v)}
        className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors align-middle"
        title="What is this?"
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>
      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          {/* Tooltip */}
          <div className="absolute left-5 top-0 z-50 w-64 bg-popover border border-border rounded-lg shadow-lg p-3 text-xs text-muted-foreground leading-relaxed">
            <button
              onClick={() => setOpen(false)}
              className="absolute top-2 right-2 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="h-3 w-3" />
            </button>
            <p>{text}</p>
          </div>
        </>
      )}
    </div>
  );
}
