import type { CSSProperties } from 'react';
import type { Picture } from '@/lib/data';

/** Below this width a photo's phone crop is used, where it has one. */
export const PHONE_MEDIA = '(max-width: 759px)';

interface Props {
  pic: Picture;
  /** A different crop of the same photo for phones, with the subject centred. */
  phone?: Picture;
  /** The width the image takes at each screen size, in the form the browser's `sizes` uses. */
  sizes: string;
  /** Set for the one image at the top of the page. Everything else loads as it nears the screen. */
  first?: boolean;
  className?: string;
  alt?: string;
  style?: CSSProperties;
  /** Moves a little slower than the page on large screens. */
  parallax?: boolean;
}

export function Pic({ pic, phone, sizes, first, className, alt, style, parallax }: Props) {
  return (
    <picture>
      {phone?.sources.map((s) => (
        <source key={`phone-${s.type}`} media={PHONE_MEDIA} type={s.type} srcSet={s.srcset} sizes="100vw" />
      ))}
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
        data-parallax={parallax ? '' : undefined}
        style={{ backgroundColor: pic.colour, objectPosition: pic.position ?? undefined, ...style }}
      />
    </picture>
  );
}
