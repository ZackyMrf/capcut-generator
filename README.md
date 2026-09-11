# CapCut Automation Bot & Media Scraper Toolkit ⚡

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-20+-43853D?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/JavaScript-ESM-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript" />
  <img src="https://img.shields.io/badge/Platform-capcut.com-000000?style=for-the-badge" alt="Platform" />
  <img src="https://img.shields.io/badge/CLI-Pure_JSON_Output-007ACC?style=for-the-badge&logo=gnubash&logoColor=white" alt="JSON CLI" />
  <img src="https://img.shields.io/badge/Zero--Browser-High--Speed_REST-success?style=for-the-badge" alt="Zero-Browser" />
  <img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="MIT License" />
</p>

High-performance, zero-browser automation toolkit and CLI for **[capcut.com](https://www.capcut.com/)** featuring automated account generation, email OTP verification, full account profile inspection (role, storage quota, workspace info), referral links generation, template scraping, watermark-free MP4 video downloading, and AI inspiration feed extraction.

---

## 🚀 Key Highlights

1. **Automated Account Generation & Email OTP Verification**:
   - Automated registration flow via temporary email mailboxes (`glx.web.id`).
   - Requests verification code from CapCut Passport API with native XOR encryption.
   - Automatically polls inbox, retrieves 6-digit OTP code, and finalizes registration.
   - Captures and exports complete session cookies (`sessionid`, `sessionid_ss`, `passport_csrf_token`, `odin_tt`).

2. **Full Account Profile & Role Extraction**:
   - Retrieves complete account metadata upon registration and via `--check`:
     - Account role (`owner`, `admin`, `member`)
     - Cloud storage capacity & usage (e.g. 5.00 GB free quota)
     - Workspace ID, Space ID, and member count
     - Account region, birthday, and Pro status

3. **Referral ID & Invitation Links Extraction**:
   - Automatically extracts and formats:
     - `referralId` / `userId`
     - `referralLink` (CapCut Pro referral & fission share link)
     - `spaceInviteLink` (CapCut team space collaboration invite link)
     - `creatorProfileUrl` (Public creator discover page link)

4. **Template Scraping & Watermark-Free Direct Video Links**:
   - Scrapes template metadata, author profiles, statistics, and related template recommendations directly from CapCut Modern.js SSR / router state.
   - Extracts direct high-definition MP4 URLs (`capcutvod.com` / `tiktokcdn.com`).
   - Supports template IDs, full URLs, and short share links.

5. **Watermark-Free Video Downloader**:
   - Download template videos directly to disk via CLI with progress reporting.

6. **AI Inspiration Feeds & Prompts Scraper**:
   - Extracts trending AI video prompts, effect types, template IDs, cover images, and sample videos from CapCut workspace feeds.

7. **Clean JSON Output to stdout**:
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
| `--save <file>` | Appends generated account credentials to JSON or text file |
| `--check <cookie>` | Checks full profile, role, storage quota & referral info with cookie |
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
```json
{
  "capcutWeb": true,
  "mailService": true,
  "nodeVersion": "v20.20.2",
  "status": "healthy"
}
```

---

### 2. Auto Create Account with Role & Referral ID
Create an account on-the-fly:
```bash
node main.js --create-account
```
Save to a JSON file:
```bash
node main.js --create-account --save accounts.json
```
Batch creation:
```bash
node main.js --create-account --count 5 --delay 3 --save accounts.json
```

Example JSON response:
```json
{
  "status": "success",
  "account": {
    "email": "user123456@glx.web.id",
    "password": "Cc9!examplePass",
    "userId": "7684163280726574101",
    "screenName": "user3683794077417",
    "avatarUrl": "https://sf16-passport-sg.ibytedtos.com/obj/user-avatar-alisg/example.png",
    "secUserId": "MS4wLjABAAAA...",
    "role": "owner",
    "isPro": false,
    "storage": {
      "quotaBytes": 5368709120,
      "usageBytes": 0,
      "quotaFormatted": "5.00 GB",
      "usageFormatted": "0.00 GB"
    },
    "workspace": {
      "workspaceId": "7684163353941540885",
      "spaceId": "7684162534710461460",
      "name": "user3683794077417’s space",
      "role": "owner",
      "memberCount": 1,
      "memberLimit": 1
    },
    "referral": {
      "referralId": "7684163280726574101",
      "userId": "7684163280726574101",
      "secUserId": "MS4wLjABAAAA...",
      "workspaceId": "7684163353941540885",
      "spaceId": "7684162534710461460",
      "referralLink": "https://www.capcut.com/capcut_pc_web/fission_receive?enter_from=share&user_id=7684163280726574101",
      "spaceInviteLink": "https://www.capcut.com/join-space?space_id=7684162534710461460&workspace_id=7684163353941540885",
      "creatorProfileUrl": "https://www.capcut.com/discover/creator/MS4wLjABAAAA..."
    },
    "cookieString": "sessionid=...; sessionid_ss=...; passport_csrf_token=...;"
  }
}
```

---

### 3. Check Account Info, Role & Referral Details
```bash
node main.js --check "sessionid=YOUR_SESSION_ID; sessionid_ss=YOUR_SESSION_ID;"
```

---

### 4. Scrape Template Details & Video Link
```bash
node main.js --template 7299286607478181121
```

---

### 5. Download Template Video
```bash
node main.js --download 7299286607478181121 --output ./downloads/my_video.mp4
```

---

### 6. Scrape AI Prompts & Video Inspirations
```bash
node main.js --inspirations
```

---

## 🏗️ Architecture & Protocols

1. **Zero-Browser Architecture**: Pure HTTP requests using native Node.js `fetch` without Puppeteer or Playwright.
2. **ByteDance Passport Protocol**: Utilizes XOR encryption (`0x05`) for credential encoding compatible with ByteDance Passport endpoints.
3. **Workspace & Modern.js SSR State Parsing**: Extracts role, storage quota, referral links, and workspace IDs directly from embedded Gateway session states (`__GTW_USER_INFO__` & `__GTW_USER_WORKSPACES__`).
