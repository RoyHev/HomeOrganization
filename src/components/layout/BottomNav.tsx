import { NavLink } from 'react-router-dom'
import { Package, ShoppingCart, ChefHat, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

const tabs = [
  { to: '/pantry', label: 'Pantry', icon: Package },
  { to: '/shopping', label: 'Shopping', icon: ShoppingCart },
  { to: '/recipes', label: 'Recipes', icon: ChefHat },
  { to: '/supply', label: 'Supply', icon: Sparkles },
] as const

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 safe-bottom">
      <div className="mx-auto flex max-w-lg items-stretch justify-around">
        {tabs.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex flex-1 flex-col items-center justify-center gap-1 py-2 min-h-[56px] text-xs font-medium transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
              )
            }
          >
            <Icon className="h-5 w-5" />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
