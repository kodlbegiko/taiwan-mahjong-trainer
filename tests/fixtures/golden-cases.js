/** Human-reviewed shapes: 0..8 man, 9..17 pin, 18..26 sou, 27..33 honors. */
export const GOLDEN_HANDS = Object.freeze([
  {
    id: 'five-melds-complete',
    hand: [0,0,0,0,1,2,9,10,11,18,19,20,27,27,27,28,28],
    shanten: -1,
    note: '111m 123m 123p 123s EEE SS',
  },
  {
    id: 'single-pair-wait',
    hand: [0,0,0,0,1,2,9,10,11,18,19,20,27,27,27,28],
    shanten: 0,
    draws: [{ tile: 28, count: 3 }],
    note: 'Complete shape missing one of two S honors',
  },
  {
    id: 'edge-wait-789',
    hand: [7,8,27,27,27,28,28,28,29,29,29,30,30,30,31,31],
    shanten: 0,
    draws: [{ tile: 6, count: 4 }],
    note: 'Four honor triplets, honor pair, isolated 8m 9m edge wait',
  },
  {
    id: 'two-sided-wait-23',
    hand: [1,2,27,27,27,28,28,28,29,29,29,30,30,30,31,31],
    shanten: 0,
    draws: [{ tile: 0, count: 4 }, { tile: 3, count: 4 }],
    note: 'Four honor triplets, honor pair, 2m 3m two-sided wait',
  },
  {
    id: 'isolated-honor-singletons',
    hand: [0,0,0,9,9,9,18,18,18,30,30,30,31,31,27,28],
    shanten: 1,
    note: 'Four triplets and a pair with two unmatched honors',
  },
  {
    id: 'four-quad-honors',
    hand: [27,27,27,27,28,28,28,28,29,29,29,29,30,30,30,30],
    shanten: 4,
    note: '16 physical tiles, four quads cannot be interpreted as five melds plus pair',
  },
  {
    id: 'wrong-suit-not-sequence',
    hand: [0,0,0,7,8,9,9,10,11,18,19,20,27,27,27,28,28],
    shanten: 0,
    note: '8m 9m 1p must not be treated as a sequence',
  },
]);
