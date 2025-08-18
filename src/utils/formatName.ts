export const formatShortName = (full: string): string => {
  const [f = '', l = ''] = full.trim().split(/\s+/);
  return l ? `${f} ${l[0].toUpperCase()}.` : f;
};
