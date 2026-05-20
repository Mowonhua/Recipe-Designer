import { open, save } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile, exists, stat, mkdir } from '@tauri-apps/plugin-fs';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { appDataDir, join } from '@tauri-apps/api/path';
import { useStore } from '../store';
import type { State, Template } from '../store';

const EXTENSION = 'grecipe';
const FILTER_NAME = 'Recipe Designer Project';
export const EXTERNAL_CHANGE_EVENT = 'file-external-change';

// Custom events for user feedback (Editor listens to these)
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
    // Tauri v2 injects __TAURI_INTERNALS__ into the webview
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
    // Not in Tauri runtime
  }
}

// --- Version Migration ---

const CURRENT_VERSION = 1;

const migrations: Record<number, (data: any) => any> = {
  // When schema changes, add migration here:
  // 1: (data) => { data.version = 2; ... return data; },
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

// --- File Operations ---

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

    if (!selected) return; // user cancelled

    const path = typeof selected === 'string' ? selected : (selected as any)?.path;
    if (!path) {
      notify('error', 'fileService.failedOpenPath');
      return;
    }

    const content = await readTextFile(path);
    const raw = JSON.parse(content);
    const state = migrateData(raw);

    const store = useStore();
    store.seedData({
      nodes: state.nodes || [],
      edges: state.edges || [],
      machines: state.machines || [],
      global_effects: state.global_effects || [],
      proliferators: state.proliferators || [],
      templates: state.templates || [],
    });
    if (state.meta) {
      store.meta = { ...state.meta };
    }
    store.version = state.version || CURRENT_VERSION;

    currentFilePath = path;
    lastSavedChangeCounter = store.changeCounter;
    updateTitle(store);
    startExternalMonitoring(path);
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

    if (!selected) return; // user cancelled

    const path = typeof selected === 'string' ? selected : (selected as any)?.path;
    if (!path) {
      notify('error', 'fileService.failedGetSavePath');
      return;
    }

    currentFilePath = path;
    await writeProjectFile(path);
    startExternalMonitoring(path);
  } catch (err: any) {
    notify('error', 'fileService.failedSave', { error: err?.message || String(err) });
    console.error('[file-service] saveProjectAs error:', err);
  }
}

async function writeProjectFile(path: string) {
  if (!isTauriEnv) return;

  const store = useStore();

  // .bak backup before overwriting
  try {
    if (await exists(path)) {
      const content = await readTextFile(path);
      await writeTextFile(path + '.bak', content);
    }
  } catch {
    // proceed even if backup fails
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

// --- Auto Save ---

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

// --- External Change Monitoring ---

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
      // file may be deleted, ignore
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
    const content = await readTextFile(currentFilePath);
    const raw = JSON.parse(content);
    const state = migrateData(raw);
    const store = useStore();
    store.seedData({
      nodes: state.nodes || [],
      edges: state.edges || [],
      machines: state.machines || [],
      global_effects: state.global_effects || [],
      proliferators: state.proliferators || [],
      templates: state.templates || [],
    });
    store.meta = { ...state.meta };
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

// --- Init ---

export function initFileService() {
  isTauriEnv = detectTauri();
  if (!isTauriEnv) {
    console.log('[file-service] Not in Tauri environment, file operations disabled');
    return;
  }
  startAutoSave();
}

// --- Template Persistence ---

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
    // No templates yet, return empty
  }
  return [];
}

export async function saveTemplates(templates: Template[]): Promise<void> {
  if (!isTauriEnv) return;
  try {
    const path = await getTemplatesPath();
    const dir = await appDataDir();
    try { await mkdir(dir, { recursive: true }); } catch { /* dir may already exist */ }
    await writeTextFile(path, JSON.stringify(templates, null, 2));
  } catch {
    // Failed to save templates
  }
}

export function getCurrentFilePath(): string | null {
  return currentFilePath;
}

export function isDirty(): boolean {
  return getDirty(useStore());
}
