'use client';

import { useEffect, useState } from 'react';

// Define a proper type for the deferred prompt
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;

export default function PWAInstall() {
  const [showInstallButton, setShowInstallButton] = useState(false);

  useEffect(() => {
    // Check if the app is already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      return;
    }

    // Listen for the beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', (e) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault();
      // Store the event so it can be triggered later
      deferredPrompt = e as BeforeInstallPromptEvent;
      // Show the install button
      setShowInstallButton(true);
    });

    // Hide the button if the app is installed
    window.addEventListener('appinstalled', () => {
      setShowInstallButton(false);
      deferredPrompt = null;
    });
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Show the install prompt
    try {
      await deferredPrompt.prompt();

      // Wait for the user to respond to the prompt
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`[PWA Install] User choice: ${outcome}`);
    } catch (error) {
      console.error('[PWA Install] Error during install prompt:', error);
    } finally {
      // We no longer need the prompt regardless of outcome
      deferredPrompt = null;
      // Hide the button
      setShowInstallButton(false);
    }
  };

  if (!showInstallButton) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-blue-600 text-white p-4 rounded-lg shadow-lg">
      <p className="mb-2">Install Comprehendo for offline use!</p>
      <button
        onClick={() => {
          void handleInstallClick();
        }}
        className="bg-white text-blue-600 px-4 py-2 rounded font-medium hover:bg-blue-50"
      >
        Install App
      </button>
    </div>
  );
}
