"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/cn";

type BackgroundVideoProps = {
  mp4Src: string;
  webmSrc: string;
  toneOverlayClassName?: string;
  fadeOverlayClassName?: string;
  className?: string;
  children?: ReactNode;
};

export function BackgroundVideo({
  mp4Src,
  webmSrc,
  toneOverlayClassName,
  fadeOverlayClassName,
  className,
  children,
}: BackgroundVideoProps) {
  return (
    <div className={cn("relative", className)}>
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 h-full w-full object-cover"
      >
        <source src={webmSrc} type="video/webm" />
        <source src={mp4Src} type="video/mp4" />
      </video>
      {toneOverlayClassName ? <div className={cn("absolute inset-0", toneOverlayClassName)} /> : null}
      {fadeOverlayClassName ? <div className={cn("absolute inset-0", fadeOverlayClassName)} /> : null}
      <div className="relative">{children}</div>
    </div>
  );
}
