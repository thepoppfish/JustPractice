/** Render the preserved baseline requirements and their current verification evidence. */
import fs from 'node:fs';
import path from 'node:path';
import { root } from './package-dist-closure.mjs';

const directory = path.join(root, 'docs', 'polish');
const items = JSON.parse(fs.readFileSync(path.join(directory, 'backlog.json'), 'utf8'));
const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);
const label = {
  merged: 'Merged',
  'implemented-awaiting-review': 'Implemented · PR open',
  'verification-pending': 'Implemented · verification outstanding',
  open: 'Open',
};
const counts = items.reduce((result, item) => {
  result[item.status] = (result[item.status] ?? 0) + 1;
  return result;
}, {});
const details = items.map((item) => `<article id="${escape(item.id)}">
<h2>${escape(item.id)} · ${escape(item.title)}</h2>
<p class="status">${escape(label[item.status] ?? item.status)}${item.pr ? ` · <a href="https://github.com/thepoppfish/JustPractice/pull/${item.pr}">PR #${item.pr}</a>` : ''}</p>
<p>${escape(item.action)}</p>
<p><strong>Acceptance:</strong> ${escape(item.accept)}</p>
${item.verification ? `<p><strong>Verification:</strong> ${escape(item.verification)}</p>` : ''}
${item.pendingChecks?.length ? `<p class="pending"><strong>Outstanding:</strong> ${item.pendingChecks.map(escape).join('; ')}</p>` : ''}
${item.checks?.length ? `<ul>${item.checks.map((check) => `<li>${check.href ? `<a href="${escape(check.href)}">${escape(check.text)}</a>` : escape(check.text)}</li>`).join('')}</ul>` : ''}
<details><summary>Original baseline evidence</summary><p>${escape(item.evidence)}</p>${item.image ? `<a href="../../output/playwright/baseline-2026-11-09/${escape(item.image)}">Original screenshot</a>` : ''}</details>
</article>`).join('\n');
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>JustPractice · baseline progress</title><style>
*{box-sizing:border-box}body{margin:0;background:#101318;color:#ebedf2;font:16px/1.65 system-ui}main{max-width:1080px;margin:auto;padding:32px 24px}a{color:#ffc18e}a:focus-visible,summary:focus-visible{outline:3px solid #ffd08a;outline-offset:4px}h1,h2{line-height:1.25}h2{font-size:22px}article{padding:24px 0;border-bottom:1px solid #46505f;scroll-margin-top:24px}nav{display:flex;flex-wrap:wrap;gap:12px}.status{color:#b1edc0;font-weight:600}.pending{padding:12px;background:#35261b;border-left:3px solid #ffa466}details{color:#b7bdc8}summary{cursor:pointer}li{margin:8px 0}code{overflow-wrap:anywhere}.note{padding:16px;background:#202630;border-radius:8px}
</style><main><h1>JustPractice · baseline progress</h1>
<p>All 21 original requirements retained. Updated ${escape(new Date().toISOString().slice(0, 10))}.</p>
<p class="note">${escape(Object.entries(counts).map(([status, count]) => `${count} ${label[status] ?? status}`).join(' · '))}. Merges and publishing remain with the maintainer. Open PRs are not represented as merged or released.</p>
<p><a href="../../output/playwright/baseline-2026-11-09/baseline-review.html#backlog">Original review</a> · <a href="backlog.json">Machine-readable tracker</a> · <a href="dependency-review.md">Dependency review</a></p>
<p>Screenshot and trace links refer to local review artifacts under <code>output/playwright/</code>; they are not part of the extension or the public documentation deployment. Public PRs include the maintained code and CI artifacts.</p>
<nav aria-label="Baseline items">${items.map((item) => `<a href="#${escape(item.id)}">${escape(item.id)}</a>`).join('')}</nav>
${details}</main></html>\n`;
fs.writeFileSync(path.join(directory, 'index.html'), html);
const baselinePath = path.join(root, 'output/playwright/baseline-2026-11-09/baseline-review.html');
if (fs.existsSync(baselinePath)) {
  let baseline = fs.readFileSync(baselinePath, 'utf8');
  const banner = '<aside id="polish-progress-link" style="padding:16px;background:#202630;color:#ebedf2"><a style="color:#ffc18e" href="../../../docs/polish/index.html">Open the current 21-item progress tracker and verification evidence</a></aside>';
  baseline = baseline.includes('id="polish-progress-link"')
    ? baseline.replace(/<aside id="polish-progress-link"[\s\S]*?<\/aside>/, banner)
    : baseline.replace(/<body[^>]*>/, (body) => body + banner);
  fs.writeFileSync(baselinePath, baseline);
}
console.info(`[polish-review] Rendered ${items.length} preserved requirements.`);
