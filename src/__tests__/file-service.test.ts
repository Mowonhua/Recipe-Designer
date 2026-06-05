import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const fsMock = vi.hoisted(() => ({
  files: new Map<string, string>(),
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
  exists: vi.fn(),
  stat: vi.fn(),
  mkdir: vi.fn(),
}));

const windowMock = vi.hoisted(() => ({
  setTitle: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: fsMock.readTextFile,
  writeTextFile: fsMock.writeTextFile,
  exists: fsMock.exists,
  stat: fsMock.stat,
  mkdir: fsMock.mkdir,
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
  save: vi.fn(),
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => windowMock,
}));

vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn(async () => 'D:/AppData/RecipeDesigner'),
  join: vi.fn(async (...parts: string[]) => parts.join('/')),
}));

function createMemoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => data.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      data.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      data.delete(key);
    }),
  };
}

function createProjectJson() {
  return JSON.stringify({
    version: 1,
    meta: {
      created: '2026-01-01T00:00:00.000Z',
      updated: '2026-01-02T00:00:00.000Z',
      game: 'Restored Game',
      viewport: { zoom: 1, center: { x: 10, y: 20 } },
    },
    global_effects: [],
    proliferators: [],
    tag_pool: { recipe_tags: [], machine_tags: [] },
    machines: [],
    nodes: [{
      id: 'iron-ore',
      name: 'Iron Ore',
      tags: [],
      is_raw_material: true,
      slots: [],
      position: { x: 120, y: 80 },
    }],
    edges: [],
    groups: [{
      id: 'raw-group',
      name: 'Raw',
      children: ['iron-ore'],
      collapsed: false,
    }],
    templates: [],
  });
}

describe('file-service project restore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
    setActivePinia(createPinia());
    fsMock.files.clear();
    fsMock.readTextFile.mockReset();
    fsMock.writeTextFile.mockReset();
    fsMock.exists.mockReset();
    fsMock.stat.mockReset();
    fsMock.mkdir.mockReset();
    windowMock.setTitle.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('初始化文件服务时会恢复最近打开的项目路径和项目内容', async () => {
    const path = 'D:/Factory/demo.grecipe';
    const storage = createMemoryStorage();
    storage.setItem('rd-current-project-path', path);
    fsMock.files.set(path, createProjectJson());
    fsMock.exists.mockImplementation(async (target: string) => fsMock.files.has(target));
    fsMock.readTextFile.mockImplementation(async (target: string) => fsMock.files.get(target));
    fsMock.stat.mockResolvedValue({ mtime: Date.now() });
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('window', {
      localStorage: storage,
      dispatchEvent: vi.fn(),
      __TAURI_INTERNALS__: {},
    });

    const { initFileService, getCurrentFilePath } = await import('../services/file-service');
    const { useStore } = await import('../store');

    const restored = await initFileService();
    const store = useStore();

    expect(restored).toBe(true);
    expect(getCurrentFilePath()).toBe(path);
    expect(fsMock.readTextFile).toHaveBeenCalledWith(path);
    expect(store.nodes[0]?.id).toBe('iron-ore');
    expect(store.groups[0]?.id).toBe('raw-group');
    expect(store.meta.game).toBe('Restored Game');
  });

  it('最近项目文件不存在时会清理失效路径并保持空项目', async () => {
    const path = 'D:/Factory/missing.grecipe';
    const storage = createMemoryStorage();
    storage.setItem('rd-current-project-path', path);
    fsMock.exists.mockResolvedValue(false);
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('window', {
      localStorage: storage,
      dispatchEvent: vi.fn(),
      __TAURI_INTERNALS__: {},
    });

    const { initFileService, getCurrentFilePath } = await import('../services/file-service');

    const restored = await initFileService();

    expect(restored).toBe(false);
    expect(getCurrentFilePath()).toBeNull();
    expect(storage.removeItem).toHaveBeenCalledWith('rd-current-project-path');
    expect(fsMock.readTextFile).not.toHaveBeenCalled();
  });
});
