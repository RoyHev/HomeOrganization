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
