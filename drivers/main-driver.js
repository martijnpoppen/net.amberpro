const Homey = require('homey');
const AmberCloud = require('../lib/amber-cloud');
const Amber = require('../lib/amber');
const { encrypt, mapName, sleep } = require('../lib/helpers');

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
                    secure: false,
                    username: data.username,
                    password: data.password
                };

                this.homey.app.log(`[Driver] ${this.id} - got config`, this.config);
    
                this._amberCloudClient = await new AmberCloud(this.config);
                
                this.amberCloudData = await this._amberCloudClient.getNodes();


                if(this.amberCloudData && this.amberCloudData.status !== 200) {
                    throw new Error(this.homey.__('pair.error'));
                } else if(this.amberCloudData && !this.amberCloudData.hasOwnProperty('items')) {
                    throw new Error(this.homey.__('pair.error_empty'));
                }
            } catch (error) {
                throw new Error(this.homey.__('pair.error'));
            }
        });

        session.setHandler("list_devices", async () => {
            this.results = [];
            this.homey.app.log(`[Driver] ${this.id} - this.amberCloudData`, this.amberCloudData);


            this.amberCloudData.items.forEach(node => {
                if(node.extra.data.model === this.deviceType()) {
                    this.results.push({
                        name: node.name,
                        data: {
                            id: `${node.id}`,
                        },
                        settings: {
                            ...this.config,
                            mac: node.extra.data.macaddr.eth0,
                            ip: `${mapName(node.name)}.local`,
                            username: this.config.username,
                            password: encrypt(this.config.password),
                            sso: node.extra.data.sso
                        }
                    });
                }
            });

            this.homey.app.log(`[Driver] ${this.id} - Found devices - `, this.results);

            return this.results;
        });
    }
}