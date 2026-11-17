import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

let s3Client;

export const loadDocument = async (documentPath, cfg) => {
  if (!cfg.bucket) return readFile(path.join(cfg.localDir, documentPath));
  s3Client ??= new S3Client({});
  const { Body } = await s3Client.send(
    new GetObjectCommand({ Bucket: cfg.bucket, Key: documentPath.replace(/^\/+/, '') }),
  );
  return Buffer.from(await Body.transformToByteArray());
};
