/// <reference types="vite/client" />

import type {
  AppInfo,
  AppSettings,
  MenuAction,
  PostFolder,
  PostOrigin,
  PostSummary,
  SshLogEvent,
  SshStatus,
  SyncResult,
  TemplateSet,
  UploadResult,
} from "./lib/types";

type HexoDesktopAPI = {
  platform: NodeJS.Platform;
  appInfo: () => Promise<AppInfo>;
  settings: () => Promise<AppSettings>;
  saveSettings: (body: Partial<AppSettings>) => Promise<AppSettings>;
  posts: () => Promise<PostSummary[]>;
  remotePosts: () => Promise<PostSummary[]>;
  readPost: (path: string, origin?: PostOrigin) => Promise<{ path: string; content: string }>;
  savePost: (path: string, content: string, origin?: PostOrigin) => Promise<{ path: string }>;
  createPost: (
    title: string,
    folder: PostFolder,
    templateId?: string | null,
    origin?: PostOrigin,
  ) => Promise<{ path: string; content: string }>;
  templates: () => Promise<TemplateSet>;
  saveTemplates: (body: Partial<TemplateSet>) => Promise<TemplateSet>;
  deletePost: (path: string, origin?: PostOrigin) => Promise<void>;
  renamePost: (path: string, name: string, origin?: PostOrigin) => Promise<{ path: string }>;
  uploadImage: (payload: {
    name: string;
    type: string;
    data: ArrayBuffer;
    postPath: string | null;
    origin?: PostOrigin;
  }) => Promise<UploadResult>;
  pickDirectory: () => Promise<string | null>;
  pickFile: () => Promise<string | null>;
  openExternal: (url: string) => Promise<void>;
  setDirty: (dirty: boolean) => void;
  setTheme: (theme: string) => void;
  sshConnect: () => Promise<{ host: string; user: string }>;
  sshDisconnect: () => Promise<void>;
  sshStatus: () => Promise<SshStatus>;
  sshPull: () => Promise<SyncResult>;
  sshPush: (rel?: string | null) => Promise<SyncResult>;
  sshExec: (kind: "generate" | "deploy" | "full") => Promise<{ code: number }>;
  onMenu: (handler: (action: MenuAction) => void) => () => void;
  onTheme: (handler: (theme: string) => void) => () => void;
  onTypography: (handler: (value: { fontFamily: string; fontSize: number }) => void) => () => void;
  onSshLog: (handler: (event: SshLogEvent) => void) => () => void;
  onSshStatus: (handler: (status: SshStatus) => void) => () => void;
};

declare global {
  interface Window {
    hexo: HexoDesktopAPI;
  }
}

export {};
