import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent, TouchEvent } from 'react'
import {
  SignIn,
  SignedIn,
  SignedOut,
  UserButton,
  useAuth,
  useUser,
} from '@clerk/clerk-react'
import { createSupabaseClient } from './lib/supabase'
import type { Category, ContentItem, Profile } from './types'

const SWIPE_THRESHOLD = 42

const FILTERS = [
  { id: 'all', label: 'Alla' },
  { id: 'new', label: 'Nytt' },
  { id: 'popular', label: 'Populart' },
  { id: 'premium', label: 'Premium' },
  { id: 'video', label: 'Video' },
  { id: 'image', label: 'Bild' },
  { id: 'favorites', label: 'Favoriter' },
]

function App() {
  const { userId, getToken, isLoaded } = useAuth()
  const { user } = useUser()

  const [supabaseToken, setSupabaseToken] = useState<string | undefined>()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [content, setContent] = useState<ContentItem[]>([])
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [filterId, setFilterId] = useState('all')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

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

  const recentUploads = useMemo(() => {
    return [...content]
      .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
      .slice(0, 5)
  }, [content])

  const ensureProfile = useCallback(
    async (id: string, email: string | null) => {
      const { error } = await supabase.from('profiles').upsert(
        {
          id,
          email,
        },
        { onConflict: 'id' },
      )

      if (error) {
        setStatus(error.message)
      }
    },
    [supabase],
  )

  const loadProfile = useCallback(async (id: string) => {
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
  }, [supabase])

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

  const loadFavorites = useCallback(async (id: string) => {
    const { data, error } = await supabase
      .from('favorites')
      .select('content_id')
      .eq('user_id', id)

    if (error) {
      setStatus(error.message)
      return
    }

    setFavorites(new Set((data || []).map((x) => x.content_id)))
  }, [supabase])

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

  const filteredContent = useMemo(() => {
    const byCategory = content.filter(
      (item) => selectedCategory === 'all' || item.category_id === selectedCategory,
    )

    if (filterId === 'new') {
      return byCategory
        .slice()
        .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
        .slice(0, 12)
    }

    if (filterId === 'popular') {
      return byCategory
        .filter((item) => (item.favorites?.[0]?.count || 0) > 0)
        .sort((a, b) => (b.favorites?.[0]?.count || 0) - (a.favorites?.[0]?.count || 0))
    }

    return byCategory.filter((item) => {
      if (filterId === 'all') return true
      if (filterId === 'premium') return item.is_premium
      if (filterId === 'video') return item.type === 'video'
      if (filterId === 'image') return item.type === 'image'
      if (filterId === 'favorites') return favorites.has(item.id)
      return true
    })
  }, [content, favorites, filterId, selectedCategory])

  const imageGalleryByCategory = useMemo(() => {
    return categories.map((category) => ({
      category,
      images: filteredContent.filter(
        (item) => item.type === 'image' && item.category_id === category.id,
      ),
    }))
  }, [categories, filteredContent])

  const filteredVideos = useMemo(() => {
    return filteredContent.filter((item) => item.type === 'video')
  }, [filteredContent])

  const activeLightboxImage = useMemo(() => {
    if (!lightboxImages.length) return null
    return lightboxImages[lightboxIndex] || null
  }, [lightboxImages, lightboxIndex])

  useEffect(() => {
    if (!isLoaded) return

    if (!userId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSupabaseToken(undefined)
      setProfile(null)
      setContent([])
      setFavorites(new Set())
      return
    }

    const syncAuth = async () => {
      setStatus(null)

      const tokenFromTemplate = await getToken({ template: 'supabase' })
      const token = tokenFromTemplate || (await getToken())

      if (!token) {
        setStatus('Kunde inte hamta Clerk token for Supabase.')
        return
      }

      setSupabaseToken(token)
    }

    void syncAuth()
  }, [getToken, isLoaded, userId])

  useEffect(() => {
    if (!userId || !supabaseToken) return

    const emailAddress = user?.primaryEmailAddress?.emailAddress || null
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  const startCheckout = async () => {
    setStatus(null)
    setBusy(true)

    const clerkToken = await getToken()

    const backendUrl = import.meta.env.VITE_STRIPE_BACKEND_URL

    const response = await fetch(
      `${backendUrl}/api/stripe/create-checkout-session`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clerkToken || ''}`,
        },
      },
    )

    const data = await response.json()

    if (!response.ok) {
      setStatus(data.error || 'Checkout failed')
      setBusy(false)
      return
    }

    window.location.href = data.url
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
    setStatus('Innehall uppladdat.')
    setBusy(false)
  }

  return (
    <main className="shell">
      <SignedOut>
        <section className="authCard">
          <p className="eyebrow">EthioGlow Premium Studio</p>
          <h1>Logga in med Clerk</h1>
          <p>
            Du kan logga in med email eller Google-konto. Aktivera Google i
            Clerk Dashboard under Social Connections.
          </p>
          <div className="clerkWrap">
            <SignIn
              appearance={{
                elements: {
                  card: 'clerkCard',
                },
              }}
              routing="virtual"
            />
          </div>
          {status && <p className="status">{status}</p>}
        </section>
      </SignedOut>

      <SignedIn>
      <header className="topBar">
        <div>
          <p className="eyebrow">EthioGlow Premium Studio</p>
          <h1>Premium Content Platform</h1>
          <p>
            Roll: <strong>{profile?.role || 'okand'}</strong> | Subscription:{' '}
            <strong>{profile?.subscription_status || 'okand'}</strong>
          </p>
        </div>
        <UserButton afterSignOutUrl="/" />
      </header>

      {!hasAccess && (
        <section className="paywall">
          <h2>Aktivera medlemskap</h2>
          <p>
            Du maste ha en aktiv Stripe subscription for att se premium bilder
            och videos.
          </p>
          <button onClick={startCheckout} disabled={busy}>
            Betala subscription
          </button>
        </section>
      )}

      {hasAccess && (
        <>
          <section className="filters">
            {FILTERS.map((filter) => (
              <button
                key={filter.id}
                className={filterId === filter.id ? 'active' : ''}
                onClick={() => setFilterId(filter.id)}
              >
                {filter.label}
              </button>
            ))}

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="all">Alla kategorier</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </section>

          <section className="recent">
            <h2>Senast uppladdat</h2>
            <div className="recentList">
              {recentUploads.map((item) => (
                <article key={item.id} className="recentItem">
                  <strong>{item.title}</strong>
                  <span>{new Date(item.created_at).toLocaleDateString()}</span>
                </article>
              ))}
            </div>
          </section>

          <section className="contentGrid">
            {filteredVideos.map((item) => (
              <article key={item.id} className="card">
                <header>
                  <h3>{item.title}</h3>
                  <span>{item.categories?.[0]?.name || 'Ingen kategori'}</span>
                </header>

                <video src={item.signedUrl} controls preload="metadata" />

                <p>{item.description}</p>
                <div className="metaRow">
                  <small>
                    {item.type.toUpperCase()} | Favoriter:{' '}
                    {item.favorites?.[0]?.count || 0}
                  </small>
                  <button onClick={() => toggleFavorite(item.id)}>
                    {favorites.has(item.id) ? 'Ta bort favorit' : 'Spara favorit'}
                  </button>
                </div>
              </article>
            ))}

            {filteredVideos.length === 0 && (
              <p className="emptyState">Inga videos matchar valt filter.</p>
            )}
          </section>

          <section className="galleryBoard">
            <h2>Bildgalleri per kategori</h2>
            {imageGalleryByCategory.map(({ category, images }) => (
              <article key={category.id} className="galleryCategoryCard">
                <div className="galleryHeader">
                  <h3>{category.name}</h3>
                  <small>{images.length} bilder</small>
                </div>

                {images.length > 0 ? (
                  <div className="galleryGrid">
                    {images.map((image, index) => (
                      <div key={image.id} className="galleryItem">
                        <button
                          type="button"
                          className="galleryThumb"
                          onClick={() => openLightbox(images, index)}
                        >
                          <img src={image.signedUrl} alt={image.title} loading="lazy" />
                        </button>
                        <div className="galleryItemMeta">
                          <strong>{image.title}</strong>
                          <button
                            type="button"
                            onClick={() => toggleFavorite(image.id)}
                          >
                            {favorites.has(image.id) ? 'Ta bort favorit' : 'Spara favorit'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="emptyState">Inga bilder i denna kategori just nu.</p>
                )}
              </article>
            ))}
          </section>
        </>
      )}

      {isAdmin && (
        <section className="adminPanel">
          <h2>Admin upload</h2>
          <form onSubmit={handleUpload} className="uploadForm">
            <input
              type="text"
              placeholder="Titel"
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              required
            />
            <textarea
              placeholder="Beskrivning"
              value={uploadDescription}
              onChange={(e) => setUploadDescription(e.target.value)}
            />

            <div className="gridTwo">
              <select
                value={uploadType}
                onChange={(e) => setUploadType(e.target.value as 'image' | 'video')}
              >
                <option value="image">Bild</option>
                <option value="video">Video</option>
              </select>

              <select
                value={uploadCategory}
                onChange={(e) => setUploadCategory(e.target.value)}
                required
              >
                <option value="">Valj kategori</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <label className="checkboxRow">
              <input
                type="checkbox"
                checked={uploadPremium}
                onChange={(e) => setUploadPremium(e.target.checked)}
              />
              Markera som premium
            </label>

            <input
              type="file"
              accept="image/*,video/*"
              onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              required
            />
            <button type="submit" disabled={busy}>
              Ladda upp
            </button>
          </form>
        </section>
      )}

      <section className="policyGrid">
        <article>
          <h3>Copyright-regler</h3>
          <p>
            Endast material du ager eller har licens for far laddas upp. Inget
            piratkopierat, inget otillat ompublicerat innehall.
          </p>
        </article>
        <article>
          <h3>Alderspolicy</h3>
          <p>
            Plattformen ar 18+. Material med minderariga ar strikt forbjudet och
            leder till permanent avstangning.
          </p>
        </article>
        <article>
          <h3>Integritet</h3>
          <p>
            Publicera aldrig personuppgifter utan samtycke. Kanslig data, privata
            adresser och identifierbar info ar forbjudet.
          </p>
        </article>
        <article>
          <h3>Forbjudet innehall</h3>
          <p>
            Inget hat, trakasserier, explicit olagligt material, valdsglorifiering
            eller innehall som bryter svensk lag.
          </p>
        </article>
      </section>

      {status && <p className="status">{status}</p>}

      {activeLightboxImage && (
        <section
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Bildvisare"
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
              className="lightboxClose"
              onClick={closeLightbox}
              aria-label="Stang"
            >
              x
            </button>
            <button
              type="button"
              className="lightboxNav left"
              onClick={showPrevLightboxImage}
              aria-label="Forra bild"
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
              className="lightboxNav right"
              onClick={showNextLightboxImage}
              aria-label="Nasta bild"
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
      </SignedIn>
    </main>
  )
}

export default App
