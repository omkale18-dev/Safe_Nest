export const sanitizeForLog = (input: any): string => {
  if (typeof input !== 'string') {
    input = String(input);
  }
  return input.replace(/[\r\n\t\x00-\x1f\x7f-\x9f]/g, '');
};

export const sanitizeForHTML = (input: string): string => {
  if (!input) return '';
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

export const isValidImageUrl = (url: string): boolean => {
  if (!url) return false;
  // Disallow quotes, angle brackets, whitespace to prevent attribute injection
  if (/["'<>]/.test(url)) return false;
  if (/\s/.test(url)) return false;

  // Allow only data:image with base64 content
  if (url.startsWith('data:image/')) {
    return /^data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+$/.test(url);
  }

  // Allow only https URLs, basic validation; disallow javascript schemes hidden in path
  if (url.startsWith('https://')) {
    const lower = url.toLowerCase();
    if (lower.includes('javascript:')) return false;
    return /^https:\/\/[^\s"'<>()]+$/.test(url);
  }

  return false;
};

// Get device name for tracking
export const getDeviceName = (): string => {
  const userAgent = navigator.userAgent;
  
  // Check for mobile devices
  if (/Android/i.test(userAgent)) {
    const match = userAgent.match(/Android[^;]+; ([^)]+)\)/);
    if (match && match[1]) {
      return match[1].trim();
    }
    return 'Android Device';
  }
  
  if (/iPhone/i.test(userAgent)) {
    return 'iPhone';
  }
  
  if (/iPad/i.test(userAgent)) {
    return 'iPad';
  }
  
  // Desktop browsers
  if (/Windows/i.test(userAgent)) {
    return 'Windows PC';
  }
  
  if (/Mac/i.test(userAgent)) {
    return 'Mac';
  }
  
  if (/Linux/i.test(userAgent)) {
    return 'Linux PC';
  }
  
  return 'Unknown Device';
};