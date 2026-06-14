export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type L1Category = 'pantry' | 'supply'
export type HouseholdRole = 'owner' | 'member'

export type Database = {
  public: {
    Tables: {
      households: {
        Row: {
          id: string
          name: string
          invite_code: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          invite_code: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          invite_code?: string
          created_at?: string
        }
        Relationships: []
      }
      household_members: {
        Row: {
          id: string
          household_id: string
          user_id: string
          role: HouseholdRole
          display_name: string | null
          created_at: string
        }
        Insert: {
          id?: string
          household_id: string
          user_id: string
          role?: HouseholdRole
          display_name?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          household_id?: string
          user_id?: string
          role?: HouseholdRole
          display_name?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'household_members_household_id_fkey'
            columns: ['household_id']
            isOneToOne: false
            referencedRelation: 'households'
            referencedColumns: ['id']
          },
        ]
      }
      categories: {
        Row: {
          id: string
          household_id: string
          l1: L1Category
          name: string
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          household_id: string
          l1: L1Category
          name: string
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          household_id?: string
          l1?: L1Category
          name?: string
          sort_order?: number
          created_at?: string
        }
        Relationships: []
      }
      inventory_items: {
        Row: {
          id: string
          household_id: string
          l1: L1Category
          category_id: string | null
          name: string
          quantity: number
          unit: string
          low_stock_threshold: number | null
          notes: string | null
          snoozed_until: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          household_id: string
          l1: L1Category
          category_id?: string | null
          name: string
          quantity?: number
          unit?: string
          low_stock_threshold?: number | null
          notes?: string | null
          snoozed_until?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          household_id?: string
          l1?: L1Category
          category_id?: string | null
          name?: string
          quantity?: number
          unit?: string
          low_stock_threshold?: number | null
          notes?: string | null
          snoozed_until?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'inventory_items_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id']
          },
        ]
      }
      shopping_list_items: {
        Row: {
          id: string
          household_id: string
          l1: L1Category
          name: string
          quantity: number
          unit: string
          inventory_item_id: string | null
          category_id: string | null
          added_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          household_id: string
          l1: L1Category
          name: string
          quantity?: number
          unit?: string
          inventory_item_id?: string | null
          category_id?: string | null
          added_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          household_id?: string
          l1?: L1Category
          name?: string
          quantity?: number
          unit?: string
          inventory_item_id?: string | null
          category_id?: string | null
          added_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'shopping_list_items_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id']
          },
        ]
      }
      recipes: {
        Row: {
          id: string
          household_id: string
          title: string
          servings: number
          instructions: string
          prep_minutes: number | null
          cook_minutes: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          household_id: string
          title: string
          servings?: number
          instructions?: string
          prep_minutes?: number | null
          cook_minutes?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          household_id?: string
          title?: string
          servings?: number
          instructions?: string
          prep_minutes?: number | null
          cook_minutes?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      recipe_ingredients: {
        Row: {
          id: string
          recipe_id: string
          name: string
          quantity: number
          unit: string
          inventory_item_id: string | null
          sort_order: number
        }
        Insert: {
          id?: string
          recipe_id: string
          name: string
          quantity?: number
          unit?: string
          inventory_item_id?: string | null
          sort_order?: number
        }
        Update: {
          id?: string
          recipe_id?: string
          name?: string
          quantity?: number
          unit?: string
          inventory_item_id?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: 'recipe_ingredients_recipe_id_fkey'
            columns: ['recipe_id']
            isOneToOne: false
            referencedRelation: 'recipes'
            referencedColumns: ['id']
          },
        ]
      }
      recipe_macros: {
        Row: {
          recipe_id: string
          calories: number | null
          protein_g: number | null
          carbs_g: number | null
          fat_g: number | null
        }
        Insert: {
          recipe_id: string
          calories?: number | null
          protein_g?: number | null
          carbs_g?: number | null
          fat_g?: number | null
        }
        Update: {
          recipe_id?: string
          calories?: number | null
          protein_g?: number | null
          carbs_g?: number | null
          fat_g?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'recipe_macros_recipe_id_fkey'
            columns: ['recipe_id']
            isOneToOne: true
            referencedRelation: 'recipes'
            referencedColumns: ['id']
          },
        ]
      }
      activity_log: {
        Row: {
          id: string
          household_id: string
          user_id: string | null
          message: string
          created_at: string
        }
        Insert: {
          id?: string
          household_id: string
          user_id?: string | null
          message: string
          created_at?: string
        }
        Update: {
          id?: string
          household_id?: string
          user_id?: string | null
          message?: string
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      get_user_household_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      seed_household_categories: {
        Args: { p_household_id: string }
        Returns: undefined
      }
      lookup_household_by_invite: {
        Args: { p_invite_code: string }
        Returns: string
      }
      get_household_members_with_email: {
        Args: Record<PropertyKey, never>
        Returns: Array<{
          id: string
          household_id: string
          user_id: string
          role: HouseholdRole
          display_name: string | null
          email: string
          created_at: string
        }>
      }
      update_member_role: {
        Args: { p_member_id: string; p_new_role: string }
        Returns: undefined
      }
      remove_household_member: {
        Args: { p_member_id: string }
        Returns: undefined
      }
      regenerate_invite_code: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      is_platform_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      platform_admin_list_households: {
        Args: Record<PropertyKey, never>
        Returns: Array<{
          id: string
          name: string
          invite_code: string
          member_count: number
          created_at: string
        }>
      }
      platform_admin_list_users: {
        Args: Record<PropertyKey, never>
        Returns: Array<{
          user_id: string
          email: string
          display_name: string | null
          household_id: string | null
          household_name: string | null
          role: string | null
          email_confirmed_at: string | null
          created_at: string
        }>
      }
      platform_admin_create_household: {
        Args: { p_name: string; p_owner_email: string }
        Returns: Array<{ household_id: string; invite_code: string }>
      }
      platform_admin_add_user_to_household: {
        Args: {
          p_household_id: string
          p_email: string
          p_role?: string
          p_display_name?: string | null
        }
        Returns: string
      }
      create_household: {
        Args: { p_name: string; p_invite_code: string }
        Returns: string
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type Household = Database['public']['Tables']['households']['Row']
export type HouseholdMember = Database['public']['Tables']['household_members']['Row']
export type Category = Database['public']['Tables']['categories']['Row']
export type InventoryItem = Database['public']['Tables']['inventory_items']['Row']
export type ShoppingListItem = Database['public']['Tables']['shopping_list_items']['Row']
export type Recipe = Database['public']['Tables']['recipes']['Row']
export type RecipeIngredient = Database['public']['Tables']['recipe_ingredients']['Row']
export type RecipeMacros = Database['public']['Tables']['recipe_macros']['Row']
export type ActivityLogEntry = Database['public']['Tables']['activity_log']['Row']

export type InventoryItemWithCategory = InventoryItem & {
  categories: Pick<Category, 'id' | 'name'> | null
}

export type RecipeWithDetails = Recipe & {
  recipe_ingredients: RecipeIngredient[]
  recipe_macros: RecipeMacros | null
}

export type HouseholdMemberWithHousehold = HouseholdMember & {
  households: Household
}
