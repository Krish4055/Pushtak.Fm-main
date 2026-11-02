/**
 * Preloaded Demo Book: "The Art of Deep Focus & Mindful Living"
 * 
 * Ready instantly when the user opens Pushtak.fm.
 * Contains engaging chapters, natural sentence rhythm, and rich conceptual content
 * to showcase audio playback, karaoke highlighting, quizzes, and Ask the Book.
 */

import { processBookText, ParsedBook } from '../services/bookParser.js';

const DEMO_BOOK_TEXT = `Chapter 1: The Modern Attention Crisis & The Commute Sanctuary

We live in an era where sustained attention has become humanity's rarest currency. Every day, the average person is interrupted over two hundred times by digital notifications, breaking thoughts into fragments before deep insight can take root. We scroll when we wait for coffee. We refresh feeds while sitting on the train or stuck in traffic. In doing so, we have surrendered the quiet spaces of our day to algorithmic agitation.

Yet, travel—whether on a crowded metro in Delhi, a commuter train in Mumbai, or a quiet highway bus—has historically served as a sanctuary for contemplative reflection. When your hands and eyes are tethered to the motion of travel, your mind is free to absorb ideas through voice. Audio learning is not merely a passive convenience; it is an intimate cognitive return to our oral heritage. For thousands of years, the highest philosophy and greatest epics were transmitted through the living cadence of the spoken word.

When you listen to a chapter split into five or ten minute sections, your brain naturally syncs with the rhythm of thought. The cognitive load decreases. Concepts settle into your working memory without visual fatigue. Instead of reaching your destination depleted by endless scrolling, you arrive energized, having absorbed five chapters of a transformative book hands-free.

Chapter 2: The 20-Minute Focus Ritual & The Dopamine Reset

The human prefrontal cortex is not designed for continuous cognitive thrashing. When you switch between checking emails, listening to snippets of chatter, and answering messages, your brain incurs what neuroscientists call an attention residue. A portion of your focus remains stuck on the previous task, reducing cognitive throughput by up to forty percent.

To reclaim high-yield intellectual capacity, adopt the twenty-minute focus ritual. The twenty-minute threshold is deliberate: it is long enough to submerge yourself into complex subject matter, yet short enough to prevent cognitive exhaustion. In this system, you commit to a single stream of input without tab-switching or ambient glances.

Consider how this applies to studying complex subjects. A student preparing for medical or engineering exams often feels overwhelmed by five-hundred page textbooks. But when broken down into ten-minute audio journeys followed by active self-testing, the mountain becomes a series of gentle steps. Retention skyrockets when active listening is coupled with immediate retrieval practice. You hear the core principle, you pause to reflect on its meaning, and you test your understanding with a short quiz. This triple-reinforcement loop transforms information from fleeting working memory into permanent cognitive architecture.

Chapter 3: Ancient Indian Wisdom for Modern Overthinkers

In the second chapter of the Bhagavad Gita, Krishna speaks of Nishkama Karma—the discipline of immersing yourself fully in the action itself, free from obsessive anxiety over outcomes. For the modern student, entrepreneur, or daily commuter, this is the ultimate antidote to burnout. Most mental exhaustion does not come from intellectual labor; it comes from the background dread of whether our efforts will guarantee recognition, status, or success.

When you detach from the imagined verdict of tomorrow and anchor your awareness entirely into the sentence unfolding right now, stillness emerges. True focus is not brute willpower or white-knuckled strain. True focus is the natural consequence of stillness. As the ancient Upanishadic sages observed, just as a disturbed lake cannot reflect the moon, an agitated intellect cannot grasp profound truth.

Whenever you find yourself rushing through your commute or feeling overwhelmed by a towering syllabus, pause. Take one deep breath. Let the voice guide your attention. Remember that every master was once a student who chose to listen quietly while the rest of the world hurried past.`;

export function getPreloadedDemoBook(targetMinutes: number = 5): ParsedBook {
  const book = processBookText(
    'The Art of Deep Focus & Mindful Living',
    DEMO_BOOK_TEXT,
    targetMinutes,
    'Dr. Arjun Mehta'
  );
  book.id = 'demo-deep-focus';
  book.coverGradient = 'from-indigo-950 via-slate-900 to-sky-950';
  return book;
}
