import { createContext, useContext } from "react";

export type Lang = "en" | "tr";

const strings = {
  en: {
    title: "Doc Assistant",
    tagline: "Answers from your documents, with sources.",
    documents: "Documents",
    noDocuments: "No documents yet. Upload a PDF, DOCX, TXT or Markdown file to get started.",
    dropHint: "Drop a file here or click to upload",
    dropTypes: "PDF, DOCX, TXT, MD · max 20 MB",
    indexing: "Indexing…",
    delete: "Delete",
    confirmDelete: (name: string) => `Delete "${name}"? Its content will no longer be used in answers.`,
    pages: (n: number) => `${n} page${n === 1 ? "" : "s"}`,
    chunks: (n: number) => `${n} chunk${n === 1 ? "" : "s"}`,
    askPlaceholder: "Ask a question about your documents…",
    send: "Send",
    stop: "Stop",
    newChat: "New chat",
    emptyTitle: "Ask your documents anything",
    emptyBody: "Answers only use the documents on the left, and every claim links to its source.",
    examples: [
      "How many days of annual leave do I get after 6 years?",
      "How long does the tracker's backup battery last?",
      "Kayıp bir laptopu ne kadar sürede bildirmeliyim?",
    ],
    status: { retrieving: "Searching documents…", thinking: "Thinking…", writing: "Writing…" },
    sources: "Sources",
    page: (n: number) => `page ${n}`,
    answeredBy: (model: string) => `Answered by ${model}`,
    retried: "The answer was restarted on a fallback model.",
    devMode: "Dev mode",
  },
  tr: {
    title: "Doküman Asistanı",
    tagline: "Dokümanlarınızdan, kaynaklı cevaplar.",
    documents: "Dokümanlar",
    noDocuments: "Henüz doküman yok. Başlamak için PDF, DOCX, TXT veya Markdown dosyası yükleyin.",
    dropHint: "Dosyayı buraya bırakın ya da tıklayıp seçin",
    dropTypes: "PDF, DOCX, TXT, MD · en fazla 20 MB",
    indexing: "İndeksleniyor…",
    delete: "Sil",
    confirmDelete: (name: string) => `"${name}" silinsin mi? İçeriği artık cevaplarda kullanılmayacak.`,
    pages: (n: number) => `${n} sayfa`,
    chunks: (n: number) => `${n} parça`,
    askPlaceholder: "Dokümanlarınız hakkında bir soru sorun…",
    send: "Gönder",
    stop: "Durdur",
    newChat: "Yeni sohbet",
    emptyTitle: "Dokümanlarınıza istediğinizi sorun",
    emptyBody: "Cevaplar yalnızca soldaki dokümanları kullanır; her bilgi kaynağına bağlanır.",
    examples: [
      "6 yıllık kıdemle kaç gün yıllık izin hakkım var?",
      "Kayıp bir laptopu ne kadar sürede bildirmeliyim?",
      "How long does the tracker's backup battery last?",
    ],
    status: { retrieving: "Dokümanlar taranıyor…", thinking: "Düşünüyor…", writing: "Yazıyor…" },
    sources: "Kaynaklar",
    page: (n: number) => `sayfa ${n}`,
    answeredBy: (model: string) => `Cevaplayan: ${model}`,
    retried: "Cevap yedek bir modelle yeniden başlatıldı.",
    devMode: "Geliştirme modu",
  },
} as const;

export type Strings = (typeof strings)[Lang];

export function getStrings(lang: Lang): Strings {
  return strings[lang];
}

export function initialLang(): Lang {
  try {
    const saved = localStorage.getItem("lang");
    if (saved === "en" || saved === "tr") return saved;
  } catch {
    // storage unavailable (private mode, blocked site data)
  }
  return navigator.language.toLowerCase().startsWith("tr") ? "tr" : "en";
}

export function saveLang(lang: Lang): void {
  try {
    localStorage.setItem("lang", lang);
  } catch {
    // ignore
  }
}

export const StringsContext = createContext<Strings>(strings.en);
export const useStrings = () => useContext(StringsContext);
