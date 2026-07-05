const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { signToken, verifyToken, authenticate, isPublicPath } = require('../security/auth');

describe('auth helpers', () => {
  it('authenticates demo admin', () => {
    const result = authenticate('admin', 'admin123');
    assert.ok(result);
    assert.equal(result.user.username, 'admin');
    assert.ok(result.token.includes('.'));
  });

  it('rejects invalid credentials', () => {
    assert.equal(authenticate('admin', 'wrong'), null);
  });

  it('signs and verifies JWT', () => {
    const user = { id: 1, username: 'admin', role: 'admin' };
    const token = signToken(user);
    const verified = verifyToken(`Bearer ${token}`);
    assert.equal(verified.username, 'admin');
  });

  it('verifyToken rejects malformed token', () => {
    assert.equal(verifyToken('Bearer not-a-jwt'), null);
  });

  it('marks public paths correctly', () => {
    assert.equal(isPublicPath('/api/health'), true);
    assert.equal(isPublicPath('/api/auth/login'), true);
    assert.equal(isPublicPath('/api/prescriptions/pickup/TCM128456'), true);
    assert.equal(isPublicPath('/api/prescriptions/pickup/queue'), false);
    assert.equal(isPublicPath('/api/inventory'), false);
  });
});
