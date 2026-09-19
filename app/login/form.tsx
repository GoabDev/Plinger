"use client";

import { useActionState } from "react";
import { ArrowRight } from "lucide-react";
import { signIn } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, { error: null, fieldErrors: {} });
  const emailError = state.fieldErrors.email;
  const passwordError = state.fieldErrors.password;

  return (
    <form action={action} className="login-form">
      <label htmlFor="login-email">Email address</label>
      <input
        id="login-email"
        name="email"
        type="email"
        autoComplete="username"
        required
        aria-invalid={Boolean(state.error || emailError)}
        aria-describedby={[emailError ? "login-email-error" : "", state.error ? "login-error" : ""].filter(Boolean).join(" ") || undefined}
      />
      {emailError && <p id="login-email-error" className="login-error" role="alert">{emailError}</p>}
      <label htmlFor="login-password">Password</label>
      <input
        id="login-password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        aria-invalid={Boolean(state.error || passwordError)}
        aria-describedby={[passwordError ? "login-password-error" : "", state.error ? "login-error" : ""].filter(Boolean).join(" ") || undefined}
      />
      {passwordError && <p id="login-password-error" className="login-error" role="alert">{passwordError}</p>}
      {state.error && (
        <p id="login-error" className="login-error" role="alert">
          {state.error}
        </p>
      )}
      <button className="button button-black login-submit" disabled={pending}>
        {pending ? "Signing in..." : "Sign in"}
        <ArrowRight size={16} aria-hidden="true" />
      </button>
    </form>
  );
}
