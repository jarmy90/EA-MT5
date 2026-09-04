import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import type { ExpertAdvisor } from '../../types'

type Props = { agents: ExpertAdvisor[]; reducedMotion?: boolean }

const roleColors = ['#22d3ee', '#a855f7', '#f59e0b', '#22c55e']

function addBox(group: THREE.Group, size: [number, number, number], position: [number, number, number], material: THREE.Material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material)
  mesh.position.set(...position); mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh); return mesh
}

function createOperator(color: string, state: string) {
  const group = new THREE.Group()
  const cloth = new THREE.MeshStandardMaterial({ color, roughness: .72, metalness: .1 })
  const skin = new THREE.MeshStandardMaterial({ color: '#b88970', roughness: .8 })
  const dark = new THREE.MeshStandardMaterial({ color: '#182235', roughness: .65 })
  addBox(group, [.48, .62, .3], [0, 1.05, 0], cloth)
  const head = new THREE.Mesh(new THREE.SphereGeometry(.22, 12, 8), skin); head.position.set(0, 1.58, 0); head.castShadow = true; group.add(head)
  addBox(group, [.36, .12, .32], [0, 1.77, 0], dark)
  const armL = addBox(group, [.12, .42, .12], [-.3, .96, -.12], skin); armL.rotation.z = -.55
  const armR = addBox(group, [.12, .42, .12], [.3, .96, -.12], skin); armR.rotation.z = .55
  addBox(group, [.16, .5, .17], [-.13, .42, 0], dark)
  addBox(group, [.16, .5, .17], [.13, .42, 0], dark)
  const badge = addBox(group, [.08, .08, .03], [0, 1.15, -.17], new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: .6 }))
  group.userData = { state, arms: [armL, armR], badge }
  return group
}

function buildScene(container: HTMLDivElement, agents: ExpertAdvisor[], reducedMotion: boolean, onSelect: (id: string) => void) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#080d18'); scene.fog = new THREE.Fog('#080d18', 15, 30)
  const camera = new THREE.PerspectiveCamera( thirty(), container.clientWidth / container.clientHeight, .1, 100); camera.position.set(8, 7, 10); camera.lookAt(0, 0, 0)
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false }); renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75)); renderer.setSize(container.clientWidth, container.clientHeight); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; container.appendChild(renderer.domElement)
  scene.add(new THREE.HemisphereLight('#d8e7ff', '#101522', 2.2)); const key = new THREE.DirectionalLight('#ffffff', 2.5); key.position.set(5, 10, 4); key.castShadow = true; scene.add(key)
  const floor = new THREE.Mesh(new THREE.BoxGeometry(15, .3, 10), new THREE.MeshStandardMaterial({ color: '#111a28', roughness: .8, metalness: .25 })); floor.position.y = -.15; floor.receiveShadow = true; scene.add(floor)
  const grid = new THREE.GridHelper(14, 28, '#27425b', '#18283b'); grid.position.y = .02; scene.add(grid)
  const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2(); const clickable: THREE.Object3D[] = []
  agents.forEach((ea, index) => { const x = index % 2 ? 3.5 : -3.5; const z = index > 1 ? 2.6 : -2.6; const station = new THREE.Group(); station.position.set(x, 0, z); station.userData.eaId = ea.id; addBox(station, [3.2, .18, 2], [0, .45, 0], new THREE.MeshStandardMaterial({ color: '#1b2739', roughness: .55, metalness: .4 })); addBox(station, [1.8, 1.05, .12], [0, 1.55, -.65], new THREE.MeshStandardMaterial({ color: '#07131f', emissive: roleColors[index], emissiveIntensity: .18, roughness: .3, metalness: .5 })); const operator = createOperator(roleColors[index], ea.operatingState); operator.position.set(0, 0, .38); station.add(operator); station.traverse(o => { if (o instanceof THREE.Mesh) clickable.push(o) }); scene.add(station) })
  const onClick = (event: PointerEvent) => { const rect = renderer.domElement.getBoundingClientRect(); pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1; pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1; raycaster.setFromCamera(pointer, camera); const hit = raycaster.intersectObjects(clickable, true)[0]; const id = hit?.object.parent?.parent?.userData.eaId || hit?.object.parent?.userData.eaId; if (id) onSelect(id) }
  renderer.domElement.addEventListener('click', onClick)
  let frame = 0; let disposed = false; const animate = () => { if (disposed) return; frame = requestAnimationFrame(animate); if (!reducedMotion) scene.traverse(o => { const data = o.userData; if (data.arms) { const t = performance.now() / 420; data.arms[0].rotation.z = -.55 + Math.sin(t) * .08; data.arms[1].rotation.z = .55 - Math.sin(t) * .08 } }); renderer.render(scene, camera) }; animate()
  const resize = () => { camera.aspect = container.clientWidth / container.clientHeight; camera.updateProjectionMatrix(); renderer.setSize(container.clientWidth, container.clientHeight) }; const observer = new ResizeObserver(resize); observer.observe(container)
  return () => { disposed = true; cancelAnimationFrame(frame); observer.disconnect(); renderer.domElement.removeEventListener('click', onClick); scene.traverse(o => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); const materials = Array.isArray(o.material) ? o.material : [o.material]; materials.forEach(m => m.dispose()) } }); renderer.dispose(); renderer.domElement.remove() }
}

function thirty() { return 30 }

export default function OperationsFloor3D({ agents, reducedMotion = false }: Props) {
  const ref = useRef<HTMLDivElement>(null); const [webgl, setWebgl] = useState(true); const [selected, setSelected] = useState('')
  useEffect(() => { if (!ref.current) return; try { return buildScene(ref.current, agents, reducedMotion, setSelected) } catch { setWebgl(false); return undefined } }, [agents, reducedMotion])
  return <section className="operations-floor-3d panel" aria-label="Wawa 3D operations floor"><div className="floor-heading"><div><div className="kicker">OPERATIONS FLOOR / THREE.JS</div><h2>Institutional trading room</h2></div><span>{selected ? `FOCUS · ${selected}` : 'OVERVIEW'} · click a station</span></div>{webgl ? <div className="three-stage" ref={ref} /> : <div className="three-fallback">3D unavailable in this browser. Operational EA data remains available above.</div>}</section>
}
