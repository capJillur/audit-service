const { validateUrl } = require('../src/utils/validateUrl');
const AppError = require('../src/utils/AppError');

describe('validateUrl', () => {
  test('accepts a well-formed https URL', () => {
    const url = validateUrl('https://example.com/page');
    expect(url.href).toBe('https://example.com/page');
  });

  test('accepts a well-formed http URL', () => {
    const url = validateUrl('http://example.com');
    expect(url.protocol).toBe('http:');
  });

  test('rejects empty input', () => {
    expect(() => validateUrl('')).toThrow(AppError);
  });

  test('rejects non-string input', () => {
    expect(() => validateUrl(undefined)).toThrow(AppError);
    expect(() => validateUrl(123)).toThrow(AppError);
  });

  test('rejects malformed URLs', () => {
    expect(() => validateUrl('not a url')).toThrow(AppError);
  });

  test('rejects unsupported protocols', () => {
    expect(() => validateUrl('ftp://example.com')).toThrow(AppError);
    expect(() => validateUrl('file:///etc/passwd')).toThrow(AppError);
  });

  test('rejects localhost', () => {
    expect(() => validateUrl('http://localhost:3000')).toThrow(AppError);
  });

  test('rejects loopback IP', () => {
    expect(() => validateUrl('http://127.0.0.1')).toThrow(AppError);
  });

  test('rejects private network ranges', () => {
    expect(() => validateUrl('http://10.0.0.5')).toThrow(AppError);
    expect(() => validateUrl('http://192.168.1.1')).toThrow(AppError);
    expect(() => validateUrl('http://172.16.0.1')).toThrow(AppError);
  });

  test('allows a public IP-like hostname that is not private', () => {
    expect(() => validateUrl('http://8.8.8.8')).not.toThrow();
  });

  test('error includes a 422 status and VALIDATION_ERROR code', () => {
    try {
      validateUrl('not a url');
      throw new Error('should have thrown');
    } catch (err) {
      expect(err.statusCode).toBe(422);
      expect(err.code).toBe('VALIDATION_ERROR');
    }
  });
});
