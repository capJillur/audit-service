const cheerio = require('cheerio');
const AppError = require('../utils/AppError');
const config = require('../config');

/**
 * Fetches `url` with a hard timeout and a response-size cap, then extracts
 * a set of lightweight SEO/performance signals from the HTML.
 * @param {URL} url
 * @returns {Promise<object>} audit report
 */
async function runAudit(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.fetchTimeoutMs);
  const startedAt = process.hrtime.bigint();

  let response;
  try {
    response = await fetch(url.toString(), {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'PagePulse-Auditor/1.0 (+https://digitalheroesco.com)' },
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new AppError(
        'UPSTREAM_TIMEOUT',
        `Request to ${url.href} timed out after ${config.fetchTimeoutMs}ms`,
        504
      );
    }
    throw new AppError('UPSTREAM_UNREACHABLE', `Could not reach ${url.href}: ${err.message}`, 502);
  } finally {
    clearTimeout(timeout);
  }

  const responseTimeMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
  const contentType = response.headers.get('content-type') || '';
  const contentLengthHeader = response.headers.get('content-length');

  if (contentLengthHeader && Number(contentLengthHeader) > config.maxResponseBytes) {
    throw new AppError(
      'RESPONSE_TOO_LARGE',
      `Response exceeds the ${config.maxResponseBytes} byte limit`,
      413
    );
  }

  const body = await response.text();
  const sizeBytes = Buffer.byteLength(body, 'utf8');
  if (sizeBytes > config.maxResponseBytes) {
    throw new AppError(
      'RESPONSE_TOO_LARGE',
      `Response exceeds the ${config.maxResponseBytes} byte limit`,
      413
    );
  }

  const report = {
    requestedUrl: url.href,
    finalUrl: response.url || url.href,
    redirected: response.redirected,
    statusCode: response.status,
    ok: response.ok,
    contentType,
    sizeBytes,
    responseTimeMs: Math.round(responseTimeMs),
    https: (response.url || url.href).startsWith('https:'),
  };

  if (contentType.includes('text/html')) {
    Object.assign(report, extractHtmlSignals(body));
  }

  report.seoScore = computeSeoScore(report);
  return report;
}

function extractHtmlSignals(html) {
  const $ = cheerio.load(html);

  const title = $('head > title').first().text().trim() || null;
  const metaDescription = $('meta[name="description"]').attr('content')?.trim() || null;
  const h1Elements = $('h1');
  const images = $('img');
  const imagesMissingAlt = images.filter((_, el) => !$(el).attr('alt')?.trim()).length;

  const links = $('a[href]');
  let internalLinks = 0;
  let externalLinks = 0;
  links.each((_, el) => {
    const href = $(el).attr('href') || '';
    if (/^https?:\/\//i.test(href)) externalLinks += 1;
    else internalLinks += 1;
  });

  return {
    title,
    titleLength: title ? title.length : 0,
    metaDescription,
    metaDescriptionLength: metaDescription ? metaDescription.length : 0,
    h1Count: h1Elements.length,
    imageCount: images.length,
    imagesMissingAlt,
    internalLinkCount: internalLinks,
    externalLinkCount: externalLinks,
  };
}

/**
 * A small, transparent 0-100 heuristic score — not a Lighthouse replacement,
 * just enough signal to flag obvious SEO issues in the report.
 */
function computeSeoScore(report) {
  let score = 100;
  const issues = [];

  if (!report.https) {
    score -= 15;
    issues.push('Page is not served over HTTPS');
  }
  if (report.contentType.includes('text/html')) {
    if (!report.title) {
      score -= 15;
      issues.push('Missing <title> tag');
    } else if (report.titleLength < 10 || report.titleLength > 60) {
      score -= 5;
      issues.push('Title length outside the recommended 10-60 characters');
    }
    if (!report.metaDescription) {
      score -= 10;
      issues.push('Missing meta description');
    }
    if (report.h1Count === 0) {
      score -= 10;
      issues.push('No <h1> found');
    } else if (report.h1Count > 1) {
      score -= 5;
      issues.push('Multiple <h1> tags found');
    }
    if (report.imagesMissingAlt > 0) {
      score -= Math.min(15, report.imagesMissingAlt * 2);
      issues.push(`${report.imagesMissingAlt} image(s) missing alt text`);
    }
  }
  if (report.responseTimeMs > 3000) {
    score -= 10;
    issues.push('Response time exceeds 3000ms');
  }
  if (!report.ok) {
    score -= 20;
    issues.push(`Non-2xx status code: ${report.statusCode}`);
  }

  report.issues = issues;
  return Math.max(0, score);
}

module.exports = { runAudit };
