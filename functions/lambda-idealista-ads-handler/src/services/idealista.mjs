import axios from 'axios';
import { redisClient } from './redis.mjs';

const instance = axios.create({
	baseURL: process.env.IDEALISTA_URL,
	timeout: 15000
});

async function retrieveAccessToken() {
	try {
		const params = new URLSearchParams();
		const authorization = ( Buffer.from(process.env.IDEALISTA_AUTHORIZATION) ).toString( "base64" );
		params.append('grant_type', 'client_credentials');
		const response = await instance.post('/oauth/token', params, {
			headers: {
				'Authorization': `Basic ${authorization}`
			}
		});
		
		await redisClient.set('access_token', response.data.access_token, 'EX', response.data.expires_in);
		return response.data.access_token;
	} catch (error) {
		throw error;
	}
}

async function getAccessToken() {
	const redisAccessToken = await redisClient.get('access_token');
	if (redisAccessToken) {		
		return redisAccessToken;
	}
	
	return await retrieveAccessToken();	 
}
function getFeedKey(provider) {
	if (provider === 'H&P') {
		provider = 'HP';
	}	
	let feedKey = process.env[`IDEALISTA_FEEDKEY_${provider}`];	
	if (!feedKey) {
		throw new Error(`FeedKey not found for provider ${provider}`);
	}
	return feedKey;
}
export async function createAd (payload, provider) {
	try {
		console.log(payload);
		const token = await getAccessToken();
		const feedKey = getFeedKey(provider);
		const response = await instance.post('/v1/properties', payload, {
			headers: {
				'Authorization': `Bearer ${token}`,
				'Content-Type': 'application/json',
				'feedKey': feedKey 
			}
		});
		console.log(response);
		return response.data;
	} catch (error) {
		if (error.response) {
			throw new Error(JSON.stringify(error.response?.data));
		}
		throw new Error(JSON.stringify({'error': error.message}));
	}
}
export async function updateAd (payload, propertyId, provider) {
	try {
		console.log(payload);
		const token = await getAccessToken();
		const feedKey = getFeedKey(provider);		
		const response = await instance.put(`/v1/properties/${propertyId}`, payload, {
			headers: {
				'Authorization': `Bearer ${token}`,
				'Content-Type': 'application/json',
				'feedKey': feedKey 
			}
		});
		return response.data;
	} catch (error) {
		if (error.response) {
			throw new Error(JSON.stringify(error.response?.data));
		}
		throw new Error(JSON.stringify({'error': error.message}));
	}
}
export async function deactivateAd (propertyId, provider) {
	try {
		const token = await getAccessToken();
		const feedKey = getFeedKey(provider);
		const response = await instance.post(`/v1/properties/${propertyId}/deactivate`, {}, {
			headers: {
				'Authorization': `Bearer ${token}`,
				'Content-Type': 'application/json',
				'feedKey': feedKey 
			}
		});
		return response.data;
	} catch (error) {
		if (error.response) {
			throw new Error(JSON.stringify(error.response?.data));
		}
		throw new Error(JSON.stringify({'error': error.message}));
	}
}
export async function uploadAdImages(payloadImages, propertyId) {	
	try {
		const token = await getAccessToken();
		const feedKey = getFeedKey(payloadImages.provider);
		await instance.put(`/v1/properties/${propertyId}/images`, { images: payloadImages.data }, {
			headers: {
				'Authorization': `Bearer ${token}`,
				'Content-Type': 'application/json',
				'feedKey': feedKey 
			}
		});				
	} catch (error) {
		console.log(error.response);
		throw error;
	}
}
export async function uploadVirtualTour(payloadImages, propertyId) {
	const token = await getAccessToken();
	const feedKey = getFeedKey(payloadImages.provider);
	for (let index = 0; index < payloadImages.length; index++) {		
		try {
			const payload = payloadImages.data[index];
			await instance.post(`/v1/properties/${propertyId}/virtualtours`, payload, {
				headers: {
					'Authorization': `Bearer ${token}`,
					'Content-Type': 'application/json',
					'feedKey': feedKey 
				}
			});			
		} catch (error) {
			console.log(error.response);
			continue;
		}
	}
}