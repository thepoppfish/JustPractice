/** Reject new advisories while retaining one narrowly reviewed tooling exception. */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const result = spawnSync(process.execPath, [process.env.npm_execpath, 'audit', '--json'], {
  encoding: 'utf8',
});
if (result.error || ![0, 1].includes(result.status)) {
  throw result.error ?? new Error(result.stderr || 'npm audit did not complete');
}
const report = JSON.parse(result.stdout);
if (report.error || !report.vulnerabilities) throw new Error('Invalid npm audit response');
const exception = 'https://github.com/advisories/GHSA-g3hv-75wg-m249';
const exceptionExpires = Date.parse('2027-02-09T00:00:00Z');
const lock = JSON.parse(fs.readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));
let accepted = 0;
const rejected = [];
for (const [name, finding] of Object.entries(report.vulnerabilities)) {
  // npm reports the same minimatch advisory through six typescript-eslint parents.
  const allowedPackage = name === 'minimatch' || name === 'typescript-eslint' ||
    name.startsWith('@typescript-eslint/');
  const reviewed = allowedPackage && finding.severity === 'moderate' &&
    Date.now() < exceptionExpires && finding.via.length > 0 &&
    finding.via.every((via) => typeof via === 'string'
      ? via === 'minimatch' || via.startsWith('@typescript-eslint/')
      : via.url === exception) &&
    finding.nodes.every((node) => lock.packages[node]?.dev === true);
  if (reviewed) accepted++;
  else rejected.push(`${name}: ${finding.severity}`);
}
if (rejected.length) throw new Error(`Unreviewed advisories:\n${rejected.join('\n')}`);
console.info(`[audit] No unreviewed advisories; ${accepted} tooling entries covered by the minimatch exception (expires 2027-02-09).`);
