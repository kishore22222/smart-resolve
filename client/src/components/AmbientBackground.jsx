import { useEffect, useRef } from 'react';
import gsap from 'gsap';

// Slow, coordinated drift of the background light blobs. Motion is decorative,
// so it is skipped entirely when the user prefers reduced motion (and in tests).
export default function AmbientBackground() {
  const ref = useRef(null);

  useEffect(() => {
    if (import.meta.env.MODE === 'test') return undefined;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    if (reduce || !ref.current) return undefined;

    const blobs = ref.current.querySelectorAll('[data-blob]');
    const ctx = gsap.context(() => {
      blobs.forEach((blob, i) => {
        gsap.to(blob, {
          xPercent: i % 2 ? 7 : -7,
          yPercent: i % 2 ? -6 : 6,
          scale: 1.12,
          duration: 12 + i * 3,
          ease: 'sine.inOut',
          repeat: -1,
          yoyo: true,
          delay: i * 0.5,
        });
      });
    }, ref);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={ref} aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 grid-overlay opacity-60" />
      <div data-blob className="absolute -left-28 top-[-12%] h-[440px] w-[440px] rounded-full bg-blue/20 blur-[120px]" />
      <div data-blob className="absolute right-[-10%] top-[4%] h-[380px] w-[380px] rounded-full bg-violet/20 blur-[120px]" />
      <div data-blob className="absolute bottom-[-18%] left-[28%] h-[440px] w-[440px] rounded-full bg-magenta/15 blur-[130px]" />
      <div data-blob className="absolute bottom-[-12%] right-[6%] h-[320px] w-[320px] rounded-full bg-teal/15 blur-[120px]" />
    </div>
  );
}
