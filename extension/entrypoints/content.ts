import { createGmApi } from '../utils/gm-shim';
import { migrateLegacyUserscriptStorage } from '../utils/storage';
import { bootToolkit } from '../utils/toolkit-bundle';

function renderInlineMigrationNotice(version: string) {
  if (document.getElementById('amaes-migration-notice')) return;

  const box = document.createElement('div');
  box.id = 'amaes-migration-notice';
  box.style.cssText = [
    'margin: 10px 0 14px 0',
    'padding: 12px 14px',
    'border-radius: 10px',
    'border: 1px solid #3b82f6',
    'background: #0f172a',
    'color: #e2e8f0',
    'font-family: system-ui, -apple-system, sans-serif',
    'font-size: 13px',
    'line-height: 1.45',
    'display: flex',
    'flex-wrap: wrap',
    'align-items: center',
    'justify-content: space-between',
    'gap: 10px',
  ].join(';');

  const textWrap = document.createElement('div');
  textWrap.style.flex = '1 1 280px';

  const title = document.createElement('strong');
  title.textContent = `AMAES Toolkit Extension v${version} is active alongside an older userscript.`;
  title.style.display = 'block';
  title.style.color = '#93c5fd';

  const body = document.createElement('span');
  body.textContent =
    'Your settings and API keys have been imported automatically. Please disable the old userscript in your script manager and refresh this page to avoid duplicate panels.';

  textWrap.appendChild(title);
  textWrap.appendChild(body);

  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex;align-items:center;gap:8px;flex-shrink:0;';

  const dismissBtn = document.createElement('button');
  dismissBtn.type = 'button';
  dismissBtn.textContent = 'Dismiss';
  dismissBtn.style.cssText =
    'padding:6px 10px;border-radius:6px;background:#1e293b;color:#cbd5e1;border:1px solid #334155;font-size:12px;cursor:pointer;';
  dismissBtn.addEventListener('click', () => box.remove());

  actions.appendChild(dismissBtn);
  box.appendChild(textWrap);
  box.appendChild(actions);

  const hostContainer =
    document.getElementById('region-main') ||
    document.getElementById('page-content') ||
    document.querySelector('main');

  if (hostContainer) {
    hostContainer.prepend(box);
  } else {
    box.style.position = 'fixed';
    box.style.left = '16px';
    box.style.bottom = '16px';
    box.style.maxWidth = '460px';
    box.style.zIndex = '99998';
    box.style.margin = '0';
    document.body?.appendChild(box);
  }
}

export default defineContentScript({
  matches: [
    'https://semestral.amaes.com/*',
    'https://semestralexam.amaes.com/*',
    'https://study-tool-amaes.pages.dev/*',
  ],
  runAt: 'document_end',
  async main() {
    const version = browser.runtime.getManifest().version;

    // On the AMAES Toolkit site, expose extension version for "Check status" detection.
    if (window.location.hostname === 'study-tool-amaes.pages.dev') {
      document.documentElement.setAttribute('data-amaes-toolkit-version', version);
      document.documentElement.dataset.amaesExtensionActive = '1';
      document.dispatchEvent(
        new CustomEvent('amaes-toolkit-detected', {
          detail: { version },
        }),
      );
      return;
    }

    // Import legacy userscript settings and cached answer banks from localStorage on first run.
    await migrateLegacyUserscriptStorage(
      browser.storage.local,
      window.localStorage,
    );

    // Guard against duplicate panel injection if the legacy Violentmonkey script is still enabled.
    const legacyActive =
      document.documentElement.dataset.amaesUserscriptActive === '1' ||
      Boolean(document.getElementById('amaes-panel')) ||
      Boolean(document.getElementById('amaes-toolkit-panel'));
    if (legacyActive) {
      renderInlineMigrationNotice(version);
      return;
    }

    document.documentElement.dataset.amaesExtensionActive = '1';

    // Pull cached dynamic config (flags & Moodle selector overrides) via background worker.
    try {
      const cfgRes = (await browser.runtime.sendMessage({
        type: 'GET_DYNAMIC_CONFIG',
      })) as { ok?: boolean; config?: unknown } | undefined;
      if (cfgRes?.ok && cfgRes.config) {
        (globalThis as Record<string, unknown>).__AMAES_REMOTE_CONFIG__ = cfgRes.config;
      }
    } catch {
      // Fall back silently to bundled defaults.
    }

    // Preload extension storage into the GM shim and boot the full AMAES Toolkit.
    const gmApi = await createGmApi();
    bootToolkit(gmApi);
  },
});
