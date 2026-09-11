import assert from "node:assert/strict";
import {
  classifyCoreOutcomeFromTranscript,
  isDemoAgreed,
  isMeetingBooked,
  normalizeCoreOutcome,
  tallyOutcomeBucket,
} from "./coreOutcome";

assert.equal(normalizeCoreOutcome("Demo agreed to"), "Demo agreed");
assert.equal(normalizeCoreOutcome("demo agreed"), "Demo agreed");
assert.equal(normalizeCoreOutcome("The prospect agreed to a demo"), "Demo agreed");
assert.equal(normalizeCoreOutcome("Meeting booked"), "Meeting booked");
assert.equal(normalizeCoreOutcome("booked"), "Meeting booked");
assert.equal(normalizeCoreOutcome("Dropped"), "Dropped");
assert.equal(normalizeCoreOutcome("No next step"), "Dropped");
assert.equal(isDemoAgreed("Demo agreed to"), true);
assert.equal(isMeetingBooked("Demo agreed to"), false);
assert.equal(isMeetingBooked("Meeting booked"), true);
assert.equal(tallyOutcomeBucket("Demo agreed to"), "demoAgreed");
assert.equal(normalizeCoreOutcome("Meeting booked | Demo agreed | Dropped"), "Dropped");
assert.equal(tallyOutcomeBucket("Meeting booked"), "booked");

// Vicente's-style: prospect agrees to a demo, no calendar lock.
const vicenteJason = `Mac: Jason, thanks for taking a minute — we help independent grocers cut shrink on perishables.
Jason: Yeah, shrink is a headache in produce. What do you guys actually do?
Mac: Easiest is to walk you through it live. Would you be open to a demo?
Jason: Sure, a demo sounds good. Send me some times and I'll pick one.
Mac: Perfect, I'll follow up with a few slots.`;
assert.equal(classifyCoreOutcomeFromTranscript(vicenteJason), "Demo agreed");

const calendarLock = `Mac: How does Tuesday at 10 AM look for a 20-minute walkthrough?
Jason: Tuesday at 10 works for me.
Mac: Great — I'll send the calendar invite for Tuesday 10 AM.`;
assert.equal(classifyCoreOutcomeFromTranscript(calendarLock), "Meeting booked");

const emailFold = `Prospect: Just send me an email with some brochures.
Rep: Absolutely, I'll send that right over. Have a great day!`;
assert.equal(classifyCoreOutcomeFromTranscript(emailFold), "Dropped");

const demoHarbor = `Chloe: That sounds terrible! Let me pull up my slides and jump right into the demo to show you how our system eliminates approval bottlenecks.
Prospect: Just send a quote and I'll show my team.`;
assert.equal(classifyCoreOutcomeFromTranscript(demoHarbor), "Dropped");

console.log("coreOutcome checks passed");
