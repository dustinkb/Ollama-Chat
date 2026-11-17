import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import path from 'node:path';
import fs from 'node:fs';

interface OpenRouterPricing {
  prompt?: string;
  completion?: string;
  request?: string;
  image?: string;
}

interface OpenRouterRawModel {
  id: string;
  name?: string;
  description?: string;
  context_length?: number | null;
  pricing?: OpenRouterPricing;
  architecture?: {
    modality?: string;
    tokenizer?: string;
    instruct_type?: string | null;
  };
}

interface OpenRouterFreeModel {
  id: string;
  name: string;
  description?: string;
  context_length?: number | null;
  pricing?: OpenRouterPricing;
  architecture?: {
    modality?: string;
    tokenizer?: string;
    instruct_type?: string | null;
  };
}

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

function getOpenRouterApiKey(): string {
  return (process.env.OPENROUTER_API_KEY || '').trim();
}

function isFreeOpenRouterModel(model: OpenRouterRawModel): boolean {
  if (!model || typeof model.id !== 'string') return false;

  const pricing = model.pricing;
  if (pricing && pricing.prompt !== undefined && pricing.completion !== undefined) {
    const promptPrice = Number(pricing.prompt);
    const completionPrice = Number(pricing.completion);
    if (Number.isNaN(promptPrice) || Number.isNaN(completionPrice)) {
      return false;
    }
    if (promptPrice !== 0 || completionPrice !== 0) {
      return false;
    }
    if (pricing.request !== undefined && pricing.request !== '') {
      const requestPrice = Number(pricing.request);
      if (!Number.isNaN(requestPrice) && requestPrice !== 0) {
        return false;
      }
    }
    if (pricing.image !== undefined && pricing.image !== '') {
      const imagePrice = Number(pricing.image);
      if (!Number.isNaN(imagePrice) && imagePrice !== 0) {
        return false;
      }
    }
    return true;
  }

  return model.id.endsWith(':free') || model.id === 'openrouter/free';
}

async function createServer() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '4mb' }));

  // Check whether OPENROUTER_API_KEY is present in the local environment (never expose the secret itself)
  app.get('/api/openrouter/status', (_req: Request, res: Response) => {
    res.json({
      configured: Boolean(getOpenRouterApiKey()),
    });
  });

  // Fetch all OpenRouter models and filter strictly to free models
  app.get('/api/openrouter/models', async (_req: Request, res: Response) => {
    const apiKey = getOpenRouterApiKey();
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    try {
      const upstream = await fetch(`${OPENROUTER_BASE_URL}/models`, {
        method: 'GET',
        headers,
      });

      if (!upstream.ok) {
        const text = await upstream.text().catch(() => '');
        res.status(upstream.status).json({
          error: `OpenRouter models request failed (${upstream.status})${text ? `: ${text}` : ''}`,
        });
        return;
      }

      const payload = (await upstream.json()) as { data?: OpenRouterRawModel[] };
      const allModels = Array.isArray(payload.data) ? payload.data : [];

      const freeModels: OpenRouterFreeModel[] = allModels
        .filter(isFreeOpenRouterModel)
        .map((m) => ({
          id: m.id,
          name: m.name?.trim() || m.id,
          description: m.description,
          context_length: m.context_length ?? null,
          pricing: m.pricing,
          architecture: m.architecture,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

      res.json({
        models: freeModels,
        totalFetched: allModels.length,
        configured: Boolean(apiKey),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch OpenRouter models.';
      res.status(502).json({ error: message });
    }
  });

  // Proxy OpenRouter chat completions using the local Linux environment OPENROUTER_API_KEY
  app.post('/api/openrouter/chat', async (req: Request, res: Response) => {
    const apiKey = getOpenRouterApiKey();
    if (!apiKey) {
      res.status(401).json({
        error:
          'OPENROUTER_API_KEY is not set in the local Linux environment. Export OPENROUTER_API_KEY before starting the server.',
      });
      return;
    }

    const body = req.body as {
      model?: string;
      messages?: Array<{ role: string; content: string }>;
      stream?: boolean;
    };

    if (!body?.model || !Array.isArray(body.messages)) {
      res.status(400).json({ error: 'Request must include model and messages.' });
      return;
    }

    const shouldStream = body.stream !== false;
    const controller = new AbortController();

    res.on('close', () => {
      if (!res.writableEnded) {
        controller.abort();
      }
    });

    try {
      const upstream = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.APP_URL || `http://localhost:${port}`,
          'X-Title': 'Ollama Chat',
        },
        body: JSON.stringify({
          model: body.model,
          messages: body.messages,
          stream: shouldStream,
        }),
        signal: controller.signal,
      });

      if (!upstream.ok) {
        const text = await upstream.text().catch(() => '');
        let message = `OpenRouter error (${upstream.status})`;
        if (text) {
          try {
            const parsed = JSON.parse(text) as { error?: { message?: string } | string };
            if (typeof parsed.error === 'string') {
              message = parsed.error;
            } else if (parsed.error?.message) {
              message = parsed.error.message;
            } else {
              message = `${message}: ${text}`;
            }
          } catch {
            message = `${message}: ${text}`;
          }
        }
        res.status(upstream.status).json({ error: message });
        return;
      }

      if (!shouldStream) {
        const data = await upstream.json();
        res.json(data);
        return;
      }

      if (!upstream.body) {
        res.status(502).json({ error: 'OpenRouter returned an empty response stream.' });
        return;
      }

      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();

      const reader = upstream.body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value && !res.writableEnded) {
            res.write(value);
          }
        }
      } finally {
        reader.releaseLock();
        if (!res.writableEnded) {
          res.end();
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        if (!res.writableEnded) {
          res.end();
        }
        return;
      }
      const message =
        err instanceof Error ? err.message : 'Unexpected error communicating with OpenRouter.';
      if (!res.headersSent) {
        res.status(502).json({ error: message });
      } else if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ error: { message } })}\n\n`);
        res.end();
      }
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      const indexPath = path.join(distDir, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Build output not found. Run npm run build first.');
      }
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

createServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
