const { app, BrowserWindow, ipcMain, clipboard, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// EPIPE 에러 무시
process.stdout.on('error', () => {});
process.stderr.on('error', () => {});

let mainWindow = null;

// ── Python converter 경로 ──────────────────────────────
// ASAR 환경에서 unpacked 바이너리를 찾기 위해 경로 치환
function unpackedPath(p) {
    if (typeof p !== 'string') return p;
    return p.replace('app.asar', 'app.asar.unpacked');
}

function getConverterConfig() {
    const binaryName = process.platform === 'win32' ? 'converter.exe' : 'converter';

    // 1순위: PyInstaller 바이너리 (app.asar.unpacked > __dirname)
    const binaryPath = unpackedPath(path.join(__dirname, 'python', 'dist', binaryName));
    if (fs.existsSync(binaryPath)) {
        return { cmd: binaryPath, args: [] };
    }

    // 2순위: __dirname 그대로 (개발 모드)
    const devBinaryPath = path.join(__dirname, 'python', 'dist', binaryName);
    if (fs.existsSync(devBinaryPath)) {
        return { cmd: devBinaryPath, args: [] };
    }

    // 3순위: .venv의 python3 (개발 모드)
    const venvPython = path.join(__dirname, '.venv', 'bin', 'python3');
    const venvPythonWin = path.join(__dirname, '.venv', 'Scripts', 'python.exe');
    const scriptPath = path.join(__dirname, 'python', 'converter.py');
    if (fs.existsSync(venvPython)) {
        return { cmd: venvPython, args: [scriptPath] };
    }
    if (fs.existsSync(venvPythonWin)) {
        return { cmd: venvPythonWin, args: [scriptPath] };
    }

    // 4순위: 시스템 python3 + unpacked converter.py
    const unpackedScript = unpackedPath(scriptPath);
    if (fs.existsSync(unpackedScript)) {
        return { cmd: 'python3', args: [unpackedScript] };
    }

    // 5순위: 시스템 python3 + converter.py (실패 가능성 있음)
    return { cmd: 'python3', args: [scriptPath] };
}

// ── Conversion via markitdown ──────────────────────────
let _activeConversionProcess = null;

function cancelActiveConversion() {
    if (_activeConversionProcess) {
        try {
            _activeConversionProcess.kill('SIGTERM');
        } catch (e) { /* ignore */ }
        _activeConversionProcess = null;
    }
}

function convertWithMarkitdown(filePath, llmConfig = null) {
    return new Promise((resolve, reject) => {
        const config = getConverterConfig();
        const input = JSON.stringify({ file_path: filePath, llm_config: llmConfig || undefined });

        const proc = spawn(config.cmd, config.args, {
            env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
        });
        _activeConversionProcess = proc;

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data) => { stdout += data.toString(); });
        proc.stderr.on('data', (data) => { stderr += data.toString(); });

        proc.on('close', (code) => {
            _activeConversionProcess = null;
            if (code !== 0) {
                // SIGTERM으로 종료된 경우 (취소)
                if (code === null || proc.signalCode === 'SIGTERM') {
                    reject(new Error('CANCELLED'));
                    return;
                }
                reject(new Error(`Converter exited with code ${code}: ${stderr.slice(-200)}`));
                return;
            }
            try {
                const result = JSON.parse(stdout);
                resolve(result);
            } catch (e) {
                reject(new Error(`Failed to parse converter output: ${e.message}\nstdout: ${stdout.slice(-200)}`));
            }
        });

        proc.on('error', (err) => {
            _activeConversionProcess = null;
            reject(err);
        });
        proc.stdin.write(input);
        proc.stdin.end();
    });
}

// ── Conversion queue ───────────────────────────────────
class ConversionQueue {
    constructor() {
        this.queue = [];
        this.running = false;
        this.listeners = new Set();
        this._activeProcess = null;
        this._cancelled = false;
        this._clipboardEnabled = false;
        this._outputMode = 'sidecar';
        this._outputDir = '';
    }

    onProgress(callback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    _notify(event, data) {
        for (const listener of this.listeners) {
            listener({ event, ...data });
        }
    }

    add(files, llmConfig = null) {
        for (const filePath of files) {
            this.queue.push({ filePath, llmConfig, status: 'pending' });
        }
        this._notify('queue-updated', { queue: this.getQueue() });
        if (!this.running) {
            this._processNext();
        }
    }

    getQueue() {
        return this.queue.map((item, index) => ({
            index,
            filePath: item.filePath,
            fileName: path.basename(item.filePath),
            status: item.status,
            progress: item.progress || 0,
            error: item.error || null,
        }));
    }

    async _processNext() {
        if (this.queue.length === 0) {
            this.running = false;
            this._notify('queue-drained', {});
            return;
        }

        this.running = true;
        const item = this.queue[0];
        item.status = 'converting';
        item.progress = 0;
        this._notify('queue-updated', { queue: this.getQueue() });

        try {
            this._notify('item-progress', {
                index: 0,
                fileName: path.basename(item.filePath),
                progress: 10,
                status: 'converting',
            });

            const result = await convertWithMarkitdown(item.filePath, item.llmConfig);

            this._notify('item-progress', {
                index: 0, progress: 90, status: 'converting',
            });

            if (result.success) {
                // Save .md file
                const mdPath = this._getOutputPath(item.filePath);
                fs.writeFileSync(mdPath, result.markdown, 'utf-8');

                // Copy to clipboard if enabled
                if (this._clipboardEnabled) {
                    try {
                        clipboard.writeText(result.markdown);
                    } catch (e) { /* ignore clipboard errors */ }
                }

                item.status = 'done';
                item.progress = 100;
                item.outputPath = mdPath;
                this._notify('item-completed', {
                    index: 0,
                    fileName: path.basename(item.filePath),
                    outputPath: mdPath,
                    markdown: result.markdown,
                    elapsedMs: result.elapsed_ms,
                });
            } else {
                item.status = 'error';
                item.error = result.error;
                this._notify('item-error', {
                    index: 0,
                    fileName: path.basename(item.filePath),
                    error: result.error,
                });
            }
        } catch (err) {
            if (err.message === 'CANCELLED') {
                // 사용자 취소: 현재 작업만 취소하고 나머지 큐도 비움
                this.queue = [];
                this.running = false;
                this._notify('queue-cleared', {});
                this._notify('queue-updated', { queue: this.getQueue() });
                return;
            }
            item.status = 'error';
            item.error = err.message;
            this._notify('item-error', {
                index: 0,
                fileName: path.basename(item.filePath),
                error: err.message,
            });
            this.queue.shift();
            this._notify('queue-updated', { queue: this.getQueue() });
            this._processNext();
            return;
        }

        this.queue.shift();
        this._notify('queue-updated', { queue: this.getQueue() });
        this._processNext();
    }

    _getOutputPath(inputPath) {
        const ext = path.extname(inputPath);
        const base = path.basename(inputPath, ext);

        if (this._outputMode === 'custom' || this._outputMode === 'custom+clipboard') {
            const dir = this._outputDir || path.dirname(inputPath);
            return path.join(dir, `${base}.md`);
        }

        // sidecar or sidecar+clipboard
        const dir = path.dirname(inputPath);
        return path.join(dir, `${base}.md`);
    }
}

const conversionQueue = new ConversionQueue();

// ── Settings store ─────────────────────────────────────
const settingsPath = path.join(app.getPath('userData'), 'settings.json');

function loadSettings() {
    try {
        if (fs.existsSync(settingsPath)) {
            return JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
        }
    } catch (e) { /* ignore */ }
    return {
        outputMode: 'sidecar',       // sidecar | custom | sidecar+clipboard | custom+clipboard
        outputDir: '',
        clipboardEnabled: false,
        llmEndpoint: '',
        llmModel: '',
    };
}

function saveSettings(settings) {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
}

// ── Window ─────────────────────────────────────────────
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        minWidth: 600,
        minHeight: 400,
        title: 'Mytory MDBox',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
    });

    mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// ── IPC Handlers ───────────────────────────────────────
ipcMain.handle('app:select-directory', async () => {
    const { dialog } = require('electron');
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
});

ipcMain.handle('app:convert', async (event, { filePaths, llmConfig }) => {
    const settings = loadSettings();
    conversionQueue._clipboardEnabled = settings.clipboardEnabled;
    conversionQueue._outputMode = settings.outputMode;
    conversionQueue._outputDir = settings.outputDir;
    conversionQueue.add(filePaths, llmConfig || null);
    return { queued: filePaths.length };
});

ipcMain.handle('app:get-settings', () => {
    return loadSettings();
});

ipcMain.handle('app:save-settings', async (event, settings) => {
    saveSettings(settings);
    return { success: true };
});

ipcMain.handle('app:get-queue', () => {
    return conversionQueue.getQueue();
});

ipcMain.handle('app:cancel-all', () => {
    cancelActiveConversion();
    return { success: true };
});

ipcMain.handle('app:get-config', () => {
    return {
        version: app.getVersion(),
        isDev: !app.isPackaged,
    };
});

// ── App lifecycle ──────────────────────────────────────
app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });

    // Forward queue events to renderer
    conversionQueue.onProgress((data) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('queue:event', data);
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
