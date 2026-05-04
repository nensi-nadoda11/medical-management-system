import { useSessionQuery } from "../../auth/hooks/use-session";

const inputClassName =
  "w-full min-w-0 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100";

interface BranchScopeControlProps {
  branchId: string;
  combineBranches: boolean;
  onBranchIdChange: (branchId: string) => void;
  onCombineBranchesChange: (value: boolean) => void;
}

export const BranchScopeControl = ({
  branchId,
  combineBranches,
  onBranchIdChange,
  onCombineBranchesChange,
}: BranchScopeControlProps) => {
  const branches = useSessionQuery().data?.branchContext?.accessibleBranches ?? [];

  if (branches.length <= 1) {
    return null;
  }

  return (
    <>
      <label className="grid min-w-0 gap-2 text-sm font-medium text-slate-700">
        Branch
        <select
          className={inputClassName}
          disabled={combineBranches}
          onChange={(event) => onBranchIdChange(event.target.value)}
          value={branchId}
        >
          <option value="">Current branch</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name} ({branch.code})
            </option>
          ))}
        </select>
      </label>

      <label className="flex min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700">
        <input
          checked={combineBranches}
          onChange={(event) => onCombineBranchesChange(event.target.checked)}
          type="checkbox"
        />
        <span>Combined branches</span>
      </label>
    </>
  );
};
