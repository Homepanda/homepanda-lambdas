import { Hono } from 'hono';
import { handle } from '@hono/aws-lambda';
import { logger } from 'hono/logger';
import { Upload } from '@aws-sdk/lib-storage';
import { S3Client } from '@aws-sdk/client-s3';
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { connectorActivate, refreshToken, retrieveFile, setDeliveryStatus } from './lib/bitrix.mjs';
import { getSecret, updateSecret } from './lib/secretManager.mjs';
import { findConversationByChatId, HttpError } from './lib/homepanda.mjs';
import { buildOutboundS3Key } from './lib/helper.mjs';

const sqsClient = new SQSClient({});
const SQS_QUEUE_URL = process.env.SQS_QUEUE_URL;
const MEDIA_BUCKET = process.env.S3_MEDIA_BUCKET;
const SQS_QUEUE_BITRIX_URL = process.env.SQS_QUEUE_BITRIX_URL;

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
  const body = await c.req.parseBody();
  const { PLACEMENT, PLACEMENT_OPTIONS, event, data, auth } = body;
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
    const connector = body['data[CONNECTOR]'];
    const line = body['data[LINE]'];
    for (let i = 0; body[`data[MESSAGES][${i}][im][message_id]`]; i++) {
      const imChatId = body[`data[MESSAGES][${i}][im][chat_id]`];
      const messageId = body[`data[MESSAGES][${i}][im][message_id]`];
      const userId = body[`data[MESSAGES][${i}][message][user_id]`];
      const text = (body[`data[MESSAGES][${i}][message][text]`] ?? '').replace(/^\[b\][^[\]]*:\s*\[\/b\]\s*\[br\]\s*/i, '');
      const externalChatId = body[`data[MESSAGES][${i}][chat][id]`];
      const fileLink = body[`data[MESSAGES][${i}][message][files][0][link]`];
      const fileName = body[`data[MESSAGES][${i}][message][files][0][name]`];
      try {
        const conversation = await findConversationByChatId(imChatId);
        let payload = { kind: 'text', body: text };
        if (fileLink) {
          const fileResponse = await fetch(fileLink);
          if (!fileResponse.ok) {
            throw new Error(`Impossibile scaricare il file da Bitrix: ${fileResponse.statusText}`);
          }
          const contentType = fileResponse.headers.get('content-type')
            || body[`data[MESSAGES][${i}][message][files][0][type]`]
            || 'application/octet-stream';
          const s3Key = buildOutboundS3Key(conversation.conversationId, messageId);
          await new Upload({
            client: new S3Client({}),
            params: {
              Bucket: MEDIA_BUCKET,
              Key: s3Key,
              Body: fileResponse.body,
              ContentType: contentType
            }
          }).done();
          payload = {
            kind: 'media',
            mediaType: 'document',
            s3Key,
            caption: text
          };
          if (contentType.startsWith('image/')) payload.mediaType = 'image';
          else if (contentType.startsWith('audio/')) payload.mediaType = 'audio';
          else if (contentType.startsWith('video/')) payload.mediaType = 'video';
          else payload.filename = fileName;
        }
        await sqsClient.send(
          new SendMessageCommand({
            QueueUrl: SQS_QUEUE_URL,
            MessageBody: JSON.stringify({
              clientMessageId: messageId,
              toPhone: conversation.toPhone,
              waPhoneNumberId: conversation.waPhoneNumberId,
              origin: 'bitrix24',
              agentRef: `agent-${userId}`,
              payload
            }),
            MessageGroupId: conversation.toPhone,
            MessageDeduplicationId: messageId,
          }),
        );
        await setDeliveryStatus(connector, line, [{
          im: { chat_id: imChatId, message_id: messageId },
          message: { id: [messageId] },
          chat: { id: externalChatId }
        }]);
      } catch (error) {
        console.error(JSON.stringify({ msg: 'connector message failed', messageId, error: String(error) }));
      }
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
    } catch (error) {
      if (error instanceof HttpError) {
        if (error.status === 404) {
          envelope = {
            event: 'CREATE',
            type: 'MESSAGE',
            data: {
              messageId: body['data[message][uuid]'],
              conversationId: null,
              contactPhone: chatId,
              contactName: null,
              body: "Questa chat non è collegata al filo WhatsApp attivo. Usa la chat della scheda da cui è partito l'ultimo template, oppure invia un template da questa scheda.",
              mediaS3Key: null,
              occurredAt: body['data[message][date]'],
              chatId: chatId
            }
          }          
          await sqsClient.send(
            new SendMessageCommand({
              QueueUrl: SQS_QUEUE_BITRIX_URL,
              MessageBody: JSON.stringify(envelope),
              MessageGroupId: chatId,
              MessageDeduplicationId: `${envelope.messageId}_${chatId}`,
            }),
          );
        }
      }
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
