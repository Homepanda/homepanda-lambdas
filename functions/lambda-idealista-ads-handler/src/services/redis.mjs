import Redis from 'ioredis';

export const redisClient = new Redis({
	host: process.env.REDIS_HOST,
	port: process.env.REDIS_PORT,
	keyPrefix: 'lambda-idealista-ads-handler:',
	tls: {},
	maxRetriesPerRequest: 3,
	enableReadyCheck: true,
	lazyConnect: false,
});