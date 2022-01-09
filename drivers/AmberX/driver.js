const localDriver = require('../local-driver');

module.exports = class driver_AmberX extends localDriver {
  deviceType() {
    return "Amber X";
  }

  sso() {
      return true;
  }
};
