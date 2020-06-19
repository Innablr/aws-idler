type EnvironmentConfig = {
    debugLevel: string;
    configBucket: string;
    configKey: string;
    baseBackoff: number;
    maxRetries: number;
}

const environ: EnvironmentConfig = {
    debugLevel: process.env['DEBUG_LEVEL'] || 'debug',
    configBucket: process.env['S3_BUCKET'] || 'lan-innablr-dev-idler',
    configKey: process.env['S3_KEY'] || 'config/idler.yaml',
    baseBackoff: parseInt(process.env['SDK_BASE_BACKOFF'] || '300', 10),
    maxRetries: parseInt(process.env['SDK_MAX_RETRIES'] || '30', 10)
}

export default environ;
