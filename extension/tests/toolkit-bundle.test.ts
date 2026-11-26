import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('toolkit-bundle', () => {
  it('contains zero legacy Acads-Tools/amaestoolkit/GreasyFork references and uses Cloudflare v0.1.4 endpoints', () => {
    const bundlePath = path.resolve(import.meta.dirname, '..', 'utils', 'toolkit-bundle.js');
    const code = fs.readFileSync(bundlePath, 'utf8');

    expect(code).toContain('const SCRIPT_VERSION = "v0.1.4";');
    expect(code).toContain('https://amaes-community-relay.study-tool-amaes-relay.workers.dev');
    expect(code).toContain('https://study-tool-amaes.pages.dev/');
    expect(code).toContain('/v1/config?_t=');
    expect(code).toContain('function getRemoteSelectors()');
    expect(code).not.toMatch(/Acads-Tools|acads-tools|amaestoolkit\.pages\.dev|greasyfork\.org/i);
  });

  it('boots cleanly on the portal host without throwing', async () => {
    const attrs: Record<string, string> = {};
    const events: string[] = [];

    vi.stubGlobal('window', {
      location: { hostname: 'study-tool-amaes.pages.dev', pathname: '/' },
    });
    vi.stubGlobal('document', {
      readyState: 'complete',
      documentElement: {
        setAttribute: (k: string, v: string) => {
          attrs[k] = v;
        },
      },
      dispatchEvent: (ev: { type: string }) => {
        events.push(ev.type);
      },
      getElementById: () => null,
      addEventListener: () => {},
    });
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    });
    vi.stubGlobal('CustomEvent', class {
      type: string;
      detail: unknown;
      constructor(type: string, init?: { detail?: unknown }) {
        this.type = type;
        this.detail = init?.detail;
      }
    });

    const { bootToolkit } = await import('../utils/toolkit-bundle.js');
    bootToolkit({
      GM_getValue: (_k: string, d?: unknown) => d,
      GM_setValue: async () => {},
      GM_deleteValue: async () => {},
      GM_setClipboard: () => {},
      GM_notification: () => {},
      GM_xmlhttpRequest: () => {},
    });

    expect(attrs['data-amaes-toolkit-version']).toBe('0.1.4');
    expect(events).toContain('amaes-toolkit-detected');
    vi.unstubAllGlobals();
  });
});
