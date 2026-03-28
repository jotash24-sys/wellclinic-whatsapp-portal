// Vercel Serverless Function — Proxy para API Anthropic
// Suporta Opus 4.6 com Extended Thinking + Streaming (SSE)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY não configurada no servidor.' });
  }

  const { system, userMessage, stream } = req.body;

  if (!userMessage) {
    return res.status(400).json({ error: 'userMessage é obrigatório.' });
  }

  const requestBody = {
    model: 'claude-opus-4-6',
    max_tokens: 16000,
    thinking: {
      type: 'enabled',
      budget_tokens: 10000
    },
    system,
    messages: [{ role: 'user', content: userMessage }]
  };

  // ========== NON-STREAMING ==========
  if (!stream) {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();
      return res.status(200).json(data);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ========== STREAMING (SSE) ==========
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({ ...requestBody, stream: true })
    });

    if (!response.ok) {
      const errorText = await response.text();
      res.write('data: ' + JSON.stringify({ type: 'error', error: errorText }) + '\n\n');
      res.end();
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const payload = line.slice(6).trim();
          if (payload === '[DONE]') {
            res.write('data: [DONE]\n\n');
            continue;
          }
          try {
            const event = JSON.parse(payload);

            if (event.type === 'content_block_start') {
              if (event.content_block?.type === 'thinking') {
                res.write('data: ' + JSON.stringify({ type: 'thinking_start' }) + '\n\n');
              } else if (event.content_block?.type === 'text') {
                res.write('data: ' + JSON.stringify({ type: 'text_start' }) + '\n\n');
              }
            }

            if (event.type === 'content_block_delta') {
              if (event.delta?.type === 'thinking_delta') {
                res.write('data: ' + JSON.stringify({ type: 'thinking_delta', text: event.delta.thinking }) + '\n\n');
              }
              if (event.delta?.type === 'text_delta') {
                res.write('data: ' + JSON.stringify({ type: 'text_delta', text: event.delta.text }) + '\n\n');
              }
            }

            if (event.type === 'content_block_stop') {
              res.write('data: ' + JSON.stringify({ type: 'block_stop' }) + '\n\n');
            }

            if (event.type === 'message_stop') {
              res.write('data: ' + JSON.stringify({ type: 'message_stop' }) + '\n\n');
            }
          } catch (e) {
            // ignora JSON inválido
          }
        }
      }
    }

    res.end();
  } catch (err) {
    res.write('data: ' + JSON.stringify({ type: 'error', error: err.message }) + '\n\n');
    res.end();
  }
}

export const config = {
  maxDuration: 60
};
