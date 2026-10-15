import { useCallback, useEffect, useState } from "react";
import { getHealth, listDocuments, type DocumentInfo, type Health } from "./api";
import { ChatPanel } from "./components/ChatPanel";
import { DocumentPanel } from "./components/DocumentPanel";
import { getStrings, initialLang, saveLang, StringsContext, type Lang } from "./i18n";

export function App() {
  const [lang, setLang] = useState<Lang>(initialLang);
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [chatKey, setChatKey] = useState(0);
  const t = getStrings(lang);

  const refresh = useCallback(() => {
    listDocuments().then(setDocuments).catch(() => setDocuments([]));
    getHealth().then(setHealth).catch(() => setHealth(null));
  }, []);

  useEffect(refresh, [refresh]);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = t.title;
  }, [lang, t.title]);

  function switchLang(next: Lang) {
    setLang(next);
    saveLang(next);
  }

  return (
    <StringsContext.Provider value={t}>
      <div className="flex h-full flex-col md:flex-row">
        <aside className="flex max-h-[45vh] shrink-0 flex-col gap-5 border-b border-slate-200 bg-white p-4 md:max-h-none md:w-80 md:border-r md:border-b-0 dark:border-slate-800 dark:bg-slate-900/40">
          <header className="flex items-start justify-between gap-2">
            <div>
              <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                <span className="grid size-7 place-items-center rounded-lg bg-brand-600 text-sm text-white">✦</span>
                {t.title}
              </h1>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t.tagline}</p>
            </div>
            <div className="flex rounded-lg border border-slate-200 p-0.5 text-xs dark:border-slate-700" role="group">
              {(["tr", "en"] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => switchLang(l)}
                  aria-pressed={lang === l}
                  className={`rounded-md px-2 py-1 font-medium uppercase ${
                    lang === l ? "bg-brand-600 text-white" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </header>

          <DocumentPanel documents={documents} onChange={refresh} />

          <footer className="mt-auto hidden flex-col gap-2 md:flex">
            <button
              type="button"
              onClick={() => setChatKey((k) => k + 1)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              {t.newChat}
            </button>
            {health && (
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                {health.provider === "claude" ? "Claude" : t.devMode} · {health.model}
              </p>
            )}
          </footer>
        </aside>

        <main className="flex min-h-0 flex-1 flex-col">
          <ChatPanel key={chatKey} disabled={documents.length === 0} />
        </main>
      </div>
    </StringsContext.Provider>
  );
}
