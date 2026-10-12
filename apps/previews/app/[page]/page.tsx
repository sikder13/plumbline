import type { Metadata } from 'next';
import { preload } from 'react-dom';
import { Found } from '@/components/Found';
import { Motion } from '@/components/Motion';
import { Shell } from '@/components/Shell';
import { DESIGNS } from '@/designs';
import { allPages, pageByPath, pic } from '@/lib/data';
import { BASE, barLine } from '@/lib/offer';
import { Visits } from '@/components/Visits';

export const dynamicParams = false;

export function generateStaticParams() {
  return allPages().map((p) => ({ page: p.path }));
}

export async function generateMetadata({ params }: { params: Promise<{ page: string }> }): Promise<Metadata> {
  const data = pageByPath((await params).page);
  return { title: `${data.name}: design demo` };
}

export default async function Page({ params }: { params: Promise<{ page: string }> }) {
  const data = pageByPath((await params).page);
  const design = DESIGNS[data.design];
  if (!design) throw new Error(`${data.slug}: no design called "${data.design}"`);

  // The first things a phone needs: the type the page is set in and the photo at the top.
  for (const font of design.fonts) preload(`${BASE}/fonts/${font}.woff2`, { as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' });
  const hero = pic(data, 'hero').sources[0]!;
  preload(hero.srcset.split(' ')[0]!, { as: 'image', type: hero.type, imageSrcSet: hero.srcset, imageSizes: design.heroSizes, fetchPriority: 'high' });

  const Demo = design.Demo;
  return (
    <>
      <Shell line={barLine(data.name)} demo={<Demo data={data} />} found={<Found data={data} />} />
      <Motion />
      <Visits token={data.path} />
    </>
  );
}
