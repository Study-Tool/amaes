import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

function loadConfirmedCandidateFn() {
  const solverPath = path.resolve(import.meta.dirname, '..', 'toolkit-src', 'quiz', 'solver.js');
  const solverSrc = fs.readFileSync(solverPath, 'utf8');
  const start = solverSrc.indexOf('function isConfirmedCandidate(item)');
  const end = solverSrc.indexOf('function getStudyGuideInfo(item)');
  if (start < 0 || end < 0 || end <= start) {
    throw new Error('Could not locate isConfirmedCandidate in solver.js');
  }
  const fnCode = solverSrc.slice(start, end);
  const sandbox: Record<string, unknown> = {};
  vm.runInNewContext(`${fnCode}`, sandbox);
  return sandbox.isConfirmedCandidate as (item: Record<string, unknown> | null) => boolean;
}

describe('isConfirmedCandidate and auto-answer verification', () => {
  it('accepts verified:true database entries across all non-AI sources', () => {
    const isConfirmedCandidate = loadConfirmedCandidateFn();

    expect(isConfirmedCandidate({ verified: true, source: 'Grades-Harvester' })).toBe(true);
    expect(isConfirmedCandidate({ verified: true, source: 'community_contribution' })).toBe(true);
    expect(isConfirmedCandidate({ verified: true, source: 'Review' })).toBe(true);
    expect(isConfirmedCandidate({ verified: true, source: 'review_screen' })).toBe(true);
    expect(isConfirmedCandidate({ verified: true, source: 'verified_db' })).toBe(true);
    expect(isConfirmedCandidate({ verified: true, source: 'amauoed-ite6301' })).toBe(true);
    expect(isConfirmedCandidate({ verified: true, source: 'Elimination Deduction', evidenceType: 'moodle_review_elimination' })).toBe(true);
  });

  it('rejects unverified entries and unconfirmed AI inferences', () => {
    const isConfirmedCandidate = loadConfirmedCandidateFn();

    expect(isConfirmedCandidate(null)).toBe(false);
    expect(isConfirmedCandidate({ verified: false, source: 'amauoed' })).toBe(false);
    expect(isConfirmedCandidate({ verified: false, source: 'community_cache' })).toBe(false);
    expect(isConfirmedCandidate({ verified: true, isAiSuggestion: true, source: 'Google Gemini AI' })).toBe(false);
    expect(isConfirmedCandidate({ verified: true, source: 'Google Gemini AI', evidenceType: 'ai_inference' })).toBe(false);
    expect(isConfirmedCandidate({ verified: true, isAiSuggestion: true, source: 'Google Gemini AI', evidenceType: 'moodle_review' })).toBe(true);
  });

  it('allows study-guide/community fallback auto-pick when autoPickQuiz and autoPickStudyGuideFallback are enabled', () => {
    const solverPath = path.resolve(import.meta.dirname, '..', 'toolkit-src', 'quiz', 'solver.js');
    const solverSrc = fs.readFileSync(solverPath, 'utf8');
    expect(solverSrc).not.toContain('isStudyGuide && autoQuizMode && autoPickStudyGuideFallback');
    expect(solverSrc).toContain('isStudyGuide && autoPickStudyGuideFallback');
  });

  it('uses 3 Easy Steps in welcome modal with valid links and respects autoPickQuiz on load', () => {
    const modalsSrc = fs.readFileSync(path.resolve(import.meta.dirname, '..', 'toolkit-src', 'ui', 'modals.js'), 'utf8');
    const contentSrc = fs.readFileSync(path.resolve(import.meta.dirname, '..', 'entrypoints', 'content.ts'), 'utf8');
    const promptsSrc = fs.readFileSync(path.resolve(import.meta.dirname, '..', 'toolkit-src', 'ai', 'prompts.js'), 'utf8');
    const initSrc = fs.readFileSync(path.resolve(import.meta.dirname, '..', 'toolkit-src', 'init.js'), 'utf8');

    expect(modalsSrc).toContain('Get Started in 3 Easy Steps');
    expect(modalsSrc).not.toContain('frequently-asked-questions-faqs');
    expect(modalsSrc).not.toContain('Acads-Tools');
    expect(contentSrc).not.toContain('#migration-step');
    expect(promptsSrc).toContain('highlightQuizAnswers(cached, Boolean(autoPickQuiz), false)');
    expect(initSrc).toContain('highlightQuizAnswers((fresh || []).concat(jennyAnswers), Boolean(autoQuizMode || autoPickQuiz))');
  });
});
