// ============================================================
// WELL CLINIC — Backend Proxy para API Anthropic
// Protege a API key e habilita Opus 4.6 + Extended Thinking
// ============================================================
// Como usar:
//   1. npm install express cors
//   2. Defina sua chave: export ANTHROPIC_API_KEY="sk-ant-..."
//   3. node server.js
//   4. Abra http://localhost:3000
// ============================================================

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.ANTHROPIC_API_KEY || '';

if (!API_KEY) {
  console.warn('\n⚠️  ANTHROPIC_API_KEY não definida!');
  console.warn('   export ANTHROPIC_API_KEY="sk-ant-..." e reinicie.\n');
}

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Serve o portal HTML
app.use(express.static(path.join(__dirname)));

// ======================== ENDPOINT: ANALYZE ========================
// Recebe a mensagem do paciente, chama Opus 4.6 com extended thinking,
// e retorna a resposta via Server-Sent Events (streaming)
app.post('/api/analyze', async (req, res) => {
  const { system, userMessage, stream } = req.body;

  if (!API_KEY) {
    return res.status(500).json({ error: 'API key não configurada no servidor.' });
  }

  // Se não quer streaming, retorna resposta normal
  if (!stream) {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-opus-4-6',
          max_tokens: 16000,
          thinking: {
            type: 'enabled',
            budget_tokens: 10000
          },
          system,
          messages: [{ role: 'user', content: userMessage }]
        })
      });

      const data = await response.json();
      return res.json(data);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ========== STREAMING MODE (SSE) ==========
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 16000,
        stream: true,
        thinking: {
          type: 'enabled',
          budget_tokens: 10000
        },
        system,
        messages: [{ role: 'user', content: userMessage }]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      res.write(`data: ${JSON.stringify({ type: 'error', error: errorText })}\n\n`);
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

            // Sinalizar quando o thinking começou/terminou
            if (event.type === 'content_block_start') {
              if (event.content_block?.type === 'thinking') {
                res.write(`data: ${JSON.stringify({ type: 'thinking_start' })}\n\n`);
              } else if (event.content_block?.type === 'text') {
                res.write(`data: ${JSON.stringify({ type: 'text_start' })}\n\n`);
              }
            }

            // Streaming do thinking
            if (event.type === 'content_block_delta') {
              if (event.delta?.type === 'thinking_delta') {
                res.write(`data: ${JSON.stringify({ type: 'thinking_delta', text: event.delta.thinking })}\n\n`);
              }
              // Streaming do texto principal
              if (event.delta?.type === 'text_delta') {
                res.write(`data: ${JSON.stringify({ type: 'text_delta', text: event.delta.text })}\n\n`);
              }
            }

            if (event.type === 'content_block_stop') {
              res.write(`data: ${JSON.stringify({ type: 'block_stop' })}\n\n`);
            }

            if (event.type === 'message_stop') {
              res.write(`data: ${JSON.stringify({ type: 'message_stop' })}\n\n`);
            }

          } catch (e) {
            // ignora JSON inválido
          }
        }
      }
    }

    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`);
    res.end();
  }
});

// ======================== ENDPOINT: QUICK (Sonnet fallback) ========================
// Para buscas rápidas e categorização, usa Sonnet (mais barato e rápido)
app.post('/api/quick', async (req, res) => {
  const { system, userMessage } = req.body;

  if (!API_KEY) {
    return res.status(500).json({ error: 'API key não configurada.' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system,
        messages: [{ role: 'user', content: userMessage }]
      })
    });

    const data = await response.json();
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n✅ Well Clinic Portal rodando em http://localhost:${PORT}`);
  console.log(`   API Key: ${API_KEY ? '✓ configurada' : '✗ NÃO configurada'}\n`);
});
