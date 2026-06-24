const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

const SYSTEM_PROMPT = `You are a recipe parser. The user will provide either:
- A URL to a recipe page (with optional image candidates from that page), OR
- Free-form text describing or containing a recipe

Return ONLY a JSON object with this exact structure (no markdown, no extra text):
{
  "title": "string",
  "servings": number,
  "prep_minutes": number | null,
  "cook_minutes": number | null,
  "l1": "starters" | "entrees" | "desserts" | null,
  "recipe_type": "string | null",
  "source_url": "string | null",
  "instruction_steps": ["string", "..."],
  "ingredients": [
    { "name": "string", "quantity": number, "unit": "string" }
  ],
  "macros": {
    "calories": number | null,
    "protein_g": number | null,
    "carbs_g": number | null,
    "fat_g": number | null
  },
  "images": [
    { "url": "string", "is_primary": boolean }
  ]
}

Rules:
- l1: classify as starters (soups/salads/apps), entrees (mains), or desserts. null if unclear.
- recipe_type: short style tag like "Italian", "Quick", "Vegetarian". null if nothing fits.
- source_url: set when the user provided a URL.
- instruction_steps: one clear step per array item. No leading numbers or bullets in the text.
- unit: one of: each, g, kg, ml, L, cup, tbsp, tsp, oz, lb, pack, bottle, can.
- macros: only if explicitly stated. All null otherwise.
- images: ONLY when image candidates are provided. Include ONLY photos of the finished dish or the food being prepared.
  Exclude logos, icons, author headshots, ads, Pinterest/social buttons, site branding, utensils-only shots, and stock UI graphics.
  Pick exactly one is_primary: true for the best hero shot of the dish. If no suitable food photo exists, return an empty images array.
  Use candidate URLs exactly as given — do not invent URLs.
- Return ONLY the JSON object. No markdown fences.`

const SKIP_IMAGE_PATTERN =
  /(?:logo|icon|avatar|badge|sprite|pixel|favicon|gravatar|tracking|analytics|advert|banner|widget|emoji|share|social|pinterest|facebook|twitter|instagram|author|profile|thumbnail-\d+x\d+|\/\d{1,2}x\d{1,2}\/)/i

const SKIP_IMAGE_EXT = /\.(svg|ico|gif)(\?|$)/i

function resolveUrl(src: string, base: string): string | null {
  try {
    if (src.startsWith('data:')) return null
    if (src.startsWith('//')) return `https:${src}`
    return new URL(src, base).href
  } catch {
    return null
  }
}

function isLikelyFoodImageCandidate(url: string, alt = ''): boolean {
  const combined = `${url} ${alt}`.toLowerCase()
  if (SKIP_IMAGE_EXT.test(url)) return false
  if (SKIP_IMAGE_PATTERN.test(combined)) return false
  if (url.includes('1x1') || url.includes('spacer')) return false
  return true
}

function extractImageCandidates(html: string, pageUrl: string): Array<{ url: string; alt: string }> {
  const seen = new Set<string>()
  const candidates: Array<{ url: string; alt: string }> = []

  const add = (src: string | null | undefined, alt = '') => {
    if (!src) return
    const resolved = resolveUrl(src.trim(), pageUrl)
    if (!resolved || seen.has(resolved)) return
    if (!isLikelyFoodImageCandidate(resolved, alt)) return
    seen.add(resolved)
    candidates.push({ url: resolved, alt: alt.trim() })
  }

  // Open Graph / Twitter
  for (const match of html.matchAll(
    /<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']+)["']/gi,
  )) {
    add(match[1])
  }
  for (const match of html.matchAll(
    /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image|twitter:image)["']/gi,
  )) {
    add(match[1])
  }

  // JSON-LD recipe images
  for (const match of html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const json = JSON.parse(match[1]) as unknown
      const nodes = Array.isArray(json) ? json : [json]
      for (const node of nodes) {
        if (!node || typeof node !== 'object') continue
        const record = node as Record<string, unknown>
        const type = String(record['@type'] ?? '').toLowerCase()
        if (!type.includes('recipe')) continue
        const image = record.image
        if (typeof image === 'string') add(image)
        else if (Array.isArray(image)) {
          for (const img of image) {
            if (typeof img === 'string') add(img)
            else if (img && typeof img === 'object' && 'url' in img) {
              add(String((img as { url: string }).url))
            }
          }
        } else if (image && typeof image === 'object' && 'url' in image) {
          add(String((image as { url: string }).url))
        }
      }
    } catch {
      // ignore invalid JSON-LD
    }
  }

  // img tags — prefer larger hints in attributes
  for (const match of html.matchAll(/<img[^>]+>/gi)) {
    const tag = match[0]
    const src =
      tag.match(/\ssrc=["']([^"']+)["']/i)?.[1] ??
      tag.match(/\sdata-src=["']([^"']+)["']/i)?.[1] ??
      tag.match(/\sdata-lazy-src=["']([^"']+)["']/i)?.[1]
    const alt = tag.match(/\salt=["']([^"']*)["']/i)?.[1] ?? ''
    const width = parseInt(tag.match(/\swidth=["']?(\d+)/i)?.[1] ?? '0', 10)
    const height = parseInt(tag.match(/\sheight=["']?(\d+)/i)?.[1] ?? '0', 10)
    if ((width > 0 && width < 120) || (height > 0 && height < 120)) continue
    add(src, alt)
  }

  return candidates.slice(0, 20)
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .slice(0, 12_000)
}

async function fetchPage(url: string): Promise<{ html: string; text: string }> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; RecipeParser/1.0)',
      Accept: 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(12_000),
  })
  if (!res.ok) throw new Error(`Failed to fetch URL (${res.status})`)
  const html = await res.text()
  return { html, text: htmlToText(html) }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiKey) {
      return jsonResponse({ error: 'OpenAI API key not configured' }, 500)
    }

    const body = await req.json() as { input?: string; type?: 'url' | 'text' }
    const { input, type } = body

    if (!input || typeof input !== 'string' || !input.trim()) {
      return jsonResponse({ error: 'input is required' }, 400)
    }

    let userContent: string
    let imageCandidates: Array<{ url: string; alt: string }> = []

    if (type === 'url') {
      const trimmedUrl = input.trim()
      try {
        const { html, text } = await fetchPage(trimmedUrl)
        imageCandidates = extractImageCandidates(html, trimmedUrl)
        const candidateBlock =
          imageCandidates.length > 0
            ? `\n\nImage candidates from page (select only actual food photos):\n${imageCandidates
                .map((c, i) => `${i + 1}. url: ${c.url}${c.alt ? ` | alt: ${c.alt}` : ''}`)
                .join('\n')}`
            : ''
        userContent = `Parse the recipe from this URL: ${trimmedUrl}\n\nPage content:\n${text}${candidateBlock}`
      } catch (fetchErr) {
        const msg = fetchErr instanceof Error ? fetchErr.message : 'Unknown fetch error'
        userContent = `Parse the recipe from this URL (could not fetch automatically: ${msg}): ${trimmedUrl}`
      }
    } else {
      userContent = `Parse the following recipe text:\n\n${input.trim()}\n\n(No image candidates — return images as an empty array.)`
    }

    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0,
        max_tokens: 2000,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
      }),
    })

    if (!aiRes.ok) {
      const err = await aiRes.text()
      return jsonResponse({ error: `OpenAI error: ${err}` }, 502)
    }

    const aiData = await aiRes.json() as {
      choices: Array<{ message: { content: string } }>
    }

    const raw = aiData.choices?.[0]?.message?.content?.trim() ?? ''

    let recipe: Record<string, unknown>
    try {
      recipe = JSON.parse(raw) as Record<string, unknown>
    } catch {
      const cleaned = raw.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim()
      recipe = JSON.parse(cleaned) as Record<string, unknown>
    }

    // Normalize instruction_steps → instructions string for DB
    const steps = Array.isArray(recipe.instruction_steps)
      ? (recipe.instruction_steps as unknown[]).map((s) => String(s).trim()).filter(Boolean)
      : []
    if (steps.length > 0) {
      recipe.instructions = steps.join('\n')
    } else if (typeof recipe.instructions === 'string') {
      recipe.instruction_steps = recipe.instructions
        .split(/\n+/)
        .map((s) => s.replace(/^\s*(\d+[\.\)]\s*|[-•*]\s*)/, '').trim())
        .filter(Boolean)
    } else {
      recipe.instructions = ''
      recipe.instruction_steps = []
    }

    // Validate image URLs against candidates (prevent hallucinated URLs)
    if (type === 'url' && Array.isArray(recipe.images)) {
      const allowed = new Set(imageCandidates.map((c) => c.url))
      recipe.images = (recipe.images as Array<{ url?: string; is_primary?: boolean }>)
        .filter((img) => img.url && allowed.has(img.url))
        .map((img, i, arr) => ({
          url: img.url,
          is_primary: img.is_primary === true,
        }))
      if ((recipe.images as unknown[]).length > 0) {
        const hasPrimary = (recipe.images as Array<{ is_primary: boolean }>).some((i) => i.is_primary)
        if (!hasPrimary) {
          (recipe.images as Array<{ is_primary: boolean }>)[0].is_primary = true
        }
      }
    } else {
      recipe.images = []
    }

    return jsonResponse({ recipe })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return jsonResponse({ error: message }, 500)
  }
})
