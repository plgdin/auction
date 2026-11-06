export type ToastTone = "neutral" | "success" | "error";

export function toast(message: string, tone: ToastTone = "neutral") {
  window.dispatchEvent(new CustomEvent("lelam-toast", { detail: { message, tone } }));
}
