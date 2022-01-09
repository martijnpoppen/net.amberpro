const localDriver = require('../local-driver');

module.exports = class driver_AmberPlus extends localDriver {
    deviceType() {
        return 'Amber';
    }

    sso() {
        return false;
    }
}