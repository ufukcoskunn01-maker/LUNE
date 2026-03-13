"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import lottie, { type AnimationItem } from "lottie-web";

import { homepageHeadStyles } from "./homepageHeadStyles";
import { homepageMarkup } from "./homepageMarkup";

const typedWords = [
  "Where am I overspending this month?",
  "How have tariffs impacted my portfolio?",
  "Can I retire by 60?",
];

const shellStyles = `
:host {
  display: block;
  width: 100%;
  color: #fff;
  background: #0f1011;
  font-family: Suisseintltrial, Arial, sans-serif;
}

.homepage-root {
  display: block;
  min-height: 100vh;
  color: #fff;
  background: #0f1011;
}

.homepage-root .motion-fade-up,
.homepage-root .motion-scale-up,
.homepage-root .motion-slide-left,
.homepage-root .motion-slide-right {
  opacity: 0;
  will-change: opacity, transform;
  transition:
    opacity 850ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 850ms cubic-bezier(0.22, 1, 0.36, 1);
  transition-delay: var(--motion-delay, 0ms);
}

.homepage-root .motion-fade-up {
  transform: translate3d(0, 42px, 0);
}

.homepage-root .motion-scale-up {
  transform: translate3d(0, 24px, 0) scale(0.965);
}

.homepage-root .motion-slide-left {
  transform: translate3d(52px, 0, 0);
}

.homepage-root .motion-slide-right {
  transform: translate3d(-52px, 0, 0);
}

.homepage-root .motion-visible {
  opacity: 1;
  transform: translate3d(0, 0, 0) scale(1);
}

.homepage-root .motion-float-slow {
  animation: homepage-float-slow 9s ease-in-out infinite;
}

.homepage-root .motion-float-medium {
  animation: homepage-float-medium 7s ease-in-out infinite;
}

.homepage-root .motion-pulse-soft {
  animation: homepage-pulse-soft 4.2s ease-in-out infinite;
}

@keyframes homepage-float-slow {
  0%,
  100% {
    transform: translate3d(0, 0, 0);
  }

  50% {
    transform: translate3d(0, -14px, 0);
  }
}

@keyframes homepage-float-medium {
  0%,
  100% {
    transform: translate3d(0, 0, 0);
  }

  50% {
    transform: translate3d(0, -10px, 0);
  }
}

@keyframes homepage-pulse-soft {
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }

  50% {
    transform: scale(1.04);
    opacity: 0.88;
  }
}

#testimonial-slider {
  will-change: transform;
}

.testimonial-viewport {
  overflow: hidden;
}

.testimonial-slider-ready #testimonial-slider {
  display: flex;
  gap: 30px;
  transition: transform 600ms ease;
}

.testimonial-slider-ready #testimonial-slider .quote-card {
  flex: 0 0 calc((100% - 60px) / 3);
  min-width: 0;
}

@media screen and (max-width: 991px) {
  .testimonial-slider-ready #testimonial-slider .quote-card {
    flex-basis: calc((100% - 30px) / 2);
  }
}

@media screen and (max-width: 640px) {
  .testimonial-slider-ready #testimonial-slider .quote-card {
    flex-basis: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .homepage-root .motion-fade-up,
  .homepage-root .motion-scale-up,
  .homepage-root .motion-slide-left,
  .homepage-root .motion-slide-right {
    opacity: 1;
    transform: none;
    transition: none;
  }

  .homepage-root .motion-float-slow,
  .homepage-root .motion-float-medium,
  .homepage-root .motion-pulse-soft,
  .testimonial-slider-ready #testimonial-slider {
    animation: none;
    transition: none;
  }
}
`;

function slidesPerView(width: number) {
  if (width <= 640) {
    return 1;
  }

  if (width <= 991) {
    return 2;
  }

  return 3;
}

export function Homepage() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [shadowRoot, setShadowRoot] = useState<ShadowRoot | null>(null);

  useEffect(() => {
    if (!hostRef.current || shadowRoot) {
      return;
    }

    setShadowRoot(hostRef.current.attachShadow({ mode: "open" }));
  }, [shadowRoot]);

  useLayoutEffect(() => {
    if (!shadowRoot) {
      return;
    }

    const root = shadowRoot;
    const cleanups: Array<() => void> = [];

    const applyReferralCode = () => {
      const params = new URL(window.location.href).searchParams;
      const referralCode = params.get("referral_code");

      if (!referralCode) {
        return;
      }

      root.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((anchor) => {
        const href = anchor.getAttribute("href");

        if (!href || href === "#" || href.startsWith("mailto:")) {
          return;
        }

        try {
          const url = new URL(href, window.location.origin);
          url.searchParams.set("referral_code", referralCode);
          anchor.href = url.toString();
        } catch {
          // Ignore malformed links copied from the reference HTML.
        }
      });
    };

    const normalizeLinks = () => {
      root.querySelectorAll<HTMLAnchorElement>('a[href="/#"]').forEach((anchor) => {
        anchor.setAttribute("href", "#");
      });

      root
        .querySelectorAll<HTMLAnchorElement>('a[href="https://useorigin.com/"]')
        .forEach((anchor) => {
          anchor.setAttribute("href", "/");
        });
    };

    const initTypedWords = () => {
      const node = root.querySelector<HTMLElement>(".typed-words");

      if (!node) {
        return;
      }

      let wordIndex = 0;
      let charIndex = 0;
      let deleting = false;
      let timeoutId: number | undefined;

      const tick = () => {
        const activeWord = typedWords[wordIndex] ?? "";

        if (!deleting) {
          charIndex += 1;
          node.textContent = activeWord.slice(0, charIndex);

          if (charIndex === activeWord.length) {
            deleting = true;
            timeoutId = window.setTimeout(tick, 800);
            return;
          }

          timeoutId = window.setTimeout(tick, 75);
          return;
        }

        charIndex -= 1;
        node.textContent = activeWord.slice(0, Math.max(charIndex, 0));

        if (charIndex <= 0) {
          deleting = false;
          wordIndex = (wordIndex + 1) % typedWords.length;
          timeoutId = window.setTimeout(tick, 500);
          return;
        }

        timeoutId = window.setTimeout(tick, 45);
      };

      tick();

      cleanups.push(() => {
        if (timeoutId) {
          window.clearTimeout(timeoutId);
        }
      });
    };

    const initNavigation = () => {
      const menuButton = root.querySelector<HTMLElement>(".menu-button");
      const menu = root.querySelector<HTMLElement>(".navigation-menu");
      const dropdowns = Array.from(
        root.querySelectorAll<HTMLElement>(".nav-dropdown-toggle"),
      );

      if (!menuButton || !menu) {
        return;
      }

      const onMenuClick = () => {
        menu.classList.toggle("active");
        menuButton.classList.toggle("active");
      };

      menuButton.addEventListener("click", onMenuClick);

      dropdowns.forEach((toggle) => {
        const onToggleClick = () => {
          if (window.innerWidth > 991) {
            return;
          }

          const list = toggle.nextElementSibling as HTMLElement | null;
          const isActive = toggle.classList.contains("active");

          dropdowns.forEach((item) => {
            item.classList.remove("active");
            const sibling = item.nextElementSibling as HTMLElement | null;
            sibling?.classList.remove("active");
          });

          if (!isActive) {
            toggle.classList.add("active");
            list?.classList.add("active");
          }
        };

        toggle.addEventListener("click", onToggleClick);
        cleanups.push(() => toggle.removeEventListener("click", onToggleClick));
      });

      cleanups.push(() => menuButton.removeEventListener("click", onMenuClick));
    };

    const initMotion = () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        return;
      }

      const observed = new Set<HTMLElement>();
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) {
              return;
            }

            entry.target.classList.add("motion-visible");
            observer.unobserve(entry.target);
          });
        },
        {
          threshold: 0.22,
          rootMargin: "0px 0px -8% 0px",
        },
      );

      const registerGroup = ({
        selector,
        className,
        baseDelay = 0,
        step = 110,
        immediate = false,
      }: {
        selector: string;
        className: string;
        baseDelay?: number;
        step?: number;
        immediate?: boolean;
      }) => {
        const nodes = Array.from(root.querySelectorAll<HTMLElement>(selector));

        nodes.forEach((node, index) => {
          node.classList.add(className);
          node.style.setProperty("--motion-delay", `${baseDelay + index * step}ms`);

          if (immediate) {
            requestAnimationFrame(() => {
              node.classList.add("motion-visible");
            });
            return;
          }

          if (!observed.has(node)) {
            observed.add(node);
            observer.observe(node);
          }
        });
      };

      registerGroup({
        selector:
          ".navbar, .promocontainer, .hero h1, .hero .hero__sub-wrapper, .hero .button.nav, .top__search-bar, .hero .hero__sub-wrapper_pad, .phone_container",
        className: "motion-fade-up",
        immediate: true,
        baseDelay: 40,
        step: 90,
      });

      registerGroup({
        selector:
          ".intro .large-heading, .ai-section .large-heading, .forecast-section h1, .testimonial-title, .updates h3, .footer-hero h1",
        className: "motion-fade-up",
        baseDelay: 30,
      });

      registerGroup({
        selector: ".track__card, .track-card-black, .update-card, .quote-card",
        className: "motion-scale-up",
        baseDelay: 40,
        step: 120,
      });

      registerGroup({
        selector:
          ".ask-answer-container, .lottie-animation.m-t-40, .lottie-animation.m-t-40_recaps, .forecast, .footer-hero-mobile-block",
        className: "motion-scale-up",
      });

      registerGroup({
        selector: ".sphere-center",
        className: "motion-slide-right",
      });

      registerGroup({
        selector: ".div-block-9, .globe",
        className: "motion-slide-left",
      });

      root.querySelector<HTMLElement>(".globe")?.classList.add("motion-float-slow");
      root
        .querySelector<HTMLElement>(".footer-hero-mobile")
        ?.classList.add("motion-float-medium");
      root.querySelector<HTMLElement>(".star")?.classList.add("motion-pulse-soft");

      cleanups.push(() => observer.disconnect());
    };

    const initTestimonialSlider = () => {
      const slider = root.getElementById("testimonial-slider");

      if (!slider || slider.children.length === 0) {
        return;
      }

      const section = slider.parentElement;

      if (!section) {
        return;
      }

      section.classList.add("testimonial-slider-ready");

      let viewport = section.querySelector<HTMLElement>(".testimonial-viewport");
      if (!viewport) {
        viewport = document.createElement("div");
        viewport.className = "testimonial-viewport";
        slider.parentNode?.insertBefore(viewport, slider);
        viewport.appendChild(slider);
      }

      let prevButton = section.querySelector<HTMLButtonElement>(".slick-prev");
      let nextButton = section.querySelector<HTMLButtonElement>(".slick-next");

      if (!prevButton || !nextButton) {
        prevButton = document.createElement("button");
        nextButton = document.createElement("button");

        prevButton.type = "button";
        nextButton.type = "button";
        prevButton.className = "slick-prev slick-arrow";
        nextButton.className = "slick-next slick-arrow";
        prevButton.innerHTML =
          '<img src="/homepage/assets/aHR0cHM6-68c055d0349d06a4b26ff489_chevron-left.svg" alt="Previous testimonial" />';
        nextButton.innerHTML =
          '<img src="/homepage/assets/aHR0cHM6-68c055d0db5392b4ab1a0df0_chevron-right.svg" alt="Next testimonial" />';

        section.append(prevButton, nextButton);
      }

      let index = 0;
      let intervalId: number | undefined;

      const sync = () => {
        const cards = Array.from(slider.children) as HTMLElement[];
        const perView = slidesPerView(window.innerWidth);
        const maxIndex = Math.max(cards.length - perView, 0);
        index = Math.min(index, maxIndex);

        const firstCard = cards[0];
        if (!firstCard) {
          return;
        }

        const styles = window.getComputedStyle(slider);
        const gap = Number.parseFloat(styles.columnGap || styles.gap || "30");
        const offset = index * (firstCard.getBoundingClientRect().width + gap);
        slider.style.transform = `translate3d(-${offset}px, 0, 0)`;
      };

      const advance = (direction: number) => {
        const perView = slidesPerView(window.innerWidth);
        const maxIndex = Math.max(slider.children.length - perView, 0);
        index += direction;

        if (index > maxIndex) {
          index = 0;
        } else if (index < 0) {
          index = maxIndex;
        }

        sync();
      };

      const restart = () => {
        if (intervalId) {
          window.clearInterval(intervalId);
        }

        intervalId = window.setInterval(() => advance(1), 5000);
      };

      const onPrev = () => {
        advance(-1);
        restart();
      };

      const onNext = () => {
        advance(1);
        restart();
      };

      prevButton.addEventListener("click", onPrev);
      nextButton.addEventListener("click", onNext);

      const resizeObserver = new ResizeObserver(sync);
      resizeObserver.observe(viewport);
      sync();
      restart();

      cleanups.push(() => {
        prevButton?.removeEventListener("click", onPrev);
        nextButton?.removeEventListener("click", onNext);
        resizeObserver.disconnect();
        if (intervalId) {
          window.clearInterval(intervalId);
        }
      });
    };

    const initLottieAnimations = () => {
      const animations: AnimationItem[] = [];

      root.querySelectorAll<HTMLElement>(".lottie-animation").forEach((node) => {
        const animationPath = node.dataset.src;

        if (!animationPath) {
          return;
        }

        animations.push(
          lottie.loadAnimation({
            container: node,
            renderer: "svg",
            loop: node.dataset.loop === "1",
            autoplay: true,
            path: animationPath,
            rendererSettings: {
              preserveAspectRatio: "xMidYMid meet",
            },
          }),
        );
      });

      cleanups.push(() => {
        animations.forEach((animation) => animation.destroy());
      });
    };

    const initNewsletterForm = () => {
      const form = root.querySelector<HTMLFormElement>("#email-form");
      const done = root.querySelector<HTMLElement>(".w-form-done");
      const fail = root.querySelector<HTMLElement>(".w-form-fail");
      const formBlock = root.querySelector<HTMLElement>(".w-form");
      const submitButton = root.querySelector<HTMLInputElement>(".newsletter__button");

      if (!form || !done || !fail || !formBlock || !submitButton) {
        return;
      }

      done.style.display = "none";
      fail.style.display = "none";
      fail.textContent = "Newsletter signup is not connected in this app build.";
      submitButton.setAttribute("title", "Newsletter signup is unavailable in this build");

      const onSubmit = (event: SubmitEvent) => {
        event.preventDefault();
        done.style.display = "none";
        fail.style.display = "block";
      };

      form.addEventListener("submit", onSubmit);
      cleanups.push(() => form.removeEventListener("submit", onSubmit));
    };

    applyReferralCode();
    normalizeLinks();
    initTypedWords();
    initNavigation();
    initMotion();
    initTestimonialSlider();
    initLottieAnimations();
    initNewsletterForm();

    return () => {
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [shadowRoot]);

  return (
    <>
      <div ref={hostRef} />
      {shadowRoot
        ? createPortal(
            <>
              <style>{'@import url("/homepage/assets/homepage.webflow.css");'}</style>
              <style>{shellStyles}</style>
              <style>{homepageHeadStyles}</style>
              <div
                className="homepage-root"
                dangerouslySetInnerHTML={{ __html: homepageMarkup }}
              />
            </>,
            shadowRoot,
          )
        : null}
    </>
  );
}
