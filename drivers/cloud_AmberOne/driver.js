const cloudDriver = require('../cloud-driver');

module.exports = class driver_cloud_AmberOne extends cloudDriver {
    deviceType() {
        return 'Amber One';
    }

    sso() {
        return false;
    }
}