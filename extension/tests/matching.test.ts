import { describe, expect, it } from 'vitest';
import {
  isConfirmedCandidate,
  normalizeChoice,
  normalizeQuestionMatchKey,
  normalizeText,
  questionTextMatches,
  stripQuestionMarkup,
  unscriptDigits,
} from '../utils/matching';

describe('matching TypeScript module', () => {
  it('normalizes superscripts, HTML entities, numbering, and preambles', () => {
    expect(unscriptDigits('x² + y₁')).toBe('x2 + y1');
    expect(normalizeText('1. Choose the best answer: What is 2² &amp; 3?')).toBe('what is 22 & 3');
    expect(normalizeText('Question #4: OSI has 7 layers. Select one:')).toBe('osi has 7 layers');
  });

  it('normalizes choices cleanly without stripping negative numbers', () => {
    expect(normalizeChoice('a. Common Law')).toBe('common law');
    expect(normalizeChoice('b) -42 ✓')).toBe('-42');
    expect(normalizeChoice('True (Correct)')).toBe('true');
  });

  it('matches questions safely while guarding negations and code tokens', () => {
    const base = 'Which protocol operates at the transport layer of the OSI model?';
    expect(questionTextMatches(base, '1. ' + base)).toBe(true);
    expect(
      questionTextMatches(
        'Which protocol operates at the transport layer?',
        'Which protocol does NOT operate at the transport layer?',
      ),
    ).toBe(false);
    expect(stripQuestionMarkup('Fill in [blank:1] with [moodle-asset:img.png]')).toBe('Fill in   with  ');
    expect(normalizeQuestionMatchKey('Identify: ___ is a protocol.')).toBe('is a protocol');
  });

  it('validates confirmed candidates across all non-AI verified sources', () => {
    expect(isConfirmedCandidate({ verified: true, source: 'Grades-Harvester' })).toBe(true);
    expect(isConfirmedCandidate({ verified: true, source: 'community_contribution' })).toBe(true);
    expect(isConfirmedCandidate({ verified: true, source: 'Review' })).toBe(true);
    expect(isConfirmedCandidate({ verified: false, source: 'amauoed' })).toBe(false);
    expect(isConfirmedCandidate({ verified: true, isAiSuggestion: true, source: 'Google Gemini AI' })).toBe(false);
    expect(
      isConfirmedCandidate({
        verified: true,
        isAiSuggestion: true,
        source: 'Google Gemini AI',
        evidenceType: 'moodle_review',
      }),
    ).toBe(true);
  });
});
