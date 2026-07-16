/*
 * The toys in the toy box. Edit freely — each entry becomes a physics card.
 * `live` is optional; cards without it just link to the source.
 * `featured: true` stars a card: ⭐ badge, golden glow, bigger, first in tidy mode.
 */
const PROJECTS = [
  {
    name: 'Word Bord',
    img: 'images/wordbord.png',
    emoji: '🅱️',
    desc: 'Spin rows and columns to form words in this daily word puzzle.',
    live: 'https://wordbord.com',
    github: 'https://github.com/ericx1e/Word-Bord',
  },
  {
    name: '24',
    img: 'images/24thegame.png',
    emoji: '♦️',
    desc: 'Use math operations on four cards to make 24. Simple rules, surprisingly spicy.',
    live: 'https://24thegame.com',
    github: 'https://github.com/ericx1e/24',
  },
  {
    name: 'StudyBrew',
    img: 'images/studybrew.png',
    emoji: '☕️',
    desc: 'A study tool that replaces the anxious countdown timer with the peaceful pouring of tea.',
    live: 'https://studybrew.netlify.app',
    github: 'https://github.com/ericx1e/StudyBrew',
  },
  {
    name: 'ControlFlow',
    img: 'images/controlflow.png',
    emoji: '🧩',
    desc: 'A roguelike puzzle game where you escape each floor by snapping code blocks together.',
    live: 'https://ericx1e.github.io/ControlFlow/',
    github: 'https://github.com/ericx1e/ControlFlow',
  },
  {
    name: 'Battle JS',
    img: 'images/battle.png',
    emoji: '⚔️',
    desc: 'A battle simulator with sandbox, campaign, and multiplayer modes.',
    live: 'https://ericx1e.github.io/Battle-JS/',
    github: 'https://github.com/ericx1e/Battle-JS',
  },
  {
    name: 'Prime Bord',
    img: 'images/primes.png',
    emoji: '🔢',
    desc: 'A prime number tile game. Like a word game, but the words are prime numbers.',
    live: 'https://primebord.com',
    github: 'https://github.com/ericx1e/Prime-Bord',
  },
  {
    name: 'Tanks',
    img: 'images/tanks.png',
    emoji: '💥',
    desc: 'A roguelite multiplayer tank battle arena.',
    live: 'https://tankgame.app',
    featured: true,
    // github: '', TODO: add repo link
  },
  {
    name: 'RNG Chess',
    img: 'images/rngchess.png',
    emoji: '🎲',
    desc: ' Chess, but fate makes the final call. You pick the direction, the odds pick the square.',
    live: 'https://rngchess.fly.dev',
  },
];
