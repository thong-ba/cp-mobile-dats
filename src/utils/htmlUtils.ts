/**
 * Clean HTML content for display in React Native
 * - Removes empty <p> tags
 * - Converts &nbsp; to regular spaces
 * - Preserves HTML structure for proper rendering
 * - Removes excessive whitespace
 */
export const cleanHtmlContent = (html: string): string => {
  if (!html || typeof html !== 'string') return '';

  let cleaned = html
    // Remove empty paragraph tags (with optional whitespace/&nbsp;)
    .replace(/<p>\s*(&nbsp;|\s)*<\/p>/gi, '')
    // Remove paragraphs that only contain &nbsp;
    .replace(/<p>(&nbsp;)+<\/p>/gi, '')
    // Convert multiple &nbsp; to single space
    .replace(/&nbsp;+/g, ' ')
    // Remove excessive whitespace between tags (but keep structure)
    .replace(/>\s+</g, '><')
    // Trim
    .trim();

  // If cleaned is empty or only whitespace, return empty string
  if (!cleaned || cleaned.replace(/<[^>]*>/g, '').trim().length === 0) {
    return '';
  }

  return cleaned;
};

/**
 * Check if string contains HTML tags
 */
export const containsHtml = (text: string): boolean => {
  if (!text || typeof text !== 'string') return false;
  return /<[^>]+>/.test(text);
};

