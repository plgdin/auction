# Scratch & Debugging Scripts

This directory contains temporary utility scripts, database backfill functions, and standalone debugging tools.

## Key Utility Scripts

* **`reprocess_all.ts`**: Resets the `asset_status` of all completed auctions in the database to `'pending'`. Useful for running new worker/parser versions on all existing data.
  * *Run command*: `npx tsx scratch/reprocess_all.ts`
* **`run_single_ocr_test.ts`**: Resets a specific auction record (e.g. `13932`) back to pending and runs the worker queue processing on it immediately to test rendering and OCR output.
  * *Run command*: `npx tsx scratch/run_single_ocr_test.ts`
* **`inspect_raw_materials.ts`**: Queries a specific auction record from Supabase and formats its `raw_materials_text` (JSON) to console output for quick examination.
  * *Run command*: `npx tsx scratch/inspect_raw_materials.ts`
* **`clear_db.ts`**: Resets or truncates database records to clear local scrapers.

## Parsing & Testing Scripts
* **`test_parser.ts`**: Runs the catalog parser (`mstcParser.ts`) against local test strings or files to verify regex extraction.
* **`test_ocr_parser.ts`**: Evaluates OCR pattern-matching and quantity extractor logic.
