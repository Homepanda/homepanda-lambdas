import crypto from 'crypto';

export function buildOutboundS3Key(conversationId, clientMessageId) {
  const date = new Date();
	const y = date.getUTCFullYear();
	const m = String(date.getUTCMonth() + 1).padStart(2, '0');
	const d = String(date.getUTCDate()).padStart(2, '0');
	const safe = crypto.randomUUID();
	return `outbound/${y}/${m}/${d}/${conversationId}/${clientMessageId}/${safe}`;
}