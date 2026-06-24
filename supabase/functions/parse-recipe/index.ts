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

const SYSTEM_PROMPT = `You are a recipe parser. The user will provide recipe content — often including STRUCTURED RECIPE DATA extracted from a web page.

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
- When STRUCTURED RECIPE DATA is provided, treat it as authoritative for title, servings, ingredients, and instructions.
  Parse each ingredient string into quantity, unit, and name WITHOUT changing the amounts (e.g. "1 cup salted butter" → quantity: 1, unit: "cup", name: "salted butter").
  For fractions use decimals: ½ → 0.5, ¼ → 0.25, ¾ → 0.75, ⅓ → 0.33, ⅔ → 0.67.
- l1: starters (soups/salads/apps), entrees (mains), desserts. null if unclear.
- recipe_type: short style tag like "Italian", "Quick", "Baked". null if nothing fits.
- source_url: set when the user provided a URL.
- instruction_steps: one clear step per array item. No leading numbers or bullets.
- unit: one of: each, g, kg, ml, L, cup, tbsp, tsp, oz, lb, pack, bottle, can.
- macros: only if explicitly stated in structured nutrition data. All null otherwise.
- images: ONLY when image candidates are provided. Include ONLY photos of the finished dish.
  Exclude logos, icons, author photos, ads, social buttons. One is_primary: true. Empty array if none suitable.
  Use candidate URLs exactly as given.
- Return ONLY the JSON object. No markdown fences.`

const SKIP_IMAGE_PATTERN =
  /(?:logo|icon|avatar|badge|sprite|pixel|favicon|gravatar|tracking|analytics|advert|banner|widget|emoji|share|social|pinterest|facebook|twitter|instagram|author|profile|thumbnail-\d+x\d+|\/\d{1,2}x\d{1,2}\/)/i

const SKIP_IMAGE_EXT = /\.(svg|ico|gif)(\?|$)/i

const FRACTION_CHARS: Record<string, number> = {
  '½': 0.5,
  '¼': 0.25,
  '¾': 0.75,
  '⅓': 0.33,
  '⅔': 0.67,
  '⅛': 0.125,
}

const UNIT_ALIASES: Record<string, string> = {
  cup: 'cup',
  cups: 'cup',
  tablespoon: 'tbsp',
  tablespoons: 'tbsp',
  tbsp: 'tbsp',
  tbs: 'tbsp',
  teaspoon: 'tsp',
  teaspoons: 'tsp',
  tsp: 'tsp',
  ounce: 'oz',
  ounces: 'oz',
  oz: 'oz',
  pound: 'lb',
  pounds: 'lb',
  lbs: 'lb',
  lb: 'lb',
  gram: 'g',
  grams: 'g',
  g: 'g',
  kilogram: 'kg',
  kilograms: 'kg',
  kg: 'kg',
  milliliter: 'ml',
  milliliters: 'ml',
  ml: 'ml',
  liter: 'L',
  liters: 'L',
  litre: 'L',
  litres: 'L',
  can: 'can',
  cans: 'can',
  bottle: 'bottle',
  bottles: 'bottle',
  pack: 'pack',
  package: 'pack',
  packages: 'pack',
  pinch: 'tsp',
  clove: 'each',
  cloves: 'each',
  slice: 'each',
  slices: 'each',
  piece: 'each',
  pieces: 'each',
  head: 'each',
  heads: 'each',
  bunch: 'each',
  bunches: 'each',
  sprig: 'each',
  sprigs: 'each',
  stalk: 'each',
  stalks: 'each',
}

type ParsedIngredient = { name: string; quantity: number; unit: string }

function parseQuantityToken(token: string): number {
  const t = token.trim()
  if (FRACTION_CHARS[t] !== undefined) return FRACTION_CHARS[t]
  if (t.includes('/')) {
    const parts = t.split('/').map((p) => parseFloat(p.trim()))
    if (parts.length === 2 && parts[1]) return parts[0] / parts[1]
  }
  const mixed = t.match(/^(\d+)\s+(\d+\/\d+|[½¼¾⅓⅔⅛])$/)
  if (mixed) return parseQuantityToken(mixed[1]) + parseQuantityToken(mixed[2])
  const n = parseFloat(t)
  return Number.isFinite(n) ? n : 1
}

function normalizeUnit(word: string): string | null {
  const key = word.toLowerCase().replace(/\./g, '')
  return UNIT_ALIASES[key] ?? null
}

/** Parse a single ingredient line like "1 cup flour" or "2 large eggs". */
function parseIngredientLine(line: string): ParsedIngredient {
  let text = line.trim().replace(/^[-•▢*]+\s*/, '').trim()
  if (!text) return { name: line.trim(), quantity: 1, unit: 'each' }

  let quantity = 1
  let rest = text

  // Leading unicode fraction e.g. "½ teaspoon salt"
  if (FRACTION_CHARS[text[0]]) {
    quantity = FRACTION_CHARS[text[0]]
    rest = text.slice(1).trim()
  } else {
    const qtyMatch = text.match(
      /^((?:\d+\s+)?(?:\d+\/\d+|\d+(?:\.\d+)?))\s*(?:-|–|to)?\s*(?:\d+(?:\.\d+)?|\d+\/\d+)?\s*/u,
    )
    if (qtyMatch) {
      quantity = parseQuantityToken(qtyMatch[1].trim())
      rest = text.slice(qtyMatch[0].length).trim()
    }
  }

  // Optional unit word(s) — try longest match first (e.g. "tablespoons")
  const words = rest.split(/\s+/)
  for (let len = Math.min(3, words.length); len >= 1; len--) {
    const phrase = words.slice(0, len).join(' ')
    const unit = normalizeUnit(phrase)
    if (unit) {
      const name = words.slice(len).join(' ').trim()
      return { quantity, unit, name: name || rest }
    }
    if (len === 1) {
      const single = normalizeUnit(words[0])
      if (single) {
        return { quantity, unit: single, name: words.slice(1).join(' ').trim() || rest }
      }
    }
  }

  return { quantity, unit: 'each', name: rest || text }
}

function parseIngredientLines(lines: string[]): ParsedIngredient[] {
  return lines.map(parseIngredientLine).filter((i) => i.name.length > 0)
}

function normalizeLlmIngredient(ing: {
  name?: string
  quantity?: number
  unit?: string
}): ParsedIngredient {
  const name = String(ing.name ?? '').trim()
  const rawUnit = String(ing.unit ?? '').trim().toLowerCase()
  const quantity = typeof ing.quantity === 'number' ? ing.quantity : 1

  const knownUnits = ['cup', 'tbsp', 'tsp', 'oz', 'lb', 'g', 'kg', 'ml', 'L', 'each', 'pack', 'bottle', 'can']
  if (rawUnit && (knownUnits.includes(rawUnit) || UNIT_ALIASES[rawUnit])) {
    return { name, quantity, unit: UNIT_ALIASES[rawUnit] ?? rawUnit }
  }

  // Unit missing or in name — re-parse the full line
  const line =
    quantity !== 1 && !name.match(/^\d/)
      ? `${quantity} ${name}`
      : name
  const reparsed = parseIngredientLine(line)
  if (reparsed.unit !== 'each') return reparsed

  return { name: reparsed.name || name, quantity: reparsed.quantity, unit: 'each' }
}

function extractWprmIngredientLines(html: string): string[] {
  const ingBlock = html.match(
    /wprm-recipe-ingredients-container[\s\S]*?<\/(?:ul|div)>/i,
  )?.[0]
  if (!ingBlock) return []
  return [...ingBlock.matchAll(/wprm-recipe-ingredient[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((m) => stripHtmlTags(m[1]))
    .filter(Boolean)
}

function extractIngredientLinesFromText(text: string): string[] {
  return text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => /^[-•▢*]?\s*(\d|[½¼¾⅓⅔⅛])/.test(l))
}

type StructuredRecipe = {
  name?: string
  recipeYield?: string | number | string[]
  prepTime?: string
  cookTime?: string
  totalTime?: string
  recipeIngredient?: string[]
  recipeInstructions?: Array<string | { text?: string; name?: string }>
  image?: string | string[] | { url?: string } | Array<{ url?: string }>
  nutrition?: Record<string, unknown>
}

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

function parseIsoDurationMinutes(iso?: string): number | null {
  if (!iso || typeof iso !== 'string') return null
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/i)
  if (!match) return null
  const hours = parseInt(match[1] ?? '0', 10)
  const minutes = parseInt(match[2] ?? '0', 10)
  const total = hours * 60 + minutes
  return total > 0 ? total : null
}

function parseYieldToServings(yield_: string | number | string[] | undefined): number | null {
  if (yield_ == null) return null
  const raw = Array.isArray(yield_) ? yield_[0] : yield_
  if (typeof raw === 'number') return raw > 0 ? raw : null
  const num = parseInt(String(raw).replace(/[^\d]/g, ''), 10)
  return num > 0 ? num : null
}

function stripHtmlTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&frac12;/gi, '½')
    .replace(/&frac14;/gi, '¼')
    .replace(/&frac34;/gi, '¾')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function collectJsonLdNodes(parsed: unknown): unknown[] {
  if (!parsed || typeof parsed !== 'object') return []
  const record = parsed as Record<string, unknown>
  if (Array.isArray(record['@graph'])) return record['@graph'] as unknown[]
  if (Array.isArray(parsed)) return parsed
  return [parsed]
}

function isRecipeNode(node: unknown): node is StructuredRecipe {
  if (!node || typeof node !== 'object') return false
  const type = (node as Record<string, unknown>)['@type']
  const types = Array.isArray(type) ? type : [type]
  return types.some((t) => String(t).toLowerCase() === 'recipe')
}

function extractJsonLdRecipes(html: string): StructuredRecipe[] {
  const recipes: StructuredRecipe[] = []
  for (const match of html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const parsed = JSON.parse(match[1]) as unknown
      for (const node of collectJsonLdNodes(parsed)) {
        if (isRecipeNode(node)) recipes.push(node)
      }
    } catch {
      // ignore invalid JSON-LD
    }
  }
  return recipes
}

function instructionToText(step: string | { text?: string; name?: string }): string {
  if (typeof step === 'string') return step.trim()
  return (step.text ?? step.name ?? '').trim()
}

function structuredRecipeToText(recipe: StructuredRecipe): string {
  const lines: string[] = ['STRUCTURED RECIPE DATA (authoritative — use exact ingredient amounts):']
  if (recipe.name) lines.push(`Title: ${recipe.name}`)
  const servings = parseYieldToServings(recipe.recipeYield)
  if (servings) lines.push(`Servings: ${servings}`)
  else if (recipe.recipeYield) lines.push(`Yield: ${JSON.stringify(recipe.recipeYield)}`)
  const prep = parseIsoDurationMinutes(recipe.prepTime)
  const cook = parseIsoDurationMinutes(recipe.cookTime)
  if (prep) lines.push(`Prep minutes: ${prep}`)
  if (cook) lines.push(`Cook minutes: ${cook}`)

  if (recipe.recipeIngredient?.length) {
    lines.push('', 'Ingredients:')
    for (const ing of recipe.recipeIngredient) {
      lines.push(`- ${ing}`)
    }
  }

  if (recipe.recipeInstructions?.length) {
    lines.push('', 'Instructions:')
    for (const step of recipe.recipeInstructions) {
      const text = instructionToText(step)
      if (text) lines.push(`- ${text}`)
    }
  }

  if (recipe.nutrition) {
    lines.push('', `Nutrition: ${JSON.stringify(recipe.nutrition)}`)
  }

  return lines.join('\n')
}

function extractWprmRecipeText(html: string): string | null {
  const parts: string[] = []

  const ingBlock = html.match(
    /wprm-recipe-ingredients-container[\s\S]*?<\/(?:ul|div)>/i,
  )?.[0]
  if (ingBlock) {
    const items = [...ingBlock.matchAll(/wprm-recipe-ingredient[^>]*>([\s\S]*?)<\/li>/gi)]
      .map((m) => stripHtmlTags(m[1]))
      .filter(Boolean)
    if (items.length > 0) {
      parts.push('Recipe card ingredients:')
      items.forEach((item) => parts.push(`- ${item}`))
    }
  }

  const instBlock = html.match(
    /wprm-recipe-instructions-container[\s\S]*?<\/(?:ol|div)>/i,
  )?.[0]
  if (instBlock) {
    const steps = [...instBlock.matchAll(/wprm-recipe-instruction-text[^>]*>([\s\S]*?)<\/(?:div|li)/gi)]
      .map((m) => stripHtmlTags(m[1]))
      .filter(Boolean)
    if (steps.length > 0) {
      parts.push('', 'Recipe card instructions:')
      steps.forEach((step) => parts.push(`- ${step}`))
    }
  }

  return parts.length > 0 ? parts.join('\n') : null
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

  for (const recipe of extractJsonLdRecipes(html)) {
    const image = recipe.image
    if (typeof image === 'string') add(image)
    else if (Array.isArray(image)) {
      for (const img of image) {
        if (typeof img === 'string') add(img)
        else if (img && typeof img === 'object' && 'url' in img) add(String(img.url))
      }
    } else if (image && typeof image === 'object' && 'url' in image) {
      add(String((image as { url: string }).url))
    }
  }

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

function buildRecipeContent(html: string, pageUrl: string): string {
  const structured = extractJsonLdRecipes(html)
  if (structured.length > 0) {
    return structured.map(structuredRecipeToText).join('\n\n')
  }

  const wprm = extractWprmRecipeText(html)
  if (wprm) return wprm

  // Fallback: strip HTML but prioritize recipe-card region if present
  const recipeRegion =
    html.match(/wprm-recipe-container[\s\S]{0,25000}/i)?.[0] ??
    html.match(/recipe-ingredients[\s\S]{0,25000}/i)?.[0] ??
    html

  return stripHtmlTags(recipeRegion).slice(0, 15_000)
}

async function fetchPage(url: string): Promise<{ html: string }> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; RecipeParser/1.0)',
      Accept: 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(12_000),
  })
  if (!res.ok) throw new Error(`Failed to fetch URL (${res.status})`)
  const html = await res.text()
  return { html }
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
    let authoritativeIngredientLines: string[] = []

    if (type === 'url') {
      const trimmedUrl = input.trim()
      try {
        const { html } = await fetchPage(trimmedUrl)
        imageCandidates = extractImageCandidates(html, trimmedUrl)

        const structured = extractJsonLdRecipes(html)
        if (structured[0]?.recipeIngredient?.length) {
          authoritativeIngredientLines = structured[0].recipeIngredient
        } else {
          const wprmLines = extractWprmIngredientLines(html)
          if (wprmLines.length > 0) authoritativeIngredientLines = wprmLines
        }

        const recipeContent = buildRecipeContent(html, trimmedUrl)
        const candidateBlock =
          imageCandidates.length > 0
            ? `\n\nImage candidates (select only actual food photos):\n${imageCandidates
                .map((c, i) => `${i + 1}. url: ${c.url}${c.alt ? ` | alt: ${c.alt}` : ''}`)
                .join('\n')}`
            : ''
        userContent = `Parse the recipe from: ${trimmedUrl}\n\n${recipeContent}${candidateBlock}`
      } catch (fetchErr) {
        const msg = fetchErr instanceof Error ? fetchErr.message : 'Unknown fetch error'
        userContent = `Parse the recipe from this URL (could not fetch: ${msg}): ${trimmedUrl}`
      }
    } else {
      authoritativeIngredientLines = extractIngredientLinesFromText(input.trim())
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
        max_tokens: 2500,
        response_format: { type: 'json_object' },
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

    // Prefer deterministic ingredient parsing for reliable units
    if (authoritativeIngredientLines.length > 0) {
      recipe.ingredients = parseIngredientLines(authoritativeIngredientLines)
    } else if (Array.isArray(recipe.ingredients)) {
      recipe.ingredients = (recipe.ingredients as Array<{
        name?: string
        quantity?: number
        unit?: string
      }>).map(normalizeLlmIngredient)
    }

    if (type === 'url' && Array.isArray(recipe.images)) {
      const allowed = new Set(imageCandidates.map((c) => c.url))
      recipe.images = (recipe.images as Array<{ url?: string; is_primary?: boolean }>)
        .filter((img) => img.url && allowed.has(img.url))
        .map((img) => ({
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
