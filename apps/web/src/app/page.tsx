"use client";
import dynamic from "next/dynamic";
const Portal = dynamic(() => import("./portal"), {
  ssr: false,
  loading: () => <p style={{ padding: 40 }}>Loading Knowledge Hub…</p>,
});
export default function Page() {
  return <Portal />;
}
