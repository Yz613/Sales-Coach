import Link from "next/link";

export default function BrandMark({
  href = "/",
  tone = "paper",
}: {
  href?: string;
  tone?: "paper" | "ink";
}) {
  const isPaper = tone === "paper";

  return (
    <Link href={href} className="group flex items-center gap-2.5">
      <span
        className={`flex h-9 w-9 items-center justify-center font-serif text-[15px] font-semibold tracking-tight ${
          isPaper
            ? "border border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]"
            : "rounded-lg bg-blue-600 text-white shadow-lg shadow-blue-500/20"
        }`}
      >
        RQ
      </span>
      <span className="leading-tight">
        <span
          className={`block font-serif text-[17px] font-medium tracking-tight ${
            isPaper ? "text-[var(--ink)]" : "font-bold text-white"
          }`}
        >
          RefreshQueue
        </span>
        <span
          className={`block text-[10px] font-semibold uppercase tracking-[0.16em] ${
            isPaper ? "text-[var(--muted)]" : "text-blue-400"
          }`}
        >
          {isPaper ? "Monday call queue" : "AI Sales Manager"}
        </span>
      </span>
    </Link>
  );
}
