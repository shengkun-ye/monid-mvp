/**
 * Curated list of Apify Actors for Phase 2 AI planning.
 * actorId: use in URL https://api.apify.com/v2/acts/{actorId}/runs (format: owner~actor-name)
 * description: for the LLM to match user request
 * exampleInput: minimal shape so the LLM knows what keys to produce
 */
export const CURATED_ACTORS = [
  {
    actorId: "apify~hello-world",
    description: "Simple test actor. Use when the user asks for a test, demo, or hello world.",
    exampleInput: {},
  },
  {
    actorId: "damilo~google-maps-scraper",
    description:
      "Scrape Google Maps: businesses, cafes, restaurants, shops by search query and location. Returns name, address, phone, website, rating, reviews. REQUIRED: query (what to search) and location (where).",
    exampleInput: {
      query: "cafes",
      location: "Boston, MA, USA",
      max_results: 10,
    },
  },
  {
    actorId: "apify~web-scraper",
    description:
      "Scrape arbitrary websites by URL. Use ONLY when no dedicated actor fits. Do NOT use for Twitter/X, Reddit, LinkedIn, Instagram, etc.—use those platform-specific actors instead.",
    exampleInput: {
      startUrls: [{ url: "https://example.com" }],
      pageFunction: "async function pageFunction(context) { return context.page.title(); }",
    },
  },
  // --- X (Twitter) ---
  {
    actorId: "apidojo~tweet-scraper",
    description:
      "X (Twitter) scraper. Use for ANY Twitter/X request: recent posts from @username, user timeline, tweets from a handle, search by keyword/hashtag. Returns tweets, engagement, author. Input via startUrls and/or handles. See Apify console: https://console.apify.com/actors/61RPP7dywgiy0JPD0/input",
    exampleInput: {
      startUrls: ["https://twitter.com/username"],
      handles: ["username"],
      maxItems: 50,
    },
  },
  // --- Reddit ---
  {
    actorId: "trudax~reddit-scraper-lite",
    description:
      "Scrape Reddit: posts, comments, subreddits. Search by keyword, subreddit name, or URLs. Returns titles, text, scores, comments. See Apify console: https://console.apify.com/actors/oAuCIx3ItNrs2okjQ/input",
    exampleInput: {
      startUrls: [{ url: "https://www.reddit.com/r/subreddit/" }],
      maxItems: 100,
    },
  },
  // --- LinkedIn ---
  {
    actorId: "harvestapi~linkedin-post-search",
    description:
      "Search LinkedIn posts by query. Use for finding posts, discussions, and content on LinkedIn. See Apify console: https://console.apify.com/actors/buIWk2uOUzTmcLsuB/information/latest/readme",
    exampleInput: {
      search: "search query for posts",
      maxItems: 50,
    },
  },
  // --- Amazon ---
  {
    actorId: "delicious_zebu~amazon-product-details-scraper",
    description:
      "Scrape Amazon product details: pricing, reviews, ratings, availability, descriptions, ASINs from product URLs.",
    exampleInput: {
      startUrls: [{ url: "https://www.amazon.com/dp/ASIN" }],
      maxItems: 10,
    },
  },
  {
    actorId: "scrapeai~amazon-product-scraper",
    description:
      "Scrape Amazon: product info, reviews, prices, descriptions from product or search URLs.",
    exampleInput: {
      startUrls: [{ url: "https://www.amazon.com/dp/ASIN" }],
    },
  },
  {
    actorId: "scrapier~amazon-search-actor",
    description:
      "Scrape Amazon search results: product titles, prices, ratings, images by search query.",
    exampleInput: {
      searchStringsArray: ["laptop"],
      country: "US",
      maxItems: 50,
    },
  },
  // --- TikTok ---
  {
    actorId: "thescrapelab~tiktok-scraper-2-0",
    description:
      "Scrape TikTok: users, keywords, profiles, video analytics, transcripts. Use handles or search terms.",
    exampleInput: {
      userNames: ["username"],
      maxUserCount: 10,
      maxVideoCount: 20,
    },
  },
  {
    actorId: "apidojo~tiktok-scraper-api",
    description:
      "Scrape TikTok: videos, profiles, hashtags, music, search results. Fast extraction.",
    exampleInput: {
      hashtags: ["trending"],
      maxResults: 50,
    },
  },
  {
    actorId: "neuro-scraper~tiktok-video-details-scraper",
    description:
      "Scrape TikTok video details from video URLs: views, likes, comments, author info.",
    exampleInput: {
      postURLs: ["https://www.tiktok.com/@user/video/123"],
    },
  },
  // --- Instagram ---
  {
    actorId: "apify~instagram-profile-scraper",
    description:
      "Scrape Instagram: profiles and posts. Returns name, bio, followers, latest posts, engagement. Use profile URLs or usernames.",
    exampleInput: {
      directUrls: ["https://www.instagram.com/username/"],
      resultsLimit: 30,
    },
  },
  {
    actorId: "alizarin_refrigerator-owner~instagram-scraper",
    description:
      "Scrape Instagram profiles and posts without login. Follower counts, engagement, reels.",
    exampleInput: {
      username: ["username"],
      resultsLimit: 20,
    },
  },
  {
    actorId: "data-slayer~instagram-posts",
    description:
      "Scrape Instagram user posts: engagement metrics, content history. No login required.",
    exampleInput: {
      usernames: ["username"],
      maxPosts: 50,
    },
  },
  // --- YouTube ---
  {
    actorId: "video-scraper~youtube-channel-video-scraper",
    description:
      "Scrape YouTube channel videos: video URLs, titles, thumbnails, view counts, publish dates. Use channel URL or @handle.",
    exampleInput: {
      channelUrl: "https://www.youtube.com/@channel",
      maxResults: 50,
    },
  },
  {
    actorId: "alpha-scraper~youtube-channel-scraper-metadata-extractor",
    description:
      "Scrape YouTube channel metadata: subscribers, total views, description, social links, statistics.",
    exampleInput: {
      channelUrls: ["https://www.youtube.com/@channel"],
    },
  },
  // --- Facebook ---
  {
    actorId: "scraper-engine~facebook-url-to-id",
    description:
      "Convert Facebook URLs (profiles, pages, groups, posts) to numeric IDs for automation and integrations.",
    exampleInput: {
      startUrls: [{ url: "https://www.facebook.com/page-or-profile" }],
    },
  },
];
