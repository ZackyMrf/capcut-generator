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

export function formatTimestamp(ts) {
  if (!ts) return null;
  const num = typeof ts === 'number' ? ts : parseInt(ts, 10);
  if (isNaN(num) || num <= 0) return null;
  const ms = num < 1e11 ? num * 1000 : num;
  const d = new Date(ms);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().replace('T', ' ').substring(0, 19);
}

export class CapCut {
  constructor(options = {}) {
    this.apiBase = options.apiBase || process.env.CAPCUT_API_BASE || 'https://www.capcut.com';
    this.editApiBase = options.editApiBase || process.env.CAPCUT_EDIT_API_BASE || 'https://edit-api-sg.capcut.com';
    this.commerceApiBase = options.commerceApiBase || 'https://commerce-api-sg.capcut.com';
    this.feedApiBase = options.feedApiBase || 'https://feed-api-sg.capcut.com';
    this.userAgent = options.userAgent || process.env.USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    this.aid = options.aid || '348188';
    this.cookie = options.cookie || '';
  }

  generateFeedSign(url, pf = 0, timestamp = null) {
    const ts = timestamp || Math.floor(Date.now() / 1000);
    const raw = `9e2c|${url.slice(-7)}|${pf}||${ts}||11ac`;
    const sign = crypto.createHash('md5').update(raw).digest('hex');
    return { sign, deviceTime: ts };
  }

  getFeedHeaders(path, cookieString = null, extraHeaders = {}) {
    const effectiveCookie = cookieString || this.cookie;
    const { sign, deviceTime } = this.generateFeedSign(path, 0);
    return {
      'Content-Type': 'application/json',
      'Cookie': effectiveCookie,
      'sign': sign,
      'sign-ver': '1',
      'device-time': String(deviceTime),
      'pf': '0',
      'loc': 'SG',
      'app-sdk-version': '100.0.0',
      'User-Agent': this.userAgent,
      ...extraHeaders
    };
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

  buildWorkspaceHeaders(cookieString = null, extraHeaders = {}) {
    const effectiveCookie = cookieString || this.cookie;
    return this.buildHeaders({
      'Cookie': effectiveCookie,
      'Content-Type': 'application/json',
      'loc': 'sg',
      'lan': 'en',
      'pf': '7',
      'sign-ver': '1',
      ...extraHeaders
    });
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

    let bizParam = '%7B%7D';
    if (options.inviteCode || options.inviterUserId) {
      const bizObj = {};
      if (options.inviteCode) bizObj.invite_code = options.inviteCode;
      if (options.inviterUserId) bizObj.inviter_uid = options.inviterUserId;
      bizObj.enter_from = 'share';
      bizParam = encodeURIComponent(JSON.stringify(bizObj));
    }

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
    formData.append('biz_param', bizParam);
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

  async getFullAccountProfile(cookieString = null, progressCb = () => {}) {
    const effectiveCookie = cookieString || this.cookie;
    if (!effectiveCookie) {
      throw new Error('Cookie string is required to retrieve full account profile');
    }

    progressCb('Querying passport account details...');
    let passportData = null;
    try {
      passportData = await this.getUserInfo(effectiveCookie);
    } catch {}

    progressCb('Querying workspace, role and referral details from CapCut...');
    const headers = this.buildHeaders({
      'Cookie': effectiveCookie,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    });

    const res = await fetch(`${this.apiBase}/my-edit`, { headers, redirect: 'follow' });
    let gtwUser = null;
    let gtwWorkspaces = [];

    if (res.ok) {
      const html = await res.text();
      const uMatch = html.match(/<script id="__GTW_USER_INFO__"[^>]*>([\s\S]*?)<\/script>/);
      const wMatch = html.match(/<script id="__GTW_USER_WORKSPACES__"[^>]*>([\s\S]*?)<\/script>/);

      if (uMatch) {
        try {
          const outer = JSON.parse(uMatch[1]);
          const inner = JSON.parse(outer.__userInfoStringify);
          gtwUser = inner?.data;
        } catch {}
      }

      if (wMatch) {
        try {
          const outer = JSON.parse(wMatch[1]);
          const inner = JSON.parse(outer.__userWorkspaces);
          gtwWorkspaces = inner?.data?.workspace_infos || [];
        } catch {}
      }
    }

    const primaryWorkspace = gtwWorkspaces[0] || {};
    const gtwUserInfo = gtwUser?.user_info || {};
    const spaceInfo = gtwUser?.space_info || {};
    const subscribeInfo = gtwUser?.subscribe_info || {};
    const workspaceSubInfo = gtwUser?.workspace_subscribe_info || {};

    const userId = passportData?.user_id_str || String(passportData?.user_id || '') || gtwUserInfo.user_id || '';
    const secUserId = passportData?.sec_user_id || gtwUserInfo.sec_user_id || '';
    const screenName = passportData?.screen_name || gtwUserInfo.nick_name || '';
    const email = passportData?.email || gtwUserInfo.email || gtwUserInfo.bind_email || '';
    const role = primaryWorkspace.role || 'owner';
    const workspaceId = primaryWorkspace.workspace_id || spaceInfo.workspace_id || '';
    const spaceId = primaryWorkspace.space_id || spaceInfo.space_id || '';
    const quotaBytes = primaryWorkspace.quota || 5368709120;
    const usageBytes = primaryWorkspace.usage || 0;

    const quotaGb = (quotaBytes / (1024 ** 3)).toFixed(2);
    const usageGb = (usageBytes / (1024 ** 3)).toFixed(2);

    const isPro = Boolean(subscribeInfo.flag || workspaceSubInfo.flag);
    let proLevel = 'free';
    if (workspaceSubInfo.flag) {
      proLevel = 'teams';
    } else if (subscribeInfo.flag) {
      proLevel = subscribeInfo.cur_vip_level || subscribeInfo.vip_level || 'vip';
    }

    const startTs = subscribeInfo.vipRealStart || subscribeInfo.start_time || workspaceSubInfo.start_time || null;
    const endTs = subscribeInfo.vipRealEnd || subscribeInfo.end_time || workspaceSubInfo.end_time || null;
    const renewTs = subscribeInfo.renewalTime || subscribeInfo.renew_time || null;

    const proDetails = {
      isPro,
      level: proLevel,
      startTime: startTs,
      startTimeFormatted: formatTimestamp(startTs),
      expireTime: endTs,
      expireTimeFormatted: formatTimestamp(endTs),
      renewsAt: renewTs,
      renewsAtFormatted: formatTimestamp(renewTs),
      isAutoRenew: Boolean(renewTs),
      rawSubscription: subscribeInfo
    };

    const referral = {
      referralId: userId,
      userId,
      secUserId,
      workspaceId,
      spaceId,
      referralLink: userId ? `${this.apiBase}/capcut_pc_web/fission_receive?enter_from=share&user_id=${userId}` : '',
      spaceInviteLink: spaceId && workspaceId ? `${this.apiBase}/join-space?space_id=${spaceId}&workspace_id=${workspaceId}` : '',
      creatorProfileUrl: secUserId ? `${this.apiBase}/discover/creator/${secUserId}` : ''
    };

    return {
      userId,
      secUserId,
      screenName,
      email,
      role,
      isPro,
      pro: proDetails,
      isNewUser: Boolean(gtwUserInfo.is_new_user ?? passportData?.new_user),
      region: primaryWorkspace.region || gtwUser?.location?.code || 'SG',
      birthday: gtwUserInfo.capcut_birthday || gtwUserInfo.age_gate_birthay || '',
      storage: {
        quotaBytes,
        usageBytes,
        quotaFormatted: `${quotaGb} GB`,
        usageFormatted: `${usageGb} GB`
      },
      workspace: {
        workspaceId,
        spaceId,
        name: primaryWorkspace.name || `${screenName}’s space`,
        role,
        memberCount: primaryWorkspace.member_cnt || 1,
        memberLimit: primaryWorkspace.member_limit || 1
      },
      referral,
      accountInfo: passportData
    };
  }

  async claimReferral(referralInput, cookieString = null, progressCb = () => {}) {
    const effectiveCookie = cookieString || this.cookie;
    if (!effectiveCookie) {
      throw new Error('Cookie string is required to claim referral');
    }

    const input = String(referralInput || '').replace(/[\r\n\t\s]+/g, '').trim();
    let inviteCode = input;
    let inviterUserId = null;
    let isUrl = false;

    if (input.startsWith('http://') || input.startsWith('https://')) {
      isUrl = true;
      try {
        const parsed = new URL(input);
        const codeParam = parsed.searchParams.get('code') || parsed.searchParams.get('invite_code');
        const userParam = parsed.searchParams.get('user_id') || parsed.searchParams.get('inviter_uid');
        if (codeParam) inviteCode = codeParam;
        if (userParam) inviterUserId = userParam;
      } catch {}
    } else if (/^\d{15,25}$/.test(input)) {
      inviterUserId = input;
    }

    const results = {
      input,
      parsedCode: inviteCode,
      inviterUserId,
      actions: []
    };

    const targetUrl = isUrl
      ? input
      : inviterUserId
        ? `${this.apiBase}/capcut_pc_web/fission_receive?enter_from=share&user_id=${inviterUserId}`
        : `${this.apiBase}/capcut_pc_web/fission_receive?enter_from=share&code=${encodeURIComponent(inviteCode)}`;

    progressCb(`Visiting referral endpoint ${targetUrl}...`);
    try {
      const res = await fetch(targetUrl, {
        headers: this.buildHeaders({ 'Cookie': effectiveCookie }),
        redirect: 'follow'
      });
      results.actions.push({
        action: 'visit_referral_link',
        targetUrl,
        status: res.status,
        success: res.ok
      });
    } catch (e) {
      results.actions.push({
        action: 'visit_referral_link',
        targetUrl,
        success: false,
        error: e.message
      });
    }

    if (inviterUserId) {
      progressCb(`Submitting referral binding for inviter user ${inviterUserId}...`);
      try {
        const rwRes = await fetch(`${this.commerceApiBase}/luckycat/i18n/capcut/campaign/v1/mur101/redeem_reward`, {
          method: 'POST',
          headers: this.buildHeaders({
            'Cookie': effectiveCookie,
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify({ inviter_uid: inviterUserId, user_id: inviterUserId })
        });
        const rwData = await rwRes.json();
        results.actions.push({
          action: 'bind_inviter_user',
          success: rwData.err_no === 0,
          data: rwData
        });
      } catch (e) {
        results.actions.push({
          action: 'bind_inviter_user',
          success: false,
          error: e.message
        });
      }
    }

    if (inviteCode && !isUrl) {
      progressCb(`Attempting VIP redemption recharge for code ${inviteCode}...`);
      try {
        const rcRes = await fetch(`${this.commerceApiBase}/commerce/v1/vip/outside/code_recharge`, {
          method: 'POST',
          headers: this.buildHeaders({
            'Cookie': effectiveCookie,
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify({ code: inviteCode })
        });
        const rcData = await rcRes.json();
        results.actions.push({
          action: 'code_recharge',
          success: rcData.ret === '0',
          data: rcData
        });
      } catch (e) {
        results.actions.push({
          action: 'code_recharge',
          success: false,
          error: e.message
        });
      }

      progressCb(`Attempting campaign reward redeem for code ${inviteCode}...`);
      try {
        const rwRes = await fetch(`${this.commerceApiBase}/luckycat/i18n/capcut/campaign/v1/mur101/redeem_reward`, {
          method: 'POST',
          headers: this.buildHeaders({
            'Cookie': effectiveCookie,
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify({ invite_code: inviteCode })
        });
        const rwData = await rwRes.json();
        results.actions.push({
          action: 'redeem_reward',
          success: rwData.err_no === 0,
          data: rwData
        });
      } catch (e) {
        results.actions.push({
          action: 'redeem_reward',
          success: false,
          error: e.message
        });
      }
    }

    progressCb('Referral claim operations completed.');
    return results;
  }

  async getTrial7d(cookieString = null, options = {}, progressCb = () => {}) {
    const effectiveCookie = cookieString || this.cookie;
    if (!effectiveCookie) {
      throw new Error('Cookie string is required to get 7-day trial');
    }

    const actions = [];
    let token = options.token || options.code || null;

    progressCb('Checking fission 7-day Pro activity validity on web...');
    try {
      const validHeaders = this.getFeedHeaders('/lv/v1/pc/share/is_activity_valid', effectiveCookie);
      const validRes = await fetch(`${this.feedApiBase}/lv/v1/pc/share/is_activity_valid`, {
        method: 'POST',
        headers: validHeaders,
        body: JSON.stringify({})
      });
      const validJson = await validRes.json();
      actions.push({
        action: 'is_activity_valid',
        success: validJson.ret === '0',
        data: validJson.data
      });
    } catch (e) {
      actions.push({
        action: 'is_activity_valid',
        success: false,
        error: e.message
      });
    }

    if (!token) {
      progressCb('Generating fission 7-day Pro invitation token...');
      try {
        const tokenHeaders = this.getFeedHeaders('/lv/v1/pc/share/token_gen', effectiveCookie);
        const tokenRes = await fetch(`${this.feedApiBase}/lv/v1/pc/share/token_gen`, {
          method: 'POST',
          headers: tokenHeaders,
          body: JSON.stringify({})
        });
        const tokenJson = await tokenRes.json();
        if (tokenJson?.data?.token) {
          token = tokenJson.data.token;
        }
        actions.push({
          action: 'token_gen',
          success: tokenJson.ret === '0',
          token
        });
      } catch (e) {
        actions.push({
          action: 'token_gen',
          success: false,
          error: e.message
        });
      }
    }

    const targetCode = token || options.refCode || options.inviteCode || '';
    if (targetCode) {
      progressCb(`Claiming web fission trial endpoint with code: ${targetCode}...`);
      try {
        const fissionUrl = `${this.apiBase}/capcut_pc_web/fission_receive?code=${encodeURIComponent(targetCode)}&lng=en`;
        const fRes = await fetch(fissionUrl, {
          headers: this.buildHeaders({ 'Cookie': effectiveCookie }),
          redirect: 'follow'
        });
        actions.push({
          action: 'visit_fission_receive',
          url: fissionUrl,
          status: fRes.status,
          success: fRes.ok
        });
      } catch (e) {
        actions.push({
          action: 'visit_fission_receive',
          success: false,
          error: e.message
        });
      }
    }

    if (options.userId || options.inviterUid) {
      const uid = options.inviterUid || options.userId;
      progressCb(`Visiting referral fission share link for user: ${uid}...`);
      try {
        const userUrl = `${this.apiBase}/capcut_pc_web/fission_receive?enter_from=share&user_id=${uid}`;
        const uRes = await fetch(userUrl, {
          headers: this.buildHeaders({ 'Cookie': effectiveCookie }),
          redirect: 'follow'
        });
        actions.push({
          action: 'visit_fission_user',
          url: userUrl,
          status: uRes.status,
          success: uRes.ok
        });
      } catch (e) {
        actions.push({
          action: 'visit_fission_user',
          success: false,
          error: e.message
        });
      }
    }

    progressCb('Triggering web direct VIP start activation...');
    try {
      const actRes = await fetch(`${this.commerceApiBase}/commerce/v1/vip/outside/start_activation`, {
        method: 'POST',
        headers: this.buildWorkspaceHeaders(effectiveCookie),
        body: JSON.stringify({ aid: Number(this.aid), scene: 'vip' })
      });
      const actJson = await actRes.json();
      actions.push({
        action: 'start_activation',
        success: actJson.ret === '0',
        data: actJson
      });
    } catch (e) {
      actions.push({
        action: 'start_activation',
        success: false,
        error: e.message
      });
    }

    progressCb('Triggering campaign benefits and coldstart rewards...');
    try {
      const coldRes = await fetch(`${this.commerceApiBase}/luckycat/i18n/capcut/campaign/v1/coldstart_popup?scene=web&entrance=&aid=${this.aid}`, {
        method: 'GET',
        headers: this.buildHeaders({ 'Cookie': effectiveCookie })
      });
      const coldJson = await coldRes.json();
      actions.push({
        action: 'coldstart_popup',
        success: coldJson.err_no === 0,
        data: coldJson.data
      });
    } catch (e) {
      actions.push({
        action: 'coldstart_popup',
        success: false,
        error: e.message
      });
    }

    if (options.referralInput || options.inviteCode || targetCode) {
      const codeOrUid = options.referralInput || options.inviteCode || targetCode;
      try {
        const rwRes = await fetch(`${this.commerceApiBase}/luckycat/i18n/capcut/campaign/v1/mur101/redeem_reward`, {
          method: 'POST',
          headers: this.buildHeaders({
            'Cookie': effectiveCookie,
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify({
            inviter_uid: options.inviterUid || options.userId || '',
            user_id: options.inviterUid || options.userId || '',
            invite_code: codeOrUid
          })
        });
        const rwJson = await rwRes.json();
        actions.push({
          action: 'mur101_redeem_reward',
          success: rwJson.err_no === 0,
          data: rwJson
        });
      } catch (e) {
        actions.push({
          action: 'mur101_redeem_reward',
          success: false,
          error: e.message
        });
      }
    }

    progressCb('Syncing web subscription user status...');
    try {
      const userSubRes = await fetch(`${this.commerceApiBase}/commerce/v1/subscription/user_info`, {
        method: 'POST',
        headers: this.buildWorkspaceHeaders(effectiveCookie),
        body: JSON.stringify({ aid: Number(this.aid), scene: 'vip', from_db: false })
      });
      const userSubJson = await userSubRes.json();
      actions.push({
        action: 'subscription_user_info',
        success: userSubJson.ret === '0',
        data: userSubJson.response ? JSON.parse(userSubJson.response) : userSubJson.data
      });
    } catch (e) {
      actions.push({
        action: 'subscription_user_info',
        success: false,
        error: e.message
      });
    }

    progressCb('Initiating web third-party free trial subscription...');
    try {
      const trialRes = await fetch(`${this.commerceApiBase}/pipo/v2/subscription/third_party/free_trial_make_order`, {
        method: 'POST',
        headers: this.buildWorkspaceHeaders(effectiveCookie),
        body: JSON.stringify({
          aid: Number(this.aid),
          region: options.region || 'SG',
          user_create_time: Math.floor(Date.now() / 1000),
          payment_method: 'free_trial'
        })
      });
      const trialJson = await trialRes.json();
      actions.push({
        action: 'free_trial_make_order',
        success: trialJson.ret === '0',
        data: trialJson
      });
    } catch (e) {
      actions.push({
        action: 'free_trial_make_order',
        success: false,
        error: e.message
      });
    }

    progressCb('Querying user fission trial rights and balance...');
    let rightsData = null;
    try {
      const rightsHeaders = this.getFeedHeaders('/lv/v1/pc/share/get_user_rights', effectiveCookie);
      const rightsRes = await fetch(`${this.feedApiBase}/lv/v1/pc/share/get_user_rights`, {
        method: 'POST',
        headers: rightsHeaders,
        body: JSON.stringify({})
      });
      const rightsJson = await rightsRes.json();
      rightsData = rightsJson.data;
      actions.push({
        action: 'get_user_rights',
        success: rightsJson.ret === '0',
        data: rightsData
      });
    } catch (e) {
      actions.push({
        action: 'get_user_rights',
        success: false,
        error: e.message
      });
    }

    progressCb('Querying final profile and Pro subscription status...');
    let profile = null;
    try {
      profile = await this.getFullAccountProfile(effectiveCookie, progressCb);
    } catch {
      profile = null;
    }

    const fissionVipDays = rightsData?.fission_vip_days || 0;
    const fissionContributorCount = rightsData?.fission_contributor_count || 0;

    return {
      success: true,
      token,
      shareLink: token ? `${this.apiBase}/capcut_pc_web/fission_receive?code=${token}&lng=en` : '',
      fissionVipDays,
      fissionContributorCount,
      isPro: profile?.isPro || false,
      pro: profile?.pro || null,
      profile,
      actions
    };
  }

  async getWorkspaceInfoByInviteLink(inviteInput, cookieString = null) {
    const effectiveCookie = cookieString || this.cookie;
    const cleanInput = String(inviteInput || '').replace(/[\r\n\t\s]+/g, '').trim();
    const url = `${this.editApiBase}/cc/v1/workspace/get_workspace_info_by_invitation_link`;
    const res = await fetch(url, {
      method: 'POST',
      headers: this.buildWorkspaceHeaders(effectiveCookie),
      body: JSON.stringify({
        invitation_link: cleanInput
      })
    });
    return await res.json();
  }

  async joinWorkspace(inviteInput, cookieString = null, progressCb = () => {}) {
    const effectiveCookie = cookieString || this.cookie;
    if (!effectiveCookie) {
      throw new Error('Cookie string is required to join workspace');
    }

    const cleanInput = String(inviteInput || '').replace(/[\r\n\t\s]+/g, '').trim();
    let invitationLink = cleanInput;
    let workspaceId = '';
    let spaceId = '';
    let code = '';

    if (cleanInput.startsWith('http://') || cleanInput.startsWith('https://')) {
      try {
        const u = new URL(cleanInput);
        workspaceId = u.searchParams.get('workspace_id') || '';
        spaceId = u.searchParams.get('space_id') || '';
        code = u.searchParams.get('code') || '';
      } catch {}
    } else {
      code = cleanInput;
      invitationLink = `${this.apiBase}/workspace?code=${code}`;
    }

    progressCb(`Resolving workspace invitation for: ${invitationLink}...`);
    let infoData = null;
    try {
      infoData = await this.getWorkspaceInfoByInviteLink(invitationLink, effectiveCookie);
    } catch {}

    const results = {
      input: cleanInput,
      invitationLink,
      workspaceInfo: infoData?.data || null,
      actions: []
    };

    progressCb('Submitting workspace join request (join_workspace_with_apply)...');
    try {
      const applyPayload = {
        join_workspace_type: 1,
        invite_link_param: {
          invitation_link: invitationLink,
          invite_from: 'web'
        },
        application_param: {
          workspace_id: workspaceId || infoData?.data?.workspace_id || '',
          source_type: 1,
          reason: 'Invited team member',
          file_id: ''
        }
      };
      const applyRes = await fetch(`${this.editApiBase}/cc/v1/workspace/join_workspace_with_apply`, {
        method: 'POST',
        headers: this.buildWorkspaceHeaders(effectiveCookie),
        body: JSON.stringify(applyPayload)
      });
      const applyJson = await applyRes.json();
      results.actions.push({
        action: 'join_workspace_with_apply',
        success: applyJson.ret === '0',
        data: applyJson
      });
    } catch (e) {
      results.actions.push({
        action: 'join_workspace_with_apply',
        success: false,
        error: e.message
      });
    }

    progressCb('Submitting direct workspace binding (join_workspace)...');
    try {
      const directPayload = {
        invitation_link: invitationLink,
        workspace_id: workspaceId || infoData?.data?.workspace_id || '',
        space_id: spaceId || infoData?.data?.space_id || ''
      };
      const directRes = await fetch(`${this.editApiBase}/cc/v1/workspace/join_workspace`, {
        method: 'POST',
        headers: this.buildWorkspaceHeaders(effectiveCookie),
        body: JSON.stringify(directPayload)
      });
      const directJson = await directRes.json();
      results.actions.push({
        action: 'join_workspace',
        success: directJson.ret === '0',
        data: directJson
      });
    } catch (e) {
      results.actions.push({
        action: 'join_workspace',
        success: false,
        error: e.message
      });
    }

    const anySuccess = results.actions.some((a) => a.success);
    results.success = anySuccess;
    progressCb(anySuccess ? 'Successfully joined the workspace!' : 'Workspace join operations processed.');
    return results;
  }

  async registerDisposableAccount(options = {}, progressCb = () => {}) {
    const password = options.password || generateSecurePassword();

    let inviteCode = options.inviteCode || null;
    let inviterUserId = options.inviterUserId || null;

    if (options.referralInput) {
      const refStr = String(options.referralInput || '').replace(/[\r\n\t\s]+/g, '').trim();
      if (refStr.startsWith('http://') || refStr.startsWith('https://')) {
        try {
          const parsed = new URL(refStr);
          const cp = parsed.searchParams.get('code') || parsed.searchParams.get('invite_code');
          const up = parsed.searchParams.get('user_id') || parsed.searchParams.get('inviter_uid');
          if (cp) inviteCode = cp;
          if (up) inviterUserId = up;
        } catch {}
      } else if (/^\d{15,25}$/.test(refStr)) {
        inviterUserId = refStr;
      } else {
        inviteCode = refStr;
      }
    }

    const regOptions = {
      ...options,
      inviteCode,
      inviterUserId
    };

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
    const regResult = await this.registerVerifyLogin(email, password, code, regOptions);

    let claimResult = null;
    if (options.referralInput || inviteCode || inviterUserId) {
      const refTarget = options.referralInput || inviteCode || inviterUserId;
      progressCb(`Processing referral claim for: ${refTarget}...`);
      try {
        claimResult = await this.claimReferral(refTarget, regResult.cookieString, progressCb);
      } catch (e) {
        progressCb(`Referral claim note: ${e.message}`);
      }
    }

    let joinedTeam = null;
    if (options.team || options.teamLink || options.spaceLink) {
      const teamTarget = options.team || options.teamLink || options.spaceLink;
      progressCb(`Processing team workspace invitation for: ${teamTarget}...`);
      try {
        joinedTeam = await this.joinWorkspace(teamTarget, regResult.cookieString, progressCb);
      } catch (e) {
        progressCb(`Team join note: ${e.message}`);
      }
    }

    progressCb('Fetching complete account profile, role, storage, and pro details...');
    let fullProfile = null;
    try {
      fullProfile = await this.getFullAccountProfile(regResult.cookieString, progressCb);
    } catch {
      fullProfile = {
        userId: regResult.data.user_id_str || String(regResult.data.user_id),
        secUserId: regResult.data.sec_user_id || '',
        screenName: regResult.data.screen_name || regResult.data.name || '',
        email,
        role: 'owner',
        isPro: false,
        pro: { isPro: false, level: 'free', startTime: null, expireTime: null },
        isNewUser: true,
        region: 'SG',
        referral: {
          referralId: regResult.data.user_id_str || String(regResult.data.user_id),
          userId: regResult.data.user_id_str || String(regResult.data.user_id),
          secUserId: regResult.data.sec_user_id || '',
          referralLink: `${this.apiBase}/capcut_pc_web/fission_receive?enter_from=share&user_id=${regResult.data.user_id_str || String(regResult.data.user_id)}`
        }
      };
    }

    let trialResult = null;
    if (options.getTrial) {
      progressCb('Claiming 7-day Pro free trial directly from web...');
      try {
        trialResult = await this.getTrial7d(regResult.cookieString, {
          userId: fullProfile?.userId,
          inviterUid: inviterUserId,
          inviteCode,
          referralInput: options.referralInput,
          region: options.region || 'SG'
        }, progressCb);
        if (trialResult?.profile) {
          fullProfile = trialResult.profile;
        }
      } catch (e) {
        progressCb(`Trial claim note: ${e.message}`);
      }
    }

    progressCb('Account creation completed successfully.');
    return {
      email,
      password,
      userId: fullProfile.userId || regResult.data.user_id_str || String(regResult.data.user_id),
      screenName: fullProfile.screenName || regResult.data.screen_name || '',
      avatarUrl: regResult.data.avatar_url || '',
      secUserId: fullProfile.secUserId || regResult.data.sec_user_id || '',
      role: fullProfile.role || 'owner',
      isPro: fullProfile.isPro || false,
      pro: fullProfile.pro,
      storage: fullProfile.storage,
      workspace: fullProfile.workspace,
      referral: fullProfile.referral,
      claimedReferral: claimResult,
      joinedTeam,
      trial: trialResult,
      cookieString: regResult.cookieString,
      sessionCookies: regResult.cookies,
      fullProfile
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
