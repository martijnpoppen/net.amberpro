const localDriver = require('../local-driver');

module.exports = class driver_AmberPlus extends localDriver {
    deviceType() {
        return 'AM1212-2';
    }

    sso() {
        return false;
    }
}