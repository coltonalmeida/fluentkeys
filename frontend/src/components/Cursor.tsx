import { useEffect, useRef } from 'react'

/**
 * Circular gradient cursor that follows the pointer; the gradient flips
 * with the light/dark theme via the .app-cursor styles in index.css.
 * The native cursor is hidden in index.css for fine pointers only.
 */
export function Cursor() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (!window.matchMedia('(pointer: fine)').matches) return
    let raf = 0
    const onMove = (e: MouseEvent) => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        el.style.opacity = '1'
        el.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -50%)`
      })
    }
    const onLeave = () => {
      el.style.opacity = '0'
    }
    window.addEventListener('mousemove', onMove)
    document.documentElement.addEventListener('mouseleave', onLeave)
    return () => {
      window.removeEventListener('mousemove', onMove)
      document.documentElement.removeEventListener('mouseleave', onLeave)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div
      ref={ref}
      aria-hidden
      className="app-cursor pointer-events-none fixed left-0 top-0 z-50 h-5 w-5 rounded-full opacity-0"
      style={{ willChange: 'transform' }}
    />
  )
}
