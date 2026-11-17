import { useEffect, useRef, useState } from "react";
import { ArrowRight, LockKeyhole, Mail, ShieldCheck, Store, UserRound } from "lucide-react";
import { Link, navigate } from "../components/Link";
import { Field } from "../components/Ui";
import { useStore } from "../lib/store";
import { useRoute } from "../lib/router";
import { toast } from "../lib/toast";

const demoAccounts = [
  { label: "Buyer demo", email: "buyer@lelam.co", password: "demo1234", note: "Shop, offers, bids" },
  { label: "Seller demo", email: "seller@lelam.co", password: "demo1234", note: "Listings, offers, payouts" },
  { label: "Admin demo", email: "admin@lelam.co", password: "admin1234", note: "Reviews, settings, finance" },
];

export function AuthPage({ mode }: { mode: "login" | "register" }) {
  const { login, register, signInWithGoogle, user } = useStore();
  const route = useRoute();
  const nextPath = route.query.get("next");
  const destination = nextPath?.startsWith("/") ? `#${nextPath}` : "#/account";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [asSeller, setAsSeller] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isGoogleReady, setIsGoogleReady] = useState(false);
  const googleBtnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) navigate(destination);
  }, [user, destination]);

  useEffect(() => {
    if (!document.querySelector('script[src="https://accounts.google.com/gsi/client"]')) {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }

    let checkInterval: any;
    const initializeGoogleButton = () => {
      const google = (window as any).google;
      if (google && googleBtnRef.current) {
        clearInterval(checkInterval);
        try {
          google.accounts.id.initialize({
            client_id:
              import.meta.env.VITE_GOOGLE_CLIENT_ID ||
              "646836716775-qdcu7env4a6i8490odqktdhji4p8qk93.apps.googleusercontent.com",
            callback: async (response: any) => {
              setIsGoogleLoading(true);
              const res = await signInWithGoogle(response.credential);
              setIsGoogleLoading(false);
              if (res.ok) {
                toast("Signed in with Google.", "success");
                navigate(destination);
              } else {
                toast(res.error, "error");
              }
            },
          });
          google.accounts.id.renderButton(googleBtnRef.current, {
            theme: "outline",
            size: "large",
            width: Math.min(googleBtnRef.current.parentElement?.clientWidth || 320, 380),
            text: "continue_with",
            shape: "rectangular",
          });
          setIsGoogleReady(true);
        } catch (err) {
          console.error("Error initializing Google Sign-In:", err);
        }
      }
    };

    checkInterval = setInterval(initializeGoogleButton, 200);
    initializeGoogleButton();
    return () => clearInterval(checkInterval);
  }, [signInWithGoogle, destination]);

  const submit = () => {
    if (mode === "login") {
      const result = login(email, password);
      if (result.ok) {
        toast("Welcome back.", "success");
        navigate(destination);
      } else {
        toast(result.error, "error");
      }
      return;
    }
    const result = register({ name, email, password, asSeller });
    if (result.ok) {
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
              ? "Sign in to buy, make private offers, bid in live auctions, and follow your deliveries."
              : "Create an account to shop the archive, or open a seller account to list the pieces you no longer wear."}
          </p>

          <ul className="auth-points">
            <li>
              <ShieldCheck size={16} /> Private offers, never public bidding
            </li>
            <li>
              <Store size={16} /> You keep any bid above your asking price in auctions
            </li>
            <li>
              <LockKeyhole size={16} /> Doorstep delivery across India
            </li>
          </ul>

          <div className="auth-demo">
            <span className="auth-demo-label">TRY A DEMO ACCOUNT</span>
            {demoAccounts.map((account) => (
              <button
                key={account.email}
                type="button"
                onClick={() => {
                  setEmail(account.email);
                  setPassword(account.password);
                  if (mode === "register") navigate("#/login");
                }}
              >
                <div>
                  <strong>{account.label}</strong>
                  <em>{account.note}</em>
                </div>
                <span>{account.email}</span>
              </button>
            ))}
            <p>Click a demo account to fill the form. No real account is created.</p>
          </div>
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
              submit();
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

          <div className="auth-divider">
            <span>or</span>
          </div>

          <div className="google-auth-wrap">
            <div ref={googleBtnRef} className="google-btn-container" />
            {!isGoogleReady && (
              <button
                type="button"
                className="button button-ghost button-google"
                disabled={isGoogleLoading}
                onClick={async () => {
                  const google = (window as any).google;
                  if (google?.accounts?.id) {
                    google.accounts.id.prompt();
                    return;
                  }
                  setIsGoogleLoading(true);
                  const res = await signInWithGoogle();
                  setIsGoogleLoading(false);
                  if (!res.ok) toast(res.error, "error");
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                {isGoogleLoading ? "Connecting..." : "Continue with Google"}
              </button>
            )}
          </div>

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
            This is a frontend demo. Accounts and passwords live in your browser only.
          </div>
        </section>
      </div>
    </main>
  );
}
