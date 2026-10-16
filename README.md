# ARABIC STONE — facturation marbre

This is the main application. `frontend/` adapts the original React frontend; `backend/` is the consolidated Spring Boot backend. The older projects elsewhere in the repository are preserved as references.

## Run locally with permanent data (no Docker)

Open two PowerShell terminals in this folder:

```powershell
.\start-backend.ps1
```

```powershell
.\start-frontend.ps1
```

Open **http://localhost:8080**. The default launcher now uses **H2 in a permanent file**, at `backend/data/marble.mv.db`. Stopping the application does not erase it. It is intended for one local backend process on this computer.

Initial administrator login is in the private `.env` file (`APP_ADMIN_USERNAME` / `APP_ADMIN_PASSWORD`). The launcher creates that configuration once if absent. Company phone, address, ICE, IF, RC, patente and CNSS are editable in **Profile**. Existing documents keep their original saved company details.

In **Profile > Sauvegarde de vos données**, download a ZIP backup. This uses the database's online backup command; do not copy a live database file as a substitute. Keep the ZIP and a separate private copy of `.env` on another device.

Check a ZIP by restoring into a new folder:

```powershell
.\verify-local-backup.ps1 -BackupFile C:\path\to\marble-local-backup.zip
```

The script refuses an existing destination, restores a separate copy and opens it to verify document/payment tables. The current database stays untouched. If that restored copy is needed later, stop the backend, set `LOCAL_DB_PATH` to the restored `marble` path without `.mv.db`, and start normally. Keep the original file until the restored copy is checked.

To retain an earlier application export, use `import-local.ps1 -SnapshotFile ...` once against an empty local database. It preserves document IDs, numbers, saved details and payments. It refuses a populated business database. Use the verified `preview-preserved-*.json` file, not the original nested-payment export.

`-Preview` still means a temporary demo that resets. `-Postgres` selects the separate PostgreSQL setup for later. Do not use `-Preview` for your actual work.

## What is included

- Clients, suppliers, categories and marble articles, with document histories.
- Purchase documents and client invoices: create, edit, view, print and download PDF.
- Separate **Longueur** and **Largeur** fields, fixed **cm** entry (no unit selector), **PCS**, surface in **m²**, price in **MAD/m²**, and TVA.
- **Ajouter un sous-total** closes the group of lines since the previous subtotal. It can span several articles. The next running subtotal starts at zero. Subtotals are saved and printed without being counted twice in document totals.
- HT, TVA, TTC, payments, amount paid and remaining balance. Overpayments and reductions below the amount already paid are rejected.
- Internal invoice notes (up to 4,000 characters), editable on the invoice form and shown in its information page. They are excluded from the print model, printed invoice and PDF. Application transfers and database backups preserve them.
- The supplied Arabic Stone logo and French login page are used throughout the application. Printed document tables omit the TVA column; the fixed 20% TVA remains in totals. The amount in words follows the table, with the totals block at the bottom left of the final page and space left empty on the right.
- Example marble articles, supplier purchases, and unpaid/partly paid/fully paid invoices.

Stock in m² is calculated automatically from saved document lines: active purchase documents add surface and client invoices subtract it. Edits, deletions and purchase cancellations are reflected without an editable stock counter. By default shortages are warnings: invoices can be saved with zero or negative stock. Concurrent document changes still lock affected articles in a stable order.

The invoice editor shows availability and shortage alerts while dimensions, units and PCS are entered. These alerts do not block adding rows, duplicating or saving. Numeric limits, required fields and payment checks still apply. Stock refreshes every 30 seconds while visible and on return to the window. The Stock page manages categories in a popup; legacy category URLs redirect there. The dashboard uses compact creation buttons instead of the large banner.

The dashboard includes monthly sales/receipts (6 or 12 months), invoice counts, active clients, available stock and low-stock alerts. The automatic alert threshold is seven days of demand based on the last thirty days of invoiced surface; an existing article minimum, if greater, remains a floor. Articles without recent sales are flagged when their balance reaches zero. Negative balances from incomplete historical purchases are shown explicitly and excluded from the available-stock total. Enter the actual missing purchase documents to correct the history.

Stock measures the total surface of each article, not the availability of a particular slab size. Cutting, offcuts, employees, payroll, caisse and full accounting remain outside this version. Supplier payments here belong to purchase documents; they are not a supplier invoice ledger.

## Calculation rules

Length and width are entered in centimetres; surface in m² = length × width × PCS ÷ 10,000. Existing metre-based documents are converted to centimetres for display/editing, retaining their area and amounts. The surface column is labelled **m²**. Entered prices are **TTC per m²**, preserving the original application's price convention. TVA is fixed at **20%**. It is shown separately in the totals and enforced by the backend; the printed article table has no TVA column.

For centimetres: `surface per piece = longueur × largeur / 10000`.
For metres: `surface per piece = longueur × largeur`.
`total surface = surface per piece × PCS`.
`line TTC = round(total surface × price TTC/m², 2)`.
`line HT = round(line TTC / (1 + TVA rate), 2)`.
`line TVA = line TTC − line HT`.

Amounts use decimal arithmetic in Spring, with HALF_UP rounding. Dimensions accept three decimal places; per-piece surface is stored with six decimal places. The server recalculates all saved totals. Invoice numbers are assigned automatically on creation using the original `YYMM###` monthly sequence; manual invoice numbers are ignored and an existing invoice keeps its number when edited. Documents preserve contact, company and article names so later catalogue edits do not alter them. There is no discount field in this minimal version.

The entry form includes searchable clients/articles, inline contact creation, a same-article/new-dimensions action (retaining width and price), row duplication, Enter-to-next-field navigation and a sticky totals/save bar. Optional declaration/payment fields are collapsed by default.

## Fast local preview without PostgreSQL

Requirements: Node.js 20+ and a **JDK 21**, not Java 8. Maven is supplied by the wrapper. Open two PowerShell terminals in this folder:

```powershell
.\start-backend.ps1 -Preview
```

```powershell
.\start-frontend.ps1
```

Open **http://localhost:8080**. Local demo login: **admin / marble123**.

The preview uses an **in-memory H2 database**. It resets when the backend stops. Use the PostgreSQL setup below to retain your data. The launcher can use the portable JDK/Maven already installed under `%TEMP%\opencode\tooling` on this machine, if present.

## Persistent PostgreSQL database

Use the new `marble_invoicing` database. The old MySQL and Spring databases are untouched.

1. Keep any current preview running until its records are exported:

```powershell
.\export-preview.ps1
```

This asks for the existing app login and preserves business records, document snapshots, dimensions, payments and company details under ignored `backups/`. It excludes password hashes. Avoid editing records during this application export; a PostgreSQL dump is the transaction-consistent backup for live use.

2. Generate private configuration once (already prepared on this machine):

```powershell
.\configure-live.ps1
```

The ignored `.env` contains random database, initial administrator and signing secrets. It will not be overwritten. Read `APP_ADMIN_PASSWORD` there for the first live login. Demo seeding is disabled in the live profile. An existing administrator is never recreated just because its username changed.

3. Start Docker Desktop's Linux engine, then PostgreSQL:

```powershell
docker compose up -d db
```

4. Start the live backend in another terminal:

```powershell
.\start-backend.ps1 -Postgres
```

This reads `.env`, selects the `live` profile and runs Flyway. PostgreSQL is on localhost:5433; the backend is on localhost:4000. If the preview occupies port 4000, first run this validation instance on a different port with `$env:SERVER_PORT='4001'`. Do not stop the preview until preservation and import are verified.

5. If retaining preview records, import into the empty live business database after Flyway and the administrator have initialized:

```powershell
.\import-preview.ps1 -SnapshotFile .\backups\preview-YYYYMMDD-HHMMSS.json
```

The importer runs in one PostgreSQL transaction, rejects a populated business database, preserves document IDs/numbers/snapshots, and leaves the live administrator credentials unchanged. `-PrepareOnly` writes SQL without executing it. Do not import demo records into a real company database unless you want to retain them.

6. Run `.\start-frontend.ps1`, open http://localhost:8080, sign in with the live credentials and check clients, invoices, payments and PDFs. Verify `/health` reports PostgreSQL and `storage: persistent`. Restart the live backend and confirm records remain.

Alternatively, `docker compose up --build` builds React into Spring and serves the whole app at http://localhost:4000. Compose binds both published ports to this computer only. Never use `docker compose down -v` with business data: it deletes the database volume.

For a separately installed PostgreSQL server, set `DB_URL` and `DB_USERNAME`; put its password in `.env`. The database administrator must allow/install the standard `pg_trgm` extension used for substring-search indexes.

## Backups and recovery

```powershell
.\backup-database.ps1
.\verify-backup.ps1 -BackupFile .\backups\marble-TIMESTAMP-ID.dump
```

The backup uses PostgreSQL `pg_dump` custom format, validates archive structure, and saves a SHA-256 checksum. Verification restores to a new, uniquely named test database, checks document/payment tables, then removes only that test database. It never restores over the working database. Keep a private second copy on another device. These are manual tools; no scheduled backup has been installed and restore success must be tested with a working PostgreSQL engine.

## Growing records and dashboard

- Dashboard sums all headers and payments in SQL, without a 10,000-document cap or fetching invoice lines. Its totals share a repeatable-read transaction snapshot. Cancelled purchases are excluded.
- Visible invoice/purchase pages return exact database counts with `paged=true`; contact histories have pages and all-history balances. Batch printing uses only the visible page to avoid loading years of PDFs into browser memory.
- The dashboard refreshes on return/focus and every 30 seconds while visible. Failed refreshes warn that the previous figures may be stale.
- V3 adds date/order, status/date, contact, payment-history and product-reference indexes. Live PostgreSQL also runs V4 for trigram substring indexes. Foreign keys protect referenced records; numeric amounts use fixed precision.
- Document counters are transactional and persistent: deleting the latest invoice does not free its number. Concurrent payments lock the document before validating the remaining balance.
- Years alone do not determine capacity. Use the volume checks below, monitor disk space and query times, and test on the actual PostgreSQL host. Local H2 timings do not establish PostgreSQL capacity.

## Manual testing checklist

The local database includes clearly labelled `TEST` clients and articles, supplied by purchase `TEST-ACHAT-001`. Search for `TEST` when creating invoices. The sample stock is 114.665 m² New Halayeb at 200 MAD/m² TTC, 129.735 m² Crema Silvia at 140 MAD/m² TTC, and 108 m² Noir Galaxy at 450 MAD/m² TTC. To prepare this set again, run `./tools/seed-testing-data.ps1`; it reuses existing test records without overwriting them or adding the purchase twice. These records affect dashboard figures and should be kept in a tester database.

Numeric limits are checked on each editor line: dimensions up to 100,000 with three decimals, PCS from 1 to 100,000, prices up to 9,999,999,999.99 MAD/m² with two decimals, and line/document totals up to 999,999,999,999.99 MAD TTC. Excessive inputs are marked before submission.

1. Sign in. Open **Marbres & pierres**, clients and suppliers.
2. First save a supplier purchase for the test article (for example **323 cm × 71 cm × 20 PCS**, adding **45.866 m²**). Then create an invoice: length **323 cm**, width **71 cm**, **16 PCS**, price **200 TTC/m²**, TVA **20%**. Total surface must be **36.6928 m²**, line TTC **7,338.56 MAD**, and the remaining stock from these two documents **9.1732 m²**.
3. Add another line, including a different article if desired, with sufficient recorded purchases for each material. Click **Ajouter un sous-total**. Add further lines and another subtotal. Verify each subtotal covers only the lines since the preceding marker.
4. Save, reopen and edit the invoice. Verify dimensions, PCS, TVA and subtotal positions persist.
5. Add a partial payment. Check paid/remaining amounts. Try an overpayment: it must be rejected. Edit or remove the payment and check the recalculation.
6. Print and download the PDF. Verify dimensions, surfaces, subtotal rows and payment totals.
7. Repeat with a supplier purchase document. Open a client/supplier name in the list to see its document history.
8. Change an article/contact name: existing saved documents retain their original names. An article or contact referenced by documents cannot be deleted. Documents with payments cannot be deleted until those payments are corrected/removed.

## Checks

```powershell
cd backend
.\mvnw.cmd verify
```

Tests exercise the complete Spring API and migrations with H2 in PostgreSQL mode. The same workflow tests also run against PostgreSQL through Testcontainers when Docker is available; those tests are explicitly skipped otherwise.

```powershell
cd frontend
npm ci
npm run build
npm exec tsc -- --noEmit -p tsconfig.app.json
```

Some inherited React components still have lint findings; `npm run lint` reports them. Production build and type checking are separate checks. H2 passing does not establish PostgreSQL runtime verification on machines without a working Docker engine.

The original invoice API is preserved (`/factures`, `items`, `unitPriceTtc`, `lineTotalHt`, `lineTotalTva`, `lineTotalTtc`), extended with line `length`, `width`, `dimensionUnit`, `quantity` (PCS), `surface`, `totalSurface`, `subtotalAfter`, and document paid/remaining totals. Purchasing uses `/bon-achat` and keeps `unitPrice`, `lineTotal`, and `totalAmount`. Prices and tax rates are never replaced by dimensions.

## Arabic Stone visual theme

The app uses a generated black marble texture, warm ivory surfaces and gold accents. The dashboard shows actual invoice, purchase and payment totals, recent documents, and catalogue prices. Its decorative stone swatches are illustrative rather than product photos.

Invoices and purchase documents share A4 stationery with the company identity, separate length/width columns, PCS, m², TTC prices, fixed 20% TVA and saved group subtotals. Long documents repeat the header and reserve space for final totals. Existing document numbers and saved company/client snapshots are preserved.

Configure your business address, telephone and legal identifiers under **Mon entreprise & profil** before creating real documents. The preview uses saved document information; demo documents may have empty company details.

## Restricted invoicing accounts

The administrator opens **Comptes** to create and manage accounts with the fixed **Facturation** role. Accounts can be renamed, disabled/reactivated and have their passwords reset (minimum ten characters). Each change invalidates the account's previous sessions immediately; reactivation requires a fresh login. Accounts are disabled instead of deleted so invoice history remains linked to its author.

Restricted accounts create invoices using existing clients and articles, then view/print/download all invoices, including those created by the administrator or other invoicing accounts. They cannot edit or delete invoices, modify internal notes, manage payments, clients, stock, purchases, settings, backups or accounts. The backend enforces these restrictions independently of the interface. Their invoices use the managing administrator's company information and the shared automatic invoice-number sequence. Existing invoices remain unchanged and available to admins; their creator is left unset rather than guessed. New invoices record their creator in an indexed column.

`InvoicingAccountsTest` covers allowed creation/read/printing data, shared invoice access, forbidden API routes, account control, disabled logins and session revocation.

## Phone and tablet interface

Phone navigation includes a drawer and quick bottom tabs. Invoice and purchase lines use labelled cards on smaller screens and tables on wide desktop screens. Length and width always use centimetres, without a unit selector; all areas and prices remain in m². The mobile save bar stays available while entering lines.

Stock, document histories, accounts and payment histories adapt to cards. Form controls have touch-sized targets, numeric keyboards, and readable input text; dialogs fit short/narrow screens and scroll vertically. The invoice preview fits the screen and offers a 100% zoom option. Printing and PDF export retain the original A4 content and pagination.
