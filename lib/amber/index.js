const https = require('https');
const axios = require('axios');
const ftp = require('basic-ftp');
const {getFilePath, removeFile } = require('./helpers');


class Amber {
    constructor(params) {
        this.ip = params.ip;
        this.mac = params.mac;
        this.secure = params.secure || false;
        this.timeout = parseInt(params.timeout) || 5000; //request timeout

        this._isDebugMode = params.debug || false;

        this.username = params.username;
        this.password = params.password;
        this.router_password = params.router_password || null;
        this.auth = {
            access_token: '', //session id
            time: '', //unix time
            expires_in: 0 //in sec
        };

        this.router_auth = {
            access_token: '', //session id
            time: '', //unix time
            expires_in: 0 //in sec
        };

        this.url = 'http' + (this.secure ? 's' : '') + '://' + this.ip;
        this.router_url = 'http' + (this.secure ? 's' : '') + '://latticerouter.local';

        this.axiosClient = axios.create({
            httpsAgent: new https.Agent({
                rejectUnauthorized: false
            }),
            timeout: 0
        });
    }

    /**
     * Utility function which returns the current time in the format hh:mm:ss.us.
     *
     * @private
     *
     * @returns {string} Current time in the format hh:mm:ss.us.
     */
    getTime() {
        var now = new Date();

        var paddingHead = function (num, size) {
            var str = num + '';

            while (str.length < size) {
                str = '0' + str;
            }

            return str;
        };

        var paddingTail = function (num, size) {
            var str = num + '';

            while (str.length < size) {
                str = str + '0';
            }

            return str;
        };

        return '' + paddingHead(now.getHours(), 2) + ':' + paddingHead(now.getMinutes(), 2) + ':' + paddingHead(now.getSeconds(), 2) + '.' + paddingTail(now.getMilliseconds(), 3);
    }

    _error = function (errorInfo, funcName) {
        if (true === this._isDebugMode) {
            console.log(errorInfo, funcName);
        }
    };

    /**
     * Make a HTTP request.
     * Note, the response will always be in JSON format.
     *
     * @private
     *
     * @param {Object}  options             - Options.
     * @param {string}  options.method      - HTTP method ("GET", "POST", etc.).
     * @param {string}  options.path        - The path is the relative request URI, which will be appended to the base URI.
     * @param {Object}  [options.headers]   - HTTP request headers.
     * @param {Object}  [options.data]      - HTTP body data.
     *
     * @returns {Promise} Requested data.
     */
     _makeRequest = function(url = '', options, router = false) {
        var funcName    = "_makeRequest()";
        var _this       = this;
        var reqOptions  = {
            method: "GET",
            withCredentials: true
        };
 
         if (true === _this._isDebugMode) {
             console.log(`this.url`, router ? this.router_url : this.url);
         }
        
        if ("object" !== typeof options) {
            return Promise.reject(this._error("Options is missing.", funcName));
        }
 
        if ("string" !== typeof options.method) {
            return Promise.reject(this._error("HTTP method is missing.", funcName));
        }
 
        if ("string" !== typeof options.path && url === '') {
            return Promise.reject(this._error("Path is missing.", funcName));
        }
 
        reqOptions.method = options.method;
 
        if(options.responseType) {
            reqOptions.responseType = options.responseType;
        }
 
        if (options.https && "object" === typeof options.https) {
            reqOptions.https = options.https;
        }
 
        if (options.headers && "object" === typeof options.headers) {
            reqOptions.headers = options.headers;
        }
 
        if (options.data) {
            reqOptions.data = options.data;
        }    
 
        reqOptions.url = options.path ? options.path : url; 
        reqOptions.url = router ? `${this.router_url}${reqOptions.url}` : `${this.url}${reqOptions.url}`;
 
 
        if (true === _this._isDebugMode) {
         console.log(`reqOptions`, reqOptions);
     }
 
        return this.axiosClient(reqOptions).then(function(result) {
            var description = "";
 
            if (true === _this._isDebugMode) {
                console.log(result);
                console.log("----------");
                console.log(JSON.stringify(result.data, null, 2));
            }
 
            if (200 !== result.status) {
                return Promise.reject(_this._error("Bad request.", funcName));
            }
 
            if (result.data.error && result.data.error !== '0000') {  
                description = result.data.error;      
                return Promise.reject(_this._error(description, funcName));
            }
 
            if(typeof result.data.data === 'object') {
                 return Promise.resolve({...result.data.data, status: result.status});
            }
            
            return Promise.resolve({...result.data, status: result.status});
        }).catch(error => {
             _this._error(error, funcName)

             if(error && error.data && error.data.message) {
                return Promise.reject(error.data.message);
             }
             
             return Promise.reject(error);
         });;
    };

    /**
     * check if the sid is still valid
     * @returns {string|boolean}
     */
    isLoggedIn() {
        return this.auth.access_token && this.auth.time + this.auth.timeout > ((new Date() / 1e3) | 0) ? true : false;
    }

    /**
     * Login to your diskstation
     * @return {Promise}
     */
    _login = async function () {
        try {
            if (this.isLoggedIn()) {
                return Promise.resolve({ status: 'loggedin' });
            } else {
                const apiUrl = '/api/auth/auth';
                const options = {
                    data: {
                        username: this.username,
                        password: this.password
                    },
                    method: 'POST'
                };

                const login = await this._makeRequest(apiUrl, options);

                if (login && login.access_token.length) {
                    if ('error' in login) {
                        return Promise.reject({ error: login.error.code });
                    } else {
                        this.auth.access_token = login.access_token;
                        this.auth.timeout = login.expires_in;
                        this.auth.time = (new Date() / 1e3) | 0;

                        return Promise.resolve(login);
                    }
                } else {
                    return Promise.reject({ error: login.error });
                }
            }
        } catch (e) {
            return Promise.reject({ error: e.error });
        }
    };

    /**
     * get the power State of your Diskstation
     * @param callback
     */
    getPowerState = async function () {
        const login = await this._login();
        if (true === this._isDebugMode) {
            console.log(login);
        }

        const apiUrl = '/api/system/get_status';
        const options = {
            headers: { Cookie: `authorization_code=${this.auth.access_token}` },
            method: 'POST'
        };

        return this._makeRequest(apiUrl, options);
    };

    reboot = async function () {
        const login = await this._login();
        if (true === this._isDebugMode) {
            console.log(login);
        }

        const apiUrl = '/api/system/reboot';
        const options = {
            headers: { Cookie: `authorization_code=${this.auth.access_token}` },
            method: 'POST'
        };

        return this._makeRequest(apiUrl, options);
    };

    /**
     * Wake on LAN support for Diskstation
     * wol has to be enabled
     * @param callback
     */
    wakeUp = async function () {
        var that = this;

        return new Promise((resolve, reject) => {
            wol.wake(that.mac, function (err) {
                if (!err) {
                    resolve(true);
                } else {
                    reject(err);
                }
            });
        });
    };

    /**
     * Shutdown your Diskstation
     * @param callback
     */
    shutdown = async function () {
        const login = await this._login();
        if (true === this._isDebugMode) {
            console.log(login);
        }

        const apiUrl = '/api/system/poweroff';
        const options = {
            headers: { Cookie: `authorization_code=${this.auth.access_token}` },
            method: 'POST'
        };

        return this._makeRequest(apiUrl, options);
    };

    /**
   

   /**
    * Gets the current disk/volume usage quote
    * returns the average if there are more than one volume
    * @param callback
    */
    getDiskUsage = async function () {
        const login = await this._login();
        if (true === this._isDebugMode) {
            console.log(login);
        }

        const options = {
            headers: { Cookie: `authorization_code=${this.auth.access_token}` },
            method: 'POST'
        };

        var apiUrl = '/api/storage/get_volume_info_list';

        return this._makeRequest(apiUrl, options);
    };

    getPairing = async function () {
        const login = await this._login();
        if (true === this._isDebugMode) {
            console.log(login);
        }

        const apiUrl = '/api/batch/commit';

        const options = {
            data: {
                des: [
                    ['system', 'get_system_name', [], {}],
                    ['system', 'get_sku_no', [], {}],
                    ['system', 'get_serial_no', []]
                ],
                blocking: true
            },
            headers: { Cookie: `authorization_code=${this.auth.access_token}` },
            method: 'POST'
        };

        return this._makeRequest(apiUrl, options);
    };

    getModel = async function () {
        const login = await this._login();
        if (true === this._isDebugMode) {
            console.log(login);
        }

        const apiUrl = '/api/system/get_sku_no';

        const options = {
            headers: { Cookie: `authorization_code=${this.auth.access_token}` },
            method: 'POST'
        };

        return this._makeRequest(apiUrl, options);
    };

    getInfo = async function () {
        const login = await this._login();
        if (true === this._isDebugMode) {
            console.log(login);
        }

        const apiUrl = '/api/system/get_sys_info';

        const options = {
            data: { components: 'all', first_call: true },
            headers: { Cookie: `authorization_code=${this.auth.access_token}` },
            method: 'POST'
        };

        return this._makeRequest(apiUrl, options);
    };

    setFtp = async function () {
        const login = await this._login();
        if (true === this._isDebugMode) {
            console.log(login);
        }

        const apiUrl = '/api/batch/commit';

        const options = {
            data: { des: [['fileshare', 'set_service', [], { service: 'ftp', enable: true }]], blocking: true },
            headers: { Cookie: `authorization_code=${this.auth.access_token}` },
            method: 'POST'
        };

        return this._makeRequest(apiUrl, options);
    };

    setBrightness = async function (value) {
        const login = await this._login();
        if (true === this._isDebugMode) {
            console.log(login);
        }

        const apiUrl = '/api/batch/commit';

        const options = {
            data: { des: [['hwmonitor', 'set_led_brightness', [], { percentage: value }]], blocking: true },
            headers: { Cookie: `authorization_code=${this.auth.access_token}` },
            method: 'POST'
        };

        return this._makeRequest(apiUrl, options);
    };

    // -------------------------------------------------- ROUTER ------------------------------
    isRouterLoggedIn() {
        return this.router_auth.access_token && this.router_auth.time + this.router_auth.timeout > ((new Date() / 1e3) | 0) ? true : false;
    }

    _routerLogin = async function () {
        try {
            if(this.isRouterLoggedIn()) {
                return Promise.resolve({"status": "loggedin"});
            } else {
 
                const apiUrl = '/cgi-bin/login.cgi';
                const options = {
                     data: {
                        Password: this.router_password,
                    },
                    method: 'POST'
                };
 
                const login = await this._makeRequest(apiUrl, options, true);

                if(login && login.name && login.name.length) {
                    if (login.error && login.error !== '0000') {
                         return Promise.reject({error: login.error});
                    } else {
                        this.router_auth.access_token = login.name;
                        this.router_auth.timeout = 500;
                        this.router_auth.time = (new Date / 1e3 | 0);
 
                        return Promise.resolve(login);
                    }
                } else {
                    return Promise.reject({error: login.error});
                }
            }
        } catch (e) {
            return Promise.reject({error: e.error});
        }
    };

    getWanType = async function () {
        const login = await this._routerLogin();
        if (true === this._isDebugMode) {
            console.log(login);
        }

        const apiUrl = '/cgi-bin/get_info.cgi';
        const options = {
            headers: { Cookie: `name=${this.router_auth.access_token}` },
            method: 'POST',
            data: {
                action: 'get_wan_type'
            }
        };

        return this._makeRequest(apiUrl, options, true);
    };

    getClientList = async function () {
        const login = await this._routerLogin();
        if (true === this._isDebugMode) {
            console.log(login);
        }

        const apiUrl = '/client_list.shtml';
        const options = {
            headers: { Cookie: `name=${this.router_auth.access_token}` },
            method: 'POST',
            responseType: 'text'
        };

        return this._makeRequest(apiUrl, options, true);
    };



    // -------------------------------------------------- FTP ------------------------------
    async upload(sourcePath, fileName) {
        const settings = {
            host: this.ip,
            user: this.username,
            password: this.password,
            port: 21, 
            path_prefix: `/home/admin/homey-amber/`,
            secure: true,
            secureOptions: { rejectUnauthorized: false }
        }

        const ftps = new ftp.Client()

        try {
            const filePath = await getFilePath(sourcePath, fileName);

            await ftps.access(settings)
            await ftps.ensureDir(settings.path_prefix)
            await ftps.appendFrom(filePath, fileName)
            await removeFile(filePath);
        }
        catch(err) {
            console.log(err)
        }
    }
}

module.exports = Amber;
