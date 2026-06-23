export type CookieConsentChoice = 'accepted' | 'declined';

const CONSENT_COOKIE = 'lelam_cookie_consent';
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function readCookieConsent(): CookieConsentChoice | null {
  const consent = document.cookie
    .split('; ')
    .find(cookie => cookie.startsWith(`${CONSENT_COOKIE}=`));
  const value = consent ? decodeURIComponent(consent.split('=')[1]) : null;
  return value === 'accepted' || value === 'declined' ? value : null;
}

export function writeCookieConsent(value: CookieConsentChoice) {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${CONSENT_COOKIE}=${value}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax${secure}`;
  window.dispatchEvent(new CustomEvent('cookie-consent-changed', { detail: value }));
}

export function hasPersonalizationConsent(): boolean {
  return readCookieConsent() === 'accepted';
}
