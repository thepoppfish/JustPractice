/**
 * Dist runtime closure: files reachable from manifest.json + HTML/JS imports.
 * Shared by package audit and store zip scripts.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const root = path.resolve(__dirname, '..');
export const distDir = path.join(root, 'dist');

/** Extension pages opened via chrome.runtime.getURL but not listed in manifest.json. */
export const EXTRA_DIST_SEEDS = ['src/welcome/index.html'];

export function norm(p) {
  return p.split(path.sep).join('/');
}

function readText(absPath) {
  try {
    return fs.readFileSync(absPath, 'utf8');
  } catch {
    return null;
  }
}

/** Resolve reference from a dist file to a dist-relative path. */
function resolveDistRef(fromRel, ref) {
  const r = ref.trim();
  if (r.startsWith('http://') || r.startsWith('https://') || r.startsWith('data:')) {
    return null;
  }
  if (r.startsWith('/')) {
    return norm(r.slice(1));
  }
  const fromDir = path.dirname(fromRel);
  return norm(path.normalize(path.join(fromDir, r)));
}

function extractRefsFromHtml(text, fromRel) {
  const out = [];
  const re = /(?:src|href)=["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const resolved = resolveDistRef(fromRel, m[1]);
    if (resolved) out.push(resolved);
  }
  return out;
}

function extractRefsFromJs(text, fromRel) {
  const out = [];
  const re = /import\s*(?:[\s\S]*?\sfrom\s*)?["'](\.[^"']+)["']/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const resolved = resolveDistRef(fromRel, m[1]);
    if (resolved) out.push(resolved);
  }
  return out;
}

/** @returns {Set<string>} dist-relative paths required at runtime */
export function collectDistClosure() {
  const required = new Set();
  const manifestPath = path.join(distDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) return required;

  const manifest = JSON.parse(readText(manifestPath));
  const queue = ['manifest.json'];
  const seen = new Set();

  if (manifest.background?.service_worker) {
    queue.push(norm(manifest.background.service_worker));
  }
  for (const icon of Object.values(manifest.icons ?? {})) {
    if (typeof icon === 'string') queue.push(norm(icon));
  }
  if (manifest.action?.default_popup) queue.push(norm(manifest.action.default_popup));
  if (manifest.action?.default_icon) {
    for (const icon of Object.values(manifest.action.default_icon)) {
      if (typeof icon === 'string') queue.push(norm(icon));
    }
  }
  if (manifest.options_ui?.page) queue.push(norm(manifest.options_ui.page));
  for (const cs of manifest.content_scripts ?? []) {
    for (const js of cs.js ?? []) queue.push(norm(js));
  }
  for (const seed of EXTRA_DIST_SEEDS) queue.push(norm(seed));

  while (queue.length > 0) {
    const rel = queue.shift();
    if (!rel || seen.has(rel)) continue;
    seen.add(rel);
    required.add(rel);

    const abs = path.join(distDir, rel);
    if (!fs.existsSync(abs)) continue;

    const text = readText(abs);
    if (!text) continue;

    let refs = [];
    if (rel.endsWith('.html')) refs = extractRefsFromHtml(text, rel);
    else if (rel.endsWith('.js')) refs = extractRefsFromJs(text, rel);

    for (const ref of refs) {
      if (!seen.has(ref)) queue.push(ref);
    }
  }

  return required;
}

export function listDistFiles() {
  /** @type {string[]} */
  const files = [];
  function walk(absDir, relPrefix) {
    if (!fs.existsSync(absDir)) return;
    for (const name of fs.readdirSync(absDir)) {
      const abs = path.join(absDir, name);
      const rel = relPrefix ? `${relPrefix}/${name}` : name;
      const st = fs.statSync(abs);
      if (st.isDirectory()) walk(abs, rel);
      else if (st.isFile()) files.push(norm(rel));
    }
  }
  walk(distDir, '');
  return files.sort();
}
