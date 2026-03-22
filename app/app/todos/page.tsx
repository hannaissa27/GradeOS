'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useCanvas } from '@/lib/canvas-context';
import { getTodos, createTodo, updateTodo, deleteTodo, reorderTodos, type Todo } from '@/lib/db-queries';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { 
  GripVertical, 
  Plus, 
  Trash2, 
  Calendar as CalendarIcon, 
  ChevronDown, 
  ChevronUp,
  X,
  ArrowLeft
} from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

type FilterOption = 'all' | 'today' | 'high' | 'course';

function SortableTodoCard({ 
  todo, 
  isSelected, 
  onSelect, 
  onToggle, 
  onDelete 
}: { 
  todo: Todo; 
  isSelected: boolean;
  onSelect: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: todo.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const priorityColor = {
    high: 'bg-[oklch(var(--grade-danger))]',
    medium: 'bg-[oklch(var(--grade-warning))]',
    low: 'bg-muted-foreground/50',
  }[todo.priority];

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 100 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'group',
        isDragging && 'z-50'
      )}
    >
      <Card 
        className={cn(
          'transition-all cursor-pointer hover:border-primary/50',
          isSelected && 'border-primary bg-primary/5',
          todo.completed && 'opacity-60'
        )}
        onClick={onSelect}
      >
        <CardContent className="p-3 flex items-center gap-3">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground touch-none"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="w-4 h-4" />
          </button>

          <Checkbox
            checked={todo.completed}
            onCheckedChange={() => onToggle()}
            onClick={(e) => e.stopPropagation()}
            className="flex-shrink-0"
          />

          <div className="flex-1 min-w-0">
            <p className={cn(
              'font-medium truncate',
              todo.completed && 'line-through text-muted-foreground'
            )}>
              {todo.title}
            </p>
            <div className="flex items-center gap-2 mt-1">
              {todo.dueDate && (
                <span className="text-xs text-muted-foreground">
                  {format(new Date(todo.dueDate), 'MMM d')}
                </span>
              )}
              {todo.courseTag && (
                <Badge variant="outline" className="text-xs py-0">
                  {todo.courseTag}
                </Badge>
              )}
              {todo.durationMinutes && (
                <span className="text-xs text-muted-foreground">
                  ~{todo.durationMinutes < 60 ? `${todo.durationMinutes}min` : todo.durationMinutes % 60 === 0 ? `${todo.durationMinutes / 60}h` : `${Math.floor(todo.durationMinutes / 60)}h ${todo.durationMinutes % 60}m`}
                </span>
              )}
            </div>
          </div>

          <div className={cn('w-2 h-2 rounded-full flex-shrink-0', priorityColor)} />

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 opacity-0 group-hover:opacity-100 flex-shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function TodosPage() {
  const { isConnected } = useCanvas();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterOption>('all');
  const [showCompleted, setShowCompleted] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // Add form state
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState<Date | undefined>(undefined);
  const [newPriority, setNewPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [newCourseTag, setNewCourseTag] = useState('');
  const [newDuration, setNewDuration] = useState(60);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    loadTodos();
  }, []);

  const loadTodos = async () => {
    setIsLoading(true);
    try {
      const data = await getTodos();
      setTodos(data);
    } catch (error) {
      console.error('Failed to load todos:', error);
      // Supabase table may not exist - use localStorage fallback
      try {
        const local = JSON.parse(localStorage.getItem('gradeos-todos-local') || '[]');
        setTodos(local);
      } catch {}
    } finally {
      setIsLoading(false);
    }
  };

  const selectedTodo = useMemo(() => 
    todos.find(t => t.id === selectedId), 
    [todos, selectedId]
  );

  const filteredTodos = useMemo(() => {
    const now = new Date();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    return todos.filter(todo => {
      if (!showCompleted && todo.completed) return false;
      
      switch (filter) {
        case 'today':
          if (!todo.dueDate) return false;
          return new Date(todo.dueDate) <= todayEnd;
        case 'high':
          return todo.priority === 'high';
        case 'course':
          return !!todo.courseTag;
        default:
          return true;
      }
    });
  }, [todos, filter, showCompleted]);

  const activeTodos = filteredTodos.filter(t => !t.completed);
  const completedTodos = filteredTodos.filter(t => t.completed);

  const todayTodos = useMemo(() => {
    const now = new Date();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    return activeTodos.filter(t => t.dueDate && new Date(t.dueDate) <= todayEnd);
  }, [activeTodos]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = activeTodos.findIndex(t => t.id === active.id);
    const newIndex = activeTodos.findIndex(t => t.id === over.id);
    
    const reordered = arrayMove(activeTodos, oldIndex, newIndex);
    const updatedTodos = reordered.map((t, idx) => ({ ...t, sortOrder: idx }));
    
    // Optimistic update
    setTodos(prev => [
      ...prev.filter(t => t.completed),
      ...updatedTodos,
    ].sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return a.sortOrder - b.sortOrder;
    }));

    // Persist
    await reorderTodos(updatedTodos.map(t => ({ id: t.id, sortOrder: t.sortOrder })));
  };

  const handleAddTodo = async () => {
    if (!newTitle.trim()) return;

    const localTodo: Todo = {
      id: `local-${Date.now()}`,
      title: newTitle,
      notes: '',
      dueDate: newDate?.toISOString().split('T')[0] || null,
      priority: newPriority,
      completed: false,
      courseTag: newCourseTag || '',
      durationMinutes: newDuration,
      sortOrder: todos.length,
      createdAt: new Date().toISOString(),
    };

    // Add optimistically right away
    setTodos(prev => [localTodo, ...prev]);
    setNewTitle('');
    setNewDate(undefined);
    setNewPriority('medium');
    setNewCourseTag('');
    setNewDuration(60);
    setShowAddForm(false);

    // Try Supabase in background
    try {
      const todo = await createTodo({
        title: localTodo.title,
        dueDate: localTodo.dueDate || undefined,
        priority: localTodo.priority,
        courseTag: localTodo.courseTag || undefined,
        durationMinutes: localTodo.durationMinutes,
      });
      if (todo) {
        // Replace local todo with saved one
        setTodos(prev => prev.map(t => t.id === localTodo.id ? todo : t));
      }
    } catch {
      // Keep local todo — save to localStorage
      const existing = JSON.parse(localStorage.getItem('gradeos-todos-local') || '[]');
      localStorage.setItem('gradeos-todos-local', JSON.stringify([localTodo, ...existing]));
    }
  };

  const handleToggle = async (id: string) => {
    const todo = todos.find(t => t.id === id);
    if (!todo) return;

    // Optimistic update
    setTodos(prev => prev.map(t => 
      t.id === id ? { ...t, completed: !t.completed } : t
    ));

    await updateTodo(id, { completed: !todo.completed });
  };

  const handleDelete = async (id: string) => {
    // Optimistic update
    setTodos(prev => prev.filter(t => t.id !== id));
    if (selectedId === id) setSelectedId(null);
    
    await deleteTodo(id);
  };

  const handleUpdateField = async (id: string, field: keyof Todo, value: unknown) => {
    // Optimistic update
    setTodos(prev => prev.map(t => 
      t.id === id ? { ...t, [field]: value } : t
    ));

    await updateTodo(id, { [field]: value });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <Skeleton className="h-8 w-48" />
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 py-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
            <Skeleton className="h-96" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors" title="Back to dashboard">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-xl font-bold">My Todos</h1>
                <p className="text-xs text-muted-foreground">Personal to-do list, separate from Canvas</p>
              </div>
            </div>
            <Button onClick={() => setShowAddForm(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Task
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-[1fr,400px] gap-6">
          {/* Left Panel - List */}
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              {(['all', 'today', 'high', 'course'] as const).map(f => (
                <Button
                  key={f}
                  variant={filter === f ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter(f)}
                >
                  {f === 'all' && 'All'}
                  {f === 'today' && 'Today'}
                  {f === 'high' && 'High Priority'}
                  {f === 'course' && 'By Course'}
                </Button>
              ))}
            </div>

            {/* Add Form */}
            <AnimatePresence>
              {showAddForm && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card className="mb-4">
                    <CardContent className="p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium">New Task</h3>
                        <Button variant="ghost" size="icon" onClick={() => setShowAddForm(false)}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>

                      <Input
                        placeholder="Task title..."
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddTodo()}
                        autoFocus
                      />

                      <div className="grid grid-cols-2 gap-4">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="justify-start">
                              <CalendarIcon className="w-4 h-4 mr-2" />
                              {newDate ? format(newDate, 'MMM d') : 'Due date'}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={newDate}
                              onSelect={setNewDate}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>

                        <div className="flex gap-1">
                          {(['low', 'medium', 'high'] as const).map(p => (
                            <Button
                              key={p}
                              variant={newPriority === p ? 'default' : 'outline'}
                              size="sm"
                              className="flex-1"
                              onClick={() => setNewPriority(p)}
                            >
                              {p}
                            </Button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <Input
                          placeholder="Course tag (optional)"
                          value={newCourseTag}
                          onChange={(e) => setNewCourseTag(e.target.value)}
                        />

                        <div className="space-y-1">
                          <span className="text-xs text-muted-foreground">
                            Duration: {Math.round(newDuration / 60)}h {newDuration % 60}m
                          </span>
                          <Slider
                            value={[newDuration]}
                            onValueChange={([v]) => setNewDuration(v)}
                            min={15}
                            max={480}
                            step={15}
                          />
                        </div>
                      </div>

                      <Button onClick={handleAddTodo} className="w-full">
                        Add Task
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Today Section */}
            {filter === 'all' && todayTodos.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Today
                </h2>
                <div className="space-y-2">
                  {todayTodos.map(todo => (
                    <SortableTodoCard
                      key={todo.id}
                      todo={todo}
                      isSelected={selectedId === todo.id}
                      onSelect={() => setSelectedId(todo.id)}
                      onToggle={() => handleToggle(todo.id)}
                      onDelete={() => handleDelete(todo.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Main List */}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={activeTodos.map(t => t.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {filter === 'all' && todayTodos.length > 0 && (
                    <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mt-6">
                      Upcoming
                    </h2>
                  )}
                  <AnimatePresence mode="popLayout">
                    {activeTodos.filter(t => 
                      filter !== 'all' || !todayTodos.some(tt => tt.id === t.id)
                    ).map(todo => (
                      <SortableTodoCard
                        key={todo.id}
                        todo={todo}
                        isSelected={selectedId === todo.id}
                        onSelect={() => setSelectedId(todo.id)}
                        onToggle={() => handleToggle(todo.id)}
                        onDelete={() => handleDelete(todo.id)}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </SortableContext>
            </DndContext>

            {/* Empty State */}
            {activeTodos.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-lg">Nothing here yet.</p>
                <p className="text-sm mt-1">Add a task before your professor does.</p>
              </div>
            )}

            {/* Completed Section */}
            {completedTodos.length > 0 && (
              <div className="pt-4">
                <button
                  onClick={() => setShowCompleted(!showCompleted)}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showCompleted ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  Completed ({completedTodos.length})
                </button>

                <AnimatePresence>
                  {showCompleted && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-2 mt-2"
                    >
                      {completedTodos.map(todo => (
                        <SortableTodoCard
                          key={todo.id}
                          todo={todo}
                          isSelected={selectedId === todo.id}
                          onSelect={() => setSelectedId(todo.id)}
                          onToggle={() => handleToggle(todo.id)}
                          onDelete={() => handleDelete(todo.id)}
                        />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Right Panel - Detail */}
          <div className="hidden lg:block">
            {selectedTodo ? (
              <Card className="sticky top-24">
                <CardContent className="p-6 space-y-6">
                  <Input
                    value={selectedTodo.title}
                    onChange={(e) => handleUpdateField(selectedTodo.id, 'title', e.target.value)}
                    onBlur={() => {}}
                    className="text-lg font-medium border-0 p-0 h-auto focus-visible:ring-0"
                    placeholder="Task title..."
                  />

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Notes</label>
                    <Textarea
                      value={selectedTodo.notes || ''}
                      onChange={(e) => handleUpdateField(selectedTodo.id, 'notes', e.target.value)}
                      placeholder="Add notes..."
                      className="min-h-[120px] resize-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Due Date</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start">
                          <CalendarIcon className="w-4 h-4 mr-2" />
                          {selectedTodo.dueDate 
                            ? format(new Date(selectedTodo.dueDate), 'MMMM d, yyyy')
                            : 'Set due date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={selectedTodo.dueDate ? new Date(selectedTodo.dueDate) : undefined}
                          onSelect={(date) => handleUpdateField(
                            selectedTodo.id, 
                            'dueDate', 
                            date?.toISOString().split('T')[0]
                          )}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Priority</label>
                    <div className="flex gap-2">
                      {(['low', 'medium', 'high'] as const).map(p => (
                        <Button
                          key={p}
                          variant={selectedTodo.priority === p ? 'default' : 'outline'}
                          size="sm"
                          className="flex-1"
                          onClick={() => handleUpdateField(selectedTodo.id, 'priority', p)}
                        >
                          {p}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Course Tag</label>
                    <Input
                      value={selectedTodo.courseTag || ''}
                      onChange={(e) => handleUpdateField(selectedTodo.id, 'courseTag', e.target.value)}
                      placeholder="e.g., CS 101"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">
                      Duration: {Math.round((selectedTodo.durationMinutes || 60) / 60)}h {(selectedTodo.durationMinutes || 60) % 60}m
                    </label>
                    <Slider
                      value={[selectedTodo.durationMinutes || 60]}
                      onValueChange={([v]) => handleUpdateField(selectedTodo.id, 'durationMinutes', v)}
                      min={15}
                      max={480}
                      step={15}
                    />
                  </div>

                  <Button 
                    variant="destructive" 
                    className="w-full"
                    onClick={() => handleDelete(selectedTodo.id)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Task
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card className="sticky top-24">
                <CardContent className="p-6 text-center text-muted-foreground py-24">
                  <p>Select a task to view details</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
