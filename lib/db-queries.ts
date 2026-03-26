// Supabase database queries for GradeOS
// All queries use session_hash for anonymous access

import { createClient } from '@/lib/supabase/client';
import { getSessionHash } from './session';
import type { Todo, TimeBlock, EffortOverride } from './types';
export type { Todo, TimeBlock, EffortOverride };

// ============ Effort Overrides ============

export async function getEffortOverride(assignmentId: string): Promise<number | null> {
  const supabase = createClient();
  const sessionHash = getSessionHash();
  
  const { data, error } = await supabase
    .from('effort_overrides')
    .select('effort_minutes')
    .eq('session_hash', sessionHash)
    .eq('assignment_id', assignmentId)
    .single();
  
  if (error || !data) return null;
  return data.effort_minutes;
}

export async function setEffortOverride(assignmentId: string, effortMinutes: number): Promise<void> {
  const supabase = createClient();
  const sessionHash = getSessionHash();
  
  const { error } = await supabase
    .from('effort_overrides')
    .upsert({
      session_hash: sessionHash,
      assignment_id: assignmentId,
      effort_minutes: effortMinutes,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'session_hash,assignment_id' });
  
  if (error) throw error;
}

export async function getAllEffortOverrides(): Promise<Map<string, number>> {
  const supabase = createClient();
  const sessionHash = getSessionHash();
  
  const { data, error } = await supabase
    .from('effort_overrides')
    .select('assignment_id, effort_minutes')
    .eq('session_hash', sessionHash);
  
  if (error) throw error;
  
  const map = new Map<string, number>();
  (data || []).forEach(row => map.set(row.assignment_id, row.effort_minutes));
  return map;
}

// ============ Time Blocks ============

export async function getTimeBlocks(startDate: Date, endDate: Date): Promise<TimeBlock[]> {
  const supabase = createClient();
  const sessionHash = getSessionHash();
  
  const { data, error } = await supabase
    .from('time_blocks')
    .select('*')
    .eq('session_hash', sessionHash)
    .gte('start_time', startDate.toISOString())
    .lte('end_time', endDate.toISOString())
    .order('start_time', { ascending: true });
  
  if (error) throw error;
  
  return (data || []).map(row => ({
    id: row.id,
    assignmentId: row.assignment_id,
    courseId: row.course_id,
    startTime: row.start_time,
    endTime: row.end_time,
    createdAt: row.created_at,
  }));
}

export async function createTimeBlock(
  assignmentId: string,
  courseId: string,
  startTime: Date,
  endTime: Date
): Promise<TimeBlock> {
  const supabase = createClient();
  const sessionHash = getSessionHash();
  
  const { data, error } = await supabase
    .from('time_blocks')
    .insert({
      session_hash: sessionHash,
      assignment_id: assignmentId,
      course_id: courseId,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
    })
    .select()
    .single();
  
  if (error) throw error;
  
  return {
    id: data.id,
    assignmentId: data.assignment_id,
    courseId: data.course_id,
    startTime: data.start_time,
    endTime: data.end_time,
    createdAt: data.created_at,
  };
}

export async function deleteTimeBlock(blockId: string): Promise<void> {
  const supabase = createClient();
  const sessionHash = getSessionHash();
  
  const { error } = await supabase
    .from('time_blocks')
    .delete()
    .eq('id', blockId)
    .eq('session_hash', sessionHash);
  
  if (error) throw error;
}

// ============ Todos ============

export async function getTodos(): Promise<Todo[]> {
  const supabase = createClient();
  const sessionHash = getSessionHash();
  
  const { data, error } = await supabase
    .from('todos')
    .select('*')
    .eq('session_hash', sessionHash)
    .order('sort_order', { ascending: true });
  
  if (error) throw error;
  
  return (data || []).map(row => ({
    id: row.id,
    title: row.title,
    notes: row.notes || '',
    dueDate: row.due_date,
    priority: row.priority as 'low' | 'medium' | 'high',
    completed: row.completed,
    courseTag: row.course_tag || '',
    durationMinutes: row.duration_minutes,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  }));
}

export async function createTodo(todo: Partial<Omit<Todo, 'id' | 'createdAt'>> & { title: string }): Promise<Todo> {
  const supabase = createClient();
  const sessionHash = getSessionHash();
  
  const { data, error } = await supabase
    .from('todos')
    .insert({
      session_hash: sessionHash,
      title: todo.title,
      notes: todo.notes ?? '',
      due_date: todo.dueDate ?? null,
      priority: todo.priority ?? 'medium',
      completed: todo.completed ?? false,
      sort_order: todo.sortOrder ?? 0,
      course_tag: todo.courseTag ?? '',
      duration_minutes: todo.durationMinutes ?? null,
    })
    .select()
    .single();
  
  if (error) throw error;
  
  return {
    id: data.id,
    title: data.title,
    notes: data.notes || '',
    dueDate: data.due_date,
    priority: data.priority,
    completed: data.completed,
    courseTag: data.course_tag || '',
    durationMinutes: data.duration_minutes,
    sortOrder: data.sort_order,
    createdAt: data.created_at,
  };
}

export async function updateTodo(id: string, updates: Partial<Todo>): Promise<void> {
  const supabase = createClient();
  const sessionHash = getSessionHash();
  
  const dbUpdates: Record<string, unknown> = {};
  if (updates.title !== undefined) dbUpdates.title = updates.title;
  if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
  if (updates.dueDate !== undefined) dbUpdates.due_date = updates.dueDate;
  if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
  if (updates.completed !== undefined) dbUpdates.completed = updates.completed;
  if (updates.sortOrder !== undefined) dbUpdates.sort_order = updates.sortOrder;
  if (updates.courseTag !== undefined) dbUpdates.course_tag = updates.courseTag;
  if (updates.durationMinutes !== undefined) dbUpdates.duration_minutes = updates.durationMinutes;
  
  const { error } = await supabase
    .from('todos')
    .update(dbUpdates)
    .eq('id', id)
    .eq('session_hash', sessionHash);
  
  if (error) throw error;
}

export async function deleteTodo(id: string): Promise<void> {
  const supabase = createClient();
  const sessionHash = getSessionHash();
  
  const { error } = await supabase
    .from('todos')
    .delete()
    .eq('id', id)
    .eq('session_hash', sessionHash);
  
  if (error) throw error;
}

export async function reorderTodos(items: { id: string; sortOrder: number }[] | string[]): Promise<void> {
  const supabase = createClient();
  const sessionHash = getSessionHash();
  
  // Support both formats: array of {id, sortOrder} objects or plain string[] of ids
  const updates = items.map((item, index) => {
    const id = typeof item === 'string' ? item : item.id;
    const order = typeof item === 'string' ? index : item.sortOrder;
    return supabase
      .from('todos')
      .update({ sort_order: order })
      .eq('id', id)
      .eq('session_hash', sessionHash);
  });
  
  await Promise.all(updates);
}

// ============ Pulse Reactions ============

export async function getPulseReaction(assignmentId: string): Promise<string | null> {
  const supabase = createClient();
  const sessionHash = getSessionHash();
  
  const { data, error } = await supabase
    .from('study_pulse_reactions')
    .select('reaction')
    .eq('session_hash', sessionHash)
    .eq('assignment_id', assignmentId)
    .single();
  
  if (error || !data) return null;
  return data.reaction;
}

export async function setPulseReaction(assignmentId: string, reaction: 'confused' | 'got_it' | 'stressed'): Promise<void> {
  const supabase = createClient();
  const sessionHash = getSessionHash();
  
  // Delete existing reaction first
  await supabase
    .from('study_pulse_reactions')
    .delete()
    .eq('session_hash', sessionHash)
    .eq('assignment_id', assignmentId);
  
  // Insert new reaction
  const { error } = await supabase
    .from('study_pulse_reactions')
    .insert({
      session_hash: sessionHash,
      assignment_id: assignmentId,
      reaction,
    });
  
  if (error) throw error;
}

export async function getPulseStats(assignmentId: string): Promise<{ confused: number; got_it: number; stressed: number }> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('study_pulse_reactions')
    .select('reaction')
    .eq('assignment_id', assignmentId);
  
  if (error) throw error;
  
  const stats = { confused: 0, got_it: 0, stressed: 0 };
  (data || []).forEach(row => {
    if (row.reaction in stats) {
      stats[row.reaction as keyof typeof stats]++;
    }
  });
  
  return stats;
}

// Legacy aliases
export const getStudyPulseReaction = getPulseReaction;
export const setStudyPulseReaction = setPulseReaction;
export const getStudyPulseStats = getPulseStats;

// ============ Downloaded Files ============

export async function markFileDownloaded(fileId: string, courseId: string): Promise<void> {
  const supabase = createClient();
  const sessionHash = getSessionHash();
  
  const { error } = await supabase
    .from('downloaded_files')
    .upsert({
      session_hash: sessionHash,
      file_id: fileId,
      course_id: courseId,
    }, { onConflict: 'session_hash,file_id' });
  
  if (error) throw error;
}

export async function getDownloadedFileIds(courseId: string): Promise<Set<string>> {
  const supabase = createClient();
  const sessionHash = getSessionHash();
  
  const { data, error } = await supabase
    .from('downloaded_files')
    .select('file_id')
    .eq('session_hash', sessionHash)
    .eq('course_id', courseId);
  
  if (error) throw error;
  
  return new Set((data || []).map(row => row.file_id));
}
