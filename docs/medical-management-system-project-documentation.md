# Medical Management System

## Project Documentation

Prepared for customer review
Document date: May 6, 2026
Document type: Business and user-facing project documentation

## 1. Executive Summary

The Medical Management System is a complete business application for running day-to-day operations of a medical store or pharmacy from one connected workspace.

It brings billing, inventory, purchases, supplier follow-up, customer dues, returns, reports, staff control, branch management, and admin setup into one system so that the business can work faster, reduce manual errors, and keep stock and accounts aligned.

This document is written for business owners, managers, supervisors, accountants, and customer representatives. It is intentionally non-technical and focuses on what the system does, how it supports operations, and how the main business flows work in practice.

## 2. Business Purpose

This project is designed to help a pharmacy or medical retail business manage:

- daily counter billing
- stock received from suppliers
- medicine stock movement and availability
- purchase and sales returns
- customer dues and supplier payables
- reports for sales, profit, stock, expiry, and usage
- user access and business setup
- branch-wise operations where multiple branches are used

In simple terms, the software helps the business answer these questions quickly:

- What stock is available right now?
- Which medicines are low in quantity or nearing expiry?
- How much money is receivable from customers?
- How much money is payable to suppliers?
- Which purchases, bills, and returns were completed today?
- How is the business performing day-wise, month-wise, shop-wise, and branch-wise?

## 3. Who This System Is For

The project is suitable for:

- single-shop medical stores
- multi-branch pharmacy operations
- pharmacy owners and managers
- billing counter staff
- accountants and back-office users
- operational supervisors who need stock and payment visibility

## 4. Main User Roles

The exact screens visible in the application depend on the access given by the admin.

- Admin: Full control over setup, users, permissions, medicines, billing, purchases, reports, branches, and data utilities.
- Staff: Mainly focused on billing, customers, stock lookup, and allowed daily operational tasks.
- Accountant: Mainly focused on billing history, payment tracking, dues, ledgers, returns, and reports.

## 5. High-Level Project Scope

The system covers the complete operational cycle of a pharmacy business:

- business registration and first-time setup
- shop profile and branch setup
- medicine master management
- supplier and customer master management
- purchase entry and stock receiving
- inventory monitoring and batch-level stock tracking
- sales billing and held bill handling
- customer and supplier payment tracking
- sales return and purchase return processing
- reporting and dashboard analytics
- role-based access and administrative controls
- data import, export, backup, and restore

## 6. Core Modules Included In The Project

### 6.1 Dashboard

The dashboard gives a quick operational view of the business. It is designed to help the owner or manager understand what is happening without opening multiple screens.

The dashboard can highlight:

- current sales performance
- purchase and stock activity
- low stock pressure
- expiry risk
- due collections and payable follow-up
- recent operational events and notifications

### 6.2 Notifications

The notification area helps users review important follow-up items in one place.

Typical alerts include:

- low stock items
- expiry and near-expiry stock
- customer due reminders
- supplier payable reminders
- system-level operational follow-ups

### 6.3 Billing

The billing module is the day-to-day sales counter screen.

It supports:

- medicine search and selection
- customer selection
- quick bill creation
- discount, GST, and round-off handling
- hold bill and reopen bill flow
- cash and due billing scenarios
- final sale posting with stock deduction

### 6.4 Billing History

This area allows users to review completed and held bills, check bill details, and access related records for follow-up, audit, or customer service.

### 6.5 Sales Returns

This module handles product returns from customers. It helps the shop reverse the sold quantity correctly, update stock, and adjust customer financials based on the return amount.

### 6.6 Customers

The customer module stores customer details and helps the business track:

- purchase history
- outstanding dues
- payment receipts
- return activity
- follow-up information

### 6.7 Accounting

The accounting area is split into customer and supplier accounting.

It is used to track:

- customer receivables
- supplier payables
- payment entries
- advance balances
- ledger activity
- running balances and references

### 6.8 Reports

The reports area gives management visibility into business performance and stock conditions.

Reports available in the project include:

- reports dashboard
- sales report
- profit report
- stock report
- low stock report
- expiry report
- supplier report
- usage report

### 6.9 Medicines

This module stores the medicine catalog used across billing, purchasing, and inventory.

It can manage:

- medicine names and product identity
- category and manufacturer details
- GST settings
- reorder levels
- unit and pack details
- active and inactive status

### 6.10 Suppliers

The supplier module maintains supplier master data and supports purchase and payable workflows.

### 6.11 Purchases

The purchase module is used when stock is bought from suppliers.

It supports:

- draft purchase entry
- purchase approval and review steps
- final stock receiving
- supplier invoice tracking
- payment and due capture
- supplier advance adjustment

### 6.12 Purchase Returns

This module is used when items need to be returned to the supplier due to damage, mismatch, expiry, or other business reasons.

### 6.13 Inventory

Inventory provides a stock-focused view of medicines and batches.

It helps users monitor:

- available stock
- batch-wise quantities
- low stock conditions
- expiry pressure
- stock movement health

### 6.14 Stock Transfers

For multi-branch operations, stock can be moved from one branch to another through the stock transfer flow.

### 6.15 Shop Setup

The shop setup page manages the basic business identity used across documents and operations.

Typical fields include:

- shop name
- phone number
- email
- address
- GST number
- license number
- invoice prefix

### 6.16 Staff Management

This module helps admins manage users, invitations, account status, and branch assignment.

### 6.17 Branch Management

This area is used when the business operates more than one branch.

It helps manage:

- branch creation
- branch status
- branch-specific settings
- branch visibility
- branch-level stock and operational separation

### 6.18 Data Management

This module provides controlled business utilities such as:

- imports
- exports
- backup creation
- restore actions

### 6.19 Admin Settings

The admin settings area manages the business rules and permission rules that control how the system behaves for different users and operations.

## 7. End-To-End Business Flow

The project is built to support a realistic business sequence from setup to reporting.

Recommended flow:

1. Register the first admin account.
2. Complete shop setup and branch setup.
3. Add medicines, suppliers, and customers.
4. Enter purchases and finalize them only when stock physically arrives.
5. Start billing customers from the billing screen.
6. Use held bills only when the sale is not yet finished.
7. Record customer receipts and supplier payments when money is collected or paid.
8. Process returns whenever stock comes back from customers or goes back to suppliers.
9. Review dashboard and reports daily.
10. Export reports and create backups regularly.

## 8. Important Calculation Logic

This section is important because the value of the project depends heavily on correct stock and amount calculations.

### 8.1 Purchase Calculation Logic

The project supports real-world supplier settlement behavior.

- A draft purchase does not add stock.
- A finalized or received purchase adds stock to inventory.
- Supplier GST, discount, line totals, and round-off are included in the purchase calculation.
- If the paid amount on a purchase is greater than the final payable amount, the extra money is treated as supplier advance.
- If the supplier already has an advance balance, that advance is automatically adjusted against the next purchase.
- After advance adjustment, only the remaining amount stays as current paid amount or due amount.
- If a purchase still has due amount and a purchase return is created later, the due amount is adjusted first from the return value.
- If the purchase return value is higher than the remaining due, the extra amount is treated as supplier balance or advance according to the business position.
- Stock is reduced only when a purchase return is completed, not while it is still in draft.

### 8.2 Billing Calculation Logic

The system also supports practical customer billing and advance adjustment behavior.

- A held bill does not reduce stock.
- A completed bill reduces stock and posts the sale.
- Bill discount, GST, and round-off are included in the final customer total.
- If the customer already has advance balance, that advance is adjusted against the next bill automatically.
- If the customer pays more than the bill amount, the extra money is stored as customer advance.
- If a bill has due amount and the customer later creates a sales return, the due amount is adjusted first from the return value.
- Only the net balance after due adjustment becomes refundable or available as customer credit.
- Stock comes back only when the sales return is completed, not when it is still saved as draft.

### 8.3 Stock Integrity Logic

The project follows posted-transaction logic for stock safety.

- purchases increase stock only when finalized
- bills decrease stock only when completed
- sales returns increase stock only when completed
- purchase returns decrease stock only when completed
- stock transfers reduce stock from source and increase stock in destination only when completed

This approach helps avoid accidental stock mismatches from incomplete or draft documents.

## 9. How Returns Are Managed

Returns are handled carefully so that both stock and money stay aligned.

### Sales Return

- linked to an original completed bill
- selected items and quantities are checked
- stock is added back on completion
- due adjustment and refund logic are applied

### Purchase Return

- linked to an original finalized purchase
- selected supplier-return quantities are checked
- stock is reduced on completion
- supplier payable or advance position is adjusted

## 10. Reporting And Decision Support

The reporting side of the project helps business owners make practical daily and monthly decisions.

Examples of business questions the reports can answer:

- How much was sold today?
- Which products are moving fastest?
- What is the current stock value?
- Which items are low in stock?
- Which batches may expire soon?
- Which suppliers have the highest purchase exposure?
- What is the expected gross performance over a chosen period?

The project supports reporting review by:

- day-wise range
- month-wise range
- shop-wide visibility
- branch-wise visibility where branch operations are enabled

## 11. Multi-Branch Capability

The project supports both simple and advanced business structures.

- A single shop can operate without additional branch complexity.
- A multi-branch business can separate operational visibility by branch.
- Users can be assigned to branch access as allowed by admin.
- Stock, billing, and operational screens can follow the active branch context.
- Reporting can be reviewed at branch level as well as broader business level where allowed.

## 12. User Access And Control

The project includes permission-based access control so that users only see the areas relevant to their job.

This helps the business:

- reduce accidental misuse
- protect sensitive financial settings
- separate admin and daily counter work
- give controlled access to reports and accounting

Admin settings also allow the business to control selected operational rules, such as payment behavior, stock adjustments, and other guided workflow settings.

## 13. Data Handling Features

The project includes practical data tools needed for real operations.

### Imports

Users can upload prepared files for controlled bulk entry of business records such as medicines, suppliers, and customers.

### Exports

Users can export business data and reports for sharing, backup review, or offline analysis.

### Backup And Restore

Admins can create system backups and use restore workflows carefully when needed for controlled business recovery.

## 14. Documents And Print Support

The system supports business documents that can usually be previewed, printed, or downloaded in PDF form.

Examples include:

- customer invoices
- purchase documents
- sales return notes
- purchase return notes
- payment receipts

## 15. Business Benefits

From a customer point of view, the key value of this project is operational control.

Main benefits:

- one connected system instead of scattered manual registers
- faster billing and easier daily operations
- better stock visibility
- better due and payment tracking
- cleaner supplier and customer follow-up
- fewer mistakes in returns and stock adjustments
- improved management reporting
- role-wise access control for safer operations
- branch support for growing businesses

## 16. Recommended Daily Usage Practice

To get the best results from the system, the business should follow these practices:

- keep medicine master data clean
- finalize purchases only after physical stock is received
- complete bills only after verifying items and payment
- use returns only against correct original documents
- record receipts and supplier payments on time
- check low stock and expiry reports daily
- review dashboard at the start and end of the day
- export important reports when needed
- take regular backups

## 17. Suitable Use Cases

This project is especially useful for:

- medical stores moving from manual records to software
- pharmacy owners who need stock and billing in one place
- businesses that need due tracking for both customers and suppliers
- growing businesses preparing for multi-branch operations
- teams that need admin control with staff-level operating access

## 18. Conclusion

The Medical Management System is not only a billing tool. It is a complete operational platform for pharmacy business management.

It connects shop setup, medicines, stock, purchases, sales, returns, accounting, reports, branches, and staff control into one professional workflow so that business owners can operate with more confidence, better visibility, and fewer manual errors.

This documentation can be shared with customers, managers, and non-technical stakeholders to explain the project clearly and professionally.
