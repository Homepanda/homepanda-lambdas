#!/usr/bin/env node
// ESAW_API_TOKEN=xxx node scripts/delete-file.mjs <file-id>
import { loadConfig } from '../helpers/config.mjs';
import { deleteFile } from '../services/esaw.mjs';

const usage = 'Usage: ESAW_API_TOKEN=xxx node scripts/delete-file.mjs <file-id>';
const args = process.argv.slice(2);

if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
  console.log(`${usage}\nDeletes an uploaded eSAW file. ESAW_BASE_URL optionally overrides the API URL.`);
} else {
  try {
    if (args.length !== 1 || args[0].trim().length !== 36) {
      throw new Error(`Provide one 36-character eSAW file ID.\n${usage}`);
    }
    const fileId = args[0].trim();
    const cfg = loadConfig();
    if (!cfg.apiToken?.trim()) {
      throw new Error('ESAW_API_TOKEN is required.');
    }
    await deleteFile(cfg, fileId);
    console.log(`Deleted file ${fileId}.`);
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
  }
}
