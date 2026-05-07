// reservation-calendar.js
(function () {
    // These are the sessionStorage key names for all calendar data including hours, bookings, events, and breaks.
    var KEYS = {
        mode: 'commonGoodAccessMode',
        locationName: 'commonGoodLocationName',
        locationAddress: 'commonGoodLocationAddress',
        createdLocation: 'commonGoodHasCreatedLocation',
        createdLocations: 'commonGoodCreatedLocations',
        calendarHours: 'commonGoodCalendarHours',
        bookings: 'commonGoodCalendarBookings',
        events: 'commonGoodCalendarEvents',
        breaks: 'commonGoodCalendarBreaks',
        legacySeedCleanupDone: 'commonGoodCalendarSeedCleanupDone'
    };

    // These constants control how the calendar grid is rendered, and currentWeekStart tracks which week is displayed.
    var WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var START_HOUR = 0;
    var END_HOUR = 24;
    var HOUR_ROW_HEIGHT = 44;
    var currentWeekStart = getWeekStart(new Date());
    var editScheduleState = null;

    var accessMode = sessionStorage.getItem(KEYS.mode);

    // This removes legacy placeholder data if old sessions still contain the hardcoded Test Location.
    function purgeSeedLocation() {
        var raw;
        try {
            raw = JSON.parse(sessionStorage.getItem(KEYS.createdLocations) || '[]');
        } catch (e) {
            raw = [];
        }

        var filtered = raw.filter(function (entry) {
            var name = typeof entry === 'string' ? entry : (entry && entry.name ? entry.name : '');
            return name !== 'Test Location';
        });

        if (filtered.length !== raw.length) {
            sessionStorage.setItem(KEYS.createdLocations, JSON.stringify(filtered));
            if (filtered.length === 0) {
                sessionStorage.removeItem(KEYS.createdLocation);
                sessionStorage.removeItem(KEYS.locationName);
                sessionStorage.removeItem(KEYS.locationAddress);
            }
        }
    }

    // This writes default hours, empty booking and event arrays, and an empty breaks list to sessionStorage if they do not exist.
    // It also runs legacy cleanup to remove any old hardcoded seed entries from previous sessions.
    function ensureCalendarSeedData() {
        var storedHours = parseJsonFromSession(KEYS.calendarHours, null);
        if (!storedHours) {
            storedHours = {
                0: { closed: true, start: 8, end: 8 },
                1: { closed: false, start: 8, end: 13 },
                2: { closed: false, start: 8, end: 13 },
                3: { closed: false, start: 8, end: 13 },
                4: { closed: false, start: 8, end: 13 },
                5: { closed: false, start: 8, end: 13 },
                6: { closed: false, start: 8, end: 13 }
            };
            sessionStorage.setItem(KEYS.calendarHours, JSON.stringify(storedHours));
        }

        var bookings = parseJsonFromSession(KEYS.bookings, null);
        if (!bookings) {
            bookings = [];
            sessionStorage.setItem(KEYS.bookings, JSON.stringify(bookings));
        }

        var events = parseJsonFromSession(KEYS.events, null);
        if (!events) {
            events = [];
            sessionStorage.setItem(KEYS.events, JSON.stringify(events));
        }

        var breaks = parseJsonFromSession(KEYS.breaks, null);
        if (!breaks) {
            sessionStorage.setItem(KEYS.breaks, JSON.stringify([]));
        } else {
            var currentWeekIso = dateToIso(currentWeekStart);
            var normalizedBreaks = breaks.map(function (entry) {
                if (!entry) { return entry; }
                if (entry.weekStart) { return entry; }

                entry.weekStart = currentWeekIso;
                return entry;
            });

            sessionStorage.setItem(KEYS.breaks, JSON.stringify(normalizedBreaks));
        }

        cleanupLegacySeedEntries();
    }

    // This returns true if two hour ranges overlap each other.
    function overlaps(startA, endA, startB, endB) {
        return startA < endB && startB < endA;
    }

    // This returns all break entries that apply to a given weekday in the currently displayed week.
    function getBreaksForWeekday(weekday) {
        var currentWeekIso = dateToIso(currentWeekStart);
        var breaks = parseJsonFromSession(KEYS.breaks, []);
        return breaks.filter(function (entry) {
            return entry &&
                entry.weekStart === currentWeekIso &&
                Array.isArray(entry.weekdays) &&
                entry.weekdays.indexOf(weekday) !== -1;
        });
    }

    // This checks whether a given date and time range is blocked by any scheduled break, optionally ignoring one break by id.
    function isBlockedByBreak(dateIso, startHour, endHour, ignoreBreakId) {
        var date = new Date(dateIso + 'T00:00:00');
        var weekday = date.getDay();
        var weekStartIso = dateToIso(getWeekStart(date));
        var breaks = parseJsonFromSession(KEYS.breaks, []);

        return breaks.some(function (entry) {
            if (ignoreBreakId && entry.id === ignoreBreakId) {
                return false;
            }
            if (!entry || entry.weekStart !== weekStartIso) {
                return false;
            }
            if (!Array.isArray(entry.weekdays) || entry.weekdays.indexOf(weekday) === -1) {
                return false;
            }
            return overlaps(startHour, endHour, entry.startHour, entry.endHour);
        });
    }

    // This checks whether a proposed break on the given weekdays and week would conflict with any existing booking or event.
    function breakOverlapsExistingItems(weekdays, startHour, endHour, weekStartIso, ignoreKind, ignoreId) {
        var bookings = parseJsonFromSession(KEYS.bookings, []);
        var events = parseJsonFromSession(KEYS.events, []);
        var allItems = bookings.concat(events);

        return allItems.some(function (item) {
            if (!item || !item.date) { return false; }
            if (ignoreKind === item.kind && ignoreId === item.id) { return false; }

            var itemDate = new Date(item.date + 'T00:00:00');
            if (weekdays.indexOf(itemDate.getDay()) === -1) { return false; }
            if (dateToIso(getWeekStart(itemDate)) !== weekStartIso) { return false; }

            return overlaps(startHour, endHour, item.startHour, item.endHour);
        });
    }

    // This maps a schedule item kind string to the sessionStorage key that stores it.
    function getStoreKeyForKind(kind) {
        if (kind === 'booking') { return KEYS.bookings; }
        if (kind === 'event') { return KEYS.events; }
        return KEYS.breaks;
    }

    // This finds a single schedule item by its kind and id from sessionStorage.
    function getItemByKindAndId(kind, id) {
        var items = parseJsonFromSession(getStoreKeyForKind(kind), []);

        return items.find(function (item) {
            return item && item.id === id;
        }) || null;
    }

    // This writes an updated array of items back to the correct sessionStorage key for the given kind.
    function saveItemsByKind(kind, items) {
        sessionStorage.setItem(getStoreKeyForKind(kind), JSON.stringify(items));
    }

    // This collects all bookings, events, and breaks that fall within the currently displayed week and returns them sorted.
    function getWeekItems() {
        var weekStartIso = dateToIso(currentWeekStart);
        var weekEndIso = dateToIso(addDays(currentWeekStart, 6));
        var items = [];

        parseJsonFromSession(KEYS.bookings, []).forEach(function (entry) {
            if (entry && entry.date >= weekStartIso && entry.date <= weekEndIso) {
                items.push(entry);
            }
        });

        parseJsonFromSession(KEYS.events, []).forEach(function (entry) {
            if (entry && entry.date >= weekStartIso && entry.date <= weekEndIso) {
                items.push(entry);
            }
        });

        parseJsonFromSession(KEYS.breaks, []).forEach(function (entry) {
            if (entry && entry.weekStart === weekStartIso && entry.weekdays && entry.weekdays.length) {
                items.push({
                    id: entry.id,
                    kind: 'break',
                    weekStart: entry.weekStart,
                    weekdays: entry.weekdays,
                    startHour: entry.startHour,
                    endHour: entry.endHour,
                    reason: entry.reason || ''
                });
            }
        });

        items.sort(function (a, b) {
            var aValue = a.kind === 'break' ? 'zzzz' : (a.date || '');
            var bValue = b.kind === 'break' ? 'zzzz' : (b.date || '');

            if (aValue === bValue) {
                return (a.startHour || 0) - (b.startHour || 0);
            }

            return aValue < bValue ? -1 : 1;
        });

        return items;
    }

    // This builds the management list panel showing all items for the current week with edit and delete buttons for each.
    function renderManagementList() {
        var listEl = document.getElementById('reservation-items-list');
        if (!listEl) { return; }

        var items = getWeekItems();
        listEl.innerHTML = '';

        if (!items.length) {
            listEl.innerHTML = '<p class="hosting-panel-empty">No bookings, events, or breaks scheduled yet.</p>';
            return;
        }

        items.forEach(function (item) {
            var card = document.createElement('article');
            card.className = 'reservation-manage-card';

            var title = item.kind === 'break'
                ? (item.reason ? ('On Break - ' + item.reason) : 'On Break')
                : item.title;
            var meta = item.kind === 'break' ? 'Break' : (item.kind === 'event' ? 'Event' : 'Booking');
            var timing = item.kind === 'break'
                ? ('Week of ' + new Date(item.weekStart + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' • ' + formatWeekdays(item.weekdays) + ' • ' + formatHourWithMinutes(item.startHour) + ' - ' + formatHourWithMinutes(item.endHour))
                : (new Date(item.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + ' • ' + formatHourWithMinutes(item.startHour) + ' - ' + formatHourWithMinutes(item.endHour));

            card.innerHTML =
                '<div>' +
                '  <p class="reservation-manage-meta">' + meta + '</p>' +
                '  <h3></h3>' +
                '  <p></p>' +
                '</div>' +
                '<div class="reservation-manage-actions">' +
                '  <button class="reservation-manage-action" type="button" data-action="edit">Edit</button>' +
                '  <button class="reservation-manage-action" type="button" data-action="delete">Delete</button>' +
                '</div>';

            card.querySelector('h3').textContent = title;
            card.querySelector('p:last-of-type').textContent = timing;

            card.querySelector('[data-action="edit"]').addEventListener('click', function () {
                openEditScheduleItem(item.kind, item.id);
            });

            card.querySelector('[data-action="delete"]').addEventListener('click', function () {
                deleteScheduleItem(item.kind, item.id);
            });

            listEl.appendChild(card);
        });
    }

    // This re-renders both the calendar grid and the management list after any data change.
    function rerenderScheduleViews() {
        renderCalendar();
        renderManagementList();
    }

    // This removes old hardcoded test bookings and events that were seeded in earlier versions, running only once per session.
    function cleanupLegacySeedEntries() {
        if (sessionStorage.getItem(KEYS.legacySeedCleanupDone) === 'true') {
            return;
        }

        var legacyBookingTitles = {
            '3D Printer - Carrie M.': true,
            '3D Printer - Max A.': true,
            '3D Printer - Arthur D.': true
        };

        var bookings = parseJsonFromSession(KEYS.bookings, []);
        var events = parseJsonFromSession(KEYS.events, []);

        var cleanedBookings = bookings.filter(function (entry) {
            return !(entry && legacyBookingTitles[entry.title] && entry.kind === 'booking');
        });

        var cleanedEvents = events.filter(function (entry) {
            return !(entry && entry.title === 'Print Finishing Class' && entry.kind === 'event');
        });

        sessionStorage.setItem(KEYS.bookings, JSON.stringify(cleanedBookings));
        sessionStorage.setItem(KEYS.events, JSON.stringify(cleanedEvents));
        sessionStorage.setItem(KEYS.legacySeedCleanupDone, 'true');
    }

    // This clears the guest session and redirects home if the guest user reloads the page.
    function resetGuestSessionOnReload() {
        var navEntries = performance.getEntriesByType('navigation');
        var navType = navEntries.length ? navEntries[0].type : '';

        if (accessMode === 'guest' && navType === 'reload') {
            sessionStorage.clear();
            window.location.href = '../';
            return true;
        }

        return false;
    }

    // This redirects to the home page if not logged in, or to the location creator if no location has been saved yet.
    function enforceAccess() {
        if (!accessMode) {
            window.location.href = '../';
            return false;
        }

        if (sessionStorage.getItem(KEYS.createdLocation) !== 'true') {
            window.location.href = 'add/';
            return false;
        }

        return true;
    }

    // This sets the calendar page title using the name of the location stored in sessionStorage.
    function setCalendarContext() {
        var titleEl = document.getElementById('reservation-calendar-title');
        var locationName = sessionStorage.getItem(KEYS.locationName) || 'Selected Location';

        if (titleEl) {
            titleEl.textContent = locationName + ' Reservation Calendar';
        }
    }

    // This safely reads and parses a JSON value from sessionStorage, returning the fallback if the key is missing or invalid.
    function parseJsonFromSession(key, fallback) {
        try {
            var value = sessionStorage.getItem(key);
            if (!value) { return fallback; }
            return JSON.parse(value);
        } catch (error) {
            return fallback;
        }
    }

    // These are date helpers for getting week boundaries, adding days, and formatting dates as ISO strings.
    function getWeekStart(date) {
        var d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        d.setDate(d.getDate() - d.getDay());
        d.setHours(0, 0, 0, 0);
        return d;
    }

    function addDays(date, days) {
        var d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        d.setDate(d.getDate() + days);
        return d;
    }

    function dateToIso(date) {
        return date.toISOString().slice(0, 10);
    }

    // These are display formatting helpers for hours, weekday names, date ranges, and the hours summary line.
    function formatHour(hour24) {
        var suffix = hour24 >= 12 ? 'PM' : 'AM';
        var base = hour24 % 12;
        if (base === 0) { base = 12; }
        return base + ' ' + suffix;
    }

    function formatHourWithMinutes(hour24) {
        var suffix = hour24 >= 12 ? 'PM' : 'AM';
        var base = hour24 % 12;
        if (base === 0) { base = 12; }
        return base + ':00 ' + suffix;
    }

    function toTimeInputValue(hour24) {
        return String(hour24).padStart(2, '0') + ':00';
    }

    function formatWeekdays(weekdays) {
        if (!weekdays || !weekdays.length) {
            return 'No days';
        }

        return weekdays
            .slice()
            .sort(function (a, b) { return a - b; })
            .map(function (day) { return WEEKDAY_NAMES[day]; })
            .join(', ');
    }

    function formatWeekRange(startDate) {
        var endDate = addDays(startDate, 6);
        var format = function (d) {
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        };

        return format(startDate) + ' - ' + format(endDate);
    }

    function formatHoursSummary(hoursByDay) {
        var monday = hoursByDay[1] || { closed: true };
        var saturday = hoursByDay[6] || { closed: true };

        if (monday.closed || saturday.closed) {
            return 'Current Location Hours: Custom schedule';
        }

        return 'Current Location Hours: ' + formatHour(monday.start) + ' - ' + formatHour(monday.end) + ' Mon - Sat';
    }

    function parseTimeToHour(timeValue) {
        var parts = (timeValue || '').split(':');
        var hour = parseInt(parts[0], 10);
        if (isNaN(hour)) { return null; }
        return hour;
    }

    // This builds the full weekly calendar grid including time labels, day columns, break blocks, and booking or event blocks.
    function renderCalendar() {
        var weekRangeEl = document.getElementById('reservation-week-range');
        var hoursSummaryEl = document.getElementById('reservation-hours-summary');
        var gridEl = document.getElementById('reservation-week-grid');

        if (!weekRangeEl || !hoursSummaryEl || !gridEl) { return; }

        var hoursByDay = parseJsonFromSession(KEYS.calendarHours, {});
        var bookings = parseJsonFromSession(KEYS.bookings, []);
        var events = parseJsonFromSession(KEYS.events, []);
        var allItems = bookings.concat(events);

        weekRangeEl.textContent = formatWeekRange(currentWeekStart);
        hoursSummaryEl.textContent = formatHoursSummary(hoursByDay);

        gridEl.innerHTML = '';

        var timeHeader = document.createElement('div');
        timeHeader.className = 'reservation-grid-time-header';
        gridEl.appendChild(timeHeader);

        for (var dayHeaderIndex = 0; dayHeaderIndex < 7; dayHeaderIndex += 1) {
            var dayDate = addDays(currentWeekStart, dayHeaderIndex);
            var headerCell = document.createElement('div');
            headerCell.className = 'reservation-grid-day-header';
            headerCell.innerHTML = '<span>' + WEEKDAY_NAMES[dayHeaderIndex] + '</span><span class="reservation-grid-date">' + dayDate.getDate() + '</span>';
            gridEl.appendChild(headerCell);
        }

        var bodyHeight = (END_HOUR - START_HOUR) * HOUR_ROW_HEIGHT;

        var timeColumn = document.createElement('div');
        timeColumn.className = 'reservation-grid-time-column';
        for (var hour = START_HOUR; hour < END_HOUR; hour += 1) {
            var timeLabel = document.createElement('div');
            timeLabel.className = 'reservation-grid-time-label';
            timeLabel.style.height = HOUR_ROW_HEIGHT + 'px';
            timeLabel.textContent = formatHour(hour);
            timeColumn.appendChild(timeLabel);
        }
        gridEl.appendChild(timeColumn);

        for (var dayIndex = 0; dayIndex < 7; dayIndex += 1) {
            var dayDateObj = addDays(currentWeekStart, dayIndex);
            var dayIso = dateToIso(dayDateObj);

            var dayColumn = document.createElement('div');
            dayColumn.className = 'reservation-grid-day-column';
            dayColumn.style.height = bodyHeight + 'px';

            var dayHours = hoursByDay[dayIndex] || { closed: true, start: START_HOUR, end: START_HOUR };
            var dayBreaks = getBreaksForWeekday(dayIndex);

            for (var slotHour = START_HOUR; slotHour < END_HOUR; slotHour += 1) {
                var slot = document.createElement('div');
                slot.className = 'reservation-slot';
                slot.style.height = HOUR_ROW_HEIGHT + 'px';

                var isClosed = dayHours.closed || slotHour < dayHours.start || slotHour >= dayHours.end;
                if (isClosed) {
                    slot.className += ' reservation-slot-closed';
                }

                var isBreakHour = dayBreaks.some(function (entry) {
                    return overlaps(slotHour, slotHour + 1, entry.startHour, entry.endHour);
                });
                if (isBreakHour) {
                    slot.className += ' reservation-slot-break';
                }

                dayColumn.appendChild(slot);
            }

            dayBreaks.forEach(function (entry) {
                var breakStart = Math.max(entry.startHour, START_HOUR);
                var breakEnd = Math.min(entry.endHour, END_HOUR);
                if (breakEnd <= breakStart) { return; }

                var breakBlock = document.createElement('article');
                breakBlock.className = 'reservation-item reservation-item-break reservation-item-clickable';
                breakBlock.style.top = ((breakStart - START_HOUR) * HOUR_ROW_HEIGHT + 1) + 'px';
                breakBlock.style.height = ((breakEnd - breakStart) * HOUR_ROW_HEIGHT - 2) + 'px';
                breakBlock.textContent = entry.reason ? ('On Break - ' + entry.reason) : 'On Break';
                breakBlock.addEventListener('click', function () {
                    openEditScheduleItem('break', entry.id);
                });
                dayColumn.appendChild(breakBlock);
            });

            allItems.forEach(function (item) {
                if (!item || item.date !== dayIso) { return; }

                var itemStart = Math.max(item.startHour, START_HOUR);
                var itemEnd = Math.min(item.endHour, END_HOUR);
                if (itemEnd <= START_HOUR || itemStart >= END_HOUR || itemEnd <= itemStart) { return; }

                var block = document.createElement('article');
                block.className = 'reservation-item reservation-item-clickable ' + (item.kind === 'event' ? 'reservation-item-event' : 'reservation-item-booking');
                block.style.top = ((itemStart - START_HOUR) * HOUR_ROW_HEIGHT + 1) + 'px';
                block.style.height = ((itemEnd - itemStart) * HOUR_ROW_HEIGHT - 2) + 'px';

                if (item.color) {
                    block.style.background = item.color;
                }

                block.textContent = item.title;
                block.addEventListener('click', function () {
                    openEditScheduleItem(item.kind, item.id);
                });
                dayColumn.appendChild(block);
            });

            gridEl.appendChild(dayColumn);
        }
    }

    // This wires the previous and next week navigation buttons to shift the displayed week and re-render the calendar.
    function bindWeekNavigation() {
        var prevBtn = document.getElementById('prev-week-btn');
        var nextBtn = document.getElementById('next-week-btn');

        if (prevBtn) {
            prevBtn.addEventListener('click', function () {
                currentWeekStart = addDays(currentWeekStart, -7);
                rerenderScheduleViews();
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', function () {
                currentWeekStart = addDays(currentWeekStart, 7);
                rerenderScheduleViews();
            });
        }
    }

    // This wires the location hours editor modal with day selection, open and close time inputs, a closed toggle, and an apply-to-all button.
    function bindHoursModal() {
        var openBtn = document.getElementById('set-location-hours-btn');
        var closeBtn = document.getElementById('close-hours-modal');
        var backdrop = document.getElementById('hours-modal-backdrop');
        var daySelect = document.getElementById('hours-day-select');
        var startInput = document.getElementById('hours-start-input');
        var endInput = document.getElementById('hours-end-input');
        var closedCheckbox = document.getElementById('hours-closed-checkbox');
        var saveBtn = document.getElementById('save-hours-btn');
        var applyTemplateBtn = document.getElementById('apply-weekday-template-btn');

        if (!openBtn || !closeBtn || !backdrop || !daySelect || !startInput || !endInput || !closedCheckbox || !saveBtn || !applyTemplateBtn) {
            return;
        }

        function syncClosedState() {
            startInput.disabled = closedCheckbox.checked;
            endInput.disabled = closedCheckbox.checked;
        }

        function loadSelectedDayHours() {
            var hoursByDay = parseJsonFromSession(KEYS.calendarHours, {});
            var dayHours = hoursByDay[daySelect.value] || { closed: true, start: 8, end: 8 };

            startInput.value = String(dayHours.start).padStart(2, '0') + ':00';
            endInput.value = String(dayHours.end).padStart(2, '0') + ':00';
            closedCheckbox.checked = !!dayHours.closed;
            syncClosedState();
        }

        function closeModal() {
            backdrop.hidden = true;
            document.body.style.overflow = '';
        }

        function openModal() {
            loadSelectedDayHours();
            backdrop.hidden = false;
            document.body.style.overflow = 'hidden';
        }

        openBtn.addEventListener('click', openModal);
        closeBtn.addEventListener('click', closeModal);
        daySelect.addEventListener('change', loadSelectedDayHours);
        closedCheckbox.addEventListener('change', syncClosedState);

        function markDayOpenWhenEditingTime() {
            closedCheckbox.checked = false;
            syncClosedState();
        }

        startInput.addEventListener('input', markDayOpenWhenEditingTime);
        endInput.addEventListener('input', markDayOpenWhenEditingTime);

        backdrop.addEventListener('click', function (event) {
            if (event.target === backdrop) {
                closeModal();
            }
        });

        saveBtn.addEventListener('click', function () {
            var startHour = parseTimeToHour(startInput.value);
            var endHour = parseTimeToHour(endInput.value);

            if (!closedCheckbox.checked && (startHour === null || endHour === null || endHour <= startHour)) {
                alert('Please set a valid open and close time.');
                return;
            }

            var hoursByDay = parseJsonFromSession(KEYS.calendarHours, {});
            hoursByDay[daySelect.value] = {
                closed: closedCheckbox.checked,
                start: closedCheckbox.checked ? START_HOUR : startHour,
                end: closedCheckbox.checked ? START_HOUR : endHour
            };

            sessionStorage.setItem(KEYS.calendarHours, JSON.stringify(hoursByDay));
            closeModal();
            rerenderScheduleViews();
        });

        applyTemplateBtn.addEventListener('click', function () {
            var startHour = parseTimeToHour(startInput.value);
            var endHour = parseTimeToHour(endInput.value);

            if (closedCheckbox.checked || startHour === null || endHour === null || endHour <= startHour) {
                alert('Set a valid open time range before applying hours to Monday-Saturday.');
                return;
            }

            var hoursByDay = parseJsonFromSession(KEYS.calendarHours, {});

            for (var weekday = 1; weekday <= 6; weekday += 1) {
                hoursByDay[weekday] = {
                    closed: false,
                    start: startHour,
                    end: endHour
                };
            }

            sessionStorage.setItem(KEYS.calendarHours, JSON.stringify(hoursByDay));
            closeModal();
            rerenderScheduleViews();
        });
    }

    // This wires the new booking modal with name, date, and time inputs plus break conflict checking before saving to sessionStorage.
    function bindBookingModal() {
        var openBtn = document.getElementById('new-booking-btn');
        var closeBtn = document.getElementById('close-booking-modal');
        var backdrop = document.getElementById('booking-modal-backdrop');
        var titleInput = document.getElementById('booking-title-input');
        var dateInput = document.getElementById('booking-date-input');
        var startInput = document.getElementById('booking-start-input');
        var endInput = document.getElementById('booking-end-input');
        var saveBtn = document.getElementById('save-booking-btn');

        if (!openBtn || !closeBtn || !backdrop || !titleInput || !dateInput || !startInput || !endInput || !saveBtn) {
            return;
        }

        function closeModal() {
            backdrop.hidden = true;
            document.body.style.overflow = '';
        }

        function openModal() {
            var defaultDate = addDays(currentWeekStart, 1);
            dateInput.value = dateToIso(defaultDate);
            titleInput.value = '';
            startInput.value = '09:00';
            endInput.value = '11:00';

            backdrop.hidden = false;
            document.body.style.overflow = 'hidden';
        }

        openBtn.addEventListener('click', openModal);
        closeBtn.addEventListener('click', closeModal);

        backdrop.addEventListener('click', function (event) {
            if (event.target === backdrop) {
                closeModal();
            }
        });

        saveBtn.addEventListener('click', function () {
            var title = titleInput.value.trim();
            var startHour = parseTimeToHour(startInput.value);
            var endHour = parseTimeToHour(endInput.value);

            if (!title) {
                alert('Please enter a booking name.');
                return;
            }

            if (!dateInput.value) {
                alert('Please choose a date.');
                return;
            }

            if (startHour === null || endHour === null || endHour <= startHour) {
                alert('Please set a valid booking time range.');
                return;
            }

            if (isBlockedByBreak(dateInput.value, startHour, endHour)) {
                alert('This time is unavailable because the location is scheduled to be on break.');
                return;
            }

            var bookings = parseJsonFromSession(KEYS.bookings, []);
            bookings.push({
                id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
                title: title,
                date: dateInput.value,
                startHour: startHour,
                endHour: endHour,
                kind: 'booking',
                color: '#64caa0'
            });

            sessionStorage.setItem(KEYS.bookings, JSON.stringify(bookings));
            closeModal();
            rerenderScheduleViews();
        });
    }

    // This removes a booking, event, or break from sessionStorage by kind and id, then refreshes both calendar views.
    function deleteScheduleItem(kind, id, skipConfirm) {
        if (!skipConfirm && !window.confirm('Delete this ' + kind + '?')) {
            return;
        }

        var items = parseJsonFromSession(getStoreKeyForKind(kind), []);
        items = items.filter(function (item) {
            return !(item && item.id === id);
        });

        saveItemsByKind(kind, items);
        rerenderScheduleViews();
    }

    // This opens the edit modal pre-filled with the data of the selected booking, event, or break.
    function openEditScheduleItem(kind, id) {
        var backdrop = document.getElementById('edit-schedule-item-backdrop');
        var kindEl = document.getElementById('edit-schedule-item-kind');
        var titleWrap = document.getElementById('edit-title-wrap');
        var dateWrap = document.getElementById('edit-date-wrap');
        var weekdaysWrap = document.getElementById('edit-weekdays-wrap');
        var notesWrap = document.getElementById('edit-notes-wrap');
        var titleInput = document.getElementById('edit-item-title-input');
        var dateInput = document.getElementById('edit-item-date-input');
        var startInput = document.getElementById('edit-item-start-input');
        var endInput = document.getElementById('edit-item-end-input');
        var notesInput = document.getElementById('edit-item-notes-input');
        var dayButtons = document.querySelectorAll('#edit-break-days .hosting-day-btn[data-day]');
        var item = getItemByKindAndId(kind, id);

        if (!backdrop || !kindEl || !titleInput || !dateInput || !startInput || !endInput || !notesInput || !item) {
            return;
        }

        editScheduleState = { kind: kind, id: id };
        kindEl.textContent = kind === 'break' ? 'Break' : (kind === 'event' ? 'Event' : 'Booking');

        dayButtons.forEach(function (button) {
            button.classList.remove('is-selected');
        });

        if (kind === 'break') {
            titleWrap.hidden = true;
            dateWrap.hidden = false;
            dateInput.value = item.weekStart || dateToIso(currentWeekStart);
            weekdaysWrap.hidden = false;
            notesWrap.hidden = false;
            notesInput.value = item.reason || '';
            (item.weekdays || []).forEach(function (day) {
                var button = document.querySelector('#edit-break-days .hosting-day-btn[data-day="' + day + '"]');
                if (button) {
                    button.classList.add('is-selected');
                }
            });
        } else {
            titleWrap.hidden = false;
            dateWrap.hidden = false;
            weekdaysWrap.hidden = true;
            notesWrap.hidden = kind !== 'event';
            titleInput.value = item.title || '';
            dateInput.value = item.date || '';
            notesInput.value = kind === 'event' ? (item.locationNotes || '') : '';
        }

        startInput.value = toTimeInputValue(item.startHour);
        endInput.value = toTimeInputValue(item.endHour);
        backdrop.hidden = false;
        document.body.style.overflow = 'hidden';
    }

    // This wires the edit modal's close, save, and delete buttons with full validation and conflict checking.
    function bindEditScheduleModal() {
        var backdrop = document.getElementById('edit-schedule-item-backdrop');
        var closeBtn = document.getElementById('close-edit-schedule-item');
        var saveBtn = document.getElementById('save-edit-schedule-item');
        var deleteBtn = document.getElementById('delete-schedule-item');
        var titleInput = document.getElementById('edit-item-title-input');
        var dateInput = document.getElementById('edit-item-date-input');
        var startInput = document.getElementById('edit-item-start-input');
        var endInput = document.getElementById('edit-item-end-input');
        var notesInput = document.getElementById('edit-item-notes-input');
        var dayButtons = document.querySelectorAll('#edit-break-days .hosting-day-btn[data-day]');

        if (!backdrop || !closeBtn || !saveBtn || !deleteBtn || !titleInput || !dateInput || !startInput || !endInput || !notesInput || !dayButtons.length) {
            return;
        }

        function closeModal() {
            backdrop.hidden = true;
            document.body.style.overflow = '';
            editScheduleState = null;
        }

        closeBtn.addEventListener('click', closeModal);
        backdrop.addEventListener('click', function (event) {
            if (event.target === backdrop) {
                closeModal();
            }
        });

        dayButtons.forEach(function (button) {
            button.addEventListener('click', function () {
                button.classList.toggle('is-selected');
            });
        });

        saveBtn.addEventListener('click', function () {
            if (!editScheduleState) {
                return;
            }

            var kind = editScheduleState.kind;
            var id = editScheduleState.id;
            var items = parseJsonFromSession(getStoreKeyForKind(kind), []);
            var item = getItemByKindAndId(kind, id);
            var startHour = parseTimeToHour(startInput.value);
            var endHour = parseTimeToHour(endInput.value);

            if (!item) {
                closeModal();
                return;
            }

            if (startHour === null || endHour === null || endHour <= startHour) {
                alert('Please set a valid time range.');
                return;
            }

            if (kind === 'break') {
                var weekdays = [];
                var weekStartIso = dateToIso(getWeekStart(new Date((dateInput.value || dateToIso(currentWeekStart)) + 'T00:00:00')));
                dayButtons.forEach(function (button) {
                    if (button.classList.contains('is-selected')) {
                        weekdays.push(parseInt(button.getAttribute('data-day'), 10));
                    }
                });

                if (!weekdays.length) {
                    alert('Select at least one day for this break.');
                    return;
                }

                if (breakOverlapsExistingItems(weekdays, startHour, endHour, weekStartIso, kind, id)) {
                    alert('This break overlaps an existing booking or event.');
                    return;
                }

                item.weekStart = weekStartIso;
                item.weekdays = weekdays;
                item.startHour = startHour;
                item.endHour = endHour;
                item.reason = notesInput.value.trim();
            } else {
                if (!dateInput.value) {
                    alert('Please choose a date.');
                    return;
                }

                if (isBlockedByBreak(dateInput.value, startHour, endHour, null)) {
                    alert('This time is unavailable because the location is scheduled to be on break.');
                    return;
                }

                item.title = titleInput.value.trim() || (kind === 'event' ? 'Untitled Event' : 'Untitled Booking');
                item.date = dateInput.value;
                item.startHour = startHour;
                item.endHour = endHour;

                if (kind === 'event') {
                    item.locationNotes = notesInput.value.trim();
                }
            }

            items = items.map(function (entry) {
                return entry && entry.id === item.id ? item : entry;
            });
            saveItemsByKind(kind, items);
            closeModal();
            rerenderScheduleViews();
        });

        deleteBtn.addEventListener('click', function () {
            if (!editScheduleState) {
                return;
            }

            deleteScheduleItem(editScheduleState.kind, editScheduleState.id, true);
            closeModal();
        });
    }

    // This runs all setup steps in order when the page finishes loading.
    function init() {
        purgeSeedLocation();
        if (resetGuestSessionOnReload()) { return; }
        if (!enforceAccess()) { return; }
        ensureCalendarSeedData();
        setCalendarContext();
        bindWeekNavigation();
        bindHoursModal();
        bindBookingModal();
        bindEditScheduleModal();
        rerenderScheduleViews();
    }

    document.addEventListener('DOMContentLoaded', init);
})();
