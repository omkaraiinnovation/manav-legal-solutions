/**
 * Forces every collection's live store to (re)initialize from /data/seed.
 * Run with `pnpm seed` (or `npm run seed`). Safe to re-run — this is also
 * what the Admin > "Reset Demo Data" action calls under the hood.
 */
import { COLLECTIONS, resetToSeed } from "../lib/db/store";

for (const collection of Object.values(COLLECTIONS)) {
  resetToSeed(collection);
  console.log(`seeded: ${collection}`);
}
console.log("\nDone. Local data store initialized from /data/seed.");
