export interface CandidateLike {
  verified?: boolean;
  source?: string;
  evidenceType?: string;
  isAiSuggestion?: boolean;
}

const SUPERSCRIPT_SUBSCRIPT_MAP: Record<string, string> = {
  '⁰': '0',
  '¹': '1',
  '²': '2',
  '³': '3',
  '⁴': '4',
  '⁵': '5',
  '⁶': '6',
  '⁷': '7',
  '⁸': '8',
  '⁹': '9',
  '₀': '0',
  '₁': '1',
  '₂': '2',
  '₃': '3',
  '₄': '4',
  '₅': '5',
  '₆': '6',
  '₇': '7',
  '₈': '8',
  '₉': '9',
};

const BASIC_HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
};

function decodeHtmlFallback(input: string): string {
  return input
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/gi, (m) => BASIC_HTML_ENTITIES[m.toLowerCase()] ?? m);
}

export function unscriptDigits(str: string | null | undefined): string {
  if (!str) return '';
  return String(str).replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹₀₁₂₃₄₅₆₇₈₉]/g, (ch) => SUPERSCRIPT_SUBSCRIPT_MAP[ch] || ch);
}

export function normalizeText(str: string | null | undefined): string {
  if (!str) return '';
  let text = String(str);
  if (typeof DOMParser !== 'undefined') {
    try {
      const doc = new DOMParser().parseFromString(text, 'text/html');
      text = doc.body?.textContent ?? text;
    } catch {
      text = decodeHtmlFallback(text);
    }
  } else {
    text = decodeHtmlFallback(text);
  }

  text = text.toLowerCase().trim();
  text = unscriptDigits(text);
  // Remove question numbering like "1.", "(1)", "question 1:", "question no. 1", "question #1", "q1.", "item 1:"
  text = text.replace(/^(?:(?:question|item|q)\s*(?:no\.?|#)?\s*\d+[\s:.-]*|\(?\d+\)?[\s:.)-]+)/i, '');

  const preambleRegex =
    /^(?:(?:direction|directions|instruction|instructions)\s*[:.\-–]\s*)?(?:read\s+(?:each\s+|the\s+)?(?:statement|question|passage)s?\s+(?:carefully\s+)?(?:and\s+)?)?(?:choose|select|pick|identify|mark)\s+(?:the\s+)?(?:best|correct|appropriate|right)\s+(?:answer|choice|option)[.:?!;\s–-]*/i;
  while (preambleRegex.test(text)) {
    const nextText = text.replace(preambleRegex, '').trim();
    if (nextText.length === 0) break;
    text = nextText;
  }

  const trailingPromptRegex =
    /\b(?:select\s+one|select\s+one\s+or\s+more|choose\s+one|choose\s+one\s+or\s+more|choose\s+the\s+best\s+answer)[:.]?\s*$/i;
  if (trailingPromptRegex.test(text)) {
    const nextText = text.replace(trailingPromptRegex, '').trim();
    if (nextText.length > 0) text = nextText;
  }

  text = text.replace(/_{2,}/g, '___');
  text = text.replace(/\s+/g, ' ');
  text = text.replace(/[.:?!;,]+$/, '');
  return text.trim();
}

export function stripQuestionMarkup(text: string | null | undefined): string {
  if (!text) return '';
  let prev: string;
  let curr = String(text);
  do {
    prev = curr;
    curr = curr.replace(/\[\s*(?:moodle-asset|dropdown|blank|image|___+)[^[\]]*\]/gi, ' ');
  } while (curr !== prev);
  do {
    prev = curr;
    curr = curr.replace(/\[\s*(?:image|dropdown|blank)[^[\]]*\]/gi, ' ');
  } while (curr !== prev);
  return curr;
}

export function normalizeQuestionMatchKey(value: string | null | undefined): string {
  return normalizeText(stripQuestionMarkup(value))
    .replace(/\[\s*_{2,}(?:\s*:\s*[\s\S]*?)?\s*\]/g, ' ')
    .replace(/[_\u00a0]+/g, ' ')
    .trim()
    .replace(/^[:?!;,—–-]+\s*/g, '')
    .replace(
      /^(?:(?:identify\s+(?:the\s+)?(?:following|term|what\s+is\s+being\s+described)|fill\s+in\s+the\s+blanks?|complete\s+the\s+(?:statement|sentence|following)|identification|identify))\s*[:.-]*\s*/i,
      '',
    )
    .replace(/^[:?!;,—–-]+\s*/g, '')
    .replace(/^(?:answer\s+)?question\s*(?:no\.?|#)?\s*\d+[\s:.-]*/i, '')
    .replace(/\s+\banswer\s+question\s*(?:no\.?|#)?\s*\d+[\s:.-]*$/i, '')
    .replace(
      /^(?:(?:this\s+(?:command|method|function)|jquery\s+(?:method|command|function)|it)\s+(?:is\s+)?(?:used\s+to\s+|that\s+is\s+used\s+to\s+))/i,
      '',
    )
    .replace(/\bcreates\b/gi, 'create')
    .replace(/\s+/g, ' ')
    .replace(/^[:?!;,—–-]+\s*/g, '')
    .replace(/[.:?!;,—–-]+$/g, '')
    .trim();
}

export function questionTextMatches(left: string | null | undefined, right: string | null | undefined): boolean {
  const leftNorm = normalizeQuestionMatchKey(left);
  const rightNorm = normalizeQuestionMatchKey(right);
  if (!leftNorm || !rightNorm) return false;
  if (leftNorm === rightNorm) return true;

  const longer = leftNorm.length >= rightNorm.length ? leftNorm : rightNorm;
  const shorter = leftNorm.length >= rightNorm.length ? rightNorm : leftNorm;

  if (shorter.length > 20 && longer.includes(shorter)) {
    const idx = longer.indexOf(shorter);
    const prefix = longer.slice(0, idx).trim();
    const suffix = longer.slice(idx + shorter.length).trim();
    const extra = `${prefix} ${suffix}`.trim();
    if (/\b(?:not|never|no|false|true)\b/i.test(extra)) return false;
    if (/^\.[a-z0-9_]+/i.test(prefix) || /\.[a-z0-9_]+\s*\(/i.test(extra)) return false;
    return shorter.length / longer.length >= 0.7;
  }

  return false;
}

export function normalizeChoice(str: string | null | undefined): string {
  if (!str) return '';
  let text = String(str);
  if (typeof DOMParser !== 'undefined' && /<[a-z][\s\S]*>/i.test(text)) {
    try {
      const doc = new DOMParser().parseFromString(text, 'text/html');
      const imgs = doc.body.querySelectorAll('img');
      let extracted = doc.body.textContent || '';
      if (!extracted.trim() && imgs.length > 0) {
        extracted = Array.from(imgs)
          .map((img) => {
            const m = (img.src || '').match(
              /\/pluginfile\.php\/\d+\/question\/(?:answer|questiontext|feedback)\/\d+(?:\/\d+)?\/([^?#\s]+)/i,
            );
            return img.alt || (m ? `[moodle-asset:${m[1]}]` : img.src) || '';
          })
          .join(' ');
      }
      text = extracted || text;
    } catch {
      // keep raw string
    }
  }
  text = text.toLowerCase().trim();
  text = text.replace(/^[a-z]\s*[.)]\s+/i, '');
  text = text.replace(
    /https?:\/\/[^/]+\/pluginfile\.php\/\d+\/question\/(?:answer|questiontext|feedback)\/\d+(?:\/\d+)?\/([^?#\s]+)/gi,
    '[moodle-asset:$1]',
  );
  text = text.replace(/[\u2212\u2013\u2014]/g, '-');
  text = text.replace(/[✓✔✗✘✕✖]/g, '');
  text = text.replace(/\s*[(\[]?(?:correct|incorrect)[)\]]?\s*$/i, '');
  text = text.replace(/\s+/g, ' ');
  text = text.replace(/[.:?!;,]+$/, '');
  text = unscriptDigits(text);
  return text.trim();
}

export function isConfirmedCandidate(item: CandidateLike | null | undefined): boolean {
  if (!item || item.verified !== true) return false;
  const src = String(item.source || '').toLowerCase();
  const evType = String(item.evidenceType || '').toLowerCase();
  const trustedEvidence = [
    'moodle_review',
    '100_percent',
    'moodle_100_percent',
    'moodle_review_elimination',
  ].includes(evType);
  const isAiOnlySource =
    item.isAiSuggestion === true ||
    evType === 'ai_inference' ||
    /(?:gemini|(^|[^a-z])ai([^a-z]|$))/.test(src);

  if (isAiOnlySource && !trustedEvidence) {
    return false;
  }

  return true;
}
