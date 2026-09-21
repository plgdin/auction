export interface AuctionCopyContext {
  id?: string;
  title?: string;
  location?: string;
  category?: string;
  closingTime?: string;
  price?: number | string;
  [key: string]: unknown;
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
// Message Templates — 30 distinct tones & styles
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

  // ── 13. Typo / Glitch Pattern Interrupt ────────────────────────────────
  {
    id: 'typo_glitch',
    style: 'Typo Glitch Pattern Interrupt',
    generate: (ctx, url) => {
      const title = ctx.title || 'Industrial Scrap Lot';
      const headline = '😅 *sory — wrong chat*';
      const body = `Wait actually no, this IS the right chat.\n\nI was about to send this lot to a different buyer group but you should probably see it first:\n\n*${title}*\n\nSeriously though — docs are clean, bidding is live, and I almost forgot to loop you in.`;
      return buildCopy('typo_glitch', 'typo_glitch', headline, body,
        '🫣 See what I almost forgot to send you →', url,
        'Lelam Auctions — sometimes the best deals come from typos.');
    },
  },

  // ── 14. Hinglish Conversational ────────────────────────────────────────
  {
    id: 'hinglish_bhai',
    style: 'Hinglish Bhai-Tone Conversational',
    generate: (ctx, url) => {
      const title = ctx.title || 'Scrap Material Lot';
      const location = ctx.location ? ` ${ctx.location} mein` : '';
      const headline = '🫡 *Bhai, ek lot aaya hai — dekh le*';
      const body = `Seedha baat — no bakwaas:\n\n*${title}*${location}\n\nDocs verified hai, inspection open hai, aur abhi tak zyada bheed nahi hai.\n\nJo pehle dekhega wo pehle decision le payega. Baad mein mat bolna "bataya nahi."`;
      return buildCopy('hinglish_bhai', 'hinglish_bhai', headline, body,
        '👉 Abhi dekh →', url,
        'Lelam pe real auctions — middleman ka kharcha nahi.');
    },
  },

  // ── 15. Morning Briefing / CEO Style ───────────────────────────────────
  {
    id: 'morning_briefing',
    style: 'Morning Briefing CEO Digest',
    generate: (ctx, url) => {
      const title = ctx.title || 'Industrial Asset Lot';
      const category = ctx.category || 'industrial assets';
      const location = ctx.location || 'Pan-India';
      const headline = '☀️ *Good Morning — Your Lelam Daily Brief*';
      const body = `*Today's highlight:*\n━━━━━━━━━━━━━━━━━━\n📦 *${title}*\n📍 ${location}\n🏷️ Category: ${category}\n━━━━━━━━━━━━━━━━━━\n\n• Bidding status: 🟢 Live\n• Documentation: ✅ Complete\n• Competition: Low (early window)\n\nOne lot. Two minutes to review. Your call.`;
      return buildCopy('morning_briefing', 'morning_briefing', headline, body,
        '📱 Open brief →', url,
        'Lelam Daily Brief — delivered every morning.');
    },
  },

  // ── 16. Meme / Internet Humor ──────────────────────────────────────────
  {
    id: 'meme_humor',
    style: 'Internet Meme Humor Hook',
    generate: (ctx, url) => {
      const title = ctx.title || 'Surplus Equipment Lot';
      const headline = '💀 *POV: You ignored the last Lelam alert*';
      const body = `That lot you skipped? Someone else bid on it. Got it at a great price. Is probably celebrating right now.\n\nDon't let it happen again:\n\n*${title}*\n\nThis one just dropped. Zero bids so far. The window is open.\n\nYou 🤝 A good deal\n_Let's make it happen this time._`;
      return buildCopy('meme_humor', 'meme_humor', headline, body,
        '🫡 Fine, show me the lot →', url,
        'Lelam Auctions — your deal regret counselor.');
    },
  },

  // ── 17. Data-Driven Analyst ────────────────────────────────────────────
  {
    id: 'data_analyst',
    style: 'Data-Driven Analyst Report',
    generate: (ctx, url) => {
      const title = ctx.title || 'Scrap & Equipment Lot';
      const category = ctx.category || 'industrial scrap';
      const headline = '📉 *Auction Data Snapshot*';
      const body = `Based on 90-day platform data for ${category}:\n\n┌─────────────────────────────┐\n│ Avg. lots listed/week:  12  │\n│ Avg. bidders/lot:       6   │\n│ Lots closing \u003C48hrs:    34% │\n│ Repeat buyer rate:      61% │\n└─────────────────────────────┘\n\nNew listing matching this profile:\n*${title}*\n\nHistorical pattern: lots with this profile attract 4+ bids within 36 hours of listing.`;
      return buildCopy('data_analyst', 'data_analyst', headline, body,
        '📊 View lot analytics →', url,
        'Lelam Intelligence — numbers don\'t lie.');
    },
  },

  // ── 18. Deal Hunter / Bargain Alert ────────────────────────────────────
  {
    id: 'deal_hunter',
    style: 'Deal Hunter Bargain Alert',
    generate: (ctx, url) => {
      const title = ctx.title || 'Industrial Surplus Lot';
      const location = ctx.location ? ` in ${ctx.location}` : '';
      const headline = '🎯 *Deal Alert — Below Market Radar*';
      const body = `This lot hasn't been picked up by the usual buyer networks yet:\n\n*${title}*${location}\n\n• Listed in the last 24 hours\n• Competitive reserve pricing\n• Full documentation uploaded\n• No major bidding war... _yet_\n\nSmart money moves before the crowd notices. This is that window.`;
      return buildCopy('deal_hunter', 'deal_hunter', headline, body,
        '💰 Grab this before it trends →', url,
        'Lelam Deals — first in, best served.');
    },
  },

  // ── 19. Loss Aversion / Regret Hook ────────────────────────────────────
  {
    id: 'loss_aversion',
    style: 'Loss Aversion Psychology Hook',
    generate: (ctx, url) => {
      const title = ctx.title || 'Verified Auction Lot';
      const headline = '⚠️ *A lot you matched with just got its first bid*';
      const body = `Someone else just placed a bid on:\n\n*${title}*\n\nWe flagged this for you earlier based on your interest profile. Now it's moving.\n\nEvery additional bid makes it harder for you to win. The auction doesn't wait.`;
      return buildCopy('loss_aversion', 'loss_aversion', headline, body,
        '🏃‍♂️ Place your bid before it escalates →', url,
        'Lelam — opportunities don\'t send reminders twice.');
    },
  },

  // ── 20. Comparison / Shopping Assistant ─────────────────────────────────
  {
    id: 'comparison_shop',
    style: 'Comparison Shopping Assistant',
    generate: (ctx, url) => {
      const title = ctx.title || 'Multi-Lot Opportunity';
      const category = ctx.category || 'similar assets';
      const headline = '⚖️ *Quick Comparison — Is This Lot Worth Your Bid?*';
      const body = `We compared this lot against recent ${category} auctions:\n\n*${title}*\n\n📐 *Asset Size:* Above average for category\n📄 *Documentation:* Complete (top 20% of listings)\n👥 *Bidder Count:* Below average — less competition\n📍 *Location Access:* Inspection-friendly\n\nOur take: Strong fundamentals. Low traffic. Worth evaluating.`;
      return buildCopy('comparison_shop', 'comparison_shop', headline, body,
        '🔍 See full comparison →', url,
        'Lelam Comparison Engine — bid smarter, not harder.');
    },
  },

  // ── 21. Testimonial / Social Story ─────────────────────────────────────
  {
    id: 'testimonial',
    style: 'Buyer Testimonial Story',
    generate: (ctx, url) => {
      const title = ctx.title || 'Industrial Scrap Lot';
      const headline = '💬 *"I almost didn\'t bid. Glad I did."*';
      const body = `One of our buyers shared this last week:\n\n_"Found the lot on Lelam on a Wednesday. Thought about it for a day. Almost forgot. Placed my bid Thursday evening. Won it Friday morning. The documentation was exactly as listed."_\n\nThe lot that reminded us of their story:\n*${title}*\n\nSame profile. Same opportunity. Different buyer this time — maybe you?`;
      return buildCopy('testimonial', 'testimonial', headline, body,
        '🤝 See this lot →', url,
        'Real buyers. Real wins. Lelam Auctions.');
    },
  },

  // ── 22. Checklist / Decision Helper ────────────────────────────────────
  {
    id: 'checklist_helper',
    style: 'Decision Checklist Helper',
    generate: (ctx, url) => {
      const title = ctx.title || 'Auction Lot';
      const headline = '✅ *Should You Bid? Quick Checklist*';
      const body = `New lot: *${title}*\n\nRun through this:\n\n☐ Is this asset in your buying category?\n☐ Is the location accessible for inspection?\n☐ Is the documentation complete? _(yes, verified)_\n☐ Is the bidding window still open? _(yes, live now)_\n☐ Have you reviewed the reserve pricing?\n\nIf you checked 3 or more — this lot is worth 2 minutes of your time.`;
      return buildCopy('checklist_helper', 'checklist_helper', headline, body,
        '📝 Review full details →', url,
        'Lelam — helping you bid with clarity.');
    },
  },

  // ── 23. Flash Sale / Limited Window ────────────────────────────────────
  {
    id: 'flash_window',
    style: 'Flash Sale Limited Window',
    generate: (ctx, url) => {
      const title = ctx.title || 'Flash Lot';
      const timeLeft = ctx.closingTime || '24 hours';
      const headline = '🔥 *FLASH LOT — ${timeLeft} Window*'.replace('${timeLeft}', timeLeft);
      const body = `This lot has been fast-tracked with a shortened bidding window:\n\n*${title}*\n\n⏰ Window: *${timeLeft}* from now\n📄 Documents: Already uploaded\n🔍 Inspection: Available immediately\n\nFlash lots close fast. By the time most buyers see this, the window is already half gone.`;
      return buildCopy('flash_window', 'flash_window', headline, body,
        '⚡ Bid now — clock is ticking →', url,
        'Lelam Flash Lots — blink and they\'re gone.');
    },
  },

  // ── 24. Polite Follow-Up / Nudge ───────────────────────────────────────
  {
    id: 'polite_followup',
    style: 'Polite Follow-Up Nudge',
    generate: (ctx, url) => {
      const title = ctx.title || 'Listed Auction Lot';
      const headline = '👋 *Just checking in...*';
      const body = `Hi — hope you're doing well.\n\nWe noticed you viewed a lot recently but didn't place a bid:\n\n*${title}*\n\nTotally fine if it wasn't the right fit. But if you got busy and forgot — it's still live. Wanted to make sure it didn't slip through the cracks.\n\nNo pressure at all.`;
      return buildCopy('polite_followup', 'polite_followup', headline, body,
        '🔗 Take another look →', url,
        'Lelam — just a friendly nudge, not a push.');
    },
  },

  // ── 25. WhatsApp Forward Chain Style ───────────────────────────────────
  {
    id: 'forward_chain',
    style: 'WhatsApp Forward Chain Style',
    generate: (ctx, url) => {
      const title = ctx.title || 'Government Surplus Lot';
      const location = ctx.location || 'India';
      const headline = '🔁 *Forwarded — from a buyer group*';
      const body = `_⬇️ Forwarded message ⬇️_\n\nBhai someone just shared this in our buyer group:\n\n*${title}*\n📍 ${location}\n\nApparently docs are verified and bidding just opened. I haven't seen it on other platforms yet.\n\nSharing here before it gets crowded. Check karo.`;
      return buildCopy('forward_chain', 'forward_chain', headline, body,
        '👆 Open lot details →', url,
        'Lelam — where buyers share the good stuff first.');
    },
  },

  // ── 26. Broker / Dealer Style ──────────────────────────────────────────
  {
    id: 'broker_direct',
    style: 'Broker Dealer Direct Style',
    generate: (ctx, url) => {
      const title = ctx.title || 'Premium Scrap Lot';
      const location = ctx.location || 'Warehouse';
      const headline = '📞 *Lot update from your Lelam desk*';
      const body = `Sir/Ma'am,\n\nA lot matching your previous purchase history has been listed:\n\n*${title}*\n📍 ${location}\n\nKey details:\n• Reserve is competitive for this asset class\n• Inspection can be arranged at your convenience\n• Bidding is currently active with limited participants\n\nWould recommend a quick look at the documentation before end of day. Happy to assist with any queries.`;
      return buildCopy('broker_direct', 'broker_direct', headline, body,
        '📋 View lot documentation →', url,
        'Your Lelam account desk — always here to help.');
    },
  },

  // ── 27. Festival / Seasonal Theme ──────────────────────────────────────
  {
    id: 'festive_seasonal',
    style: 'Festival Seasonal Theme',
    generate: (ctx, url) => {
      const title = ctx.title || 'Special Listing';
      const headline = '🪔 *Festive Season Special on Lelam*';
      const body = `This season, while everyone's celebrating, some of the best lots are quietly going live.\n\n*${title}*\n\nFestive period = fewer active bidders = better odds for you.\n\nMost people are on holiday. The smart ones are bidding. Be the smart one. 🎯`;
      return buildCopy('festive_seasonal', 'festive_seasonal', headline, body,
        '🎁 Unwrap this lot →', url,
        'Lelam — the best deals come when others aren\'t looking.');
    },
  },

  // ── 28. ROI Calculator Hook ────────────────────────────────────────────
  {
    id: 'roi_calculator',
    style: 'ROI Calculator Value Pitch',
    generate: (ctx, url) => {
      const title = ctx.title || 'Recovery-Grade Scrap Lot';
      const category = ctx.category || 'scrap and industrial materials';
      const headline = '🧮 *Quick Back-of-Napkin Math*';
      const body = `Current market rate for ${category} is holding strong.\n\nNew lot:\n*${title}*\n\nBuyers who secured similar lots last quarter reported:\n• Recovery rates: 70-85% of gross weight\n• Turnaround time: 2-4 weeks\n• Net margin after logistics: Positive across all reported deals\n\nThe math works. The question is whether you'll be the one doing it or watching someone else do it.`;
      return buildCopy('roi_calculator', 'roi_calculator', headline, body,
        '🔢 Run your own numbers →', url,
        'Lelam — where the math always adds up.');
    },
  },

  // ── 29. Mystery / Reveal Teaser ────────────────────────────────────────
  {
    id: 'mystery_reveal',
    style: 'Mystery Lot Reveal Teaser',
    generate: (ctx, url) => {
      const title = ctx.title || 'Undisclosed High-Value Lot';
      const location = ctx.location ? `📍 Hint: ${ctx.location}` : '📍 Location: revealed on click';
      const headline = '🕵️ *A lot just dropped that we can\'t say too much about...*';
      const body = `Here's what we CAN tell you:\n\n• Category: ████████ _(tap to reveal)_\n• Asset condition: Verified ✅\n• Documentation: Complete ✅\n• Current bids: 0\n${location}\n\nAnd here's the actual listing:\n*${title}*\n\nCuriosity didn't kill the cat. Not clicking this link might cost you a great deal though.`;
      return buildCopy('mystery_reveal', 'mystery_reveal', headline, body,
        '🔓 Reveal the full lot →', url,
        'Lelam — some lots are too good to spoil in a message.');
    },
  },

  // ── 30. Night Owl / Late-Night Drop ────────────────────────────────────
  {
    id: 'night_owl',
    style: 'Late Night Drop Alert',
    generate: (ctx, url) => {
      const title = ctx.title || 'New Industrial Lot';
      const headline = '🌙 *Late-night lot drop — for the ones still awake*';
      const body = `Most buyers will see this tomorrow morning.\n\nYou're seeing it now:\n\n*${title}*\n\nBy the time India wakes up and checks their phones, early bidders will already be registered. Morning chai + this lot already bookmarked = a good start to the day.\n\nYour move, night owl. 🦉`;
      return buildCopy('night_owl', 'night_owl', headline, body,
        '🌙 Get ahead while they sleep →', url,
        'Lelam — the early owl catches the lot.');
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

// ---------------------------------------------------------------------------
// Outreach Templates — 12 cold outreach / onboarding styles
// ---------------------------------------------------------------------------

export interface OutreachContext {
  recipientName?: string;
  vertical?: string;
  region?: string;
}

interface OutreachTemplate {
  id: string;
  style: string;
  vertical: string;
  generate: (ctx: OutreachContext, url: string) => PromoCopy;
}

function buildOutreach(
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

export const OUTREACH_TEMPLATES: OutreachTemplate[] = [
  // ── 1. Government Timber / Forest Produce ──────────────────────────────
  {
    id: 'outreach_timber',
    style: 'Cold Outreach — Timber & Forest Produce',
    vertical: 'timber',
    generate: (ctx, url) => {
      const name = ctx.recipientName || 'there';
      const headline = '🌲 *Government timber auctions — one place to find them all*';
      const body = `Hi ${name},\n\nI'm reaching out from Lelam — we're building a smarter way to discover and track government auctions in India and we're onboarding our first set of users for free.\n\nIf you participate in MSTC forest produce or timber auctions, we think you'll find this useful:\n\n• All forest department & MSTC timber lots in one dashboard\n• Real-time alerts when new lots are listed\n• No more checking 5 different portals every morning`;
      return buildOutreach('outreach_timber', 'outreach_timber', headline, body,
        '🔗 Check it out when you get a sec →', url,
        'From the Lelam team. Have a good one! 🙌');
    },
  },

  // ── 2. Scrap & Metal Dealers ───────────────────────────────────────────
  {
    id: 'outreach_scrap',
    style: 'Cold Outreach — Scrap & Metal Dealers',
    vertical: 'scrap',
    generate: (ctx, url) => {
      const name = ctx.recipientName || 'there';
      const headline = '♻️ *Tired of missing good scrap lots?*';
      const body = `Hi ${name},\n\nQuick intro — we're Lelam, and we aggregate scrap metal and industrial surplus auctions from MSTC, government departments, and PSUs into a single platform.\n\nWhy dealers are switching to us:\n\n• Copper, steel, aluminium, cable scrap — all categories tracked\n• Alerts the moment a lot drops in your category\n• Verified documents, inspection details, bidding timelines\n• Free to use during our early access period\n\nWe've already got 100+ active scrap lots live right now.`;
      return buildOutreach('outreach_scrap', 'outreach_scrap', headline, body,
        '🔗 See what\'s live right now →', url,
        'Lelam — India\'s auction intelligence platform. No spam, just lots.');
    },
  },

  // ── 3. Vehicle / Fleet Buyers ──────────────────────────────────────────
  {
    id: 'outreach_vehicles',
    style: 'Cold Outreach — Vehicle & Fleet Auctions',
    vertical: 'vehicles',
    generate: (ctx, url) => {
      const name = ctx.recipientName || 'there';
      const headline = '🚗 *Government vehicle auctions — straight to your WhatsApp*';
      const body = `Hi ${name},\n\nLelam tracks vehicle and fleet disposal auctions from government departments, banks, and PSUs across India.\n\nCars, trucks, two-wheelers, heavy equipment — if a government body is auctioning it, we'll catch it.\n\n• Fleet disposals from state transport departments\n• Bank-seized vehicle auctions\n• Defence surplus vehicle lots\n• Real-time WhatsApp alerts\n\nWe're currently free for early adopters. Thought you'd want in.`;
      return buildOutreach('outreach_vehicles', 'outreach_vehicles', headline, body,
        '🔗 Browse vehicle lots →', url,
        'Lelam — never miss a government vehicle auction again.');
    },
  },

  // ── 4. Bank NPA / Stressed Asset Buyers ────────────────────────────────
  {
    id: 'outreach_npa',
    style: 'Cold Outreach — Bank NPA & Stressed Assets',
    vertical: 'bank_npa',
    generate: (ctx, url) => {
      const name = ctx.recipientName || 'there';
      const headline = '🏦 *Bank auction properties & NPAs — aggregated daily*';
      const body = `Hi ${name},\n\nIf you're tracking bank auction properties (SARFAESI, DRT, NCLT), Lelam might save you a few hours a week.\n\nWe pull NPA and stressed asset listings from BaankNet, bank websites, and MSTC into a single searchable dashboard.\n\n• Residential, commercial, industrial, and land parcels\n• Filter by bank, location, reserve price, auction date\n• Document verification status at a glance\n• WhatsApp alerts for new listings matching your criteria\n\nFree during early access. No strings.`;
      return buildOutreach('outreach_npa', 'outreach_npa', headline, body,
        '🔗 Explore bank auction listings →', url,
        'Lelam — India\'s unified eAuction intelligence platform.');
    },
  },

  // ── 5. Real Estate Investors ───────────────────────────────────────────
  {
    id: 'outreach_realestate',
    style: 'Cold Outreach — Real Estate Investors',
    vertical: 'real_estate',
    generate: (ctx, url) => {
      const name = ctx.recipientName || 'there';
      const headline = '🏠 *Below-market properties. Government-auctioned. Verified.*';
      const body = `Hi ${name},\n\nInvesting in auctioned properties? Lelam tracks government and bank property auctions across India — residential flats, commercial spaces, land parcels, and industrial plots.\n\nWhat makes us different:\n\n• We aggregate from 15+ sources (MSTC, BaankNet, state departments)\n• Every listing has reserve price, auction date, and document status\n• Location-based filtering — pin your target cities\n• WhatsApp alerts so you never miss a listing window\n\nEarly access is free. Most of our users are property investors like you.`;
      return buildOutreach('outreach_realestate', 'outreach_realestate', headline, body,
        '🔗 See auction properties near you →', url,
        'Lelam — where smart investors find below-market deals.');
    },
  },

  // ── 6. MSTC Regular Buyers ─────────────────────────────────────────────
  {
    id: 'outreach_mstc',
    style: 'Cold Outreach — MSTC Regular Buyers',
    vertical: 'mstc',
    generate: (ctx, url) => {
      const name = ctx.recipientName || 'there';
      const headline = '📋 *Still checking MSTC manually every morning?*';
      const body = `Hi ${name},\n\nIf you bid on MSTC auctions regularly, you know the drill — log in, scroll through dozens of categories, open each lot, check documents, note closing dates... every single day.\n\nLelam does that for you.\n\n• We scrape MSTC listings automatically throughout the day\n• Filter by your categories — scrap, vehicles, timber, surplus, equipment\n• Get WhatsApp alerts the moment something relevant drops\n• All documentation links and bidding timelines in one view\n\nFree to use. Set up takes 2 minutes.`;
      return buildOutreach('outreach_mstc', 'outreach_mstc', headline, body,
        '🔗 Set up your alerts →', url,
        'Lelam — your MSTC dashboard, simplified.');
    },
  },

  // ── 7. Hinglish Casual Outreach ────────────────────────────────────────
  {
    id: 'outreach_hinglish',
    style: 'Cold Outreach — Hinglish Casual',
    vertical: 'general',
    generate: (ctx, url) => {
      const name = ctx.recipientName || 'Bhai';
      const headline = '🫡 *Ek minute — ye kaam ka hai*';
      const body = `Hi ${name},\n\nLelam naam ka ek platform hai — government auctions (MSTC, bank, PSU) ek jagah pe dikhata hai.\n\nScrap, property, vehicle, timber — jo bhi category mein bid karte ho, uska alert seedha WhatsApp pe aa jayega.\n\n• Roz subah portal check karne ki zaroorat nahi\n• Naya lot aaye — turant pata chale\n• Docs, price, timeline — sab ek click mein\n\nAbhi free hai. Baad mein paid hoga. Early access le lo.`;
      return buildOutreach('outreach_hinglish', 'outreach_hinglish', headline, body,
        '👉 Dekh lo →', url,
        'Lelam — auction ka WhatsApp buddy. 🤙');
    },
  },

  // ── 8. Professional LinkedIn-Style ─────────────────────────────────────
  {
    id: 'outreach_professional',
    style: 'Cold Outreach — Professional LinkedIn-Style',
    vertical: 'general',
    generate: (ctx, url) => {
      const name = ctx.recipientName || 'there';
      const region = ctx.region || 'India';
      const headline = '🏛️ *Quick introduction — Lelam Auction Intelligence*';
      const body = `Dear ${name},\n\nI'm writing from Lelam, an auction intelligence platform that aggregates government and institutional auctions across ${region}.\n\nWe bring together listings from MSTC, BaankNet, GeM, state government departments, and PSUs — into a single searchable interface with real-time WhatsApp alerts.\n\nOur platform currently tracks:\n• Industrial scrap & surplus equipment\n• Bank-auctioned properties (SARFAESI/NPA)\n• Government vehicle disposals\n• Forest produce & timber auctions\n\nWe're currently offering free early access to qualified buyers. I'd welcome the opportunity to show you how it works.\n\nWould a 5-minute walkthrough interest you?`;
      return buildOutreach('outreach_professional', 'outreach_professional', headline, body,
        '🔗 Learn more about Lelam →', url,
        'Lelam — India\'s Unified eAuction Intelligence Platform.');
    },
  },

  // ── 9. Problem-First / Pain Point ──────────────────────────────────────
  {
    id: 'outreach_pain_point',
    style: 'Cold Outreach — Pain Point First',
    vertical: 'general',
    generate: (ctx, url) => {
      const name = ctx.recipientName || 'there';
      const headline = '😤 *5 tabs. 3 portals. 2 hours. Zero results.*';
      const body = `Sound familiar, ${name}?\n\nEvery morning, serious auction buyers in India go through the same ritual:\n\n1. Check MSTC — scroll through 20 pages\n2. Check BaankNet — different UI, different login\n3. Check GeM — another portal, another format\n4. Check state department websites — half of them are broken\n5. Make a spreadsheet — manually\n\nWe built Lelam because we got tired of watching smart buyers waste time on this.\n\n*One platform. All auctions. WhatsApp alerts.*\n\nFree during early access.`;
      return buildOutreach('outreach_pain_point', 'outreach_pain_point', headline, body,
        '🔗 End the morning ritual →', url,
        'Lelam — because life is too short for 5 government portals.');
    },
  },

  // ── 10. Referral / Word of Mouth ───────────────────────────────────────
  {
    id: 'outreach_referral',
    style: 'Cold Outreach — Referral Style',
    vertical: 'general',
    generate: (ctx, url) => {
      const name = ctx.recipientName || 'there';
      const headline = '👋 *Someone in your network thought you\'d find this useful*';
      const body = `Hi ${name},\n\nWe were chatting with some auction buyers in your area, and your name came up as someone active in government auctions.\n\nLelam is a free platform that tracks MSTC, bank, and government auction listings — all in one place with WhatsApp alerts.\n\nA few buyers from your region are already using it. Thought it'd be worth a quick look.\n\nNo sign-up required to browse. Takes 30 seconds to see if there's anything relevant.`;
      return buildOutreach('outreach_referral', 'outreach_referral', headline, body,
        '🔗 Quick look — no sign-up needed →', url,
        'Lelam — trusted by auction buyers across India.');
    },
  },

  // ── 11. Competitor Comparison / Switcher ───────────────────────────────
  {
    id: 'outreach_switcher',
    style: 'Cold Outreach — Competitor Comparison',
    vertical: 'general',
    generate: (ctx, url) => {
      const name = ctx.recipientName || 'there';
      const headline = '⚡ *Still relying on brokers for auction info?*';
      const body = `Hi ${name},\n\nMost auction buyers in India still depend on:\n\n❌ Brokers who charge commission for information\n❌ WhatsApp groups full of outdated forwards\n❌ Manually refreshing government portal pages\n\nLelam replaces all three.\n\n✅ Direct from source — MSTC, BaankNet, GeM, state departments\n✅ Real-time WhatsApp alerts — no middleman\n✅ Verified documents and bidding timelines\n✅ Free during early access\n\nThe information was always public. We just made it accessible.`;
      return buildOutreach('outreach_switcher', 'outreach_switcher', headline, body,
        '🔗 Try the direct source →', url,
        'Lelam — cut the middleman, not the deal.');
    },
  },

  // ── 12. Region-Specific Outreach ───────────────────────────────────────
  {
    id: 'outreach_regional',
    style: 'Cold Outreach — Region-Specific',
    vertical: 'general',
    generate: (ctx, url) => {
      const name = ctx.recipientName || 'there';
      const region = ctx.region || 'your area';
      const headline = `📍 *Government auctions near ${region} — tracked for you*`;
      const body = `Hi ${name},\n\nWe noticed a lot of auction activity happening around ${region} lately — scrap disposals, bank properties, vehicle lots.\n\nLelam tracks all government and bank auctions across India, and you can filter by location to see only what's near you.\n\nHere's what's currently live around ${region}:\n\n• Multiple MSTC lots with open bidding\n• Bank auction properties (SARFAESI)\n• PSU surplus disposals\n\nAll verified. All in one place. Free to access.\n\nWorth a 30-second look to see if anything matches.`;
      return buildOutreach('outreach_regional', 'outreach_regional', headline, body,
        `🔗 See auctions near ${region} →`, url,
        'Lelam — local auctions, zero noise.');
    },
  },
];

// ---------------------------------------------------------------------------
// Outreach Generator
// ---------------------------------------------------------------------------

/**
 * Generates outreach copy for cold messaging potential users.
 * Picks a specific style by ID, or selects one at random.
 */
export function generateOutreachCopy(
  ctx: OutreachContext = {},
  styleId?: string,
  appBaseUrl: string = 'https://lelam.co'
): PromoCopy {
  const url = `${appBaseUrl}/auctions`;

  if (styleId) {
    const template = OUTREACH_TEMPLATES.find(t => t.id === styleId);
    if (template) return template.generate(ctx, url);
  }

  const randomIndex = Math.floor(Math.random() * OUTREACH_TEMPLATES.length);
  return OUTREACH_TEMPLATES[randomIndex].generate(ctx, url);
}

