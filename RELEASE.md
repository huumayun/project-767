# Shipping an update to a shop

Written for the hand-delivered case: a small number of shops, each on one till,
each sent an installer. There is no auto-updater wired up — see *If this grows*
at the end.

## What survives an update, and why

```
C:\Program Files\Mechanical Shop POS\    the app     — replaced wholesale by the installer
%APPDATA%\mechanical-shop-pos\shop.db    the data    — the installer never touches it
%APPDATA%\mechanical-shop-pos\backups\   copies      — kept across updates
```

The database lives in `app.getPath('userData')`, outside the install folder
(`electron/db/index.ts`). Reinstalling over the top therefore keeps every sale,
customer, product and shift. **Uninstalling does not delete it either**, so a
shop that removes and reinstalls the app still has its books.

Schema changes travel in `electron/db/migrations.ts`. On launch the app applies
the base schema, reconciles any missing columns, then runs whichever versioned
migrations that particular database has not seen — tracked in its own
`migrations` table. A shop six months behind catches up in one launch, in order.

Before the first launch of a **new version**, the app copies the database to
`backups/pre-update-<from>-to-<to>-<timestamp>.sqlite` and keeps the newest five.
The copy is made with `VACUUM INTO`, so the write-ahead log is folded in and a
sale rung up seconds earlier is inside it.

## Releasing

1. **Bump the version** in `package.json`. This is the only switch that matters:
   the installer is named from it, and the app compares it against the version
   recorded in the database to decide whether to take a backup.

   ```
   "version": "1.0.1"
   ```

2. **Build.**

   ```
   npm run electron:build
   ```

   Output lands in `release/`:
   - `Mechanical Shop POS-Setup-1.0.1.exe` — the installer, for a shop that has the app
   - `Mechanical Shop POS-Portable-1.0.1.exe` — no install, for a spare machine

3. **Test the upgrade, not just the app.** Installing over real data is the part
   that can go wrong, and a clean machine will not show it.

   - Copy a shop's `shop.db` onto your machine first, so you are upgrading data
     that looks like theirs rather than an empty file.
   - Install the new version over the old one.
   - Check: the sales are still there; today's figures match; open a customer
     ledger; print one invoice; open and close a shift.
   - Confirm `backups\pre-update-…` gained a file.

4. **Send the installer.** The shop runs it with the app closed. No uninstall
   first — NSIS replaces the old build in place. Their data is untouched.

5. **Tell them what changed**, in a sentence they can act on. "The invoice now
   prints the amount in words" travels; "v1.0.1" does not.

## Google Drive credentials

Drive backup needs an OAuth client. It is **not** in the repository — it used to
be, as two literals in `electron/services/googleDrive.ts`, and that repository is
public, so the client secret was readable by anyone and sat in the history of
every commit that touched the file. **That credential is burned: rotate it in the
Google Cloud Console and never put the replacement in a tracked file.**

Copy `google-oauth.example.json` to `google-oauth.json` in the project root and
fill it in. That filename is git-ignored and is listed in
`electron-builder.json5`, so it travels into the build without ever being
committed. `GDRIVE_CLIENT_ID` / `GDRIVE_CLIENT_SECRET` in the environment work
too, and win over the file.

A build made without either is not broken: Drive backup reports itself
unconfigured and everything else works. Local backups are unaffected.

Note that a desktop app cannot truly keep a client secret — the installer ships
it and an asar is a zip, which Google says as much about for "Desktop app"
clients. The authorization flow uses PKCE so an intercepted code cannot be
exchanged, and what this arrangement buys is that the credential is no longer
published in source control and can be rotated without rewriting history.

## Security notes

Two things are deliberately not solved in code, so nobody assumes they are.

**`shop.db` is not encrypted.** Customer names and phone numbers, cost prices,
margins and the whole sales history are readable by anyone who can open the file.
The right control here is BitLocker on the till — it costs no code and covers a
stolen machine, which is the realistic threat. Application-level encryption would
mean holding a key on the same machine, which does little against someone already
logged into it.

**Drive backups are unencrypted copies of that same file.** Encrypting them needs
a passphrase the owner keeps, and a passphrase the owner forgets is a backup that
cannot be restored on the replacement till — which is the one moment the backup
exists for. If a shop's data is sensitive enough to need this, agree the
passphrase handling with them first rather than switching it on.

The refresh token inside those backups *is* encrypted (migration 011), so a
leaked backup no longer hands over access to the Drive account holding the rest
of them.

## Writing a migration

- **Never edit a migration that has shipped.** It has already run on the shop's
  machine and its id is recorded, so a change to it will never execute there.
  Their database and yours would then differ with nothing to say why.
- New change → new entry in `MIGRATIONS`, new id, appended at the end.
- Write it so running it twice does no harm (`IF NOT EXISTS`, guarded updates) —
  the runner will not run it twice, but a mistake in that bookkeeping should not
  cost data.
- Adding a column is safe. Dropping or renaming one is not: the old build, if
  the shop ever rolls back, will still query it.

## If something goes wrong on their machine

1. Close the app.
2. In `%APPDATA%\mechanical-shop-pos\backups\`, take the newest
   `pre-update-…sqlite`.
3. Rename `shop.db` to `shop.db.broken` — do not delete it; it is the only
   record of what actually happened.
4. Copy the backup to `shop.db`, and delete `shop.db-wal` and `shop.db-shm` if
   they are there.
5. Reinstall the previous version and open it.

The shop loses whatever was rung up between the backup and the failure, so get
to it the same day.

## If this grows past a few shops

Hand delivery stops scaling at about the point you cannot remember who is on
which version. At that point add `electron-updater` and a `publish` block in
`electron-builder.json5` (GitHub Releases works and is free). The app then
checks on launch, downloads in the background, and installs on restart. The
database story above does not change — it is the delivery that changes.

## If a shop wants a second till

Two things have to be built first, and neither is a small change. Selling this
before they exist means selling something that quietly loses data.

**Sync only pushes.** `syncEngine.ts` sends rows to Supabase and never reads any
back, so it is a cloud *backup*, not synchronisation. Two tills would each hold
their own catalogue, their own stock counts and their own customer balances, and
neither would ever see the other's. A second till needs a pull pass, and with it
a rule for what happens when the same row was edited in two places.

**Invoice numbers are only unique within one database.** `generateInvoiceNumber`
counts `INV-YYMMDD-0001` upward per day. On one till that is safe — the number
is taken and written inside a single transaction, and a collision retries
(`sales:create`). Across two tills both would independently issue
`INV-250912-0001`, and because rows are keyed by UUID the cloud would accept
both: one shop, one day, two different bills with the same number on them. Put
the device id in the number (`INV-REG01-250912-0001`) before the second till
goes in, not after — renumbering bills a customer already holds is not something
you can do later.
