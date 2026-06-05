import { open, save } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile, exists, stat, mkdir } from '@tauri-apps/plugin-fs';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { appDataDir, join } from '@tauri-apps/api/path';
import { useStore } from '../store';
import type { State, Template } from '../store';

const EXTENSION = 'grecipe';
const FILTER_NAME = 'Recipe Designer Project';
const RECENT_PROJECT_PATH_KEY = 'rd-current-project-path';
export const EXTERNAL_CHANGE_EVENT = 'file-external-change';

// 文件操作通过全局事件把反馈交给 Editor 展示，避免服务层直接依赖 UI 组件。
export const FILE_EVENT = 'file-operation';

let currentFilePath: string | null = null;
let lastSavedChangeCounter = 0;
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
let lastExternalMtime: number | null = null;
let externalCheckInterval: ReturnType<typeof setInterval> | null = null;
let isTauriEnv = false;

function detectTauri(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    // Tauri v2 会在 WebView 注入运行时标记，用于区分桌面壳和浏览器开发环境。
    return '__TAURI_INTERNALS__' in window || '__TAURI__' in window;
  } catch {
    return false;
  }
}

function notify(type: 'success' | 'error', key: string, params?: Record<string, any>) {
  window.dispatchEvent(new CustomEvent(FILE_EVENT, { detail: { type, key, params } }));
}

function getDirty(store: ReturnType<typeof useStore>): boolean {
  return store.changeCounter !== lastSavedChangeCounter;
}

function updateTitle(store: ReturnType<typeof useStore>) {
  if (!isTauriEnv) return;
  try {
    const fileName = currentFilePath
      ? currentFilePath.split(/[\\/]/).pop() || 'Untitled'
      : 'Untitled';
    const dirtyMark = getDirty(store) ? ' *' : '';
    getCurrentWindow().setTitle(`${fileName}${dirtyMark} - Recipe Designer`);
  } catch {
    // 非 Tauri 运行时或窗口 API 不可用时跳过标题更新。
  }
}

// --- 版本迁移 ---

const CURRENT_VERSION = 1;

const migrations: Record<number, (data: any) => any> = {
  // 项目结构变更时在这里追加迁移函数，例如把 version 1 的数据提升到 version 2。
};

function migrateData(data: any): State {
  let version = data.version || 1;
  while (version < CURRENT_VERSION) {
    const migration = migrations[version];
    if (migration) {
      data = migration(data);
    }
    version = data.version;
  }
  return data as State;
}

// --- 最近项目路径 ---

function readRecentProjectPath(): string | null {
  try {
    return window.localStorage.getItem(RECENT_PROJECT_PATH_KEY);
  } catch {
    return null;
  }
}

function rememberProjectPath(path: string) {
  try {
    window.localStorage.setItem(RECENT_PROJECT_PATH_KEY, path);
  } catch {
    // localStorage 不可用时只影响刷新恢复，不影响当前项目读写。
  }
}

function clearRecentProjectPath() {
  try {
    window.localStorage.removeItem(RECENT_PROJECT_PATH_KEY);
  } catch {
    // localStorage 不可用时没有可清理的持久状态。
  }
}

// --- 项目载入 ---

function applyProjectState(state: State): ReturnType<typeof useStore> {
  const store = useStore();
  store.seedData({
    nodes: state.nodes || [],
    edges: state.edges || [],
    machines: state.machines || [],
    global_effects: state.global_effects || [],
    proliferators: state.proliferators || [],
    groups: state.groups || [],
    templates: state.templates || [],
  });
  if (state.meta) {
    store.meta = { ...state.meta };
  }
  store.version = state.version || CURRENT_VERSION;
  return store;
}

async function loadProjectFromPath(path: string): Promise<ReturnType<typeof useStore>> {
  const content = await readTextFile(path);
  const raw = JSON.parse(content);
  const state = migrateData(raw);
  return applyProjectState(state);
}

function activateProjectPath(path: string, store: ReturnType<typeof useStore>) {
  currentFilePath = path;
  lastSavedChangeCounter = store.changeCounter;
  rememberProjectPath(path);
  updateTitle(store);
  startExternalMonitoring(path);
}

// --- 文件操作 ---

export async function newProject(): Promise<void> {
  const store = useStore();
  store.seedData({
    nodes: [],
    edges: [],
    machines: [],
    global_effects: [],
    proliferators: [],
    templates: [],
  });
  store.meta.created = new Date().toISOString();
  store.meta.updated = new Date().toISOString();
  store.meta.game = 'New Game';
  store.meta.viewport = { zoom: 1.0, center: { x: 0, y: 0 } };

  currentFilePath = null;
  lastSavedChangeCounter = store.changeCounter;
  lastExternalMtime = null;
  clearRecentProjectPath();
  stopExternalMonitoring();
  updateTitle(store);
  notify('success', 'fileService.newProject');
}

export async function openProject(): Promise<void> {
  if (!isTauriEnv) return;

  try {
    const selected = await open({
      filters: [{ name: FILTER_NAME, extensions: [EXTENSION] }],
      multiple: false,
    });

    if (!selected) return; // 用户取消文件选择时保持当前项目不变。

    const path = typeof selected === 'string' ? selected : (selected as any)?.path;
    if (!path) {
      notify('error', 'fileService.failedOpenPath');
      return;
    }

    const store = await loadProjectFromPath(path);
    activateProjectPath(path, store);
    notify('success', 'fileService.opened', { name: path.split(/[\\/]/).pop() || path });
  } catch (err: any) {
    notify('error', 'fileService.failedOpen', { error: err?.message || String(err) });
    console.error('[file-service] openProject error:', err);
  }
}

export async function saveProject(): Promise<void> {
  if (!currentFilePath) {
    return saveProjectAs();
  }
  await writeProjectFile(currentFilePath);
}

export async function saveProjectAs(): Promise<void> {
  if (!isTauriEnv) return;

  try {
    const selected = await save({
      filters: [{ name: FILTER_NAME, extensions: [EXTENSION] }],
    });

    if (!selected) return; // 用户取消保存路径选择时保持当前项目不变。

    const path = typeof selected === 'string' ? selected : (selected as any)?.path;
    if (!path) {
      notify('error', 'fileService.failedGetSavePath');
      return;
    }

    await writeProjectFile(path);
    const store = useStore();
    currentFilePath = path;
    rememberProjectPath(path);
    updateTitle(store);
    startExternalMonitoring(path);
  } catch (err: any) {
    notify('error', 'fileService.failedSave', { error: err?.message || String(err) });
    console.error('[file-service] saveProjectAs error:', err);
  }
}

async function writeProjectFile(path: string) {
  if (!isTauriEnv) return;

  const store = useStore();

  // 覆写前生成 .bak 备份，使保存失败或误写后仍可从上一版恢复。
  try {
    if (await exists(path)) {
      const content = await readTextFile(path);
      await writeTextFile(path + '.bak', content);
    }
  } catch {
    // 备份失败不阻断主保存流程，避免备份权限问题导致用户无法保存项目。
  }

  store.meta.updated = new Date().toISOString();

  const state: State = {
    version: CURRENT_VERSION,
    meta: store.meta,
    global_effects: store.global_effects,
    proliferators: store.proliferators,
    tag_pool: store.tag_pool,
    machines: store.machines,
    nodes: store.nodes,
    edges: store.edges,
    groups: store.groups,
    templates: store.templates,
  };

  await writeTextFile(path, JSON.stringify(state, null, 2));

  lastSavedChangeCounter = store.changeCounter;
  try {
    const info = await stat(path);
    lastExternalMtime = typeof info.mtime === 'number' ? info.mtime : Date.now();
  } catch {
    lastExternalMtime = Date.now();
  }
  updateTitle(store);
  notify('success', 'fileService.saved', { name: path.split(/[\\/]/).pop() || path });
}

// --- 自动保存 ---

let autoSaveWatchStarted = false;

export function startAutoSave() {
  if (!isTauriEnv || autoSaveWatchStarted) return;
  autoSaveWatchStarted = true;

  const store = useStore();
  let lastCounter = store.changeCounter;

  setInterval(() => {
    if (store.changeCounter !== lastCounter) {
      lastCounter = store.changeCounter;
      scheduleAutoSave();
    }
  }, 500);
}

function scheduleAutoSave() {
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(async () => {
    if (currentFilePath && isTauriEnv) {
      const store = useStore();
      if (store.changeCounter !== lastSavedChangeCounter) {
        await writeProjectFile(currentFilePath);
      }
    }
  }, 2000);
}

// --- 外部变更监控 ---

function startExternalMonitoring(path: string) {
  stopExternalMonitoring();

  stat(path).then(info => {
    lastExternalMtime = typeof info.mtime === 'number' ? info.mtime : Date.now();
  }).catch(() => {
    lastExternalMtime = Date.now();
  });

  externalCheckInterval = setInterval(async () => {
    try {
      const info = await stat(path);
      const mtime = typeof info.mtime === 'number' ? info.mtime : 0;

      if (lastExternalMtime !== null && mtime > lastExternalMtime + 1000) {
        lastExternalMtime = mtime;
        window.dispatchEvent(new CustomEvent(EXTERNAL_CHANGE_EVENT, { detail: { path } }));
      }
    } catch {
      // 文件可能已被外部删除，此处只停止本轮检查并保留当前内存项目。
    }
  }, 3000);
}

function stopExternalMonitoring() {
  if (externalCheckInterval) {
    clearInterval(externalCheckInterval);
    externalCheckInterval = null;
  }
  lastExternalMtime = null;
}

export async function reloadCurrentFile() {
  if (!currentFilePath || !isTauriEnv) return;
  try {
    const store = await loadProjectFromPath(currentFilePath);
    lastSavedChangeCounter = store.changeCounter;
    try {
      const info = await stat(currentFilePath);
      lastExternalMtime = typeof info.mtime === 'number' ? info.mtime : Date.now();
    } catch {
      lastExternalMtime = Date.now();
    }
    updateTitle(store);
    notify('success', 'fileService.reloaded');
  } catch (err: any) {
    notify('error', 'fileService.failedReload', { error: err?.message || String(err) });
  }
}

export async function restoreLastProject(): Promise<boolean> {
  if (!isTauriEnv) return false;
  const path = readRecentProjectPath();
  if (!path) return false;

  try {
    if (!(await exists(path))) {
      clearRecentProjectPath();
      return false;
    }

    const store = await loadProjectFromPath(path);
    activateProjectPath(path, store);
    return true;
  } catch (err: any) {
    clearRecentProjectPath();
    notify('error', 'fileService.failedReload', { error: err?.message || String(err) });
    return false;
  }
}

// --- 初始化 ---

export async function initFileService(): Promise<boolean> {
  isTauriEnv = detectTauri();
  if (!isTauriEnv) {
    console.log('[file-service] Not in Tauri environment, file operations disabled');
    return false;
  }
  const restored = await restoreLastProject();
  startAutoSave();
  return restored;
}

// --- 模板持久化 ---

let templatesPath: string | null = null;

async function getTemplatesPath(): Promise<string> {
  if (!templatesPath) {
    const dir = await appDataDir();
    templatesPath = await join(dir, 'templates.json');
  }
  return templatesPath;
}

export async function loadTemplates(): Promise<Template[]> {
  if (!isTauriEnv) return [];
  try {
    const path = await getTemplatesPath();
    if (await exists(path)) {
      const content = await readTextFile(path);
      return JSON.parse(content) as Template[];
    }
  } catch {
    // 模板文件不存在或无法读取时返回空列表，保持侧边栏可用。
  }
  return [];
}

export async function saveTemplates(templates: Template[]): Promise<void> {
  if (!isTauriEnv) return;
  try {
    const path = await getTemplatesPath();
    const dir = await appDataDir();
    try { await mkdir(dir, { recursive: true }); } catch { /* 模板目录已存在时无需重复创建。 */ }
    await writeTextFile(path, JSON.stringify(templates, null, 2));
  } catch {
    // 模板保存失败不影响主项目编辑流程。
  }
}

export function getCurrentFilePath(): string | null {
  return currentFilePath;
}

export function isDirty(): boolean {
  return getDirty(useStore());
}
