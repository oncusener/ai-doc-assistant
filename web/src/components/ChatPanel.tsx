import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { streamChat, type HistoryTurn, type SourceRef } from "../api";
import { useStrings } from "../i18n";
import { Answer } from "./Answer";

interface Message {
  id: number;
  role: "user" | "assistant";
  text: string;
  sources: SourceRef[];
  citedText: Record<number, string[]>;
  status?: "retrieving" | "thinking" | "writing";
  error?: string;
  note?: string;
  model?: string;
  done: boolean;
}

const HISTORY_TURNS = 10;
let nextId = 1;

export function ChatPanel({ disabled }: { disabled: boolean }) {
  const t = useStrings();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const update = (id: number, fn: (m: Message) => Message) =>
    setMessages((all) => all.map((m) => (m.id === id ? fn(m) : m)));

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;

    const history: HistoryTurn[] = messages
      .filter((m) => m.done && !m.error && m.text)
      .slice(-HISTORY_TURNS)
      .map((m) => ({ role: m.role, content: m.text }));

    const userMsg: Message = { id: nextId++, role: "user", text: q, sources: [], citedText: {}, done: true };
    const answer: Message = {
      id: nextId++,
      role: "assistant",
      text: "",
      sources: [],
      citedText: {},
      status: "retrieving",
      done: false,
    };
    setMessages((all) => [...all, userMsg, answer]);
    setInput("");
    setBusy(true);

    const controller = new AbortController();
    abort.current = controller;
    try {
      for await (const event of streamChat(q, history, controller.signal)) {
        switch (event.type) {
          case "status":
            update(answer.id, (m) => ({ ...m, status: event.status }));
            break;
          case "sources":
            update(answer.id, (m) => ({ ...m, sources: event.sources }));
            break;
          case "text":
            update(answer.id, (m) => ({ ...m, text: m.text + event.text }));
            break;
          case "citation":
            update(answer.id, (m) => {
              const list = m.citedText[event.source] ?? [];
              if (list.includes(event.citedText)) return m;
              return { ...m, citedText: { ...m.citedText, [event.source]: [...list, event.citedText] } };
            });
            break;
          case "reset":
            update(answer.id, (m) => ({ ...m, text: "", citedText: {}, note: t.retried }));
            break;
          case "error":
            update(answer.id, (m) => ({ ...m, error: event.message }));
            break;
          case "done":
            update(answer.id, (m) => ({ ...m, model: event.model }));
            break;
        }
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        update(answer.id, (m) => ({ ...m, error: err instanceof Error ? err.message : String(err) }));
      }
    } finally {
      update(answer.id, (m) => ({ ...m, status: undefined, done: true }));
      setBusy(false);
      abort.current = null;
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void ask(input);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void ask(input);
    }
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
        {messages.length === 0 ? (
          <div className="mx-auto mt-10 max-w-xl text-center sm:mt-20">
            <h2 className="text-2xl font-semibold tracking-tight">{t.emptyTitle}</h2>
            <p className="mt-2 text-slate-600 dark:text-slate-400">{t.emptyBody}</p>
            <div className="mt-6 flex flex-col gap-2">
              {t.examples.map((example) => (
                <button
                  key={example}
                  type="button"
                  disabled={disabled}
                  onClick={() => void ask(example)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm transition hover:border-brand-500 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-5">
            {messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-brand-600 px-4 py-2.5 text-white">
                  {m.text}
                </div>
              ) : (
                <div
                  key={m.id}
                  className="max-w-[95%] rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900"
                >
                  {m.note && <p className="mb-2 text-xs text-amber-700 dark:text-amber-300">{m.note}</p>}
                  {m.text && <Answer text={m.text} sources={m.sources} citedText={m.citedText} />}
                  {m.status && (
                    <p className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                      <span className="size-2 animate-pulse rounded-full bg-brand-500" />
                      {t.status[m.status]}
                    </p>
                  )}
                  {m.error && (
                    <p role="alert" className="mt-1 text-sm text-red-600 dark:text-red-300">
                      {m.error}
                    </p>
                  )}
                  {m.done && m.model && (
                    <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">{t.answeredBy(m.model)}</p>
                  )}
                </div>
              ),
            )}
            <div ref={bottom} />
          </div>
        )}
      </div>

      <form onSubmit={onSubmit} className="border-t border-slate-200 bg-white/80 px-4 py-3 backdrop-blur sm:px-8 dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            maxLength={2000}
            disabled={disabled}
            placeholder={t.askPlaceholder}
            className="max-h-40 min-h-11 flex-1 resize-none rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-[15px] outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:focus:ring-slate-700"
          />
          {busy ? (
            <button
              type="button"
              onClick={() => abort.current?.abort()}
              className="h-11 rounded-xl border border-slate-300 px-4 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              {t.stop}
            </button>
          ) : (
            <button
              type="submit"
              disabled={disabled || !input.trim()}
              className="h-11 rounded-xl bg-brand-600 px-5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-40"
            >
              {t.send}
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
