export interface AuthPromptDetail {
  /** Where to go after signing in. Clean path, e.g. "/auction/a-1". */
  next: string;
  /** What the visitor was trying to do. */
  action?: string;
}

const EVENT = "lelam-auth-required";

/** Legacy hash route ("#/x") and plain paths normalise to "/x". */
function toPath(value: string): string {
  if (!value) return "/";
  if (value.startsWith("#/")) return value.slice(1);
  if (value.startsWith("#")) return "/";
  return value.startsWith("/") ? value : `/${value}`;
}

/** Ask the app shell to open the sign-in prompt. */
export function promptAuth(next = "/", action?: string) {
  window.dispatchEvent(
    new CustomEvent<AuthPromptDetail>(EVENT, { detail: { next: toPath(next), action } }),
  );
}

export function onAuthPrompt(handler: (detail: AuthPromptDetail) => void) {
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<AuthPromptDetail>).detail;
    if (detail?.next) handler(detail);
  };
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}

export function withNext(path: string, next: string) {
  const base = path.startsWith("#/") ? path.slice(1) : path;
  const target = toPath(next);
  return `${base}?next=${encodeURIComponent(target)}`;
}
