'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { 
  getStudyPulseReaction, 
  setStudyPulseReaction, 
  getStudyPulseStats 
} from '@/lib/db-queries';

interface StudyPulseWidgetProps {
  assignmentId: string;
}

type Reaction = 'confused' | 'got_it' | 'stressed';

export function StudyPulseWidget({ assignmentId }: StudyPulseWidgetProps) {
  const [hasReacted, setHasReacted] = useState(false);
  const [myReaction, setMyReaction] = useState<Reaction | null>(null);
  const [stats, setStats] = useState<{ confused: number; got_it: number; stressed: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [assignmentId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [reaction, statsData] = await Promise.all([
        getStudyPulseReaction(assignmentId),
        getStudyPulseStats(assignmentId),
      ]);
      
      if (reaction) {
        setMyReaction(reaction as Reaction);
        setHasReacted(true);
      }
      setStats(statsData);
    } catch (error) {
      console.error('Failed to load study pulse data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReaction = async (reaction: Reaction) => {
    try {
      await setStudyPulseReaction(assignmentId, reaction);
      setMyReaction(reaction);
      setHasReacted(true);
      // Refresh stats
      const newStats = await getStudyPulseStats(assignmentId);
      setStats(newStats);
    } catch (error) {
      console.error('Failed to save reaction:', error);
    }
  };

  const reactions: { key: Reaction; emoji: string; label: string }[] = [
    { key: 'confused', emoji: '', label: 'Confused' },
    { key: 'got_it', emoji: '', label: 'Got it' },
    { key: 'stressed', emoji: '', label: 'Stressed' },
  ];

  const totalReactions = stats 
    ? stats.confused + stats.got_it + stats.stressed 
    : 0;

  if (isLoading) {
    return (
      <div className="text-xs text-muted-foreground">
        Loading reactions...
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {hasReacted 
          ? `${totalReactions} student${totalReactions !== 1 ? 's' : ''} reacted`
          : 'See how classmates feel about this'
        }
      </p>
      
      <div className="flex items-center gap-2">
        {reactions.map(({ key, emoji, label }) => {
          const count = stats?.[key] ?? 0;
          const isSelected = myReaction === key;
          
          return (
            <Button
              key={key}
              variant={isSelected ? 'secondary' : 'outline'}
              size="sm"
              className="h-8 px-3"
              onClick={() => handleReaction(key)}
              disabled={hasReacted && myReaction !== key}
            >
              <span className="mr-1">{emoji}</span>
              {hasReacted && <span className="text-xs">{count}</span>}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
