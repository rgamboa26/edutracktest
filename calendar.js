document.addEventListener("DOMContentLoaded", function () {
    const calendarGrid = document.getElementById("calendar-grid");
    const monthYearLabel = document.getElementById("month-year");
    const prevBtn = document.getElementById("prev-month");
    const nextBtn = document.getElementById("next-month");
    let currentDate = new Date();
    let events = {};

    // LOAD LOCAL STOR
    function loadEvents() {
        const savedEvents = localStorage.getItem("events");
        if (savedEvents) {
            events = JSON.parse(savedEvents);
        }
    }

    // LOCAL STORAGE GOATED
    function saveEvents() {
        localStorage.setItem("events", JSON.stringify(events));
    }

    // DISPLAY CALENDAR GRID
    function generateCalendar(date = new Date()) {
        const year = date.getFullYear();
        const month = date.getMonth();
        const today = new Date(); // Get today's date
        const firstDay = new Date(year, month, 1).getDay();
        const lastDate = new Date(year, month + 1, 0).getDate();
        const prevLastDate = new Date(year, month, 0).getDate();
        const totalCells = 42;

        calendarGrid.innerHTML = ""; // CLR
        monthYearLabel.textContent = `${date.toLocaleString("default", { month: "long" })} ${year}`;

        for (let i = 0; i < totalCells; i++) {
            const dayCell = document.createElement("div");
            dayCell.classList.add("calendar-day");
            let displayDate = "";
            let cellDate = new Date();

            if (i < firstDay) {
                displayDate = prevLastDate - firstDay + i + 1;
                dayCell.classList.add("inactive");
                cellDate = new Date(year, month - 1, displayDate);
            } else if (i >= firstDay + lastDate) {
                displayDate = i - firstDay - lastDate + 1;
                dayCell.classList.add("inactive");
                cellDate = new Date(year, month + 1, displayDate);
            } else {
                displayDate = i - firstDay + 1;
                cellDate = new Date(year, month, displayDate);

                // DATE TODAY
                if (
                    cellDate.getDate() === today.getDate() &&
                    cellDate.getMonth() === today.getMonth() &&
                    cellDate.getFullYear() === today.getFullYear()
                ) {
                    dayCell.classList.add("today");
                }
            }

            const dateSpan = document.createElement("div");
            dateSpan.classList.add("date-number");
            dateSpan.textContent = displayDate;
            dayCell.appendChild(dateSpan);

            const cellKey = cellDate.toISOString().split("T")[0];
            if (events[cellKey]) {
                events[cellKey].forEach((event) => {
                    const eventDiv = document.createElement("div");
                    eventDiv.classList.add("event");
                    eventDiv.textContent = event;
                    dayCell.appendChild(eventDiv);
                });
            }

            calendarGrid.appendChild(dayCell);
        }
    }

    // Event listeners for navigation buttons
    prevBtn.addEventListener("click", () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        generateCalendar(currentDate);
    });

    nextBtn.addEventListener("click", () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        generateCalendar(currentDate);
    });

    // Initial setup
    loadEvents();
    generateCalendar(currentDate);
    // Call generateCalendar after adding or removing tasks
    generateCalendar(new Date());
});