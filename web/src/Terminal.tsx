import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { api, streamUrl, type LogLine } from "./api";

// Renders a session's terminal output: loads history over REST, then live-streams
// new lines over WebSocket (deduped by seq).
export default function LiveTerminal({ sessionId }: { sessionId: string }) {
  const elRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const lastSeqRef = useRef(0);

  useEffect(() => {
    const term = new Terminal({
      convertEol: true,
      fontFamily: '"JetBrains Mono", SFMono-Regular, Menlo, Consolas, monospace',
      fontSize: 12.5,
      lineHeight: 1.35,
      letterSpacing: 0.2,
      theme: {
        background: "#101218",
        foreground: "#cdd1dc",
        cursor: "#6366f1",
        black: "#1d212b",
        brightBlack: "#646a7a",
        red: "#ef4444",
        brightRed: "#fca5a5",
        green: "#10b981",
        brightGreen: "#6ee7b7",
        yellow: "#f59e0b",
        brightYellow: "#fcd34d",
        blue: "#3b82f6",
        brightBlue: "#93c5fd",
        magenta: "#8b5cf6",
        brightMagenta: "#c4b5fd",
        cyan: "#06b6d4",
        brightCyan: "#67e8f9",
      },
      scrollback: 10000,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(elRef.current!);
    fit.fit();
    termRef.current = term;
    lastSeqRef.current = 0;

    const write = (line: LogLine) => {
      if (line.seq <= lastSeqRef.current) return;
      lastSeqRef.current = line.seq;
      const prefix = line.stream === "stderr" ? "\x1b[31m" : "";
      const suffix = line.stream === "stderr" ? "\x1b[0m" : "";
      term.write(prefix + line.content.replace(/\n$/, "") + suffix + "\r\n");
    };

    let ws: WebSocket | null = null;
    let closed = false;

    const onResize = () => fit.fit();
    window.addEventListener("resize", onResize);

    (async () => {
      try {
        const hist = await api.logs(sessionId, 0);
        for (const l of hist.lines) write(l);
      } catch {
        /* ignore */
      }
      if (closed) return;

      ws = new WebSocket(streamUrl(sessionId));
      ws.onmessage = (ev) => {
        const frame = JSON.parse(ev.data);
        if (frame.t === "backlog") {
          for (const f of frame.frames || []) handleFrame(f);
        } else {
          handleFrame(frame);
        }
      };

      function handleFrame(f: any) {
        if (f.t === "log") {
          write({ seq: f.seq, ts: f.ts, stream: f.stream, content: f.content });
        } else if (f.t === "logs") {
          for (const x of f.frames || []) write(x);
        } else if (f.t === "status") {
          term.write(`\x1b[33m── status: ${f.status} ──\x1b[0m\r\n`);
        } else if (f.t === "event" && f.event?.message) {
          term.write(`\x1b[36m· ${f.event.message}\x1b[0m\r\n`);
        }
      }
    })();

    return () => {
      closed = true;
      window.removeEventListener("resize", onResize);
      ws?.close();
      term.dispose();
    };
  }, [sessionId]);

  return <div className="terminal" ref={elRef} />;
}
