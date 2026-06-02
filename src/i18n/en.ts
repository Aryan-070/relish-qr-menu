/**
 * English (en) — the canonical translation dictionary for the Relish QR app.
 *
 * This is the single source of truth for translation KEYS. Every other language
 * dictionary (e.g. {@link ../i18n/hi.ts}) is typed as
 * `Record<TranslationKey, string>` where `TranslationKey = keyof typeof en`, so
 * adding a key here makes it a compile-time requirement everywhere else.
 *
 * Keys are dot-namespaced by surface (`nav.*`, `action.*`, `order.*`,
 * `item.*`, `service.*`, `reco.*`, `search.*`, `landing.*`, `state.*`).
 * Values are the guest-facing English strings extracted from the screens.
 */
export const en = {
  // ── Navigation ────────────────────────────────────────────────────────────
  'nav.menu': 'Menu',
  'nav.askAI': 'Ask AI',
  'nav.waiter': 'Waiter',
  'nav.order': 'Order',
  'nav.myOrder': 'My Order',
  'nav.callWaiter': 'Call Waiter',

  // ── Brand / tagline ───────────────────────────────────────────────────────
  'brand.name': 'Relish',
  'brand.tagline': 'International Veg Cuisine',
  'brand.journey': 'A journey through flavours of the world',

  // ── Generic actions ───────────────────────────────────────────────────────
  'action.addToOrder': 'Add to Order',
  'action.addCombo': 'Add combo',
  'action.placeOrder': 'Place Order with Waiter',
  'action.continue': 'Continue',
  'action.next': 'Next',
  'action.startOver': 'Start over',
  'action.search': 'Search',
  'action.openMenu': 'Open Menu',
  'action.exploreMenu': 'Explore Menu',
  'action.browseMenu': 'Browse Menu',
  'action.askWaiter': 'Ask Waiter',
  'action.showMyPicks': 'Show my picks',
  'action.recommend': 'Recommend Something',
  'action.askForRecommendation': 'Ask for a Recommendation',
  'action.viewInMenu': 'View in Menu',
  'action.done': 'Done',
  'action.close': 'Close',
  'action.back': 'Back',
  'action.tapToClose': 'tap anywhere to close',
  'action.tapToAdd': 'Tap to add to your order',
  'action.tapDishToAdd': 'Tap any dish to add it here',
  'action.addedToOrder': 'Added to your order',
  'action.showToWaiter': 'Show to Waiter',

  // ── Landing screen ────────────────────────────────────────────────────────
  'landing.tonightsTable': "Tonight's Table",
  'landing.recommendShort': 'Recommend',
  'landing.callWaiter': 'Call Waiter',

  // Trust badges / facts
  'landing.badgeVeg': '100% Veg',
  'landing.badgeJain': 'Jain Options',
  'landing.badgeFresh': 'Fresh Daily',
  'landing.badgePairings': 'Curated Pairings',

  // Hero taglines / chrome (per landing variant)
  'landing.gastronomiqueTagline': 'Where each plate tells a story of craft and culture',
  'landing.gastronomiqueVol': 'Fine Dining · Vol. I',
  'landing.gastronomiqueChefSignature': "Chef's Signature",
  'landing.gastronomiqueFooter': 'International Veg Cuisine · Est. 2024 · Crafted With Care',
  'landing.editorialDining': 'Relish Dining',
  'landing.editorialVol': 'Vol. I',
  'landing.editorialTagline': "A Journey Through The World's Finest Vegetarian Cuisine",
  'landing.editorialBlurb': 'Five categories. Sixty dishes crafted with care. One unforgettable dining experience.',
  'landing.editorialQuote': 'Where every plate tells a story of culture, craft, and pure vegetarian joy.',
  'landing.editorialFooter': 'International Veg Cuisine • Scan to Browse • Est. 2024',
  'landing.est': 'Est. 2024',
  'landing.botanicaTagline': 'Farm fresh · seasonal · crafted with love',
  'landing.botanicaFarmToTable': 'Farm to Table',
  'landing.reelTagline': 'Every dish, in motion',
  'landing.intlVegCuisine': 'International Veg Cuisine',

  // ── Item detail ───────────────────────────────────────────────────────────
  'item.suitableFor': 'Suitable for',
  'item.contains': 'Contains',
  'item.allergyNote': 'please confirm with your server for severe allergies.',
  'item.goesWellWith': 'Goes well with',
  'item.pickOne': 'Pick one',
  'item.drink': 'Drink',
  'item.side': 'Side',
  'item.dessert': 'Dessert',
  'item.jain': 'Jain',
  'item.canBeJain': 'Can be Jain',
  'item.jainable': 'Jain-able',
  'item.addShort': 'ADD',

  // ── Order panel ───────────────────────────────────────────────────────────
  'order.title': 'Your Order',
  'order.total': 'Total',
  'order.taxesExtra': 'Taxes & service charges extra',
  'order.empty': 'Your order is empty',
  'order.nothingAdded': 'Nothing added yet',
  'order.handToWaiter': 'Hand this to your waiter or tap to call them',
  'order.callingWaiter': 'Calling waiter…',
  'order.addNote': 'Add special instructions',
  'order.editNote': 'Edit special instructions',
  'order.notePlaceholder': 'e.g. Less spicy, no onion, extra sauce…',
  'order.itemSingular': 'item',
  'order.itemPlural': 'items',

  // ── Service panel ─────────────────────────────────────────────────────────
  'service.title': 'Table Service',
  'service.howCanWeHelp': 'How can we help you?',
  'service.welcome': 'Welcome to Relish',
  'service.callOurWaiter': 'Call our waiter',
  'service.anytime': 'Anytime',
  'service.atYourService': 'At Your Service',
  'service.tapAny': 'tap any',
  'service.tonightsRequests': "Tonight's requests",
  'service.waiterEnRoute': 'Waiter en route',
  'service.waiterOnTheWay': 'Your waiter is on the way',
  'service.requestReceived': 'Request received',
  'service.arrived': 'Arrived!',
  'service.eta': 'ETA',
  'service.hide': 'Hide',
  'service.cancelRequest': 'Cancel request',

  // Service grid cards
  'service.water': 'Water',
  'service.waterSub': 'still · sparkling',
  'service.bill': 'Bill',
  'service.billSub': 'split · pay',
  'service.more': 'More',
  'service.moreSub': 'jain · etc',
  'service.menuSub': 'browse',
  'service.askAISub': 'Relish guide',
  'service.empty': 'empty',

  // Water view
  'service.requestWater': 'Request Water',
  'service.waterStill': 'Still',
  'service.waterSparkling': 'Sparkling',
  'service.waterIce': '+ Ice',
  'service.waterLemon': '+ Lemon',

  // Bill view
  'service.billPrintNote': "We'll print & bring it over. No rush.",
  'service.billOneBill': 'One bill',
  'service.billSplitEvenly': 'Split evenly',
  'service.billItemise': 'Itemise',
  'service.billGratuity': 'Add gratuity',

  // Split-bill calculator
  'service.splitTitle': 'Split the Bill',
  'service.splitEachPays': 'Each person pays',
  'service.splitBetween': 'Split between',
  'service.splitAddTip': 'Add a tip',
  'service.splitTipNone': 'None',
  'service.splitRoundUp': 'Round up for the staff',
  'service.splitRoundUpSub': 'nearest ₹10 each · extra goes to tip',
  'service.splitSubtotal': 'Order subtotal',
  'service.splitTip': 'Tip',
  'service.splitTableTotal': 'Table total',
  'service.splitNothingYet': 'Nothing to split yet',
  'service.personSingular': 'person',
  'service.personPlural': 'people',

  // More view
  'service.moreTitle': 'More Options',
  'service.bread': 'Bread basket',
  'service.breadSub': 'warm sourdough',
  'service.jainInfo': 'Jain info',
  'service.jainInfoSub': 'menu details',
  'service.allergyNote': 'Allergy note',
  'service.allergyNoteSub': 'flag the kitchen',
  'service.compliments': 'Compliments',
  'service.complimentsSub': 'to the chef',
  'service.helpChoosing': 'Help choosing',
  'service.helpChoosingSub': 'ask our team',
  'service.coatCheck': 'Coat check',
  'service.coatCheckSub': 'retrieve',

  // Greetings
  'service.goodMorning': 'good morning,',
  'service.goodAfternoon': 'good afternoon,',
  'service.goodEvening': 'good evening,',

  // Service panel — additional chrome
  'service.tableGuests': 'Table 7 · 2 guests',
  'service.requestReceivedTable': 'Request received · Table 7',
  'service.waiterPrefix': 'Your waiter is ',
  'service.waiterOnWay': 'on the way',

  // Water option subs
  'service.waterStillSub': 'spring, room temp',
  'service.waterSparklingSub': 'well chilled',
  'service.waterIceSub': 'extra cubes',
  'service.waterLemonSub': 'fresh wedge',

  // Bill option subs
  'service.billOneBillSub': 'for the table',
  'service.billSplitEvenlySub': '2 ways',
  'service.billItemiseSub': 'per dish',
  'service.billGratuitySub': '10 / 18 / 20%',
  'service.billCalculateShares': 'calculate shares',

  // Bread view
  'service.breadTitle': 'Bread & Sourdough',
  'service.sourdough': 'Sourdough',
  'service.sourdoughSub': 'warm basket',
  'service.moreBread': 'More bread',
  'service.moreBreadSub': 'refill please',

  // Jain view
  'service.jainTitle': 'Jain Menu Details',
  'service.jainAvailable': 'Jain-Friendly Options Available',
  'service.jainInformWaiter': 'Always inform your waiter before ordering',
  'service.jainQ1': 'What is Jain food?',
  'service.jainA1': 'Jain cuisine avoids root vegetables (onion, garlic, potato, carrot, radish) and any ingredient that harms living organisms.',
  'service.jainQ2': 'Which items are fully Jain?',
  'service.jainA2': 'Items marked with the Jain badge are prepared without any root vegetables. Look for the green "Jain" badge on the menu.',
  'service.jainQ3': 'Can dishes be made Jain?',
  'service.jainA3': 'Many dishes show "Can be Jain" — these can be prepared Jain-friendly on request. Please inform your waiter before ordering.',
  'service.jainQ4': 'Cross-contamination?',
  'service.jainA4': 'Our kitchen takes care with Jain orders, but we use a shared kitchen. Please speak to the waiter for strict requirements.',
  'service.jainStillQuestions': 'Still have questions? Call waiter',

  // Split-bill — additional
  'service.splitTipNoneShort': 'None',
  'service.splitEmptyDesc': "Add a few dishes to your order and we'll work out everyone's share.",
  'service.splitBrowseMenu': 'Browse the menu',
  'service.splitTotal': 'total',
  'service.splitCtaPrefix': 'Ask for the bill — split ',
  'service.splitWays': 'ways',
  'service.splitPerPerson': '/person',
  'service.decrease': 'Decrease',
  'service.increase': 'Increase',
  'service.goBack': 'Go back',
  'service.close': 'Close',

  // Toast / status messages
  'service.toastStill': 'Still water, on its way.',
  'service.toastSparkling': 'Sparkling, well chilled.',
  'service.toastIce': 'Extra ice — coming.',
  'service.toastLemon': 'A wedge of lemon — coming.',
  'service.toastWhole': 'One bill, on its way.',
  'service.toastSplit': 'Bill split — sent to your waiter.',
  'service.toastItemize': 'Itemising the bill.',
  'service.toastGratuity': 'Add gratuity at the till.',
  'service.toastBread': 'More bread — coming.',
  'service.toastAllergy': 'Kitchen flagged. Waiter will confirm.',
  'service.toastCompliment': 'Compliments passed to the kitchen.',
  'service.toastChoose': 'Waiter will be with you shortly.',
  'service.toastCoat': 'Retrieving your coats.',
  'service.toastWaiter': 'Waiter has been called!',
  'service.toastCancel': 'Cancelled — no waiter on the way.',
  'service.toastNoted': 'Noted — on its way.',

  // Feed labels (live requests)
  'service.feedTableSeated': 'Table seated',
  'service.feedMenusDelivered': 'Menus delivered',
  'service.feedWaiterCalled': 'Waiter called',
  'service.feedDone': '— done',
  'service.feedCancelled': '— cancelled',
  'service.feedWaiterEta': '~45 sec',
  'service.feedEta2min': '2 min',

  // ── Recommendation flow ───────────────────────────────────────────────────
  'reco.title': 'Ask Relish AI',
  'reco.subtitle': 'Personalised recommendations',
  'reco.picksTitle': 'Your Relish Picks',
  'reco.picksSubtitle': 'Based on your preferences',
  'reco.topPick': 'Top Pick for You',
  'reco.chefsPicks': "Chef's Picks",
  'reco.selectToContinue': 'Select at least one option to continue',
  'reco.everythingWorthTrying': 'Everything on our menu is worth trying!',
  'reco.notSureWhat': 'Not sure what to order?',
  'reco.moodQuestion': 'What are you in the mood for?',
  'reco.moodHint': 'Pick as many as you like',
  'reco.partyQuestion': 'Who are you ordering for?',
  'reco.partyHint': 'Select all that apply',

  // ── Search ────────────────────────────────────────────────────────────────
  'search.placeholder': "Search dishes, e.g. 'mango' or 'spicy'",
  'search.noMatch': 'No dishes match',
  'search.tryDifferent': 'Try a different word or clear a filter.',
  'search.dishSingular': 'dish',
  'search.dishPlural': 'dishes',
  'search.onTheMenu': 'on the menu',
  'search.mildOnly': 'Mild only',

  // ── Generic empty / state copy ────────────────────────────────────────────
  'state.basedOnPreferences': 'Based on your preferences',

  // ── Feedback / review / social ────────────────────────────────────────────
  'service.feedbackTitle': 'Rate your visit',
  'service.rateUs': 'Rate us',
  'service.rateUsSub': 'review · follow',
  'feedback.rateVisit': 'Done dining? Rate your visit',
  'feedback.q': 'How was your experience?',
  'feedback.tapRate': 'Tap a star to rate',
  'feedback.loved': 'So glad you enjoyed it!',
  'feedback.lovedSub': 'Would you share it on Google? It means the world to us.',
  'feedback.google': 'Rate us on Google',
  'feedback.improve': "Sorry it wasn't perfect",
  'feedback.improveSub': 'Tell us what we could do better — it goes straight to the manager.',
  'feedback.commentPlaceholder': 'Add a comment (optional)',
  'feedback.send': 'Send feedback',
  'feedback.thanks': 'Thank you for your feedback!',
  'feedback.thanksSub': 'We appreciate you dining with us.',
  'feedback.followUs': 'Follow us on Instagram',

  // ── Loyalty / rewards ─────────────────────────────────────────────────────
  'service.rewards': 'Rewards',
  'service.rewardsSub': 'points · tier',
  'service.rewardsTitle': 'Relish Rewards',
  'loyalty.title': 'Relish Rewards',
  'loyalty.subtitle': 'Earn points every visit',
  'loyalty.phonePlaceholder': 'Your phone number',
  'loyalty.namePlaceholder': 'Your name (optional)',
  'loyalty.continue': 'Continue',
  'loyalty.welcome': 'Welcome to Relish Rewards!',
  'loyalty.welcomeSub': "You've earned 50 welcome points.",
  'loyalty.points': 'points',
  'loyalty.visits': 'visits',
  'loyalty.tier': 'tier',
  'loyalty.redeem': 'Redeem 100 points',
  'loyalty.redeemed': 'Redeemed 100 points',
  'loyalty.earnHint': 'Earn 1 point for every ₹10 you spend.',
} as const
