import type {
  AppSettings,
  MenuAction,
  PostFolder,
  PostSummary,
  SshLogEvent,
  SshStatus,
  SyncResult,
  UploadResult,
} from "./types";

function desktop() {
  if (!window.hexo) {
    throw new Error("请通过 Electron 应用启动 Hexo Markdown");
  }
  return window.hexo;
}

export const api = {
  settings(): Promise<AppSettings> {
    return desktop().settings();
  },

  saveSettings(body: Partial<AppSettings>): Promise<AppSettings> {
    return desktop().saveSettings(body);
  },

  posts(): Promise<PostSummary[]> {
    return desktop().posts();
  },

  readPost(path: string): Promise<{ path: string; content: string }> {
    return desktop().readPost(path);
  },

  savePost(path: string, content: string): Promise<{ path: string }> {
    return desktop().savePost(path, content);
  },

  createPost(title: string, folder: PostFolder): Promise<{ path: string; content: string }> {
    return desktop().createPost(title, folder);
  },

  deletePost(path: string): Promise<void> {
    return desktop().deletePost(path);
  },

  renamePost(path: string, name: string): Promise<{ path: string }> {
    return desktop().renamePost(path, name);
  },

  async uploadImage(file: File, postPath: string | null): Promise<UploadResult> {
    const data = await file.arrayBuffer();
    return desktop().uploadImage({
      name: file.name,
      type: file.type,
      data,
      postPath,
    });
  },

  pickDirectory(): Promise<string | null> {
    return desktop().pickDirectory();
  },

  pickFile(): Promise<string | null> {
    return desktop().pickFile();
  },

  openExternal(url: string): Promise<void> {
    return desktop().openExternal(url);
  },

  setDirty(dirty: boolean): void {
    desktop().setDirty(dirty);
  },

  sshConnect(): Promise<{ host: string; user: string }> {
    return desktop().sshConnect();
  },

  sshDisconnect(): Promise<void> {
    return desktop().sshDisconnect();
  },

  sshStatus(): Promise<SshStatus> {
    return desktop().sshStatus();
  },

  sshPull(): Promise<SyncResult> {
    return desktop().sshPull();
  },

  sshPush(rel?: string | null): Promise<SyncResult> {
    return desktop().sshPush(rel);
  },

  sshExec(kind: "generate" | "deploy" | "full"): Promise<{ code: number }> {
    return desktop().sshExec(kind);
  },

  onMenu(handler: (action: MenuAction) => void): () => void {
    return desktop().onMenu(handler);
  },

  onSshLog(handler: (event: SshLogEvent) => void): () => void {
    return desktop().onSshLog(handler);
  },

  onSshStatus(handler: (status: SshStatus) => void): () => void {
    return desktop().onSshStatus(handler);
  },
};
