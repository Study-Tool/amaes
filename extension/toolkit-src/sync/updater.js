    // ==========================================
    // Update Checker & Release Notifier
    // ==========================================

    function isNewerVersion(remote, local) {
        const rVersion = normalizeVersion(remote);
        const lVersion = normalizeVersion(local);
        if (!rVersion || !lVersion) return false;
        const r = rVersion.split('.').map(n => parseInt(n, 10));
        const l = lVersion.split('.').map(n => parseInt(n, 10));
        for (let i = 0; i < Math.max(r.length, l.length); i++) {
            const rv = r[i] || 0;
            const lv = l[i] || 0;
            if (rv > lv) return true;
            if (rv < lv) return false;
        }
        return false;
    }

    function normalizeVersion(value) {
        const match = String(value || '').trim().match(/^v?(\d+)\.(\d+)\.(\d+)$/i);
        return match ? `${Number(match[1])}.${Number(match[2])}.${Number(match[3])}` : null;
    }

    function getExtensionUpdateGuide() {
        const ua = (navigator.userAgent || '').toLowerCase();
        if (ua.includes('firefox')) {
            return {
                browserLabel: 'Firefox',
                extUrl: 'about:debugging#/runtime/this-firefox',
                steps: [
                    'Click Open Download Page below and save the new Firefox .zip file.',
                    'Extract the files directly into your existing AMAES folder (where manifest.json lives) and replace all files.',
                    'Open about:debugging#/runtime/this-firefox and click Reload (or Load Temporary Add-on and pick manifest.json).'
                ]
            };
        }
        const isEdge = ua.includes('edg/');
        const extUrl = isEdge ? 'edge://extensions' : 'chrome://extensions';
        return {
            browserLabel: isEdge ? 'Microsoft Edge' : 'Chrome / Brave',
            extUrl,
            steps: [
                'Click Open Download Page below and download the new .zip file.',
                'Extract the files directly into your existing AMAES folder (where manifest.json lives) and replace all files so your settings and Gemini keys stay saved.',
                `Open ${extUrl} and click the Reload button on AMAES Toolkit, then click Refresh This Page below.`
            ]
        };
    }

    function showExtensionUpdateModal(targetVersion, isReinstall = false) {
        if (!document.body) return;
        document.getElementById('amaes-update-guide-modal')?.remove();

        const ver = normalizeVersion(targetVersion) || SCRIPT_VERSION.replace(/^v/i, '');
        const guide = getExtensionUpdateGuide();

        const overlay = document.createElement('div');
        overlay.id = 'amaes-update-guide-modal';
        overlay.style.cssText = [
            'position: fixed',
            'inset: 0',
            'z-index: 9999999',
            'background: rgba(2, 6, 23, 0.72)',
            'backdrop-filter: blur(4px)',
            'display: flex',
            'align-items: center',
            'justify-content: center',
            'padding: 16px',
            'font-family: system-ui, -apple-system, sans-serif'
        ].join(';');

        const dialog = document.createElement('div');
        dialog.style.cssText = [
            'width: 100%',
            'max-width: 440px',
            'background: #0f172a',
            'color: #f8fafc',
            'border: 1px solid rgba(16, 185, 129, 0.45)',
            'border-radius: 12px',
            'box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5)',
            'padding: 18px 20px',
            'display: flex',
            'flex-direction: column',
            'gap: 12px'
        ].join(';');

        const header = document.createElement('div');
        header.style.cssText = 'display:flex;align-items:flex-start;justify-content:space-between;gap:12px;';

        const titleWrap = document.createElement('div');
        const kicker = document.createElement('div');
        kicker.textContent = isReinstall ? 'EXTENSION REINSTALL GUIDE' : 'TOOLKIT UPDATE AVAILABLE';
        kicker.style.cssText = 'font-size:10px;font-weight:700;letter-spacing:0.06em;color:#6ee7b7;margin-bottom:3px;';
        const heading = document.createElement('h3');
        heading.textContent = isReinstall
            ? `Reinstall AMAES Toolkit (${SCRIPT_VERSION})`
            : `Update to v${ver} (Installed: ${SCRIPT_VERSION})`;
        heading.style.cssText = 'margin:0;font-size:16px;font-weight:700;color:#ffffff;';
        titleWrap.appendChild(kicker);
        titleWrap.appendChild(heading);

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.textContent = 'Close';
        closeBtn.style.cssText = 'background:#1e293b;color:#cbd5e1;border:1px solid #334155;border-radius:6px;padding:4px 10px;font-size:12px;cursor:pointer;';

        header.appendChild(titleWrap);
        header.appendChild(closeBtn);

        const intro = document.createElement('p');
        intro.textContent = `${guide.browserLabel}: Follow these 3 quick steps to update without losing your settings:`;
        intro.style.cssText = 'margin:0;font-size:13px;color:#cbd5e1;line-height:1.45;';

        const list = document.createElement('ol');
        list.style.cssText = 'margin:0;padding-left:18px;display:flex;flex-direction:column;gap:8px;font-size:13px;line-height:1.45;color:#e2e8f0;';
        guide.steps.forEach((step) => {
            const li = document.createElement('li');
            li.textContent = step;
            list.appendChild(li);
        });

        const urlBar = document.createElement('div');
        urlBar.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;border-radius:8px;background:#1e293b;border:1px solid #334155;';
        const urlCode = document.createElement('code');
        urlCode.textContent = guide.extUrl;
        urlCode.style.cssText = 'font-size:12px;color:#93c5fd;word-break:break-all;';
        const copyUrlBtn = document.createElement('button');
        copyUrlBtn.type = 'button';
        copyUrlBtn.textContent = 'Copy URL';
        copyUrlBtn.style.cssText = 'background:#2563eb;color:#fff;border:none;border-radius:6px;padding:5px 10px;font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap;';
        copyUrlBtn.onclick = () => {
            try {
                if (typeof GM_setClipboard === 'function') {
                    GM_setClipboard(guide.extUrl);
                } else if (navigator.clipboard?.writeText) {
                    navigator.clipboard.writeText(guide.extUrl).catch(() => {});
                }
                copyUrlBtn.textContent = 'Copied!';
                setTimeout(() => { copyUrlBtn.textContent = 'Copy URL'; }, 2500);
            } catch (_) {}
        };
        urlBar.appendChild(urlCode);
        urlBar.appendChild(copyUrlBtn);

        const actions = document.createElement('div');
        actions.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin-top:2px;';

        const downloadBtn = document.createElement('a');
        downloadBtn.href = SCRIPT_RAW_URL;
        downloadBtn.target = '_blank';
        downloadBtn.rel = 'noopener noreferrer';
        downloadBtn.textContent = `Open Download Page (v${ver})`;
        downloadBtn.style.cssText = 'flex:1 1 180px;text-align:center;background:#059669;color:#ffffff;text-decoration:none;border-radius:7px;padding:9px 12px;font-size:13px;font-weight:700;';

        const refreshBtn = document.createElement('button');
        refreshBtn.type = 'button';
        refreshBtn.textContent = 'Refresh This Page';
        refreshBtn.style.cssText = 'flex:1 1 140px;background:#1e293b;color:#f8fafc;border:1px solid #475569;border-radius:7px;padding:9px 12px;font-size:13px;font-weight:600;cursor:pointer;';
        refreshBtn.onclick = () => window.location.reload();

        actions.appendChild(downloadBtn);
        actions.appendChild(refreshBtn);

        dialog.appendChild(header);
        dialog.appendChild(intro);
        dialog.appendChild(list);
        dialog.appendChild(urlBar);
        dialog.appendChild(actions);
        overlay.appendChild(dialog);

        const closeModal = () => {
            document.removeEventListener('keydown', onEscape);
            overlay.remove();
        };
        const onEscape = (e) => {
            if (e.key === 'Escape') closeModal();
        };
        closeBtn.onclick = closeModal;
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal();
        });
        document.addEventListener('keydown', onEscape);
        document.body.appendChild(overlay);
    }

    function triggerScriptUpdate(targetVersion) {
        const ver = normalizeVersion(targetVersion);
        if (!ver || !isNewerVersion(ver, SCRIPT_VERSION)) {
            showToast(`No valid newer toolkit version was found. Please run Check for Updates again.`, 5000);
            return;
        }
        try {
            localStorage.removeItem('amaes_pending_update_install');
            localStorage.removeItem('amaes_pending_update_time');
            localStorage.removeItem('amaes_update_in_progress');
        } catch (e) {}
        showExtensionUpdateModal(ver, false);
    }

    function triggerScriptReinstall() {
        showExtensionUpdateModal(SCRIPT_VERSION, true);
    }

    function injectTopNavUpdateNotification(latestVersion) {
        if (!latestVersion || !isNewerVersion(latestVersion, SCRIPT_VERSION)) return;

        const existing = document.getElementById('amaes-topnav-update-item');
        if (existing) {
            existing.remove();
        }

        const navContainer = document.querySelector('#usernavigation, .usermenu, .popover-region, nav.navbar .ml-auto, nav.navbar .ms-auto, nav.navbar ul.navbar-nav:last-child');
        if (!navContainer) {
            setTimeout(() => injectTopNavUpdateNotification(latestVersion), 600);
            return;
        }

        const wrap = document.createElement('div');
        wrap.id = 'amaes-topnav-update-item';
        wrap.className = 'nav-item d-flex align-items-center me-2';
        wrap.style.cssText = `
            display: inline-flex;
            align-items: center;
            margin-right: 8px;
            z-index: 1050;
            vertical-align: middle;
        `;

        wrap.innerHTML = `
            <button id="amaes-topnav-update-btn" type="button" class="btn btn-sm" style="
                background: linear-gradient(135deg, #10b981, #059669);
                color: #ffffff !important;
                font-weight: 700;
                font-size: 11px;
                padding: 3px 11px;
                border-radius: 20px;
                border: 1px solid rgba(255, 255, 255, 0.3);
                box-shadow: 0 1px 4px rgba(16, 185, 129, 0.3);
                display: inline-flex;
                align-items: center;
                gap: 5px;
                cursor: pointer;
                line-height: 1.3;
                white-space: nowrap;
            " title="New version v${latestVersion} available! Click to view update steps">
                ${ICONS.download} Update Toolkit (v${latestVersion})
            </button>
        `;

        const updateBtn = wrap.querySelector('#amaes-topnav-update-btn');
        if (updateBtn) {
            updateBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                triggerScriptUpdate(latestVersion);
            };
        }

        if (navContainer.firstChild) {
            navContainer.insertBefore(wrap, navContainer.firstChild);
        } else {
            navContainer.appendChild(wrap);
        }
    }

    function clearLegacyUpdateFlags() {
        localStorage.removeItem('amaes_pending_update_install');
        localStorage.removeItem('amaes_pending_update_time');
        localStorage.removeItem('amaes_pending_reinstall');
        localStorage.removeItem('amaes_update_in_progress');
        sessionStorage.removeItem('amaes_update_attempted_reload');
        sessionStorage.removeItem('amaes_reinstall_confirmed');
    }

    function checkPendingUpdateInstallation() {
        try {
            const lastSeen = localStorage.getItem('amaes_last_seen_version');
            clearLegacyUpdateFlags();

            const cachedLatest = localStorage.getItem('amaes_latest_version_seen');
            if (cachedLatest && !isNewerVersion(cachedLatest, SCRIPT_VERSION)) {
                localStorage.removeItem('amaes_latest_version_seen');
            }

            if (lastSeen && isNewerVersion(SCRIPT_VERSION, lastSeen)) {
                setTimeout(() => {
                    showToast(`Toolkit updated to ${SCRIPT_VERSION}!`, 4500);
                    setLog(`Toolkit updated to <b>${SCRIPT_VERSION}</b>.`, "var(--accent-green)");
                }, 600);
            }

            localStorage.setItem('amaes_last_seen_version', SCRIPT_VERSION);
        } catch (e) {
            logDebug(`Error checking update version state: ${e.message}`);
        }
    }

    function setupPendingUpdateFocusListener() {
        try {
            clearLegacyUpdateFlags();
        } catch (_) {}
    }

    function renderUpdateNotice(latestVersion) {
        // 1. Persistent Header "Update Now" Button
        const titleGroup = document.getElementById('amaes-title-group');
        if (titleGroup) {
            const headerUpdateBtn = document.getElementById('amaes-header-update-btn');
            if (headerUpdateBtn) {
                headerUpdateBtn.remove();
            }
        }

        // 2. Version Pill Update Indicator & Direct Link
        const versionPill = document.getElementById('amaes-version-pill');
        if (versionPill) {
            const targetVer = latestVersion.startsWith('v') ? latestVersion : `v${latestVersion}`;
            versionPill.innerHTML = `${SCRIPT_VERSION} <span style="display: inline-flex; align-items: center; background: #10b981; color: #fff; padding: 0 4px; border-radius: 3px; font-size: 8px; margin-left: 2px; font-weight: 800; letter-spacing: 0; white-space: nowrap;">-> ${targetVer}</span>`;
            versionPill.title = `Update available: ${targetVer}. Click for update steps`;
            versionPill.style.borderColor = '#10b981';
            versionPill.style.color = '#10b981';
            versionPill.onclick = () => triggerScriptUpdate(latestVersion);
        }

        // 3. Top-Right Persistent Notification Area Update Item
        injectTopNavUpdateNotification(latestVersion);

        // 5. Persistent Banner in Panel Body
        const container = document.getElementById('amaes-update-container');
        if (container) {
            container.innerHTML = `
                <div id="amaes-update-banner" style="
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 8px;
                    padding: 6px 10px;
                    background: linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(5, 150, 105, 0.2));
                    border: 1px solid rgba(16, 185, 129, 0.45);
                    border-radius: 6px;
                    margin-bottom: 8px;
                    font-size: 11px;
                    animation: amaesFadeIn 0.3s ease;
                ">
                    <div style="display: flex; align-items: center; gap: 6px; min-width: 0; color: #a7f3d0;">
                        ${ICONS.download}
                        <span style="font-weight: 700; white-space: nowrap; font-size: 11px;">
                            Update v${latestVersion} Available
                        </span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 4px; flex-shrink: 0;">
                        <button id="amaes-banner-update-btn" type="button" class="amaes-btn amaes-btn-primary" style="
                            padding: 3px 11px;
                            font-size: 11px;
                            font-weight: 800;
                            white-space: nowrap;
                            border-radius: 4px;
                            display: inline-flex;
                            align-items: center;
                            gap: 4px;
                            background: linear-gradient(135deg, #10b981, #059669);
                            color: #ffffff !important;
                            box-shadow: 0 1px 3px rgba(0,0,0,0.2);
                            border: none;
                            cursor: pointer;
                            flex-shrink: 0;
                        ">
                            Update Now
                        </button>
                    </div>
                </div>
            `;
            const bUpdate = document.getElementById('amaes-banner-update-btn');
            if (bUpdate) {
                bUpdate.onclick = () => {
                    triggerScriptUpdate(latestVersion);
                };
            }
        } else {
            setTimeout(() => renderUpdateNotice(latestVersion), 400);
        }

        // 6. Welcome Guide Modal Update Status
        const welcomeUpdateNow = document.getElementById('btn-welcome-update-now');
        if (welcomeUpdateNow) {
            welcomeUpdateNow.disabled = false;
            welcomeUpdateNow.innerHTML = `${ICONS.download} <span>Update Now (v${latestVersion})</span>`;
            welcomeUpdateNow.onclick = (e) => {
                e.preventDefault();
                triggerScriptUpdate(latestVersion);
            };
        }

        // 7. Quiz Floating HUD Update Button
        const hudUpdateIndicator = document.getElementById('hud-update-indicator');
        if (hudUpdateIndicator) {
            hudUpdateIndicator.style.display = 'inline-flex';
            hudUpdateIndicator.onclick = (e) => {
                e.preventDefault();
                triggerScriptUpdate(latestVersion);
            };
        }
    }

    function checkForScriptUpdates(manual = false, callback = null) {
        const cachedRaw = localStorage.getItem('amaes_latest_version_seen');
        const cachedLatest = normalizeVersion(cachedRaw);
        if (cachedRaw && !cachedLatest) {
            localStorage.removeItem('amaes_latest_version_seen');
        }
        const lastCheck = parseInt(localStorage.getItem('amaes_last_update_check') || '0', 10);
        const now = Date.now();

        const hasKnownUpdate = cachedLatest && isNewerVersion(cachedLatest, SCRIPT_VERSION);

        // 1. If an update is ALREADY known from cache:
        if (hasKnownUpdate && !manual) {
            renderUpdateNotice(cachedLatest);
        }

        // 2. Cache throttling: 5 minutes for background auto-check, 10 seconds for manual
        const throttleWindow = manual ? 10 * 1000 : 5 * 60 * 1000;
        if (!manual && (now - lastCheck < throttleWindow)) {
            if (callback) callback({ status: hasKnownUpdate ? 'update_available' : 'cached', version: cachedLatest || SCRIPT_VERSION });
            return;
        }

        if (manual) {
            setLog("Checking update server for toolkit updates...", "var(--accent-blue)", "Querying config...");
        }

        const req = (typeof GM_xmlhttpRequest !== 'undefined') ? GM_xmlhttpRequest :
                    (typeof GM !== 'undefined' && GM.xmlHttpRequest) ? GM.xmlHttpRequest : null;

        const processRemoteVersion = (remoteVer) => {
            localStorage.setItem('amaes_last_update_check', String(now));
            const validRemoteVersion = normalizeVersion(remoteVer);
            if (!validRemoteVersion) {
                if (manual) setLog("GitHub returned an invalid release version.", "var(--accent-amber)");
                if (callback) callback({ status: 'error', message: 'Invalid release version' });
                return;
            }
            remoteVer = validRemoteVersion;

            if (isNewerVersion(remoteVer, SCRIPT_VERSION)) {
                localStorage.setItem('amaes_latest_version_seen', remoteVer);
                renderUpdateNotice(remoteVer);
                setLog(`Update found: <b>v${remoteVer}</b> is available! Opening installer...`, 'var(--accent-green)');
                showToast(`Update found: v${remoteVer} is available!`, 4000);
                if (manual) {
                    triggerScriptUpdate(remoteVer);
                }
                if (callback) callback({ status: 'update_available', version: remoteVer });
            } else {
                localStorage.removeItem('amaes_latest_version_seen');
                localStorage.removeItem('amaes_pending_update_install');
                localStorage.removeItem('amaes_pending_update_time');
                localStorage.removeItem('amaes_update_in_progress');
                document.getElementById('amaes-topnav-update-item')?.remove();
                document.getElementById('amaes-update-banner')?.remove();
                if (manual) {
                    setLog(`Toolkit is up to date (<b>${SCRIPT_VERSION}</b>).`, 'var(--accent-green)');
                    showToast(`Toolkit is up to date (${SCRIPT_VERSION})`);
                }
                if (callback) callback({ status: 'up_to_date', version: SCRIPT_VERSION });
            }
        };

        const checkViaRawUrl = () => {
            if (manual) setLog("Unable to reach update server.", "var(--accent-amber)");
            if (callback) callback({ status: 'error', message: 'Update config unreachable' });
        };

        // Query Cloudflare Worker /v1/config for dynamic version and link metadata
        const apiUrl = `${COMMUNITY_RELAY_URL}/v1/config?_t=${now}`;
        const handleConfigPayload = (data) => {
            if (data && data.latestVersion) {
                const ver = normalizeVersion(data.latestVersion);
                if (ver) {
                    processRemoteVersion(ver);
                    return true;
                }
            }
            return false;
        };

        if (req) {
            try {
                req({
                    method: 'GET',
                    url: apiUrl,
                    headers: { 'Accept': 'application/json', 'Cache-Control': 'no-cache' },
                    onload: (res) => {
                        try {
                            const data = JSON.parse(res.responseText || '{}');
                            if (handleConfigPayload(data)) return;
                        } catch (e) {}
                        checkViaRawUrl();
                    },
                    onerror: () => checkViaRawUrl()
                });
            } catch (e) {
                checkViaRawUrl();
            }
        } else {
            fetch(apiUrl, { cache: 'no-store' })
                .then(r => r.json())
                .then(data => {
                    if (handleConfigPayload(data)) return;
                    checkViaRawUrl();
                })
                .catch(() => checkViaRawUrl());
        }
    }

