"use client";
import type { ReactNode } from "react";

export function Frame({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="hub">
      <div className="eyebrow">Workspace / {title}</div>
      <h1>{title}</h1>
      <p className="muted">{description}</p>
      {children}
    </section>
  );
}
