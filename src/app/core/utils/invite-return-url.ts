export function normalizeInviteReturnUrl(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  const prefix = '/invite/';

  if (!value.startsWith(prefix)) {
    return null;
  }

  const token = value.slice(prefix.length);

  if (
    token.length < 32 ||
    token.length > 128 ||
    token.includes('/') ||
    token.includes('?') ||
    token.includes('#')
  ) {
    return null;
  }

  return `${prefix}${token}`;
}
