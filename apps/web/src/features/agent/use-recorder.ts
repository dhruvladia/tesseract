import { useCallback, useEffect, useRef, useState } from 'react'

export type RecorderState = 'idle' | 'recording' | 'transcribing' | 'error'

/** Press to start, press to stop; the clip is posted to /api/agent/transcribe and the text handed back. */
export function useRecorder(onText: (text: string) => void) {
  const [state, setState] = useState<RecorderState>('idle')
  const [error, setError] = useState<string | null>(null)
  const rec = useRef<MediaRecorder | null>(null)
  const chunks = useRef<BlobPart[]>([])
  const supported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined'

  const stop = useCallback(() => {
    rec.current?.stop()
    rec.current?.stream.getTracks().forEach((t) => t.stop())
  }, [])

  const start = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : ''
      const r = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      chunks.current = []
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data)
      r.onstop = async () => {
        setState('transcribing')
        try {
          const blob = new Blob(chunks.current, { type: r.mimeType || 'audio/webm' })
          const form = new FormData()
          form.append('audio', blob, `clip.${blob.type.includes('mp4') ? 'm4a' : 'webm'}`)
          const res = await fetch('/api/agent/transcribe', { method: 'POST', body: form, credentials: 'include' })
          const body = (await res.json().catch(() => ({}))) as { text?: string; error?: string }
          if (!res.ok) throw new Error(body.error ?? 'Transcription failed')
          if (body.text) onText(body.text)
          setState('idle')
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Transcription failed')
          setState('error')
        }
      }
      r.start()
      rec.current = r
      setState('recording')
    } catch (e) {
      const name = (e as { name?: string }).name
      setError(name === 'NotAllowedError' ? 'Microphone access was denied. Allow it in the browser and try again.' : name === 'NotFoundError' ? 'No microphone found.' : 'Could not start recording.')
      setState('error')
    }
  }, [onText])

  useEffect(() => () => rec.current?.stream.getTracks().forEach((t) => t.stop()), [])

  return { state, error, start, stop, supported, toggle: () => (state === 'recording' ? stop() : start()) }
}
