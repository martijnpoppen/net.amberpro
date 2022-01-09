const cloudDriver = require('../cloud-driver');

module.exports = class driver_cloud_AmberX extends cloudDriver {
  deviceType() {
    return "Amber X";
  }

  sso() {
      return true;
  }
};
