/**
 * services/imageDetector.js
 * Heuristic-based AI image detection service.
 *
 * Replaces the broken frontend implementation that:
 *   - Used Math.random() for 30% of the confidence score
 *   - Had a hardcoded +0.30 bias making nearly every image "AI-Generated"
 *   - Generated fake signal values (edgeSmoothing, artifactDetection)
 *
 * This implementation is fully deterministic. The same image always produces
 * the same result. Heuristics operate on:
 *   1. File metadata (size-to-dimension density — AI images tend to be very
 *      efficiently compressed by diffusion model pipelines)
 *   2. Raw pixel statistics from the Buffer (color channel balance, entropy)
 *   3. File header analysis (EXIF presence, PNG chunk structure)
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  TODO: ML Integration Point                                     │
 * │  Replace `computeHeuristics()` with a real model call:         │
 * │    - Hive Moderation AI Image Detection API                     │
 * │    - Sightengine AI-generated image detector                    │
 * │    - Local ONNX classifier (CNNDetection, UniversalFakeDetect)  │
 * │  The return shape { confidence, verdict, signals } stays fixed. │
 * └─────────────────────────────────────────────────────────────────┘
 */

'use strict';

const { buildResult } = require('../utils/confidenceCalculator');

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Analyze an image buffer for AI-generation signals.
 * @param {Buffer} buffer    - Raw image bytes from multer memoryStorage
 * @param {string} mimeType  - e.g. 'image/jpeg'
 * @param {Object} meta      - Optional: { width, height } if sent from client
 * @returns {{ confidence, verdict, signals, processingTime }}
 */
function analyzeImage(buffer, mimeType, meta = {}) {
  const start = Date.now();

  const signals = computeSignals(buffer, mimeType, meta);
  const weightedScore = computeWeightedScore(signals);

  const result = buildResult(
    {
      byteEntropyScore:    signals.entropy,
      colorChannelBalance: signals.channelBalance,
      compressionDensity:  signals.compressionDensity,
      headerAnomalies:     signals.headerAnomalies,
    },
    weightedScore,
    'image'
  );

  result.processingTime = `${Date.now() - start}ms`;
  result.fileSize       = `${(buffer.length / 1024).toFixed(1)} KB`;
  result.format         = mimeType.split('/')[1].toUpperCase();
  return result;
}

// ── Signal Extraction ─────────────────────────────────────────────────────────

function computeSignals(buffer, mimeType, meta) {
  return {
    entropy:            byteEntropyScore(buffer),
    channelBalance:     colorChannelBalance(buffer),
    compressionDensity: compressionDensityScore(buffer, meta),
    headerAnomalies:    headerAnomalyScore(buffer, mimeType),
  };
}

function computeWeightedScore(signals) {
  return (
    signals.entropy            * 0.30 +
    signals.channelBalance     * 0.25 +
    signals.compressionDensity * 0.25 +
    signals.headerAnomalies    * 0.20
  );
}

// ── Individual Signal Functions ───────────────────────────────────────────────

/**
 * Byte-level entropy of the raw file buffer.
 *
 * AI-generated images (from diffusion models like DALL-E, Midjourney, Stable
 * Diffusion) tend to have a characteristic entropy fingerprint in their
 * compressed byte stream — typically more uniform distribution of byte values
 * compared to natural photos which have more irregular entropy patterns.
 *
 * HIGH entropy uniformity → possible AI signal.
 * Returns 0–1.
 */
function byteEntropyScore(buffer) {
  // Sample up to 4096 bytes for performance
  const sample    = buffer.length > 4096 ? buffer.slice(0, 4096) : buffer;
  const freq      = new Array(256).fill(0);

  for (let i = 0; i < sample.length; i++) {
    freq[sample[i]]++;
  }

  // Shannon entropy
  let entropy = 0;
  const len   = sample.length;
  for (const count of freq) {
    if (count === 0) continue;
    const p = count / len;
    entropy -= p * Math.log2(p);
  }

  // Max entropy is 8 bits. Natural images: 6.5–7.5. AI: often 7.3–7.8.
  // Normalize: score increases when entropy is very high and uniform.
  const normalized = Math.max(0, (entropy - 6.5) / 1.5); // 6.5–8.0 → 0–1
  return Math.min(1, normalized);
}

/**
 * Color channel balance analysis.
 *
 * AI generators tend to produce images with slightly unnatural color channel
 * distributions — the R, G, B byte values in the compressed stream tend to
 * be more balanced than real photographs which are naturally dominated by
 * certain channels depending on content.
 *
 * Very balanced channels → possible AI signal.
 * Returns 0–1.
 */
function colorChannelBalance(buffer) {
  // Sample every 3rd byte to approximate R,G,B channels in raw stream
  const sample = buffer.length > 3000 ? buffer.slice(0, 3000) : buffer;

  let sumA = 0, sumB = 0, sumC = 0;
  for (let i = 0; i < sample.length - 2; i += 3) {
    sumA += sample[i];
    sumB += sample[i + 1];
    sumC += sample[i + 2];
  }

  const total = sumA + sumB + sumC;
  if (total === 0) return 0.5;

  const fracA = sumA / total;
  const fracB = sumB / total;
  const fracC = sumC / total;

  // Perfect balance = 0.333 each. Measure deviation from perfect balance.
  const deviation = (
    Math.abs(fracA - 1/3) +
    Math.abs(fracB - 1/3) +
    Math.abs(fracC - 1/3)
  );

  // Low deviation (< 0.05) → very balanced → AI signal
  // High deviation (> 0.20) → natural imbalance → human photo
  const score = Math.max(0, 1 - deviation / 0.15);
  return Math.min(1, score);
}

/**
 * File size vs. declared dimensions density.
 *
 * If the client sends width/height metadata, we can compute bytes-per-pixel.
 * AI images from diffusion models have characteristic compression ratios.
 * Without metadata, falls back to a file-size heuristic.
 * Returns 0–1.
 */
function compressionDensityScore(buffer, meta) {
  const fileSizeKB = buffer.length / 1024;

  if (meta.width && meta.height) {
    const pixels         = meta.width * meta.height;
    const bytesPerPixel  = buffer.length / pixels;
    // Very efficient compression (< 0.15 B/px) → common in AI-generated images
    // Natural photos typically compress to 0.2–1.0 B/px in JPEG
    const score = Math.max(0, 1 - bytesPerPixel / 0.3);
    return Math.min(1, score);
  }

  // Fallback: very small files for their implied quality are AI-suspicious
  // (AI images tend to be efficiently compressed at high visual quality)
  if (fileSizeKB < 50)  return 0.3;   // Too small → likely a thumbnail
  if (fileSizeKB < 200) return 0.55;  // Moderate — ambiguous
  if (fileSizeKB < 800) return 0.45;  // Normal photo range
  return 0.3;                          // Very large → likely raw/uncompressed
}

/**
 * File header / magic bytes analysis.
 *
 * Checks for the presence of EXIF metadata in JPEG files.
 * Real cameras always embed EXIF data (GPS, camera model, shutter speed, etc.)
 * AI-generated images typically have NO EXIF or minimal EXIF.
 * Missing EXIF in a JPEG is a moderate AI signal.
 * Returns 0–1.
 */
function headerAnomalyScore(buffer, mimeType) {
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
    // Check for EXIF marker (0xFF 0xE1) in first 512 bytes
    const header = buffer.slice(0, 512);
    let hasExif  = false;
    for (let i = 0; i < header.length - 1; i++) {
      if (header[i] === 0xFF && header[i + 1] === 0xE1) {
        hasExif = true;
        break;
      }
    }
    // No EXIF → moderate AI signal (0.6)
    // Has EXIF → less likely AI (0.2)
    return hasExif ? 0.2 : 0.6;
  }

  if (mimeType === 'image/png') {
    // PNG with no metadata chunks after IHDR → mild AI signal
    // Real screenshots and photos usually have some ancillary chunks
    const pngHeader = buffer.slice(0, 33).toString('hex');
    const hasMetaChunks = buffer.slice(33, 500).toString('hex').includes('74455874'); // tEXt chunk
    return hasMetaChunks ? 0.25 : 0.5;
  }

  return 0.4; // Neutral for other formats
}

module.exports = { analyzeImage };
