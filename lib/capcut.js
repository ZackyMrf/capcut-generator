import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createTempEmail, waitForVerificationCode } from './mail.js';

export function encryptToTargetHex(input) {
  let hexResult = '';
  for (const char of String(input)) {
    const encryptedCharCode = char.charCodeAt(0) ^ 0x05;
    hexResult += encryptedCharCode.toString(16).padStart(2, '0');
  }
  return hexResult;
}

export function generateSecurePassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*';
  let pass = 'Cc9!';
  for (let i = 0; i < 10; i++) {
    pass += chars[crypto.randomBytes(1)[0] % chars.length];
  }
  return pass;
}

export function generateRandomBirthday() {
  const start = new Date(1992, 0, 1).getTime();
  const end = new Date(2003, 11, 31).getTime();
  const d = new Date(start + Math.random() * (end - start));
  return d.toISOString().split('T')[0];
}

export class CapCut {
  constructor(options = {}) {
    this.apiBase = options.apiBase || process.env.CAPCUT_API_BASE || 'https://www.capcut.com';
    this.userAgent = options.userAgent || process.env.USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    this.aid = options.aid || '348188';
    this.cookie = options.cookie || '';
  }

  setCookie(cookie) {
    this.cookie = cookie;
  }

  buildHeaders(extraHeaders = {}) {
    const headers = {
      'User-Agent': this.userAgent,
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
      ...extraHeaders
    };
    if (this.cookie) {
      headers['Cookie'] = this.cookie;
    }
    return headers;
  }

  parseCookiesFromHeaders(res) {
    let setCookieHeaders = [];
    if (typeof res.headers.getSetCookie === 'function') {
      setCookieHeaders = res.headers.getSetCookie();
    } else {
      const raw = res.headers.get('set-cookie');
      if (raw) {
        setCookieHeaders = [raw];
      }
    }

    const cookies = {};
    for (const header of setCookieHeaders) {
      const parts = header.split(';')[0].split('=');
      const key = parts[0]?.trim();
      const val = parts.slice(1).join('=').trim();
      if (key) {
        cookies[key] = val;
      }
    }
    return cookies;
  }

  formatCookieString(cookiesObj) {
    return Object.entries(cookiesObj)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }

  async sendVerificationCode(email, password) {
    const encryptedEmail = encryptToTargetHex(email);
    const encryptedPassword = encryptToTargetHex(password);

    const url = new URL(`${this.apiBase}/passport/web/email/send_code/`);
    url.searchParams.append('aid', this.aid);
    url.searchParams.append('account_sdk_source', 'web');
    url.searchParams.append('language', 'en');
    url.searchParams.append('verifyFp', 'verify_m7euzwhw_PNtb4tlY_I0az_4me0_9Hrt_sEBZgW5GGPdn');
    url.searchParams.append('check_region', '1');

    const formData = new URLSearchParams();
    formData.append('mix_mode', '1');
    formData.append('email', encryptedEmail);
    formData.append('password', encryptedPassword);
    formData.append('type', '34');
    formData.append('fixed_mix_mode', '1');

    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: this.buildHeaders({
        'Content-Type': 'application/x-www-form-urlencoded'
      }),
      body: formData
    });

    const json = await res.json();
    if (json.message !== 'success') {
      throw new Error(`Failed to send verification code: ${json.message || JSON.stringify(json)}`);
    }
    return json;
  }

  async registerVerifyLogin(email, password, code, options = {}) {
    const encryptedEmail = encryptToTargetHex(email);
    const encryptedPassword = encryptToTargetHex(password);
    const encryptedCode = encryptToTargetHex(code);

    const birthday = options.birthday || generateRandomBirthday();
    const region = options.region || 'ID';

    const url = new URL(`${this.apiBase}/passport/web/email/register_verify_login/`);
    url.searchParams.append('aid', this.aid);
    url.searchParams.append('account_sdk_source', 'web');
    url.searchParams.append('language', 'en');
    url.searchParams.append('verifyFp', 'verify_m7euzwhw_PNtb4tlY_I0az_4me0_9Hrt_sEBZgW5GGPdn');
    url.searchParams.append('check_region', '1');

    const formData = new URLSearchParams();
    formData.append('mix_mode', '1');
    formData.append('email', encryptedEmail);
    formData.append('code', encryptedCode);
    formData.append('password', encryptedPassword);
    formData.append('type', '34');
    formData.append('birthday', birthday);
    formData.append('force_user_region', region);
    formData.append('biz_param', '%7B%7D');
    formData.append('check_region', '1');
    formData.append('fixed_mix_mode', '1');

    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: this.buildHeaders({
        'Content-Type': 'application/x-www-form-urlencoded'
      }),
      body: formData
    });

    const json = await res.json();
    if (json.message !== 'success' || !json.data) {
      throw new Error(`Failed to verify and register: ${json.message || JSON.stringify(json)}`);
    }

    const cookies = this.parseCookiesFromHeaders(res);
    const cookieString = this.formatCookieString(cookies);
    if (cookieString) {
      this.setCookie(cookieString);
    }

    return {
      data: json.data,
      cookies,
      cookieString
    };
  }

  async getUserInfo(cookieString = null) {
    const headers = this.buildHeaders();
    if (cookieString) {
      headers['Cookie'] = cookieString;
    }

    const url = `${this.apiBase}/passport/web/account/info/?aid=${this.aid}`;
    const res = await fetch(url, { headers });
    const json = await res.json();
    if (json.message !== 'success' || !json.data) {
      throw new Error(`Failed to retrieve account info: ${json.message || 'Unknown error'}`);
    }
    return json.data;
  }

  async registerDisposableAccount(options = {}, progressCb = () => {}) {
    const password = options.password || generateSecurePassword();

    progressCb('Creating temporary email address...');
    const email = options.email || (await createTempEmail());
    progressCb(`Generated email: ${email}`);

    progressCb(`Requesting verification code from CapCut for ${email}...`);
    await this.sendVerificationCode(email, password);
    progressCb('Verification code request sent successfully.');

    progressCb('Waiting for verification code in inbox...');
    const timeout = options.timeoutMs || 60000;
    const code = await waitForVerificationCode(email, timeout);
    progressCb(`Received verification code: ${code}`);

    progressCb('Registering and authenticating account...');
    const regResult = await this.registerVerifyLogin(email, password, code, options);

    progressCb('Fetching user profile info...');
    let userInfo = null;
    try {
      userInfo = await this.getUserInfo(regResult.cookieString);
    } catch {
      userInfo = regResult.data;
    }

    progressCb('Account creation completed successfully.');
    return {
      email,
      password,
      userId: regResult.data.user_id_str || String(regResult.data.user_id),
      screenName: regResult.data.screen_name || regResult.data.name || '',
      avatarUrl: regResult.data.avatar_url || '',
      secUserId: regResult.data.sec_user_id || '',
      cookieString: regResult.cookieString,
      sessionCookies: regResult.cookies,
      userInfo
    };
  }

  normalizeTemplateUrl(input) {
    const str = String(input).trim();
    if (/^\d+$/.test(str)) {
      return `${this.apiBase}/template-detail/${str}`;
    }
    if (!/^https?:\/\//i.test(str)) {
      return `${this.apiBase}/template-detail/${str}`;
    }
    return str;
  }

  async scrapeTemplate(urlOrId, progressCb = () => {}) {
    const targetUrl = this.normalizeTemplateUrl(urlOrId);
    progressCb(`Scraping template from: ${targetUrl}`);

    const res = await fetch(targetUrl, {
      headers: this.buildHeaders({
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
      }),
      redirect: 'follow'
    });

    if (!res.ok) {
      throw new Error(`Failed to load template page: HTTP ${res.status}`);
    }

    const html = await res.text();
    const match = html.match(/<script type="application\/json" id="__MODERN_ROUTER_DATA__">([\s\S]*?)<\/script>/);
    if (!match) {
      throw new Error('Failed to find Modern.js router data in CapCut page response');
    }

    const routerData = JSON.parse(match[1]);
    const loaderData = routerData?.loaderData || {};
    const detailRoute = loaderData['template-detail_$'] || {};
    const rawTemplate = detailRoute.templateDetail || detailRoute.template || {};

    const templateId = rawTemplate.templateId || detailRoute.templateId || '';
    const title = rawTemplate.title || rawTemplate.tagTitle || '';
    const desc = rawTemplate.desc || '';
    const videoUrl = rawTemplate.videoUrl || '';
    const coverUrl = rawTemplate.coverUrl || '';
    const videoRatio = rawTemplate.videoRatio || '9:16';
    const videoWidth = rawTemplate.videoWidth || 0;
    const videoHeight = rawTemplate.videoHeight || 0;
    const duration = rawTemplate.duration || rawTemplate.templateDuration || 0;

    const stats = {
      usageAmount: rawTemplate.usageAmount || 0,
      likeAmount: rawTemplate.likeAmount || 0,
      playAmount: rawTemplate.playAmount || 0,
      segmentAmount: rawTemplate.segmentAmount || 0,
      commentAmount: rawTemplate.commentAmount || 0
    };

    const author = {
      name: rawTemplate.author?.name || '',
      avatarUrl: rawTemplate.author?.avatarUrl || '',
      description: rawTemplate.author?.description || '',
      profileUrl: rawTemplate.author?.profileUrl || '',
      secUid: rawTemplate.author?.secUid || '',
      uid: rawTemplate.author?.uid || 0
    };

    const recommendList = Array.isArray(detailRoute.recommendList)
      ? detailRoute.recommendList.map((item) => ({
          templateId: item.templateId || '',
          title: item.title || '',
          desc: item.desc || '',
          coverUrl: item.coverUrl || '',
          videoUrl: item.videoUrl || '',
          usageAmount: item.usageAmount || 0,
          likeAmount: item.likeAmount || 0,
          canonicalPath: item.canonicalPath ? `${this.apiBase}${item.canonicalPath}` : ''
        }))
      : [];

    return {
      templateId,
      title,
      desc,
      videoUrl,
      coverUrl,
      videoRatio,
      dimensions: {
        width: videoWidth,
        height: videoHeight
      },
      durationMs: duration,
      stats,
      author,
      recommendList,
      sourceUrl: res.url || targetUrl
    };
  }

  async scrapeInspirations(categoryKey = null, cookieString = null, progressCb = () => {}) {
    progressCb('Fetching CapCut workspace inspirations...');
    const headers = this.buildHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    });
    if (cookieString) {
      headers['Cookie'] = cookieString;
    }

    const res = await fetch(`${this.apiBase}/my-edit`, { headers, redirect: 'follow' });
    if (!res.ok) {
      throw new Error(`Failed to load CapCut workspace: HTTP ${res.status}`);
    }

    const html = await res.text();
    const match = html.match(/<script type="application\/json" id="__MODERN_ROUTER_DATA__">([\s\S]*?)<\/script>/);
    if (!match) {
      throw new Error('Failed to find Modern.js router data in workspace response');
    }

    const routerData = JSON.parse(match[1]);
    const state = routerData?.loaderData?.['main_my-edit/page']?.myEditInitialState || {};
    const categories = state.inspirationCategories || [];
    const feedsByCategory = state.inspirationFeedsByCategory || {};
    const topChoice = state.topChoice?.bannerResources || [];

    const formattedFeeds = [];
    for (const [catId, feedData] of Object.entries(feedsByCategory)) {
      const list = Array.isArray(feedData?.list) ? feedData.list : [];
      for (const item of list) {
        const ed = item.effect_data || {};
        formattedFeeds.push({
          categoryId: catId,
          effectType: item.effect_type,
          templateId: ed.template_id || '',
          title: ed.title || '',
          prompt: ed.prompt || '',
          videoUrl: ed.video_url || '',
          coverUrl: ed.cover_url || ''
        });
      }
    }

    return {
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        key: c.key
      })),
      topChoice: topChoice.map((b) => ({
        name: b.func_name,
        type: b.material_type,
        url: b.func_url
      })),
      feeds: formattedFeeds
    };
  }

  async downloadMedia(mediaUrl, targetPath, progressCb = () => {}) {
    progressCb(`Downloading media from ${mediaUrl}...`);
    const res = await fetch(mediaUrl, {
      headers: {
        'User-Agent': this.userAgent,
        'Referer': this.apiBase
      }
    });

    if (!res.ok) {
      throw new Error(`Failed to download media: HTTP ${res.status}`);
    }

    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(targetPath, buffer);

    progressCb(`Successfully saved to ${targetPath} (${buffer.length} bytes)`);
    return {
      savedPath: targetPath,
      sizeBytes: buffer.length
    };
  }
}
