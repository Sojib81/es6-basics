//Old way to assign array items to variables
const vehicles = ["Mustang", "L-150", "expedition"];

const car = vehicles[0];
const truck = vehicles[1];
const suv = vehicles[2];

//New way to assign the array items to variables

const vehicles1 = ["Mustang", "L-150", "expedition"];
const [car_name, truck_name, suv_name] = vehicles1;

//If we only want the car and suv we can simply leave out the truck but keep the comma:

const [car_n, , suv_n] = vehicles1;

//Destructuring Objects

//Old way
const vehicleOne = {
  brand: "Ford",
  color: "red",
  type: "car",
  model: "Mustang",
  year: "2021",
};

myVehicle(vehicleOne);
//old way
function myVehicle(vehicle) {
  const message =
    "My vehicle " +
    vehicle.type +
    "is a " +
    vehicle.color +
    vehicle.brand +
    vehicle.year;
}

//with destructuring

const vehicleTwo = {
  brand: "Ford",
  color: "red",
  type: "car",
  model: "Mustang",
  year: "2021",
};

myVehicle(vehicleTwo);

function myVehicleTwo({ type, color, model, brand }) {
  const message =
    "My " + type + " is a " + color + " " + brand + " " + model + ".";
}
