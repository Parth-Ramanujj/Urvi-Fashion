// Shared (server + client) i18n and currency. Add a language by adding a dictionary; missing keys fall back to English.
export const LANGS = { en: "English", hi: "हिन्दी" } as const;
export type Lang = keyof typeof LANGS;

// Add a currency here (with a live FX rate source) to offer it in the picker; INR is the store currency.
export const CURRENCIES = {
  INR: { rate: 1, locale: "en-IN" },
} as const;
export type Currency = keyof typeof CURRENCIES;

export function formatMoney(inr: number, currency: Currency = "INR") {
  const c = CURRENCIES[currency] ?? CURRENCIES.INR;
  return new Intl.NumberFormat(c.locale, { style: "currency", currency, maximumFractionDigits: currency === "INR" ? 0 : 2 }).format(inr * c.rate);
}

const en = {
  "nav.home": "Home", "nav.shop": "Shop all", "nav.men": "Men", "nav.women": "Women", "nav.kids": "Kids", "nav.accessories": "Accessories", "nav.seasonal": "Seasonal",
  "search.placeholder": "Search for tees, dresses, brands…", "search.listening": "Listening…",
  "cart.title": "Your bag", "cart.empty": "Your bag is empty", "cart.checkout": "Checkout", "cart.view": "View bag",
  "pdp.addToBag": "Add to bag", "pdp.selectSize": "Select size", "pdp.sizeGuide": "Size guide", "pdp.wishlist": "Wishlist", "pdp.inStock": "In stock", "pdp.outOfStock": "Out of stock", "pdp.onlyLeft": "Only {n} left in stock!", "pdp.youMayLike": "You may also like", "pdp.reviews": "Ratings & reviews",
  "home.trending": "Trending now", "home.new": "New arrivals", "home.best": "Best sellers", "home.flash": "Flash sale", "home.endsIn": "Ends in", "home.categories": "Shop by category",
  "acct.login": "Log in", "acct.logout": "Log out", "acct.account": "Account", "acct.orders": "Orders", "acct.wishlist": "Wishlist",
  "common.viewAll": "View all", "common.sort": "Sort", "common.filters": "Filters", "common.clear": "Clear all", "common.results": "{n} styles",
};
type Dict = Partial<Record<keyof typeof en, string>>;
const hi: Dict = {
  "nav.home": "होम", "nav.shop": "सभी देखें", "nav.men": "पुरुष", "nav.women": "महिलाएं", "nav.kids": "बच्चे", "nav.accessories": "एक्सेसरीज़", "nav.seasonal": "मौसमी",
  "search.placeholder": "टी-शर्ट, ड्रेस, ब्रांड खोजें…", "search.listening": "सुन रहे हैं…",
  "cart.title": "आपका बैग", "cart.empty": "आपका बैग खाली है", "cart.checkout": "चेकआउट", "cart.view": "बैग देखें",
  "pdp.addToBag": "बैग में डालें", "pdp.selectSize": "साइज़ चुनें", "pdp.sizeGuide": "साइज़ गाइड", "pdp.wishlist": "विशलिस्ट", "pdp.inStock": "स्टॉक में", "pdp.outOfStock": "स्टॉक खत्म", "pdp.onlyLeft": "केवल {n} बचे हैं!", "pdp.youMayLike": "आपको यह भी पसंद आ सकता है", "pdp.reviews": "रेटिंग और समीक्षाएं",
  "home.trending": "ट्रेंडिंग", "home.new": "नए आगमन", "home.best": "बेस्ट सेलर", "home.flash": "फ़्लैश सेल", "home.endsIn": "समाप्त होगा", "home.categories": "श्रेणी अनुसार खरीदें",
  "acct.login": "लॉग इन", "acct.logout": "लॉग आउट", "acct.account": "खाता", "acct.orders": "ऑर्डर", "acct.wishlist": "विशलिस्ट",
  "common.viewAll": "सभी देखें", "common.sort": "क्रमबद्ध करें", "common.filters": "फ़िल्टर", "common.clear": "सब हटाएं", "common.results": "{n} स्टाइल",
};
const DICTS: Record<Lang, Dict> = { en, hi };
export type TKey = keyof typeof en;

export function translator(lang: Lang) {
  const d = DICTS[lang] ?? en;
  return (key: TKey, vars?: Record<string, string | number>) =>
    (d[key] ?? en[key]).replace(/\{(\w+)\}/g, (_, k) => String(vars?.[k] ?? ""));
}
