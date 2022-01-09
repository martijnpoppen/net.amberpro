const mainDriver = require('../main-driver');

module.exports = class driver_AmberPlus extends mainDriver {
    deviceType() {
        return 'Amber';
    }

    sso() {
        return false;
    }
}