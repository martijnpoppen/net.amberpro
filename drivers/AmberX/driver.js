const mainDriver = require('../main-driver');

module.exports = class driver_AmberX extends mainDriver {
    deviceType() {
        return 'AmberX';
    }
}