import { Client, type ConnectConfig, type SFTPWrapper } from "ssh2";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { dirname as posixDirname, join as posixJoin } from "node:path/posix";
import { loadConfig } from "./config";
import { resolveRel } from "./posts";
import type { SshLogKind, SyncResult } from "./types";

type LogFn = (kind: SshLogKind, text: string) => void;
type StatusFn = () => void;

let client: Client | null = null;
let connecting: Promise<Client> | null = null;
let log: LogFn = () => undefined;
let onStatus: StatusFn = () => undefined;
let busyCount = 0;

export function setSshHooks(hooks: { log?: LogFn; onStatus?: StatusFn }): void {
  if (hooks.log) log = hooks.log;
  if (hooks.onStatus) onStatus = hooks.onStatus;
}

export function sshStatus() {
  const cfg = loadConfig();
  return {
    connected: Boolean(client),
    host: cfg.sshHost,
    user: cfg.sshUser,
    busy: busyCount > 0,
  };
}

function emit(kind: SshLogKind, text: string): void {
  log(kind, text);
}

function shQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function remoteRoot(): string {
  const root = loadConfig().remoteHexoRoot.replace(/\\/g, "/").replace(/\/+$/, "");
  if (!root) throw new Error("未设置远程 Hexo 根目录");
  return root;
}

export function isSshConfigured(): boolean {
  const cfg = loadConfig();
  return Boolean(cfg.sshHost && cfg.sshUser && cfg.remoteHexoRoot && (cfg.sshPassword || cfg.sshPrivateKeyPath));
}

function remoteJoin(relPath: string): string {
  const normalized = relPath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized || normalized.includes("..") || normalized.includes("\0")) {
    throw new Error("非法远程路径");
  }
  if (
    !normalized.startsWith("source/_posts") &&
    !normalized.startsWith("source/_drafts") &&
    normalized !== "source/_posts" &&
    normalized !== "source/_drafts"
  ) {
    throw new Error("只能同步 source/_posts 或 source/_drafts");
  }
  return posixJoin(remoteRoot(), normalized);
}

function localJoin(hexoRoot: string, relPath: string): string {
  return resolveRel(hexoRoot, relPath);
}

function sftpCall<T>(fn: (cb: (err: Error | undefined | null, res: T) => void) => void): Promise<T> {
  return new Promise((resolvePromise, reject) => {
    fn((err, res) => (err ? reject(err) : resolvePromise(res)));
  });
}

function sftpDone(fn: (cb: (err: Error | undefined | null) => void) => void): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    fn((err) => (err ? reject(err) : resolvePromise()));
  });
}

async function withBusy<T>(label: string, fn: () => Promise<T>): Promise<T> {
  busyCount += 1;
  onStatus();
  emit("sys", label);
  try {
    return await fn();
  } finally {
    busyCount = Math.max(0, busyCount - 1);
    onStatus();
  }
}

function buildConnectConfig(): ConnectConfig {
  const cfg = loadConfig();
  if (!cfg.sshHost || !cfg.sshUser) throw new Error("请先在设置中填写 SSH 主机和用户名");
  const auth: ConnectConfig = {
    host: cfg.sshHost,
    port: cfg.sshPort || 22,
    username: cfg.sshUser,
    readyTimeout: 20000,
    keepaliveInterval: 15000,
    keepaliveCountMax: 3,
    tryKeyboard: true,
  };
  if (cfg.sshPrivateKeyPath) {
    if (!existsSync(cfg.sshPrivateKeyPath)) {
      throw new Error(`私钥文件不存在：${cfg.sshPrivateKeyPath}`);
    }
    auth.privateKey = readFileSync(cfg.sshPrivateKeyPath);
    if (cfg.sshPassphrase) auth.passphrase = cfg.sshPassphrase;
  } else if (cfg.sshPassword) {
    auth.password = cfg.sshPassword;
  } else {
    throw new Error("请提供 SSH 密码或私钥");
  }
  return auth;
}

function attachClient(next: Client): void {
  next.on("close", () => {
    if (client === next) {
      client = null;
      emit("sys", "SSH 连接已断开");
      onStatus();
    }
  });
  next.on("end", () => {
    if (client === next) {
      client = null;
      onStatus();
    }
  });
}

export async function sshConnect(): Promise<{ host: string; user: string }> {
  if (client) {
    const cfg = loadConfig();
    return { host: cfg.sshHost, user: cfg.sshUser };
  }
  if (connecting) {
    await connecting;
    const cfg = loadConfig();
    return { host: cfg.sshHost, user: cfg.sshUser };
  }
  const cfg = loadConfig();
  connecting = new Promise<Client>((resolvePromise, reject) => {
    const conn = new Client();
    conn.on("ready", () => resolvePromise(conn));
    conn.on("error", (error) => reject(error));
    conn.on("keyboard-interactive", (_name, _instructions, _lang, prompts, finish) => {
      const answers = prompts.map((prompt) =>
        /password/i.test(prompt.prompt) ? cfg.sshPassword : "",
      );
      finish(answers);
    });
    try {
      conn.connect(buildConnectConfig());
    } catch (error) {
      reject(error);
    }
  });
  try {
    const conn = await withBusy(`连接 ${cfg.sshUser}@${cfg.sshHost}:${cfg.sshPort || 22} …`, () => connecting!);
    client = conn;
    attachClient(conn);
    emit("sys", `已连接 ${cfg.sshUser}@${cfg.sshHost}`);
    onStatus();
    return { host: cfg.sshHost, user: cfg.sshUser };
  } catch (error) {
    client = null;
    throw new Error(error instanceof Error ? error.message : String(error));
  } finally {
    connecting = null;
  }
}

export async function sshDisconnect(): Promise<void> {
  const current = client;
  client = null;
  connecting = null;
  if (current) {
    current.end();
    emit("sys", "已断开 SSH");
  }
  onStatus();
}

async function requireClient(): Promise<Client> {
  if (!client) await sshConnect();
  if (!client) throw new Error("SSH 未连接");
  return client;
}

async function openSftp(): Promise<SFTPWrapper> {
  const conn = await requireClient();
  return new Promise((resolvePromise, reject) => {
    conn.sftp((error, sftp) => {
      if (error || !sftp) reject(error || new Error("无法打开 SFTP"));
      else resolvePromise(sftp);
    });
  });
}

async function remoteStat(sftp: SFTPWrapper, path: string) {
  return sftpCall<{ isDirectory: () => boolean }>((cb) => sftp.stat(path, cb));
}

async function remoteExists(sftp: SFTPWrapper, path: string): Promise<boolean> {
  try {
    await remoteStat(sftp, path);
    return true;
  } catch {
    return false;
  }
}

async function remoteMkdirp(sftp: SFTPWrapper, dir: string): Promise<void> {
  const normalized = dir.replace(/\\/g, "/").replace(/\/+$/, "");
  if (!normalized || normalized === "/") return;
  const parts = normalized.split("/").filter(Boolean);
  let current = normalized.startsWith("/") ? "" : "";
  for (const part of parts) {
    current += `/${part}`;
    if (await remoteExists(sftp, current)) continue;
    await sftpDone((cb) => sftp.mkdir(current, cb));
  }
}

type RemoteEntry = { filename: string; longname: string; attrs: { mode?: number } };

async function remoteReadDir(sftp: SFTPWrapper, dir: string): Promise<RemoteEntry[]> {
  return sftpCall<RemoteEntry[]>((cb) => sftp.readdir(dir, cb));
}

function isDirMode(mode?: number): boolean {
  return Boolean(mode && (mode & 0o170000) === 0o040000);
}

function isDirEntry(entry: RemoteEntry): boolean {
  if (isDirMode(entry.attrs.mode)) return true;
  return entry.longname.startsWith("d");
}

async function walkRemote(
  sftp: SFTPWrapper,
  absDir: string,
  relDir: string,
  files: string[],
): Promise<void> {
  if (!(await remoteExists(sftp, absDir))) return;
  const entries = await remoteReadDir(sftp, absDir);
  for (const entry of entries) {
    if (entry.filename === "." || entry.filename === "..") continue;
    const rel = `${relDir}/${entry.filename}`.replace(/^\/+/, "");
    const abs = `${absDir}/${entry.filename}`;
    if (isDirEntry(entry)) {
      await walkRemote(sftp, abs, rel, files);
    } else {
      files.push(rel);
    }
  }
}

async function downloadFile(sftp: SFTPWrapper, remote: string, local: string): Promise<void> {
  mkdirSync(dirname(local), { recursive: true });
  await sftpDone((cb) => sftp.fastGet(remote, local, cb));
}

async function uploadFile(sftp: SFTPWrapper, local: string, remote: string): Promise<void> {
  await remoteMkdirp(sftp, posixDirname(remote));
  await sftpDone((cb) => sftp.fastPut(local, remote, cb));
}

function walkLocalFiles(dir: string, root: string, out: string[]): void {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    const st = statSync(abs);
    if (st.isDirectory()) {
      walkLocalFiles(abs, root, out);
      continue;
    }
    if (!st.isFile()) continue;
    out.push(relative(root, abs).split(sep).join("/"));
  }
}

function collectLocalSyncFiles(hexoRoot: string, relFile?: string): string[] {
  const root = resolve(hexoRoot);
  const allow = (rel: string) =>
    rel.startsWith("source/_posts/") || rel.startsWith("source/_drafts/");

  if (relFile) {
    const rel = relFile.replace(/\\/g, "/");
    if (!allow(rel) || !rel.toLowerCase().endsWith(".md")) {
      throw new Error("只能同步 Markdown 文章或其资源目录");
    }
    const files = [rel];
    const assetRel = rel.replace(/\.md$/i, "");
    const assetAbs = join(root, ...assetRel.split("/"));
    if (existsSync(assetAbs) && statSync(assetAbs).isDirectory()) {
      const extra: string[] = [];
      walkLocalFiles(assetAbs, root, extra);
      files.push(...extra.filter(allow));
    }
    return files;
  }

  const files: string[] = [];
  for (const folder of ["source/_posts", "source/_drafts"]) {
    const abs = join(root, ...folder.split("/"));
    if (!existsSync(abs)) continue;
    const found: string[] = [];
    walkLocalFiles(abs, root, found);
    for (const rel of found) {
      if (!allow(rel)) continue;
      if (rel.toLowerCase().endsWith(".md")) files.push(rel);
    }
    for (const rel of found) {
      if (!allow(rel) || rel.toLowerCase().endsWith(".md")) continue;
      const owner = files.some((md) => rel.startsWith(md.replace(/\.md$/i, "/") ));
      if (owner) files.push(rel);
    }
  }
  return Array.from(new Set(files));
}

export async function sshPull(hexoRoot: string): Promise<SyncResult> {
  if (!hexoRoot) throw new Error("请先设置本地 Hexo 根目录");
  const sftp = await openSftp();
  return withBusy("正在从服务器拉取 Markdown…", async () => {
    const remoteFiles: string[] = [];
    await walkRemote(sftp, remoteJoin("source/_posts"), "source/_posts", remoteFiles);
    await walkRemote(sftp, remoteJoin("source/_drafts"), "source/_drafts", remoteFiles);
    const wanted = remoteFiles.filter((rel) => {
      if (rel.toLowerCase().endsWith(".md")) return true;
      return remoteFiles.some((md) => md.toLowerCase().endsWith(".md") && rel.startsWith(md.replace(/\.md$/i, "/")));
    });
    let files = 0;
    for (const rel of wanted) {
      const remote = remoteJoin(rel);
      const local = localJoin(hexoRoot, rel);
      await downloadFile(sftp, remote, local);
      files += 1;
      emit("sys", `↓ ${rel}`);
    }
    emit("sys", `拉取完成，共 ${files} 个文件`);
    return { files, dirs: 0 };
  });
}

export async function sshPush(hexoRoot: string, relFile?: string): Promise<SyncResult> {
  if (!hexoRoot) throw new Error("请先设置本地 Hexo 根目录");
  const sftp = await openSftp();
  const files = collectLocalSyncFiles(hexoRoot, relFile);
  if (!files.length) {
    emit("sys", "没有可推送的文件");
    return { files: 0, dirs: 0 };
  }
  const label = relFile ? `正在推送 ${relFile} …` : "正在推送全部文章到服务器…";
  return withBusy(label, async () => {
    let count = 0;
    for (const rel of files) {
      const local = join(resolve(hexoRoot), ...rel.split("/"));
      if (!existsSync(local)) continue;
      await uploadFile(sftp, local, remoteJoin(rel));
      count += 1;
      emit("sys", `↑ ${rel}`);
    }
    emit("sys", `推送完成，共 ${count} 个文件`);
    return { files: count, dirs: 0 };
  });
}

export async function sshExec(kind: "generate" | "deploy" | "full"): Promise<{ code: number }> {
  const cfg = loadConfig();
  const conn = await requireClient();
  const root = remoteRoot();
  const init = (cfg.sshInitCmd || "source ~/.nvm/nvm.sh 2>/dev/null || true; source ~/.bashrc 2>/dev/null || true").trim();
  const generate = (cfg.sshGenerateCmd || "npx hexo generate").trim();
  const deploy = (cfg.sshDeployCmd || "npx hexo deploy").trim();
  const body =
    kind === "generate" ? generate : kind === "deploy" ? deploy : `${generate} && ${deploy}`;
  const script = `${init}; cd ${shQuote(root)} && ${body}`;
  const command = `bash -lc ${shQuote(script)}`;
  return withBusy(`远程执行：${body}`, () => {
    emit("sys", `$ ${body}`);
    return new Promise<{ code: number }>((resolvePromise, reject) => {
      conn.exec(command, { env: { TERM: "dumb" } }, (error, stream) => {
        if (error || !stream) {
          reject(error || new Error("无法执行远程命令"));
          return;
        }
        stream.on("data", (chunk: Buffer) => emit("out", chunk.toString("utf8")));
        stream.stderr.on("data", (chunk: Buffer) => emit("err", chunk.toString("utf8")));
        stream.on("close", (code: number | undefined) => {
          const exit = code ?? 1;
          emit("sys", `退出码 ${exit}`);
          if (exit !== 0) {
            reject(new Error(`远程命令失败，退出码 ${exit}`));
            return;
          }
          resolvePromise({ code: exit });
        });
      });
    });
  });
}
