'use client';

import React, { useEffect, useState } from 'react';
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command';
import { useRouter } from 'next/navigation';
import { useCanvas } from '@/lib/canvas-context';
import { 
  BookOpen, 
  Settings, 
  RefreshCw, 
  Eye, 
  EyeOff, 
  CheckSquare, 
  FileText,
  Calendar,
  BarChart3,
  Zap
} from 'lucide-react';
import type { Course, Assignment } from '@/lib/types';

interface CommandPaletteProps {
  courses: Course[];
  assignments: Assignment[];
  onSync?: () => void;
  onToggleZenMode?: () => void;
  zenModeActive?: boolean;
  onSelectCourse?: (courseId: string) => void;
}

export function CommandPalette({ 
  courses, 
  assignments, 
  onSync, 
  onToggleZenMode,
  zenModeActive,
  onSelectCourse 
}: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const router = useRouter();
  const { isConnected } = useCanvas();

  const filteredCourses = search.trim()
    ? courses.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.code.toLowerCase().includes(search.toLowerCase())
      )
    : courses.slice(0, 6);

  const filteredAssignments = search.trim()
    ? assignments.filter(a =>
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        (a.courseCode || '').toLowerCase().includes(search.toLowerCase())
      ).slice(0, 8)
    : assignments.slice(0, 5);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(o => !o);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  // Reset search when closing
  useEffect(() => {
    if (!open) setSearch('');
  }, [open]);

  const handleSelect = (callback: () => void) => {
    callback();
    setOpen(false);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search courses, assignments, or commands..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        
        {/* Navigation — only show when not searching */}
        {!search.trim() && (
          <>
            <CommandGroup heading="Navigation">
              <CommandItem onSelect={() => handleSelect(() => router.push('/dashboard'))}>
                <Zap className="mr-2 h-4 w-4" />Execute
              </CommandItem>
              <CommandItem onSelect={() => handleSelect(() => router.push('/dashboard?tab=courses'))}>
                <BookOpen className="mr-2 h-4 w-4" />Courses
              </CommandItem>
              <CommandItem onSelect={() => handleSelect(() => router.push('/dashboard?tab=schedule'))}>
                <Calendar className="mr-2 h-4 w-4" />Schedule
              </CommandItem>
              <CommandItem onSelect={() => handleSelect(() => router.push('/dashboard?tab=reflect'))}>
                <BarChart3 className="mr-2 h-4 w-4" />Reflect
              </CommandItem>
              <CommandItem onSelect={() => handleSelect(() => router.push('/todos'))}>
                <CheckSquare className="mr-2 h-4 w-4" />Todos
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Courses */}
        {filteredCourses.length > 0 && (
          <>
            <CommandGroup heading="Courses">
              {filteredCourses.map(course => (
                <CommandItem
                  key={course.id}
                  onSelect={() => handleSelect(() => onSelectCourse?.(course.id))}
                >
                  <BookOpen className="mr-2 h-4 w-4" />
                  <span className="truncate">{course.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{course.code}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Assignments */}
        {filteredAssignments.length > 0 && (
          <>
            <CommandGroup heading="Assignments">
              {filteredAssignments.map(assignment => (
                <CommandItem
                  key={assignment.id}
                  onSelect={() => handleSelect(() => onSelectCourse?.(assignment.courseId))}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  <span className="truncate">{assignment.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{assignment.courseCode}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Commands */}
        <CommandGroup heading="Commands">
          {isConnected && onSync && (
            <CommandItem onSelect={() => handleSelect(onSync)}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Sync with Canvas
            </CommandItem>
          )}
          {onToggleZenMode && (
            <CommandItem onSelect={() => handleSelect(onToggleZenMode)}>
              {zenModeActive ? (
                <><Eye className="mr-2 h-4 w-4" />Exit Zen Mode</>
              ) : (
                <><EyeOff className="mr-2 h-4 w-4" />Enable Zen Mode</>
              )}
            </CommandItem>
          )}
          <CommandItem onSelect={() => handleSelect(() => router.push('/dashboard?integrations=true'))}>
            <Settings className="mr-2 h-4 w-4" />
            Integrations
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
