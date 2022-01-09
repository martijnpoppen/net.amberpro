const cloudDriver = require('../cloud-driver');

module.exports = class driver_cloud_AmberPlus extends cloudDriver {
    deviceType() {
        return 'Amber Plus';
    }

    sso() {
        return false;
    }
}