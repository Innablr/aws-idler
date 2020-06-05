const _ = require('lodash');
const path = require('path');
const winston = require('winston');

const supportedDrivers = ['ec2', 'ebs', 'snapshot', 'rdsInstance', 'rdsMultiAz', 'rdsMultiAzSnapshot', 'rdsCluster', 'rdsClusterSnapshot', 'redshiftCluster', 'redshiftClusterSnapshot'];
const supportedPlugins = ['powercycle', 'validateTags', 'restoreRdsSg', 'inspectorAgent', 'ssmAgent', 'enforceEc2Profile'];

async function AccountIdler(accountConfig) {
    const config = accountConfig;
    const logger = winston.loggers.get(config.settings.name);

    logger.info(`Initialising idler for account ${config.settings.name}`);

    const plugins = await Promise.all(
        Object.keys(config.plugins)
            .filter(xp => supportedPlugins.indexOf(xp) > -1)
            .filter(xs => config.plugins[xs].active)
            .map(function (xs) {
                logger.info(`Configuring plugin ${xs}...`);
                return Promise.all(config.plugins[xs].configs.map(xp => {
                    const PluginModule = require(path.join('..', 'plugins', xs));
                    return new PluginModule(accountConfig, xs, xp);
                }));
            })).then(r => _.flatMap(r));

    const drivers = config.drivers
        .filter(xd => supportedDrivers.indexOf(xd.name) > -1)
        .map(function (xd) {
            const DriverModule = require(path.join('..', 'drivers', xd.name));
            return new DriverModule(accountConfig, xd);
        });

    function loadResources() {
        return Promise.all(drivers.map(xd => xd.collect()))
            .then(r => _.flatMap(r));
    }

    function runPlugins(resources) {
        return Promise.all(plugins.map(xp => Promise.all(
            resources.filter(xr => {
                if (xp.isApplicable(xr)) {
                    return true;
                }
                logger.debug('Plugin %s is not applicable for resource type %s, skipping', xp.name, xr.resourceType);
                return false;
            }).map(xr => xp.generateActions(xr))
        ))).then(() => resources);
    }

    function runActions(resources) {
        return Promise.all(drivers.map(function (xd) {
            return xd.processActions(resources.filter(xr => xd.recogniseResource(xr)));
        })).then(() => resources);
    }

    function initialise() {
        const promises = [
            plugins.map(plugin => plugin.initialise()),
            drivers.map(driver => driver.initialise())
        ];

        return Promise.all(promises).then(() => this);
    }

    function revolve() {
        return loadResources()
            .then(runPlugins)
            .then(runActions)
            .then(function () {
                return `Account ${config.settings.name} finished processing.`;
            })
            .catch(function (err) {
                logger.error('Error processing account %s, stack trace will follow:', config.settings.name);
                logger.error(err);
            });
    }

    return {
        initialise,
        revolve
    };
}

module.exports = AccountIdler;
