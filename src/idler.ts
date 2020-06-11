import log, {logLevels} from './lib/logger';
import environ from './lib/environ';
import { configureAWS } from './lib/common';
import Configuration, {readConfigObject} from './lib/config';
import dateTime from './lib/dateTime';
import {S3} from 'aws-sdk';
import * as bunyan from 'bunyan';

// const accountIdler = require('./lib/accountIdler');
// const dateTime = require('./lib/dateTime');
// const assume = require('./lib/assume');
// const winston = require('winston');
// const AWS = require('aws-sdk');
// const _ = require('lodash');

export const handler = async function (event: any) {
    log.level(logLevels[environ.debugLevel]);

    dateTime.freezeTime(event.time);
    log.info(`Got time ${dateTime.getTime()}`);

    configureAWS(environ.maxRetries, environ.baseBackoff);

    const configBlob = readConfigObject(environ.configBucket, environ.configKey);
    const config = new Configuration(configBlob);
    await config.configureIdler();


    // // Assume-role on each org (if any listed) and get the list of accounts from it
    // const orgsAccountsList = await Promise.all(
    //     config.organizations.map(xa => {
    //         log.info('Getting list of accounts from %s organization..', xa.settings.name);
    //         return assume.connectTo(`arn:aws:iam::${xa.Id}:role/${xa.settings.organizationRoleName}`).then(cred => {
    //             cred.settings = xa.settings;
    //             return cred;
    //         });
    //     }))
    //     .then(r => _.flatMap(r))
    //     .then(creds => configMethods.getOrganisationsAccounts(creds))
    //     .then(r => _.flatMap(r));

    // // Filter final accounts list to be processed
    // const filteredAccountsList = await configMethods.filterAccountsList(orgsAccountsList, config, environ.debugLevel);

    // // Try to assume role on the listed accounts and remove from the list if fails
    // log.info('Caching STS credentials...');
    // const authenticatedAccounts = await Promise.all(
    //     filteredAccountsList.map(account =>
    //         assume.connectTo(account.settings.assumeRoleArn)
    //         .then(auth => auth ? account : undefined)
    //     )
    // )
    // .then(r => _.flatMap(r.filter(xa => xa)));

    // if (authenticatedAccounts.length < 1) {
    //     throw new Error('No accounts selected to run Idler');
    // }

    // log.info('Idler will run on %d account(s): %j', authenticatedAccounts.length,
    //     authenticatedAccounts.map(xa => `${xa.settings.name}(${xa.account_id})`));

    // // Run Idler on selected accounts
    // await Promise.all(
    //     authenticatedAccounts
    //     .map(account => accountIdler(account))
    // )
    // .then(idlers => Promise.all(
    //     idlers.map(idler => idler.initialise())
    // ))
    // .then(idlers => Promise.all(
    //     idlers.map(idler => idler.revolve())
    // ))
    // .then(function (results) {
    //     results.forEach(xr => {
    //         log.info(xr);
    //     });
    //     cb(null, 'Another run complete');
    // })
    // .catch(err => {
    //     log.error(err);
    //     cb(err);
    // });
};
