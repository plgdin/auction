export interface ZomatoAuctionContext {
  id?: string;
  title?: string;
  price?: number | string;
  location?: string;
  category?: string;
  closingTime?: string;
}

export interface ZomatoCopy {
  id: string;
  style: string;
  headline: string;
  body: string;
  ctaText: string;
  fullMessage: string;
}

export const ZOMATO_HOOK_TEMPLATES = [
  {
    id: 'typo_glitch',
    style: 'The "Did Someone Mess Up?" Glitch Hook',
    generate: (ctx: ZomatoAuctionContext, url: string): ZomatoCopy => {
      const title = ctx.title || 'Heavy Industrial Equipment & Copper Scrap Lot';
      const price = ctx.price ? `₹${Number(ctx.price).toLocaleString('en-IN')}` : 'Crazy Low Reserve Price';
      const headline = '👀 WAIT... Did the bank manager make a typo?!';
      const body = `Someone just listed "${title}" starting at ${price}. We literally had to double-check the documents twice. Either the auctioneer is feeling generous or someone's getting fired tomorrow morning. 🏃‍♂️💨`;
      const ctaText = 'Check it before they fix it 👉';
      return {
        id: 'typo_glitch',
        style: 'typo_glitch',
        headline,
        body,
        ctaText,
        fullMessage: `${headline}\n\n${body}\n\n${ctaText} ${url}\n\n_(Psst... bids close soon. Don't say we didn't warn you!)_`,
      };
    },
  },
  {
    id: 'rival_dealer',
    style: 'The "Your Competitor is Watching" Hook',
    generate: (ctx: ZomatoAuctionContext, url: string): ZomatoCopy => {
      const title = ctx.title || 'Grade-A Metal Scrap & Plant Machinery';
      const location = ctx.location ? ` in ${ctx.location}` : '';
      const headline = '🚨 STOP SCROLLING! Your rival scrap dealer is watching this.';
      const body = `Word on the street is 3 local buyers are eyeing the new auction for "${title}"${location}. While you're sipping chai, someone else is about to lock in 35% margin.`;
      const ctaText = 'Steal the deal first ⚡';
      return {
        id: 'rival_dealer',
        style: 'rival_dealer',
        headline,
        body,
        ctaText,
        fullMessage: `${headline}\n\n${body}\n\n${ctaText} ${url}\n\n_Don't let them walk away with your margin._`,
      };
    },
  },
  {
    id: 'food_craving',
    style: 'The Classic Zomato Food & Hunger Hook',
    generate: (ctx: ZomatoAuctionContext, url: string): ZomatoCopy => {
      const title = ctx.title || 'Government Surplus Vehicle & Scrap Tender';
      const headline = '🍽️ Butter Chicken is temporary. 40% margin on scrap is forever.';
      const body = `You were probably thinking about lunch or doomscrolling reels. Instead, take 30 seconds to look at "${title}". Hotter than piping-hot samosas and priced to move today.`;
      const ctaText = 'Taste the profit 🤤👉';
      return {
        id: 'food_craving',
        style: 'food_craving',
        headline,
        body,
        ctaText,
        fullMessage: `${headline}\n\n${body}\n\n${ctaText} ${url}\n\n_Delivered hot to your watchlist. Zero delivery fees._`,
      };
    },
  },
  {
    id: 'clickbait_discount',
    style: 'The "90% OFF?! Okay Not Really" Bait & Switch',
    generate: (ctx: ZomatoAuctionContext, url: string): ZomatoCopy => {
      const title = ctx.title || 'Bank NPA Commercial & Industrial Lot';
      const headline = '🔥 90% DISCOUNT ON PRIME ASSETS?!!';
      const body = `Okay fine, it's not 90% off. We lied. 😔\n\nBUT "${title}" just dropped on Lelam with a rock-bottom reserve price that might as well be free money for anyone with an active bidder account.`;
      const ctaText = 'Forgive us & see the lot 👀';
      return {
        id: 'clickbait_discount',
        style: 'clickbait_discount',
        headline,
        body,
        ctaText,
        fullMessage: `${headline}\n\n${body}\n\n${ctaText} ${url}\n\n_Trust us, your accountant will thank you._`,
      };
    },
  },
  {
    id: 'midnight_secret',
    style: 'The "We Weren\'t Supposed to Share This" VIP Hook',
    generate: (ctx: ZomatoAuctionContext, url: string): ZomatoCopy => {
      const title = ctx.title || 'PSU High-Recovery Transformer & Cable Lot';
      const headline = '🤫 DELETE THIS MESSAGE AFTER READING...';
      const body = `Our team was asked to keep this quiet until official catalog launch, but we like you better: "${title}" has ZERO registered bids right now. That means someone could literally win this at base price.`;
      const ctaText = 'Be that someone 🎯';
      return {
        id: 'midnight_secret',
        style: 'midnight_secret',
        headline,
        body,
        ctaText,
        fullMessage: `${headline}\n\n${body}\n\n${ctaText} ${url}\n\n_Exclusive alert for active Lelam traders._`,
      };
    },
  },
  {
    id: 'fomo_heartbreak',
    style: 'The "Worse Than Heartbreak" FOMO Hook',
    generate: (ctx: ZomatoAuctionContext, url: string): ZomatoCopy => {
      const title = ctx.title || 'Disposal Auction Lot';
      const timeLeft = ctx.closingTime || 'a few hours';
      const headline = '💔 Missing this will hurt more than an "I see you as a friend" text.';
      const body = `Clock is ticking fast. Only ${timeLeft} left on "${title}". If you wake up tomorrow and see it closed for pennies, you will punch the air in regret.`;
      const ctaText = 'Place a bid or cry later ⏰';
      return {
        id: 'fomo_heartbreak',
        style: 'fomo_heartbreak',
        headline,
        body,
        ctaText,
        fullMessage: `${headline}\n\n${body}\n\n${ctaText} ${url}\n\n_Tick tock... bidding window is closing!_`,
      };
    },
  },
];

/**
 * Returns a cheeky Zomato-style copy for a given auction
 */
export function generateZomatoCopy(
  ctx: ZomatoAuctionContext = {},
  styleId?: string,
  appBaseUrl: string = 'https://lelam.co'
): ZomatoCopy {
  const url = ctx.id ? `${appBaseUrl}/auctions/${ctx.id}` : `${appBaseUrl}/auctions`;

  if (styleId) {
    const template = ZOMATO_HOOK_TEMPLATES.find(t => t.id === styleId);
    if (template) return template.generate(ctx, url);
  }

  // Random hook
  const randomIndex = Math.floor(Math.random() * ZOMATO_HOOK_TEMPLATES.length);
  return ZOMATO_HOOK_TEMPLATES[randomIndex].generate(ctx, url);
}
