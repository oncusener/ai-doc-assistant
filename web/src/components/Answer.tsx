import { useState } from "react";
import Markdown from "react-markdown";
import type { SourceRef } from "../api";
import { useStrings } from "../i18n";

/** Turn citation markers like [2] into links the renderer can style as chips. */
function linkCitations(text: string): string {
  return text.replace(/\[(\d+)\](?!\()/g, "[$1](#source-$1)");
}

interface Props {
  text: string;
  sources: SourceRef[];
  citedText: Record<number, string[]>;
}

export function Answer({ text, sources, citedText }: Props) {
  const t = useStrings();
  const [active, setActive] = useState<number | null>(null);
  const byNumber = new Map(sources.map((s) => [s.n, s]));
  const cited = new Set([...text.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])));
  const shownSources = sources.filter((s) => cited.has(s.n));

  return (
    <div>
      <div className="prose-answer">
        <Markdown
          components={{
            a: ({ href, children }) => {
              const match = href?.match(/^#source-(\d+)$/);
              const source = match ? byNumber.get(Number(match[1])) : undefined;
              if (!match || !source) return <a href={href}>{children}</a>;
              const n = source.n;
              return (
                <button
                  type="button"
                  onClick={() => setActive(active === n ? null : n)}
                  title={`${source.documentName}${source.page ? ` · ${t.page(source.page)}` : ""}`}
                  className={`citation mx-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-md px-1 align-text-top text-[11px] font-semibold transition ${
                    active === n
                      ? "bg-brand-600 text-white"
                      : "bg-brand-100 text-brand-700 hover:bg-brand-600 hover:text-white dark:bg-slate-700 dark:text-brand-100"
                  }`}
                >
                  {n}
                </button>
              );
            },
          }}
        >
          {linkCitations(text)}
        </Markdown>
      </div>

      {shownSources.length > 0 && (
        <div className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-800">
          <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
            {t.sources}
          </p>
          <ul className="flex flex-col gap-2">
            {shownSources.map((s) => (
              <li key={s.n}>
                <button
                  type="button"
                  onClick={() => setActive(active === s.n ? null : s.n)}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                    active === s.n
                      ? "border-brand-500 bg-brand-50 dark:bg-slate-800"
                      : "border-slate-200 hover:border-brand-500 dark:border-slate-800"
                  }`}
                >
                  <span className="flex items-baseline gap-2">
                    <span className="font-semibold text-brand-700 dark:text-brand-100">[{s.n}]</span>
                    <span className="truncate font-medium">{s.documentName}</span>
                    {s.page !== null && (
                      <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">{t.page(s.page)}</span>
                    )}
                  </span>
                  {active === s.n && (
                    <span className="mt-2 block text-xs leading-relaxed whitespace-pre-line text-slate-600 dark:text-slate-300">
                      {citedText[s.n]?.length ? `“${citedText[s.n]!.join(" … ")}”` : s.snippet}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
