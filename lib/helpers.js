const Homey = require('homey');
const crypto = require('crypto');
const path = require('path');

const algorithm = 'aes-256-ctr';
const secretKey = Homey.env.SECRET;
const secretKeyLegacy = Homey.env.SECRET_OLD;
const iv = crypto.randomBytes(16);

exports.sleep = async function (ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

exports.rand = function() {
    return Math.floor(Math.random() * 100000);
}

exports.splitTime = function(uptime, i18n){
    const numberOfHours = parseInt(uptime) / 3600;
    const Days = Math.floor(numberOfHours/24);
    const Remainder = numberOfHours % 24;
    const Hours = Math.floor(Remainder);
    const Minutes = Math.floor(60*(Remainder-Hours));
    return `${Days} ${i18n("helpers.days")} - ${Hours} ${i18n("helpers.hours")} - ${Minutes} ${i18n("helpers.minutes")}`;
}

exports.encrypt = function (text, legacy = false) {
    const secret = legacy ? secretKeyLegacy : secretKey;
    const cipher = crypto.createCipheriv(algorithm, secret, iv);
    const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
    return `${iv.toString('hex')}+${encrypted.toString('hex')}`;
};

exports.decrypt = function (hash, legacy = false) {
    if(hash === null) {
         return hash;
    }

    const secret = legacy ? secretKeyLegacy : secretKey;
    const splittedHash = hash.split('+');
    const decipher = crypto.createDecipheriv(algorithm, secret, Buffer.from(splittedHash[0], 'hex'));

    const decrpyted = Buffer.concat([decipher.update(Buffer.from(splittedHash[1], 'hex')), decipher.final()]);

    return decrpyted.toString();
};

exports.getFileName = function(filename) {
    let name = filename;
    if(filename.includes('?')) {
        name = filename.split('?')[0];
    }
    const ext = path.basename(name||'');
    return ext;
};

exports.mapHTML = function(clientList) {
    const connectedDevices = [];
    const devicesArray = clientList.match(/(?<=<tr>)(.*?)(?=<\/tr>)/g).filter(f => f.includes('<td>'));

    devicesArray.forEach(deviceRow => {
        const device = deviceRow.match(/(?<=<td>)(.*?)(?=<\/td>)/g);
        connectedDevices.push(device[2]);
    });

    return connectedDevices;
}

exports.mapName = function (value) {
    return value
        .replace(/[^0-9A-Za-z]/g, '-')
        .replace(/-{2,}/g, '-')
        .toLowerCase();
};