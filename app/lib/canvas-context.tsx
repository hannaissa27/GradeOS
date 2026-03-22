'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { CanvasConnection } from './types';
import { validateToken } from './canvas-service';

interface CanvasContextType {
  connection: CanvasConnection;
  isConnected: boolean;
  connectWithToken: (url: string, token: string) => Promise<void>;
  disconnect: () => void;
  error: string | null;
}

const CanvasContext = createContext<CanvasContextType | undefined>(undefined);

export function CanvasProvider({ children }: { children: React.ReactNode }) {
  const [connection, setConnection] = useState<CanvasConnection>({
    canvasUrl: '',
    accessToken: '',
    connected: false,
    userName: '',
  });
  const [error, setError] = useState<string | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('canvas_connection');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setConnection(parsed);
      } catch (e) {
        console.error('[GradeOS] Failed to parse Canvas connection:', e);
      }
    }
  }, []);

  const connectWithToken = async (url: string, token: string) => {
    setError(null);
    
    // Normalize URL
    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith('http')) {
      normalizedUrl = `https://${normalizedUrl}`;
    }
    if (normalizedUrl.endsWith('/')) {
      normalizedUrl = normalizedUrl.slice(0, -1);
    }

    const result = await validateToken(normalizedUrl, token);

    // Handle demo mode
    if (result.isDemo) {
      const demoConnection: CanvasConnection = {
        canvasUrl: '',
        accessToken: '',
        connected: false, // Use mock data
        userName: result.userName,
      };
      setConnection(demoConnection);
      localStorage.setItem('canvas_connection', JSON.stringify(demoConnection));
      return;
    }

    if (!result.connected && result.error) {
      setError(result.error);
      throw new Error(result.error);
    }

    const newConnection: CanvasConnection = {
      canvasUrl: normalizedUrl,
      accessToken: token,
      connected: true,
      userName: result.userName,
    };

    setConnection(newConnection);
    localStorage.setItem('canvas_connection', JSON.stringify(newConnection));
  };

  const disconnect = () => {
    setConnection({
      canvasUrl: '',
      accessToken: '',
      connected: false,
      userName: '',
    });
    setError(null);
    localStorage.removeItem('canvas_connection');
  };

  return (
    <CanvasContext.Provider value={{ connection, isConnected: connection.connected, connectWithToken, disconnect, error }}>
      {children}
    </CanvasContext.Provider>
  );
}

export function useCanvas() {
  const context = useContext(CanvasContext);
  if (context === undefined) {
    throw new Error('useCanvas must be used within CanvasProvider');
  }
  return context;
}
