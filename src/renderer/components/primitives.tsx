import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Button({
  tone = "secondary",
  busy = false,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  readonly tone?: "primary" | "secondary" | "quiet";
  readonly busy?: boolean;
}) {
  return (
    <button
      {...props}
      type={props.type ?? "button"}
      className={`button ${tone} ${props.className ?? ""}`}
      disabled={props.disabled || busy}
      aria-busy={busy}
    >
      {children}
    </button>
  );
}

export function Status({
  tone = "neutral",
  children,
}: {
  readonly tone?: "neutral" | "success" | "pending" | "error";
  readonly children: ReactNode;
}) {
  return (
    <span className={`status ${tone}`}>
      <span className="status-dot" aria-hidden="true" />
      {children}
    </span>
  );
}

export function Panel({
  title,
  description,
  action,
  children,
}: {
  readonly title: string;
  readonly description?: string;
  readonly action?: ReactNode;
  readonly children: ReactNode;
}) {
  return (
    <section className="panel">
      <header className="panel-heading">
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

export function Notice({
  children,
  error = false,
}: {
  readonly children: ReactNode;
  readonly error?: boolean;
}) {
  return (
    <div
      className={`notice ${error ? "error" : ""}`}
      role={error ? "alert" : "status"}
    >
      {children}
    </div>
  );
}
