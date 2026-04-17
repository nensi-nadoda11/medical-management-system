import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";

import { LoadingState } from "../../../components/ui/LoadingState";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { useToast } from "../../../hooks/use-toast";
import { invitationQueryKeys, getInvitationPreview, acceptInvitation } from "../api/invitations";

const setPasswordSchema = z
  .object({
    password: z
      .string()
      .min(12, "Password must be at least 12 characters.")
      .max(72)
      .regex(/[A-Z]/, "Password must include at least one uppercase letter.")
      .regex(/[a-z]/, "Password must include at least one lowercase letter.")
      .regex(/[0-9]/, "Password must include at least one number.")
      .regex(/[^A-Za-z0-9]/, "Password must include at least one special character."),
    confirmPassword: z.string().min(12).max(72),
  })
  .superRefine((value, context) => {
    if (value.password !== value.confirmPassword) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "Passwords do not match.",
      });
    }
  });

type SetPasswordFormValues = z.infer<typeof setPasswordSchema>;

export const SetPasswordPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { pushToast } = useToast();

  const token = useMemo(() => searchParams.get("token")?.trim() ?? "", [searchParams]);

  const invitationQuery = useQuery({
    queryKey: invitationQueryKeys.preview(token),
    queryFn: () => getInvitationPreview(token),
    enabled: Boolean(token),
  });

  const form = useForm<SetPasswordFormValues>({
    resolver: zodResolver(setPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const acceptMutation = useMutation({
    mutationFn: acceptInvitation,
    onSuccess: () => {
      pushToast({
        title: "Password created",
        description: "You can now sign in using your email and new password.",
        variant: "success",
      });
      navigate("/login", { replace: true });
    },
  });

  useEffect(() => {
    if (acceptMutation.isSuccess) {
      form.reset();
    }
  }, [acceptMutation.isSuccess, form]);

  if (!token) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#f7fbfb_0%,#eef3f5_100%)] px-4 py-8">
        <section className="w-full max-w-lg rounded-[32px] border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/70">
          <h1 className="text-2xl font-semibold text-slate-950">Invitation link missing</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            We could not find an invitation token in the link. Please use the latest invite email
            or contact your administrator.
          </p>
          <Link
            className="mt-6 inline-flex rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            to="/login"
          >
            Back to login
          </Link>
        </section>
      </main>
    );
  }

  if (invitationQuery.isLoading) {
    return <LoadingState description="We are validating your invitation token." title="Checking invitation" />;
  }

  if (!invitationQuery.data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#f7fbfb_0%,#eef3f5_100%)] px-4 py-8">
        <section className="w-full max-w-lg rounded-[32px] border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/70">
          <h1 className="text-2xl font-semibold text-slate-950">Invitation unavailable</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            This invitation may be expired, revoked, invalid, or already used.
          </p>
          <Link
            className="mt-6 inline-flex rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            to="/login"
          >
            Go to login
          </Link>
        </section>
      </main>
    );
  }

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = form;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#f7fbfb_0%,#eef3f5_100%)] px-4 py-8">
      <section className="grid w-full max-w-5xl gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <article className="rounded-[32px] bg-[#102738] p-8 text-white shadow-xl shadow-slate-300/60">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-teal-300">
            Invitation accepted flow
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">
            Set your password and activate your account.
          </h1>
          <p className="mt-4 text-sm leading-7 text-slate-300">
            Your administrator has already created the invitation. You only need to set a secure
            password to complete access.
          </p>

          <div className="mt-8 space-y-4 rounded-[28px] border border-white/10 bg-white/5 p-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Full name
              </p>
              <p className="mt-2 text-base font-semibold">{invitationQuery.data.fullName}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Email
              </p>
              <p className="mt-2 text-base font-semibold">{invitationQuery.data.email}</p>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Role
                </p>
                <div className="mt-2">
                  <StatusBadge label={invitationQuery.data.role} tone={invitationQuery.data.role} />
                </div>
              </div>
            </div>
          </div>
        </article>

        <article className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/70">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-700">
              Final step
            </p>
            <h2 className="text-2xl font-semibold text-slate-950">Create your password</h2>
            <p className="text-sm leading-6 text-slate-600">
              Use a strong password with at least 12 characters, including uppercase, lowercase,
              number, and special characters.
            </p>
          </div>

          <form
            className="mt-8 grid gap-5"
            onSubmit={handleSubmit(async (values) => {
              await acceptMutation.mutateAsync({
                token,
                password: values.password,
                confirmPassword: values.confirmPassword,
              });
            })}
          >
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Password
              <input
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
                placeholder="Create a strong password"
                type="password"
                {...register("password")}
              />
              {errors.password ? (
                <span className="text-sm text-rose-600">{errors.password.message}</span>
              ) : null}
            </label>

            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Confirm password
              <input
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
                placeholder="Repeat your password"
                type="password"
                {...register("confirmPassword")}
              />
              {errors.confirmPassword ? (
                <span className="text-sm text-rose-600">{errors.confirmPassword.message}</span>
              ) : null}
            </label>

            {acceptMutation.error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {acceptMutation.error.message}
              </div>
            ) : null}

            <button
              className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={acceptMutation.isPending || acceptMutation.isSuccess}
              type="submit"
            >
              {acceptMutation.isPending
                ? "Saving password..."
                : acceptMutation.isSuccess
                  ? "Redirecting to login..."
                  : "Set password"}
            </button>
          </form>
        </article>
      </section>
    </main>
  );
};
