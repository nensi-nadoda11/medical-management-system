import { NavLink } from "react-router-dom";

import { cn } from "../../../lib/utils";

interface BillingModuleNavProps {
  canCreateBills: boolean;
}

const navItems: Array<{
  label: string;
  to: string;
  roles: Array<"admin" | "staff" | "accountant">;
}> = [
  {
    label: "POS",
    to: "/app/billing",
    roles: ["admin", "staff"],
  },
  {
    label: "Held Bills",
    to: "/app/billing/held",
    roles: ["admin", "staff", "accountant"],
  },
  {
    label: "History",
    to: "/app/billing/history",
    roles: ["admin", "staff", "accountant"],
  },
  {
    label: "Returns",
    to: "/app/billing/returns",
    roles: ["admin", "staff", "accountant"],
  },
];

export const BillingModuleNav = ({ canCreateBills }: BillingModuleNavProps) => (
  <div className="flex flex-wrap gap-2 md:flex-nowrap">
    {navItems
      .filter((item) => (canCreateBills ? true : item.roles.includes("accountant")))
      .map((item) => (
        <NavLink
          className={({ isActive }) =>
            cn(
              "inline-flex min-h-[2.9rem] items-center justify-center rounded-[6px] border-2 px-4 text-sm font-semibold backdrop-blur-xl transition",
              isActive
                ? "border-slate-950/95 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(255,255,255,0.72))] text-slate-950 shadow-[0_18px_34px_-24px_rgba(15,23,42,0.45),0_6px_18px_-14px_rgba(255,255,255,0.95),inset_0_1px_0_rgba(255,255,255,0.98),inset_0_-10px_18px_rgba(148,163,184,0.12)]"
                : "border-slate-950/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(255,255,255,0.66))] text-slate-950 shadow-[0_16px_30px_-24px_rgba(15,23,42,0.35),0_4px_14px_-12px_rgba(255,255,255,0.92),inset_0_1px_0_rgba(255,255,255,0.98),inset_0_-10px_18px_rgba(148,163,184,0.1)] hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(255,255,255,0.74))] hover:shadow-[0_18px_34px_-22px_rgba(15,23,42,0.42),0_6px_18px_-12px_rgba(255,255,255,0.95),inset_0_1px_0_rgba(255,255,255,1),inset_0_-10px_18px_rgba(148,163,184,0.12)]",
            )
          }
          end={item.to === "/app/billing"}
          key={item.to}
          to={item.to}
        >
          {item.label}
        </NavLink>
      ))}
  </div>
);
