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
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#F5F1E8',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" className={`${grotesk.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
