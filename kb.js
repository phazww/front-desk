// Everything the assistant is allowed to know. The bakery is made up for this demo.
// `words` are extra search words, so a question like "can I pay with Apple Pay" finds the right entry.
window.BUSINESS = {
  name: "Juniper Street Bakery",
  phone: "+1 555 0142",
  email: "hello@juniperstreet.example"
};

window.KB = [
  { id: "hours", title: "Opening hours",
    text: "We are open Tuesday to Friday from 7:00 to 18:00, Saturday from 8:00 to 16:00, and Sunday from 8:00 to 13:00. We are closed on Mondays.",
    words: "open opening close closed closing hours time when today tomorrow weekend monday tuesday wednesday thursday friday saturday sunday morning evening" },
  { id: "address", title: "Where we are",
    text: "Juniper Street Bakery is at 14 Juniper Street. The nearest bus stop is Market Square, a 3 minute walk away.",
    words: "address where location find located directions bus street map near" },
  { id: "parking", title: "Parking",
    text: "There is no parking lot at the bakery. Street parking on Juniper Street is free after 18:00 and on Sundays.",
    words: "park parking car lot drive" },
  { id: "bread", title: "Bread",
    text: "Bread prices: sourdough loaf $7, rye loaf $8, baguette $3.50, seeded loaf $8.50. Bread is baked every morning and on Saturdays it usually sells out by 14:00.",
    words: "bread loaf loaves sourdough rye baguette seeded price cost much fresh baked sell out" },
  { id: "pastries", title: "Pastries",
    text: "Pastries: croissant $3.80, pain au chocolat $4.20, cinnamon roll $4.50, almond croissant $4.90.",
    words: "pastry pastries croissant croissants chocolate cinnamon roll almond price cost much" },
  { id: "coffee", title: "Coffee and seats",
    text: "We serve filter coffee for $3, cappuccino for $4.20 and tea for $2.80. There are 12 seats inside.",
    words: "coffee cappuccino latte tea drink drinks sit seat seats inside eat price cost much" },
  { id: "cakes", title: "Custom cakes",
    text: "Custom cakes start at $45 for a 6 inch cake and $65 for an 8 inch cake. Please order at least 72 hours in advance. A 50% deposit confirms the order.",
    words: "cake cakes custom birthday wedding anniversary order inch size price cost much deposit advance notice tomorrow" },
  { id: "cake-order", title: "How to order a cake",
    text: "To order a custom cake, call us or fill in the order form on this site. We confirm every order by phone within one working day.",
    words: "order ordering how form book booking confirm confirmation cake" },
  { id: "allergens", title: "Allergens",
    text: "Everything is made in a kitchen that uses wheat, eggs, milk, nuts and sesame, so we cannot promise that any product is free of these allergens. We bake one gluten-free loaf on Fridays, in the same kitchen.",
    words: "allergy allergies allergen allergens nut nuts peanut gluten free wheat egg eggs milk dairy lactose sesame celiac coeliac safe" },
  { id: "vegan", title: "Vegan options",
    text: "Our sourdough loaf, rye loaf and baguette are vegan. None of our pastries are vegan.",
    words: "vegan plant based dairy free egg free animal" },
  { id: "delivery", title: "Delivery",
    text: "We deliver cake orders only, within 5 km of the bakery, for a $10 fee. Bread and pastries are not delivered.",
    words: "deliver delivery delivered deliveries ship shipping send bring home fee km distance city" },
  { id: "payment", title: "Payment",
    text: "We take cards, Apple Pay and cash. There is no minimum for card payments.",
    words: "pay payment card cards credit debit apple google cash minimum contactless" },
  { id: "contact", title: "Contact",
    text: "Phone: +1 555 0142. Email: hello@juniperstreet.example. We answer the phone during opening hours.",
    words: "phone call number email contact reach talk speak" }
];
