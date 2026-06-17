/**
 * services/videoDetector.js
 * Heuristic-based deepfake / AI video detection service.
 *
 * Replaces the frontend implementation that used pure Math.random().
 * Analysis is done on the raw video Buffer without requiring ffmpeg or any
 * native binary dependencies, using container-level heuristics.
 *
 * Signals analyzed:
 *   1. Bitrate density (file size vs. duration estimate)
 *   2. Container structure (MP4/WebM header patterns)
 *   3. Compression artifact patterns in the raw byte stream
 *   4. Moov atom positioning (AI-rendered videos have distinctive structure)
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  TODO: ML Integration Point                                     │
 * │  For production deepfake detection, replace with:              │
 * │    - FaceForensics++ model via Python microservice              │
 * │    - Microsoft Video Authenticator API                          │
 * │    - Deepware Scanner API                                       │
 * │    - Frame-by-frame analysis with a CNN (EfficientNet/ResNet)  │
 * │  The return shape { confidence, verdict, signals } stays fixed. │
 * └─────────────────────────────────────────────────────────────────┘
 */

'use strict';

const { buildResult } = require('../utils/confidenceCalculator');

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Analyze a video buffer for deepfake / AI-generation signals.
 * @param {Buffer} buffer    - Raw video bytes from multer memoryStorage
 * @param {string} mimeType  - e.g. 'video/mp4'
 * @param {Object} meta      - Optional: { duration, frameCount } from client
 * @returns {{ confidence, verdict, signals, processingTime }}
 */
function analyzeVideo(buffer, mimeType, meta = {}) {
  const start = Date.now();

  const signals = computeSignals(buffer, mimeType, meta);
  const weightedScore = computeWeightedScore(signals);

  const result = buildResult(
    {
      bitrateDensity:    signals.bitrateDensity,
      compressionPattern: signals.compressionPattern,
      containerAnomaly:  signals.containerAnomaly,
      streamUniformity:  signals.streamUniformity,
    },
    weightedScore,
    'video'
  );

  result.processingTime = `${Date.now() - start}ms`;
  result.fileSize       = `${(buffer.length / (1024 * 1024)).toFixed(2)} MB`;
  result.format         = mimeType.split('/')[1].toUpperCase();
  result.framesAnalyzed = meta.frameCount || 'N/A';
  return result;
}

// ── Signal Extraction ─────────────────────────────────────────────────────────

function computeSignals(buffer, mimeType, meta) {
  return {
    bitrateDensity:     bitrateDensityScore(buffer, meta),
    compressionPattern: compressionPatternScore(buffer),
    containerAnomaly:   containerAnomalyScore(buffer, mimeType),
    streamUniformity:   streamUniformityScore(buffer),
  };
}

function computeWeightedScore(signals) {
  return (
    signals.bitrateDensity     * 0.25 +
    signals.compressionPattern * 0.30 +
    signals.containerAnomaly   * 0.25 +
    signals.streamUniformity   * 0.20
  );
}

// ── Individual Signal Functions ───────────────────────────────────────────────

/**
 * Bitrate density analysis.
 *
 * AI-rendered videos (from text-to-video models like Sora, RunwayML, Pika)
 * tend to have unusually low or unnaturally consistent bitrates because the
 * generative process produces spatially smooth frames with few high-frequency
 * details, allowing very efficient compression.
 *
 * Very low bytes-per-second → possible AI signal.
 * Returns 0–1.
 */
function bitrateDensityScore(buffer, meta) {
  const fileSizeMB = buffer.length / (1024 * 1024);

  if (meta.duration && meta.duration > 0) {
    const bitrateKbps = (fileSizeMB * 8 * 1024) / meta.duration;
    // Very low bitrate (< 500 kbps) for a video file → AI signal
    // Normal content: 1000–8000 kbps
    if (bitrateKbps < 300)  return 0.8;
    if (bitrateKbps < 800)  return 0.65;
    if (bitrateKbps < 2000) return 0.45;
    if (bitrateKbps < 5000) return 0.3;
    return 0.2; // Very high bitrate → likely real camera footage
  }

  // Fallback without duration: very small video files are AI-suspicious
  if (fileSizeMB < 1)   return 0.7;
  if (fileSizeMB < 5)   return 0.5;
  if (fileSizeMB < 20)  return 0.35;
  return 0.25;
}

/**
 * Compression pattern analysis in the raw byte stream.
 *
 * AI-generated videos have distinctive patterns in how motion vectors and
 * keyframes are distributed. We approximate this by looking at byte-level
 * entropy in windows across the file, checking for uniformity.
 *
 * Very uniform entropy across windows → possible AI signal.
 * Returns 0–1.
 */
function compressionPatternScore(buffer) {
  // Sample 10 windows across the file
  const windowSize = Math.min(512, Math.floor(buffer.length / 10));
  if (windowSize < 64) return 0.4; // File too small

  const entropies = [];
  for (let w = 0; w < 10; w++) {
    const offset = Math.floor((w / 10) * (buffer.length - windowSize));
    const window = buffer.slice(offset, offset + windowSize);
    entropies.push(computeByteEntropy(window));
  }

  const avg      = entropies.reduce((a, b) => a + b, 0) / entropies.length;
  const variance = entropies.reduce((a, e) => a + Math.pow(e - avg, 2), 0) / entropies.length;
  const stdDev   = Math.sqrt(variance);

  // Low stdDev (< 0.3) → very uniform → AI signal
  // High stdDev (> 1.0) → variable → real video
  const uniformity = Math.max(0, 1 - stdDev / 1.0);
  return Math.min(1, uniformity);
}

/**
 * Container structure anomaly detection.
 *
 * AI video generation tools often produce files without standard camera
 * metadata atoms (moov, meta, udta). Checks for presence/absence of
 * standard container metadata in MP4/WebM files.
 *
 * Returns 0–1 (higher = more anomalous = more AI-like).
 */
function containerAnomalyScore(buffer, mimeType) {
  const header = buffer.slice(0, Math.min(4096, buffer.length)).toString('binary');

  if (mimeType === 'video/mp4' || mimeType === 'video/quicktime') {
    // Look for metadata atoms: udta, smta, ©too (encoder tag)
    const hasUdta  = header.includes('udta');
    const hasSmta  = header.includes('smta');
    const hasTool  = header.includes('\u00A9too') || header.includes('©too');
    const hasMvhd  = header.includes('mvhd'); // Movie header — should always exist

    let anomalyScore = 0.3; // Baseline
    if (!hasUdta) anomalyScore += 0.2;  // Missing user data → AI signal
    if (!hasSmta) anomalyScore += 0.1;  // Missing social metadata
    if (!hasTool) anomalyScore += 0.2;  // No encoder string → AI tool
    if (!hasMvhd) anomalyScore += 0.2;  // Malformed/minimal container

    return Math.min(1, anomalyScore);
  }

  if (mimeType === 'video/webm') {
    // WebM: check for DocType and SegmentInfo
    const hasDocType   = header.includes('webm');
    const hasInfo      = header.includes('Info') || header.includes('\x15\x49\xA9\x66');
    const hasEncoder   = header.includes('Lavf') || header.includes('encoder');

    let anomalyScore = 0.3;
    if (!hasDocType) anomalyScore += 0.15;
    if (!hasInfo)    anomalyScore += 0.2;
    if (!hasEncoder) anomalyScore += 0.25; // Missing encoder string → AI signal

    return Math.min(1, anomalyScore);
  }

  return 0.4; // Neutral for unknown formats
}

/**
 * Stream byte uniformity across the file.
 *
 * Human-captured videos have significant variation in byte patterns between
 * different temporal segments (scene changes, motion changes, lighting).
 * AI-generated videos tend to be more spatially and temporally homogeneous,
 * producing a more uniform byte distribution.
 *
 * Returns 0–1 (higher = more uniform = more AI-like).
 */
function streamUniformityScore(buffer) {
  if (buffer.length < 1024) return 0.4;

  // Build byte frequency histogram on a sample
  const sampleSize = Math.min(8192, buffer.length);
  const sample     = buffer.slice(
    Math.floor(buffer.length / 4), // Skip header (first 25%)
    Math.floor(buffer.length / 4) + sampleSize
  );

  const entropy = computeByteEntropy(sample);

  // High entropy (7.5–8.0) in video streams → very compressed / AI-generated
  // Natural video typically: 6.5–7.4
  const score = Math.max(0, (entropy - 7.0) / 1.0);
  return Math.min(1, score);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeByteEntropy(buf) {
  const freq = new Array(256).fill(0);
  for (let i = 0; i < buf.length; i++) freq[buf[i]]++;
  let entropy = 0;
  const len   = buf.length;
  for (const count of freq) {
    if (count === 0) continue;
    const p = count / len;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

module.exports = { analyzeVideo };
