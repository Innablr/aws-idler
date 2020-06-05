const environ = require('./lib/environ');
const IdlerConfir = require('./lib/config');
const accountIdler = require('./lib/accountIdler');
const dateTime = require('./lib/dateTime');
const assume = require('./lib/assume');
const winston = require('winston');
const AWS = require('aws-sdk');
const _ = require('lodash');

function configureLogTransport(label, level) {
    return new winston.transports.Console({
        timestamp: true,
        showLevel: true,
        debugStdout: true,
        label,
        level
    });
}

function addAccountLogger(accountName, level) {
    winston.loggers.add(accountName, {
        transports: [configureLogTransport(accountName, level)]
    });
}

function configureAWS(maxRetries, baseBackoff) {
    const logger = winston.loggers.get('global');
    AWS.config.update({
        retryDelayOptions: {
            base: baseBackoff
        },
        maxRetries
    });
    logger.info(`Set AWS SDK retry options to ${baseBackoff}ms base backoff, max retries ${maxRetries}`);
}

exports.handler = async function (event, context, cb) {
    addAccountLogger('global', environ.debugLevel);
    const logger = winston.loggers.get('global');
    const configMethods = new IdlerConfir();
    dateTime.freezeTime(event.time);
    logger.info(`Got time ${dateTime.getTime()}`);

    // Set retry parameters
    configureAWS(environ.maxRetries, environ.baseBackoff);

    // Read configuration file from S3
    const config = await configMethods.readConfig(environ.configBucket, environ.configKey)
        .catch(function (e) {
            throw new Error(`Unable to parse config object: ${e}. Exiting.`);
        });

    // Assume-role on each org (if any listed) and get the list of accounts from it
    const orgsAccountsList = await Promise.all(
        config.organizations.map(xa => {
            logger.info('Getting list of accounts from %s organization..', xa.settings.name);
            return assume.connectTo(`arn:aws:iam::${xa.Id}:role/${xa.settings.organizationRoleName}`).then(cred => {
                cred.settings = xa.settings;
                return cred;
            });
        }))
        .then(r => _.flatMap(r))
        .then(creds => configMethods.getOrganisationsAccounts(creds))
        .then(r => _.flatMap(r));

    // Filter final accounts list to be processed
    const filteredAccountsList = await configMethods.filterAccountsList(orgsAccountsList, config, environ.debugLevel);

    // Try to assume role on the listed accounts and remove from the list if fails
    logger.info('Caching STS credentials...');
    const authenticatedAccounts = await Promise.all(
        filteredAccountsList.map(account =>
            assume.connectTo(account.settings.assumeRoleArn)
            .then(auth => auth ? account : undefined)
        )
    )
    .then(r => _.flatMap(r.filter(xa => xa)));

    if (authenticatedAccounts.length < 1) {
        throw new Error('No accounts selected to run Idler');
    }

    logger.info('Idler will run on %d account(s): %j', authenticatedAccounts.length,
        authenticatedAccounts.map(xa => `${xa.settings.name}(${xa.account_id})`));

    // Run Idler on selected accounts
    await Promise.all(
        authenticatedAccounts
        .map(account => accountIdler(account))
    )
    .then(idlers => Promise.all(
        idlers.map(idler => idler.initialise())
    ))
    .then(idlers => Promise.all(
        idlers.map(idler => idler.revolve())
    ))
    .then(function (results) {
        results.forEach(xr => {
            logger.info(xr);
        });
        cb(null, 'Another run complete');
    })
    .catch(err => {
        logger.error(err);
        cb(err);
    });
};
