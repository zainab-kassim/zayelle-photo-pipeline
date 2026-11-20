"use client";

import { useEffect, useRef, useState } from "react";

type Output = {
  name: "large" | "thumb";
  width: number;
  height: number;
  bytes: number;
  fileName: string;
  dataUrl: string;
};

type Result = {
  original: { name: string; bytes: number; width?: number; height?: number; format?: string };
  outputs: Output[];
  ms: number;
};

type Status = "idle" | "ready" | "processing" | "done" | "error";

const kb = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(2)} MB` : `${(bytes / 1024).toFixed(1)} KB`;

const stamp = () => new Date().toLocaleTimeString("en-GB", { hour12: false });

export default function Page() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<Result | null>(null);
  const [dragging, setDragging] = useState(false);
  const [log, setLog] = useState<string[]>([`${stamp()}  pipeline online · sharp → webp ×2`]);
  const inputRef = useRef<HTMLInputElement>(null);

  const write = (line: string) => setLog((lines) => [...lines.slice(-7), `${stamp()}  ${line}`]);

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  function pick(next: File | undefined) {
    if (!next) return;
    if (!next.type.startsWith("image/")) {
      setStatus("error");
      write(`rejected ${next.name} — not an image`);
      return;
    }
    setFile(next);
    setPreview(URL.createObjectURL(next));
    setResult(null);
    setStatus("ready");
    write(`loaded ${next.name} · ${kb(next.size)}`);
  }

  async function run() {
    if (!file) return;
    setStatus("processing");
    write("POST /api/resize → resizeToWebp()");
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/resize", { method: "POST", body });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? `HTTP ${response.status}`);
      setResult(json);
      setStatus("done");
      for (const out of json.outputs as Output[]) {
        write(`wrote output/${out.fileName} · ${out.width}×${out.height} · ${kb(out.bytes)}`);
      }
      write(`done in ${json.ms} ms`);
    } catch (error) {
      setStatus("error");
      write(`error — ${error instanceof Error ? error.message : "unknown"}`);
    }
  }

  const saved = (bytes: number) =>
    result ? Math.max(0, Math.round((1 - bytes / result.original.bytes) * 100)) : 0;

  return (
    <main className="shell" data-state={status}>
      <header className="topbar">
        <div className="brand">
          <span className="mark" aria-hidden />
          <span>ZAYELLE</span>
          <span className="slash">//</span>
          <span className="dim">PHOTO_PIPELINE</span>
        </div>
        <div className="meta">
          <span>SHARP</span>
          <span>WEBP</span>
          <span>S3 → λ</span>
          <span className="status">
            <i /> {status.toUpperCase()}
          </span>
        </div>
      </header>

      <section className="intro">
        <p className="eyebrow">[ 01 ] INPUT → TRANSFORM → OUTPUT</p>
        <h1>
          Drop a photo.
          <br />
          Get two WebPs.
        </h1>
        <p className="sub">
          Same <code>resizeToWebp()</code> that runs in <code>local.ts</code> and the Lambda{" "}
          <code>handler.ts</code>. Results also land in <code>output/</code>.
        </p>
      </section>

      <Pipeline status={status} />

      <section className="grid">
        <div className="panel">
          <div className="panel-head">
            <span>IN · ORIGINAL</span>
            <span className="dim">{file ? file.type.replace("image/", "").toUpperCase() : "—"}</span>
          </div>

          <button
            type="button"
            className={`drop ${dragging ? "is-drag" : ""} ${preview ? "has-file" : ""}`}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              pick(e.dataTransfer.files[0]);
            }}
          >
            <Corners />
            {preview ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="Selected original" />
                {status === "processing" && <span className="scan" aria-hidden />}
              </>
            ) : (
              <span className="drop-empty">
                <span className="upload-icon" aria-hidden>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 15V4" />
                    <path d="M7.5 8.5 12 4l4.5 4.5" />
                    <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
                  </svg>
                </span>
                <span>DROP IMAGE OR CLICK TO BROWSE</span>
                <span className="dim">JPG · PNG · WEBP · AVIF · HEIC — max 25 MB</span>
              </span>
            )}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => pick(e.target.files?.[0])}
          />

          <dl className="specs">
            <div>
              <dt>FILE</dt>
              <dd>{file?.name ?? "—"}</dd>
            </div>
            <div>
              <dt>SIZE</dt>
              <dd>{file ? kb(file.size) : "—"}</dd>
            </div>
            <div>
              <dt>DIMS</dt>
              <dd>
                {result?.original.width ? `${result.original.width}×${result.original.height}` : "—"}
              </dd>
            </div>
          </dl>

          <button
            type="button"
            className="run"
            disabled={!file || status === "processing"}
            onClick={run}
          >
            {status === "processing" ? "PROCESSING…" : "RUN PIPELINE"}
            <span aria-hidden>→</span>
          </button>
        </div>

        <div className="panel">
          <div className="panel-head">
            <span>OUT · WEBP</span>
            <span className="dim">{result ? `${result.ms} MS` : "AWAITING INPUT"}</span>
          </div>

          <div className="outputs">
            {(result?.outputs ?? placeholders).map((out) => (
              <article key={out.name} className={`out ${result ? "" : "is-empty"}`}>
                <div className="out-thumb">
                  <Corners />
                  {out.dataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={out.dataUrl} alt={`${out.name} WebP`} />
                  ) : (
                    <span className="dim">{out.name === "large" ? "1200w" : "400w"}</span>
                  )}
                </div>
                <div className="out-body">
                  <div className="out-title">
                    <span>{out.name.toUpperCase()}</span>
                    <span className="tag">{out.name === "large" ? "Q80" : "Q75"}</span>
                  </div>
                  <dl className="specs tight">
                    <div>
                      <dt>DIMS</dt>
                      <dd>{result ? `${out.width}×${out.height}` : "—"}</dd>
                    </div>
                    <div>
                      <dt>SIZE</dt>
                      <dd>{result ? kb(out.bytes) : "—"}</dd>
                    </div>
                  </dl>
                  <div className="bar" aria-label={`${saved(out.bytes)}% smaller`}>
                    <span style={{ width: `${saved(out.bytes)}%` }} />
                  </div>
                  <div className="out-foot">
                    <span className="dim">{result ? `−${saved(out.bytes)}% vs original` : "—"}</span>
                    {result && (
                      <a href={out.dataUrl} download={out.fileName}>
                        DOWNLOAD ↓
                      </a>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="console" aria-live="polite">
        <div className="panel-head">
          <span>LOG</span>
          <span className="dim">stdout</span>
        </div>
        <pre>
          {log.map((line, i) => (
            <div key={i}>
              <span className="prompt">›</span> {line}
            </div>
          ))}
        </pre>
      </section>

      <footer className="foot">
        <span>src/resize.ts → src/local.ts · src/handler.ts · app/api/resize</span>
        <span>ZAYELLE © {new Date().getFullYear()}</span>
      </footer>
    </main>
  );
}

const placeholders: Output[] = [
  { name: "large", width: 0, height: 0, bytes: 0, fileName: "", dataUrl: "" },
  { name: "thumb", width: 0, height: 0, bytes: 0, fileName: "", dataUrl: "" },
];

function Corners() {
  return (
    <span className="corners" aria-hidden>
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}

function Pipeline({ status }: { status: Status }) {
  const lit = (step: number) => {
    if (status === "done") return "on";
    if (status === "processing") return step <= 2 ? "on" : "run";
    if (status === "ready") return step === 1 ? "on" : "";
    return "";
  };

  return (
    <svg className="pipeline" viewBox="0 0 960 150" role="img" aria-label="Pipeline: original to Sharp to two WebP outputs">
      <defs>
        <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" className="hatch-line" />
        </pattern>
      </defs>

      {/* wires */}
      <path className={`wire ${lit(2)}`} d="M200 75 H380" />
      <path className={`wire ${lit(3)}`} d="M580 75 H640 Q660 75 660 55 V45 Q660 30 680 30 H740" />
      <path className={`wire ${lit(3)}`} d="M580 75 H640 Q660 75 660 95 V105 Q660 120 680 120 H740" />

      {/* nodes */}
      <Node x={20} y={45} w={180} label="ORIGINAL" sub=".jpg / .png" state={lit(1)} />
      <Node x={380} y={45} w={200} label="SHARP" sub="rotate · resize · webp" state={lit(2)} />
      <Node x={740} y={8} w={200} label="LARGE.WEBP" sub="1200w · q80" state={lit(3)} />
      <Node x={740} y={98} w={200} label="THUMB.WEBP" sub="400w · q75" state={lit(3)} />

      {/* junction dots */}
      <circle cx="200" cy="75" r="3" className="dot" />
      <circle cx="380" cy="75" r="3" className="dot" />
      <circle cx="580" cy="75" r="3" className="dot" />
      <circle cx="740" cy="30" r="3" className="dot" />
      <circle cx="740" cy="120" r="3" className="dot" />
    </svg>
  );
}

function Node({
  x,
  y,
  w,
  label,
  sub,
  state,
}: {
  x: number;
  y: number;
  w: number;
  label: string;
  sub: string;
  state: string;
}) {
  return (
    <g className={`node ${state}`} transform={`translate(${x} ${y})`}>
      <rect width={w} height="44" className="node-box" />
      <rect width="6" height="44" fill="url(#hatch)" />
      <text x="18" y="19" className="node-label">
        {label}
      </text>
      <text x="18" y="34" className="node-sub">
        {sub}
      </text>
    </g>
  );
}
