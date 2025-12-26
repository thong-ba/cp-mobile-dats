/**
 * Message Filter Utility
 * Filter sensitive information (phone numbers, emails, URLs)
 */

/**
 * Check if content contains phone number patterns
 */
const containsPhoneNumber = (content: string): boolean => {
  // Vietnamese phone patterns
  const phonePatterns = [
    /0[1-9][0-9]{8,9}/g, // 0123456789, 0987654321
    /\+84[1-9][0-9]{8,9}/g, // +84123456789
    /84[1-9][0-9]{8,9}/g, // 84123456789
  ];

  // Written numbers (Vietnamese)
  const writtenNumbers = [
    'không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín',
    'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  ];

  // Check patterns
  for (const pattern of phonePatterns) {
    if (pattern.test(content)) {
      return true;
    }
  }

  // Check written numbers (simple check - có thể cải thiện)
  const lowerContent = content.toLowerCase();
  const numberWords = writtenNumbers.filter((word) => lowerContent.includes(word));
  if (numberWords.length >= 8) {
    // Nếu có nhiều số được viết, có thể là số điện thoại
    return true;
  }

  return false;
};

/**
 * Check if content contains email address
 */
const containsEmail = (content: string): boolean => {
  // Standard email pattern
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  if (emailPattern.test(content)) {
    return true;
  }

  // Spaced email: "user @ domain . com"
  const spacedEmailPattern = /[a-zA-Z0-9._%+-]+\s*@\s*[a-zA-Z0-9.-]+\s*\.\s*[a-zA-Z]{2,}/g;
  if (spacedEmailPattern.test(content)) {
    return true;
  }

  // Written: "user at domain dot com"
  const writtenEmailPattern = /[a-zA-Z0-9._%+-]+\s+(at|@)\s+[a-zA-Z0-9.-]+\s+(dot|\.)\s+[a-zA-Z]{2,}/gi;
  if (writtenEmailPattern.test(content)) {
    return true;
  }

  return false;
};

/**
 * Check if content contains URL
 */
const containsUrl = (content: string): boolean => {
  // Standard URL patterns
  const urlPatterns = [
    /https?:\/\/[^\s]+/g,
    /www\.[^\s]+/g,
    /[a-zA-Z0-9-]+\.[a-zA-Z]{2,}[^\s]*/g,
  ];

  for (const pattern of urlPatterns) {
    if (pattern.test(content)) {
      return true;
    }
  }

  // Spaced URL: "www . example . com"
  const spacedUrlPattern = /www\s*\.\s*[a-zA-Z0-9.-]+\s*\.\s*[a-zA-Z]{2,}/g;
  if (spacedUrlPattern.test(content)) {
    return true;
  }

  // Social media patterns
  const socialPatterns = [
    /facebook\.com/i,
    /instagram\.com/i,
    /twitter\.com/i,
    /tiktok\.com/i,
    /youtube\.com/i,
    /zalo\.me/i,
  ];

  for (const pattern of socialPatterns) {
    if (pattern.test(content)) {
      return true;
    }
  }

  return false;
};

/**
 * Check if content contains sensitive information
 */
export const containsSensitiveInfo = (content: string): boolean => {
  if (!content || content.trim().length === 0) {
    return false;
  }

  return containsPhoneNumber(content) || containsEmail(content) || containsUrl(content);
};

/**
 * Filter a single message
 */
export const filterMessage = <T extends { content?: string }>(message: T): T | null => {
  if (!message.content) {
    return message;
  }

  if (containsSensitiveInfo(message.content)) {
    return null; // Block message
  }

  return message;
};

/**
 * Filter array of messages
 */
export const filterMessages = <T extends { content?: string }>(messages: T[]): T[] => {
  return messages.filter((msg) => filterMessage(msg) !== null);
};

