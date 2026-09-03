"use client";

/**
 * LazyVideo — <video> que NO se descarga hasta acercarse al viewport.
 *
 * El footer y las secciones bajas de la landing tienen videos en loop que
 * antes bajaban completos apenas abrías la página (autoPlay ⇒ preload auto),
 * aunque el usuario nunca scrolleara hasta ahí. Con esto, el elemento video
 * (y su descarga) solo se monta cuando está a ~400px de entrar en pantalla;
 * antes de eso se ve el poster estático.
 *
 * Server-safe de usar desde server components: el estado vive acá adentro.
 */

import { useEffect, useRef, useState } from "react";

export default function LazyVideo({
  src,
  poster,
  className,
  style,
  loop = true,
  ariaHidden = true,
  rootMargin = "400px",
}: {
  src: string;
  poster?: string;
  className?: string;
  style?: React.CSSProperties;
  loop?: boolean;
  ariaHidden?: boolean;
  rootMargin?: string;
}) {
  const holderRef = useRef<HTMLDivElement>(null);
  // Sin IntersectionObserver (browsers viejos): cargar directo, sin efecto.
  const [near, setNear] = useState(
    () => typeof IntersectionObserver === "undefined"
  );

  useEffect(() => {
    const el = holderRef.current;
    if (!el || near) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin, near]);

  return (
    <div ref={holderRef} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {near ? (
        <video
          src={src}
          poster={poster}
          className={className}
          style={style}
          autoPlay
          muted
          loop={loop}
          playsInline
          aria-hidden={ariaHidden}
          tabIndex={ariaHidden ? -1 : undefined}
        />
      ) : poster ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={poster}
          alt=""
          aria-hidden
          className={className}
          style={{ ...style, objectFit: style?.objectFit ?? "cover" }}
        />
      ) : null}
    </div>
  );
}
