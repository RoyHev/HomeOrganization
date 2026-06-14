import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/hooks/useAuth'
import { HouseholdProvider } from '@/hooks/useHousehold'
import { AppShell } from '@/components/layout/AppShell'
import { LoginPage } from '@/features/auth/LoginPage'
import { SetPasswordPage } from '@/features/auth/SetPasswordPage'
import { HouseholdSetupPage } from '@/features/auth/HouseholdSetupPage'
import { PantryPage } from '@/features/pantry/PantryPage'
import { ShoppingPage } from '@/features/shopping/ShoppingPage'
import { RecipesPage } from '@/features/recipes/RecipesPage'
import { SupplyPage } from '@/features/supply/SupplyPage'
import { AdminPage } from '@/features/admin/AdminPage'
import { PlatformAdminPage } from '@/features/platform-admin/PlatformAdminPage'
import { PlatformAdminProvider } from '@/hooks/usePlatformAdmin'
import { RootRedirect } from '@/components/RootRedirect'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <PlatformAdminProvider>
          <HouseholdProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/set-password" element={<SetPasswordPage />} />
              <Route path="/household" element={<HouseholdSetupPage />} />
              <Route path="/platform-admin" element={<PlatformAdminPage />} />
              <Route element={<AppShell />}>
              <Route index element={<Navigate to="/pantry" replace />} />
              <Route path="/pantry" element={<PantryPage />} />
              <Route path="/shopping" element={<ShoppingPage />} />
              <Route path="/recipes" element={<RecipesPage />} />
              <Route path="/supply" element={<SupplyPage />} />
              <Route path="/admin" element={<AdminPage />} />
            </Route>
            <Route path="*" element={<RootRedirect />} />
          </Routes>
        </HouseholdProvider>
        </PlatformAdminProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
