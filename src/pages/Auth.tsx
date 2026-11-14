import { useEffect, useState } from "react";
import { ArrowRight, LockKeyhole, Mail, ShieldCheck, Store, UserRound } from "lucide-react";
import { Link, navigate } from "../components/Link";
import { Field } from "../components/Ui";
import { useStore } from "../lib/store";
import { useRoute } from "../lib/router";
import { toast } from "../lib/toast";

export function AuthPage({ mode }: { mode: "login" | "register" }) {
  const { login, register, user } = useStore();
  const route = useRoute();
  const nextPath = route.query.get("next");
  const destination = nextPath?.startsWith("/") ? `#${nextPath}` : "#/account";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [asSeller, setAsSeller] = useState(false);

  useEffect(() => {
    if (user) navigate(destination);
  }, [user, destination]);

  const submit = async () => {
    if (mode === "login") {
      const result = await login(email, password);
      if (result.ok) {
        toast("Welcome back.", "success");
        navigate(destination);
      } else {
        toast(result.error, "error");
      }
      return;
    }
    const result = await register({ name, email, password, asSeller });
    if (result.ok) {
      if (result.needsConfirmation) {
        toast("Check your email to confirm the account, then sign in.", "success");
        navigate("#/login");
        return;
      }
      toast(asSeller ? "Seller account created." : "Account created.", "success");
      navigate(nextPath?.startsWith("/") ? destination : asSeller ? "#/seller" : "#/account");
    } else {
      toast(result.error, "error");
    }
  };

  return (
    <main className="page-shell auth-page">
      <div className="section-wrap auth-layout">
        <section className="auth-aside">
          <div className="eyebrow">{mode === "login" ? "WELCOME BACK" : "JOIN LELAM"}</div>
          <h1>
            {mode === "login" ? (
              <>
                The rail has been <em>waiting.</em>
              </>
            ) : (
              <>
                One closet, <em>two lives.</em>
              </>
            )}
          </h1>
          <p>
            {mode === "login"
              ? "Sign in to buy, make private offers, sell, and follow your deliveries."
              : "Create an account to shop the archive, or open a seller account to list the pieces you no longer wear."}
          </p>

          <ul className="auth-points">
            <li>
              <ShieldCheck size={16} /> Private offers, never public bidding
            </li>
            <li>
              <Store size={16} /> Seller payouts protected at asking price in auctions
            </li>
            <li>
              <LockKeyhole size={16} /> Delivery only within Trivandrum 695xxx
            </li>
          </ul>
        </section>

        <section className="auth-card">
          <div className="auth-card-head">
            <span className="eyebrow">{mode === "login" ? "SIGN IN" : "CREATE ACCOUNT"}</span>
            <h2>{mode === "login" ? "Good to see you." : "Start here."}</h2>
          </div>

          <form
            className="auth-form"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            {mode === "register" && (
              <>
                <Field label="Full name">
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                    autoComplete="name"
                    placeholder="Your name"
                  />
                </Field>
                <label className="auth-seller-toggle">
                  <input
                    type="checkbox"
                    checked={asSeller}
                    onChange={(event) => setAsSeller(event.target.checked)}
                  />
                  <span>
                    <strong>I want to sell too</strong>
                    <em>Adds a seller dashboard to this account.</em>
                  </span>
                </label>
              </>
            )}
            <Field label="Email">
              <div className="auth-input-wrap">
                <Mail size={16} />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                />
              </div>
            </Field>
            <Field
              label="Password"
              hint={mode === "register" ? "At least 8 characters." : undefined}
            >
              <div className="auth-input-wrap">
                <LockKeyhole size={16} />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  placeholder="••••••••"
                />
              </div>
            </Field>

            <button type="submit" className="button button-olive auth-submit">
              {mode === "login" ? (
                <>
                  Sign in <ArrowRight size={16} />
                </>
              ) : (
                <>
                  Create account <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <div className="auth-switch">
            {mode === "login" ? (
              <>
                New here? <Link href="#/register">Create an account</Link>
              </>
            ) : (
              <>
                Already have an account? <Link href="#/login">Sign in</Link>
              </>
            )}
          </div>

          <div className="auth-demo-note">
            <UserRound size={14} />
            Your account is securely managed by Supabase. We never store your password in the browser.
          </div>
        </section>
      </div>
    </main>
  );
}
