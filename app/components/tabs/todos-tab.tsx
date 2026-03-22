'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function TodosTab() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Your Todos</CardTitle>
            <CardDescription>
              Custom tasks and assignments
            </CardDescription>
          </div>
          <Button size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Add Todo
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground space-y-3">
          <CheckCircle2 className="w-8 h-8 text-muted-foreground/50" />
          <p className="text-sm">No todos yet. Create one to get started!</p>
        </CardContent>
      </Card>
    </div>
  );
}
