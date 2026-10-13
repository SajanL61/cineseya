# SmartReact database protection

CineSeya must access only the MongoDB database named exactly `cinerusubs`. `SmartReact` is a protected, unrelated database and must never be read, written, renamed, dropped, migrated, or reused.

## Atlas role

Create a dedicated CineSeya database user with exactly one built-in role:

```text
Role: readWrite
Database: cinerusubs
```

Do not grant `readWriteAnyDatabase`, `dbAdminAnyDatabase`, `atlasAdmin`, `root`, or any role scoped to `admin`, `SmartReact`, or `*`. Put this user in `MONGODB_URI` and keep `MONGODB_DB=cinerusubs`.

## Application enforcement

Startup configuration rejects any `MONGODB_DB` except `cinerusubs`. After Mongoose connects, the application checks the live server-reported database name. A connection reporting `SmartReact` is explicitly disconnected and rejected as a critical configuration error. Models never call `useDb`, and repository code must not include a SmartReact collection migration.

## Production proof checklist

Run these checks with the deployed application identity from an approved administration host and retain redacted, timestamped output:

1. Connect with the dedicated CineSeya application URI and run `db.getName()`; it must return `cinerusubs`.
2. In `cinerusubs`, create and remove a uniquely named disposable proof document in a disposable proof collection; both operations must succeed.
3. Switch the same authenticated connection to `SmartReact` and attempt `findOne` and an insert against a uniquely named disposable proof collection. Both must fail with an authorization error. Do not target an existing collection and do not broaden privileges to make this check work.
4. Export or screenshot the Atlas database-user role showing only `readWrite@cinerusubs`.
5. Compare SmartReact Atlas metrics/audit events and pre/post collection inventories. There must be no successful application-identity operations and no data changes.

This repository has no production Atlas credentials. Local tests can prove fail-closed application logic, but cannot honestly prove the live Atlas role. Deployment remains incomplete until all five checks are recorded.
