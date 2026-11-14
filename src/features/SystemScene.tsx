import { useEffect, useId, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Pause, Play, RotateCcw, SkipForward } from 'lucide-react';
import { useLocale } from '../i18n';
import { observe } from '../domain/observer';
import { SYSTEM_BODIES, SYSTEM_DURATION, systemSnapshot, systemTrails, type SystemBody, type SystemId } from '../domain/systems';

type Props = { system: SystemId; onSystemChange: (system: SystemId) => void; time: number; onTimeChange: (time: number) => void };
const copy = {
  ru: { solar: 'Солнечная система', triple: 'Три солнца', view: 'Обзор системы', choose: 'Выбрать объект', play: 'Запустить', pause: 'Пауза', step: 'Шаг', reset: 'Сброс', top: 'Сверху', tilted: 'Под углом', time: 'Время', years: 'лет', units: 'ед.', speed: 'Скорость', yearSecond: 'лет/с', unitSecond: 'ед./с', radius: 'Средний радиус', orbit: 'Радиус орбиты', period: 'Период обращения', distance: 'От центра масс', star: 'Звезда', planet: 'Планета', au: 'а. е.', km: 'км', model: 'О модели', scale: 'Круговые орбиты · положения условны. Расстояния сжаты, размеры увеличены.', tripleScale: 'Размеры тел условны · расстояния в единицах модели', solarNote: 'Круговые орбиты в одной плоскости. Размеры и цвета помогают различать тела; положения не привязаны к календарной дате.', tripleNote: 'Три равные звезды обращаются в конфигурации Лагранжа. Пробная планета движется в их суммарном поле и не влияет на звёзды. Время в единицах модели, не годах. Интервал 40 единиц не определяет длительную устойчивость или климат; внешность тел условна.', camera: 'Перетащите для поворота · прокрутите для приближения', fallback: '3D недоступно в этом браузере. Объекты и их положение доступны ниже.', stopped: 'Расчёт остановлен', source: 'Данные и метод', complete: 'Конец интервала', running: 'Воспроизведение', paused: 'На паузе' },
  'zh-CN': { solar: '太阳系', triple: '三颗太阳', view: '恒星系统概览', choose: '选择天体', play: '开始', pause: '暂停', step: '单步', reset: '重置', top: '俯视', tilted: '斜视', time: '时间', years: '年', units: '单位', speed: '速度', yearSecond: '年/秒', unitSecond: '单位/秒', radius: '平均半径', orbit: '轨道半径', period: '公转周期', distance: '距质心', star: '恒星', planet: '行星', au: '天文单位', km: '千米', model: '关于模型', scale: '圆形轨道 · 位置为示意。距离经过压缩，天体尺寸已放大。', tripleScale: '天体大小为示意 · 距离采用模型单位', solarNote: '各天体沿同一平面内的圆形轨道运行。大小与颜色用于区分天体；位置不对应日历日期。', tripleNote: '三颗等质量恒星按拉格朗日构型运行。测试行星受三颗恒星的合引力作用，不影响恒星。时间采用模型单位，不是年。40 个单位的计算不能确定长期稳定性或气候；天体外观为示意。', camera: '拖动旋转 · 滚动缩放', fallback: '此浏览器无法显示 3D。下方仍可查看天体及其位置。', stopped: '计算已停止', source: '数据与方法', complete: '时间区间结束', running: '播放中', paused: '已暂停' },
};
const namesZh: Record<string, string> = { sun: '太阳', mercury: '水星', venus: '金星', earth: '地球', mars: '火星', jupiter: '木星', saturn: '土星', uranus: '天王星', neptune: '海王星', 'star-a': '恒星 A', 'star-b': '恒星 B', 'star-c': '恒星 C', 'test-planet': '测试行星' };
const displayRadius = (body: SystemBody) => body.kind === 'star' ? (body.id === 'sun' ? .8 : .58) : body.id === 'jupiter' ? .48 : body.id === 'saturn' ? .4 : ['uranus', 'neptune'].includes(body.id) ? .31 : body.id === 'earth' ? .27 : .22;
const point = (x: number, y: number, system: SystemId) => {
  const radius = Math.hypot(x, y), scale = system === 'solar' && radius ? (1.15 + 2.55 * Math.log1p(radius)) / radius : 1.7;
  return new THREE.Vector3(x * scale, 0, y * scale);
};

function planetTexture(body: SystemBody) {
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 128;
  const ctx = canvas.getContext('2d')!; ctx.fillStyle = body.color; ctx.fillRect(0, 0, 256, 128);
  if (body.id === 'earth' || body.id === 'test-planet') {
    ctx.fillStyle = body.id === 'earth' ? '#61946b' : '#497f66';
    for (let i = 0; i < 14; i++) { ctx.beginPath(); ctx.ellipse((i * 67 + 23) % 256, 20 + (i * 29) % 94, 10 + i % 4 * 4, 5 + i % 3 * 4, i, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#e9f1e7'; ctx.fillRect(0, 0, 256, 7); ctx.fillRect(0, 122, 256, 6);
  } else if (body.id === 'jupiter' || body.id === 'saturn') {
    for (let i = 0; i < 13; i++) { ctx.fillStyle = i % 2 ? '#a87854' : '#f4dfbf'; ctx.globalAlpha = .25 + i % 3 * .1; ctx.fillRect(0, i * 10, 256, 4 + i % 3 * 2); }
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = '#485055'; ctx.globalAlpha = .13;
    for (let i = 0; i < 45; i++) { ctx.beginPath(); ctx.arc(i * 79 % 256, i * 41 % 128, 1 + i % 5, 0, Math.PI * 2); ctx.fill(); }
  }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
}
function glowTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d')!, gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, '#ffffff'); gradient.addColorStop(.15, '#fff1b9'); gradient.addColorStop(.32, '#ffb84388'); gradient.addColorStop(1, '#ff9b0000');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(canvas);
}

export function SystemScene({ system, onSystemChange, time, onTimeChange }: Props) {
  const { locale, number } = useLocale(), c = copy[locale];
  const name = (body: SystemBody) => locale === 'zh-CN' ? namesZh[body.id] : body.name;
  const [selectedId, setSelectedId] = useState(system === 'solar' ? 'earth' : 'test-planet');
  const [playing, setPlaying] = useState(false), [speed, setSpeed] = useState(1), [cameraView, setCameraView] = useState<'tilted' | 'top'>('tilted'), [unavailable, setUnavailable] = useState(false);
  const host = useRef<HTMLDivElement>(null), label = useRef<HTMLDivElement>(null), canvasApi = useRef<{ camera: (view: 'tilted' | 'top') => void } | null>(null);
  const live = useRef({ time, playing, speed, selectedId, onTimeChange }); live.current = { time, playing, speed, selectedId, onTimeChange };
  const uid = useId();
  const snapshot = useMemo(() => systemSnapshot(system, time), [system, time]);
  const selected = snapshot.bodies.find(body => body.id === selectedId) ?? snapshot.bodies.find(body => body.id === (system === 'solar' ? 'earth' : 'test-planet'))!;
  const duration = SYSTEM_DURATION[system], unit = system === 'solar' ? c.years : c.units;
  const planetView = system === 'triple' && selected.kind === 'planet' ? observe(snapshot.bodies.filter(body => body.kind === 'star').map(body => ({ mass: 1, position: body.position, velocity: { x: 0, y: 0 } })), selected.position) : null;

  useEffect(() => { setSelectedId(system === 'solar' ? 'earth' : 'test-planet'); setPlaying(false); setSpeed(1); setCameraView('tilted'); }, [system]);
  useEffect(() => { canvasApi.current?.camera(cameraView); }, [cameraView]);
  useEffect(() => {
    if (!playing) return;
    let previous: number | undefined, frame = 0, elapsed = time;
    const tick = (now: number) => {
      if (previous !== undefined) elapsed += Math.min((now - previous) / 1000, .1) * live.current.speed;
      previous = now;
      const next = systemSnapshot(system, Math.min(duration, elapsed));
      if (Math.abs(next.time - live.current.time) >= .04 || next.time === duration) { live.current.onTimeChange(next.time); }
      if (next.time >= duration || (next.halted && next.time < elapsed)) { setPlaying(false); return; }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick); return () => cancelAnimationFrame(frame);
  }, [playing, system, duration]);

  useEffect(() => {
    if (!host.current) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false }); } catch { setUnavailable(true); return; }
    setUnavailable(false);
    const container = host.current;
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setClearColor('#060d19'); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.35;
    renderer.domElement.setAttribute('aria-hidden', 'true'); container.appendChild(renderer.domElement);
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(42, 1, .1, 150);
    const controls = new OrbitControls(camera, renderer.domElement); controls.enablePan = false; controls.minDistance = 5; controls.maxDistance = 55; controls.maxPolarAngle = Math.PI * .48; controls.enableDamping = true;
    let view: 'tilted' | 'top' = 'tilted';
    const setCamera = (next: 'tilted' | 'top') => { view = next; const tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), radius = system === 'solar' ? 10.7 : 8.1; const distance = radius * Math.max(Math.hypot(1 / (tangent * camera.aspect), view === 'top' ? 0 : .8), (view === 'top' ? 1 : .6) / tangent + (view === 'top' ? 0 : .8)); camera.position.set(0, view === 'top' ? distance : distance * .6, view === 'top' ? .01 : distance * .8); controls.target.set(0, 0, 0); controls.update(); };
    setCamera('tilted'); canvasApi.current = { camera: setCamera };
    scene.add(new THREE.AmbientLight('#8296c9', .62));
    const textures: THREE.Texture[] = [], bodies = new Map<string, THREE.Mesh>(), paths = new Map<string, THREE.Line>();
    const haloTexture = glowTexture(); textures.push(haloTexture);
    for (const body of SYSTEM_BODIES[system]) {
      const radius = displayRadius(body);
      const material = body.kind === 'star' ? new THREE.MeshBasicMaterial({ color: body.color }) : new THREE.MeshStandardMaterial({ map: planetTexture(body), roughness: 1, metalness: 0 });
      if (material instanceof THREE.MeshStandardMaterial && material.map) textures.push(material.map);
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 40, 24), material); mesh.userData.id = body.id; scene.add(mesh); bodies.set(body.id, mesh);
      if (body.kind === 'star') {
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexture, color: body.color, transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false })); glow.scale.setScalar(radius * 8); mesh.add(glow);
        const light = new THREE.PointLight(body.color, system === 'solar' ? 70 : 32, 0, 1); mesh.add(light);
      }
      if (body.id === 'saturn') {
        const ring = new THREE.Mesh(new THREE.RingGeometry(radius * 1.35, radius * 2.1, 80), new THREE.MeshStandardMaterial({ color: '#c5ad83', side: THREE.DoubleSide, transparent: true, opacity: .75, roughness: 1 })); ring.rotation.x = -Math.PI / 2.5; mesh.add(ring);
      }
    }
    for (const trail of systemTrails(system)) {
      const geometry = new THREE.BufferGeometry().setFromPoints(trail.points.map(p => point(p.x, p.y, system)));
      const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: SYSTEM_BODIES[system].find(body => body.id === trail.id)!.color, transparent: true, opacity: system === 'solar' ? .22 : .45 })); scene.add(line); paths.set(trail.id, line);
    }
    const starPositions = new Float32Array(900);
    for (let i = 0; i < starPositions.length; i += 3) { const angle = i * 2.399, z = ((i * 41 % 997) / 997 - .5) * 2, r = 42; starPositions[i] = r * Math.sqrt(1 - z * z) * Math.cos(angle); starPositions[i + 1] = r * z; starPositions[i + 2] = r * Math.sqrt(1 - z * z) * Math.sin(angle); }
    scene.add(new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(starPositions, 3)), new THREE.PointsMaterial({ color: '#a6b9d2', size: .065, transparent: true, opacity: .62 })));
    const selection = new THREE.Mesh(new THREE.RingGeometry(.72, .75, 64), new THREE.MeshBasicMaterial({ color: '#d6f4ed', transparent: true, opacity: .8, side: THREE.DoubleSide, depthTest: false })); selection.renderOrder = 4; scene.add(selection);
    const resize = new ResizeObserver(() => { const width = container.clientWidth, height = container.clientHeight; if (!width || !height) return; renderer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix(); setCamera(view); }); resize.observe(container);
    const ray = new THREE.Raycaster(), pointer = new THREE.Vector2(); let down = { x: 0, y: 0 };
    const pointerDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY }; };
    const pointerUp = (e: PointerEvent) => { if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return; const rect = renderer.domElement.getBoundingClientRect(); pointer.set((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1); ray.setFromCamera(pointer, camera); const hit = ray.intersectObjects([...bodies.values()], false)[0]; if (hit) setSelectedId(hit.object.userData.id); };
    renderer.domElement.addEventListener('pointerdown', pointerDown); renderer.domElement.addEventListener('pointerup', pointerUp);
    const lost = (event: Event) => { event.preventDefault(); setUnavailable(true); setPlaying(false); }; renderer.domElement.addEventListener('webglcontextlost', lost);
    renderer.setAnimationLoop(() => {
      const state = systemSnapshot(system, live.current.time);
      state.bodies.forEach(body => bodies.get(body.id)!.position.copy(point(body.position.x, body.position.y, system)));
      if (system === 'triple') paths.forEach(line => line.geometry.setDrawRange(0, Math.floor(state.time / .05) + 1));
      const active = bodies.get(live.current.selectedId) ?? bodies.get(system === 'solar' ? 'earth' : 'test-planet')!;
      selection.position.copy(active.position); selection.quaternion.copy(camera.quaternion); selection.scale.setScalar((displayRadius(SYSTEM_BODIES[system].find(body => body.id === active.userData.id)!) + .14) / .74);
      controls.update(); renderer.render(scene, camera);
      if (label.current) { const projected = active.position.clone().project(camera), halfWidth = label.current.offsetWidth / 2 + 12, top = label.current.offsetHeight * 2 + 12; label.current.style.left = `${Math.max(halfWidth, Math.min(container.clientWidth - halfWidth, (projected.x + 1) * container.clientWidth / 2))}px`; label.current.style.top = `${Math.max(top, Math.min(container.clientHeight - 12, (1 - projected.y) * container.clientHeight / 2))}px`; label.current.style.visibility = projected.z > 1 || Math.abs(projected.x) > 1.1 || Math.abs(projected.y) > 1.1 ? 'hidden' : 'visible'; }
    });
    return () => { renderer.setAnimationLoop(null); resize.disconnect(); controls.dispose(); renderer.domElement.removeEventListener('pointerdown', pointerDown); renderer.domElement.removeEventListener('pointerup', pointerUp); renderer.domElement.removeEventListener('webglcontextlost', lost); scene.traverse(object => { if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points) { object.geometry.dispose(); for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose(); } else if (object instanceof THREE.Sprite) object.material.dispose(); }); textures.forEach(texture => texture.dispose()); renderer.dispose(); renderer.domElement.remove(); canvasApi.current = null; };
  }, [system]);

  const seek = (value: number) => { setPlaying(false); onTimeChange(value); };
  return <section className="system-explorer" aria-label={c.view}>
    <div className="system-toolbar"><div className="segmented" role="group" aria-label={c.view}>{(['solar', 'triple'] as const).map(id => <button key={id} aria-pressed={system === id} onClick={() => { setPlaying(false); onSystemChange(id); }}>{c[id]}</button>)}</div><div className="system-camera" role="group" aria-label={locale === 'ru' ? 'Камера' : '视角'}><button aria-pressed={cameraView === 'tilted'} onClick={() => { setCameraView('tilted'); canvasApi.current?.camera('tilted'); }}>{c.tilted}</button><button aria-pressed={cameraView === 'top'} onClick={() => { setCameraView('top'); canvasApi.current?.camera('top'); }}>{c.top}</button></div></div>
    <div className="system-layout"><div className="system-stage" ref={host} data-testid="system-canvas"><div className="system-stage-label" ref={label}>{name(selected)}</div><div className="system-stage-caption"><span>{c[system]}</span><small>{c.camera}</small></div>{unavailable && <p className="system-fallback" role="status">{c.fallback}</p>}</div>
      <aside className="system-details"><span className="system-object-kind">{selected.kind === 'star' ? c.star : c.planet}</span><h2 aria-live="polite">{name(selected)}</h2><span className="system-object-swatch" style={{ background: selected.color }} /><dl>{selected.radiusKm && <><dt>{c.radius}</dt><dd>{number(selected.radiusKm, 0)} {c.km}</dd></>}{selected.semimajorAu && <><dt>{c.orbit}</dt><dd>{number(selected.semimajorAu, 2)} {c.au}</dd></>}{selected.periodYears && <><dt>{c.period}</dt><dd>{number(selected.periodYears, 2)} {c.years}</dd></>}<dt>{system === 'solar' ? (locale === 'ru' ? 'От Солнца' : '距太阳') : c.distance}</dt><dd data-testid="system-distance">{number(Math.hypot(selected.position.x, selected.position.y), 2)} {system === 'solar' ? c.au : c.units}</dd>{planetView && <><dt>{locale === 'ru' ? 'До звёзд A · B · C' : '距恒星 A · B · C'}</dt><dd>{planetView.stars.map(star => number(star.distance, 2)).join(' · ')} {c.units}</dd><dt>{locale === 'ru' ? 'Суммарный поток' : '总辐照度'}</dt><dd>{number(planetView.totalFlux, 3)} <small>Σ 1/r²</small></dd></>}</dl><p className="system-scale">{system === 'solar' ? c.scale : c.tripleScale}</p></aside></div>
    <div className="system-body-list" role="group" aria-label={c.choose}>{snapshot.bodies.map(body => <button key={body.id} aria-pressed={selected.id === body.id} onClick={() => setSelectedId(body.id)}><span style={{ background: body.color }} />{name(body)}</button>)}</div>
    <div className="system-controls"><button className="button button-primary" aria-pressed={playing} onClick={() => { if (time >= duration) seek(0); setPlaying(value => !value); }}>{playing ? <Pause size={16} /> : <Play size={16} />}{playing ? c.pause : c.play}</button><button className="button button-secondary" onClick={() => seek(Math.min(duration, time + (system === 'solar' ? .1 : .05)))}><SkipForward size={16} />{c.step}</button><button className="button button-secondary" onClick={() => { seek(0); setCameraView('tilted'); canvasApi.current?.camera('tilted'); }}><RotateCcw size={16} />{c.reset}</button><label className="system-speed">{c.speed}<select value={speed} onChange={event => setSpeed(Number(event.target.value))}>{[.25, 1, 4].map(value => <option key={value} value={value}>{number(value, value < 1 ? 2 : 0)} {system === 'solar' ? c.yearSecond : c.unitSecond}</option>)}</select></label><span data-testid="system-status" role="status">{playing ? c.running : time >= duration ? c.complete : c.paused}</span></div>
    <div className="system-time"><label htmlFor={`${uid}-time`}>{c.time}<output data-testid="system-time">{number(snapshot.time, 2)} {unit}</output></label><input id={`${uid}-time`} type="range" min="0" max={duration} step=".05" value={snapshot.time} onChange={event => seek(Number(event.target.value))} /></div>
    {snapshot.halted && <p role="status">{c.stopped}: {snapshot.reason}</p>}
    <details className="system-note"><summary>{c.model}</summary><p>{system === 'solar' ? c.solarNote : c.tripleNote}</p><p>{system === 'solar' ? c.scale : c.tripleScale}</p><a href="https://github.com/mmkolpakov/Geometry-System/blob/main/docs/models.md" target="_blank" rel="noreferrer">{c.source} ↗</a></details>
  </section>;
}
