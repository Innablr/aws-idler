import getParser from '../src/plugins/parsers/all';
import {expect} from 'chai';

describe('Availability parsers', function() {
    describe('getParser', function() {
        it('Supports strict parser', function() {
            const strict = getParser('strict');
            expect(strict).to.be.a('function');
        });

        it('Throws unsupported parsers', function() {
            expect(() => getParser('blarg')).to.throw();
        });
    });

    describe('Strict parser', async function() {
        require('./parserStrict/all');
    });
});
