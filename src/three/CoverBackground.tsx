import { useEffect, useRef } from 'react'
import * as THREE from 'three'

const PARTICLE_COUNT = 35

export function CoverBackground() {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = mountRef.current
    if (!container) return

    const w = container.clientWidth
    const h = container.clientHeight

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(w, h)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    container.appendChild(renderer.domElement)

    // Scene + Camera
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 100)
    camera.position.z = 5

    // Particles
    const positions = new Float32Array(PARTICLE_COUNT * 3)
    const colors = new Float32Array(PARTICLE_COUNT * 3)
    const velocities: { vx: number; vy: number; phase: number }[] = []

    const goldColor = new THREE.Color('#D9A03A')
    const maroonColor = new THREE.Color('#8B1024')
    const paperColor = new THREE.Color('#FFF8EA')

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * 8
      positions[i * 3 + 1] = (Math.random() - 0.5) * 12
      positions[i * 3 + 2] = (Math.random() - 0.5) * 3

      const t = Math.random()
      const c = t < 0.5 ? goldColor.clone().lerp(paperColor, Math.random() * 0.5) : maroonColor.clone().lerp(goldColor, Math.random() * 0.6)
      colors[i * 3]     = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b

      velocities.push({
        vx: (Math.random() - 0.5) * 0.003,
        vy: (Math.random() - 0.5) * 0.004,
        phase: Math.random() * Math.PI * 2,
      })
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    const mat = new THREE.PointsMaterial({
      size: 0.04,
      vertexColors: true,
      transparent: true,
      opacity: 0.55,
      sizeAttenuation: true,
    })

    const points = new THREE.Points(geo, mat)
    scene.add(points)

    // Soft light
    const ambientLight = new THREE.AmbientLight(0xfff8ea, 0.4)
    scene.add(ambientLight)

    let frameId: number
    let t = 0

    const animate = () => {
      frameId = requestAnimationFrame(animate)
      t += 0.008

      const pos = geo.attributes.position.array as Float32Array
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const v = velocities[i]
        pos[i * 3]     += v.vx + Math.sin(t + v.phase) * 0.001
        pos[i * 3 + 1] += v.vy + Math.cos(t * 0.7 + v.phase) * 0.001

        // Wrap around bounds
        if (pos[i * 3] > 4)  pos[i * 3] = -4
        if (pos[i * 3] < -4) pos[i * 3] = 4
        if (pos[i * 3 + 1] > 6)  pos[i * 3 + 1] = -6
        if (pos[i * 3 + 1] < -6) pos[i * 3 + 1] = 6
      }
      geo.attributes.position.needsUpdate = true

      // Slow rotation
      points.rotation.z = Math.sin(t * 0.1) * 0.04

      renderer.render(scene, camera)
    }

    animate()

    const handleResize = () => {
      if (!container) return
      const nw = container.clientWidth
      const nh = container.clientHeight
      camera.aspect = nw / nh
      camera.updateProjectionMatrix()
      renderer.setSize(nw, nh)
    }
    const ro = new ResizeObserver(handleResize)
    ro.observe(container)

    return () => {
      cancelAnimationFrame(frameId)
      ro.disconnect()
      renderer.dispose()
      geo.dispose()
      mat.dispose()
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [])

  return (
    <div
      ref={mountRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
      aria-hidden
    />
  )
}
