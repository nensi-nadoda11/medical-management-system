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
          cn("ui-nav-pill", isActive ? "ui-nav-pill--active" : "ui-nav-pill--idle")
        }
        key={item.to}
        to={item.to}
      >
        {item.label}
      </NavLink>
    ))}
  </div>
);
