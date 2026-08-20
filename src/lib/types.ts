import type { ThemeId } from "./theme";
import type { FontFamilyId } from "./typography";

export type { ThemeId, FontFamilyId };

export type PostFolder = "posts" | "drafts";

export type PostTemplate = {
  id: string;
  name: string;
  body: string;
  readonly?: boolean;
};

export type TemplateSet = {
  defaultId: string;
  items: PostTemplate[];
  scaffolds: PostTemplate[];
};

export type PostOrigin = "local" | "remote";

export type PostSummary = {
  path: string;
  name: string;
  folder: PostFolder;
  title: string;
  date: string;
  mtime: number;
  origin: PostOrigin;
};

export type AppSettings = {
  hexoRoot: string;
  r2AccountId: string;
  r2AccessKeyId: string;
  r2SecretAccessKey: string;
  r2Bucket: string;
  r2PublicUrl: string;
  r2KeyPrefix: string;
  sshHost: string;
  sshPort: number;
  sshUser: string;
  sshPassword: string;
  sshPrivateKeyPath: string;
  sshPassphrase: string;
  remoteHexoRoot: string;
  sshInitCmd: string;
  sshGenerateCmd: string;
  sshDeployCmd: string;
  autoUploadOnSave: boolean;
  theme: ThemeId;
  fontFamily: FontFamilyId;
  fontSize: number;
  r2Configured: boolean;
  sshConfigured: boolean;
  hexoValid: boolean;
  hexoHasConfig: boolean;
};

export type UploadResult = {
  url: string;
  key: string;
  storage: "r2" | "local" | "remote";
};

export type SshStatus = {
  connected: boolean;
  host: string;
  user: string;
  busy: boolean;
};

export type SshLogEvent = {
  kind: "out" | "err" | "sys";
  text: string;
  ts: number;
};

export type SyncResult = {
  files: number;
  dirs: number;
};

export type AppInfo = {
  name: string;
  version: string;
  electron: string;
  chrome: string;
};

export type MenuAction =
  | "new"
  | "save"
  | "rename"
  | "settings"
  | "about"
  | "outline"
  | "ssh-connect"
  | "ssh-disconnect"
  | "ssh-pull"
  | "ssh-push-current"
  | "ssh-push-all"
  | "hexo-generate"
  | "hexo-deploy"
  | "hexo-full";
