import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { canvasUrl, accessToken, path } = await request.json();

    if (!canvasUrl || !accessToken || !path) {
      return NextResponse.json(
        { error: 'Missing required fields: canvasUrl, accessToken, path' },
        { status: 400 }
      );
    }

    // Validate URL format
    let normalizedUrl = canvasUrl.trim();
    if (!normalizedUrl.startsWith('http')) {
      normalizedUrl = `https://${normalizedUrl}`;
    }
    if (normalizedUrl.endsWith('/')) {
      normalizedUrl = normalizedUrl.slice(0, -1);
    }

    const apiUrl = `${normalizedUrl}/api/v1${path}`;
    
    const response = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.status === 401) {
      return NextResponse.json(
        { error: 'Invalid or expired Canvas token. Please generate a new token from your Canvas settings.' },
        { status: 401 }
      );
    }

    if (response.status === 403) {
      return NextResponse.json(
        { error: 'Access denied. Please check your Canvas token permissions.' },
        { status: 403 }
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Canvas API error: ${response.status} ${response.statusText}`, details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('[Canvas API Route] path:', path, 'status:', response.status, 'data type:', Array.isArray(data) ? `array[${data.length}]` : typeof data);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[Canvas Proxy] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to connect to Canvas' },
      { status: 500 }
    );
  }
}
