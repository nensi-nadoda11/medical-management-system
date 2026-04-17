import { startTransition, useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import "../../../App.css";

import { ApiError } from "../../../lib/api";
import { authService } from "../../../services/auth";
import type { AuthSession, PendingRegistration } from "../../../types/auth";
import {
  type FieldErrors,
  type LoginValues,
  type OtpValues,
  type RegistrationValues,
  validateLogin,
  validateOtp,
  validateRegistration,
} from "../../../utils/validation";
import { authQueryKeys } from "../hooks/use-session";

type AppView = "register" | "verify" | "login";

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

const routeByView: Record<AppView, string> = {
  register: "/register",
  verify: "/verify",
  login: "/login",
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

interface AuthPageProps {
  initialView: AppView;
}

export const AuthPage = ({ initialView }: AuthPageProps) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [view, setView] = useState<AppView>(initialView);
  const [pendingRegistration, setPendingRegistration] =
    useState<PendingRegistration | null>(null);

  const [registrationValues, setRegistrationValues] =
    useState<RegistrationValues>(defaultRegistrationValues);
  const [registrationErrors, setRegistrationErrors] = useState<
    FieldErrors<RegistrationValues>
  >({});
  const [registrationStatus, setRegistrationStatus] = useState("");

  const [otpValues, setOtpValues] = useState<OtpValues>(defaultOtpValues);
  const [otpErrors, setOtpErrors] = useState<FieldErrors<OtpValues>>({});
  const [otpStatus, setOtpStatus] = useState("");

  const [loginValues, setLoginValues] =
    useState<LoginValues>(defaultLoginValues);
  const [loginErrors, setLoginErrors] = useState<FieldErrors<LoginValues>>({});
  const [loginStatus, setLoginStatus] = useState("");

  const registerMutation = useMutation({
    mutationFn: authService.registerAdmin,
  });
  const verifyMutation = useMutation({
    mutationFn: authService.verifyRegistration,
  });
  const resendMutation = useMutation({
    mutationFn: authService.resendRegistrationOtp,
  });
  const loginMutation = useMutation({
    mutationFn: authService.login,
  });

  useEffect(() => {
    setView(initialView);
  }, [initialView]);

  useEffect(() => {
    const cachedPending = window.sessionStorage.getItem(
      pendingRegistrationStorageKey,
    );

    if (cachedPending) {
      try {
        const parsedPending = JSON.parse(cachedPending) as PendingRegistration;
        setPendingRegistration(parsedPending);
      } catch {
        window.sessionStorage.removeItem(pendingRegistrationStorageKey);
      }
    }
  }, []);

  const switchView = (nextView: AppView) => {
    setRegistrationStatus("");
    setOtpStatus("");
    setLoginStatus("");
    startTransition(() => {
      setView(nextView);
      navigate(routeByView[nextView]);
    });
  };

  const handleRegistrationChange = <K extends keyof RegistrationValues>(
    field: K,
    value: RegistrationValues[K],
  ) => {
    setRegistrationValues((current) => ({ ...current, [field]: value }));
    setRegistrationErrors((current) => ({ ...current, [field]: undefined }));
  };

  const handleOtpChange = <K extends keyof OtpValues>(
    field: K,
    value: OtpValues[K],
  ) => {
    const sanitizedValue = value.replace(/\D/g, "").slice(0, 6) as OtpValues[K];
    setOtpValues((current) => ({ ...current, [field]: sanitizedValue }));
    setOtpErrors((current) => ({ ...current, [field]: undefined }));
  };

  const handleLoginChange = <K extends keyof LoginValues>(
    field: K,
    value: LoginValues[K],
  ) => {
    setLoginValues((current) => ({ ...current, [field]: value }));
    setLoginErrors((current) => ({ ...current, [field]: undefined }));
  };

  const handleRegisterSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    const nextErrors = validateRegistration(registrationValues);
    setRegistrationErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setRegistrationStatus("");

    try {
      const response = await registerMutation.mutateAsync(registrationValues);
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
      setOtpStatus(
        `${response.message} We sent verification codes to your email and mobile.`,
      );
    } catch (error) {
      setRegistrationErrors((current) => ({
        ...current,
        form: formatApiError(error),
      }));
    }
  };

  const handleVerifySubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (!pendingRegistration) {
      setOtpErrors({
        form: "Start registration first so we know where to verify the account.",
      });
      switchView("register");
      return;
    }

    const nextErrors = validateOtp(otpValues);
    setOtpErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setOtpStatus("");

    try {
      const response = await verifyMutation.mutateAsync({
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
        setLoginStatus(
          "Verification completed. Sign in with your email address and password.",
        );
      }
    } catch (error) {
      setOtpErrors((current) => ({
        ...current,
        form: formatApiError(error),
      }));
    }
  };

  const handleResendOtp = async () => {
    if (!pendingRegistration) {
      return;
    }

    setOtpErrors({});

    try {
      const response = await resendMutation.mutateAsync({
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
    }
  };

  const handleLoginSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validateLogin(loginValues);
    setLoginErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setLoginStatus("");

    try {
      await loginMutation.mutateAsync(loginValues);
      const nextSession = await authService
        .getSession()
        .catch<AuthSession | null>(() => null);

      if (!nextSession) {
        throw new ApiError(
          "We could not establish your authenticated session. Please sign in again.",
          401,
          "SESSION_NOT_ESTABLISHED",
        );
      }

      queryClient.setQueryData(authQueryKeys.session, nextSession);
      navigate("/app");
    } catch (error) {
      setLoginErrors((current) => ({
        ...current,
        form: formatApiError(error),
      }));
    }
  };

  return (
    <main className="auth-shell">
      <section className="auth-hero">
        <div className="auth-hero__eyebrow">Medical Management System</div>
        <h1>
          Secure access for clinics, staff operations, and financial workflows.
        </h1>
        <p className="auth-hero__lead">
          Register the first shop administrator, verify both communication
          channels, and use the same login architecture that is already ready
          for admin, staff, and accountant roles.
        </p>

        <div className="hero-grid">
          <article className="hero-metric">
            <strong>Shared OTP delivery</strong>
            <span>
              The same 6-digit OTP is sent to both email and SMS for backup
              delivery.
            </span>
          </article>
          <article className="hero-metric">
            <strong>Role-ready login</strong>
            <span>
              Single secure sign-in path for all current and future users.
            </span>
          </article>
          <article className="hero-metric">
            <strong>Protected sessions</strong>
            <span>
              Cookie-based auth with backend-managed session validation.
            </span>
          </article>
        </div>

        <div className="hero-note">
          <span className="hero-note__label">Flow</span>
          <p>
            Register shop admin -&gt; receive one OTP on email and SMS -&gt;
            sign in with email + password.
          </p>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <div
            className="view-switcher"
            role="tablist"
            aria-label="Authentication views"
          >
            <button
              className={
                view === "register"
                  ? "view-switcher__tab is-active"
                  : "view-switcher__tab"
              }
              onClick={() => switchView("register")}
              role="tab"
              type="button"
            >
              Admin registration
            </button>
            <button
              className={
                view === "verify"
                  ? "view-switcher__tab is-active"
                  : "view-switcher__tab"
              }
              onClick={() => switchView("verify")}
              role="tab"
              type="button"
            >
              OTP verification
            </button>
            <button
              className={
                view === "login"
                  ? "view-switcher__tab is-active"
                  : "view-switcher__tab"
              }
              onClick={() => switchView("login")}
              role="tab"
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
                    onChange={(event) =>
                      handleRegistrationChange("shopName", event.target.value)
                    }
                    placeholder="CarePoint Diagnostics"
                    value={registrationValues.shopName}
                  />
                  {registrationErrors.shopName ? (
                    <small className="field__error">
                      {registrationErrors.shopName}
                    </small>
                  ) : null}
                </label>

                <label className="field">
                  <span>Full name</span>
                  <input
                    autoComplete="name"
                    onChange={(event) =>
                      handleRegistrationChange("fullName", event.target.value)
                    }
                    placeholder="Dr. Meera Nair"
                    value={registrationValues.fullName}
                  />
                  {registrationErrors.fullName ? (
                    <small className="field__error">
                      {registrationErrors.fullName}
                    </small>
                  ) : null}
                </label>

                <label className="field">
                  <span>Email address</span>
                  <input
                    autoComplete="email"
                    inputMode="email"
                    onChange={(event) =>
                      handleRegistrationChange("email", event.target.value)
                    }
                    placeholder="admin@carepoint.com"
                    value={registrationValues.email}
                  />
                  {registrationErrors.email ? (
                    <small className="field__error">
                      {registrationErrors.email}
                    </small>
                  ) : null}
                </label>

                <label className="field">
                  <span>Mobile number</span>
                  <input
                    autoComplete="tel"
                    inputMode="tel"
                    onChange={(event) =>
                      handleRegistrationChange(
                        "mobileNumber",
                        event.target.value,
                      )
                    }
                    placeholder="+91 98765 43210"
                    value={registrationValues.mobileNumber}
                  />
                  {registrationErrors.mobileNumber ? (
                    <small className="field__error">
                      {registrationErrors.mobileNumber}
                    </small>
                  ) : null}
                </label>

                <label className="field">
                  <span>Password</span>
                  <input
                    autoComplete="new-password"
                    onChange={(event) =>
                      handleRegistrationChange("password", event.target.value)
                    }
                    placeholder="Create a strong password"
                    type="password"
                    value={registrationValues.password}
                  />
                  <small className="field__hint">
                    Minimum 12 characters with uppercase, lowercase, number, and
                    special character.
                  </small>
                  {registrationErrors.password ? (
                    <small className="field__error">
                      {registrationErrors.password}
                    </small>
                  ) : null}
                </label>

                <label className="field">
                  <span>Confirm password</span>
                  <input
                    autoComplete="new-password"
                    onChange={(event) =>
                      handleRegistrationChange(
                        "confirmPassword",
                        event.target.value,
                      )
                    }
                    placeholder="Repeat your password"
                    type="password"
                    value={registrationValues.confirmPassword}
                  />
                  {registrationErrors.confirmPassword ? (
                    <small className="field__error">
                      {registrationErrors.confirmPassword}
                    </small>
                  ) : null}
                </label>
              </div>

              <label className="checkbox-field">
                <input
                  checked={registrationValues.termsAccepted}
                  onChange={(event) =>
                    handleRegistrationChange(
                      "termsAccepted",
                      event.target.checked,
                    )
                  }
                  type="checkbox"
                />
                <span>
                  I confirm that I accept the platform terms and responsible use
                  policies.
                </span>
              </label>
              {registrationErrors.termsAccepted ? (
                <small className="field__error">
                  {registrationErrors.termsAccepted}
                </small>
              ) : null}

              {registrationErrors.form ? (
                <div className="message-banner message-banner--error">
                  {registrationErrors.form}
                </div>
              ) : null}
              {registrationStatus ? (
                <div className="message-banner message-banner--success">
                  {registrationStatus}
                </div>
              ) : null}

              <div className="form-actions">
                <button
                  className="primary-button"
                  disabled={registerMutation.isPending}
                  type="submit"
                >
                  {registerMutation.isPending
                    ? "Creating secure registration..."
                    : "Create admin account"}
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
                    <strong>
                      {formatExpiry(pendingRegistration.expiresAt)}
                    </strong>
                  </div>
                </div>
              ) : (
                <div className="message-banner message-banner--error">
                  No pending registration was found. Start with admin
                  registration first.
                </div>
              )}

              <div className="message-banner message-banner--neutral">
                The same 6-digit OTP is sent to your email and mobile number.
                You only need to enter it once here.
              </div>

              <div className="form-grid form-grid--single">
                <label className="field">
                  <span>Shared OTP</span>
                  <input
                    inputMode="numeric"
                    maxLength={6}
                    onChange={(event) =>
                      handleOtpChange("otp", event.target.value)
                    }
                    placeholder="6-digit code"
                    value={otpValues.otp}
                  />
                  {otpErrors.otp ? (
                    <small className="field__error">{otpErrors.otp}</small>
                  ) : null}
                </label>
              </div>

              {otpErrors.form ? (
                <div className="message-banner message-banner--error">
                  {otpErrors.form}
                </div>
              ) : null}
              {otpStatus ? (
                <div className="message-banner message-banner--success">
                  {otpStatus}
                </div>
              ) : null}

              <div className="form-actions">
                <button
                  className="primary-button"
                  disabled={verifyMutation.isPending || !pendingRegistration}
                  type="submit"
                >
                  {verifyMutation.isPending
                    ? "Verifying codes..."
                    : "Verify account"}
                </button>
                <button
                  className="secondary-button"
                  disabled={resendMutation.isPending || !pendingRegistration}
                  onClick={handleResendOtp}
                  type="button"
                >
                  {resendMutation.isPending ? "Resending..." : "Resend OTP"}
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
                One login path serves admin, staff, and accountant accounts. The
                system detects the role and shop automatically.
              </div>

              <div className="form-grid form-grid--single">
                <label className="field">
                  <span>Email address</span>
                  <input
                    autoComplete="email"
                    inputMode="email"
                    onChange={(event) =>
                      handleLoginChange("email", event.target.value)
                    }
                    placeholder="you@clinic.com"
                    value={loginValues.email}
                  />
                  {loginErrors.email ? (
                    <small className="field__error">{loginErrors.email}</small>
                  ) : null}
                </label>

                <label className="field">
                  <span>Password</span>
                  <input
                    autoComplete="current-password"
                    onChange={(event) =>
                      handleLoginChange("password", event.target.value)
                    }
                    placeholder="Enter your password"
                    type="password"
                    value={loginValues.password}
                  />
                  {loginErrors.password ? (
                    <small className="field__error">
                      {loginErrors.password}
                    </small>
                  ) : null}
                </label>
              </div>

              {loginErrors.form ? (
                <div className="message-banner message-banner--error">
                  {loginErrors.form}
                </div>
              ) : null}
              {loginStatus ? (
                <div className="message-banner message-banner--success">
                  {loginStatus}
                </div>
              ) : null}

              <div className="form-actions">
                <button
                  className="primary-button"
                  disabled={loginMutation.isPending}
                  type="submit"
                >
                  {loginMutation.isPending ? "Signing in..." : "Sign in"}
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
      </section>
    </main>
  );
};
