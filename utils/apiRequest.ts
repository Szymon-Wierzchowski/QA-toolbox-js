/** Typed fetch wrapper: fails loudly on HTTP errors. */
export async function apiRequest<T>(
  url: string,
  init: RequestInit = {}
): Promise<T> {
  const { headers, ...rest } = init;
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json", ...headers },
    ...rest,
  });
  // fetch only rejects on network errors; a 404 or 500 still "succeeds"
  if (!response.ok) {
    throw new Error(`${rest.method ?? "GET"} ${url} failed: ${response.status}`);
  }
  // `as T` is a promise to the compiler, not a runtime check
  return (await response.json()) as T;
}
