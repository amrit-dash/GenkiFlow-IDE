
'use client'; // Error components must be Client Components

import type React from 'react';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service in a real app
    console.error("Caught by root error.tsx:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-6 text-center">
      <h1 className="text-4xl font-bold text-destructive mb-4">Application Error</h1>
      <p className="text-xl text-muted-foreground mb-2">
        Something went wrong while trying to render this page.
      </p>
      {error.message && (
        <p className="text-md bg-destructive/10 p-3 rounded-md text-destructive-foreground mb-4">
          <strong>Error Message:</strong> {error.message}
        </p>
      )}
      {error.digest && (
        <p className="text-sm text-muted-foreground mb-6">
          Error Digest: {error.digest}
        </p>
      )}
      <div className="flex gap-4">
        <Button
          onClick={
            // Attempt to recover by trying to re-render the segment
            () => reset()
          }
          variant="destructive"
          size="lg"
        >
          Try Again
        </Button>
        <Link href="/" passHref>
          <Button variant="outline" size="lg">
            Go to Homepage
          </Button>
        </Link>
      </div>
    </div>
  );
}
