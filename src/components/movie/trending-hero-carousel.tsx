'use client';

import { ChevronLeft, ChevronRight, Info, Pause, Play, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { TrailerDialog } from '@/components/movie/trailer-dialog';
import { WatchlistButton } from '@/components/movie/watchlist-button';
import { CineBackdrop } from '@/components/ui/cine-artwork';
import type { MovieRecord } from '@/types/content';

const ROTATION_INTERVAL = 3_000;

export function TrendingHeroCarousel({ movies }: { movies: MovieRecord[] }) {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState<'next' | 'previous'>('next');
  const [paused, setPaused] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pageHidden, setPageHidden] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const total = movies.length;

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncPreference = () => setReducedMotion(preference.matches);
    syncPreference();
    preference.addEventListener('change', syncPreference);
    return () => preference.removeEventListener('change', syncPreference);
  }, []);

  useEffect(() => {
    const syncVisibility = () => setPageHidden(document.hidden);
    syncVisibility();
    document.addEventListener('visibilitychange', syncVisibility);
    return () => document.removeEventListener('visibilitychange', syncVisibility);
  }, []);

  useEffect(() => {
    if (total < 2 || paused || focused || pageHidden || reducedMotion) return;
    const timer = window.setTimeout(() => {
      setDirection('next');
      setCurrent((index) => (index + 1) % total);
    }, ROTATION_INTERVAL);
    return () => window.clearTimeout(timer);
  }, [current, focused, pageHidden, paused, reducedMotion, total]);

  if (!total) return null;
  const movie = movies[current] ?? movies[0]!;
  const isPlaying = total > 1 && !paused && !focused && !pageHidden && !reducedMotion;

  const move = (step: -1 | 1) => {
    setDirection(step === 1 ? 'next' : 'previous');
    setCurrent((index) => (index + step + total) % total);
  };

  const select = (index: number) => {
    setDirection(index < current ? 'previous' : 'next');
    setCurrent(index);
  };

  const togglePaused = () => {
    if (paused) setFocused(false);
    setPaused((value) => !value);
  };

  return (
    <section
      className="home-hero hero-carousel"
      aria-roledescription="carousel"
      aria-label="Trending movies"
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
      }}
      onTouchStart={(event) => event.currentTarget.setAttribute('data-touch-start', String(event.touches[0]?.clientX ?? 0))}
      onTouchEnd={(event) => {
        const start = Number(event.currentTarget.getAttribute('data-touch-start') ?? 0);
        const end = event.changedTouches[0]?.clientX ?? start;
        event.currentTarget.removeAttribute('data-touch-start');
        if (Math.abs(end - start) > 45) move(end < start ? 1 : -1);
      }}
    >
      <div className="hero-carousel-backdrops" aria-hidden="true">
        {movies.map((item, index) => (
          <div className={`hero-backdrop hero-carousel-backdrop${index === current ? ' active' : ''}`} key={item.id}>
            <CineBackdrop src={item.backdropUrl} alt="" focalPoint={item.backdropFocalPoint} fillContainer preload={index === 0} sizes="100vw" />
          </div>
        ))}
      </div>

      <div className="hero-carousel-slide" data-direction={direction} key={movie.id} aria-label={`${current + 1} of ${total}: ${movie.title}`}>
        <div className="hero-content">
          <div className="hero-content-inner">
            <span className="hero-kicker">Trending on CineSeya.lk</span>
            <h1>{movie.title}</h1>
            {movie.sinhalaTitle && <p className="hero-sinhala" lang="si">{movie.sinhalaTitle}</p>}
            <div className="hero-meta">
              {movie.imdbRating && <span className="rating">★ {movie.imdbRating.toFixed(1)}</span>}
              <i/><span>{movie.year}</span>
              {movie.runtime > 0 && <><i/><span>{movie.runtime} min</span></>}
              {movie.genres.length > 0 && <><i/><span>{movie.genres.join(' · ')}</span></>}
              <span className="age">{movie.ageRating}</span>
            </div>
            <p className="hero-description">{movie.overview}</p>
            <div className="hero-actions">
              <Link className="action-button" href={`/movies/${movie.slug}`}><Info/>View Details</Link>
              {movie.trailerUrl && <TrailerDialog title={movie.title} url={movie.trailerUrl}/>}
              <WatchlistButton id={movie.id} slug={movie.slug} title={movie.title} posterUrl={movie.posterUrl} posterFocalPoint={movie.posterFocalPoint} label/>
            </div>
          </div>
        </div>
      </div>

      <aside className="hero-side-note"><b><ShieldCheck/>Rights-aware access</b>Full media controls appear only when a verified, distributable version is active.</aside>

      {total > 1 && <div className="hero-carousel-controls" data-playing={isPlaying}>
        <button type="button" onClick={() => move(-1)} aria-label="Show previous trending movie"><ChevronLeft/></button>
        <div className="hero-carousel-dots" aria-label="Choose a trending movie">
          {movies.map((item, index) => <button type="button" className={index === current ? 'active' : ''} aria-label={`Show ${item.title}`} aria-current={index === current ? 'true' : undefined} onClick={() => select(index)} key={item.id}/>) }
        </div>
        <button type="button" onClick={() => move(1)} aria-label="Show next trending movie"><ChevronRight/></button>
        <button type="button" className="hero-carousel-pause" disabled={reducedMotion} aria-label={reducedMotion ? 'Automatic rotation disabled by reduced motion preference' : paused ? 'Resume automatic rotation' : 'Pause automatic rotation'} aria-pressed={paused} onClick={togglePaused}>{paused || reducedMotion ? <Play/> : <Pause/>}</button>
      </div>}
    </section>
  );
}
