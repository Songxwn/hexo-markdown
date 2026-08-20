import type { ThemeId } from "./theme";

export type AppConfig = {
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
};

export type PublicConfig = Omit<AppConfig, "r2SecretAccessKey" | "sshPassword" | "sshPassphrase"> & {
  r2SecretAccessKey: string;
  sshPassword: string;
  sshPassphrase: string;
  r2Configured: boolean;
  sshConfigured: boolean;
  hexoValid: boolean;
  hexoHasConfig: boolean;
};

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

export type SshStatus = {
  connected: boolean;
  host: string;
  user: string;
  busy: boolean;
};

export type SshLogKind = "out" | "err" | "sys";

export type SshLogEvent = {
  kind: SshLogKind;
  text: string;
  ts: number;
};

export type SyncResult = {
  files: number;
  dirs: number;
};
