const localDriver = require('../local-driver');

module.exports = class driver_AmberX extends localDriver {
  deviceType() {
    return "AL1111";
  }

  sso() {
      return true;
  }
};
