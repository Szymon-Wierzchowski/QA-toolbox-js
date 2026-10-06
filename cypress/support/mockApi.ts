export type Scenario =
  | "success"
  | "empty"
  | "serverError"
  | "slow"
  | "networkError";

export const allScenarios: Scenario[] = [
  "success",
  "empty",
  "serverError",
  "slow",
  "networkError",
];

interface MockApiOptions<T> {
  url: string | RegExp;
  alias: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  scenario?: Scenario;
  body?: T; // payload returned by the "success" and "slow" scenarios
  emptyBody?: unknown; // use `{}` for endpoints that return an object
  delayMs?: number;
}

/**
 * Replaces a real API response with a chosen scenario.
 * Call it BEFORE the action that triggers the request (usually before cy.visit).
 */
export function mockApi<T>({
  url,
  alias,
  method = "GET",
  scenario = "success",
  body,
  emptyBody = [],
  delayMs = 3000,
}: MockApiOptions<T>) {
  // A plain string must match the whole URL, so "/api/items" misses "/api/items?page=2".
  // Use "/api/items*" or a RegExp when the app adds query strings.
  const route = { method, url };

  switch (scenario) {
    case "success":
      cy.intercept(route, { statusCode: 200, body }).as(alias);
      break;
    case "empty":
      cy.intercept(route, { statusCode: 200, body: emptyBody }).as(alias);
      break;
    case "serverError":
      cy.intercept(route, {
        statusCode: 500,
        body: { message: "Internal Server Error" },
      }).as(alias);
      break;
    case "slow":
      cy.intercept(route, { statusCode: 200, body, delay: delayMs }).as(alias);
      break;
    case "networkError":
      // Simulates a dropped connection, which is different from an HTTP error
      cy.intercept(route, { forceNetworkError: true }).as(alias);
      break;
  }
}

/** Waits for the mocked call and returns it, so the test can inspect what the app sent. */
export function waitForRequest(alias: string) {
  return cy.wait(`@${alias}`).then((interception) => interception.request);
}
