// src/app/layout.tsx

import type { Metadata } from 'next';
import { Providers } from './providers';
import './globals.css';

// Define site metadata
export const metadata: Metadata = {
  title: 'Cortaku - App Hub',
  description: 'Cortaku\'s self-hosted application hub.',
};

// Define the RootLayout component
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head />
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}