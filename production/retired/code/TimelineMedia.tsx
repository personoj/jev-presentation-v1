import {useEffect, useRef, useState} from 'react';

type Timeline = {
  fps: number; frameCount: number; initialState: string;
  states: {id: string; frame: number; hold: number}[];
  segments: {from: string; to: string; start: number; hold: number; endExclusive: number}[];
};
type ReadinessSource = Pick<HTMLMediaElement, 'readyState' | 'addEventListener' | 'removeEventListener'>;
/** Cached metadata may arrive before React subscribes. Always sample current state. */
export function observeMediaReadiness(media: ReadinessSource, update: (ready: boolean) => void) {
  const events = ['loadedmetadata', 'loadeddata', 'canplay', 'emptied', 'loadstart'];
  let disposed = false;
  const sync = () => { if (!disposed) update(media.readyState >= 1); };
  for (const event of events) media.addEventListener(event, sync);
  sync();
  return () => { disposed = true; for (const event of events) media.removeEventListener(event, sync); };
}
type PlaybackMedia = Pick<HTMLVideoElement, 'currentTime' | 'playbackRate' | 'pause' | 'play'>;
type Scheduler = {request: (callback: FrameRequestCallback) => number; cancel: (id: number) => void; now: () => number};
type PlaybackOptions = {
  hold: number; fps: number; speed: number; reduced: boolean;
  onPlaying: (playing: boolean) => void; onArrive: () => void; onError: () => void;
};
/** One cancellable run; stale play promises and frames cannot finish a newer run. */
export function runTimelinePlayback(media: PlaybackMedia, options: PlaybackOptions, scheduler: Scheduler) {
  let active = true, frame: number | null = null;
  const {hold, fps, speed, reduced} = options;
  const cancelFrame = () => { if (frame !== null) scheduler.cancel(frame); frame = null; };
  const cancel = () => { if (!active) return; active = false; cancelFrame(); media.pause(); };
  const finish = () => {
    if (!active) return;
    active = false; cancelFrame(); media.pause(); media.currentTime = hold;
    options.onPlaying(false); options.onArrive();
  };
  media.pause(); options.onPlaying(false);
  if (reduced || Math.abs(media.currentTime - hold) < .5 / fps) { finish(); return cancel; }
  options.onPlaying(true);
  const from = media.currentTime, started = scheduler.now();
  if (hold > from) {
    media.playbackRate = Math.max(.25, Math.min(4, speed));
    void media.play().catch(() => {
      if (!active) return;
      active = false; cancelFrame(); media.pause(); options.onPlaying(false); options.onError();
    });
    const tick = () => {
      if (!active) return;
      if (media.currentTime >= hold - .45 / fps) { finish(); return; }
      frame = scheduler.request(tick);
    };
    frame = scheduler.request(tick);
  } else {
    let last = -1;
    const tick = (now: number) => {
      if (!active) return;
      const position = Math.max(hold, from - (now - started) / 1000 * speed);
      const index = Math.round(position * fps);
      if (index !== last) { media.currentTime = Math.max(hold, index / fps); last = index; }
      if (position <= hold) { finish(); return; }
      frame = scheduler.request(tick);
    };
    frame = scheduler.request(tick);
  }
  return cancel;
}
export function TimelineMedia({id, poster, target='last', enabled=true, speed=2, className='', onArrive, stills}: {
  id: string; poster: string; target?: string; enabled?: boolean; speed?: number;
  className?: string; onArrive?: (state: string) => void; stills?: Record<string,string>;
}) {
  const [small] = useState(() => matchMedia('(max-width:700px)').matches);
  const [loaded, setLoaded] = useState<{id: string; timeline: Timeline} | null>(null);
  const [readySource, setReadySource] = useState(''), [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false), [replay, setReplay] = useState(0);
  const [arrived, setArrived] = useState(''), [loadedStills,setLoadedStills] = useState<Record<string,boolean>>({});
  const video = useRef<HTMLVideoElement>(null), callback = useRef(onArrive);
  const stopPlayback = useRef<(() => void) | null>(null);
  callback.current = onArrive;
  const src = '/media/' + id + (small ? '-mobile' : '') + '.mp4';
  const timeline = loaded?.id === id ? loaded.timeline : null;
  const ready = readySource === src;
  const stateId = target==='first'?timeline?.states[0]?.id:target==='last'?timeline?.states.at(-1)?.id:target;
  const resting = !playing && arrived===stateId && !!stills?.[arrived] && !!loadedStills[stills[arrived]];

  useEffect(() => {
    const controller = new AbortController();
    setFailed(false);
    fetch('/media/' + id + '-timeline.json', {signal: controller.signal})
      .then(response => { if (!response.ok) throw new Error(); return response.json(); })
      .then(value => {
        if (controller.signal.aborted) return;
        if (!(value.fps > 0) || !Array.isArray(value.states) || value.states.length < 2) throw new Error();
        setLoaded({id, timeline: value});
      })
      .catch(error => { if (!controller.signal.aborted && error.name !== 'AbortError') setFailed(true); });
    return () => controller.abort();
  }, [id]);

  useEffect(() => {
    const media = video.current;
    if (!media || failed) return;
    return observeMediaReadiness(media, value => setReadySource(value ? src : ''));
  }, [src, failed]);

  useEffect(() => {
    stopPlayback.current?.(); stopPlayback.current = null;
    setPlaying(false);
    const media = video.current;
    if (!media || !timeline || !enabled || failed) return;
    // Also inspect when the timeline/target arrives, even if its metadata event was missed.
    if (media.readyState < 1) return;
    const state = target === 'first' ? timeline.states[0]
      : target === 'last' ? timeline.states.at(-1) : timeline.states.find(item => item.id === target);
    if (!state) { setFailed(true); return; }
    const cancel = runTimelinePlayback(media, {
      hold: state.hold, fps: timeline.fps, speed,
      reduced: matchMedia('(prefers-reduced-motion:reduce)').matches,
      onPlaying: setPlaying, onArrive: () => {setArrived(state.id);callback.current?.(state.id)}, onError: () => setFailed(true),
    }, {request: fn => requestAnimationFrame(fn), cancel: frame => cancelAnimationFrame(frame), now: () => performance.now()});
    stopPlayback.current = cancel;
    return () => { cancel(); if (stopPlayback.current === cancel) stopPlayback.current = null; };
  }, [target, enabled, timeline, ready, failed, speed, replay]);

  return <div className={'timeline-media ' + className} data-media={id} data-state={target} data-playing={playing} data-resting={resting}>
    <img className="media-poster" src={poster} alt="纸艺场景静帧" style={{visibility: ready && !failed ? 'hidden' : 'visible'}}/>
    {!failed && <video ref={video} src={src} muted playsInline preload="auto"
      disablePictureInPicture controlsList="nodownload noplaybackrate noremoteplayback" disableRemotePlayback
      onError={() => setFailed(true)} aria-label={id + ' 纸艺动效'} style={{opacity: ready && !resting ? 1 : 0}}/>}
    {Object.entries(stills??{}).map(([state,path])=><img key={path} className="media-rest" src={path} alt={state==='open'?'高清印刷书页':state==='entered'?'高清结构化判断图解':'高清停留画面'} onLoad={()=>setLoadedStills(old=>({...old,[path]:true}))} style={{opacity:resting&&arrived===state?1:0}} aria-hidden={!(resting&&arrived===state)}/>)}
    {failed ? <span className="media-note">静帧展示</span> : <button className="media-replay" onClick={() => {
      const media = video.current; if (!media) return;
      // Cancel before seek so an already queued old frame cannot restore its old hold.
      stopPlayback.current?.(); stopPlayback.current = null;
      media.pause(); if (media.readyState >= 1) media.currentTime = 0;
      setPlaying(false); setArrived(''); setReplay(value => value + 1);
    }} aria-label={'重播 ' + id + ' 动效'}>↺</button>}
  </div>;
}

