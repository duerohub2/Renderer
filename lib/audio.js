export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
export const MAX_AUDIO_SECONDS = 300;

// Menerima File atau Blob, mengembalikan AudioBuffer.
export async function decodeAudioFile(file) {
  if (file.size > MAX_AUDIO_BYTES) throw new Error('FILE AUDIO TERLALU BESAR (MAKS. 25 MB).');

  const AudioContextClass = typeof window !== 'undefined' ? window.AudioContext || window.webkitAudioContext : null;
  if (!AudioContextClass) throw new Error('BROWSER TIDAK MENDUKUNG PEMBACAAN AUDIO.');

  const bytes = await file.arrayBuffer();
  const context = new AudioContextClass();
  let buffer;
  try {
    buffer = await new Promise((resolve, reject) => {
      context.decodeAudioData(bytes, resolve, reject);
    });
  } catch {
    throw new Error('FORMAT AUDIO TIDAK DIKENALI. COBA MP3, WAV, ATAU M4A.');
  } finally {
    context.close().catch(() => {});
  }

  if (buffer.duration > MAX_AUDIO_SECONDS) throw new Error('AUDIO TERLALU PANJANG (MAKS. 5 MENIT). POTONG DULU.');
  return buffer;
}
