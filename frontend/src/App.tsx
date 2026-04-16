/*
import { startTransition, useEffect, useState } from "react";
import "./App.css";

import { ApiError } from "./lib/api";
import { authService } from "./services/auth";
import type { AuthSession, PendingRegistration } from "./types/auth";
import {
  type FieldErrors,
  type LoginValues,
  type OtpValues,
  type RegistrationValues,
  validateLogin,
  validateOtp,
  validateRegistration,
} from "./utils/validation";

type AppView = "register" | "verify" | "login" | "dashboard";

const pendingRegistrationStorageKey = "mms.pendingRegistration";

const defaultRegistrationValues: RegistrationValues = {
  shopName: "",
  fullName: "",
  email: "",
  mobileNumber: "",
  password: "",
  confirmPassword: "",
  termsAccepted: false,
};

const defaultOtpValues: OtpValues = {
  otp: "",
};

const defaultLoginValues: LoginValues = {
  email: "",
  password: "",
};

const formatApiError = (error: unknown) => {
  if (error instanceof ApiError) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
};

const formatExpiry = (isoDate: string) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(isoDate));

function App() {
  const [view, setView] = useState<AppView>("register");
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [pendingRegistration, setPendingRegistration] = useState<PendingRegistration | null>(null);

  const [registrationValues, setRegistrationValues] =
    useState<RegistrationValues>(defaultRegistrationValues);
  const [registrationErrors, setRegistrationErrors] = useState<FieldErrors<RegistrationValues>>({});
  const [registrationStatus, setRegistrationStatus] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);

  const [otpValues, setOtpValues] = useState<OtpValues>(defaultOtpValues);
  const [otpErrors, setOtpErrors] = useState<FieldErrors<OtpValues>>({});
  const [otpStatus, setOtpStatus] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const [loginValues, setLoginValues] = useState<LoginValues>(defaultLoginValues);
  const [loginErrors, setLoginErrors] = useState<FieldErrors<LoginValues>>({});
  const [loginStatus, setLoginStatus] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    const cachedPending = window.sessionStorage.getItem(pendingRegistrationStorageKey);

    if (cachedPending) {
      try {
        const parsedPending = JSON.parse(cachedPending) as PendingRegistration;
        setPendingRegistration(parsedPending);
        startTransition(() => {
          setView("verify");
        });
      } catch {
        window.sessionStorage.removeItem(pendingRegistrationStorageKey);
      }
    }

    void authService
      .getSession()
      .then((activeSession) => {
        setSession(activeSession);
        startTransition(() => {
          setView("dashboard");
        });
      })
      .catch(() => undefined)
      .finally(() => {
        setIsBootstrapping(false);
      });
  }, []);

  const switchView = (nextView: AppView) => {
    setRegistrationStatus("");
    setOtpStatus("");
    setLoginStatus("");
    startTransition(() => {
      setView(nextView);
    });
  };

  const handleRegistrationChange = <K extends keyof RegistrationValues>(
    field: K,
    value: RegistrationValues[K],
  ) => {
    setRegistrationValues((current) => ({ ...current, [field]: value }));
    setRegistrationErrors((current) => ({ ...current, [field]: undefined }));
  };

  const handleOtpChange = <K extends keyof OtpValues>(field: K, value: OtpValues[K]) => {
    const sanitizedValue = value.replace(/\D/g, "").slice(0, 6) as OtpValues[K];
    setOtpValues((current) => ({ ...current, [field]: sanitizedValue }));
    setOtpErrors((current) => ({ ...current, [field]: undefined }));
  };

  const handleLoginChange = <K extends keyof LoginValues>(field: K, value: LoginValues[K]) => {
    setLoginValues((current) => ({ ...current, [field]: value }));
    setLoginErrors((current) => ({ ...current, [field]: undefined }));
  };

  const handleRegisterSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validateRegistration(registrationValues);
    setRegistrationErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsRegistering(true);
    setRegistrationStatus("");

    try {
      const response = await authService.registerAdmin(registrationValues);
      const nextPendingRegistration: PendingRegistration = {
        shopName: response.shop.name,
        fullName: response.user.fullName,
        email: response.user.email,
        mobileNumber: response.user.mobileNumber,
        pendingUserId: response.pendingUserId,
        expiresAt: response.verification.expiresAt,
        emailVerified: response.verification.emailVerified,
        mobileVerified: response.verification.mobileVerified,
      };

      setPendingRegistration(nextPendingRegistration);
      window.sessionStorage.setItem(
        pendingRegistrationStorageKey,
        JSON.stringify(nextPendingRegistration),
      );

      setOtpValues(defaultOtpValues);
      switchView("verify");
      setOtpStatus(`${response.message} We sent verification codes to your email and mobile.`);
    } catch (error) {
      setRegistrationErrors((current) => ({
        ...current,
        form: formatApiError(error),
      }));
    } finally {
      setIsRegistering(false);
    }
  };

  const handleVerifySubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!pendingRegistration) {
      setOtpErrors({ form: "Start registration first so we know where to verify the account." });
      switchView("register");
      return;
    }

    const nextErrors = validateOtp(otpValues);
    setOtpErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsVerifying(true);
    setOtpStatus("");

    try {
      const response = await authService.verifyRegistration({
        email: pendingRegistration.email,
        mobileNumber: pendingRegistration.mobileNumber,
        otp: otpValues.otp,
      });

      const updatedPendingRegistration: PendingRegistration = {
        ...pendingRegistration,
        emailVerified: response.user.emailVerified,
        mobileVerified: response.user.mobileVerified,
      };

      setPendingRegistration(updatedPendingRegistration);
      window.sessionStorage.setItem(
        pendingRegistrationStorageKey,
        JSON.stringify(updatedPendingRegistration),
      );
      setOtpStatus(response.message);

      if (response.isCompleted) {
        window.sessionStorage.removeItem(pendingRegistrationStorageKey);
        setPendingRegistration(null);
        setOtpValues(defaultOtpValues);
        setLoginValues((current) => ({
          ...current,
          email: response.user.email,
        }));
        setRegistrationValues(defaultRegistrationValues);
        switchView("login");
        setLoginStatus("Verification completed. Sign in with your email address and password.");
      }
    } catch (error) {
      setOtpErrors((current) => ({
        ...current,
        form: formatApiError(error),
      }));
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendOtp = async () => {
    if (!pendingRegistration) {
      return;
    }

    setIsResending(true);
    setOtpErrors({});

    try {
      const response = await authService.resendRegistrationOtp({
        email: pendingRegistration.email,
        mobileNumber: pendingRegistration.mobileNumber,
      });

      const updatedPendingRegistration: PendingRegistration = {
        ...pendingRegistration,
        expiresAt: response.verification.expiresAt,
        emailVerified: response.verification.emailVerified,
        mobileVerified: response.verification.mobileVerified,
      };

      setPendingRegistration(updatedPendingRegistration);
      window.sessionStorage.setItem(
        pendingRegistrationStorageKey,
        JSON.stringify(updatedPendingRegistration),
      );
      setOtpStatus(response.message);
    } catch (error) {
      setOtpErrors((current) => ({
        ...current,
        form: formatApiError(error),
      }));
    } finally {
      setIsResending(false);
    }
  };

  const handleLoginSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validateLogin(loginValues);
    setLoginErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsLoggingIn(true);
    setLoginStatus("");

    try {
      const response = await authService.login(loginValues);
      const nextSession = await authService.getSession().catch<AuthSession | null>(() => null);

      const activeSession =
        nextSession ?? {
          sessionId: "active",
          sessionExpiresAt: response.sessionExpiresAt,
          user: response.user,
          shop: response.shop,
        };

      setSession(activeSession);
      switchView("dashboard");
    } catch (error) {
      setLoginErrors((current) => ({
        ...current,
        form: formatApiError(error),
      }));
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await authService.logout();
    } finally {
      setSession(null);
      switchView("login");
      setLoginValues(defaultLoginValues);
      setLoginStatus("Your session has ended.");
    }
  };

  if (isBootstrapping) {
    return (
      <main className="auth-shell auth-shell--loading">
        <div className="loading-card">
          <span className="loading-card__pulse" />
          <p>Preparing the secure access experience...</p>
        </div>
      </main>
    );
  }

  if (view === "dashboard" && session) {
    return (
      <main className="dashboard-shell">
        <section className="dashboard-card">
          <div className="dashboard-card__header">
            <div>
              <p className="auth-card__tag">Temporary landing page</p>
              <h1>{session.shop.name}</h1>
              <p className="dashboard-card__subtitle">
                Login is working. You can use this page as the temporary redirect target until the
                main application modules are ready.
              </p>
            </div>
            <button className="secondary-button" onClick={handleLogout} type="button">
              Log out
            </button>
          </div>

          <div className="dashboard-grid">
            <article className="dashboard-stat">
              <span>User</span>
              <strong>{session.user.fullName}</strong>
              <p>{session.user.email}</p>
            </article>
            <article className="dashboard-stat">
              <span>Role</span>
              <strong>{session.user.role}</strong>
              <p>Detected automatically from the authenticated session.</p>
            </article>
            <article className="dashboard-stat">
              <span>Shop status</span>
              <strong>{session.shop.status}</strong>
              <p>Admin account is active and linked to the registered shop.</p>
            </article>
            <article className="dashboard-stat">
              <span>Session expiry</span>
              <strong>{formatExpiry(session.sessionExpiresAt)}</strong>
              <p>The backend session cookie is active and validated.</p>
            </article>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-shell">
      <section className="auth-hero">
        <div className="auth-hero__eyebrow">Medical Management System</div>
        <h1>Secure access for clinics, staff operations, and financial workflows.</h1>
        <p className="auth-hero__lead">
          Register the first shop administrator, verify both communication channels, and use the
          same login architecture that is already ready for admin, staff, and accountant roles.
        </p>

        <div className="hero-grid">
          <article className="hero-metric">
            <strong>Shared OTP delivery</strong>
            <span>The same 6-digit OTP is sent to both email and SMS for backup delivery.</span>
          </article>
          <article className="hero-metric">
            <strong>Role-ready login</strong>
            <span>Single secure sign-in path for all current and future users.</span>
          </article>
          <article className="hero-metric">
            <strong>Protected sessions</strong>
            <span>Cookie-based auth with backend-managed session validation.</span>
          </article>
        </div>

        <div className="hero-note">
          <span className="hero-note__label">Flow</span>
          <p>Register shop admin -&gt; receive one OTP on email and SMS -&gt; sign in with email + password.</p>
        </div>
      </section>

      <section className="auth-panel">
        {session ? (
          <div className="auth-card">
            <div className="auth-card__header">
              <div>
                <p className="auth-card__tag">Authenticated session</p>
                <h2>Welcome back, {session.user.fullName}</h2>
              </div>
              <button className="secondary-button" onClick={handleLogout} type="button">
                Log out
              </button>
            </div>

            <div className="session-grid">
              <div className="session-item">
                <span>Role</span>
                <strong>{session.user.role}</strong>
              </div>
              <div className="session-item">
                <span>Shop</span>
                <strong>{session.shop.name}</strong>
              </div>
              <div className="session-item">
                <span>Email</span>
                <strong>{session.user.email}</strong>
              </div>
              <div className="session-item">
                <span>Mobile</span>
                <strong>{session.user.mobileNumber}</strong>
              </div>
              <div className="session-item">
                <span>Session expiry</span>
                <strong>{formatExpiry(session.sessionExpiresAt)}</strong>
              </div>
              <div className="session-item">
                <span>Shop status</span>
                <strong>{session.shop.status}</strong>
              </div>
            </div>
          </div>
        ) : (
          <div className="auth-card">
            <div className="view-switcher" role="tablist" aria-label="Authentication views">
              <button
                className={view === "register" ? "view-switcher__tab is-active" : "view-switcher__tab"}
                onClick={() => switchView("register")}
                type="button"
              >
                Admin registration
              </button>
              <button
                className={view === "verify" ? "view-switcher__tab is-active" : "view-switcher__tab"}
                onClick={() => switchView("verify")}
                type="button"
              >
                OTP verification
              </button>
              <button
                className={view === "login" ? "view-switcher__tab is-active" : "view-switcher__tab"}
                onClick={() => switchView("login")}
                type="button"
              >
                Login
              </button>
            </div>

            {view === "register" && (
              <form className="form-stack" onSubmit={handleRegisterSubmit}>
                <div className="auth-card__header">
                  <div>
                    <p className="auth-card__tag">Phase 1</p>
                    <h2>Create a new shop admin account</h2>
                  </div>
                </div>

                <div className="form-grid">
                  <label className="field">
                    <span>Shop name</span>
                    <input
                      autoComplete="organization"
                      value={registrationValues.shopName}
                      onChange={(event) => handleRegistrationChange("shopName", event.target.value)}
                      placeholder="CarePoint Diagnostics"
                    />
                    {registrationErrors.shopName ? (
                      <small className="field__error">{registrationErrors.shopName}</small>
                    ) : null}
                  </label>

                  <label className="field">
                    <span>Full name</span>
                    <input
                      autoComplete="name"
                      value={registrationValues.fullName}
                      onChange={(event) => handleRegistrationChange("fullName", event.target.value)}
                      placeholder="Dr. Meera Nair"
                    />
                    {registrationErrors.fullName ? (
                      <small className="field__error">{registrationErrors.fullName}</small>
                    ) : null}
                  </label>

                  <label className="field">
                    <span>Email address</span>
                    <input
                      autoComplete="email"
                      inputMode="email"
                      value={registrationValues.email}
                      onChange={(event) => handleRegistrationChange("email", event.target.value)}
                      placeholder="admin@carepoint.com"
                    />
                    {registrationErrors.email ? (
                      <small className="field__error">{registrationErrors.email}</small>
                    ) : null}
                  </label>

                  <label className="field">
                    <span>Mobile number</span>
                    <input
                      autoComplete="tel"
                      inputMode="tel"
                      value={registrationValues.mobileNumber}
                      onChange={(event) =>
                        handleRegistrationChange("mobileNumber", event.target.value)
                      }
                      placeholder="+91 98765 43210"
                    />
                    {registrationErrors.mobileNumber ? (
                      <small className="field__error">{registrationErrors.mobileNumber}</small>
                    ) : null}
                  </label>

                  <label className="field">
                    <span>Password</span>
                    <input
                      autoComplete="new-password"
                      type="password"
                      value={registrationValues.password}
                      onChange={(event) => handleRegistrationChange("password", event.target.value)}
                      placeholder="Create a strong password"
                    />
                    <small className="field__hint">
                      Minimum 12 characters with uppercase, lowercase, number, and special
                      character.
                    </small>
                    {registrationErrors.password ? (
                      <small className="field__error">{registrationErrors.password}</small>
                    ) : null}
                  </label>

                  <label className="field">
                    <span>Confirm password</span>
                    <input
                      autoComplete="new-password"
                      type="password"
                      value={registrationValues.confirmPassword}
                      onChange={(event) =>
                        handleRegistrationChange("confirmPassword", event.target.value)
                      }
                      placeholder="Repeat your password"
                    />
                    {registrationErrors.confirmPassword ? (
                      <small className="field__error">{registrationErrors.confirmPassword}</small>
                    ) : null}
                  </label>
                </div>

                <label className="checkbox-field">
                  <input
                    checked={registrationValues.termsAccepted}
                    onChange={(event) =>
                      handleRegistrationChange("termsAccepted", event.target.checked)
                    }
                    type="checkbox"
                  />
                  <span>I confirm that I accept the platform terms and responsible use policies.</span>
                </label>
                {registrationErrors.termsAccepted ? (
                  <small className="field__error">{registrationErrors.termsAccepted}</small>
                ) : null}

                {registrationErrors.form ? (
                  <div className="message-banner message-banner--error">{registrationErrors.form}</div>
                ) : null}
                {registrationStatus ? (
                  <div className="message-banner message-banner--success">{registrationStatus}</div>
                ) : null}

                <div className="form-actions">
                  <button className="primary-button" disabled={isRegistering} type="submit">
                    {isRegistering ? "Creating secure registration..." : "Create admin account"}
                  </button>
                  <button
                    className="ghost-button"
                    onClick={() => switchView("login")}
                    type="button"
                  >
                    Already verified? Sign in
                  </button>
                </div>
              </form>
            )}

            {view === "verify" && (
              <form className="form-stack" onSubmit={handleVerifySubmit}>
                <div className="auth-card__header">
                  <div>
                    <p className="auth-card__tag">Phase 2</p>
                    <h2>Verify the shared OTP</h2>
                  </div>
                </div>

                {pendingRegistration ? (
                  <div className="verification-summary">
                    <div>
                      <span>Shop</span>
                      <strong>{pendingRegistration.shopName}</strong>
                    </div>
                    <div>
                      <span>Email</span>
                      <strong>{pendingRegistration.email}</strong>
                    </div>
                    <div>
                      <span>Mobile</span>
                      <strong>{pendingRegistration.mobileNumber}</strong>
                    </div>
                    <div>
                      <span>OTP expiry</span>
                      <strong>{formatExpiry(pendingRegistration.expiresAt)}</strong>
                    </div>
                  </div>
                ) : (
                  <div className="message-banner message-banner--error">
                    No pending registration was found. Start with admin registration first.
                  </div>
                )}

                <div className="message-banner message-banner--neutral">
                  The same 6-digit OTP is sent to your email and mobile number. You only need to
                  enter it once here.
                </div>

                <div className="form-grid form-grid--single">
                  <label className="field">
                    <span>Shared OTP</span>
                    <input
                      inputMode="numeric"
                      maxLength={6}
                      value={otpValues.otp}
                      onChange={(event) => handleOtpChange("otp", event.target.value)}
                      placeholder="6-digit code"
                    />
                    {otpErrors.otp ? <small className="field__error">{otpErrors.otp}</small> : null}
                  </label>
                </div>

                {otpErrors.form ? (
                  <div className="message-banner message-banner--error">{otpErrors.form}</div>
                ) : null}
                {otpStatus ? (
                  <div className="message-banner message-banner--success">{otpStatus}</div>
                ) : null}

                <div className="form-actions">
                  <button
                    className="primary-button"
                    disabled={isVerifying || !pendingRegistration}
                    type="submit"
                  >
                    {isVerifying ? "Verifying codes..." : "Verify account"}
                  </button>
                  <button
                    className="secondary-button"
                    disabled={isResending || !pendingRegistration}
                    onClick={handleResendOtp}
                    type="button"
                  >
                    {isResending ? "Resending..." : "Resend OTP"}
                  </button>
                </div>
              </form>
            )}

            {view === "login" && (
              <form className="form-stack" onSubmit={handleLoginSubmit}>
                <div className="auth-card__header">
                  <div>
                    <p className="auth-card__tag">Phase 3</p>
                    <h2>Sign in to your medical management workspace</h2>
                  </div>
                </div>

                <div className="message-banner message-banner--neutral">
                  One login path serves admin, staff, and accountant accounts. The system detects
                  the role and shop automatically.
                </div>

                <div className="form-grid form-grid--single">
                  <label className="field">
                    <span>Email address</span>
                    <input
                      autoComplete="email"
                      inputMode="email"
                      value={loginValues.email}
                      onChange={(event) => handleLoginChange("email", event.target.value)}
                      placeholder="you@clinic.com"
                    />
                    {loginErrors.email ? (
                      <small className="field__error">{loginErrors.email}</small>
                    ) : null}
                  </label>

                  <label className="field">
                    <span>Password</span>
                    <input
                      autoComplete="current-password"
                      type="password"
                      value={loginValues.password}
                      onChange={(event) => handleLoginChange("password", event.target.value)}
                      placeholder="Enter your password"
                    />
                    {loginErrors.password ? (
                      <small className="field__error">{loginErrors.password}</small>
                    ) : null}
                  </label>
                </div>

                {loginErrors.form ? (
                  <div className="message-banner message-banner--error">{loginErrors.form}</div>
                ) : null}
                {loginStatus ? (
                  <div className="message-banner message-banner--success">{loginStatus}</div>
                ) : null}

                <div className="form-actions">
                  <button className="primary-button" disabled={isLoggingIn} type="submit">
                    {isLoggingIn ? "Signing in..." : "Sign in"}
                  </button>
                  <button
                    className="ghost-button"
                    onClick={() => switchView("register")}
                    type="button"
                  >
                    Need a new shop admin account?
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </section>
    </main>
  );
}

export default App;
*/

import { AppRouter } from "./app/router/AppRouter";

const AppRoot = () => <AppRouter />;

export default AppRoot;
