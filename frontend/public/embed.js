/**
 * FluentKeys embeddable typing test (§5).
 *
 * Usage — drop this where you want the widget to appear:
 *   <script src="https://YOUR-FLUENTKEYS-DOMAIN/embed.js"
 *           data-height="420"></script>
 *
 * It injects an <iframe> pointing at /embed on the same origin the script was
 * loaded from, so the widget always tracks the deployment serving this file.
 */
(function () {
  var script = document.currentScript
  if (!script) return

  // Derive the FluentKeys origin from this script's own URL.
  var origin
  try {
    origin = new URL(script.src).origin
  } catch (e) {
    return
  }

  var height = script.getAttribute('data-height') || '420'

  var iframe = document.createElement('iframe')
  iframe.src = origin + '/embed'
  iframe.title = 'FluentKeys typing test'
  iframe.loading = 'lazy'
  iframe.style.width = '100%'
  iframe.style.maxWidth = '720px'
  iframe.style.height = height + 'px'
  iframe.style.border = '1px solid #d4d4d8'
  iframe.style.borderRadius = '12px'
  iframe.setAttribute('allow', 'clipboard-write')

  // Insert right after the script tag.
  script.parentNode.insertBefore(iframe, script.nextSibling)
})()
