# Readiness check - 16 October 2026

The application now runs with **permanent local storage without Docker**, using an H2 file at `backend/data/marble.mv.db`. PostgreSQL remains an optional later deployment and is not verified on this machine.

## Verified

- Mobile/centimetre UI: nine stock/dimension checks, two payment checks and the print-privacy check passed. Existing metre-based lines retain the same amounts after conversion to centimetre entry. Browser checks covered 320/390-pixel phones, 768/1024-pixel tablets and 1280-pixel desktop layout; tested routes included dashboard, stock/categories, invoice and purchase lists/forms, contacts, profile and accounts. A forty-line sample retained the same five A4 pages and row distribution on phone and desktop, without overflow; mobile PDF export also produced five A4 pages, with the last page visually checked. These are browser viewport checks, not physical-device/OS printing tests. Temporary test pages were removed; no test invoices/payments were saved in the real database.

- Updated Facturation visibility at the user’s request: restricted accounts can list, open by ID/number and print all invoices, while editing/deleting any invoice, payment changes, notes and administrative APIs remain blocked. Both account-permission tests passed after this change; TypeScript and the frontend production build passed. The local backend was restarted.

- Restricted invoicing accounts: 24 selected backend checks passed (account authorization and ownership, session revocation, existing invoice workflows, automatic stock and independent backup restoration). Frontend TypeScript and production build passed. V8 adds enabled/session-version fields and indexed invoice authorship without assigning historical invoices to a guessed creator. The live local database was backed up, restored independently for verification, then migrated to V8. Its saved invoices/payments remained unchanged. Admin account listing and the creation form were verified in the browser without creating a test account in the real database. PostgreSQL execution remains unverified locally.

- Current stock policy: shortages are warnings by default. Seven targeted backend checks passed, including creating/editing invoices at zero or negative stock, automatic balances after purchases/deletions, and retained low-stock alerts. Earlier strict-policy checks explicitly opt into that optional policy. Frontend TypeScript and production build passed; browser checks confirmed compact dashboard actions, Stock navigation, category management/creation popups, and enabled invoice row/save controls despite shortages. The local backend was restarted and saved documents/payments were checked unchanged.

- Invoice presentation/internal-notes update: API checks cover note creation, update, clearing, length validation and unchanged totals/number. Import plus independent database restore preserve notes. The print-model privacy check passes. Browser/PDF checks verified seven table columns without TVA, amount in words 12px below the table, bottom-left totals, empty right side, and five-page output for forty wrapped lines with no page overflow. Login and validation messages remain French; the supplied logo is used in the login, navigation and printed header. The local database was backed up and migrated to V7; existing documents, payments and stock were retained.

- Large purchase input checks: a purchase with 9,999,999,999.99 MAD/m² saved and reloaded correctly in the isolated API test. Excess price, precision, length and line totals return specific errors. Eight frontend checks and the production build passed; browser entry checks confirmed excessive price/length are marked before submission. The test helper reads response JSON explicitly as UTF-8.
- Added a repeatable `TEST` data set to the local application at the user's request: three clients, one supplier, three stocked articles and purchase `TEST-ACHAT-001`; no client invoices or payments were created. Rerunning the setup reuses the same records and does not add stock twice. A backup was taken before the insertion.

- Earlier strict stock policy (superseded by warning-only behavior): seven focused frontend checks passed (exact boundaries, repeated articles/subtotals, invoice edit allowance, negative history, CM/M conversion, duplication and unknown stock). Browser checks confirmed shortages appear while typing, row/save actions are disabled, correction re-enables them, and an existing invoice receives its own original allocation when edited. No documents were saved during these browser checks.

- Automatic-stock/dashboard update: 62 backend checks, 46 passed and 16 PostgreSQL checks skipped, zero failures/errors (`backend/automatic-stock-regression.log`). New coverage includes surface-based purchases/sales, edits, deletion, cancelled purchases, insufficient-stock rejection, concurrent sales, demand-based alerts and monthly invoice/payment date aggregation. The updated 10,051-invoice/100,501-line dashboard sample took 990 ms. Frontend TypeScript and production builds passed; chart period selection, stock filter and read-only balances were verified in the browser.
- The existing local database was backed up before the update, then migrated to V6 without changing saved documents. Its New Halayeb history has 41.3788 m² purchased and 42.9788 m² invoiced: the -1.6 m² balance is deliberately shown as missing purchase history, not corrected by invented stock.

- Earlier baseline verification: 53 tests, 38 passed, 15 PostgreSQL tests explicitly skipped, no failures. See `backend/local-readiness.log`.
- Volume sample: 10,051 invoices and 100,501 lines across two years. All-time dashboard totals, date filters, late pages, contact balances and recent documents remain correct. Dashboard response in the latest H2 test run: approximately 1 second on this machine. This is a sample measurement, not a capacity guarantee for every workload.
- Local-file tests verify preserved import, rejection of import over populated data, online ZIP backup, restore into a separate database, and shutdown/reopen persistence.
- The real running local application retained 4 preserved documents, 8 lines and 3 payments. Frontend proxy totals match backend totals. An actual backup restored and opened successfully in a separate folder. After restarting the backend into a new process, saved document IDs, numbers, dimensions and payments were checked again and remained unchanged.
- Frontend production build and application TypeScript checks passed. The backup button is in Profile. Browser automation was unavailable during the earlier storage-readiness check; the latest dashboard and stock screens were checked in the browser as described above.
- Concurrent invoice creation produces distinct numbers. Concurrent payments cannot overpay a document. Deleted invoice numbers are not reused.
- Company profile settings persist and new documents capture them; old document snapshots stay unchanged. Renaming the administrator does not recreate its original login on restart.
- Shared SQL migrations install growth indexes. PostgreSQL-only substring indexes are prepared in V4 but have not been executed here.
- Export/import fidelity check covers empty and multiple-payment histories, exact saved payment totals, IDs, JSON structure, SQL escaping and malformed-record rejection. Run `tools/verify-transfer.ps1` to repeat it with disposable fixtures.

## Data preserved

The original saved export was normalized and its payment totals verified. Use the newest `backups/preview-preserved-*.json` and matching SHA-256 file. It contains 3 invoices, 1 purchase document and 3 payments, with the document lines and snapshots. The earlier `preview-20261015-214553.json` contains nested payment arrays; keep it as an original reference and do not import it directly. The importer rejects that malformed structure.

The preview server was no longer running when work resumed. Entries made after the saved export cannot be verified or recovered from that file. No existing database was overwritten or reset during this check.

## Later: PostgreSQL deployment

1. Start/fix Docker Desktop's Linux engine, or provide a working PostgreSQL server.
2. Follow `README.md` to initialize the live database using the private `.env` already prepared. Live demo seeding is disabled. The initial live password is in `.env`; the demo password is not the live password.
3. Run the PostgreSQL workflow tests, apply the shared and PostgreSQL-specific migrations and verify query plans on the actual host.
4. Decide whether the preserved preview records should be retained. Import only into an empty business database, verify counts, invoice numbers, PDFs and payment balances.
5. Restart the live backend and verify data remains. Check `/health` reports PostgreSQL and persistent storage.
6. Run `backup-database.ps1`, then `verify-backup.ps1` on its resulting archive. The restore check uses a separate disposable database and never overwrites the working one.

Backup tools are manual. No recurring backup job has been installed. Keep a private second copy on another device.

## Invoice numbering update — 2026-10-20

- Invoice format is now `NN-MM-YYYY`, based on the selected document date. Same-month/day-only edits retain the existing code, including legacy codes; month/year changes allocate the destination period's next code. Purchase numbering is unchanged.
- A read-only preview endpoint never consumes counters. The frontend cancels obsolete date requests and ignores their results/errors; save responses and the document detail show the backend's actual assigned code.
- Existing row locks and counters serialize allocations. Legacy counters and modern/legacy record maxima are respected. Editing or deleting an imported invoice preserves its consumed number even if its counter was missing. Existing records are not renumbered in bulk; no schema migration is needed.
- SQL DATE values now use JDBC calendar-date conversion, fixing a timezone-sensitive month-boundary regression caught by the numbering tests.
- Verified: 45 backend tests passed (numbering, concurrent creation/date edits, permissions, workflow, and stock), 3 frontend preview tests passed, TypeScript and production frontend build passed. Browser checks used disposable sample data and confirmed the read-only preview, month changes, legacy day-only preservation, and restoring the original number after returning to its month.
- 15 PostgreSQL numbering/concurrency variants were skipped because a Docker engine was unavailable. Live PostgreSQL verification remains outstanding. No local or cloud business data was modified.

## Invoice contact footer update - 2026-10-20

- Preserved the existing stone/gold stationery and created a verified seven-file design backup at `design-backups/invoice-before-contact-footer-2026-10-20/` before editing.
- Added client/supplier telephone, repeated contact footer with WhatsApp/fixed/mobile/address, existing legal identifiers, and a locally bundled QR encoding the exact supplied Google Maps URL. Saved contact values take precedence over the reference defaults for Arabic Stone.
- Added an editable company WhatsApp field with a nullable V9 migration. New document snapshots include it; existing company data and document snapshots are preserved. Import/export retains the new field.
- Verified 28 backend checks, 5 frontend print/footer checks, TypeScript, production build, and the fixture-only transfer script. The V8-to-V9 migration preservation test passed.
- Exported and visually inspected a one-page A4 sample and the last page of an eight-page/48-line sample. Every page has a header/footer/QR, totals appear on the final page only, no page overflow was detected, and mobile preview preserves pagination. Decoded the QR from the exported sample and from the first/last rendered pages of the long PDF.
- No real local or cloud business records were changed. PostgreSQL runtime deployment remains unverified locally because Docker is unavailable.
