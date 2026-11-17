export const loadConfig = () => ({
  baseUrl: (process.env.ESAW_BASE_URL || 'https://saas.esignanywhere.net/Api').replace(/\/+$/, ''),
  apiToken: process.env.ESAW_API_TOKEN,
  callbackUrl: process.env.ESAW_CALLBACK_URL,
  bucket: process.env.DOCUMENTS_BUCKET,
  localDir: process.env.DOCUMENTS_LOCAL_DIR || process.cwd(),
  sigStart: process.env.SIGSTRING_START || '#SIGN',
  sigEnd: process.env.SIGSTRING_END ?? '#',
  phonePrefix: process.env.DEFAULT_PHONE_PREFIX || '+39',
  languageCode: process.env.ESAW_LANGUAGE_CODE || 'IT',
  otpValidity: process.env.OTP_VALIDITY_SECONDS ? Number(process.env.OTP_VALIDITY_SECONDS) : undefined,
});
