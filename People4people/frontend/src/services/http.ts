const productionDefaultApiUrl = 'https://zsb-api-people-4-people.onrender.com/api/v1';
const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();
const apiUrl = configuredApiUrl || (import.meta.env.PROD ? productionDefaultApiUrl : '');
const apiUrlWithScheme = apiUrl && !/^https?:\/\//i.test(apiUrl)
  ? `https://${apiUrl}`
  : apiUrl;
const normalizedApiUrl = apiUrlWithScheme?.replace(/\/+$/, '');

export const API_BASE_URL = normalizedApiUrl
  ? normalizedApiUrl.endsWith('/api/v1')
    ? normalizedApiUrl
    : `${normalizedApiUrl}/api/v1`
  : '/api/v1';

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return fetch(`${API_BASE_URL}${normalizedPath}`, options);
}
