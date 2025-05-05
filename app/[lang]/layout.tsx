import type { Metadata } from 'next';
import '../globals.css';

export const metadata: Metadata = {
  title: 'Comprehendo',
  description: 'An AI-powered language learning tool',
};

// This layout is nested within app/layout.tsx
// It receives params.lang, but the <html> and <body> tags are defined in the parent.
const RootLayout = ({ children }: { children: React.ReactNode }) => {
  // We don't render <html> or <body> here.
  // We also don't need to access params.lang here, as the lang attribute
  // should be handled by the top-level layout based on cookies/headers/middleware.
  return children;
};

export default RootLayout;
