/**
 * services/textDetector.js
 * Heuristic-based AI text detection service.
 *
 * All logic moved from the frontend script.js and significantly improved:
 * - No random values whatsoever
 * - Deterministic: same input always yields same output
 * - Modular signal functions, each independently testable
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  TODO: ML Integration Point                                     │
 * │  Replace `computeHeuristicScore()` with a call to a real model: │
 * │    - OpenAI text-davinci-003 log-probabilities                  │
 * │    - HuggingFace roberta-base-openai-detector API               │
 * │    - Local ONNX model via onnxruntime-node                      │
 * │  The return shape { confidence, verdict, signals } stays fixed. │
 * └─────────────────────────────────────────────────────────────────┘
 */

'use strict';

const { buildResult } = require('../utils/confidenceCalculator');

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Analyze a text string for AI-generation signals.
 * @param {string} text - Raw input text (already validated & sanitized)
 * @returns {{ confidence: number, verdict: string, signals: Object, processingTime: string }}
 */
function analyzeText(text) {
  const start = Date.now();

  const signals = computeSignals(text);
  const weightedScore = computeWeightedScore(signals);

  const result = buildResult(
    {
      fillerPhrases:   signals.fillerScore,
      sentenceUniform: signals.uniformScore,
      lowWordVariety:  1 - signals.wordVariety,
      lowBurstiness:   1 - signals.burstiness,
      hedgingLanguage: signals.hedging,
    },
    weightedScore,
    'text'
  );

  result.processingTime = `${Date.now() - start}ms`;
  result.wordCount      = countWords(text);
  return result;
}

// ── Signal Extraction ─────────────────────────────────────────────────────────

function computeSignals(text) {
  return {
    fillerScore:  fillerPhraseScore(text),
    uniformScore: sentenceUniformityScore(text),
    wordVariety:  wordVarietyScore(text),
    burstiness:   burstinessScore(text),
    hedging:      hedgingScore(text),
  };
}

/**
 * Weighted combination of all signals → single AI probability (0–1).
 * Weights must sum to 1.0.
 */
function computeWeightedScore(signals) {
  return (
    signals.fillerScore   * 0.30 +
    signals.uniformScore  * 0.25 +
    (1 - signals.wordVariety)  * 0.20 +
    (1 - signals.burstiness)   * 0.15 +
    signals.hedging       * 0.10
  );
}

// ── Individual Signal Functions ───────────────────────────────────────────────

/**
 * Density of AI-typical "filler" phrases per 100 words.
 * Higher → more likely AI.
 */
function fillerPhraseScore(text) {
  const FILLERS = [
    'it is important to', 'it is worth noting', 'in conclusion',
    'furthermore', 'moreover', 'additionally', 'it should be noted',
    'one might argue', 'it can be said', 'as mentioned earlier',
    'clearly', 'obviously', 'it is crucial', 'it is essential',
    'delve into', 'in the realm of', 'it is imperative',
    'navigating', 'multifaceted', 'paradigm', 'synergy',
    'leverage', 'comprehensive', 'holistic approach',
    'at the end of the day', 'in today\'s world',
  ];
  const lower    = text.toLowerCase();
  const wordCount = countWords(text);
  const hits     = FILLERS.reduce((acc, phrase) => {
    const re  = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const m   = lower.match(re);
    return acc + (m ? m.length : 0);
  }, 0);
  // Normalize: 1 filler per 100 words → score 0.5; 2+ per 100 words → 1.0
  return Math.min(1, (hits / Math.max(1, wordCount)) * 100 * 0.5);
}

/**
 * How uniform sentence lengths are (low variance = AI trait).
 * Returns 0 (highly varied = human) to 1 (very uniform = AI).
 */
function sentenceUniformityScore(text) {
  const sentences = text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (sentences.length < 3) return 0.4; // Not enough data — neutral

  const lengths = sentences.map((s) => countWords(s));
  const avg     = lengths.reduce((a, b) => a + b, 0) / lengths.length;

  if (avg === 0) return 0.4;

  // Coefficient of Variation: low CoV = uniform = AI
  const variance = lengths.reduce((acc, l) => acc + Math.pow(l - avg, 2), 0) / lengths.length;
  const stdDev   = Math.sqrt(variance);
  const cv       = stdDev / avg; // 0 = perfectly uniform, 1+ = highly varied

  // cv < 0.2 → very uniform (AI), cv > 0.8 → very varied (human)
  return Math.min(1, Math.max(0, 1 - cv / 0.8));
}

/**
 * Type-token ratio: unique words / total words.
 * Low variety → AI trait. Returns 0–1.
 */
function wordVarietyScore(text) {
  const words  = (text.toLowerCase().match(/\b[a-z]+\b/g) || []);
  if (words.length === 0) return 0.5;
  const unique = new Set(words).size;
  return unique / words.length; // Higher = more variety = more human
}

/**
 * Sentence burstiness: measures variance in pacing.
 * Low burstiness → AI trait (very regular rhythm).
 * Returns 0 (no bursts = AI) to 1 (bursty = human).
 */
function burstinessScore(text) {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  if (sentences.length < 4) return 0.5;

  const lengths   = sentences.map((s) => s.trim().length);
  const avg       = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const variance  = lengths.reduce((a, l) => a + Math.pow(l - avg, 2), 0) / lengths.length;
  const stdDev    = Math.sqrt(variance);

  // Normalize: stdDev > 40 chars → highly bursty (human)
  return Math.min(1, stdDev / 40);
}

/**
 * Presence of hedging language (uncertainty markers).
 * AI tends to either over-hedge or under-hedge.
 * This detects ABSENCE of natural hedging → AI signal.
 * Returns 0 (no hedges = AI) to 1 (natural hedging = human).
 */
function hedgingScore(text) {
  const HEDGES = [
    'maybe', 'perhaps', 'possibly', 'seem', 'might',
    'could', 'may', 'appear', 'apparently', 'supposedly',
    'i think', 'i believe', 'in my opinion', 'i feel',
    'not sure', 'probably', 'likely', 'uncertain',
  ];
  const lower    = text.toLowerCase();
  const wordCount = countWords(text);
  const hits     = HEDGES.reduce((acc, h) => {
    const re = new RegExp(`\\b${h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    return acc + (lower.match(re) || []).length;
  }, 0);
  // 1 hedge per 50 words → natural. Normalized to 0–1.
  return Math.min(1, (hits / Math.max(1, wordCount)) * 50);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function countWords(text) {
  return (text.trim().match(/\S+/g) || []).length;
}

module.exports = { analyzeText };
