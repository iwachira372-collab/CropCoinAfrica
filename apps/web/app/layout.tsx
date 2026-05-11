import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CropCoin - Agricultural Finance Platform',
  description: 'Empowering African farmers with digital finance',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
