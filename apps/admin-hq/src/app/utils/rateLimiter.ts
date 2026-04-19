const LOGIN_ATTEMPTS_KEY = "messflow_login_attempts";
const LOGIN_LOCKOUT_KEY = "messflow_login_lockout";
const ACTION_ATTEMPTS_PREFIX = "messflow_action_attempts_";
const ACTION_LOCKOUT_PREFIX = "messflow_action_lockout_";

const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes

const MAX_ACTION_ATTEMPTS = 3;
const ACTION_LOCKOUT_DURATION_MS = 2 * 60 * 1000; // 2 minutes

export function checkLoginRateLimit(): { allowed: boolean; remainingSeconds: number } {
  const lockoutTimeStr = localStorage.getItem(LOGIN_LOCKOUT_KEY);
  if (lockoutTimeStr) {
    const lockoutTime = parseInt(lockoutTimeStr, 10);
    const now = Date.now();
    if (now < lockoutTime) {
      return { allowed: false, remainingSeconds: Math.ceil((lockoutTime - now) / 1000) };
    } else {
      // Lockout expired
      localStorage.removeItem(LOGIN_LOCKOUT_KEY);
      localStorage.setItem(LOGIN_ATTEMPTS_KEY, "0");
    }
  }
  return { allowed: true, remainingSeconds: 0 };
}

export function recordFailedLoginAttempt() {
  let attempts = parseInt(localStorage.getItem(LOGIN_ATTEMPTS_KEY) || "0", 10);
  attempts += 1;
  
  if (attempts >= MAX_LOGIN_ATTEMPTS) {
    const lockoutTime = Date.now() + LOGIN_LOCKOUT_DURATION_MS;
    localStorage.setItem(LOGIN_LOCKOUT_KEY, lockoutTime.toString());
  } else {
    localStorage.setItem(LOGIN_ATTEMPTS_KEY, attempts.toString());
  }
}

export function resetLoginRateLimit() {
  localStorage.removeItem(LOGIN_ATTEMPTS_KEY);
  localStorage.removeItem(LOGIN_LOCKOUT_KEY);
}

export function checkActionRateLimit(key: string): { allowed: boolean; remainingSeconds: number } {
  const lockoutTimeStr = localStorage.getItem(`${ACTION_LOCKOUT_PREFIX}${key}`);
  if (lockoutTimeStr) {
    const lockoutTime = parseInt(lockoutTimeStr, 10);
    const now = Date.now();
    if (now < lockoutTime) {
      return { allowed: false, remainingSeconds: Math.ceil((lockoutTime - now) / 1000) };
    } else {
      // Lockout expired
      localStorage.removeItem(`${ACTION_LOCKOUT_PREFIX}${key}`);
      localStorage.removeItem(`${ACTION_ATTEMPTS_PREFIX}${key}`);
    }
  }
  return { allowed: true, remainingSeconds: 0 };
}

export function recordFailedAction(key: string) {
  let attempts = parseInt(localStorage.getItem(`${ACTION_ATTEMPTS_PREFIX}${key}`) || "0", 10);
  attempts += 1;
  
  if (attempts >= MAX_ACTION_ATTEMPTS) {
    const lockoutTime = Date.now() + ACTION_LOCKOUT_DURATION_MS;
    localStorage.setItem(`${ACTION_LOCKOUT_PREFIX}${key}`, lockoutTime.toString());
  } else {
    localStorage.setItem(`${ACTION_ATTEMPTS_PREFIX}${key}`, attempts.toString());
  }
}

export function resetActionRateLimit(key: string) {
  localStorage.removeItem(`${ACTION_ATTEMPTS_PREFIX}${key}`);
  localStorage.removeItem(`${ACTION_LOCKOUT_PREFIX}${key}`);
}
