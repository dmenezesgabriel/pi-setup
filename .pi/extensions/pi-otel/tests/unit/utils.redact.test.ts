import { describe, it, expect } from 'vitest';
import { redactText } from '../../src/utils';

describe('utils.redact', () => {
  it('redacts emails by default', () => {
    const s = 'Contact me at test@example.com for info.';
    const r = redactText(s);
    expect(r).toContain('***REDACTED***');
    expect(r).not.toContain('test@example.com');
  });

  it('redacts phone numbers by default', () => {
    const s = 'Call me at +1-555-123-4567.';
    const r = redactText(s);
    expect(r).toContain('***REDACTED***');
    expect(r).not.toContain('+1-555-123-4567');
  });

  it('supports custom patterns', () => {
    const s = 'secret: ABC123';
    const r = redactText(s, [/ABC\d{3}/g]);
    expect(r).toContain('***REDACTED***');
    expect(r).not.toContain('ABC123');
  });
});
