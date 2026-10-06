import { sleep } from "./retry";

/** sprawdza warunek, dopóki nie stanie się on prawdziwy lub nie upłynie czas oczekiwania. */
export async function waitUntil(
  condition: () => boolean | Promise<boolean>,
  { timeoutMs = 10_000, intervalMs = 250, message = "Condition not met" } = {}
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await condition()) return;
    await sleep(intervalMs);
  }
  throw new Error(`${message} within ${timeoutMs} ms`);
}
