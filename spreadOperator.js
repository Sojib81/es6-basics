//The JavaScript spread operator (...) allows us to quickly copy all or part of an existing array or object into another array or object.

const numberOne = [1, 2, 3, 4, 5];
const numberTwo = [6, 7, 8, 9, 10];
const numbersCombined = [...numberOne, ...numberTwo];
console.log(numbersCombined);

const numbers = [1, 2, 3, 4, 5, 6];

const [one, two, ...rest] = numbers;

const myVehicle = {
  brand: "Ford",
  model: "Mustang",
  color: "red",
};

const updateMyVehicle = {
  type: "car",
  year: 2021,
  color: "yellow",
};

const myUpdatedVehicle = { ...myVehicle, ...updateMyVehicle };
/**
 * Notice the properties that did not match were combined, but the property that did match, color, was overwritten by the last object that was passed, updateMyVehicle. The resulting color is now yellow.
 */
