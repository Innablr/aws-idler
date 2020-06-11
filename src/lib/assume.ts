import {STS, Credentials} from 'aws-sdk';
import {AwsArn} from './common';
import log from './logger';
import dateTime from './dateTime';
import * as moment from 'moment-timezone';


class RemoteCredentials {
    private credsCache: {
        [key: string]: {
            creds: Credentials,
            expiration: moment.Moment
        }
    };

    constructor() {
        this.credsCache = {};
    }

    async connectTo(remoteRole: AwsArn) : Promise<Credentials | null> {
        const sts = new STS();

        log.debug('Requested connection via [%s]', remoteRole.fullArn);

        if (remoteRole.fullArn in this.credsCache) {
            if (this.credsCache[remoteRole.fullArn].expiration > moment.utc()) {
                log.debug('Role [%s] is cached, returning access key [%s], expire at [%s]',
                    remoteRole, this.credsCache[remoteRole.fullArn].creds.accessKeyId, this.credsCache[remoteRole.fullArn].expiration);
                return this.credsCache[remoteRole.fullArn].creds;
            }
            log.debug('Cached role [%s] expired at [%s], requesting new creds...',
                remoteRole, this.credsCache[remoteRole.fullArn].expiration);
        }

        log.debug('Assuming role [%s]...', remoteRole);

        try {
            const r = await sts.assumeRole({
                RoleArn: remoteRole.fullArn,
                RoleSessionName: `Idler_${dateTime.getTime().format('YYYYMMDDHHmmss')}`
            }).promise();
            const expireAt = moment.utc(r.Credentials!.Expiration).subtract(5, 'seconds');
            const tokenCreds = new Credentials({
                accessKeyId: r.Credentials!.AccessKeyId,
                secretAccessKey: r.Credentials!.SecretAccessKey,
                sessionToken: r.Credentials!.SessionToken
            });
            log.debug('Assumed role [%s] will expire at [%s] plus 5 seconds.', remoteRole, expireAt);
            this.credsCache[remoteRole.fullArn] = {
                expiration: expireAt,
                creds: tokenCreds
            };
        } catch (error) {
            log.error(error);
            log.info('Failed assuming role %s on account %s. Idler will not run in this account.', remoteRole, remoteRole.accountId);
            return null;
        }

        return this.credsCache[remoteRole.fullArn].creds;
    }
}

export default new RemoteCredentials();
