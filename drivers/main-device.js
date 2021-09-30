const Homey = require('homey');
const Amber = require('../lib/amber');
const AmberRouter = require('../lib/amber-router');
const FTP = require('../lib/amber/ftp');
const { sleep, decrypt, encrypt, splitTime, removeFile, getFileName, getFilePath, mapHTML } = require('../lib/helpers');

module.exports = class mainDevice extends Homey.Device {
    async onInit() {
        try {
            const settings = this.getSettings();

            this.homey.app.log('[Device] - init =>', this.getName());
            this.homey.app.setDevices(this);

            if(!settings.mac || settings.mac.length < 8) {
                await this.findMacAddress();
            }

            await this.checkCapabilities();
        
            await this.setAmberClient();

            this.registerCapabilityListener('onoff', this.onCapability_ON_OFF.bind(this));
            this.registerCapabilityListener('dim', this.onCapability_DIM.bind(this));
            this.registerCapabilityListener('action_reboot', this.onCapability_REBOOT.bind(this));
            this.registerCapabilityListener('action_update_data', this.onCapability_UPDATE_DATA.bind(this));

            await this.checkOnOffState();
            await this.setCapabilityValues();

            if(settings.enable_interval) {
                await this.checkOnOffStateInterval(settings.update_interval);
                await this.setCapabilityValuesInterval(settings.update_interval);
            } 
            
            if(this.hasCapability('measure_wan_type') && !!settings.router_password) {
                await this.setFlowtriggers();
                await this.setRouterCheck();

                if(settings.enable_interval) {
                    await this.setRouterCheckInterval(settings.update_interval);
                }
            }

            await this.setAvailable();
        } catch (error) {
            this.homey.app.log(`[Device] ${this.getName()} - OnInit Error`, error);
        }
    }

    async onSettings({ oldSettings, newSettings, changedKeys }) {
        this.homey.app.log(`[Device] ${this.getName()} - oldSettings`, {...oldSettings, username: 'LOG', password: 'LOG'});
        this.homey.app.log(`[Device] ${this.getName()} - newSettings`, {...newSettings, username: 'LOG', password: 'LOG'});

        if(this.onPollInterval || this.onOnOffPollInterval || this.onRouterPollInterval) {
            this.clearIntervals();
        }

        if(newSettings.password !== oldSettings.password) {
            await this.setAmberClient({...newSettings, password: encrypt(newSettings.password)});
        } else {
            await this.setAmberClient(newSettings);
        }

        if(newSettings.enable_interval) {
            await this.checkOnOffStateInterval(newSettings.update_interval);
            await this.setCapabilityValuesInterval(newSettings.update_interval);

            if(this.hasCapability('measure_wan_type') && !!newSettings.router_password) {
                await this.setRouterCheckInterval(newSettings.update_interval);
            }
        }

        if(newSettings.password !== oldSettings.password) {
            this.savePassword(newSettings, 2000);
        }
    }

    async savePassword(settings, delay = 0) {
        this.homey.app.log(`[Device] ${this.getName()} - savePassword - encrypted`);
        
        if(delay > 0) {
            await sleep(delay);
        }

        await this.setSettings({...settings, password: encrypt(settings.password)});
    }

    async setAmberClient(overrideSettings = null) {
        const settings = overrideSettings ? overrideSettings : this.getSettings();
        this.config = {...settings, password: decrypt(settings.password)};

        this.homey.app.log(`[Device] - ${this.getName()} => setAmberClient Got config`, {...this.config, username: 'LOG', password: 'LOG'});

        this._amberClient = await new Amber(this.config);

        if(this.hasCapability('measure_wan_type') && !!this.config.router_password) {
            this._amberRouterClient = await new AmberRouter({ ip: 'latticerouter.local', password: this.config.router_password});
        }

        await this._amberClient.setFtp();
        this._ftp = await new FTP({...this.config, port: 21, path_prefix: `/home/${this.config.username}/homey-amber/`});
    }

    async checkCapabilities() {
        const driverManifest = this.driver.manifest;
        const driverCapabilities = driverManifest.capabilities;
        
        const deviceCapabilities = this.getCapabilities();

        this.homey.app.log(`[Device] ${this.getName()} - Found capabilities =>`, deviceCapabilities);
        this.homey.app.log(`[Device] ${this.getName()} - Driver capabilities =>`, driverCapabilities);
        
        if(deviceCapabilities.length !== driverCapabilities.length) {      
            await this.updateCapabilities(driverCapabilities, deviceCapabilities);
        }

        return deviceCapabilities;
    }

    async updateCapabilities(driverCapabilities, deviceCapabilities) {
        this.homey.app.log(`[Device] ${this.getName()} - Add new capabilities =>`, driverCapabilities);
        try {
            deviceCapabilities.forEach(c => {
                this.removeCapability(c);
            });
            await sleep(2000);
            driverCapabilities.forEach(c => {
                this.addCapability(c);
            });
            await sleep(2000);
        } catch (error) {
            this.homey.app.log(error)
        }
    }

    async setFlowtriggers() {
        this.routerConnectedTrigger = this.homey.flow.getDeviceTriggerCard(`trigger_router_connected`);
        this.routerDisonnectedTrigger = this.homey.flow.getDeviceTriggerCard(`trigger_router_disconnected`);

        this.routerConnectedTrigger.registerRunListener(async (args, state) =>  args.ip === state.ip || !args.ip);
        this.routerDisonnectedTrigger.registerRunListener(async (args, state) => args.ip === state.ip || !args.ip);
    }

    async findMacAddress() {
        try {
            const discoveryStrategy = this.homey.discovery.getStrategy("amberpro_discovery");

            // Use the discovery results that were already found
            const initialDiscoveryResults = discoveryStrategy.getDiscoveryResults();
            for (const discoveryResult of Object.values(initialDiscoveryResults)) {
                this.homey.app.log(`[Device] ${this.getName()} - findMacAddress =>`, discoveryResult);

                if(discoveryResult.txt && discoveryResult.txt.model && discoveryResult.txt.model.includes('AM')) {
                    const mac = discoveryResult.txt.macaddr;
                    const settings = this.getSettings();

                    await this.setSettings({...settings, mac});

                    this.homey.app.log(`[Device] ${this.getName()} - findMacAddress - address =>`, mac);
                }
            }
        } catch (error) {
            this.homey.app.log(error)
        }
    }

    async onCapability_ON_OFF(value) {
        const settings = this.getSettings();

        try {
            if(!value && settings && settings.override_onoff) {
                throw new Error(this.homey.__("amber.override_onoff"));
            }

            if(value) {
                this.homey.app.log(`[Device] ${this.getName()} - onoff - wakeUp`);
                
                await this._amberClient.wakeUp();
                throw new Error(this.homey.__("amber.onoff_turn_on"));
            } else {
                this.homey.app.log(`[Device] ${this.getName()} - onoff - shutdown`);
                
                await this._amberClient.shutdown();

                if(settings.enable_interval) {
                    await this.setUnavailable(this.homey.__("amber.shutdown"));
                }
                
                await sleep(6000);
            }

            return Promise.resolve(true);
        } catch (e) {
            this.homey.app.error(e);
            return Promise.reject(e);
        }
    }

    async onCapability_DIM(value) {
        try {
            await this._amberClient.setBrightness(value);

            return Promise.resolve(true);
        } catch (e) {
            this.homey.app.error(e);
            return Promise.reject(e);
        }
    }

    async onCapability_REBOOT(value) {
        try {
           this.homey.app.log(`[Device] ${this.getName()} - onCapability_REBOOT`, value);

           const state = this.getState();

           if(!state.onoff) {
                throw new Error(this.homey.__("amber.onoff_turn_on"));
           }

           this.setStoreValue('rebooting', true);
           this.setCapabilityValue('action_reboot', false);

           await this._amberClient.reboot();
           
           this.setUnavailable(this.homey.__("amber.reboot"));

           await this.clearIntervals();
           this.checkOnOffStateInterval(10);

            return Promise.resolve(true);
        } catch (e) {
            this.homey.app.error(e);
            return Promise.reject(e);
        }
    }

    async onCapability_UPDATE_DATA(value) {
        try {
           const settings = this.getSettings();
           this.homey.app.log(`[Device] ${this.getName()} - onCapability_UPDATE_DATA`, value);

           this.setCapabilityValue('action_update_data', false);

           this.checkOnOffState();
           this.setCapabilityValues();

            return Promise.resolve(true);
        } catch (e) {
            this.homey.app.error(e);
            return Promise.reject(e);
        }
    }

    async onCapability_UPLOAD_FILE(value) {
        try {
           let filePath = null;
           let fileName = null;

           this.homey.app.log(`[Device] ${this.getName()} - onCapability_UPLOAD_FILE`, value);

            if(!!value.localUrl) {
                fileName = `${value.id}.jpg`
                filePath = await getFilePath(value.localUrl, fileName);

                this.homey.app.log(`[Device] ${this.getName()} - onCapability_UPLOAD_FILE - uploading Image`, value.localUrl, value.id);
                
            } else if(typeof value === 'string') {
                fileName = await getFileName(value);
                filePath = await getFilePath(value, fileName);
            
                this.homey.app.log(`[Device] ${this.getName()} - onCapability_UPLOAD_FILE - uploading File`, value, fileName);
            }
           
            if(!fileName.includes('.')) {
                throw new Error(this.homey.__("amber.file_invalid"));
            }

            await this._ftp.upload(filePath, fileName);

            await sleep(200);
            await removeFile(filePath);

            return Promise.resolve(true);
        } catch (e) {
            this.homey.app.error(e);
            return Promise.reject(e);
        }
    }

    async checkOnOffState() {
        try {  
            const powerState = await this._amberClient.getPowerState();

            this.homey.app.log(`[Device] ${this.getName()} - checkOnOffState`, powerState);

            if(powerState && powerState.status === 200) {
                await this.setCapabilityValue('onoff', true);
                await this.unsetWarning();
            } else {
                await this.setCapabilityValue('onoff', false);
            }

            await this.checkRebootState();
        } catch (error) {
            this.homey.app.log(`[Device] ${this.getName()} - checkOnOffState`, error);
            await this.setCapabilityValue('onoff', false);
            await this.checkRebootState();
        }
    }

    async checkRebootState() {
        const settings = this.getSettings();
        const isOn = await this.getCapabilityValue('onoff');
        
        if(isOn && this.getStoreValue('rebooting')) {
            this.homey.app.log(`[Device] ${this.getName()} - checkRebootState - reboot done`);
            this.setStoreValue('rebooting', false);
            
            await this.setAvailable();
            
            await this.clearIntervals();

            if(settings.enable_interval) {
                await this.checkOnOffStateInterval(settings.update_interval);
                await this.setCapabilityValuesInterval(settings.update_interval);

                if(this.hasCapability('measure_wan_type') && !!settings.router_password) {
                    await this.setRouterCheckInterval(settings.update_interval);
                }
            }
        } else if(!this.getStoreValue('rebooting')) {
            await this.setAvailable();
        }
    }

    async checkOnOffStateInterval(update_interval) {
        try {  
            const REFRESH_INTERVAL = 1000 * update_interval;

            this.homey.app.log(`[Device] ${this.getName()} - onOnOffPollInterval =>`, REFRESH_INTERVAL, update_interval);
            this.onOnOffPollInterval = setInterval(this.checkOnOffState.bind(this), REFRESH_INTERVAL);
        } catch (error) {
            this.setUnavailable(error)
            this.homey.app.log(error);
        }
    }

    async setCapabilityValues() {
        this.homey.app.log(`[Device] ${this.getName()} - setCapabilityValues`);

        try { 
            const isOn = await this.getCapabilityValue('onoff');

            if(!isOn) {
                throw new Error(`[Device] ${this.getName()} - setCapabilityValues - device off`)
            }

            const deviceInfo = await this._amberClient.getInfo();

            if(deviceInfo.error) {
                throw new Error(`[Device] ${this.getName()} - setCapabilityValues`, deviceInfo.error)
            }

            const {temperature, uptime_sec} = deviceInfo;
            const { disk_usage } = await this.setDiskUsage(deviceInfo);
            const { cpu_load, ram_load } = await this.setLoad(deviceInfo);

            this.homey.app.log(`[Device] ${this.getName()} - deviceInfo =>`, deviceInfo);
            
            await this.setCapabilityValue('alarm_heat.cpu', !!temperature.system > 75 );
            await this.setCapabilityValue('alarm_heat.system', !!temperature.cpu > 95);
            await this.setCapabilityValue('measure_temperature.system', parseInt(temperature.system));
            await this.setCapabilityValue('measure_temperature.cpu', parseInt(temperature.cpu));
            await this.setCapabilityValue('measure_uptime', parseInt(uptime_sec) / 3600);
            await this.setCapabilityValue('measure_uptime_days', splitTime(uptime_sec, this.homey.__));
            await this.setCapabilityValue('measure_disk_usage', parseInt(disk_usage));
            await this.setCapabilityValue('measure_cpu_usage', parseInt(cpu_load));
            await this.setCapabilityValue('measure_ram_usage', parseInt(ram_load));
        } catch (error) {
            this.homey.app.log(error);
        }
    }

    async setCapabilityValuesInterval(update_interval) {
        try {  
            const REFRESH_INTERVAL = 1000 * update_interval;

            this.homey.app.log(`[Device] ${this.getName()} - onPollInterval =>`, REFRESH_INTERVAL, update_interval);
            this.onPollInterval = setInterval(this.setCapabilityValues.bind(this), REFRESH_INTERVAL);
        } catch (error) {
            this.setUnavailable(error)
            this.homey.app.log(error);
        }
    }

    async setRouterCheck() {
        this.homey.app.log(`[Device] ${this.getName()} - setRouterCheck`);

        try { 
            const isOn = await this.getCapabilityValue('onoff');
            const wanType = await this._amberRouterClient.getWanType();
            const connectedDevices = this.getStoreValue('connected_devices');

            this.homey.app.log(`[Device] ${this.getName()} - setRouterCheck => wanType`, wanType);

            if(!isOn) {
                throw new Error(`[Device] ${this.getName()} - setRouterCheck - device off`)
            }

            if(wanType.status !== 200) {
                throw new Error(`[Device] ${this.getName()} - setRouterCheck`, wanType.error)
            }

            this.setCapabilityValue('measure_wan_type', wanType.connectionType)

            if(wanType.connectionType && wanType.connectionType === 'DHCP') {
                const clientList = await this._amberRouterClient.getClientList();
                this.homey.app.log(`[Device] ${this.getName()} - setRouterCheck => clientList`, clientList);

                const connectedDevicesDiff = mapHTML(clientList.data);

                this.setStoreValue('connected_devices', connectedDevicesDiff);

                this.homey.app.log(`[Device] ${this.getName()} - setRouterCheck => connectedDevices`, connectedDevices, connectedDevicesDiff);

                if(connectedDevices.length) {
                    const disconnnectedDeviceDiff = connectedDevices.filter(e => !connectedDevicesDiff.includes(e));;
                    const connnectedDeviceDiff = connectedDevicesDiff.filter(e => !connectedDevices.includes(e));;
                    
                    connnectedDeviceDiff.forEach(async ip =>  {
                        await this.routerConnectedTrigger.trigger(this, {ip}, {ip})
                            .catch( this.error )
                            .then(this.log(`[setRouterCheck] trigger_router_connected - Triggered: "${ip}"`)); 
                      });

                      disconnnectedDeviceDiff.forEach(async ip =>  {
                        await this.routerDisonnectedTrigger.trigger(this, {ip}, {ip})
                            .catch( this.error )
                            .then(this.log(`[setRouterCheck] trigger_router_disconnected - Triggered: "${ip}"`)); 
                      });
                }
            }
        } catch (error) {
            this.homey.app.log(error);
        }
    }

    async setRouterCheckInterval(update_interval, enabled = true) {
        try {  
            const REFRESH_INTERVAL = 1000 * update_interval;

            this.homey.app.log(`[Device] ${this.getName()} - onRouterPollInterval =>`, REFRESH_INTERVAL, update_interval);
            
            if(enabled) {
                this.onRouterPollInterval = setInterval(this.setRouterCheck.bind(this), REFRESH_INTERVAL);
            }
        } catch (error) {
            this.setUnavailable(error)
            this.homey.app.log(error);
        }
    }

    async setDiskUsage(data) {
        try {
            let space = data.volume[0].spaceuse;
            space = space.replace('%', '');


            const usage = {disk_usage: space};
            this.homey.app.log(`[Device] ${this.getName()} - setDiskUsage`, space);

            return usage;
        } catch (error) {
            this.setUnavailable(error)
            this.homey.app.log(error);
        }
    }

    async setLoad(data) {
        try {
            let cpu_load = 0;
            let ram_load = 0;

            cpu_load = data.cpu.percent
            ram_load = data.mem.real_usage_percent;
    
            const usage = {cpu_load, ram_load};
            this.homey.app.log(`[Device] ${this.getName()} - setLoad`, usage);

            return usage;
        } catch (error) {
            this.setUnavailable(error)
            this.homey.app.log(error);
        }
    }

    async clearIntervals() {
        this.homey.app.log(`[Device] ${this.getName()} - clearIntervals`);

        await clearInterval(this.onPollInterval);
        await clearInterval(this.onOnOffPollInterval);
        await clearInterval(this.onRouterPollInterval);
    }

    onDeleted() {
        this.clearIntervals();
    }
}