const Homey = require('homey');
const Amber = require('../lib/amber');
const { encrypt, mapName, sleep } = require('../lib/helpers');

module.exports = class localDriver extends Homey.Driver {
    onInit() {
        this.homey.app.log('[Driver] - init', this.id);
        this.homey.app.log(`[Driver] - version`, Homey.manifest.version);
    }

    deviceType() {
        return 'other';
    }

    sso() {
        return false;
    }

    async onPair(session) {
        const discoveryStrategy = this.getDiscoveryStrategy();
        const discoveryResults = discoveryStrategy.getDiscoveryResults();
        let selectedDevice = null;

        session.setHandler('list_devices', async () => {
            try {
                const devices = Object.values(discoveryResults).map((discoveryResult) => {
                    return {
                        name: discoveryResult.txt.hostname,
                        data: {
                            id: `${discoveryResult.host}`
                        },
                        settings: {
                            mac: discoveryResult.txt.macaddr,
                            ip: `${mapName(discoveryResult.txt.hostname)}.local`,
                            sso: this.sso()
                        }
                    };
                });

                this.homey.app.log(`[Driver] ${this.id} - Found devices - `, devices);

                return devices;
            } catch (error) {
                this.homey.app.log(error);
                return Promise.reject(error);
            }
        });

        session.setHandler('list_devices_selection', async (data) => {
            selectedDevice = data[0];
            return selectedDevice;
        });

        session.setHandler('get_device', async (data) => {
            return session.showView('login_credentials');
        });

        session.setHandler('login', async (data) => {
            try {
                this.config = {
                    ...selectedDevice.settings,
                    debug: false,
                    secure: false,
                    username: data.username,
                    password: data.password
                };

                this.homey.app.log(`[Driver] ${this.id} - got config`, this.config);

                this._amberClient = await new Amber(this.config);

                this.amberData = await this._amberClient.getPowerState();

                if (this.amberData && this.amberData.status !== 200) {
                    throw new Error(this.homey.__('pair.error'));
                }

                selectedDevice.settings = {...this.config, password: encrypt(this.config.password)};
                return selectedDevice
            } catch (error) {
                console.log(error);
                throw new Error(this.homey.__('pair.error'));
            }
        });

        session.setHandler('add_device', async (data) => {
            try {
                return Promise.resolve(selectedDevice);
            } catch (error) {
              return Promise.reject(error);
            }
          });
    }
};
