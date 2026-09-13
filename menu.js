/* ===========================================================================
   MC TAP — MENU DATA
   ===========================================================================
   Transcribed from the printed 2026 menu. Prices are real.

   Two things are still guesses and are marked TODO below:
     - add-on prices (bacon, cheese, mushrooms) were inferred from the gaps
       between menu items, not read off a menu
     - the cheese varieties offered on a cheeseburger
   =========================================================================== */

window.MCTAP_CONFIG = {
  pricesConfirmed: true,

  // Flip to true to stop taking orders (kitchen slammed, closing early).
  orderingPaused: false,

  prepMinutes: 20,
  lastOrderBeforeCloseMinutes: 45,

  // null = don't show a tax line, just say tax is added at the bar.
  // Put the real combined Ogle County rate here (e.g. 0.0725) once confirmed.
  taxRate: null,

  phone: "+18153933503",
  phoneDisplay: "(815) 393-3503",

  // Shown on the order page. Applied by the bar at payment, not by this page.
  dailySpecials: [
    "Sunday: buy any burger, get one half off. Equal or lesser value. And $1 off Bloody Marys.",
    "Monday: $1 off all sandwiches. $2.75 domestic cans.",
    "Tuesday: $1 off all burgers and Tap Bites. $1 off drafts.",
    "Wednesday: $1 off all baskets. $1 off whiskey mixers.",
    "Thursday: taco day. Buy two tacos, get one for $1. $3.50 Corona or Modelo.",
    "Friday: $2.75 domestic bottles. $3 Jackson Morgan and Dr. shots.",
    "Saturday: $1 off Captain, Jack or Tito's mixers. $8 Coronita or Modelito buckets."
  ],

  // ---- WHERE ORDERS GO -------------------------------------------------
  //
  // PRIVACY: everything in this file is public. It ships to the browser as
  // plain text and anyone can read it with View Source. Never put a personal
  // phone number or private email address in here.
  //
  // OPTION A (recommended) — set `endpoint` to a URL.
  //   The order is POSTed there as JSON. The destination phone number or
  //   inbox lives in that service's settings, NOT in this file, so nothing
  //   personal is ever published. Use a Formspree form, a Zapier or Make
  //   webhook, or a small serverless function.
  //
  // OPTION B — leave `endpoint` null and set a public contact below.
  //   The customer gets a finished ticket and sends it themselves. Only use
  //   a number or address the bar is happy to publish. A free Google Voice
  //   number works well: it can receive texts, it forwards to whoever is
  //   working, and it can be reassigned later without touching the website.
  //
  // Set either of these to null and that button disappears. With both null
  // the customer gets "copy the order" and "call it in" instead, which is
  // always safe.
  endpoint: null,
  orderTextTo: null,
  orderEmailTo: null
};

/* ---- shared option groups ---- */

var DONENESS = {
  id: "temp", label: "How do you want it cooked?", type: "single", required: true,
  options: [
    { label: "Medium", price: 0 },
    { label: "Medium well", price: 0 },
    { label: "Well done", price: 0 }
  ]
};

var DOUBLE = {
  id: "size", label: "Size", type: "single", required: true,
  options: [
    { label: "Single (1/2 lb)", price: 0 },
    { label: "Make it a double", price: 4.00 }
  ]
};

/* TODO: confirm which cheeses are actually stocked. */
var CHEESE = {
  id: "cheese", label: "Cheese", type: "single",
  options: [
    { label: "American", price: 0 },
    { label: "Swiss", price: 0 },
    { label: "Cheddar", price: 0 },
    { label: "Pepper jack", price: 0 }
  ]
};

/* TODO: these prices are inferred from the menu, not confirmed.
   Cheeseburger is $1.00 over Hamburger, so cheese ≈ $1.00.
   Bacon Cheeseburger and Mushroom Swiss are both $1.25 over Cheeseburger. */
var ADDONS = {
  id: "addons", label: "Add anything?", type: "multi",
  options: [
    { label: "Bacon", price: 1.25 },
    { label: "Sautéed mushrooms", price: 1.25 },
    { label: "Grilled onions", price: 0.75 },
    { label: "Extra cheese", price: 1.00 }
  ]
};

var HOLDS = {
  id: "holds", label: "Hold anything?", type: "multi",
  options: [
    { label: "No lettuce", price: 0 },
    { label: "No tomato", price: 0 },
    { label: "No onion", price: 0 },
    { label: "No pickle", price: 0 },
    { label: "No mayo", price: 0 },
    { label: "No ketchup", price: 0 },
    { label: "No mustard", price: 0 }
  ]
};

/* Burgers and sandwiches do NOT come with a side. Baskets do. */
var ADD_SIDE = {
  id: "side", label: "Add a side?", type: "single",
  options: [
    { label: "No side", price: 0 },
    { label: "Fries", price: 2.75 },
    { label: "Curly fries", price: 3.75 },
    { label: "Tater tots", price: 5.25 },
    { label: "Onion rings", price: 7.75 },
    { label: "Cheese curds", price: 9.00 }
  ]
};

var BASKET_SAUCE = {
  id: "sauce", label: "Choice of sauce", type: "single", required: true,
  options: [
    { label: "Ranch", price: 0 },
    { label: "Honey mustard", price: 0 },
    { label: "BBQ", price: 0 },
    { label: "Buffalo", price: 0 },
    { label: "Tartar", price: 0 }
  ]
};

window.MCTAP_MENU = [
  {
    id: "burgers",
    name: "Burgers",
    note: "Half a pound, cooked to order. Make any of them a double for $4.00 more. Burgers don't come with a side — add one below if you want it.",
    items: [
      { id: "hamburger", name: "Hamburger", desc: "Half a pound, no cheese.", price: 10.00,
        groups: [ DOUBLE, DONENESS, ADDONS, HOLDS, ADD_SIDE ] },
      { id: "cheeseburger", name: "Cheeseburger", desc: "The reason people make the drive.", price: 11.00,
        image: "images/classic-burger.jpg",
        groups: [ DOUBLE, DONENESS, CHEESE, ADDONS, HOLDS, ADD_SIDE ] },
      { id: "bacon-cheeseburger", name: "Bacon Cheeseburger", desc: "Nobody has ever accused us of going light on the bacon.", price: 12.25,
        image: "images/bacon-burger.jpg",
        groups: [ DOUBLE, DONENESS, CHEESE, ADDONS, HOLDS, ADD_SIDE ] },
      { id: "mushroom-swiss", name: "Mushroom Swiss Burger", desc: "Sautéed mushrooms, Swiss melted over the edge.", price: 12.25,
        image: "images/mushroom-swiss.jpg",
        groups: [ DOUBLE, DONENESS, ADDONS, HOLDS, ADD_SIDE ] },
      { id: "veggie-burger", name: "Veggie Burger", desc: "", price: 8.50,
        groups: [ CHEESE, HOLDS, ADD_SIDE ] }
    ]
  },
  {
    id: "sandwiches",
    name: "Sandwiches",
    items: [
      { id: "patty-melt", name: "Patty Melt", desc: "Grilled onions and cheese on toasted rye.", price: 11.00,
        groups: [ DONENESS, HOLDS, ADD_SIDE ] },
      { id: "pork-tenderloin", name: "Pork Tenderloin", desc: "Hangs off the bun the way it ought to.", price: 11.25,
        image: "images/breaded-sandwich.jpg",
        groups: [ HOLDS, ADD_SIDE ] },
      { id: "grilled-chicken", name: "Grilled Chicken", desc: "", price: 10.75,
        groups: [ CHEESE, HOLDS, ADD_SIDE ] },
      { id: "pork-chop", name: "Pork Chop", desc: "", price: 10.75,
        groups: [ HOLDS, ADD_SIDE ] },
      { id: "chicken-club", name: "Chicken Club", desc: "Grilled or fried.", price: 12.50,
        groups: [
          { id: "prep", label: "Grilled or fried?", type: "single", required: true,
            options: [ { label: "Grilled", price: 0 }, { label: "Fried", price: 0 } ] },
          HOLDS, ADD_SIDE ] },
      { id: "cod-sandwich", name: "Battered Cod Fillet", desc: "With cheese.", price: 11.25,
        groups: [ HOLDS, ADD_SIDE ] }
    ]
  },
  {
    id: "baskets",
    name: "Baskets",
    note: "Every basket comes with fries and your choice of sauce.",
    items: [
      { id: "cod-sticks", name: "Battered Cod Sticks", desc: "", price: 10.75, groups: [ BASKET_SAUCE ] },
      { id: "chicken-tenders", name: "Chicken Tenders", desc: "Breaded and fried.", price: 11.00,
        image: "images/chicken-tenders.jpg", groups: [ BASKET_SAUCE ] },
      { id: "wings-half", name: "Boneless Wings, half pound", desc: "", price: 8.75, groups: [ BASKET_SAUCE ] },
      { id: "wings-full", name: "Boneless Wings, full pound", desc: "", price: 16.50, groups: [ BASKET_SAUCE ] }
    ]
  },
  {
    id: "thursday",
    name: "Thursday Tacos",
    note: "Thursdays only. Buy two hard or soft shell tacos and get a third for $1 — the bar sorts that out when you pay.",
    items: [
      { id: "taco", name: "Taco", desc: "Hard or soft shell.", price: 2.75,
        image: "images/taco-thursday.jpg",
        groups: [
          { id: "shell", label: "Shell", type: "single", required: true,
            options: [ { label: "Hard shell", price: 0 }, { label: "Soft shell", price: 0 } ] },
          { id: "taco-holds", label: "Hold anything?", type: "multi",
            options: [
              { label: "No cheese", price: 0 }, { label: "No lettuce", price: 0 },
              { label: "No tomato", price: 0 }, { label: "No onion", price: 0 },
              { label: "No sour cream", price: 0 }
            ] }
        ] },
      { id: "taco-salad", name: "Taco Salad", desc: "", price: 5.75,
        image: "images/walking-taco.jpg",
        groups: [ { id: "salad-holds", label: "Hold anything?", type: "multi",
          options: [ { label: "No sour cream", price: 0 }, { label: "No tomato", price: 0 }, { label: "No onion", price: 0 } ] } ] },
      { id: "loaded-nachos", name: "Loaded Nachos", desc: "", price: 6.75, groups: [] },
      { id: "fairdale-fries", name: "Fairdale Fries", desc: "", price: 6.25, groups: [] }
    ]
  },
  {
    id: "tapbites",
    name: "Tap Bites",
    items: [
      { id: "fries", name: "Fries", desc: "", price: 2.75 },
      { id: "curly-fries", name: "Curly Fries", desc: "", price: 3.75 },
      { id: "tots", name: "Tater Tots", desc: "", price: 5.25 },
      { id: "corn-bites", name: "Corn Bites", desc: "", price: 7.00 },
      { id: "mini-corn-dogs", name: "Mini Corn Dogs", desc: "", price: 7.25 },
      { id: "portobello", name: "Portobello Mushrooms", desc: "", price: 7.50 },
      { id: "cauliflower", name: "Breaded Cauliflower", desc: "", price: 7.75 },
      { id: "onion-rings", name: "Onion Rings", desc: "Hand-battered.", price: 7.75 },
      { id: "mac-bites", name: "Mac N Cheese Bites", desc: "", price: 8.25 },
      { id: "curds", name: "Cheese Curds", desc: "Fried golden, squeaky inside.", price: 9.00 }
    ]
  }
];
