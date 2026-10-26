"use client";
import type { KB } from "../lib/types";

export function KBSelect({
  bases,
  value,
  onChange,
}: {
  bases: KB[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label>
      Knowledge base{" "}
      <select
        aria-label="Knowledge base"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Choose a knowledge base</option>
        {bases.map((k) => (
          <option key={k.id} value={k.id}>
            {k.name}
          </option>
        ))}
      </select>
    </label>
  );
}
