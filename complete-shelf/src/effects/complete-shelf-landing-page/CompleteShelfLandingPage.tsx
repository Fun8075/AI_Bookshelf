import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import "./styles.css";

const DEFAULT_SOURCE_URL = "/landing-pages/complete-shelf-v2.html";

const FONT_STACKS = {
  "iowan-old-style": '"Iowan Old Style", "Baskerville", "Times New Roman", serif',
  "instrument-serif":
    '"Instrument Serif", "Iowan Old Style", "Times New Roman", serif',
  newsreader: '"Newsreader", "Iowan Old Style", "Times New Roman", serif',
  geist:
    '"Geist", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  inter:
    '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
} as const;

/** Google Fonts specs for the families the authored document does not ship. */
const WEBFONTS: Partial<Record<keyof typeof FONT_STACKS, string>> = {
  "instrument-serif": "Instrument+Serif:ital@0;1",
  newsreader: "Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600",
  geist: "Geist:wght@400;500;600",
};

export type CompleteShelfFont = keyof typeof FONT_STACKS;

export interface CompleteShelfLandingPageProps {
  /** Path to the byte-exact authored document. Defaults to the bundled copy. */
  sourceUrl?: string;
  /** Accessible name for the embedded document. */
  title?: string;
  /** Overrides the document's `--accent` token (e.g. `#c87046`). */
  primaryColor?: string;
  /** Overrides the document's `--serif` heading stack. */
  headingFont?: CompleteShelfFont;
  /** Overrides the document's `--mono` body stack. */
  bodyFont?: CompleteShelfFont;
  className?: string;
  style?: CSSProperties;
  onReady?: () => void;
}

type Status = "loading" | "ready" | "error";

function ensureWebfont(doc: Document, font: CompleteShelfFont) {
  const spec = WEBFONTS[font];
  if (!spec) return;

  // 字体已随项目本地化到 /fonts/fonts.css，不再请求外部 CDN
  if (doc.head.querySelector('link[href="/fonts/fonts.css"]')) return;

  const link = doc.createElement("link");
  link.rel = "stylesheet";
  link.href = "/fonts/fonts.css";
  link.dataset.completeShelfFonts = "local";
  doc.head.appendChild(link);
}

function applyTheme(
  doc: Document,
  theme: Pick<
    CompleteShelfLandingPageProps,
    "primaryColor" | "headingFont" | "bodyFont"
  >
) {
  const root = doc.documentElement;
  const { primaryColor, headingFont, bodyFont } = theme;

  if (primaryColor) {
    root.style.setProperty("--accent", primaryColor);
  }
  if (headingFont) {
    root.style.setProperty("--serif", FONT_STACKS[headingFont]);
    ensureWebfont(doc, headingFont);
  }
  if (bodyFont) {
    root.style.setProperty("--mono", FONT_STACKS[bodyFont]);
    ensureWebfont(doc, bodyFont);
  }
}

/**
 * Hosts the Complete Shelf landing page.
 *
 * The authored document is served untouched from `sourceUrl` and rendered in a
 * same-origin iframe; React only owns the sized frame, the loading veil, and
 * the optional theme tokens. Its Three.js renderer, interactions, and lifecycle
 * stay inside the document, and are released when the iframe is torn down.
 */
export function CompleteShelfLandingPage({
  sourceUrl = DEFAULT_SOURCE_URL,
  title = "工作卷册 — 七件创作工具",
  primaryColor,
  headingFont,
  bodyFont,
  className,
  style,
  onReady,
}: CompleteShelfLandingPageProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [status, setStatus] = useState<Status>("loading");

  const handleLoad = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) {
      setStatus("error");
      return;
    }
    setStatus("ready");
    onReady?.();
  }, [onReady]);

  const handleError = useCallback(() => {
    setStatus("error");
  }, []);

  useEffect(() => {
    if (status !== "ready") return;
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    applyTheme(doc, { primaryColor, headingFont, bodyFont });
  }, [status, primaryColor, headingFont, bodyFont]);

  const frameClassName = className
    ? `effect-frame ${className}`
    : "effect-frame";

  return (
    <div className={frameClassName} style={style}>
      <iframe
        ref={iframeRef}
        className="effect-frame__document"
        src={sourceUrl}
        title={title}
        onLoad={handleLoad}
        onError={handleError}
        allow="fullscreen; clipboard-write"
      />

      <div className="effect-frame__veil" data-hidden={status === "ready"}>
        {status === "error" ? (
          <div className="effect-frame__error">
            <p className="effect-frame__mark">完整书架暂不可用</p>
            <a
              className="effect-frame__link"
              href={sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              直接打开文档
            </a>
          </div>
        ) : (
          <p className="effect-frame__mark" role="status">
            正在载入书架
          </p>
        )}
      </div>
    </div>
  );
}

export default CompleteShelfLandingPage;
