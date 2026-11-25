import crypto from 'crypto';

export function bitrixMessageUuid(messageId) {
  const hash = crypto.createHash('sha1').update(`bitrix:${messageId}`).digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function buildOutboundS3Key(conversationId, clientMessageId) {
  const date = new Date();
	const y = date.getUTCFullYear();
	const m = String(date.getUTCMonth() + 1).padStart(2, '0');
	const d = String(date.getUTCDate()).padStart(2, '0');
	const safe = crypto.randomUUID();
	return `outbound/${y}/${m}/${d}/${conversationId}/${clientMessageId}/${safe}`;
}