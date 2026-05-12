import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, TouchEvent } from 'react'
import { useAuth, useClerk, useUser } from '@clerk/clerk-react'
import {
  createCheckoutSession,
  createSupabaseClient,
  syncProfileWithBackend,
} from '../lib/supabase'
import type { Category, ContentItem, Profile } from '../types'
import Footer from '../components/Footer'

const SWIPE_THRESHOLD = 42

export default function DashboardPage() {
  const { userId, getToken, isLoaded } = useAuth()
  const { user } = useUser()
  const { openUserProfile, signOut } = useClerk()
  const accountMenuRef = useRef<HTMLDivElement | null>(null)

  const [supabaseToken, setSupabaseToken] = useState<string | undefined>()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [content, setContent] = useState<ContentItem[]>([])
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [selectedMediaType, setSelectedMediaType] = useState<'image' | 'video'>('image')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [autoCheckoutTriggered, setAutoCheckoutTriggered] = useState(false)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)

  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadDescription, setUploadDescription] = useState('')
  const [uploadType, setUploadType] = useState<'image' | 'video'>('image')
  const [uploadCategory, setUploadCategory] = useState('')
  const [uploadPremium, setUploadPremium] = useState(true)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [lightboxImages, setLightboxImages] = useState<ContentItem[]>([])
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [touchStartX, setTouchStartX] = useState<number | null>(null)

  const supabase = useMemo(() => createSupabaseClient(supabaseToken), [supabaseToken])

  const isAdmin = profile?.role === 'admin'
  const hasAccess = Boolean(profile?.subscription_active || isAdmin)
  const shouldHideDashboard = !isLoaded || !userId || !supabaseToken || !profile || !hasAccess

  const ensureProfile = useCallback(
    async (id: string, email: string | null) => {
      const { error } = await supabase.from('profiles').upsert(
        {
          id,
          email,
          role: 'paying_user',
          subscription_status: 'inactive',
          subscription_active: false,
        },
        { onConflict: 'id', ignoreDuplicates: true },
      )
      if (error) {
        setStatus(error.message)
      }
    },
    [supabase],
  )

  const loadProfile = useCallback(
    async (id: string) => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, role, subscription_status, subscription_active')
        .eq('id', id)
        .single()

      if (error) {
        setStatus(error.message)
        return null
      }

      setProfile(data)
      return data as Profile
    },
    [supabase],
  )

  const loadCategories = useCallback(async () => {
    const { data, error } = await supabase
      .from('categories')
      .select('id, name, slug')
      .order('name', { ascending: true })

    if (error) {
      setStatus(error.message)
      return
    }

    setCategories(data || [])
  }, [supabase])

  const loadFavorites = useCallback(
    async (id: string) => {
      const { data, error } = await supabase
        .from('favorites')
        .select('content_id')
        .eq('user_id', id)

      if (error) {
        setStatus(error.message)
        return
      }

      setFavorites(new Set((data || []).map((x) => x.content_id)))
    },
    [supabase],
  )

  const loadContent = useCallback(async () => {
    const { data, error } = await supabase
      .from('content_items')
      .select(
        'id, title, description, type, category_id, file_path, file_url, is_premium, created_at, categories(name, slug), favorites(count)',
      )
      .order('created_at', { ascending: false })

    if (error) {
      setStatus(error.message)
      return
    }

    const withUrls = await Promise.all(
      (data || []).map(async (item) => {
        const { data: signed } = await supabase.storage
          .from('premium-content')
          .createSignedUrl(item.file_path, 3600)

        return {
          ...item,
          signedUrl: signed?.signedUrl,
        }
      }),
    )

    setContent(withUrls as unknown as ContentItem[])
  }, [supabase])

  const hydrateUserData = useCallback(
    async (id: string, email: string | null) => {
      await ensureProfile(id, email)
      const nextProfile = await loadProfile(id)
      await loadCategories()

      if (nextProfile?.subscription_active || nextProfile?.role === 'admin') {
        await Promise.all([loadContent(), loadFavorites(id)])
      } else {
        setContent([])
        setFavorites(new Set())
      }
    },
    [ensureProfile, loadCategories, loadContent, loadFavorites, loadProfile],
  )

  const mediaContent = useMemo(() => {
    return content.filter(
      (item) =>
        item.type === selectedMediaType &&
        (selectedCategory === 'all' || item.category_id === selectedCategory),
    )
  }, [content, selectedCategory, selectedMediaType])

  const categoriesForSelectedMedia = useMemo(() => {
    return categories
  }, [categories])

  const startCheckout = useCallback(async () => {
    if (!userId) return

    setStatus(null)
    setBusy(true)

    try {
      const clerkToken = await getToken()

      if (!clerkToken) {
        setStatus('Could not get Clerk token for checkout.')
        setBusy(false)
        return
      }

      const checkoutUrl = await createCheckoutSession(clerkToken)
      window.location.href = checkoutUrl
    } catch {
      setStatus('Could not start Stripe checkout. Please try again.')
      setBusy(false)
    }
  }, [getToken, userId])

  useEffect(() => {
    if (selectedCategory === 'all') return

    const existsInCurrentMedia = categoriesForSelectedMedia.some(
      (category) => category.id === selectedCategory,
    )

    if (!existsInCurrentMedia) {
      setSelectedCategory('all')
    }
  }, [categoriesForSelectedMedia, selectedCategory])

  const activeLightboxImage = useMemo(() => {
    if (!lightboxImages.length) return null
    return lightboxImages[lightboxIndex] || null
  }, [lightboxImages, lightboxIndex])

  useEffect(() => {
    if (!isLoaded) return

    if (!userId) {
      setSupabaseToken(undefined)
      setProfile(null)
      setContent([])
      setFavorites(new Set())
      return
    }

    const syncAuth = async () => {
      setStatus(null)

      const clerkToken = await getToken()

      if (clerkToken) {
        try {
          await syncProfileWithBackend(clerkToken)
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Could not sync profile.'
          setStatus(message)
          return
        }
      }

      const tokenFromTemplate = await getToken({ template: 'supabase' })
      const token = tokenFromTemplate || clerkToken

      if (!token) {
        setStatus('Could not get Clerk token for Supabase.')
        return
      }

      setSupabaseToken(token)
    }

    void syncAuth()
  }, [getToken, isLoaded, userId])

  useEffect(() => {
    if (!userId || !supabaseToken) return

    const emailAddress = user?.primaryEmailAddress?.emailAddress || null
    void hydrateUserData(userId, emailAddress)
  }, [hydrateUserData, supabaseToken, user?.primaryEmailAddress, userId])

  useEffect(() => {
    if (!lightboxImages.length) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setLightboxImages([])
        setLightboxIndex(0)
      }
      if (event.key === 'ArrowLeft') {
        setLightboxIndex((prev) => (prev - 1 + lightboxImages.length) % lightboxImages.length)
      }
      if (event.key === 'ArrowRight') {
        setLightboxIndex((prev) => (prev + 1) % lightboxImages.length)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [lightboxImages])

  useEffect(() => {
    if (!accountMenuOpen) return

    const handlePointerDown = (event: MouseEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) {
        setAccountMenuOpen(false)
      }
    }

    window.addEventListener('mousedown', handlePointerDown)
    return () => window.removeEventListener('mousedown', handlePointerDown)
  }, [accountMenuOpen])

  useEffect(() => {
    if (!isLoaded || !userId) {
      setAutoCheckoutTriggered(false)
      return
    }

    if (!profile) return
    if (hasAccess) {
      setAutoCheckoutTriggered(false)
      return
    }
    if (autoCheckoutTriggered || busy) return

    setAutoCheckoutTriggered(true)
    setStatus('Subscription required. Redirecting to Stripe checkout...')
    void startCheckout()
  }, [autoCheckoutTriggered, busy, hasAccess, isLoaded, profile, startCheckout, userId])

  const openLightbox = (images: ContentItem[], index: number) => {
    setLightboxImages(images)
    setLightboxIndex(index)
  }

  const closeLightbox = () => {
    setLightboxImages([])
    setLightboxIndex(0)
    setTouchStartX(null)
  }

  const showPrevLightboxImage = () => {
    setLightboxIndex((prev) => (prev - 1 + lightboxImages.length) % lightboxImages.length)
  }

  const showNextLightboxImage = () => {
    setLightboxIndex((prev) => (prev + 1) % lightboxImages.length)
  }

  const handleLightboxTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    setTouchStartX(event.changedTouches[0]?.clientX ?? null)
  }

  const handleLightboxTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    if (touchStartX === null) return
    const touchEndX = event.changedTouches[0]?.clientX ?? touchStartX
    const delta = touchEndX - touchStartX

    if (Math.abs(delta) > SWIPE_THRESHOLD) {
      if (delta < 0) showNextLightboxImage()
      if (delta > 0) showPrevLightboxImage()
    }

    setTouchStartX(null)
  }

  const toggleFavorite = async (contentId: string) => {
    if (!userId) return

    if (favorites.has(contentId)) {
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('user_id', userId)
        .eq('content_id', contentId)

      if (error) {
        setStatus(error.message)
        return
      }
    } else {
      const { error } = await supabase
        .from('favorites')
        .insert({ user_id: userId, content_id: contentId })

      if (error) {
        setStatus(error.message)
        return
      }
    }

    await loadFavorites(userId)
    await loadContent()
  }

  const handleUpload = async (event: FormEvent) => {
    event.preventDefault()
    if (!isAdmin || !userId || !uploadFile || !uploadCategory) return

    setBusy(true)
    setStatus(null)

    const filePath = `${userId}/${Date.now()}-${uploadFile.name}`
    const { error: uploadError } = await supabase.storage
      .from('premium-content')
      .upload(filePath, uploadFile)

    if (uploadError) {
      setStatus(uploadError.message)
      setBusy(false)
      return
    }

    const { error: insertError } = await supabase.from('content_items').insert({
      title: uploadTitle,
      description: uploadDescription || null,
      type: uploadType,
      category_id: uploadCategory,
      file_path: filePath,
      file_url: filePath,
      is_premium: uploadPremium,
      created_by: userId,
    })

    if (insertError) {
      setStatus(insertError.message)
      setBusy(false)
      return
    }

    setUploadTitle('')
    setUploadDescription('')
    setUploadFile(null)
    setUploadCategory('')
    await loadContent()
    setStatus('Content uploaded.')
    setBusy(false)
  }

  const handleManageAccount = () => {
    setAccountMenuOpen(false)
    void openUserProfile()
  }

  const handleSignOut = () => {
    setAccountMenuOpen(false)
    void signOut({ redirectUrl: '/' })
  }

  if (shouldHideDashboard) {
    const message =
      status ||
      (profile && !hasAccess
        ? 'Active membership required. Redirecting to Stripe checkout...'
        : 'Checking your membership and preparing access...')

    return (
      <div className="min-h-screen bg-linear-to-b from-gray-800 to-slate-900 flex items-center justify-center px-4">
        <div className="max-w-lg w-full bg-gray-800 border border-gray-700 rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full border-4 border-brand-500/30 border-t-brand-500 animate-spin" />
          <h1 className="text-3xl font-serif font-bold text-white mb-4">Checking membership</h1>
          <p className="text-gray-300 leading-relaxed">{message}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-gray-800 to-slate-900 flex flex-col">
      <header className="border-b border-gray-700 bg-linear-to-r from-gray-900 via-gray-800 to-gray-900 shadow-sm backdrop-blur-sm bg-opacity-95 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold">
                EthioGlow Premium Studio
              </p>
              <h1 className="text-2xl sm:text-3xl font-serif font-bold text-white mt-1">
                Premium Content Platform
              </h1>
              <p className="text-sm text-gray-300 mt-1">
                Role: <span className="font-semibold text-brand-400">{profile?.role || 'unknown'}</span>
                {' | '}Subscription:{' '}
                <span className="font-semibold text-green-400">
                  {profile?.subscription_status || 'unknown'}
                </span>
              </p>
            </div>
            <div className="relative" ref={accountMenuRef}>
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={accountMenuOpen}
                aria-label="Open account menu"
                onClick={() => setAccountMenuOpen((open) => !open)}
                className="w-11 h-11 rounded-full overflow-hidden ring-2 ring-white/10 hover:ring-brand-500/60 transition-all cursor-pointer bg-gray-700 flex items-center justify-center"
              >
                {user?.imageUrl ? (
                  <img src={user.imageUrl} alt={user.fullName || user.primaryEmailAddress?.emailAddress || 'User'} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-linear-to-br from-brand-500 to-brand-700 text-white flex items-center justify-center font-semibold">
                    {(user?.firstName || user?.primaryEmailAddress?.emailAddress || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
              </button>

              {accountMenuOpen && (
                <div className="absolute right-0 mt-3 w-72 rounded-2xl border border-gray-700 bg-gray-800 shadow-2xl overflow-hidden z-50">
                  <div className="px-4 py-4 border-b border-gray-700">
                    <p className="text-sm font-semibold text-white truncate">
                      {user?.fullName || user?.primaryEmailAddress?.emailAddress || 'Account'}
                    </p>
                    <p className="text-sm text-gray-400 truncate">
                      {user?.primaryEmailAddress?.emailAddress || ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleManageAccount}
                    className="w-full px-4 py-3 text-left text-gray-200 hover:bg-gray-700 transition-colors cursor-pointer"
                  >
                    Manage account
                  </button>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="w-full px-4 py-3 text-left text-gray-200 hover:bg-gray-700 transition-colors cursor-pointer border-t border-gray-700"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-grow">
        <div className="bg-gradient-to-r from-blue-900/30 to-blue-800/30 border-l-4 border-blue-500 p-4 mb-6 rounded-r-lg shadow-md">
          <p className="text-sm text-blue-100 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            All images on this website are AI-generated.
          </p>
        </div>

        <>
            <div className="bg-gray-800 rounded-xl shadow-sm border border-gray-700 p-4 mb-6">
              <div className="flex gap-3 flex-wrap">
                <button
                  type="button"
                  className={`px-6 py-2.5 rounded-lg font-medium transition-all cursor-pointer ${selectedMediaType === 'image' ? 'bg-brand-500 text-white shadow-md' : 'bg-gray-900 text-gray-200 border border-gray-600 hover:bg-gray-700'}`}
                  onClick={() => setSelectedMediaType('image')}
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    Images
                  </span>
                </button>
                <button
                  type="button"
                  className={`px-6 py-2.5 rounded-lg font-medium transition-all cursor-pointer ${selectedMediaType === 'video' ? 'bg-brand-500 text-white shadow-md' : 'bg-gray-900 text-gray-200 border border-gray-600 hover:bg-gray-700'}`}
                  onClick={() => setSelectedMediaType('video')}
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                    Videos
                  </span>
                </button>
              </div>
            </div>

            <div className="bg-gray-800 rounded-xl shadow-sm border border-gray-700 p-4 mb-6">
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all cursor-pointer ${selectedCategory === 'all' ? 'bg-brand-500 text-white shadow-md' : 'bg-gray-900 text-gray-200 border border-gray-600 hover:bg-gray-700'}`}
                  onClick={() => setSelectedCategory('all')}
                >
                  All categories
                </button>
                {categoriesForSelectedMedia.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all cursor-pointer ${selectedCategory === category.id ? 'bg-brand-500 text-white shadow-md' : 'bg-gray-900 text-gray-200 border border-gray-600 hover:bg-gray-700'}`}
                    onClick={() => setSelectedCategory(category.id)}
                  >
                    {category.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {mediaContent.map((item, index) => (
                <article
                  key={item.id}
                  className="bg-gray-800 rounded-xl shadow-md hover:shadow-xl transition-shadow duration-300 overflow-hidden border border-gray-700"
                >
                  <div className="relative">
                    {selectedMediaType === 'video' ? (
                      <video
                        src={item.signedUrl}
                        controls
                        preload="metadata"
                        className="w-full h-64 object-cover"
                      />
                    ) : (
                      <button
                        type="button"
                        className="w-full h-64 overflow-hidden group cursor-pointer"
                        onClick={() => openLightbox(mediaContent, index)}
                      >
                        <img
                          src={item.signedUrl}
                          alt={item.title}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        />
                      </button>
                    )}
                    <span className="absolute top-2 right-2 px-3 py-1 bg-black/70 text-white text-xs font-semibold rounded-full backdrop-blur-sm">
                      {item.categories?.[0]?.name || 'Uncategorized'}
                    </span>
                  </div>

                  <div className="p-4">
                    <h3 className="text-lg font-serif font-bold text-white mb-2">{item.title}</h3>
                    <p className="text-sm text-gray-300 mb-4 line-clamp-2">{item.description}</p>

                    <div className="flex items-center justify-between pt-4 border-t border-gray-700">
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span className="px-2 py-1 bg-gray-700 rounded-full font-medium">
                          {item.type.toUpperCase()}
                        </span>
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                          {item.favorites?.[0]?.count || 0}
                        </span>
                      </div>
                      <button
                        onClick={() => toggleFavorite(item.id)}
                        className="text-sm font-medium text-brand-500 hover:text-brand-600 transition-colors cursor-pointer"
                      >
                        {favorites.has(item.id) ? '❤️ Saved' : '🤍 Save'}
                      </button>
                    </div>
                  </div>
                </article>
              ))}

              {mediaContent.length === 0 && (
                <div className="col-span-full text-center py-16">
                  <svg
                    className="w-20 h-20 mx-auto text-gray-600 mb-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                    />
                  </svg>
                  <p className="text-gray-400 text-lg">
                    No {selectedMediaType === 'image' ? 'images' : 'videos'} found in this category.
                  </p>
                </div>
              )}
            </div>
        </>

        {isAdmin && (
          <div className="bg-gray-800 border-2 border-gray-700 rounded-2xl p-8 shadow-lg mt-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-serif font-bold text-white">Admin Upload</h2>
                <p className="text-sm text-gray-300">Add new content to the platform</p>
              </div>
            </div>
            <form onSubmit={handleUpload} className="space-y-4">
              <input
                type="text"
                placeholder="Content title"
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                required
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent placeholder-gray-400"
              />
              <textarea
                placeholder="Description (optional)"
                value={uploadDescription}
                onChange={(e) => setUploadDescription(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none placeholder-gray-400"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <select
                  value={uploadType}
                  onChange={(e) => setUploadType(e.target.value as 'image' | 'video')}
                  className="px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="image">📸 Image</option>
                  <option value="video">🎥 Video</option>
                </select>

                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                  required
                  className="px-4 py-3 bg-gray-700 border border-gray-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">Select category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={uploadPremium}
                  onChange={(e) => setUploadPremium(e.target.checked)}
                  className="w-5 h-5 text-purple-600 border-purple-300 rounded focus:ring-purple-500"
                />
                <span className="text-sm font-medium text-gray-300">Mark as premium content</span>
              </label>

              <div className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center hover:border-gray-500 transition-colors">
                <input
                  type="file"
                  accept="image/*,video/*"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  required
                  className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-700 cursor-pointer"
                />
                {uploadFile && <p className="mt-2 text-sm text-gray-300">Selected: {uploadFile.name}</p>}
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full py-3 px-6 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-lg"
              >
                {busy ? 'Uploading...' : '⬆️ Upload Content'}
              </button>
            </form>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8 mb-8">
          <div className="bg-gradient-to-br from-blue-900/40 to-blue-800/30 rounded-xl p-6 shadow-lg border-2 border-blue-500/30 hover:border-blue-400/50 transition-all">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center mb-4 shadow-md">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-serif font-bold text-white mb-2">Terms of Use</h3>
            <p className="text-sm text-gray-300">
              All content is for personal viewing only. Redistribution, sharing, or commercial use of images and videos is strictly prohibited.
            </p>
          </div>
          <div className="bg-gradient-to-br from-green-900/40 to-green-800/30 rounded-xl p-6 shadow-lg border-2 border-green-500/30 hover:border-green-400/50 transition-all">
            <div className="w-12 h-12 bg-gradient-to-br from-green-600 to-green-700 rounded-lg flex items-center justify-center mb-4 shadow-md">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-serif font-bold text-white mb-2">Age Requirement</h3>
            <p className="text-sm text-gray-300">
              You must be 18 years or older to access this platform. All content features adult models aged 23+.
            </p>
          </div>
          <div className="bg-gradient-to-br from-purple-900/40 to-purple-800/30 rounded-xl p-6 shadow-lg border-2 border-purple-500/30 hover:border-purple-400/50 transition-all">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-purple-700 rounded-lg flex items-center justify-center mb-4 shadow-md">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-serif font-bold text-white mb-2">Privacy & Security</h3>
            <p className="text-sm text-gray-300">
              Your subscription and viewing activity are kept private. We protect your personal information and secure all transactions.
            </p>
          </div>
        </div>

        {status && (
          <div
            className={`mt-6 p-4 rounded-lg text-sm ${
              status.toLowerCase().includes('error') ||
              status.toLowerCase().includes('failed') ||
              status.toLowerCase().includes('could not')
                ? 'bg-red-50 text-red-800 border border-red-200'
                : status.toLowerCase().includes('success') || status.toLowerCase().includes('uploaded')
                  ? 'bg-green-50 text-green-800 border border-green-200'
                  : 'bg-blue-50 text-blue-800 border border-blue-200'
            }`}
          >
            {status}
          </div>
        )}

        {activeLightboxImage && (
          <section
            className="lightbox"
            role="dialog"
            aria-modal="true"
            aria-label="Image viewer"
            onClick={closeLightbox}
          >
            <div
              className="lightboxInner"
              onClick={(event) => event.stopPropagation()}
              onTouchStart={handleLightboxTouchStart}
              onTouchEnd={handleLightboxTouchEnd}
            >
              <button
                type="button"
                className="lightboxClose cursor-pointer"
                onClick={closeLightbox}
                aria-label="Close"
              >
                ×
              </button>
              <button
                type="button"
                className="lightboxNav left cursor-pointer"
                onClick={showPrevLightboxImage}
                aria-label="Previous image"
              >
                ←
              </button>
              <img
                src={activeLightboxImage.signedUrl}
                alt={activeLightboxImage.title}
                className="lightboxImage"
              />
              <button
                type="button"
                className="lightboxNav right cursor-pointer"
                onClick={showNextLightboxImage}
                aria-label="Next image"
              >
                →
              </button>
              <div className="lightboxCaption">
                <strong>{activeLightboxImage.title}</strong>
                <span>
                  {lightboxIndex + 1} / {lightboxImages.length}
                </span>
              </div>
            </div>
          </section>
        )}
      </div>

      <Footer />
    </div>
  )
}
