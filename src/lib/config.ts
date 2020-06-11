import {S3, Organizations} from 'aws-sdk';
import log from './logger';
import * as yaml from 'js-yaml';
import * as merge from 'deepmerge';
import {AwsArn, paginateAwsCall} from './common';
import assume from './assume';
import * as defaultConfig from './defaultConfig.json';

interface IdlerSettings {
    region: string;
    timezone: string;
    timezoneTag: string;
    revolverRoleName?: string;
};

interface DriverSettings {
    name: string;
    active: boolean;
    pretend: boolean;
};

interface PluginSettings {
    name: string;
    active: boolean;
    configs: any[];
}

interface AccountConfig {
    settings: IdlerSettings;
    drivers: DriverSettings[];
    plugins: PluginSettings[];
}

interface IncludedAccount {
    accountId: string;
    name: string;
    config: Partial<AccountConfig>;
}

interface ExcludedAccount {
    accountId: string;
    name?: string;
}

export async function readConfigObject(configBucket: string, configKey: string): Promise<any> {
    const s3 = new S3();
    log.debug(`Loading config from S3 bucket [${configBucket}] key [${configKey}]`);
    try {
        const configData = await s3.getObject({Bucket: configBucket, Key: configKey}).promise();
        log.debug(`Found S3 object MIME ${configData.ContentType}`);
        const rawConfig = yaml.safeLoad(configData.Body!.toString('utf8') || '{}');
        return rawConfig;
    } catch (error) {
        if (error.code === 'NoSuchKey' || error.code === 'NoSuchBucket') {
            log.warn(`No config object found: [${error.message}], using default config`);
            return defaultConfig;
        }
        throw error;
    }
}

class Configuration {
    private _idlerAccounts: IncludedAccount[];
    private rawConfig: any;
    private defaultSettings: AccountConfig;
    private includeAccounts: IncludedAccount[];
    private excludeAccounts: ExcludedAccount[];

    constructor(configObject: Object) {
        log.trace(`Configuring Idler...`);
        this._idlerAccounts = [];
        this.rawConfig = configObject;
        this.defaultSettings = this.rawConfig.defaults;
        this.includeAccounts = this.rawConfig.includeAccounts || [];
        this.excludeAccounts = this.rawConfig.excludeAccounts || [];
    }

    public get idlerAccounts(): IncludedAccount[] {
        return this._idlerAccounts;
    }

    public async configureIdler() : Promise<void> {
        const orgAccounts = await this.fetchOrganisationAccounts();
        const incAccounts = this.includeAccounts.map(xa => {
            const merged: IncludedAccount = {
                accountId: xa.accountId,
                name: xa.name,
                config: merge(this.defaultSettings, xa.config || {})
            };
            return merged;
        });
        this._idlerAccounts = merge(orgAccounts, incAccounts).filter(xa => {
            if (xa.accountId in this.excludeAccounts.map(xe => xe.accountId)) {
                log.warn(`Account ${xa.accountId} (${xa.name}) is excluded in config`);
                return false;
            }
            return true;
        });
    }

    private async fetchOrganisationAccounts(): Promise<IncludedAccount[]> {
        if (! ('organizationReadOnlyRoleArn' in this.rawConfig)) {
            log.info('No Organisation configured. Set organizationReadOnlyRoleArn to read account list from the AWS Organisation');
            return [];
        }

        const creds = await assume.connectTo(new AwsArn(this.rawConfig.organizationReadOnlyRoleArn));
        const orgs = new Organizations({credentials: creds, region: 'us-east-1'});
        try {
            const orgAccounts = await paginateAwsCall(orgs.listAccounts.bind(orgs), 'Accounts');
            log.info('Read %d accounts from the Organisation', orgAccounts.length);
            return orgAccounts.map((xa: Organizations.Account) => {
                const accountDef: IncludedAccount = {
                    accountId: xa.Id!,
                    name: xa.Name!,
                    config: this.defaultSettings
                }
                return accountDef;
            });
        } catch (error) {
            log.error(error);
            throw new Error(`Unable to fetch Organisation account list via [${this.rawConfig.organizationReadOnlyRoleArn}]: ${error.message}`);
        }
    }
}

// class IdlerConfigOld {
//     readConfig(configBucket: string, configKey: string) {
//         const s3 = new AWS.S3();
//         log.debug(`Fetching config from bucket [${configBucket}] key [${configKey}]`);
//         log.debug(`configBucket: ${configBucket}`);
//         log.debug(`configKey: ${configKey}`);
//         return s3.getObject({
//             Bucket: configBucket,
//             Key: configKey
//         }).promise()
//             .then(function (data) {
//                 log.debug(`Found S3 object MIME ${data.ContentType}`);
//                 return yaml.safeLoad(data.Body.toString('utf8'));
//             })
//             .then(function (config) {
//                 log.debug('Idler config is: %j', config);
//                 if (!Array.isArray(config.accounts.include_list)) {
//                     throw new Error('Invalid configuration. \'include_list\' key is either missing or not an array');
//                 }
//                 if (!Array.isArray(config.accounts.exclude_list)) {
//                     throw new Error('Invalid configuration. \'exclude_list\' key is either missing or not an array');
//                 }
//                 settings.store(config.settings);
//                 return config;
//             })
//             .then(async function (config) {
//                 // merge default settings and extract some info
//                 config.organizations = await config.organizations.map(r => _.merge({}, config.defaults, r));
//                 config.accounts.include_list = await config.accounts.include_list.map(r => _.merge({}, config.defaults, r));
//                 config.accounts.exclude_list = await config.accounts.exclude_list.map(r => _.merge({}, config.defaults, r));

//                 config.defaults.settings.organizationRoleName = config.defaults.settings.organization_role_name;
//                 config.defaults.settings.idlerRoleName = config.defaults.settings.idler_role_name;

//                 const ec2DriverDefaultConfig = config.defaults.drivers.find(d => d.name === 'ec2');

//                 if (ec2DriverDefaultConfig !== undefined) {
//                     ec2DriverDefaultConfig.inspectorAssessmentTarget =
//                         ec2DriverDefaultConfig.inspector_assessment_target
//                             ? ec2DriverDefaultConfig.inspector_assessment_target
//                             : '';
//                 }

//                 config.organizations.map(org => {
//                     org.Id = org.account_id;
//                     org.settings.organizationRoleName = org.settings.organization_role_name;
//                     org.settings.idlerRoleName = org.settings.idler_role_name;
//                 });
//                 config.accounts.include_list.map(acc => {
//                     acc.Id = acc.account_id;
//                     acc.settings.idlerRoleName = acc.settings.idler_role_name;
//                 });
//                 config.accounts.exclude_list.map(acc => {
//                     acc.Id = acc.account_id;
//                     acc.settings.idlerRoleName = acc.settings.idler_role_name;
//                 });

//                 return config;
//             });
//         // .then(config => config.accounts.map(xa => _.merge({}, config.defaults, xa)));
//     }

//     getOrganisationsAccounts(creds) {
//         const defaultRegion = 'us-east-1';
//         return Promise.all(
//             creds.map(cr => {
//                 const client = new AWS.Organizations({credentials: cr, region: defaultRegion});
//                 return paginateAwsCall(client.listAccounts.bind(client), 'Accounts')
//                     .then(accounts =>
//                         Promise.all(
//                             accounts.map(account => {
//                                 account.settings = {
//                                     'name': account.Name,
//                                     'region': cr.settings.region,
//                                     'timezone': cr.settings.timezone,
//                                     'idlerRoleName': cr.settings.idler_role_name,
//                                     'inspectorName': cr.settings.inspectorName
//                                 };
//                                 return account;
//                             })
//                         )
//                     );
//             })
//         );
//     }

//     filterAccountsList(orgsAccountsList, config, debugLevel) {
//         const logger = this.logger;
//         logger.info('%d Accounts found on the Organizations listed', orgsAccountsList.length)
//         logger.info('Getting accounts from include/exclude lists..');
//         logger.info('%d accounts found on include_list', config.accounts.include_list.length);
//         logger.info('%d accounts found on exclude_list', config.accounts.exclude_list.length);
//         const filteredAccountsList = config.accounts.include_list
//             // concat include_list
//             .concat(orgsAccountsList)
//             // delete exclude_list
//             .filter(xa => !config.accounts.exclude_list.find(xi => xi.Id === xa.Id))
//             // add logger
//             .map(account => {
//                 this.addAccountLogger(account.settings.name, debugLevel);
//                 return account;
//             })
//             // merge with default settings
//             .map(account => _.merge({}, config.defaults, account))
//             // build assumeRoleArn string, extract account_id and idler_role_name
//             .map(account => {
//                 account.settings.assumeRoleArn = `arn:aws:iam::${account.Id}:role/${account.settings.idlerRoleName}`;
//                 return account;
//             });

//         // remove duplicated accounts
//         return _.uniqBy(filteredAccountsList, account => JSON.stringify([account.Id, account.settings.region]));
//     }
// }

export default Configuration;
