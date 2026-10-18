/** One row of a wave list, with the columns the run reads. */
export interface WaveRow {
  order: number;
  status: 'wave' | 'reserve';
  slug: string;
  name: string;
  town: string;
  region: string;
  category: string;
  activity: string;
  website: string;
  email: string;
  emailSourceUrl: string;
  phone: string;
  ownerNames: string;
  greeting: string;
  ownerSource1: string;
  ownerSource2: string;
  reviews: string;
  bookingSystem: string;
  multiBusiness: string;
  notes: string;
}

export function waveRows(records: Record<string, string>[]): WaveRow[] {
  return records
    .filter((r) => r.slug)
    .map((r) => ({
      order: Number(r.order),
      status: /^reserve/i.test(r.status ?? '') ? ('reserve' as const) : ('wave' as const),
      slug: r.slug!,
      name: r.business_name ?? r.slug!,
      town: r.town ?? '',
      region: r.region ?? '',
      category: r.category ?? '',
      activity: r.activity_type ?? '',
      website: r.website ?? '',
      email: (r.email ?? '').trim(),
      emailSourceUrl: r.email_source_url ?? '',
      phone: r.phone ?? '',
      ownerNames: r.owner_names ?? '',
      greeting: r.greeting ?? '',
      ownerSource1: r.owner_source_url_1 ?? '',
      ownerSource2: r.owner_source_url_2 ?? '',
      reviews: r.reviews ?? '',
      bookingSystem: r.booking_system ?? '',
      multiBusiness: r.multi_business ?? '',
      notes: r.notes ?? '',
    }));
}

/** The first names the greeting uses: "Mike and Nans" is Mike and Nans. */
export function greetingNames(greeting: string): string[] {
  return greeting
    .split(/\s*(?:,|&|\band\b)\s*/i)
    .map((n) => n.trim())
    .filter(Boolean);
}

/**
 * The ways a greeting name may be written on a page: as given, and as any first name in the owner
 * list that it is a short form of ("Malc" and "Malcolm") or the reverse.
 */
export function nameForms(name: string, ownerNames: string): string[] {
  const forms = new Set([name]);
  const lower = name.toLowerCase();
  for (const word of ownerNames.replace(/\([^)]*\)/g, ' ').split(/[^\p{L}'-]+/u)) {
    const w = word.toLowerCase();
    if (w.length >= 3 && lower.length >= 3 && (w.startsWith(lower) || lower.startsWith(w))) forms.add(word);
  }
  return [...forms];
}
