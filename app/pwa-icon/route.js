import { ImageResponse } from 'next/og';

export const runtime = 'edge';

const SIZES = [64, 180, 192, 512];
const LETTER_R = 'M176 410 V142 H286 a74 74 0 0 1 0 148 H176 M270 290 L352 410';

function stroke(color, width) {
  return `<path d="${LETTER_R}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linejoin="miter" stroke-linecap="butt"/>`;
}

function buildSvg(size) {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">`,
    '<rect width="512" height="512" fill="#FFE500"/>',
    '<g transform="translate(25.6 25.6) scale(0.9)">',
    `<g transform="translate(16 16)">${stroke('#0A0A0A', 84)}</g>`,
    stroke('#0A0A0A', 84),
    stroke('#FFFFFF', 52),
    '<circle cx="424" cy="96" r="40" fill="#FF3B30" stroke="#0A0A0A" stroke-width="14"/>',
    '</g>',
    '</svg>',
  ].join('');
}

export async function GET(request) {
  const requested = Number(new URL(request.url).searchParams.get('s'));
  const size = SIZES.includes(requested) ? requested : 512;
  const src = `data:image/svg+xml;utf8,${encodeURIComponent(buildSvg(size))}`;

  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: '100%', height: '100%' }}>
        <img src={src} width={size} height={size} alt="" />
      </div>
    ),
    { width: size, height: size, headers: { 'cache-control': 'public, max-age=86400' } },
  );
}
