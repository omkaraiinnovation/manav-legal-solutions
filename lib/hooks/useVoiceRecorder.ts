"use client";
import { useRef, useState, useCallback, useEffect } from "react";

export type RecorderStatus = "idle" | "recording" | "error";

/**
 * Thin wrapper over the browser MediaRecorder API for voice-first intake
 * (spec §6: "Speak → Transcription → Fact Extraction..."). Shared by every
 * "Speak the matter" affordance in the app so the mic-permission/timer/
 * mimeType-negotiation logic lives in exactly one place. `onComplete` fires
 * with a File ready to hand to the same upload/transcription pipeline as
 * any other audio upload — the recording is not treated specially.
 */
export function useVoiceRecorder(onComplete: (file: File) => void) {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType =
        ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find(
          (t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)
        ) ?? "";
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const ext = recorder.mimeType?.includes("mp4") ? "m4a" : "webm";
        const file = new File([blob], `voice-note-${new Date().toISOString().replace(/[:.]/g, "-")}.${ext}`, {
          type: recorder.mimeType || "audio/webm",
        });
        setSeconds(0);
        setStatus("idle");
        onComplete(file);
      };
      recorderRef.current = recorder;
      recorder.start();
      setStatus("recording");
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      setError("Microphone access was denied or is unavailable. You can upload an audio file instead.");
      setStatus("error");
    }
  }, [onComplete]);

  const stop = useCallback(() => {
    recorderRef.current?.stop();
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
    },
    []
  );

  return { status, seconds, error, start, stop };
}

export function formatSeconds(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
