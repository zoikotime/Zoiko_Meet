import { useCallback, useEffect, useRef, useState } from 'react'

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
    refresh()
    navigator.mediaDevices?.addEventListener('devicechange', refresh)
    return () => navigator.mediaDevices?.removeEventListener('devicechange', refresh)
  }, [refresh])

  return { devices, audioDeviceId, setAudioDeviceId, videoDeviceId, setVideoDeviceId, refresh }
}
