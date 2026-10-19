/** The Indiana INBiz new business filings export: tab separated, Windows-1252. */

export interface Filing {
  control: string;
  typeCode: string;
  typeDesc: string;
  /** Filing date as YYYY-MM-DD. */
  created: string;
  name: string;
  address: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
  agent: string;
}

/** "09/12/2026 00:00:00" as "2026-09-12". */
export function isoDate(us: string): string {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(us.trim());
  if (!m) return '';
  return `${m[3]}-${m[1]!.padStart(2, '0')}-${m[2]!.padStart(2, '0')}`;
}

/**
 * Every row as a filing. A row with a stray extra field (a tab inside a value) keeps its leading
 * fields by position and its type from the second to last field, where the export always puts it.
 */
export function readInbiz(raw: Buffer): Filing[] {
  const text = new TextDecoder('windows-1252').decode(raw);
  const lines = text.split(/\r?\n/).filter((l) => l.length);
  const header = lines.shift()!.split('\t').map((h) => h.trim());
  const at = (name: string) => {
    const i = header.indexOf(name);
    if (i < 0) throw new Error(`the export has no column ${name}`);
    return i;
  };
  const col = {
    control: at('Original_control_number'),
    typeCode: at('Corporation_type'),
    created: at('Creation_date'),
    name: at('Corporation_Name'),
    address: at('Corporation_address_1'),
    address2: at('Corporation_address_2'),
    city: at('Corporation_city'),
    state: at('Corporation_state'),
    zip: at('Corporation_zip_code'),
    agent: at('Agent_name'),
  };
  return lines.map((line) => {
    const f = line.split('\t');
    const get = (i: number) => (f[i] ?? '').trim();
    return {
      control: get(col.control),
      typeCode: get(col.typeCode),
      typeDesc: (f.length > header.length ? f[f.length - 2] ?? '' : get(at('Corporation_type_desc'))).trim(),
      created: isoDate(get(col.created)),
      name: get(col.name),
      address: get(col.address),
      address2: get(col.address2),
      city: get(col.city),
      state: get(col.state),
      zip: get(col.zip),
      agent: get(col.agent),
    };
  });
}
