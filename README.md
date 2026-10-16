# Front Desk

A demo of a chat assistant for a small business site that only says what the site says.

Live demo: https://phazww.github.io/front-desk/

Most site chatbots will invent a price or an opening time if you ask the right way. Here the model only drafts the answer. Code decides what the customer sees:

1. **Find.** `desk.js` picks up to three entries of the site's content that match the question. If nothing matches, the model is not asked and the customer gets the phone number.
2. **Draft.** An open-weight model running in the browser (WebLLM: Gemma 4 E2B or Qwen 3.5 2B) reads only those entries and returns JSON: the answer, the id of the source entry and the sentence it took the answer from.
3. **Check.** The quoted sentence must really be in that entry, and every number in the answer (prices, times, sizes) must appear in it. "4 pm" is read as 16:00; "$4" does not pass for $4.50.
4. **Show or step back.** If any check fails, the draft is dropped and the customer sees the entry's exact text, or the contact details.

The bakery in the demo, Juniper Street Bakery, is made up. Its whole "site" is in `kb.js`.

## Files

- `kb.js`: the business content, the only thing the assistant may use
- `desk.js`: search, prompt, JSON schema and the checks (no dependencies, also runs in Node)
- `app.js`: the chat, model loading and the recorded answers
- `tests.js`: 31 questions with known answers, 8 of them not answerable from the site

## Run the tests

Open the page with `#tests` in a browser with WebGPU and press the button. The model downloads once and is cached.

## Widget

`widget.js` adds a chat button to any site with one script tag (see `widget.html`):

```html
<script src="https://phazww.github.io/front-desk/widget.js"
        data-content="https://your-site.com/front-desk.json" async></script>
```

Without `data-endpoint` it runs in quote mode: no model, it shows the closest part of the site word for word, or the contact details. With `data-endpoint` (an OpenAI-compatible proxy that holds the key) it drafts answers and runs the same checks, falling back to quote mode when a check fails. On the 31 test questions, quote mode shows the right part of the site or declines in 30 cases; the test questions were also used while writing the search words and rules, so expect less on new content.

## Import a site

```
node tools/import-site.js https://example-cafe.com > front-desk.json
```

Fetches the home page and up to 12 linked pages of the same site (one request at a time), cuts the text into entries at headings, drops embedded social feeds, finds the phone and email, and adds search hints to entries that contain an address, hours, prices, allergens, orders, delivery, parking or reservations. The result is a draft to read and fix by hand. Menus published as images or PDFs are not read, so prices often have to be added by hand.

## Use it on a real site

Replace `kb.js` with the business's own content and write a test set from real customer questions. The checks do not depend on the model, so a hosted model can replace the in-browser one.

Made by [@phaz_dev](https://x.com/phaz_dev). Services: [Contra](https://contra.com/phaz_3lpd033k).
