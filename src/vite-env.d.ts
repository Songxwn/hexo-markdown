/// <reference types="vite/client" />

import type {
  AppSettings,
  MenuAction,
  PostFolder,
  PostSummary,
  SshLogEvent,
  SshStatus,
  SyncResult,
  UploadResult,
} from "./lib/types";

type HexoDesktopAPI = {
  platform: NodeJS.Platform;
  settings: () => Promise<AppSettings>;
  saveSettings: (body: Partial<AppSettings>) => Promise<AppSettings>;
  posts: () => Promise<PostSummary[]>;
  readPost: (path: string) => Promise<{ path: string; content: string }>;
  savePost: (path: string, content: string) => Promise<{ path: string }>;
  createPost: (title: string, folder: PostFolder) => Promise<{ path: string; content: string }>;
  deletePost: (path: string) => Promise<void>;
  uploadImage: (payload: {
    name: string;
    type: string;
    data: ArrayBuffer;
    postPath: string | null;
  }) => Promise<UploadResult>;
  pickDirectory: () => Promise<string | null>;
  pickFile: () => Promise<string | null>;
  openExternal: (url: string) => Promise<void>;
  setDirty: (dirty: boolean) => void;
  sshConnect: () => Promise<{ host: string; user: string }>;
  sshDisconnect: () => Promise<void>;
  sshStatus: () => Promise<SshStatus>;
  sshPull: () => Promise<SyncResult>;
  sshPush: (rel?: string | null) => Promise<SyncResult>;
  sshExec: (kind: "generate" | "deploy" | "full") => Promise<{ code: number }>;
  onMenu: (handler: (action: MenuAction) => void) => () => void;
  onSshLog: (handler: (event: SshLogEvent) => void) => () => void;
  onSshStatus: (handler: (status: SshStatus) => void) => () => void;
};

declare global {
  interface Window {
    hexo: HexoDesktopAPI;
  }
}

export {};
