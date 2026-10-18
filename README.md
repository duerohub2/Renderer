# RENDERIZER

Render kode HTML/CSS/JS menjadi video MP4 atau WebM langsung di browser. Rendering 100% client-side (WebCodecs + html2canvas). Backend hanya menyimpan metadata.

## Stack

- Next.js 14 App Router (JavaScript), CSS global tanpa Tailwind
- html2canvas, mp4-muxer (MP4), webm-muxer (WebM)
- Deploy: Vercel

Catatan: mp4-muxer hanya menulis container MP4, tidak bisa menulis WebM. Karena itu format WebM memakai webm-muxer (library dari penulis yang sama, API-nya sama).

## Deploy (GitHub web + Vercel, tanpa terminal)

1. Buat repo baru di GitHub.
2. Klik **Add file > Create new file**. Ketik path lengkap (contoh `app/api/health/route.js`) lalu paste isi file. Ulangi untuk semua file, atau drag-drop seluruh folder ke **Upload files**.
3. Struktur akhir:
   ```
   app/layout.js  app/page.js  app/globals.css
   app/api/health/route.js  app/api/history/route.js
   components/RenderStudio.jsx Editor.jsx Preview.jsx Settings.jsx ProgressModal.jsx ResultPanel.jsx
   lib/renderer.js  lib/demos.js
   package.json  next.config.js  .gitignore  README.md
   ```
4. Di Vercel: **Add New > Project**, import repo, framework terdeteksi otomatis sebagai Next.js, klik **Deploy**.

## Fitur tambahan

- Slider waktu di preview: seek animasi ke detik tertentu untuk memeriksa hasil per-frame sebelum render. Tombol LIVE melanjutkan animasi.
- Kualitas (bitrate 2.5 / 5 / 10 Mbps), warna latar, dan estimasi ukuran file.
- Kode dan pengaturan tersimpan otomatis di localStorage browser.
- Drag-drop file ke editor, tombol Tab menyisipkan 2 spasi.
- Saat render: layar dijaga tetap menyala (Wake Lock), peringatan jika tab ditutup, dan tombol batal.

## Cara pakai

1. Paste kode HTML, upload file (.html/.htm/.txt), atau klik **LOAD DEMO**.
2. Preview ter-update 400 ms setelah berhenti mengetik.
3. Atur lebar, tinggi, durasi (1-90 detik), FPS (12-60), dan format.
4. Klik **RENDER VIDEO**. Tunggu sampai modal progress tertutup.
5. Putar atau scrub hasilnya di panel **HASIL RENDER**, lalu klik **DOWNLOAD** secara manual.
6. **RENDER ULANG** menghapus hasil dan kembali ke state awal.

## Endpoint

- `GET /api/health` mengembalikan `{ status: 'ok', timestamp }`
- `POST /api/history` menyimpan metadata (width, height, duration, fps, format, sizeBytes)
- `GET /api/history` mengembalikan daftar metadata

Penyimpanan history in-memory: hilang saat instance serverless di-recycle dan tidak dibagi antar instance. Ganti dengan database untuk persistensi.

## Cara kerja engine

Untuk tiap frame, semua animasi dokumen di-pause dan di-seek ke `(i / fps) * 1000` ms, lalu html2canvas memotret dokumen. Seek juga diterapkan ke klon dokumen yang dibuat html2canvas (lewat `onclone`), karena html2canvas merender dari klon, dan animasi klon akan mulai dari 0 tanpa seek tersebut. Frame dikirim ke `VideoEncoder`, lalu hasilnya di-mux ke MP4 (H.264) atau WebM (VP9). Encoder dipilih lewat `isConfigSupported` dengan beberapa level codec sebagai cadangan.

## Limitasi

- CSS animation, transition, dan WAAPI akurat per-frame (di-seek lewat `getAnimations()`).
- Animasi JS (GSAP, requestAnimationFrame, setTimeout) tidak di-seek dan berjalan pada waktu nyata, jadi hasilnya tidak deterministik.
- html2canvas tidak mendukung semua CSS: `backdrop-filter`, blend mode, transform 3D, dan `conic-gradient` bisa tidak muncul atau salah render. Di demo, orb punya warna dasar cadangan jika conic-gradient tidak dirender.
- Resource eksternal (gambar, font) membutuhkan header CORS.
- Render 90 detik @ 30 fps = 2700 frame. Bisa makan waktu beberapa menit dan memori besar. Tab harus tetap terbuka.
- Dukungan browser: Chrome/Edge, atau Safari 16.4+. Tanpa WebCodecs, aplikasi menampilkan pesan error dan tombol render dinonaktifkan.
- Encoder H.264 mensyaratkan dimensi genap. Semua nilai UI sudah genap.
