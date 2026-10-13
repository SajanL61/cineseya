'use client';

import type Hls from 'hls.js';
import { Captions, ChevronLeft, ChevronRight, Expand, Maximize, Pause, Play, RotateCcw, Volume2, VolumeX, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { readCsrfToken } from '@/lib/client/browser-brand';

type TrackOption = { index: number; label: string; bitrate?: number };
type EpisodeLink = { id: string; label: string; href: string; watchHref?: string; detailHref: string };

const csrf = readCsrfToken;
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
const dataPerHour = (bitrate: number) => `${Math.max(1, Math.round(bitrate * 3_600 / 8 / 1_000_000))} MB/hour est.`;

export function AdaptiveMediaPlayer({ src, mimeType, poster, title, contentType, contentId, authenticated, episodeNavigation }: {
  src: string;
  mimeType: string;
  poster: string;
  title: string;
  contentType: 'movie' | 'episode';
  contentId: string;
  authenticated: boolean;
  episodeNavigation?: { previous?: EpisodeLink; next?: EpisodeLink };
}) {
  const router = useRouter();
  const container = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const hls = useRef<Hls | null>(null);
  const lastSaved = useRef(0);
  const milestones = useRef(new Set<number>());
  const recoveryAttempts = useRef(0);
  const dataSaverRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [quality, setQuality] = useState(-1);
  const [qualities, setQualities] = useState<TrackOption[]>([]);
  const [audioTrack, setAudioTrack] = useState(0);
  const [audioTracks, setAudioTracks] = useState<TrackOption[]>([]);
  const [subtitleTrack, setSubtitleTrack] = useState(-1);
  const [subtitleTracks, setSubtitleTracks] = useState<TrackOption[]>([]);
  const [playerError, setPlayerError] = useState('');
  const [dataSaver, setDataSaver] = useState(false);
  const [activeQuality, setActiveQuality] = useState('Auto');
  const [connection, setConnection] = useState('Checking');
  const [playbackSrc, setPlaybackSrc] = useState(() => src.includes('/api/stream/bootstrap/') ? '' : src);
  const [autoplayNext, setAutoplayNext] = useState(true);
  const [nextPrompt, setNextPrompt] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const isHls = /(?:mpegurl|\.m3u8(?:$|\?))/i.test(`${mimeType} ${playbackSrc}`);

  const analytics = useCallback((eventType: string, details: Record<string, unknown> = {}) => {
    void fetch('/api/analytics/events', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventType, contentType, contentId, path: window.location.pathname, ...details }) }).catch(() => undefined);
  }, [contentId, contentType]);

  useEffect(() => {
    const enabled = localStorage.getItem('cineseya-data-saver') === 'true';
    dataSaverRef.current = enabled;
    queueMicrotask(() => setDataSaver(enabled));
    queueMicrotask(() => setAutoplayNext(localStorage.getItem('cineseya-autoplay-next') !== 'false'));
  }, []);

  useEffect(() => {
    if (!nextPrompt || !autoplayNext || !episodeNavigation?.next?.watchHref) return;
    if (countdown <= 0) { router.push(episodeNavigation.next.watchHref); return; }
    const timer = window.setTimeout(() => setCountdown((value) => value - 1), 1_000);
    return () => window.clearTimeout(timer);
  }, [autoplayNext, countdown, episodeNavigation?.next?.watchHref, nextPrompt, router]);

  useEffect(() => {
    if (!src.includes('/api/stream/bootstrap/')) return;
    const controller = new AbortController();
    void fetch(src, { method: 'POST', credentials: 'same-origin', signal: controller.signal }).then(async (response) => {
      const result = await response.json() as { streamUrl?: string; error?: { message?: string } };
      if (!response.ok || !result.streamUrl) throw new Error(result.error?.message || 'A secure streaming session could not be created.');
      setPlaybackSrc(result.streamUrl);
    }).catch((cause) => { if (!(cause instanceof DOMException && cause.name === 'AbortError')) setPlayerError(cause instanceof Error ? cause.message : 'A secure streaming session could not be created.'); });
    return () => controller.abort();
  }, [src]);

  const save = useCallback((force = false) => {
    const element = video.current;
    if (!authenticated || !element || (!force && Math.abs(element.currentTime - lastSaved.current) < 15)) return;
    lastSaved.current = element.currentTime;
    void fetch('/api/progress', {
      method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf() },
      body: JSON.stringify({ contentType, contentId, seconds: element.currentTime, duration: element.duration || 0, completed: element.duration > 0 && element.currentTime / element.duration > .92 }),
    });
  }, [authenticated, contentId, contentType]);

  useEffect(() => {
    const element = video.current;
    if (!element || !playbackSrc) return;
    let disposed = false;
    setPlayerError('');
    setQualities([]);
    setAudioTracks([]);
    setSubtitleTracks([]);
    if (!isHls || element.canPlayType('application/vnd.apple.mpegurl')) {
      element.src = playbackSrc;
      return () => { element.removeAttribute('src'); element.load(); };
    }
    void import('hls.js').then(({ default: HlsPlayer }) => {
      if (disposed) return;
      if (!HlsPlayer.isSupported()) {
        setPlayerError('Adaptive playback is not supported in this browser. Use the download options instead.');
        return;
      }
      const mobile = window.matchMedia('(max-width: 700px)').matches;
      const instance = new HlsPlayer({ enableWorker: true, startLevel: mobile ? 0 : -1, capLevelToPlayerSize: true, fragLoadingMaxRetry: 2, manifestLoadingMaxRetry: 2, levelLoadingMaxRetry: 2 });
      hls.current = instance;
      instance.attachMedia(element);
      instance.on(HlsPlayer.Events.MEDIA_ATTACHED, () => instance.loadSource(playbackSrc));
      const updateTracks = () => {
        const options = instance.levels.map((level, index) => ({ index, bitrate: level.bitrate, label: `${level.height ? `${level.height}p` : `${Math.round(level.bitrate / 1000)} kbps`} · ${dataPerHour(level.bitrate)}` }));
        setQualities(options);
        setAudioTracks(instance.audioTracks.map((track, index) => ({ index, label: track.name || track.lang || `Audio ${index + 1}` })));
        setSubtitleTracks(instance.subtitleTracks.map((track, index) => ({ index, label: track.name || track.lang || `Subtitles ${index + 1}` })));
        if (dataSaverRef.current) {
          const cap = [...instance.levels].map((level, index) => ({ height: level.height || 0, index })).filter((item) => item.height <= 480).at(-1)?.index ?? 0;
          instance.autoLevelCapping = cap; instance.currentLevel = -1;
        }
      };
      instance.on(HlsPlayer.Events.MANIFEST_PARSED, updateTracks);
      instance.on(HlsPlayer.Events.AUDIO_TRACKS_UPDATED, updateTracks);
      instance.on(HlsPlayer.Events.SUBTITLE_TRACKS_UPDATED, updateTracks);
      instance.on(HlsPlayer.Events.FRAG_LOADED, () => { recoveryAttempts.current = 0; });
      instance.on(HlsPlayer.Events.LEVEL_SWITCHED, (_event, data) => {
        const level = instance.levels[data.level];
        if (level) setActiveQuality(`${level.height || Math.round(level.bitrate / 1_000)}${level.height ? 'p' : ' kbps'}`);
        const estimate = instance.bandwidthEstimate;
        setConnection(estimate > 4_000_000 ? 'Excellent' : estimate > 1_500_000 ? 'Good' : estimate > 700_000 ? 'Limited' : 'Slow');
      });
      instance.on(HlsPlayer.Events.ERROR, (_event, data) => {
        if (!data.fatal) return;
        analytics('buffer_event');
        recoveryAttempts.current += 1;
        if (recoveryAttempts.current > 2) { setPlayerError('The stream could not be played after retrying. Check your connection or try a download.'); instance.destroy(); }
        else if (data.type === HlsPlayer.ErrorTypes.NETWORK_ERROR) { instance.nextLevel = Math.max(0, instance.currentLevel - 1); instance.startLoad(); }
        else if (data.type === HlsPlayer.ErrorTypes.MEDIA_ERROR) instance.recoverMediaError();
        else setPlayerError('The stream could not be played. Try another quality or use the download options.');
      });
    });
    return () => {
      disposed = true;
      hls.current?.destroy();
      hls.current = null;
      element.removeAttribute('src');
      element.load();
    };
  }, [analytics, isHls, playbackSrc]);

  useEffect(() => {
    const instance = hls.current;
    if (!instance || !instance.levels.length) return;
    if (dataSaver) {
      const cap = [...instance.levels].map((level, index) => ({ height: level.height || 0, index })).filter((item) => item.height <= 480).at(-1)?.index ?? 0;
      instance.autoLevelCapping = cap; instance.currentLevel = -1;
    } else instance.autoLevelCapping = -1;
  }, [dataSaver]);

  useEffect(() => {
    if (!authenticated) return;
    fetch(`/api/progress?contentType=${contentType}&contentId=${contentId}`).then((response) => response.ok ? response.json() : null).then((result) => {
      if (result?.progress && video.current) video.current.currentTime = result.progress.seconds;
    }).catch(() => undefined);
  }, [authenticated, contentId, contentType]);

  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, select, textarea, button')) return;
      const element = video.current;
      if (!element) return;
      if (event.code === 'Space') { event.preventDefault(); if (element.paused) void element.play(); else element.pause(); }
      if (event.key === 'ArrowLeft') element.currentTime = Math.max(0, element.currentTime - 10);
      if (event.key === 'ArrowRight') element.currentTime = Math.min(element.duration || Infinity, element.currentTime + 10);
      if (event.key.toLocaleLowerCase() === 'm') { element.muted = !element.muted; setMuted(element.muted); }
      if (event.key.toLocaleLowerCase() === 'f') void container.current?.requestFullscreen();
    };
    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, []);

  const togglePlayback = () => playing ? video.current?.pause() : void video.current?.play();
  const toggleDataSaver = () => { const next = !dataSaver; dataSaverRef.current = next; setDataSaver(next); if (next) { setQuality(-1); analytics('data_saver_enabled'); } localStorage.setItem('cineseya-data-saver', String(next)); };
  return <div className="cinema-player" ref={container}>
    <video ref={video} poster={poster} playsInline preload="metadata" onPlay={() => { setPlaying(true); setNextPrompt(false); if (!milestones.current.has(0)) { milestones.current.add(0); analytics('watch_started'); } }} onPause={() => { setPlaying(false); save(true); }} onWaiting={() => analytics('buffer_event')} onTimeUpdate={(event) => { const element = event.currentTarget; setCurrent(element.currentTime); save(); if (element.duration > 0) { const percent = element.currentTime / element.duration * 100; for (const mark of [25, 50, 75]) if (percent >= mark && !milestones.current.has(mark)) { milestones.current.add(mark); analytics(`watch_${mark}_percent`, { quality: activeQuality }); } } }} onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)} onEnded={(event) => { save(true); analytics('watch_completed', { quality: activeQuality, durationSeconds: event.currentTarget.duration || 0 }); if (episodeNavigation?.next) { setCountdown(10); setNextPrompt(true); } }} onVolumeChange={(event) => { setMuted(event.currentTarget.muted); setVolume(event.currentTarget.volume); }} />
    {nextPrompt && episodeNavigation?.next ? <div className="player-next-prompt" role="dialog" aria-modal="false" aria-label="Next episode"><span>Up next</span><h2>{episodeNavigation.next.label}</h2><p>{autoplayNext && episodeNavigation.next.watchHref ? `Playing in ${countdown} seconds` : 'Autoplay is off. Play when you are ready.'}</p><div><button type="button" onClick={() => router.push(episodeNavigation.next!.href)}><Play/>Play Now</button><button type="button" onClick={() => setNextPrompt(false)}><X/>Cancel</button></div></div> : null}
    {playerError ? <div className="player-error" role="alert">{playerError}</div> : null}
    <button className="player-center" aria-label={playing ? 'Pause' : 'Play'} onClick={togglePlayback}>{playing ? <Pause /> : <Play />}</button>
    <div className="player-controls"><input aria-label="Playback position" type="range" min={0} max={duration || 0} step={.1} value={current} onChange={(event) => { if (video.current) video.current.currentTime = Number(event.target.value); setCurrent(Number(event.target.value)); }} /><div>
      <button aria-label={playing ? 'Pause' : 'Play'} onClick={togglePlayback}>{playing ? <Pause /> : <Play />}</button>
      <button aria-label="Replay ten seconds" onClick={() => { if (video.current) video.current.currentTime = Math.max(0, video.current.currentTime - 10); }}><RotateCcw /></button>
      <button aria-label={muted ? 'Unmute' : 'Mute'} onClick={() => { if (video.current) { video.current.muted = !video.current.muted; setMuted(video.current.muted); } }}>{muted ? <VolumeX /> : <Volume2 />}</button>
      <input className="player-volume" aria-label="Volume" type="range" min={0} max={1} step={.05} value={muted ? 0 : volume} onChange={(event) => { const value = Number(event.target.value); if (video.current) { video.current.volume = value; video.current.muted = value === 0; } setVolume(value); setMuted(value === 0); }} />
      <span>{clock(current)} / {clock(duration)}</span><b>{title}</b>
      {qualities.length ? <select aria-label="Video quality" value={quality} onChange={(event) => { const value = Number(event.target.value); setQuality(value); if (hls.current) { hls.current.currentLevel = value; if (value >= 0) { hls.current.autoLevelCapping = -1; if (dataSaver) toggleDataSaver(); } } const label = value < 0 ? 'Auto' : qualities.find((item) => item.index === value)?.label || 'Manual'; analytics('quality_selected', { quality: label }); }}><option value={-1}>Auto · Recommended</option>{qualities.map((option) => <option value={option.index} key={option.index}>{option.label}</option>)}</select> : null}
      {qualities.length ? <button className={dataSaver ? 'data-saver active' : 'data-saver'} type="button" aria-pressed={dataSaver} onClick={toggleDataSaver}>Data Saver {dataSaver ? 'On' : 'Off'}</button> : null}
      {audioTracks.length > 1 ? <select aria-label="Audio track" value={audioTrack} onChange={(event) => { const value = Number(event.target.value); setAudioTrack(value); if (hls.current) hls.current.audioTrack = value; }}>{audioTracks.map((option) => <option value={option.index} key={option.index}>{option.label}</option>)}</select> : null}
      {subtitleTracks.length ? <label className="player-track"><Captions aria-hidden="true" /><select aria-label="Subtitle track" value={subtitleTrack} onChange={(event) => { const value = Number(event.target.value); setSubtitleTrack(value); if (hls.current) hls.current.subtitleTrack = value; }}><option value={-1}>Off</option>{subtitleTracks.map((option) => <option value={option.index} key={option.index}>{option.label}</option>)}</select></label> : null}
      <select aria-label="Playback speed" value={speed} onChange={(event) => { const value = Number(event.target.value); setSpeed(value); if (video.current) video.current.playbackRate = value; }}>{[.5, .75, 1, 1.25, 1.5, 2].map((value) => <option value={value} key={value}>{value}×</option>)}</select>
      {episodeNavigation?.next ? <button type="button" className={autoplayNext ? 'autoplay-next active' : 'autoplay-next'} aria-pressed={autoplayNext} onClick={() => { const next = !autoplayNext; setAutoplayNext(next); localStorage.setItem('cineseya-autoplay-next', String(next)); }}>Autoplay {autoplayNext ? 'On' : 'Off'}</button> : null}
      <button aria-label="Picture in picture" onClick={() => void video.current?.requestPictureInPicture?.()}><Expand /></button><button aria-label="Full screen" onClick={() => void container.current?.requestFullscreen()}><Maximize /></button>
    </div></div>
    {isHls ? <div className="player-status"><span>{quality === -1 ? `Auto · ${activeQuality}` : activeQuality}</span><span>Data Saver {dataSaver ? 'On' : 'Off'}</span><span>Connection {connection}</span></div> : null}
    {episodeNavigation?.previous || episodeNavigation?.next ? <nav className="player-episode-nav" aria-label="Episode navigation">{episodeNavigation.previous ? <button type="button" onClick={() => router.push(episodeNavigation.previous!.href)}><ChevronLeft/>Previous Episode</button> : <span/>}{episodeNavigation.next ? <button type="button" onClick={() => router.push(episodeNavigation.next!.href)}>Next Episode<ChevronRight/></button> : null}</nav> : null}
  </div>;
}
