// src/app/providers.tsx
// Client component to wrap the application with ThemeProvider from next-themes
// Configured to default to light theme.

'use client'; // This component uses client-side features

import { ThemeProvider } from 'next-themes';
import { useState, useEffect } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  // Ensure the component only renders on the client side where theme can be determined
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Avoid rendering ThemeProvider on the server to prevent hydration mismatch
  if (!mounted) {
    // Render children directly on the server/initially to avoid layout shifts
    // or return null/loading state if preferred
    return <>{children}</>;
  }

  return (
    // Wrap children with ThemeProvider
    // attribute="class" enables class-based dark mode (works with Tailwind's darkMode: 'class')
    // defaultTheme="light" sets light mode as the initial theme
    // enableSystem={false} prevents overriding the default with the system preference
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      {children}
    </ThemeProvider>
  );
}
