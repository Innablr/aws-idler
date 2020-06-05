const idlerHandler = require('./idler').handler;

const timeStamp = process.env['CURRENT_TIME'] || new Date().toISOString();

function done(err, data) {
    if (err) {
        console.log(`Error: ${err}`);
        return;
    }
    console.log(`Invocation result: ${JSON.stringify(data)}`);
}

console.log(`Running idler at timestamp [${timeStamp}]`);
idlerHandler({time: timeStamp}, {}, done);
