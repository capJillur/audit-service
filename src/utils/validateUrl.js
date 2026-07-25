const AppError = require('./AppError');

const BLOCKED_HOSTNAMES = new Set(['localhost', '0.0.0.0', '::1']);

// Matches IPv4 literals so we can reject private/loopback/link-local ranges.
const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

function isPrivateIpv4(hostname) {
  const m = hostname.match(IPV4_RE);
  if (!m) return false;
  const [a, b] = [parseInt(m[1], 10), parseInt(m[2], 10)];
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  return false;
}

/**
 * Validates that `raw` is a safe, well-formed http(s) URL to audit.
 * Throws AppError(VALIDATION_ERROR) on failure.
 * @returns {URL}
 */
function validateUrl(raw) {
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new AppError('VALIDATION_ERROR', '"url" is required and must be a non-empty string', 422);
  }

  let parsed;
  try {
    parsed = new URL(raw.trim());
  } catch {
    throw new AppError('VALIDATION_ERROR', `"${raw}" is not a valid URL`, 422);
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new AppError('VALIDATION_ERROR', 'Only http and https URLs are supported', 422);
  }

  const hostname = parsed.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith('.local') || isPrivateIpv4(hostname)) {
    throw new AppError(
      'VALIDATION_ERROR',
      'URLs pointing to localhost or private network addresses are not allowed',
      422
    );
  }

  return parsed;
}

module.exports = { validateUrl, isPrivateIpv4 };
