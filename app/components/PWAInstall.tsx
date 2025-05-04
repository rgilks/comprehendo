'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BeforeInstallPromptEvent } from '../../types/pwa';

let deferredPrompt: BeforeInstallPromptEvent | null = null;

const PWAInstall = () => {
  const [showInstallButton, setShowInstallButton] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      return;
    }

    const beforeInstallHandler = (e: Event) => {
      e.preventDefault();
      deferredPrompt = e as BeforeInstallPromptEvent;
      setShowInstallButton(true);
    };

    const appInstalledHandler = () => {
      setShowInstallButton(false);
      deferredPrompt = null;
    };

    window.addEventListener('beforeinstallprompt', beforeInstallHandler);
    window.addEventListener('appinstalled', appInstalledHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', beforeInstallHandler);
      window.removeEventListener('appinstalled', appInstalledHandler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();

      const { outcome } = await deferredPrompt.userChoice;
      console.log(`[PWA Install] User choice: ${outcome}`);
    } catch (error) {
      console.error('[PWA Install] Error during install prompt:', error);
    } finally {
      deferredPrompt = null;
      setShowInstallButton(false);
    }
  };

  if (!showInstallButton) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-blue-600 text-white p-4 rounded-lg shadow-lg">
      <p className="mb-2">{t('pwa.installPrompt')}</p>
      <button
        onClick={() => {
          void handleInstallClick();
        }}
        className="bg-white text-blue-600 px-4 py-2 rounded font-medium hover:bg-blue-50"
      >
        {t('pwa.installButton')}
      </button>
    </div>
  );
};

export default PWAInstall;
