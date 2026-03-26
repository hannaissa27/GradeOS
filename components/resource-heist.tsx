'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, Package, FileText, AlertCircle, Check } from 'lucide-react';
import type { Course, CanvasConnection } from '@/lib/types';

interface ResourceHeistProps {
  course: Course;
  connection: CanvasConnection;
}

interface CanvasFile {
  id: string;
  filename: string;
  display_name: string;
  url: string;
  size: number;
  mime_class: string;
  content_type: string;
}

async function fetchCourseFiles(courseId: string, connection: CanvasConnection): Promise<CanvasFile[]> {
  const res = await fetch('/api/canvas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      canvasUrl: connection.canvasUrl,
      accessToken: connection.accessToken,
      path: `/courses/${courseId}/files?per_page=100&sort=created_at&order=desc`,
    }),
  });
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data;
}

export function ResourceHeist({ course, connection }: ResourceHeistProps) {
  const [files, setFiles] = useState<CanvasFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  const handleLoad = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchCourseFiles(course.id, connection);
      setFiles(data);
      setLoaded(true);
    } catch {
      // 406 = Canvas token doesn't have file permissions - show helpful message
      setError('Files unavailable — your Canvas token may not have file access permissions.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadAll = async () => {
    if (files.length === 0) return;
    setIsDownloading(true);
    setError(null);

    try {
      // Dynamic import of jszip to avoid SSR issues
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setProgress(`Downloading ${i + 1} of ${files.length}: ${file.display_name}`);
        try {
          // Fetch through proxy to avoid CORS
          const res = await fetch('/api/canvas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              canvasUrl: connection.canvasUrl,
              accessToken: connection.accessToken,
              path: `/files/${file.id}/download`,
            }),
          });
          if (res.ok) {
            const blob = await res.blob();
            zip.file(file.display_name || file.filename, blob);
          }
        } catch {
          // Skip failed files, continue
        }
      }

      setProgress('Creating zip...');
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${course.code}-files.zip`;
      a.click();
      URL.revokeObjectURL(url);
      setProgress(null);
    } catch {
      setError('Failed to create zip file.');
      setProgress(null);
    } finally {
      setIsDownloading(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Package className="h-4 w-4" />
            Resource Heist
          </CardTitle>
          {!loaded ? (
            <Button variant="outline" size="sm" onClick={handleLoad} disabled={isLoading} className="h-7 text-xs cursor-pointer">
              {isLoading ? 'Loading...' : 'Load Files'}
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadAll}
              disabled={isDownloading || files.length === 0}
              className="h-7 text-xs cursor-pointer"
            >
              <Download className="h-3 w-3 mr-1" />
              {isDownloading ? 'Zipping...' : `Download All (${files.length})`}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <p className="text-xs text-red-500 flex items-center gap-1 mb-2">
            <AlertCircle className="h-3 w-3" />{error}
          </p>
        )}
        {progress && (
          <p className="text-xs text-muted-foreground mb-2 truncate">{progress}</p>
        )}
        {isLoading && (
          <div className="space-y-1.5">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
          </div>
        )}
        {loaded && files.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-3">No files found in this course</p>
        )}
        {loaded && files.length > 0 && (
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {files.map(file => (
              <div key={file.id} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-accent/50 transition-colors">
                <FileText className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                <span className="text-xs truncate flex-1">{file.display_name || file.filename}</span>
                <span className="text-xs text-muted-foreground flex-shrink-0">{formatSize(file.size)}</span>
              </div>
            ))}
          </div>
        )}
        {!loaded && !isLoading && (
          <p className="text-xs text-muted-foreground">Download all course files as a zip in one click.</p>
        )}
      </CardContent>
    </Card>
  );
}
