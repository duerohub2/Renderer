export const DEMO_HTML = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 100%; height: 100%; overflow: hidden; }
  body {
    position: relative;
    background: #0A0A0A;
    font-family: "Arial Black", Arial, sans-serif;
  }
  .ring {
    position: absolute;
    width: 52vmin; height: 52vmin;
    left: calc(50% - 26vmin); top: calc(46% - 26vmin);
    border-radius: 50%;
    border: 1vmin dashed #00E0C6;
    animation: spinrev 5s linear infinite;
  }
  .pulse {
    position: absolute;
    width: 38vmin; height: 38vmin;
    left: calc(50% - 19vmin); top: calc(46% - 19vmin);
    animation: pulse 1.25s ease-in-out infinite alternate;
  }
  .orb {
    width: 100%; height: 100%;
    border-radius: 50%;
    background-color: #FF4D9D;
    background-image: conic-gradient(from 0deg, #FFE500, #FF3B30, #FF4D9D, #2962FF, #00E0C6, #FFE500);
    border: 1vmin solid #F5F1E8;
    animation: spin 5s linear infinite;
  }
  .text {
    position: absolute;
    left: 0; right: 0; bottom: 8vmin;
    text-align: center;
    font-size: 9vmin;
    letter-spacing: 0.6vmin;
    color: #FFE500;
    animation: bounce 1.25s cubic-bezier(0.28, 0.84, 0.42, 1) infinite alternate;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes spinrev { to { transform: rotate(-360deg); } }
  @keyframes pulse { from { transform: scale(0.9); } to { transform: scale(1.1); } }
  @keyframes bounce { from { transform: translateY(0); } to { transform: translateY(-14vmin); } }
</style>
</head>
<body>
  <div class="ring"></div>
  <div class="pulse"><div class="orb"></div></div>
  <div class="text">RENDERIZER</div>
</body>
</html>`;
