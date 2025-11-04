// Gemini API 클라이언트 (재시도, JSON 파싱, 스키마 검증)

const axios = require('axios');
const Ajv = require('ajv');
const http = require('http');
const https = require('https');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const GEMINI_API_BASE = process.env.GEMINI_API_BASE || 'https://generativelanguage.googleapis.com/v1beta';
const TIMEOUT = 30000;
const MAX_RETRIES = 2;

const ajv = new Ajv({
  allErrors: true,
  strict: false,
});
const validatorCache = new WeakMap();

const geminiClient = axios.create({
  baseURL: GEMINI_API_BASE,
  timeout: TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    'x-goog-api-key': GEMINI_API_KEY,
  },
  httpAgent: new http.Agent({ keepAlive: true, maxSockets: 20 }),
  httpsAgent: new https.Agent({ keepAlive: true, maxSockets: 20 }),
});

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const ensureArray = (v) => (Array.isArray(v) ? v : (v ? [v] : []));

// 프롬프트 길이 제한
function shrinkPrompt(text, maxChars = 1500) {
  if (typeof text !== 'string') return '';
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + '\n[...truncated for generation...]';
}

// 재시도 로직이 포함된 POST 요청
async function safePost(url, body, retries = MAX_RETRIES) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await geminiClient.post(url, body);
    } catch (err) {
      const code = err.code;
      const msg = String(err.message || '');
      const transient =
        code === 'ECONNRESET' ||
        code === 'ECONNABORTED' ||
        msg.includes('socket hang up');

      if (!transient || i === retries) throw err;

      const backoff = Math.pow(2, i) * 1000;
      console.warn(`[Gemini Client] transient error (${code || msg}). retry in ${backoff}ms...`);
      await delay(backoff);
    }
  }
}

// 응답에서 텍스트 추출
function collectTextParts(content) {
  return ensureArray(content).flatMap(item => {
    if (!item) return [];

    // 문자열 그 자체
    if (typeof item === 'string' && item.trim()) return [item];

    const parts = ensureArray(item.parts);
    const texts = [];

    for (const p of parts) {
      if (typeof p?.text === 'string' && p.text.trim()) {
        texts.push(p.text);
      } else if (p?.functionCall?.args) {
        try {
          texts.push(JSON.stringify(p.functionCall.args));
        } catch {}
      }
    }

    if (texts.length) return texts;

    if (typeof item.text === 'string' && item.text.trim()) return [item.text];
    return [];
  });
}

function extractTextFromCandidate(candidate) {
  if (!candidate) return null;

  const collected = collectTextParts(candidate.content);
  if (collected.length > 0) return collected.join('\n').trim();

  const outputParts = ensureArray(candidate.output).flatMap(part => {
    if (typeof part === 'string') return [part];
    if (typeof part?.text === 'string') return [part.text];
    return [];
  });
  if (outputParts.length > 0) return outputParts.join('\n').trim();

  if (typeof candidate.text === 'string' && candidate.text.trim()) {
    return candidate.text.trim();
  }
  if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();

  return null;
}

function getValidatorForSchema(schema) {
  if (!schema) return null;
  if (!validatorCache.has(schema)) {
    validatorCache.set(schema, ajv.compile(schema));
  }
  return validatorCache.get(schema);
}

function formatValidationErrors(errors = []) {
  return errors.map(err => {
    const instancePath = err.instancePath || '(root)';
    const message = err.message || 'validation error';
    return `${instancePath} ${message}`.trim();
  });
}

function validateSchemaIfNeeded(payload, schema) {
  if (!schema) return;
  const validator = getValidatorForSchema(schema);
  if (!validator) return;

  const isValid = validator(payload);
  if (!isValid) {
    const error = new Error('Gemini response failed schema validation');
    error.validationErrors = validator.errors || [];
    throw error;
  }
}

// Gemini API 호출
async function callGemini({ systemPrompt, userPrompt, tools = null, responseSchema = null, retryCount = 0 }) {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'your_gemini_api_key') {
    console.error('[Gemini Client] API key not configured properly');
    throw new Error('GEMINI_API_KEY is not configured. Please set it in your .env file');
  }

  const genConfig = {
    temperature: 0.4,
    topK: 40,
    topP: 0.95,
    maxOutputTokens: 4096,
    responseMimeType: 'application/json',
  };

  const baseBody = {
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    generationConfig: genConfig,
  };
  if (systemPrompt) {
    baseBody.systemInstruction = { role: 'system', parts: [{ text: systemPrompt }] };
  }
  if (tools?.length) baseBody.tools = tools;

  console.log('[Gemini Client] Starting request with model:', GEMINI_MODEL);
  console.log('[Gemini Client] Sending request to:', `/models/${GEMINI_MODEL}:generateContent`);

  try {
    const response = await safePost(`/models/${GEMINI_MODEL}:generateContent`, baseBody);

    console.log('[Gemini Client] Response status:', response.status);
    console.log('[Gemini Client] Response data structure:', JSON.stringify(response.data, null, 2));

    if (!response.data?.candidates?.length) {
      throw new Error('No candidates in Gemini API response');
    }

    const candidate = response.data.candidates[0];
    if (candidate.finishReason && candidate.finishReason !== 'STOP') {
      console.warn('[Gemini Client] finishReason:', candidate.finishReason);
      if (candidate.finishReason === 'MAX_TOKENS') {
        console.warn('[Gemini Client] Response truncated - consider increasing maxOutputTokens or simplifying prompts');
      }
    }

    let textContent = extractTextFromCandidate(candidate);
    if (!textContent) {
      if (candidate.finishReason === 'MAX_TOKENS') {
        throw new Error('Gemini response truncated at max token limit without text content');
      }
      throw new Error('No text content in Gemini response');
    }

    // JSON 파싱
    try {
      const parsed = JSON.parse(textContent);
      validateSchemaIfNeeded(parsed, responseSchema);
      return parsed;
    } catch (_) {}

    try {
      let cleaned = textContent.trim();
      cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/, '');
      cleaned = cleaned.replace(/\s*```\s*$/, '').trim();
      const parsed = JSON.parse(cleaned);
      validateSchemaIfNeeded(parsed, responseSchema);
      return parsed;
    } catch (_) {}

    try {
      const m = textContent.match(/\{[\s\S]*\}/);
      if (m) {
        const parsed = JSON.parse(m[0]);
        validateSchemaIfNeeded(parsed, responseSchema);
        return parsed;
      }
    } catch (e) {
      console.error('[Gemini Client] Regex extraction failed:', e.message);
    }

    console.error('[Gemini Client] All parsing attempts failed');
    console.error('[Gemini Client] Full raw text:', textContent);
    throw new Error('Failed to parse Gemini response as JSON after multiple attempts');

  } catch (error) {
    if (error.validationErrors) {
      console.error('[Gemini Client] Schema validation errors:', formatValidationErrors(error.validationErrors));
    }

    const isMaxTokens = /max token/i.test(String(error.message));
    if (isMaxTokens && retryCount < 1) {
      console.warn('[Gemini Client] Truncated output — retrying with smaller prompt...');
      const smaller = shrinkPrompt(userPrompt, 1500);

      const retryBody = {
        contents: [{ role: 'user', parts: [{ text: smaller }] }],
        generationConfig: { ...baseBody.generationConfig, maxOutputTokens: 4096 },
      };
      if (systemPrompt) retryBody.systemInstruction = { role: 'system', parts: [{ text: systemPrompt }] };
      if (tools?.length) retryBody.tools = tools;

      const res2 = await safePost(`/models/${GEMINI_MODEL}:generateContent`, retryBody);
      const cand2 = res2.data?.candidates?.[0];
      let text2 = extractTextFromCandidate(cand2);

      if (!text2 && cand2?.finishReason === 'MAX_TOKENS') {
        console.warn('[Gemini Client] Still truncated — final retry in TEXT mode');
        const textModeBody = {
          contents: [{ role: 'user', parts: [{ text: smaller }] }],
          generationConfig: { ...baseBody.generationConfig, responseMimeType: undefined, maxOutputTokens: 4096 },
        };
        if (systemPrompt) textModeBody.systemInstruction = { role: 'system', parts: [{ text: systemPrompt }] };
        if (tools?.length) textModeBody.tools = tools;

        const res3 = await safePost(`/models/${GEMINI_MODEL}:generateContent`, textModeBody);
        const cand3 = res3.data?.candidates?.[0];
        text2 = extractTextFromCandidate(cand3);
      }

      if (!text2) throw new Error('Gemini returned no text after MAX_TOKENS retries');

      try {
        const parsed = JSON.parse(text2);
        validateSchemaIfNeeded(parsed, responseSchema);
        return parsed;
      } catch (_) {}

      try {
        let cleaned = text2.trim()
          .replace(/^```json\s*/i, '').replace(/^```\s*/, '')
          .replace(/\s*```\s*$/, '').trim();
        const parsed = JSON.parse(cleaned);
        validateSchemaIfNeeded(parsed, responseSchema);
        return parsed;
      } catch (_) {}

      const m = text2.match(/\{[\s\S]*\}/);
      if (m) {
        const parsed = JSON.parse(m[0]);
        validateSchemaIfNeeded(parsed, responseSchema);
        return parsed;
      }
      throw new Error('Failed to parse Gemini response after retries');
    }

    if (error.response) {
      const status = error.response.status;
      console.error('[Gemini Client] Response Status:', status);
      console.error('[Gemini Client] Response Data:', error.response.data);

      if ((status === 429 || status >= 500) && retryCount < MAX_RETRIES) {
        const waitTime = Math.pow(2, retryCount) * 1000;
        console.log(`[Gemini Client] Retrying after ${waitTime}ms... (${retryCount + 1}/${MAX_RETRIES})`);
        await delay(waitTime);
        return callGemini({ systemPrompt, userPrompt, tools, responseSchema, retryCount: retryCount + 1 });
      }
    }

    if (error instanceof SyntaxError) {
      console.error('[Gemini Client] JSON Parse Error:', error.message);
      throw new Error('Failed to parse Gemini response as JSON');
    }

    throw error;
  }
}

function isGeminiEnabled() {
  return process.env.ENABLE_GEMINI === 'true' && !!GEMINI_API_KEY;
}

module.exports = {
  callGemini,
  isGeminiEnabled,
};
