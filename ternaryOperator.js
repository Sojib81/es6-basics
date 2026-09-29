//Syntax: condition ? <expression if true> : <expression if false>
const authenticated = true;
const renderApp = () => console.log("App");
const renderLogin = () => console.log("Login");

//using if else

if (authenticated) {
  renderApp();
} else {
  renderLogin();
}

//using ternary

authenticated ? renderApp() : renderLogin();
