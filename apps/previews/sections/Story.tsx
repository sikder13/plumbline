import type { StorySection } from '@plumbline/preview/types';
import { Pic } from '@/components/Pic';
import { Pinned } from '@/components/Pinned';
import { pic } from '@/lib/data';
import { coverSizes, two, type Ctx } from './kit';
import s from './sections.module.css';

/**
 * The pinned story: the frame holds still while the visitor scrolls through three to five steps.
 * `wipe` opens each photograph over the last from the side, under a large numeral;
 * `stack` deals the steps as cards, each sliding up over the one before;
 * `rail` keeps one window of photograph beside a rail that fills as the steps go by;
 * `words` needs no photographs: the lines themselves light up in turn.
 */
export function Story({ section: st, data }: Ctx & { section: StorySection }) {
  const first = (i: number) => (i === 0 ? 'on' : 'off');
  const steps = st.steps;
  const photo = (i: number, phone: { vw: number; shape: number }, desktop: string) => {
    const key = steps[i]!.image;
    if (!key) return null;
    const p = pic(data, key);
    return <Pic pic={p} sizes={coverSizes(p, phone, desktop)} />;
  };
  return (
    <section className={s.storyWrap} id={st.id} aria-labelledby="story-h" data-variant={st.variant}>
      <Pinned steps={steps.length} className={s.story}>
        {st.variant === 'wipe' &&
          steps.map((step, i) => (
            <div key={step.label} className={s.storyPhoto} data-step={i} data-state={first(i)}>
              {photo(i, { vw: 100, shape: 0.47 }, '100vw')}
            </div>
          ))}
        <header className={s.storyHead}>
          <h2 id="story-h">{st.heading}</h2>
          <p className={s.storyCount} aria-hidden="true">
            {steps.map((step, i) => (
              <span key={step.label} data-step={i} data-state={first(i)}>
                {two(i + 1)}
              </span>
            ))}
            <i>/ {two(steps.length)}</i>
          </p>
        </header>
        {st.variant === 'rail' && (
          <div className={s.storyWindow}>
            {steps.map((step, i) => (
              <div key={step.label} data-step={i} data-state={first(i)}>
                {photo(i, { vw: 88, shape: 0.9 }, '42vw')}
              </div>
            ))}
          </div>
        )}
        <ol className={s.storySteps}>
          {steps.map((step, i) => (
            <li key={step.label} data-step={i} data-state={first(i)}>
              {st.variant === 'stack' && <div className={s.storyCardPhoto}>{photo(i, { vw: 88, shape: 1.1 }, '560px')}</div>}
              <div className={s.storyText}>
                <h3>{step.label}</h3>
                <p>{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className={s.storyBar} aria-hidden="true">
          <i />
        </div>
      </Pinned>
    </section>
  );
}
