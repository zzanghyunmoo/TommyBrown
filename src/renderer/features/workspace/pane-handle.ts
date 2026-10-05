export interface PaneHandle {
  readonly focus: () => void;
  readonly newTab: () => void;
  readonly closeTab: () => void;
  readonly cycleTab: (offset: number) => void;
  readonly selectTab: (index: number) => void;
}
