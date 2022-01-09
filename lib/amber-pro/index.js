const https = require('https');
const axios = require('axios');
const fs = require('fs');

class Amber  {
   constructor(params) {
       this.url = params.ip;
       this.secure = params.secure || true;
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
   
    //    this.url = 'http' + (this.secure ? 's' : '') + '://' + this.ip;

       this.axiosClient = axios.create({
            baseURL: this.url,
            httpsAgent: new https.Agent({  
                rejectUnauthorized: false
            }),
            timeout: 0
      });
   };



   /**
    * Utility function which returns the current time in the format hh:mm:ss.us.
    * 
    * @private
    * 
    * @returns {string} Current time in the format hh:mm:ss.us.
    */
   getTime() {

       var now = new Date();

       var paddingHead = function(num, size) {
           var str = num + "";

           while (str.length < size) {
               str = "0" + str;
           }

           return str;
       };

       var paddingTail = function(num, size) {
           var str = num + "";

           while (str.length < size) {
               str = str + "0";
           }

           return str;
       };

       return "" + paddingHead(now.getHours(), 2) + ":" +
           paddingHead(now.getMinutes(), 2) + ":" +
           paddingHead(now.getSeconds(), 2) + "." +
           paddingTail(now.getMilliseconds(), 3);
   };


   _error = function(errorInfo, funcName) {
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
   _makeRequest = function(url = '', options) {
       var funcName    = "_makeRequest()";
       var _this       = this;
       var reqOptions  = {
           method: "GET",
           withCredentials: true
       };

        if (true === _this._isDebugMode) {
            console.log(`this.url`, this.url);
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
            return Promise.reject(_this._error(error, funcName));
        });;
   };
   
   
   isLoggedIn() {
       return (this.auth.access_token && (this.auth.time + this.auth.timeout) > (new Date / 1e3 | 0)) ? true : false;
   };
   

   _login = async function() {
       try {
           if(this.isLoggedIn()) {
               return Promise.resolve({"status": "loggedin"});
           } else {

               const apiUrl = '/login';
               const options = {
                    data: {
                       username: this.username,
                       password: this.password,
                   },
                   method: 'POST'
               };

               const login = await this._makeRequest(apiUrl, options);

               if(login && login.access_token.length) {
                   if ('error' in login) {
                        return Promise.reject({error: login.error.code});
                   } else {
                       this.auth.access_token = login.access_token;
                       this.auth.timeout = login.expires_in;
                       this.auth.time = (new Date / 1e3 | 0);

                       return Promise.resolve(login);
                   }
               } else {
                   return Promise.reject({error: login.error});
               }
           }
       } catch (e) {
            return Promise.reject({error: e});
       }
   };
   
   getPowerState = async function() {
       const login = await this._login();
       if (true === this._isDebugMode) {
           console.log(login);
       }
   
       const apiUrl = '/power-state';
       const options = {
            headers: { 'X-Secret-Token': this.auth.access_token },
            method: 'GET'
        }
   
       return this._makeRequest(apiUrl, options);    
   };


   reboot = async function() {
        const login = await this._login();
        if (true === this._isDebugMode) {
            console.log(login);
        }

        const apiUrl = '/reboot';
        const options = {
            headers: { 'X-Secret-Token': this.auth.access_token },
            method: 'POST'
        }

        return this._makeRequest(apiUrl, options);    
    };


   shutdown = async function() {
        const login = await this._login();
        if (true === this._isDebugMode) {
            console.log(login);
        }

        const apiUrl = '/shutdown';
        const options = {
            headers: { 'X-Secret-Token': this.auth.access_token },
            method: 'POST'
        }

        return this._makeRequest(apiUrl, options);    
   };
   
   getDiskUsage = async function() {
       const login = await this._login();
       if (true === this._isDebugMode) {
           console.log(login);
       }

       const options = {
            headers: { 'X-Secret-Token': this.auth.access_token },
            method: 'GET'
       }
   
       var apiUrl = '/disk-usage';

       return this._makeRequest(apiUrl, options);
   };

   getInfo = async function() {
       const login = await this._login();
       if (true === this._isDebugMode) {
           console.log(login);
       }

       const apiUrl = '/info';


       const options = {
           headers: { 'X-Secret-Token': this.auth.access_token },
           method: 'GET'
       };

       return this._makeRequest(apiUrl, options)
   };

    setBrightness = async function(value) {
        const login = await this._login();
        if (true === this._isDebugMode) {
            console.log(login);
        }

        const apiUrl = `/brightness/${value}`;

        const options = {
            headers: { 'X-Secret-Token': this.auth.access_token },
            method: 'GET'
        };

        return this._makeRequest(apiUrl, options)
    };

    upload = async function(sourcePath, remotePath) {
        const apiUrl = `/upload/${remotePath}`;
        const imageStream = await axios.get(sourcePath, {responseType: "stream"}); 
        const options = {
            headers: { 
                'X-Secret-Token': this.auth.access_token,
                "Content-Type": imageStream.headers["content-type"], 
            },
            data: imageStream.data,
            method: 'POST'
        };

        return this._makeRequest(apiUrl, options);
    };
    
    // -------------------------------------------------- ROUTER ------------------------------
    isRouterLoggedIn() {
        return (this.router_auth.access_token && (this.router_auth.time + this.router_auth.timeout) > (new Date / 1e3 | 0)) ? true : false;
    };

    _routerLogin = async function() {
        try {
            if(this.isRouterLoggedIn()) {
                return Promise.resolve({"status": "loggedin"});
            } else {
                const apiUrl = '/router/login';
                const options = {
                    headers: { 'X-Secret-Token': this.auth.access_token },
                    data: {
                        password: this.router_password,
                    },
                    method: 'POST'
                };

                const login = await this._makeRequest(apiUrl, options);

                if(login && login.name && login.name.length) {
                    this.router_auth.access_token = login.name;
                    this.router_auth.timeout = 500;
                    this.router_auth.time = (new Date / 1e3 | 0);

                    return Promise.resolve(login);
                } else {
                    return Promise.reject({error: login.error});
                }
            }
        } catch (e) {
            return Promise.reject({error: e.error});
        }
    };

    getWanType = async function() {
        const login = await this._routerLogin();
        if (true === this._isDebugMode) {
            console.log(login);
        }

        const apiUrl = '/router/info';
        const options = {
            headers: { 'X-Secret-Token': this.router_auth.access_token },
            method: 'GET',
        };

        return this._makeRequest(apiUrl, options);    
    };


    getClientList = async function() {
        const login = await this._routerLogin();
        if (true === this._isDebugMode) {
            console.log(login);
        }

        const apiUrl = '/router/clients';
        const options = {
            headers: { 'X-Secret-Token': this.router_auth.access_token },
            method: 'GET'
        };

        return this._makeRequest(apiUrl, options);    
    };
}
   
module.exports = Amber;
