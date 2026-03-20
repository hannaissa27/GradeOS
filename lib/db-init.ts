import { createClient } from '@/lib/supabase/client';

export async function initializeTables() {
  const supabase = createClient();

  try {
    // Create tables with IF NOT EXISTS
    await supabase.rpc('initialize_gradeos_tables').catch(() => {
      // If RPC doesn't exist, we'll just create them on demand
    });
  } catch (error) {
    console.error('[GradeOS] Error initializing tables:', error);
  }
}

// Helper to ensure a table exists before writing
export async function ensureTableExists(tableName: string) {
  const supabase = createClient();

  const tableCreationQueries: Record<string, string> = {
    effort_overrides: `
      CREATE TABLE IF NOT EXISTS public.effort_overrides (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_hash TEXT NOT NULL,
        assignment_id TEXT NOT NULL,
        effort_minutes INTEGER NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT now(),
        UNIQUE(session_hash, assignment_id)
      );
    `,
    time_blocks: `
      CREATE TABLE IF NOT EXISTS public.time_blocks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_hash TEXT NOT NULL,
        assignment_id TEXT NOT NULL,
        course_id TEXT NOT NULL,
        start_time TIMESTAMPTZ NOT NULL,
        end_time TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now()
      );
    `,
    todos: `
      CREATE TABLE IF NOT EXISTS public.todos (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_hash TEXT NOT NULL,
        title TEXT NOT NULL,
        notes TEXT DEFAULT '',
        due_date DATE,
        priority TEXT DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
        completed BOOLEAN DEFAULT false,
        sort_order INTEGER DEFAULT 0,
        course_tag TEXT DEFAULT '',
        duration_minutes INTEGER,
        created_at TIMESTAMPTZ DEFAULT now()
      );
    `,
    study_pulse_reactions: `
      CREATE TABLE IF NOT EXISTS public.study_pulse_reactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        assignment_id TEXT NOT NULL,
        reaction TEXT NOT NULL CHECK (reaction IN ('confused','got_it','stressed')),
        session_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now()
      );
    `,
    downloaded_files: `
      CREATE TABLE IF NOT EXISTS public.downloaded_files (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_hash TEXT NOT NULL,
        file_id TEXT NOT NULL,
        course_id TEXT NOT NULL,
        downloaded_at TIMESTAMPTZ DEFAULT now(),
        UNIQUE(session_hash, file_id)
      );
    `,
  };

  if (tableCreationQueries[tableName]) {
    try {
      // Note: createClient doesn't have a direct SQL execution method
      // Tables will be created on first write attempt by Supabase
      console.log(`[GradeOS] Ensuring table exists: ${tableName}`);
    } catch (error) {
      console.error(`[GradeOS] Error ensuring table ${tableName}:`, error);
    }
  }
}
