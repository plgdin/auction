export interface AuthPromptDetail {
  /** Where to go after signing in. */
  next: string;
  /** What the visitor was trying to do. */
  action?: string;
}

const EVENT = "lelam-auth-required";

/** Ask the app shell to open the sign-in prompt. */
export function promptAuth(next = "#/", action?: string) {
  window.dispatchEvent(
    new CustomEvent<AuthPromptDetail>(EVENT, { detail: { next, action } }),
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
  return `${path}?next=${encodeURIComponent(next)}`;
}
