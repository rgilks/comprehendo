'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import type { MouseEventHandler } from 'react';

export default function SentryExamplePage() {
  useEffect(() => {
    void Sentry.captureMessage('Sentry example page loaded');
    console.log('Page loaded: Sent message to Sentry');

    Sentry.addBreadcrumb({
      category: 'navigation',
      message: 'User visited Sentry example page',
      level: 'info',
    });
    console.log('Page loaded: Added navigation breadcrumb');
  }, []);

  const handleError: MouseEventHandler = () => {
    console.log('Triggering test error...');
    try {
      throw new Error('This is a test error from the Sentry example page');
    } catch (error) {
      void Sentry.captureException(error);
      console.log('Error captured and sent to Sentry');
    }
  };

  const handleReplay: MouseEventHandler = () => {
    console.log('Testing replay functionality...');
    Sentry.addBreadcrumb({
      category: 'ui.click',
      message: 'User clicked replay test button',
      level: 'info',
    });
    console.log('Added click breadcrumb');

    void Sentry.captureMessage('Replay test initiated', 'info');
    console.log('Sent test message to Sentry');
  };

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-2xl font-bold mb-4">Sentry Example Page</h1>
      <div className="space-y-4">
        <button
          onClick={handleError}
          className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
        >
          Trigger Error
        </button>
        <button
          onClick={handleReplay}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Test Replay
        </button>
      </div>
      <div className="mt-8 p-4 bg-gray-800 text-gray-200 rounded">
        <p className="font-mono text-sm">
          Open your browser console to see the actions being performed.
        </p>
        <p className="font-mono text-sm mt-2">
          Check your Sentry dashboard to see the captured events.
        </p>
      </div>
    </div>
  );
}
