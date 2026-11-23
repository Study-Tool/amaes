(function () {
  'use strict';

  const RELAY_BASE_URL = 'https://amaes-community-relay.study-tool-amaes-relay.workers.dev';
  let latestVersion = '0.1.3';

  function getDownloadMeta(browser, version) {
    const cleanVer = String(version || '0.1.0').replace(/^v/i, '');
    const isFirefox = browser === 'firefox';
    const target = isFirefox ? 'firefox' : 'chrome';
    const filename = `amaes-toolkit-${target}-v${cleanVer}.zip`;
    const href = `downloads/${filename}`;
    if (browser === 'chrome') {
      return {
        href,
        filename,
        label: `Download AMAES Toolkit v${cleanVer} for Chrome`,
        extPage: 'chrome://extensions',
        steps: '<strong>Chrome &amp; Brave:</strong> Click <strong>Copy Extensions URL</strong> above, paste it into your address bar (<code>Ctrl+L</code> then <code>Ctrl+V</code>), turn <strong>Developer mode</strong> ON (top right), click <strong>Load unpacked</strong>, and select the extracted folder.'
      };
    }
    if (browser === 'edge') {
      return {
        href,
        filename,
        label: `Download AMAES Toolkit v${cleanVer} for Edge`,
        extPage: 'edge://extensions',
        steps: '<strong>Edge:</strong> Click <strong>Copy Extensions URL</strong> above, paste it into your address bar (<code>Ctrl+L</code> then <code>Ctrl+V</code>), turn <strong>Developer mode</strong> ON, click <strong>Load unpacked</strong>, and select the extracted folder.'
      };
    }
    if (isFirefox) {
      return {
        href,
        filename,
        label: `Download AMAES Toolkit v${cleanVer} for Firefox`,
        extPage: 'about:debugging#/runtime/this-firefox',
        steps: '<strong>Firefox:</strong> Click <strong>Copy Extensions URL</strong> above, paste it into your address bar, click <strong>Load Temporary Add-on...</strong>, and pick <code>manifest.json</code> inside the extracted folder (or load the <code>.zip</code> directly).'
      };
    }
    return {
      href,
      filename,
      label: `Download AMAES Toolkit v${cleanVer} (.zip)`,
      extPage: 'chrome://extensions',
      steps: 'Extract the downloaded archive, open your browser extensions page with Developer mode enabled, and choose <strong>Load unpacked</strong>.'
    };
  }

  const names = {
    chrome: 'Chrome / Chromium',
    edge: 'Microsoft Edge',
    firefox: 'Firefox',
    other: 'your browser'
  };

  const browserName = document.getElementById('browser-name');
  const downloadLink = document.getElementById('download-link');
  const reinstallLink = document.getElementById('reinstall-link');
  const extPageUrlEl = document.getElementById('ext-page-url');
  const copyExtUrlBtn = document.getElementById('copy-ext-url-btn');
  const copyExtUrlFeedback = document.getElementById('copy-ext-url-feedback');
  const browserLoadText = document.getElementById('browser-load-text');
  const checkResult = document.getElementById('check-result');
  const versionResult = document.getElementById('version-result');
  const activeActions = document.getElementById('active-actions');
  const toolkitStepTitle = document.getElementById('toolkit-step-title');
  const statusCopy = document.getElementById('status-copy');
  const browserStep = document.getElementById('browser-step');
  const installStep = document.getElementById('install-step');
  const releaseVersionEl = document.getElementById('release-version');
  const heroVersionBadge = document.getElementById('hero-version-badge');
  const heroAnnouncement = document.getElementById('hero-announcement');
  const relayHealthBadge = document.getElementById('relay-health-badge');
  const inlineUpdateBanner = document.getElementById('inline-update-banner');
  const inlineUpdateTitle = document.getElementById('inline-update-title');
  const inlineUpdateBtn = document.getElementById('inline-update-btn');
  const inlineUpdateSteps = document.getElementById('inline-update-steps');
  const inlineCopyExtBtn = document.getElementById('inline-copy-ext-btn');

  let detectedVersion = null;
  let activeBrowser = 'chrome';

  function parseVersion(version) {
    const match = String(version || '').trim().replace(/^v/i, '').match(/^(\d+)\.(\d+)\.(\d+)$/);
    return match ? match.slice(1).map(Number) : null;
  }

  function compareVersions(left, right) {
    const a = parseVersion(left);
    const b = parseVersion(right);
    if (!a || !b) return null;
    for (let i = 0; i < 3; i += 1) {
      if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1;
    }
    return 0;
  }

  function renderVersionStatus() {
    if (!detectedVersion || !latestVersion || !versionResult) return;
    const comparison = compareVersions(detectedVersion, latestVersion);
    if (comparison === null) {
      versionResult.className = 'version-result outdated';
      versionResult.textContent = 'Installed version could not be compared with latest.';
      if (inlineUpdateBanner) inlineUpdateBanner.hidden = true;
      return;
    }
    if (comparison < 0) {
      versionResult.className = 'version-result outdated';
      versionResult.textContent = `Update available: v${latestVersion}`;
      if (inlineUpdateBanner) {
        if (inlineUpdateTitle) {
          inlineUpdateTitle.textContent = `AMAES Toolkit v${latestVersion} is available (you have v${detectedVersion})`;
        }
        const cfg = getDownloadMeta(activeBrowser, latestVersion);
        if (inlineUpdateBtn) {
          inlineUpdateBtn.href = cfg.href;
          inlineUpdateBtn.setAttribute('download', cfg.filename);
          inlineUpdateBtn.textContent = `Download v${latestVersion}`;
        }
        if (inlineUpdateSteps) {
          const isFx = activeBrowser === 'firefox';
          inlineUpdateSteps.innerHTML = isFx
            ? `<li>Click <strong>Download v${latestVersion}</strong> below.</li><li>Extract the files directly into your existing AMAES folder (where <code>manifest.json</code> lives) and replace all files.</li><li>Open <code>${cfg.extPage}</code> and click <strong>Reload</strong> (or <strong>Load Temporary Add-on</strong> &rarr; <code>manifest.json</code>).</li>`
            : `<li>Click <strong>Download v${latestVersion}</strong> below.</li><li>Extract the files directly into your existing AMAES folder (where <code>manifest.json</code> lives) and replace all files so settings stay saved.</li><li>Open <code>${cfg.extPage}</code> and click <strong>Reload</strong> on AMAES Toolkit.</li>`;
        }
        if (inlineCopyExtBtn) {
          inlineCopyExtBtn.textContent = `Copy ${cfg.extPage}`;
        }
        inlineUpdateBanner.hidden = false;
      }
    } else {
      versionResult.className = 'version-result current';
      versionResult.textContent = comparison === 0 ? 'Up to date' : 'Ahead of release';
      if (inlineUpdateBanner) inlineUpdateBanner.hidden = true;
    }
  }

  function announceDetected(versionValue) {
    detectedVersion = versionValue || 'installed';
    document.body.classList.add('toolkit-active');
    if (toolkitStepTitle) toolkitStepTitle.textContent = 'AMAES Toolkit Ready';
    if (statusCopy) statusCopy.textContent = `AMAES Toolkit v${detectedVersion} is active in this browser.`;
    if (activeActions) activeActions.hidden = false;
    if (browserStep) browserStep.classList.add('completed');
    if (installStep) installStep.classList.add('completed');
    if (checkResult) {
      checkResult.style.color = '#86efac';
      checkResult.textContent = `AMAES Toolkit v${detectedVersion} detected!`;
    }
    renderVersionStatus();
  }

  function detectFromPageMarker() {
    const marker = document.documentElement.getAttribute('data-amaes-toolkit-version');
    if (marker) {
      announceDetected(marker);
      return true;
    }
    return false;
  }

  document.addEventListener('amaes-toolkit-detected', function (event) {
    let ver = null;
    try {
      ver = event && event.detail && event.detail.version;
    } catch (_) {
      ver = null;
    }
    announceDetected(ver || document.documentElement.getAttribute('data-amaes-toolkit-version'));
  });

  function chooseBrowser(browser) {
    activeBrowser = browser;
    document.querySelectorAll('.browser-choice').forEach(function (button) {
      button.classList.toggle('selected', button.dataset.browser === browser);
    });
    const cfg = getDownloadMeta(browser, latestVersion);
    if (browserName) browserName.textContent = names[browser] || names.other;
    if (downloadLink) {
      downloadLink.href = cfg.href;
      downloadLink.setAttribute('download', cfg.filename);
      downloadLink.textContent = cfg.label;
    }
    if (reinstallLink) {
      reinstallLink.href = cfg.href;
      reinstallLink.setAttribute('download', cfg.filename);
    }
    if (inlineUpdateBtn) {
      inlineUpdateBtn.href = cfg.href;
      inlineUpdateBtn.setAttribute('download', cfg.filename);
    }
    if (extPageUrlEl) extPageUrlEl.textContent = cfg.extPage;
    if (copyExtUrlFeedback) copyExtUrlFeedback.textContent = '';
    if (browserLoadText) browserLoadText.innerHTML = cfg.steps;
    if (inlineCopyExtBtn) inlineCopyExtBtn.textContent = `Copy ${cfg.extPage}`;
    renderVersionStatus();
  }

  const ua = navigator.userAgent.toLowerCase();
  const detectedBrowser = ua.includes('edg/')
    ? 'edge'
    : ua.includes('firefox')
    ? 'firefox'
    : ua.includes('chrome') || ua.includes('chromium')
    ? 'chrome'
    : 'other';

  document.querySelectorAll('.browser-choice').forEach(function (button) {
    button.addEventListener('click', function () {
      chooseBrowser(button.dataset.browser);
    });
  });
  chooseBrowser(detectedBrowser);

  if (copyExtUrlBtn && extPageUrlEl) {
    const copyCurrentExtUrl = function (onDone) {
      const targetUrl = extPageUrlEl.textContent.trim();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(targetUrl).then(onDone).catch(function () {});
      } else {
        const tmp = document.createElement('textarea');
        tmp.value = targetUrl;
        tmp.style.position = 'fixed';
        tmp.style.opacity = '0';
        document.body.appendChild(tmp);
        tmp.select();
        document.execCommand('copy');
        tmp.remove();
        onDone();
      }
    };
    copyExtUrlBtn.addEventListener('click', function () {
      copyCurrentExtUrl(function () {
        if (copyExtUrlFeedback) {
          copyExtUrlFeedback.textContent = 'Copied! Paste in address bar (Ctrl+L, Ctrl+V, Enter)';
        }
      });
    });
    if (inlineCopyExtBtn) {
      inlineCopyExtBtn.addEventListener('click', function () {
        copyCurrentExtUrl(function () {
          inlineCopyExtBtn.textContent = 'Copied!';
          setTimeout(function () {
            const cfg = getDownloadMeta(activeBrowser, latestVersion);
            inlineCopyExtBtn.textContent = `Copy ${cfg.extPage}`;
          }, 2000);
        });
      });
    }
  }

  const checkButton = document.getElementById('check-button');
  if (checkButton) {
    checkButton.addEventListener('click', function () {
      if (checkResult) {
        checkResult.style.color = '';
        checkResult.textContent = 'Checking...';
      }
      if (!detectFromPageMarker()) {
        setTimeout(function () {
          if (!detectFromPageMarker() && checkResult) {
            checkResult.style.color = '#fbbf24';
            checkResult.textContent = 'AMAES Toolkit not detected yet — load the unpacked folder and refresh this page.';
          }
        }, 200);
      }
    });
  }

  window.addEventListener('load', function () {
    detectFromPageMarker();
  });

  // Fetch dynamic links, latest version, and announcements from /v1/config
  fetch(`${RELAY_BASE_URL}/v1/config`, { headers: { Accept: 'application/json' } })
    .then(function (res) {
      if (!res.ok) throw new Error('Config unavailable');
      return res.json();
    })
    .then(function (cfg) {
      latestVersion = cfg.latestVersion || '0.1.0';
      if (releaseVersionEl) releaseVersionEl.textContent = `v${latestVersion}`;
      if (heroVersionBadge) heroVersionBadge.textContent = `v${latestVersion}`;
      if (relayHealthBadge) {
        relayHealthBadge.textContent = 'Online';
        relayHealthBadge.style.color = '#86efac';
      }
      if (heroAnnouncement && cfg.announcement) {
        heroAnnouncement.textContent = cfg.announcement;
        heroAnnouncement.hidden = false;
      }
      const links = cfg.links || {};
      const map = {
        'top-database-link': links.database,
        'top-repo-link': links.repo,
        'about-database-link': links.database,
        'footer-db-link': links.database,
        'footer-repo-link': links.repo,
        'footer-support-link': links.support
      };
      Object.entries(map).forEach(function ([id, url]) {
        const el = document.getElementById(id);
        if (el && url) el.href = url;
      });
      chooseBrowser(activeBrowser);
      renderVersionStatus();
    })
    .catch(function () {
      if (releaseVersionEl) releaseVersionEl.textContent = 'v0.1.0';
      if (relayHealthBadge) {
        relayHealthBadge.textContent = 'Offline';
        relayHealthBadge.style.color = '#fbbf24';
      }
    });

  // Smooth scroll without leaving hash clutter
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  // QR Modal
  const qrLink = document.getElementById('qr-card-link');
  const qrModal = document.getElementById('qr-modal');
  const qrModalClose = document.getElementById('qr-modal-close');
  const qrModalDismiss = document.getElementById('qr-modal-dismiss-btn');
  const qrModalFullscreen = document.getElementById('qr-modal-fullscreen-btn');
  const qrModalFullscreenText = document.getElementById('qr-modal-fullscreen-text');

  function openQrModal(e) {
    if (!qrModal) return;
    e.preventDefault();
    qrModal.hidden = false;
    requestAnimationFrame(function () {
      qrModal.classList.add('active');
    });
    document.body.style.overflow = 'hidden';
  }

  function closeQrModal() {
    if (!qrModal) return;
    qrModal.classList.remove('active');
    document.body.style.overflow = '';
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(function () {});
    }
    setTimeout(function () {
      if (!qrModal.classList.contains('active')) qrModal.hidden = true;
    }, 250);
  }

  function toggleFullscreen() {
    if (!qrModal) return;
    if (!document.fullscreenElement) {
      const req = qrModal.requestFullscreen || qrModal.webkitRequestFullscreen;
      if (req) req.call(qrModal).catch(function () {});
    } else if (document.exitFullscreen) {
      document.exitFullscreen().catch(function () {});
    }
  }

  if (qrLink) qrLink.addEventListener('click', openQrModal);
  if (qrModalClose) qrModalClose.addEventListener('click', closeQrModal);
  if (qrModalDismiss) qrModalDismiss.addEventListener('click', closeQrModal);
  if (qrModalFullscreen) qrModalFullscreen.addEventListener('click', toggleFullscreen);
  if (qrModal) {
    qrModal.addEventListener('click', function (e) {
      if (e.target === qrModal || e.target.classList.contains('qr-modal-container')) closeQrModal();
    });
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && qrModal && qrModal.classList.contains('active')) closeQrModal();
  });
  document.addEventListener('fullscreenchange', function () {
    if (qrModalFullscreenText) {
      qrModalFullscreenText.textContent = document.fullscreenElement ? 'Exit Fullscreen' : 'Fullscreen';
    }
  });
}());
