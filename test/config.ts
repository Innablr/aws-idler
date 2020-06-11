import Configuration, {readConfigObject} from '../src/lib/config';
import * as chai from 'chai';
import * as sinon from 'sinon';
import * as sinonChai from 'sinon-chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as defaultConfig from '../src/lib/defaultConfig.json';
import * as AWSMock from "aws-sdk-mock";
import * as AWS from "aws-sdk";
import {GetObjectRequest} from 'aws-sdk/clients/s3';

import * as staticAccountList from './testConfig/staticAccountList.json';
import * as staticAccountListWithIndividualSettings from './testConfig/staticAccountListWithIndividualSettings.json';

chai.should();
chai.use(sinonChai);
chai.use(chaiAsPromised);

describe('Idler Configuration', function() {
    describe('S3 config reader', function() {
        it('correctly calls S3 getObject', async function() {
            const s3GetObjectSpy = sinon.spy();
            AWSMock.setSDKInstance(AWS);
            AWSMock.mock('S3', 'getObject', s3GetObjectSpy);
            readConfigObject('test-bucket', 'test-key');
            s3GetObjectSpy.should.have.been.calledWith({Bucket: 'test-bucket', Key: 'test-key'});
            AWSMock.restore();
        });

        it('parses a yaml config', async function() {
            AWSMock.setSDKInstance(AWS);
            AWSMock.mock('S3', 'getObject', (params: GetObjectRequest, callback: Function) => {
                callback(null, {ContentType: 'text/plain', Body: '---\ndefault:\n  drivers: []\n  plugins: []'});
            });
            const r = await readConfigObject('test-bucket', 'test-key');
            r.should.be.an('object');
            r.should.deep.include({default: {drivers: [], plugins: []}});
            AWSMock.restore();
        });

        it('loads default config when there is no config object in the bucket or the bucket doesn\'t exist', async function (){
            AWSMock.setSDKInstance(AWS);
            AWSMock.mock('S3', 'getObject', (params: GetObjectRequest, callback: Function) => {
                callback({code: 'NoSuchKey', message: 'The specified key does not exist.'});
            });
            const r0 = await readConfigObject('test-bucket', 'test-key');
            r0.should.deep.equal(defaultConfig);
            AWSMock.restore();
            AWSMock.mock('S3', 'getObject', (params: GetObjectRequest, callback: Function) => {
                callback({code: 'NoSuchBucket', message: 'The specified bucket does not exist'});
            });
            const r1 = await readConfigObject('test-bucket', 'test-key');
            r0.should.deep.equal(defaultConfig);
            AWSMock.restore();
        });

        it('throws when there\'s a different read error', async function (){
            AWSMock.setSDKInstance(AWS);
            AWSMock.mock('S3', 'getObject', (params: GetObjectRequest, callback: Function) => {
                callback({code: 'SomeOtherError', message: 'Woteva'});
            });
            await readConfigObject('test-bucket', 'test-key').should.be.rejected;
            AWSMock.restore();
        });

    });

    describe('Configuration builder', function() {
        it('initialises with default config', function() {
            const r = new Configuration(defaultConfig);
            r["rawConfig"].should.equal(defaultConfig);
            r["defaultSettings"].should.deep.equal(defaultConfig.defaults);
            r["includeAccounts"].should.deep.equal(defaultConfig.includeAccounts);
            r["excludeAccounts"].should.deep.equal(defaultConfig.excludeAccounts);
        });

        it('configures with a static list of accounts', async function() {
            const r = new Configuration(staticAccountList);
            await r.configureIdler();
            const accounts = r.idlerAccounts;
            accounts.should.be.an('array').that.has.lengthOf(3);
            accounts.forEach(xa => {
                xa.should.have.all.keys('accountId', 'name', 'config');
                xa.config.should.deep.equal(staticAccountList.defaults);
            });
        });

        it('properly combines settings', async function() {
            const r = new Configuration(staticAccountListWithIndividualSettings);
            await r.configureIdler();
            const accounts = r.idlerAccounts;
            accounts.should.be.an('array').that.has.lengthOf(3);
            accounts[0].name
        });
    });
});
