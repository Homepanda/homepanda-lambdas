import axios from 'axios';

const publicKey = process.env.WIKICASA_PUBLICKEY || '';
const privateKey = process.env.WIKICASA_PRIVATEKEY || '';
const instance = axios.create({
	baseURL: process.env.WIKICASA_URL,
	timeout: 40000
});

async function getAccessToken() {
	try {				
		const response = await instance.get('/rest/auth/ssoTokenForProvider', {
			headers: {
				'PublicKey': publicKey,
				'PrivateKey': privateKey,
			}
		});

		return response.data;
	} catch (error) {		
		throw new Error(JSON.stringify(error.response.data));
	}
}

function getUserIdByProvider(provider) {
	let providerDefault = 'HP';	
	if (provider.includes('RLB')) {
		providerDefault = 'RLB';
	}
	providerDefault = process.env[`WIKICASA_USERID_${providerDefault}`];
	if (!providerDefault) {
		providerDefault = process.env.WIKICASA_USERID_HP;
	}

	return providerDefault;
}

export async function createAd (payload, provider) {
	try {		
		const token = await getAccessToken();
		const data  = JSON.parse(JSON.stringify(payload));		
		const response = await instance.post('rest/v1/listings', data, {
			headers: {
				'Authorization': `Bearer ${token}`,
				'Content-Type': 'application/json',
				'X-Username': getUserIdByProvider(provider)
			}
		});
		return response.data;
	} catch (error) {
		throw new Error(JSON.stringify(error.response.data));
	}
}

export async function updateAd (payload, propertyId) {
	try {		
		const token = await getAccessToken();
		const data  = JSON.parse(JSON.stringify(payload));
		const response = await instance.put(`/rest/v1/listings/${propertyId}`, data, {
			headers: {
				'Authorization': `Bearer ${token}`,
				'Content-Type': 'application/json'				
			}
		});
		return response.data;
	} catch (error) {
		throw new Error(JSON.stringify(error.response.data));
	}
}

export async function deleteAd (propertyId) {
	try {	
		const token = await getAccessToken();
		const response = await instance.delete(`/rest/v1/listings/${propertyId}`, {
			headers: {
				'Authorization': `Bearer ${token}`,
				'Content-Type': 'application/json'				
			}
		});		
		return response.data;
	} catch (error) {
		throw new Error(JSON.stringify(error.response.data));
	}
}