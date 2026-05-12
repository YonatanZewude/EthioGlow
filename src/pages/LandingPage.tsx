import { useRef, useCallback, useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Footer from '../components/Footer'
import { createSupabaseClient } from '../lib/supabase'

type HomepageSlide = {
  id: string
  title: string
  url: string
  category?: string
}

const DEMO_SLIDES: HomepageSlide[] = [
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

export default function LandingPage() {
  const navigate = useNavigate()
  const supabase = useMemo(() => createSupabaseClient(), [])
  const [homeSlideIndex, setHomeSlideIndex] = useState(1)
  const [homeLightboxIndex, setHomeLightboxIndex] = useState<number | null>(null)
  const [homepageSlides, setHomepageSlides] = useState<HomepageSlide[]>(DEMO_SLIDES)
  const homeFrameRef = useRef<HTMLDivElement | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [startX, setStartX] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [hasDragged, setHasDragged] = useState(false)
  const [lightboxTouchStart, setLightboxTouchStart] = useState(0)

  const activeHomeSlide = useMemo(() => {
    if (homeLightboxIndex === null || !homepageSlides.length) return null
    return homepageSlides[homeLightboxIndex] || null
  }, [homeLightboxIndex, homepageSlides])

  const homepageDotCount = Math.min(homepageSlides.length, 12)

  const getHomeSlideStep = useCallback(() => {
    const container = homeFrameRef.current
    const firstCard = container?.querySelector<HTMLElement>('.swiper-slide')
    if (!container || !firstCard) return 0

    const styles = window.getComputedStyle(container)
    const gap = Number.parseFloat(styles.columnGap || styles.gap || '0') || 0
    return firstCard.offsetWidth + gap
  }, [])

  const scrollHomepageBy = useCallback(
    (direction: 1 | -1) => {
      const container = homeFrameRef.current
      if (!container || !homepageSlides.length) return

      const step = getHomeSlideStep()
      if (!step) return

      let targetIndex = homeSlideIndex + direction

      // Infinite loop logic
      if (targetIndex >= homepageSlides.length) {
        targetIndex = 0 // Loop to first slide
      } else if (targetIndex < 0) {
        targetIndex = homepageSlides.length - 1 // Loop to last slide
      }

      // Scroll to target position
      const targetScroll = targetIndex * step
      container.scrollTo({ left: targetScroll, behavior: 'smooth' })
      setHomeSlideIndex(targetIndex)
    },
    [getHomeSlideStep, homeSlideIndex, homepageSlides.length],
  )

  const handleHomeFrameScroll = useCallback(() => {
    const container = homeFrameRef.current
    if (!container || !homepageSlides.length) return

    const step = getHomeSlideStep()
    if (!step) return

    const nextIndex = Math.round(container.scrollLeft / step)
    setHomeSlideIndex(Math.max(0, Math.min(nextIndex, homepageSlides.length - 1)))
  }, [getHomeSlideStep, homepageSlides.length])

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

  // Touch and drag handlers for swiper
  const handleMouseDown = (e: React.MouseEvent) => {
    const container = homeFrameRef.current
    if (!container) return
    setIsDragging(true)
    setHasDragged(false)
    setStartX(e.pageX - container.offsetLeft)
    setScrollLeft(container.scrollLeft)
    container.style.cursor = 'grabbing'
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    e.preventDefault()
    const container = homeFrameRef.current
    if (!container) return
    const x = e.pageX - container.offsetLeft
    const walk = (x - startX) * 2 // Scroll speed multiplier
    if (Math.abs(walk) > 5) {
      setHasDragged(true)
    }
    container.scrollLeft = scrollLeft - walk
  }

  const handleMouseUp = () => {
    const container = homeFrameRef.current
    if (container) {
      container.style.cursor = 'grab'
    }
    setIsDragging(false)
  }

  const handleMouseLeave = () => {
    if (isDragging) {
      const container = homeFrameRef.current
      if (container) {
        container.style.cursor = 'grab'
      }
      setIsDragging(false)
    }
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    const container = homeFrameRef.current
    if (!container) return
    setIsDragging(true)
    setHasDragged(false)
    setStartX(e.touches[0].pageX - container.offsetLeft)
    setScrollLeft(container.scrollLeft)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return
    const container = homeFrameRef.current
    if (!container) return
    const x = e.touches[0].pageX - container.offsetLeft
    const walk = (x - startX) * 2
    if (Math.abs(walk) > 5) {
      setHasDragged(true)
    }
    container.scrollLeft = scrollLeft - walk
  }

  const handleTouchEnd = () => {
    setIsDragging(false)
  }

  const handleSlideClick = (index: number) => {
    // Only open lightbox if user didn't drag
    if (!hasDragged) {
      openHomepageLightbox(index)
    }
  }

  useEffect(() => {
    const loadLandingSlides = async () => {
      const { data, error } = await supabase
        .from('content_items')
        .select('id, title, file_path, landing_order, created_at')
        .eq('type', 'image')
        .eq('show_on_landing', true)
        .order('landing_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })

      if (error || !data?.length) {
        setHomepageSlides(DEMO_SLIDES)
        return
      }

      const slides: Array<HomepageSlide | null> = await Promise.all(
        data.map(async (item) => {
          const { data: signed } = await supabase.storage
            .from('premium-content')
            .createSignedUrl(item.file_path, 3600)

          if (!signed?.signedUrl) {
            return null
          }

          return {
            id: item.id,
            title: item.title,
            url: signed.signedUrl,
            category: 'Featured',
          } satisfies HomepageSlide
        }),
      )

      const validSlides = slides.filter((slide): slide is HomepageSlide => slide !== null)
      setHomepageSlides(validSlides.length ? validSlides : DEMO_SLIDES)
    }

    void loadLandingSlides()
  }, [supabase])

  useEffect(() => {
    if (!homepageSlides.length) {
      setHomeSlideIndex(0)
      setHomeLightboxIndex(null)
      return
    }

    setHomeSlideIndex((currentIndex) => Math.min(currentIndex, homepageSlides.length - 1))
    setHomeLightboxIndex((currentIndex) => {
      if (currentIndex === null) return null
      return Math.min(currentIndex, homepageSlides.length - 1)
    })
  }, [homepageSlides])

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (homeLightboxIndex === null) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeHomepageLightbox()
      } else if (e.key === 'ArrowLeft') {
        showPrevHomepageLightbox()
      } else if (e.key === 'ArrowRight') {
        showNextHomepageLightbox()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [homeLightboxIndex, homepageSlides.length])

  // Initial scroll to index 1 on mount
  useEffect(() => {
    const container = homeFrameRef.current
    if (!container || !homepageSlides.length) return

    const step = getHomeSlideStep()
    if (!step) return

    // Scroll to index 1 without animation
    setTimeout(() => {
      container.scrollTo({ left: step, behavior: 'auto' })
    }, 0)
  }, [getHomeSlideStep, homepageSlides.length]) // Run once with dependencies

  // Touch swipe for lightbox
  const handleLightboxTouchStart = (e: React.TouchEvent) => {
    setLightboxTouchStart(e.touches[0].clientX)
  }

  const handleLightboxTouchEnd = (e: React.TouchEvent) => {
    const touchEnd = e.changedTouches[0].clientX
    const diff = lightboxTouchStart - touchEnd
    const threshold = 50

    if (Math.abs(diff) > threshold) {
      if (diff > 0) {
        // Swiped left, show next
        showNextHomepageLightbox()
      } else {
        // Swiped right, show previous
        showPrevHomepageLightbox()
      }
    }
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-gray-800 to-slate-900 flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-700 bg-linear-to-r from-gray-900 via-gray-800 to-gray-900 sticky top-0 z-40 shadow-sm backdrop-blur-sm bg-opacity-95">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-3xl sm:text-4xl font-serif font-bold tracking-tight text-white">
              EthioGlow<span className="text-brand-400">.</span>
            </h1>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="px-6 py-2 rounded-full text-sm font-medium bg-gray-700 text-white hover:bg-gray-600 transition-all border border-gray-600 shadow-md cursor-pointer"
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => navigate('/register')}
                className="px-6 py-2 rounded-full text-sm font-medium bg-brand-500 text-white hover:bg-brand-600 transition-all shadow-md cursor-pointer"
              >
                Register
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section with Professional Swiper */}
      <section className="relative bg-linear-to-br from-slate-900 via-purple-900 to-slate-900 py-20 px-4 overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-serif font-bold text-white mb-6 leading-tight">
              Premium AI-Generated Habesha <span className="text-brand-400">Content</span>
            </h2>
            <p className="text-xl sm:text-2xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
              Discover over 10,000 exclusive AI-generated images and videos.
            </p>
          </div>

          <div className="relative professional-swiper-container">
            {/* Navigation Buttons */}
            <button
              type="button"
              className="swiper-nav-btn swiper-nav-prev"
              onClick={showPrevHomepageSlide}
              aria-label="Previous image"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {/* Swiper Container */}
            <div className="professional-swiper-wrapper">
              <div 
                className="professional-swiper" 
                ref={homeFrameRef} 
                onScroll={handleHomeFrameScroll}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                style={{ cursor: 'grab', userSelect: 'none' }}
              >
                {homepageSlides.map((slide, index) => (
                  <article
                    key={slide.id}
                    className={`swiper-slide ${index === homeSlideIndex ? 'swiper-slide-active' : ''}`}
                  >
                    <div className="swiper-slide-inner">
                      <button
                        type="button"
                        className="swiper-image-btn"
                        onClick={() => handleSlideClick(index)}
                        aria-label={`Open image ${slide.title}`}
                      >
                        <div className="swiper-image-wrapper">
                          <img
                            src={slide.url}
                            alt={slide.title}
                            loading="lazy"
                            className="swiper-image"
                          />
                          <div className="swiper-overlay">
                            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m0 0v6m0-6h6m-6 0H4" />
                            </svg>
                          </div>
                        </div>
                        <div className="swiper-slide-info">
                          <h3 className="swiper-slide-title">{slide.title}</h3>
                          <p className="swiper-slide-category">{'category' in slide ? String(slide.category) : 'Gallery'}</p>
                        </div>
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <button
              type="button"
              className="swiper-nav-btn swiper-nav-next"
              onClick={showNextHomepageSlide}
              aria-label="Next image"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Modern Pagination */}
          <div className="flex justify-center items-center gap-6 mt-8">
            <div className="professional-pagination" aria-hidden="true">
              {homepageSlides.slice(0, homepageDotCount).map((slide, index) => (
                <button
                  key={slide.id}
                  type="button"
                  className={`pagination-dot ${homeSlideIndex % Math.max(homepageDotCount, 1) === index ? 'pagination-dot-active' : ''}`}
                  onClick={() => {
                    const container = homeFrameRef.current
                    if (container) {
                      const step = getHomeSlideStep()
                      container.scrollTo({ left: step * index, behavior: 'smooth' })
                    }
                  }}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
            <div className="text-sm font-medium text-gray-300">
              {homeSlideIndex + 1} / {homepageSlides.length}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4 bg-linear-to-b from-gray-900 to-gray-800">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center p-6 bg-linear-to-br from-gray-800 to-gray-900 rounded-2xl border border-purple-500/20 shadow-xl hover:shadow-purple-500/20 transition-all duration-300">
              <div className="w-16 h-16 mx-auto mb-4 bg-linear-to-br from-brand-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-serif font-bold mb-2 text-white">1000+ Images</h3>
              <p className="text-gray-400">Curated collection of high-quality AI-generated images</p>
            </div>
            <div className="text-center p-6 bg-linear-to-br from-gray-800 to-gray-900 rounded-2xl border border-brand-500/20 shadow-xl hover:shadow-brand-500/20 transition-all duration-300">
              <div className="w-16 h-16 mx-auto mb-4 bg-linear-to-br from-purple-600 to-brand-600 rounded-full flex items-center justify-center shadow-lg">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-serif font-bold mb-2 text-white">Premium Videos</h3>
              <p className="text-gray-400">Exclusive video content for your creative projects</p>
            </div>
            <div className="text-center p-6 bg-linear-to-br from-gray-800 to-gray-900 rounded-2xl border border-indigo-500/20 shadow-xl hover:shadow-indigo-500/20 transition-all duration-300">
              <div className="w-16 h-16 mx-auto mb-4 bg-linear-to-br from-brand-600 to-indigo-600 rounded-full flex items-center justify-center shadow-lg">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-serif font-bold mb-2 text-white">Easy Filtering</h3>
              <p className="text-gray-400">Find exactly what you need with smart categories</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 bg-linear-to-br from-purple-600 via-brand-600 to-indigo-700">
        <div className="max-w-4xl mx-auto text-center text-white">
          <h2 className="text-4xl font-serif font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-xl mb-8 text-brand-100">
            Join thousands enjoying exclusive AI-generated Ethiopian model images
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigate('/register')}
              className="px-8 py-4 bg-white text-purple-700 font-bold rounded-full hover:bg-gray-100 transition-all shadow-lg hover:shadow-xl text-lg cursor-pointer"
            >
              Start Free Trial
            </button>
            <button
              onClick={() => navigate('/login')}
              className="px-8 py-4 bg-purple-800 border-2 border-white text-white font-bold rounded-full hover:bg-purple-900 transition-all text-lg shadow-lg cursor-pointer"
            >
              Sign In
            </button>
          </div>
        </div>
      </section>

      {/* Disclaimer */}
      <div className="py-3 px-4 bg-linear-to-r from-gray-900 via-gray-800 to-gray-900 text-center text-sm text-gray-400 border-t border-purple-500/20">
        All images on this website are AI-generated.
      </div>

      {/* Lightbox */}
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
            onTouchStart={handleLightboxTouchStart}
            onTouchEnd={handleLightboxTouchEnd}
          >
            <button
              type="button"
              className="lightboxClose cursor-pointer"
              onClick={closeHomepageLightbox}
              aria-label="Close"
            >
              ×
            </button>
            <button
              type="button"
              className="lightboxNav left cursor-pointer"
              onClick={showPrevHomepageLightbox}
              aria-label="Previous image"
            >
              ←
            </button>
            <img src={activeHomeSlide.url} alt={activeHomeSlide.title} className="lightboxImage" />
            <button
              type="button"
              className="lightboxNav right cursor-pointer"
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

      <Footer />
    </div>
  )
}
