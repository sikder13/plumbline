import type { Design } from './types';
import { coastal } from './coastal';
import { earth } from './earth';
import { journal } from './journal';
import { label } from './label';
import { loop } from './loop';
import { waterline } from './waterline';
import { recipe } from '@/sections/Recipe';

/** The wave 1 pages each have a design of their own, as does a page made to order. A later page is laid out from its recipe by the section library. */
export const DESIGNS: Record<string, Design> = { coastal, earth, journal, label, loop, waterline, recipe };
