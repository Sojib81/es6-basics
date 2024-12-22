//Syntax: condition ? <expression if true> : <expression if false>
//using if else

if (authenticated) {
  renderApp();
} else {
  renderLogin();
}

//using ternary

authenticated ? renderApp() : renderLogin();
