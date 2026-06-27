import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-shortcut-token',
}

const VALID_UNITS = new Set([
  'each',
  'g',
  'kg',
  'ml',
  'L',
  'cup',
  'tbsp',
  'tsp',
  'oz',
  'lb',
  'pack',
  'bottle',
  'can',
])

type Action = 'add' | 'remove'
type Destination = 'shopping_list' | 'pantry' | 'supply'
type InventoryL1 = 'pantry' | 'supply'
type ShoppingL1 = 'pantry' | 'supply' | 'general'

type ParsedItem = {
  name: string
  quantity: number
  unit: string
}

type ParsedCommand = {
  action: Action
  destination: Destination | null
  items: ParsedItem[]
  removeAll: boolean
}

type ShoppingRow = {
  id: string
  name: string
  quantity: number
  unit: string
  l1: ShoppingL1
}

type InventoryRow = {
  id: string
  name: string
  quantity: number
  unit: string
  l1: InventoryL1
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function normalizeUnit(raw: string | undefined): string {
  if (!raw) return 'each'
  const lower = raw.toLowerCase()
  const aliases: Record<string, string> = {
    cups: 'cup',
    tablespoons: 'tbsp',
    tablespoon: 'tbsp',
    teaspoons: 'tsp',
    teaspoon: 'tsp',
    pounds: 'lb',
    pound: 'lb',
    ounces: 'oz',
    ounce: 'oz',
    liters: 'L',
    litre: 'L',
    litres: 'L',
    milliliters: 'ml',
    milliliter: 'ml',
    grams: 'g',
    kilograms: 'kg',
    kilogram: 'kg',
    packs: 'pack',
    bottles: 'bottle',
    cans: 'can',
  }
  const unit = aliases[lower] ?? lower
  return VALID_UNITS.has(unit) ? unit : 'each'
}

function guessShoppingL1(name: string): ShoppingL1 {
  const lower = name.toLowerCase()
  const supplyHints = [
    'toilet paper',
    'paper towel',
    'detergent',
    'soap',
    'shampoo',
    'bleach',
    'trash bag',
    'sponge',
    'cleaner',
    'laundry',
    'tissue',
  ]
  if (supplyHints.some((hint) => lower.includes(hint))) return 'supply'
  return 'general'
}

function parseItemLine(line: string): ParsedItem | null {
  const trimmed = line.trim().replace(/^(the|some|a|an)\s+/i, '')
  if (!trimmed) return null

  const removeAllMatch = trimmed.match(/^all\s+(?:of\s+)?(?:the\s+)?(.+)$/i)
  if (removeAllMatch) {
    return { name: removeAllMatch[1].trim(), quantity: 0, unit: 'each' }
  }

  const qtyUnitName = trimmed.match(
    /^(\d+(?:\.\d+)?)\s*(cup|cups|tbsp|tsp|oz|lb|g|kg|ml|l|pack|packs|bottle|bottles|can|cans)?\s+(?:of\s+)?(.+)$/i,
  )
  if (qtyUnitName) {
    const quantity = parseFloat(qtyUnitName[1])
    const unit = normalizeUnit(qtyUnitName[2])
    const name = qtyUnitName[3].trim()
    if (!name) return null
    return { name, quantity: Number.isFinite(quantity) ? quantity : 1, unit }
  }

  const qtyXName = trimmed.match(/^(\d+(?:\.\d+)?)\s*x\s+(.+)$/i)
  if (qtyXName) {
    const quantity = parseFloat(qtyXName[1])
    const name = qtyXName[2].trim()
    if (!name) return null
    return {
      name,
      quantity: Number.isFinite(quantity) ? quantity : 1,
      unit: 'each',
    }
  }

  return { name: trimmed, quantity: 1, unit: 'each' }
}

function parseItemText(itemText: string): ParsedItem[] {
  return itemText
    .split(/,|(?:\band\b)/i)
    .map((part) => parseItemLine(part))
    .filter((item): item is ParsedItem => !!item && item.name.length > 0)
}

function detectDestination(text: string): Destination | null {
  const lower = text.toLowerCase()
  if (/\b(shopping\s*list|grocery\s*list)\b/.test(lower) || /\bshopping\b/.test(lower)) {
    return 'shopping_list'
  }
  if (/\bsupply(?:\s+closet)?\b/.test(lower)) return 'supply'
  if (/\bpantry\b/.test(lower)) return 'pantry'
  return null
}

function stripDestinationPhrases(text: string): string {
  return text
    .replace(/\b(to|in|into|from|on)\s+(the\s+)?(shopping\s*list|grocery\s*list|shopping)\b/gi, '')
    .replace(/\b(to|in|into|from|on)\s+(the\s+)?supply(?:\s+closet)?\b/gi, '')
    .replace(/\b(to|in|into|from|on)\s+(the\s+)?pantry\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseSingleCommand(text: string): ParsedCommand {
  let working = text.trim()
  let action: Action = 'add'
  let removeAll = false

  const lower = working.toLowerCase()

  if (/\b(we'?re\s+)?out\s+of\b|\bi\s+need\b|\bneed\s+to\s+(?:buy|get)\b|\bbuy\b|\bget\s+(?:some\s+)?|\bpick\s+up\b/.test(lower)) {
    action = 'add'
    working = working
      .replace(/\b(we'?re\s+)?out\s+of\b/gi, '')
      .replace(/\bi\s+need\s+to\s+(?:buy|get)\b/gi, '')
      .replace(/\bi\s+need\b/gi, '')
      .replace(/\bneed\s+to\s+(?:buy|get)\b/gi, '')
      .replace(/\bbuy\b/gi, '')
      .replace(/\bget\s+(?:some\s+)?/gi, '')
      .replace(/\bpick\s+up\b/gi, '')
  } else if (/\b(used|finished|ate)\s+(the\s+)?(last\s+of\s+)?/i.test(working)) {
    action = 'remove'
    removeAll = true
    working = working.replace(/\b(used|finished|ate)\s+(the\s+)?(last\s+of\s+)?/gi, '')
  } else if (/\b(remove|subtract|delete|take off|clear)\b/i.test(working)) {
    action = 'remove'
    working = working.replace(/\b(remove|subtract|delete|take off|clear)\b/gi, '')
  } else if (/\b(add|put|stock)\b/i.test(working)) {
    action = 'add'
    working = working.replace(/\b(add|put|stock)\b/gi, '')
  }

  let destination = detectDestination(working)
  if (!destination) {
    destination = action === 'add' ? 'shopping_list' : null
  }

  working = stripDestinationPhrases(working)
  const items = parseItemText(working)

  for (const item of items) {
    if (item.quantity === 0) removeAll = true
  }

  return { action, destination, items, removeAll }
}

function parseCommands(text: string): ParsedCommand[] {
  const segments = text
    .split(/\s+and\s+(?=(?:add|remove|put|buy|need|used|finished|we'?re\s+out|i\s+need)\b)/i)
    .map((segment) => segment.trim())
    .filter(Boolean)

  const commands = (segments.length > 0 ? segments : [text])
    .map(parseSingleCommand)
    .filter((command) => command.items.length > 0)

  return commands
}

function findByName<T extends { name: string }>(rows: T[], name: string): T | undefined {
  const lower = name.toLowerCase()
  return (
    rows.find((row) => row.name.toLowerCase() === lower) ??
    rows.find((row) => row.name.toLowerCase().includes(lower)) ??
    rows.find((row) => lower.includes(row.name.toLowerCase()))
  )
}

function destinationLabel(destination: Destination | null): string {
  switch (destination) {
    case 'pantry':
      return 'pantry'
    case 'supply':
      return 'supply closet'
    case 'shopping_list':
      return 'shopping list'
    default:
      return 'inventory'
  }
}

function extractToken(req: Request): string | null {
  const headerToken = req.headers.get('X-Shortcut-Token')?.trim()
  if (headerToken) return headerToken

  const auth = req.headers.get('Authorization')?.trim()
  if (auth?.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim()
  }

  return null
}

async function executeAddShopping(
  admin: ReturnType<typeof createClient>,
  householdId: string,
  userId: string,
  items: ParsedItem[],
  existingItems: ShoppingRow[],
  shoppingL1: ShoppingL1,
): Promise<string[]> {
  const added: string[] = []

  for (const item of items) {
    const l1 = shoppingL1 === 'general' ? guessShoppingL1(item.name) : shoppingL1
    const duplicate = existingItems.find(
      (row) => row.name.toLowerCase() === item.name.toLowerCase() && row.l1 === l1,
    )

    if (duplicate) {
      const newQty = Number(duplicate.quantity) + item.quantity
      const { error } = await admin
        .from('shopping_list_items')
        .update({ quantity: newQty })
        .eq('id', duplicate.id)
      if (error) throw new Error(error.message)
      duplicate.quantity = newQty
      added.push(item.name)
      continue
    }

    const { data: inserted, error } = await admin
      .from('shopping_list_items')
      .insert({
        household_id: householdId,
        added_by: userId,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        l1,
      })
      .select('id, name, quantity, unit, l1')
      .single()

    if (error) throw new Error(error.message)
    if (inserted) existingItems.push(inserted as ShoppingRow)
    added.push(item.name)
  }

  return added
}

async function executeRemoveShopping(
  admin: ReturnType<typeof createClient>,
  items: ParsedItem[],
  existingItems: ShoppingRow[],
  removeAll: boolean,
): Promise<string[]> {
  const removed: string[] = []

  for (const item of items) {
    const match = findByName(existingItems, item.name)
    if (!match) continue

    const subtract = removeAll || item.quantity === 0 ? Number(match.quantity) : item.quantity
    const newQty = Number(match.quantity) - subtract

    if (newQty <= 0) {
      const { error } = await admin.from('shopping_list_items').delete().eq('id', match.id)
      if (error) throw new Error(error.message)
      const idx = existingItems.findIndex((row) => row.id === match.id)
      if (idx >= 0) existingItems.splice(idx, 1)
    } else {
      const { error } = await admin
        .from('shopping_list_items')
        .update({ quantity: newQty })
        .eq('id', match.id)
      if (error) throw new Error(error.message)
      match.quantity = newQty
    }

    removed.push(item.name)
  }

  return removed
}

async function executeAddInventory(
  admin: ReturnType<typeof createClient>,
  householdId: string,
  l1: InventoryL1,
  items: ParsedItem[],
  existingItems: InventoryRow[],
): Promise<string[]> {
  const added: string[] = []

  for (const item of items) {
    const duplicate = existingItems.find(
      (row) => row.l1 === l1 && row.name.toLowerCase() === item.name.toLowerCase(),
    )

    if (duplicate) {
      const newQty = Number(duplicate.quantity) + item.quantity
      const { error } = await admin
        .from('inventory_items')
        .update({ quantity: newQty, unit: item.unit })
        .eq('id', duplicate.id)
      if (error) throw new Error(error.message)
      duplicate.quantity = newQty
      added.push(item.name)
      continue
    }

    const { data: inserted, error } = await admin
      .from('inventory_items')
      .insert({
        household_id: householdId,
        l1,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        category_id: null,
        low_stock_threshold: null,
      })
      .select('id, name, quantity, unit, l1')
      .single()

    if (error) throw new Error(error.message)
    if (inserted) existingItems.push(inserted as InventoryRow)
    added.push(item.name)
  }

  return added
}

async function executeRemoveInventory(
  admin: ReturnType<typeof createClient>,
  items: ParsedItem[],
  existingItems: InventoryRow[],
  l1: InventoryL1 | null,
  removeAll: boolean,
): Promise<string[]> {
  const removed: string[] = []

  for (const item of items) {
    const candidates = l1
      ? existingItems.filter((row) => row.l1 === l1)
      : existingItems
    const match = findByName(candidates, item.name)
    if (!match) continue

    const subtract = removeAll || item.quantity === 0 ? Number(match.quantity) : item.quantity
    const newQty = Math.max(0, Number(match.quantity) - subtract)

    if (newQty <= 0) {
      const { error } = await admin.from('inventory_items').delete().eq('id', match.id)
      if (error) throw new Error(error.message)
      const idx = existingItems.findIndex((row) => row.id === match.id)
      if (idx >= 0) existingItems.splice(idx, 1)
    } else {
      const { error } = await admin
        .from('inventory_items')
        .update({ quantity: newQty })
        .eq('id', match.id)
      if (error) throw new Error(error.message)
      match.quantity = newQty
    }

    removed.push(item.name)
  }

  return removed
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  try {
    const token = extractToken(req)
    if (!token) {
      return jsonResponse({ error: 'Missing shortcut token' }, 401)
    }

    const body = await req.json() as { text?: string }
    const text = body.text?.trim()
    if (!text) {
      return jsonResponse({ error: 'Missing text' }, 400)
    }

    const commands = parseCommands(text)
    if (commands.length === 0) {
      return jsonResponse({ error: 'Could not understand that command' }, 400)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(supabaseUrl, serviceRoleKey)

    const tokenHash = await hashToken(token)
    const { data: tokenRow, error: tokenError } = await admin
      .from('shortcut_tokens')
      .select('id, user_id, household_id')
      .eq('token_hash', tokenHash)
      .maybeSingle()

    if (tokenError || !tokenRow) {
      return jsonResponse({ error: 'Invalid shortcut token' }, 401)
    }

    const [{ data: shoppingItems, error: shoppingError }, { data: inventoryItems, error: inventoryError }] =
      await Promise.all([
        admin
          .from('shopping_list_items')
          .select('id, name, quantity, unit, l1')
          .eq('household_id', tokenRow.household_id),
        admin
          .from('inventory_items')
          .select('id, name, quantity, unit, l1')
          .eq('household_id', tokenRow.household_id),
      ])

    if (shoppingError) return jsonResponse({ error: shoppingError.message }, 500)
    if (inventoryError) return jsonResponse({ error: inventoryError.message }, 500)

    const shoppingRows = (shoppingItems ?? []) as ShoppingRow[]
    const inventoryRows = (inventoryItems ?? []) as InventoryRow[]
    const messages: string[] = []
    const notFound: string[] = []

    for (const command of commands) {
      const { action, destination, items, removeAll } = command
      const label = destinationLabel(destination)

      if (action === 'add' && destination === 'shopping_list') {
        const names = await executeAddShopping(
          admin,
          tokenRow.household_id,
          tokenRow.user_id,
          items,
          shoppingRows,
          'general',
        )
        if (names.length === 0) {
          messages.push('Nothing was added to your shopping list.')
        } else {
          messages.push(`Added ${names.join(', ')} to your shopping list.`)
        }
        continue
      }

      if (action === 'add' && (destination === 'pantry' || destination === 'supply')) {
        const names = await executeAddInventory(
          admin,
          tokenRow.household_id,
          destination,
          items,
          inventoryRows,
        )
        if (names.length === 0) {
          messages.push(`Nothing was added to your ${label}.`)
        } else {
          messages.push(`Added ${names.join(', ')} to your ${label}.`)
        }
        continue
      }

      if (action === 'remove' && destination === 'shopping_list') {
        const names = await executeRemoveShopping(admin, items, shoppingRows, removeAll)
        if (names.length === 0) {
          for (const item of items) notFound.push(item.name)
          messages.push(`Couldn't find those items on your shopping list.`)
        } else {
          messages.push(`Removed ${names.join(', ')} from your shopping list.`)
        }
        continue
      }

      if (action === 'remove' && (destination === 'pantry' || destination === 'supply')) {
        const names = await executeRemoveInventory(
          admin,
          items,
          inventoryRows,
          destination,
          removeAll,
        )
        if (names.length === 0) {
          for (const item of items) notFound.push(item.name)
          messages.push(`Couldn't find those items in your ${label}.`)
        } else {
          messages.push(`Removed ${names.join(', ')} from your ${label}.`)
        }
        continue
      }

      if (action === 'remove') {
        const names = await executeRemoveInventory(admin, items, inventoryRows, null, removeAll)
        if (names.length === 0) {
          for (const item of items) notFound.push(item.name)
          messages.push(`Couldn't find those items in your pantry or supply closet.`)
        } else {
          messages.push(`Removed ${names.join(', ')} from inventory.`)
        }
      }
    }

    await admin
      .from('shortcut_tokens')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', tokenRow.id)

    const message = messages.join(' ')

    return jsonResponse({
      ok: true,
      message,
      not_found: notFound.length > 0 ? notFound : undefined,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return jsonResponse({ error: message }, 500)
  }
})
