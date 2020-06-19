import {config} from 'aws-sdk';
import log from './logger';

export class AwsArn {
    fullArn: string;
    arn: string;
    partition: string;
    service: string;
    region: string | undefined;
    accountId: string | undefined;
    resourceType: string | undefined;
    resource: string;

    private decodeResource(resourceType: string, resource: string) : string[] {
        if (!resource) {
            if (resourceType.includes('/')) {
                return resourceType.split('/');
            } else {
                return ['', resourceType];
            }
        }
        return [resourceType, resource];
    }

    constructor(fullArn: string) {
        let [arn, partition, service, region, accountId, resourceType, resource] = fullArn.split(':');
        [resourceType, resource] = this.decodeResource(resourceType, resource);
        this.fullArn = fullArn;
        this.arn = arn;
        this.partition = partition;
        this.service = service;
        this.region = region || undefined;
        this.accountId = accountId || undefined;
        this.resourceType = resourceType || undefined;
        this.resource = resource;
    }

    toString() : string {
        return this.fullArn;
    }
}

export async function paginateAwsCall(fn: Function, what: string, params?: object) : Promise<any[]> {
    let entityList: any[] = [];
    const parameters = params || {};
    let r = await fn(parameters).promise();
    entityList = entityList.concat(entityList, r[what]);
    while (r.NextToken !== undefined) {
            r = await fn(Object.assign({}, parameters, {NextToken: r.NextToken})).promise();
            entityList = entityList.concat(r[what]);
    }
    return entityList;
}

export function configureAWS(maxRetries: number, baseBackoff: number) : void {
    config.update({
        retryDelayOptions: {base: baseBackoff},
        maxRetries
    });
    log.info(`Set AWS SDK retry options to ${baseBackoff}ms base backoff, max retries ${maxRetries}`);
}
