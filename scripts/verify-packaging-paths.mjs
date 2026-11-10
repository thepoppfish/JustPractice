/** Exercise the actual packager in a path that used to break PowerShell archives. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { root, distDir, collectDistClosure } from './package-dist-closure.mjs';

const prefix = "JustPractice user's בדיקה [paths]-";
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
function cleanupTemporary() {
  const resolved = path.resolve(temporary);
  if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith(prefix)) {
    throw new Error('Refusing cleanup outside the owned temporary directory');
  }
  fs.rmSync(resolved, { recursive: true, force: true });
}
try {
  fs.cpSync(distDir, path.join(temporary, 'dist'), { recursive: true });
  fs.mkdirSync(path.join(temporary, 'scripts'));
  for (const script of ['package-extension.mjs', 'package-dist-closure.mjs', 'package-safety.mjs', 'verify-extension-dist.mjs']) {
    fs.copyFileSync(path.join(root, 'scripts', script), path.join(temporary, 'scripts', script));
  }
  const result = spawnSync(process.execPath, [path.join(temporary, 'scripts/package-extension.mjs')], {
    cwd: temporary, encoding: 'utf8',
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || 'Packaging failed');
  const { version } = JSON.parse(fs.readFileSync(path.join(distDir, 'manifest.json'), 'utf8'));
  const zip = fs.readFileSync(path.join(temporary, 'release', `justpractice-${version}.zip`));
  // Inspect the central directory of this trusted, freshly generated archive.
  // No extraction or external unzip tool is needed on either CI platform.
  const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (end < 0) throw new Error('Archive has no end-of-directory record');
  const count = zip.readUInt16LE(end + 10);
  let cursor = zip.readUInt32LE(end + 16);
  const names = [];
  for (let i = 0; i < count; i++) {
    if (zip.readUInt32LE(cursor) !== 0x02014b50) throw new Error('Invalid ZIP directory');
    const nameLength = zip.readUInt16LE(cursor + 28);
    names.push(zip.toString('utf8', cursor + 46, cursor + 46 + nameLength).replaceAll('\\', '/'));
    cursor += 46 + nameLength + zip.readUInt16LE(cursor + 30) + zip.readUInt16LE(cursor + 32);
  }
  const files = names.filter((name) => !name.endsWith('/')).sort();
  const expected = [...collectDistClosure()].sort();
  if (JSON.stringify(files) !== JSON.stringify(expected)) throw new Error('ZIP does not match the verified runtime closure');
  if (!files.includes('manifest.json')) throw new Error('Manifest is not at the ZIP root');
  console.info(`[packaging-paths] Passed spaces, apostrophe, Unicode and literal brackets; ${files.length} runtime files, manifest at root.`);
} finally {
  cleanupTemporary();
}
