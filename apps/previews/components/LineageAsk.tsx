'use client';

import { Fragment, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

interface Question {
  q: string;
  lines: string[];
  from: string;
  picture: ReactNode;
}

/**
 * Questions a visitor might put to the guide, written as lines in a notebook, each answered with a story in
 * her own words. Choosing one underlines it in ink and writes its answer in, a word at a time, with a print of the place where there is one. The first answer
 * writes itself in once, when the card first comes into view. Before the script arrives, or with reduced
 * motion asked for, the answer simply shows. Styled by the design through the data attributes below.
 */
export function LineageAsk({ questions, labels, face, name, className }: { questions: Question[]; labels: { choose: string; from: string }; face: ReactNode; name: string; className?: string }) {
  const [active, setActive] = useState(0);
  const [take, setTake] = useState(0);
  const card = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = card.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        io.disconnect();
        setTake((t) => (t === 0 ? 1 : t));
      },
      { threshold: 0.45 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const ask = (i: number) => {
    setActive(i);
    setTake((t) => t + 1);
  };

  const now = questions[active]!;
  let count = 0;

  return (
    <div className={className}>
      <div data-ask-list role="group" aria-label={labels.choose}>
        <p data-ask-title aria-hidden="true">
          {labels.choose}
        </p>
        {questions.map((q, i) => (
          <button key={q.q} type="button" aria-pressed={i === active} onClick={() => ask(i)}>
            <span>
              {q.q}
              <svg data-ink viewBox="0 0 200 10" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                <path d="M2 6.5C40 3 70 9 110 5.5S170 3.5 198 6" pathLength={1} />
              </svg>
            </span>
          </button>
        ))}
      </div>
      <figure ref={card} data-ask-card data-has-print={now.picture ? '' : undefined}>
        <div data-ask-who>
          <div data-ask-face>{face}</div>
          <p>
            <b>{name}</b>
            <span key={`q-${take}`} data-ask-q>
              {now.q}
            </span>
          </p>
        </div>
        <blockquote key={`a-${take}`} data-ask-answer data-writing={take > 0 ? '' : undefined} aria-live="polite">
          {now.lines.map((line) => (
            <p key={line}>
              {line.split(' ').map((w, i) => (
                <Fragment key={`${w}-${i}`}>
                  <span style={{ '--w': count++ } as CSSProperties}>{w}</span>{' '}
                </Fragment>
              ))}
            </p>
          ))}
        </blockquote>
        <figcaption>
          {labels.from} <span>{now.from}</span>
        </figcaption>
        {now.picture && (
          <div key={`p-${take}`} data-ask-print>
            {now.picture}
          </div>
        )}
      </figure>
    </div>
  );
}
