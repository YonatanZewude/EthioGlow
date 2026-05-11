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
  const [verificationCode, setVerificationCode] = useState('')
  const [pendingVerification, setPendingVerification] = useState(false)
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
        setPendingVerification(false)
        setVerificationCode('')

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
          setStatus('Signed in successfully.')
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
          setPendingVerification(false)
          setVerificationCode('')
          setStatus('Account created successfully.')
        } else {
          await signUp.prepareEmailAddressVerification({ strategy: 'email_code' })
          setPendingVerification(true)
          setStatus('Check your email and enter the verification code to finish sign-up.')
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

  const handleEmailCodeVerification = async (event: FormEvent) => {
    event.preventDefault()
    setStatus(null)
    setAuthBusy(true)

    try {
      if (!signUpLoaded || !signUp || !setSignUpActive) {
        setStatus('Sign-up verification is not loaded yet. Please try again.')
        setAuthBusy(false)
        return
      }

      const result = await signUp.attemptEmailAddressVerification({
        code: verificationCode,
      })

      if (result.status === 'complete' && result.createdSessionId) {
        await setSignUpActive({ session: result.createdSessionId })
        setPendingVerification(false)
        setVerificationCode('')
        setAutoCheckoutTriggered(false)
        setStatus('Email verified. Your account is now active.')
      } else {
        setStatus('Verification is incomplete. Please try the code again.')
      }
    } catch (error) {
      const message =
        error && typeof error === 'object' && 'errors' in error
          ? String((error as { errors?: Array<{ longMessage?: string }> }).errors?.[0]?.longMessage || 'Verification error')
          : 'Verification error'
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
    <>
      <SignedOut>
        <section className="min-h-screen bg-white">
          <header className="border-b border-gray-200 bg-white sticky top-0 z-40 shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center py-4">
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl sm:text-4xl font-serif font-bold tracking-tight text-gray-900">EthioGlow<span className="text-brand-500">.</span></h1>
                  <button
                    type="button"
                    className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
                    aria-label="Toggle navigation"
                    aria-expanded={homeMenuOpen}
                    onClick={() => setHomeMenuOpen((prev) => !prev)}
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  </button>
                </div>
              </div>

                <div className={`${homeMenuOpen ? 'block' : 'hidden'} lg:flex lg:items-center lg:gap-8 absolute lg:relative top-full left-0 right-0 bg-white lg:bg-transparent border-b lg:border-0 border-gray-200 p-4 lg:p-0 shadow-lg lg:shadow-none`}>
                <nav className="flex flex-col lg:flex-row gap-2 lg:gap-6 mb-4 lg:mb-0" aria-label="Image categories">
                  {HOMEPAGE_TOPICS.map((topic) => (
                    <button
                      key={topic}
                      type="button"
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${homeTopic === topic ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
                      onClick={() => {
                        setHomeTopic(topic)
                        setHomeMenuOpen(false)
                      }}
                    >
                      {topic}
                    </button>
                  ))}
                </nav>

                <div className="flex flex-col lg:flex-row gap-3 lg:gap-4 items-stretch lg:items-center">
                  <input
                    type="search"
                    placeholder="Search images..."
                    value={homeSearch}
                    onChange={(event) => setHomeSearch(event.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent w-full lg:w-64"
                    aria-label="Search"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${authMode === 'sign-in' ? 'bg-gray-900 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                      onClick={() => {
                        setAuthMode('sign-in')
                        setHomeMenuOpen(false)
                      }}
                    >
                      Login
                    </button>
                    <button
                      type="button"
                      className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${authMode === 'sign-up' ? 'bg-brand-500 text-white hover:bg-brand-600' : 'border border-brand-500 text-brand-500 hover:bg-brand-50'}`}
                      onClick={() => {
                        setAuthMode('sign-up')
                        setHomeMenuOpen(false)
                      }}
                    >
                      Register
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </header>

          {/* Hero Section with Marketing */}
          <section className="relative bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 py-16 px-4">
            <div className="max-w-7xl mx-auto">
              <div className="text-center mb-12">
                <h2 className="text-5xl sm:text-6xl font-serif font-bold text-gray-900 mb-4">
                  Premium AI-Generated <span className="text-brand-500">Content</span>
                </h2>
                <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                  Discover over 1,000 exclusive AI-generated images and videos. High-quality, professional content for your creative projects.
                </p>
              </div>

              <div className="relative">
                <button
                  type="button"
                  className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-12 h-12 flex items-center justify-center bg-white/90 hover:bg-white rounded-full shadow-lg transition-all hover:scale-110"
                  onClick={showPrevHomepageSlide}
                  aria-label="Previous image"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>

                <div
                  className="homeFrame px-14"
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
                        className="w-full h-full p-0 border-0 rounded-lg overflow-hidden cursor-pointer"
                        onClick={() => openHomepageLightbox(index)}
                        aria-label={`Open image ${slide.title}`}
                      >
                        <img src={slide.url} alt={slide.title} loading="lazy" className="w-full h-full object-cover" />
                      </button>
                    </article>
                  ))}
                </div>

                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-12 h-12 flex items-center justify-center bg-white/90 hover:bg-white rounded-full shadow-lg transition-all hover:scale-110"
                  onClick={showNextHomepageSlide}
                  aria-label="Next image"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              <div className="flex justify-center mt-6">
                <div className="homeDots" aria-hidden="true">
                  {homepageSlides.slice(0, homepageDotCount).map((slide, index) => (
                    <span
                      key={slide.id}
                      className={homeSlideIndex % Math.max(homepageDotCount, 1) === index ? 'active' : ''}
                    />
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Features Section */}
          <section className="py-16 px-4 bg-white">
            <div className="max-w-7xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="text-center p-6">
                  <div className="w-16 h-16 mx-auto mb-4 bg-brand-100 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-serif font-bold mb-2">1000+ Images</h3>
                  <p className="text-gray-600">Curated collection of high-quality AI-generated images</p>
                </div>
                <div className="text-center p-6">
                  <div className="w-16 h-16 mx-auto mb-4 bg-brand-100 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-serif font-bold mb-2">Premium Videos</h3>
                  <p className="text-gray-600">Exclusive video content for your creative projects</p>
                </div>
                <div className="text-center p-6">
                  <div className="w-16 h-16 mx-auto mb-4 bg-brand-100 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-serif font-bold mb-2">Easy Filtering</h3>
                  <p className="text-gray-600">Find exactly what you need with smart categories</p>
                </div>
              </div>
            </div>
          </section>

          <p className="py-3 px-4 bg-gray-100 text-center text-sm text-gray-600 border-t border-gray-200">
            ⚠️ All images on this website are AI-generated.
          </p>

          <section className="py-16 px-4 bg-gradient-to-br from-gray-50 to-white">
            <div className="max-w-md mx-auto">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-serif font-bold text-gray-900 mb-2">
                  {authMode === 'sign-in' ? 'Welcome Back' : 'Get Started'}
                </h2>
                <p className="text-gray-600">
                  {authMode === 'sign-in' 
                    ? 'Sign in to access your premium content' 
                    : 'Register to unlock access to 1,000+ AI-generated images'}
                </p>
              </div>
              <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-200">
                <form className="space-y-4" onSubmit={handleAuthSubmit}>
                  <div className="flex gap-2 p-1 bg-gray-100 rounded-lg" role="tablist" aria-label="Select auth mode">
                    <button
                      type="button"
                      className={`flex-1 py-2.5 px-4 rounded-md text-sm font-medium transition-all ${authMode === 'sign-in' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                      onClick={() => {
                        setAuthMode('sign-in')
                        setPendingVerification(false)
                        setVerificationCode('')
                      }}
                    >
                      Login
                    </button>
                    <button
                      type="button"
                      className={`flex-1 py-2.5 px-4 rounded-md text-sm font-medium transition-all ${authMode === 'sign-up' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                      onClick={() => {
                        setAuthMode('sign-up')
                        setPendingVerification(false)
                        setVerificationCode('')
                      }}
                    >
                      Register
                    </button>
                  </div>

                  <input
                    type="email"
                    placeholder="Email address"
                    autoComplete="email"
                    value={authEmail}
                    onChange={(event) => setAuthEmail(event.target.value)}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                  />
                  <input
                    type="password"
                    placeholder="Password (min 8 characters)"
                    autoComplete={authMode === 'sign-in' ? 'current-password' : 'new-password'}
                    value={authPassword}
                    onChange={(event) => setAuthPassword(event.target.value)}
                    required
                    minLength={8}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                  />

                  {pendingVerification && authMode === 'sign-up' && (
                    <input
                      type="text"
                      placeholder="Enter 6-digit verification code"
                      autoComplete="one-time-code"
                      value={verificationCode}
                      onChange={(event) => setVerificationCode(event.target.value)}
                      required
                      className="w-full px-4 py-3 border border-brand-300 bg-brand-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                    />
                  )}

                  <button 
                    type="submit" 
                    disabled={authBusy}
                    className="w-full py-3 px-6 bg-gradient-to-r from-brand-500 to-brand-600 text-white font-semibold rounded-lg hover:from-brand-600 hover:to-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
                  >
                    {authMode === 'sign-in' ? 'Sign In' : 'Create Account'}
                  </button>

                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-300"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-4 bg-white text-gray-500">or continue with</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleGoogleAuth}
                    disabled={authBusy}
                    className="w-full py-3 px-6 bg-white border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Sign in with Google
                  </button>
                </form>

                {pendingVerification && authMode === 'sign-up' && (
                  <form className="mt-4 space-y-4" onSubmit={handleEmailCodeVerification}>
                    <button 
                      type="submit" 
                      disabled={authBusy || !verificationCode.trim()}
                      className="w-full py-3 px-6 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Verify Email Code
                    </button>
                  </form>
                )}

                <div id="clerk-captcha" className="mt-4" />

                {status && (
                  <div className={`mt-4 p-4 rounded-lg text-sm ${
                    status.toLowerCase().includes('error') || status.toLowerCase().includes('failed') || status.toLowerCase().includes('could not')
                      ? 'bg-red-50 text-red-800 border border-red-200' 
                      : status.toLowerCase().includes('success') || status.toLowerCase().includes('verified')
                      ? 'bg-green-50 text-green-800 border border-green-200'
                      : 'bg-blue-50 text-blue-800 border border-blue-200'
                  }`}>
                    {status}
                  </div>
                )}
              </div>
            </div>
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
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
          <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">EthioGlow Premium Studio</p>
                  <h1 className="text-2xl sm:text-3xl font-serif font-bold text-gray-900 mt-1">Premium Content Platform</h1>
                  <p className="text-sm text-gray-600 mt-1">
                    Role: <span className="font-semibold text-brand-600">{profile?.role || 'unknown'}</span>
                    {' | '}Subscription: <span className="font-semibold text-green-600">{profile?.subscription_status || 'unknown'}</span>
                  </p>
                </div>
                <UserButton afterSignOutUrl="/" />
              </div>
            </div>
          </header>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6 rounded-r-lg">
              <p className="text-sm text-yellow-800 flex items-center gap-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                All images on this website are AI-generated.
              </p>
            </div>

            {!hasAccess && (
              <div className="bg-gradient-to-br from-brand-50 to-brand-100 border border-brand-200 rounded-2xl p-8 text-center shadow-lg">
                <div className="w-20 h-20 mx-auto mb-4 bg-white rounded-full flex items-center justify-center shadow-md">
                  <svg className="w-10 h-10 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-serif font-bold text-gray-900 mb-2">Activate Membership</h2>
                <p className="text-gray-700 mb-6 max-w-md mx-auto">
                  You need an active Stripe subscription to view premium images and videos.
                </p>
                <button 
                  onClick={startCheckout} 
                  disabled={busy}
                  className="px-8 py-3 bg-gradient-to-r from-brand-500 to-brand-600 text-white font-semibold rounded-full hover:from-brand-600 hover:to-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
                >
                  Start Subscription
                </button>
              </div>
            )}

            {hasAccess && (
              <>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
                  <div className="flex gap-3 flex-wrap">
                    <button
                      type="button"
                      className={`px-6 py-2.5 rounded-lg font-medium transition-all ${selectedMediaType === 'image' ? 'bg-gray-900 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                      onClick={() => setSelectedMediaType('image')}
                    >
                      <span className="flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Images
                      </span>
                    </button>
                    <button
                      type="button"
                      className={`px-6 py-2.5 rounded-lg font-medium transition-all ${selectedMediaType === 'video' ? 'bg-gray-900 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                      onClick={() => setSelectedMediaType('video')}
                    >
                      <span className="flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Videos
                      </span>
                    </button>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
                  <div className="flex gap-2 flex-wrap">
                    <button
                      type="button"
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${selectedCategory === 'all' ? 'bg-brand-500 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                      onClick={() => setSelectedCategory('all')}
                    >
                      All categories
                    </button>
                    {categoriesForSelectedMedia.map((category) => (
                      <button
                        key={category.id}
                        type="button"
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${selectedCategory === category.id ? 'bg-brand-500 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                        onClick={() => setSelectedCategory(category.id)}
                      >
                        {category.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {mediaContent.map((item, index) => (
                    <article key={item.id} className="bg-white rounded-xl shadow-md hover:shadow-xl transition-shadow duration-300 overflow-hidden border border-gray-200">
                      <div className="relative">
                        {selectedMediaType === 'video' ? (
                          <video src={item.signedUrl} controls preload="metadata" className="w-full h-64 object-cover" />
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
                        <h3 className="text-lg font-serif font-bold text-gray-900 mb-2">{item.title}</h3>
                        <p className="text-sm text-gray-600 mb-4 line-clamp-2">{item.description}</p>
                        
                        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span className="px-2 py-1 bg-gray-100 rounded-full font-medium">{item.type.toUpperCase()}</span>
                            <span className="flex items-center gap-1">
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                              {item.favorites?.[0]?.count || 0}
                            </span>
                          </div>
                          <button 
                            onClick={() => toggleFavorite(item.id)}
                            className="text-sm font-medium text-brand-500 hover:text-brand-600 transition-colors"
                          >
                            {favorites.has(item.id) ? '❤️ Saved' : '🤍 Save'}
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}

                  {mediaContent.length === 0 && (
                    <div className="col-span-full text-center py-16">
                      <svg className="w-20 h-20 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                      </svg>
                      <p className="text-gray-500 text-lg">
                        No {selectedMediaType === 'image' ? 'images' : 'videos'} found in this category.
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}

            {isAdmin && (
              <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-purple-200 rounded-2xl p-8 shadow-lg mt-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-2xl font-serif font-bold text-gray-900">Admin Upload</h2>
                    <p className="text-sm text-gray-600">Add new content to the platform</p>
                  </div>
                </div>
                <form onSubmit={handleUpload} className="space-y-4">
                  <input
                    type="text"
                    placeholder="Content title"
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    required
                    className="w-full px-4 py-3 border border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  <textarea
                    placeholder="Description (optional)"
                    value={uploadDescription}
                    onChange={(e) => setUploadDescription(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 border border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <select
                      value={uploadType}
                      onChange={(e) => setUploadType(e.target.value as 'image' | 'video')}
                      className="px-4 py-3 border border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="image">📸 Image</option>
                      <option value="video">🎥 Video</option>
                    </select>

                    <select
                      value={uploadCategory}
                      onChange={(e) => setUploadCategory(e.target.value)}
                      required
                      className="px-4 py-3 border border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                    <span className="text-sm font-medium text-gray-700">Mark as premium content</span>
                  </label>

                  <div className="border-2 border-dashed border-purple-300 rounded-lg p-6 text-center hover:border-purple-400 transition-colors">
                    <input
                      type="file"
                      accept="image/*,video/*"
                      onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                      required
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100 cursor-pointer"
                    />
                    {uploadFile && (
                      <p className="mt-2 text-sm text-gray-600">Selected: {uploadFile.name}</p>
                    )}
                  </div>
                  
                  <button 
                    type="submit" 
                    disabled={busy}
                    className="w-full py-3 px-6 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                  >
                    {busy ? 'Uploading...' : '⬆️ Upload Content'}
                  </button>
                </form>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-8 mb-8">
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-serif font-bold text-gray-900 mb-2">Copyright Rules</h3>
                <p className="text-sm text-gray-600">
                  Only upload content you own or are licensed to use. No pirated or unauthorized reposted material.
                </p>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h3 className="text-lg font-serif font-bold text-gray-900 mb-2">Age Policy</h3>
                <p className="text-sm text-gray-600">
                  This platform is 23+. Any content involving minors is strictly forbidden and leads to permanent suspension.
                </p>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h3 className="text-lg font-serif font-bold text-gray-900 mb-2">Privacy</h3>
                <p className="text-sm text-gray-600">
                  Never publish personal information without consent. Sensitive data, private addresses, and identifying information are forbidden.
                </p>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                </div>
                <h3 className="text-lg font-serif font-bold text-gray-900 mb-2">Prohibited Content</h3>
                <p className="text-sm text-gray-600">
                  No hate, harassment, explicit illegal material, glorification of violence, or content that violates Swedish law.
                </p>
              </div>
            </div>

            {status && (
              <div className={`mt-6 p-4 rounded-lg text-sm ${
                status.toLowerCase().includes('error') || status.toLowerCase().includes('failed') || status.toLowerCase().includes('could not')
                  ? 'bg-red-50 text-red-800 border border-red-200' 
                  : status.toLowerCase().includes('success') || status.toLowerCase().includes('uploaded')
                  ? 'bg-green-50 text-green-800 border border-green-200'
                  : 'bg-blue-50 text-blue-800 border border-blue-200'
              }`}>
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
                    className="lightboxClose"
                    onClick={closeLightbox}
                    aria-label="Close"
                  >
                    ×
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
          </div>
        </div>
      </SignedIn>
    </>
  )
}

export default App
