export const buildWorkflowUrl = (cfg, workflow) =>
  `${cfg.homepandaEndpoint}/api/v1/webhook/workflow/${encodeURIComponent(workflow)}/2`;

export const postSuccessWebhook = async (cfg, workflow, buffer, fileName = 'document.pdf') => {
  const form = new FormData();
  form.append('status', 'SUCCESS');
  form.append('document', new Blob([buffer], { type: 'application/pdf' }), fileName);

  const url = buildWorkflowUrl(cfg, workflow);
  const res = await fetch(url, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) throw new Error(`Homepanda success webhook failed (HTTP ${res.status})`);
};

export const postFailureWebhook = async (cfg, workflow, data) => {
  const url = buildWorkflowUrl(cfg, workflow);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) throw new Error(`Homepanda failure webhook failed (HTTP ${res.status})`);
};
