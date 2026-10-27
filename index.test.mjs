import { expect, test } from "bun:test"
import { _internal, AICodeMirrorAuthPlugin } from "./index.mjs"

const {
  GLOBAL_ORIGIN,
  CHINA_ORIGIN,
  MODELS,
  pickBaseURL,
  endpoint,
  variants,
  entry,
  model,
  staticModels,
} = _internal

const byId = (id) => MODELS.find((m) => m.id === id)

test("baseURL selects only the two supported origins", () => {
  expect(pickBaseURL(undefined)).toBe(GLOBAL_ORIGIN)
  expect(pickBaseURL(`${CHINA_ORIGIN}/`)).toBe(CHINA_ORIGIN)
  expect(pickBaseURL(" https://api.aicodemirror.ai/// ")).toBe(GLOBAL_ORIGIN)
  expect(pickBaseURL("https://evil.example")).toBe(GLOBAL_ORIGIN)
})

test("Claude uses Anthropic and the other families use the official Responses API", () => {
  expect(endpoint(byId("claude-opus-5-5"))).toEqual({
    npm: "@ai-sdk/anthropic",
    base: `${GLOBAL_ORIGIN}/api/claudecode/v1`,
  })
  expect(endpoint(byId("gpt-6-astra"))).toEqual({
    npm: "@ai-sdk/openai",
    base: `${GLOBAL_ORIGIN}/v1`,
  })
  expect(endpoint(byId("gemini-4-argon"), CHINA_ORIGIN)).toEqual({
    npm: "@ai-sdk/openai",
    base: `${CHINA_ORIGIN}/v1`,
  })
  expect(endpoint(byId("grok-4.7"))).toEqual({
    npm: "@ai-sdk/openai",
    base: `${GLOBAL_ORIGIN}/v1`,
  })
})

test("catalog contains all 25 unique models in four families", () => {
  expect(MODELS).toHaveLength(25)
  expect(new Set(MODELS.map((m) => m.id)).size).toBe(25)
  expect(MODELS.filter((m) => m.protocol === "anthropic")).toHaveLength(12)
  expect(MODELS.filter((m) => m.id.startsWith("gpt-"))).toHaveLength(6)
  expect(MODELS.filter((m) => m.id.startsWith("gemini-"))).toHaveLength(3)
  expect(MODELS.filter((m) => m.id.startsWith("grok-"))).toHaveLength(4)
})

test("official standard prices include cache write and read", () => {
  expect(entry(byId("claude-fable-5-1")).cost).toEqual({
    input: 10,
    output: 50,
    cache_write: 12.5,
    cache_read: 0.25,
  })
  expect(entry(byId("gpt-6.1-terra")).cost).toEqual({
    input: 1,
    output: 5,
    cache_write: 1.25,
    cache_read: 0.05,
  })
  expect(entry(byId("gemini-3.8-flash")).cost.cache_read).toBe(0.075)
  expect(entry(byId("grok-build-0.1")).cost).toEqual({
    input: 1,
    output: 2,
    cache_write: 0,
    cache_read: 0.2,
  })
})

test("model limits and modalities follow the catalog", () => {
  expect(entry(byId("claude-opus-4-8")).limit).toEqual({ context: 1_000_000, output: 32_000 })
  expect(entry(byId("claude-haiku-4-5-20251001")).limit.context).toBe(200_000)
  expect(entry(byId("gpt-6-sol")).limit).toEqual({ context: 1_050_000, output: 128_000 })
  expect(entry(byId("gemini-4-argon")).limit).toEqual({ context: 1_048_576, output: 32_768 })
  expect(entry(byId("grok-4.7")).limit).toEqual({ context: 500_000, output: 500_000 })
  expect(entry(byId("grok-build-0.1")).modalities.input).toEqual(["text", "image", "pdf"])
  expect(entry(byId("gemini-3-flash-preview")).modalities.input).toEqual(["text", "image"])
})

test("variants follow the wire API", () => {
  expect(variants(byId("claude-sonnet-5-5")).high).toEqual({
    thinking: { type: "enabled", budgetTokens: 16_000 },
  })
  expect(variants(byId("gpt-6-astra"))).toEqual({
    low: { reasoningEffort: "low" },
    medium: { reasoningEffort: "medium" },
    high: { reasoningEffort: "high" },
  })
  expect(variants(byId("gemini-4-argon")).low).toEqual({ reasoningEffort: "low" })
})

test("model() returns a full OpenCode model with per-model routing", () => {
  const out = model(byId("gemini-4-argon"), CHINA_ORIGIN)
  expect(out.providerID).toBe("aicodemirror")
  expect(out.api).toEqual({
    id: "gemini-4-argon",
    url: `${CHINA_ORIGIN}/v1`,
    npm: "@ai-sdk/openai",
  })
  expect(out.capabilities.toolcall).toBe(true)
  expect(out.capabilities.input.image).toBe(true)
  expect(out.cost.cache.read).toBe(0.1)
  expect(out.free).toBeUndefined()
})

test("config hook creates all models and preserves user overrides", async () => {
  const plugin = await AICodeMirrorAuthPlugin({}, { baseURL: CHINA_ORIGIN })
  const cfg = {
    provider: {
      aicodemirror: {
        name: "mine",
        models: { "claude-opus-5-5": { name: "custom" } },
      },
    },
  }
  await plugin.config(cfg)
  const p = cfg.provider.aicodemirror
  expect(p.name).toBe("mine")
  expect(Object.keys(p.models)).toHaveLength(25)
  expect(p.models["claude-opus-5-5"].name).toBe("custom")
  expect(p.models["claude-opus-5-5"].cost.input).toBe(4)
  expect(p.models["claude-opus-5-5"].provider.api).toBe(`${CHINA_ORIGIN}/api/claudecode/v1`)
  expect(p.models["gpt-6-astra"].provider.api).toBe(`${CHINA_ORIGIN}/v1`)
  expect(p.models["gemini-4-argon"].provider.api).toBe(`${CHINA_ORIGIN}/v1`)
})

test("config hook creates provider from scratch", async () => {
  const plugin = await AICodeMirrorAuthPlugin({}, undefined)
  const cfg = {}
  await plugin.config(cfg)
  expect(cfg.provider.aicodemirror.name).toBe("AICodeMirror")
  expect(cfg.provider.aicodemirror.models["grok-4.5"].tool_call).toBe(true)
})

test("provider editor switch selects the China origin dynamically", async () => {
  let enabled = false
  const input = {
    magpie: {
      option(provider, key) {
        expect(provider).toBe("aicodemirror")
        expect(key).toBe("china_optimized")
        return enabled
      },
    },
  }
  const plugin = await AICodeMirrorAuthPlugin(input, undefined)
  expect(plugin.auth.options).toEqual([
    {
      key: "china_optimized",
      label: "国内优化线路",
      description: "开启后使用 api.claudecode.net.cn；关闭时使用全球高保线路 api.aicodemirror.ai。",
    },
  ])
  const globalCfg = {}
  await plugin.config(globalCfg)
  expect(globalCfg.provider.aicodemirror.models["grok-4.5"].provider.api).toBe(`${GLOBAL_ORIGIN}/v1`)

  enabled = true
  const chinaCfg = {}
  await plugin.config(chinaCfg)
  expect(chinaCfg.provider.aicodemirror.models["grok-4.5"].provider.api).toBe(`${CHINA_ORIGIN}/v1`)
  const models = await plugin.provider.models({}, { auth: { type: "api", key: "sk-test" } })
  expect(models["gpt-6-astra"].api.url).toBe(`${CHINA_ORIGIN}/v1`)
})

test("loader rejects missing or non-API authentication", async () => {
  const plugin = await AICodeMirrorAuthPlugin({}, undefined)
  expect(await plugin.auth.loader(async () => ({ type: "oauth" }))).toEqual({})
  expect(await plugin.auth.loader(async () => ({ type: "api", key: " " }))).toEqual({})
})

test("loader signs actual fetch requests with bearer and x-api-key", async () => {
  const original = globalThis.fetch
  const calls = []
  globalThis.fetch = async (request, init) => {
    calls.push({ request, init })
    return new Response("ok")
  }
  try {
    const plugin = await AICodeMirrorAuthPlugin({}, { baseURL: CHINA_ORIGIN })
    const got = await plugin.auth.loader(async () => ({ type: "api", key: " sk-test " }))
    expect(got.baseURL).toBeUndefined()
    expect(got.apiKey).toBe("sk-test")
    await got.fetch("https://api.claudecode.net.cn/api/claudecode/v1/messages", {
      headers: { "x-existing": "yes" },
    })
    const headers = new Headers(calls[0].init.headers)
    expect(headers.get("authorization")).toBe("Bearer sk-test")
    expect(headers.get("x-api-key")).toBe("sk-test")
    expect(headers.get("x-existing")).toBe("yes")
  } finally {
    globalThis.fetch = original
  }
})

test("models hook is static and does not invent unknown free models", async () => {
  const plugin = await AICodeMirrorAuthPlugin({}, undefined)
  const provider = { models: { existing: true } }
  expect(await plugin.provider.models(provider, {})).toBe(provider.models)
  const out = await plugin.provider.models(provider, { auth: { type: "api", key: "sk-test" } })
  expect(Object.keys(out)).toHaveLength(25)
  expect(out["gpt-6-astra"].api.npm).toBe("@ai-sdk/openai")
  expect(Object.values(out).every((m) => m.free === undefined)).toBe(true)
  expect(staticModels(GLOBAL_ORIGIN)["grok-4.7"].limit.context).toBe(500_000)
})

test("magpie.icon is the inlined assets/icon.jpg", async () => {
  const { readFile } = await import("node:fs/promises")
  const pkg = JSON.parse(await readFile(new URL("./package.json", import.meta.url), "utf8"))
  const prefix = "data:image/jpeg;base64,"
  expect(pkg.magpie.icon.startsWith(prefix)).toBe(true)
  const inlined = Buffer.from(pkg.magpie.icon.slice(prefix.length), "base64")
  const onDisk = await readFile(new URL("./assets/icon.jpg", import.meta.url))
  expect(inlined.equals(onDisk)).toBe(true)
})

test("package keeps zero runtime dependencies", async () => {
  const { readFile } = await import("node:fs/promises")
  const pkg = JSON.parse(await readFile(new URL("./package.json", import.meta.url), "utf8"))
  expect(pkg.dependencies).toBeUndefined()
  expect(pkg.name).toBe("opencode-aicodemirror-auth")
})
