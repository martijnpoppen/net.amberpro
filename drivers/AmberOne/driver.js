const localDriver = require('../local-driver');

module.exports = class driver_AmberOne extends localDriver {
    deviceType() {
        return 'AM1212-1';
    }

    sso() {
        return false;
    }
}