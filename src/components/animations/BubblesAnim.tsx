const BUBBLES = [
  { left: '8%',  size: 12, delay: '0s',    dur: '3.4s' },
  { left: '22%', size: 7,  delay: '0.5s',  dur: '2.8s' },
  { left: '36%', size: 15, delay: '1.0s',  dur: '3.8s' },
  { left: '50%', size: 6,  delay: '0.3s',  dur: '2.6s' },
  { left: '63%', size: 11, delay: '1.5s',  dur: '3.2s' },
  { left: '76%', size: 8,  delay: '0.8s',  dur: '3.0s' },
  { left: '88%', size: 5,  delay: '1.8s',  dur: '2.4s' },
  { left: '44%', size: 9,  delay: '2.2s',  dur: '3.6s' },
]

export function BubblesAnim() {
  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 0 }}
      aria-hidden
    >
      {BUBBLES.map((b, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            bottom: -b.size,
            left: b.left,
            width: b.size,
            height: b.size,
            borderRadius: '50%',
            background: `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.75), rgba(217,160,58,0.18))`,
            border: '1px solid rgba(217,160,58,0.42)',
            animation: `bubble-rise ${b.dur} ${b.delay} infinite ease-in,
                         bubble-sway ${parseFloat(b.dur) * 0.6}s ${b.delay} infinite ease-in-out`,
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: '18%',
              left: '18%',
              width: '36%',
              height: '36%',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.62)',
            }}
          />
        </div>
      ))}
    </div>
  )
}
