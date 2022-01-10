const https = require('https');
const axios = require('axios');

class Amber  {
   constructor(params) {
       this.timeout = parseInt(params.timeout) || 5000; //request timeout

       this._isDebugMode = params.debug || false;
   
       this.username = params.username;
       this.password = params.password;

       this.url = 'https://myamber.cloud/life/v1';

        this.auth = {
            auth_auth_token: '', //session id
            time: '', //unix time
            expires_in: 0 //in sec
        };

       this.axiosClient = axios.create({
            baseURL: this.url,
            httpsAgent: new https.Agent({  
                rejectUnauthorized: false
            })
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
       var error = {
           debug: {
               date: this.getTime(),
               funcName: funcName
           }
       };

       if ("string" === typeof errorInfo) {
           error.error = {
               message: errorInfo
           };
       } else if ("object" === typeof errorInfo) {
           error.error = errorInfo;
       }  else if ("number" === typeof errorInfo) {
           error.error = errorInfo;
       } else {
           error.error = {
               message: "Invalid error info."
           };
       }

       return error;
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

       if (options.data && "object" === typeof options.data) {
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

           if (result.data.error) {  
               description = result.data.error;      
               return Promise.reject(_this._error(description, funcName));
           }

           if(typeof result.data.data === 'object') {
                return Promise.resolve({...result.data.data, status: result.status});
           }
           
           return Promise.resolve({...result.data, status: result.status});
       }).catch(error => {
            return Promise.reject(_this._error("Critical Error", error.response.statusText, funcName));
        });;
   };
   
   
   /**
    * check if the sid is still valid
    * @returns {string|boolean}
    */
   isLoggedIn() {
       return (this.auth.access_token && (this.auth.time + this.auth.timeout) > (new Date / 1e3 | 0)) ? true : false;
   };
   
   
   /**
    * Login to your diskstation
    * @return {Promise}
    */
   _login = async function() {
       try {
           if(this.isLoggedIn()) {
               return Promise.resolve({"status": "loggedin"});
           } else {

               const apiUrl = '/cloud/login';
               const options = {
                    data: {
                        account: this.username,
                       password: this.password,
                   },
                   method: 'POST'
               };

               const login = await this._makeRequest(apiUrl, options);

               if(login && login.session.length) {
                    this.auth.access_token = login.session;

                    return Promise.resolve(login);
               } else {
                   return Promise.reject({error: login.statusText});
               }
           }
       } catch (e) {
            return Promise.reject({error: e.error});
       }
   };
   
   
   /**
    * get the power State of your Diskstation
    * @param callback
    */
   getNodes = async function() {
       const login = await this._login();
       if (true === this._isDebugMode) {
           console.log(login);
       }
   
       const apiUrl = '/node';
       const options = {
            headers: { Cookie: `session=${this.auth.access_token}; sess_ver=0` },
            method: 'GET'
        }
   
       return this._makeRequest(apiUrl, options);    
   };    
}
   
module.exports = Amber;
