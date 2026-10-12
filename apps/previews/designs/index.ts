import type { Design } from './types';
import { coastal } from './coastal';
import { earth } from './earth';
import { journal } from './journal';
import { label } from './label';
import { waterline } from './waterline';

/** One design per business. No two share a layout, a type pairing or a way of showing the top photo. */
export const DESIGNS: Record<string, Design> = { coastal, earth, journal, label, waterline };
