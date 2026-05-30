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
      fontFamily: "SFMono-Regular, Menlo, Consolas, monospace",
      fontSize: 12,
      theme: { background: "#0b0e14", foreground: "#c5c8c6" },
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
