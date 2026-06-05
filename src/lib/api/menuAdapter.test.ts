import { describe, it, expect } from 'vitest'
import { adaptPublicMenu } from './menuAdapter'
import type { PublicMenuResponse } from './publicMenu'

function res(items: Partial<PublicMenuResponse['categories'][number]['items'][number]>[]): PublicMenuResponse {
  return {
    available: true,
    categories: [
      {
        id: 'c1',
        code: 'mains',
        name: 'Mains',
        sort_order: 1,
        items: items.map((i, idx) => ({
          id: i.id ?? `i${idx}`,
          code: i.code ?? `code${idx}`,
          name: i.name ?? 'Item',
          price_minor: i.price_minor ?? 12000,
          available: i.available ?? true,
          sold_out: i.sold_out ?? false,
          ...i,
        })),
      },
    ],
  }
}

describe('adaptPublicMenu', () => {
  it('maps paise → rupees, image_url → imageUrl, and description/dietary', () => {
    const [cat] = adaptPublicMenu(
      res([
        {
          name: 'Paneer Tikka',
          price_minor: 24050,
          image_url: 'https://cdn.test/paneer.jpg',
          description: 'Charred cottage cheese',
          is_jain: true,
          spice_level: 2,
          chefs_special: true,
          tags: ['popular'],
        },
      ]),
    )
    const item = cat.items[0]
    expect(item.price).toBe(241) // 24050 paise → ₹240.5 → rounded 241
    expect(item.imageUrl).toBe('https://cdn.test/paneer.jpg')
    expect(item.description).toBe('Charred cottage cheese')
    expect(item.isJain).toBe(true)
    expect(item.spiceLevel).toBe(2)
    expect(item.chefsSpecial).toBe(true)
    expect(item.tags).toContain('popular')
  })

  it('leaves imageUrl undefined when image_url is blank (manifest fallback)', () => {
    const [cat] = adaptPublicMenu(res([{ image_url: '' }]))
    expect(cat.items[0].imageUrl).toBeUndefined()
  })

  it('tags a sold-out / unavailable item and drops unavailable from the list', () => {
    const [cat] = adaptPublicMenu(
      res([
        { name: 'In stock', available: true },
        { name: 'Hidden', available: false },
      ]),
    )
    // Unavailable items are filtered out entirely.
    expect(cat.items).toHaveLength(1)
    expect(cat.items[0].name).toBe('In stock')
  })

  it('marks an available-but-sold-out item with a sold-out tag', () => {
    const [cat] = adaptPublicMenu(res([{ name: 'Last one', available: true, sold_out: true }]))
    expect(cat.items[0].tags).toContain('sold-out')
  })
})
