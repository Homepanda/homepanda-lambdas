import { StepError } from './errors.mjs';

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const signerIndex = (sig, cfg) => {
  const found = sig.FoundSigStringPattern ?? '';
  const match =
    found.match(new RegExp(`^${escapeRegex(cfg.sigStart)}(\\d+)${escapeRegex(cfg.sigEnd)}$`)) ?? found.match(/(\d+)/);
  return match ? Number(match[1]) : null;
};

export const normalizePhone = (phone, prefix) => {
  const cleaned = String(phone ?? '').replace(/[\s\-.()]/g, '');
  if (!cleaned) return undefined;
  return /^(\+|00)/.test(cleaned) ? cleaned : `${prefix}${cleaned}`;
};

export const buildActivities = (people, signatures, cfg) => {
  const groups = {};
  for (const sig of signatures) {
    const idx = signerIndex(sig, cfg);
    if (idx) (groups[idx] ??= []).push(sig);
  }
  const missing = people.filter((_, i) => !groups[i + 1]);
  if (missing.length) {
    throw new StepError(`Missing signature tags for ${missing.length} signer(s)`, {
      missingSigners: missing.map((p) => p.email),
    });
  }
  const noPhone = people.filter((p) => !normalizePhone(p.phone, cfg.phonePrefix));
  if (noPhone.length) {
    throw new StepError('Phone number required for SMS OTP signature', { missingPhone: noPhone.map((p) => p.email) });
  }

  return people.map((person, i) => ({
    Action: {
      Sign: {
        RecipientConfiguration: {
          ContactInformation: {
            Email: person.email,
            GivenName: person.name,
            Surname: person.surname,
            PhoneNumber: normalizePhone(person.phone, cfg.phonePrefix),
            LanguageCode: cfg.languageCode,
          },
        },
        SigningGroup: person.signingGroup,
        Elements: {
          Signatures: groups[i + 1].map((sig) => ({
            ElementId: sig.ElementId,
            Required: true,
            DocumentNumber: sig.DocumentNumber ?? 1,
            DisplayName: sig.DisplayName || `Firma ${person.name} ${person.surname}`,
            FieldDefinition: sig.FieldDefinition,
            AllowedSignatureTypes: {
              // OneTimePassword: { Preferred: true, ...(cfg.otpValidity && { ValidityInSeconds: cfg.otpValidity }) },
              ClickToSign: {}
            },
          })),
        },
      },
    },
  }));
};
