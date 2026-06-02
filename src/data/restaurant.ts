// Brand profile + external links used by guest-facing review & social CTAs.
// These are demo placeholders — in production each restaurant sets its own
// Google review deep-link and Instagram handle (e.g. from the console settings).

export const RESTAURANT = {
  name: 'Relish',
  instagramHandle: '@relish',
  instagramUrl: 'https://instagram.com/relish',
  // Google "write a review" deep link — replace the placeId with the venue's
  // real Google Place ID to land guests straight on the review composer.
  googleReviewUrl: 'https://search.google.com/local/writereview?placeid=ChIJ_RELISH_DEMO',
} as const
