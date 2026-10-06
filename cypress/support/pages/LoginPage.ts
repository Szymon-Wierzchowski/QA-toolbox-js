/** Page Object: everything the tests know about the login page lives here. */
export class LoginPage {
  visit() {
    cy.visit("/");
    return this; // lets tests chain: loginPage.visit().login(...)
  }

  login(username: string, password: string) {
    cy.getByDataTest("username").type(username);
    cy.getByDataTest("password").type(password, { log: false }); // keeps it out of the command log
    cy.getByDataTest("login-button").click();
    return this;
  }

  // A getter, so the element is looked up when used, not when the page object is created
  get errorMessage() {
    return cy.getByDataTest("error");
  }
}

export const loginPage = new LoginPage();
