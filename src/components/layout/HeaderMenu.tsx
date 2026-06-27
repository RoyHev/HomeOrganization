import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu, Settings, Mic, Shield, LogOut } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useHousehold } from '@/hooks/useHousehold'
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SiriShortcutDialog } from '@/components/SiriShortcutDialog'

export function HeaderMenu() {
  const navigate = useNavigate()
  const { signOut } = useAuth()
  const { membership } = useHousehold()
  const { isPlatformAdmin } = usePlatformAdmin()
  const [siriOpen, setSiriOpen] = useState(false)

  const isOwner = membership?.role === 'owner'

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="shrink-0" aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          <DropdownMenuItem onSelect={() => navigate('/settings')}>
            <Settings className="h-4 w-4" />
            Settings
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setSiriOpen(true)}>
            <Mic className="h-4 w-4" />
            Siri
          </DropdownMenuItem>
          {isOwner && (
            <DropdownMenuItem onSelect={() => navigate('/admin')}>
              <Shield className="h-4 w-4" />
              Admin
            </DropdownMenuItem>
          )}
          {isPlatformAdmin && (
            <DropdownMenuItem onSelect={() => navigate('/platform-admin')}>
              <Shield className="h-4 w-4" />
              Platform admin
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={() => void signOut()}
          >
            <LogOut className="h-4 w-4" />
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <SiriShortcutDialog open={siriOpen} onOpenChange={setSiriOpen} />
    </>
  )
}
