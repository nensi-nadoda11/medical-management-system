# Medical Management System

## Customer Software Instruction & Usage Guide

Prepared for customer sharing  
Version date: 2026-05-06

## 1. What This Software Does

This software helps a medical store, pharmacy, or healthcare retail business manage daily operations from one place.

It supports:

- Shop and branch setup
- Medicine master and catalog management
- Supplier and customer management
- Purchase entry and stock receiving
- Billing and held bills
- Sales returns and purchase returns
- Inventory monitoring and stock adjustment
- Customer and supplier accounting
- Reports, exports, and printable documents
- Staff access control and admin settings
- Backup, restore, import, and export tools

## 2. Who Can Use It

The software supports role-based access. The exact menu visible to a user depends on the permissions given by the admin.

- `Admin`: Full control of setup, masters, stock, billing, reports, users, branches, permissions, and data tools
- `Staff`: Usually focused on billing, customers, sales returns, and basic report access
- `Accountant`: Usually focused on billing history, returns, financial reports, dues, ledgers, and payments

Important:

- Not every user will see every screen
- Admin can change role permissions from the Admin Settings module

## 3. First-Time Getting Started

### For the shop owner or first admin

1. Register the admin account
2. Verify the account using OTP
3. Log in
4. Open `Shop Setup`
5. Update shop name, contact details, GST, license, and invoice prefix
6. If the business has multiple branches, open `Branches` and create additional branches
7. Open `Medicine Master` and add medicines, categories, and manufacturers
8. Open `Suppliers` and add supplier records
9. Open `Customers` and add customer records if needed
10. Start entering purchases to build stock
11. Start billing from the POS(point of sale) screen

### For invited users

1. The admin sends an invitation
2. The invited user opens the link
3. The user sets a password
4. The user logs in with assigned access

## 4. Main Business Flow

This is the recommended business flow for normal daily usage:

1. Set up the shop and branch details
2. Create medicine, supplier, and customer masters
3. Enter purchase orders and receive stock
4. Check inventory, low stock, and expiry alerts
5. Create customer bills from the billing screen
6. Put bills on hold if needed and resume them later
7. Complete bills to update sales and reduce stock
8. Handle sales returns when items are returned by customers
9. Handle purchase returns when stock goes back to suppliers
10. Record customer receipts and supplier payments
11. Review dashboard and reports
12. Export reports, print documents, and take backups regularly

## 5. How Key Calculations Work

This section is important because most users want to know when stock and totals actually change.

- A `draft purchase` does not add stock yet
- A `finalized or received purchase` adds stock and updates supplier payable
- A `held bill` does not reduce stock yet
- A `completed bill` reduces stock and updates sales values
- If a bill is unpaid or partially paid, the customer due is updated
- A `sales return` increases stock back and adjusts refund or customer due based on return details
- A `purchase return` reduces stock and adjusts supplier payable
- A `customer payment` reduces outstanding receivable
- A `supplier payment` reduces outstanding payable
- Reports use posted business data, mainly completed bills, finalized purchases, completed returns, and recorded payments

## 6. Dashboard

The Dashboard is the home screen after login.

It shows a quick overview of:

- Today sales
- Monthly sales
- Profit snapshot
- Low stock count
- Expiry count
- Notifications
- Outstanding customer and supplier activity
- Recent transactions and operational alerts

Use the dashboard to quickly understand:

- What sold today
- What may expire soon
- Which dues need follow-up

## 7. Notifications

Open `Notifications` to manage operational alerts.

This screen helps users track:

- Low stock items
- Supplier reorder alerts
- Near-expiry and expired stock
- Customer due reminders
- Supplier payable reminders

Users can:

- Filter alerts by type and severity
- Mark alerts as read
- Acknowledge alerts
- Review pending operational issues in one place

## 8. Shop Setup

Open `Shop Setup` to manage core business information.

Use it to update:

- Shop name
- Phone and email
- Address
- City, state, and pincode
- GST number
- License number
- Invoice prefix

This information is used across:

- Invoices
- Documents
- Communication templates
- General business identity

## 9. Branches

If the business has more than one branch, use the `Branches` module.

It allows the admin to:

- Create branch records
- Activate or deactivate branches
- Set branch-level invoice prefix
- Configure low stock thresholds
- Enable or disable branch alert behavior
- View how many users are assigned to each branch

Branch behavior:

- One default branch always exists
- If a user can access multiple branches, an `Active Branch` selector appears in the workspace
- Changing the active branch refreshes data for that branch
- Reports can also be viewed branch-wise or in combined mode

## 10. Medicine Master

Open `Medicines` to maintain the medicine catalog.

This is where you manage:

- Medicine name
- Generic name
- Brand name
- Category
- Manufacturer
- Strength, form, and unit
- GST percentage
- Reorder level
- Barcode
- Prescription-required flag
- Active or inactive status

Extra tools:

- `Manage categories`
- `Manage manufacturers`

Best use:

- Complete this master carefully before heavy purchase or billing activity

## 11. Suppliers

Open `Suppliers` to manage supplier records.

You can store:

- Supplier name
- Mobile and contact information
- GST and compliance details
- Address
- Opening balance
- Active or inactive status

This module supports purchasing and supplier accounting workflows.

## 12. Customers

Open `Customers` to manage customer records.

You can:

- Add and edit customer details
- Store mobile, alternate mobile, email, city, and other details
- Track customer purchase totals
- Track customer due amounts
- Open the customer detail page for history and payments

From the customer detail page, users can:

- Review purchase history
- Review payment history
- Record customer payments if allowed

## 13. Purchases

Open `Purchases` to manage purchase orders and stock receiving.

This module supports:

- Draft purchase orders
- Approved purchase orders
- Received or finalized purchases
- Cancelled purchase documents

Typical purchase workflow:

1. Click `Create purchase order`
2. Select supplier
3. Enter purchase date and supplier invoice details
4. Add item rows with batch number, expiry, quantity, free quantity, rates, GST, and discount
5. Save as draft if the order is not yet received
6. Finalize when stock has actually arrived

What happens on finalization:

- Stock is added to inventory
- Purchase values are posted
- Supplier payable is updated

The purchases module also helps users view:

- Payment status
- Invoice references
- Totals
- Purchase workflow stage

## 14. Purchase Returns

Open `Purchase Returns` when stock must be returned to a supplier.

Typical workflow:

1. Start a new purchase return
2. Search and select a finalized purchase
3. Choose the item quantities to return
4. Add return reason and notes
5. Save draft if the return is still being prepared
6. Complete the return when it is confirmed

What happens on completion:

- Stock is reduced from inventory
- Supplier payable is adjusted
- Return documents become available

## 15. Inventory

Open `Inventory Summary` to monitor stock position.

Users can:

- Search medicines
- Filter by category and manufacturer
- View low stock items
- View active batch count
- Open a medicine-level stock detail screen
- Use stock adjustment if permitted

Related inventory tools:

- `Low Stock`
- `Expiry Report`
- `Stock Adjustment`

## 16. Low Stock

Use `Low Stock` for replenishment planning.

It shows:

- Medicines below reorder level
- Current stock
- Shortage quantity

This screen is best for:

- Purchase planning
- Supplier reorder follow-up
- Daily stock risk review

## 17. Expiry Report

Use `Expiry Report` to review expiring and expired batches.

It supports:

- Expired-only view
- Next 30 days
- Next 60 days
- Next 90 days

This helps the business:

- Prevent expiry losses
- Push near-expiry stock faster
- Review write-off risk early

## 18. Billing / Point of Sale

Open `Billing` to create new bills.

The billing screen includes:

- Medicine search
- Cart panel
- Customer selection
- Quick customer add
- Bill summary
- Hold bill option
- Complete bill option

Typical billing workflow:

1. Search medicines
2. Add items to the bill
3. Select the correct batch if needed
4. Enter quantity and discount
5. Select customer or use walk-in details
6. Enter payment details
7. Save as `Hold bill` if the sale is not finished
8. Click `Complete bill` to finish the sale

Important billing behavior:

- Held bill can be reopened later
- Stock reduces only when the bill is completed
- Customer due is created if payment is partial or pending
- The system supports FEFO(first expire first open)-style stock selection behavior where configured

## 19. Billing History

Open `Billing History` to review:

- Completed bills
- Held bills
- Cancelled bills
- Payment status
- Customer linkage
- Operator visibility

Users can also open bill details and related documents from here.

## 20. Sales Returns

Open `Sales Returns` to manage customer item returns.

Typical workflow:

1. Start a new return
2. Search a completed bill
3. Select items and quantities that are returnable
4. Enter reason and notes
5. Set refund details where applicable
6. Save draft or complete the return

What happens on completion:

- Returned stock is added back where applicable
- Refund tracking is updated
- Customer due or refund position is corrected

## 21. Accounting

The accounting area has two parts:

- `Customer payments`
- `Supplier payments`

### Customer accounting

Use this section to:

- View outstanding customers
- Record customer receipts
- View customer payment register
- Open customer ledgers

### Supplier accounting

Use this section to:

- View outstanding suppliers
- Record supplier payments
- View supplier payment register
- Open supplier ledgers

Ledgers help track:

- Debit and credit movement
- Running balance
- Bill or purchase references
- Payment history

## 22. Reports & Analytics

Open `Reports` for analysis and exports.

Available report areas include:

- Reports Dashboard
- Sales Report
- Profit & Loss
- Stock Report
- Low Stock Report
- Expiry Report
- Supplier Report
- Usage Report

What reports are useful for:

- `Sales Report`: Sales value, bill count, payment mix, and trend
- `Profit & Loss`: Revenue, cost, and profit trend
- `Stock Report`: Batch-wise stock and stock valuation
- `Low Stock Report`: Shortage-focused inventory review
- `Expiry Report`: Expiry risk and batch action planning
- `Supplier Report`: Purchase totals and outstanding supplier dues
- `Usage Report`: Medicine consumption trend

Export options:

- `Export Excel`
- `Export PDF`
- Some report screens also support print-ready flows

## 23. Documents

The system supports business document preview, print, and PDF download.

Available document types include:

- Sale invoice
- Purchase document
- Sales return note
- Purchase return note
- Customer payment receipt
- Supplier payment receipt

Users can typically:

- Preview documents
- Print documents
- Download PDF copies

## 24. Staff Management

Open `Staff Management` to manage team access.

Admins can:

- Invite new users
- View active and inactive users
- View invitation status
- Resend invitations
- Revoke invitations
- Activate or deactivate users
- Edit user details

This helps the business safely control who can access which part of the software.

## 25. Admin Settings

Open `Admin Settings` for advanced control.

This module supports:

- Role permission matrix
- User-specific permission overrides
- Shop operational settings
- Audit history of changes

Operational settings include controls such as:

- Default low stock threshold
- Low stock alerts
- Expiry alerts
- Invoice prefix
- Allow partial payments
- Allow held bills
- Allow staff sales return
- Allow inventory adjustment
- Allow draft purchases
- Prefer FEFO behavior

This section should usually be managed only by the admin.

## 26. Stock Transfers

If multi-branch mode is active, admin users can use `Stock Transfers`.

Typical workflow:

1. Select source branch
2. Select destination branch
3. Search source batches
4. Add transfer items and quantities
5. Create draft transfer
6. Complete transfer when movement is confirmed

What happens on completion:

- Source branch stock decreases
- Destination branch stock increases

## 27. Data Management

Open `Data Management` for controlled admin-only utilities.

It has three main sections:

- Import
- Export
- Backup & Restore

### Import

Supported imports:

- Medicines
- Suppliers
- Customers

Workflow:

1. Download the template in CSV or XLSX
2. Fill the template
3. Upload the file
4. Validate preview
5. Review errors, warnings, and duplicates
6. Confirm import only after preview looks safe

Duplicate handling modes include:

- Skip duplicates
- Update existing
- Fail on duplicates
- Upsert

### Export

Supported dataset exports:

- Medicines
- Suppliers
- Customers
- Stock summary

Formats:

- CSV
- XLSX

### Backup & Restore

Admins can create manual backups that may include:

- Shop profile
- Settings
- Master records
- Supplier and customer contacts

Restore should be used carefully because it changes live business data.

Best practice:

- Always create a backup before major data cleanup or import work

## 28. Best Practices for Daily Use

- Complete shop setup before starting live billing
- Keep medicine master clean and consistent
- Finalize purchases only when stock is physically received
- Use held bills only for temporary counter flow
- Complete bills only after checking quantity and payment
- Review low stock and expiry screens dailyw
- Record payments on time to keep dues correct
- Use reports at day end or week end for review
- Take regular backups
- Restrict admin settings and restore access to trusted users only

## 29. Quick Summary of What Updates Automatically

- Completing a purchase updates stock and supplier liability
- Completing a bill updates stock and sales
- Completing a sales return updates stock and refund or due position
- Completing a purchase return updates stock and supplier payable
- Recording a customer payment updates receivable balances
- Recording a supplier payment updates payable balances
- Notifications refresh operational follow-up areas
- Reports reflect posted business activity

