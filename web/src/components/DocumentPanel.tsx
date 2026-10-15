import { useRef, useState, type DragEvent } from "react";
import { deleteDocument, uploadDocument, type DocumentInfo } from "../api";
import { useStrings } from "../i18n";

const ACCEPT = ".pdf,.docx,.txt,.md,.markdown,.csv";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

interface Props {
  documents: DocumentInfo[];
  onChange: () => void;
}

export function DocumentPanel({ documents, onChange }: Props) {
  const t = useStrings();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setError(null);
    setUploading(file.name);
    try {
      await uploadDocument(file);
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(null);
      if (input.current) input.current.value = "";
    }
  }

  async function remove(doc: DocumentInfo) {
    if (!window.confirm(t.confirmDelete(doc.name))) return;
    try {
      await deleteDocument(doc.id);
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    void upload(event.dataTransfer.files);
  }

  return (
    <section className="flex min-h-0 flex-col gap-3">
      <h2 className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
        {t.documents}
      </h2>

      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        disabled={uploading !== null}
        className={`rounded-xl border-2 border-dashed px-4 py-5 text-center transition ${
          dragging
            ? "border-brand-500 bg-brand-50 dark:bg-slate-800"
            : "border-slate-300 hover:border-brand-500 dark:border-slate-700"
        } disabled:cursor-wait disabled:opacity-70`}
      >
        {uploading ? (
          <span className="flex items-center justify-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <span className="size-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            <span className="truncate">
              {t.indexing} {uploading}
            </span>
          </span>
        ) : (
          <>
            <span className="block text-sm font-medium text-slate-700 dark:text-slate-200">{t.dropHint}</span>
            <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{t.dropTypes}</span>
          </>
        )}
      </button>
      <input ref={input} type="file" accept={ACCEPT} className="hidden" onChange={(e) => void upload(e.target.files)} />

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      )}

      {documents.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">{t.noDocuments}</p>
      ) : (
        <ul className="flex min-h-0 flex-col gap-2 overflow-y-auto">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className="group flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900"
            >
              <span className="mt-0.5 rounded-md bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold text-brand-700 uppercase dark:bg-slate-800 dark:text-brand-100">
                {doc.name.split(".").pop()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium" title={doc.name}>
                  {doc.name}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {[doc.pageCount ? t.pages(doc.pageCount) : null, t.chunks(doc.chunkCount), formatSize(doc.sizeBytes)]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void remove(doc)}
                className="rounded-md px-2 py-1 text-xs text-slate-400 opacity-100 hover:bg-red-50 hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100 dark:hover:bg-red-950"
                aria-label={`${t.delete} ${doc.name}`}
              >
                {t.delete}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
