'use client';

import dynamic from 'next/dynamic';

const PWAInstall = dynamic(() => import('./PWAInstall'), {
  ssr: false,
});

export default function ClientPWAWrapper() {
  return <PWAInstall />;
}
