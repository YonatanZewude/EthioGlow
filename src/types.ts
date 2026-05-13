export type Role = 'admin' | 'paying_user'

export type Profile = {
  id: string
  email: string | null
  role: Role
  subscription_status: string
  subscription_active: boolean
}

export type Category = {
  id: string
  name: string
  slug: string
}

export type ContentType = 'image' | 'video'

export type ContentItem = {
  id: string
  title: string
  description: string | null
  type: ContentType
  file_path: string
  file_url: string | null
  is_premium: boolean
  show_on_landing: boolean
  landing_order: number | null
  created_at: string
  category_id: string
  categories: {
    name: string
    slug: string
  } | null
  favorites: Array<{ count: number }>
  signedUrl?: string
}

export type VisitorEvent = {
  id: string
  page_path: string
  source: string | null
  referrer_url: string | null
  city: string | null
  country: string | null
  device_type: string | null
  device_os: string | null
  browser: string | null
  visited_at: string
}
