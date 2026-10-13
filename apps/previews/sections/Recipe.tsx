import type { CSSProperties } from 'react';
import type { Recipe, Section } from '@plumbline/preview/types';
import { DemoFoot } from '@/components/DemoFoot';
import type { Design } from '@/designs/types';
import type { PageData } from '@/lib/data';
import { Action } from './Action';
import { Hero, heroSizes } from './Hero';
import type { Ctx } from './kit';
import { List } from './List';
import { Numbers } from './Numbers';
import { Rows } from './Rows';
import { Story } from './Story';
import { TYPE } from './type';
import { Visit } from './Visit';
import { Wipes } from './Wipes';
import { Words } from './Words';
import s from './sections.module.css';

function View({ section, ...ctx }: Ctx & { section: Section }) {
  switch (section.kind) {
    case 'hero':
      return <Hero section={section} {...ctx} />;
    case 'story':
      return <Story section={section} {...ctx} />;
    case 'rows':
      return <Rows section={section} {...ctx} />;
    case 'wipes':
      return <Wipes section={section} {...ctx} />;
    case 'numbers':
      return <Numbers section={section} {...ctx} />;
    case 'words':
      return <Words section={section} {...ctx} />;
    case 'list':
      return <List section={section} {...ctx} />;
    case 'visit':
      return <Visit section={section} {...ctx} />;
  }
}

const recipeOf = (data: PageData) => data.demo as Recipe;

/** A page laid out from its recipe: the palette and the faces set once at the root, then the sections in order. */
function Demo({ data }: { data: PageData }) {
  const recipe = recipeOf(data);
  const t = TYPE[recipe.type];
  const p = recipe.palette;
  const vars = {
    '--paper': p.paper,
    '--ink': p.ink,
    '--soft': p.soft,
    '--deep': p.deep,
    '--on-deep': p.onDeep,
    '--accent': p.accent,
    '--on-accent': p.onAccent,
    '--display': t.display,
    '--body': t.body,
    '--dw': t.weight,
    '--ds': t.italic ? 'italic' : 'normal',
    '--dt': t.tracking,
    '--dl': t.leading,
    '--dc': t.upper ? 'uppercase' : 'none',
    '--dscale': t.scale,
  } as CSSProperties;
  const [hero, ...rest] = recipe.sections;
  const ctx = { data, recipe };
  return (
    <div className={s.root} style={vars} data-family={p.family}>
      {hero && <View section={hero} {...ctx} />}
      <main>
        {rest.map((section, i) => (
          <View key={`${section.kind}-${i}`} section={section} {...ctx} />
        ))}
      </main>
      <footer className={s.foot}>
        <p className={`${s.footName} ${s.display}`}>{data.name}</p>
        <DemoFoot domain={data.domain} />
      </footer>
      <Action recipe={recipe} />
    </div>
  );
}

export const recipe: Design = {
  Demo,
  fonts: (data) => TYPE[recipeOf(data).type].fonts,
  heroSizes: (data) => heroSizes(recipeOf(data).sections.find((x) => x.kind === 'hero')),
};
