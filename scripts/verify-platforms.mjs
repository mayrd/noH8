#!/usr/bin/env node
/**
 * L1 — print the §8.5 acceptance matrix as a live-verification checklist.
 *
 * Usage: `npm run verify` (or `node scripts/verify-platforms.mjs`). Purely
 * offline — it only prints the checklist; the network contact happens when
 * *you* visit the live pages to verify each cell.
 */
import { renderVerificationChecklist } from './platformVerification.mjs';

process.stdout.write(renderVerificationChecklist());
process.stdout.write('\n');
