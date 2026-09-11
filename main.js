#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CapCut } from './lib/capcut.js';
import { createTempEmail, fetchEmails } from './lib/mail.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  try {
    process.loadEnvFile(envPath);
  } catch {}
}

function printHelp() {
  console.error(`
======================================================
  🎬 CAPCUT AUTOMATION & SCRAPER CLI
  Platform: Node.js (Zero-Browser & High Performance)
  Output: Clean JSON Final Result to stdout
======================================================

Usage:
  node main.js [command] [options]

Commands:
  --health, -h              Run system health check
  --template <url|id>       Scrape template details, direct video link & recommendations
  --download <url|id>       Scrape and download watermark-free template video
  --inspirations            Scrape AI prompts, templates & effect feeds
  --create-account          Create a disposable account via email OTP verification
  --check <cookie>          Check full profile, Pro start/exp, role & referral info
  --claim <code|link>       Claim a referral code, invite link, or redemption voucher
  --help                    Show this help message

Options:
  --ref <code|link>         Attach referral code or invite link when creating account
  --output <path>           Custom output path for downloaded video (default: ./downloads/<id>.mp4)
  --save <file>             Save created account credentials to specified file
  --cookie <string>         Pass existing session cookies for authenticated requests
  --loop                    Run continuously creating accounts
  --count <N>               Create N accounts in batch (default: 1)
  --delay <seconds>         Delay between iterations in seconds (default: 3)
  --quiet, -q               Suppress progress messages to stderr
`);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    action: null,
    target: null,
    output: null,
    cookie: null,
    save: null,
    ref: null,
    count: 1,
    loop: false,
    delay: 3,
    quiet: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help') {
      options.action = 'help';
    } else if (arg === '--health' || arg === '-h') {
      options.action = 'health';
    } else if (arg === '--template') {
      options.action = 'template';
      options.target = (args[++i] || '').replace(/[\r\n\t\s]+/g, '').trim();
    } else if (arg === '--download') {
      options.action = 'download';
      options.target = (args[++i] || '').replace(/[\r\n\t\s]+/g, '').trim();
    } else if (arg === '--inspirations') {
      options.action = 'inspirations';
    } else if (arg === '--create-account') {
      options.action = 'create-account';
    } else if (arg === '--claim') {
      options.action = 'claim';
      options.target = (args[++i] || '').replace(/[\r\n\t\s]+/g, '').trim();
    } else if (arg === '--check') {
      options.action = 'check';
      options.cookie = (args[++i] || '').trim();
    } else if (arg === '--ref' || arg === '--invite-code') {
      options.ref = (args[++i] || '').replace(/[\r\n\t\s]+/g, '').trim();
    } else if (arg === '--output' || arg === '-o') {
      options.output = (args[++i] || '').trim();
    } else if (arg === '--save') {
      options.save = (args[++i] || '').trim();
    } else if (arg === '--cookie') {
      options.cookie = (args[++i] || '').trim();
    } else if (arg === '--count') {
      options.count = parseInt(args[++i], 10) || 1;
    } else if (arg === '--loop') {
      options.loop = true;
    } else if (arg === '--delay') {
      options.delay = parseFloat(args[++i]) || 3;
    } else if (arg === '--quiet' || arg === '-q') {
      options.quiet = true;
    }
  }

  return options;
}

function logProgress(msg, quiet = false) {
  if (!quiet) {
    console.error(`[*] ${msg}`);
  }
}

function saveAccountToFile(filePath, accountData) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (filePath.endsWith('.json')) {
    let list = [];
    if (fs.existsSync(filePath)) {
      try {
        list = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        if (!Array.isArray(list)) list = [list];
      } catch {
        list = [];
      }
    }
    list.push(accountData);
    fs.writeFileSync(filePath, JSON.stringify(list, null, 2));
  } else {
    const line = `${accountData.email}|${accountData.password}|${accountData.userId}|${accountData.role}|${accountData.pro?.level || 'free'}|${accountData.pro?.expireTimeFormatted || '-'}|${accountData.referral?.referralLink || ''}|${accountData.cookieString}\n`;
    fs.appendFileSync(filePath, line);
  }
}

async function runHealthCheck(client, quiet) {
  logProgress('Running system health check...', quiet);
  const results = {
    capcutWeb: false,
    mailService: false,
    nodeVersion: process.version,
    status: 'degraded'
  };

  try {
    const res = await fetch('https://www.capcut.com/', { method: 'HEAD' });
    results.capcutWeb = res.ok || res.status === 403 || res.status === 200;
  } catch (e) {
    results.capcutWebError = e.message;
  }

  try {
    const testEmail = await createTempEmail();
    const emails = await fetchEmails(testEmail);
    results.mailService = Array.isArray(emails);
  } catch (e) {
    results.mailServiceError = e.message;
  }

  if (results.capcutWeb && results.mailService) {
    results.status = 'healthy';
  }

  return results;
}

async function main() {
  const opts = parseArgs();

  if (!opts.action || opts.action === 'help') {
    printHelp();
    process.exit(opts.action ? 0 : 1);
  }

  const client = new CapCut({ cookie: opts.cookie });

  if (opts.action === 'health') {
    const health = await runHealthCheck(client, opts.quiet);
    console.log(JSON.stringify(health, null, 2));
    process.exit(health.status === 'healthy' ? 0 : 1);
  }

  if (opts.action === 'template') {
    if (!opts.target) {
      console.error('Error: --template requires a URL or Template ID');
      process.exit(1);
    }
    try {
      const data = await client.scrapeTemplate(opts.target, (msg) => logProgress(msg, opts.quiet));
      console.log(JSON.stringify({ status: 'success', template: data }, null, 2));
    } catch (err) {
      console.error(`Error: ${err.message}`);
      console.log(JSON.stringify({ status: 'error', message: err.message }, null, 2));
      process.exit(1);
    }
    return;
  }

  if (opts.action === 'download') {
    if (!opts.target) {
      console.error('Error: --download requires a URL or Template ID');
      process.exit(1);
    }
    try {
      const template = await client.scrapeTemplate(opts.target, (msg) => logProgress(msg, opts.quiet));
      if (!template.videoUrl) {
        throw new Error('No playable video URL found for this template');
      }

      const safeTitle = (template.title || template.templateId || 'video').replace(/[^a-zA-Z0-9_-]/g, '_');
      const outPath = opts.output || path.join(process.cwd(), 'downloads', `${safeTitle}_${template.templateId}.mp4`);

      const dlResult = await client.downloadMedia(template.videoUrl, outPath, (msg) => logProgress(msg, opts.quiet));
      console.log(JSON.stringify({
        status: 'success',
        templateId: template.templateId,
        title: template.title,
        downloadUrl: template.videoUrl,
        savedPath: dlResult.savedPath,
        sizeBytes: dlResult.sizeBytes
      }, null, 2));
    } catch (err) {
      console.error(`Error: ${err.message}`);
      console.log(JSON.stringify({ status: 'error', message: err.message }, null, 2));
      process.exit(1);
    }
    return;
  }

  if (opts.action === 'inspirations') {
    try {
      const insp = await client.scrapeInspirations(null, opts.cookie, (msg) => logProgress(msg, opts.quiet));
      console.log(JSON.stringify({ status: 'success', data: insp }, null, 2));
    } catch (err) {
      console.error(`Error: ${err.message}`);
      console.log(JSON.stringify({ status: 'error', message: err.message }, null, 2));
      process.exit(1);
    }
    return;
  }

  if (opts.action === 'check') {
    if (!opts.cookie) {
      console.error('Error: --check requires a session cookie string');
      process.exit(1);
    }
    try {
      const profile = await client.getFullAccountProfile(opts.cookie, (msg) => logProgress(msg, opts.quiet));
      console.log(JSON.stringify({ status: 'success', profile }, null, 2));
    } catch (err) {
      console.error(`Error: ${err.message}`);
      console.log(JSON.stringify({ status: 'error', message: err.message }, null, 2));
      process.exit(1);
    }
    return;
  }

  if (opts.action === 'claim') {
    if (!opts.target) {
      console.error('Error: --claim requires a referral code, invite link or voucher');
      process.exit(1);
    }
    if (!opts.cookie) {
      console.error('Error: --claim requires --cookie <cookie_string>');
      process.exit(1);
    }
    try {
      const claimResult = await client.claimReferral(opts.target, opts.cookie, (msg) => logProgress(msg, opts.quiet));
      const updatedProfile = await client.getFullAccountProfile(opts.cookie, (msg) => logProgress(msg, opts.quiet));
      console.log(JSON.stringify({
        status: 'success',
        claim: claimResult,
        profile: updatedProfile
      }, null, 2));
    } catch (err) {
      console.error(`Error: ${err.message}`);
      console.log(JSON.stringify({ status: 'error', message: err.message }, null, 2));
      process.exit(1);
    }
    return;
  }

  if (opts.action === 'create-account') {
    const totalRuns = opts.loop ? Infinity : opts.count;
    const accounts = [];
    let iteration = 0;

    while (iteration < totalRuns) {
      iteration++;
      logProgress(`Starting account creation [${iteration}${opts.loop ? '' : '/' + totalRuns}]...`, opts.quiet);

      try {
        const account = await client.registerDisposableAccount({
          referralInput: opts.ref
        }, (msg) => logProgress(msg, opts.quiet));
        accounts.push(account);

        if (opts.save) {
          saveAccountToFile(opts.save, account);
          logProgress(`Saved account credentials to ${opts.save}`, opts.quiet);
        }

        if (totalRuns === 1) {
          console.log(JSON.stringify({ status: 'success', account }, null, 2));
          return;
        }

        logProgress(`Account created: ${account.email} (Role: ${account.role}, Pro: ${account.pro?.level}, ID: ${account.userId})`, opts.quiet);
      } catch (err) {
        logProgress(`Account creation error: ${err.message}`, opts.quiet);
      }

      if (iteration < totalRuns) {
        logProgress(`Sleeping for ${opts.delay}s before next run...`, opts.quiet);
        await new Promise((r) => setTimeout(r, opts.delay * 1000));
      }
    }

    console.log(JSON.stringify({ status: 'success', total: accounts.length, accounts }, null, 2));
  }
}

main().catch((err) => {
  console.error(`Fatal error: ${err.message}`);
  process.exit(1);
});
