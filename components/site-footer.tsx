import { Download, Globe2, ShieldCheck, Zap } from "lucide-react";

const FEATURES = [
  {
    icon: Zap,
    title: "Original quality",
    body: "Saves the file exactly as the source serves it. No re-encoding, no quality loss.",
  },
  {
    icon: ShieldCheck,
    title: "Private by design",
    body: "No tracking, no accounts, no server. The bytes never leave your browser.",
  },
  {
    icon: Download,
    title: "Browser delivery",
    body: "Saved straight to your device with a real progress bar. Nothing to install.",
  },
];

const STEPS = [
  {
    title: "Paste a direct link",
    body: "A link that points at a media file — .mp4, .webm, .mov, .mp3 or .m4a.",
  },
  {
    title: "Check the file",
    body: "Your browser reads the type, size and duration straight from the source.",
  },
  {
    title: "Save it",
    body: "Streamed into your downloads folder. Nothing is uploaded or stored.",
  },
];

export function Benefits() {
  return (
    <section className="benefits" aria-labelledby="benefits-title">
      <div className="benefits-head">
        <span className="section-label">Why Saveo</span>
        <h2 id="benefits-title">
          A downloader that <em>stays out of the way.</em>
        </h2>
      </div>

      <div className="benefit-list">
        {FEATURES.map(({ icon: Icon, title, body }, index) => (
          <article className="benefit" key={title}>
            <span className="benefit-index" aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div className="benefit-body">
              <h3>{title}</h3>
              <p>{body}</p>
            </div>
            <span className="benefit-icon" aria-hidden="true">
              <Icon size={16} />
            </span>
          </article>
        ))}
      </div>
    </section>
  );
}

export function Steps() {
  return (
    <section className="steps" id="how" aria-label="How Saveo works">
      {STEPS.map((step, index) => (
        <article className="step" key={step.title}>
          <span className="step-num" aria-hidden="true">
            {String(index + 1).padStart(2, "0")}
          </span>
          <h3>{step.title}</h3>
          <p>{step.body}</p>
        </article>
      ))}
    </section>
  );
}

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <span className="footer-mark" aria-hidden="true">
            <img src="/icon.svg" alt="" width={20} height={20} />
          </span>
          <span className="footer-brand-text">
            <strong>Saveo</strong>
            <small>media downloader</small>
          </span>
        </div>

        <p className="footer-note">
          <ShieldCheck size={14} aria-hidden="true" />
          Use only media you own or are authorized to save.
        </p>

        <span className="footer-version">
          <Globe2 size={13} aria-hidden="true" />
          v3.0
        </span>
      </div>
    </footer>
  );
}
