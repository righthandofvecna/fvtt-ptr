export const trainerProgressions = {
  "original": {
    cap: 50,
    tier: {
      1: "Unranked Trainer",
      5: "Amateur Trainer",
      10: "Capable Trainer",
      20: "Veteran Trainer",
      30: "Elite Trainer",
      40: "Champion Trainer"
    },
  },
  "short-track": {
    cap: 25,
    tlModifier: 2,
    tier: {
      1: "Unranked Trainer",
      5: "Journeyman Trainer",
      10: "Skilled Trainer",
      15: "Elite Trainer",
      20: "Champion Trainer",
      25: "Legendary Trainer"
    },
    edges: {
      1: 5,
      2: 1,
      6: 1,
      10: 1,
      12: 1,
      15: 1,
      20: 2,
      25: 3,
    },
    features: {
      1: 4,
      10: 1,
      15: 1,
      20: 1,
      25: 3,
    },
    stats: {
      1: 11,
      10: 5,
      15: 5,
      20: 5,
      25: 5,
    },
    bonusItems: [
      {
        level: 1,
        options: [{
          itemType: "feature",
          uuids: [],
          keywords: ["Training"],
          skipPrereqs: true,
        }]
      },
      {
        level: 5,
        options: [{
          itemType: "feature",
          uuids: [],
          keywords: ["General"],
          skipPrereqs: true,
        }]
      },
    ],
  },
  "ptr-update": {
    cap: 50,
    tier: {
      1: "Unranked Trainer",
      5: "Amateur Trainer",
      10: "Journeyman Trainer",
      15: "Experienced Trainer",
      20: "Skilled Trainer",
      25: "Veteran Trainer",
      30: "Elite Trainer",
      35: "Celebrity Trainer",
      40: "Champion Trainer",
      45: "Superstar Trainer",
      50: "Legendary Trainer"
    },
    edges: {
      1: 4,
      2: 1,
      8: 1,
      10: 1,
      16: 1,
      20: 1,
      35: 2,
      50: 2,
    },
    features: {
      1: 4,
      15: 1,
      25: 1,
      45: 1,
      50: 2,
    },
    stats: {
      1: 10,
      10: 5,
      20: 5,
      25: 3,
      35: 5,
    },
    bonusItems: [
      {
        level: 1,
        options: [{
          itemType: "feature",
          uuids: [],
          keywords: ["Training"],
          skipPrereqs: true,
        }]
      },
      {
        level: 5,
        options: [{
          itemType: "feature",
          uuids: [],
          keywords: ["General"],
          skipPrereqs: true,
        }]
      },
      {
        level: 20,
        options: [{
          itemType: "feature",
          uuids: ["Compendium.ptu.feats.Item.GGa7OT8dHc4RLIEj"],
          keywords: [],
          skipPrereqs: true,
        }]
      },
      {
        level: 30,
        options: [
          {
            itemType: "feature",
            uuids: [],
            keywords: [],
            skipPrereqs: false,
          },
          {
            itemType: "edge",
            uuids: [],
            keywords: [],
            skipPrereqs: false,
            count: 2,
          },
        ]
      },
      {
        level: 30,
        options: [{
          itemType: "feature",
          uuids: ["Compendium.ptu.feats.Item.pXC58ggNIX6QFb5s"],
          keywords: [],
          skipPrereqs: true,
        }]
      },
      {
        level: 40,
        options: [
          {
            itemType: "feature",
            uuids: [],
            keywords: [],
            skipPrereqs: false,
          },
          {
            itemType: "edge",
            uuids: [],
            keywords: [],
            skipPrereqs: false,
            count: 2,
          },
        ]
      },
    ]
  },
  "long-track": {
    cap: 100,
    tlModifier: 0.5,
    tier: {
      1: "Unranked Trainer",
      10: "Amateur Trainer",
      20: "Journeyman Trainer",
      30: "Experienced Trainer",
      40: "Skilled Trainer",
      50: "Veteran Trainer",
      60: "Elite Trainer",
      70: "Celebrity Trainer",
      80: "Champion Trainer",
      90: "Superstar Trainer",
      100: "Legendary Trainer"
    },
    edges: {
      1: 4,
      10: 1,
      20: 1,
    },
    features: {
      1: 4,
    },
    stats: {
      1: 10,
    },
    bonusItems: [
      {
        level: 1,
        options: [{
          itemType: "feature",
          uuids: [],
          keywords: ["Training"],
          skipPrereqs: true,
        }]
      },
      {
        level: 5,
        options: [{
          itemType: "feature",
          uuids: [],
          keywords: ["General"],
          skipPrereqs: true,
        }]
      },
    ],
  }
}

// Apply basic formulaic progression
// every level, gain +1 stat, and alternately gain +1 feature or +1 edge
for (let i = 2; i <= 50; i++) {
  trainerProgressions["ptr-update"].stats[i] ??= 0;
  trainerProgressions["ptr-update"].stats[i] += 1;
  if (i % 2 == 1) {
    trainerProgressions["ptr-update"].features[i] ??= 0;
    trainerProgressions["ptr-update"].features[i] += 1;
  } else {
    trainerProgressions["ptr-update"].edges[i] ??= 0;
    trainerProgressions["ptr-update"].edges[i] += 1;
  }
}

// Apply basic formulaic progression for short-track
// Every level, gain +2 stats, +1 feature, +1 edge
for (let i = 2; i <= 25; i++) {
  trainerProgressions["short-track"].stats[i] ??= 0;
  trainerProgressions["short-track"].stats[i] += 2;
  trainerProgressions["short-track"].features[i] ??= 0;
  trainerProgressions["short-track"].features[i] += 1;
  trainerProgressions["short-track"].edges[i] ??= 0;
  trainerProgressions["short-track"].edges[i] += 1;
}

// Apply basic formulaic progression for long-track
// Every level, gain +1 stat, and alternately gain +1 feature or +1 edge
for (let i = 2; i <= 100; i++) {
  trainerProgressions["long-track"].stats[i] ??= 0;
  trainerProgressions["long-track"].stats[i] += 1;
  if (i % 2 == 1) {
    trainerProgressions["long-track"].features[i] ??= 0;
    trainerProgressions["long-track"].features[i] += 1;
  } else {
    trainerProgressions["long-track"].edges[i] ??= 0;
    trainerProgressions["long-track"].edges[i] += 1;
  }
}


trainerProgressions["data-revamp"] = foundry.utils.deepClone(trainerProgressions["short-track"]);