/**
 * Saveo Main Application Controller
 * Unified Downloader, Library & History, Settings, and Update System
 */

class SaveoApp {
  constructor() {
    this.currentTab = 'single';
    this.currentMedia = null;
    this.selectedMode = 'video'; // 'video' or 'audio'
    this.selectedFormat = null;
    this.selectedClip = null;
    this.activeSingleTaskId = null;
    this.tasks = [];
    this.settings = {};
    this.watchlistItems = [];

    this.init();
  }

  async init() {
    try { this.setupTabs(); } catch (e) { console.error("Setup tabs error:", e); }
    try { this.setupDownloader(); } catch (e) { console.error("Setup downloader error:", e); }
    try { this.setupWatchlist(); } catch (e) { console.error("Setup watchlist error:", e); }
    try { this.setupHistory(); } catch (e) { console.error("Setup history error:", e); }
    try { this.setupSettings(); } catch (e) { console.error("Setup settings error:", e); }
    try { this.setupUpdateSystem(); } catch (e) { console.error("Setup update system error:", e); }
    try { this.setupWebSocketListeners(); } catch (e) { console.error("Setup WebSocket listeners error:", e); }

    // Load initial data safely
    try { await this.loadSettings(); } catch (e) { console.error("Error loading settings:", e); }
    try { await this.setupCast(); } catch (e) { console.error("Error loading cast info:", e); }
    try { await this.loadBeamInfo(); } catch (e) { console.error("Error loading beam info:", e); }
    try { await this.loadSystemStatus(); } catch (e) { console.error("Error loading system status:", e); }
    try { await this.loadTasks(); } catch (e) { console.error("Error loading tasks:", e); }
    try { await this.loadHistory(); } catch (e) { console.error("Error loading history:", e); }

    // Start background polling fallback for resilient download tracking
    this.startTaskPolling();

    // Check for updates in the background on startup (spins circular arrow and shows breathing dot if available)
    this.checkUpdatesOnStartup();
  }

  dismissSplash() {
    // No-op compatibility stub (desktop uses native ~50ms boot splash)
    const splash = document.getElementById('app-splash');
    if (splash && splash.parentElement) {
      splash.parentElement.removeChild(splash);
    }
  }

  // ================= TABS NAVIGATION =================
  setupTabs() {
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.getAttribute('data-tab');
        this.switchTab(target);
      });
    });

    // Mobile bottom navigation tabs (Native Android & responsive view)
    const mobileTabs = document.querySelectorAll('.mobile-nav-btn');
    mobileTabs.forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-tab');
        if (target) {
          this.switchTab(target);
        }
      });
    });

    // Top-left brand logo/title returns to Downloader
    const brandBtn = document.getElementById('header-brand-btn');
    if (brandBtn) {
      brandBtn.addEventListener('click', () => {
        this.switchTab('single');
      });
    }

    // Top-right header action icons
    const navHistory = document.getElementById('header-nav-history');
    if (navHistory) {
      navHistory.addEventListener('click', () => {
        if (this.currentTab === 'history') {
          this.switchTab('single');
        } else {
          this.switchTab('history');
        }
      });
    }

    const navSettings = document.getElementById('header-nav-settings');
    if (navSettings) {
      navSettings.addEventListener('click', () => {
        if (this.currentTab === 'settings') {
          this.switchTab('single');
        } else {
          this.switchTab('settings');
        }
      });
    }
  }

  switchTab(tabName) {
    this.currentTab = tabName;
    document.querySelectorAll('.nav-tab').forEach(t => {
      t.classList.toggle('active', t.getAttribute('data-tab') === tabName);
    });
    document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
    });
    document.querySelectorAll('.tab-pane').forEach(p => {
      p.classList.toggle('active', p.id === `pane-${tabName}`);
    });

    // Update header icons active state
    const navHistory = document.getElementById('header-nav-history');
    if (navHistory) navHistory.classList.toggle('active', tabName === 'history');

    const navSettings = document.getElementById('header-nav-settings');
    if (navSettings) navSettings.classList.toggle('active', tabName === 'settings');

    if (tabName === 'history') {
      this.loadHistory();
    } else if (tabName === 'watchlist') {
      this.loadWatchlist();
    } else if (tabName === 'settings') {
      this.loadSettings();
    }
  }

  setAnalyzeLoading(isLoading) {
    const btn = document.getElementById('btn-analyze');
    if (!btn) return;
    if (isLoading) {
      btn.disabled = true;
      btn.classList.add('is-analyzing');
      btn.innerHTML = `
        <svg class="btn-spinner-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <circle cx="12" cy="12" r="9" stroke-opacity="0.25"></circle>
          <path d="M12 3a9 9 0 0 1 9 9" stroke-linecap="round"></path>
        </svg>
        <span class="btn-text">Analyzing...</span>
      `;
    } else {
      btn.disabled = false;
      btn.classList.remove('is-analyzing');
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" class="btn-icon">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <span class="btn-text">Analyze</span>
      `;
    }
  }

  // ================= SAVEO CAST =================
  async setupCast() {
    const card = document.getElementById('cast-card');
    if (!card) return;
    if (typeof window.SaveoAndroid !== 'undefined') {
      card.style.display = 'none';
      return;
    }
    try {
      const info = await api.getCastInfo();
      const feedInput = document.getElementById('cast-feed-url');
      const m3uInput = document.getElementById('cast-m3u-url');
      const origin = window.location.origin;
      const feedUrl = info && info.feed_path ? `${origin}${info.feed_path}` : '';
      const m3uUrl = info && info.m3u_path ? `${origin}${info.m3u_path}` : '';
      if (!feedUrl) {
        card.style.display = 'none';
        return;
      }
      if (feedInput) feedInput.value = feedUrl;
      if (m3uInput) m3uInput.value = m3uUrl;

      const copy = (value, label) => {
        if (!navigator.clipboard || !navigator.clipboard.writeText) {
          Components.showToast('Clipboard is unavailable.', 'error');
          return;
        }
        navigator.clipboard.writeText(value).then(
          () => Components.showToast(`${label} copied.`, 'success'),
          () => Components.showToast('Could not copy.', 'error')
        );
      };
      const btnFeed = document.getElementById('btn-copy-cast-feed');
      if (btnFeed) btnFeed.addEventListener('click', () => copy(feedUrl, 'Podcast feed URL'));
      const btnM3u = document.getElementById('btn-copy-cast-m3u');
      if (btnM3u) btnM3u.addEventListener('click', () => copy(m3uUrl, 'M3U URL'));
    } catch (e) {
      card.style.display = 'none';
    }
  }

  // ================= SAVEO BEAM =================
  async loadBeamInfo() {
    const card = document.getElementById('beam-card');
    const input = document.getElementById('beam-url');
    if (!card || !input) return;
    if (typeof window.SaveoAndroid !== 'undefined') {
      card.style.display = 'none';
      return;
    }
    try {
      const info = await api.getBeamInfo();
      const url = info && info.url ? info.url : '';
      input.value = url;
      const wanted = document.getElementById('setting-beam-enabled')
        ? document.getElementById('setting-beam-enabled').checked
        : Boolean(this.settings.beam_enabled);
      input.placeholder = url
        ? ''
        : (wanted ? 'Beam could not start (is port 8767 in use?)' : 'Enable Beam and save preferences to get a link');
      const btn = document.getElementById('btn-copy-beam');
      if (btn) {
        btn.onclick = () => {
          if (!url) {
            Components.showToast('Beam is not running.', 'info');
            return;
          }
          if (!navigator.clipboard || !navigator.clipboard.writeText) {
            Components.showToast('Clipboard is unavailable.', 'error');
            return;
          }
          navigator.clipboard.writeText(url).then(
            () => Components.showToast('Beam link copied.', 'success'),
            () => Components.showToast('Could not copy.', 'error')
          );
        };
      }
    } catch (e) {
      input.value = '';
    }
  }

  // ================= WATCHLIST =================
  setupWatchlist() {
    const urlInput = document.getElementById('watch-url-input');
    const btnAdd = document.getElementById('btn-watch-add');
    const btnCheckAll = document.getElementById('btn-watch-check-all');
    const list = document.getElementById('watchlist-items');

    const addWatch = async () => {
      const url = (urlInput ? urlInput.value : '').trim();
      if (!url) {
        Components.showToast('Paste a channel, playlist, or album URL first.', 'error');
        if (urlInput) urlInput.focus();
        return;
      }
      const payload = {
        url,
        quality: document.getElementById('watch-quality')?.value || 'best',
        folder: (document.getElementById('watch-folder')?.value || '').trim(),
        max_items: parseInt(document.getElementById('watch-max-items')?.value, 10) || 10,
        min_duration: parseInt(document.getElementById('watch-min-duration')?.value, 10) || 0,
        include: (document.getElementById('watch-include')?.value || '').trim(),
        exclude: (document.getElementById('watch-exclude')?.value || '').trim()
      };
      try {
        await api.addWatchlist(payload);
        if (urlInput) urlInput.value = '';
        await this.loadWatchlist();
        Components.showToast('Added to watchlist.', 'success');
      } catch (e) {
        Components.showToast(`Could not add watch: ${e.message}`, 'error');
      }
    };

    if (btnAdd) btnAdd.addEventListener('click', addWatch);
    if (urlInput) {
      urlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          addWatch();
        }
      });
    }

    if (btnCheckAll) {
      btnCheckAll.addEventListener('click', async () => {
        Components.showToast('Checking watchlist...', 'info');
        try {
          const res = await api.checkAllWatchlist();
          const results = (res && res.results) || [];
          const added = results.reduce((sum, item) => sum + (item.added || 0), 0);
          Components.showToast(`Watchlist checked: ${added} new download(s).`, 'success');
          await this.loadWatchlist();
          await this.loadTasks();
        } catch (e) {
          Components.showToast(`Watchlist check failed: ${e.message}`, 'error');
        }
      });
    }

    if (list) {
      list.addEventListener('click', async (e) => {
        const target = e.target.closest('[data-action]');
        if (!target) return;
        const id = target.getAttribute('data-id');
        const action = target.getAttribute('data-action');
        const item = (this.watchlistItems || []).find(entry => entry.id === id);
        if (!item) return;

        if (action === 'check') {
          try {
            const res = await api.checkWatchlistItem(id);
            Components.showToast(`Checked: +${res.added || 0} new, ${res.skipped || 0} skipped.`, 'success');
            await this.loadWatchlist();
            await this.loadTasks();
          } catch (err) {
            Components.showToast(`Check failed: ${err.message}`, 'error');
          }
        } else if (action === 'toggle') {
          try {
            await api.toggleWatchlistItem(id, !item.enabled);
            await this.loadWatchlist();
          } catch (err) {
            Components.showToast(`Could not update watch: ${err.message}`, 'error');
          }
        } else if (action === 'remove') {
          if (!confirm('Remove this watchlist item? Downloaded files are kept.')) return;
          try {
            await api.removeWatchlist(id);
            await this.loadWatchlist();
            Components.showToast('Removed from watchlist.', 'info');
          } catch (err) {
            Components.showToast(`Could not remove watch: ${err.message}`, 'error');
          }
        }
      });
    }
  }

  async loadWatchlist() {
    const container = document.getElementById('watchlist-items');
    if (!container) return;
    try {
      const res = await api.getWatchlist();
      this.watchlistItems = (res && res.items) || [];
      this.renderWatchlist();
    } catch (e) {
      container.innerHTML = `<div class="watchlist-empty">Could not load watchlist: ${Components.escapeHtml(e.message)}</div>`;
    }
  }

  renderWatchlist() {
    const container = document.getElementById('watchlist-items');
    if (!container) return;
    container.innerHTML = '';

    if (!this.watchlistItems.length) {
      container.innerHTML = `
        <div class="watchlist-empty">
          No watched sources yet. Add a channel or playlist URL above and Saveo will queue only new items.
        </div>
      `;
      return;
    }

    this.watchlistItems.forEach(item => {
      const card = document.createElement('div');
      card.className = `watchlist-card${item.enabled === false ? ' paused' : ''}`;
      const safeId = Components.escapeAttr(item.id || '');
      const title = item.title || item.url || 'Watchlist item';
      const safeTitle = Components.escapeHtml(title);
      const safeUrl = Components.escapeHtml(item.url || '');
      const safePlatform = Components.escapeHtml(item.platform || 'Media');
      const folder = item.folder ? ` • ${Components.escapeHtml(item.folder)}` : '';
      const lastChecked = item.last_checked
        ? new Date(item.last_checked * 1000).toLocaleString()
        : 'never';
      const stats = `Last check: +${item.last_added || 0} new, ${item.last_skipped || 0} skipped • ${lastChecked}`;
      const error = item.last_error
        ? `<div class="watchlist-error">${Components.escapeHtml(item.last_error)}</div>`
        : '';

      card.innerHTML = `
        <div class="watchlist-info">
          <div class="watchlist-title" title="${Components.escapeAttr(title)}">${safeTitle}</div>
          <div class="watchlist-meta">${safePlatform}${folder} • ${Components.escapeHtml(item.format_label || 'Best Quality')}</div>
          <div class="watchlist-meta">${safeUrl}</div>
          <div class="watchlist-stats">${stats}</div>
          ${error}
        </div>
        <div class="watchlist-actions">
          <button class="secondary-btn btn-sm" data-action="check" data-id="${safeId}">Check now</button>
          <button class="secondary-btn btn-sm" data-action="toggle" data-id="${safeId}">${item.enabled === false ? 'Resume' : 'Pause'}</button>
          <button class="icon-btn" data-action="remove" data-id="${safeId}" title="Remove from watchlist">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      `;
      container.appendChild(card);
    });
  }

  // ================= UNIFIED DOWNLOADER =================
  setupDownloader() {
    const urlInput = document.getElementById('single-url-input');
    const btnPaste = document.getElementById('btn-paste');
    const btnClear = document.getElementById('btn-clear');
    const btnAnalyze = document.getElementById('btn-analyze');
    const btnChangeDir = document.getElementById('btn-change-dir');
    const btnStartDownload = document.getElementById('btn-start-download');
    const btnCancelSingle = document.getElementById('btn-cancel-single');
    const btnSuccessOpenFolder = document.getElementById('btn-success-open-folder');
    const btnSuccessPlay = document.getElementById('btn-success-play');
    const btnCloseError = document.getElementById('btn-close-error');
    const btnCopyTitle = document.getElementById('btn-copy-title');

    // Live typing instant detection
    let detectTimer = null;
    urlInput.addEventListener('input', () => {
      const val = urlInput.value.trim();
      btnClear.style.display = val ? 'flex' : 'none';

      clearTimeout(detectTimer);
      if (val.length > 8) {
        detectTimer = setTimeout(() => this.instantDetectPlatform(val), 150);
      } else {
        this.hideDetectedBadge();
      }
    });

    urlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        btnAnalyze.click();
      }
    });

    // Batch Drawer Toggle button
    const btnBatchToggle = document.getElementById('btn-batch-toggle');
    const batchDrawer = document.getElementById('saveo-batch-drawer');
    const batchTextarea = document.getElementById('batch-urls-input');
    const btnClearBatch = document.getElementById('btn-clear-batch');

    if (batchTextarea && btnClearBatch) {
      batchTextarea.addEventListener('input', () => {
        const val = batchTextarea.value.trim();
        btnClearBatch.style.display = val ? 'flex' : 'none';
      });

      btnClearBatch.addEventListener('click', () => {
        batchTextarea.value = '';
        btnClearBatch.style.display = 'none';
        batchTextarea.focus();
      });
    }

    if (btnBatchToggle && batchDrawer) {
      btnBatchToggle.addEventListener('click', () => {
        const isShown = batchDrawer.style.display !== 'none';
        batchDrawer.style.display = isShown ? 'none' : 'block';
        btnBatchToggle.classList.toggle('active', !isShown);
        if (!isShown && batchTextarea) {
          batchTextarea.focus();
          if (btnClearBatch) {
            btnClearBatch.style.display = batchTextarea.value.trim() ? 'flex' : 'none';
          }
        }
      });
    }

    // Drag-and-drop links onto the input card (single or batch).
    const dropZone = document.querySelector('.input-saveo-card');
    const handleDroppedText = (text) => {
      const value = (text || '').trim();
      if (!value) return;
      const urls = value.match(/https?:\/\/[^\s,;"'<>]+/g) || [];
      const isBatch = urls.length > 1;
      if (isBatch && batchDrawer && batchTextarea) {
        batchDrawer.style.display = 'block';
        if (btnBatchToggle) btnBatchToggle.classList.add('active');
        batchTextarea.value = value;
        if (btnClearBatch) btnClearBatch.style.display = 'flex';
        batchTextarea.focus();
      } else {
        urlInput.value = value;
        btnClear.style.display = 'flex';
        this.instantDetectPlatform(value);
        urlInput.focus();
      }
      Components.showToast(isBatch ? `Dropped ${urls.length} links into the batch input.` : 'Link dropped into the input.', 'info');
    };
    const bindDrop = (el) => {
      if (!el) return;
      el.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (dropZone) dropZone.classList.add('drag-over');
      });
      el.addEventListener('dragleave', () => {
        if (dropZone) dropZone.classList.remove('drag-over');
      });
      el.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (dropZone) dropZone.classList.remove('drag-over');
        handleDroppedText(e.dataTransfer ? e.dataTransfer.getData('text') : '');
      });
    };
    bindDrop(dropZone);
    bindDrop(urlInput);
    bindDrop(batchTextarea);

    // Paste button (reads clipboard directly from native backend or web API)
    btnPaste.addEventListener('click', async () => {
      let text = '';

      // 1. First try native backend clipboard endpoint (instant, zero browser permission prompt)
      try {
        const res = await api.getClipboard();
        if (res && res.text) {
          text = res.text;
        }
      } catch (e) {}

      // 2. Android native interface
      if (!text && window.SaveoAndroid && window.SaveoAndroid.getClipboardText) {
        try {
          text = window.SaveoAndroid.getClipboardText();
        } catch (e) {}
      }

      // 3. Web clipboard API fallback (if supported and permitted)
      if (!text && navigator.clipboard && navigator.clipboard.readText) {
        try {
          text = await navigator.clipboard.readText();
        } catch (err) {}
      }

      if (text && text.trim()) {
        const trimmed = text.trim();
        if (batchDrawer && batchDrawer.style.display !== 'none' && batchTextarea) {
          batchTextarea.value = trimmed;
          if (btnClearBatch) btnClearBatch.style.display = 'flex';
        } else {
          urlInput.value = trimmed;
          btnClear.style.display = 'flex';
          this.instantDetectPlatform(trimmed);
        }
        Components.showToast('Pasted from clipboard', 'info');
      } else {
        Components.showToast('Clipboard is empty or contains no link.', 'info');
      }
    });

    // Clear button for single URL input
    btnClear.addEventListener('click', () => {
      urlInput.value = '';
      btnClear.style.display = 'none';
      this.hideDetectedBadge();
      this.resetSingleView();
      urlInput.focus();
    });

    // Fetch Details / Analyze button
    btnAnalyze.addEventListener('click', () => {
      let text = urlInput.value.trim();
      if (batchDrawer && batchDrawer.style.display !== 'none' && batchTextarea && batchTextarea.value.trim()) {
        text = batchTextarea.value.trim();
      }
      if (!text) {
        Components.showToast('Please paste a media URL or batch links to fetch.', 'error');
        if (batchDrawer && batchDrawer.style.display !== 'none' && batchTextarea) {
          batchTextarea.focus();
        } else {
          urlInput.focus();
        }
        return;
      }
      this.analyzeInput(text);
    });

    // Mode Toggle (Video vs Audio)
    const modeBtnVideo = document.getElementById('mode-btn-video');
    const modeBtnAudio = document.getElementById('mode-btn-audio');

    modeBtnVideo.addEventListener('click', () => {
      this.selectedMode = 'video';
      modeBtnVideo.classList.add('active');
      modeBtnAudio.classList.remove('active');
      document.querySelectorAll('#advanced-formats-list .advanced-format-row').forEach(r => r.classList.remove('selected'));
      document.getElementById('video-formats-section').style.display = 'block';
      document.getElementById('audio-formats-section').style.display = 'none';
      const btnText = document.getElementById('btn-start-download-text');
      if (btnText && (!window.SaveoAndroid || !window.SaveoAndroid.getClipboardText)) {
        btnText.textContent = 'Download';
      }
      if (this.currentMedia && this.currentMedia.formats && this.currentMedia.formats.length > 0) {
        const preferred = this.getPreferredVideoFormat(this.currentMedia.formats);
        this.selectedFormat = preferred;
        const grid = document.getElementById('video-formats-grid');
        if (grid && preferred) {
          grid.querySelectorAll('.saveo-quality-chip').forEach(c => {
            c.classList.toggle('selected', c.getAttribute('data-fid') === preferred.format_id);
          });
        }
        const sizeEl = document.getElementById('saveo-estimated-size');
        if (sizeEl) sizeEl.textContent = (preferred && preferred.filesize_str) ? preferred.filesize_str : 'Standard';
      }
    });

    modeBtnAudio.addEventListener('click', () => {
      this.selectedMode = 'audio';
      modeBtnAudio.classList.add('active');
      modeBtnVideo.classList.remove('active');
      document.querySelectorAll('#advanced-formats-list .advanced-format-row').forEach(r => r.classList.remove('selected'));
      document.getElementById('video-formats-section').style.display = 'none';
      document.getElementById('audio-formats-section').style.display = 'block';
      const btnText = document.getElementById('btn-start-download-text');
      if (btnText && (!window.SaveoAndroid || !window.SaveoAndroid.getClipboardText)) {
        btnText.textContent = 'Download';
      }
      if (this.currentMedia && this.currentMedia.audio_formats && this.currentMedia.audio_formats.length > 0) {
        const preferred = this.getPreferredAudioFormat(this.currentMedia.audio_formats);
        this.selectedFormat = preferred;
        const grid = document.getElementById('audio-formats-grid');
        if (grid && preferred) {
          grid.querySelectorAll('.saveo-quality-chip').forEach(c => {
            c.classList.toggle('selected', c.getAttribute('data-fid') === preferred.format_id);
          });
        }
        const sizeEl = document.getElementById('saveo-estimated-size');
        if (sizeEl) sizeEl.textContent = (preferred && preferred.filesize_str) ? preferred.filesize_str : '~3.5 MB';
      }
    });

    // Change Directory button
    btnChangeDir.addEventListener('click', async () => {
      try {
        const res = await api.browseFolder();
        if (res.updated && res.folder) {
          document.getElementById('selected-save-dir').textContent = res.folder;
          this.settings.download_dir = res.folder;
          Components.showToast(`Download folder updated: ${res.folder}`, 'success');
        }
      } catch (e) {
        console.error("Browse folder error:", e);
      }
    });

    // Start Download button
    btnStartDownload.addEventListener('click', () => {
      this.startSingleDownload();
    });

    // Cancel active single download
    btnCancelSingle.addEventListener('click', async () => {
      const activeId = this.activeSingleTaskId;
      if (activeId) {
        try {
          await api.cancelTask(activeId);
        } catch (e) {}
        const t = (this.tasks || []).find(x => x.id === activeId);
        if (t) {
          t.status = 'cancelled';
          Components.updateQueueItem(t);
        }
        this.activeSingleTaskId = null;
      }
      // Reset single download progress UI completely
      const fill = document.getElementById('single-progress-fill');
      if (fill) fill.style.width = '0%';
      document.getElementById('single-metric-percent').textContent = '0.0%';
      document.getElementById('single-metric-size').textContent = '0 MB / 0 MB';
      document.getElementById('single-metric-speed').textContent = '-- KB/s';
      document.getElementById('single-metric-eta').textContent = '--:--';
      document.getElementById('single-download-card').style.display = 'none';
      if (this.currentMedia) {
        document.getElementById('media-card').style.display = 'block';
      }
      this.setSinglePauseButtonState(false);
      Components.showToast('Download cancelled.', 'info');
    });

    // Pause / Resume active single download
    const btnPauseSingle = document.getElementById('btn-pause-single');
    if (btnPauseSingle) {
      btnPauseSingle.addEventListener('click', async () => {
        const activeId = this.activeSingleTaskId;
        if (!activeId) return;
        const task = (this.tasks || []).find(x => x.id === activeId);
        const isPaused = task && task.status === 'paused';
        if (isPaused) {
          try {
            await api.resumeTask(activeId);
            if (task) task.status = 'downloading';
            this.setSinglePauseButtonState(false);
            Components.showToast('Download resumed.', 'info');
          } catch (e) {
            Components.showToast('Failed to resume download.', 'error');
          }
        } else {
          try {
            await api.pauseTask(activeId);
            if (task) task.status = 'paused';
            this.setSinglePauseButtonState(true);
            Components.showToast('Download paused.', 'info');
          } catch (e) {
            Components.showToast('Failed to pause download.', 'error');
          }
        }
      });
    }

    // Success actions
    btnSuccessOpenFolder.addEventListener('click', async () => {
      const path = btnSuccessOpenFolder.getAttribute('data-path');
      const id = btnSuccessOpenFolder.getAttribute('data-id');
      await api.revealFile(path, id);
    });

    btnSuccessPlay.addEventListener('click', async () => {
      const path = btnSuccessPlay.getAttribute('data-path');
      const id = btnSuccessPlay.getAttribute('data-id');
      await api.openFile(path, id);
    });

    // Close error card
    btnCloseError.addEventListener('click', () => {
      document.getElementById('analyze-error').style.display = 'none';
    });

    // Copy title (button + clicking the title itself)
    const copyMediaTitle = () => {
      const title = document.getElementById('media-title').textContent;
      if (!navigator.clipboard || !navigator.clipboard.writeText) {
        Components.showToast('Clipboard is unavailable.', 'error');
        return;
      }
      navigator.clipboard.writeText(title).then(
        () => Components.showToast('Title copied to clipboard!', 'success'),
        () => Components.showToast('Could not copy title.', 'error')
      );
    };
    if (btnCopyTitle) btnCopyTitle.addEventListener('click', copyMediaTitle);
    const mediaTitleEl = document.getElementById('media-title');
    if (mediaTitleEl) mediaTitleEl.addEventListener('click', copyMediaTitle);

    // Header open folder button (guarded)
    const headerOpenFolder = document.getElementById('header-open-folder');
    if (headerOpenFolder) {
      headerOpenFolder.addEventListener('click', async () => {
        await api.openFolder(this.settings.download_dir);
      });
    }

    // Clear recent downloads button in downloader view
    const btnClearRecent = document.getElementById('btn-clear-recent-downloads');
    if (btnClearRecent) {
      btnClearRecent.addEventListener('click', async () => {
        await api.clearFinishedTasks();
        this.tasks = (this.tasks || []).filter(t => t.status === 'queued' || t.status === 'downloading' || t.status === 'processing' || t.status === 'pending');
        this.renderQueueList();
        Components.showToast('Cleared recent completed downloads.', 'info');
      });
    }

    // Bulk queue actions (desktop)
    const btnPauseAll = document.getElementById('btn-pause-all');
    if (btnPauseAll) {
      btnPauseAll.addEventListener('click', async () => {
        const ids = (this.tasks || [])
          .filter(t => ['downloading', 'processing', 'queued'].includes(t.status))
          .map(t => t.id);
        if (!ids.length) {
          Components.showToast('No active downloads to pause.', 'info');
          return;
        }
        await Promise.allSettled(ids.map(id => api.pauseTask(id)));
        await this.loadTasks();
        Components.showToast(`Paused ${ids.length} download(s).`, 'info');
      });
    }

    const btnResumeAll = document.getElementById('btn-resume-all');
    if (btnResumeAll) {
      btnResumeAll.addEventListener('click', async () => {
        const ids = (this.tasks || []).filter(t => t.status === 'paused').map(t => t.id);
        if (!ids.length) {
          Components.showToast('No paused downloads to resume.', 'info');
          return;
        }
        await Promise.allSettled(ids.map(id => api.resumeTask(id)));
        await this.loadTasks();
        Components.showToast(`Resumed ${ids.length} download(s).`, 'info');
      });
    }

    const btnRetryFailed = document.getElementById('btn-retry-failed');
    if (btnRetryFailed) {
      btnRetryFailed.addEventListener('click', async () => {
        const ids = (this.tasks || []).filter(t => t.status === 'failed' || t.status === 'cancelled').map(t => t.id);
        if (!ids.length) {
          Components.showToast('No failed downloads to retry.', 'info');
          return;
        }
        await Promise.allSettled(ids.map(id => api.retryTask(id)));
        await this.loadTasks();
        Components.showToast(`Retrying ${ids.length} download(s).`, 'info');
      });
    }

    // Downloader queue list action delegation
    const qList = document.getElementById('downloader-queue-list');
    qList.addEventListener('click', async (e) => {
      const target = e.target.closest('[data-action]');
      if (!target) return;

      const action = target.getAttribute('data-action');
      const id = target.getAttribute('data-id');
      const path = target.getAttribute('data-path');

      if (action === 'open-file') {
        let targetPath = path;
        if (!targetPath && id) {
          const t = (this.tasks || []).find(x => x.id === id);
          if (t && t.file_path) targetPath = t.file_path;
        }
        await api.openFile(targetPath, id);
      } else if (action === 'cancel') {
        try {
          await api.cancelTask(id);
        } catch (e) {}
        const t = (this.tasks || []).find(x => x.id === id);
        if (t) {
          t.status = 'cancelled';
          Components.updateQueueItem(t);
        }
        if (this.activeSingleTaskId === id) {
          document.getElementById('single-download-card').style.display = 'none';
          if (this.currentMedia) document.getElementById('media-card').style.display = 'block';
          this.activeSingleTaskId = null;
        }
        Components.showToast('Download cancelled.', 'info');
      } else if (action === 'pause') {
        try {
          await api.pauseTask(id);
          const t = (this.tasks || []).find(x => x.id === id);
          if (t) {
            t.status = 'paused';
            Components.updateQueueItem(t);
          }
          if (this.activeSingleTaskId === id) {
            this.setSinglePauseButtonState(true);
          }
          Components.showToast('Download paused.', 'info');
        } catch (e) {
          Components.showToast('Failed to pause download.', 'error');
        }
      } else if (action === 'resume') {
        try {
          await api.resumeTask(id);
          const t = (this.tasks || []).find(x => x.id === id);
          if (t) {
            t.status = 'downloading';
            Components.updateQueueItem(t);
          }
          if (this.activeSingleTaskId === id) {
            this.setSinglePauseButtonState(false);
          }
          Components.showToast('Download resumed.', 'info');
        } catch (e) {
          Components.showToast('Failed to resume download.', 'error');
        }
      } else if (action === 'retry') {
        const errCard = document.getElementById('analyze-error');
        if (errCard) errCard.style.display = 'none';
        await api.retryTask(id);
      } else if (action === 'remove') {
        try {
          await api.removeTask(id);
        } catch (e) {}
        const card = document.getElementById(`q-task-${id}`);
        if (card) card.remove();
        this.tasks = (this.tasks || []).filter(t => t.id !== id);
        if (this.activeSingleTaskId === id) {
          document.getElementById('single-download-card').style.display = 'none';
          if (this.currentMedia) document.getElementById('media-card').style.display = 'block';
          this.activeSingleTaskId = null;
        }
        this.updateRecentDownloadsHeader();
        if (this.tasks.length === 0) {
          this.renderQueueList();
        }
      }
    });
  }

  // Instant platform detection
  async instantDetectPlatform(text) {
    try {
      const urls = text.match(/https?:\/\/[^\s,;"'<>]+/g) || [];
      if (urls.length > 1) {
        const badge = document.getElementById('detected-badge');
        const nameEl = document.getElementById('detect-name');
        const iconEl = document.getElementById('detect-icon');
        if (nameEl) nameEl.textContent = `Batch (${urls.length} URLs)`;
        if (iconEl) iconEl.textContent = '';
        if (badge) badge.style.opacity = '1';
        return;
      }
      if (urls.length === 1) {
        const u = urls[0];
        const res = await api.detectPlatform(u);
        if (res.valid && res.platform !== 'Unknown') {
          const badge = document.getElementById('detected-badge');
          const nameEl = document.getElementById('detect-name');
          const iconEl = document.getElementById('detect-icon');
          if (nameEl) nameEl.textContent = res.platform;
          if (iconEl) iconEl.textContent = '';
          if (badge) badge.style.opacity = '1';
        } else {
          this.hideDetectedBadge();
        }
      } else {
        this.hideDetectedBadge();
      }
    } catch (e) {
      this.hideDetectedBadge();
    }
  }

  hideDetectedBadge() {
    const badge = document.getElementById('detected-badge');
    if (badge) badge.style.opacity = '0';
  }

  resetSingleView() {
    const pContainer = document.getElementById('playlist-container');
    if (pContainer) pContainer.innerHTML = '';

    const bContainer = document.getElementById('batch-container');
    if (bContainer) bContainer.innerHTML = '';

    document.getElementById('media-card').style.display = 'none';
    document.getElementById('single-download-card').style.display = 'none';
    document.getElementById('single-success-card').style.display = 'none';
    document.getElementById('analyze-skeleton').style.display = 'none';
    document.getElementById('analyze-error').style.display = 'none';
    this.currentMedia = null;
    this.selectedFormat = null;
    this.selectedClip = null;
    this.activeSingleTaskId = null;
  }

  getPreferredVideoFormat(formats) {
    if (!formats || formats.length === 0) return null;
    const pref = (this.settings.default_video_quality || 'best').toLowerCase();
    if (pref === 'best') {
      return formats[0];
    }
    const targetH = parseInt(pref.replace('p', ''), 10);
    if (!isNaN(targetH)) {
      const exactMatch = formats.find(f => {
        if (f.raw_info && f.raw_info.height === targetH) return true;
        if (f.label && f.label.toLowerCase().includes(`${targetH}p`)) return true;
        if (f.resolution && f.resolution.includes(`x${targetH}`)) return true;
        return false;
      });
      if (exactMatch) return exactMatch;

      // Closest available quality <= target
      const closest = formats.find(f => {
        const h = f.raw_info ? f.raw_info.height : parseInt((f.resolution || '').split('x')[1], 10);
        return h && h <= targetH;
      });
      if (closest) return closest;
    }
    return formats[0];
  }

  getPreferredAudioFormat(audioFormats) {
    if (!audioFormats || audioFormats.length === 0) return null;
    const pref = (this.settings.default_audio_format || 'mp3').toLowerCase();
    const matched = audioFormats.find(f => 
      (f.ext && f.ext.toLowerCase() === pref) || 
      (f.format_id && f.format_id.toLowerCase().includes(pref))
    );
    return matched || audioFormats[0];
  }

  // Unified Analyze Input (handles single URL, multiple URLs, and playlists)
  async analyzeInput(rawText) {
    this.resetSingleView();

    // Check for multiple URLs separated by commas, newlines, or spaces
    const urls = rawText.match(/https?:\/\/[^\s,;"'<>]+/g) || [];
    if (urls.length === 0) {
      Components.showToast('Please enter a valid media link starting with http:// or https://', 'error');
      return;
    }

    document.getElementById('analyze-skeleton').style.display = 'grid';
    this.setAnalyzeLoading(true);

    // Case 1: Multiple URLs pasted
    if (urls.length > 1) {
      try {
        const parsed = await api.batchParse(rawText);
        document.getElementById('analyze-skeleton').style.display = 'none';

        const bContainer = document.getElementById('batch-container');
        bContainer.innerHTML = '';

        const batchCard = Components.renderBatchCard(parsed, (selectedItems, options) => {
          this.startBatchDownload(selectedItems, options);
        });
        bContainer.appendChild(batchCard);

        Components.showToast(`Identified ${parsed.items.length} media links!`, 'success');
      } catch (err) {
        this.showAnalyzeError(err);
      } finally {
        this.setAnalyzeLoading(false);
      }
      return;
    }

    // Case 2: Single URL (Video, Audio, or Playlist)
    const singleUrl = urls[0];
    try {
      const data = await api.analyzeUrl(singleUrl);
      this.currentMedia = data;
      document.getElementById('analyze-skeleton').style.display = 'none';

      // Check if resource is a Playlist
      if (data.is_playlist) {
        const pContainer = document.getElementById('playlist-container');
        pContainer.innerHTML = '';

        const playlistCard = Components.renderPlaylistCard(data, (pData, selectedEntries, options) => {
          this.startPlaylistDownload(pData, selectedEntries, options);
        });
        pContainer.appendChild(playlistCard);

        Components.showToast(`Playlist detected: ${data.title} (${data.playlist_count || (data.playlist_entries && data.playlist_entries.length) || 0} videos)`, 'success');
        return;
      }

      // Single Media Preview Card
      document.getElementById('media-title').textContent = data.title;
      document.getElementById('media-uploader').textContent = data.uploader;
      document.getElementById('media-duration').textContent = data.duration_str || '--:--';
      document.getElementById('media-duration-text').textContent = `Duration: ${data.duration_str || 'Unknown'}`;
      document.getElementById('media-platform-tag').textContent = data.platform;
      document.getElementById('media-desc').textContent = data.description || 'No description available for this resource.';

      const thumbImg = document.getElementById('media-thumb-img');
      if (data.thumbnail) {
        let thumbUrl = data.thumbnail;
        if (thumbUrl.startsWith('//')) thumbUrl = 'https:' + thumbUrl;

        // Bilibili / hdslb images strictly require Referer: https://www.bilibili.com/
        const isBilibili = thumbUrl.includes('hdslb.com') || thumbUrl.includes('bilibili.com');
        if (isBilibili) {
          thumbImg.src = `/api/proxy/thumbnail?url=${encodeURIComponent(thumbUrl)}`;
        } else {
          thumbImg.src = thumbUrl;
        }

        thumbImg.onerror = () => {
          if (!thumbImg.src.includes('/api/proxy/thumbnail') && thumbUrl) {
            thumbImg.src = `/api/proxy/thumbnail?url=${encodeURIComponent(thumbUrl)}`;
          } else {
            thumbImg.style.display = 'none';
          }
        };
        thumbImg.style.display = 'block';
      } else {
        thumbImg.style.display = 'none';
      }

      // Populate Download Directory
      const saveDir = this.settings.download_dir || data.default_download_dir;
      document.getElementById('selected-save-dir').textContent = saveDir;

      // Render Video Formats with preferred quality pre-selection
      const preferredVideo = this.getPreferredVideoFormat(data.formats);
      this.selectedFormat = preferredVideo || data.formats[0] || null;
      Components.renderVideoFormats(data.formats, preferredVideo ? preferredVideo.format_id : null, (fmt) => {
        this.selectedFormat = fmt;
      });

      // Render Audio Formats with preferred codec pre-selection
      const preferredAudio = this.getPreferredAudioFormat(data.audio_formats);
      Components.renderAudioFormats(data.audio_formats, preferredAudio ? preferredAudio.format_id : null, (fmt) => {
        this.selectedFormat = fmt;
      });

      // Exact source streams (codec/fps/HDR/bitrate), desktop and web only.
      Components.renderAdvancedFormats(data.advanced_formats || [], (fmt) => {
        this.selectedFormat = fmt;
      });

      // Chapter clips (desktop/web sources that expose chapters).
      this.selectedClip = null;
      Components.renderChapters(data.chapters || [], (chapter) => {
        this.selectedClip = chapter;
      });

      // Show preview card
      document.getElementById('media-card').style.display = 'block';

      if (this.selectedMode === 'audio') {
        this.selectedFormat = preferredAudio;
        document.getElementById('mode-btn-audio').click();
      } else {
        this.selectedFormat = preferredVideo;
        document.getElementById('mode-btn-video').click();
      }

      Components.showToast(`Ready: ${data.title.substring(0, 45)}...`, 'success');

    } catch (err) {
      this.showAnalyzeError(err);
    } finally {
      this.setAnalyzeLoading(false);
    }
  }

  showAnalyzeError(err) {
    document.getElementById('analyze-skeleton').style.display = 'none';
    const errCard = document.getElementById('analyze-error');
    const friendlyEl = document.getElementById('error-friendly-text');
    const suggestionEl = document.getElementById('error-suggestion');
    const techEl = document.getElementById('error-tech-log');
    const actionRow = document.getElementById('error-action-row');

    let friendly = (err.data && err.data.error_friendly) ? err.data.error_friendly : (err.message || 'Unable to extract media.');
    let suggestion = (err.data && err.data.error_suggestion) 
      ? err.data.error_suggestion 
      : 'Make sure the URL is accessible and the media is public.';
    let technical = (err.data && err.data.error_technical) ? err.data.error_technical : (err.stack || err.message);

    // If friendly is raw JSON string (e.g. from native bridge), parse it cleanly
    if (typeof friendly === 'string' && friendly.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(friendly);
        if (parsed.error_friendly) friendly = parsed.error_friendly;
        else if (parsed.error) friendly = parsed.error;
        else if (parsed.message) friendly = parsed.message;
        if (parsed.error_suggestion) suggestion = parsed.error_suggestion;
        if (parsed.error_technical) technical = parsed.error_technical;
      } catch (e) {}
    }

    // Strip raw CLI/module prefixes if present
    if (typeof friendly === 'string') {
      friendly = friendly.replace(/^ERROR:\s*(\[[^\]]+\]\s*[^:]+:\s*)?/i, '').trim();
    }

    friendlyEl.textContent = friendly;
    if (suggestionEl) suggestionEl.textContent = suggestion;
    techEl.textContent = technical;

    if (actionRow) {
      const combined = (friendly + ' ' + suggestion + ' ' + technical).toLowerCase();
      if (combined.includes('bot') || combined.includes('cookie') || combined.includes('sign in')) {
        actionRow.style.display = 'block';
      } else {
        actionRow.style.display = 'none';
      }
    }

    errCard.style.display = 'flex';
    Components.showToast('Unable to extract media from this URL.', 'error');
  }

  // Start single download
  async startSingleDownload() {
    if (!this.currentMedia) return;

    const isAudio = this.selectedMode === 'audio';
    const advanced = Boolean(this.selectedFormat && this.selectedFormat.advanced);
    let formatId = this.selectedFormat ? this.selectedFormat.format_id : 'best';
    if (advanced && !this.selectedFormat.has_audio) {
      formatId = `${this.selectedFormat.format_id}+bestaudio`;
    }
    const formatLabel = (this.selectedFormat ? this.selectedFormat.label : 'Best Quality')
      + (advanced && !this.selectedFormat.has_audio ? ' + audio' : '');
    const audioCodec = isAudio && this.selectedFormat ? this.selectedFormat.ext : 'mp3';
    const outDir = document.getElementById('selected-save-dir').textContent.trim() || this.settings.download_dir;
    const clip = this.selectedClip;
    const clipSuffix = clip
      ? ` • Clip ${Components.formatSeconds(clip.start_time)}-${clip.end_time != null ? Components.formatSeconds(clip.end_time) : 'end'}`
      : '';
    const downloadTitle = clip ? `${this.currentMedia.title} - ${clip.title}` : this.currentMedia.title;

    const payload = {
      url: this.currentMedia.url,
      format_id: formatId,
      format_label: `${formatLabel}${clipSuffix}`,
      is_audio: isAudio,
      audio_format: audioCodec,
      output_dir: outDir,
      title: downloadTitle,
      thumbnail: this.currentMedia.thumbnail,
      expected_size_str: this.selectedFormat ? (this.selectedFormat.filesize_str || '') : '',
      expected_bytes: this.selectedFormat ? (this.selectedFormat.filesize_approx || 0) : 0,
      start_time: clip ? clip.start_time : null,
      end_time: clip && clip.end_time != null ? clip.end_time : null
    };

    try {
      let task = await api.startDownload(payload);

      if (task && task.duplicate) {
        const existing = task.existing || {};
        if (existing.duplicate_source === 'queue') {
          Components.showToast('Already in the download queue.', 'info');
          return;
        }
        const label = existing.filename || existing.title || 'this media';
        if (!confirm(`Already downloaded: ${label}\n\nDownload another copy anyway?`)) {
          Components.showToast('Skipped: this file is already in your library.', 'info');
          return;
        }
        task = await api.startDownload({ ...payload, force: true });
      }

      this.activeSingleTaskId = task.id;

      // Show progress card
      document.getElementById('media-card').style.display = 'none';
      const pCard = document.getElementById('single-download-card');
      pCard.style.display = 'block';
      document.getElementById('single-progress-title').textContent = this.currentMedia.title;
      document.getElementById('single-status-badge').textContent = 'Starting...';

      Components.showToast('Download started.', 'success');
      await this.loadTasks();

    } catch (e) {
      Components.showToast(`Failed to initiate download: ${e.message}`, 'error');
    }
  }

  // Start playlist download (handles quality selection & selected videos)
  async startPlaylistDownload(playlistData, selectedEntries, options) {
    try {
      const urls = selectedEntries.map(e => e.url);
      const res = await api.batchEnqueue({
        urls,
        items: selectedEntries,
        playlist_folder: playlistData.title,
        is_audio: options.is_audio,
        format_id: options.format_id,
        format_label: options.format_label,
        audio_format: options.audio_format,
        output_dir: this.settings.download_dir
      });

      document.getElementById('playlist-container').innerHTML = '';
      const started = res && typeof res.count === 'number' ? res.count : selectedEntries.length;
      const skipped = (res && res.skipped) ? res.skipped.length : 0;
      if (started === 0 && skipped > 0) {
        Components.showToast(`All ${skipped} selected videos are already downloaded.`, 'info');
      } else {
        Components.showToast(`Downloading ${started} videos from "${playlistData.title}"${skipped ? ` (${skipped} already downloaded)` : ''}.`, 'success');
      }
      await this.loadTasks();

    } catch (e) {
      Components.showToast(`Error starting playlist download: ${e.message}`, 'error');
    }
  }

  // Start batch download (handles multiple individual URLs)
  async startBatchDownload(selectedItems, options) {
    try {
      const urls = selectedItems.map(it => it.url);
      const res = await api.batchEnqueue({
        urls,
        items: selectedItems,
        is_audio: options.is_audio,
        format_id: options.format_id,
        format_label: options.format_label,
        audio_format: options.audio_format,
        output_dir: this.settings.download_dir
      });

      document.getElementById('batch-container').innerHTML = '';
      const started = res && typeof res.count === 'number' ? res.count : selectedItems.length;
      const skipped = (res && res.skipped) ? res.skipped.length : 0;
      if (started === 0 && skipped > 0) {
        Components.showToast(`All ${skipped} selected items are already downloaded.`, 'info');
      } else {
        Components.showToast(`Downloading ${started} items${skipped ? ` (${skipped} already downloaded)` : ''}.`, 'success');
      }
      await this.loadTasks();

    } catch (e) {
      Components.showToast(`Error starting batch download: ${e.message}`, 'error');
    }
  }

  // ================= TASK QUEUE & RECENT DOWNLOADS =================
  async loadTasks() {
    try {
      this.tasks = await api.getTasks();
      this.renderQueueList();
    } catch (e) {
      console.error("Load tasks error:", e);
    }
  }

  renderQueueList() {
    const container = document.getElementById('downloader-queue-list');
    if (!container) return;

    container.innerHTML = '';
    if (!this.tasks || this.tasks.length === 0) {
      this.updateRecentDownloadsHeader();
      container.innerHTML = `
        <div class="downloader-cat-idle">
          <div class="cat-idle-text">Nothing in the queue. Paste a link above to start a download.</div>
        </div>
      `;
      return;
    }

    this.tasks.forEach(t => {
      try {
        const card = Components.renderQueueItem(t);
        if (card) container.appendChild(card);
      } catch (err) {
        console.error("Error rendering task card:", err);
      }
    });

    this.updateRecentDownloadsHeader();
  }

  updateRecentDownloadsHeader() {
    const header = document.getElementById('recent-downloads-header');
    const countEl = document.getElementById('recent-downloads-count');
    if (!header || !countEl) return;

    const visibleCount = this.tasks.length;
    countEl.textContent = visibleCount;
    header.style.display = visibleCount > 0 ? 'flex' : 'none';
  }

  startTaskPolling() {
    if (this._taskPollTimer) return;
    this._taskPollTimer = setInterval(async () => {
      const hasActive = (this.tasks || []).some(t =>
        t.status === 'downloading' || t.status === 'processing' || t.status === 'queued'
      );
      if (hasActive || this.activeSingleTaskId) {
        try {
          const freshTasks = await api.getTasks();
          if (Array.isArray(freshTasks)) {
            // Check if queue list structure changed to avoid wiping DOM and causing flickering
            const currentSig = (this.tasks || []).map(t => `${t.id}:${t.status}`).join('|');
            const freshSig = freshTasks.map(t => `${t.id}:${t.status}`).join('|');
            this.tasks = freshTasks;

            if (currentSig !== freshSig) {
              this.renderQueueList();
            } else {
              // Update existing cards in-place smoothly without blinking
              freshTasks.forEach(t => Components.updateQueueItem(t));
            }

            if (this.activeSingleTaskId) {
              const single = freshTasks.find(t => t.id === this.activeSingleTaskId);
              if (single) {
                if (single.status === 'completed') {
                  this.activeSingleTaskId = null; // Clear immediately to prevent repeat triggers
                  this.handleSingleSuccess(single);
                } else if (single.status === 'failed') {
                  this.activeSingleTaskId = null;
                  document.getElementById('single-download-card').style.display = 'none';
                  const errCard = document.getElementById('analyze-error');
                  if (errCard) {
                    document.getElementById('error-friendly-text').textContent = single.error_friendly || 'Download failed.';
                    document.getElementById('error-tech-log').textContent = single.error_technical || 'No additional logs.';
                    errCard.style.display = 'flex';
                  }
                } else if (single.status === 'cancelled') {
                  this.activeSingleTaskId = null;
                  document.getElementById('single-download-card').style.display = 'none';
                  if (this.currentMedia) document.getElementById('media-card').style.display = 'block';
                } else {
                  this.updateSingleProgress(single);
                }
              }
            }
          }
        } catch (e) {
          // Ignore transient polling errors
        }
      }
    }, 1500);
  }

  // ================= HISTORY =================
  setupHistory() {
    const searchInput = document.getElementById('hist-search-input');
    const btnOpenFolder = document.getElementById('btn-hist-open-folder');
    const btnClearHist = document.getElementById('btn-hist-clear');
    const histStatFolder = document.getElementById('hist-stat-folder');
    const container = document.getElementById('history-items-container');

    if (histStatFolder) {
      histStatFolder.addEventListener('click', async () => {
        await api.openFolder(this.settings.download_dir);
      });
    }

    if (searchInput && container) {
      searchInput.addEventListener('input', () => {
        const query = searchInput.value.toLowerCase().trim();
        const cards = container.querySelectorAll('.history-card');
        cards.forEach(card => {
          const titleEl = card.querySelector('.history-filename');
          const title = titleEl ? titleEl.textContent.toLowerCase() : '';
          card.style.display = (!query || title.includes(query)) ? 'grid' : 'none';
        });
      });
    }

    const transcriptInput = document.getElementById('transcript-search-input');
    const transcriptResults = document.getElementById('transcript-results');
    let transcriptTimer = null;
    if (transcriptInput && transcriptResults) {
      if (typeof window.SaveoAndroid !== 'undefined') {
        const block = transcriptInput.closest('.transcript-search-block');
        if (block) block.style.display = 'none';
      }
      transcriptInput.addEventListener('input', () => {
        clearTimeout(transcriptTimer);
        const query = transcriptInput.value.trim();
        if (query.length < 2) {
          transcriptResults.innerHTML = '';
          return;
        }
        transcriptTimer = setTimeout(async () => {
          try {
            const results = await api.searchTranscripts(query);
            Components.renderTranscriptResults(results, (result) => this.downloadTranscriptClip(result));
          } catch (e) {
            transcriptResults.innerHTML = '';
            Components.showToast(`Subtitle search failed: ${e.message}`, 'error');
          }
        }, 300);
      });
    }

    if (btnOpenFolder) {
      btnOpenFolder.addEventListener('click', async () => {
        await api.openFolder(this.settings.download_dir);
      });
    }

    if (btnClearHist) {
      btnClearHist.addEventListener('click', async () => {
        if (confirm('Are you sure you want to clear your download history? (Files will remain in your folder)')) {
          await api.clearHistory();
          await this.loadHistory();
          Components.showToast('Download history cleared.', 'info');
        }
      });
    }

    const btnExportManifest = document.getElementById('btn-export-manifest');
    if (btnExportManifest) {
      btnExportManifest.addEventListener('click', async () => {
        try {
          const items = await api.getHistory();
          const manifest = {
            generated_at: new Date().toISOString(),
            app: 'Saveo',
            items: (items || []).map(item => ({
              id: item.id,
              title: item.title,
              url: item.url,
              filename: item.filename,
              file_size: item.file_size,
              format_label: item.format_label,
              sha256: item.sha256 || '',
              created_at_str: item.created_at_str || '',
              provenance_path: item.provenance_path || ''
            }))
          };
          const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = 'saveo-library-manifest.json';
          document.body.appendChild(link);
          link.click();
          link.remove();
          URL.revokeObjectURL(url);
          Components.showToast('Library manifest exported.', 'success');
        } catch (e) {
          Components.showToast(`Manifest export failed: ${e.message}`, 'error');
        }
      });
    }

    // History item card click delegation
    if (container) {
      container.addEventListener('click', async (e) => {
        const target = e.target.closest('[data-action]');
        if (!target) return;

        const action = target.getAttribute('data-action');
        const id = target.getAttribute('data-id');
        const path = target.getAttribute('data-path');

        if (action === 'open-file' || action === 'play') {
          await api.openFile(path, id);
        } else if (action === 'reveal') {
          await api.revealFile(path, id);
        } else if (action === 'delete-file') {
          if (!confirm('Delete the actual file from disk? This cannot be undone.')) return;
          await api.deleteHistoryItem(id, true);
          const card = document.getElementById(`hist-item-${id}`);
          if (card) card.remove();
          await this.loadHistory();
          Components.showToast('File deleted from disk.', 'info');
        } else if (action === 'verify') {
          try {
            const result = await api.verifyHistoryItem(id);
            if (result.status === 'verified') {
              Components.showToast('Verified: the file hash matches the receipt.', 'success');
            } else if (result.status === 'changed') {
              Components.showToast('Warning: the file has changed since it was downloaded.', 'error');
            } else if (result.status === 'missing') {
              Components.showToast('File is missing from disk.', 'error');
            } else {
              Components.showToast('This file cannot be verified on this platform.', 'info');
            }
          } catch (e) {
            Components.showToast(`Verification failed: ${e.message}`, 'error');
          }
        } else if (action === 'redownload') {
          const url = target.getAttribute('data-url');
          if (!url) return;
          await api.startDownload({
            url,
            format_id: target.getAttribute('data-format') || 'best',
            format_label: target.getAttribute('data-format-label') || 'Best Quality',
            is_audio: target.getAttribute('data-audio') === '1',
            audio_format: target.getAttribute('data-audio-format') || 'mp3',
            output_dir: this.settings.download_dir,
            title: target.getAttribute('data-title') || '',
            thumbnail: target.getAttribute('data-thumb') || '',
            start_time: target.getAttribute('data-start') !== '' ? parseFloat(target.getAttribute('data-start')) : null,
            end_time: target.getAttribute('data-end') !== '' ? parseFloat(target.getAttribute('data-end')) : null,
            force: true
          });
          await this.loadTasks();
          Components.showToast('Re-download queued.', 'success');
        } else if (action === 'delete-hist') {
          await api.deleteHistoryItem(id);
          const card = document.getElementById(`hist-item-${id}`);
          if (card) card.remove();
          await this.loadHistory();
          Components.showToast('Removed record from history.', 'info');
        }
      });
    }
  }

  async downloadTranscriptClip(result) {
    if (!result || !result.url) {
      Components.showToast('This library item has no source URL for clipping.', 'error');
      return;
    }
    try {
      await api.startDownload({
        url: result.url,
        format_id: result.format_id || 'best',
        format_label: `${result.format_label || 'Best Quality'} • Clip`,
        is_audio: Boolean(result.is_audio),
        audio_format: result.audio_format || 'mp3',
        output_dir: this.settings.download_dir,
        title: `${result.title} - clip ${Components.formatSeconds(result.start_time)}`,
        thumbnail: result.thumbnail || '',
        start_time: result.start_time,
        end_time: result.end_time,
        force: true
      });
      await this.loadTasks();
      Components.showToast('Transcript clip queued.', 'success');
    } catch (e) {
      Components.showToast(`Could not queue clip: ${e.message}`, 'error');
    }
  }

  async loadHistory() {
    try {
      const items = await api.getHistory();
      const container = document.getElementById('history-items-container');
      const emptyState = document.getElementById('history-empty-state');

      // Filter out any 0-byte ghost entries or entries without a file path
      const validItems = (items || []).filter(it => it.file_path && (it.file_size > 0 || it.status === 'completed'));

      // Update statistics
      let totalBytes = 0;
      let completedCount = 0;
      validItems.forEach(it => {
        completedCount++;
        const sz = it.file_size || it.filesize || it.downloaded_bytes || it.total_bytes || 0;
        totalBytes += Number(sz) || 0;
      });

      const statTotal = document.getElementById('hist-stat-total');
      const statCompleted = document.getElementById('hist-stat-completed');
      const statSize = document.getElementById('hist-stat-size');
      const statFolder = document.getElementById('hist-stat-folder');

      if (statTotal) statTotal.textContent = validItems.length;
      if (statCompleted) statCompleted.textContent = completedCount;
      if (statSize) statSize.textContent = Components.formatBytes(totalBytes);
      if (statFolder) statFolder.textContent = this.settings.download_dir || 'Downloads/Saveo';

      if (emptyState) {
        emptyState.style.display = validItems.length === 0 ? 'block' : 'none';
      }

      if (container) {
        container.innerHTML = '';
        if (validItems.length > 0) {
          validItems.forEach(it => {
            try {
              const card = Components.renderHistoryItem(it);
              if (card) container.appendChild(card);
            } catch (cardErr) {
              console.error("Error rendering history item card:", cardErr, it);
            }
          });
        }
      }

    } catch (e) {
      console.error("Load history error:", e);
    }
  }

  // ================= SETTINGS =================
  setupSettings() {
    const btnBrowse = document.getElementById('btn-settings-browse');
    const sliderConcurrent = document.getElementById('setting-concurrent');
    const badgeConcurrent = document.getElementById('concurrent-val-badge');
    const sliderFragments = document.getElementById('setting-fragment-concurrency');
    const badgeFragments = document.getElementById('fragment-val-badge');
    const btnSave = document.getElementById('btn-save-settings');

    if (sliderConcurrent && badgeConcurrent) {
      const updateConcurrentBadge = () => {
        badgeConcurrent.textContent = sliderConcurrent.value;
      };
      sliderConcurrent.addEventListener('input', updateConcurrentBadge);
      sliderConcurrent.addEventListener('change', updateConcurrentBadge);
    }

    if (sliderFragments && badgeFragments) {
      const updateFragmentBadge = () => {
        badgeFragments.textContent = sliderFragments.value;
      };
      sliderFragments.addEventListener('input', updateFragmentBadge);
      sliderFragments.addEventListener('change', updateFragmentBadge);
    }

    if (btnBrowse) {
      btnBrowse.addEventListener('click', async () => {
        try {
          const res = await api.browseFolder();
          if (res && res.updated && res.folder) {
            const dirInput = document.getElementById('setting-dir-input');
            if (dirInput) dirInput.value = res.folder;
            this.settings.download_dir = res.folder;
            const saveDir = document.getElementById('selected-save-dir');
            if (saveDir) saveDir.textContent = res.folder;
            Components.showToast(`Updated directory: ${res.folder}`, 'success');
          }
        } catch (e) {
          console.error("Browse folder error:", e);
        }
      });
    }

    const btnBrowseCookies = document.getElementById('btn-settings-browse-cookies');
    const btnUploadCookies = document.getElementById('btn-settings-upload-cookies');
    const fileUploadInput = document.getElementById('setting-cookie-file-upload');
    const btnClearCookies = document.getElementById('btn-settings-clear-cookies');
    const cookieInput = document.getElementById('setting-cookie-input');

    if (btnBrowseCookies && cookieInput) {
      btnBrowseCookies.addEventListener('click', async () => {
        try {
          const res = await api.browseCookieFile();
          if (res && res.updated && res.cookie_file) {
            cookieInput.value = res.cookie_file;
            this.settings.cookie_file = res.cookie_file;
            Components.showToast(`Selected cookies: ${res.cookie_file}`, 'success');
            this.loadSystemStatus();
          }
        } catch (e) {
          console.error("Browse cookies error:", e);
        }
      });
    }

    if (btnUploadCookies && fileUploadInput) {
      btnUploadCookies.addEventListener('click', () => fileUploadInput.click());
      fileUploadInput.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        try {
          const reader = new FileReader();
          reader.onload = async (evt) => {
            const text = evt.target.result;
            const res = await api.uploadCookies(text);
            if (res && res.status === 'success') {
              if (cookieInput) cookieInput.value = res.cookie_file;
              this.settings.cookie_file = res.cookie_file;
              Components.showToast('Uploaded and activated cookies.txt successfully!', 'success');
              this.loadSystemStatus();
            }
          };
          reader.readAsText(file);
        } catch (err) {
          console.error("Upload cookies error:", err);
          Components.showToast(`Upload failed: ${err.message}`, 'error');
        }
      });
    }

    if (btnClearCookies) {
      btnClearCookies.addEventListener('click', async () => {
        if (cookieInput) cookieInput.value = '';
        this.settings.cookie_file = '';
        try {
          await api.updateSettings({ cookie_file: '' });
          Components.showToast('Cleared custom cookies file.', 'info');
          this.loadSystemStatus();
        } catch (e) {
          console.error("Clear cookies error:", e);
        }
      });
    }

    const btnErrorCookies = document.getElementById('btn-error-cookie-settings');
    if (btnErrorCookies) {
      btnErrorCookies.addEventListener('click', () => {
        this.switchTab('settings');
      });
    }

    const btnQuickCookie = document.getElementById('btn-quick-cookie-settings');
    if (btnQuickCookie) {
      btnQuickCookie.addEventListener('click', () => {
        this.switchTab('settings');
      });
    }

    if (btnSave) {
      btnSave.addEventListener('click', async () => {
        const dirInput = document.getElementById('setting-dir-input');
        const vQual = document.getElementById('setting-video-quality');
        const aCodec = document.getElementById('setting-audio-codec');
        const notif = document.getElementById('setting-notifications');
        const cookieBrowser = document.getElementById('setting-cookie-browser');
        const rateInput = document.getElementById('setting-rate-limit');
        const parsedRate = rateInput ? parseInt(rateInput.value, 10) : NaN;
        const subsToggle = document.getElementById('setting-subtitles');
        const subtitleLangs = document.getElementById('setting-subtitle-langs');
        const subtitleMode = document.getElementById('setting-subtitle-mode');
        const embedMeta = document.getElementById('setting-embed-metadata');
        const embedThumb = document.getElementById('setting-embed-thumbnail');
        const activeThemeChip = document.querySelector('.theme-chip.active');
        const selectedTheme = (activeThemeChip ? activeThemeChip.getAttribute('data-theme') : null) || ThemeManager.currentTheme || 'dark';

        const updates = {
          download_dir: dirInput ? dirInput.value : (this.settings.download_dir || ''),
          default_video_quality: vQual ? vQual.value : (this.settings.default_video_quality || 'best'),
          default_audio_format: aCodec ? aCodec.value : (this.settings.default_audio_format || 'mp3'),
          max_concurrent_downloads: typeof window.SaveoAndroid !== 'undefined'
            ? 1
            : (sliderConcurrent ? parseInt(sliderConcurrent.value, 10) : (this.settings.max_concurrent_downloads || 3)),
          fragment_concurrency: sliderFragments ? parseInt(sliderFragments.value, 10) : (this.settings.fragment_concurrency || 1),
          rate_limit_kbps: Number.isNaN(parsedRate) ? (this.settings.rate_limit_kbps || 0) : parsedRate,
          filename_template: (document.getElementById('setting-filename-template')?.value || '{title}').trim() || '{title}',
          subtitles_enabled: subsToggle ? subsToggle.checked : Boolean(this.settings.subtitles_enabled),
          subtitle_langs: (subtitleLangs ? subtitleLangs.value : (this.settings.subtitle_langs || 'en')).trim() || 'en',
          subtitle_mode: subtitleMode ? subtitleMode.value : (this.settings.subtitle_mode || 'sidecar'),
          embed_metadata: embedMeta ? embedMeta.checked : Boolean(this.settings.embed_metadata),
          embed_thumbnail: embedThumb ? embedThumb.checked : Boolean(this.settings.embed_thumbnail),
          schedule_enabled: document.getElementById('setting-schedule-enabled')
            ? document.getElementById('setting-schedule-enabled').checked
            : Boolean(this.settings.schedule_enabled),
          schedule_start: (document.getElementById('setting-schedule-start')?.value || this.settings.schedule_start || '01:00'),
          schedule_stop: (document.getElementById('setting-schedule-stop')?.value || this.settings.schedule_stop || '07:00'),
          beam_enabled: document.getElementById('setting-beam-enabled')
            ? document.getElementById('setting-beam-enabled').checked
            : Boolean(this.settings.beam_enabled),
          notifications: notif ? notif.checked : (this.settings.notifications !== false),
          skip_duplicates: document.getElementById('setting-skip-duplicates')
            ? document.getElementById('setting-skip-duplicates').checked
            : (this.settings.skip_duplicates !== false),
          cookie_browser: cookieBrowser ? cookieBrowser.value : (this.settings.cookie_browser || 'none'),
          cookie_file: cookieInput ? cookieInput.value.trim() : (this.settings.cookie_file || ''),
          theme: selectedTheme
        };

        try {
          this.settings = await api.updateSettings(updates);
          const saveDir = document.getElementById('selected-save-dir');
          if (saveDir) saveDir.textContent = this.settings.download_dir || 'Downloads/Saveo';
          if (this.settings.theme) {
            ThemeManager.setTheme(this.settings.theme);
          }
          Components.showToast('Preferences saved successfully!', 'success');
          this.loadSystemStatus();
          this.loadBeamInfo();
        } catch (e) {
          Components.showToast(`Failed to save settings: ${e.message}`, 'error');
        }
      });
    }
  }

  async loadSettings() {
    try {
      this.settings = await api.getSettings();
      const dirInput = document.getElementById('setting-dir-input');
      if (dirInput) dirInput.value = this.settings.download_dir || '';

      const saveDir = document.getElementById('selected-save-dir');
      if (saveDir) saveDir.textContent = this.settings.download_dir || 'Downloads/Saveo';

      const vQual = document.getElementById('setting-video-quality');
      if (vQual) vQual.value = this.settings.default_video_quality || 'best';

      const aCodec = document.getElementById('setting-audio-codec');
      if (aCodec) aCodec.value = this.settings.default_audio_format || 'mp3';

      const concurrent = document.getElementById('setting-concurrent');
      if (concurrent) {
        // Android's pause/cancel state is global, so downloads run one at a time there.
        const isMobile = typeof window.SaveoAndroid !== 'undefined';
        concurrent.max = isMobile ? '1' : '5';
        concurrent.value = isMobile ? 1 : (this.settings.max_concurrent_downloads || 3);
      }

      const badge = document.getElementById('concurrent-val-badge');
      if (badge) badge.textContent = concurrent ? concurrent.value : (this.settings.max_concurrent_downloads || 3);

      const filenameInput = document.getElementById('setting-filename-template');
      if (filenameInput) {
        filenameInput.value = this.settings.filename_template || '{title}';
        // The embedded Android engine names files from the media title only.
        if (typeof window.SaveoAndroid !== 'undefined') {
          const row = filenameInput.closest('.setting-item');
          if (row) row.style.display = 'none';
        }
      }

      const fragmentSlider = document.getElementById('setting-fragment-concurrency');
      if (fragmentSlider) fragmentSlider.value = this.settings.fragment_concurrency || 1;
      const fragmentBadge = document.getElementById('fragment-val-badge');
      if (fragmentBadge) fragmentBadge.textContent = fragmentSlider ? fragmentSlider.value : (this.settings.fragment_concurrency || 1);

      const rateInput = document.getElementById('setting-rate-limit');
      if (rateInput) rateInput.value = this.settings.rate_limit_kbps || 0;

      const subsToggle = document.getElementById('setting-subtitles');
      if (subsToggle) subsToggle.checked = Boolean(this.settings.subtitles_enabled);
      const subtitleLangs = document.getElementById('setting-subtitle-langs');
      if (subtitleLangs) subtitleLangs.value = this.settings.subtitle_langs || 'en';
      const subtitleMode = document.getElementById('setting-subtitle-mode');
      if (subtitleMode) subtitleMode.value = this.settings.subtitle_mode || 'sidecar';
      const embedMeta = document.getElementById('setting-embed-metadata');
      if (embedMeta) embedMeta.checked = Boolean(this.settings.embed_metadata);
      const embedThumb = document.getElementById('setting-embed-thumbnail');
      if (embedThumb) embedThumb.checked = Boolean(this.settings.embed_thumbnail);

      const scheduleToggle = document.getElementById('setting-schedule-enabled');
      if (scheduleToggle) scheduleToggle.checked = Boolean(this.settings.schedule_enabled);
      const scheduleStart = document.getElementById('setting-schedule-start');
      if (scheduleStart) scheduleStart.value = this.settings.schedule_start || '01:00';
      const scheduleStop = document.getElementById('setting-schedule-stop');
      if (scheduleStop) scheduleStop.value = this.settings.schedule_stop || '07:00';

      const beamToggle = document.getElementById('setting-beam-enabled');
      if (beamToggle) beamToggle.checked = Boolean(this.settings.beam_enabled);

      // These shape the desktop yt-dlp engine; the Android engine has fixed defaults.
      if (typeof window.SaveoAndroid !== 'undefined') {
        [
          'setting-rate-limit',
          'setting-fragment-concurrency',
          'setting-subtitles',
          'setting-subtitle-langs',
          'setting-subtitle-mode',
          'setting-embed-metadata',
          'setting-embed-thumbnail',
          'setting-schedule-enabled',
          'setting-schedule-start',
          'setting-schedule-stop',
        ].forEach(id => {
          const el = document.getElementById(id);
          if (!el) return;
          const row = el.closest('.setting-item');
          if (row) row.style.display = 'none';
        });
      }

      const notif = document.getElementById('setting-notifications');
      if (notif) notif.checked = this.settings.notifications !== false;

      const skipDup = document.getElementById('setting-skip-duplicates');
      if (skipDup) skipDup.checked = this.settings.skip_duplicates !== false;

      const cookieInput = document.getElementById('setting-cookie-input');
      if (cookieInput) {
        cookieInput.value = this.settings.cookie_file || '';
      }

      const cookieBrowserSelect = document.getElementById('setting-cookie-browser');
      if (cookieBrowserSelect) {
        cookieBrowserSelect.value = this.settings.cookie_browser || 'none';
      }

      if (this.settings.theme) {
        ThemeManager.setTheme(this.settings.theme);
      }
    } catch (e) {
      console.error("Load settings error:", e);
    }
  }

  setServicesStatus(state) {
    const pill = document.getElementById('server-status-pill');
    const label = document.getElementById('server-status-label');
    if (!pill || !label) return;
    if (state === 'reconnecting') {
      pill.className = 'header-server-pill status-reconnecting';
      label.textContent = 'Reconnecting...';
    } else {
      pill.className = 'header-server-pill status-ready';
      label.textContent = 'Services Online';
    }
  }

  async loadSystemStatus() {
    try {
      const status = await api.getSystemStatus();
      const appVer = status.app_version || 'v1.4.16';
      const rawYtdlp = status.ytdlp_version;

      const verPill = document.getElementById('header-version-pill');
      if (verPill) verPill.textContent = appVer;

      const enginePill = document.getElementById('header-engine-pill');
      if (enginePill) {
        if (rawYtdlp && rawYtdlp !== 'unknown' && rawYtdlp !== 'installed') {
          const cleanVer = rawYtdlp.startsWith('v') ? rawYtdlp.slice(1) : rawYtdlp;
          enginePill.textContent = `Engine v${cleanVer}`;
        } else {
          enginePill.textContent = 'Engine Active';
        }
      }

      const trustVer = document.getElementById('trust-version');
      if (trustVer) trustVer.textContent = appVer;

      this.setServicesStatus('ready');

      const diagYtdlp = document.getElementById('diag-ytdlp');
      if (diagYtdlp) {
        if (rawYtdlp && rawYtdlp !== 'unknown' && rawYtdlp !== 'installed') {
          const cleanVer = rawYtdlp.startsWith('v') ? rawYtdlp.slice(1) : rawYtdlp;
          diagYtdlp.textContent = `yt-dlp v${cleanVer}`;
        } else {
          diagYtdlp.textContent = 'yt-dlp (Active Engine)';
        }
      }

      const diagFfmpeg = document.getElementById('diag-ffmpeg');
      if (diagFfmpeg) diagFfmpeg.textContent = status.ffmpeg_ready ? 'Bundled v7.1 (Active)' : 'Not Available';

      const diagPython = document.getElementById('diag-python');
      if (diagPython) diagPython.textContent = `Python ${status.python_version}`;

      const diagCookies = document.getElementById('diag-cookies');
      if (diagCookies) {
        if (status.cookies_ready) {
          diagCookies.textContent = status.cookies_path 
            ? `Active (${status.cookies_path.split(/[\\/]/).pop()})` 
            : `Active (${status.cookie_browser})`;
          diagCookies.className = 'diag-val highlight';
        } else {
          diagCookies.textContent = 'None (Optional)';
          diagCookies.className = 'diag-val';
        }
      }

      const mediaAuthBadge = document.getElementById('media-auth-badge');
      if (mediaAuthBadge) {
        if (status.cookies_ready) {
          if (status.cookies_path) {
            mediaAuthBadge.textContent = 'cookies.txt active';
          } else if (status.cookie_browser && status.cookie_browser !== 'none') {
            mediaAuthBadge.textContent = `${status.cookie_browser} active`;
          } else {
            mediaAuthBadge.textContent = 'Cookies active';
          }
          mediaAuthBadge.style.background = 'rgba(79, 169, 111, 0.14)';
          mediaAuthBadge.style.color = 'var(--good, #4fa96f)';
        } else {
          mediaAuthBadge.textContent = 'None (public)';
          mediaAuthBadge.style.background = '';
          mediaAuthBadge.style.color = '';
        }
      }

    } catch (e) {
      console.error("Load system status error:", e);
    }
  }

  // ================= UPDATE SYSTEM =================
  setupUpdateSystem() {
    const modal = document.getElementById('update-modal');
    const btnClose = document.getElementById('btn-close-update-modal');
    const btnHeaderUpdates = document.getElementById('header-check-updates');
    const btnSettingsUpdates = document.getElementById('btn-settings-check-updates');
    const btnViewGithub = document.getElementById('btn-view-github');
    const btnCancelDl = document.getElementById('btn-cancel-installer-dl');
    const btnPrimary = document.getElementById('btn-installer-primary');
    const btnPrimaryText = document.getElementById('btn-installer-primary-text');

    const curVerEl = document.getElementById('update-cur-ver');
    const newVerEl = document.getElementById('update-new-ver');
    const releaseDateEl = document.getElementById('update-release-date');
    const releaseSizeEl = document.getElementById('update-release-size');
    const changelogEl = document.getElementById('update-changelog-content');
    const dlBox = document.getElementById('update-dl-progress-box');
    const dlTitle = document.getElementById('update-dl-status-title');
    const dlPercent = document.getElementById('update-dl-percent');
    const dlBar = document.getElementById('update-dl-bar-fill');
    const dlBytes = document.getElementById('update-dl-bytes');
    const dlSpeed = document.getElementById('update-dl-speed');
    const statusMsg = document.getElementById('update-status-msg');

    let currentUpdateInfo = null;
    let pollInterval = null;
    let downloadState = 'idle'; // 'idle', 'can-download', 'downloading', 'ready-to-install', 'ytdlp-core'

    const formatBytes = (bytes) => {
      if (bytes === undefined || bytes === null || isNaN(bytes) || bytes <= 0) return '0 MB';
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    const formatDate = (isoStr) => {
      if (!isoStr) return 'Recently';
      try {
        const d = new Date(isoStr);
        return d.toLocaleDateString(undefined, { month: '2-digit', day: '2-digit', year: 'numeric' });
      } catch (e) {
        return isoStr;
      }
    };

    const renderChangelog = (notes) => {
      const defaultFeatures = `
        <ul>
          <li><span class="cl-feature-highlight">Native Desktop Clipboard:</span> Seamless one-click paste with zero browser permission prompts.</li>
          <li><span class="cl-feature-highlight">Accurate Progress Tracking:</span> Synchronized download counters and completion states.</li>
          <li><span class="cl-feature-highlight">Intelligent Core Engine:</span> Dynamic yt-dlp core status detection and self-updating engine.</li>
          <li><span class="cl-feature-highlight">Refined Theme-Adaptive UI:</span> Minimalist design with real-time local background engine monitoring.</li>
          <li><span class="cl-feature-highlight">Private & Local:</span> 100% on-device processing with zero telemetry and zero external tracking.</li>
        </ul>
      `;

      if (!notes || !notes.trim()) {
        return defaultFeatures;
      }

      const lines = notes.split('\n');
      const items = [];
      for (let line of lines) {
        line = line.trim();
        if (!line) continue;
        // Skip release download table, dividers, and installation instructions
        if (line.startsWith('|') || line.startsWith('---') || line.startsWith('===') || line === '--') continue;
        if (line.toLowerCase().includes('tested on windows') || line.toLowerCase().includes('download saveo') || line.toLowerCase().includes('download saveo')) continue;
        if (line.toLowerCase().includes('###') || line.toLowerCase().includes('platform |')) continue;
        
        if (/^[-*+]\s+/.test(line)) {
          let content = line.replace(/^[-*+]\s+/, '').trim();
          if (!content || content === '-' || content === '--') continue;
          content = Components.escapeHtml(content);
          content = content.replace(/\*\*(.*?)\*\*:?/g, (match, p1) => {
            const title = p1.replace(/:+$/, '').trim();
            return `<span class="cl-feature-highlight">${title}:</span>`;
          });
          items.push(`<li>${content}</li>`);
        }
      }

      if (items.length > 0) {
        return `<ul>${items.slice(0, 10).join('')}</ul>`;
      }

      return defaultFeatures;
    };

    const openUpdateCheck = async () => {
      if (modal) modal.style.display = 'flex';
      if (statusMsg) statusMsg.style.display = 'none';
      if (dlBox) dlBox.style.display = 'none';
      if (btnCancelDl) btnCancelDl.style.display = 'none';
      if (btnPrimary) btnPrimary.disabled = true;
      if (btnPrimaryText) btnPrimaryText.textContent = 'Checking for Updates...';

      const titleEl = document.getElementById('update-modal-title');
      const descEl = document.getElementById('update-modal-desc');
      const curVerEl = document.getElementById('update-cur-ver');
      const newVerEl = document.getElementById('update-new-ver');

      if (curVerEl) curVerEl.textContent = 'v1.4.16';
      if (newVerEl) newVerEl.textContent = '...';
      if (titleEl) titleEl.textContent = 'Checking for Updates...';
      if (descEl) descEl.textContent = 'Contacting update servers to verify Saveo release and platform core engine status...';
      if (changelogEl) changelogEl.innerHTML = '<div style="color: #64748b; font-size: 13px;">Fetching release notes...</div>';

      try {
        const info = await api.checkUpdates();
        currentUpdateInfo = info;
        const appInst = info.app_installed || 'v1.4.16';
        const appLatest = info.app_latest || 'v1.4.16';
        const isUpToDate = Boolean(info.app_up_to_date);

        if (curVerEl) curVerEl.textContent = appInst;
        if (newVerEl) newVerEl.textContent = appLatest;
        if (releaseDateEl) releaseDateEl.textContent = formatDate(info.published_at);
        if (releaseSizeEl) releaseSizeEl.textContent = formatBytes(info.installer_size);
        if (changelogEl) changelogEl.innerHTML = renderChangelog(info.release_notes);

        if (info.release_url && btnViewGithub) {
          btnViewGithub.href = info.release_url;
        }

        const updateDot = document.getElementById('header-update-dot');
        if (isUpToDate) {
          if (titleEl) titleEl.textContent = 'Saveo is Up to Date';
          const ytdlpUpToDate = Boolean(info.ytdlp_up_to_date);
          if (ytdlpUpToDate) {
            if (updateDot) updateDot.style.display = 'none';
            if (descEl) descEl.textContent = `You are running the newest release of Saveo (${appInst}), and the embedded yt-dlp core engine (${info.ytdlp_installed || 'Latest'}) is fully up to date.`;
            if (btnPrimary) btnPrimary.disabled = false;
            if (btnPrimaryText) btnPrimaryText.textContent = 'Core is Up to Date';
          } else {
            if (updateDot) updateDot.style.display = 'block';
            if (descEl) descEl.textContent = `Saveo is up to date, but a newer yt-dlp core engine (${info.ytdlp_latest || 'Update'}) is available for latest platform fixes.`;
            if (btnPrimary) btnPrimary.disabled = false;
            if (btnPrimaryText) btnPrimaryText.textContent = 'Update yt-dlp Core';
          }
          downloadState = 'ytdlp-core';
        } else {
          if (updateDot) updateDot.style.display = 'block';
          if (titleEl) titleEl.textContent = 'Application Update Available';
          if (descEl) descEl.textContent = 'A newer version of Saveo is ready to install';
          if (btnPrimary) btnPrimary.disabled = false;
          if (btnPrimaryText) btnPrimaryText.textContent = 'Download Update';
          downloadState = 'can-download';
        }
      } catch (e) {
        if (curVerEl) curVerEl.textContent = 'v1.4.16';
        if (newVerEl) newVerEl.textContent = 'v1.4.16';
        if (titleEl) titleEl.textContent = 'Saveo Core Engine';
        if (descEl) descEl.textContent = 'Verified online. You can check the embedded yt-dlp core engine.';
        if (changelogEl) changelogEl.innerHTML = renderChangelog('');
        if (btnPrimary) btnPrimary.disabled = false;
        if (btnPrimaryText) btnPrimaryText.textContent = 'Check yt-dlp Core';
        downloadState = 'ytdlp-core';
      }
    };

    if (btnHeaderUpdates) btnHeaderUpdates.addEventListener('click', openUpdateCheck);
    if (btnSettingsUpdates) btnSettingsUpdates.addEventListener('click', openUpdateCheck);
    if (btnClose && modal) btnClose.addEventListener('click', () => { modal.style.display = 'none'; });
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
      });
    }

    // Cancel download button
    if (btnCancelDl) {
      btnCancelDl.addEventListener('click', async () => {
        if (pollInterval) clearInterval(pollInterval);
        try {
          await api.cancelInstallerDownload();
        } catch (e) {}
        if (dlBox) dlBox.style.display = 'none';
        btnCancelDl.style.display = 'none';
        if (btnPrimary) btnPrimary.disabled = false;
        if (btnPrimaryText) btnPrimaryText.textContent = 'Download Update';
        downloadState = 'can-download';
        Components.showToast('Download cancelled', 'info');
      });
    }

    // Primary action button handler (Download -> Restart & Install / Core Update)
    if (btnPrimary) {
      btnPrimary.addEventListener('click', async () => {
      if (downloadState === 'can-download') {
        const url = currentUpdateInfo?.installer_url || `https://github.com/ProTechPh/Saveo/releases/download/${currentUpdateInfo?.app_latest || 'v1.4.16'}/Saveo-Setup.exe`;
        const size = currentUpdateInfo?.installer_size || 0;

        downloadState = 'downloading';
        btnPrimary.disabled = true;
        btnPrimaryText.textContent = 'Downloading...';
        btnCancelDl.style.display = 'inline-flex';
        dlBox.style.display = 'block';
        dlBar.style.width = '0%';
        dlPercent.textContent = '0%';
        dlBytes.textContent = `0 MB / ${formatBytes(size)}`;
        dlSpeed.textContent = '0 MB/s';
        dlTitle.textContent = 'Downloading installer...';

        try {
          await api.downloadInstaller(url, size);
          
          if (pollInterval) clearInterval(pollInterval);
          pollInterval = setInterval(async () => {
            try {
              const st = await api.getInstallerDownloadStatus();
              if (st.status === 'downloading') {
                const pct = Math.min(Math.max(st.percent || 0, 0), 100);
                dlBar.style.width = pct + '%';
                dlPercent.textContent = Math.round(pct) + '%';
                dlBytes.textContent = `${formatBytes(st.downloaded_bytes)} / ${formatBytes(st.total_bytes)}`;
                dlSpeed.textContent = `${(st.speed_bps / (1024 * 1024)).toFixed(1)} MB/s`;
              } else if (st.status === 'completed') {
                clearInterval(pollInterval);
                dlBar.style.width = '100%';
                dlPercent.textContent = '100%';
                dlTitle.textContent = 'Download Complete!';
                const finalSize = st.total_bytes || st.downloaded_bytes || size || 0;
                dlBytes.textContent = `${formatBytes(finalSize)} / ${formatBytes(finalSize)}`;
                dlSpeed.textContent = 'Completed';
                btnCancelDl.style.display = 'none';
                btnPrimary.disabled = false;
                btnPrimaryText.textContent = 'Restart and Install';
                downloadState = 'ready-to-install';
              } else if (st.status === 'error') {
                clearInterval(pollInterval);
                dlTitle.textContent = 'Download Failed';
                dlBox.style.display = 'none';
                btnCancelDl.style.display = 'none';
                btnPrimary.disabled = false;
                btnPrimaryText.textContent = 'Download Update';
                downloadState = 'can-download';
                Components.showToast(`Download failed: ${st.error || 'Network error'}`, 'error');
              }
            } catch (err) {}
          }, 400);

        } catch (e) {
          btnPrimary.disabled = false;
          btnPrimaryText.textContent = 'Download Update';
          downloadState = 'can-download';
          Components.showToast(`Download failed: ${e.message}`, 'error');
        }

      } else if (downloadState === 'ready-to-install') {
        // Trigger install and restart
        btnPrimary.disabled = true;
        btnPrimaryText.textContent = 'Launching Installer...';

        try {
          await api.installAndRestart();
          Components.showToast('Launching installer and restarting Saveo...', 'success');

          const serverPill = document.getElementById('server-status-pill');
          const serverLabel = document.getElementById('server-status-label');
          if (serverPill) {
            serverPill.className = 'header-server-pill status-reconnecting';
          }
          if (serverLabel) {
            serverLabel.textContent = 'Updating...';
          }

          // Close modal after brief delay and enter reconnecting polling loop
          setTimeout(() => {
            modal.style.display = 'none';
          }, 1500);

          // Poll until server is back online
          let reconnectAttempts = 0;
          const reconnectTimer = setInterval(async () => {
            reconnectAttempts++;
            try {
              const st = await api.getSystemStatus();
              if (st && st.python_version) {
                clearInterval(reconnectTimer);
                if (serverPill) serverPill.className = 'header-server-pill status-ready';
                if (serverLabel) serverLabel.textContent = 'Services Online';
                Components.showToast('Saveo updated and reconnected!', 'success');
                await this.loadSystemStatus();
              }
            } catch (e) {
              // Still restarting
            }
            if (reconnectAttempts > 60) {
              clearInterval(reconnectTimer);
            }
          }, 1500);

        } catch (e) {
          btnPrimary.disabled = false;
          btnPrimaryText.textContent = 'Install & Restart';
          Components.showToast(`Installer: ${e.message}`, 'error');
          if (statusMsg) {
            statusMsg.style.display = 'block';
            statusMsg.style.color = '#f59e0b';
            const safeMessage = Components.escapeHtml(e.message || '');
            statusMsg.innerHTML = `${safeMessage} <br/><a href="#" id="link-open-installer-folder" style="color:var(--accent);text-decoration:underline;display:inline-block;margin-top:6px;font-weight:500;">Open Installer in Downloads</a>`;
            const openLink = document.getElementById('link-open-installer-folder');
            if (openLink) {
              openLink.addEventListener('click', (evt) => {
                evt.preventDefault();
                api.openInstallerFolder().catch(() => {});
              });
            }
          }
        }

      } else if (downloadState === 'ytdlp-core') {
        // Update / Verify yt-dlp core
        btnPrimary.disabled = true;
        btnPrimaryText.textContent = 'Checking core engine...';
        statusMsg.style.display = 'block';
        statusMsg.style.color = '#a78bfa';
        statusMsg.textContent = 'Checking PyPI for latest yt-dlp engine status...';

        try {
          const res = await api.updateYtdlpCore();
          if (res.status === 'success') {
            statusMsg.style.color = '#10b981';
            if (res.already_up_to_date) {
              statusMsg.textContent = res.message || `yt-dlp core engine is already up to date (${res.version || ''}).`;
              Components.showToast(res.message || 'yt-dlp core is up to date', 'info');
              btnPrimaryText.textContent = 'Core is Up to Date';
            } else {
              statusMsg.textContent = res.message || `Updated yt-dlp core engine to ${res.version}!`;
              Components.showToast(`yt-dlp core updated to ${res.version}!`, 'success');
              btnPrimaryText.textContent = 'Core Updated';
            }
            await this.loadSystemStatus();
          } else {
            statusMsg.style.color = '#ef4444';
            statusMsg.textContent = res.message || 'Update check failed.';
            btnPrimaryText.textContent = 'Check yt-dlp Core';
          }
        } catch (e) {
          statusMsg.style.color = '#ef4444';
          statusMsg.textContent = `Update error: ${e.message}`;
          btnPrimaryText.textContent = 'Check yt-dlp Core';
        } finally {
          btnPrimary.disabled = false;
        }
      }
    });
  }
}

  // ================= BACKGROUND STARTUP UPDATE CHECK =================
  async checkUpdatesOnStartup() {
    const btnHeaderUpdates = document.getElementById('header-check-updates');
    const updateIcon = document.getElementById('header-update-icon');
    const updateDot = document.getElementById('header-update-dot');

    // Turn circular arrow on startup
    if (updateIcon) updateIcon.classList.add('spinning');
    if (btnHeaderUpdates) btnHeaderUpdates.classList.add('checking');

    try {
      // Gentle initial pause so first render completes smoothly
      await new Promise(r => setTimeout(r, 900));
      const info = await api.checkUpdates();
      if (info) {
        const hasAppUpdate = !info.app_up_to_date;
        const hasCoreUpdate = !info.ytdlp_up_to_date;

        if (hasAppUpdate || hasCoreUpdate) {
          if (updateDot) {
            updateDot.style.display = 'block';
            updateDot.title = hasAppUpdate
              ? `Saveo ${info.app_latest || 'update'} available!`
              : `yt-dlp core engine update available!`;
          }
        } else {
          if (updateDot) updateDot.style.display = 'none';
        }
      }
    } catch (e) {
      console.warn("Background update check skipped/failed:", e);
    } finally {
      if (updateIcon) updateIcon.classList.remove('spinning');
      if (btnHeaderUpdates) btnHeaderUpdates.classList.remove('checking');
    }
  }

  // ================= WEBSOCKET & NATIVE EVENT LISTENERS =================
  setupWebSocketListeners() {
    api.on('sse_connected', () => this.setServicesStatus('ready'));
    api.on('sse_disconnected', () => this.setServicesStatus('reconnecting'));

    api.on('initial_state', (payload) => {
      if (payload && Array.isArray(payload.tasks)) {
        this.tasks = payload.tasks;
        this.renderQueueList();
        this.updateRecentDownloadsHeader();

        if (this.activeSingleTaskId) {
          const singleTask = this.tasks.find(t => t.id === this.activeSingleTaskId);
          if (singleTask) {
            if (singleTask.status === 'completed') {
              this.handleSingleSuccess(singleTask);
              this.activeSingleTaskId = null;
            } else if (singleTask.status === 'failed') {
              this.activeSingleTaskId = null;
              const card = document.getElementById('single-download-card');
              if (card) card.style.display = 'none';
              const errCard = document.getElementById('analyze-error');
              if (errCard) {
                document.getElementById('error-friendly-text').textContent = singleTask.error_friendly || 'Download failed.';
                document.getElementById('error-tech-log').textContent = singleTask.error_technical || 'No additional logs.';
                errCard.style.display = 'flex';
              }
            } else if (singleTask.status === 'downloading' || singleTask.status === 'processing') {
              this.updateSingleProgress(singleTask);
            }
          }
        }
      }
    });

    api.on('task_added', (payload) => {
      const task = payload.task;
      const idx = this.tasks.findIndex(t => t.id === task.id);
      if (idx >= 0) {
        this.tasks[idx] = task;
      } else {
        this.tasks.unshift(task);
      }
      this.renderQueueList();
    });

    api.on('task_progress', (payload) => {
      const task = payload.task;
      const idx = this.tasks.findIndex(t => t.id === task.id);
      if (idx >= 0) {
        const existing = this.tasks[idx];
        // Terminal state guard: ignore late progress ticks for completed/failed/cancelled tasks
        if (existing && (existing.status === 'completed' || existing.status === 'failed' || existing.status === 'cancelled')) {
          return;
        }
        this.tasks[idx] = task;
      }

      if (this.activeSingleTaskId === task.id) {
        this.updateSingleProgress(task);
      }

      Components.updateQueueItem(task);
    });

    api.on('task_completed', (payload) => {
      const task = payload.task;
      const idx = this.tasks.findIndex(t => t.id === task.id);
      if (idx >= 0) this.tasks[idx] = task;

      if (this.activeSingleTaskId === task.id) {
        this.activeSingleTaskId = null;
        this.handleSingleSuccess(task);
      } else {
        Components.showToast(`Completed download: "${task.title || 'Media'}"`, 'success');
      }

      Components.updateQueueItem(task);
      this.updateRecentDownloadsHeader();
      this.loadHistory();

      if (this.settings.notifications && ("Notification" in window) && Notification.permission === "granted") {
        new Notification("Saveo — Download Finished", {
          body: `${task.title} has finished downloading.`,
          icon: task.thumbnail || undefined
        });
      }
    });

    api.on('queue_cleared', () => {
      this.tasks = (this.tasks || []).filter(t => t.status === 'queued' || t.status === 'downloading' || t.status === 'processing' || t.status === 'pending');
      this.renderQueueList();
    });

    api.on('task_removed', (payload) => {
      const taskId = payload && payload.task ? payload.task.id : (payload ? payload.id : null);
      if (taskId) {
        this.tasks = (this.tasks || []).filter(t => t.id !== taskId);
        this.renderQueueList();
      }
    });

    api.on('task_cancelled', (payload) => {
      const taskId = payload && payload.task ? payload.task.id : (payload ? payload.id : null);
      if (taskId) {
        const idx = this.tasks.findIndex(t => t.id === taskId);
        if (idx >= 0) {
          this.tasks[idx].status = 'cancelled';
          Components.updateQueueItem(this.tasks[idx]);
        }
      }
      this.renderQueueList();
    });

    api.on('task_failed', (payload) => {
      const task = payload.task;
      const idx = this.tasks.findIndex(t => t.id === task.id);
      if (idx >= 0) this.tasks[idx] = task;

      if (this.activeSingleTaskId === task.id) {
        this.activeSingleTaskId = null;
        document.getElementById('single-download-card').style.display = 'none';
        const errCard = document.getElementById('analyze-error');
        document.getElementById('error-friendly-text').textContent = task.error_friendly || 'Download failed.';
        document.getElementById('error-tech-log').textContent = task.error_technical || 'No additional logs.';
        errCard.style.display = 'flex';
      }

      Components.updateQueueItem(task);
      this.updateRecentDownloadsHeader();
    });

    api.on('task_updated', (payload) => {
      const task = payload.task;
      const idx = this.tasks.findIndex(t => t.id === task.id);
      if (idx >= 0) this.tasks[idx] = task;
      if (this.activeSingleTaskId === task.id && (task.status === 'queued' || task.status === 'downloading')) {
        const errCard = document.getElementById('analyze-error');
        if (errCard) errCard.style.display = 'none';
      }
      this.renderQueueList();
    });

    if (("Notification" in window) && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }

  setSinglePauseButtonState(isPaused) {
    const btnText = document.getElementById('single-pause-text');
    const badge = document.getElementById('single-status-badge');
    const btnIcon = document.getElementById('single-pause-icon');
    if (isPaused) {
      if (btnText) btnText.textContent = 'Resume';
      if (badge) badge.textContent = 'Paused';
      if (btnIcon) {
        btnIcon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3" fill="currentColor"></polygon>';
      }
    } else {
      if (btnText) btnText.textContent = 'Pause';
      if (badge && badge.textContent === 'Paused') badge.textContent = 'Downloading';
      if (btnIcon) {
        btnIcon.innerHTML = '<rect x="6" y="4" width="4" height="16" rx="1"></rect><rect x="14" y="4" width="4" height="16" rx="1"></rect>';
      }
    }
  }

  updateSingleProgress(task) {
    const fill = document.getElementById('single-progress-fill');
    const badge = document.getElementById('single-status-badge');
    const metricPercent = document.getElementById('single-metric-percent');
    const metricSize = document.getElementById('single-metric-size');
    const metricSpeed = document.getElementById('single-metric-speed');
    const metricEta = document.getElementById('single-metric-eta');

    const pct = typeof task.percent !== 'undefined' ? task.percent : (task.progress_percent || 0);
    if (fill) fill.style.width = `${Math.min(100, Math.max(0, pct))}%`;

    const isProcessing = (task.status === 'processing');
    const etaLabel = document.getElementById('single-metric-eta-label');
    if (etaLabel) etaLabel.textContent = isProcessing ? 'Duration' : 'Estimated Time';
    const isPaused = (task.status === 'paused');
    const isAudio = Boolean(task.is_audio);
    const audioFmt = (task.audio_format || 'audio').toUpperCase();
    const targetSizeClean = (task.expected_size_str || '').split('•')[0].trim();

    if (badge) {
      if (pct >= 100) {
        badge.textContent = 'Completed';
      } else if (isPaused) {
        badge.textContent = 'Paused';
      } else if (isProcessing) {
        badge.textContent = isAudio ? `Encoding ${audioFmt}` : 'Finishing up...';
      } else {
        badge.textContent = 'Downloading';
      }
    }

    this.setSinglePauseButtonState(isPaused);

    if (metricPercent) metricPercent.textContent = `${pct.toFixed(1)}%`;

    if (isPaused) {
      if (metricSpeed) metricSpeed.textContent = 'Paused';
      if (metricEta) metricEta.textContent = '--:--';
      if (metricSize) metricSize.textContent = `${task.downloaded_str || '0 B'} / ${task.total_str || '0 B'} (Paused)`;
    } else if (isProcessing) {
      if (metricSize) metricSize.textContent = isAudio
        ? `Encoding ${audioFmt}${targetSizeClean ? ` (~${targetSizeClean})` : ''}`
        : `${task.downloaded_str || '0 B'} / ${task.total_str || '0 B'}`;
      if (metricSpeed) metricSpeed.textContent = task.speed_str || 'Finishing up...';
      if (metricEta) metricEta.textContent = task.eta_str || '--:--';
    } else {
      if (metricSize) {
        if (isAudio && targetSizeClean && ['MP3', 'WAV'].includes(audioFmt)) {
          metricSize.textContent = `${task.downloaded_str || '0 B'} / ${task.total_str || '0 B'} (Stream • Est: ${targetSizeClean})`;
        } else {
          metricSize.textContent = `${task.downloaded_str || '0 B'} / ${task.total_str || '0 B'}`;
        }
      }
      if (metricSpeed) metricSpeed.textContent = task.speed_str || '-- KB/s';
      if (metricEta) metricEta.textContent = task.eta_str || '--:--';
    }
  }

  handleSingleSuccess(task) {
    this.activeSingleTaskId = null;
    document.getElementById('single-download-card').style.display = 'none';
    const errCard = document.getElementById('analyze-error');
    if (errCard) errCard.style.display = 'none';

    const successCard = document.getElementById('single-success-card');
    document.getElementById('success-filename').textContent = task.filename || task.title;

    const btnFolder = document.getElementById('btn-success-open-folder');
    const btnPlay = document.getElementById('btn-success-play');
    btnFolder.setAttribute('data-path', task.file_path || '');
    btnFolder.setAttribute('data-id', task.id || '');
    btnPlay.setAttribute('data-path', task.file_path || '');
    btnPlay.setAttribute('data-id', task.id || '');

    successCard.style.display = 'flex';
    Components.showToast('Download completed successfully!', 'success');
    this.loadHistory();
  }
}

// Instantiate on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.saveoApp = new SaveoApp();
  window.saveoApp = window.saveoApp;
});
