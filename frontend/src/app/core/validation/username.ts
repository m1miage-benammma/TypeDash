const USERNAME_PATTERN = /^[A-Za-z0-9_-]{3,24}$/;

export function normalizeUsername(value: string): string {
  return value.trim();
}

export function isValidUsername(value: string): boolean {
  return USERNAME_PATTERN.test(normalizeUsername(value));
}
