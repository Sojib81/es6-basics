class Car {
  constructor(carName) {
    this.brand = carName;
  }

  //Methods in classes

  present() {
    return "I have a car from " + this.brand;
  }
}

//class inheritance
class Model extends Car {
  constructor(carName, carModel) {
    super(carName);
    this.model = carModel;
  }

  show() {
    return this.present() + ", It is a " + this.model;
  }
}

const myCar = new Model("Ford", "Mustang");
const showMessage = myCar.show();
console.log(showMessage);
