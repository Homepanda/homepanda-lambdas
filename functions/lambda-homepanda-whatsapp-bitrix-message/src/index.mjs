import { Hono } from 'hono';
import { handle } from '@hono/aws-lambda';
import { logger } from 'hono/logger';
import { Upload } from '@aws-sdk/lib-storage';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { connectorActivate, refreshToken, retrieveFile, setConnector } from './lib/bitrix.mjs';
import { getSecret, updateSecret } from './lib/secretManager.mjs';
import { findConversationByChatId } from './lib/homepanda.mjs';
import { buildOutboundS3Key } from './lib/helper.mjs';

const sqsClient = new SQSClient({});
const SQS_QUEUE_URL = process.env.SQS_QUEUE_URL;
const MEDIA_BUCKET = process.env.S3_MEDIA_BUCKET;

const app = new Hono().basePath('/bitrix');

app.use(logger());
app.use('*', async (c, next) => {
  console.log(c);
  await next()
})
app.post('/install', async (c) => {
  try {
    const data = await c.req.parseBody();
    const authData = {
      token_type: "Bearer",
      access_token: data['auth[access_token]'],
      expires_in: data['auth[expires_in]'],
      refresh_token: data['auth[refresh_token]']
    };
    const response = await updateSecret(authData);
    console.log("Segreto inserito con successo!");
    console.log(`ID Nuova Versione generata: ${response.VersionId}`);
    console.log(`Stato versione: ${response.VersionStages.join(", ")}`);
    return c.json(response);
  } catch (error) {
    console.error("Errore durante l'inserimento del segreto:", error.message);
  }
  return c.status(400);
});
app.get('/refresh', async (c) => {
  const authData = await getSecret();
  if (authData) {
    const newAuthData = await refreshToken(authData.refresh_token);
    const response = await updateSecret(newAuthData);
    console.log("Segreto inserito con successo!");
    console.log(`ID Nuova Versione generata: ${response.VersionId}`);
    console.log(`Stato versione: ${response.VersionStages.join(", ")}`);
    return c.json(newAuthData);
  }

  c.status(404);
  return c.json({ 'error': 'Secret not found' });
});
app.post('/handler', async (c) => {
  const { PLACEMENT, PLACEMENT_OPTIONS, event, data, auth } = await c.req.parseBody();
  if (PLACEMENT === 'SETTING_CONNECTOR') {
    const options = JSON.parse(PLACEMENT_OPTIONS);
    const line = Number(options.LINE);

    await connectorActivate('homepanda_whatsapp_connector', line, Number(options.ACTIVE_STATUS));
    await setConnector('homepanda_whatsapp_connector', line, {
      ID: `homepanda_whatsapp_${line}`,
      URL_IM: 'https://wa.me/+393925262930',
      NAME: 'WhatsApp Homepanda Support'
    }
    );
  }
  if (event === 'ONIMCONNECTORMESSAGEADD') {
    console.log(event, data, auth);
    for (const msg of data.MESSAGES) {
      const externalChannel = msg.chat.id;
      const conversation = await db.bitrixConversations.findByExternalChannel(externalChannel);
      if (conversation) {
        await sqs.sendMessage({
          QueueUrl: process.env.SQS_WHATSAPP_OUTBOUND,
          MessageBody: JSON.stringify({
            clientMessageId: uuidv7(),
            toPhone: conversation.contactPhone,
            conversationId: conversation.conversationId,
            origin: 'bitrix24',
            agentRef: String(msg.message.user_id),
            payload: {
              kind: 'text',
              body: msg.message.text
            }
          }),
          MessageGroupId: conversation.contactPhone,
          MessageDeduplicationId: `bitrix:${msg.im.message_id}`
        });
      }
      const message = [{
        im: msg.im,
        message: {
          id: [`ext-msg-${uuidv7()}`],
          date: Math.floor(Date.now() / 1000)
        },
        chat: msg.chat
      }];

      await setDeliveryStatus('homepanda_whatsapp_connector', data.LINE, message);
    }
  }
  if (event === 'ONIMCONNECTORDIALOGSTART') {
    console.log(event, data, auth);
    const { LINE, SESSION_ID, CHAT_ID, USER_CODE } = data;

    console.log('Nuova conversazione:', {
      lineId: LINE,
      sessionId: SESSION_ID,
      chatId: CHAT_ID,
      userCode: USER_CODE
    });
  }
  return c.text('OK');
});

app.post('/handler/chat', async (c) => {
  const body = await c.req.parseBody();
  if (body.event === 'ONIMBOTV2MESSAGEADD') {
    const chatId = body['data[message][chatId]'];
    let envelope = {};
    try {
      const conversation = await findConversationByChatId(chatId);
      envelope = {
        clientMessageId: body['data[message][uuid]'],
        toPhone: conversation.toPhone,
        waPhoneNumberId: conversation.waPhoneNumberId,
        origin: "bitrix24",
        agentRef: `agent-${body['data[message][authorId]']}`,
        requestedAt: body['data[message][date]'],
        bitrix: {
          chatId: body['data[chat][id]'],
          crmEntityType: body['data[chat][entityLink][type]'],
          crmEntityId: body['data[chat][entityLink][id]'].replace(/[^0-9]+/g, '')
        },
        payload: {
          kind: 'text',
          body: body['data[message][text]']
        }
      };
      if (body['data[message][params][FILE_ID][0]']) {
        const fileResponse = await retrieveFile(body['data[bot][id]'], body['data[message][params][FILE_ID][0]']);
        const fileStream = fileResponse.body;
        const contentType = fileResponse.headers.get('content-type') || 'application/octet-stream';
        const s3 = new S3Client({});
        const s3Key = buildOutboundS3Key(conversation.conversationId, body['data[message][uuid]']);
        const s3Upload = new Upload({
          client: s3,
          params: {
            Bucket: MEDIA_BUCKET,
            Key: s3Key,
            Body: fileStream,
            ContentType: contentType
          }
        });
        await s3Upload.done();        
        envelope.payload = {
          kind: 'media',
          mediaType: 'document',
          s3Key,          
          caption: body['data[message][text]']
        }
        switch (true) {
          case contentType.startsWith('image/'):
            envelope.payload.mediaType = 'image';
            break;
          case contentType.startsWith('audio/'):
            envelope.payload.mediaType = 'audio';
            break;
          case contentType.startsWith('video/'):
            envelope.payload.mediaType = 'video';
            break;
          default:            
            envelope.payload['filename'] = s3Key.split('/').at(-1);
            break;
        }        
      }
      console.log(envelope);      
    } catch (error) {
      return c.json({ error: 'CONVERSATION_NOT_BOUNDED' }, 500);
    }
    try {
      await sqsClient.send(
        new SendMessageCommand({
          QueueUrl: SQS_QUEUE_URL,
          MessageBody: JSON.stringify(envelope),
          MessageGroupId: envelope.toPhone,
          MessageDeduplicationId: envelope.clientMessageId,
        }),
      );
    } catch (error) {
      console.error(JSON.stringify({ msg: 'sqs send failed', error: String(error) }));
      return c.json({ error: 'ENQUEUE_FAILED' }, 500);
    }
  }

  return c.text('OK');
});

export const handler = handle(app);
