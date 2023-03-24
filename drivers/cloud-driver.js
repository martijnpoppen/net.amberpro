const Homey = require('homey');
const AmberPro = require('../lib/amber-pro');
const { encrypt } = require('../lib/helpers');

module.exports = class mainDriver extends Homey.Driver {
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
        session.setHandler('instructions', async (data) => {
            return session.showView('login_credentials');
        });

        session.setHandler('login', async (data) => {
            try {
                this.config = {
                    debug: false,
                    mac: null,
                    secure: false,
                    cloud: true,
                    sso: this.sso(),
                    username: 'admin',
                    password: data.password,
                    ip: data.username
                };

                this.homey.app.log(`[Driver] ${this.id} - got config`, this.config);

                this._amberClient = await new AmberPro({ ...this.config, url: this.config.ip });

                this.amberData = await this._amberClient.getInfo();

                if (this.amberData && this.amberData.status != 200) {
                    throw new Error(this.homey.__('pair.error'));
                }

                return true;
            } catch (error) {
                console.log(error);
                throw new Error(this.homey.__('pair.error'));
            }
        });

        session.setHandler('list_devices', async () => {
            this.results = [];
            this.homey.app.log(`[Driver] ${this.id} - this.amberData`, this.amberData);

            this.results.push({
                name: this.deviceType(),
                data: {
                    id: `${this.id}-${this.amberData.network[0].mac}`
                },
                settings: {
                    ...this.config,
                    password: encrypt(this.config.password)
                }
            });

            this.homey.app.log(`[Driver] ${this.id} - Found devices - `, this.results);

            return this.results;
        });
    }
};
