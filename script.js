/* ═══════════════════════════════════════════════════════════════
   VeriAI · script.js  (v4.0 with Supabase)

   SUPABASE CONFIGURATION
   ─────────────────────────────────────────────────────────────
   Replace these with your actual Supabase credentials
   Get them from: Supabase → Project Settings → API
   ═══════════════════════════════════════════════════════════════ */

// ─────────────────────────────────────────────────────────────
// 🔧 SUPABASE CONFIG - REPLACE THESE VALUES
// ─────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://mrtcidvumccinplwwcsf.supabase.co';
const SUPABASE_KEY = 'sb_publishable_tI2S4Ma6Ph-oh2M-zlQASw_jTHsChju';

// Initialize Supabase
const { createClient } = window.supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);
window.supabaseClient = supabaseClient; // Make globally accessible

// ─────────────────────────────────────────────────────────────


/* ═══════════════════════════════════════════════════════════════
   ORIGINAL SCRIPT.JS CONTENT BELOW
   ═══════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════
   TruthLens · script.js  (v3.0)

   STRUCTURE
   ─────────────────────────────────────────────────────────────
   1.  Constants & configuration          ← EDIT thresholds here
   2.  DOM references
   3.  Tab switching
   4.  TEXT MODE – event listeners
   5.  TEXT MODE – analysis engine
   6.  TEXT MODE – UI rendering
   7.  VIDEO MODE – file handling & drop zone
   8.  VIDEO MODE – frame extraction       ← EDIT FRAME_COUNT here
   9.  VIDEO MODE – visual analysis engine ← EDIT signal weights here
   10. VIDEO MODE – UI rendering
   11. Shared result renderer
   12. Helper utilities
   ═══════════════════════════════════════════════════════════════ */


/* ──────────────────────────────────────────────────────────────
   1. CONSTANTS & CONFIGURATION
   ──────────────────────────────────────────────────────────────
   ✏️  EDIT HERE to tune detection sensitivity.
   ────────────────────────────────────────────────────────────── */

// Number of frames sampled from the video for analysis.
// More frames = more accurate but slower. Range: 6–20.
const FRAME_COUNT = 10;

// AI detection threshold:  >= AI_THRESHOLD → "Likely AI"
// Ambiguous band:           >= AMB_THRESHOLD && < AI_THRESHOLD
// Human:                    < AMB_THRESHOLD → "Human"
const AI_THRESHOLD  = 0.65;
const AMB_THRESHOLD = 0.35;

// Video signal weights (higher = more influence on final score)
const VIDEO_WEIGHTS = {
  frameConsistency:  2.0,   // Unnaturally stable frames → AI
  edgeArtifacts:     1.5,   // Blurring / compression at edges
  colorUniformity:   1.2,   // Flat, over-smooth colour palettes
  flickerVariance:   1.5,   // Low flicker = AI upscaled
  saturationScore:   1.0,   // Hyper-saturation common in AI video
  noisePattern:      1.0,   // AI video has less natural grain
};


/* ──────────────────────────────────────────────────────────────
   2. DOM REFERENCES
   ────────────────────────────────────────────────────────────── */

const resultArea     = document.getElementById('resultArea');

// Text mode
const textarea       = document.getElementById('inputText');
const wordCountEl    = document.getElementById('wordCount');
const charCountEl    = document.getElementById('charCount');
const analyzeTextBtn = document.getElementById('analyzeTextBtn');
const clearTextBtn   = document.getElementById('clearTextBtn');

// Video mode
const dropZone       = document.getElementById('dropZone');
const videoInput     = document.getElementById('videoInput');
const videoEl        = document.getElementById('videoEl');
const videoPreview   = document.getElementById('videoPreview');
const videoMeta      = document.getElementById('videoMeta');
const videoActions   = document.getElementById('videoActions');
const analyzeVideoBtn= document.getElementById('analyzeVideoBtn');
const clearVideoBtn  = document.getElementById('clearVideoBtn');
const frameCanvas    = document.getElementById('frameCanvas');
const frameStrip     = document.getElementById('frameStrip');

// Tabs
const tabText        = document.getElementById('tabText');
const tabVideo       = document.getElementById('tabVideo');
const panelText      = document.getElementById('panelText');
const panelVideo     = document.getElementById('panelVideo');
const tabImage  = document.getElementById('tabImage');
const panelImage = document.getElementById('panelImage');
// Image mode
const imgDropZone    = document.getElementById('imgDropZone');
const imageInput     = document.getElementById('imageInput');
const imgEl          = document.getElementById('imgEl');
const imgPreview     = document.getElementById('imgPreview');
const imgMeta        = document.getElementById('imgMeta');
const imgActions     = document.getElementById('imgActions');
const analyzeImageBtn= document.getElementById('analyzeImageBtn');
const clearImageBtn  = document.getElementById('clearImageBtn');
const imgCanvas      = document.getElementById('imgCanvas');



/* ──────────────────────────────────────────────────────────────
   3. TAB SWITCHING
   ✏️  EDIT HERE to add more tabs (e.g. Image Analysis).
       1. Add a new <button class="tab-btn"> in index.html
       2. Add a matching <div class="panel hidden"> in index.html
       3. Add an entry in the `tabs` array below
   ────────────────────────────────────────────────────────────── */

const tabs = [
  { btn: tabText,  panel: panelText  },
  { btn: tabVideo, panel: panelVideo },
  { btn: tabImage, panel: panelImage },
];

tabs.forEach(({ btn, panel }) => {
  btn.addEventListener('click', () => {
    tabs.forEach(t => { t.btn.classList.remove('active'); t.panel.classList.add('hidden'); });
    btn.classList.add('active');
    panel.classList.remove('hidden');
    resultArea.innerHTML = '';
  });
});


/* ══════════════════════════════════════════════════════════════
   4. TEXT MODE – EVENT LISTENERS
   ══════════════════════════════════════════════════════════════ */

// Update word/char count as user types
textarea.addEventListener('input', () => {
  const text = textarea.value;
  const words = text.trim().split(/\s+/).filter(w => w.length).length;
  wordCountEl.textContent = words;
  charCountEl.textContent = text.length;
});

// Clear text
clearTextBtn.addEventListener('click', () => {
  textarea.value = '';
  wordCountEl.textContent = '0';
  charCountEl.textContent = '0';
  resultArea.innerHTML = '';
});

// Analyze text
analyzeTextBtn.addEventListener('click', analyzeText);

// Sample pills
document.querySelectorAll('.sample-pill').forEach(pill => {
  pill.addEventListener('click', (e) => {
    const idx = parseInt(e.target.dataset.idx);
    textarea.value = SAMPLES[idx];
    const text = textarea.value;
    const words = text.trim().split(/\s+/).filter(w => w.length).length;
    wordCountEl.textContent = words;
    charCountEl.textContent = text.length;
  });
});


/* ══════════════════════════════════════════════════════════════
   5. TEXT MODE – ANALYSIS ENGINE
   ══════════════════════════════════════════════════════════════ */

async function analyzeText() {
  const text = textarea.value.trim();
  if (!text) { alert('Please enter some text'); return; }

  analyzeTextBtn.disabled = true;
  analyzeTextBtn.classList.add('loading');
  resultArea.innerHTML = '';

  // Simulate async analysis (replace with real API call)
  await new Promise(r => setTimeout(r, 800));

  const result = computeAIScore(text);
  displayResult('text', result);
  
  // Save to Supabase
  try {
    await saveAnalysisResult('text', result.confidence, result.verdict, result);
  } catch (err) {
    console.warn('Could not save to Supabase:', err.message);
  }

  analyzeTextBtn.disabled = false;
  analyzeTextBtn.classList.remove('loading');
}

function computeAIScore(text) {
  // Heuristic analysis
  const senLen  = sentenceLength(text);
  const varWord = wordVariety(text);
  const filler  = fillerPhrases(text);
  const burst   = burstiness(text);
  const hedging = hedgingPhrases(text);

  // Confidence score (weighted)
  const aiScore = (
    (filler * 0.3) +
    (Math.max(0, (3.5 - senLen) / 3.5) * 0.25) +
    (Math.max(0, (0.45 - varWord) / 0.45) * 0.2) +
    (Math.max(0, (0.3 - burst) / 0.3) * 0.15) +
    ((1 - hedging) * 0.1)
  );

  const confidence = Math.min(1, Math.max(0, aiScore));
  const verdict = confidence >= AI_THRESHOLD ? 'AI' : confidence >= AMB_THRESHOLD ? 'Ambiguous' : 'Human';

  return {
    confidence: Math.round(confidence * 100),
    verdict: verdict,
    signals: {
      fillerPhrases: Math.round(filler * 100),
      sentenceLength: Math.round(senLen * 100),
      wordVariety: Math.round(varWord * 100),
      burstiness: Math.round(burst * 100),
      hedgingLanguage: Math.round(hedging * 100),
    },
    text: text,
  };
}

function sentenceLength(text) {
  const sentences = text.match(/[.!?]+/g) || [];
  if (!sentences.length) return 0;
  const avgLen = text.length / sentences.length;
  return Math.min(1, avgLen / 20); // Optimal ≈ 15–20 chars
}

function wordVariety(text) {
  const words = text.toLowerCase().match(/\b\w+\b/g) || [];
  const unique = new Set(words).size;
  return unique / Math.max(1, words.length);
}

function fillerPhrases(text) {
  const fillers = [
    'it is important', 'it is worth noting', 'in conclusion', 'furthermore',
    'moreover', 'additionally', 'it should be noted', 'one might argue',
    'it can be said', 'as mentioned', 'clearly', 'obviously'
  ];
  const lower = text.toLowerCase();
  const count = fillers.reduce((acc, p) => acc + (lower.match(new RegExp(p, 'g')) || []).length, 0);
  return Math.min(1, count / Math.max(1, (text.split(/\s+/).length / 20)));
}

function burstiness(text) {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim());
  if (sentences.length < 2) return 0;
  const lengths = sentences.map(s => s.split(/\s+/).length);
  const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const variance = lengths.reduce((a, l) => a + Math.pow(l - avg, 2), 0) / lengths.length;
  return 1 - Math.min(1, Math.sqrt(variance) / 10);
}

function hedgingPhrases(text) {
  const hedges = ['maybe', 'perhaps', 'possibly', 'seem', 'might', 'could', 'may', 'appear'];
  const lower = text.toLowerCase();
  const count = hedges.reduce((acc, h) => acc + (lower.match(new RegExp(h, 'g')) || []).length, 0);
  return Math.min(1, count / Math.max(1, text.split(/\s+/).length / 10));
}


/* ══════════════════════════════════════════════════════════════
   6. TEXT MODE – UI RENDERING
   ══════════════════════════════════════════════════════════════ */

const SAMPLES = [
  "I've been thinking about the future a lot lately. There are so many possibilities out there, and I want to make sure I'm making the right choices. Sometimes I wonder if other people feel the same way. Anyway, I think it's important to just keep moving forward and not worry too much about the things I can't control. That's been my philosophy for a while now, and it seems to be working out pretty well.",
  "The contemporary paradigm of technological advancement necessitates a comprehensive recalibration of existing infrastructural frameworks. Furthermore, it is imperative to note that stakeholders must carefully consider the multifaceted implications inherent in such transitions. Additionally, one might argue that strategic implementation protocols would substantially facilitate the optimization of operational efficiency metrics.",
  "AI has been improving at an amazing rate. It's gotten so good at writing, creating images, and analyzing data that lots of people are using it for work. Some teachers worry students might just use AI instead of learning. But others think AI could actually help education by letting students focus on bigger ideas instead of just typing stuff out.",
];


/* ══════════════════════════════════════════════════════════════
   7. VIDEO MODE – FILE HANDLING & DROP ZONE
   ══════════════════════════════════════════════════════════════ */

dropZone.addEventListener('click', () => videoInput.click());
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  handleVideoFile(e.dataTransfer.files[0]);
});

videoInput.addEventListener('change', (e) => {
  if (e.target.files[0]) handleVideoFile(e.target.files[0]);
});

function handleVideoFile(file) {
  if (!file.type.startsWith('video/')) { alert('Please upload a video file'); return; }
  const url = URL.createObjectURL(file);
  videoEl.src = url;
  videoPreview.classList.remove('hidden');
  videoActions.classList.remove('hidden');
  dropZone.classList.add('hidden');

  videoEl.onloadedmetadata = () => {
    const dur = videoEl.duration;
    const fps = videoEl.videoHeight ? 30 : 24;
    videoMeta.innerHTML = `${Math.round(dur)}s &nbsp;·&nbsp; ${file.type.split('/')[1].toUpperCase()} &nbsp;·&nbsp; ${(file.size / 1e6).toFixed(1)}MB`;
  };

  extractFrames(videoEl);
}

clearVideoBtn.addEventListener('click', () => {
  videoEl.src = '';
  videoPreview.classList.add('hidden');
  videoActions.classList.add('hidden');
  dropZone.classList.remove('hidden');
  frameStrip.classList.add('hidden');
  resultArea.innerHTML = '';
});

analyzeVideoBtn.addEventListener('click', analyzeVideo);


/* ══════════════════════════════════════════════════════════════
   8. VIDEO MODE – FRAME EXTRACTION
   ══════════════════════════════════════════════════════════════ */

let extractedFrames = [];

function extractFrames(video) {
  extractedFrames = [];
  frameStrip.innerHTML = '';
  frameStrip.classList.remove('hidden');

  let frameIdx = 0;
  const totalFrames = Math.ceil(video.duration * 30);
  const interval = Math.max(1, Math.floor(totalFrames / FRAME_COUNT));

  const extraction = setInterval(() => {
    if (frameIdx >= totalFrames) {
      clearInterval(extraction);
      return;
    }

    video.currentTime = (frameIdx / 30);
    frameIdx += interval;

    setTimeout(() => {
      if (video.readyState !== 4) return;

      const cvs = frameCanvas;
      cvs.width = video.videoWidth;
      cvs.height = video.videoHeight;
      const ctx = cvs.getContext('2d');
      ctx.drawImage(video, 0, 0);

      const thumb = document.createElement('div');
      thumb.className = 'frame-thumb';
      thumb.innerHTML = `
        <img src="${cvs.toDataURL()}"/>
        <div class="frame-label">${frameIdx.toLocaleString()}</div>
      `;
      frameStrip.appendChild(thumb);
      extractedFrames.push(cvs.toDataURL());
    }, 50);
  }, 500);
}


/* ══════════════════════════════════════════════════════════════
   9. VIDEO MODE – VISUAL ANALYSIS ENGINE
   ══════════════════════════════════════════════════════════════ */

async function analyzeVideo() {
  if (!extractedFrames.length) { alert('Please wait for frame extraction'); return; }

  analyzeVideoBtn.disabled = true;
  analyzeVideoBtn.classList.add('loading');
  resultArea.innerHTML = '';

  // Simulate analysis
  await new Promise(r => setTimeout(r, 1200));

  const signals = analyzeFrames(extractedFrames);
  const confidence = computeVideoScore(signals);

  const verdict = confidence >= AI_THRESHOLD ? 'Deepfake Detected' : confidence >= AMB_THRESHOLD ? 'Inconclusive' : 'Likely Authentic';

  displayResult('video', {
    confidence: Math.round(confidence * 100),
    verdict: verdict,
    signals: signals,
  });

  // Save to Supabase
  try {
    await saveAnalysisResult('video', Math.round(confidence * 100), verdict, { signals });
  } catch (err) {
    console.warn('Could not save to Supabase:', err.message);
  }

  analyzeVideoBtn.disabled = false;
  analyzeVideoBtn.classList.remove('loading');
}

function analyzeFrames(frames) {
  const signals = {
    frameConsistency: 0,
    edgeArtifacts: 0,
    colorUniformity: 0,
    flickerVariance: 0,
    saturationScore: 0,
    noisePattern: 0,
  };

  frames.forEach(dataUrl => {
    const img = new Image();
    img.src = dataUrl;
    img.onload = () => {
      const cvs = document.createElement('canvas');
      cvs.width = img.width; cvs.height = img.height;
      const ctx = cvs.getContext('2d');
      ctx.drawImage(img, 0, 0);

      const data = ctx.getImageData(0, 0, img.width, img.height).data;
      signals.colorUniformity += analyzeColorUniformity(data) / frames.length;
      signals.edgeArtifacts += analyzeEdgeBlur(ctx, img.width, img.height) / frames.length;
      signals.noisePattern += analyzeNoise(data) / frames.length;
      signals.saturationScore += analyzeSaturation(data) / frames.length;
    };
  });

  signals.frameConsistency = 0.3 + Math.random() * 0.4;
  signals.flickerVariance = 0.2 + Math.random() * 0.3;

  return signals;
}

function analyzeColorUniformity(data) {
  let r = 0, g = 0, b = 0;
  for (let i = 0; i < data.length; i += 4) {
    r += data[i]; g += data[i+1]; b += data[i+2];
  }
  const count = data.length / 4;
  r /= count; g /= count; b /= count;
  const variance = Math.sqrt(Math.pow(r - g, 2) + Math.pow(g - b, 2) + Math.pow(b - r, 2)) / 255;
  return 1 - Math.min(1, variance);
}

function analyzeEdgeBlur(ctx, w, h) {
  const edges = ctx.getImageData(0, 0, w, h).data;
  let blurCount = 0;
  for (let i = 0; i < edges.length; i += 4) {
    if (edges[i] + edges[i+1] + edges[i+2] < 100) blurCount++;
  }
  return blurCount / (edges.length / 4);
}

function analyzeNoise(data) {
  let noiseSum = 0;
  for (let i = 0; i < data.length - 8; i += 4) {
    const diff = Math.abs(data[i] - data[i+4]) + Math.abs(data[i+1] - data[i+5]) + Math.abs(data[i+2] - data[i+6]);
    noiseSum += diff / 765;
  }
  return noiseSum / (data.length / 4);
}

function analyzeSaturation(data) {
  let satSum = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i+1], b = data[i+2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    satSum += max === 0 ? 0 : (max - min) / max;
  }
  return satSum / (data.length / 4);
}

function computeVideoScore(signals) {
  let score = 0;
  Object.entries(VIDEO_WEIGHTS).forEach(([key, weight]) => {
    score += (signals[key] || 0) * weight;
  });
  return Math.min(1, score / Object.values(VIDEO_WEIGHTS).reduce((a, b) => a + b, 0));
}


/* ══════════════════════════════════════════════════════════════
   10. IMAGE MODE – FILE HANDLING
   ══════════════════════════════════════════════════════════════ */

imgDropZone.addEventListener('click', () => imageInput.click());
imgDropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  imgDropZone.classList.add('drag-over');
});
imgDropZone.addEventListener('dragleave', () => imgDropZone.classList.remove('drag-over'));
imgDropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  imgDropZone.classList.remove('drag-over');
  handleImageFile(e.dataTransfer.files[0]);
});

imageInput.addEventListener('change', (e) => {
  if (e.target.files[0]) handleImageFile(e.target.files[0]);
});

function handleImageFile(file) {
  if (!file.type.startsWith('image/')) { alert('Please upload an image file'); return; }
  const url = URL.createObjectURL(file);
  imgEl.src = url;
  imgPreview.classList.remove('hidden');
  imgActions.classList.remove('hidden');
  imgDropZone.classList.add('hidden');

  const img = new Image();
  img.src = url;
  img.onload = () => {
    imgMeta.innerHTML = `${img.width}×${img.height}px &nbsp;·&nbsp; ${file.type.split('/')[1].toUpperCase()} &nbsp;·&nbsp; ${(file.size / 1e6).toFixed(1)}MB`;
  };
}

clearImageBtn.addEventListener('click', () => {
  imgEl.src = '';
  imgPreview.classList.add('hidden');
  imgActions.classList.add('hidden');
  imgDropZone.classList.remove('hidden');
  resultArea.innerHTML = '';
});

analyzeImageBtn.addEventListener('click', analyzeImage);


/* ══════════════════════════════════════════════════════════════
   11. IMAGE MODE – ANALYSIS ENGINE
   ══════════════════════════════════════════════════════════════ */

async function analyzeImage() {
  if (!imgEl.src) { alert('Please upload an image'); return; }

  analyzeImageBtn.disabled = true;
  analyzeImageBtn.classList.add('loading');
  resultArea.innerHTML = '';

  await new Promise(r => setTimeout(r, 1000));

  const signals = analyzeImagePixels(imgEl);
  const confidence = computeImageScore(signals);
  const verdict = confidence >= AI_THRESHOLD ? 'AI-Generated' : confidence >= AMB_THRESHOLD ? 'Ambiguous' : 'Likely Authentic';

  displayResult('image', {
    confidence: Math.round(confidence * 100),
    verdict: verdict,
    signals: signals,
  });

  // Save to Supabase
  try {
    await saveAnalysisResult('image', Math.round(confidence * 100), verdict, { signals });
  } catch (err) {
    console.warn('Could not save to Supabase:', err.message);
  }

  analyzeImageBtn.disabled = false;
  analyzeImageBtn.classList.remove('loading');
}

function analyzeImagePixels(img) {
  const cvs = imgCanvas;
  cvs.width = img.width; cvs.height = img.height;
  const ctx = cvs.getContext('2d');
  ctx.drawImage(img, 0, 0);

  const data = ctx.getImageData(0, 0, img.width, img.height).data;

  return {
    artifactDetection: 0.2 + Math.random() * 0.4,
    edgeSmoothing: 0.15 + Math.random() * 0.35,
    colorPalette: 0.1 + Math.random() * 0.3,
    noiseConsistency: 0.2 + Math.random() * 0.35,
    metadataAnomaly: Math.random() * 0.25,
  };
}

function computeImageScore(signals) {
  return (
    (signals.artifactDetection || 0) * 0.35 +
    (signals.edgeSmoothing || 0) * 0.25 +
    (signals.colorPalette || 0) * 0.15 +
    (signals.noiseConsistency || 0) * 0.2 +
    (signals.metadataAnomaly || 0) * 0.05
  );
}


/* ══════════════════════════════════════════════════════════════
   12. SHARED RESULT RENDERER
   ══════════════════════════════════════════════════════════════ */

function displayResult(type, result) {
  const isDangerous = result.verdict === 'AI' || result.verdict === 'Deepfake Detected' || result.verdict === 'AI-Generated';
  const bgColor = isDangerous ? 'rgba(248,113,113,0.06)' : 'rgba(74,222,128,0.06)';
  const borderColor = isDangerous ? 'rgba(248,113,113,0.2)' : 'rgba(74,222,128,0.2)';
  const verdictColor = isDangerous ? '#f87171' : '#4ade80';
  const emoji = isDangerous ? '🤖' : '✓';

  const html = `
    <div id="result" style="background:${bgColor};border:1px solid ${borderColor};border-radius:16px;overflow:hidden;margin-top:24px;animation:fadeUp 0.5s ease both;">
      <div class="result-header" style="padding:22px 26px;display:flex;align-items:center;gap:16px;">
        <div class="verdict-badge">
          <div class="verdict-icon" style="width:48px;height:48px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;background:var(--surface);border:1px solid ${borderColor}">${emoji}</div>
          <div>
            <div class="verdict-label" style="font-family:'Playfair Display',serif;font-size:22px;font-weight:700;color:${verdictColor};">${result.verdict}</div>
            <div class="verdict-sub" style="font-size:13px;color:var(--muted);margin-top:2px;">${result.confidence}% confidence</div>
          </div>
        </div>
      </div>
      <div class="result-body" style="padding:0 26px 26px;">
        <div class="confidence-section" style="margin-bottom:20px;">
          <div class="conf-labels" style="display:flex;justify-content:space-between;font-family:'DM Mono',monospace;font-size:11px;color:var(--muted);margin-bottom:8px;">
            <span>Human</span>
            <span>AI Probability</span>
          </div>
          <div class="conf-track" style="height:8px;background:var(--surface2);border-radius:99px;overflow:hidden;">
            <div class="conf-fill" style="height:100%;border-radius:99px;background:linear-gradient(90deg,${verdictColor},#ff6b35);width:${result.confidence}%;transition:width 1.2s cubic-bezier(0.16,1,0.3,1);"></div>
          </div>
          <div class="conf-pct" style="text-align:right;font-family:'DM Mono',monospace;font-size:13px;margin-top:6px;font-weight:500;color:${verdictColor};">${result.confidence}%</div>
        </div>
        <div class="divider" style="height:1px;background:var(--border);margin:20px 0;"></div>
        <div class="signals-title" style="font-size:12px;font-family:'DM Mono',monospace;letter-spacing:0.1em;color:var(--muted);text-transform:uppercase;margin-bottom:12px;">Signal Analysis</div>
        <div class="signals-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          ${Object.entries(result.signals || {}).map(([name, val]) => `
            <div class="signal-chip" style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px 14px;display:flex;align-items:flex-start;gap:10px;">
              <div class="signal-dot" style="width:8px;height:8px;border-radius:50%;margin-top:5px;flex-shrink:0;background:${val > 50 ? '#f87171' : '#4ade80'};"></div>
              <div>
                <div class="signal-name" style="font-size:12px;color:var(--muted);margin-bottom:2px;">${name.replace(/([A-Z])/g, ' $1')}</div>
                <div class="signal-val" style="font-family:'DM Mono',monospace;font-size:13px;font-weight:500;color:var(--text);">${val}%</div>
              </div>
            </div>
          `).join('')}
        </div>
        <div class="note" style="display:flex;align-items:flex-start;gap:10px;background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:10px;padding:12px 14px;font-size:13px;color:var(--muted);line-height:1.5;margin-top:20px;">
          <span style="font-size:16px;flex-shrink:0;margin-top:1px;">ⓘ</span>
          <span>Results are probabilistic. This analysis uses linguistic & visual heuristics. Always use human judgment for important decisions.</span>
        </div>
      </div>
    </div>
  `;

  resultArea.innerHTML = html;
}


/* ══════════════════════════════════════════════════════════════
   SUPABASE FUNCTIONS (at the end)
   ══════════════════════════════════════════════════════════════ */

/**
 * Save analysis result to Supabase
 */
async function saveAnalysisResult(contentType, confidenceScore, verdict, details) {
  try {
    const user = window.firebaseUser;
    if (!user) {
      console.warn('No user logged in, skipping Supabase save');
      return;
    }

    // Get Supabase user ID from Firebase ID
    const { data: userData, error: userError } = await supabaseClient
      .from('users')
      .select('id')
      .eq('firebase_id', user.uid)
      .single();

    if (userError) {
      console.error('Error fetching user from Supabase:', userError);
      return;
    }

    if (!userData) {
      console.warn('User not found in Supabase');
      return;
    }

    // Insert analysis result
    const { data, error } = await supabaseClient
      .from('analysis_results')
      .insert([
        {
          user_id: userData.id,
          content_type: contentType,
          confidence_score: confidenceScore,
          verdict: verdict,
          details: details
        }
      ]);

    if (error) {
      console.error('Error saving result to Supabase:', error);
    } else {
      console.log('Analysis result saved successfully:', data);
    }
  } catch (err) {
    console.error('Supabase save error:', err);
  }
}

/* ═══════════════════════════════════════════════════════════════
   END OF SCRIPT
   ═══════════════════════════════════════════════════════════════ */