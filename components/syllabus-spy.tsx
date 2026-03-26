'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { FileSearch, Upload, Calendar, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { hasAIKey } from '@/lib/aiUtils';

interface ExtractedDate {
  date: string;
  description: string;
  type: 'exam' | 'assignment' | 'holiday' | 'other';
}

function parseDate(text: string): ExtractedDate[] {
  const results: ExtractedDate[] = [];
  // Common date patterns
  const patterns = [
    /(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?/gi,
    /\d{1,2}\/\d{1,2}(?:\/\d{2,4})?/g,
  ];

  const lines = text.split('\n');
  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;

    patterns.forEach(pattern => {
      const matches = trimmed.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const lower = trimmed.toLowerCase();
          let type: ExtractedDate['type'] = 'other';
          if (/exam|midterm|final|test|quiz/.test(lower)) type = 'exam';
          else if (/assignment|homework|hw|project|paper|essay|due/.test(lower)) type = 'assignment';
          else if (/holiday|break|no class/.test(lower)) type = 'holiday';

          results.push({
            date: match,
            description: trimmed.slice(0, 120),
            type,
          });
        });
      }
    });
  });

  // Deduplicate by description
  const seen = new Set<string>();
  return results.filter(r => {
    const key = r.description.slice(0, 60);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function extractWithAI(text: string): Promise<ExtractedDate[]> {
  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: `Extract all dates and associated events/deadlines from this syllabus text. Return ONLY a JSON array, no other text: [{"date":"YYYY-MM-DD","event":"description"}]\n\n${text.slice(0, 4000)}`,
      system: 'You are a date extraction assistant. Return ONLY valid JSON array.',
      maxTokens: 1000,
    }),
  });

  if (!res.ok) throw new Error('AI request failed');
  const data = await res.json();
  const text2 = data.text || '';
  
  try {
    const parsed = JSON.parse(text2.replace(/```json|```/g, '').trim());
    if (Array.isArray(parsed)) {
      return parsed.filter((item: any) => item.date && item.event);
    }
  } catch {}
  return [];
}

export function SyllabusSpy() {
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [dates, setDates] = useState<ExtractedDate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [useAI, setUseAI] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    // Read as text (works for .txt, .md; PDFs will need manual paste)
    if (f.type === 'text/plain' || f.name.endsWith('.txt') || f.name.endsWith('.md')) {
      const t = await f.text();
      setText(t);
    } else {
      setError('For PDFs: open the PDF, select all text (Ctrl+A), copy, and paste below.');
    }
  };

  const handleExtract = async () => {
    if (!text.trim()) { setError('Paste your syllabus text below first.'); return; }
    setIsLoading(true);
    setError(null);
    try {
      let extracted: ExtractedDate[];
      if (useAI && hasAIKey()) {
        extracted = await extractWithAI(text);
      } else {
        extracted = parseDate(text);
      }
      setDates(extracted);
      if (extracted.length === 0) setError('No dates found. Try pasting more of the syllabus.');
    } catch {
      setError('Extraction failed. Try without AI.');
    } finally {
      setIsLoading(false);
    }
  };

  const typeColor: Record<ExtractedDate['type'], string> = {
    exam: 'bg-red-500/10 text-red-600 dark:text-red-400',
    assignment: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    holiday: 'bg-green-500/10 text-green-600 dark:text-green-400',
    other: 'bg-muted text-muted-foreground',
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileSearch className="h-4 w-4" />
            Syllabus Spy
          </CardTitle>
          <button onClick={() => setOpen(v => !v)} className="text-muted-foreground hover:text-foreground cursor-pointer p-1">
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </CardHeader>

      {open && (
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Paste your syllabus text (or upload a .txt file) to extract all important dates automatically.
          </p>

          {/* File upload */}
          <label className="flex items-center gap-2 cursor-pointer">
            <div className="flex items-center gap-2 px-3 py-1.5 border border-border rounded-md text-xs hover:bg-accent transition-colors cursor-pointer">
              <Upload className="h-3 w-3" />
              {file ? file.name : 'Upload .txt file'}
            </div>
            <input type="file" accept=".txt,.md" onChange={handleFile} className="hidden" />
          </label>

          {/* Text paste area */}
          <Textarea
            placeholder="Or paste your syllabus text here..."
            value={text}
            onChange={e => setText(e.target.value)}
            className="text-xs min-h-[80px] resize-none"
          />

          <div className="flex items-center justify-between gap-2">
            {hasAIKey() && (
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                <input type="checkbox" checked={useAI} onChange={e => setUseAI(e.target.checked)} />
                Use AI (more accurate)
              </label>
            )}
            <Button
              size="sm"
              onClick={handleExtract}
              disabled={isLoading || !text.trim()}
              className="h-7 text-xs ml-auto cursor-pointer"
            >
              {isLoading ? 'Extracting...' : 'Extract Dates'}
            </Button>
          </div>

          {error && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="h-3 w-3 flex-shrink-0" />{error}
            </p>
          )}

          {isLoading && (
            <div className="space-y-1.5">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          )}

          {dates.length > 0 && (
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              <p className="text-xs font-medium text-muted-foreground">{dates.length} dates found</p>
              {dates.map((d, i) => (
                <div key={i} className="flex items-start gap-2 p-2 rounded-md bg-muted/30">
                  <Calendar className="h-3 w-3 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-medium">{d.date}</span>
                      <Badge className={`text-[10px] py-0 px-1.5 ${typeColor[d.type]}`}>{d.type}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{d.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
