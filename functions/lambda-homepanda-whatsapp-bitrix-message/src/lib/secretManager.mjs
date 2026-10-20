import { SecretsManagerClient, GetSecretValueCommand, PutSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const smClient = new SecretsManagerClient({});

export async function getSecret() {
  const secretResponse = await smClient.send(
    new GetSecretValueCommand({
      SecretId: 'BitrixOauthWhatsappAppToken'
    })
  );

  if (secretResponse.SecretString) {
    return JSON.parse(secretResponse.SecretString);
  }
  return secretResponse;

}

export async function updateSecret(newSecret) {
  const response = await smClient.send(
    new PutSecretValueCommand({
      SecretId: 'BitrixOauthWhatsappAppToken',
      SecretString: JSON.stringify(newSecret)
    })
  );

  return response;
}
