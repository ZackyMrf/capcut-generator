# CapCut Automation Bot & Media Scraper Toolkit ⚡

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-20+-43853D?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/JavaScript-ESM-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript" />
  <img src="https://img.shields.io/badge/Platform-capcut.com-000000?style=for-the-badge" alt="Platform" />
  <img src="https://img.shields.io/badge/CLI-Pure_JSON_Output-007ACC?style=for-the-badge&logo=gnubash&logoColor=white" alt="JSON CLI" />
  <img src="https://img.shields.io/badge/Zero--Browser-High--Speed_REST-success?style=for-the-badge" alt="Zero-Browser" />
  <img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="MIT License" />
</p>

High-performance, zero-browser automation toolkit and CLI for **[capcut.com](https://www.capcut.com/)** featuring automated account generation, email OTP verification, referral linking & claim support, Pro expiration tracking, template scraping, watermark-free MP4 video downloading, and AI inspiration feed extraction.

---

## 🚀 Key Highlights

1. **Automated Account Generation & Email OTP Verification**:
   - Automated registration flow via temporary email mailboxes (`glx.web.id`).
   - Requests verification code from CapCut Passport API with native XOR encryption.
   - Automatically polls inbox, retrieves 6-digit OTP code, and finalizes registration.
   - Captures and exports complete session cookies (`sessionid`, `sessionid_ss`, `passport_csrf_token`, `odin_tt`).

2. **Referral Code & Invite Link Claim Support**:
   - Attach an invitation code or referral link when creating accounts via `--ref <code|link>`.
   - Binds `inviter_uid` and `invite_code` during registration (`biz_param`).
   - Claim or redeem referral links and voucher codes on existing accounts via `--claim <code|link>`.

3. **Full Account Profile, Role & Pro Expiration Tracking**:
   - Account role (`owner`, `admin`, `member`).
   - Cloud storage capacity & usage (e.g. 5.00 GB free quota).
   - Pro subscription status with detailed start time (`startTimeFormatted`), expiration date (`expireTimeFormatted`), renewal time (`renewsAtFormatted`), and tier level.

4. **Referral ID & Share Links Extraction**:
   - Automatically extracts and formats:
     - `referralId` / `userId`
     - `referralLink` (CapCut Pro referral & fission share link)
     - `spaceInviteLink` (CapCut team space collaboration invite link)
     - `creatorProfileUrl` (Public creator discover page link)

5. **Template Scraping & Watermark-Free Direct Video Links**:
   - Scrapes template metadata, author profiles, statistics, and related template recommendations directly from CapCut Modern.js SSR / router state.
   - Extracts direct high-definition MP4 URLs (`capcutvod.com` / `tiktokcdn.com`).

6. **Watermark-Free Video Downloader**:
   - Download template videos directly to disk via CLI with progress reporting.

7. **AI Inspiration Feeds & Prompts Scraper**:
   - Extracts trending AI video prompts, effect types, template IDs, cover images, and sample videos from CapCut workspace feeds.

8. **Clean JSON Output to stdout**:
   - All internal progress and diagnostics flow to `stderr`.
   - Structured JSON is printed directly to `stdout` for easy piping to `jq` or external automation pipelines.

---

## 🛠️ Installation & Setup

### Prerequisites
- Node.js 18.0.0 or higher (Node.js 20+ recommended)

### Setup
```bash
git clone <repo-url> /root/capcut
cd /root/capcut
cp .env.example .env
```

---

## 📋 Available Commands & Options

| Command | Description |
|---|---|
| `--health`, `-h` | Runs connectivity health check against CapCut and mail service |
| `--create-account` | Creates an account automatically using disposable email & OTP |
| `--ref <code\|link>` | Attaches referral code or invite link during account creation |
| `--claim <code\|link>` | Claims referral code, invite link, or voucher code for existing cookie |
| `--check <cookie>` | Checks full profile, Pro start/exp, role, storage & referral info |
| `--save <file>` | Appends generated account credentials to JSON or text file |
| `--template <url\|id>` | Scrapes metadata, video link, author info, and related templates |
| `--download <url\|id>` | Scrapes and downloads high-quality MP4 video to disk |
| `--output <path>` | Custom destination path for downloaded media |
| `--inspirations` | Scrapes AI prompts and effect feeds from CapCut workspace |
| `--loop` | Runs account creation continuously in a loop |
| `--count <N>` | Creates N accounts in batch |
| `--delay <seconds>` | Sets delay between iterations (default: 3) |
| `--quiet`, `-q` | Suppresses progress logs on stderr |
| `--help` | Displays command-line help banner |

---

## 💻 CLI Usage Guide

### 1. System Health Check
```bash
node main.js --health
```

---

### 2. Auto Create Account with Referral Code or Invite Link
Create an account bound to a referral link:
```bash
node main.js --create-account --ref "https://www.capcut.com/capcut_pc_web/fission_receive?enter_from=share&user_id=7684160646846891028"
```
Or with an invitation code:
```bash
node main.js --create-account --ref "MY_INVITE_CODE" --save accounts.json
```

---

### 3. Claim Referral on Existing Account
```bash
node main.js --claim "https://www.capcut.com/capcut_pc_web/fission_receive?enter_from=share&user_id=7684160646846891028" --cookie "sessionid=YOUR_SESSION_ID; sessionid_ss=YOUR_SESSION_ID;"
```

---

### 4. Check Account Info, Role, Pro Expiration & Referral Details
```bash
node main.js --check "sessionid=YOUR_SESSION_ID; sessionid_ss=YOUR_SESSION_ID;"
```

Example JSON response:
```json
{
  "status": "success",
  "profile": {
    "userId": "7684160646846891028",
    "secUserId": "MS4wLjABAAAA...",
    "screenName": "user7948009241781",
    "email": "d***0@glx.web.id",
    "role": "owner",
    "isPro": true,
    "pro": {
      "isPro": true,
      "level": "pro",
      "startTime": 1789108096,
      "startTimeFormatted": "2026-09-11 06:28:16",
      "expireTime": 1789712896,
      "expireTimeFormatted": "2026-09-18 06:28:16",
      "renewsAt": null,
      "renewsAtFormatted": null,
      "isAutoRenew": false
    },
    "storage": {
      "quotaBytes": 5368709120,
      "usageBytes": 0,
      "quotaFormatted": "5.00 GB",
      "usageFormatted": "0.00 GB"
    },
    "workspace": {
      "workspaceId": "7684161807962963989",
      "spaceId": "7684161101974209556",
      "name": "user7948009241781’s space",
      "role": "owner",
      "memberCount": 1,
      "memberLimit": 1
    },
    "referral": {
      "referralId": "7684160646846891028",
      "referralLink": "https://www.capcut.com/capcut_pc_web/fission_receive?enter_from=share&user_id=7684160646846891028",
      "spaceInviteLink": "https://www.capcut.com/join-space?space_id=7684161101974209556&workspace_id=7684161807962963989",
      "creatorProfileUrl": "https://www.capcut.com/discover/creator/MS4wLjABAAAA..."
    }
  }
}
```

---

### 5. Scrape Template Details & Video Link
```bash
node main.js --template 7299286607478181121
```

---

### 6. Download Template Video
```bash
node main.js --download 7299286607478181121 --output ./downloads/my_video.mp4
```

---

### 7. Scrape AI Prompts & Video Inspirations
```bash
node main.js --inspirations
```

---

## 🏗️ Architecture & Protocols

1. **Zero-Browser Architecture**: Pure HTTP requests using native Node.js `fetch` without Puppeteer or Playwright.
2. **ByteDance Passport Protocol**: Utilizes XOR encryption (`0x05`) for credential encoding compatible with ByteDance Passport endpoints, supporting `biz_param` for referral binding.
3. **Workspace & Modern.js SSR State Parsing**: Extracts role, storage quota, referral links, and workspace IDs directly from embedded Gateway session states (`__GTW_USER_INFO__` & `__GTW_USER_WORKSPACES__`).
