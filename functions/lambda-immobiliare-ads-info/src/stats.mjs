import { DateTime } from 'luxon';

export const CHUNK_SIZE = 4000;
export const DELAY_DAYS = 2;

const DIGITS = /^\d+$/;

export function toStatsProperties(listings) {
    const properties = [];
    const invalid = [];
    const adIdByPropertyId = new Map();
    let duplicates = 0;
    for (const listing of listings) {
        const propertyId = String(listing?.propertyId ?? '').trim();
        const adIdValue = String(listing?.adId ?? '').trim();
        const adId = Number(adIdValue);
        if (!DIGITS.test(propertyId) || !DIGITS.test(adIdValue) || !Number.isSafeInteger(adId) || adId <= 0) {
            invalid.push(listing);
            continue;
        }

        const known = adIdByPropertyId.get(propertyId);
        if (known !== undefined) {
            duplicates++;
            if (known !== adId) {
                console.warn(`Duplicate listing ${propertyId} with different adId: keeping ${known}, skipping ${adId}`);
            }
            continue;
        }
        adIdByPropertyId.set(propertyId, adId);
        properties.push({ propertyId, adId });
    }
    return { properties, invalid, duplicates };
}

export function statsDate(now = DateTime.now()) {
    return now.setZone('Europe/Rome').minus({ days: DELAY_DAYS }).toISODate();
}

export function buildStatsEvents(properties, date) {
    const events = [];
    for (let i = 0; i < properties.length; i += CHUNK_SIZE) {
        events.push({
            detail: {
                PROPERTIES: properties.slice(i, i + CHUNK_SIZE),
                START: date,
                END: date,
            }
        });
    }
    return events;
}

function parseLimit(value) {
    if (value === undefined || value === null || value === '') {
        return null;
    }
    const limit = Number(value);
    if (!Number.isSafeInteger(limit) || limit <= 0) {
        throw new Error(`IMMOBILIARE_STATS_LIMIT must be a positive integer, got ${JSON.stringify(value)}`);
    }
    return limit;
}

export async function sendStats({ listings, queueUrl, limit, sendMessage, now = DateTime.now() }) {
    if (!queueUrl) {
        console.info('IMMOBILIARE_STATS_QUEUE_URL not set for this run: stats not requested');
        return { sent: 0, skipped: true };
    }

    let sent = 0;
    try {
        const max = parseLimit(limit);
        const { properties, invalid, duplicates } = toStatsProperties(listings);
        if (invalid.length > 0) {
            console.warn(`Stats: skipped ${invalid.length} rows without a valid listing id or codice: `
                + invalid.slice(0, 10).map((listing) => JSON.stringify(listing)).join(', '));
        }
        const selected = max === null ? properties : properties.slice(0, max);
        if (selected.length === 0) {
            throw new Error(`no valid listing out of ${listings.length} rows`);
        }

        const date = statsDate(now);
        const events = buildStatsEvents(selected, date);
        console.info(`Stats: queueing ${selected.length} properties to ${queueUrl} for ${date} in ${events.length} messages`
            + ` (${invalid.length} rows skipped, ${duplicates} duplicates removed`
            + (max === null ? ')' : `, limited to ${max})`));

        for (const [index, event] of events.entries()) {
            const result = await sendMessage({
                QueueUrl: queueUrl,
                MessageBody: JSON.stringify(event),
            });
            if (!result?.MessageId) {
                throw new Error(`message ${index + 1} of ${events.length} not queued: no MessageId in the response`);
            }
            sent += event.detail.PROPERTIES.length;
        }

        const summary = `Queued ${sent} of ${selected.length} properties to ${queueUrl} for ${date} in ${events.length} messages`;
        console.info(summary);
        return { sent, summary };
    } catch (error) {
        console.error(`IMMOBILIARE_STATS_FAILED ${sent} properties queued before the error: ${error.message}`, error);
        return { sent, error };
    }
}
