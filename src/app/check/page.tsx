import type { Metadata } from "next";
import { PairCheck } from "@/components/pair-check";

export const metadata: Metadata = {
  title: "Pair check",
  description:
    "Test any two researchers against the conflict-of-interest rules and see " +
    "the connecting records.",
};

export default function CheckPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="max-w-2xl mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Pair check</h1>
        <p className="text-muted mt-2 leading-relaxed">
          Screen any two researchers against the same rules the panel workflow
          uses. Useful when a name is proposed informally and someone needs a
          quick, evidenced answer before it goes further.
        </p>
      </div>

      <PairCheck />
    </div>
  );
}
