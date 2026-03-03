import React from "react";

type Props = {
  webmSrc: string;
  mp4Src?: string;
  className?: string;
  toneOverlayClassName?: string;
  fadeOverlayClassName?: string;
  children?: React.ReactNode;
};

export function BackgroundVideo({
  webmSrc,
  mp4Src,
  className = "",
  toneOverlayClassName = "bg-black/10",
  fadeOverlayClassName = "bg-gradient-to-b from-background/0 via-background/20 to-background/90 dark:to-background/95",
  children,
}: Props) {
  return (
    <section className={`relative w-full overflow-hidden ${className}`}>
      <video
        className="absolute inset-0 h-full w-full object-cover"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
      >
        {webmSrc ? <source src={webmSrc} type="video/webm" /> : null}
        {mp4Src ? <source src={mp4Src} type="video/mp4" /> : null}
      </video>

      {/* overlays do NOT block video */}
      <div className={`pointer-events-none absolute inset-0 ${toneOverlayClassName}`} />
      <div className={`pointer-events-none absolute inset-0 ${fadeOverlayClassName}`} />

      <div className="relative z-10">{children}</div>
    </section>
  );
}
