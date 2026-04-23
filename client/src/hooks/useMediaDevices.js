import { useCallback, useEffect, useState } from 'react'

/**
 * Enumerate available audio/video input devices and provide switching helpers.
 * Returns { devices, audioDeviceId, videoDeviceId, switchAudio, switchVideo, refresh }.
 */
export default function useMediaDevices() {
  const [devices, setDevices] = useState({ audio: [], video: [] })
  const [audioDeviceId, setAudioDeviceId] = useState('')
  const [videoDeviceId, setVideoDeviceId] = useState('')

  const refresh = useCallback(async () => {
    try {
      const all = await navigator.mediaDevices.enumerateDevices()
      const audio = all.filter((d) => d.kind === 'audioinput' && d.deviceId)
      const video = all.filter((d) => d.kind === 'videoinput' && d.deviceId)
      setDevices({ audio, video })
      return { audio, video }
    } catch {
      return { audio: [], video: [] }
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const enumerate = async () => {
      try {
        const all = await navigator.mediaDevices.enumerateDevices()
        if (cancelled) return
        const audio = all.filter((d) => d.kind === 'audioinput' && d.deviceId)
        const video = all.filter((d) => d.kind === 'videoinput' && d.deviceId)
        setDevices({ audio, video })
      } catch { /* ignore enumeration failures */ }
    }
    enumerate()
    navigator.mediaDevices?.addEventListener('devicechange', enumerate)
    return () => {
      cancelled = true
      navigator.mediaDevices?.removeEventListener('devicechange', enumerate)
    }
  }, [])

  return { devices, audioDeviceId, setAudioDeviceId, videoDeviceId, setVideoDeviceId, refresh }
}
