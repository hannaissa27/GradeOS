'use client';

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronDown, ChevronUp, MessageSquare, X, EyeOff } from 'lucide-react';
import { formatRelativeTime, courseColor } from '@/lib/gradeUtils';
import type { Announcement, Course } from '@/lib/types';

interface AnnouncementDigestProps {
  announcements: Announcement[];
  courses: Course[];
  isLoading?: boolean;
}

export function AnnouncementDigest({ announcements, courses, isLoading }: AnnouncementDigestProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [hidden, setHidden] = useState(false);

  const courseMap = new Map(courses.map(c => [c.id, c]));

  const visibleAnnouncements = announcements.filter(a => !dismissed.has(a.id));

  const groupedAnnouncements = visibleAnnouncements.reduce((acc, ann) => {
    if (!acc[ann.courseId]) acc[ann.courseId] = [];
    acc[ann.courseId].push(ann);
    return acc;
  }, {} as Record<string, Announcement[]>);

  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  function stripHtml(html: string): string {
    if (typeof document === 'undefined') return html;
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Announcements
          </h3>
        </div>
        {[...Array(2)].map((_, i) => (
          <Card key={i}><CardContent className="p-3"><Skeleton className="h-10 w-full" /></CardContent></Card>
        ))}
      </div>
    );
  }

  if (hidden) {
    return (
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm flex items-center gap-2 text-muted-foreground">
          <MessageSquare className="h-4 w-4" />
          Announcements hidden
        </h3>
        <Button variant="ghost" size="sm" onClick={() => setHidden(false)} className="h-7 text-xs cursor-pointer">
          Show
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Announcements
          {visibleAnnouncements.length > 0 && (
            <span className="text-xs text-muted-foreground font-normal">({visibleAnnouncements.length})</span>
          )}
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setHidden(true)}
          className="h-7 text-xs text-muted-foreground cursor-pointer"
        >
          <EyeOff className="h-3 w-3 mr-1" />
          Hide
        </Button>
      </div>

      {visibleAnnouncements.length === 0 ? (
        <Card>
          <CardContent className="p-4 text-center text-muted-foreground text-xs">
            No announcements
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {Object.entries(groupedAnnouncements).map(([courseId, courseAnnouncements]) => {
            const course = courseMap.get(courseId);
            return (
              <div key={courseId} className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: courseColor(courseId) }} />
                  <span className="text-xs font-medium text-muted-foreground">{course?.code || 'Unknown'}</span>
                </div>
                {courseAnnouncements.map(ann => {
                  const isExpanded = expandedIds.has(ann.id);
                  const plainText = stripHtml(ann.message);
                  const isTruncated = plainText.length > 120;
                  return (
                    <Card key={ann.id}>
                      <CardContent className="p-2.5">
                        <div className="space-y-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-medium text-xs leading-tight flex-1">{ann.title}</p>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <span className="text-xs text-muted-foreground whitespace-nowrap">{formatRelativeTime(ann.postedAt)}</span>
                              <button
                                onClick={() => setDismissed(prev => new Set([...prev, ann.id]))}
                                className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer ml-1"
                                title="Dismiss"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                          <p className={`text-xs text-muted-foreground ${!isExpanded && isTruncated ? 'line-clamp-2' : ''}`}>
                            {plainText}
                          </p>
                          {isTruncated && (
                            <button
                              onClick={() => toggleExpanded(ann.id)}
                              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              {isExpanded ? <><ChevronUp className="h-3 w-3" />Less</> : <><ChevronDown className="h-3 w-3" />More</>}
                            </button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
