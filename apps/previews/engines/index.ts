import type { EngineDemo } from '@plumbline/preview/engine';
import type { Design } from '@/designs/types';
import type { PageData } from '@/lib/data';
import { fishing } from './fishing/fishing';
import { SPLIT_SIZES } from './sizes';
import { paddle } from './paddle/paddle';
import { physio } from './physio/physio';
import { stay } from './stay/stay';

/** The page engines, as designs: each renders any page whose settings name it. */
const demo = (data: PageData) => data.demo as EngineDemo;
const engine = (Demo: Design['Demo']): Design => ({
  Demo,
  fonts: (data) => demo(data).pair.preload,
  heroSizes: (data) => (demo(data).heroKind === 'split' ? SPLIT_SIZES : '100vw'),
});

export const ENGINES_AS_DESIGNS: Record<string, Design> = {
  fishing: engine(fishing.Demo),
  paddle: engine(paddle.Demo),
  stay: engine(stay.Demo),
  physio: engine(physio.Demo),
};
