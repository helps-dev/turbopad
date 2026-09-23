import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TurboPad — terminal & launchpad on Robinhood Chain',
  description:
    'Live meme and RWA markets, holder concentration risk, and wallet-signed token launches on Robinhood Chain.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
