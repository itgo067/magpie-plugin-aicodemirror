const PROVIDER = "aicodemirror"
const GLOBAL_ORIGIN = "https://api.aicodemirror.ai"
const CHINA_ORIGIN = "https://api.claudecode.net.cn"
const ORIGINS = [GLOBAL_ORIGIN, CHINA_ORIGIN]

const PROTOCOL = {
  anthropic: {
    npm: "@ai-sdk/anthropic",
    path: "/api/claudecode/v1",
  },
  responses: {
    npm: "@ai-sdk/openai",
    path: "/v1",
  },
}

const EFFORTS = ["low", "medium", "high"]
const BUDGET = { low: 4096, medium: 8192, high: 16_000 }
const CLAUDE = { protocol: "anthropic", context: 1_000_000, output: 128_000, input: ["text", "image", "pdf"] }
const OPENAI = { protocol: "responses", context: 1_050_000, output: 128_000, input: ["text", "image", "pdf"] }
const GEMINI = { protocol: "responses", context: 1_048_576, output: 65_536, input: ["text", "image"] }
const GROK = { protocol: "responses", context: 500_000, output: 500_000, input: ["text", "image"] }

const MODELS = [
  { ...CLAUDE, id: "claude-fable-5-1", name: "Claude Fable 5.1", cost: [10, 50, 12.5, 0.25] },
  { ...CLAUDE, id: "claude-opus-5-5", name: "Claude Opus 5.5", cost: [4, 20, 5, 0.2] },
  { ...CLAUDE, id: "claude-sonnet-5-5", name: "Claude Sonnet 5.5", cost: [2, 10, 2.5, 0.2] },
  { ...CLAUDE, id: "claude-haiku-5-5", name: "Claude Haiku 5.5", cost: [0.1, 0.5, 0.125, 0.01] },
  { ...CLAUDE, id: "claude-opus-5", name: "Claude Opus 5", cost: [5, 25, 6.25, 0.5] },
  { ...CLAUDE, id: "claude-fable-5", name: "Claude Fable 5", cost: [10, 50, 12.5, 1] },
  { ...CLAUDE, id: "claude-sonnet-5", name: "Claude Sonnet 5", cost: [2, 10, 2.5, 0.2] },
  { ...CLAUDE, id: "claude-opus-4-8", name: "Claude Opus 4.8", output: 32_000, cost: [5, 25, 6.25, 0.5] },
  { ...CLAUDE, id: "claude-opus-4-7", name: "Claude Opus 4.7", cost: [5, 25, 6.25, 0.5] },
  { ...CLAUDE, id: "claude-opus-4-6", name: "Claude Opus 4.6", cost: [5, 25, 6.25, 0.5] },
  { ...CLAUDE, id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", output: 64_000, cost: [3, 15, 3.75, 0.3] },
  { ...CLAUDE, id: "claude-haiku-4-5-20251001", name: "Claude Haiku 4.5", context: 200_000, output: 64_000, cost: [1, 5, 1.25, 0.1] },

  { ...OPENAI, id: "gpt-6-astra", name: "GPT-6 Astra", cost: [10, 50, 12.5, 1] },
  { ...OPENAI, id: "gpt-6.1-terra", name: "GPT-6.1 Terra", cost: [1, 5, 1.25, 0.05] },
  { ...OPENAI, id: "gpt-6.1-sol", name: "GPT-6.1 Sol", cost: [2, 10, 2.5, 0.1] },
  { ...OPENAI, id: "gpt-6-sol", name: "GPT-6 Sol", cost: [2, 10, 2.5, 0.2] },
  { ...OPENAI, id: "gpt-5.6-sol", name: "GPT-5.6 Sol", context: 1_000_000, cost: [5, 30, 6.25, 0.5] },
  { ...OPENAI, id: "gpt-5.6-terra", name: "GPT-5.6 Terra", context: 1_000_000, cost: [2, 12, 2.5, 0.2] },

  { ...GEMINI, id: "gemini-4-argon", name: "Gemini 4 Argon", output: 32_768, cost: [2, 10, 0, 0.1] },
  { ...GEMINI, id: "gemini-3.8-flash", name: "Gemini 3.8 Flash", cost: [0.75, 3.75, 0, 0.075] },
  { ...GEMINI, id: "gemini-3-flash-preview", name: "Gemini 3 Flash Preview", cost: [0.5, 3, 0, 0.05] },

  { ...GROK, id: "grok-4.7", name: "Grok 4.7", input: ["text", "image", "pdf"], cost: [2, 6, 0, 0.5] },
  { ...GROK, id: "grok-4.6", name: "Grok 4.6", cost: [2, 6, 0, 0.5] },
  { ...GROK, id: "grok-4.5", name: "Grok 4.5", cost: [2, 6, 0, 0.3] },
  { ...GROK, id: "grok-build-0.1", name: "Grok Build 0.1", context: 256_000, output: 256_000, input: ["text", "image", "pdf"], cost: [1, 2, 0, 0.2] },
].map((m) => ({ ...m, efforts: EFFORTS }))

function pickBaseURL(value) {
  const origin = typeof value === "string" ? value.trim().replace(/\/+$/, "") : ""
  return ORIGINS.includes(origin) ? origin : GLOBAL_ORIGIN
}

function endpoint(m, origin = GLOBAL_ORIGIN) {
  const p = PROTOCOL[m.protocol]
  return { npm: p.npm, base: `${origin}${p.path}` }
}

function variants(m) {
  return Object.fromEntries(
    m.efforts.map((effort) =>
      m.protocol === "anthropic"
        ? [effort, { thinking: { type: "enabled", budgetTokens: BUDGET[effort] } }]
        : [effort, { reasoningEffort: effort }],
    ),
  )
}

function cost(m) {
  return {
    input: m.cost[0],
    output: m.cost[1],
    cache_read: m.cost[3],
    cache_write: m.cost[2],
  }
}

function entry(m, origin = GLOBAL_ORIGIN) {
  const p = endpoint(m, origin)
  return {
    name: m.name,
    provider: { npm: p.npm, api: p.base },
    limit: { context: m.context, output: m.output },
    reasoning: true,
    tool_call: true,
    attachment: m.input.length > 1,
    modalities: { input: m.input, output: ["text"] },
    cost: cost(m),
    variants: variants(m),
  }
}

function configModels(origin) {
  return Object.fromEntries(MODELS.map((m) => [m.id, entry(m, origin)]))
}

function mergeModels(defaults, user) {
  const out = { ...defaults }
  for (const [id, value] of Object.entries(user ?? {})) {
    out[id] = out[id] ? { ...out[id], ...value } : value
  }
  return out
}

function model(m, origin = GLOBAL_ORIGIN) {
  const e = entry(m, origin)
  const p = endpoint(m, origin)
  return {
    id: m.id,
    providerID: PROVIDER,
    name: m.name,
    api: { id: m.id, url: p.base, npm: p.npm },
    status: "active",
    cost: {
      input: e.cost.input,
      output: e.cost.output,
      cache: { read: e.cost.cache_read, write: e.cost.cache_write },
    },
    limit: e.limit,
    options: {},
    headers: {},
    capabilities: {
      temperature: true,
      reasoning: true,
      attachment: e.attachment,
      toolcall: true,
      input: {
        text: true,
        image: m.input.includes("image"),
        audio: m.input.includes("audio"),
        video: m.input.includes("video"),
        pdf: m.input.includes("pdf"),
      },
      output: { text: true, image: false, audio: false, video: false, pdf: false },
      interleaved: false,
    },
    release_date: "",
    variants: e.variants,
  }
}

function staticModels(origin) {
  return Object.fromEntries(MODELS.map((m) => [m.id, model(m, origin)]))
}

function authHeaders(key) {
  return { authorization: `Bearer ${key}`, "x-api-key": key }
}

export const AICodeMirrorAuthPlugin = async (input, options) => {
  const origin = pickBaseURL(options?.baseURL)
  const defaultEndpoint = `${origin}${PROTOCOL.anthropic.path}`

  return {
    config: async (cfg) => {
      cfg.provider ??= {}
      const was = cfg.provider[PROVIDER] ?? {}
      cfg.provider[PROVIDER] = {
        name: "AICodeMirror",
        npm: PROTOCOL.anthropic.npm,
        api: defaultEndpoint,
        ...was,
        models: mergeModels(configModels(origin), was.models),
      }
    },

    auth: {
      provider: PROVIDER,
      methods: [{ type: "api", label: "AICodeMirror API Key", placeholder: "sk-…" }],
      async loader(getAuth) {
        const auth = await getAuth()
        if (auth?.type !== "api" || typeof auth.key !== "string" || !auth.key.trim()) return {}
        const key = auth.key.trim()
        return {
          apiKey: key,
          async fetch(request, init) {
            const headers = new Headers(init?.headers ?? request?.headers ?? {})
            headers.set("authorization", `Bearer ${key}`)
            headers.set("x-api-key", key)
            return fetch(request, { ...init, headers })
          },
        }
      },
    },

    provider: {
      id: PROVIDER,
      async models(provider, { auth } = {}) {
        if (auth?.type !== "api" || !auth.key) return provider.models
        return staticModels(origin)
      },
    },
  }
}

export const _internal = {
  PROVIDER,
  GLOBAL_ORIGIN,
  CHINA_ORIGIN,
  ORIGINS,
  PROTOCOL,
  MODELS,
  pickBaseURL,
  endpoint,
  variants,
  cost,
  entry,
  configModels,
  mergeModels,
  model,
  staticModels,
  authHeaders,
}
