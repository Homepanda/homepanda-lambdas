import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar, Cookie } from 'tough-cookie';
import * as cheerio from 'cheerio';
import { dateRange, sleep } from './utils.mjs';

const BASE_URL = 'https://gestionale.immobiliare.it';
const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64; rv:155.0) Gecko/20100101 Firefox/155.0';
const REQUEST_TIMEOUT_MS = 15000;
const RETRY_DELAYS_MS = [5000, 15000];
const MAX_RETRY_AFTER_MS = 60000;
const BODY_SNIPPET_LENGTH = 200;
const DATADOME_HEADERS = ['x-datadome', 'x-datadome-cid', 'x-dd-b'];
const DATADOME_BODY_MARKERS = ['captcha-delivery.com', 'geo.captcha', 'datadome'];

export const STAT_TYPES = [
  'performance_index',
  'lead',
  'phone_click',
  'visit_request',
  'impression_serp',
  'carousel_listing_changed',
  'map_pin_selected',
  'detail_view_client',
  'impression_mail_alert',
  'click_mail_alert',
  'price_proposal',
];

export class ImmobiliareError extends Error {
  constructor(kind, message, status) {
    super(message);
    this.name = 'ImmobiliareError';
    this.kind = kind;
    this.status = status;
  }
}

export async function createHttpClient({ cookieKey, cookieValue } = {}) {
  const jar = new CookieJar();
  if (cookieKey && cookieValue) {
    await jar.setCookie(new Cookie({
      key: cookieKey,
      value: cookieValue,
      domain: 'gestionale.immobiliare.it',
      httpOnly: true,
    }), BASE_URL);
  }
  return wrapper(axios.create({
    jar,
    timeout: REQUEST_TIMEOUT_MS,
    headers: { 'User-Agent': USER_AGENT },
    validateStatus: () => true,
  }));
}

export class Immobiliare {
  constructor(client, { throttle = async () => {}, wait = sleep, now = Date.now } = {}) {
    this.client = client;
    this.throttle = throttle;
    this.wait = wait;
    this.now = now;
  }

  async login(username, password) {
    const signin = await this.#request({ method: 'get', url: `${BASE_URL}/signin/` });
    if (signin.status === 403) {
      throw new ImmobiliareError('blocked', 'Signin page blocked (HTTP 403)', 403);
    }
    const csrfToken = csrfTokenFromSignin(signin.data);
    if (!csrfToken) {
      console.warn(`CSRF token not found on signin page (HTTP ${signin.status}), logging in without it: ${bodySnippet(signin.data)}`);
    }

    const form = new URLSearchParams({ username, password });
    if (csrfToken) {
      form.set('_csrf_token', csrfToken);
    }
    const response = await this.#request({ method: 'post', url: `${BASE_URL}/login_check`, data: form });
    if (response.status === 403) {
      throw new ImmobiliareError('blocked', 'Login blocked (HTTP 403)', 403);
    }
    const page = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
    if (/'agencyId': '\d+'/.test(page)) {
      return;
    }
    if (/Credenziali non valide/.test(page)) {
      throw new ImmobiliareError('login', 'Invalid credentials', response.status);
    }
    throw new ImmobiliareError('login', `Login not confirmed (HTTP ${response.status})`, response.status);
  }

  async getPropertyStats(propertyId, start, end) {
    for (let attempt = 0; ; attempt++) {
      const response = await this.#request({
        method: 'get',
        url: `${BASE_URL}/api/properties/${encodeURIComponent(propertyId)}/stats`,
        params: { start, end, statTypes: STAT_TYPES.join(','), details: 1 },
        headers: {
          Accept: 'application/json',
          Referer: `${BASE_URL}/immobili/portale/${encodeURIComponent(propertyId)}/prestazioni`,
        },
      });
      const { status, data } = response;    

      if (status === 429 || status === 503) {
        const delay = this.#retryAfterMs(response.headers?.['retry-after']) ?? RETRY_DELAYS_MS[attempt];
        if (attempt >= RETRY_DELAYS_MS.length || delay > MAX_RETRY_AFTER_MS) {
          throw new ImmobiliareError('overloaded', `Property ${propertyId}: server overloaded (HTTP ${status})`, status);
        }
        console.warn(`Property ${propertyId}: HTTP ${status}, retrying in ${delay} ms`);
        await this.wait(delay);
        continue;
      }
      // Un 403 può essere il blocco anti-bot (ferma tutto) oppure un annuncio non più accessibile (si salta)
      if (status === 403) {
        const signal = dataDomeSignal(response);
        if (signal) {
          throw new ImmobiliareError('blocked', `Property ${propertyId}: blocked by DataDome (HTTP 403, ${signal})`, status);
        }
        throw new ImmobiliareError(
          'not_accessible',
          `Property ${propertyId}: HTTP 403 without DataDome signature, listing not accessible: ${bodySnippet(data)}`,
          status,
        );
      }
      if (status === 401) {
        throw new ImmobiliareError('session', `Property ${propertyId}: session not valid (HTTP 401)`, status);
      }
      if (status === 404 || status === 410) {
        throw new ImmobiliareError('not_found', `Property ${propertyId}: not found (HTTP ${status})`, status);
      }
      if (status < 200 || status >= 300) {
        throw new ImmobiliareError('http', `Property ${propertyId}: unexpected HTTP ${status}`, status);
      }

      if (typeof data === 'string') {
        throw new ImmobiliareError(
          'session',
          `Property ${propertyId}: HTML response instead of JSON, session not valid: ${bodySnippet(data)}`,
          status,
        );
      }
      if (data?.status !== 'success' || typeof data.data !== 'object' || data.data === null) {
        throw new ImmobiliareError(
          'http',
          `Property ${propertyId}: unexpected response status "${data?.status}": ${bodySnippet(data)}`,
          status,
        );
      }

      const propertyResponse = await this.#request({
        method: 'get',
        url: `${BASE_URL}/api/properties/${encodeURIComponent(propertyId)}`,        
        headers: {
          Accept: 'application/json',
          Referer: `${BASE_URL}/immobili/portale/${encodeURIComponent(propertyId)}/prestazioni`,
        },
      });
      const { data: dataProperty } = propertyResponse;

      data.data['favorite'] = dataProperty.data.usersStats.saves;
      data.data['visit'] = dataProperty.data.usersStats.views;

      return data.data;
    }
  }

  async #request(config) {
    await this.throttle();
    try {
      return await this.client.request(config);
    } catch (error) {
      throw new ImmobiliareError('http', `${config.method.toUpperCase()} ${config.url} failed: ${error.message}`);
    }
  }

  #retryAfterMs(header) {
    if (!header) {
      return undefined;
    }
    const seconds = Number(header);
    if (Number.isFinite(seconds)) {
      return Math.max(0, seconds * 1000);
    }
    const date = Date.parse(header);
    return Number.isNaN(date) ? undefined : Math.max(0, date - this.now());
  }
}

// Firma di DataDome nella risposta: header, cookie o rimando al captcha nel corpo.
// Restituisce il segnale trovato, così finisce nel log, oppure undefined.
function dataDomeSignal(response) {
  const headers = response.headers ?? {};
  const header = DATADOME_HEADERS.find((name) => headers[name]);
  if (header) {
    return `header ${header}`;
  }
  if (/datadome/i.test(String(headers.server ?? ''))) {
    return 'header server';
  }
  if (/datadome=/i.test([].concat(headers['set-cookie'] ?? []).join('; '))) {
    return 'set-cookie datadome';
  }
  const body = bodySnippet(response.data, 4000).toLowerCase();
  const marker = DATADOME_BODY_MARKERS.find((value) => body.includes(value));
  return marker ? `body ${marker}` : undefined;
}

function csrfTokenFromSignin(html) {
  if (typeof html !== 'string') {
    return undefined;
  }
  const raw = cheerio.load(html)('#auth-data').text();
  if (!raw) {
    return undefined;
  }
  try {
    const token = JSON.parse(raw).csrfToken;
    return typeof token === 'string' && token !== '' ? token : undefined;
  } catch {
    return undefined;
  }
}

function bodySnippet(data, max = BODY_SNIPPET_LENGTH) {
  const text = typeof data === 'string' ? data : JSON.stringify(data ?? null);
  const oneLine = String(text).replace(/\s+/g, ' ').trim();
  return oneLine.length > max ? `${oneLine.slice(0, max)}…` : oneLine;
}

export function toDailyRecords(propertyId, adId, data, start, end, fetchedAt) {
  const series = Object.entries(data)
    .filter(([, value]) => Array.isArray(value?.details))
    .map(([metric, value]) => [metric, new Map(value.details.map(({ label, total }) => [label, total]))]);

  return dateRange(start, end).map((date) => ({
    provider: 'immobiliare',
    propertyId: String(propertyId),
    adId: Number(adId),
    date,
    metrics: Object.fromEntries(series.map(([metric, totalsByDate]) => [metric, totalsByDate.get(date) ?? 0])),
    favorite: data.favorite ?? 0,
    visit: data.visit ?? 0,
    performanceIndexes: data.performanceIndexes ?? null,
    fetchedAt,
  }));
}
