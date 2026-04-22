import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { Modal } from "../../../components/ui/Modal";
import { useToast } from "../../../hooks/use-toast";
import type { StaffUser } from "../../../types/staff";
import { branchesQueryKeys, getBranches, getUserBranchAssignments, updateUserBranchAssignments } from "../../branches/api/branches";
import { staffQueryKeys, updateUser } from "../api/staff";

const editUserSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required.").max(160),
  email: z.string().trim().email("Enter a valid email address.").max(320),
  role: z.enum(["staff", "accountant"]),
  branchIds: z.array(z.string()),
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
      email: "",
      role: "staff",
      branchIds: [],
    },
  });

  const branchesQuery = useQuery({
    queryKey: branchesQueryKeys.list,
    queryFn: getBranches,
    enabled: open,
  });

  const assignmentsQuery = useQuery({
    queryKey: branchesQueryKeys.assignments(user?.id ?? ""),
    queryFn: () => getUserBranchAssignments(user!.id),
    enabled: open && Boolean(user?.id),
  });

  useEffect(() => {
    if (!user) {
      return;
    }

    if (user.role === "staff" || user.role === "accountant") {
      form.reset({
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        branchIds: assignmentsQuery.data?.branchIds ?? [],
      });
    }
  }, [assignmentsQuery.data?.branchIds, form, user]);

  const updateMutation = useMutation({
    mutationFn: async (values: EditUserFormValues) => {
      const { branchIds, ...userPayload } = values;
      const nextBranchIds =
        branchIds.length || branchesQuery.data?.defaultBranchId
          ? branchIds.length
            ? branchIds
            : [branchesQuery.data!.defaultBranchId]
          : [];

      await updateUser(user!.id, userPayload);
      await updateUserBranchAssignments(user!.id, nextBranchIds);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: staffQueryKeys.users }),
        queryClient.invalidateQueries({ queryKey: branchesQueryKeys.all }),
      ]);
      pushToast({
        title: "User updated",
        description: "Staff member details and branch access were saved successfully.",
        variant: "success",
      });
      onClose();
    },
  });

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = form;
  const selectedBranchIds = useWatch({ control: form.control, name: "branchIds" }) ?? [];
  const availableBranches = (branchesQuery.data?.items ?? []).filter(
    (branch) => branch.status === "active",
  );

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
          Email
          <input
            className="rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
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

        <div className="grid gap-2 text-sm font-medium text-slate-700">
          <span>Branch access</span>
          <div className="grid gap-2 rounded-[24px] border border-slate-200 bg-slate-50 p-3">
            {availableBranches.map((branch) => {
              const checked = selectedBranchIds.includes(branch.id);

              return (
                <label
                  className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3.5 py-3"
                  key={branch.id}
                >
                  <input
                    checked={checked}
                    onChange={(event) =>
                      setValue(
                        "branchIds",
                        event.target.checked
                          ? [...selectedBranchIds, branch.id]
                          : selectedBranchIds.filter((item) => item !== branch.id),
                        { shouldDirty: true },
                      )
                    }
                    type="checkbox"
                  />
                  <span>
                    {branch.name} ({branch.code}){branch.isDefault ? " - Default" : ""}
                  </span>
                </label>
              );
            })}
            {!availableBranches.length ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
                No active branches available for assignment.
              </div>
            ) : null}
          </div>
          <span className="text-xs text-slate-500">
            If nothing is selected, the default branch will be assigned automatically.
          </span>
        </div>

        {updateMutation.error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {updateMutation.error.message}
          </div>
        ) : null}
      </form>
    </Modal>
  );
};
