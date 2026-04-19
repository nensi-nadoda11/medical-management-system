import { NavLink } from "react-router-dom";

import { cn } from "../../../lib/utils";

const navItems = [
  {
    label: "Customer Accounting",
    to: "/app/accounting/customers",
  },
  {
    label: "Supplier Accounting",
    to: "/app/accounting/suppliers",
  },
];

export const AccountingModuleNav = () => (
  <div className="flex flex-wrap gap-2">
    {navItems.map((item) => (
      <NavLink
        className={({ isActive }) =>
          cn(
            "rounded-2xl border px-3.5 py-2 text-sm font-semibold transition",
            isActive
              ? "border-slate-950 bg-slate-950 text-white"
              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
          )
        }
        key={item.to}
        to={item.to}
      >
        {item.label}
      </NavLink>
    ))}
  </div>
);
