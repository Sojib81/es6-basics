//before

hello = function () {
  return "Hello react";
};

//With Arrow Functions

hello = () => {
  return "hello react";
};

//If the function returns only one statement, By default arrow functions return value

hello = () => "hello react!";

//This will work if it has only one statement

//################################

//If i have parameters i need to passed them into parentheses. Example:

hello = (value) => "Say hello to parameter, hello " + value;
const helloWorld = hello("world");
console.log(helloWorld);

//With arrow functions , the this keyword always represents the object that defined the arrow function.
