import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

export function formatQuantity(quantity: number, unit: string): string {
  const formatted = Number.isInteger(quantity)
    ? quantity.toString()
    : quantity.toFixed(2).replace(/\.?0+$/, '')
  return `${formatted} ${unit}`
}

export function isLowStock(quantity: number, threshold: number | null): boolean {
  if (threshold === null) return quantity <= 0
  return quantity <= threshold
}

export function isOutOfStock(quantity: number): boolean {
  return quantity <= 0
}

/** Split stored recipe instructions into display steps. */
export function parseInstructionSteps(instructions: string): string[] {
  const text = instructions.trim()
  if (!text) return []

  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean)

  // Multiple lines — treat each as a step (strip leading numbers/bullets)
  if (lines.length > 1) {
    return lines.map((line) => line.replace(/^\s*(\d+[\.\):\-]\s*|[-•*]\s+)/, '').trim()).filter(Boolean)
  }

  // Single block — split on numbered patterns like "1. " or "2) "
  const numbered = text.split(/(?=\s*\d+[\.\)]\s+)/).map((s) => s.trim()).filter(Boolean)
  if (numbered.length > 1) {
    return numbered.map((s) => s.replace(/^\d+[\.\)]\s*/, '').trim()).filter(Boolean)
  }

  // Split long paragraphs on sentence boundaries as a last resort
  if (text.length > 120) {
    const sentences = text.match(/[^.!?]+[.!?]+/g)
    if (sentences && sentences.length > 1) {
      return sentences.map((s) => s.trim()).filter(Boolean)
    }
  }

  return [text]
}
