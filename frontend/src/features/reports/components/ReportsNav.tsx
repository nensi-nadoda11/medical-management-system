import { NavLink } from "react-router-dom";

import { cn } from "../../../lib/utils";

type UserRole = "admin" | "staff" | "accountant";

const items: Array<{
  label: string;
  to: string;
  roles: UserRole[];
}> = [
  {
    label: "Dashboard",
    to: "/app/reports/dashboard",
    roles: ["admin", "staff", "accountant"],
  },
  {
    label: "Sales",
    to: "/app/reports/sales",
    roles: ["admin", "staff", "accountant"],
  },
  {
    label: "Profit & Loss",
    to: "/app/reports/profit",
    roles: ["admin", "accountant"],
  },
  {
    label: "Stock",
    to: "/app/reports/stock",
    roles: ["admin", "accountant"],
  },
  {
    label: "Low Stock",
    to: "/app/reports/low-stock",
    roles: ["admin", "accountant"],
  },
  {
    label: "Expiry",
    to: "/app/reports/expiry",
    roles: ["admin", "accountant"],
  },
  {
    label: "Suppliers",
    to: "/app/reports/suppliers",
    roles: ["admin", "accountant"],
  },
  {
    label: "Usage",
    to: "/app/reports/usage",
    roles: ["admin", "accountant"],
  },
];

export const ReportsNav = ({ role }: { role: UserRole }) => (
  <div className="flex flex-wrap gap-2">
    {items
      .filter((item) => item.roles.includes(role))
      .map((item) => (
        <NavLink
          className={({ isActive }) =>
            cn("ui-nav-pill", isActive ? "ui-nav-pill--active" : "ui-nav-pill--idle")
          }
          end
          key={item.to}
          to={item.to}
        >
          {item.label}
        </NavLink>
      ))}
  </div>
);
