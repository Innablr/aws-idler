import * as path from 'path';

export default function getParser(name: string) {
    const m = require(path.join(__dirname, name));
    return m;
}
