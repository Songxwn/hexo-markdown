import mermaid from "mermaid";

let seq = 0;
let themeKey = "";

function currentThemeKey(): string {
  return document.documentElement.dataset.theme === "paper" ? "paper" : "dark";
}

function ensureInit(): void {
  const key = currentThemeKey();
  if (key === themeKey) return;
  themeKey = key;
  const paper = key === "paper";
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: paper ? "neutral" : "dark",
    fontFamily:
      getComputedStyle(document.documentElement).getPropertyValue("--preview").trim() || undefined,
    flowchart: { htmlLabels: true, curve: "basis" },
    themeVariables: paper
      ? {
          background: "transparent",
        }
      : {
          background: "transparent",
          primaryTextColor: "#f3ede1",
          secondaryTextColor: "#f3ede1",
          tertiaryTextColor: "#f3ede1",
          lineColor: "#9a9284",
        },
  });
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function renderMermaidBlocks(root: HTMLElement, cancelled?: () => boolean): Promise<void> {
  const blocks = [...root.querySelectorAll<HTMLElement>(".preview-mermaid")];
  if (!blocks.length) return;
  ensureInit();
  for (const block of blocks) {
    if (cancelled?.()) return;
    const srcEl = block.querySelector(".mermaid-src");
    const source = srcEl?.textContent?.trim() || "";
    let view = block.querySelector<HTMLElement>(".mermaid-view");
    if (!view) {
      view = document.createElement("div");
      view.className = "mermaid-view";
      block.appendChild(view);
    }
    if (!source) {
      view.innerHTML = `<p class="mermaid-error">空的 Mermaid 代码块</p>`;
      continue;
    }
    const id = `mermaid-d${++seq}`;
    try {
      const { svg } = await mermaid.render(id, source);
      if (cancelled?.()) return;
      view.innerHTML = svg;
      if (srcEl instanceof HTMLElement) srcEl.hidden = true;
      block.classList.remove("is-error");
    } catch (error) {
      document.getElementById(id)?.remove();
      document.getElementById(`d${id}`)?.remove();
      if (cancelled?.()) return;
      const message = error instanceof Error ? error.message : String(error);
      view.innerHTML = `<p class="mermaid-error">Mermaid 无法渲染：${escapeHtml(message)}</p>`;
      if (srcEl instanceof HTMLElement) srcEl.hidden = false;
      block.classList.add("is-error");
    }
  }
}
