const environ = {};

environ.debugLevel = process.env['DEBUG_LEVEL'] || 'debug';
environ.configBucket = process.env['S3_BUCKET'];
environ.configKey = process.env['S3_KEY'] || 'config/idler.yaml';
environ.baseBackoff = parseInt(process.env['SDK_BASE_BACKOFF'] || '300', 10);
environ.maxRetries = parseInt(process.env['SDK_MAX_RETRIES'] || '30', 10);

module.exports = environ;
