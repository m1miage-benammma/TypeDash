declare const TYPEDASH_API_ORIGIN: string;

export const environment = {
  apiUrl: '/api',
  streamOrigin: typeof TYPEDASH_API_ORIGIN === 'undefined' ? '' : TYPEDASH_API_ORIGIN,
} as const;
