const ftp = require('basic-ftp');

class FTP {
    constructor(data) {
        
        const {ip, port, username, password, path_prefix} = data;
        this.settings = {
            host: ip,
            user: username,
            password: password,
            secure: true,
            secureOptions: { rejectUnauthorized: false }
        };

        this.path_prefix = path_prefix;
    }

    async upload(sourcePath, remotePath) {
        const ftps = new ftp.Client()

        try {
            await ftps.access(this.settings)
            await ftps.ensureDir(this.path_prefix)
            await ftps.appendFrom(sourcePath, remotePath)
        }
        catch(err) {
            console.log(err)
        }
    }
}

module.exports = FTP;