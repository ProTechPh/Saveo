/**
 * Saveo UI Component Renderers & Helpers
 */

const Components = {
  
  // HTML and Attribute escaping helpers
  escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  escapeAttr(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  },

  // Platform icon (neutral mark; no emoji)
  getPlatformIcon() {
    return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2.5" y="5" width="19" height="14" rx="2"></rect><path d="M2.5 9h19"></path><path d="M10 12.5l4 2.5-4 2.5z" fill="currentColor" stroke="none"></path></svg>';
  },

  // Toast Notification
  showToast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let iconSvg = '';
    if (type === 'success') {
      iconSvg = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    } else if (type === 'error') {
      iconSvg = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
    } else {
      iconSvg = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
    }

    toast.innerHTML = iconSvg;
    const textEl = document.createElement('span');
    textEl.textContent = message;
    toast.appendChild(textEl);
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  // Render Format Chips for Video (Saveo Modern Style)
  renderVideoFormats(formats, selectedFormatId, onSelect) {
    const container = document.getElementById('video-formats-grid');
    if (!container) return;
    container.innerHTML = '';

    const existingDropdown = container.parentElement.querySelector('.video-format-dropdown-wrap');
    if (existingDropdown) existingDropdown.remove();

    if (!formats || formats.length === 0) {
      container.innerHTML = `<div style="grid-column: 1/-1; color: var(--fg-dim); font-size: 12px;">Default source stream will be downloaded.</div>`;
      return;
    }

    const defaultFmt = formats[0];
    const initialSelectedId = selectedFormatId || defaultFmt.format_id;
    if (!selectedFormatId && formats.length > 0) {
      onSelect(defaultFmt);
      const sizeEl = document.getElementById('saveo-estimated-size');
      if (sizeEl) sizeEl.textContent = defaultFmt.filesize_str || 'Standard';
    }

    formats.forEach((fmt) => {
      const isSelected = (fmt.format_id === initialSelectedId);
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = `saveo-quality-chip ${isSelected ? 'selected' : ''}`;
      chip.setAttribute('data-fid', fmt.format_id);

      chip.innerHTML = `
        <span class="chip-label">${this.escapeHtml(fmt.label || fmt.resolution || '')}</span>
        <span class="chip-size">${this.escapeHtml(fmt.filesize_str || 'Standard')}</span>
      `;

      chip.addEventListener('click', () => {
        container.querySelectorAll('.saveo-quality-chip').forEach(c => c.classList.remove('selected'));
        chip.classList.add('selected');
        document.querySelectorAll('#advanced-formats-list .advanced-format-row').forEach(r => r.classList.remove('selected'));
        const sizeEl = document.getElementById('saveo-estimated-size');
        if (sizeEl) sizeEl.textContent = fmt.filesize_str || 'Standard';
        onSelect(fmt);
      });

      container.appendChild(chip);
    });
  },

  // Render Audio Codec Chips (Saveo Modern Style)
  renderAudioFormats(formats, selectedFormatId, onSelect) {
    const container = document.getElementById('audio-formats-grid');
    if (!container) return;
    container.innerHTML = '';

    const existingDropdown = container.parentElement.querySelector('.audio-format-dropdown-wrap');
    if (existingDropdown) existingDropdown.remove();

    if (!formats || formats.length === 0) return;

    const defaultFmt = formats[0];
    const initialSelectedId = selectedFormatId || defaultFmt.format_id;

    formats.forEach((fmt) => {
      const isSelected = (fmt.format_id === initialSelectedId);
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = `saveo-quality-chip ${isSelected ? 'selected' : ''}`;
      chip.setAttribute('data-fid', fmt.format_id);

      chip.innerHTML = `
        <span class="chip-label">${this.escapeHtml(fmt.label || '')}</span>
        <span class="chip-size">${this.escapeHtml(fmt.filesize_str || (fmt.ext ? fmt.ext.toUpperCase() : 'Audio'))}</span>
      `;

      chip.addEventListener('click', () => {
        container.querySelectorAll('.saveo-quality-chip').forEach(c => c.classList.remove('selected'));
        chip.classList.add('selected');
        const sizeEl = document.getElementById('saveo-estimated-size');
        if (sizeEl) sizeEl.textContent = fmt.filesize_str || '~3.5 MB';
        onSelect(fmt);
      });

      container.appendChild(chip);
    });
  },

  // Render subtitle search results with a one-click clip action.
  renderTranscriptResults(results, onClip) {
    const container = document.getElementById('transcript-results');
    if (!container) return;

    container.innerHTML = '';
    if (!results || results.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'transcript-empty';
      empty.textContent = 'No subtitle matches. Download subtitles first, or try another phrase.';
      container.appendChild(empty);
      return;
    }

    results.forEach((result) => {
      const row = document.createElement('div');
      row.className = 'transcript-result';

      const time = document.createElement('span');
      time.className = 'transcript-time';
      time.textContent = this.formatSeconds(result.start);

      const info = document.createElement('div');
      info.className = 'transcript-info';
      const title = document.createElement('div');
      title.className = 'transcript-title';
      title.textContent = result.title || 'Downloaded media';
      const snippet = document.createElement('div');
      snippet.className = 'transcript-snippet';
      snippet.textContent = result.text || '';
      info.appendChild(title);
      info.appendChild(snippet);

      const clipBtn = document.createElement('button');
      clipBtn.type = 'button';
      clipBtn.className = 'secondary-btn btn-sm';
      clipBtn.textContent = 'Clip';
      clipBtn.title = 'Download this moment as a clip';
      clipBtn.addEventListener('click', () => onClip(result));

      row.appendChild(time);
      row.appendChild(info);
      row.appendChild(clipBtn);
      container.appendChild(row);
    });
  },

  // Render chapter list for one-shot clip downloads.
  renderChapters(chapters, onSelect) {
    const wrap = document.getElementById('chapters-wrap');
    const list = document.getElementById('chapters-list');
    const selectedRow = document.getElementById('selected-clip-row');
    const selectedLabel = document.getElementById('selected-clip-label');
    const clearBtn = document.getElementById('btn-clear-clip');
    if (!wrap || !list) return;

    list.innerHTML = '';
    if (selectedRow) selectedRow.style.display = 'none';
    if (selectedLabel) selectedLabel.textContent = '';

    const clearSelection = () => {
      list.querySelectorAll('.chapter-row').forEach(row => row.classList.remove('selected'));
      if (selectedRow) selectedRow.style.display = 'none';
      if (selectedLabel) selectedLabel.textContent = '';
      onSelect(null);
    };
    if (clearBtn) clearBtn.onclick = clearSelection;

    if (!chapters || chapters.length === 0) {
      wrap.style.display = 'none';
      return;
    }

    wrap.style.display = 'block';
    chapters.forEach((chapter, index) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'chapter-row';

      const title = document.createElement('span');
      title.textContent = chapter.title || `Chapter ${index + 1}`;
      const time = document.createElement('span');
      time.className = 'chapter-time';
      const endLabel = chapter.end_time != null ? this.formatSeconds(chapter.end_time) : 'end';
      time.textContent = `${this.formatSeconds(chapter.start_time)}–${endLabel}`;

      row.appendChild(title);
      row.appendChild(time);
      row.addEventListener('click', () => {
        list.querySelectorAll('.chapter-row').forEach(r => r.classList.remove('selected'));
        row.classList.add('selected');
        if (selectedRow) selectedRow.style.display = 'flex';
        if (selectedLabel) selectedLabel.textContent = `${title.textContent} (${time.textContent})`;
        onSelect({ ...chapter, title: title.textContent });
      });
      list.appendChild(row);
    });
  },

  // Render exact source streams for advanced users.
  renderAdvancedFormats(formats, onSelect) {
    const wrap = document.getElementById('advanced-formats-wrap');
    const list = document.getElementById('advanced-formats-list');
    const count = document.getElementById('advanced-format-count');
    if (!wrap || !list) return;

    list.innerHTML = '';
    if (!formats || formats.length === 0) {
      if (count) count.textContent = '0';
      wrap.style.display = 'none';
      return;
    }

    if (count) count.textContent = formats.length;
    wrap.style.display = 'block';

    formats.forEach((fmt) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'advanced-format-row';
      row.setAttribute('data-fid', fmt.format_id);

      const label = document.createElement('span');
      label.textContent = fmt.label || fmt.format_id;
      const size = document.createElement('span');
      size.className = 'af-size';
      size.textContent = `${fmt.has_audio ? 'muxed' : 'video only'}${fmt.filesize_str ? ` • ${fmt.filesize_str}` : ''}`;

      row.appendChild(label);
      row.appendChild(size);
      row.addEventListener('click', () => {
        list.querySelectorAll('.advanced-format-row').forEach(r => r.classList.remove('selected'));
        row.classList.add('selected');
        document.querySelectorAll('#video-formats-grid .saveo-quality-chip').forEach(c => c.classList.remove('selected'));
        const sizeEl = document.getElementById('saveo-estimated-size');
        if (sizeEl) sizeEl.textContent = fmt.filesize_str || 'Adaptive';
        onSelect({ ...fmt, advanced: true });
      });
      list.appendChild(row);
    });
  },

  formatBytes(bytes) {
    if (!bytes || bytes <= 0) return '0 MB';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    let b = parseFloat(bytes);
    while (b >= 1024 && i < units.length - 1) {
      b /= 1024;
      i++;
    }
    return `${b.toFixed(1)} ${units[i]}`;
  },

  formatSeconds(s) {
    if (!s || s <= 0) return '00:00';
    const sec = parseInt(s, 10);
    const m = Math.floor(sec / 60);
    const remS = sec % 60;
    const h = Math.floor(m / 60);
    const remM = m % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return h > 0 ? `${pad(h)}:${pad(remM)}:${pad(remS)}` : `${pad(remM)}:${pad(remS)}`;
  },

  // Render Queue / Recent Download Card (Saveo Modern Style)
  renderQueueItem(task) {
    const card = document.createElement('div');
    card.id = `q-task-${task.id}`;

    if (task.status === 'completed') {
      card.className = 'saveo-recent-card';
      const isAudio = Boolean(task.is_audio);
      const tagType = isAudio ? 'AUDIO' : 'VIDEO';
      const tagText = isAudio ? 'Music • Tap to play' : 'Movies • Tap to watch';
      const safePath = this.escapeAttr(task.file_path || '');
      const safeId = this.escapeAttr(task.id || '');
      const safeTitleAttr = this.escapeAttr(task.title || 'Downloaded Media');
      const safeTitle = this.escapeHtml(task.title || 'Downloaded Media');

      card.innerHTML = `
        <button class="saveo-play-badge" data-action="open-file" data-path="${safePath}" data-id="${safeId}" title="Tap to play">
          <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"></polygon></svg>
        </button>
        <div class="saveo-recent-info" data-action="open-file" data-path="${safePath}" data-id="${safeId}">
          <div class="saveo-recent-title" title="${safeTitleAttr}">${safeTitle}</div>
          <div class="saveo-recent-sub">
            <span class="saveo-tag-pill ${isAudio ? 'audio' : 'video'}">${tagType}</span>
            <span class="saveo-tag-text">${tagText}</span>
          </div>
        </div>
        <div class="saveo-recent-actions">
          <button class="btn-saveo-open" data-action="open-file" data-path="${safePath}" data-id="${safeId}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
            <span>Open</span>
          </button>
          <button class="icon-btn-trash" data-action="remove" data-id="${safeId}" title="Remove">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      `;
      return card;
    }

    // Active downloading or pending / failed card
    card.className = 'queue-item-card';
    let thumbSrc = task.thumbnail || '';
    if (thumbSrc.startsWith('//')) thumbSrc = 'https:' + thumbSrc;
    if (thumbSrc.includes('hdslb.com') || thumbSrc.includes('bilibili.com')) {
      thumbSrc = `/api/proxy/thumbnail?url=${encodeURIComponent(thumbSrc)}`;
    }
    const platformIcon = this.getPlatformIcon(task.platform);
    const safeTitle = this.escapeHtml(task.title || 'Media');
    const safeTitleAttr = this.escapeAttr(task.title || 'Media');
    const safePlatform = this.escapeHtml(task.platform || 'Media');
    const safeThumb = this.escapeAttr(thumbSrc);
    const safeError = this.escapeHtml(task.error_friendly || '');

    let statusClass = task.status || 'queued';
    let statusLabel = task.status || 'Queued';
    if (task.status === 'processing') statusLabel = task.is_audio ? 'Encoding' : 'Finishing up...';
    if (task.status === 'downloading') statusLabel = 'Downloading';
    if (task.status === 'cancelled') statusLabel = 'Cancelled';
    if (task.status === 'failed') statusLabel = 'Failed';

    const actionButtons = this._getQueueItemActions(task);
    const metaRowContent = this._getQueueItemMeta(task);

    card.innerHTML = `
      <div style="position: relative;">
        ${thumbSrc ? `<img class="queue-item-thumb" referrerpolicy="no-referrer" src="${safeThumb}" alt="thumb" />` : `<div class="queue-item-thumb" style="display:flex;align-items:center;justify-content:center;font-size:22px;">${platformIcon}</div>`}
      </div>
      <div class="queue-item-info">
        <div class="queue-item-title-row">
          <span class="queue-item-title" title="${safeTitleAttr}">${safeTitle}</span>
          <span class="queue-item-platform">${safePlatform}</span>
          <span class="status-tag ${statusClass}">${statusLabel}</span>
        </div>
        <div class="queue-item-progress-track">
          <div class="queue-item-progress-fill" style="width: ${task.percent || 0}%;"></div>
        </div>
        <div class="queue-item-meta-row">
          ${metaRowContent}
        </div>
        ${task.error_friendly ? `<div class="queue-item-error-msg">${safeError}</div>` : ''}
      </div>
      <div class="queue-item-actions" data-action-key="${this._actionKey(task)}">
        ${actionButtons}
      </div>
    `;

    const thumbEl = card.querySelector('img.queue-item-thumb');
    if (thumbEl) {
      thumbEl.addEventListener('error', () => {
        if (thumbSrc && !thumbEl.src.includes('/api/proxy/thumbnail')) {
          thumbEl.src = `/api/proxy/thumbnail?url=${encodeURIComponent(thumbSrc)}`;
        } else {
          thumbEl.style.display = 'none';
        }
      });
    }

    return card;
  },

  // Identifies which set of action buttons a status needs. Rebuilding the
  // buttons on every progress tick destroys them mid-click, so the DOM is
  // only touched when this key changes.
  _actionKey(task) {
    if (task.status === 'downloading' || task.status === 'processing') return 'active';
    if (task.status === 'paused') return 'paused';
    if (task.status === 'failed' || task.status === 'cancelled') return 'retry';
    if (task.status === 'completed') return 'completed';
    return 'queued';
  },

  _getQueueItemActions(task) {
    if (task.status === 'downloading' || task.status === 'processing') {
      return `
        <button class="icon-btn-pause" data-action="pause" data-id="${this.escapeAttr(task.id)}" title="Pause">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="6" y="4" width="4" height="16" rx="1"></rect><rect x="14" y="4" width="4" height="16" rx="1"></rect></svg>
        </button>
        <button class="icon-btn-cancel" data-action="cancel" data-id="${this.escapeAttr(task.id)}" title="Cancel">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      `;
    } else if (task.status === 'paused') {
      return `
        <button class="secondary-btn btn-sm" data-action="resume" data-id="${this.escapeAttr(task.id)}" title="Resume">
          <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
          <span>Resume</span>
        </button>
        <button class="icon-btn" data-action="remove" data-id="${this.escapeAttr(task.id)}" title="Remove">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      `;
    } else if (task.status === 'failed' || task.status === 'cancelled') {
      return `
        <button class="secondary-btn btn-sm" data-action="retry" data-id="${this.escapeAttr(task.id)}" title="Retry">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 4v6h6"></path><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>
          <span>Retry</span>
        </button>
        <button class="icon-btn" data-action="remove" data-id="${this.escapeAttr(task.id)}" title="Remove">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      `;
    } else if (task.status === 'completed') {
      const safePath = this.escapeAttr(task.file_path || '');
      const safeId = this.escapeAttr(task.id || '');
      return `
        <button class="btn-saveo-open" data-action="open-file" data-path="${safePath}" data-id="${safeId}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
          <span>Open</span>
        </button>
        <button class="icon-btn-trash" data-action="remove" data-id="${safeId}" title="Remove">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      `;
    } else {
      return `
        <button class="icon-btn" data-action="remove" data-id="${this.escapeAttr(task.id)}" title="Remove">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      `;
    }
  },

  _getQueueItemMeta(task) {
    const safeFormat = this.escapeHtml(task.format_label || '');
    const safeSpeed = this.escapeHtml(task.speed_str || '-- KB/s');
    const safeDownloaded = this.escapeHtml(task.downloaded_str || '0 B');
    const safeTotal = this.escapeHtml(task.total_str || '0 B');
    const safeEta = this.escapeHtml(task.eta_str || '--:--');
    const safeExpected = this.escapeHtml((task.expected_size_str || '').split('•')[0].trim());
    const safeSize = this.escapeHtml(task.file_size_str || task.total_str || '');

    if (task.status === 'paused') {
      return `
        <span class="meta-warn">Download Paused (${task.percent ? task.percent.toFixed(1) : '0.0'}%)</span>
        <span class="meta-format">${safeFormat}</span>
      `;
    }
    if (task.status === 'cancelled') {
      return `
        <span class="meta-warn">Download Cancelled</span>
        <span class="meta-format">${safeFormat}</span>
      `;
    }
    if (task.status === 'failed') {
      return `
        <span class="meta-bad">Download Failed</span>
        <span class="meta-format">${safeFormat}</span>
      `;
    }
    if (task.status === 'completed') {
      return `
        <span class="meta-good">Completed (100%)</span>
        <span>${safeSize}</span>
        <span class="meta-format">${safeFormat}</span>
      `;
    }
    if (task.status === 'processing') {
      const isAudio = Boolean(task.is_audio);
      const audioFmt = this.escapeHtml((task.audio_format || 'audio').toUpperCase());
      const encLabel = isAudio ? `Encoding ${audioFmt}` : 'Finishing up...';
      const targetStr = safeExpected ? ` (~${safeExpected})` : '';
      return `
        <span class="meta-info">${encLabel}${targetStr}</span>
        <span>${safeEta}</span>
        <span class="meta-format">${safeFormat}</span>
      `;
    }
    const isAudio = Boolean(task.is_audio);
    const audioFmt = this.escapeHtml((task.audio_format || 'audio').toUpperCase());
    const targetHint = (isAudio && safeExpected && ['MP3', 'WAV'].includes((task.audio_format || '').toUpperCase()))
      ? ` • Target: ~${safeExpected}`
      : '';
    return `
      <span>${task.percent ? task.percent.toFixed(1) : '0.0'}%</span>
      <span>${safeSpeed}</span>
      <span>${safeDownloaded} / ${safeTotal}${targetHint}</span>
      <span>ETA: ${safeEta}</span>
      <span class="meta-format">${safeFormat}</span>
    `;
  },

  // Update existing Queue Item DOM
  updateQueueItem(task) {
    const el = document.getElementById(`q-task-${task.id}`);
    if (!el) return false;

    // If transitioned to completed, replace with Saveo completed card!
    if (task.status === 'completed' && !el.classList.contains('saveo-recent-card')) {
      const newCard = this.renderQueueItem(task);
      el.replaceWith(newCard);
      return true;
    }

    const fill = el.querySelector('.queue-item-progress-fill');
    if (fill) fill.style.width = `${task.percent || 0}%`;

    const statusTag = el.querySelector('.status-tag');
    if (statusTag) {
      statusTag.className = `status-tag ${task.status}`;
      let label = task.status;
      if (task.status === 'processing') label = 'Finishing up...';
      if (task.status === 'downloading') label = 'Downloading';
      if (task.status === 'cancelled') label = 'Cancelled';
      if (task.status === 'failed') label = 'Failed';
      statusTag.textContent = label;
    }

    const metaRow = el.querySelector('.queue-item-meta-row');
    if (metaRow) {
      const metaHtml = this._getQueueItemMeta(task);
      if (metaRow.innerHTML !== metaHtml) metaRow.innerHTML = metaHtml;
    }

    const actionsEl = el.querySelector('.queue-item-actions');
    if (actionsEl) {
      const actionKey = this._actionKey(task);
      if (actionsEl.dataset.actionKey !== actionKey) {
        actionsEl.innerHTML = this._getQueueItemActions(task);
        actionsEl.dataset.actionKey = actionKey;
      }
    }

    let errEl = el.querySelector('.queue-item-error-msg');
    if (task.error_friendly) {
      if (!errEl) {
        errEl = document.createElement('div');
        errEl.className = 'queue-item-error-msg';
        
        const info = el.querySelector('.queue-item-info');
        if (info) info.appendChild(errEl);
      }
      errEl.textContent = task.error_friendly;
    } else if (errEl) {
      errEl.remove();
    }

    return true;
  },

  // Render History Item Card (Clean & Responsive)
  renderHistoryItem(item) {
    const card = document.createElement('div');
    card.className = 'history-card';
    card.id = `hist-item-${item.id || 'entry'}`;

    const platform = (item.platform && item.platform !== 'undefined') ? String(item.platform) : 'YouTube';
    let thumbSrc = item.thumbnail ? String(item.thumbnail) : '';
    if (thumbSrc.startsWith('//')) thumbSrc = 'https:' + thumbSrc;
    if (thumbSrc.includes('hdslb.com') || thumbSrc.includes('bilibili.com')) {
      thumbSrc = `/api/proxy/thumbnail?url=${encodeURIComponent(thumbSrc)}`;
    }
    const fmtStr = String(item.format_label || '');
    const isAudio = Boolean(item.is_audio || fmtStr.toLowerCase().includes('audio'));
    const formatLabel = (fmtStr && fmtStr !== 'undefined') ? fmtStr : (isAudio ? 'Audio' : 'Video');
    const sizeStr = item.file_size_str || (item.file_size ? this.formatBytes(item.file_size) : (item.downloaded_bytes ? this.formatBytes(item.downloaded_bytes) : ''));
    const title = String(item.filename || item.title || 'Downloaded Media');
    const mediaTitle = item.title ? String(item.title) : title;
    const filePath = item.file_path ? String(item.file_path) : '';
    const itemId = String(item.id || '');
    const sourceUrl = item.url ? String(item.url) : '';
    const formatId = item.format_id ? String(item.format_id) : (isAudio ? 'bestaudio' : 'best');
    const audioFormat = item.audio_format ? String(item.audio_format) : 'mp3';
    const originalThumb = item.thumbnail ? String(item.thumbnail) : '';
    const canDeleteFile = typeof window === 'undefined' || typeof window.SaveoAndroid === 'undefined';
    const icon = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2.5" y="5" width="19" height="14" rx="2"></rect><path d="M2.5 9h19"></path></svg>';

    const safeThumb = this.escapeAttr(thumbSrc);
    const safeTitle = this.escapeHtml(title);
    const safeTitleAttr = this.escapeAttr(title);
    const safePlatform = this.escapeHtml(platform);
    const safeFormat = this.escapeHtml(formatLabel);
    const safeSize = this.escapeHtml(sizeStr);
    const safeDate = this.escapeHtml(item.created_at_str || '');
    const safePath = this.escapeAttr(filePath);
    const safeId = this.escapeAttr(itemId);
    const safeUrl = this.escapeAttr(sourceUrl);
    const safeFormatId = this.escapeAttr(formatId);
    const safeAudioFormat = this.escapeAttr(audioFormat);

    card.innerHTML = `
      <div class="history-thumb-box">
        ${thumbSrc ? `<img class="history-thumb" referrerpolicy="no-referrer" src="${safeThumb}" alt="thumb" /><div class="history-thumb-fallback" style="display:none;">${icon}</div>` : `<div class="history-thumb-fallback">${icon}</div>`}
      </div>
      <div class="history-info">
        <div class="history-filename" title="${safeTitleAttr}">${safeTitle}</div>
        <div class="history-meta-sub">
          <span class="history-platform-badge">${safePlatform}</span>
          <span class="saveo-tag-pill ${isAudio ? 'audio' : 'video'}">${isAudio ? 'AUDIO' : 'VIDEO'}</span>
          ${sizeStr ? `<span>${safeSize}</span>` : ''}
          ${formatLabel ? `<span class="history-format-pill">${safeFormat}</span>` : ''}
          ${safeDate ? `<span>${safeDate}</span>` : ''}
        </div>
      </div>
      <div class="history-actions">
        ${filePath ? `
          <button class="btn-saveo-open" data-action="open-file" data-path="${safePath}" data-id="${safeId}" title="Open with compatible app">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
            <span>Open</span>
          </button>
        ` : ''}
        ${sourceUrl ? `
          <button class="icon-btn" data-action="redownload" data-url="${safeUrl}" data-format="${safeFormatId}" data-format-label="${safeFormat}" data-audio="${isAudio ? '1' : '0'}" data-audio-format="${safeAudioFormat}" data-title="${this.escapeAttr(mediaTitle)}" data-thumb="${this.escapeAttr(originalThumb)}" data-start="${item.start_time != null ? this.escapeAttr(item.start_time) : ''}" data-end="${item.end_time != null ? this.escapeAttr(item.end_time) : ''}" title="Download again">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"></path><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
          </button>
        ` : ''}
        ${canDeleteFile && filePath ? `
          <button class="icon-btn-trash" data-action="delete-file" data-id="${safeId}" title="Delete file from disk">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        ` : ''}
        ${canDeleteFile && filePath ? `
          <button class="icon-btn" data-action="verify" data-id="${safeId}" title="Verify file integrity">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><polyline points="9 12 11 14 15 10"></polyline></svg>
          </button>
        ` : ''}
        <button class="icon-btn" data-action="delete-hist" data-id="${safeId}" title="Remove record from history">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
    `;

    const imgEl = card.querySelector('img.history-thumb');
    if (imgEl) {
      imgEl.addEventListener('error', () => {
        if (originalThumb && !imgEl.src.includes('/api/proxy/thumbnail')) {
          imgEl.src = `/api/proxy/thumbnail?url=${encodeURIComponent(originalThumb)}`;
        } else {
          imgEl.style.display = 'none';
          const fallback = card.querySelector('.history-thumb-fallback');
          if (fallback) fallback.style.display = 'flex';
        }
      });
    }

    return card;
  },

  // Render Saveo Playlist Card with Quality Selection & Full Video List
  renderPlaylistCard(data, onDownloadSelected) {
    const card = document.createElement('div');
    card.className = 'saveo-playlist-card';

    const entries = data.playlist_entries || [];
    const count = data.playlist_count || entries.length;
    let thumb = data.thumbnail || (entries[0] && entries[0].thumbnail) || '';
    if (thumb.startsWith('//')) thumb = `https:${thumb}`;
    if (thumb.includes('hdslb.com') || thumb.includes('bilibili.com')) {
      thumb = `/api/proxy/thumbnail?url=${encodeURIComponent(thumb)}`;
    }
    const safeThumb = this.escapeAttr(thumb);
    const safeTitle = this.escapeHtml(data.title || 'Playlist');
    const safeTitleAttr = this.escapeAttr(data.title || 'Playlist');
    const safeUploader = this.escapeHtml(data.uploader || 'Creator');
    const safeDuration = this.escapeHtml(data.duration_str || 'Various');

    // Selection set of video indices
    const selectedIndices = new Set(entries.map((_, i) => i));

    // Quality state for entire playlist
    let selectedQuality = 'best'; // '1080p', '720p', '480p', 'best', 'audio_mp3', 'audio_m4a'
    let isAudio = false;
    let audioFormat = 'mp3';
    let reverseOrder = false;
    let lastClickedIdx = null;

    // Size estimation helper based on duration and quality bitrate
    const getEntrySize = (durSec) => {
      const dur = durSec && durSec > 0 ? durSec : 210; // default 3.5 min
      let bytesPerSec = 0;
      if (selectedQuality === 'audio_mp3') {
        bytesPerSec = (320 * 1024) / 8; // 320 kbps
      } else if (selectedQuality === 'audio_m4a') {
        bytesPerSec = (192 * 1024) / 8; // 192 kbps
      } else if (selectedQuality === '2160p') {
        bytesPerSec = (8000 * 1024) / 8; // ~8.0 Mbps 4K UHD
      } else if (selectedQuality === '1440p') {
        bytesPerSec = (5500 * 1024) / 8; // ~5.5 Mbps 2K QHD
      } else if (selectedQuality === '1080p') {
        bytesPerSec = (3500 * 1024) / 8; // ~3.5 Mbps FHD
      } else if (selectedQuality === '720p') {
        bytesPerSec = (1900 * 1024) / 8; // ~1.9 Mbps HD
      } else if (selectedQuality === '480p') {
        bytesPerSec = (900 * 1024) / 8;  // ~900 kbps SD
      } else {
        // best: Adaptive highest available quality, always >= 1080p
        bytesPerSec = (5500 * 1024) / 8; // ~5.5 Mbps
      }
      return dur * bytesPerSec;
    };

    const calcTotalEstimatedSize = () => {
      let total = 0;
      entries.forEach((e, i) => {
        if (selectedIndices.has(i)) {
          total += getEntrySize(e.duration);
        }
      });
      return Components.formatBytes(total);
    };

    // Render items HTML
    const renderVideoRows = () => {
      return entries.map((item, idx) => {
        const isChecked = selectedIndices.has(idx);
        const itemSizeStr = Components.formatBytes(getEntrySize(item.duration));
        const safeItemTitle = Components.escapeHtml(item.title || '');
        const safeItemTitleAttr = Components.escapeAttr(item.title || '');
        const safeItemDuration = Components.escapeHtml(item.duration_str || '00:00');
        return `
          <div class="playlist-video-row ${isChecked ? 'selected' : ''}" data-idx="${idx}">
            <input type="checkbox" class="playlist-chk custom-checkbox" data-idx="${idx}" ${isChecked ? 'checked' : ''} />
            <span class="playlist-item-idx">#${idx + 1}</span>
            <div class="playlist-item-info">
              <span class="playlist-item-title" title="${safeItemTitleAttr}">${safeItemTitle}</span>
              <div class="playlist-item-meta">
                <span>${safeItemDuration}</span>
                <span class="dot">•</span>
                <span class="playlist-item-size">${itemSizeStr}</span>
              </div>
            </div>
          </div>
        `;
      }).join('');
    };

    card.innerHTML = `
      <!-- TOP PLAYLIST HEADER -->
      <div class="saveo-playlist-header">
        ${thumb ? `<img src="${safeThumb}" referrerpolicy="no-referrer" alt="thumb" class="saveo-playlist-thumb" />` : `<div class="saveo-playlist-thumb placeholder">PL</div>`}
        <div class="saveo-playlist-info">
          <div class="saveo-playlist-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            <span>Playlist • ${count} Videos</span>
          </div>
          <h3 class="saveo-playlist-title" title="${safeTitleAttr}">${safeTitle}</h3>
          <div class="saveo-playlist-author">Curated by <span>${safeUploader}</span> • Total duration: ${safeDuration}</div>
        </div>
      </div>

      <!-- PLAYLIST QUALITY SELECTOR (Applied to all videos at once!) -->
      <div class="saveo-playlist-quality-wrap">
        <label class="saveo-sublabel">Select Download Quality:</label>
        <div class="saveo-quality-chips-grid">
          <button class="saveo-q-chip" data-quality="2160p">
            <span class="q-label">4K UHD</span>
            <span class="q-est">~2160p</span>
          </button>
          <button class="saveo-q-chip" data-quality="1440p">
            <span class="q-label">2K QHD</span>
            <span class="q-est">~1440p</span>
          </button>
          <button class="saveo-q-chip" data-quality="1080p">
            <span class="q-label">Full HD 1080p</span>
            <span class="q-est">~FHD</span>
          </button>
          <button class="saveo-q-chip" data-quality="720p">
            <span class="q-label">HD 720p</span>
            <span class="q-est">~Standard</span>
          </button>
          <button class="saveo-q-chip" data-quality="480p">
            <span class="q-label">Standard 480p</span>
            <span class="q-est">~SD</span>
          </button>
          <button class="saveo-q-chip active" data-quality="best">
            <span class="q-label">Best Auto</span>
            <span class="q-est">~Top Quality</span>
          </button>
          <button class="saveo-q-chip" data-quality="audio_mp3">
            <span class="q-label">Audio Only (MP3)</span>
            <span class="q-est">~320k</span>
          </button>
          <button class="saveo-q-chip" data-quality="audio_m4a">
            <span class="q-label">Audio Only (M4A)</span>
            <span class="q-est">~HQ AAC</span>
          </button>
        </div>

        <!-- ESTIMATED SIZE BANNER -->
        <div class="saveo-size-banner">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
          <span>Estimated Download Size: <strong id="playlist-est-size">${calcTotalEstimatedSize()}</strong></span>
        </div>
      </div>

      <!-- FILTER + SELECTION CONTROLS -->
      <div class="playlist-filter-wrap">
        <input type="search" class="text-input" id="playlist-filter-input" placeholder="Filter videos by title..." title="Filter videos; Select All applies to visible rows" autocomplete="off" />
      </div>

      <div class="saveo-selection-bar">
        <div class="saveo-selection-count">
          <span id="playlist-selected-count">${selectedIndices.size}</span> of ${count} videos selected
        </div>
        <div class="saveo-selection-btns">
          <button class="text-action-btn" id="btn-reverse-order">Reverse order</button>
          <span class="divider">|</span>
          <button class="text-action-btn" id="btn-select-all">Select All</button>
          <span class="divider">|</span>
          <button class="text-action-btn" id="btn-deselect-all">Deselect All</button>
        </div>
      </div>

      <!-- SCROLLABLE LIST OF ALL PLAYLIST VIDEOS -->
      <div class="saveo-playlist-scrollable" id="playlist-videos-container">
        ${renderVideoRows()}
      </div>

      <!-- PRIMARY DOWNLOAD ACTION -->
      <div class="saveo-playlist-footer">
        <button class="primary-btn btn-download-playlist-now" id="btn-download-playlist-now">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          <span id="btn-download-playlist-text">Download Playlist (${selectedIndices.size} Videos • ${calcTotalEstimatedSize()})</span>
        </button>
      </div>
    `;

    // Refresh UI helper
    const updateSizeAndButton = () => {
      const est = calcTotalEstimatedSize();
      const estSizeEl = card.querySelector('#playlist-est-size');
      if (estSizeEl) estSizeEl.textContent = est;

      const selCountEl = card.querySelector('#playlist-selected-count');
      if (selCountEl) selCountEl.textContent = selectedIndices.size;

      const btnText = card.querySelector('#btn-download-playlist-text');
      if (btnText) {
        btnText.textContent = `Download Playlist (${selectedIndices.size} Videos • ${est})`;
      }

      const dlBtn = card.querySelector('#btn-download-playlist-now');
      if (dlBtn) dlBtn.disabled = selectedIndices.size === 0;

      // Update individual row sizes
      card.querySelectorAll('.playlist-video-row').forEach(row => {
        const idx = parseInt(row.getAttribute('data-idx'), 10);
        const item = entries[idx];
        const sizeEl = row.querySelector('.playlist-item-size');
        if (sizeEl && item) {
          sizeEl.textContent = Components.formatBytes(getEntrySize(item.duration));
        }
      });
    };

    // Quality chip click handlers
    card.querySelectorAll('.saveo-q-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        card.querySelectorAll('.saveo-q-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');

        selectedQuality = chip.getAttribute('data-quality');
        if (selectedQuality.startsWith('audio_')) {
          isAudio = true;
          audioFormat = selectedQuality.replace('audio_', '');
        } else {
          isAudio = false;
          audioFormat = 'mp3';
        }
        updateSizeAndButton();
      });
    });

    // Filter + selection helpers
    const filterInput = card.querySelector('#playlist-filter-input');
    const setRowSelected = (row, selected) => {
      const idx = parseInt(row.getAttribute('data-idx'), 10);
      const chk = row.querySelector('.playlist-chk');
      if (chk) chk.checked = selected;
      row.classList.toggle('selected', selected);
      if (selected) selectedIndices.add(idx);
      else selectedIndices.delete(idx);
    };

    const applyFilter = () => {
      const query = (filterInput ? filterInput.value : '').trim().toLowerCase();
      card.querySelectorAll('.playlist-video-row').forEach(row => {
        const idx = parseInt(row.getAttribute('data-idx'), 10);
        const title = String((entries[idx] && entries[idx].title) || '').toLowerCase();
        row.style.display = (!query || title.includes(query)) ? '' : 'none';
      });
    };

    if (filterInput) filterInput.addEventListener('input', applyFilter);

    // Checkbox and row click handlers (Shift = range select)
    const listContainer = card.querySelector('#playlist-videos-container');
    listContainer.addEventListener('click', (e) => {
      const row = e.target.closest('.playlist-video-row');
      if (!row) return;

      const idx = parseInt(row.getAttribute('data-idx'), 10);
      const willSelect = !selectedIndices.has(idx);

      if (e.shiftKey && lastClickedIdx !== null) {
        e.preventDefault();
        const start = Math.min(lastClickedIdx, idx);
        const end = Math.max(lastClickedIdx, idx);
        card.querySelectorAll('.playlist-video-row').forEach(r => {
          const rIdx = parseInt(r.getAttribute('data-idx'), 10);
          if (rIdx >= start && rIdx <= end) setRowSelected(r, willSelect);
        });
      } else {
        setRowSelected(row, willSelect);
      }

      lastClickedIdx = idx;
      updateSizeAndButton();
    });

    // Select All (only rows matching the current filter)
    card.querySelector('#btn-select-all').addEventListener('click', () => {
      card.querySelectorAll('.playlist-video-row').forEach(row => {
        if (row.style.display !== 'none') setRowSelected(row, true);
      });
      updateSizeAndButton();
    });

    // Deselect All
    card.querySelector('#btn-deselect-all').addEventListener('click', () => {
      card.querySelectorAll('.playlist-video-row').forEach(row => setRowSelected(row, false));
      updateSizeAndButton();
    });

    // Reverse the download order
    const reverseBtn = card.querySelector('#btn-reverse-order');
    if (reverseBtn) {
      reverseBtn.addEventListener('click', () => {
        reverseOrder = !reverseOrder;
        reverseBtn.textContent = reverseOrder ? 'Original order' : 'Reverse order';
      });
    }

    // Download Button Click
    card.querySelector('#btn-download-playlist-now').addEventListener('click', () => {
      if (selectedIndices.size === 0) {
        Components.showToast('Please select at least one video to download.', 'error');
        return;
      }
      const orderedIndices = Array.from(selectedIndices).sort((a, b) => a - b);
      if (reverseOrder) orderedIndices.reverse();
      const selectedEntries = orderedIndices.map(i => entries[i]);
      let formatId = 'best';
      if (selectedQuality === '2160p' || selectedQuality === '4k') formatId = '2160p';
      else if (selectedQuality === '1440p') formatId = '1440p';
      else if (selectedQuality === '1080p') formatId = '1080p';
      else if (selectedQuality === '720p') formatId = '720p';
      else if (selectedQuality === '480p') formatId = '480p';
      else if (isAudio) formatId = 'bestaudio';

      onDownloadSelected(data, selectedEntries, {
        qualityKey: selectedQuality,
        format_id: formatId,
        format_label: isAudio ? `Audio (${audioFormat.toUpperCase()})` : (selectedQuality === 'best' ? 'Best Quality' : selectedQuality.toUpperCase()),
        is_audio: isAudio,
        audio_format: audioFormat
      });
    });

    return card;
  },

  // Render Batch URLs Card (for multiple pasted links)
  renderBatchCard(batchData, onDownloadSelected) {
    const card = document.createElement('div');
    card.className = 'saveo-playlist-card saveo-batch-card';

    const items = batchData.items || [];
    const selectedIndices = new Set(items.map((_, i) => i));
    let selectedQuality = 'best';
    let isAudio = false;
    let audioFormat = 'mp3';

    card.innerHTML = `
      <div class="saveo-playlist-header">
        <div class="saveo-playlist-thumb placeholder">URL</div>
        <div class="saveo-playlist-info">
          <div class="saveo-playlist-badge">
            <span>Multiple Media Links • ${items.length} URLs</span>
          </div>
          <h3 class="saveo-playlist-title">Batch Download Links</h3>
          <div class="saveo-playlist-author">All recognized video and audio URLs will download directly.</div>
        </div>
      </div>

      <div class="saveo-playlist-quality-wrap">
        <label class="saveo-sublabel">Select Download Quality Preset:</label>
        <div class="saveo-quality-chips-grid">
          <button class="saveo-q-chip" data-quality="2160p">
            <span class="q-label">4K 2160p</span>
          </button>
          <button class="saveo-q-chip" data-quality="1440p">
            <span class="q-label">2K 1440p</span>
          </button>
          <button class="saveo-q-chip" data-quality="1080p">
            <span class="q-label">Full HD 1080p</span>
          </button>
          <button class="saveo-q-chip" data-quality="720p">
            <span class="q-label">HD 720p</span>
          </button>
          <button class="saveo-q-chip" data-quality="480p">
            <span class="q-label">Standard 480p</span>
          </button>
          <button class="saveo-q-chip active" data-quality="best">
            <span class="q-label">Best Auto</span>
          </button>
          <button class="saveo-q-chip" data-quality="audio_mp3">
            <span class="q-label">Audio Only (MP3)</span>
          </button>
          <button class="saveo-q-chip" data-quality="audio_m4a">
            <span class="q-label">Audio Only (M4A)</span>
          </button>
        </div>
      </div>

      <div class="saveo-selection-bar">
        <div class="saveo-selection-count">
          <span id="batch-selected-count">${selectedIndices.size}</span> of ${items.length} items selected
        </div>
        <div class="saveo-selection-btns">
          <button class="text-action-btn" id="btn-batch-select-all">Select All</button>
          <span class="divider">|</span>
          <button class="text-action-btn" id="btn-batch-deselect-all">Deselect All</button>
        </div>
      </div>

      <div class="saveo-playlist-scrollable" id="batch-items-container">
        ${items.map((it, idx) => `
          <div class="playlist-video-row selected" data-idx="${idx}">
            <input type="checkbox" class="playlist-chk custom-checkbox" data-idx="${idx}" checked />
            <span class="playlist-item-idx">#${idx + 1}</span>
            <div class="playlist-item-info">
              <span class="playlist-item-title">${Components.escapeHtml(it.title || it.url || '')}</span>
              <div class="playlist-item-meta">
                <span>${Components.escapeHtml(it.platform || 'Media')}</span>
              </div>
            </div>
          </div>
        `).join('')}
      </div>

      <div class="saveo-playlist-footer">
        <button class="primary-btn btn-download-playlist-now" id="btn-download-batch-now">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          <span id="btn-download-batch-text">Download All (${selectedIndices.size} Items)</span>
        </button>
      </div>
    `;

    const updateBatchBtn = () => {
      const selEl = card.querySelector('#batch-selected-count');
      if (selEl) selEl.textContent = selectedIndices.size;
      const textEl = card.querySelector('#btn-download-batch-text');
      if (textEl) textEl.textContent = `Download All (${selectedIndices.size} Items)`;
      const dlBtn = card.querySelector('#btn-download-batch-now');
      if (dlBtn) dlBtn.disabled = selectedIndices.size === 0;
    };

    card.querySelectorAll('.saveo-q-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        card.querySelectorAll('.saveo-q-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        selectedQuality = chip.getAttribute('data-quality');
        isAudio = selectedQuality.startsWith('audio_');
        audioFormat = isAudio ? selectedQuality.replace('audio_', '') : 'mp3';
      });
    });

    const listCont = card.querySelector('#batch-items-container');
    listCont.addEventListener('click', (e) => {
      const row = e.target.closest('.playlist-video-row');
      if (!row) return;
      const idx = parseInt(row.getAttribute('data-idx'), 10);
      const chk = row.querySelector('.playlist-chk');
      if (e.target !== chk) chk.checked = !chk.checked;
      if (chk.checked) {
        selectedIndices.add(idx);
        row.classList.add('selected');
      } else {
        selectedIndices.delete(idx);
        row.classList.remove('selected');
      }
      updateBatchBtn();
    });

    card.querySelector('#btn-batch-select-all').addEventListener('click', () => {
      items.forEach((_, i) => selectedIndices.add(i));
      card.querySelectorAll('.playlist-chk').forEach(c => c.checked = true);
      card.querySelectorAll('.playlist-video-row').forEach(r => r.classList.add('selected'));
      updateBatchBtn();
    });

    card.querySelector('#btn-batch-deselect-all').addEventListener('click', () => {
      selectedIndices.clear();
      card.querySelectorAll('.playlist-chk').forEach(c => c.checked = false);
      card.querySelectorAll('.playlist-video-row').forEach(r => r.classList.remove('selected'));
      updateBatchBtn();
    });

    card.querySelector('#btn-download-batch-now').addEventListener('click', () => {
      if (selectedIndices.size === 0) return;
      const sel = items.filter((_, i) => selectedIndices.has(i));
      let formatId = selectedQuality;
      if (selectedQuality === 'audio_mp3') {
        formatId = 'audio_mp3';
      }
      onDownloadSelected(sel, {
        format_id: formatId,
        format_label: isAudio ? `Audio (${audioFormat.toUpperCase()})` : (selectedQuality === 'best' ? 'Best Auto' : selectedQuality.toUpperCase()),
        is_audio: isAudio,
        audio_format: audioFormat
      });
    });

    return card;
  }
};

