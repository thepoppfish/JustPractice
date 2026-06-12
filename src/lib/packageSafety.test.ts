import { describe, expect, it } from 'vitest';
import { looksLikeUserStorageExport, shipFileSafetyIssue } from '../../scripts/package-safety.mjs';

describe('package-safety', () => {
  it('detects chrome.storage export shape', () => {
    const exportJson = JSON.stringify({
      jpPractice: {
        schemaVersion: 16,
        library: [
          {
            videoId: 'abc',
            title: 't',
            channel: 'c',
            addedAt: 1,
            difficulty: null,
            completedAt: null,
            durationSec: null,
          },
        ],
        videoSeconds: { abc: 120 },
        settings: { dailyGoalMinutes: 30 },
      },
    });
    expect(looksLikeUserStorageExport(exportJson, 'backup.json')).toBe(true);
    expect(shipFileSafetyIssue('backup.json', exportJson)).toMatch(/practice storage/);
  });

  it('ignores manifest.json and JS bundles', () => {
    const manifest = JSON.stringify({ manifest_version: 3, name: 'JustPractice' });
    expect(looksLikeUserStorageExport(manifest, 'manifest.json')).toBe(false);
    expect(shipFileSafetyIssue('assets/index.js', 'const k = "jpPractice";')).toBeNull();
  });

  it('flags export-style filenames', () => {
    expect(shipFileSafetyIssue('justpractice-export-2025.json', '{}')).toMatch(/export-style/);
  });
});
