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
const WEBCODECS_ERROR = 'Browser tidak support WebCodecs. Pakai Chrome/Edge/Safari 16.4+';

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
    bitrate: [2_500_000, 5_000_000, 10_000_000].includes(Number(settings.bitrate)) ? Number(settings.bitrate) : BITRATE,
    background: /^#[0-9a-f]{6}$/i.test(String(settings.background)) ? String(settings.background) : '#ffffff',
    speed: [0.25, 0.5, 1, 2, 4].includes(Number(settings.speed)) ? Number(settings.speed) : 1,
    virtualTime: Boolean(settings.virtualTime),
  };
}

export function isWebCodecsSupported() {
  return typeof window !== 'undefined' && Boolean(window.VideoEncoder) && Boolean(window.VideoFrame);
}

// Jam virtual untuk animasi JS: requestAnimationFrame, setTimeout, setInterval, performance.now, Date.now.
const VIRTUAL_CLOCK = `(function(){
var now=0,base=Date.now(),seq=0,rafs=[],timers=[],win=window;
performance.now=function(){return now};
Date.now=function(){return base+now};
win.requestAnimationFrame=function(cb){seq++;rafs.push({id:seq,cb:cb});return seq};
win.cancelAnimationFrame=function(id){rafs=rafs.filter(function(r){return r.id!==id})};
function add(fn,ms,args,repeat){seq++;var d=Math.max(0,Number(ms)||0);timers.push({id:seq,fn:fn,at:now+d,ms:Math.max(d,1),args:args,repeat:repeat});return seq}
win.setTimeout=function(fn,ms){return add(fn,ms,Array.prototype.slice.call(arguments,2),false)};
win.setInterval=function(fn,ms){return add(fn,ms,Array.prototype.slice.call(arguments,2),true)};
win.clearTimeout=win.clearInterval=function(id){timers=timers.filter(function(t){return t.id!==id})};
win.__virtualClock={advance:function(target){
var guard=0;
while(guard++<10000){
var next=null;
for(var i=0;i<timers.length;i++){if(timers[i].at<=target&&(!next||timers[i].at<next.at))next=timers[i]}
if(!next)break;
now=Math.max(now,next.at);
if(next.repeat){next.at+=next.ms}else{timers=timers.filter(function(t){return t!==next})}
if(typeof next.fn==='function'){try{next.fn.apply(win,next.args)}catch(e){}}
}
now=target;
var cbs=rafs;rafs=[];
for(var j=0;j<cbs.length;j++){try{cbs[j].cb(now)}catch(e){}}
}};
})();`;

function injectVirtualClock(code) {
  const tag = `<script>${VIRTUAL_CLOCK}</script>`;
  if (/<head[^>]*>/i.test(code)) return code.replace(/<head[^>]*>/i, (match) => match + tag);
  if (/<html[^>]*>/i.test(code)) return code.replace(/<html[^>]*>/i, (match) => match + tag);
  return tag + code;
}

function throwIfAborted(signal) {
  if (signal && signal.aborted) throw new DOMException('Render dibatalkan', 'AbortError');
}

function createOffscreenFrame(code, width, height, virtualTime) {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText = `position:fixed;left:-9999px;top:0;width:${width}px;height:${height}px;border:0;`;
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

// Pause semua animasi lalu lompat ke waktu tertentu (CSS animation, transition, WAAPI).
function seekAnimations(doc, timeMs) {
  let animations = [];
  try {
    animations =
      typeof doc.getAnimations === 'function'
        ? doc.getAnimations()
        : doc.documentElement.getAnimations({ subtree: true });
  } catch {
    return;
  }
  for (const animation of animations) {
    try {
      animation.pause();
      animation.currentTime = timeMs;
    } catch {
      /* animasi tidak bisa di-seek, lewati */
    }
  }
}

async function pickEncoderConfig(format, width, height, fps, bitrate) {
  const codecs =
    format === 'mp4'
      ? ['avc1.640028', 'avc1.64002A', 'avc1.4D0028', 'avc1.42E028']
      : ['vp09.00.10.08', 'vp09.00.40.08', 'vp09.00.50.08'];

  for (const codec of codecs) {
    const config = { codec, width, height, bitrate, framerate: fps };
    if (format === 'mp4') config.avc = { format: 'avc' };
    try {
      const support = await VideoEncoder.isConfigSupported(config);
      if (support && support.supported) return config;
    } catch {
      /* coba kandidat berikutnya */
    }
  }
  throw new Error(`Encoder ${format.toUpperCase()} tidak tersedia untuk ${width}x${height} @ ${fps}fps di browser ini.`);
}

async function createMuxer(format, width, height, fps) {
  if (format === 'mp4') {
    const { Muxer, ArrayBufferTarget } = await import('mp4-muxer');
    const target = new ArrayBufferTarget();
    const muxer = new Muxer({
      target,
      video: { codec: 'avc', width, height, frameRate: fps },
      fastStart: 'in-memory',
    });
    return { muxer, target, mime: 'video/mp4' };
  }
  // mp4-muxer hanya menulis container MP4. WebM butuh webm-muxer (codec 'V_VP9').
  const { Muxer, ArrayBufferTarget } = await import('webm-muxer');
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: 'V_VP9', width, height, frameRate: fps },
  });
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
  onProgress = () => {},
  signal,
}) {
  if (typeof window === 'undefined' || !window.VideoEncoder) throw new Error(WEBCODECS_ERROR);
  if (!isWebCodecsSupported()) throw new Error(WEBCODECS_ERROR);

  const totalFrames = duration * fps;
  const startedAt = performance.now();
  let captureStartedAt = 0;
  const emit = (phase, current) => {
    const now = performance.now();
    const captureElapsed = captureStartedAt ? now - captureStartedAt : 0;
    const etaMs =
      phase === 'capture' && current > 0 && captureElapsed > 0
        ? (captureElapsed / current) * (totalFrames - current)
        : null;
    onProgress({ phase, current, total: totalFrames, elapsedMs: now - startedAt, etaMs });
  };

  let iframe = null;
  let encoder = null;

  try {
    emit('prepare', 0);

    iframe = await createOffscreenFrame(code, width, height, virtualTime);
    await sleep(500);
    throwIfAborted(signal);

    const doc = iframe.contentDocument;
    if (!doc) throw new Error('Dokumen iframe tidak bisa diakses.');
    try {
      if (doc.fonts && doc.fonts.ready) await doc.fonts.ready;
    } catch {
      /* abaikan */
    }
    const clock = virtualTime ? iframe.contentWindow.__virtualClock : null;
    if (clock) clock.advance(0);
    seekAnimations(doc, 0);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    const config = await pickEncoderConfig(format, width, height, fps, bitrate);
    const { muxer, target, mime } = await createMuxer(format, width, height, fps);

    let encoderError = null;
    encoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: (err) => {
        encoderError = err;
      },
    });
    encoder.configure(config);

    const html2canvas = (await import('html2canvas')).default;
    const frameDurationUs = Math.round(1_000_000 / fps);
    const body = doc.body || doc.documentElement;

    captureStartedAt = performance.now();

    for (let i = 0; i < totalFrames; i++) {
      throwIfAborted(signal);
      if (encoderError) throw new Error(`Encoder gagal: ${encoderError.message}`);

      const timeMs = (i / fps) * 1000 * speed;
      if (clock) clock.advance(timeMs);
      seekAnimations(doc, timeMs);
      void body.offsetHeight;

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
        // html2canvas merender dari klon dokumen; animasi klon harus di-seek juga.
        onclone: (clonedDoc) => seekAnimations(clonedDoc, timeMs),
      });

      ctx.fillStyle = background;
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(captured, 0, 0, width, height);

      const bitmap = await createImageBitmap(canvas);
      const frame = new VideoFrame(bitmap, {
        timestamp: Math.round((i * 1_000_000) / fps),
        duration: frameDurationUs,
      });
      encoder.encode(frame, { keyFrame: i % fps === 0 });
      frame.close();
      bitmap.close();

      emit('capture', i + 1);

      while (encoder.encodeQueueSize > 8) await sleep(10);
      if (i % 5 === 4) await sleep(0);
    }

    emit('finalize', totalFrames);
    await encoder.flush();
    if (encoderError) throw new Error(`Encoder gagal: ${encoderError.message}`);
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
      extension: format === 'webm' ? 'webm' : 'mp4',
    };
  } finally {
    if (iframe) iframe.remove();
    if (encoder && encoder.state !== 'closed') {
      try {
        encoder.close();
      } catch {
        /* sudah tertutup */
      }
    }
  }
}
