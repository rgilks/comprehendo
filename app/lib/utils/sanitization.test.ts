import { describe, it, expect } from 'vitest';
import {
  sanitizeHtml,
  sanitizeText,
  validateAndSanitizeInput,
  sanitizeUrl,
  sanitizeJson,
} from './sanitization';

describe('sanitization utilities', () => {
  describe('sanitizeText', () => {
    it('should remove HTML tags', () => {
      expect(sanitizeText('<script>alert("xss")</script>')).toBe('scriptalert("xss")/script');
      expect(sanitizeText('<div>Hello</div>')).toBe('divHello/div');
    });

    it('should remove javascript: protocol', () => {
      expect(sanitizeText('javascript:alert("xss")')).toBe('alert("xss")');
    });

    it('should remove event handlers', () => {
      expect(sanitizeText('onclick="alert(1)"')).toBe('"alert(1)"');
      expect(sanitizeText('onload="malicious()"')).toBe('"malicious()"');
    });

    it('should trim whitespace', () => {
      expect(sanitizeText('  hello  ')).toBe('hello');
    });

    it('should handle empty strings', () => {
      expect(sanitizeText('')).toBe('');
    });
  });

  describe('validateAndSanitizeInput', () => {
    it('should return empty string for null/undefined', () => {
      expect(validateAndSanitizeInput(null)).toBe('');
      expect(validateAndSanitizeInput(undefined)).toBe('');
    });

    it('should truncate long inputs', () => {
      const longInput = 'a'.repeat(2000);
      const result = validateAndSanitizeInput(longInput, 100);
      expect(result).toHaveLength(100);
    });

    it('should sanitize malicious input', () => {
      const malicious = '<script>alert("xss")</script>';
      expect(validateAndSanitizeInput(malicious)).toBe('scriptalert("xss")/script');
    });

    it('should handle normal input', () => {
      expect(validateAndSanitizeInput('Hello World')).toBe('Hello World');
    });
  });

  describe('sanitizeUrl', () => {
    it('should allow http and https URLs', () => {
      expect(sanitizeUrl('https://example.com')).toBe('https://example.com/');
      expect(sanitizeUrl('http://example.com')).toBe('http://example.com/');
    });

    it('should reject javascript: URLs', () => {
      expect(sanitizeUrl('javascript:alert("xss")')).toBe('');
    });

    it('should reject data: URLs', () => {
      expect(sanitizeUrl('data:text/html,<script>alert("xss")</script>')).toBe('');
    });

    it('should handle invalid URLs', () => {
      expect(sanitizeUrl('not-a-url')).toBe('');
      expect(sanitizeUrl('')).toBe('');
    });

    it('should handle null/undefined', () => {
      expect(sanitizeUrl(null as unknown as string)).toBe('');
      expect(sanitizeUrl(undefined as unknown as string)).toBe('');
    });
  });

  describe('sanitizeJson', () => {
    it('should remove __proto__ properties', () => {
      const malicious = '{"__proto__": {"isAdmin": true}}';
      const result = sanitizeJson(malicious);
      const parsed = JSON.parse(result);
      expect(parsed).toEqual({});
      expect(Object.prototype.hasOwnProperty.call(parsed, '__proto__')).toBe(false);
    });

    it('should remove constructor properties', () => {
      const malicious = '{"constructor": {"prototype": {"isAdmin": true}}}';
      const result = sanitizeJson(malicious);
      const parsed = JSON.parse(result);
      expect(parsed).toEqual({});
      expect(Object.prototype.hasOwnProperty.call(parsed, 'constructor')).toBe(false);
    });

    it('should handle normal JSON', () => {
      const normal = '{"name": "John", "age": 30}';
      const result = sanitizeJson(normal);
      const parsed = JSON.parse(result);
      expect(parsed.name).toBe('John');
      expect(parsed.age).toBe(30);
    });

    it('should handle invalid JSON', () => {
      expect(sanitizeJson('invalid json')).toBe('{}');
    });
  });

  describe('sanitizeHtml', () => {
    it('should remove script tags', () => {
      const html = '<script>alert("xss")</script><p>Hello</p>';
      const result = sanitizeHtml(html);
      expect(result).not.toContain('<script>');
      expect(result).toContain('<p>Hello</p>');
    });

    it('should remove iframe tags', () => {
      const html = '<iframe src="malicious.com"></iframe><p>Hello</p>';
      const result = sanitizeHtml(html);
      expect(result).not.toContain('<iframe>');
      expect(result).toContain('<p>Hello</p>');
    });

    it('should allow safe tags', () => {
      const html = '<p><strong>Hello</strong> <em>World</em></p>';
      const result = sanitizeHtml(html);
      expect(result).toContain('<p>');
      expect(result).toContain('<strong>');
      expect(result).toContain('<em>');
    });

    it('should remove javascript: protocols', () => {
      const html = '<a href="javascript:alert(1)">Click</a>';
      const result = sanitizeHtml(html);
      expect(result).not.toContain('javascript:');
    });
  });
});
