(function () {
    'use strict';

    // ── Translations ────────────────────────────────────
    const translations = {
        'Pending': { en: 'Pending', ko: '대기 중' },
        'Done': { en: 'Done', ko: '완료' },
        'Failed': { en: 'Failed', ko: '실패' },
        'Cancel': { en: 'Cancel', ko: '취소' },
        'Cancel All': { en: 'Cancel All', ko: '전체 취소' },
        'Clear All': { en: 'Clear All', ko: '모두 지우기' },
        'Settings': { en: 'Settings', ko: '설정' },
        'Saved': { en: 'Settings saved.', ko: '설정이 저장되었습니다.' },
        'Converting': { en: 'Converting', ko: '변환 중' },
    };

    let currentLang = 'en';

    function t(key) {
        const entry = translations[key];
        if (!entry) return key;
        return entry[currentLang] || entry['en'] || key;
    }

    function detectLanguage() {
        const saved = localStorage.getItem('mdbox-lang');
        if (saved) return saved;
        const nav = navigator.language || navigator.userLanguage || '';
        if (nav.startsWith('ko')) return 'ko';
        return 'en';
    }

    function applyLanguage(lang) {
        currentLang = lang;
        localStorage.setItem('mdbox-lang', lang);
        // Apply HTML translations via MytoryI18n
        if (window.MytoryI18n) {
            MytoryI18n.setLanguage(lang);
        }
        // Re-render dynamic content
        renderQueue();
        // Update settings modal language
        const langSelect = document.getElementById('settingLang');
        if (langSelect) langSelect.value = lang;
    }

    // ── DOM refs ────────────────────────────────────────
    const dropzone = document.getElementById('dropzone');
    const dropzoneArea = document.getElementById('dropzoneArea');
    const globalDropOverlay = document.getElementById('globalDropOverlay');
    const fileInput = document.getElementById('fileInput');
    const folderInput = document.getElementById('folderInput');
    const selectFilesBtn = document.getElementById('selectFilesBtn');
    const queueList = document.getElementById('queueList');
    const queueEmpty = document.getElementById('queueEmpty');
    const queueCount = document.getElementById('queueCount');
    const settingsModal = document.getElementById('settingsModal');
    const settingsClose = document.getElementById('settingsClose');
    const settingsCancel = document.getElementById('settingsCancel');
    const settingsSave = document.getElementById('settingsSave');
    const toastContainer = document.getElementById('toastContainer');

    // Settings inputs
    const settingOutputMode = document.getElementById('settingOutputMode');
    const settingOutputDir = document.getElementById('settingOutputDir');
    const settingOutputDirBtn = document.getElementById('settingOutputDirBtn');
    const outputDirGroup = document.getElementById('outputDirGroup');
    const settingLlmEndpoint = document.getElementById('settingLlmEndpoint');
    const settingLlmModel = document.getElementById('settingLlmModel');

    // Settings gear (inserted dynamically)
    const gearBtn = document.createElement('button');
    gearBtn.className = 'settings-gear';
    gearBtn.innerHTML = '⚙️';
    gearBtn.title = 'Settings';
    dropzoneArea.parentElement.appendChild(gearBtn);

    // ── State ───────────────────────────────────────────
    let settings = {
        outputMode: 'sidecar',
        outputDir: '',
        clipboardEnabled: false,
        llmEndpoint: '',
        llmModel: '',
    };
    let queue = [];
    let completedItems = [];
    let unsubscribeQueue = null;

    // ── Queue rendering ─────────────────────────────────
    function renderQueue() {
        const items = queueList.querySelectorAll('.queue-item');
        items.forEach(el => el.remove());

        const clearAllBtn = queueList.querySelector('.queue-clear-all');
        if (clearAllBtn) clearAllBtn.remove();

        const headerExtra = document.querySelector('.queue-header__extra');
        if (headerExtra) headerExtra.remove();

        const activeCount = queue.length;
        const completedCount = completedItems.length;
        const hasActive = queue.some(item => item.status === 'converting' || item.status === 'pending');

        // Nothing at all
        if (activeCount === 0 && completedCount === 0) {
            queueEmpty.classList.remove('hidden');
            queueCount.textContent = '0';
            return;
        }

        queueEmpty.classList.add('hidden');
        queueCount.textContent = String(completedCount + activeCount);

        // Cancel all button in header (if there are active items)
        if (hasActive) {
            const extra = document.createElement('span');
            extra.className = 'queue-header__extra';
            extra.innerHTML = '<button class="queue-header__cancel-all">' + t('Cancel All') + '</button>';
            extra.querySelector('.queue-header__cancel-all').addEventListener('click', () => {
                mdboxAPI.cancelAll();
            });
            document.querySelector('.queue-header').appendChild(extra);
        }

        // Active items (pending / converting)
        queue.forEach((item) => {
            const el = createQueueItemEl(item);
            queueList.appendChild(el);
        });

        // Completed items (done / error) — with dismiss button
        completedItems.forEach((item) => {
            const el = createQueueItemEl(item, true);
            queueList.appendChild(el);
        });

        // Clear all button (only when there are completed items)
        if (completedCount > 1) {
            const clearBtn = document.createElement('div');
            clearBtn.className = 'queue-clear-all';
            clearBtn.innerHTML = '<button class="queue-clear-all__btn">✕ ' + t('Clear All') + '</button>';
            clearBtn.querySelector('.queue-clear-all__btn').addEventListener('click', () => {
                completedItems = [];
                renderQueue();
            });
            queueList.appendChild(clearBtn);
        }
    }

    function createQueueItemEl(item, showDismiss = false) {
        const el = document.createElement('div');
        el.className = `queue-item status-${item.status}`;

        // Cancel button on converting items
        if (item.status === 'converting') {
            el.addEventListener('click', (e) => {
                const cancelBtn = e.target.closest('.queue-item__cancel');
                if (cancelBtn) {
                    mdboxAPI.cancelAll();
                }
            });
        }

        let statusIcon = '⏳';
        if (item.status === 'converting') statusIcon = '🔄';
        else if (item.status === 'done') statusIcon = '✅';
        else if (item.status === 'error') statusIcon = '❌';

        const statusText =
            item.status === 'done' ? '✅ ' + t('Done') :
            item.status === 'error' ? '❌ ' + t('Failed') :
            item.status === 'converting' ? '' :
            t('Pending');

        const progressHtml = item.status === 'converting'
            ? `<div class="queue-item__progress-bar"><div class="queue-item__progress-fill" style="width:${item.progress || 10}%"></div></div><button class="queue-item__cancel" title="${t('Cancel')}">⏹</button>`
            : statusText
                ? `<span class="queue-item__progress">${statusText}</span>`
                : '';

        const dismissHtml = showDismiss
            ? `<button class="queue-item__dismiss" data-key="${escapeHtml(item.key || item.fileName)}">&times;</button>`
            : '';

        el.innerHTML = `
            <div class="queue-item__row">
                <span class="queue-item__status-icon">${statusIcon}</span>
                <span class="queue-item__name" title="${escapeHtml(item.fileName)}">${escapeHtml(item.fileName)}</span>
                ${progressHtml}
                ${dismissHtml}
            </div>
            ${item.status === 'error' && item.error ? `<div class="queue-item__error">${escapeHtml(item.error)}</div>` : ''}
        `;

        if (showDismiss) {
            el.querySelector('.queue-item__dismiss').addEventListener('click', () => {
                const key = item.key || item.fileName;
                completedItems = completedItems.filter(ci => (ci.key || ci.fileName) !== key);
                renderQueue();
            });
        }

        return el;
    }

    function updateQueueItemProgress(index, progress) {
        const items = queueList.querySelectorAll('.queue-item');
        if (items[index]) {
            const fill = items[index].querySelector('.queue-item__progress-fill');
            if (fill) fill.style.width = `${progress}%`;
        }
    }

    function addCompletedItem(item) {
        completedItems.push(item);
        renderQueue();
    }

    // ── File handling ───────────────────────────────────
    async function handleFiles(files) {
        const filePaths = [];
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            // Electron extends File with .path property
            // Fallback to webUtils.getPathForFile() for drag/drop
            let path = file.path;
            if (!path) {
                try {
                    path = await mdboxAPI.getPathForFile(file);
                } catch (e) {
                    // ignore
                }
            }
            if (path) {
                filePaths.push(path);
            }
        }

        if (filePaths.length === 0) return;

        const llmConfig = {};
        if (settings.llmEndpoint) llmConfig.endpoint = settings.llmEndpoint;
        if (settings.llmModel) llmConfig.model = settings.llmModel;

        await mdboxAPI.convert({
            filePaths,
            llmConfig: Object.keys(llmConfig).length > 0 ? llmConfig : null,
        });
    }

    async function handleDroppedItems(items) {
        const files = [];
        const dirs = [];

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.webkitGetAsEntry) {
                const entry = item.webkitGetAsEntry();
                if (entry) {
                    if (entry.isDirectory) {
                        dirs.push(entry);
                    } else if (entry.isFile) {
                        const file = item.getAsFile();
                        if (file) files.push(file);
                    }
                }
            } else {
                const file = item.getAsFile();
                if (file) files.push(file);
            }
        }

        // Process directories recursively
        for (const dir of dirs) {
            await readDirRecursive(dir, files);
        }

        if (files.length > 0) {
            await handleFiles(files);
        }
    }

    async function readDirRecursive(entry, files) {
        if (entry.isFile) {
            const file = await new Promise((resolve) => entry.file(resolve));
            files.push(file);
        } else if (entry.isDirectory) {
            const reader = entry.createReader();
            const entries = await new Promise((resolve) => {
                reader.readEntries((results) => resolve(results));
            });
            for (const child of entries) {
                await readDirRecursive(child, files);
            }
        }
    }

    // ── Dropzone events ─────────────────────────────────
    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        document.body.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        document.body.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        document.body.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            handleDroppedItems(e.dataTransfer.items);
        }
    });

    // Global drag events (for overlay)
    document.addEventListener('dragover', (e) => {
        e.preventDefault();
        document.body.classList.add('dragover');
    });

    document.addEventListener('dragleave', (e) => {
        if (!e.relatedTarget || e.relatedTarget === document.body) {
            document.body.classList.remove('dragover');
        }
    });

    document.addEventListener('drop', (e) => {
        e.preventDefault();
        document.body.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            handleDroppedItems(e.dataTransfer.items);
        }
    });

    // Click to select files
    selectFilesBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.click();
    });

    dropzone.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            handleFiles(fileInput.files);
            fileInput.value = '';
        }
    });

    // ── Settings ────────────────────────────────────────
    gearBtn.addEventListener('click', () => openSettings());

    async function openSettings() {
        settings = await mdboxAPI.getSettings();
        const langEl = document.getElementById('settingLang');
        if (langEl) langEl.value = currentLang;
        settingOutputMode.value = settings.outputMode || 'sidecar';
        settingOutputDir.value = settings.outputDir || '';
        settingLlmEndpoint.value = settings.llmEndpoint || '';
        settingLlmModel.value = settings.llmModel || '';
        toggleOutputDirField();
        settingsModal.classList.remove('hidden');
    }

    // Language change handler
    document.addEventListener('change', (e) => {
        if (e.target.id === 'settingLang') {
            applyLanguage(e.target.value);
        }
    });

    function closeSettings() {
        settingsModal.classList.add('hidden');
    }

    settingsClose.addEventListener('click', closeSettings);
    settingsCancel.addEventListener('click', closeSettings);
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) closeSettings();
    });

    settingOutputMode.addEventListener('change', toggleOutputDirField);

    function toggleOutputDirField() {
        const mode = settingOutputMode.value;
        if (mode === 'custom' || mode === 'custom+clipboard') {
            outputDirGroup.classList.remove('hidden');
        } else {
            outputDirGroup.classList.add('hidden');
        }
    }

    settingOutputDirBtn.addEventListener('click', async () => {
        const dir = await mdboxAPI.selectDirectory();
        if (dir) settingOutputDir.value = dir;
    });

    settingsSave.addEventListener('click', async () => {
        const newSettings = {
            outputMode: settingOutputMode.value,
            outputDir: settingOutputDir.value,
            clipboardEnabled: settingOutputMode.value.includes('clipboard'),
            llmEndpoint: settingLlmEndpoint.value,
            llmModel: settingLlmModel.value,
        };
        await mdboxAPI.saveSettings(newSettings);
        settings = newSettings;
        closeSettings();
        showToast(t('Settings'), t('Saved'), 'success');
    });

    // ── Queue events from main ──────────────────────────
    if (mdboxAPI.onQueueEvent) {
        unsubscribeQueue = mdboxAPI.onQueueEvent((data) => {
            if (data.event === 'queue-updated' && data.queue) {
                queue = data.queue;
                renderQueue();
            } else if (data.event === 'item-completed') {
                addCompletedItem({
                    key: data.fileName + Date.now(),
                    fileName: data.fileName,
                    status: 'done',
                    outputPath: data.outputPath,
                });
                // Copy to clipboard if clipboard mode
                if (settings.clipboardEnabled && data.markdown) {
                    navigator.clipboard.writeText(data.markdown).catch(() => {});
                }
            } else if (data.event === 'item-error') {
                addCompletedItem({
                    key: data.fileName + Date.now(),
                    fileName: data.fileName,
                    status: 'error',
                    error: data.error,
                });
            } else if (data.event === 'queue-cleared') {
                queue = [];
                completedItems = [];
                renderQueue();
            } else if (data.event === 'item-progress') {
                updateQueueItemProgress(data.index, data.progress);
            }
        });
    }

    function pathSuffix(p) {
        if (!p) return '알 수 없음';
        const parts = p.split('/').filter(Boolean);
        return parts.slice(-2).join('/');
    }

    // ── Toast ───────────────────────────────────────────
    function showToast(title, message, type = 'success') {
        const el = document.createElement('div');
        el.className = `toast toast--${type}`;
        const icon = type === 'success' ? '✅' : '❌';
        el.innerHTML = `
            <span class="toast__icon">${icon}</span>
            <div class="toast__body">
                <div class="toast__title">${escapeHtml(title)}</div>
                <div class="toast__message">${escapeHtml(message)}</div>
            </div>
            <button class="toast__close">&times;</button>
        `;

        const closeBtn = el.querySelector('.toast__close');
        closeBtn.addEventListener('click', () => {
            el.style.opacity = '0';
            el.style.transition = 'opacity 0.3s';
            setTimeout(() => el.remove(), 300);
        });

        toastContainer.appendChild(el);
    }

    // ── Utils ───────────────────────────────────────────
    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ── Init ────────────────────────────────────────────
    async function init() {
        settings = await mdboxAPI.getSettings();
        const config = await mdboxAPI.getConfig();
        document.title = `Mytory MDBox v${config.version}`;

        // Initialize i18n
        const detectedLang = detectLanguage();
        if (window.MytoryI18n) {
            MytoryI18n.init({
                lang: detectedLang,
                defaultLang: 'en',
                allowHtml: true,
                autoApply: true,
            });
        }
        applyLanguage(detectedLang);
    }

    init();
})();
