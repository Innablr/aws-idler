import * as bunyan from 'bunyan';

export const logLevels: {[key: string]: number} = {
    "trace": bunyan.TRACE,
    "debug": bunyan.DEBUG,
    "info": bunyan.INFO,
    "warn": bunyan.WARN,
    "error": bunyan.ERROR,
    "fatal": bunyan.FATAL
}

const log = bunyan.createLogger({
    name: 'idler',
    hostname: 'lambda.amazonaws.com',
    stream: process.stdout
});

export default log;
