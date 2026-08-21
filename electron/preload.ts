import { contextBridge, ipcRenderer } from "electron";

export type MenuAction =
  | "new"
  | "save"
  | "rename"
  | "publish"
  | "settings"
  | "export-config"
  | "import-config"
  | "about"
  | "outline"
  | "llm"
  | "ssh-connect"
  | "ssh-disconnect"
  | "ssh-pull"
  | "ssh-push-current"
  | "ssh-push-all"
  | "hexo-generate"
  | "hexo-deploy"
  | "hexo-full";

const api = {
  platform: process.platform as NodeJS.Platform,
  appInfo: () => ipcRenderer.invoke("app:info"),
  settings: () => ipcRenderer.invoke("settings:get"),
  saveSettings: (body: unknown) => ipcRenderer.invoke("settings:save", body),
  exportSettings: () => ipcRenderer.invoke("settings:export"),
  importSettings: () => ipcRenderer.invoke("settings:import"),
  posts: () => ipcRenderer.invoke("posts:list"),
  remotePosts: () => ipcRenderer.invoke("posts:remote-list"),
  readPost: (path: string, origin?: "local" | "remote") =>
    ipcRenderer.invoke("posts:read", { path, origin }),
  savePost: (path: string, content: string, origin?: "local" | "remote") =>
    ipcRenderer.invoke("posts:write", { path, content, origin }),
  createPost: (
    title: string,
    folder: "posts" | "drafts",
    templateId?: string | null,
    origin?: "local" | "remote",
  ) => ipcRenderer.invoke("posts:create", { title, folder, templateId, origin }),
  templates: () => ipcRenderer.invoke("templates:get"),
  saveTemplates: (body: unknown) => ipcRenderer.invoke("templates:save", body),
  deletePost: (path: string, origin?: "local" | "remote") =>
    ipcRenderer.invoke("posts:delete", { path, origin }),
  renamePost: (path: string, name: string, origin?: "local" | "remote") =>
    ipcRenderer.invoke("posts:rename", { path, name, origin }),
  movePost: (path: string, folder: "posts" | "drafts", origin?: "local" | "remote") =>
    ipcRenderer.invoke("posts:move", { path, folder, origin }),
  uploadImage: (payload: {
    name: string;
    type: string;
    data: ArrayBuffer;
    postPath: string | null;
    origin?: "local" | "remote";
  }) => ipcRenderer.invoke("images:upload", payload),
  pickDirectory: () => ipcRenderer.invoke("dialog:directory") as Promise<string | null>,
  pickFile: () => ipcRenderer.invoke("dialog:file") as Promise<string | null>,
  openExternal: (url: string) => ipcRenderer.invoke("shell:open-external", url),
  setDirty: (dirty: boolean) => ipcRenderer.send("window:dirty", dirty),
  setTheme: (theme: string) => ipcRenderer.send("window:theme", theme),
  sshConnect: () => ipcRenderer.invoke("ssh:connect"),
  sshDisconnect: () => ipcRenderer.invoke("ssh:disconnect"),
  sshStatus: () => ipcRenderer.invoke("ssh:status"),
  sshPull: () => ipcRenderer.invoke("ssh:pull"),
  sshPush: (rel?: string | null) => ipcRenderer.invoke("ssh:push", rel || null),
  sshExec: (kind: "generate" | "deploy" | "full") => ipcRenderer.invoke("ssh:exec", kind),
  llmChat: (payload: {
    id: number;
    mode: string;
    instruction?: string;
    selection: string;
    article: string;
  }) => ipcRenderer.send("llm:chat", payload),
  llmAbort: (id: number) => ipcRenderer.send("llm:abort", id),
  listLlmModels: (payload: { baseUrl: string; apiKey?: string }) =>
    ipcRenderer.invoke("llm:models", payload) as Promise<{ models: string[]; url: string }>,
  onLlmChunk: (handler: (event: { id: number; text: string }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: { id: number; text: string }) =>
      handler(payload);
    ipcRenderer.on("llm:chunk", listener);
    return () => ipcRenderer.removeListener("llm:chunk", listener);
  },
  onLlmDone: (handler: (event: { id: number }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: { id: number }) => handler(payload);
    ipcRenderer.on("llm:done", listener);
    return () => ipcRenderer.removeListener("llm:done", listener);
  },
  onLlmError: (handler: (event: { id: number; message: string }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: { id: number; message: string }) =>
      handler(payload);
    ipcRenderer.on("llm:error", listener);
    return () => ipcRenderer.removeListener("llm:error", listener);
  },
  onMenu: (handler: (action: MenuAction) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, action: MenuAction) => handler(action);
    ipcRenderer.on("menu", listener);
    return () => {
      ipcRenderer.removeListener("menu", listener);
    };
  },
  onTheme: (handler: (theme: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, theme: string) => handler(theme);
    ipcRenderer.on("theme", listener);
    return () => ipcRenderer.removeListener("theme", listener);
  },
  onTypography: (handler: (value: { fontFamily: string; fontSize: number }) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      value: { fontFamily: string; fontSize: number },
    ) => handler(value);
    ipcRenderer.on("typography", listener);
    return () => ipcRenderer.removeListener("typography", listener);
  },
  onSshLog: (handler: (event: { kind: "out" | "err" | "sys"; text: string; ts: number }) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      payload: { kind: "out" | "err" | "sys"; text: string; ts: number },
    ) => handler(payload);
    ipcRenderer.on("ssh:log", listener);
    return () => ipcRenderer.removeListener("ssh:log", listener);
  },
  onSshStatus: (handler: (status: { connected: boolean; host: string; user: string; busy: boolean }) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      status: { connected: boolean; host: string; user: string; busy: boolean },
    ) => handler(status);
    ipcRenderer.on("ssh:status", listener);
    return () => ipcRenderer.removeListener("ssh:status", listener);
  },
};

contextBridge.exposeInMainWorld("hexo", api);
