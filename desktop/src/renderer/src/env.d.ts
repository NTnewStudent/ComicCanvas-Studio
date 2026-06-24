import type { ComicCanvasApi } from '../../preload'

declare global {
  interface Window {
    comicCanvas: ComicCanvasApi
  }
}
