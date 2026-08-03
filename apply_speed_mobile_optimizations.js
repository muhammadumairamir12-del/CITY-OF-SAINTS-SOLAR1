const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, 'index.html');
let content = fs.readFileSync(htmlPath, 'utf8');

console.log('Applying Speed and Mobile Optimizations to index.html...');

// 1. Inject Global Speed CSS (touch-action for instant clicks, smooth scroll, hardware acceleration)
const styleCloseMarker = '</style>';
const speedStyles = `
/* ── NANO-SECOND CLICK & MOBILE SPEED OPTIMIZATIONS ── */
a, button, [onclick], input[type="submit"], .video-card-wrap, .time-card {
  touch-action: manipulation; /* Eliminates 300ms mobile tap delay */
}
html {
  scroll-behavior: smooth;
}
.pg {
  will-change: opacity, display; /* GPU acceleration for page transitions */
}
`;
if (!content.includes('NANO-SECOND CLICK & MOBILE SPEED OPTIMIZATIONS')) {
    content = content.replace(styleCloseMarker, `${speedStyles}\n${styleCloseMarker}`);
    console.log('- Injected Global Speed CSS');
}

// 2. Fix Mobile Video Sizing
const oldMobileVideoCSS = `.video-card-wrap.is-playing .video-player-container{
    min-height:min(56vw, 72vh);
    aspect-ratio:16/9;
  }`;
const newMobileVideoCSS = `.video-card-wrap.is-playing .video-player-container{
    height: auto !important;
    min-height: auto !important;
    aspect-ratio: 16/9;
    width: 100%;
  }`;
if (content.includes(oldMobileVideoCSS)) {
    content = content.replace(oldMobileVideoCSS, newMobileVideoCSS);
    console.log('- Fixed Mobile Video Sizing Constraints');
} else {
    console.log('- Mobile Video CSS already updated or not found (checking for alternatives...)');
    // Fallback regex replacement if spacing differs
    content = content.replace(/min-height:\s*min\(56vw,\s*72vh\);/g, 'height: auto !important; min-height: auto !important;');
}

// 3. Remove 300ms timeouts on goPage redirects for instant transitions
const oldTimeout = 'setTimeout(() => goPage(pg), 300);';
const newTimeout = 'goPage(pg);';
let timeoutReplacements = 0;
while (content.includes(oldTimeout)) {
    content = content.replace(oldTimeout, newTimeout);
    timeoutReplacements++;
}
if (timeoutReplacements > 0) {
    console.log(`- Removed ${timeoutReplacements} artificial 300ms delays for instant navigation.`);
}

fs.writeFileSync(htmlPath, content, 'utf8');
console.log('✅ Speed and Mobile optimizations successfully applied!');
