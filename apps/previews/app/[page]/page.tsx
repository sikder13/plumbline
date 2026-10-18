import type { Metadata } from 'next';
import { preload } from 'react-dom';
import { Found } from '@/components/Found';
import { MotionLayer } from '@/components/MotionLayer';
import { Shell } from '@/components/Shell';
import { DESIGNS } from '@/designs';
import { allPages, pageByPath, pic } from '@/lib/data';
import { PHONE_MEDIA } from '@/components/Pic';
import { BASE, ENGINE_DESIGNS, FOUND_LINK, SENDER, SENDER_SITE } from '@/lib/offer';
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
  const fonts = typeof design.fonts === 'function' ? design.fonts(data) : design.fonts;
  const heroSizes = typeof design.heroSizes === 'function' ? design.heroSizes(data) : design.heroSizes;
  for (const font of fonts) preload(`${BASE}/fonts/${font}.woff2`, { as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' });
  // A page opening on its words alone has no photo at the top. Every other page names one, and a missing one stops the build.
  const hero = ENGINE_DESIGNS.has(data.design) && !data.images.hero ? null : pic(data, 'hero').sources[0]!;
  const phoneHero = hero ? data.images.heroPhone?.sources[0] : undefined;

  const Demo = design.Demo;
  return (
    <>
      {phoneHero && <link rel="preload" as="image" type={phoneHero.type} imageSrcSet={phoneHero.srcset} imageSizes="100vw" media={PHONE_MEDIA} fetchPriority="high" />}
      {hero && <link rel="preload" as="image" type={hero.type} imageSrcSet={hero.srcset} imageSizes={heroSizes} media={phoneHero ? `not all and ${PHONE_MEDIA}` : undefined} fetchPriority="high" />}
      <Shell business={data.name} foundLink={FOUND_LINK} sender={{ name: SENDER, href: SENDER_SITE }} demo={<Demo data={data} />} found={<Found data={data} />} />
      <MotionLayer />
      <Visits token={data.path} />
    </>
  );
}
