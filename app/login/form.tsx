"use client";

import { useActionState } from "react";
import { ArrowRight } from "lucide-react";
import { signIn } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, { error: null });

  return (
    <form action={action} className="login-form">
      <label htmlFor="login-email">Email address</label>
      <input
        id="login-email"
        name="email"
        type="email"
        autoComplete="username"
        required
        aria-invalid={Boolean(state.error)}
        aria-describedby={state.error ? "login-error" : undefined}
      />
      <label htmlFor="login-password">Password</label>
      <input
        id="login-password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        aria-invalid={Boolean(state.error)}
        aria-describedby={state.error ? "login-error" : undefined}
      />
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
