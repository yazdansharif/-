/* =====================================================
   CONFIGURATION
   ✏️ TO CHANGE THE START DATE/TIME:
   Edit the ISO string below. The "+03:30" at the end is
   Iran Standard Time's fixed UTC offset (Iran does not
   currently observe daylight saving time), so this anchors
   the moment in absolute time regardless of where a visitor
   is browsing from — everyone sees the same elapsed time.

   Format: "YYYY-MM-DDTHH:MM:SS+03:30"
===================================================== */
const START_DATE_ISO = "2026-06-30T09:30:00+03:30";
const START_DATE = new Date(START_DATE_ISO);

/* =====================================================
   DOM REFERENCES
===================================================== */
const elDays = document.getElementById("days");
const elHours = document.getElementById("hours");
const elMinutes = document.getElementById("minutes");
const elSeconds = document.getElementById("seconds");
const elStartLabel = document.getElementById("startDateLabel");

/* =====================================================
   DISPLAY THE START DATE (in Iran time, for context)
   Uses Intl.DateTimeFormat with an explicit timeZone so
   the label is consistent for every visitor everywhere.
===================================================== */
function renderStartDateLabel() {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  elStartLabel.textContent = `${formatter.format(START_DATE)} (Iran Standard Time)`;
}

/* =====================================================
   PAD a number to at least 2 digits, e.g. 4 -> "04"
===================================================== */
function pad(num) {
  return String(num).padStart(2, "0");
}

/* =====================================================
   Update a single timer card's value, only touching the
   DOM (and re-triggering the pulse animation) when the
   displayed text actually changes. Keeps things cheap to
   run every second.
===================================================== */
function setValue(element, newText) {
  if (element.textContent === newText) return;
  element.textContent = newText;

  // Restart the CSS pulse animation by toggling the class.
  element.classList.remove("is-updating");
  // Force reflow so the animation can replay immediately.
  // eslint-disable-next-line no-unused-expressions
  element.offsetWidth;
  element.classList.add("is-updating");
}

/* =====================================================
   MAIN TICK — computes elapsed time and updates the DOM.
   Because START_DATE and "now" are both absolute instants
   (Date objects store UTC internally), this difference is
   correct no matter what timezone the visitor's device is
   set to.
===================================================== */
function tick() {
  const now = new Date();
  let diffMs = now.getTime() - START_DATE.getTime();

  // Guard against the (unlikely) case of a future start date.
  if (diffMs < 0) diffMs = 0;

  const totalSeconds = Math.floor(diffMs / 1000);

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  setValue(elDays, pad(days));
  setValue(elHours, pad(hours));
  setValue(elMinutes, pad(minutes));
  setValue(elSeconds, pad(seconds));
}

/* =====================================================
   INIT
===================================================== */
renderStartDateLabel();
tick();
setInterval(tick, 1000);
