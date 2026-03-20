import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground">
      <div className="text-center space-y-6">
        <div className="space-y-2">
          <h1 className="text-6xl font-bold">404</h1>
          <p className="text-xl text-muted-foreground">Page not found</p>
        </div>
        
        <p className="text-muted-foreground max-w-sm">
          This page doesn't exist. Head back to the app to get started.
        </p>
        
        <Link href="/">
          <Button>Return Home</Button>
        </Link>
      </div>
    </div>
  );
}
