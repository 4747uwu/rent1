// backend/config/wasabi-s3.js
import { S3Client } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

dotenv.config();

export const wasabiConfig = {
    endpoint: process.env.WASABI_ENDPOINT || 'https://s3.ap-southeast-1.wasabisys.com',
    accessKeyId: process.env.WASABI_ACCESS_KEY,
    secretAccessKey: process.env.WASABI_SECRET_KEY,
    region: process.env.WASABI_REGION || 'ap-southeast-1',
    documentsBucket: process.env.WASABI_DOCUMENTS_BUCKET || 'medicaldocuments'
};

// Validate configuration
if (!wasabiConfig.accessKeyId || !wasabiConfig.secretAccessKey) {
    console.error('❌ CRITICAL: Wasabi S3 credentials missing!');
    throw new Error('Missing Wasabi S3 credentials in .env file');
}

console.log('✅ Wasabi S3 Configuration Loaded:');
console.log(`   Endpoint: ${wasabiConfig.endpoint}`);
console.log(`   Region: ${wasabiConfig.region}`);
console.log(`   Documents Bucket: ${wasabiConfig.documentsBucket}`);
console.log(`   Access Key: ${wasabiConfig.accessKeyId.substring(0, 8)}...`);

// Create S3 Client
export const wasabiS3Client = new S3Client({
    endpoint: wasabiConfig.endpoint,
    region: wasabiConfig.region,
    credentials: {
        accessKeyId: wasabiConfig.accessKeyId,
        secretAccessKey: wasabiConfig.secretAccessKey
    },
    forcePathStyle: true // Required for Wasabi
});

export default wasabiS3Client;