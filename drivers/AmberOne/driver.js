const localDriver = require('../local-driver');

module.exports = class driver_AmberOne extends localDriver {
    deviceType() {
        return 'Amber';
    }

    sso() {
        return false;
    }
}