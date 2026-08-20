import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  net,
  protocol,
  shell,
  type MenuItemConstructorOptions,
} from "electron";
import { initConfig, loadConfig } from "../server/config";
import { DEFAULT_THEME, THEME_CHROME, THEME_IDS, THEME_LABELS, normalizeTheme, type ThemeId } from "../server/theme";
import {
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZE,
  FONT_IDS,
  FONT_LABELS,
  FONT_SIZE_STEPS,
  normalizeFontFamily,
  normalizeFontSize,
  stepFontSize,
  type FontFamilyId,
} from "../server/typography";
import {
  getPost,
  getPosts,
  getRemotePosts,
  getTemplates,
  mediaAbsolutePath,
  newPost,
  publicConfig,
  putPost,
  remoteMediaBytes,
  removePost,
  renamePost,
  updateSettings,
  updateTemplates,
  uploadImage,
} from "../server/service";
import {
  setSshHooks,
  sshConnect,
  sshDisconnect,
  sshExec,
  sshPull,
  sshPush,
  sshStatus,
} from "../server/ssh";
import type { AppConfig, PostFolder, PostOrigin, TemplateSet } from "../server/types";

protocol.registerSchemesAsPrivileged([
  {
    scheme: "hexomd",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

const isMac = process.platform === "darwin";
const isWin = process.platform === "win32";

function resolveAppIcon(): string | undefined {
  const preferred = isWin ? ["icon.ico", "icon.png"] : ["icon.png", "icon.ico"];
  const dirs = [process.resourcesPath, join(__dirname, "../build")];
  for (const dir of dirs) {
    for (const name of preferred) {
      const candidate = join(dir, name);
      if (existsSync(candidate)) return candidate;
    }
  }
  return undefined;
}

let mainWindow: BrowserWindow | null = null;
let dirty = false;
let quitting = false;

function currentTheme(): ThemeId {
  try {
    return normalizeTheme(loadConfig().theme);
  } catch {
    return DEFAULT_THEME;
  }
}

function currentFontFamily(): FontFamilyId {
  try {
    return normalizeFontFamily(loadConfig().fontFamily);
  } catch {
    return DEFAULT_FONT_FAMILY;
  }
}

function currentFontSize(): number {
  try {
    return normalizeFontSize(loadConfig().fontSize);
  } catch {
    return DEFAULT_FONT_SIZE;
  }
}

function applyWindowChrome(theme: ThemeId): void {
  const chrome = THEME_CHROME[theme] || THEME_CHROME[DEFAULT_THEME];
  if (!mainWindow) return;
  mainWindow.setBackgroundColor(chrome.bg);
  if (isWin) {
    try {
      mainWindow.setTitleBarOverlay({
        color: chrome.overlay,
        symbolColor: chrome.symbol,
        height: 56,
      });
    } catch {
      /* overlay may be unavailable */
    }
  }
}

function persistTheme(theme: ThemeId): void {
  const id = normalizeTheme(theme);
  updateSettings({ theme: id });
  applyWindowChrome(id);
  mainWindow?.webContents.send("theme", id);
  createMenu();
}

function persistTypography(patch: { fontFamily?: FontFamilyId; fontSize?: number }): void {
  const next = updateSettings(patch);
  mainWindow?.webContents.send("typography", {
    fontFamily: normalizeFontFamily(next.fontFamily),
    fontSize: normalizeFontSize(next.fontSize),
  });
  createMenu();
}

function sendMenu(action: string) {
  mainWindow?.webContents.send("menu", action);
}

function handle(channel: string, fn: (...args: unknown[]) => unknown) {
  ipcMain.handle(channel, async (_event, ...args: unknown[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : String(error));
    }
  });
}

function createMenu(): void {
  const fileExtra: MenuItemConstructorOptions[] = isMac
    ? []
    : [
        { type: "separator" },
        { label: "设置…", accelerator: "Ctrl+,", click: () => sendMenu("settings") },
        { type: "separator" },
        { role: "quit", label: "退出" },
      ];

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? ([
          {
            label: app.name,
            submenu: [
              { label: "关于 Hexo Markdown", click: () => sendMenu("about") },
              { type: "separator" },
              { label: "设置…", accelerator: "Cmd+,", click: () => sendMenu("settings") },
              { type: "separator" },
              { role: "services" },
              { type: "separator" },
              { role: "hide", label: "隐藏" },
              { role: "hideOthers", label: "隐藏其他" },
              { role: "unhide", label: "全部显示" },
              { type: "separator" },
              { role: "quit", label: "退出" },
            ],
          },
        ] satisfies MenuItemConstructorOptions[])
      : []),
    {
      label: "文件",
      submenu: [
        { label: "新建文章", accelerator: "CmdOrCtrl+N", click: () => sendMenu("new") },
        { label: "保存", accelerator: "CmdOrCtrl+S", click: () => sendMenu("save") },
        { label: "重命名文件…", click: () => sendMenu("rename") },
        ...fileExtra,
      ],
    },
    {
      label: "编辑",
      submenu: [
        { role: "undo", label: "撤销" },
        { role: "redo", label: "重做" },
        { type: "separator" },
        { role: "cut", label: "剪切" },
        { role: "copy", label: "复制" },
        { role: "paste", label: "粘贴" },
        { role: "selectAll", label: "全选" },
      ],
    },
    {
      label: "视图",
      submenu: [
        { role: "reload", label: "重新加载" },
        { role: "forceReload", label: "强制重新加载" },
        { role: "toggleDevTools", label: "开发者工具" },
        { type: "separator" },
        { role: "togglefullscreen", label: "全屏" },
        { type: "separator" },
        { label: "大纲", accelerator: "CmdOrCtrl+Shift+O", click: () => sendMenu("outline") },
        { type: "separator" },
        {
          label: "外观",
          submenu: THEME_IDS.map((id) => ({
            label: THEME_LABELS[id],
            type: "radio" as const,
            checked: currentTheme() === id,
            click: () => persistTheme(id),
          })),
        },
        {
          label: "字体",
          submenu: FONT_IDS.map((id) => ({
            label: FONT_LABELS[id],
            type: "radio" as const,
            checked: currentFontFamily() === id,
            click: () => persistTypography({ fontFamily: id }),
          })),
        },
        {
          label: "文字大小",
          submenu: [
            {
              label: "增大",
              accelerator: "CmdOrCtrl+=",
              click: () => persistTypography({ fontSize: stepFontSize(currentFontSize(), 1) }),
            },
            {
              label: "增大",
              accelerator: "CmdOrCtrl+Plus",
              visible: false,
              acceleratorWorksWhenHidden: true,
              click: () => persistTypography({ fontSize: stepFontSize(currentFontSize(), 1) }),
            },
            {
              label: "减小",
              accelerator: "CmdOrCtrl+-",
              click: () => persistTypography({ fontSize: stepFontSize(currentFontSize(), -1) }),
            },
            {
              label: "重置",
              accelerator: "CmdOrCtrl+0",
              click: () => persistTypography({ fontSize: DEFAULT_FONT_SIZE }),
            },
            { type: "separator" },
            ...FONT_SIZE_STEPS.map((size) => ({
              label: `${size} px${size === DEFAULT_FONT_SIZE ? "（标准）" : ""}`,
              type: "radio" as const,
              checked: currentFontSize() === size,
              click: () => persistTypography({ fontSize: size }),
            })),
          ],
        },
      ],
    },
    {
      label: "远程",
      submenu: [
        { label: "连接 SSH", click: () => sendMenu("ssh-connect") },
        { label: "断开连接", click: () => sendMenu("ssh-disconnect") },
        { type: "separator" },
        { label: "从服务器拉取", click: () => sendMenu("ssh-pull") },
        { label: "推送当前文章", accelerator: "CmdOrCtrl+Shift+U", click: () => sendMenu("ssh-push-current") },
        { label: "推送全部文章", click: () => sendMenu("ssh-push-all") },
        { type: "separator" },
        { label: "Hexo 生成", click: () => sendMenu("hexo-generate") },
        { label: "Hexo 部署", click: () => sendMenu("hexo-deploy") },
        { label: "生成并部署", accelerator: "CmdOrCtrl+Shift+D", click: () => sendMenu("hexo-full") },
      ],
    },
    {
      label: "窗口",
      role: "window",
      submenu: [
        { role: "minimize", label: "最小化" },
        { role: "close", label: "关闭" },
      ],
    },
    {
      label: "帮助",
      role: "help",
      submenu: [
        { label: "关于 Hexo Markdown", click: () => sendMenu("about") },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function registerIpc(): void {
  handle("app:info", () => ({
    name: app.getName(),
    version: app.getVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
  }));
  handle("settings:get", () => publicConfig());
  handle("settings:save", (body) => {
    const next = updateSettings((body || {}) as Partial<AppConfig>);
    applyWindowChrome(normalizeTheme(next.theme));
    createMenu();
    return next;
  });
  handle("templates:get", () => getTemplates());
  handle("templates:save", (body) => updateTemplates((body || {}) as Partial<TemplateSet>));
  handle("posts:list", () => getPosts());
  handle("posts:remote-list", () => getRemotePosts());
  handle("posts:read", (payload) => {
    if (typeof payload === "string") return getPost(payload);
    const data = payload as { path?: string; origin?: PostOrigin };
    return getPost(data?.path || "", data?.origin);
  });
  handle("posts:write", (payload) => {
    const data = payload as { path?: string; content?: string; origin?: PostOrigin };
    return putPost(data?.path || "", data?.content ?? "", data?.origin);
  });
  handle("posts:create", (payload) => {
    const data = payload as {
      title?: string;
      folder?: PostFolder;
      templateId?: string | null;
      origin?: PostOrigin;
    };
    return newPost(
      data?.title || "未命名",
      data?.folder === "drafts" ? "drafts" : "posts",
      data?.templateId,
      data?.origin,
    );
  });
  handle("posts:delete", (payload) => {
    if (typeof payload === "string") {
      removePost(payload);
      return { ok: true };
    }
    const data = payload as { path?: string; origin?: PostOrigin };
    removePost(data?.path || "", data?.origin);
    return { ok: true };
  });
  handle("posts:rename", (payload) => {
    const data = payload as { path?: string; name?: string; origin?: PostOrigin };
    return renamePost(data?.path || "", data?.name || "", data?.origin);
  });
  handle("images:upload", async (payload) => {
    const data = payload as {
      name?: string;
      type?: string;
      data?: ArrayBuffer;
      postPath?: string | null;
      origin?: PostOrigin;
    };
    if (!data?.data) throw new Error("没有文件");
    return uploadImage(
      {
        originalname: data.name || "image.png",
        mimetype: data.type || "image/png",
        buffer: Buffer.from(data.data),
      },
      data.postPath ?? null,
      data.origin,
    );
  });
  handle("dialog:directory", async () => {
    const win = BrowserWindow.getFocusedWindow() ?? mainWindow;
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, {
      title: "选择 Hexo 博客根目录",
      properties: ["openDirectory"],
      defaultPath: loadConfig().hexoRoot || app.getPath("home"),
    });
    if (result.canceled) return null;
    return result.filePaths[0] ?? null;
  });
  handle("shell:open-external", async (url) => {
    if (typeof url === "string" && /^https?:/i.test(url)) {
      await shell.openExternal(url);
    }
  });
  handle("dialog:file", async () => {
    const win = BrowserWindow.getFocusedWindow() ?? mainWindow;
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, {
      title: "选择 SSH 私钥",
      properties: ["openFile"],
      defaultPath: loadConfig().sshPrivateKeyPath || join(app.getPath("home"), ".ssh"),
    });
    if (result.canceled) return null;
    return result.filePaths[0] ?? null;
  });
  handle("ssh:connect", () => sshConnect());
  handle("ssh:disconnect", () => sshDisconnect());
  handle("ssh:status", () => sshStatus());
  handle("ssh:pull", () => sshPull(loadConfig().hexoRoot));
  handle("ssh:push", (rel) =>
    sshPush(loadConfig().hexoRoot, typeof rel === "string" && rel ? rel : undefined),
  );
  handle("ssh:exec", (kind) => {
    if (kind !== "generate" && kind !== "deploy" && kind !== "full") {
      throw new Error("未知的远程命令");
    }
    return sshExec(kind);
  });
  ipcMain.on("window:dirty", (_event, value: boolean) => {
    dirty = Boolean(value);
  });
  ipcMain.on("window:theme", (_event, theme: unknown) => {
    applyWindowChrome(normalizeTheme(theme));
  });
}

function registerProtocol(): void {
  protocol.handle("hexomd", async (request) => {
    try {
      const url = new URL(request.url);
      const rel = url.pathname
        .replace(/^\/+/, "")
        .split("/")
        .map((part) => decodeURIComponent(part))
        .join("/");
      if (url.hostname === "remote") {
        const bytes = await remoteMediaBytes(rel);
        return new Response(Uint8Array.from(bytes));
      }
      const abs = mediaAbsolutePath(rel);
      if (!existsSync(abs)) {
        return new Response("Not found", { status: 404 });
      }
      return net.fetch(pathToFileURL(abs).href);
    } catch {
      return new Response("Not found", { status: 404 });
    }
  });
}

async function createWindow(): Promise<void> {
  const theme = currentTheme();
  const chrome = THEME_CHROME[theme];
  mainWindow = new BrowserWindow({
    title: "Hexo Markdown",
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    show: false,
    backgroundColor: chrome.bg,
    icon: resolveAppIcon(),
    ...(isMac
      ? {
          titleBarStyle: "hiddenInset" as const,
          trafficLightPosition: { x: 16, y: 18 },
        }
      : isWin
        ? {
            titleBarStyle: "hidden" as const,
            titleBarOverlay: {
              color: chrome.overlay,
              symbolColor: chrome.symbol,
              height: 56,
            },
          }
        : { frame: true }),
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.on("close", (event) => {
    if (quitting || !dirty) return;
    event.preventDefault();
    const choice = dialog.showMessageBoxSync(mainWindow!, {
      type: "question",
      buttons: ["取消", "不保存并退出"],
      defaultId: 0,
      cancelId: 0,
      title: "未保存的更改",
      message: "当前文章尚未保存，确定退出？",
    });
    if (choice === 1) {
      dirty = false;
      mainWindow?.destroy();
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    const current = mainWindow?.webContents.getURL() || "";
    if (url === current) return;
    if (process.env.VITE_DEV_SERVER_URL && url.startsWith(process.env.VITE_DEV_SERVER_URL)) return;
    event.preventDefault();
    if (/^https?:/i.test(url)) void shell.openExternal(url);
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    await mainWindow.loadFile(join(__dirname, "../dist/index.html"));
  }
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    app.setName("Hexo Markdown");
    if (isWin) {
      app.setAppUserModelId("app.hexo.markdown");
    }
    app.setAboutPanelOptions({
      applicationName: "Hexo Markdown",
      applicationVersion: app.getVersion(),
    });
    initConfig({
      dataDir: join(app.getPath("userData"), "data"),
      envFiles: [join(process.cwd(), ".env"), join(app.getPath("userData"), ".env")],
    });
    setSshHooks({
      log: (kind, text) => {
        mainWindow?.webContents.send("ssh:log", { kind, text, ts: Date.now() });
      },
      onStatus: () => {
        mainWindow?.webContents.send("ssh:status", sshStatus());
      },
    });
    registerProtocol();
    registerIpc();
    createMenu();
    await createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        void createWindow();
      } else {
        mainWindow?.show();
      }
    });
  });
}

app.on("before-quit", () => {
  quitting = true;
  void sshDisconnect();
});

app.on("window-all-closed", () => {
  if (!isMac) app.quit();
});
