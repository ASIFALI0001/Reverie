/**
 * Firebase error code → what the person should do next. Never reveals whether
 * an account exists. Returns null for errors that need no message (user cancelled).
 */
export function authErrorMessage(err: unknown): string | null {
  const code = (err as { code?: string } | null)?.code ?? "";
  switch (code) {
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
    case "auth/user-cancelled":
      return null;
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
    case "auth/invalid-login-credentials":
      return "That email and password don’t match. Try again, or reset your password.";
    case "auth/email-already-in-use":
      return "An account with this email already exists. Sign in instead.";
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/weak-password":
    case "auth/password-does-not-meet-requirements":
      return "Choose a longer password — at least 8 characters.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a minute, then try again.";
    case "auth/network-request-failed":
      return "Can’t reach the sign-in service. Check your connection and try again.";
    case "auth/user-disabled":
      return "This account has been disabled.";
    case "auth/account-exists-with-different-credential":
      return "This email already uses a different sign-in method. Sign in with email and password instead.";
    case "auth/unauthorized-domain":
      return "Sign-in isn’t enabled for this address yet. Add it under Firebase → Authentication → Authorized domains.";
    case "auth/requires-recent-login":
      return "For your security, sign in again to continue.";
    default: {
      const message = (err as { message?: string } | null)?.message;
      if (message && !code) return message;
      return "Something went wrong signing you in. Try again.";
    }
  }
}
