const normalizeUrl = (value, scheme) => {
  if (!value) return value;
  const withScheme = /^https?:\/\//i.test(value) ? value : `${scheme}://${value}`;
  return withScheme.replace(/\/+$/, '');
};

export const loadConfig = () => ({
  baseUrl: normalizeUrl(process.env.ESAW_BASE_URL || 'https://saas.esignanywhere.net/Api').replace(/\/+$/, ''),
  apiToken: process.env.ESAW_API_TOKEN,
  homepandaEndpoint: normalizeUrl(
    process.env.HOMEPANDA_ENDPOINT_PROPERTY || 'http://property.homepanda.locale',
    'http',
  ),
});
