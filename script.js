/* ═══════════════════════════════════════════════════════════════
   VeriAI · script.js (FINAL - Standalone, No Backend Required)
   
   Complete AI Detection Engine - Heuristic Analysis Only
   ═══════════════════════════════════════════════════════════════ */

// Supabase Configuration
const SUPABASE_URL = 'https://mrtcidvumccinplwwcsf.supabase.co';
const SUPABASE_KEY = 'sb_publishable_tI2S4Ma6Ph-oh2M-zlQASw_jTHsChju';

// Backend API base URL — change to your deployed URL in production
const BACKEND_URL   = 'http://localhost:3001';

const AI_THRESHOLD  = 0.65;
const AMB_THRESHOLD = 0.35;
const FRAME_COUNT = 10;

let supabaseClient;

// Track the actual File objects so they can be sent to the backend as FormData
let currentImageFile = null;
let currentVideoFile = null;

document.addEventListener('DOMContentLoaded', function() {
  if (window.supabase) {
    try {
      const { createClient } = window.supabase;
      supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);
      window.supabaseClient = supabaseClient;
      console.log('✅ Supabase initialized');
    } catch (err) {
      console.error('❌ Supabase error:', err);
    }
  }
});

/* ══════════════════════════════════════════════════════════════
   DOM REFERENCES
   ══════════════════════════════════════════════════════════════ */

const resultArea     = document.getElementById('resultArea');
const textarea       = document.getElementById('inputText');
const wordCountEl    = document.getElementById('wordCount');
const charCountEl    = document.getElementById('charCount');
const analyzeTextBtn = document.getElementById('analyzeTextBtn');
const clearTextBtn   = document.getElementById('clearTextBtn');

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

const tabText        = document.getElementById('tabText');
const tabVideo       = document.getElementById('tabVideo');
const tabImage       = document.getElementById('tabImage');
const panelText      = document.getElementById('panelText');
const panelVideo     = document.getElementById('panelVideo');
const panelImage     = document.getElementById('panelImage');

const imgDropZone    = document.getElementById('imgDropZone');
const imageInput     = document.getElementById('imageInput');
const imgEl          = document.getElementById('imgEl');
const imgPreview     = document.getElementById('imgPreview');
const imgMeta        = document.getElementById('imgMeta');
const imgActions     = document.getElementById('imgActions');
const analyzeImageBtn= document.getElementById('analyzeImageBtn');
const clearImageBtn  = document.getElementById('clearImageBtn');
const imgCanvas      = document.getElementById('imgCanvas');

/* ══════════════════════════════════════════════════════════════
   TAB SWITCHING
   ══════════════════════════════════════════════════════════════ */

const tabs = [
  { btn: tabText,  panel: panelText  },
  { btn: tabVideo, panel: panelVideo },
  { btn: tabImage, panel: panelImage },
];

tabs.forEach(({ btn, panel }) => {
  btn.addEventListener('click', () => {
    tabs.forEach(t => { 
      t.btn.classList.remove('active'); 
      t.panel.classList.add('hidden'); 
    });
    btn.classList.add('active');
    panel.classList.remove('hidden');
    resultArea.innerHTML = '';
  });
});

/* ══════════════════════════════════════════════════════════════
   TEXT ANALYSIS - HEURISTIC BASED
   ══════════════════════════════════════════════════════════════ */

textarea.addEventListener('input', () => {
  const text = textarea.value;
  const words = text.trim().split(/\s+/).filter(w => w.length).length;
  wordCountEl.textContent = words;
  charCountEl.textContent = text.length;
});

clearTextBtn.addEventListener('click', () => {
  textarea.value = '';
  wordCountEl.textContent = '0';
  charCountEl.textContent = '0';
  resultArea.innerHTML = '';
});

analyzeTextBtn.addEventListener('click', analyzeText);

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

async function analyzeText() {
  const text = textarea.value.trim();
  if (!text) { alert('Please enter some text'); return; }
  if (text.length < 50) { alert('Please enter at least 50 characters'); return; }

  analyzeTextBtn.disabled = true;
  analyzeTextBtn.classList.add('loading');
  resultArea.innerHTML = '';

  try {
    const token = await getAuthToken();
    const response = await fetch(`${BACKEND_URL}/api/analyze/text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody.error?.message || `Server error ${response.status}`);
    }

    const { data } = await response.json();
    displayResult('text', data.result);

  } catch (error) {
    alert('Analysis Error: ' + error.message);
    console.error('Text analysis error:', error);
  }

  analyzeTextBtn.disabled = false;
  analyzeTextBtn.classList.remove('loading');
}

function computeAIScore(text) {
  const senLen  = sentenceLength(text);
  const varWord = wordVariety(text);
  const filler  = fillerPhrases(text);
  const burst   = burstiness(text);
  const hedging = hedgingPhrases(text);

  const aiScore = (
    (filler * 0.3) +
    (Math.max(0, (3.5 - senLen) / 3.5) * 0.25) +
    (Math.max(0, (0.45 - varWord) / 0.45) * 0.2) +
    (Math.max(0, (0.3 - burst) / 0.3) * 0.15) +
    ((1 - hedging) * 0.1)
  );

  const confidence = Math.min(1, Math.max(0, aiScore)) * 100;
  const verdict = confidence >= AI_THRESHOLD * 100 ? 'AI' : 
                  confidence >= AMB_THRESHOLD * 100 ? 'Ambiguous' : 'Human';

  return {
    confidence: Math.round(confidence),
    verdict: verdict,
    signals: {
      fillerPhrases: Math.round(filler * 100),
      sentenceLength: Math.round(senLen * 100),
      wordVariety: Math.round(varWord * 100),
      burstiness: Math.round(burst * 100),
      hedgingLanguage: Math.round(hedging * 100),
    }
  };
}

function sentenceLength(text) {
  const sentences = text.match(/[.!?]+/g) || [];
  if (!sentences.length) return 0;
  const avgLen = text.length / sentences.length;
  return Math.min(1, avgLen / 20);
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
   IMAGE ANALYSIS - HEURISTIC BASED
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
  currentImageFile = file;  // Store ref for backend FormData upload
  const url = URL.createObjectURL(file);
  imgEl.src = url;
  imgPreview.classList.remove('hidden');
  imgActions.classList.remove('hidden');
  imgDropZone.classList.add('hidden');

  const img = new Image();
  img.onload = () => {
    imgMeta.innerHTML = `${img.width}×${img.height}px &nbsp;·&nbsp; ${file.type.split('/')[1].toUpperCase()} &nbsp;·&nbsp; ${(file.size / 1e6).toFixed(1)}MB`;
  };
  img.src = url;
}

clearImageBtn.addEventListener('click', () => {
  imgEl.src = '';
  currentImageFile = null;  // Release file reference
  imgPreview.classList.add('hidden');
  imgActions.classList.add('hidden');
  imgDropZone.classList.remove('hidden');
  resultArea.innerHTML = '';
});

analyzeImageBtn.addEventListener('click', analyzeImage);

async function analyzeImage() {
  if (!currentImageFile) { alert('Please upload an image'); return; }

  analyzeImageBtn.disabled = true;
  analyzeImageBtn.classList.add('loading');
  resultArea.innerHTML = '';

  try {
    const token = await getAuthToken();

    // Include image dimensions so the backend can compute bytes-per-pixel
    const formData = new FormData();
    formData.append('file', currentImageFile);
    if (imgEl.naturalWidth)  formData.append('width',  imgEl.naturalWidth);
    if (imgEl.naturalHeight) formData.append('height', imgEl.naturalHeight);

    const response = await fetch(`${BACKEND_URL}/api/analyze/image`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody.error?.message || `Server error ${response.status}`);
    }

    const { data } = await response.json();
    displayResult('image', data.result);

  } catch (error) {
    alert('Analysis Error: ' + error.message);
    console.error('Image analysis error:', error);
  }

  analyzeImageBtn.disabled = false;
  analyzeImageBtn.classList.remove('loading');
}


function analyzeImagePixels(ctx, w, h) {
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  const count = data.length / 4;

  // ── Signal 1: Color Channel Balance ──────────────────────────────
  // AI generators produce unnaturally balanced RGB channels
  let rSum = 0, gSum = 0, bSum = 0;
  for (let i = 0; i < data.length; i += 4) {
    rSum += data[i];
    gSum += data[i + 1];
    bSum += data[i + 2];
  }
  const rAvg = rSum / count, gAvg = gSum / count, bAvg = bSum / count;
  const total = rAvg + gAvg + bAvg || 1;
  const fracR = rAvg / total, fracG = gAvg / total, fracB = bAvg / total;
  const channelDeviation = Math.abs(fracR - 1/3) + Math.abs(fracG - 1/3) + Math.abs(fracB - 1/3);
  // Low deviation = very balanced = AI signal (score 0–100)
  const colorBalanceScore = Math.round(Math.min(100, Math.max(0, (1 - channelDeviation / 0.15) * 100)));

  // ── Signal 2: Local Variance (Edge Smoothness) ───────────────────
  // AI images have smoother gradients; measure average local pixel variance
  let totalVariance = 0;
  const stride = Math.max(1, Math.floor(Math.sqrt(count / 1000))); // sample ~1000 pixels
  let sampleCount = 0;
  for (let y = 1; y < h - 1; y += stride) {
    for (let x = 1; x < w - 1; x += stride) {
      const i = (y * w + x) * 4;
      const il = (y * w + (x - 1)) * 4;
      const ir = (y * w + (x + 1)) * 4;
      const diffR = Math.abs(data[i] - data[il]) + Math.abs(data[i] - data[ir]);
      const diffG = Math.abs(data[i+1] - data[il+1]) + Math.abs(data[i+1] - data[ir+1]);
      const diffB = Math.abs(data[i+2] - data[il+2]) + Math.abs(data[i+2] - data[ir+2]);
      totalVariance += (diffR + diffG + diffB) / 6;
      sampleCount++;
    }
  }
  const avgLocalVariance = sampleCount > 0 ? totalVariance / sampleCount : 0;
  // Low local variance = smoother = more AI-like (score 0–100)
  const edgeSmoothScore = Math.round(Math.min(100, Math.max(0, (1 - avgLocalVariance / 30) * 100)));

  // ── Signal 3: Pixel-level entropy (texture complexity) ───────────
  // AI images often have overly regular texture patterns
  const lumBuckets = new Array(16).fill(0);
  for (let i = 0; i < data.length; i += 4) {
    const lum = Math.round((0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2]) / 16);
    lumBuckets[Math.min(15, lum)]++;
  }
  let entropy = 0;
  for (const b of lumBuckets) {
    if (b === 0) continue;
    const p = b / count;
    entropy -= p * Math.log2(p);
  }
  // Max entropy for 16 buckets is 4 bits. Low entropy = uniform = AI signal
  const entropyScore = Math.round(Math.min(100, Math.max(0, (1 - entropy / 4) * 100)));

  // ── Signal 4: Saturation uniformity ─────────────────────────────
  // AI images often have narrow saturation ranges
  let satSum = 0, satSqSum = 0;
  const satSample = Math.max(1, Math.floor(count / 2000));
  let satN = 0;
  for (let i = 0; i < data.length; i += 4 * satSample) {
    const maxC = Math.max(data[i], data[i+1], data[i+2]);
    const minC = Math.min(data[i], data[i+1], data[i+2]);
    const sat = maxC === 0 ? 0 : (maxC - minC) / maxC;
    satSum += sat;
    satSqSum += sat * sat;
    satN++;
  }
  const satAvg = satN > 0 ? satSum / satN : 0;
  const satVariance = satN > 0 ? (satSqSum / satN) - satAvg * satAvg : 0;
  const satStdDev = Math.sqrt(Math.max(0, satVariance));
  // Low saturation std deviation = more uniform = AI signal
  const satUniformScore = Math.round(Math.min(100, Math.max(0, (1 - satStdDev / 0.25) * 100)));

  // ── Weighted confidence score ─────────────────────────────────────
  // Weights: colorBalance 30%, edgeSmooth 30%, entropy 25%, satUniform 15%
  const confidence = Math.round(
    colorBalanceScore * 0.30 +
    edgeSmoothScore   * 0.30 +
    entropyScore      * 0.25 +
    satUniformScore   * 0.15
  );

  const verdict = confidence >= 65 ? 'AI-Generated' :
                  confidence >= 35 ? 'Possibly AI-Generated' : 'Likely Authentic';

  return {
    confidence,
    verdict,
    signals: {
      colorChannelBalance: colorBalanceScore,
      edgeSmoothness:      edgeSmoothScore,
      textureEntropy:      entropyScore,
      saturationUniformity: satUniformScore,
    }
  };
}

/* ══════════════════════════════════════════════════════════════
   VIDEO ANALYSIS - HEURISTIC BASED
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
  currentVideoFile = file;  // Store ref for backend FormData upload
  const url = URL.createObjectURL(file);
  videoEl.src = url;
  videoPreview.classList.remove('hidden');
  videoActions.classList.remove('hidden');
  dropZone.classList.add('hidden');

  videoEl.onloadedmetadata = () => {
    const dur = videoEl.duration;
    videoMeta.innerHTML = `${Math.round(dur)}s &nbsp;·&nbsp; ${file.type.split('/')[1].toUpperCase()} &nbsp;·&nbsp; ${(file.size / 1e6).toFixed(1)}MB`;
  };

  extractFrames(videoEl);  // Frame strip is still shown as visual preview
}

clearVideoBtn.addEventListener('click', () => {
  videoEl.src = '';
  currentVideoFile = null;  // Release file reference
  videoPreview.classList.add('hidden');
  videoActions.classList.add('hidden');
  dropZone.classList.remove('hidden');
  frameStrip.classList.add('hidden');
  resultArea.innerHTML = '';
});

analyzeVideoBtn.addEventListener('click', analyzeVideo);

let extractedFrames = [];

function extractFrames(video) {
  extractedFrames = [];
  frameStrip.innerHTML = '';
  frameStrip.classList.remove('hidden');

  // Wait for metadata before seeking
  const startExtraction = () => {
    const duration    = video.duration;
    const frameCount  = FRAME_COUNT;
    const times       = [];
    for (let i = 0; i < frameCount; i++) {
      times.push((i / (frameCount - 1 || 1)) * duration * 0.95);
    }

    let idx = 0;

    const captureNext = () => {
      if (idx >= times.length) return;
      video.currentTime = times[idx];
    };

    video.onseeked = () => {
      // Draw the current frame
      const cvs = frameCanvas;
      cvs.width  = video.videoWidth  || 320;
      cvs.height = video.videoHeight || 180;
      const ctx = cvs.getContext('2d');
      ctx.drawImage(video, 0, 0);

      const dataURL = cvs.toDataURL();
      extractedFrames.push(dataURL);

      const thumb = document.createElement('div');
      thumb.className = 'frame-thumb';
      thumb.innerHTML = `
        <img src="${dataURL}"/>
        <div class="frame-label">${(times[idx] || 0).toFixed(1)}s</div>
      `;
      frameStrip.appendChild(thumb);

      idx++;
      if (idx < times.length) {
        captureNext();
      } else {
        video.onseeked = null; // Done
      }
    };

    captureNext();
  };

  if (video.readyState >= 1) {
    startExtraction();
  } else {
    video.addEventListener('loadedmetadata', startExtraction, { once: true });
  }
}

async function analyzeVideo() {
  if (!currentVideoFile) { alert('Please upload a video file first'); return; }

  analyzeVideoBtn.disabled = true;
  analyzeVideoBtn.classList.add('loading');
  resultArea.innerHTML = '';

  try {
    const token = await getAuthToken();

    // Send the raw video file — backend analyzes container structure & byte entropy
    const formData = new FormData();
    formData.append('file', currentVideoFile);
    if (videoEl.duration) formData.append('duration', videoEl.duration);
    if (extractedFrames.length) formData.append('frameCount', extractedFrames.length);

    const response = await fetch(`${BACKEND_URL}/api/analyze/video`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody.error?.message || `Server error ${response.status}`);
    }

    const { data } = await response.json();
    displayResult('video', data.result);

  } catch (error) {
    alert('Analysis Error: ' + error.message);
    console.error('Video analysis error:', error);
  }

  analyzeVideoBtn.disabled = false;
  analyzeVideoBtn.classList.remove('loading');
}

/**
 * Analyze extracted video frames for deepfake/AI signals.
 * Uses deterministic heuristics on pixel data from canvas-extracted frames.
 * @param {string[]} frameDataURLs - Array of base64 data URLs from canvas
 */
function analyzeVideoFrames(frameDataURLs) {
  // We work synchronously here using data already in extractedFrames.
  // The frames were drawn to the hidden canvas — we re-read pixel stats from
  // the last drawn frame as representative sample.
  const cvs = frameCanvas;
  const ctx = cvs.getContext('2d');

  const frameScores = [];

  // Analyze each frame that was already rendered to the shared canvas
  // We use the stored DataURLs by re-drawing them to a temp canvas
  const tmpCvs = document.createElement('canvas');
  const tmpCtx = tmpCvs.getContext('2d');

  for (const dataURL of frameDataURLs) {
    try {
      // Create Image synchronously-ish via pre-loaded src
      const img = new Image();
      img.src = dataURL;
      // Image is already decoded (came from canvas.toDataURL)
      tmpCvs.width = img.naturalWidth || 320;
      tmpCvs.height = img.naturalHeight || 180;
      tmpCtx.drawImage(img, 0, 0);
      const fd = tmpCtx.getImageData(0, 0, tmpCvs.width, tmpCvs.height);
      frameScores.push(computeFrameAIScore(fd));
    } catch (e) { /* skip bad frames */ }
  }

  if (frameScores.length === 0) {
    // Fallback: cannot read pixel data (e.g., cross-origin)
    return {
      confidence: 45,
      verdict: 'Inconclusive',
      signals: {
        framesAnalyzed: frameDataURLs.length,
        frameConsistency: 45,
        colorUniformity: 45,
        edgeSmoothness: 45,
      }
    };
  }

  // ── Signal 1: Inter-frame consistency ─────────────────────────────
  // AI video: frames are very consistent (low variance between frames)
  // Real video: more variation (scene changes, motion, lighting shifts)
  const avgScore = frameScores.reduce((a, b) => a + b.lum, 0) / frameScores.length;
  const lumVariance = frameScores.reduce((a, b) => a + Math.pow(b.lum - avgScore, 2), 0) / frameScores.length;
  const lumStdDev = Math.sqrt(lumVariance);
  // Low std dev (<5) = AI-like, high (>20) = natural video
  const consistencyScore = Math.round(Math.min(100, Math.max(0, (1 - lumStdDev / 20) * 100)));

  // ── Signal 2: Average color balance across frames ─────────────────
  const avgBalance = frameScores.reduce((a, b) => a + b.colorBalance, 0) / frameScores.length;
  const colorBalanceScore = Math.round(avgBalance * 100);

  // ── Signal 3: Average edge smoothness across frames ───────────────
  const avgSmooth = frameScores.reduce((a, b) => a + b.edgeSmooth, 0) / frameScores.length;
  const edgeSmoothScore = Math.round(avgSmooth * 100);

  // ── Weighted confidence ───────────────────────────────────────────
  const confidence = Math.round(
    consistencyScore * 0.40 +
    colorBalanceScore * 0.30 +
    edgeSmoothScore  * 0.30
  );

  const verdict = confidence >= 65 ? 'Deepfake Detected' :
                  confidence >= 35 ? 'Inconclusive' : 'Likely Authentic';

  return {
    confidence,
    verdict,
    signals: {
      framesAnalyzed:   frameScores.length,
      frameConsistency: consistencyScore,
      colorUniformity:  colorBalanceScore,
      edgeSmoothness:   edgeSmoothScore,
    }
  };
}

function computeFrameAIScore(imageData) {
  const data = imageData.data;
  const count = data.length / 4;
  if (count === 0) return { lum: 128, colorBalance: 0.5, edgeSmooth: 0.5 };

  let rSum = 0, gSum = 0, bSum = 0, lumSum = 0;
  for (let i = 0; i < data.length; i += 4) {
    rSum += data[i];
    gSum += data[i + 1];
    bSum += data[i + 2];
    lumSum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  const rAvg = rSum / count, gAvg = gSum / count, bAvg = bSum / count;
  const total = rAvg + gAvg + bAvg || 1;
  const dev = Math.abs(rAvg / total - 1/3) + Math.abs(gAvg / total - 1/3) + Math.abs(bAvg / total - 1/3);
  const colorBalance = Math.max(0, 1 - dev / 0.15);

  // Edge smoothness: sample a row
  const w = imageData.width;
  const h = imageData.height;
  let edgeSum = 0, edgeN = 0;
  const rowStep = Math.max(1, Math.floor(h / 10));
  for (let y = 0; y < h; y += rowStep) {
    for (let x = 1; x < w - 1; x += 2) {
      const i = (y * w + x) * 4;
      const il = i - 4;
      const ir = i + 4;
      const diff = (Math.abs(data[i] - data[il]) + Math.abs(data[i] - data[ir]) +
                    Math.abs(data[i+1] - data[il+1]) + Math.abs(data[i+1] - data[ir+1]) +
                    Math.abs(data[i+2] - data[il+2]) + Math.abs(data[i+2] - data[ir+2])) / 6;
      edgeSum += diff;
      edgeN++;
    }
  }
  const avgEdge = edgeN > 0 ? edgeSum / edgeN : 15;
  const edgeSmooth = Math.max(0, 1 - avgEdge / 30);

  return { lum: lumSum / count, colorBalance, edgeSmooth };
}

/* ══════════════════════════════════════════════════════════════
   RESULT DISPLAY
   ══════════════════════════════════════════════════════════════ */

function displayResult(type, result) {
  // 3-tier coloring: red=AI/Deepfake, amber=Ambiguous/Possibly/Inconclusive, green=Human/Authentic
  const isAI       = result.verdict.includes('AI') || result.verdict.includes('Deepfake');
  const isAmbig    = result.verdict.includes('Ambiguous') || result.verdict.includes('Possibly') ||
                     result.verdict.includes('Inconclusive');
  const bgColor    = isAI ? 'rgba(248,113,113,0.06)' : isAmbig ? 'rgba(251,191,36,0.06)'  : 'rgba(74,222,128,0.06)';
  const borderColor= isAI ? 'rgba(248,113,113,0.2)'  : isAmbig ? 'rgba(251,191,36,0.2)'   : 'rgba(74,222,128,0.2)';
  const verdictColor=isAI ? '#f87171'                 : isAmbig ? '#fbbf24'                : '#4ade80';
  const emoji      = isAI ? '🤖'                      : isAmbig ? '❓'                     : '✓';
  // Keep isDangerous alias for signal chip coloring below
  const isDangerous = isAI || isAmbig;

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
            <span>Human / Real</span>
            <span>AI Probability</span>
          </div>
          <div class="conf-track" style="height:8px;background:var(--surface2);border-radius:99px;overflow:hidden;">
            <div class="conf-fill" style="height:100%;border-radius:99px;background:linear-gradient(90deg,${verdictColor},#ff6b35);width:${result.confidence}%;transition:width 1.2s cubic-bezier(0.16,1,0.3,1);"></div>
          </div>
          <div class="conf-pct" style="text-align:right;font-family:'DM Mono',monospace;font-size:13px;margin-top:6px;font-weight:500;color:${verdictColor};">${result.confidence}%</div>
        </div>
        <div class="divider" style="height:1px;background:var(--border);margin:20px 0;"></div>
        <div class="signals-title" style="font-size:12px;font-family:'DM Mono',monospace;letter-spacing:0.1em;color:var(--muted);text-transform:uppercase;margin-bottom:12px;">Detection Signals</div>
        <div class="signals-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          ${Object.entries(result.signals || {}).map(([name, val]) => {
            if (typeof val === 'undefined') return '';
            // framesAnalyzed is a count not a percentage — display raw number
            const isCount = name === 'framesAnalyzed';
            const displayVal = isCount ? val : (typeof val === 'number' ? val + '%' : val);
            const dotColor = isCount ? '#6b6b7a' : (val > 50 ? '#f87171' : '#4ade80');
            const label = name.replace(/([A-Z])/g, ' $1').trim();
            return `
              <div class="signal-chip" style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px 14px;display:flex;align-items:flex-start;gap:10px;">
                <div class="signal-dot" style="width:8px;height:8px;border-radius:50%;margin-top:5px;flex-shrink:0;background:${dotColor};"></div>
                <div>
                  <div class="signal-name" style="font-size:12px;color:var(--muted);margin-bottom:2px;">${label}</div>
                  <div class="signal-val" style="font-family:'DM Mono',monospace;font-size:13px;font-weight:500;color:var(--text);">${displayVal}</div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
        <div class="note" style="display:flex;align-items:flex-start;gap:10px;background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:10px;padding:12px 14px;font-size:13px;color:var(--muted);line-height:1.5;margin-top:20px;">
          <span style="font-size:16px;flex-shrink:0;margin-top:1px;">ⓘ</span>
          <span>Results are probabilistic, not definitive. Always use human judgment for important decisions.</span>
        </div>
      </div>
    </div>
  `;

  resultArea.innerHTML = html;
}

/* ══════════════════════════════════════════════════════════════
   SAMPLE TEXTS
   ══════════════════════════════════════════════════════════════ */

const SAMPLES = [
  "I've been thinking about the future a lot lately. There are so many possibilities out there, and I want to make sure I'm making the right choices. Sometimes I wonder if other people feel the same way. Anyway, I think it's important to just keep moving forward and not worry too much about the things I can't control. That's been my philosophy for a while now, and it seems to be working out pretty well.",
  "The contemporary paradigm of technological advancement necessitates a comprehensive recalibration of existing infrastructural frameworks. Furthermore, it is imperative to note that stakeholders must carefully consider the multifaceted implications inherent in such transitions. Additionally, one might argue that strategic implementation protocols would substantially facilitate the optimization of operational efficiency metrics.",
  "AI has been improving at an amazing rate. It's gotten so good at writing, creating images, and analyzing data that lots of people are using it for work. Some teachers worry students might just use AI instead of learning. But others think AI could actually help education by letting students focus on bigger ideas instead of just typing stuff out."
];

/* ══════════════════════════════════════════════════════════════
   AUTH HELPER
   ══════════════════════════════════════════════════════════════ */

/**
 * Returns the Firebase ID token for the currently signed-in user.
 * Throws if no user is authenticated.
 * The token is sent as a Bearer header to authenticate backend API calls.
 */
async function getAuthToken() {
  if (!window.firebaseUser) {
    throw new Error('You must be signed in to analyse content.');
  }
  return await window.firebaseUser.getIdToken();
}

console.log('🚀 VeriAI Ready - All Features Active');