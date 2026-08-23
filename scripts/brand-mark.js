/**
 * The brand mark, defined once as geometry.
 *
 * The mark is a thick ring open to the east, with three detached blades
 * filling the opening — so every part of it is an annular sector between two
 * angles. Describing it that way (rather than as a hand-tuned path string) is
 * what lets the same definition produce the SVG the app renders and the PNG
 * raster set the browser and the OS need: `pathData()` walks the sectors into
 * arcs, `rasterize()` walks them into pixels.
 *
 * Angles are degrees, 0 = east, increasing clockwise on screen (SVG's y-down
 * convention), so a sector reads the way it looks. Radii are fractions of the
 * mark's outer radius.
 */

/** The C's own sector: the long way round, through west. */
const C_START = 55;
const C_END = 305;
/** Everything shares one inner radius, so the band is one width throughout. */
const INNER = 0.585;
const BLADES = 3;
/** Gap between the C's ends and the blades, and between the blades. */
const BASE_GAP = 8;

const OPENING = 360 - (C_END - C_START);
const rad = (deg) => (deg * Math.PI) / 180;

/**
 * The four sectors as [start, end, inner].
 *
 * The opening the C leaves is divided evenly — three identical blades and
 * four identical gaps — so the blades read as equal and equally spaced from
 * the C's two ends. Widening `gap` narrows the blades to match; it never
 * moves the C or the outline of the mark.
 */
function sectors(gap = BASE_GAP) {
  const width = (OPENING - (BLADES + 1) * gap) / BLADES;
  const out = [[C_START, C_END, INNER]];
  for (let i = 0; i < BLADES; i++) {
    const start = C_END + gap + i * (width + gap);
    out.push([start, start + width, INNER]);
  }
  return out;
}

/**
 * How wide the gaps have to be at this rendered radius.
 *
 * A gap is an angle, so it shrinks to nothing in absolute terms as the mark
 * gets smaller — at 16px the design's 8 degrees is under one pixel of arc and
 * the blades smear into the C. Below roughly 48px the gaps therefore open up
 * until they are worth about `MIN_GAP_PX` of arc at the band's mid-radius.
 * This is optical sizing, not a different logo: the silhouette is unchanged.
 */
const MIN_GAP_PX = 2.2;
const MAX_GAP = 17;
function gapFor(radiusPx) {
  const midRadius = radiusPx * ((1 + INNER) / 2);
  const needed = ((MIN_GAP_PX / midRadius) * 180) / Math.PI;
  return Math.min(MAX_GAP, Math.max(BASE_GAP, needed));
}

/* ------------------------------------------------------------ vector ---- */

/**
 * SVG path data for the whole mark, as one `fill-rule: nonzero` path.
 * @param cx,cy centre; @param R outer radius; @param dp decimal places
 */
function pathData(cx, cy, R, dp = 3, gap = BASE_GAP) {
  return pathList(cx, cy, R, dp, gap).join(' ');
}

/** The same geometry as one path per sector, for the icon registry. */
function pathList(cx, cy, R, dp = 3, gap = BASE_GAP) {
  const n = (v) => Number(v.toFixed(dp));
  const pt = (a, r) => `${n(cx + R * r * Math.cos(rad(a)))} ${n(cy + R * r * Math.sin(rad(a)))}`;

  return sectors(gap).map(([a1, a2, ri]) => {
    const large = a2 - a1 > 180 ? 1 : 0;
    const ro = n(R);
    const rin = n(R * ri);
    return [
      `M${pt(a1, 1)}`,
      `A${ro} ${ro} 0 ${large} 1 ${pt(a2, 1)}`,
      `L${pt(a2, ri)}`,
      `A${rin} ${rin} 0 ${large} 0 ${pt(a1, ri)}`,
      'Z',
    ].join(' ');
  });
}

/* ------------------------------------------------------------ raster ---- */

/**
 * True when the point (unit-radius polar space, centre at origin) is ink.
 *
 * `grow` dilates the shape by that much in radius units — outwards, inwards
 * and sideways — which is how the outline is drawn: rasterise once grown for
 * the halo, once plain for the mark.
 */
function covers(x, y, list, grow = 0) {
  const d = Math.hypot(x, y);
  if (d > 1 + grow) return false;
  let a = (Math.atan2(y, x) * 180) / Math.PI;
  if (a < 0) a += 360;
  for (const [a1, a2, ri] of list) {
    if (d < ri - grow) continue;
    // Widen the sector by the arc `grow` subtends at this radius, so the halo
    // is the same thickness on a sector's flat ends as on its arcs.
    const slack = d > 0 ? ((grow / d) * 180) / Math.PI : 180;
    // Sectors may run past 360 (the blades straddle east); test the angle at
    // both a and a+360 so the wrap needs no special case.
    for (const t of [a, a + 360]) {
      if (t >= a1 - slack && t <= a2 + slack) return true;
    }
  }
  return false;
}

/**
 * Anti-aliased RGBA raster of the mark.
 *
 * @param size     square edge in px
 * @param ink      [r,g,b] of the mark
 * @param bg       [r,g,b] to fill behind it, or null for transparent
 * @param inset    fraction of the edge left empty around the mark (0 = bleed)
 * @param outline  [r,g,b] halo drawn behind the mark, or null for none
 * @param samples  supersampling factor per axis
 */
const MIN_HALO_SIZE = 24;
function rasterize(size, ink, bg, inset = 0, { outline = null, samples = 4 } = {}) {
  const out = Buffer.alloc(size * size * 4);
  /* The halo has to stay inside the canvas, so it eats into the inset — and
     below ~24px a one-pixel halo is a third of the band's width, which closes
     the gaps it was meant to open. Small entries go without; the SVG favicon,
     which flips colour by scheme, is what carries those sizes in practice. */
  const halo = outline && size >= MIN_HALO_SIZE ? Math.max(1, size * 0.02) : 0;
  const R = (size / 2) * (1 - 2 * inset) - halo;
  const c = size / 2;
  const step = 1 / samples;
  const total = samples * samples;
  const list = sectors(gapFor(R));
  const grow = halo / R;

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let hits = 0;
      let haloHits = 0;
      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const x = (px + (sx + 0.5) * step - c) / R;
          const y = (py + (sy + 0.5) * step - c) / R;
          if (covers(x, y, list)) hits++;
          else if (halo && covers(x, y, list, grow)) haloHits++;
        }
      }
      const a = hits / total;
      const h = halo ? (hits + haloHits) / total : 0;
      const i = (py * size + px) * 4;

      // Paint back to front: plate, then halo, then mark.
      let px3 = bg ? bg.slice() : [ink[0], ink[1], ink[2]];
      let alpha = bg ? 1 : 0;
      if (halo) {
        px3 = px3.map((v, k) => outline[k] * h + v * (1 - h));
        alpha = h + alpha * (1 - h);
      }
      px3 = px3.map((v, k) => ink[k] * a + v * (1 - a));
      alpha = a + alpha * (1 - a);

      for (let k = 0; k < 3; k++) out[i + k] = Math.round(px3[k]);
      out[i + 3] = Math.round(alpha * 255);
    }
  }
  return out;
}

module.exports = { sectors, gapFor, pathData, pathList, covers, rasterize, BASE_GAP };
