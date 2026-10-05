import { afterNextRender, DestroyRef, Directive, ElementRef, inject } from '@angular/core';

@Directive({ selector: '[tdReveal]' })
export class RevealDirective {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    let disposed = false;
    let cleanup: (() => void) | undefined;
    this.destroyRef.onDestroy(() => { disposed = true; cleanup?.(); });
    afterNextRender(() => {
      void Promise.all([import('gsap'), import('gsap/ScrollTrigger')]).then(([{ gsap }, { ScrollTrigger }]) => {
        if (disposed) return;
        gsap.registerPlugin(ScrollTrigger);
        const media = gsap.matchMedia();
        media.add('(prefers-reduced-motion: no-preference)', () => {
          const elements = this.host.nativeElement.querySelectorAll('h1, [data-reveal]');
          elements.forEach(element => {
            gsap.from(element, {
              y: 12, opacity: 0, duration: .45, ease: 'power2.out',
              scrollTrigger: { trigger: element, start: 'top 94%', once: true },
              clearProps: 'transform,opacity',
            });
          });
        }, this.host.nativeElement);
        cleanup = () => media.revert();
      });
    });
  }
}
