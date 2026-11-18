import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar, Cookie } from 'tough-cookie';
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { Immobiliare } from './immobilare.mjs';
import { sendStats } from './stats.mjs';

const sqsClient = new SQSClient({ region: "eu-central-1" });

export const handler = async(event) => {
    
    const SesCookie = new Cookie({
        key: event.detail.COOKIE_KEY,
        value: event.detail.COOKIE_VALUE,
        domain: 'gestionale.immobiliare.it',
        httpOnly: true 
    });
    
    const jar = new CookieJar();
    await jar.setCookie(SesCookie, 'https://gestionale.immobiliare.it');
    const immobilare = new Immobiliare(wrapper(axios.create({ 
        jar,
        headers: {
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:137.0) Gecko/20100101 Firefox/137.0',
        }
    })));
    console.info('Crawler attempt to login...');
    await immobilare.login(
        event.detail.USERNAME,
        event.detail.PASSWORD,
    );
    console.info('Crawler logged, try to download ads data');
    const response = {
        messages: 0,
        errors: 0
    };
    const { ads: data, listings } = await immobilare.downloadData();
    for (let index = 0; index < data.length; index++) {
        const element = data[index];
        element.provider = 'immobiliare';
        try {
            await sqsClient.send(
                new SendMessageCommand({
                    MessageBody: JSON.stringify(element),
                    QueueUrl: process.env.QUEUE_URL
                })
            );
            response.messages = response.messages + 1;
        } catch (error) {
            console.log("Error", error);
            response.errors = response.errors + 1;
            continue;
        }        
    }
    
    if (response.errors === 0) {
        const responseString = `Sent ${response.messages} out of ${data.length} messages correctly`;
        console.log(responseString)
        await sendStats({
            listings,
            queueUrl: event.detail.IMMOBILIARE_STATS_QUEUE_URL,
            limit: event.detail.IMMOBILIARE_STATS_LIMIT,
            sendMessage: (params) => sqsClient.send(new SendMessageCommand(params)),
        });
        return responseString;
    }

    console.warn('Stats not requested: ads info messages failed');
    throw new Error(`${response.errors} out of ${data.length} messages with errors`);
};
