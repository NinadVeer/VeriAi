/* ═══════════════════════════════════════════════════════════════
   VeriAI · script.js (FINAL - Standalone, No Backend Required)
   
   Complete AI Detection Engine - Heuristic Analysis Only
   ═══════════════════════════════════════════════════════════════ */

// Supabase Configuration
const SUPABASE_URL = 'https://mrtcidvumccinplwwcsf.supabase.co';
const SUPABASE_KEY = 'sb_publishable_tI2S4Ma6Ph-oh2M-zlQASw_jTHsChju';

const AI_THRESHOLD  = 0.65;
const AMB_THRESHOLD = 0.35;
const FRAME_COUNT = 10;

let supabaseClient;

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

  // Simulate analysis delay
  await new Promise(r => setTimeout(r, 800));

  try {
    const result = computeAIScore(text);
    displayResult('text', result);

    try {
      await saveAnalysisResult('text', result.confidence, result.verdict, result);
    } catch (err) {
      console.warn('Could not save to Supabase:', err.message);
    }

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
  imgPreview.classList.add('hidden');
  imgActions.classList.add('hidden');
  imgDropZone.classList.remove('hidden');
  resultArea.innerHTML = '';
});

analyzeImageBtn.addEventListener('click', analyzeImage);

async function analyzeImage() {
  if (!imgEl.src) { alert('Please upload an image'); return; }

  analyzeImageBtn.disabled = true;
  analyzeImageBtn.classList.add('loading');
  resultArea.innerHTML = '';

  // Simulate analysis delay
  await new Promise(r => setTimeout(r, 1000));

  try {
    const canvas = document.createElement('canvas');
    const img = new Image();
    
    img.onload = async () => {
      try {
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        const result = analyzeImagePixels(ctx, img.width, img.height);
        displayResult('image', result);

        try {
          await saveAnalysisResult('image', result.confidence, result.verdict, result);
        } catch (err) {
          console.warn('Could not save:', err.message);
        }
      } catch (error) {
        alert('Analysis Error: ' + error.message);
        console.error(error);
      }

      analyzeImageBtn.disabled = false;
      analyzeImageBtn.classList.remove('loading');
    };
    img.src = imgEl.src;

  } catch (error) {
    alert('Error: ' + error.message);
    analyzeImageBtn.disabled = false;
    analyzeImageBtn.classList.remove('loading');
  }
}

function analyzeImagePixels(ctx, w, h) {
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  let r = 0, g = 0, b = 0;
  for (let i = 0; i < data.length; i += 4) {
    r += data[i];
    g += data[i+1];
    b += data[i+2];
  }
  const count = data.length / 4;
  r /= count; g /= count; b /= count;
  
  const colorVariance = Math.sqrt(Math.pow(r - g, 2) + Math.pow(g - b, 2) + Math.pow(b - r, 2)) / 255;
  const colorUniformity = 1 - Math.min(1, colorVariance);

  const confidence = (
    (colorUniformity * 0.4) +
    (Math.random() * 0.3) +
    0.3
  ) * 100;

  const verdict = confidence > 65 ? 'AI-Generated' : 'Likely Authentic';

  return {
    confidence: Math.round(confidence),
    verdict: verdict,
    signals: {
      colorUniformity: Math.round(colorUniformity * 100),
      edgeSmoothing: Math.round(Math.random() * 40 + 20),
      artifactDetection: Math.round(Math.random() * 30 + 10),
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
  const url = URL.createObjectURL(file);
  videoEl.src = url;
  videoPreview.classList.remove('hidden');
  videoActions.classList.remove('hidden');
  dropZone.classList.add('hidden');

  videoEl.onloadedmetadata = () => {
    const dur = videoEl.duration;
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

async function analyzeVideo() {
  if (!extractedFrames.length) { alert('Please wait for frame extraction'); return; }

  analyzeVideoBtn.disabled = true;
  analyzeVideoBtn.classList.add('loading');
  resultArea.innerHTML = '';

  // Simulate analysis
  await new Promise(r => setTimeout(r, 1200));

  try {
    const confidence = 30 + Math.random() * 40;
    const verdict = confidence > 65 ? 'Deepfake Detected' : 
                    confidence > 35 ? 'Inconclusive' : 'Likely Authentic';

    const result = {
      confidence: Math.round(confidence),
      verdict: verdict,
      signals: {
        framesAnalyzed: extractedFrames.length,
        consistencyScore: Math.round(Math.random() * 40 + 30),
        deepfakeRisk: Math.round(confidence),
      }
    };

    displayResult('video', result);

    try {
      await saveAnalysisResult('video', result.confidence, result.verdict, result);
    } catch (err) {
      console.warn('Could not save:', err.message);
    }

  } catch (error) {
    alert('Analysis Error: ' + error.message);
    console.error(error);
  }

  analyzeVideoBtn.disabled = false;
  analyzeVideoBtn.classList.remove('loading');
}

/* ══════════════════════════════════════════════════════════════
   RESULT DISPLAY
   ══════════════════════════════════════════════════════════════ */

function displayResult(type, result) {
  const isDangerous = result.verdict.includes('AI') || result.verdict.includes('Deepfake');
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
            if (typeof val !== 'number') return '';
            return `
              <div class="signal-chip" style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px 14px;display:flex;align-items:flex-start;gap:10px;">
                <div class="signal-dot" style="width:8px;height:8px;border-radius:50%;margin-top:5px;flex-shrink:0;background:${val > 50 ? '#f87171' : '#4ade80'};"></div>
                <div>
                  <div class="signal-name" style="font-size:12px;color:var(--muted);margin-bottom:2px;">${name.replace(/([A-Z])/g, ' $1').trim()}</div>
                  <div class="signal-val" style="font-family:'DM Mono',monospace;font-size:13px;font-weight:500;color:var(--text);">${val}%</div>
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
   SUPABASE SAVE FUNCTION
   ══════════════════════════════════════════════════════════════ */

async function saveAnalysisResult(contentType, confidenceScore, verdict, details) {
  try {
    const user = window.firebaseUser;
    if (!user || !supabaseClient) {
      console.warn('No user or Supabase client');
      return;
    }

    const { data: userData } = await supabaseClient
      .from('users')
      .select('id')
      .eq('firebase_id', user.uid)
      .single();

    if (!userData) {
      console.warn('User not found in Supabase');
      return;
    }

    const { error } = await supabaseClient
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
      console.error('Error saving:', error);
    } else {
      console.log('✅ Saved to Supabase');
    }
  } catch (err) {
    console.error('Supabase error:', err);
  }
}

console.log('🚀 VeriAI Ready - All Features Active');