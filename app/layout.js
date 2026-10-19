import { Space_Grotesk, Space_Mono } from 'next/font/google';
import './globals.css';

const grotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '700'],
  variable: '--font-grotesk',
  display: 'swap',
});

const mono = Space_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata = {
  title: 'RENDERIZER - HTML JADI VIDEO',
  description: 'Render kode HTML/CSS/JS menjadi video MP4 atau WebM langsung di browser.',
  applicationName: 'RENDERIZER',
  icons: {
    icon: [
      { url: '/pwa-icon?s=64', sizes: '64x64', type: 'image/png' },
      { url: '/pwa-icon?s=192', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/pwa-icon?s=180', sizes: '180x180', type: 'image/png' }],
  },
  other: {
    'apple-mobile-web-app-title': 'RENDERIZER',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#FFE500',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" className={`${grotesk.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
