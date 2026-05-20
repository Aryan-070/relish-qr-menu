export interface MenuItem {
  id: string
  name: string
  price: number
  description: string
  isJain: boolean
  canBeJain: boolean
  tags: string[]
  pairings: { beverage?: string; side?: string; dessert?: string }
  customizations: string[]
}

export interface Category {
  id: string
  name: string
  description: string
  editorialNote: string
  backgroundAnimation: 'bubbles' | 'steam' | 'plate' | 'swirl' | 'drizzle' | 'none'
  items: MenuItem[]
}

export interface RecommendationPath {
  id: string
  name: string
  tagline: string
  itemIds: string[]
  estimatedPrice: number
  reason: string
  moodMatch: string[]
  partySizeMatch: string[]
  budgetMatch: string[]
}

export const categories: Category[] = [
  {
    id: 'beverages',
    name: 'Beverages',
    description: 'Refreshing drinks for every occasion',
    editorialNote: 'From garden-fresh coolers to indulgent blends — start your Relish journey with a sip.',
    backgroundAnimation: 'bubbles',
    items: [
      {
        id: 'bev-001',
        name: 'Fresh Lime Soda',
        price: 120,
        description: 'Hand-squeezed lime, fizzy water, a pinch of black salt. Served sweet, salted, or mixed.',
        isJain: true,
        canBeJain: false,
        tags: ['refreshing', 'summer', 'light'],
        pairings: { side: 'qb-002', dessert: 'des-003' },
        customizations: ['Sweet', 'Salted', 'Mixed', 'Extra lime'],
      },
      {
        id: 'bev-002',
        name: 'Masala Chai',
        price: 90,
        description: 'Our signature blend of Assam tea, fresh ginger, cardamom, and cinnamon. Served piping hot.',
        isJain: true,
        canBeJain: false,
        tags: ['warm', 'spiced', 'classic'],
        pairings: { side: 'qb-001', dessert: 'des-001' },
        customizations: ['Regular', 'Strong', 'Less sweet', 'Ginger extra'],
      },
      {
        id: 'bev-003',
        name: 'Cold Coffee',
        price: 160,
        description: 'Creamy blended coffee with a hint of chocolate. Topped with whipped cream.',
        isJain: false,
        canBeJain: false,
        tags: ['cold', 'indulgent', 'coffee'],
        pairings: { dessert: 'des-002' },
        customizations: ['Regular', 'Extra strong', 'Less sweet', 'No whip'],
      },
      {
        id: 'bev-004',
        name: 'Mango Lassi',
        price: 150,
        description: 'Thick Alphonso mango pulp blended with chilled yoghurt and a whisper of cardamom.',
        isJain: false,
        canBeJain: false,
        tags: ['fruity', 'thick', 'summer'],
        pairings: { side: 'ita-001', dessert: 'des-004' },
        customizations: ['Regular', 'Less sweet', 'Extra thick'],
      },
      {
        id: 'bev-005',
        name: 'Virgin Mojito',
        price: 170,
        description: 'Fresh mint, muddled lime, crushed ice, and sparkling water. Bright and effervescent.',
        isJain: true,
        canBeJain: false,
        tags: ['refreshing', 'minty', 'fizzy'],
        pairings: { side: 'qb-003', dessert: 'des-003' },
        customizations: ['Regular', 'Extra mint', 'Less sweet', 'Kala namak'],
      },
      {
        id: 'bev-006',
        name: 'Watermelon Cooler',
        price: 140,
        description: 'Fresh watermelon blended with rose water and a squeeze of lemon. Seasonal and stunning.',
        isJain: true,
        canBeJain: false,
        tags: ['fruity', 'seasonal', 'light'],
        pairings: { side: 'qb-002' },
        customizations: ['Regular', 'Extra rose', 'No ice'],
      },
    ],
  },
  {
    id: 'soups',
    name: 'Soups',
    description: 'Warm your soul with every bowl',
    editorialNote: 'Slow-simmered, herb-finished, and generously portioned — each bowl is a story of comfort.',
    backgroundAnimation: 'steam',
    items: [
      {
        id: 'soup-001',
        name: 'Tomato Basil Bisque',
        price: 180,
        description: 'Roasted vine tomatoes, garden basil, cream swirl, and crispy croutons. A Relish classic.',
        isJain: false,
        canBeJain: true,
        tags: ['classic', 'comfort', 'creamy'],
        pairings: { side: 'qb-001', dessert: 'des-001' },
        customizations: ['Regular', 'Jain (no cream)', 'Extra croutons', 'Less spicy'],
      },
      {
        id: 'soup-002',
        name: 'Sweet Corn Soup',
        price: 160,
        description: 'Silky corn broth with capsicum julienne, noodle wisps, and a drizzle of soy. Indo-Chinese soul.',
        isJain: false,
        canBeJain: false,
        tags: ['mild', 'indo-chinese', 'light'],
        pairings: { side: 'qb-003', dessert: 'des-003' },
        customizations: ['Regular', 'Less cornstarch', 'Extra veg', 'Spicy'],
      },
      {
        id: 'soup-003',
        name: 'Hot & Sour Soup',
        price: 160,
        description: 'Punchy vinegar broth, tofu strips, mushrooms, and chilli oil. For the bold.',
        isJain: false,
        canBeJain: false,
        tags: ['spicy', 'tangy', 'indo-chinese'],
        pairings: { side: 'qb-004', dessert: 'des-003' },
        customizations: ['Regular', 'Less spicy', 'No tofu', 'Extra sour'],
      },
      {
        id: 'soup-004',
        name: 'Minestrone',
        price: 200,
        description: 'Italian garden vegetable soup with cannellini beans, pasta, and a Parmesan rind broth.',
        isJain: false,
        canBeJain: true,
        tags: ['Italian', 'hearty', 'filling'],
        pairings: { side: 'ita-003', dessert: 'des-001' },
        customizations: ['Regular', 'Jain (no cheese)', 'Extra pasta', 'Gluten-free pasta'],
      },
      {
        id: 'soup-005',
        name: 'Cream of Mushroom',
        price: 210,
        description: 'Wild mushroom medley, truffle oil finish, and toasted sourdough on the side.',
        isJain: false,
        canBeJain: true,
        tags: ['creamy', 'earthy', 'premium'],
        pairings: { side: 'ita-002', dessert: 'des-002' },
        customizations: ['Regular', 'Jain (no dairy)', 'Extra truffle', 'Less cream'],
      },
    ],
  },
  {
    id: 'quickbites',
    name: 'Quick Bites',
    description: 'Small bites, big flavours',
    editorialNote: 'Perfect starters and shareable plates — ideal for the whole table to dig in.',
    backgroundAnimation: 'plate',
    items: [
      {
        id: 'qb-001',
        name: 'Veg Platter',
        price: 350,
        description: 'A grand sharing board: paneer tikka, hara bhara kebab, mushroom crostini, and dips.',
        isJain: false,
        canBeJain: true,
        tags: ['sharing', 'variety', 'popular'],
        pairings: { beverage: 'bev-001', dessert: 'des-004' },
        customizations: ['Regular', 'Jain version', 'Extra dips', 'No onion/garlic'],
      },
      {
        id: 'qb-002',
        name: 'Loaded Nachos',
        price: 280,
        description: 'Crispy corn chips, sour cream, jalapeños, salsa, and molten cheese sauce.',
        isJain: false,
        canBeJain: false,
        tags: ['Mexican', 'shareable', 'cheesy'],
        pairings: { beverage: 'bev-005', dessert: 'des-003' },
        customizations: ['Regular', 'Extra jalapeños', 'No jalapeños', 'Extra cheese'],
      },
      {
        id: 'qb-003',
        name: 'Spring Rolls',
        price: 200,
        description: 'Crispy rice paper rolls stuffed with glass noodles, vegetables, and served with plum sauce.',
        isJain: true,
        canBeJain: false,
        tags: ['crispy', 'asian', 'light'],
        pairings: { beverage: 'bev-006', dessert: 'des-003' },
        customizations: ['Regular', 'Extra sauce', 'Steamed'],
      },
      {
        id: 'qb-004',
        name: 'Cheesy Garlic Bread',
        price: 180,
        description: 'Thick-cut sourdough, roasted garlic butter, and a generous mozarella melt.',
        isJain: false,
        canBeJain: false,
        tags: ['Italian', 'cheesy', 'comfort'],
        pairings: { beverage: 'bev-002', dessert: 'des-001' },
        customizations: ['Regular', 'Extra cheese', 'No garlic', 'Gluten-free bread'],
      },
      {
        id: 'qb-005',
        name: 'Paneer Tikka',
        price: 260,
        description: 'Marinated cottage cheese grilled in the tandoor. Served with green chutney and onion rings.',
        isJain: false,
        canBeJain: true,
        tags: ['Indian', 'tandoor', 'popular'],
        pairings: { beverage: 'bev-004', dessert: 'des-004' },
        customizations: ['Regular', 'Jain (no onion)', 'Extra chutney', 'Less spicy'],
      },
      {
        id: 'qb-006',
        name: 'Bruschetta Classica',
        price: 220,
        description: 'Grilled ciabatta rubbed with garlic, topped with diced tomato, basil, and extra virgin olive oil.',
        isJain: true,
        canBeJain: false,
        tags: ['Italian', 'fresh', 'light'],
        pairings: { beverage: 'bev-001', dessert: 'des-001' },
        customizations: ['Regular', 'Extra tomato', 'Add cheese'],
      },
    ],
  },
  {
    id: 'italian',
    name: 'Italian Fiesta',
    description: 'Pasta, pizza, and all things Italian',
    editorialNote: 'Handcrafted with imported semolina, slow-simmered sauces, and an obsessive love for Italian soul food.',
    backgroundAnimation: 'swirl',
    items: [
      {
        id: 'ita-001',
        name: 'Pasta Arrabbiata',
        price: 280,
        description: 'Penne tossed in a fiery San Marzano tomato sauce with garlic, red chilli, and fresh basil.',
        isJain: true,
        canBeJain: false,
        tags: ['spicy', 'Italian', 'classic'],
        pairings: { beverage: 'bev-001', dessert: 'des-001' },
        customizations: ['Regular', 'Less spicy', 'Extra sauce', 'Gluten-free pasta'],
      },
      {
        id: 'ita-002',
        name: 'Pasta Aglio e Olio',
        price: 260,
        description: 'Spaghetti with golden garlic, chilli flakes, parsley, and the finest Sicilian olive oil.',
        isJain: true,
        canBeJain: false,
        tags: ['simple', 'Italian', 'garlic'],
        pairings: { beverage: 'bev-003', dessert: 'des-002' },
        customizations: ['Regular', 'Extra garlic', 'Less spicy', 'Add cheese'],
      },
      {
        id: 'ita-003',
        name: 'Pesto Farfalle',
        price: 300,
        description: 'Bow-tie pasta tossed in vibrant house-made basil pesto, sun-dried tomatoes, and pine nuts.',
        isJain: false,
        canBeJain: false,
        tags: ['pesto', 'Italian', 'premium'],
        pairings: { beverage: 'bev-005', dessert: 'des-001' },
        customizations: ['Regular', 'Extra pesto', 'No pine nuts', 'Gluten-free pasta'],
      },
      {
        id: 'ita-004',
        name: 'Margherita Pizza',
        price: 320,
        description: 'Thin crispy base, San Marzano tomato sauce, fresh buffalo mozzarella, and basil. Simplicity elevated.',
        isJain: false,
        canBeJain: false,
        tags: ['pizza', 'classic', 'Italian'],
        pairings: { beverage: 'bev-001', dessert: 'des-003' },
        customizations: ['Thin crust', 'Thick crust', 'Extra cheese', 'Add jalapeños'],
      },
      {
        id: 'ita-005',
        name: 'Veg Lasagna',
        price: 360,
        description: 'Layers of fresh pasta, roasted vegetables, béchamel, and a golden cheese crust.',
        isJain: false,
        canBeJain: false,
        tags: ['comfort', 'filling', 'Italian'],
        pairings: { beverage: 'bev-003', dessert: 'des-002' },
        customizations: ['Regular', 'Extra cheese', 'Gluten-free'],
      },
      {
        id: 'ita-006',
        name: 'Risotto ai Funghi',
        price: 380,
        description: 'Arborio rice slow-stirred with wild mushrooms, white wine, and Parmesan foam.',
        isJain: false,
        canBeJain: false,
        tags: ['premium', 'Italian', 'earthy'],
        pairings: { beverage: 'bev-003', dessert: 'des-001' },
        customizations: ['Regular', 'Extra mushrooms', 'Less cream'],
      },
    ],
  },
  {
    id: 'desserts',
    name: 'Desserts',
    description: 'A sweet finale to every meal',
    editorialNote: 'From Italian classics to Indian favourites — our desserts are made to linger.',
    backgroundAnimation: 'drizzle',
    items: [
      {
        id: 'des-001',
        name: 'Tiramisu',
        price: 280,
        description: 'Espresso-soaked ladyfingers layered with mascarpone cream and dusted with dark cocoa.',
        isJain: false,
        canBeJain: false,
        tags: ['Italian', 'coffee', 'creamy'],
        pairings: { beverage: 'bev-003' },
        customizations: ['Regular', 'Extra espresso', 'Less sweet'],
      },
      {
        id: 'des-002',
        name: 'Choco Lava Cake',
        price: 260,
        description: 'Warm dark chocolate cake with a molten core, vanilla ice cream, and gold-dusted tuile.',
        isJain: false,
        canBeJain: false,
        tags: ['chocolate', 'warm', 'indulgent'],
        pairings: { beverage: 'bev-003' },
        customizations: ['Regular', 'Dark chocolate', 'Less sweet'],
      },
      {
        id: 'des-003',
        name: 'Gelato (2 scoops)',
        price: 200,
        description: 'House-churned Italian gelato. Today\'s flavours: Pistachio, Mango, Chocolate Truffle.',
        isJain: false,
        canBeJain: false,
        tags: ['Italian', 'cold', 'light'],
        pairings: { beverage: 'bev-001' },
        customizations: ['2 scoops', '3 scoops', 'Waffle cone', 'Cup'],
      },
      {
        id: 'des-004',
        name: 'Gulab Jamun',
        price: 160,
        description: 'Soft rose-water khoya dumplings in warm saffron syrup. Served with a scoop of vanilla.',
        isJain: false,
        canBeJain: true,
        tags: ['Indian', 'warm', 'classic'],
        pairings: { beverage: 'bev-002' },
        customizations: ['Regular', 'No ice cream', 'Jain version'],
      },
      {
        id: 'des-005',
        name: 'Mango Kulfi',
        price: 180,
        description: 'Dense traditional kulfi made with Alphonso mango, saffron, and hand-ground pistachios.',
        isJain: true,
        canBeJain: false,
        tags: ['Indian', 'cold', 'mango'],
        pairings: { beverage: 'bev-004' },
        customizations: ['Regular', 'Falooda add-on'],
      },
      {
        id: 'des-006',
        name: 'Pannacotta',
        price: 240,
        description: 'Silky vanilla bean cream set in a mould, finished with seasonal berry coulis and mint.',
        isJain: false,
        canBeJain: false,
        tags: ['Italian', 'creamy', 'elegant'],
        pairings: { beverage: 'bev-003' },
        customizations: ['Regular', 'Mango coulis', 'Chocolate sauce'],
      },
    ],
  },
]

export const recommendationPaths: RecommendationPath[] = [
  {
    id: 'light-meal',
    name: 'Light Meal',
    tagline: 'Fresh, balanced, and satisfying',
    itemIds: ['bev-001', 'soup-001', 'qb-006', 'des-003'],
    estimatedPrice: 780,
    reason: 'A fresh start with our Tomato Basil Bisque, a crispy Bruschetta Classica, and a cooling Fresh Lime Soda — the ideal light bite that does not weigh you down.',
    moodMatch: ['Light & Fresh', 'Drinks only'],
    partySizeMatch: ['Just me', 'Two people'],
    budgetMatch: ['Under ₹300', '₹300–₹500'],
  },
  {
    id: 'comfort-combo',
    name: 'Comfort Combo',
    tagline: 'Cheesy, warm, and utterly satisfying',
    itemIds: ['bev-003', 'soup-005', 'ita-001', 'des-002'],
    estimatedPrice: 900,
    reason: 'Dive into wild mushroom soup, a soul-warming Pasta Arrabbiata, and finish with our legendary Choco Lava Cake. The combo table orderes again and again.',
    moodMatch: ['Cheesy & Comforting', 'Italian', 'Mexican'],
    partySizeMatch: ['Two people', 'Family/group'],
    budgetMatch: ['₹300–₹500', 'Premium / no limit'],
  },
  {
    id: 'signature-experience',
    name: 'Signature Experience',
    tagline: 'Bold flavours and Relish\'s best',
    itemIds: ['bev-004', 'qb-001', 'ita-006', 'des-001'],
    estimatedPrice: 1160,
    reason: 'The Veg Platter to start, Risotto ai Funghi as the centrepiece, and Tiramisu to end — this is Relish at its very best.',
    moodMatch: ['Spicy', 'Italian', 'Dessert'],
    partySizeMatch: ['Family/group', 'Two people'],
    budgetMatch: ['₹300–₹500', 'Premium / no limit'],
  },
]

export const allItems: MenuItem[] = categories.flatMap(c => c.items)

export function getItemById(id: string): MenuItem | undefined {
  return allItems.find(item => item.id === id)
}

export function getCategoryById(id: string): Category | undefined {
  return categories.find(c => c.id === id)
}

export function getCategoryForItem(itemId: string): string {
  if (itemId.startsWith('bev'))  return 'beverages'
  if (itemId.startsWith('soup')) return 'soups'
  if (itemId.startsWith('qb'))   return 'quickbites'
  if (itemId.startsWith('ita'))  return 'italian'
  return 'desserts'
}
