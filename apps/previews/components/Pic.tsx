import type { CSSProperties } from 'react';
import type { Picture } from '@/lib/data';

interface Props {
  pic: Picture;
  /** The width the image takes at each screen size, in the form the browser's `sizes` uses. */
  sizes: string;
  /** Set for the one image at the top of the page. Everything else loads as it nears the screen. */
  first?: boolean;
  className?: string;
  alt?: string;
  style?: CSSProperties;
}

export function Pic({ pic, sizes, first, className, alt, style }: Props) {
  return (
    <picture>
      {pic.sources.map((s) => (
        <source key={s.type} type={s.type} srcSet={s.srcset} sizes={sizes} />
      ))}
      <img
        src={pic.fallback}
        width={pic.width}
        height={pic.height}
        alt={alt ?? pic.alt}
        loading={first ? 'eager' : 'lazy'}
        decoding={first ? 'sync' : 'async'}
        fetchPriority={first ? 'high' : undefined}
        className={className}
        style={{ backgroundColor: pic.colour, objectPosition: pic.position ?? undefined, ...style }}
      />
    </picture>
  );
}
