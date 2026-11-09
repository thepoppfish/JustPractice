# Synthetic performance input

`performance-base.json` is a frozen schema-16 synthetic record from the
November 2026 visual review. It contains no personal browser export. Keeping a
source fixture lets another checkout repeat a before/after workload without
depending on local `output/` files.

The profiling scripts replace its library and per-video maps. The watch workload
also clears daily totals and disables focus gating/XP toasts; it uses a real
media element playing a locally generated canvas stream. Library workloads
generate new valid membership tokens, deterministic IDs/titles/levels and an
80% active / 20% completed split. The fixed historical dates are synthetic;
they are not current usage statistics.

The scripts load a disposable installed Chromium profile and never read or
write a personal Chrome profile. Their JSON, screenshots, CPU profiles and
traces go under the requested `output/` directory and are not runtime files.
