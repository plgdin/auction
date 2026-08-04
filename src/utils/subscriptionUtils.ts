// Subscription & Trial utilities

export interface SubscriptionStatus {
  isExpired: boolean;
  daysRemaining: number;
  statusText: string;
  isTrial: boolean;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export const setTrialStartTimestamp = (userId?: string) => {
  const now = Date.now();
  localStorage.setItem(`lelam_trial_start_${userId || 'guest'}`, now.toString());
  localStorage.setItem('lelam_trial_start', now.toString());
};

export const getTrialStatus = (userId?: string): SubscriptionStatus => {
  const stored = localStorage.getItem(`lelam_trial_start_${userId || 'guest'}`) || localStorage.getItem('lelam_trial_start');
  
  if (!stored) {
    return {
      isExpired: false,
      daysRemaining: 7,
      statusText: '7-Day Free Trial Active',
      isTrial: true,
    };
  }

  const startTime = parseInt(stored, 10);
  const elapsed = Date.now() - startTime;
  const daysElapsed = elapsed / (1000 * 60 * 60 * 24);
  const daysRemaining = Math.max(0, Math.ceil(7 - daysElapsed));

  if (elapsed >= SEVEN_DAYS_MS) {
    return {
      isExpired: true,
      daysRemaining: 0,
      statusText: 'Your subscription is over',
      isTrial: true,
    };
  }

  return {
    isExpired: false,
    daysRemaining,
    statusText: `${daysRemaining} days remaining in Free Trial`,
    isTrial: true,
  };
};
