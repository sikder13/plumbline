import { CHECK_IDS } from '@plumbline/checks/ids';
import { loadLibraryRaw, validateLibrary } from './index.ts';

const errors = validateLibrary(loadLibraryRaw(), CHECK_IDS);
if (errors.length) {
  console.error(`impact library: ${errors.length} problem(s)`);
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}
console.log(`impact library: ${CHECK_IDS.length} checks, all entries valid`);
