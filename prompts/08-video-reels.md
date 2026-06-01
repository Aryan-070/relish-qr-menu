# Relish — Video Reels
> IDs: `vid-001` through `vid-006`
> Reference `00-style-guide.md` for BASE STYLE, colour palette, and negative prompts.

6 videos total — 1 full-screen landing hero + 5 category ambient loops.
All vertical 9:16 portrait. No reference images — every prompt is fully self-contained.

---

## vid-001 · Classic Landing Hero

```
### Classic Landing Hero
File: public/assets/hero-reel.mp4
Model: veo-3.1-generate-preview | Aspect: 9:16 | Duration: 8s | Resolution: 4K | FPS: 24
Usage: LandingCover.tsx — set HERO_VIDEO_SRC = '/assets/hero-reel.mp4'

SILENT SCENE — no dialogue, no speech, no voices.

[BASE STYLE — see 00-style-guide.md]

[00:00-00:02]
A dark walnut table surface fills the vertical 9:16 frame. A single white ceramic bowl
with a thin maroon-gold rim line sits centred in deep chiaroscuro — 80% of the frame
is in near-black shadow, a narrow shaft of warm amber-gold window light enters from
the upper-left at a 35-degree angle, illuminating only the bowl rim and the still golden
broth surface inside. Tiny wisps of steam rise from the soup in slow organic curls,
each wisp catching the amber light before dissolving into shadow. Camera opens at
60 cm overhead, perfectly still.

[00:02-00:05]
Camera begins a very slow macro dolly push-in toward the bowl — 10% zoom over 3 seconds,
barely perceptible. A ceramic ladle enters frame from the upper-left in extreme slow
motion (128 fps tempo played at 24 fps). Honey-coloured broth pours from the ladle in
a single viscous arc that catches the amber window light, hitting the bowl surface and
creating tiny golden concentric ripples that expand and fade. The pour lasts 2 seconds.
Camera holds steady during the pour.

[00:05-00:08]
Camera tilts 15 degrees down-left and pulls back 20% to reveal a wider editorial
composition — the soup bowl at centre-left, and the right side of frame shows a second
white plate bearing handmade pasta with a deep maroon tomato sauce at f/5.6 soft focus.
Final frame: two plates visible, amber shaft of light cutting diagonally across both,
heavy dramatic shadow surrounding. Slow hold to end.

Cinematography: Overhead macro push-in dolly → slow tilt-and-pullback reveal. 85 mm
equivalent, f/2.0 opening to f/2.8 during pullback. Extremely shallow depth of field.
Lighting: Single Rembrandt source, 3200 K, high contrast ratio 8:1, narrow slit-light
quality. Warm amber-gold shaft from upper-left.
Film look: ARRI ALEXA Log-C colour science. Subtle halation blooming on specular soup
surface highlights. 35 mm film grain overlay at 15% opacity.
Colours: background #0B0305 near-black, shadow #2A1E1E, table surface #3E1A04 warm
brown, soup highlight #D9A03A gold, sauce accent #8B1024 maroon, cream rim #FFF8EA.

SFX: Faint ambient restaurant hum — distant murmur of a dining room, barely perceptible.
No music. No cutlery sounds. Only the subtle breath of the space.

Negative: bright backgrounds, white tablecloths, flat lighting, daylight, people, hands,
text, watermark, grey tones, blue tones, cool white balance, kitchen environment,
utensils entering frame other than the ladle, modern or sterile look
```

---

## vid-002 · Beverages Ambient Loop

```
### Beverages Ambient Loop
File: public/assets/cat-beverages.mp4
Model: veo-3.1-fast-generate-preview | Aspect: 9:16 | Duration: 6s | Resolution: 4K | FPS: 24
Usage: CategoryPage.tsx — replaces BubblesAnim for the beverages category header background

SILENT SCENE — no dialogue, no speech, no voices.

[BASE STYLE — see 00-style-guide.md]

Close macro shot. A tall clear highball glass centred in the 9:16 frame, filling
approximately 65% of the frame height. Inside the glass: a golden iced beverage —
honey-amber colour (#D9A03A warmth), abundant ice cubes stacked inside.

Carbonation bubbles: continuous streams of tiny bubbles rise from the bottom of the
glass to the surface in organic clusters — some fast, some slow, varying paths, never
repeating. The bubble motion is the primary visual rhythm.

Condensation: the glass exterior is covered in heavy condensation — a fine network of
tiny water droplets clings to the outer glass surface. Two larger droplets slowly slide
downward during the 6 seconds, leaving faint trails.

Garnish: a thin lime wheel rests against the inside of the glass at mid-height, barely
moving. A small sprig of fresh mint floats at the surface, imperceptibly swaying with
microscopic ripples.

Camera: completely locked, zero movement. Pure subject animation.
Backlit from behind the glass — warm amber-gold backlight (#C8A832 warmth) creates a
glowing beverage with light shafting through the liquid. Side key light from upper-left
(#FFF8EA cream quality) illuminates the condensation droplets.
Depth of field: sharp on the glass condensation and bubbles, soft-focus cream #FFF8EA
background. 85 mm equivalent, f/2.4.

Seamless loop: bubble streams and condensation drip cycle naturally back to start at 6s.

SFX: Subtle carbonation fizz — fine effervescence, barely audible. No voices, no music,
no clinking ice.

Negative: people, hands, text, fast movement, camera motion, dark backgrounds, grey or
blue tones, non-beverage food items, alcohol, abstract graphics
```

---

## vid-003 · Soups Ambient Loop

```
### Soups Ambient Loop
File: public/assets/cat-soups.mp4
Model: veo-3.1-fast-generate-preview | Aspect: 9:16 | Duration: 6s | Resolution: 4K | FPS: 24
Usage: CategoryPage.tsx — replaces SteamAnim for the soups category header background

SILENT SCENE — no dialogue, no speech, no voices.

[BASE STYLE — see 00-style-guide.md]

Perfectly overhead aerial view of a white ceramic bowl with a maroon-gold rim, centred
in the 9:16 frame on cream linen (#FFF8EA). The bowl is filled with a rich golden
saffron broth — the surface is calm, slightly reflective, warm amber. Nothing else in
frame — no pasta, no bread, no other food. Broth only.

Steam: three independent wisps rise from the broth surface — one from the left-centre,
one from the right-centre, one from the bowl's rear. Each wisp is thin, translucent,
cream-white (#FFF8EA) against the warm amber broth. The wisps sway gently as if a
breath of air passes — left-right oscillation at a 2–3 second frequency. Steam is the
only motion for the first 3 seconds.

At 3 seconds: a small ceramic pitcher enters frame from the top edge and pours a thin
stream of white cream. The cream lands at the bowl's centre and begins spreading in a
slow, languid clockwise swirl. The swirl turns over the remaining 3 seconds.

Camera: locked directly overhead, zero movement.
Lighting: warm single window source from upper-left, 3200 K, soft shadows on bowl rim.
Bowl surface glows warmly with broth reflections.
Colours: #D9A03A amber broth, #FFF8EA steam and linen, #8B1024 maroon bowl rim.

Seamless loop: steam wisps and swirl return naturally to start at 6s.

SFX: Gentle ambient kitchen warmth — distant soft hum of a warm kitchen, barely audible.
No voices, no clinking, no music.

Negative: people, hands, text, camera movement, cold tones, artificial light, pasta,
noodles, rice, bread, vegetables, meat, non-soup food of any kind
```

---

## vid-004 · QuickBites Ambient Loop

```
### QuickBites Ambient Loop
File: public/assets/cat-quickbites.mp4
Model: veo-3.1-fast-generate-preview | Aspect: 9:16 | Duration: 6s | Resolution: 4K | FPS: 24
Usage: CategoryPage.tsx — replaces PlateAnim for the quickbites category header background
Note: PlateAnim shows expanding concentric gold circles — the video echoes this circular energy

SILENT SCENE — no dialogue, no speech, no voices.

[BASE STYLE — see 00-style-guide.md]

45-degree elevated angle view of a white ceramic plate on cream linen (#FFF8EA), centred
in the 9:16 frame. The plate holds two golden falafel balls — spherical, dark-golden
exterior with a slightly crisp, textured surface visible under warm window light.

Drizzle sequence: from the moment the video opens, a thin stream of pale tahini-sesame
sauce begins pouring from a ceramic spoon that enters frame from the upper-right. The
sauce is honey-cream coloured (#EDD99A), catching the warm light. The drizzle falls in
slow motion — the arc hangs briefly before landing on the falafel surface and rolling
down in a slow, viscous curve. As the drizzle pools on the plate, a tiny circular ripple
expands outward — referencing the circular energy of the concentric-ring animation it
replaces. The pool spreads in a ring.

At 3 seconds: the ceramic spoon exits frame from upper-right. A few sesame seeds detach
from the falafel crust and roll gently across the plate surface.

At 4.5 seconds: fine steam wisps begin rising from the hot falafel.

Final frame: falafel with a complete tahini drizzle swirl pattern, steam rising.
Loopable cut back to opening.

Camera: 45-degree elevated angle, locked. 85 mm equivalent, f/2.8 — plate edge sharp,
background linen softly bokeh'd.
Lighting: warm window light from upper-left, 3200 K, casting a long soft shadow from
the falafel across the plate surface.
Colours: #EDD99A tahini honey-cream, #D9A03A gold highlights, #FFF8EA linen surface,
golden-brown falafel crust.

Seamless loop: drizzle arc cycles naturally back to start at 6s.

SFX: Near-silent — barely audible sizzle from the warm falafel, almost subliminal.
No voices, no music, no kitchen noise.

Negative: people, text, camera movement, dark backgrounds, grey tones, meat, seafood,
non-vegetarian food, burgers, sandwiches, pizza — quickbites only
```

---

## vid-005 · Italian Ambient Loop

```
### Italian Ambient Loop
File: public/assets/cat-italian.mp4
Model: veo-3.1-fast-generate-preview | Aspect: 9:16 | Duration: 6s | Resolution: 4K | FPS: 24
Usage: CategoryPage.tsx — replaces SwirlAnim for the italian category header background
Note: SwirlAnim shows a gold clockwise spiral — the video echoes this swirling energy

SILENT SCENE — no dialogue, no speech, no voices.

[BASE STYLE — see 00-style-guide.md]

Overhead 90-degree locked view of a wide shallow bowl on a warm walnut-brown surface
(#3E1A04). The bowl holds a generous portion of spaghetti in a deep maroon tomato sauce
(#8B1024). Pasta strands are glossy with sauce, a light olive oil sheen creating gold
highlights (#D9A03A) across the surface.

The scene is completely still for the first 1.5 seconds — only the faintest heat shimmer
visible above the bowl surface.

At 1.5 seconds: the sauce begins simmering gently. Tiny circular bubbles form at various
points across the sauce surface, rise slowly, and pop — each one sending a tiny ripple
outward. Bubble frequency is low and irregular — never more than 3 bubbles at a time.
Fine steam wisps rise with the bubbles.

At 3 seconds: a wooden ladle enters frame from the top edge and makes a single slow,
deliberate clockwise sweep through the pasta — one full turn, pulling sauce and pasta
strands into a spiral pattern. The motion is slow, a 2-second sweep. The ladle exits
frame. The swirl pattern in the pasta gradually settles.

Final frame: pasta swirl mid-settling, sauce still gently bubbling at edges.
Seamlessly loopable.

Camera: perfectly overhead, locked, zero movement. 85 mm equivalent, f/5.6 — all in
sharp focus throughout.
Lighting: warm window light from upper-left, 3200 K, creating a warm gloss sheen on the
sauce surface.
Colours: #8B1024 deep maroon sauce, #D9A03A olive oil gold sheen, #FFF8EA steam wisps,
#3E1A04 warm walnut surface.

Seamless loop: sauce motion and swirl cycle naturally back to start at 6s.

SFX: Soft, gentle simmer — the quiet bubble-pop of a slowly simmering sauce, barely
audible. No voices, no music, no kitchen clatter.

Negative: people, text, camera movement, cold tones, blue-grey lighting, pizza, risotto,
non-Italian food, meat, seafood, non-vegetarian ingredients
```

---

## vid-006 · Desserts Ambient Loop

```
### Desserts Ambient Loop
File: public/assets/cat-desserts.mp4
Model: veo-3.1-fast-generate-preview | Aspect: 9:16 | Duration: 6s | Resolution: 4K | FPS: 24
Usage: CategoryPage.tsx — replaces DrizzleAnim for the desserts category header background
Note: DrizzleAnim shows a gold drizzle line falling — the video is this animation brought to life

SILENT SCENE — no dialogue, no speech, no voices.

[BASE STYLE — see 00-style-guide.md]

Close macro overhead view of a white ceramic ramekin on cream linen (#FFF8EA), centred
in the 9:16 frame. Inside the ramekin: dark chocolate mousse — deep brown, nearly black
surface with a matte velvety texture. The scene is still for the first 1 second — only
a hint of steam visible.

At 1 second: a thin golden stream of salted caramel (#D9A03A, viscous, slightly opaque)
begins pouring from directly above, entering frame from the top edge. The caramel arc
lands on the mousse centre in extreme slow motion — the impact creates a tiny crown
splash in golden liquid, each micro-droplet hanging momentarily before falling back.
The pour lasts 2.5 seconds.

The caramel pools on the mousse surface, spreading slowly from centre outward in a
circular pool of liquid gold. As the pool spreads it catches the warm window light and
glints with a warm metallic gold shimmer.

At 4.5 seconds: a thin line of caramel drips over the ramekin rim and runs down the
white ceramic exterior in a single slow, viscous drip — echoing the falling drizzle line
of the animation it replaces. The drip hangs at the bottom of the ramekin.

Final frame: caramel-pooled mousse surface glowing gold, one caramel drip still running
down the ramekin exterior. Loopable cut back to opening.

Camera: overhead 90-degree, macro, locked. 85 mm equivalent, f/4.0 — sharp throughout.
Lighting: warm window light from upper-left, 3200 K, creating a strong gold specular
highlight on the caramel surface and deep shadow inside the ramekin where mousse texture
is deepest.
Colours: near-black mousse #1A0B0B, #D9A03A gold caramel, #FFF8EA linen surface,
white ramekin exterior.

Seamless loop: caramel motion cycles naturally back to start at 6s.

SFX: Faint caramel drip — a barely audible viscous liquid sound as the caramel pools,
almost subliminal. No voices, no music.

Negative: people, text, camera movement, cold tones, blue-grey, non-dessert food,
savoury items, pasta, soup, pizza, anything that is not a dessert
```
