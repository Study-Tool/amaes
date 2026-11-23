import {
  DEFAULT_REMOTE_CONFIG,
  getBrowserUpdateGuide,
  isUpdateAvailable,
  type RemoteConfig,
} from '../../utils/config';

let currentExtensionsUrl = 'chrome://extensions';

function renderUpdateCard(config: RemoteConfig, installedVersion: string) {
  const card = document.getElementById('update-card');
  const titleEl = document.getElementById('update-card-title');
  const versionEl = document.getElementById('update-card-version');
  const subtitleEl = document.getElementById('update-card-subtitle');
  const stepsEl = document.getElementById('update-steps-list');
  const downloadEl = document.getElementById('update-download-link') as HTMLAnchorElement | null;
  const copyBtn = document.getElementById('copy-ext-url-btn');
  if (!card || !stepsEl) return;

  const hasUpdate = isUpdateAvailable(installedVersion, config.latestVersion);
  if (!hasUpdate) {
    card.classList.add('hidden');
    return;
  }

  const guide = getBrowserUpdateGuide(navigator.userAgent);
  currentExtensionsUrl = guide.extensionsUrl;

  if (titleEl) titleEl.textContent = `Update Available (Installed: v${installedVersion})`;
  if (versionEl) versionEl.textContent = `v${config.latestVersion}`;
  if (subtitleEl) {
    subtitleEl.textContent = `${guide.browserLabel}: follow these 3 steps to keep your settings:`;
  }

  stepsEl.replaceChildren();
  for (const stepText of guide.steps) {
    const li = document.createElement('li');
    li.textContent = stepText;
    stepsEl.appendChild(li);
  }

  if (downloadEl) {
    downloadEl.href = config.links.extension || config.links.homepage;
  }
  if (copyBtn) {
    copyBtn.textContent = `Copy ${guide.extensionsUrl}`;
  }
  card.classList.remove('hidden');
}

function applyConfigToUi(config: RemoteConfig): boolean {
  const installedVersion = browser.runtime.getManifest().version;
  const versionBadge = document.getElementById('version-badge');
  if (versionBadge) {
    versionBadge.textContent = `v${installedVersion}`;
  }

  const bindLink = (id: string, url: string) => {
    const el = document.getElementById(id) as HTMLAnchorElement | null;
    if (!el) return;
    if (url) {
      el.href = url;
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  };

  bindLink('link-homepage', config.links.homepage);
  bindLink('link-database', config.links.database);
  bindLink('link-support', config.links.support);
  bindLink('link-repo', config.links.repo);
  bindLink('link-mirror', config.links.mirror);

  const announcementBox = document.getElementById('announcement-box');
  if (announcementBox) {
    if (config.announcement) {
      announcementBox.textContent = config.announcement;
      announcementBox.classList.remove('hidden');
    } else {
      announcementBox.classList.add('hidden');
    }
  }

  renderUpdateCard(config, installedVersion);
  return isUpdateAvailable(installedVersion, config.latestVersion);
}

async function loadConfig(forceRefresh = false) {
  const statusEl = document.getElementById('status-text');
  if (statusEl) statusEl.textContent = forceRefresh ? 'Checking...' : 'Loading...';

  try {
    const res = (await browser.runtime.sendMessage({
      type: 'GET_DYNAMIC_CONFIG',
      forceRefresh,
    })) as { ok?: boolean; config?: RemoteConfig };
    const cfg = res?.config || DEFAULT_REMOTE_CONFIG;
    const hasUpdate = applyConfigToUi(cfg);
    if (statusEl) {
      statusEl.textContent = hasUpdate
        ? `Update v${cfg.latestVersion} available`
        : `Up to date (v${browser.runtime.getManifest().version})`;
    }
  } catch {
    applyConfigToUi(DEFAULT_REMOTE_CONFIG);
    if (statusEl) statusEl.textContent = 'Offline defaults';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  applyConfigToUi(DEFAULT_REMOTE_CONFIG);
  void loadConfig(false);

  const refreshBtn = document.getElementById('refresh-config-btn');
  refreshBtn?.addEventListener('click', () => {
    void loadConfig(true);
  });

  const copyBtn = document.getElementById('copy-ext-url-btn');
  const feedbackEl = document.getElementById('copy-ext-feedback');
  copyBtn?.addEventListener('click', () => {
    const showCopied = () => {
      if (feedbackEl) {
        feedbackEl.textContent = `Copied ${currentExtensionsUrl} — paste in address bar and click Reload.`;
        feedbackEl.classList.remove('hidden');
      }
    };
    const showManual = () => {
      if (feedbackEl) {
        feedbackEl.textContent = `Copy manually: ${currentExtensionsUrl}`;
        feedbackEl.classList.remove('hidden');
      }
    };
    const tryFallback = () => {
      try {
        const tmp = document.createElement('textarea');
        tmp.value = currentExtensionsUrl;
        tmp.style.position = 'fixed';
        tmp.style.opacity = '0';
        document.body.appendChild(tmp);
        tmp.select();
        const ok = document.execCommand('copy');
        tmp.remove();
        if (ok) showCopied();
        else showManual();
      } catch {
        showManual();
      }
    };

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(currentExtensionsUrl).then(showCopied).catch(tryFallback);
    } else {
      tryFallback();
    }
  });
});
