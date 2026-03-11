export function loadImage(path: string, cache: Map<string, HTMLImageElement>, onReady: () => void) {
  const existing = cache.get(path)
  if (existing) {
    return existing
  }

  const image = new Image()
  image.onload = onReady
  image.onerror = onReady
  image.src = path
  cache.set(path, image)
  return image
}
