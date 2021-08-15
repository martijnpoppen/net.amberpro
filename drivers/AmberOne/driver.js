const mainDriver = require('../main-driver');

module.exports = class driver_AmberOne extends mainDriver {
    deviceType() {
        return 'AmberOne';
    }
}