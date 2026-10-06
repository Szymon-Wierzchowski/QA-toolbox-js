declare global {
  namespace Cypress {
    interface Chainable {
      /** Finds an element by its data-test attribute. */
      getByDataTest(value: string): Chainable<JQuery<HTMLElement>>;
      /** Logs in once and reuses the session in later tests. */
      login(username: string, password: string): Chainable<void>;
    }
  }
}

Cypress.Commands.add("getByDataTest", (value: string) =>
  cy.get(`[data-test="${value}"]`)
);

Cypress.Commands.add("login", (username: string, password: string) => {
  // cy.session caches cookies per id, so the form is filled once, not before every test
  cy.session([username, password], () => {
    cy.visit("/");
    cy.getByDataTest("username").type(username);
    cy.getByDataTest("password").type(password, { log: false });
    cy.getByDataTest("login-button").click();
    cy.url().should("include", "/inventory"); // proves the login worked before the session is saved
  });
});

export {}; // makes this file a module, which `declare global` requires
