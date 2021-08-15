const Homey = require('homey');
const Amber = require('../lib/amber');
const { encrypt } = require('../lib/helpers');

module.exports = class mainDriver extends Homey.Driver {
    onInit() {
        this.homey.app.log('[Driver] - init', this.id);
        this.homey.app.log(`[Driver] - version`, Homey.manifest.version);
    }

    deviceType() {
        return 'other';
    }

    async onPair(session) {
        session.setHandler("login", async (data) => {
            try {
                this.config = {
                    debug: false,
                    mac: null,
                    secure: data.secure || false,
                    ip: data.ip || 'latticenode.local',
                    username: data.username,
                    password: data.password,
                    timeout: 3000
                };
                this.homey.app.log(`[Driver] - got config`, this.config);
    
                this._amberClient = await new Amber(this.config);
                
                this.amberData = await this._amberClient.getPairing();
            } catch (error) {
                throw new Error(this.homey.__('pair.error'));
            }
        });

        session.setHandler("list_devices", async () => {
            let results = [];

            if(this.amberData && this.amberData.status !== 200) {
                throw new Error(this.homey.__('pair.error'));
            } else if(this.amberData && !this.amberData[0].hasOwnProperty('data')) {
                throw new Error(this.homey.__('pair.error_empty'));
            }

            this.homey.app.getDevices().forEach((device) => {
                const data = device.getData();
                pairedDriverDevices.push(data.id);
            });

            results.push({
                name: `${this.amberData[0].data} - ${this.amberData[1].data}`,
                data: {
                    id: `${this.id}-${this.amberData[2].data}`,
                },
                settings: {
                    ...this.config,
                    password: encrypt(this.config.password)
                }
            });

            this.homey.app.log("Found devices - ", results);

            return results;
        });
    }
}