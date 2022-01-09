const axios = require('axios');
const fs = require('fs');

exports.getFilePath = async function (value, filename) {
    const dir = './userdata/'
 
    await fs.chmodSync(dir, 0o755); 

    await axios.get(value, {responseType: "stream"} )  
        .then(response => {  
            response.data.pipe(fs.createWriteStream(`${dir}${filename}`));  
        })  
        .catch(error => {  
            console.log(error);  
        });

    return `${dir}${filename}`;
};

exports.removeFile = function(filename) {
    try {
        fs.unlinkSync(filename)
    } catch (error) {
        console.log('removeFile', error); 
    }
};