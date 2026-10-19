export const LIMITS = {
  minSize: 64,
  maxWidth: 1920,
  maxHeight: 1920,
  minDuration: 1,
  maxDuration: 90,
  minFps: 12,
  maxFps: 60,
};
const BITRATE = 5_000_000;
const AUDIO_SAMPLE_RATE = 48000;
const WEBCODECS_ERROR =
  'Browser tidak support WebCodecs. Pakai Chrome/Edge/Safari 16.4+';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const snap = (value, min, max, step) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.round(n / step) * step));
};
export function normalizeSettings(settings) {
  return {
    width: snap(settings.width, LIMITS.minSize, LIMITS.maxWidth, 2),
    height: snap(settings.height, LIMITS.minSize, LIMITS.maxHeight, 2),
    duration: snap(settings.duration, LIMITS.minDuration, LIMITS.maxDuration, 1),
    fps: snap(settings.fps, LIMITS.minFps, LIMITS.maxFps, 1),
    format: settings.format === 'webm' ? 'webm' : 'mp4',
    bitrate: [2_500_000, 5_000_000, 10_000_000].includes(
      Number(settings.bitrate)
    )
      ? Number(settings.bitrate)
      : BITRATE,
    background: /^#[0-9a-f]{6}$/i.test(String(settings.background))
      ? String(settings.background)
      : '#ffffff',
    speed: [0.25, 0.5, 1, 2, 4].includes(Number(settings.speed))
      ? Number(settings.speed)
      : 1,
    virtualTime: Boolean(settings.virtualTime),
    audioVolume: [0.5, 1, 1.5].includes(Number(settings.audioVolume))
      ? Number(settings.audioVolume)
      : 1,
    audioStart: Math.min(
      3600,
      Math.max(0, Math.round((Number(settings.audioStart) || 0) * 10) / 10)
    ),
    audioLoop: settings.audioLoop === undefined
      ? true
      : Boolean(settings.audioLoop),
    audioFade: Boolean(settings.audioFade),
  };
}
export function isWebCodecsSupported() {
  return (
    typeof window !== 'undefined' &&
    Boolean(window.VideoEncoder) &&
    Boolean(window.VideoFrame)
  );
}
// Jam virtual untuk animasi JavaScript.
const VIRTUAL_CLOCK = `(function(){
var now=0,base=Date.now(),seq=0,rafs=[],timers=[],win=window;
performance.now=function(){return now};
Date.now=function(){return base+now};
win.requestAnimationFrame=function(cb){
  seq++;
  rafs.push({id:seq,cb:cb});
  return seq;
};
win.cancelAnimationFrame=function(id){
  rafs=rafs.filter(function(r){return r.id!==id});
};
function add(fn,ms,args,repeat){
  seq++;
  var d=Math.max(0,Number(ms)||0);
  timers.push({
    id:seq,
    fn:fn,
    at:now+d,
    ms:Math.max(d,1),
    args:args,
    repeat:repeat
  });
  return seq;
}
win.setTimeout=function(fn,ms){
  return add(fn,ms,Array.prototype.slice.call(arguments,2),false);
};
win.setInterval=function(fn,ms){
  return add(fn,ms,Array.prototype.slice.call(arguments,2),true);
};
win.clearTimeout=win.clearInterval=function(id){
  timers=timers.filter(function(t){return t.id!==id});
};
win.__virtualClock={
  advance:function(target){
    var guard=0;
    // Jalankan timer yang jatuh tempo secara kronologis.
    while(guard++<10000){
      var next=null;
      for(var i=0;i<timers.length;i++){
        if(
          timers[i].at<=target &&
          (!next||timers[i].at<next.at)
        ){
          next=timers[i];
        }
      }
      if(!next)break;
      now=Math.max(now,next.at);
      if(next.repeat){
        next.at+=next.ms;
      }else{
        timers=timers.filter(function(t){return t!==next});
      }
      if(typeof next.fn==='function'){
        try{
          next.fn.apply(win,next.args);
        }catch(e){}
      }
    }
    now=target;
    // Jalankan batch RAF untuk frame virtual ini.
    // RAF yang dijadwalkan ulang akan dijalankan pada
    // advance berikutnya, sama seperti frame berikutnya.
    var cbs=rafs;
    rafs=[];
    for(var j=0;j<cbs.length;j++){
      try{
        cbs[j].cb(now);
      }catch(e){}
    }
  }
};
})();`;
function injectVirtualClock(code) {
  const tag = `<script>${VIRTUAL_CLOCK}</script>`;
  if (/<head[^>]*>/i.test(code)) {
    return code.replace(/<head[^>]*>/i, (match) => match + tag);
  }
  if (/<html[^>]*>/i.test(code)) {
    return code.replace(/<html[^>]*>/i, (match) => match + tag);
  }
  return tag + code;
}
function throwIfAborted(signal) {
  if (signal && signal.aborted) {
    throw new DOMException('Render dibatalkan', 'AbortError');
  }
}
function createOffscreenFrame(code, width, height, virtualTime) {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText =
      `position:fixed;left:-9999px;top:0;width:${width}px;height:${height}px;border:0;`;
    const timer = setTimeout(() => {
      iframe.remove();
      reject(new Error('Gagal memuat HTML (timeout 15 detik).'));
    }, 15000);
    iframe.onload = () => {
      clearTimeout(timer);
      resolve(iframe);
    };
    iframe.srcdoc = virtualTime ? injectVirtualClock(code) : code;
    document.body.appendChild(iframe);
  });
}
// Sinkronkan animasi CSS, transition, dan WAAPI
// ke waktu frame yang sedang direkam.
function seekAnimations(doc, timeMs) {
  if (!doc || !doc.documentElement) return;
  const root = doc.documentElement;
  let animations = [];
  try {
    // Document.getAnimations() mengambil animasi pada dokumen,
    // termasuk animasi elemen turunannya.
    animations = typeof doc.getAnimations === 'function'
      ? doc.getAnimations()
      : root.getAnimations({ subtree: true });
  } catch {
    try {
      animations = root.getAnimations({ subtree: true });
    } catch {
      return;
    }
  }
  for (const animation of animations) {
    try {
      // Jangan mengubah currentTime jika animasi tidak mendukung
      // pengaturan waktu secara langsung.
      animation.pause();
      animation.currentTime = timeMs;
    } catch {
      // Lewati animasi yang tidak dapat di-seek.
    }
  }
  // Paksa layout dihitung agar posisi visual animasi diterapkan
  // sebelum html2canvas mengambil gambar.
  try {
    void root.offsetHeight;
    void root.getBoundingClientRect();
  } catch {
    // Lanjutkan jika layout tidak dapat dipaksa.
  }
}
async function pickEncoderConfig(format, width, height, fps, bitrate) {
  const codecs = format === 'mp4'
    ? [
        'avc1.640028',
        'avc1.64002A',
        'avc1.4D0028',
        'avc1.42E028'
      ]
    : [
        'vp09.00.10.08',
        'vp09.00.40.08',
        'vp09.00.50.08'
      ];
  for (const codec of codecs) {
    const config = { codec, width, height, bitrate, framerate: fps };
    if (format === 'mp4') {
      config.avc = { format: 'avc' };
    }
    try {
      const support = await VideoEncoder.isConfigSupported(config);
      if (support && support.supported) return config;
    } catch {
      // Coba codec berikutnya.
    }
  }
  throw new Error(
    `Encoder ${format.toUpperCase()} tidak tersedia untuk ${width}x${height} @ ${fps}fps di browser ini.`
  );
}
// Pilih encoder audio: AAC untuk MP4 (cadangan Opus),
// dan Opus untuk WebM.
async function pickAudioConfig(format) {
  const candidates = format === 'mp4'
    ? [
        { codec: 'mp4a.40.2', muxerCodec: 'aac' },
        { codec: 'opus', muxerCodec: 'opus' }
      ]
    : [
        { codec: 'opus', muxerCodec: 'A_OPUS' }
      ];
  for (const candidate of candidates) {
    const config = {
      codec: candidate.codec,
      sampleRate: AUDIO_SAMPLE_RATE,
      numberOfChannels: 2,
      bitrate: 128_000
    };
    try {
      const support = await AudioEncoder.isConfigSupported(config);
      if (support && support.supported) {
        return { config, muxerCodec: candidate.muxerCodec };
      }
    } catch {
      // Coba kandidat berikutnya.
    }
  }
  throw new Error(
    'Browser belum mendukung encode audio untuk format ini. Hapus audio atau pakai Chrome terbaru.'
  );
}
// Potong, ulang, atur volume dan fade audio.
async function mixAudio(audio, duration) {
  const OfflineContext =
    window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!OfflineContext) {
    throw new Error('Browser tidak mendukung pemrosesan audio.');
  }
  const context = new OfflineContext(
    2,
    Math.ceil(duration * AUDIO_SAMPLE_RATE),
    AUDIO_SAMPLE_RATE
  );
  const source = context.createBufferSource();
  source.buffer = audio.buffer;
  const offset = Math.min(
    Math.max(0, audio.startAt),
    Math.max(0, audio.buffer.duration - 0.05)
  );
  if (audio.loop) {
    source.loop = true;
    source.loopStart = offset;
    source.loopEnd = audio.buffer.duration;
  }
  const gain = context.createGain();
  if (audio.fade) {
    const fadeSeconds = Math.min(1, duration / 2);
    gain.gain.setValueAtTime(0, 0);
    gain.gain.linearRampToValueAtTime(audio.volume, fadeSeconds);
    gain.gain.setValueAtTime(
      audio.volume,
      Math.max(fadeSeconds, duration - fadeSeconds)
    );
    gain.gain.linearRampToValueAtTime(0, duration);
  } else {
    gain.gain.setValueAtTime(audio.volume, 0);
  }
  source.connect(gain);
  gain.connect(context.destination);
  source.start(0, offset);
  return context.startRendering();
}
// Kirim potongan audio yang sesuai dengan frame video.
function feedAudio(audioEncoder, rendered, frameIndex, fps) {
  const from = Math.round((frameIndex * AUDIO_SAMPLE_RATE) / fps);
  const to = Math.min(
    Math.round(((frameIndex + 1) * AUDIO_SAMPLE_RATE) / fps),
    rendered.length
  );
  const frames = to - from;
  if (frames <= 0) return;
  const planar = new Float32Array(frames * 2);
  planar.set(rendered.getChannelData(0).subarray(from, to), 0);
  planar.set(rendered.getChannelData(1).subarray(from, to), frames);
  const data = new AudioData({
    format: 'f32-planar',
    sampleRate: AUDIO_SAMPLE_RATE,
    numberOfFrames: frames,
    numberOfChannels: 2,
    timestamp: Math.round((from * 1_000_000) / AUDIO_SAMPLE_RATE),
    data: planar
  });
  audioEncoder.encode(data);
  data.close();
}
async function createMuxer(format, width, height, fps, audioCodec) {
  if (format === 'mp4') {
    const { Muxer, ArrayBufferTarget } = await import('mp4-muxer');
    const target = new ArrayBufferTarget();
    const options = {
      target,
      video: {
        codec: 'avc',
        width,
        height,
        frameRate: fps
      },
      fastStart: 'in-memory'
    };
    if (audioCodec) {
      options.audio = {
        codec: audioCodec,
        numberOfChannels: 2,
        sampleRate: AUDIO_SAMPLE_RATE
      };
    }
    const muxer = new Muxer(options);
    return { muxer, target, mime: 'video/mp4' };
  }
  const { Muxer, ArrayBufferTarget } = await import('webm-muxer');
  const target = new ArrayBufferTarget();
  const options = {
    target,
    video: {
      codec: 'V_VP9',
      width,
      height,
      frameRate: fps
    }
  };
  if (audioCodec) {
    options.audio = {
      codec: audioCodec,
      numberOfChannels: 2,
      sampleRate: AUDIO_SAMPLE_RATE
    };
  }
  const muxer = new Muxer(options);
  return { muxer, target, mime: 'video/webm' };
}
export async function renderVideo({
  code,
  width,
  height,
  duration,
  fps,
  format,
  bitrate = BITRATE,
  background = '#ffffff',
  speed = 1,
  virtualTime = false,
  audio = null,
  onProgress = () => {},
  signal
}) {
  if (typeof window === 'undefined' || !window.VideoEncoder) {
    throw new Error(WEBCODECS_ERROR);
  }
  if (!isWebCodecsSupported()) {
    throw new Error(WEBCODECS_ERROR);
  }
  const totalFrames = duration * fps;
  const startedAt = performance.now();
  let captureStartedAt = 0;
  const emit = (phase, current) => {
    const now = performance.now();
    const captureElapsed = captureStartedAt
      ? now - captureStartedAt
      : 0;
    const etaMs =
      phase === 'capture' && current > 0 && captureElapsed > 0
        ? (captureElapsed / current) * (totalFrames - current)
        : null;
    onProgress({
      phase,
      current,
      total: totalFrames,
      elapsedMs: now - startedAt,
      etaMs
    });
  };
  let iframe = null;
  let encoder = null;
  let audioEncoder = null;
  try {
    emit('prepare', 0);
    iframe = await createOffscreenFrame(
      code,
      width,
      height,
      virtualTime
    );
    await sleep(500);
    throwIfAborted(signal);
    const doc = iframe.contentDocument;
    if (!doc) {
      throw new Error('Dokumen iframe tidak bisa diakses.');
    }
    try {
      if (doc.fonts && doc.fonts.ready) {
        await doc.fonts.ready;
      }
    } catch {
      // Abaikan kegagalan font.
    }
    const clock = virtualTime
      ? iframe.contentWindow.__virtualClock
      : null;
    if (clock) {
      clock.advance(0);
    }
    seekAnimations(doc, 0);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Browser gagal membuat canvas render.');
    }
    const config = await pickEncoderConfig(
      format,
      width,
      height,
      fps,
      bitrate
    );
    let audioSetup = null;
    let mixed = null;
    if (audio && audio.buffer) {
      if (!window.AudioEncoder || !window.AudioData) {
        throw new Error(
          'Browser belum mendukung encode audio. Hapus audio atau pakai Chrome terbaru.'
        );
      }
      audioSetup = await pickAudioConfig(format);
      mixed = await mixAudio(audio, duration);
      throwIfAborted(signal);
    }
    const { muxer, target, mime } = await createMuxer(
      format,
      width,
      height,
      fps,
      audioSetup ? audioSetup.muxerCodec : null
    );
    let encoderError = null;
    encoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: (err) => {
        encoderError = err;
      }
    });
    encoder.configure(config);
    let audioError = null;
    if (audioSetup) {
      audioEncoder = new AudioEncoder({
        output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
        error: (err) => {
          audioError = err;
        }
      });
      audioEncoder.configure(audioSetup.config);
    }
    const html2canvas = (await import('html2canvas')).default;
    const frameDurationUs = Math.round(1_000_000 / fps);
    const body = doc.body || doc.documentElement;
    captureStartedAt = performance.now();
    for (let i = 0; i < totalFrames; i++) {
      throwIfAborted(signal);
      if (encoderError) {
        throw new Error(`Encoder gagal: ${encoderError.message}`);
      }
      if (audioError) {
        throw new Error(`Encoder audio gagal: ${audioError.message}`);
      }
      // Waktu berdasarkan nomor frame, bukan waktu nyata.
      const timeMs = (i / fps) * 1000 * speed;
      if (clock) {
        clock.advance(timeMs);
      }
      seekAnimations(doc, timeMs);
      // Pastikan perubahan style/layout diterapkan sebelum capture.
      void body.offsetHeight;
      void body.getBoundingClientRect();
      const captured = await html2canvas(doc.documentElement, {
        width,
        height,
        windowWidth: width,
        windowHeight: height,
        x: 0,
        y: 0,
        scrollX: 0,
        scrollY: 0,
        backgroundColor: background,
        scale: 1,
        useCORS: true,
        logging: false,
        // Sinkronkan juga animasi pada dokumen klon html2canvas.
        onclone: (clonedDoc) => {
          seekAnimations(clonedDoc, timeMs);
        }
      });
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(captured, 0, 0, width, height);
      const bitmap = await createImageBitmap(canvas);
      const frame = new VideoFrame(bitmap, {
        timestamp: Math.round((i * 1_000_000) / fps),
        duration: frameDurationUs
      });
      encoder.encode(frame, {
        keyFrame: i % fps === 0
      });
      frame.close();
      bitmap.close();
      if (audioEncoder) {
        feedAudio(audioEncoder, mixed, i, fps);
      }
      emit('capture', i + 1);
      while (encoder.encodeQueueSize > 8) {
        await sleep(10);
      }
      if (i % 5 === 4) {
        await sleep(0);
      }
    }
    emit('finalize', totalFrames);
    await encoder.flush();
    if (audioEncoder) {
      await audioEncoder.flush();
    }
    if (audioError) {
      throw new Error(`Encoder audio gagal: ${audioError.message}`);
    }
    if (encoderError) {
      throw new Error(`Encoder gagal: ${encoderError.message}`);
    }
    muxer.finalize();
    const blob = new Blob([target.buffer], { type: mime });
    const url = URL.createObjectURL(blob);
    return {
      blob,
      url,
      size: blob.size,
      width,
      height,
      duration,
      fps,
      format,
      mime,
      hasAudio: Boolean(audioSetup),
      extension: format === 'webm' ? 'webm' : 'mp4'
    };
  } finally {
    if (iframe) {
      iframe.remove();
    }
    if (encoder && encoder.state !== 'closed') {
      try {
        encoder.close();
      } catch {
        // Encoder mungkin sudah tertutup.
      }
    }
    if (audioEncoder && audioEncoder.state !== 'closed') {
      try {
        audioEncoder.close();
      } catch {
        // Encoder audio mungkin sudah tertutup.
      }
    }
  }
}
