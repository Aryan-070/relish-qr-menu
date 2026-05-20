interface Props {
  categoryId: string
  className?: string
  style?: React.CSSProperties
}

export function CategoryIllustration({ categoryId, className = '', style }: Props) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl ${className}`}
      style={{ background: '#FFF8EA', ...style }}
    >
      <svg
        viewBox="0 0 400 200"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden
      >
        <IllustrationContent categoryId={categoryId} />
      </svg>
    </div>
  )
}

function IllustrationContent({ categoryId }: { categoryId: string }) {
  switch (categoryId) {
    case 'beverages':  return <BeveragesArt />
    case 'soups':      return <SoupsArt />
    case 'quickbites': return <QuickBitesArt />
    case 'italian':    return <ItalianArt />
    case 'desserts':   return <DessertsArt />
    default:           return <QuickBitesArt />
  }
}

/* ─────────────────────────────── BEVERAGES ─────────────────────────────── */
function BeveragesArt() {
  return (
    <>
      <defs>
        <radialGradient id="bev-bg" cx="50%" cy="45%" r="75%">
          <stop offset="0%" stopColor="#FFF8EA" />
          <stop offset="100%" stopColor="#EDCF8A" stopOpacity="0.55" />
        </radialGradient>
      </defs>
      <rect width="400" height="200" fill="url(#bev-bg)" />

      {/* Decorative bg circles */}
      <circle cx="58" cy="100" r="52" fill="none" stroke="rgba(217,160,58,0.13)" strokeWidth="1" />
      <circle cx="340" cy="105" r="42" fill="rgba(217,160,58,0.05)" />

      {/* ── GLASS ── */}
      <path d="M172,18 L186,175 L214,175 L228,18 Z"
            fill="rgba(217,160,58,0.07)" stroke="rgba(217,160,58,0.55)" strokeWidth="1.5" />
      <ellipse cx="200" cy="18" rx="28" ry="5.5"
               fill="none" stroke="rgba(217,160,58,0.55)" strokeWidth="1.5" />
      {/* liquid */}
      <path d="M175,72 L186,175 L214,175 L225,72 Z" fill="rgba(217,160,58,0.30)" />
      <ellipse cx="200" cy="72" rx="25" ry="5" fill="rgba(217,160,58,0.22)" />
      {/* glass shine */}
      <path d="M178,28 C176,80 177,120 179,158"
            stroke="rgba(255,255,255,0.45)" strokeWidth="2.5" strokeLinecap="round" fill="none" />

      {/* Straw */}
      <line x1="219" y1="10" x2="208" y2="178"
            stroke="#8B1024" strokeWidth="5" strokeLinecap="round" />
      <line x1="219" y1="10" x2="208" y2="178"
            stroke="#FFF8EA" strokeWidth="2" strokeLinecap="round" strokeDasharray="8 8" />

      {/* Ice cubes */}
      <rect x="183" y="120" width="19" height="16" rx="3"
            fill="rgba(255,255,255,0.58)" stroke="rgba(217,160,58,0.38)" strokeWidth="1" />
      <rect x="202" y="132" width="16" height="14" rx="3"
            fill="rgba(255,255,255,0.48)" stroke="rgba(217,160,58,0.28)" strokeWidth="1" />

      {/* Bubbles inside */}
      <circle cx="191" cy="148" r="3.5" fill="rgba(255,255,255,0.5)" />
      <circle cx="204" cy="126" r="2.5" fill="rgba(255,255,255,0.42)" />
      <circle cx="214" cy="158" r="2"   fill="rgba(255,255,255,0.45)" />
      <circle cx="187" cy="108" r="1.8" fill="rgba(255,255,255,0.38)" />
      <circle cx="208" cy="165" r="1.5" fill="rgba(255,255,255,0.35)" />

      {/* ── LEMON SLICE on rim ── */}
      <circle cx="228" cy="42" r="18" fill="#F4D03F" stroke="#D9A03A" strokeWidth="1.5" />
      <circle cx="228" cy="42" r="13" fill="none" stroke="rgba(217,160,58,0.7)" strokeWidth="0.8" />
      <line x1="228" y1="24" x2="228" y2="60" stroke="rgba(217,160,58,0.7)" strokeWidth="0.8" />
      <line x1="210" y1="42" x2="246" y2="42" stroke="rgba(217,160,58,0.7)" strokeWidth="0.8" />
      <line x1="215" y1="29" x2="241" y2="55" stroke="rgba(217,160,58,0.5)" strokeWidth="0.7" />
      <line x1="241" y1="29" x2="215" y2="55" stroke="rgba(217,160,58,0.5)" strokeWidth="0.7" />

      {/* ── MINT SPRIGS (left) ── */}
      <path d="M97,78 Q110,58 130,72 Q118,90 97,78 Z"  fill="rgba(79,122,60,0.52)" />
      <path d="M92,98 Q107,78 128,94 Q114,114 92,98 Z" fill="rgba(79,122,60,0.45)" />
      <path d="M96,118 Q112,98 133,114 Q118,135 96,118 Z" fill="rgba(79,122,60,0.38)" />
      <line x1="105" y1="82"  x2="126" y2="77"  stroke="rgba(79,122,60,0.6)"  strokeWidth="0.8" />
      <line x1="102" y1="103" x2="123" y2="98"  stroke="rgba(79,122,60,0.55)" strokeWidth="0.8" />
      <line x1="106" y1="123" x2="128" y2="118" stroke="rgba(79,122,60,0.5)"  strokeWidth="0.8" />

      {/* ── FLOATING CITRUS (right) ── */}
      <circle cx="298" cy="65" r="17" fill="rgba(244,208,63,0.45)" stroke="rgba(217,160,58,0.5)" strokeWidth="1" />
      <circle cx="298" cy="65" r="12" fill="none" stroke="rgba(217,160,58,0.4)" strokeWidth="0.7" />
      <line x1="298" y1="48" x2="298" y2="82" stroke="rgba(217,160,58,0.4)" strokeWidth="0.7" />
      <line x1="281" y1="65" x2="315" y2="65" stroke="rgba(217,160,58,0.4)" strokeWidth="0.7" />

      <circle cx="340" cy="140" r="12" fill="rgba(244,208,63,0.38)" stroke="rgba(217,160,58,0.4)" strokeWidth="1" />
      <circle cx="340" cy="140" r="8"  fill="none" stroke="rgba(217,160,58,0.35)" strokeWidth="0.7" />
      <line x1="340" y1="128" x2="340" y2="152" stroke="rgba(217,160,58,0.35)" strokeWidth="0.7" />
      <line x1="328" y1="140" x2="352" y2="140" stroke="rgba(217,160,58,0.35)" strokeWidth="0.7" />

      {/* Scatter dots */}
      <circle cx="55"  cy="35"  r="3"   fill="rgba(217,160,58,0.38)" />
      <circle cx="350" cy="42"  r="2.5" fill="rgba(217,160,58,0.30)" />
      <circle cx="148" cy="174" r="2"   fill="rgba(217,160,58,0.25)" />
      <circle cx="308" cy="172" r="2"   fill="rgba(217,160,58,0.28)" />
      <circle cx="372" cy="95"  r="1.5" fill="rgba(139,16,36,0.22)"  />
      <circle cx="28"  cy="155" r="2"   fill="rgba(217,160,58,0.22)" />
    </>
  )
}

/* ─────────────────────────────── SOUPS ─────────────────────────────── */
function SoupsArt() {
  return (
    <>
      <defs>
        <radialGradient id="soup-bg" cx="50%" cy="50%" r="70%">
          <stop offset="0%" stopColor="#FFF8EA" />
          <stop offset="100%" stopColor="#EDD5A0" stopOpacity="0.6" />
        </radialGradient>
      </defs>
      <rect width="400" height="200" fill="url(#soup-bg)" />
      <ellipse cx="200" cy="175" rx="140" ry="35" fill="rgba(139,16,36,0.04)" />

      {/* ── BOWL ── */}
      <path d="M 82,122 Q 84,194 200,197 Q 316,194 318,122 Z"
            fill="#F0E0C0" stroke="rgba(217,160,58,0.5)" strokeWidth="1.5" />
      <ellipse cx="200" cy="122" rx="118" ry="22"
               fill="#F7EBD2" stroke="rgba(217,160,58,0.5)" strokeWidth="1.5" />
      {/* inner shadow rim */}
      <ellipse cx="200" cy="122" rx="110" ry="18"
               fill="none" stroke="rgba(42,30,30,0.07)" strokeWidth="3" />
      {/* broth surface */}
      <ellipse cx="200" cy="122" rx="108" ry="17" fill="rgba(139,16,36,0.22)" />
      {/* cream swirl */}
      <path d="M 178,116 Q 190,108 200,116 Q 210,124 222,116"
            fill="none" stroke="rgba(247,235,210,0.68)" strokeWidth="2.5" strokeLinecap="round" />
      {/* crouton */}
      <rect x="193" y="116" width="16" height="11" rx="2.5" fill="rgba(200,160,90,0.82)" />
      <rect x="195" y="117" width="12" height="9"  rx="2"   fill="rgba(222,182,112,0.92)" />
      {/* herb garnish */}
      <path d="M 160,119 Q 165,111 174,117 Q 168,124 160,119 Z" fill="rgba(79,122,60,0.52)" />
      <path d="M 226,117 Q 231,109 240,115 Q 234,122 226,117 Z" fill="rgba(79,122,60,0.46)" />

      {/* ── STEAM ── */}
      <path d="M 185,100 Q 180,82 187,64 Q 192,47 188,30"
            fill="none" stroke="rgba(247,235,210,0.72)" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M 200,98 Q 194,79 200,59 Q 206,39 200,22"
            fill="none" stroke="rgba(247,235,210,0.67)" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M 215,100 Q 220,82 214,64 Q 208,47 215,30"
            fill="none" stroke="rgba(247,235,210,0.62)" strokeWidth="2.5" strokeLinecap="round" />

      {/* ── SPOON ── */}
      <ellipse cx="305" cy="128" rx="12" ry="8"
               fill="#F7EBD2" stroke="rgba(217,160,58,0.6)" strokeWidth="1.2" />
      <line x1="316" y1="124" x2="356" y2="97"
            stroke="rgba(217,160,58,0.6)" strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="305" cy="128" rx="9" ry="6" fill="rgba(139,16,36,0.25)" />

      {/* Decorative */}
      <circle cx="55" cy="100" r="42" fill="none" stroke="rgba(217,160,58,0.1)" strokeWidth="1" />
      <circle cx="55" cy="100" r="28" fill="rgba(217,160,58,0.04)" />
      <path d="M 355,80 Q 372,65 382,78 Q 370,92 355,80 Z" fill="rgba(79,122,60,0.3)" />
      <line x1="360" y1="83" x2="378" y2="75" stroke="rgba(79,122,60,0.38)" strokeWidth="0.8" />
      <circle cx="45"  cy="50"  r="3"   fill="rgba(217,160,58,0.35)" />
      <circle cx="355" cy="55"  r="2.5" fill="rgba(217,160,58,0.28)" />
      <circle cx="368" cy="155" r="2"   fill="rgba(217,160,58,0.25)" />
      <circle cx="30"  cy="160" r="2"   fill="rgba(217,160,58,0.22)" />
    </>
  )
}

/* ─────────────────────────────── QUICK BITES ─────────────────────────────── */
function QuickBitesArt() {
  return (
    <>
      <defs>
        <radialGradient id="qb-bg" cx="50%" cy="50%" r="70%">
          <stop offset="0%" stopColor="#FFF8EA" />
          <stop offset="100%" stopColor="#EDCF8A" stopOpacity="0.5" />
        </radialGradient>
      </defs>
      <rect width="400" height="200" fill="url(#qb-bg)" />

      {/* ── PLATE ── */}
      <ellipse cx="202" cy="170" rx="88" ry="12" fill="rgba(42,30,30,0.06)" />
      <circle cx="200" cy="118" r="88"
              fill="#F7EBD2" stroke="rgba(217,160,58,0.38)" strokeWidth="2" />
      <circle cx="200" cy="118" r="80"
              fill="none" stroke="rgba(217,160,58,0.2)" strokeWidth="1" />
      <circle cx="200" cy="118" r="75" fill="rgba(255,252,245,0.92)" />

      {/* ── FOOD ITEMS ── */}
      {/* Samosa */}
      <path d="M 165,108 L 180,85 L 196,118 Z"
            fill="rgba(200,150,60,0.72)" stroke="rgba(180,130,40,0.9)" strokeWidth="1" />
      <circle cx="178" cy="103" r="2"   fill="rgba(139,85,30,0.5)" />
      <circle cx="183" cy="112" r="1.5" fill="rgba(139,85,30,0.4)" />
      {/* Bruschetta */}
      <rect x="205" y="95" width="42" height="22" rx="5"
            fill="rgba(200,160,80,0.75)" stroke="rgba(180,140,60,0.9)" strokeWidth="1" />
      <rect x="207" y="97" width="38" height="18" rx="4" fill="rgba(222,186,102,0.6)" />
      <circle cx="218" cy="106" r="6" fill="rgba(215,25,32,0.5)" />
      <circle cx="230" cy="106" r="5" fill="rgba(215,25,32,0.45)" />
      <circle cx="240" cy="106" r="4" fill="rgba(215,25,32,0.4)" />
      {/* Chutney cup */}
      <ellipse cx="162" cy="142" rx="16" ry="11"
               fill="rgba(79,122,60,0.5)" stroke="rgba(79,122,60,0.7)" strokeWidth="1" />
      <ellipse cx="162" cy="140" rx="13" ry="8" fill="rgba(79,122,60,0.6)" />
      {/* Spring roll */}
      <rect x="218" y="133" width="30" height="16" rx="8"
            fill="rgba(210,175,90,0.72)" stroke="rgba(190,155,70,0.8)" strokeWidth="1" />
      <rect x="220" y="135" width="26" height="12" rx="7" fill="rgba(232,198,112,0.62)" />
      <ellipse cx="218" cy="141" rx="4" ry="8" fill="rgba(190,155,70,0.8)" />
      <ellipse cx="248" cy="141" rx="4" ry="8" fill="rgba(190,155,70,0.8)" />
      {/* Herb garnish */}
      <path d="M 196,130 Q 200,122 206,128 Q 202,136 196,130 Z" fill="rgba(79,122,60,0.55)" />
      <path d="M 193,138 Q 198,130 204,136 Q 200,144 193,138 Z" fill="rgba(79,122,60,0.48)" />

      {/* ── FORK ── */}
      <line x1="98" y1="162" x2="98" y2="100"
            stroke="rgba(217,160,58,0.65)" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M98,100 Q98,85 93,80"
            stroke="rgba(217,160,58,0.65)" strokeWidth="4.5" strokeLinecap="round" fill="none" />
      <line x1="89" y1="80" x2="88" y2="60" stroke="rgba(217,160,58,0.65)" strokeWidth="2" strokeLinecap="round" />
      <line x1="92" y1="80" x2="91" y2="59" stroke="rgba(217,160,58,0.65)" strokeWidth="2" strokeLinecap="round" />
      <line x1="95" y1="80" x2="95" y2="58" stroke="rgba(217,160,58,0.65)" strokeWidth="2" strokeLinecap="round" />
      <line x1="98" y1="80" x2="99" y2="59" stroke="rgba(217,160,58,0.65)" strokeWidth="2" strokeLinecap="round" />

      {/* ── KNIFE ── */}
      <line x1="302" y1="162" x2="302" y2="100"
            stroke="rgba(217,160,58,0.65)" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M302,100 L302,62 L308,80 Z" fill="rgba(217,160,58,0.55)" />

      {/* Dots */}
      <circle cx="48"  cy="40"  r="3"   fill="rgba(217,160,58,0.35)" />
      <circle cx="358" cy="42"  r="2.5" fill="rgba(217,160,58,0.3)"  />
      <circle cx="365" cy="162" r="2"   fill="rgba(217,160,58,0.25)" />
      <circle cx="35"  cy="162" r="2"   fill="rgba(217,160,58,0.22)" />
    </>
  )
}

/* ─────────────────────────────── ITALIAN ─────────────────────────────── */
function ItalianArt() {
  return (
    <>
      <defs>
        <radialGradient id="ita-bg" cx="50%" cy="50%" r="70%">
          <stop offset="0%" stopColor="#FFF8EA" />
          <stop offset="100%" stopColor="#EDCF8A" stopOpacity="0.5" />
        </radialGradient>
      </defs>
      <rect width="400" height="200" fill="url(#ita-bg)" />

      {/* ── PLATE ── */}
      <ellipse cx="202" cy="172" rx="90" ry="12" fill="rgba(42,30,30,0.05)" />
      <circle cx="200" cy="118" r="90"
              fill="#F7EBD2" stroke="rgba(217,160,58,0.4)" strokeWidth="2" />
      <circle cx="200" cy="118" r="82"
              fill="none" stroke="rgba(217,160,58,0.2)" strokeWidth="1" />
      <circle cx="200" cy="118" r="78" fill="rgba(255,252,245,0.94)" />

      {/* ── PASTA STRANDS ── */}
      <path d="M 148,102 Q 162,90 176,103 Q 190,116 204,103 Q 218,90 232,103 Q 246,116 255,103"
            fill="none" stroke="rgba(200,155,65,0.85)" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M 145,113 Q 159,100 173,113 Q 187,126 201,113 Q 215,100 229,113 Q 243,126 256,113"
            fill="none" stroke="rgba(200,155,65,0.82)" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M 147,124 Q 161,111 175,124 Q 189,137 203,124 Q 217,111 231,124 Q 245,137 256,124"
            fill="none" stroke="rgba(200,155,65,0.80)" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M 150,135 Q 164,122 178,135 Q 192,148 206,135 Q 220,122 234,135 Q 248,148 255,138"
            fill="none" stroke="rgba(200,155,65,0.75)" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M 155,146 Q 169,133 183,146 Q 197,159 211,146 Q 225,133 239,146 Q 250,155 254,148"
            fill="none" stroke="rgba(200,155,65,0.65)" strokeWidth="3" strokeLinecap="round" />

      {/* Tomato sauce */}
      <circle cx="185" cy="110" r="9" fill="rgba(215,25,32,0.35)" />
      <circle cx="213" cy="130" r="7" fill="rgba(215,25,32,0.32)" />
      <circle cx="228" cy="108" r="6" fill="rgba(215,25,32,0.30)" />
      <circle cx="170" cy="130" r="5" fill="rgba(215,25,32,0.28)" />

      {/* Basil */}
      <path d="M 200,100 Q 208,90 218,98 Q 210,108 200,100 Z" fill="rgba(79,122,60,0.62)" />
      <path d="M 196,98 Q 188,88 198,82 Q 205,92 196,98 Z"   fill="rgba(79,122,60,0.54)" />

      {/* Parmesan dots */}
      <circle cx="175" cy="95"  r="1.5" fill="rgba(220,195,120,0.72)" />
      <circle cx="220" cy="145" r="1.5" fill="rgba(220,195,120,0.72)" />
      <circle cx="240" cy="100" r="1.2" fill="rgba(220,195,120,0.65)" />
      <circle cx="160" cy="148" r="1.2" fill="rgba(220,195,120,0.60)" />

      {/* ── FORK (right, lifting pasta) ── */}
      <line x1="312" y1="180" x2="296" y2="115"
            stroke="rgba(217,160,58,0.65)" strokeWidth="5" strokeLinecap="round" />
      <path d="M296,115 Q294,100 290,88"
            stroke="rgba(217,160,58,0.65)" strokeWidth="5" strokeLinecap="round" fill="none" />
      <line x1="286" y1="88" x2="283" y2="70" stroke="rgba(217,160,58,0.65)" strokeWidth="2" strokeLinecap="round" />
      <line x1="289" y1="88" x2="287" y2="69" stroke="rgba(217,160,58,0.65)" strokeWidth="2" strokeLinecap="round" />
      <line x1="292" y1="88" x2="291" y2="69" stroke="rgba(217,160,58,0.65)" strokeWidth="2" strokeLinecap="round" />
      <line x1="295" y1="88" x2="295" y2="70" stroke="rgba(217,160,58,0.65)" strokeWidth="2" strokeLinecap="round" />
      {/* pasta on fork */}
      <path d="M 288,75 Q 295,68 300,78 Q 306,88 312,80"
            fill="none" stroke="rgba(200,155,65,0.72)" strokeWidth="3" strokeLinecap="round" />

      {/* ── TOMATO HALF (left decoration) ── */}
      <path d="M 40,115 A 30,22 0 0,1 100,115 Z"
            fill="rgba(215,25,32,0.45)" stroke="rgba(180,20,20,0.5)" strokeWidth="1" />
      <path d="M 70,93 A 30,22 0 0,0 40,115 A 30,22 0 0,0 100,115 A 30,22 0 0,0 70,93 Z"
            fill="rgba(215,25,32,0.38)" />
      <line x1="70" y1="93" x2="55" y2="115" stroke="rgba(255,200,180,0.5)" strokeWidth="0.8" />
      <line x1="70" y1="93" x2="70" y2="115" stroke="rgba(255,200,180,0.5)" strokeWidth="0.8" />
      <line x1="70" y1="93" x2="85" y2="115" stroke="rgba(255,200,180,0.5)" strokeWidth="0.8" />

      <circle cx="42"  cy="42"  r="3"   fill="rgba(217,160,58,0.35)" />
      <circle cx="358" cy="45"  r="2.5" fill="rgba(217,160,58,0.3)"  />
      <circle cx="370" cy="165" r="2"   fill="rgba(217,160,58,0.25)" />
      <circle cx="32"  cy="168" r="2"   fill="rgba(217,160,58,0.22)" />
    </>
  )
}

/* ─────────────────────────────── DESSERTS ─────────────────────────────── */
function DessertsArt() {
  const cocoaDots = Array.from({ length: 20 }, (_, i) => ({
    cx: 158 + (i % 9) * 10 + (i >= 9 ? 5 : 0),
    cy: 68 + Math.floor(i / 9) * 10,
    r:  1 + (i % 3) * 0.5,
    o:  0.28 + (i % 3) * 0.12,
  }))

  return (
    <>
      <defs>
        <radialGradient id="des-bg" cx="50%" cy="45%" r="70%">
          <stop offset="0%" stopColor="#FFF8EA" />
          <stop offset="100%" stopColor="#EDCF8A" stopOpacity="0.5" />
        </radialGradient>
      </defs>
      <rect width="400" height="200" fill="url(#des-bg)" />

      {/* ── TIRAMISU SLICE ── */}
      <ellipse cx="202" cy="175" rx="55" ry="8" fill="rgba(42,30,30,0.07)" />
      {/* outer frame */}
      <rect x="155" y="65" width="90" height="108" rx="3"
            fill="#FFF8EA" stroke="rgba(217,160,58,0.4)" strokeWidth="1.5" />
      {/* layer 4 – bottom ladyfinger */}
      <rect x="155" y="147" width="90" height="26" fill="#8B7040" />
      <rect x="157" y="149" width="86" height="22" fill="#A08048" />
      <line x1="175" y1="149" x2="175" y2="171" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
      <line x1="190" y1="149" x2="190" y2="171" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
      <line x1="205" y1="149" x2="205" y2="171" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
      <line x1="220" y1="149" x2="220" y2="171" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
      {/* layer 3 – mascarpone */}
      <rect x="155" y="118" width="90" height="29" fill="#F5E6CE" />
      {/* layer 2 – espresso ladyfinger */}
      <rect x="155" y="88" width="90" height="30" fill="#8B7040" />
      <rect x="157" y="90" width="86" height="26" fill="#A08048" />
      <line x1="175" y1="90" x2="175" y2="116" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
      <line x1="190" y1="90" x2="190" y2="116" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
      <line x1="205" y1="90" x2="205" y2="116" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
      <line x1="220" y1="90" x2="220" y2="116" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
      {/* layer 1 – top cream */}
      <rect x="155" y="65" width="90" height="23" fill="#F5E6CE" />
      {/* cocoa dust */}
      {cocoaDots.map((d, i) => (
        <circle key={i} cx={d.cx} cy={d.cy} r={d.r} fill={`rgba(91,74,68,${d.o})`} />
      ))}
      {/* cream swirl */}
      <path d="M 200,60 Q 215,52 228,60 Q 232,66 224,70 Q 216,72 210,66 Q 204,58 210,55 Q 218,52 224,56"
            fill="none" stroke="rgba(245,230,206,0.95)" strokeWidth="4" strokeLinecap="round" />

      {/* Caramel drizzle – left side */}
      <path d="M 155,75 Q 148,82 150,92"  stroke="#D9A03A" strokeWidth="2"   strokeLinecap="round" fill="none" />
      <path d="M 155,95 Q 147,102 150,112" stroke="#D9A03A" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <path d="M 155,115 Q 148,122 151,130" stroke="#D9A03A" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <circle cx="150" cy="92"  r="3"   fill="rgba(217,160,58,0.62)" />
      <circle cx="150" cy="112" r="2.5" fill="rgba(217,160,58,0.55)" />
      <circle cx="151" cy="130" r="2"   fill="rgba(217,160,58,0.5)"  />
      {/* right side */}
      <path d="M 245,80 Q 252,88 250,98"    stroke="#D9A03A" strokeWidth="2"   strokeLinecap="round" fill="none" />
      <path d="M 245,105 Q 253,112 251,120" stroke="#D9A03A" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <circle cx="250" cy="98"  r="2.5" fill="rgba(217,160,58,0.55)" />
      <circle cx="251" cy="120" r="2"   fill="rgba(217,160,58,0.5)"  />

      {/* ── COFFEE CUP ── */}
      <path d="M 58,126 Q 56,156 72,158 Q 88,156 86,126 Z"
            fill="#F7EBD2" stroke="rgba(217,160,58,0.5)" strokeWidth="1.2" />
      <path d="M 86,133 Q 98,133 98,144 Q 98,155 86,153"
            fill="none" stroke="rgba(217,160,58,0.5)" strokeWidth="1.5" />
      <ellipse cx="72" cy="126" rx="14" ry="5"  fill="rgba(91,74,68,0.55)" />
      <ellipse cx="72" cy="125" rx="12" ry="4"  fill="rgba(80,60,50,0.68)" />
      <ellipse cx="72" cy="160" rx="22" ry="5"
               fill="#F7EBD2" stroke="rgba(217,160,58,0.45)" strokeWidth="1" />

      {/* 4-pointed gold stars */}
      <path d="M290,48 L292,42 L294,48 L300,50 L294,52 L292,58 L290,52 L284,50 Z"
            fill="rgba(217,160,58,0.52)" />
      <path d="M340,80 L341.5,75 L343,80 L348,81.5 L343,83 L341.5,88 L340,83 L335,81.5 Z"
            fill="rgba(217,160,58,0.46)" />
      <path d="M 55,70 L 56.5,65 L 58,70 L 63,71.5 L 58,73 L 56.5,78 L 55,73 L 50,71.5 Z"
            fill="rgba(217,160,58,0.42)" />
      <path d="M350,155 L351,151 L352,155 L356,156 L352,157 L351,161 L350,157 L346,156 Z"
            fill="rgba(217,160,58,0.40)" />

      <circle cx="38"  cy="38"  r="3"   fill="rgba(217,160,58,0.35)" />
      <circle cx="368" cy="42"  r="2.5" fill="rgba(217,160,58,0.3)"  />
      <circle cx="375" cy="168" r="2"   fill="rgba(217,160,58,0.25)" />
    </>
  )
}
