import { contextBridge, ipcRenderer } from "electron";

export type MenuAction =
  | "new"
  | "save"
  | "settings"
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
  settings: () => ipcRenderer.invoke("settings:get"),
  saveSettings: (body: unknown) => ipcRenderer.invoke("settings:save", body),
  posts: () => ipcRenderer.invoke("posts:list"),
  readPost: (path: string) => ipcRenderer.invoke("posts:read", path),
  savePost: (path: string, content: string) => ipcRenderer.invoke("posts:write", { path, content }),
  createPost: (title: string, folder: "posts" | "drafts") =>
    ipcRenderer.invoke("posts:create", { title, folder }),
  deletePost: (path: string) => ipcRenderer.invoke("posts:delete", path),
  uploadImage: (payload: { name: string; type: string; data: ArrayBuffer; postPath: string | null }) =>
    ipcRenderer.invoke("images:upload", payload),
  pickDirectory: () => ipcRenderer.invoke("dialog:directory") as Promise<string | null>,
  pickFile: () => ipcRenderer.invoke("dialog:file") as Promise<string | null>,
  openExternal: (url: string) => ipcRenderer.invoke("shell:open-external", url),
  setDirty: (dirty: boolean) => ipcRenderer.send("window:dirty", dirty),
  sshConnect: () => ipcRenderer.invoke("ssh:connect"),
  sshDisconnect: () => ipcRenderer.invoke("ssh:disconnect"),
  sshStatus: () => ipcRenderer.invoke("ssh:status"),
  sshPull: () => ipcRenderer.invoke("ssh:pull"),
  sshPush: (rel?: string | null) => ipcRenderer.invoke("ssh:push", rel || null),
  sshExec: (kind: "generate" | "deploy" | "full") => ipcRenderer.invoke("ssh:exec", kind),
  onMenu: (handler: (action: MenuAction) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, action: MenuAction) => handler(action);
    ipcRenderer.on("menu", listener);
    return () => {
      ipcRenderer.removeListener("menu", listener);
    };
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
