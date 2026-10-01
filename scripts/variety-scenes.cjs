/* The variety scene set (VARIETY-BRIEF.md). Fixed seeds and camera paths;
   recorded by `node scripts/capture-clip.cjs --variety <id> --label before|after`.
   Camera "orbit": a slow orbit round the focus group's centroid at a distance
   set by the group's spread; "broadcast": the page's own director.
   focus: 'side0' | 'side1' | 'all' | a JS expression over ships (ids). */
module.exports.scenes = [
  {id: 'v1', name: 'A Shadow fleet arriving', matchup: [8, 5], seed: 811, size: 300, from: 0, to: 16, focus: 'side0', camera: {type: 'orbit', dist: 1.5, up: .35, speed: .03, start: 3.3}},
  {id: 'v2', name: 'An Engineer fleet in its crescent', matchup: [15, 6], seed: 1512, size: 300, from: 14, to: 28, focus: 'side0', camera: {type: 'orbit', dist: 1.3, up: .55, speed: .025, start: 2.6}},
  {id: 'v3', name: 'Dominion against Romulans', matchup: [19, 18], seed: 1918, size: 300, from: 26, to: 40, focus: 'all', camera: {type: 'orbit', dist: 1.0, up: .3, speed: .03, start: 1.2}},
  {id: 'v4', name: 'Space Marines in their wall', matchup: [20, 21], seed: 2021, size: 300, from: 12, to: 26, focus: 'side0', camera: {type: 'orbit', dist: 1.2, up: .25, speed: .02, start: 3.0}},
  {id: 'v5', name: 'Imperial against Rebels, both lines wide', matchup: [5, 6], seed: 506, size: 400, from: 20, to: 34, focus: 'all', camera: {type: 'orbit', dist: 1.1, up: .5, speed: .015, start: 1.6}},
  {id: 'v6', name: 'Minbari, with a Sharlin in frame', matchup: [7, 9], seed: 709, size: 300, from: 18, to: 32, focus: "ships.filter(s=>s.side===0&&(s.hulls||s.slen>=300)).map(s=>s.id)", camera: {type: 'orbit', dist: 1.6, up: .3, speed: .03, start: 2.2}},
  {id: 'v7', name: 'Tesla against Tyranids', matchup: [22, 21], seed: 2221, size: 300, from: 24, to: 38, focus: 'all', camera: {type: 'orbit', dist: 1.0, up: .35, speed: .03, start: .8}},
  {id: 'v8', name: "Every fleet's muster in the ship study, one band at a time", study: true},
  {id: 'v9', name: 'A full 90-second war in Broadcast, 600 a side, Ultra', matchup: [5, 6], seed: 9090, size: 600, from: 0, to: 90, focus: 'all', quality: 'ultra', camera: {type: 'broadcast'}},
];
