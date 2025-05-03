import type { Metadata } from 'next';
import '../globals.css';

export const metadata: Metadata = {
  title: 'Comprehendo',
  description: 'An AI-powered language learning tool',
};

const RootLayout = ({ children }: { children: React.ReactNode }) => (
  <html>
    <body>{children}</body>
  </html>
);

export default RootLayout;
