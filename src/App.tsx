import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, TouchEvent } from 'react'
import {
  SignedIn,
  SignedOut,
  UserButton,
  useAuth,
  useSignIn,
  useSignUp,
  useUser,
} from '@clerk/clerk-react'
import { createSupabaseClient } from './lib/supabase'
import type { Category, ContentItem, Profile } from './types'

const SWIPE_THRESHOLD = 42

const HOMEPAGE_TOPICS = ['Outdoor', 'Indoor', 'In nature', 'On the beach']

const DEMO_SLIDES = [
  {
    id: 'demo-1',
    title: 'Outdoor Portrait',
    url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=700&q=80',
  },
  {
    id: 'demo-2',
    title: 'Indoor Editorial',
    url: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=700&q=80',
  },
  {
    id: 'demo-3',
    title: 'In nature Light',
    url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=700&q=80',
  },
  {
    id: 'demo-4',
    title: 'On the beach Vibe',
    url: 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=700&q=80',
  },
  {
    id: 'demo-5',
    title: 'Studio Motion',
    url: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=700&q=80',
  },
]

function App() {
  const { userId, getToken, isLoaded } = useAuth()
  const { user } = useUser()
  const { isLoaded: signInLoaded, signIn, setActive: setSignInActive } = useSignIn()
  const { isLoaded: signUpLoaded, signUp, setActive: setSignUpActive } = useSignUp()

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
  const [authMode, setAuthMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [homeTopic, setHomeTopic] = useState('Outdoor')
  const [homeSearch, setHomeSearch] = useState('')
  const [homeSlideIndex, setHomeSlideIndex] = useState(0)
  const [homeLightboxIndex, setHomeLightboxIndex] = useState<number | null>(null)
  const [homeMenuOpen, setHomeMenuOpen] = useState(false)
  const homeFrameRef = useRef<HTMLDivElement | null>(null)

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

  const mediaContent = useMemo(() => {
    return content.filter(
      (item) =>
        item.type === selectedMediaType
        && (selectedCategory === 'all' || item.category_id === selectedCategory),
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
      const backendUrl = import.meta.env.VITE_STRIPE_BACKEND_URL

      if (!backendUrl) {
        setStatus('Stripe backend URL is missing.')
        setBusy(false)
        return
      }

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

  const homepageSlides = useMemo(() => {
    const uploaded = content
      .filter((item) => item.type === 'image' && item.signedUrl)
      .map((item) => ({
        id: item.id,
        title: item.title,
        url: item.signedUrl as string,
        category: item.categories?.[0]?.name || '',
      }))

    const pool = uploaded.length ? uploaded : DEMO_SLIDES
    const query = homeSearch.trim().toLowerCase()
    const topic = homeTopic.trim().toLowerCase()

    const bySearch = query
      ? pool.filter((item) => item.title.toLowerCase().includes(query))
      : pool

    const byTopic = bySearch.filter((item) => {
      const category = 'category' in item ? String(item.category || '').toLowerCase() : ''
      return (
        item.title.toLowerCase().includes(topic) ||
        category.includes(topic) ||
        bySearch.length <= 5
      )
    })

    return byTopic.length ? byTopic : bySearch
  }, [content, homeSearch, homeTopic])

  const activeHomeSlide = useMemo(() => {
    if (homeLightboxIndex === null || !homepageSlides.length) return null
    return homepageSlides[homeLightboxIndex] || null
  }, [homeLightboxIndex, homepageSlides])

  const homepageDotCount = Math.min(homepageSlides.length, 12)

  const getHomeSlideStep = useCallback(() => {
    const container = homeFrameRef.current
    const firstCard = container?.querySelector<HTMLElement>('.homeCard')
    if (!container || !firstCard) return 0

    const styles = window.getComputedStyle(container)
    const gap = Number.parseFloat(styles.columnGap || styles.gap || '0') || 0
    return firstCard.offsetWidth + gap
  }, [])

  const scrollHomepageBy = useCallback(
    (direction: 1 | -1) => {
      const container = homeFrameRef.current
      if (!container) return

      const step = getHomeSlideStep()
      if (!step) return

      const maxLeft = Math.max(container.scrollWidth - container.clientWidth, 0)

      if (direction > 0 && container.scrollLeft >= maxLeft - step / 2) {
        container.scrollTo({ left: 0, behavior: 'smooth' })
        return
      }

      if (direction < 0 && container.scrollLeft <= step / 2) {
        container.scrollTo({ left: maxLeft, behavior: 'smooth' })
        return
      }

      container.scrollBy({ left: step * direction, behavior: 'smooth' })
    },
    [getHomeSlideStep],
  )

  const handleHomeFrameScroll = useCallback(() => {
    const container = homeFrameRef.current
    if (!container || !homepageSlides.length) return

    const step = getHomeSlideStep()
    if (!step) return

    const nextIndex = Math.round(container.scrollLeft / step)
    setHomeSlideIndex(Math.max(0, Math.min(nextIndex, homepageSlides.length - 1)))
  }, [getHomeSlideStep, homepageSlides.length])

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

  useEffect(() => {
    if (homeLightboxIndex === null || !homepageSlides.length) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setHomeLightboxIndex(null)
      }
      if (event.key === 'ArrowLeft') {
        setHomeLightboxIndex((prev) => {
          if (prev === null) return prev
          return (prev - 1 + homepageSlides.length) % homepageSlides.length
        })
      }
      if (event.key === 'ArrowRight') {
        setHomeLightboxIndex((prev) => {
          if (prev === null) return prev
          return (prev + 1) % homepageSlides.length
        })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [homeLightboxIndex, homepageSlides])

  useEffect(() => {
    if (!homepageSlides.length) return

    const timer = window.setInterval(() => {
      scrollHomepageBy(1)
    }, 4200)

    return () => window.clearInterval(timer)
  }, [homepageSlides.length, scrollHomepageBy])

  useEffect(() => {
    if (!homepageSlides.length) {
      setHomeSlideIndex(0)
      return
    }

    if (homeSlideIndex > homepageSlides.length - 1) {
      setHomeSlideIndex(homepageSlides.length - 1)
    }
  }, [homeSlideIndex, homepageSlides.length])

  useEffect(() => {
    const container = homeFrameRef.current
    if (!container) return

    container.scrollTo({ left: 0, behavior: 'auto' })
    setHomeSlideIndex(0)
  }, [homeSearch, homeTopic])

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
  }, [
    autoCheckoutTriggered,
    busy,
    hasAccess,
    isLoaded,
    profile,
    startCheckout,
    userId,
  ])

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

  const showPrevHomepageSlide = () => {
    scrollHomepageBy(-1)
  }

  const showNextHomepageSlide = () => {
    scrollHomepageBy(1)
  }

  const openHomepageLightbox = (index: number) => {
    setHomeLightboxIndex(index)
  }

  const closeHomepageLightbox = () => {
    setHomeLightboxIndex(null)
  }

  const showPrevHomepageLightbox = () => {
    if (!homepageSlides.length || homeLightboxIndex === null) return
    setHomeLightboxIndex((homeLightboxIndex - 1 + homepageSlides.length) % homepageSlides.length)
  }

  const showNextHomepageLightbox = () => {
    if (!homepageSlides.length || homeLightboxIndex === null) return
    setHomeLightboxIndex((homeLightboxIndex + 1) % homepageSlides.length)
  }

  const handleAuthSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setStatus(null)
    setAuthBusy(true)

    try {
      if (authMode === 'sign-in') {
        if (!signInLoaded || !signIn || !setSignInActive) {
          setStatus('Sign-in is not loaded yet. Please try again.')
          setAuthBusy(false)
          return
        }

        const signInAttempt = await signIn.create({
          identifier: authEmail,
          password: authPassword,
        })

        if (signInAttempt.status === 'complete' && signInAttempt.createdSessionId) {
          await setSignInActive({ session: signInAttempt.createdSessionId })
          setAutoCheckoutTriggered(false)
        } else {
          setStatus('Could not sign in. Please check your credentials.')
        }
      } else {
        if (!signUpLoaded || !signUp || !setSignUpActive) {
          setStatus('Sign-up is not loaded yet. Please try again.')
          setAuthBusy(false)
          return
        }

        const signUpAttempt = await signUp.create({
          emailAddress: authEmail,
          password: authPassword,
        })

        if (signUpAttempt.status === 'complete' && signUpAttempt.createdSessionId) {
          await setSignUpActive({ session: signUpAttempt.createdSessionId })
          setAutoCheckoutTriggered(false)
        } else {
          setStatus(
            'Account created. Complete verification in Clerk if required.',
          )
        }
      }
    } catch (error) {
      const message =
        error && typeof error === 'object' && 'errors' in error
          ? String((error as { errors?: Array<{ longMessage?: string }> }).errors?.[0]?.longMessage || 'Auth error')
          : 'Auth error'
      setStatus(message)
    }

    setAuthBusy(false)
  }

  const handleGoogleAuth = async () => {
    setStatus(null)
    setAuthBusy(true)

    try {
      if (!signInLoaded || !signIn) {
        setStatus('Google sign-in is not loaded yet. Please try again.')
        setAuthBusy(false)
        return
      }

      await signIn.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: window.location.origin,
        redirectUrlComplete: window.location.origin,
      })
    } catch (error) {
      const message =
        error && typeof error === 'object' && 'errors' in error
          ? String((error as { errors?: Array<{ longMessage?: string }> }).errors?.[0]?.longMessage || 'Google auth error')
          : 'Google auth error'
      setStatus(message)
      setAuthBusy(false)
    }
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

  return (
    <main className="shell">
      <SignedOut>
        <section className="homePage">
          <header className="homeTopBar">
            <div className="homeBrandRow">
              <h1 className="brand">EthioGlow.</h1>
              <button
                type="button"
                className="hamburgerMenu"
                aria-label="Toggle navigation"
                aria-expanded={homeMenuOpen}
                onClick={() => setHomeMenuOpen((prev) => !prev)}
              >
                ☰
              </button>
            </div>

            <div className={`homeMenu ${homeMenuOpen ? 'open' : ''}`}>
              <nav className="homeTopics" aria-label="Image styles">
                {HOMEPAGE_TOPICS.map((topic) => (
                  <button
                    key={topic}
                    type="button"
                    className={homeTopic === topic ? 'active' : ''}
                    onClick={() => {
                      setHomeTopic(topic)
                      setHomeMenuOpen(false)
                    }}
                  >
                    {topic}
                  </button>
                ))}
              </nav>

              <div className="homeActions">
                <label className="homeSearch" aria-label="Search">
                  <input
                    type="search"
                    placeholder="Search"
                    value={homeSearch}
                    onChange={(event) => setHomeSearch(event.target.value)}
                  />
                </label>

                <button type="button" className="ghostAction">
                  New images
                </button>
                <button type="button" className="ghostAction">
                  Favorites
                </button>
                <button
                  type="button"
                  className={authMode === 'sign-in' ? 'darkAction active' : 'darkAction'}
                  onClick={() => {
                    setAuthMode('sign-in')
                    setHomeMenuOpen(false)
                  }}
                >
                  Login
                </button>
                <button
                  type="button"
                  className={authMode === 'sign-up' ? 'darkAction active' : 'darkAction'}
                  onClick={() => {
                    setAuthMode('sign-up')
                    setHomeMenuOpen(false)
                  }}
                >
                  Register
                </button>
              </div>
            </div>
          </header>

          <section className="homeSlider">
            <button
              type="button"
              className="homeSliderNav left"
              onClick={showPrevHomepageSlide}
              aria-label="Previous image"
            >
              ←
            </button>

            <div
              className="homeFrame"
              ref={homeFrameRef}
              onScroll={handleHomeFrameScroll}
            >
              {homepageSlides.map((slide, index) => (
                <article
                  key={slide.id}
                  className={`homeCard ${index === homeSlideIndex ? 'focus' : ''}`}
                >
                  <button
                    type="button"
                    className="homeCardButton"
                    onClick={() => openHomepageLightbox(index)}
                    aria-label={`Open image ${slide.title}`}
                  >
                    <img src={slide.url} alt={slide.title} loading="lazy" />
                  </button>
                </article>
              ))}
            </div>

            <button
              type="button"
              className="homeSliderNav right"
              onClick={showNextHomepageSlide}
              aria-label="Next image"
            >
              →
            </button>
          </section>

          <div className="homeSliderMeta">
            <div className="homeDots" aria-hidden="true">
              {homepageSlides.slice(0, homepageDotCount).map((slide, index) => (
                <span
                  key={slide.id}
                  className={homeSlideIndex % Math.max(homepageDotCount, 1) === index ? 'active' : ''}
                />
              ))}
            </div>
          </div>

          <p className="homeAiNotice">
            All images on this website are AI-generated.
          </p>

          <section className="homeAuthPanel">
            <p className="homeRegisterNote">
              Register to unlock access to more than 1,000 AI-generated images.
            </p>
            <form className="authForm" onSubmit={handleAuthSubmit}>
              <div className="authSwitch" role="tablist" aria-label="Select auth mode">
                <button
                  type="button"
                  className={authMode === 'sign-in' ? 'active' : ''}
                  onClick={() => setAuthMode('sign-in')}
                >
                  Login
                </button>
                <button
                  type="button"
                  className={authMode === 'sign-up' ? 'active' : ''}
                  onClick={() => setAuthMode('sign-up')}
                >
                  Register
                </button>
              </div>

              <input
                type="email"
                placeholder="Email"
                value={authEmail}
                onChange={(event) => setAuthEmail(event.target.value)}
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={authPassword}
                onChange={(event) => setAuthPassword(event.target.value)}
                required
                minLength={8}
              />

              <div className="homeAuthActions">
                <button type="submit" disabled={authBusy}>
                  {authMode === 'sign-in' ? 'Login' : 'Register'}
                </button>
                <button
                  type="button"
                  className="googleBtn"
                  onClick={handleGoogleAuth}
                  disabled={authBusy}
                >
                  Google
                </button>
              </div>
            </form>

            {status && <p className="status">{status}</p>}
          </section>

          {activeHomeSlide && (
            <section
              className="lightbox"
              role="dialog"
              aria-modal="true"
              aria-label="Homepage image viewer"
              onClick={closeHomepageLightbox}
            >
              <div
                className="lightboxInner"
                onClick={(event) => event.stopPropagation()}
              >
                <button
                  type="button"
                  className="lightboxClose"
                  onClick={closeHomepageLightbox}
                  aria-label="Close"
                >
                  x
                </button>
                <button
                  type="button"
                  className="lightboxNav left"
                  onClick={showPrevHomepageLightbox}
                  aria-label="Previous image"
                >
                  ←
                </button>
                <img
                  src={activeHomeSlide.url}
                  alt={activeHomeSlide.title}
                  className="lightboxImage"
                />
                <button
                  type="button"
                  className="lightboxNav right"
                  onClick={showNextHomepageLightbox}
                  aria-label="Next image"
                >
                  →
                </button>
                <div className="lightboxCaption">
                  <strong>{activeHomeSlide.title}</strong>
                  <span>
                    {(homeLightboxIndex || 0) + 1} / {homepageSlides.length}
                  </span>
                </div>
              </div>
            </section>
          )}
        </section>
      </SignedOut>

      <SignedIn>
      <header className="topBar">
        <div>
          <p className="eyebrow">EthioGlow Premium Studio</p>
          <h1>Premium Content Platform</h1>
          <p>
            Role: <strong>{profile?.role || 'unknown'}</strong> | Subscription:{' '}
            <strong>{profile?.subscription_status || 'unknown'}</strong>
          </p>
        </div>
        <UserButton afterSignOutUrl="/" />
      </header>

      <p className="homeAiNotice siteAiNotice">All images on this website are AI-generated.</p>

      {!hasAccess && (
        <section className="paywall">
          <h2>Activate membership</h2>
          <p>
            You need an active Stripe subscription to view premium images and
            videos.
          </p>
          <button onClick={startCheckout} disabled={busy}>
            Start subscription
          </button>
        </section>
      )}

      {hasAccess && (
        <>
          <section className="mediaSwitcher">
            <button
              type="button"
              className={selectedMediaType === 'image' ? 'active' : ''}
              onClick={() => setSelectedMediaType('image')}
            >
              Images
            </button>
            <button
              type="button"
              className={selectedMediaType === 'video' ? 'active' : ''}
              onClick={() => setSelectedMediaType('video')}
            >
              Videos
            </button>
          </section>

          <section className="categoryStrip">
            <button
              type="button"
              className={selectedCategory === 'all' ? 'active' : ''}
              onClick={() => setSelectedCategory('all')}
            >
              All categories
            </button>
            {categoriesForSelectedMedia.map((category) => (
              <button
                key={category.id}
                type="button"
                className={selectedCategory === category.id ? 'active' : ''}
                onClick={() => setSelectedCategory(category.id)}
              >
                {category.name}
              </button>
            ))}
          </section>

          <section className="contentGrid">
            {mediaContent.map((item, index) => (
              <article key={item.id} className="card">
                <header>
                  <h3>{item.title}</h3>
                  <span>{item.categories?.[0]?.name || 'No category'}</span>
                </header>

                {selectedMediaType === 'video' ? (
                  <video src={item.signedUrl} controls preload="metadata" />
                ) : (
                  <button
                    type="button"
                    className="galleryThumb"
                    onClick={() => openLightbox(mediaContent, index)}
                  >
                    <img src={item.signedUrl} alt={item.title} loading="lazy" />
                  </button>
                )}

                <p>{item.description}</p>
                <div className="metaRow">
                  <small>
                    {item.type.toUpperCase()} | Favorites:{' '}
                    {item.favorites?.[0]?.count || 0}
                  </small>
                  <button onClick={() => toggleFavorite(item.id)}>
                    {favorites.has(item.id) ? 'Remove favorite' : 'Save favorite'}
                  </button>
                </div>
              </article>
            ))}

            {mediaContent.length === 0 && (
              <p className="emptyState">
                No {selectedMediaType === 'image' ? 'image content' : 'video content'}
                {' '}matches the selected category.
              </p>
            )}
          </section>
        </>
      )}

      {isAdmin && (
        <section className="adminPanel">
          <h2>Admin upload</h2>
          <form onSubmit={handleUpload} className="uploadForm">
            <input
              type="text"
              placeholder="Title"
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              required
            />
            <textarea
              placeholder="Description"
              value={uploadDescription}
              onChange={(e) => setUploadDescription(e.target.value)}
            />

            <div className="gridTwo">
              <select
                value={uploadType}
                onChange={(e) => setUploadType(e.target.value as 'image' | 'video')}
              >
                <option value="image">Image</option>
                <option value="video">Video</option>
              </select>

              <select
                value={uploadCategory}
                onChange={(e) => setUploadCategory(e.target.value)}
                required
              >
                <option value="">Select category</option>
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
              Mark as premium
            </label>

            <input
              type="file"
              accept="image/*,video/*"
              onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              required
            />
            <button type="submit" disabled={busy}>
              Upload
            </button>
          </form>
        </section>
      )}

      <section className="policyGrid">
        <article>
          <h3>Copyright Rules</h3>
          <p>
            Only upload content you own or are licensed to use. No pirated or
            unauthorized reposted material.
          </p>
        </article>
        <article>
          <h3>Age Policy</h3>
          <p>
            This platform is 18+. Any content involving minors is strictly
            forbidden and leads to permanent suspension.
          </p>
        </article>
        <article>
          <h3>Privacy</h3>
          <p>
            Never publish personal information without consent. Sensitive data,
            private addresses, and identifying information are forbidden.
          </p>
        </article>
        <article>
          <h3>Prohibited Content</h3>
          <p>
            No hate, harassment, explicit illegal material, glorification of
            violence, or content that violates Swedish law.
          </p>
        </article>
      </section>

      {status && <p className="status">{status}</p>}

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
              className="lightboxClose"
              onClick={closeLightbox}
              aria-label="Close"
            >
              x
            </button>
            <button
              type="button"
              className="lightboxNav left"
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
              className="lightboxNav right"
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
      </SignedIn>
    </main>
  )
}

export default App
