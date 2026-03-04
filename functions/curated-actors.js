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
    actorId: "xtdata~twitter-x-scraper",
    description:
      "X (Twitter) scraper. Use for ANY Twitter/X request: recent posts from @username, user timeline, tweets from a handle, search by keyword/hashtag. Returns tweets, engagement, author. Prefer this over web-scraper for Twitter/X. Use startUrls (array of URL strings) and/or twitterHandles (array of handles without @), maxItems, sort.",
    exampleInput: {
      startUrls: ["https://twitter.com/username"],
      twitterHandles: ["username"],
      maxItems: 50,
      sort: "Latest",
    },
  },
  // --- Reddit ---
  {
    actorId: "runtime~reddit-scraper",
    description:
      "Scrape Reddit: posts, comments, subreddits, user profiles. Search by keyword, subreddit name, or URLs. Returns titles, text, scores, comments.",
    exampleInput: {
      startUrls: [{ url: "https://www.reddit.com/r/subreddit/" }],
      maxItems: 100,
    },
  },
  {
    actorId: "cloud9_ai~reddit-scraper",
    description:
      "Scrape Reddit via RSS: posts and discussions by keyword, subreddit, or user. Lighter alternative for Reddit data.",
    exampleInput: {
      search: "keyword or subreddit",
      maxItems: 50,
    },
  },
  // --- LinkedIn ---
  {
    actorId: "anchor~linkedin-profile-enrichment",
    description:
      "Scrape LinkedIn: people and company profiles. Use for lead enrichment, job titles, company info, experience. Provide profile or company URLs.",
    exampleInput: {
      profileUrls: ["https://www.linkedin.com/in/username/"],
    },
  },
  {
    actorId: "scrapier~linkedin-profile-scraper",
    description:
      "Scrape LinkedIn profiles: names, job titles, company, education, skills, experience. Use profile URLs.",
    exampleInput: {
      urls: ["https://www.linkedin.com/in/username/"],
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
