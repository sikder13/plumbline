import type { ReactNode } from 'react';

/**
 * Their minibus seen from above, nose to the right, centred on 0 0: a plain body in the current colour
 * with a single line for the windscreen. It is the one object that drives the whole page.
 */
export function MeanderVan({ className, children }: { className?: string; children?: ReactNode }) {
  return (
    <g className={className}>
      <rect x="-17" y="-8.5" width="34" height="17" rx="4" fill="currentColor" />
      <path d="M9.5 -6.2V6.2" stroke="#0f1519" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M-13 -8.5H5M-13 8.5H5" stroke="#0f1519" strokeOpacity="0.28" strokeWidth="1.2" />
      {children}
    </g>
  );
}

export interface RoadCls {
  edge: string;
  fill: string;
  lane: string;
}

/**
 * A stretch of road in fine line work: two edge lines (a broad stroke with a narrower one of the ground
 * colour laid inside it) and a dashed line down the middle.
 */
export function MeanderRoad({ d, cls, id, track }: { d: string; cls: RoadCls; id?: string; track?: boolean }) {
  return (
    <>
      <path d={d} className={cls.edge} id={id} data-track={track ? '' : undefined} />
      <path d={d} className={cls.fill} />
      <path d={d} className={cls.lane} />
    </>
  );
}
