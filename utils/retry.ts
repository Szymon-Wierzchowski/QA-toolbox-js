export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Re-runs a flaky action, waiting longer after each failure. */
export async function retry<T>(
  action: () => Promise<T>,
  { attempts = 3, delayMs = 500 } = {}
): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await action();
    } catch (error) {
      lastError = error;
      if (i < attempts - 1) await sleep(delayMs * 2 ** i); // 500, 1000, 2000...
    }
  }
  throw lastError;
}
