# erictxie

My personal website: a toy box. The name hangs from strings, projects fall
from the sky, and everything obeys (or defies) gravity via
[matter.js](https://brm.io/matter-js/).

## Run locally

No build step — it's plain HTML/CSS/JS.

```sh
python3 -m http.server 8000
# → http://localhost:8000
```

## Edit projects

All project cards live in [`projects.js`](projects.js). Each entry:

```js
{ name: 'Word Bord', emoji: '🅱️', img: 'images/wordbord.png', desc: '…', live: 'https://…', github: 'https://…' }
```

`live`, `github`, and `img` (a screenshot shown in the card's popup) are all
optional. Cards spawn in array order. The about-me bio and the dangling
link buttons live at the top of `main.js` (`ABOUT` / `DANGLERS`).

## Deploy

Static files at the repo root — GitHub Pages (Settings → Pages → deploy from
`main`) or any static host works as-is.
