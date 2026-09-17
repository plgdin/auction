export interface AuctionCopyContext {
  id?: string;
  title?: string;
  location?: string;
  category?: string;
  closingTime?: string;
}

/** @deprecated Use AuctionCopyContext instead */
export type ZomatoAuctionContext = AuctionCopyContext;

export interface PromoCopy {
  id: string;
  style: string;
  headline: string;
  body: string;
  ctaText: string;
  fullMessage: string;
}

/** @deprecated Use PromoCopy instead */
export type ZomatoCopy = PromoCopy;

// ---------------------------------------------------------------------------
// Message Templates — 12 distinct tones & styles
// ---------------------------------------------------------------------------

interface CopyTemplate {
  id: string;
  style: string;
  generate: (ctx: AuctionCopyContext, url: string) => PromoCopy;
}

function buildCopy(
  id: string,
  style: string,
  headline: string,
  body: string,
  ctaText: string,
  url: string,
  footer: string
): PromoCopy {
  return {
    id,
    style,
    headline,
    body,
    ctaText,
    fullMessage: `${headline}\n\n${body}\n\n${ctaText} ${url}\n\n_${footer}_`,
  };
}

export const ZOMATO_HOOK_TEMPLATES: CopyTemplate[] = [
  // ── 1. Professional New-Lot Alert ──────────────────────────────────────
  {
    id: 'new_lot_alert',
    style: 'Professional New Lot Alert',
    generate: (ctx, url) => {
      const title = ctx.title || 'Industrial Equipment & Scrap Lot';
      const location = ctx.location ? `📍 ${ctx.location}` : '';
      const headline = '📋 *New Auction Lot Now Live on Lelam*';
      const body = `A fresh lot has been listed and is open for bidding:\n\n*${title}*${location ? `\n${location}` : ''}\n\nVerified documents available. Inspection window is now open.`;
      return buildCopy('new_lot_alert', 'new_lot_alert', headline, body,
        '🔗 View full details & register interest →', url,
        'Lelam Auctions — India\'s Unified eAuction Intelligence Platform');
    },
  },

  // ── 2. Countdown / Closing Soon ────────────────────────────────────────
  {
    id: 'closing_soon',
    style: 'Urgent Countdown Timer',
    generate: (ctx, url) => {
      const title = ctx.title || 'Active Auction Lot';
      const timeLeft = ctx.closingTime || 'a few hours';
      const headline = '⏳ *BIDDING CLOSES SOON*';
      const body = `Only *${timeLeft}* remaining on:\n\n*${title}*\n\nIf you have been watching this lot, now is the time. Once the window closes, it's gone.`;
      return buildCopy('closing_soon', 'closing_soon', headline, body,
        '⚡ Place your bid now →', url,
        'Final call — this lot will not be relisted.');
    },
  },

  // ── 3. Insider / Early Access ──────────────────────────────────────────
  {
    id: 'insider_access',
    style: 'VIP Early Access Alert',
    generate: (ctx, url) => {
      const title = ctx.title || 'Premium Industrial Lot';
      const headline = '🔐 *Early Access — Not Yet in Public Catalog*';
      const body = `Before this hits the main listings, we wanted our active bidders to get first look:\n\n*${title}*\n\nCurrently zero registered bids. Early movers get full inspection access before the crowd arrives.`;
      return buildCopy('insider_access', 'insider_access', headline, body,
        '🎯 Get first-mover advantage →', url,
        'Shared exclusively with verified Lelam bidders.');
    },
  },

  // ── 4. Social Proof / Demand Spike ─────────────────────────────────────
  {
    id: 'high_demand',
    style: 'High Demand Social Proof',
    generate: (ctx, url) => {
      const title = ctx.title || 'Scrap & Machinery Lot';
      const location = ctx.location ? ` in ${ctx.location}` : '';
      const headline = '📈 *Trending Lot — High Buyer Interest*';
      const body = `*${title}*${location} has attracted significant attention in the last 24 hours.\n\n• Multiple buyers have registered interest\n• Document downloads are above average\n• Inspection slots are filling up\n\nThis level of activity usually means competitive bidding.`;
      return buildCopy('high_demand', 'high_demand', headline, body,
        '📊 View lot & current status →', url,
        'Data sourced from Lelam platform activity.');
    },
  },

  // ── 5. No-Nonsense / Direct ────────────────────────────────────────────
  {
    id: 'straight_talk',
    style: 'No-Nonsense Direct Alert',
    generate: (ctx, url) => {
      const title = ctx.title || 'Auction Lot';
      const location = ctx.location || '';
      const headline = '🏭 *Lot Available — Details Below*';
      const parts = [`*${title}*`];
      if (location) parts.push(`📍 ${location}`);
      parts.push('✅ Documents verified');
      parts.push('✅ Open for inspection');
      parts.push('✅ Bidding is live');
      const body = parts.join('\n');
      return buildCopy('straight_talk', 'straight_talk', headline, body,
        '→ View lot', url,
        'Lelam Auctions');
    },
  },

  // ── 6. Market Intelligence ─────────────────────────────────────────────
  {
    id: 'market_intel',
    style: 'Market Intelligence Digest',
    generate: (ctx, url) => {
      const title = ctx.title || 'Industrial Scrap & Equipment Lot';
      const category = ctx.category || 'metals & industrial equipment';
      const headline = '📊 *Weekly Market Alert — Fresh Listing*';
      const body = `Demand for ${category} continues to stay strong this quarter.\n\nNew listing worth watching:\n*${title}*\n\nBuyers who moved early on similar lots last month secured favorable positions. This lot is now live for registration and bidding.`;
      return buildCopy('market_intel', 'market_intel', headline, body,
        '📋 Review lot details →', url,
        'Lelam Market Intelligence — curated for serious buyers.');
    },
  },

  // ── 7. Question / Curiosity Hook ───────────────────────────────────────
  {
    id: 'curiosity_hook',
    style: 'Curiosity Question Hook',
    generate: (ctx, url) => {
      const title = ctx.title || 'Verified Auction Lot';
      const headline = '🤔 *Quick question for you...*';
      const body = `When was the last time you checked what's live on Lelam?\n\nBecause while you were busy, this dropped:\n\n*${title}*\n\nFull documentation is up. Bidding window is open. The only thing missing is your bid.`;
      return buildCopy('curiosity_hook', 'curiosity_hook', headline, body,
        '👀 Take a look →', url,
        'You miss 100% of the lots you don\'t check.');
    },
  },

  // ── 8. Weekend / Casual Tone ───────────────────────────────────────────
  {
    id: 'weekend_casual',
    style: 'Casual Weekend Alert',
    generate: (ctx, url) => {
      const title = ctx.title || 'Scrap & Industrial Lot';
      const headline = '☕ *Quick heads up while you have a minute...*';
      const body = `Not trying to ruin your evening scroll, but this lot just went live and it looked like something you'd want to know about:\n\n*${title}*\n\nNo pressure — just didn't want you to find out after bidding closes and kick yourself.`;
      return buildCopy('weekend_casual', 'weekend_casual', headline, body,
        '🔗 Check it out when you get a sec →', url,
        'From the Lelam team. Have a good one! 🙌');
    },
  },

  // ── 9. Storytelling / Narrative ────────────────────────────────────────
  {
    id: 'story_hook',
    style: 'Storytelling Narrative Hook',
    generate: (ctx, url) => {
      const title = ctx.title || 'High-Recovery Industrial Lot';
      const location = ctx.location || 'an industrial zone';
      const headline = '📖 *Here\'s something interesting...*';
      const body = `A government body just cleared a batch of surplus assets from ${location} for auction.\n\nThe listing:\n*${title}*\n\nThese lots don't sit around long once they go public. Last time a similar batch was listed, bidding closed within 48 hours of catalog release.`;
      return buildCopy('story_hook', 'story_hook', headline, body,
        '📂 View the full catalog →', url,
        'Real auctions. Verified documents. Zero middlemen.');
    },
  },

  // ── 10. FOMO — Last Chance ─────────────────────────────────────────────
  {
    id: 'last_chance',
    style: 'Last Chance FOMO',
    generate: (ctx, url) => {
      const title = ctx.title || 'Active Auction Lot';
      const headline = '🔔 *Final Reminder — Don\'t Miss This One*';
      const body = `We sent an alert about this lot earlier and you haven't checked it yet:\n\n*${title}*\n\nBidding activity has picked up since our last message. Once the hammer drops, there are no second chances on this one.`;
      return buildCopy('last_chance', 'last_chance', headline, body,
        '🏃 View before it closes →', url,
        'This is your last alert for this lot.');
    },
  },

  // ── 11. Category Digest ────────────────────────────────────────────────
  {
    id: 'category_digest',
    style: 'Category-Based Digest',
    generate: (ctx, url) => {
      const category = ctx.category || 'Scrap & Industrial Assets';
      const title = ctx.title || 'Multiple lots now available';
      const headline = `📦 *New in ${category}*`;
      const body = `Fresh listings just dropped in a category you follow:\n\n*${title}*\n\n• Verified seller\n• Documents uploaded\n• Inspection available\n\nNew lots in this category tend to attract bids quickly. Worth a look if this is your segment.`;
      return buildCopy('category_digest', 'category_digest', headline, body,
        '📋 Browse all listings →', url,
        `Personalized alert based on your interests in ${category}.`);
    },
  },

  // ── 12. Milestone / Platform Update ────────────────────────────────────
  {
    id: 'platform_update',
    style: 'Platform Milestone + Featured Lot',
    generate: (ctx, url) => {
      const title = ctx.title || 'Featured Auction Lot';
      const headline = '🏛️ *Lelam Update — Featured Lot This Week*';
      const body = `Our team hand-picks one standout lot each week based on asset quality, documentation completeness, and buyer interest.\n\nThis week's pick:\n*${title}*\n\nFull details, inspection photos, and bidding timeline are live on the platform.`;
      return buildCopy('platform_update', 'platform_update', headline, body,
        '⭐ See this week\'s featured lot →', url,
        'Curated by the Lelam editorial team.');
    },
  },
];

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Generates promotional copy for a given auction context.
 * Picks a specific style by ID, or selects one at random.
 */
export function generateZomatoCopy(
  ctx: AuctionCopyContext = {},
  styleId?: string,
  appBaseUrl: string = 'https://lelam.co'
): PromoCopy {
  const url = ctx.id ? `${appBaseUrl}/auctions/${ctx.id}` : `${appBaseUrl}/auctions`;

  if (styleId) {
    const template = ZOMATO_HOOK_TEMPLATES.find(t => t.id === styleId);
    if (template) return template.generate(ctx, url);
  }

  const randomIndex = Math.floor(Math.random() * ZOMATO_HOOK_TEMPLATES.length);
  return ZOMATO_HOOK_TEMPLATES[randomIndex].generate(ctx, url);
}
