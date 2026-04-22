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
  <div className="flex flex-wrap gap-2">
    {navItems
      .filter((item) => (canCreateBills ? true : item.roles.includes("accountant")))
      .map((item) => (
        <NavLink
          className={({ isActive }) =>
            cn("ui-nav-pill", isActive ? "ui-nav-pill--active" : "ui-nav-pill--idle")
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
