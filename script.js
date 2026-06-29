// ==============================
// Elapsed Time Counter
// Start Time: 2026-06-28 17:44 (Iran Time)
// ==============================

// Start date in Iran Standard Time (UTC+3:30)
const startDate = new Date("2026-06-28T17:44:00+03:30");

// Get timer element
const timer = document.getElementById("timer");

// Update timer every second
function updateTimer() {

    const now = new Date();

    let diff = now - startDate;

    if (diff < 0) {
        timer.innerHTML = "The timer has not started yet.";
        return;
    }

    const totalSeconds = Math.floor(diff / 1000);

    const days = Math.floor(totalSeconds / (60 * 60 * 24));

    const hours = Math.floor(
        (totalSeconds % (60 * 60 * 24)) / (60 * 60)
    );

    const minutes = Math.floor(
        (totalSeconds % (60 * 60)) / 60
    );

    const seconds = totalSeconds % 60;

    timer.innerHTML = `
        <div class="time-box">
            <span class="number">${days}</span>
            <span class="label">Days</span>
        </div>

        <div class="time-box">
            <span class="number">${hours}</span>
            <span class="label">Hours</span>
        </div>

        <div class="time-box">
            <span class="number">${minutes}</span>
            <span class="label">Minutes</span>
        </div>

        <div class="time-box">
            <span class="number">${seconds}</span>
            <span class="label">Seconds</span>
        </div>
    `;
}

// Initial update
updateTimer();

// Refresh every second
setInterval(updateTimer, 1000);