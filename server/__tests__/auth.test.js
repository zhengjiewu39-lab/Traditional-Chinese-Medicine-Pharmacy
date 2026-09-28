const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const {
  signToken, verifyToken, authenticate, isPublicPath, getUsers, sanitizeProfileUpdate,
} = require('../security/auth');
const { validateUploadedText } = require('../security/uploadValidation');

describe('auth helpers', () => {
  it('authenticates demo admin', () => {
    const result = authenticate('admin', 'admin123');
    assert.ok(result);
    assert.equal(result.user.username, 'admin');
    assert.ok(result.token.includes('.'));
  });

  it('rejects invalid credentials and non-string input', () => {
    assert.equal(authenticate('admin', 'wrong'), null);
    assert.equal(authenticate('admin', undefined), null);
    assert.equal(authenticate('__proto__', 'x'), null);
    assert.equal(authenticate('constructor', 'x'), null);
  });

  it('stores only bcrypt hashes, never plaintext passwords', () => {
    for (const acc of Object.values(getUsers())) {
      assert.equal(acc.password, undefined);
      assert.match(acc.passwordHash, /^\$2[aby]\$\d{2}\$/);
    }
  });

  it('signs and verifies JWT', () => {
    const user = { id: 1, username: 'admin', role: 'admin' };
    const token = signToken(user);
    const verified = verifyToken(`Bearer ${token}`);
    assert.equal(verified.username, 'admin');
  });

  it('rejects malformed, tampered, re-signed, alg-changed and legacy demo tokens', () => {
    assert.equal(verifyToken('Bearer not-a-jwt'), null);
    assert.equal(verifyToken('Bearer tcm-token-admin'), null);
    assert.equal(verifyToken(undefined), null);
    const token = signToken({ id: 2, username: 'pharmacist', role: 'pharmacist' });
    const [h, b, s] = token.split('.');
    const escalated = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(b, 'base64url')), role: 'admin' })).toString('base64url');
    assert.equal(verifyToken(`Bearer ${h}.${escalated}.${s}`), null);
    assert.equal(verifyToken(`Bearer ${h}.${b}.${s.slice(0, -2)}`), null);
    const forged = crypto.createHmac('sha256', 'guess').update(`${h}.${b}`).digest('base64url');
    assert.equal(verifyToken(`Bearer ${h}.${b}.${forged}`), null);
    const none = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    assert.equal(verifyToken(`Bearer ${none}.${b}.`), null);
    const expired = Buffer.from(JSON.stringify({ username: 'x', exp: Date.now() - 1 })).toString('base64url');
    assert.equal(verifyToken(`Bearer ${h}.${expired}.${s}`), null);
  });

  it('marks public paths correctly', () => {
    assert.equal(isPublicPath('/api/health'), true);
    assert.equal(isPublicPath('/api/auth/login'), true);
    assert.equal(isPublicPath('/api/pickup/redeem'), true);
    assert.equal(isPublicPath('/api/prescriptions/pickup/TCM128456'), false);
    assert.equal(isPublicPath('/api/prescriptions/pickup/queue'), false);
    assert.equal(isPublicPath('/api/inventory'), false);
  });

  it('profile update cannot change role, id, username or unknown fields', () => {
    for (const bad of [{ role: 'admin' }, { name: 'x', role: 'admin' }, { id: 9 }, { username: 'root' }, { exp: 1 }, { isAdmin: true }]) {
      assert.ok(sanitizeProfileUpdate(bad).error, JSON.stringify(bad));
    }
    assert.ok(sanitizeProfileUpdate({ name: 'x'.repeat(101) }).error);
    assert.ok(sanitizeProfileUpdate({ name: 5 }).error);
    assert.deepEqual(sanitizeProfileUpdate({ name: '王药师', email: 'a@b.c' }).value, { name: '王药师', email: 'a@b.c' });
  });
});

describe('upload validation (extension + MIME + content)', () => {
  const file = (originalname, mimetype, content) => ({
    originalname, mimetype, buffer: Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8'),
  });

  it('accepts matching text files', () => {
    assert.equal(validateUploadedText(file('rx.txt', 'text/plain', '当归 10g\n川芎 6g')).value, '当归 10g\n川芎 6g');
    assert.ok(validateUploadedText(file('rx.json', 'application/json', '{"herbs":[]}')).value);
    assert.ok(validateUploadedText(file('rx.csv', 'text/csv', 'herb,dose\n当归,10')).value);
    assert.ok(validateUploadedText(file('rx.xml', 'application/xml', '<rx/>')).value);
  });

  it('rejects wrong extensions, mismatched MIME, binaries and disguised executables', () => {
    const bad = [
      file('rx.html', 'text/html', '<script>alert(1)</script>'),
      file('rx.js', 'text/plain', 'alert(1)'),
      file('rx.txt', 'text/html', 'x'),
      file('rx.txt', 'application/octet-stream', 'x'),
      file('rx.txt', 'text/plain', Buffer.from('MZ\x90\x00binary', 'latin1')),
      file('rx.csv', 'text/csv', Buffer.from('PK\x03\x04zip', 'latin1')),
      file('rx.txt', 'text/plain', '#!/bin/sh\nrm -rf /'),
      file('rx.txt', 'text/plain', Buffer.from([0xc3, 0x28])),
      file('rx.txt', 'text/plain', 'a\u0000b'),
      file('rx.json', 'application/json', '{not json'),
      file('rx.xml', 'text/xml', 'plain'),
      file('rx.txt', 'text/plain', ''),
      file('noext', 'text/plain', 'x'),
    ];
    for (const f of bad) assert.ok(validateUploadedText(f).error, f.originalname);
  });
});
