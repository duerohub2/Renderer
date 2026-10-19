export default function manifest() {
  return {
    name: 'RENDERIZER',
    short_name: 'RENDERIZER',
    description: 'Render kode HTML/CSS/JS menjadi video MP4 atau WebM langsung di browser.',
    start_url: '/',
    display: 'browser',
    background_color: '#F5F1E8',
    theme_color: '#FFE500',
    lang: 'id',
    icons: [
      { src: '/pwa-icon?s=192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/pwa-icon?s=512', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  };
}
