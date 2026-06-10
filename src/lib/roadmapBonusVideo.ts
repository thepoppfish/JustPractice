import { inProgressLibraryItems } from './storageMigrate';
import type {
  LibraryItem,
  PersistedData,
  RoadmapBonusPick,
  RoadmapBonusTier,
  RoadmapCompletionSnapshot,
} from './storageTypes';
import { videoHasWatchTime } from './videoDailyPractice';
import type { RoadmapUiMode } from './todayPathTypes';

export type { RoadmapBonusTier };

export const ROADMAP_BONUS_SHORT_MAX_SEC = 10 * 60;
export const ROADMAP_BONUS_MEDIUM_MAX_SEC = 25 * 60;

export const ROADMAP_BONUS_MULTIPLIER: Record<RoadmapBonusTier, number> = {
  short: 1.5,
  medium: 2,
  long: 3,
};

export interface RoadmapBonusCandidateVm {
  videoId: string;
  title: string;
  durationSec: number;
}

export interface RoadmapBonusTierVm {
  tier: RoadmapBonusTier;
  multiplier: number;
  candidate: RoadmapBonusCandidateVm | null;
  isSelected: boolean;
  canPick: boolean;
}

export interface RoadmapBonusUiState {
  showPicker: boolean;
  tiers: RoadmapBonusTierVm[];
  activePick: RoadmapBonusPick | null;
  canChangePick: boolean;
}

export function tierForDurationSec(durationSec: number): RoadmapBonusTier | null {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return null;
  if (durationSec < ROADMAP_BONUS_SHORT_MAX_SEC) return 'short';
  if (durationSec <= ROADMAP_BONUS_MEDIUM_MAX_SEC) return 'medium';
  return 'long';
}

export function normalizeRoadmapBonusPick(raw: unknown): RoadmapBonusPick | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const dateKey = typeof o.dateKey === 'string' ? o.dateKey : '';
  const videoId = typeof o.videoId === 'string' ? o.videoId : '';
  const tier = o.tier === 'short' || o.tier === 'medium' || o.tier === 'long' ? o.tier : null;
  if (!dateKey || !videoId || !tier) return null;
  const multiplier =
    typeof o.multiplier === 'number' && Number.isFinite(o.multiplier) && o.multiplier > 0
      ? o.multiplier
      : ROADMAP_BONUS_MULTIPLIER[tier];
  const pickedAtMs =
    typeof o.pickedAtMs === 'number' && Number.isFinite(o.pickedAtMs) ? o.pickedAtMs : Date.now();
  const videoSecondsBaselineAtPick =
    typeof o.videoSecondsBaselineAtPick === 'number' && Number.isFinite(o.videoSecondsBaselineAtPick)
      ? Math.max(0, Math.floor(o.videoSecondsBaselineAtPick))
      : 0;
  return { dateKey, videoId, tier, multiplier, pickedAtMs, videoSecondsBaselineAtPick };
}

function snapshotVideoIds(snapshot: RoadmapCompletionSnapshot | null | undefined): Set<string> {
  const ids = new Set<string>();
  if (!snapshot) return ids;
  for (const step of snapshot.steps) ids.add(step.videoId);
  return ids;
}

function bonusEligibleItems(
  data: PersistedData,
  todayKey: string,
  snapshot: RoadmapCompletionSnapshot | null | undefined,
): LibraryItem[] {
  const exclude = snapshotVideoIds(snapshot);
  const out: LibraryItem[] = [];
  for (const item of inProgressLibraryItems(data.library)) {
    const d = item.durationSec;
    if (typeof d !== 'number' || !Number.isFinite(d) || d <= 0) continue;
    if (exclude.has(item.videoId)) continue;
    if (videoHasWatchTime(data, item.videoId, todayKey)) continue;
    out.push(item);
  }
  return out;
}

function recommendForTier(items: LibraryItem[], tier: RoadmapBonusTier): LibraryItem | null {
  const band = items.filter((item) => tierForDurationSec(item.durationSec!) === tier);
  if (band.length === 0) return null;
  return band.slice().sort((a, b) => a.addedAt - b.addedAt)[0]!;
}

export function recommendBonusCandidates(
  data: PersistedData,
  todayKey: string,
  snapshot: RoadmapCompletionSnapshot | null | undefined,
): Record<RoadmapBonusTier, RoadmapBonusCandidateVm | null> {
  const eligible = bonusEligibleItems(data, todayKey, snapshot);
  const toVm = (item: LibraryItem | null): RoadmapBonusCandidateVm | null => {
    if (!item) return null;
    const d = item.durationSec!;
    return { videoId: item.videoId, title: item.title, durationSec: d };
  };
  return {
    short: toVm(recommendForTier(eligible, 'short')),
    medium: toVm(recommendForTier(eligible, 'medium')),
    long: toVm(recommendForTier(eligible, 'long')),
  };
}

export function hasPracticedSinceBonusPick(
  data: Pick<PersistedData, 'videoSeconds'>,
  pick: RoadmapBonusPick,
): boolean {
  const now = data.videoSeconds[pick.videoId] ?? 0;
  return now > pick.videoSecondsBaselineAtPick;
}

export function canChangeRoadmapBonusPick(
  data: PersistedData,
  todayKey: string,
): boolean {
  const pick = normalizeRoadmapBonusPick(data.roadmapBonusPick);
  if (!pick || pick.dateKey !== todayKey) return true;
  return !hasPracticedSinceBonusPick(data, pick);
}

export function buildRoadmapBonusPick(
  data: PersistedData,
  todayKey: string,
  tier: RoadmapBonusTier,
  videoId: string,
): RoadmapBonusPick | null {
  const item = data.library.find((i) => i.videoId === videoId && i.completedAt === null);
  if (!item) return null;
  const d = item.durationSec;
  if (typeof d !== 'number' || tierForDurationSec(d) !== tier) return null;
  return {
    dateKey: todayKey,
    videoId,
    tier,
    multiplier: ROADMAP_BONUS_MULTIPLIER[tier],
    pickedAtMs: Date.now(),
    videoSecondsBaselineAtPick: data.videoSeconds[videoId] ?? 0,
  };
}

export function roadmapBonusMultiplierForPractice(
  data: PersistedData,
  videoId: string,
  dateKey: string,
): number {
  const pick = normalizeRoadmapBonusPick(data.roadmapBonusPick);
  if (!pick || pick.dateKey !== dateKey || pick.videoId !== videoId) return 1;
  return pick.multiplier;
}

export function resolveRoadmapBonusUi(
  data: PersistedData,
  todayKey: string,
  pathMode: RoadmapUiMode,
  pathNodeCount: number,
): RoadmapBonusUiState {
  const empty: RoadmapBonusUiState = {
    showPicker: false,
    tiers: [],
    activePick: null,
    canChangePick: true,
  };
  if (pathMode !== 'completed' || pathNodeCount === 0) return empty;

  const snapshot = data.roadmapCompletionSnapshot ?? null;
  const candidates = recommendBonusCandidates(data, todayKey, snapshot);
  const activePick = normalizeRoadmapBonusPick(data.roadmapBonusPick);
  const pickValid = activePick?.dateKey === todayKey ? activePick : null;
  const canChange = canChangeRoadmapBonusPick(data, todayKey);

  const libraryById = new Map(data.library.map((i) => [i.videoId, i]));

  const tiers: RoadmapBonusTierVm[] = (['short', 'medium', 'long'] as const).map((tier) => {
    let candidate = candidates[tier];
    if (pickValid?.tier === tier) {
      const picked = libraryById.get(pickValid.videoId);
      const d = picked?.durationSec;
      if (picked && typeof d === 'number' && tierForDurationSec(d) === tier) {
        candidate = { videoId: picked.videoId, title: picked.title, durationSec: d };
      }
    }
    const isSelected = pickValid?.tier === tier && pickValid.videoId === candidate?.videoId;
    return {
      tier,
      multiplier: ROADMAP_BONUS_MULTIPLIER[tier],
      candidate,
      isSelected: Boolean(isSelected),
      canPick: Boolean(candidate) && (canChange || isSelected),
    };
  });

  const anyCandidate = tiers.some((t) => t.candidate !== null);
  return {
    showPicker: anyCandidate || pickValid !== null,
    tiers,
    activePick: pickValid,
    canChangePick: canChange,
  };
}
