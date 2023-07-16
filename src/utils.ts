export const getPreviewText = (text: string, limit = 50) => {
  if (text.length <= limit) {
    return text;
  } else {
    return text.substring(0, limit) + '...';
  }
};

export const isValidJsonString = (str: unknown): boolean => {
  if (typeof str !== 'string') {
    return false;
  }
  try {
    const result = JSON.parse(str);
    const type = Object.prototype.toString.call(result);
    return type === '[object Object]' || type === '[object Array]';
  } catch (e) {
    return false;
  }
};
