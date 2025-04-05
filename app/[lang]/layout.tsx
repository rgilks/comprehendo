import type { Metadata } from 'next';
import '../globals.css';

export const metadata: Metadata = {
  title: 'Comprehendo',
  description: 'An AI-powered language learning tool',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
