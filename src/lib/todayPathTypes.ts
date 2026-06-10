import type { LibraryItem } from './storageTypes';

export type PathNodeState = 'stepCompleted' | 'active' | 'available';

export interface TodayPathNodeVm {
  item: LibraryItem;
  durationSec: number;
  allocatedSec: number;
  practicedTodayAtBuild: number;
  practicedSecOnStep: number;
  showVideoLengthTotal: boolean;
  state: PathNodeState;
  side: 'left' | 'right' | 'center';
}

export type RoadmapUiMode = 'active' | 'completed';
