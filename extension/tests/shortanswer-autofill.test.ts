import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

class FakeClassList {
  private set = new Set<string>();
  constructor(initial = '') {
    initial
      .split(/\s+/)
      .filter(Boolean)
      .forEach((cls) => this.set.add(cls));
  }
  add(...tokens: string[]) {
    tokens.filter(Boolean).forEach((t) => this.set.add(t));
  }
  remove(...tokens: string[]) {
    tokens.forEach((t) => this.set.delete(t));
  }
  contains(token: string) {
    return this.set.has(token);
  }
  toString() {
    return Array.from(this.set).join(' ');
  }
  [Symbol.iterator]() {
    return this.set.values();
  }
}

class FakeNode {
  parentNode: FakeElement | null = null;
  constructor(public textContent: string) {}
  get parentElement() {
    return this.parentNode;
  }
  cloneNode() {
    return new FakeNode(this.textContent);
  }
  remove() {
    if (!this.parentNode) return;
    this.parentNode.childNodes = this.parentNode.childNodes.filter((n) => n !== this);
    this.parentNode = null;
  }
}

class FakeElement {
  tagName: string;
  classList: FakeClassList;
  attrs: Record<string, string> = {};
  dataset: Record<string, string> = {};
  style: Record<string, string> = {};
  childNodes: Array<FakeElement | FakeNode> = [];
  parentNode: FakeElement | null = null;
  value = '';
  checked = false;
  type = '';
  title = '';
  onclick: ((e?: unknown) => void) | null = null;
  private _innerHTML = '';
  dispatchedEvents: string[] = [];

  constructor(tagName: string, attrs: Record<string, string> = {}, text = '') {
    this.tagName = tagName.toUpperCase();
    this.classList = new FakeClassList(attrs.class || '');
    Object.assign(this.attrs, attrs);
    if (attrs.type) this.type = attrs.type;
    if (attrs.value) this.value = attrs.value;
    if (text) this.appendChild(new FakeNode(text));
  }

  get parentElement() {
    return this.parentNode;
  }

  get className() {
    return this.classList.toString();
  }

  set className(val: string) {
    this.classList = new FakeClassList(val || '');
  }

  get children(): FakeElement[] {
    return this.childNodes.filter((n): n is FakeElement => n instanceof FakeElement);
  }

  get innerHTML() {
    return this._innerHTML;
  }

  set innerHTML(val: string) {
    this._innerHTML = val;
  }

  get textContent(): string {
    return this.childNodes
      .map((n) => (n instanceof FakeElement ? n.textContent : n.textContent))
      .join('');
  }

  set textContent(val: string) {
    this.childNodes = val ? [new FakeNode(val)] : [];
  }

  get innerText(): string {
    return this.textContent;
  }

  set innerText(val: string) {
    this.textContent = val;
  }

  setAttribute(name: string, val: string) {
    this.attrs[name] = String(val);
    if (name === 'class') this.classList = new FakeClassList(val);
    if (name === 'type') this.type = val;
    if (name === 'value') this.value = val;
  }

  getAttribute(name: string) {
    if (name === 'class') return this.className;
    if (name === 'type' && !('type' in this.attrs) && this.type) return this.type;
    return name in this.attrs ? this.attrs[name] : null;
  }

  appendChild<T extends FakeElement | FakeNode>(node: T): T {
    if (node.parentNode) node.remove();
    node.parentNode = this;
    this.childNodes.push(node);
    return node;
  }

  insertBefore<T extends FakeElement | FakeNode>(node: T, ref: FakeElement | FakeNode | null): T {
    if (!ref) return this.appendChild(node);
    if (node.parentNode) node.remove();
    const idx = this.childNodes.indexOf(ref);
    if (idx === -1) return this.appendChild(node);
    node.parentNode = this;
    this.childNodes.splice(idx, 0, node);
    return node;
  }

  insertAdjacentElement(pos: string, el: FakeElement) {
    if (!this.parentNode) return el;
    if (pos === 'afterend') {
      const idx = this.parentNode.childNodes.indexOf(this);
      if (el.parentNode) el.remove();
      el.parentNode = this.parentNode;
      this.parentNode.childNodes.splice(idx + 1, 0, el);
    }
    return el;
  }

  replaceWith(replacement: FakeElement | FakeNode | string) {
    if (!this.parentNode) return;
    const node =
      typeof replacement === 'string' ? new FakeNode(replacement) : replacement;
    if (node.parentNode) node.remove();
    const idx = this.parentNode.childNodes.indexOf(this);
    if (idx !== -1) {
      node.parentNode = this.parentNode;
      this.parentNode.childNodes.splice(idx, 1, node);
    }
    this.parentNode = null;
  }

  remove() {
    if (!this.parentNode) return;
    this.parentNode.childNodes = this.parentNode.childNodes.filter((n) => n !== this);
    this.parentNode = null;
  }

  cloneNode(deep = false): FakeElement {
    const copy = new FakeElement(this.tagName, { ...this.attrs, class: this.className });
    copy.value = this.value;
    copy.type = this.type;
    copy.dataset = { ...this.dataset };
    if (deep) {
      this.childNodes.forEach((child) => {
        copy.appendChild(child instanceof FakeElement ? child.cloneNode(true) : child.cloneNode());
      });
    }
    return copy;
  }

  dispatchEvent(ev: { type: string }) {
    this.dispatchedEvents.push(ev.type);
    return true;
  }

  private matchesSimple(part: string): boolean {
    let rem = part.trim();
    if (!rem) return false;

    const notMatches: string[] = [];
    rem = rem.replace(/:not\(([^)]+)\)/g, (_m, inner: string) => {
      notMatches.push(inner.trim());
      return '';
    });

    const attrMatches: Array<{ key: string; op: string; val: string }> = [];
    rem = rem.replace(/\[([^\]=~*^$|]+)(?:([*^$~|]?=)["']?([^"'\]]*)["']?)?\]/g, (_m, key, op = '', val = '') => {
      attrMatches.push({ key: key.trim(), op, val });
      return '';
    });

    const classes: string[] = [];
    rem = rem.replace(/\.([a-zA-Z0-9_-]+)/g, (_m, cls) => {
      classes.push(cls);
      return '';
    });

    let id = '';
    rem = rem.replace(/#([a-zA-Z0-9_-]+)/g, (_m, i) => {
      id = i;
      return '';
    });

    const tag = rem.trim().toUpperCase();
    if (tag && tag !== '*' && this.tagName !== tag) return false;
    if (id && this.attrs.id !== id) return false;
    if (classes.some((c) => !this.classList.contains(c))) return false;
    for (const a of attrMatches) {
      const actual = a.key === 'data-input-idx' ? this.attrs['data-input-idx'] : this.getAttribute(a.key);
      if (!a.op) {
        if (actual === null) return false;
      } else if (a.op === '=') {
        if (actual !== a.val) return false;
      } else if (a.op === '*=') {
        if (!actual || !actual.includes(a.val)) return false;
      }
    }
    for (const neg of notMatches) {
      if (this.matchesSimple(neg)) return false;
    }
    return true;
  }

  matches(selector: string): boolean {
    return selector.split(',').some((sel) => {
      const chain = sel.trim().split(/\s+/).filter(Boolean);
      if (chain.length === 0) return false;
      const last = chain[chain.length - 1];
      if (last === '>') return false;
      if (!this.matchesSimple(last)) return false;
      if (chain.length === 1) return true;
      let cursor: FakeElement | null = this;
      for (let i = chain.length - 2; i >= 0; i -= 1) {
        const token = chain[i];
        if (token === '>') {
          const parentToken = chain[i - 1];
          i -= 1;
          cursor = cursor?.parentNode || null;
          if (!cursor || !cursor.matchesSimple(parentToken)) return false;
        } else {
          cursor = cursor?.parentNode || null;
          while (cursor && !cursor.matchesSimple(token)) {
            cursor = cursor.parentNode;
          }
          if (!cursor) return false;
        }
      }
      return true;
    });
  }

  closest(selector: string): FakeElement | null {
    let cur: FakeElement | null = this;
    while (cur) {
      if (cur.matches(selector)) return cur;
      cur = cur.parentNode;
    }
    return null;
  }

  querySelectorAll(selector: string): FakeElement[] {
    const out: FakeElement[] = [];
    const visit = (node: FakeElement) => {
      for (const child of node.children) {
        if (child.matches(selector)) out.push(child);
        visit(child);
      }
    };
    visit(this);
    return out;
  }

  querySelector(selector: string): FakeElement | null {
    return this.querySelectorAll(selector)[0] || null;
  }
}

function loadSolverHarness() {
  const rootDir = path.resolve(import.meta.dirname, '..', 'toolkit-src');
  const detectorSrc = fs.readFileSync(path.join(rootDir, 'moodle', 'detector.js'), 'utf8');
  const diagnosticsSrc = fs.readFileSync(path.join(rootDir, 'dev', 'diagnostics.js'), 'utf8');
  const solverSrc = fs.readFileSync(path.join(rootDir, 'quiz', 'solver.js'), 'utf8');

  const detStart = detectorSrc.indexOf('    function normalizeText(');
  const detEnd = detectorSrc.indexOf('    // Auto-closes Moodle 4', detStart);
  const detSlice = detectorSrc.slice(detStart, detEnd);

  const cleanStart = diagnosticsSrc.indexOf('    const SUP_MAP =');
  const cleanEnd = diagnosticsSrc.indexOf('    // Fetch or convert an image URL', cleanStart);
  const cleanSlice = diagnosticsSrc.slice(cleanStart, cleanEnd);

  const idTypeStart = diagnosticsSrc.indexOf('    function mapQuestionTypeCategory(');
  const idTypeEnd = diagnosticsSrc.indexOf('    function recordUnknownQuestionType(', idTypeStart);
  const idTypeSlice = diagnosticsSrc.slice(idTypeStart, idTypeEnd);

  const doc = new FakeElement('body');
  const focusBanners: FakeElement[] = [];

  const sandbox: Record<string, unknown> = {
    DOMParser: class {
      parseFromString(str: string) {
        return { body: { textContent: String(str || '').replace(/<[^>]+>/g, '') } };
      }
    },
    Event: class {
      type: string;
      bubbles: boolean;
      constructor(type: string, opts?: { bubbles?: boolean }) {
        this.type = type;
        this.bubbles = Boolean(opts?.bubbles);
      }
    },
    MouseEvent: class {
      type: string;
      constructor(type: string) {
        this.type = type;
      }
    },
    HTMLInputElement: class {},
    window: {
      location: {
        pathname: '/2612/mod/quiz/attempt.php',
        search: '?attempt=278914&cmid=5902&page=13',
        href: 'https://semestral.amaes.com/2612/mod/quiz/attempt.php?attempt=278914&cmid=5902&page=13',
      },
      addEventListener: () => {},
    },
    document: {
      title: 'Prelim Quiz 2',
      createElement: (tag: string) => new FakeElement(tag),
      createTextNode: (text: string) => new FakeNode(text),
      querySelectorAll: (sel: string) => doc.querySelectorAll(sel),
      querySelector: (sel: string) => doc.querySelector(sel),
      addEventListener: () => {},
    },
    localStorage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    },
    sessionStorage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    },
    ICONS: { zap: '', xCircle: '', checkCircle: '', target: '', external: '', lightbulb: '', rotateCcw: '' },
    autoQuizMode: true,
    autoPickQuiz: true,
    autoPickStudyGuideFallback: true,
    autoNextQuiz: false,
    autoNextVerified: true,
    adaptiveProbeQuiz: true,
    adaptiveProbeBudget: 2,
    fastQuizMode: true,
    autoSubmitQuiz: false,
    knownWrongAnswerWarningListenersBound: false,
    isTermsAcknowledged: () => true,
    checkIsReviewPage: () => false,
    checkIsQuizAttemptPage: () => true,
    checkIsQuizPage: () => true,
    detectCourseInfo: () => ({ subjectCode: 'CS6204', subjectName: 'Computer Architecture' }),
    getQuizAttemptSummary: () => null,
    parseMoodleQuestionGrade: () => ({ earned: null, max: null, isFullMark: false, isZeroMark: false, isPartialMark: false }),
    hasChoiceCheckmark: () => false,
    hasChoiceCross: () => false,
    isChoiceRowEliminated: () => false,
    getStoredAmauoedUrl: () => 'https://amauoed.com/courses',
    recordUnknownQuestionType: () => {},
    detectAndReportQuestionAnomaly: () => {},
    getCachedAiAnswer: () => null,
    matchAiAnswerToChoice: () => null,
    setQuestionAiTag: () => {},
    setQuestionStudyGuideTag: () => {},
    updateQuestionAiDrawerState: () => {},
    renderNewQuestionFocusBanner: (que: FakeElement, qNum: string) => {
      const banner = new FakeElement('div', { class: 'amaes-new-question-focus-banner' }, `NO SAVED ${qNum}`);
      focusBanners.push(banner);
      (que.querySelector('.formulation') || que).appendChild(banner);
    },
    updateNextButtonIndicator: () => {},
    showToast: () => {},
    setLog: () => {},
    logDebug: () => {},
    escapeHtml: (s: string) => String(s),
    setTimeout,
    clearTimeout,
    Date,
    Math,
    Set,
    Map,
    Array,
    Object,
    String,
    Number,
    Boolean,
    JSON,
    console,
  };

  vm.runInNewContext(`${detSlice}\n${cleanSlice}\n${idTypeSlice}\n${solverSrc}`, sandbox);

  return { doc, focusBanners, sandbox };
}

describe('short-answer and Cloze autofill pipeline', () => {
  it('autofills Cloze / multianswer short-answer questions even when .qtext is absent', () => {
    const { doc, sandbox } = loadSolverHarness();

    const que = new FakeElement('div', { class: 'que multianswer' });
    const info = new FakeElement('div', { class: 'info' });
    info.appendChild(new FakeElement('h3', { class: 'no' }, 'Question 14'));
    // Flag image input inside .info must NOT confuse text input extraction.
    info.appendChild(new FakeElement('input', { type: 'image', class: 'questionflagimage' }));
    que.appendChild(info);

    const formulation = new FakeElement('div', { class: 'formulation clearfix' });
    const p = new FakeElement('p');
    p.appendChild(new FakeNode('These lines, collectively, are called the '));
    const subq = new FakeElement('span', { class: 'subquestion' });
    subq.appendChild(new FakeElement('label', { class: 'accesshide' }, 'Answer 1'));
    const textInput = new FakeElement('input', { type: 'text', name: 'q14:1_answer' });
    subq.appendChild(textInput);
    p.appendChild(subq);
    p.appendChild(new FakeNode(' .'));
    formulation.appendChild(p);
    que.appendChild(formulation);
    doc.appendChild(que);

    const db = [
      {
        qRaw: 'These lines, collectively, are called the [____: Data Bus] .',
        qNorm: 'these lines, collectively, are called the [___: data bus]',
        ansRaw: 'Data Bus',
        ansNorm: 'data bus',
        wrongAnswers: [],
        choices: [],
        verified: true,
        source: 'review_screen',
        questionType: 'shortanswer',
      },
      {
        qRaw: 'These lines, collectively, are called the [____: Transmission media] .',
        qNorm: 'these lines, collectively, are called the [___: transmission media]',
        ansRaw: '',
        ansNorm: '',
        wrongAnswers: ['Transmission media'],
        wrongAnswerEvidence: true,
        verified: false,
        source: 'review_screen',
        questionType: 'shortanswer',
      },
    ];

    const highlight = sandbox.highlightQuizAnswers as (d: unknown[], autoSelect: boolean) => { matched: number; total: number };
    const isAnswered = sandbox.isQuestionAnswered as (q: FakeElement) => boolean;

    const res = highlight(db, true);
    expect(res).toEqual({ matched: 1, total: 1 });
    expect(textInput.value).toBe('Data Bus');
    expect(textInput.dispatchedEvents).toEqual(['input', 'change', 'blur']);
    expect(que.querySelector('.amaes-shortans-hint')).not.toBeNull();
    expect(que.querySelector('.amaes-new-question-focus-banner')).toBeNull();
    expect(isAnswered(que)).toBe(true);
  });

  it('matches .qtext containing .accesshide labels and replaces confirmed wrong pre-filled input', () => {
    const { doc, sandbox } = loadSolverHarness();

    const que = new FakeElement('div', { class: 'que shortanswer' });
    const formulation = new FakeElement('div', { class: 'formulation' });
    const qtext = new FakeElement('div', { class: 'qtext' });
    qtext.appendChild(new FakeNode('These lines, collectively, are called the '));
    qtext.appendChild(new FakeElement('label', { class: 'accesshide' }, 'Answer Question 14'));
    const textInput = new FakeElement('input', { type: 'text', class: 'form-control', value: 'Transmission media' });
    qtext.appendChild(textInput);
    qtext.appendChild(new FakeNode(' .'));
    formulation.appendChild(qtext);
    que.appendChild(formulation);
    doc.appendChild(que);

    const db = [
      {
        qRaw: 'These lines, collectively, are called the .',
        qNorm: 'these lines, collectively, are called the',
        ansRaw: 'Data Bus',
        ansNorm: 'data bus',
        wrongAnswers: ['Transmission media'],
        wrongAnswerEvidence: true,
        choices: [],
        verified: true,
        source: 'review_screen',
        questionType: 'shortanswer',
      },
    ];

    const highlight = sandbox.highlightQuizAnswers as (d: unknown[], autoSelect: boolean) => { matched: number; total: number };
    const res = highlight(db, true);

    expect(res).toEqual({ matched: 1, total: 1 });
    expect(textInput.value).toBe('Data Bus');
  });

  it('allows fuzzy duplicate legacy keys when answers agree, but pauses when fuzzy answers conflict', () => {
    const { doc, sandbox } = loadSolverHarness();
    const normalizeKey = sandbox.normalizeQuestionMatchKey as (v: string) => string;

    expect(normalizeKey('These lines, collectively, are called the Answer Question 14.')).toBe(
      'these lines, collectively, are called the',
    );

    const que = new FakeElement('div', { class: 'que shortanswer' });
    const formulation = new FakeElement('div', { class: 'formulation' });
    const qtext = new FakeElement('div', { class: 'qtext' }, 'A set of parallel conducting lines connecting CPU components');
    const textInput = new FakeElement('input', { type: 'text', class: 'form-control' });
    formulation.appendChild(qtext);
    formulation.appendChild(textInput);
    que.appendChild(formulation);
    doc.appendChild(que);

    const agreeingDb = [
      {
        qRaw: 'Identify: A set of parallel conducting lines connecting CPU components in computer architecture',
        qNorm: 'a set of parallel conducting lines connecting cpu components in computer architecture',
        ansRaw: 'Data Bus',
        ansNorm: 'data bus',
        verified: true,
        source: 'review_screen',
      },
      {
        qRaw: 'A set of parallel conducting lines connecting CPU components in the system',
        qNorm: 'a set of parallel conducting lines connecting cpu components in the system',
        ansRaw: 'data bus',
        ansNorm: 'data bus',
        verified: true,
        source: 'review_screen',
      },
    ];

    const highlight = sandbox.highlightQuizAnswers as (d: unknown[], autoSelect: boolean) => { matched: number; total: number };
    const resAgree = highlight(agreeingDb, true);
    expect(resAgree).toEqual({ matched: 1, total: 1 });
    expect(textInput.value).toBe('Data Bus');
    expect(que.querySelector('.amaes-ambiguous-question-match-note')).toBeNull();

    // Now simulate genuinely conflicting fuzzy keys -> must pause and not autofill.
    textInput.value = '';
    que.querySelectorAll('.amaes-shortans-hint').forEach((el) => el.remove());
    const conflictingDb = [
      agreeingDb[0],
      {
        ...agreeingDb[1],
        ansRaw: 'Address Bus',
        ansNorm: 'address bus',
      },
    ];
    const resConflict = highlight(conflictingDb, true);
    expect(resConflict).toEqual({ matched: 0, total: 1 });
    expect(textInput.value).toBe('');
    expect(que.querySelector('.amaes-ambiguous-question-match-note')).not.toBeNull();
  });
});
