import { useEffect, useRef, useState, type FormEvent } from "react";
import { Bot, Mic, MicOff, Send, Sparkles, Volume2, VolumeX, X } from "lucide-react";
import type { NarratorLang } from "../voice/sonusNarrator";

export interface AssistantMessage {
  id: string;
  role: "user" | "sonus";
  text: string;
  badges?: string[];
}

export interface SonusAssistantDrawerProps {
  open: boolean;
  lang: NarratorLang;
  speaking: boolean;
  voiceReplyEnabled: boolean;
  messages: AssistantMessage[];
  onClose: () => void;
  onToggleVoiceReply: () => void;
  onChangeLang: (lang: NarratorLang) => void;
  onSendQuery: (query: string) => void;
}

interface SpeechRecLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

function createSpeechRecognition(): SpeechRecLike | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecLike;
    webkitSpeechRecognition?: new () => SpeechRecLike;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

const QUICK_PROMPTS_ES = [
  "¿Qué estoy escuchando?",
  "Llévame al Ártico y reproduce",
  "¿Por qué suena o no el fuego?",
  "¿Hay datos faltantes?",
];

const QUICK_PROMPTS_EN = [
  "What am I hearing?",
  "Go to the Arctic and play",
  "Explain fire frequencies",
  "Any missing data?",
];

export function SonusAssistantDrawer({
  open,
  lang,
  speaking,
  voiceReplyEnabled,
  messages,
  onClose,
  onToggleVoiceReply,
  onChangeLang,
  onSendQuery,
}: SonusAssistantDrawerProps) {
  const [draft, setDraft] = useState("");
  const [listening, setListening] = useState(false);
  const feedRef = useRef<HTMLDivElement | null>(null);
  const recRef = useRef<SpeechRecLike | null>(null);
  const micSupported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [messages, open]);

  useEffect(() => {
    return () => {
      try {
        recRef.current?.stop();
      } catch {
        /* ignorar al desmontar */
      }
    };
  }, []);

  if (!open) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const clean = draft.trim();
    if (!clean) return;
    onSendQuery(clean);
    setDraft("");
  };

  const toggleMic = () => {
    if (listening) {
      try {
        recRef.current?.stop();
      } catch {
        /* ignore */
      }
      setListening(false);
      return;
    }
    const rec = createSpeechRecognition();
    if (!rec) return;
    rec.lang = lang === "en" ? "en-US" : "es-MX";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (ev) => {
      const transcript = ev.results?.[0]?.[0]?.transcript?.trim();
      if (transcript) {
        onSendQuery(transcript);
      }
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    try {
      rec.start();
    } catch {
      setListening(false);
    }
  };

  const prompts = lang === "en" ? QUICK_PROMPTS_EN : QUICK_PROMPTS_ES;

  return (
    <aside
      className="glass-panel sonus-assistant-drawer"
      aria-label="SONUS Acoustic AI Assistant"
    >
      <header className="sonus-assistant__header">
        <div className="panel-title-group">
          <Bot size={15} className="panel-icon panel-icon--violet" aria-hidden="true" />
          <div>
            <h2 className="panel-title">SONUS AI COPILOT</h2>
            <span className="sonus-assistant__sub">
              {speaking ? "Speaking..." : "Acoustic & NASA telemetry agent"}
            </span>
          </div>
        </div>

        <div className="panel-badges">
          <div className="lang-switch" role="group" aria-label="Voice narration language">
            <button
              type="button"
              className={`lang-switch__btn ${lang === "en" ? "is-on" : ""}`}
              onClick={() => onChangeLang("en")}
            >
              EN
            </button>
            <button
              type="button"
              className={`lang-switch__btn ${lang === "es" ? "is-on" : ""}`}
              onClick={() => onChangeLang("es")}
            >
              ES
            </button>
          </div>
          <button
            type="button"
            className={`icon-btn ${voiceReplyEnabled ? "is-accent" : ""}`}
            onClick={onToggleVoiceReply}
            title={voiceReplyEnabled ? "Mute voice reply" : "Enable voice reply"}
            aria-label={voiceReplyEnabled ? "Mute voice reply" : "Enable voice reply"}
          >
            {voiceReplyEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            title="Close assistant"
            aria-label="Close assistant"
          >
            <X size={14} />
          </button>
        </div>
      </header>

      <div className="sonus-assistant__chips">
        {prompts.map((p) => (
          <button
            key={p}
            type="button"
            className="sonus-prompt-chip"
            onClick={() => onSendQuery(p)}
          >
            <Sparkles size={11} aria-hidden="true" />
            <span>{p}</span>
          </button>
        ))}
      </div>

      <div ref={feedRef} className="sonus-assistant__feed">
        {messages.map((m) => (
          <div key={m.id} className={`sonus-msg sonus-msg--${m.role}`}>
            <p>{m.text}</p>
            {m.badges && m.badges.length > 0 && (
              <div className="sonus-msg__badges">
                {m.badges.map((b) => (
                  <span key={b} className="micro-metric">
                    {b}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <form className="sonus-assistant__form" onSubmit={handleSubmit}>
        <input
          type="text"
          className="sonus-assistant__input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask about Hz or say 'go to Sahara'..."
          aria-label="Message for SONUS AI"
        />
        {micSupported && (
          <button
            type="button"
            className={`icon-btn ${listening ? "is-listening" : ""}`}
            onClick={toggleMic}
            title={listening ? "Stop microphone" : "Speak with microphone"}
            aria-label={listening ? "Stop microphone" : "Speak with microphone"}
          >
            {listening ? <MicOff size={14} /> : <Mic size={14} />}
          </button>
        )}
        <button
          type="submit"
          className="sonus-send-btn"
          title="Send"
          aria-label="Send message"
        >
          <Send size={13} aria-hidden="true" />
        </button>
      </form>
    </aside>
  );
}
