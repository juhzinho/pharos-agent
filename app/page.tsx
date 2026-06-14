"use client";

import { useRouter } from "next/navigation";
import PharosLanding from "@/components/PharosLanding";

export default function HomePage() {
  const router = useRouter();
  return (
    <PharosLanding
      onStart={() => router.push("/chat")}
      onAbout={() => router.push("/about")}
    />
  );
}
