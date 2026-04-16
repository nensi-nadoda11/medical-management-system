import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Modal } from "../../../components/ui/Modal";
import { useToast } from "../../../hooks/use-toast";
import { staffQueryKeys, inviteUser } from "../api/staff";

const inviteUserSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required.").max(160),
  email: z.string().trim().email("Enter a valid email address.").max(320),
  role: z.enum(["staff", "accountant"], {
    error: "Role is required.",
  }),
});

type InviteUserFormValues = z.infer<typeof inviteUserSchema>;

interface InviteUserDialogProps {
  open: boolean;
  onClose: () => void;
}

export const InviteUserDialog = ({ open, onClose }: InviteUserDialogProps) => {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const form = useForm<InviteUserFormValues>({
    resolver: zodResolver(inviteUserSchema),
    defaultValues: {
      fullName: "",
      email: "",
      role: "staff",
    },
  });

  useEffect(() => {
    if (!open) {
      form.reset();
    }
  }, [form, open]);

  const inviteMutation = useMutation({
    mutationFn: inviteUser,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: staffQueryKeys.invitations });
      pushToast({
        title: "Invitation sent",
        description: "The invite email has been sent successfully.",
        variant: "success",
      });
      onClose();
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = form;

  return (
    <Modal
      description="Invite a staff member or accountant without leaving this screen."
      footer={
        <>
          <button
            className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={inviteMutation.isPending}
            form="invite-user-form"
            type="submit"
          >
            {inviteMutation.isPending ? "Sending..." : "Send invitation"}
          </button>
        </>
      }
      onClose={onClose}
      open={open}
      title="Invite user"
    >
      <form
        className="grid gap-4"
        id="invite-user-form"
        onSubmit={handleSubmit(async (values) => {
          await inviteMutation.mutateAsync(values);
        })}
      >
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Full name
          <input
            className="rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
            placeholder="Riya Sharma"
            {...register("fullName")}
          />
          {errors.fullName ? <span className="text-sm text-rose-600">{errors.fullName.message}</span> : null}
        </label>

        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Email
          <input
            className="rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
            placeholder="riya@clinic.com"
            {...register("email")}
          />
          {errors.email ? <span className="text-sm text-rose-600">{errors.email.message}</span> : null}
        </label>

        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Role
          <select
            className="rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
            {...register("role")}
          >
            <option value="staff">Staff</option>
            <option value="accountant">Accountant</option>
          </select>
          {errors.role ? <span className="text-sm text-rose-600">{errors.role.message}</span> : null}
        </label>

        {inviteMutation.error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {inviteMutation.error.message}
          </div>
        ) : null}
      </form>
    </Modal>
  );
};
