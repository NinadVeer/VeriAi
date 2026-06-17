/**
 * utils/confidenceCalculator.js
 * Shared helpers to normalize raw scores into confidence percentages
 * and derive verdicts consistently across all detector services.
 */

'use strict';

// Thresholds — adjust these to tune sensitivity across all detectors
const THRESHOLDS = {
  AI:       65,  // >= 65%  → AI / Deepfake Detected
  AMBIGUOUS: 35, // >= 35%  → Ambiguous / Inconclusive
  // < 35% → Human / Likely Authentic
};

/**
 * Clamp a value between min and max.
 */
function clamp(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Normalize a raw signal score (0–1 float) to an integer percentage (0–100).
 */
function toPercent(rawScore) {
  return Math.round(clamp(rawScore * 100, 0, 100));
}

/**
 * Given a confidence number (0–100), return a human-readable verdict.
 * @param {number} confidence  - 0 to 100
 * @param {'text'|'image'|'video'} contentType
 * @returns {string}
 */
function getVerdict(confidence, contentType = 'text') {
  const verdicts = {
    text: {
      ai:        'AI-Generated',
      ambiguous: 'Ambiguous',
      human:     'Human Written',
    },
    image: {
      ai:        'AI-Generated',
      ambiguous: 'Possibly AI-Generated',
      human:     'Likely Authentic',
    },
    video: {
      ai:        'Deepfake Detected',
      ambiguous: 'Inconclusive',
      human:     'Likely Authentic',
    },
  };

  const v = verdicts[contentType] || verdicts.text;

  if (confidence >= THRESHOLDS.AI)        return v.ai;
  if (confidence >= THRESHOLDS.AMBIGUOUS) return v.ambiguous;
  return v.human;
}

/**
 * Build a final result object from a raw signals map.
 * @param {Object} rawSignals   - keys: signal name, values: 0–1 floats
 * @param {number} weightedScore - final combined AI score (0–1 float)
 * @param {'text'|'image'|'video'} contentType
 * @returns {{ confidence, verdict, signals }}
 */
function buildResult(rawSignals, weightedScore, contentType) {
  const confidence = toPercent(clamp(weightedScore));
  const verdict    = getVerdict(confidence, contentType);

  // Convert all signal floats to integer percentages
  const signals = {};
  for (const [key, val] of Object.entries(rawSignals)) {
    signals[key] = typeof val === 'number' ? toPercent(val) : val;
  }

  return { confidence, verdict, signals };
}

module.exports = { clamp, toPercent, getVerdict, buildResult, THRESHOLDS };
