import { useEffect } from "react";

import { cn } from "../../../lib/utils";
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
  const branchContext = useSessionQuery().data?.branchContext;
  const currentBranch = branchContext?.currentBranch;
  const branches = branchContext?.accessibleBranches ?? [];
  const additionalBranches = currentBranch
    ? branches.filter((branch) => branch.id !== currentBranch.id)
    : branches;
  const canCombineBranches = additionalBranches.length > 0;

  useEffect(() => {
    if (!canCombineBranches && combineBranches) {
      onCombineBranchesChange(false);
    }
  }, [canCombineBranches, combineBranches, onCombineBranchesChange]);

  useEffect(() => {
    if (branchId && !additionalBranches.some((branch) => branch.id === branchId)) {
      onBranchIdChange("");
    }
  }, [additionalBranches, branchId, onBranchIdChange]);

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
          <option value="">
            {currentBranch
              ? `${currentBranch.name} (${currentBranch.code})`
              : "Current branch"}
          </option>
          {additionalBranches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name} ({branch.code})
            </option>
          ))}
        </select>
      </label>

      <label className="grid min-w-0 gap-2 text-sm font-medium text-slate-700">
        Scope
        <input
          checked={combineBranches}
          className="sr-only"
          disabled={!canCombineBranches}
          onChange={(event) => onCombineBranchesChange(event.target.checked)}
          type="checkbox"
        />
        <span
          className={cn(
            "flex h-[52px] min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3.5 text-sm font-medium transition",
            canCombineBranches
              ? "cursor-pointer text-slate-700"
              : "cursor-not-allowed bg-slate-50 text-slate-400",
          )}
        >
          <span
            className={cn(
              "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition",
              combineBranches
                ? "border-teal-500 bg-teal-500"
                : "border-slate-300 bg-white",
            )}
          >
            {combineBranches ? (
              <span className="h-2.5 w-2.5 rounded-[3px] bg-white" />
            ) : null}
          </span>
          <span className="truncate">Combined branches</span>
        </span>
      </label>
    </>
  );
};
