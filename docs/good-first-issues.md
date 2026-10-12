# Good first issues

These are small, real gaps. Each one can land as its own pull request. Comment on the tracking issue if you start one, or open a new issue from the Good first issue template and paste the title.

## 1. Call Bank column still says Sandler

`src/app/calls/page.tsx` labels a column "Sandler Badges" even when the workspace methodology is MEDDIC, SPIN, Challenger, or BANT. The letters under it are pain, budget, and decision for every method.

Use the active methodology name from `methodById` in the header, and keep the badge letters. Add a test that a non-Sandler method does not render the word Sandler in that header.

## 2. Empty Call Bank should teach the next click

When an admin has no calls, `src/app/calls/page.tsx` says "No calls have been uploaded yet." Members get one extra sentence about Upload.

Add two actions: paste a transcript, and open the public sample at `/demo` so a new workspace is not a blank table. Cover the admin and member strings with the existing page-level test style in `src/lib`.

## 3. Find inside one transcript

Workspace search lives on Conversations. The call review transcript (`src/components/TimestampedTranscript.tsx`) has no find box, so a manager hunting for "budget" scrolls the whole call.

Add a client-side filter that highlights matching turns and does not request the server. A unit test can cover the match helper with a two-speaker fixture.

## 4. Copy the coaching brief

`src/components/CoachingBrief.tsx` shows praise, gaps, and drills, and there is no way to copy them into a 1:1 note.

Add a button that writes a short Markdown block (three headings, three paragraphs) to the clipboard, with a visible "Copied" state when the browser allows it. Test the Markdown builder without rendering the page.

## 5. Filter the Call Bank

`src/app/calls/page.tsx` is one ranked table. A manager with a few dozen calls cannot narrow it to a stage, an outcome, or a rep without leaving the page.

Add client-side filters above the table. Empty filter results need their own sentence, distinct from the no-calls sentence. Rank numbers should stay the global rank, not restart at 1 inside the filter.

## 6. Show how recent a call is

`formatDate` in `src/lib/utils.ts` always prints an absolute date. The Call Bank and the call review header never say "3 days ago", so a queue of old calls looks the same as this morning.

Add `formatRelativeDay` that returns "Today", "Yesterday", or "N days ago" inside 14 days, and the existing absolute date after that. Test the boundaries at 0, 1, 14, and 15 days. Use a fixed `now` argument so the test does not depend on the clock.

## 7. Next and previous missed moment

Scorecard cites in `src/components/ScorecardGrid.tsx` jump to a timestamp. There is no way to move to the next Fail or Incomplete cite without scrolling back to the cards.

Add next and previous controls that walk the cites whose status is not Pass, and move focus to that transcript turn. Disable the controls on the first and last miss. Test the walk on a scorecard with Pass, Fail, Pass, Incomplete.
