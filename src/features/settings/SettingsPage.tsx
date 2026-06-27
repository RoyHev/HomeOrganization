import { useAuth } from '@/hooks/useAuth'
import { useHousehold } from '@/hooks/useHousehold'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function SettingsPage() {
  const { user } = useAuth()
  const { household } = useHousehold()

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Settings</h2>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Email</p>
            <p className="font-medium">{user?.email}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Household</p>
            <p className="font-medium">{household?.name}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
