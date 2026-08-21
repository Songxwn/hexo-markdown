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
} from "./types";
import { imageFileName } from "./markdown";

function desktop() {
  if (!window.hexo) {
    throw new Error("请通过 Electron 应用启动 Hexo Markdown");
  }
  return window.hexo;
}

export const api = {
  appInfo(): Promise<AppInfo> {
    return desktop().appInfo();
  },

  settings(): Promise<AppSettings> {
    return desktop().settings();
  },

  saveSettings(body: Partial<AppSettings>): Promise<AppSettings> {
    return desktop().saveSettings(body);
  },

  exportSettings(): Promise<{ canceled: boolean; path?: string }> {
    return desktop().exportSettings();
  },

  importSettings(): Promise<{
    canceled: boolean;
    settings?: AppSettings;
    templates?: TemplateSet;
  }> {
    return desktop().importSettings();
  },

  posts(): Promise<PostSummary[]> {
    return desktop().posts();
  },

  remotePosts(): Promise<PostSummary[]> {
    return desktop().remotePosts();
  },

  readPost(path: string, origin: PostOrigin = "local"): Promise<{ path: string; content: string }> {
    return desktop().readPost(path, origin);
  },

  savePost(path: string, content: string, origin: PostOrigin = "local"): Promise<{ path: string }> {
    return desktop().savePost(path, content, origin);
  },

  createPost(
    title: string,
    folder: PostFolder,
    templateId?: string | null,
    origin: PostOrigin = "local",
  ): Promise<{ path: string; content: string }> {
    return desktop().createPost(title, folder, templateId, origin);
  },

  templates(): Promise<TemplateSet> {
    return desktop().templates();
  },

  saveTemplates(body: Partial<TemplateSet>): Promise<TemplateSet> {
    return desktop().saveTemplates(body);
  },

  deletePost(path: string, origin: PostOrigin = "local"): Promise<void> {
    return desktop().deletePost(path, origin);
  },

  renamePost(path: string, name: string, origin: PostOrigin = "local"): Promise<{ path: string }> {
    return desktop().renamePost(path, name, origin);
  },

  async uploadImage(file: File, postPath: string | null, origin: PostOrigin = "local"): Promise<UploadResult> {
    const data = await file.arrayBuffer();
    return desktop().uploadImage({
      name: imageFileName(file),
      type: file.type,
      data,
      postPath,
      origin,
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

  setTheme(theme: string): void {
    desktop().setTheme(theme);
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

  llmChat(
    payload: { id: number; mode: string; instruction?: string; selection: string; article: string },
    handlers: {
      onChunk: (text: string) => void;
      onDone: () => void;
      onError: (message: string) => void;
    },
  ): () => void {
    const d = desktop();
    const offChunk = d.onLlmChunk((event) => {
      if (event.id === payload.id) handlers.onChunk(event.text);
    });
    const offDone = d.onLlmDone((event) => {
      if (event.id !== payload.id) return;
      cleanup();
      handlers.onDone();
    });
    const offError = d.onLlmError((event) => {
      if (event.id !== payload.id) return;
      cleanup();
      handlers.onError(event.message);
    });
    function cleanup() {
      offChunk();
      offDone();
      offError();
    }
    d.llmChat(payload);
    return () => {
      d.llmAbort(payload.id);
      cleanup();
    };
  },

  listLlmModels(payload: { baseUrl: string; apiKey?: string }): Promise<{ models: string[]; url: string }> {
    return desktop().listLlmModels(payload);
  },

  onMenu(handler: (action: MenuAction) => void): () => void {
    return desktop().onMenu(handler);
  },

  onTheme(handler: (theme: string) => void): () => void {
    return desktop().onTheme(handler);
  },

  onTypography(handler: (value: { fontFamily: string; fontSize: number }) => void): () => void {
    return desktop().onTypography(handler);
  },

  onSshLog(handler: (event: SshLogEvent) => void): () => void {
    return desktop().onSshLog(handler);
  },

  onSshStatus(handler: (status: SshStatus) => void): () => void {
    return desktop().onSshStatus(handler);
  },
};
