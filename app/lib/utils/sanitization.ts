import DOMPurify from 'dompurify';

/**
 * Sanitizes HTML content to prevent XSS attacks
 * @param html - The HTML content to sanitize
 * @returns Sanitized HTML content
 */
export const sanitizeHtml = (html: string): string => {
  if (typeof window !== 'undefined') {
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'span'],
      ALLOWED_ATTR: ['class', 'data-testid'],
      ALLOW_DATA_ATTR: true,
    });
  }

  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
    .replace(/<link\b[^<]*(?:(?!<\/link>)<[^<]*)*<\/link>/gi, '')
    .replace(/<meta\b[^<]*(?:(?!<\/meta>)<[^<]*)*<\/meta>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');
};

/**
 * Sanitizes plain text content
 * @param text - The text content to sanitize
 * @returns Sanitized text content
 */
export const sanitizeText = (text: string): string => {
  return text
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();
};

/**
 * Validates and sanitizes user input for display
 * @param input - The user input to validate and sanitize
 * @param maxLength - Maximum allowed length (default: 1000)
 * @returns Sanitized and validated input
 */
export const validateAndSanitizeInput = (
  input: string | null | undefined,
  maxLength: number = 1000
): string => {
  if (!input || typeof input !== 'string') {
    return '';
  }

  const truncated = input.length > maxLength ? input.substring(0, maxLength) : input;
  return sanitizeText(truncated);
};

/**
 * Sanitizes URL to prevent malicious redirects
 * @param url - The URL to sanitize
 * @returns Sanitized URL or empty string if invalid
 */
export const sanitizeUrl = (url: string): string => {
  if (!url || typeof url !== 'string') {
    return '';
  }

  try {
    const parsedUrl = new URL(url);

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return '';
    }

    return parsedUrl.toString();
  } catch {
    return '';
  }
};

/**
 * Sanitizes JSON content to prevent prototype pollution
 * @param jsonString - The JSON string to sanitize
 * @returns Sanitized JSON string
 */
export const sanitizeJson = (jsonString: string): string => {
  try {
    const parsed = JSON.parse(jsonString);

    const sanitized = JSON.parse(
      JSON.stringify(parsed, (key, value) => {
        if (key === '__proto__' || key === 'constructor') {
          return undefined;
        }
        return value;
      })
    );

    return JSON.stringify(sanitized);
  } catch {
    return '{}';
  }
};
