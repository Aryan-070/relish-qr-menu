const WISPS = [
  { left: '18%', delay: '0s',   dur: '3.2s', width: 3,   height: 52 },
  { left: '34%', delay: '0.7s', dur: '3.8s', width: 2.5, height: 42 },
  { left: '52%', delay: '1.4s', dur: '3.0s', width: 3,   height: 58 },
  { left: '70%', delay: '1.0s', dur: '3.6s', width: 2,   height: 40 },
]

export function SteamAnim() {
  return (
    <div
      className="absolute inset-x-0 top-0 pointer-events-none overflow-hidden"
      style={{ height: 72, zIndex: 0 }}
      aria-hidden
    >
      {WISPS.map((w, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            top: 0,
            left: w.left,
            width: w.width,
            height: w.height,
            borderRadius: 4,
            background: `linear-gradient(to top,
              rgba(255,248,234,0),
              rgba(255,248,234,0.55) 40%,
              rgba(255,248,234,0.78))`,
            animation: `steam-rise ${w.dur} ${w.delay} infinite ease-in,
                         steam-sway ${parseFloat(w.dur) * 0.65}s ${w.delay} infinite ease-in-out`,
            transformOrigin: 'bottom center',
          }}
        />
      ))}
    </div>
  )
}
