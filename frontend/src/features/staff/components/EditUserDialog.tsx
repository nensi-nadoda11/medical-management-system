import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Modal } from "../../../components/ui/Modal";
import { useToast } from "../../../hooks/use-toast";
import type { StaffUser } from "../../../types/staff";
import { staffQueryKeys, updateUser } from "../api/staff";

const editUserSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required.").max(160),
  role: z.enum(["staff", "accountant"]),
});

type EditUserFormValues = z.infer<typeof editUserSchema>;

interface EditUserDialogProps {
  open: boolean;
  user: StaffUser | null;
  onClose: () => void;
}

export const EditUserDialog = ({ open, user, onClose }: EditUserDialogProps) => {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const form = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      fullName: "",
      role: "staff",
    },
  });

  useEffect(() => {
    if (!user) {
      return;
    }

    if (user.role === "staff" || user.role === "accountant") {
      form.reset({
        fullName: user.fullName,
        role: user.role,
      });
    }
  }, [form, user]);

  const updateMutation = useMutation({
    mutationFn: (values: EditUserFormValues) => updateUser(user!.id, values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: staffQueryKeys.users });
      pushToast({
        title: "User updated",
        description: "Staff member details were saved successfully.",
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
      description="Update the employee name or role. Admin users are protected from edits here."
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
            disabled={updateMutation.isPending}
            form="edit-user-form"
            type="submit"
          >
            {updateMutation.isPending ? "Saving..." : "Save changes"}
          </button>
        </>
      }
      onClose={onClose}
      open={open}
      title="Edit user"
    >
      <form
        className="grid gap-4"
        id="edit-user-form"
        onSubmit={handleSubmit(async (values) => {
          await updateMutation.mutateAsync(values);
        })}
      >
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Full name
          <input
            className="rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
            {...register("fullName")}
          />
          {errors.fullName ? <span className="text-sm text-rose-600">{errors.fullName.message}</span> : null}
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

        {updateMutation.error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {updateMutation.error.message}
          </div>
        ) : null}
      </form>
    </Modal>
  );
};
