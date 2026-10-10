import { CHECK_IDS, registryProblems } from '@plumbline/checks';
import { loadLibraryRaw, validateLibrary } from './index.ts';

const errors = [...validateLibrary(loadLibraryRaw(), CHECK_IDS), ...registryProblems()];
if (errors.length) {
  console.error(`impact library and checks: ${errors.length} problem(s)`);
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}
console.log(`impact library: ${CHECK_IDS.length} checks, each with a module and a valid entry`);
