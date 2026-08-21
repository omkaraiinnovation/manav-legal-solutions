"use client";
import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Send, Loader2, Sparkles, Paperclip, Mic, Square, X, AlertTriangle, FileText, Image as ImageIcon, Music, Video } from "lucide-react";
import type { Jurisdiction, IndiaStateOrUT } from "@/lib/types";
import { INDIA_STATES_AND_UTS } from "@/lib/types";
import { ACCEPT_ATTRIBUTE } from "@/lib/documents/mime";
import { useVoiceRecorder, formatSeconds } from "@/lib/hooks/useVoiceRecorder";
import type { ConsultationAttachment } from "@/lib/agents/consultation-agent";

interface Message { role: "user" | "assistant"; content: string; }

const KIND_ICON = { document: FileText, image: ImageIcon, audio: Music, video: Video } as const;

const SUGGESTED = [
  "My landlord in Patna is refusing to return my security deposit.",
  "A cheque given to me for Rs. 50,000 has bounced.",
  "My neighbour's construction is encroaching on my land in Muzaffarpur.",
  "I received a notice from the GST department — what should I do?",
];

export function ChatPanel({ matterId }: { matterId?: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState<IndiaStateOrUT>("Bihar");
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [attachments, setAttachments] = useState<ConsultationAttachment[]>([]);
  const [attaching, setAttaching] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);

  const recorder = useVoiceRecorder((file) => { attachFiles([file]); });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function attachFiles(files: File[]) {
    setAttachError(null);
    setAttaching(true);
    try {
      for (const file of files) {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/ingest", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Could not process "${file.name}".`);
        setAttachments((prev) => [...prev, ...(data.attachments as ConsultationAttachment[])]);
      }
    } catch (err) {
      setAttachError(err instanceof Error ? err.message : "Could not process the attachment.");
    } finally {
      setAttaching(false);
    }
  }

  function removeAttachment(fileName: string) {
    setAttachments((prev) => prev.filter((a) => a.fileName !== fileName));
  }

  async function send(text: string) {
    if ((!text.trim() && attachments.length === 0) || loading) return;
    const displayText = text.trim() || `[${attachments.length} file${attachments.length === 1 ? "" : "s"} attached]`;
    const next = [...messages, { role: "user" as const, content: displayText }];
    setMessages(next);
    setInput("");
    const sentAttachments = attachments;
    setAttachments([]);
    setLoading(true);
    try {
      const jurisdiction: Jurisdiction = { level: "state", state };
      const res = await fetch("/api/consultation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: displayText, history: messages, jurisdiction, matterId, attachments: sentAttachments }),
      });
      const data = await res.json();
      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Something went wrong reaching the consultation agent. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="flex items-center gap-2 border-b px-6 py-3" style={{ borderColor: "var(--hairline)" }}>
        <span className="text-xs font-medium text-ink-faint">Jurisdiction:</span>
        <select
          value={state}
          onChange={(e) => setState(e.target.value as IndiaStateOrUT)}
          className="rounded-[6px] border bg-transparent px-2 py-1 text-xs"
          style={{ borderColor: "var(--hairline)" }}
        >
          {INDIA_STATES_AND_UTS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6">
        {messages.length === 0 && (
          <div className="mx-auto max-w-2xl animate-rise">
            <div className="mb-4 flex items-center gap-2" style={{ color: "var(--brass)" }}>
              <Sparkles size={18} />
              <span className="text-sm font-medium">Mode A — Consultation</span>
            </div>
            <h2 className="font-display text-2xl font-semibold">What happened, and where?</h2>
            <p className="mt-2 text-sm text-ink-soft">
              Describe your situation in your own words — Hindi or English. We'll identify the applicable
              legal framework, explain your options in plain language, and flag anything that needs an
              advocate's urgent attention.
            </p>
            <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {SUGGESTED.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="paper-card px-4 py-3 text-left text-sm transition-transform hover:-translate-y-0.5"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mx-auto max-w-2xl space-y-5">
          {messages.map((m, i) => (
            <div key={i} className={`animate-rise flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-[14px] px-4 py-3 text-sm leading-relaxed ${m.role === "user" ? "text-white" : "paper-card"}`}
                style={m.role === "user" ? { background: "var(--oxblood)" } : undefined}
              >
                {m.role === "assistant" ? (
                  <div className="prose-legal">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                ) : (
                  m.content
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="paper-card flex items-center gap-2 px-4 py-3 text-sm text-ink-faint">
                <Loader2 size={14} className="animate-spin" /> Running jurisdiction + applicable-law sweep…
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="border-t px-6 pt-3" style={{ borderColor: "var(--hairline)" }}>
        {(attachments.length > 0 || attaching || attachError) && (
          <div className="mx-auto mb-2 flex max-w-2xl flex-wrap gap-1.5">
            {attachments.map((a) => {
              const Icon = KIND_ICON[a.sourceKind];
              return (
                <span
                  key={a.fileName}
                  className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs"
                  style={{ borderColor: "var(--hairline)" }}
                >
                  <Icon size={11} className="text-ink-faint" />
                  <span className="max-w-[10rem] truncate">{a.fileName}</span>
                  {a.lowConfidence && <AlertTriangle size={10} style={{ color: "var(--unverified)" }} />}
                  <button type="button" onClick={() => removeAttachment(a.fileName)} className="text-ink-faint hover:text-current">
                    <X size={11} />
                  </button>
                </span>
              );
            })}
            {attaching && (
              <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs text-ink-faint" style={{ borderColor: "var(--hairline)" }}>
                <Loader2 size={11} className="animate-spin" /> Processing…
              </span>
            )}
            {attachError && <span className="text-xs" style={{ color: "var(--flagged)" }}>{attachError}</span>}
          </div>
        )}

        {recorder.status === "recording" && (
          <div className="mx-auto mb-2 flex max-w-2xl items-center gap-1.5 text-xs" style={{ color: "var(--flagged)" }}>
            <Mic size={12} className="animate-pulse" /> Recording… {formatSeconds(recorder.seconds)}
          </div>
        )}
        {recorder.error && <div className="mx-auto mb-2 max-w-2xl text-xs" style={{ color: "var(--flagged)" }}>{recorder.error}</div>}

        <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="mx-auto flex max-w-2xl items-end gap-2 pb-4">
          <input ref={fileInputRef} type="file" multiple className="hidden" accept={ACCEPT_ATTRIBUTE} onChange={(e) => { if (e.target.files) attachFiles(Array.from(e.target.files)); e.target.value = ""; }} />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Attach documents, images, audio, video, or a .zip"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border text-ink-faint hover:bg-[var(--paper-sunken)]"
            style={{ borderColor: "var(--hairline)" }}
          >
            <Paperclip size={16} />
          </button>
          <button
            type="button"
            onClick={recorder.status === "recording" ? recorder.stop : recorder.start}
            title="Speak the matter"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border hover:bg-[var(--paper-sunken)]"
            style={{ borderColor: recorder.status === "recording" ? "var(--flagged)" : "var(--hairline)", color: recorder.status === "recording" ? "var(--flagged)" : undefined }}
          >
            {recorder.status === "recording" ? <Square size={16} /> : <Mic size={16} />}
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder="Describe your situation, or attach/speak it…"
            rows={1}
            className="max-h-32 flex-1 resize-none rounded-[10px] border bg-transparent px-3.5 py-2.5 text-sm outline-none focus:border-[var(--oxblood)]"
            style={{ borderColor: "var(--hairline)" }}
          />
          <button
            type="submit"
            disabled={loading || (!input.trim() && attachments.length === 0)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] text-white disabled:opacity-40"
            style={{ background: "var(--oxblood)" }}
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
